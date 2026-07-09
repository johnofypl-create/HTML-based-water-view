/**
 * 水下鱼群
 * 几条小鱼在浅水区随机游动，偶尔可见（水下深色剪影）。
 */
import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { WORLD_SIZE, WATER_LEVEL } from '../config/constants'

export default function Fish() {
  const groupRef = useRef<THREE.Group>(null)

  const fish = useMemo(() => {
    const rng = mulberry(999)
    const arr: { pos: THREE.Vector3; dir: number; speed: number; phase: number }[] = []
    for (let i = 0; i < 12; i++) {
      arr.push({
        pos: new THREE.Vector3((rng() - 0.5) * WORLD_SIZE * 0.6, 0, (rng() - 0.5) * WORLD_SIZE * 0.6),
        dir: rng() * Math.PI * 2,
        speed: 0.8 + rng() * 0.6,
        phase: rng() * Math.PI * 2,
      })
    }
    return arr
  }, [])

  const fishGeo = useMemo(() => {
    const g = new THREE.ConeGeometry(0.08, 0.3, 4)
    g.rotateZ(Math.PI / 2)
    return g
  }, [])

  const fishMat = useMemo(
    () => new THREE.MeshBasicMaterial({ color: 0x1a3038, transparent: true, opacity: 0.7 }),
    [],
  )

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime
    if (!groupRef.current) return
    groupRef.current.children.forEach((child, i) => {
      const f = fish[i]
      // 随机转向
      f.dir += Math.sin(t * 0.5 + f.phase) * delta * 0.8
      f.pos.x += Math.cos(f.dir) * f.speed * delta
      f.pos.z += Math.sin(f.dir) * f.speed * delta
      // 边界回弹
      const lim = WORLD_SIZE * 0.4
      if (f.pos.x > lim) { f.pos.x = lim; f.dir = Math.PI - f.dir }
      if (f.pos.x < -lim) { f.pos.x = -lim; f.dir = Math.PI - f.dir }
      if (f.pos.z > lim) { f.pos.z = lim; f.dir = -f.dir }
      if (f.pos.z < -lim) { f.pos.z = -lim; f.dir = -f.dir }
      // 水下深度
      child.position.set(f.pos.x, WATER_LEVEL - 0.4 - Math.abs(Math.sin(t + f.phase)) * 0.3, f.pos.z)
      child.rotation.y = -f.dir
    })
  })

  return (
    <group ref={groupRef}>
      {fish.map((_, i) => (
        <mesh key={i} geometry={fishGeo} material={fishMat} />
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
