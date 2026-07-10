/**
 * 岩石（InstancedMesh）
 * 低多边形 IcosahedronGeometry + flatShading，暖灰标准材质。
 * 用 sampling 采样放置（含浅水区）。阶段2 会并入完整 Vegetation 总管。
 */
import { useMemo, useRef, useLayoutEffect } from 'react'
import * as THREE from 'three'
import { sampleVegetation } from '../utils/sampling'
import { PERF, SEED } from '../config/constants'
import { registerSplashTarget } from '../water/splashTargets'

export default function Rocks() {
  const meshRef = useRef<THREE.InstancedMesh>(null)

  const geometry = useMemo(() => {
    const g = new THREE.IcosahedronGeometry(1, 0)
    // 随机扰动顶点增加风化感
    const pos = g.attributes.position as THREE.BufferAttribute
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i)
      const y = pos.getY(i)
      const z = pos.getZ(i)
      const n = 0.15 * (Math.sin(x * 12.9 + y * 78.2) * 0.5 + 0.5)
      pos.setXYZ(i, x + n, y + n * 0.7, z - n * 0.5)
    }
    g.computeVertexNormals()
    return g
  }, [])

  const material = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: new THREE.Color('#8a8078'),
        roughness: 0.95,
        metalness: 0.02,
        flatShading: true,
      }),
    [],
  )

  const instances = useMemo(
    () => sampleVegetation('rock', PERF.rockCount, SEED, false),
    [],
  )

  useLayoutEffect(() => {
    const mesh = meshRef.current
    if (!mesh) return
    const m = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    const up = new THREE.Vector3(0, 1, 0)
    const normal = new THREE.Vector3()
    const pos = new THREE.Vector3()
    const scl = new THREE.Vector3()
    const euler = new THREE.Euler()

    instances.forEach((inst, i) => {
      pos.set(...inst.position)
      // 略微陷入地面
      pos.y -= inst.scale * 0.15
      normal.set(...inst.normal)
      q.setFromUnitVectors(up, normal)
      // 叠加 Y 旋转
      const qy = new THREE.Quaternion().setFromEuler(
        new THREE.Euler(0, inst.rotationY, 0),
      )
      q.premultiply(qy)
      // 不规则缩放：扁
      const s = inst.scale * (0.8 + Math.random() * 0.4)
      scl.set(s * 1.1, s * 0.7, s * 1.0)
      m.compose(pos, q, scl)
      mesh.setMatrixAt(i, m)
      // 顶点色变化
      mesh.setColorAt(i, new THREE.Color().setHSL(0.08, 0.05, 0.42 + Math.random() * 0.12))
    })
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  }, [instances])

  // 把每个岩石登记为溅水目标（礁石拍浪），卸载时注销
  useLayoutEffect(() => {
    const offs = instances.map((inst) => {
      const [x, y, z] = inst.position
      const waterlineY = y + inst.scale * 0.2 // 岩石顶约在中心 + 0.2×scale
      return registerSplashTarget({
        pos: new THREE.Vector3(x, waterlineY, z),
        radius: inst.scale,
        waterlineY,
        phase: Math.random() * Math.PI * 2,
      })
    })
    return () => offs.forEach((o) => o())
  }, [instances])

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, material, instances.length]}
      castShadow
      receiveShadow
    />
  )
}
