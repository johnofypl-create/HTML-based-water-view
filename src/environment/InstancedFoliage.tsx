/**
 * 通用实例化植被组件
 * 接收几何/材质/实例数据/摇摆参数，创建 InstancedMesh + aPhase 实例属性，
 * useFrame 更新 uTime 与风强度（午后略强）。
 */
import { useMemo, useRef, useLayoutEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { VegetationInstance } from '../utils/sampling'
import { makeSwayMaterial, SwayOpts, SwayUniforms } from '../animation/vertexShaders'
import { lightingState } from '../state/lightingState'

interface Props {
  geometry: THREE.BufferGeometry
  baseMaterial: THREE.MeshStandardMaterial
  instances: VegetationInstance[]
  sway: SwayOpts
  /** 实例缩放基数 */
  scaleBase?: number
  /** 缩放随机范围 */
  scaleJitter?: number
  /** 是否贴法线倾斜（草贴地，树一般不贴） */
  alignNormal?: boolean
  /** Y 偏移（陷入地面） */
  ySink?: number
  /** 颜色变化回调（返回每实例颜色） */
  colorFor?: (inst: VegetationInstance, i: number) => THREE.Color | null
  castShadow?: boolean
  receiveShadow?: boolean
}

export default function InstancedFoliage({
  geometry,
  baseMaterial,
  instances,
  sway,
  scaleBase = 1,
  scaleJitter = 0.2,
  alignNormal = false,
  ySink = 0,
  colorFor,
  castShadow = true,
  receiveShadow = true,
}: Props) {
  const { material, uniforms } = useMemo(
    () => makeSwayMaterial(baseMaterial, sway),
    [baseMaterial, sway],
  )
  const meshRef = useRef<THREE.InstancedMesh>(null)

  // aPhase 实例属性（直接设置到 geometry，避免 R3F attach 路径问题）
  const phaseAttr = useMemo(() => {
    const arr = new Float32Array(instances.length)
    instances.forEach((inst, i) => (arr[i] = inst.phase / (Math.PI * 2)))
    return new THREE.InstancedBufferAttribute(arr, 1)
  }, [instances])

  useLayoutEffect(() => {
    // 把 aPhase 设到 geometry 上
    geometry.setAttribute('aPhase', phaseAttr)
  }, [geometry, phaseAttr])

  useLayoutEffect(() => {
    const mesh = meshRef.current
    if (!mesh) return
    const m = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    const up = new THREE.Vector3(0, 1, 0)
    const normal = new THREE.Vector3()
    const pos = new THREE.Vector3()
    const scl = new THREE.Vector3()
    const qy = new THREE.Quaternion()

    instances.forEach((inst, i) => {
      pos.set(inst.position[0], inst.position[1] - ySink, inst.position[2])
      if (alignNormal) {
        normal.set(inst.normal[0], inst.normal[1], inst.normal[2])
        q.setFromUnitVectors(up, normal)
      } else {
        q.identity()
      }
      qy.setFromAxisAngle(up, inst.rotationY)
      q.premultiply(qy)
      const s = scaleBase * inst.scale * (1 - scaleJitter * 0.5 + Math.random() * scaleJitter)
      scl.set(s, s, s)
      m.compose(pos, q, scl)
      mesh.setMatrixAt(i, m)
      if (colorFor) {
        const col = colorFor(inst, i)
        if (col) mesh.setColorAt(i, col)
      }
    })
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  }, [instances, scaleBase, scaleJitter, alignNormal, ySink, colorFor])

  useFrame((_, delta) => {
    uniforms.uTime.value += delta
    // 风强度：午后略强，夜晚弱
    const tod = lightingState.timeOfDay
    const dayFactor = Math.max(0, Math.sin(((tod - 6) / 12) * Math.PI))
    uniforms.uWindStrength.value = 0.5 + dayFactor * 0.8
    // 风向缓慢变化
    const ang = uniforms.uTime.value * 0.05
    uniforms.uWindDir.value.set(Math.cos(ang) * 0.7 + 0.3, Math.sin(ang) * 0.4).normalize()
  })

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, material, instances.length]}
      castShadow={castShadow}
      receiveShadow={receiveShadow}
    />
  )
}
