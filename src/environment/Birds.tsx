/**
 * 飞鸟
 * 几只鸟沿大圆路径飞行，翅膀扇动。简单 V 形几何。
 */
import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { WORLD_SIZE } from '../config/constants'

export default function Birds() {
  const groupRef = useRef<THREE.Group>(null)
  const wingRefs = useRef<THREE.Mesh[]>([])

  const birds = useMemo(() => {
    const rng = mulberry(321)
    const arr: { radius: number; speed: number; height: number; phase: number; offset: number }[] = []
    for (let i = 0; i < 7; i++) {
      arr.push({
        radius: WORLD_SIZE * (0.35 + rng() * 0.2),
        speed: 0.08 + rng() * 0.06,
        height: 16 + rng() * 8,
        phase: rng() * Math.PI * 2,
        offset: rng() * Math.PI * 2,
      })
    }
    return arr
  }, [])

  // V 形翅膀几何
  const wingGeo = useMemo(() => {
    const g = new THREE.BufferGeometry()
    // 两个三角片组成 V
    const verts = new Float32Array([
      0, 0, 0,   -0.5, 0, 0.3,   -0.2, 0, 0.1,
      0, 0, 0,   0.2, 0, 0.1,    0.5, 0, 0.3,
    ])
    g.setAttribute('position', new THREE.BufferAttribute(verts, 3))
    g.computeVertexNormals()
    return g
  }, [])

  const birdMat = useMemo(
    () => new THREE.MeshBasicMaterial({ color: 0x2a2a2a, side: THREE.DoubleSide }),
    [],
  )

  useFrame((state) => {
    const t = state.clock.elapsedTime
    if (!groupRef.current) return
    groupRef.current.children.forEach((child, i) => {
      const b = birds[i]
      const ang = t * b.speed + b.offset
      child.position.set(
        Math.cos(ang) * b.radius,
        b.height + Math.sin(ang * 2) * 1.5,
        Math.sin(ang) * b.radius,
      )
      // 朝向飞行方向
      child.rotation.y = -ang + Math.PI / 2
      // 翅膀扇动
      const wing = wingRefs.current[i]
      if (wing) wing.rotation.z = Math.sin(t * 8 + b.phase) * 0.5
    })
  })

  return (
    <group ref={groupRef}>
      {birds.map((_, i) => (
        <mesh key={i} geometry={wingGeo} material={birdMat} ref={(r) => { if (r) wingRefs.current[i] = r }} />
      ))}
    </group>
  )
}

function mulberry(seed: number) {
  let a = seed >>> 0
  return function () {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
