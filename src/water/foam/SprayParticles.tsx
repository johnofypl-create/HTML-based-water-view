/**
 * @module water/foam/SprayParticles
 * @layer water（域层）
 * @purpose 飞溅粒子层（InstancedMesh + billboard 四边形 + TSL 弹道）—— WebGPU 版
 * @dependsOn ['config/constants', 'water/surface/gerstner', 'water/surface/waterSurface', 'state/splashBus', 'water/state/splashTargets', 'water/foam/sprayShader']
 * @exports [SprayParticles, SprayParticles]
 * @aiEdit
 *   - 调粒子数/寿命/尺寸 → config/spray.ts；调触发逻辑 → 本文件 spawn 段
 */
/**
 * 飞溅粒子（浪花 / 水花）组件 —— WebGPU/TSL 版
 *
 * 原实现：THREE.Points + ShaderMaterial（gl_PointSize）；WebGPU 不支持 gl_PointSize
 * → 改为 InstancedMesh（静态四边形） + MeshStandardNodeMaterial + positionNode（弹道
 * + billboard）+ colorNode/opacityNode（软圆点 + 淡入淡出）。
 *
 * 性能：4096 实例 × 6 顶点 = 24576 顶点，单 draw call。
 * 触发源不变：A. 波峰碎浪 / B. splashBus 预留 / C. 礁石拍浪。
 */
import { useMemo, useRef, useLayoutEffect } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three/webgpu'
import * as TSL from 'three/tsl'
import { SPRAY, WATER_LEVEL } from '../../config/constants'
import { sampleGerstner, primaryWindDir } from '../surface/gerstner'
import { sampleWaterSurface } from '../surface/waterSurface'
import { splashBus } from '../../state/splashBus'
import { getSplashTargets, tickSplashTargetCooldowns } from '../state/splashTargets'
import { sprayBallistic, sprayColor, sprayAlpha } from './sprayShader'

const {
  Fn,
  uniform,
  positionLocal,
  attribute,
  float,
  vec3,
  vec4,
  normalize,
  cross,
  clamp,
  smoothstep,
  mix,
  length,
} = TSL as any

const N = SPRAY.count

export default function SprayParticles() {
  const { gl } = useThree()

  // ========== 粒子属性缓冲（环形缓冲，head 指向下一个写入槽）==========
  const buffers = useMemo(() => {
    const aSpawnPos = new Float32Array(N * 3) // spawn 世界位置（新属性，原是 geometry.position）
    const aVel = new Float32Array(N * 3)
    const aSpawnTime = new Float32Array(N).fill(-1e9) // 初始全「死亡」
    const aLife = new Float32Array(N).fill(1)
    const aSeed = new Float32Array(N)
    for (let i = 0; i < N; i++) aSeed[i] = Math.random()
    return { aSpawnPos, aVel, aSpawnTime, aLife, aSeed }
  }, [])

  // ========== 四边形几何体（每个实例 = 1 四边形，6 顶点）==========
  const quadGeo = useMemo(() => {
    const g = new THREE.BufferGeometry()
    const vert = new Float32Array([
      -0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0,
      -0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0,
    ])
    const norms = new Float32Array([
      0, 0, 1, 0, 0, 1, 0, 0, 1,
      0, 0, 1, 0, 0, 1, 0, 0, 1,
    ])
    const uvs = new Float32Array([
      0, 0, 1, 0, 1, 1,
      0, 0, 1, 1, 0, 1,
    ])
    g.setAttribute('position', new THREE.BufferAttribute(vert, 3))
    g.setAttribute('normal', new THREE.BufferAttribute(norms, 3))
    g.setAttribute('uv', new THREE.BufferAttribute(uvs, 2))
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 200)
    return g
  }, [])

  // ========== TSL 材质 ==========
  const material = useMemo(() => {
    // Uniform 节点
    const uTime = uniform(0)
    const uGravity = uniform(SPRAY.gravity)
    const uSize = uniform(SPRAY.size)
    const uCameraPos = uniform(new THREE.Vector3())
    const uPixelRatio = uniform(Math.min(gl.getPixelRatio(), 2))
    const uFoamCol = uniform(new THREE.Color('#f4f0e6'))
    const uOpacity = uniform(SPRAY.opacity)

    const mat = new THREE.MeshStandardNodeMaterial()
    mat.flatShading = true
    mat.transparent = true
    mat.depthWrite = false
    mat.blending = THREE.NormalBlending
    mat.side = THREE.DoubleSide
    mat.polygonOffset = true
    mat.polygonOffsetFactor = -1

    // ---- positionNode: 弹道 + billboard ----
    mat.positionNode = Fn(() => {
      // 读取实例属性
      const spawnPos = attribute('aSpawnPos')
      const vel = attribute('aVel')
      const spawnTime = attribute('aSpawnTime')
      const life = attribute('aLife')

      const age = uTime.sub(spawnTime)
      const lifeT = age.div(life)
      const gravVec = vec3(0.0, uGravity, 0.0)

      // 弹道：中心 = spawnPos + vel*age + 0.5*gravity*age²
      const center = spawnPos.add(vel.mul(age)).add(gravVec.mul(age).mul(age).mul(0.5))

      // Billboard：四边形顶点方向
      const toCam = normalize(uCameraPos.sub(center))
      const worldRight = normalize(cross(vec3(0.0, 1.0, 0.0), toCam))
      const worldUp = normalize(cross(toCam, worldRight))

      // 尺寸衰减
      const s = uSize.mul(clamp(float(1.0).sub(lifeT.mul(0.7)), 0.0, 1.0))

      // 四边形偏移（positionLocal.xy 为四边形顶点坐标 [-0.5, 0.5]）
      const offset = worldRight.mul(positionLocal.x.mul(s)).add(worldUp.mul(positionLocal.y.mul(s)))
      const worldPos = center.add(offset)

      // 死亡粒子推到原点（alpha=0 不可见，碰撞检测安全）
      const isDead = age.lessThan(0.0).or(age.greaterThan(life))
      return isDead.select(center, worldPos)
    })()

    // ---- colorNode: 软圆点 + 中心辉光 ----
    mat.colorNode = Fn(() => {
      const aSeed = attribute('aSeed')
      const d = length(positionLocal.xy)
      // 中心亮 → 模拟水珠高光
      return mix(uFoamCol, vec3(1.0, 1.0, 1.0), clamp(float(1.0).sub(d.mul(2.0)), 0.0, 1.0).mul(0.45))
    })()

    // ---- opacityNode: 圆盘衰减 + 淡入淡出 ----
    mat.opacityNode = Fn(() => {
      const spawnTime = attribute('aSpawnTime')
      const life = attribute('aLife')

      const age = uTime.sub(spawnTime)
      const lifeT = age.div(life)

      // 圆盘形状
      const d = length(positionLocal.xy)
      const circleAlpha = clamp(float(1.0).sub(smoothstep(0.12, 0.5, d)), 0.0, 1.0)

      // 寿命淡入（前8%）+ 淡出
      const fadeIn = smoothstep(0.0, 0.08, lifeT)
      const fadeOut = clamp(float(1.0).sub(lifeT), 0.0, 1.0)
      const lifeFade = fadeOut.mul(fadeIn)

      // 死亡粒子 alpha=0
      const isDead = age.lessThan(0.0).or(age.greaterThan(life))
      return isDead.select(float(0.0), lifeFade.mul(circleAlpha).mul(uOpacity))
    })()

    // 暴露 uniform 引用供 useFrame 写入
    ;(mat as any).sprayUniforms = { uTime, uGravity, uSize, uCameraPos, uPixelRatio, uFoamCol, uOpacity }

    return mat
  }, [gl])

  // ========== 环形缓冲 / 节流 / 活跃计数 ==========
  const head = useRef(0)
  const dirty = useRef(false)
  const frameSpawn = useRef(0)
  const secondSpawn = useRef(0)
  const secondTimer = useRef(0)
  const alive = useRef(0)
  const timeRef = useRef(0)
  const meshRef = useRef<THREE.InstancedMesh>(null)

  // 风方向（首波方向）
  const windDir = useMemo(() => {
    const [x, z] = primaryWindDir()
    return new THREE.Vector2(x, z).normalize()
  }, [])

  /** 写入单个粒子到 head 槽 */
  const spawn = (pos: THREE.Vector3, vel: THREE.Vector3, life: number, time: number) => {
    if (frameSpawn.current >= SPRAY.perFrameMax) return
    if (secondSpawn.current >= SPRAY.perSecondMax) return
    const i = head.current
    buffers.aSpawnPos[i * 3] = pos.x
    buffers.aSpawnPos[i * 3 + 1] = pos.y
    buffers.aSpawnPos[i * 3 + 2] = pos.z
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

  /** A. 波峰自动碎浪 */
  const emitCrest = (t: number) => {
    const G = SPRAY.scanGrid
    const ext = SPRAY.scanExtent
    const cell = (ext * 2) / G
    const s = scanState.current
    const rowsThisFrame = Math.max(1, Math.floor(G / 3))
    for (let r = 0; r < rowsThisFrame; r++) {
      const zi = (s.step + r) % G
      const z = -ext + (zi + 0.5) * cell
      for (let xi = 0; xi < G; xi++) {
        const x = -ext + (xi + 0.5) * cell
        const g = sampleGerstner(x, z, t)
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
            spawn(pos, vel, SPRAY.life * (0.6 + Math.random() * 0.8), t)
          }
        }
      }
    }
    s.step = (s.step + rowsThisFrame) % G
  }

  /** B. 地形改造溅水 */
  const burst = (pos: THREE.Vector3, intensity: number) => {
    const t = timeRef.current
    const count = Math.max(1, Math.round(intensity * SPRAY.splashPerIntensity))
    for (let i = 0; i < count; i++) {
      const ang = Math.random() * Math.PI * 2
      const rad = (0.3 + Math.random() * 1.0) * Math.min(1, intensity) * 0.8
      const up = (0.5 + Math.random() * 1.0) * (0.6 + intensity * 0.6)
      const pos2 = new THREE.Vector3(pos.x + Math.cos(ang) * rad, pos.y + 0.05, pos.z + Math.sin(ang) * rad)
      const vel = new THREE.Vector3(Math.cos(ang) * rad * 0.8, up, Math.sin(ang) * rad * 0.8)
      spawn(pos2, vel, SPRAY.life * (0.6 + Math.random() * 0.8), t)
    }
  }

  /** C. 礁石拍浪 */
  const emitRocks = (t: number) => {
    const targets = getSplashTargets()
    for (const tg of targets) {
      if (tg.cooldown > 0) continue
      const surf = sampleWaterSurface(tg.pos.x, tg.pos.z, t)
      const submerge = surf.surfaceY - tg.waterlineY
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
          spawn(pos, vel, SPRAY.life * (0.6 + Math.random() * 0.8), t)
        }
        tg.cooldown = SPRAY.rockCooldown
      }
    }
  }

  // 订阅 splashBus
  useLayoutEffect(() => {
    const off = splashBus.on((e) => burst(e.pos, e.intensity))
    return off
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 创建并设置实例属性
  useLayoutEffect(() => {
    const mesh = meshRef.current
    if (!mesh) return

    // 设置 identity 实例矩阵（位置在 TSL positionNode 中计算）
    const m = new THREE.Matrix4()
    m.identity()
    for (let i = 0; i < N; i++) mesh.setMatrixAt(i, m)
    mesh.instanceMatrix.needsUpdate = true

    // 实例属性（InstancedBufferAttribute，每实例一个值）
    mesh.geometry.setAttribute('aSpawnPos', new THREE.InstancedBufferAttribute(buffers.aSpawnPos, 3))
    mesh.geometry.setAttribute('aVel', new THREE.InstancedBufferAttribute(buffers.aVel, 3))
    mesh.geometry.setAttribute('aSpawnTime', new THREE.InstancedBufferAttribute(buffers.aSpawnTime, 1))
    mesh.geometry.setAttribute('aLife', new THREE.InstancedBufferAttribute(buffers.aLife, 1))
    mesh.geometry.setAttribute('aSeed', new THREE.InstancedBufferAttribute(buffers.aSeed, 1))
  }, [buffers])

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime
    timeRef.current = t

    // 重置每帧节流
    frameSpawn.current = 0
    secondTimer.current += delta
    if (secondTimer.current >= 1) { secondTimer.current -= 1; secondSpawn.current = 0 }
    tickSplashTargetCooldowns(delta)

    // 三发射源
    emitCrest(t)
    emitRocks(t)

    // 上传脏的属性缓冲
    if (dirty.current && meshRef.current) {
      const g = meshRef.current.geometry
      ;(g.attributes.aSpawnPos as THREE.BufferAttribute).needsUpdate = true
      ;(g.attributes.aVel as THREE.BufferAttribute).needsUpdate = true
      ;(g.attributes.aSpawnTime as THREE.BufferAttribute).needsUpdate = true
      ;(g.attributes.aLife as THREE.BufferAttribute).needsUpdate = true
      dirty.current = false
      alive.current = Math.max(0, alive.current - alive.current * (delta / SPRAY.life))
      if (alive.current > 0) state.invalidate()
    }

    // 更新 TSL uniform
    const su = (material as any).sprayUniforms
    if (su) {
      su.uTime.value = t
      su.uCameraPos.value.copy(state.camera.position)
    }
  })

  return (
    <instancedMesh
      ref={meshRef}
      args={[quadGeo, material, N]}
      frustumCulled={false}
      renderOrder={3}
    />
  )
}
