/**
 * 海洋生态元素（从版本 A 移入）
 *
 * 珊瑚礁：锥体暖色，浅水区散布
 * 水下植物：柱体绿色，浅水区散布
 * 步行小径：沙滩上的路径标记
 * 小岛：圆柱基底+植被点缀，散布在远海
 */
import { useMemo, useRef, useLayoutEffect } from 'react'
import * as THREE from 'three'
import { heightAt } from '../utils/terrain'
import { WATER_LEVEL, WORLD_SIZE } from '../config/constants'

// ── 确定性种子随机 ──
function srand(seed: number): number {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453
  return x - Math.floor(x)
}

// ── 简易 InstancedMesh 创建辅助 ──
function setupInstanced(
  mesh: THREE.InstancedMesh,
  data: { pos: [number, number, number]; rot: [number, number, number]; scl: [number, number, number]; color: string }[],
) {
  const m = new THREE.Matrix4()
  const color = new THREE.Color()
  data.forEach((d, i) => {
    m.compose(
      new THREE.Vector3(...d.pos),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(...d.rot)),
      new THREE.Vector3(...d.scl),
    )
    mesh.setMatrixAt(i, m)
    color.set(d.color)
    mesh.setColorAt(i, color)
  })
  mesh.instanceMatrix.needsUpdate = true
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
}

// ── 珊瑚数据 ──
function useCoralData(): { pos: [number, number, number]; rot: [number, number, number]; scl: [number, number, number]; color: string }[] {
  return useMemo(() => {
    const coralColors = ['#e8a0a0', '#e8c0a0', '#f0c0c0', '#d8a0b0', '#e0b8a8']
    const items: any[] = []
    for (let i = 0; i < 10; i++) {
      const r = srand(5000 + i)
      const x = 3 + r * 4
      const z = -4 + srand(5100 + i) * 8
      const h = heightAt(x, z)
      const coralY = Math.min(h, WATER_LEVEL - 0.15)
      items.push({
        pos: [x, coralY, z] as [number, number, number],
        rot: [0, srand(5200 + i) * Math.PI * 2, 0] as [number, number, number],
        scl: [0.15 + srand(5300 + i) * 0.25, 0.2 + srand(5400 + i) * 0.4, 0.15 + srand(5500 + i) * 0.25] as [number, number, number],
        color: coralColors[Math.floor(srand(5600 + i) * coralColors.length)],
      })
    }
    return items
  }, [])
}

// ── 水下植物数据 ──
function useUnderwaterPlantData(): { pos: [number, number, number]; rot: [number, number, number]; scl: [number, number, number]; color: string }[] {
  return useMemo(() => {
    const plantColors = ['#4a6b3a', '#3d5a2e', '#2e4a1e']
    const items: any[] = []
    for (let i = 0; i < 15; i++) {
      const r = srand(6000 + i)
      const x = 3 + r * 5
      const z = -5 + srand(6100 + i) * 10
      const h = heightAt(x, z)
      const plantY = Math.min(h, WATER_LEVEL - 0.1)
      items.push({
        pos: [x, plantY, z] as [number, number, number],
        rot: [srand(6200 + i) * 0.3, srand(6300 + i) * Math.PI * 2, srand(6400 + i) * 0.3] as [number, number, number],
        scl: [0.04, 0.3 + srand(6500 + i) * 0.6, 0.04] as [number, number, number],
        color: plantColors[Math.floor(srand(6600 + i) * plantColors.length)],
      })
    }
    return items
  }, [])
}

// ── 步行小径数据 ──
function useTrailData(): { pos: [number, number, number]; rot: [number, number, number]; scl: [number, number, number]; color: string }[] {
  return useMemo(() => {
    const items: any[] = []
    for (let i = 0; i < 20; i++) {
      const t = i / 19
      const x = -11 + t * 11
      const z = -6 + t * 3 + Math.sin(t * Math.PI * 2) * 0.8
      const h = heightAt(x, z)
      items.push({
        pos: [x, h + 0.02, z] as [number, number, number],
        rot: [0, 0, 0] as [number, number, number],
        scl: [0.25, 0.03, 0.25] as [number, number, number],
        color: '#c9b896',
      })
    }
    return items
  }, [])
}

// ── 小岛 ──
function useIslandData() {
  return useMemo(() => {
    const islandDefs = [
      { x: 9, z: -7, radius: 2.0, height: 0.5, seed: 4000 },
      { x: 12, z: 2, radius: 1.5, height: 0.4, seed: 4100 },
      { x: 10.5, z: 8, radius: 1.8, height: 0.45, seed: 4200 },
    ]
    return islandDefs.map((def) => {
      const islandY = WATER_LEVEL + 0.15
      const vegSpots: { pos: [number, number, number]; scl: [number, number, number]; color: string }[] = []
      const vegCount = Math.floor(4 + srand(def.seed + 100) * 5)
      for (let i = 0; i < vegCount; i++) {
        const angle = srand(def.seed + 200 + i) * Math.PI * 2
        const dist = srand(def.seed + 300 + i) * def.radius * 0.7
        vegSpots.push({
          pos: [def.x + Math.cos(angle) * dist, islandY + def.height * 0.6, def.z + Math.sin(angle) * dist],
          scl: [0.15 + srand(def.seed + 400 + i) * 0.2, 0.2 + srand(def.seed + 500 + i) * 0.4, 0.15 + srand(def.seed + 600 + i) * 0.2],
          color: ['#4a6b3a', '#5a7b4a', '#3d5a2e'][Math.floor(srand(def.seed + 700 + i) * 3)],
        })
      }
      return { ...def, islandY, vegSpots }
    })
  }, [])
}

// ── 主组件 ──
export default function MarineElements() {
  const coralData = useCoralData()
  const plantData = useUnderwaterPlantData()
  const trailData = useTrailData()
  const islands = useIslandData()

  // 几何体
  const coralGeo = useMemo(() => new THREE.ConeGeometry(0.5, 1, 5), [])
  const plantGeo = useMemo(() => new THREE.CylinderGeometry(0.5, 0.3, 1, 5), [])
  const boxGeo = useMemo(() => new THREE.BoxGeometry(1, 1, 1), [])
  const cylGeo = useMemo(() => new THREE.CylinderGeometry(0.5, 0.5, 1, 8), [])
  const shrubGeo = useMemo(() => new THREE.IcosahedronGeometry(0.5, 0), [])

  // 材质
  const coralMat = useMemo(() => new THREE.MeshStandardMaterial({ flatShading: true, vertexColors: true }), [])
  const plantMat = useMemo(() => new THREE.MeshStandardMaterial({ flatShading: true, vertexColors: true }), [])
  const trailMat = useMemo(() => new THREE.MeshStandardMaterial({ flatShading: true, vertexColors: true }), [])
  const islandMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#d9c19a', flatShading: true }), [])
  const vegMat = useMemo(() => new THREE.MeshStandardMaterial({ flatShading: true, vertexColors: true }), [])

  // Refs
  const coralRef = useRef<THREE.InstancedMesh>(null)
  const plantRef = useRef<THREE.InstancedMesh>(null)
  const trailRef = useRef<THREE.InstancedMesh>(null)

  useLayoutEffect(() => { if (coralRef.current) setupInstanced(coralRef.current, coralData) }, [coralData])
  useLayoutEffect(() => { if (plantRef.current) setupInstanced(plantRef.current, plantData) }, [plantData])
  useLayoutEffect(() => { if (trailRef.current) setupInstanced(trailRef.current, trailData) }, [trailData])

  return (
    <group>
      <instancedMesh ref={coralRef} args={[coralGeo, coralMat, coralData.length]} />
      <instancedMesh ref={plantRef} args={[plantGeo, plantMat, plantData.length]} />
      <instancedMesh ref={trailRef} args={[boxGeo, trailMat, trailData.length]} receiveShadow />

      {islands.map((island, i) => (
        <group key={`island-${i}`}>
          <mesh position={[island.x, island.islandY, island.z]} castShadow receiveShadow>
            <primitive object={cylGeo} attach="geometry" />
            <primitive object={islandMat} attach="material" />
          </mesh>
          {island.vegSpots.map((spot, j) => (
            <mesh key={j} position={spot.pos} scale={spot.scl}>
              <primitive object={shrubGeo} attach="geometry" />
              <meshStandardMaterial color={spot.color} flatShading />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  )
}
