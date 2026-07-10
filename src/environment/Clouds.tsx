/**
 * @module environment/Clouds
 * @layer environment（域层）
 * @purpose 云
 * @dependsOn ['utils/mergeGeometry', 'config/constants']
 * @exports [Clouds, Clouds]
 * @aiEdit
 *   - 改本文件导出的 Clouds、Clouds 即可；依赖见 @dependsOn
 */
/**
 * 云朵
 * 风格化低多边形云团（多个球合并），缓慢飘移。
 * 云影：用一个大的半透明暗斑随云移动，投影到地面。
 */
import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { mergeGeometries } from '../utils/mergeGeometry'
import { WORLD_SIZE } from '../config/constants'

interface CloudData {
  position: [number, number, number]
  scale: number
  speed: number
}

export default function Clouds() {
  const groupRef = useRef<THREE.Group>(null)
  const shadowRefs = useRef<THREE.Mesh[]>([])

  // ... clouds definition stays same
  const clouds = useMemo<CloudData[]>(() => {
    const arr: CloudData[] = []
    const rng = mulberry(789)
    for (let i = 0; i < 9; i++) {
      arr.push({
        position: [
          (rng() - 0.5) * WORLD_SIZE * 1.4,
          22 + rng() * 10,
          (rng() - 0.5) * WORLD_SIZE * 1.4,
        ],
        scale: 2.5 + rng() * 3,
        speed: 0.4 + rng() * 0.5,
      })
    }
    return arr
  }, [])

  const cloudGeo = useMemo(() => {
    const spheres: THREE.BufferGeometry[] = []
    const parts = 5
    const rng = mulberry(456)
    for (let i = 0; i < parts; i++) {
      const s = new THREE.IcosahedronGeometry(0.8, 1)
      s.translate((rng() - 0.5) * 1.8, (rng() - 0.5) * 0.4, (rng() - 0.5) * 1.2)
      spheres.push(s)
    }
    return mergeGeometries(spheres)
  }, [])

  const cloudMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: new THREE.Color('#f4f0e8'),
        roughness: 1,
        metalness: 0,
        flatShading: true,
        transparent: true,
        opacity: 0.92,
      }),
    [],
  )

  // 云影：大圆暗斑
  // 云影：多个半透明暗斑，在地形上方低空飘移
  const shadowData = useMemo(() => {
    const rng = mulberry(555)
    const arr: { size: number; speedX: number; speedZ: number; opacity: number; initX: number; initZ: number }[] = []
    for (let i = 0; i < 4; i++) {
      arr.push({
        size: WORLD_SIZE * (0.15 + rng() * 0.2),
        speedX: 0.2 + rng() * 0.5,
        speedZ: (rng() - 0.5) * 0.25,
        opacity: 0.06 + rng() * 0.1,
        initX: (rng() - 0.5) * WORLD_SIZE,
        initZ: (rng() - 0.5) * WORLD_SIZE * 0.5,
      })
    }
    return arr
  }, [])

  const shadowGeo = useMemo(() => new THREE.CircleGeometry(1, 32), [])

  useFrame((_, delta) => {
    if (groupRef.current) {
      groupRef.current.children.forEach((child, i) => {
        child.position.x += clouds[i].speed * delta
        if (child.position.x > WORLD_SIZE * 0.8) child.position.x = -WORLD_SIZE * 0.8
      })
    }
    // 云影飘移
    shadowRefs.current.forEach((mesh, i) => {
      if (!mesh) return
      const sd = shadowData[i]
      mesh.position.x += sd.speedX * delta
      mesh.position.z += sd.speedZ * delta
      if (mesh.position.x > WORLD_SIZE * 0.75) mesh.position.x = -WORLD_SIZE * 0.75
      if (mesh.position.x < -WORLD_SIZE * 0.75) mesh.position.x = WORLD_SIZE * 0.75
      if (mesh.position.z > WORLD_SIZE * 0.4) mesh.position.z = -WORLD_SIZE * 0.4
      if (mesh.position.z < -WORLD_SIZE * 0.4) mesh.position.z = WORLD_SIZE * 0.4
    })
  })

  return (
    <>
      <group ref={groupRef}>
        {clouds.map((c, i) => (
          <mesh key={i} geometry={cloudGeo} material={cloudMat} position={c.position} scale={c.scale} />
        ))}
      </group>
      {shadowData.map((sd, i) => (
        <mesh
          key={`shadow-${i}`}
          ref={(r) => { if (r) shadowRefs.current[i] = r }}
          rotation={[-Math.PI / 2, 0, 0]}
          position={[sd.initX, 5.5 + i * 0.8, sd.initZ]}
          scale={sd.size}
        >
          <primitive object={shadowGeo} attach="geometry" />
          <meshBasicMaterial color={0x000000} transparent depthWrite={false} opacity={sd.opacity} />
        </mesh>
      ))}
    </>
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
