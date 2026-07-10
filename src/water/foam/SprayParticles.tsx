/**
 * @module water/foam/SprayParticles
 * @layer water（域层）
 * @purpose 轻量 GPU 飞溅粒子层（环形缓冲 + 闭式弹道 + 三触发源）
 * @dependsOn ['config/constants', 'water/surface/gerstner', 'water/surface/waterSurface', 'state/splashBus', 'water/state/splashTargets', 'water/foam/sprayShader']
 * @exports [SprayParticles, SprayParticles]
 * @aiEdit
 *   - 调粒子数/寿命/尺寸 → 改 config/spray.ts；调触发逻辑 → 改本文件 spawn 段（波峰/地形事件/礁石拍浪）
 */
/**
 * 飞溅粒子（浪花 / 水花）组件
 *
 * 固定粒子池 + 顶点着色器闭式弹道积分（「无状态」GPU 粒子）：
 *   - 顶点着色器按 age 求轨迹，GPU 仅做求值 + 淡出 + 软圆点；
 *   - 发射完全事件驱动（CPU 写属性），1 个 draw call。
 *
 * 三种发射源：
 *   A. 波峰自动碎浪：Jacobian 阈值扫描，波面折叠/破碎处自动喷雾；
 *   B. 地形改造溅水：订阅 splashBus，收到事件即在中心 burst（对接缝）；
 *   C. 礁石拍浪：读取 splashTargets 注册表，浪涌过水位线时迎风侧起花。
 *
 * 性能 / demand 协调：
 *   - 显存 ~144KB，单 draw call；
 *   - 有活粒子 / 有发射帧才 needsUpdate + invalidate，否则静默。
 */
import { useMemo, useRef, useLayoutEffect } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { SPRAY, WATER_LEVEL } from '../../config/constants'
import { sampleGerstner, primaryWindDir } from '../surface/gerstner'
import { sampleWaterSurface } from '../surface/waterSurface'
import { splashBus } from '../../state/splashBus'
import { getSplashTargets, tickSplashTargetCooldowns } from '../state/splashTargets'
import { sprayVertexShader, sprayFragmentShader } from './sprayShader'

const N = SPRAY.count

export default function SprayParticles() {
  const { gl } = useThree()

  // ── 粒子属性缓冲（环形缓冲，head 指向下一个写入槽） ──
  const buffers = useMemo(() => {
    const position = new Float32Array(N * 3) // spawn 位置
    const aVel = new Float32Array(N * 3)
    const aSpawnTime = new Float32Array(N).fill(-1e9) // 初始全「死亡」
    const aLife = new Float32Array(N).fill(1)
    const aSeed = new Float32Array(N)
    for (let i = 0; i < N; i++) aSeed[i] = Math.random()
    return { position, aVel, aSpawnTime, aLife, aSeed }
  }, [])

  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(buffers.position, 3))
    g.setAttribute('aVel', new THREE.BufferAttribute(buffers.aVel, 3))
    g.setAttribute('aSpawnTime', new THREE.BufferAttribute(buffers.aSpawnTime, 1))
    g.setAttribute('aLife', new THREE.BufferAttribute(buffers.aLife, 1))
    g.setAttribute('aSeed', new THREE.BufferAttribute(buffers.aSeed, 1))
    // 粒子会飞出原 spawn 位置，用大包围球 + 关闭视锥裁剪，避免被裁掉
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 5, 0), 200)
    return g
  }, [buffers])

  const material = useMemo(() => {
    return new THREE.ShaderMaterial({
      vertexShader: sprayVertexShader,
      fragmentShader: sprayFragmentShader,
      transparent: true,
      depthWrite: false,
      blending: THREE.NormalBlending,
      uniforms: {
        uTime: { value: 0 },
        uGravity: { value: SPRAY.gravity },
        uSize: { value: SPRAY.size },
        uPixelRatio: { value: Math.min(gl.getPixelRatio(), 2) },
        uFoamCol: { value: new THREE.Color('#f4f0e6') },
        uOpacity: { value: SPRAY.opacity },
      },
    })
  }, [gl])

  // ── 环形缓冲 / 节流 / 活跃计数 ──
  const head = useRef(0)
  const dirty = useRef(false)
  const frameSpawn = useRef(0)
  const secondSpawn = useRef(0)
  const secondTimer = useRef(0)
  const alive = useRef(0)
  const timeRef = useRef(0) // 与着色器 uTime 严格同步（供 burst 用）

  // 风方向（首波方向，xz 归一化）
  const windDir = useMemo(() => {
    const [x, z] = primaryWindDir()
    return new THREE.Vector2(x, z).normalize()
  }, [])

  /** 写入单个粒子到 head 槽（受全局节流约束） */
  const spawn = (pos: THREE.Vector3, vel: THREE.Vector3, life: number, time: number) => {
    if (frameSpawn.current >= SPRAY.perFrameMax) return
    if (secondSpawn.current >= SPRAY.perSecondMax) return
    const i = head.current
    buffers.position[i * 3] = pos.x
    buffers.position[i * 3 + 1] = pos.y
    buffers.position[i * 3 + 2] = pos.z
    buffers.aVel[i * 3] = vel.x
    buffers.aVel[i * 3 + 1] = vel.y
    buffers.aVel[i * 3 + 2] = vel.z
    buffers.aSpawnTime[i] = time
    buffers.aLife[i] = life
    head.current = (i + 1) % N
    frameSpawn.current++
    secondSpawn.current++
    alive.current++
    dirty.current = true
  }

  // 波峰碎浪扫描游标
  const scanState = useRef({ step: 0 })

  /** A. 波峰自动碎浪：Jacobian 阈值扫描 */
  const emitCrest = (t: number) => {
    const G = SPRAY.scanGrid
    const ext = SPRAY.scanExtent
    const cell = (ext * 2) / G
    // 每帧推进 ~1/3 的扫描行，3 帧一轮（分摊 CPU 开销）
    const s = scanState.current
    const rowsThisFrame = Math.max(1, Math.floor(G / 3))
    for (let r = 0; r < rowsThisFrame; r++) {
      const zi = (s.step + r) % G
      const z = -ext + (zi + 0.5) * cell
      for (let xi = 0; xi < G; xi++) {
        const x = -ext + (xi + 0.5) * cell
        const g = sampleGerstner(x, z, t)
        // J 跌破阈值（即将折叠破碎）且波处于上升段 → 喷发
        if (g.jacobian < SPRAY.crestJacMargin && g.heightRate > 0) {
          const n = 1 + (Math.random() < 0.5 ? 1 : 0)
          for (let k = 0; k < n; k++) {
            const px = x + (Math.random() - 0.5) * cell
            const pz = z + (Math.random() - 0.5) * cell
            const py = WATER_LEVEL + g.height
            const up = 0.6 + Math.random() * 0.9
            const w = 0.3 + Math.random() * 0.6
            const pos = new THREE.Vector3(px, py, pz)
            const vel = new THREE.Vector3(
              windDir.x * w + (Math.random() - 0.5) * 0.25,
              up,
              windDir.y * w + (Math.random() - 0.5) * 0.25,
            )
            const life = SPRAY.life * (0.6 + Math.random() * 0.8)
            spawn(pos, vel, life, t)
          }
        }
      }
    }
    s.step = (s.step + rowsThisFrame) % G
  }

  /** B. 地形改造溅水：burst（对接缝，当前无地形编辑器故不主动触发） */
  const burst = (pos: THREE.Vector3, intensity: number) => {
    const t = timeRef.current
    const count = Math.max(1, Math.round(intensity * SPRAY.splashPerIntensity))
    for (let i = 0; i < count; i++) {
      const ang = Math.random() * Math.PI * 2
      const rad = (0.3 + Math.random() * 1.0) * Math.min(1, intensity) * 0.8
      const up = (0.5 + Math.random() * 1.0) * (0.6 + intensity * 0.6)
      const pos2 = new THREE.Vector3(
        pos.x + Math.cos(ang) * rad,
        pos.y + 0.05,
        pos.z + Math.sin(ang) * rad,
      )
      const vel = new THREE.Vector3(
        Math.cos(ang) * rad * 0.8,
        up,
        Math.sin(ang) * rad * 0.8,
      )
      const life = SPRAY.life * (0.6 + Math.random() * 0.8)
      spawn(pos2, vel, life, t)
    }
  }

  /** C. 礁石拍浪：浪涌过水位线时迎风侧起花 */
  const emitRocks = (t: number) => {
    const targets = getSplashTargets()
    for (const tg of targets) {
      if (tg.cooldown > 0) continue
      const surf = sampleWaterSurface(tg.pos.x, tg.pos.z, t)
      const submerge = surf.surfaceY - tg.waterlineY
      // 浪涌过水位线（上升段）才拍花
      if (submerge > 0 && surf.heightRate > 0) {
        const px = tg.pos.x + windDir.x * tg.radius
        const pz = tg.pos.z + windDir.y * tg.radius
        const n = 2 + Math.floor(Math.random() * 3)
        for (let k = 0; k < n; k++) {
          const pos = new THREE.Vector3(
            px + (Math.random() - 0.5) * tg.radius * 0.6,
            tg.waterlineY + 0.02,
            pz + (Math.random() - 0.5) * tg.radius * 0.6,
          )
          const up = 0.4 + Math.random() * 0.7
          const w = 0.5 + Math.random() * 0.7
          const vel = new THREE.Vector3(
            windDir.x * w + (Math.random() - 0.5) * 0.3,
            up,
            windDir.y * w + (Math.random() - 0.5) * 0.3,
          )
          const life = SPRAY.life * (0.6 + Math.random() * 0.8)
          spawn(pos, vel, life, t)
        }
        tg.cooldown = SPRAY.rockCooldown
      }
    }
  }

  // 订阅 splashBus（对接未来地形改造系统）
  useLayoutEffect(() => {
    const off = splashBus.on((e) => burst(e.pos, e.intensity))
    return off
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime
    timeRef.current = t

    // 重置每帧/每秒节流
    frameSpawn.current = 0
    secondTimer.current += delta
    if (secondTimer.current >= 1) {
      secondTimer.current -= 1
      secondSpawn.current = 0
    }
    tickSplashTargetCooldowns(delta)

    // 三发射源
    emitCrest(t)
    emitRocks(t)

    // 仅在产生 spawn 的帧上传属性缓冲
    if (dirty.current) {
      const pa = geometry.attributes.position as THREE.BufferAttribute
      const va = geometry.attributes.aVel as THREE.BufferAttribute
      const sa = geometry.attributes.aSpawnTime as THREE.BufferAttribute
      const la = geometry.attributes.aLife as THREE.BufferAttribute
      pa.needsUpdate = true
      va.needsUpdate = true
      sa.needsUpdate = true
      la.needsUpdate = true
      dirty.current = false
      // 粗略过期估算（按平均寿命衰减），用于 demand 保活判断
      alive.current = Math.max(0, alive.current - alive.current * (delta / SPRAY.life))
      if (alive.current > 0) state.invalidate()
    }

    material.uniforms.uTime.value = t
  })

  return (
    <points geometry={geometry} material={material} renderOrder={3} frustumCulled={false} />
  )
}
