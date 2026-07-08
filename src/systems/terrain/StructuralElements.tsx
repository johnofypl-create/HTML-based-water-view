import { useMemo, useRef, useEffect } from 'react'
import * as THREE from 'three'
import { fbm } from '../../utils/noise'
import { clamp, mapRange } from '../../utils/math'
import { COLORS } from '../../config/palette'
import { TERRAIN_CONFIG } from '../../config/constants'

// ── InstancedMesh 辅助组件 ──

function InstancedGroup({
  data,
  geometry,
  material,
  castShadow = true,
  receiveShadow = false,
}: {
  data: ElementData[]
  geometry: THREE.BufferGeometry
  material: THREE.Material
  castShadow?: boolean
  receiveShadow?: boolean
}) {
  const meshRef = useRef<THREE.InstancedMesh>(null)

  useEffect(() => {
    const mesh = meshRef.current
    if (!mesh || data.length === 0) return

    const dummy = new THREE.Object3D()
    const color = new THREE.Color()

    for (let i = 0; i < data.length; i++) {
      const el = data[i]
      dummy.position.set(...el.position)
      dummy.rotation.set(...el.rotation)
      dummy.scale.set(...el.scale)
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
      color.set(el.color)
      mesh.setColorAt(i, color)
    }

    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  }, [data])

  if (data.length === 0) return null

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, material, data.length]}
      castShadow={castShadow}
      receiveShadow={receiveShadow}
    />
  )
}

// ── 地形高度辅助函数（与 TerrainGeometry.ts 保持一致） ──

function generateElevation(u: number, v: number): number {
  const largeScale = fbm(u * 2.5, v * 2.5, 6, 2.0, 0.5, 1234)
  const mediumScale = fbm(u * 6.0, v * 6.0, 4, 2.2, 0.5, 2345) * 0.3
  const smallScale = fbm(u * 15.0, v * 15.0, 3, 2.0, 0.5, 3456) * 0.15
  let elevation = largeScale + mediumScale + smallScale
  const oceanInfluence = mapRange(u, 0.4, 1.0, 0, 1)
  elevation -= oceanInfluence * 0.35
  return clamp(elevation, 0, 1)
}

function carveRiverValley(elevation: number, u: number, v: number): number {
  const riverV = 0.85 - 0.35 * u - 0.08 * Math.sin(u * Math.PI * 1.8)
  const riverWidth = 0.03 + u * 0.07
  const dist = Math.abs(v - riverV)
  const riverDepth = 0.1 + u * 0.3
  if (dist < riverWidth * 2.0) {
    const t = dist / (riverWidth * 2.0)
    const smooth = 1 - t * t
    elevation -= riverDepth * smooth * 1.1
  }
  return elevation
}

function addCliffs(elevation: number, u: number, v: number): number {
  if (u < 0.25) {
    const cliffFactor = mapRange(u, 0, 0.25, 0.4, 0)
    const noise = fbm(u * 20, v * 20, 2, 2, 0.5, 4567) * 0.2
    elevation += (cliffFactor + noise) * 0.6
  }
  return elevation
}

function addCoastalDunes(elevation: number, u: number, v: number): number {
  if (u > 0.35 && u < 0.7) {
    const duneNoise = fbm(u * 8, v * 12, 3, 2, 0.5, 5678)
    const duneFactor = Math.sin(u * 10) * 0.08 + duneNoise * 0.05
    elevation += duneFactor
  }
  return elevation
}

function getTerrainHeight(worldX: number, worldZ: number): number {
  const { width, depth, heightScale } = TERRAIN_CONFIG
  const u = (worldX + width / 2) / width
  const v = (worldZ + depth / 2) / depth
  let elevation = generateElevation(u, v)
  elevation = carveRiverValley(elevation, u, v)
  elevation = addCliffs(elevation, u, v)
  elevation = addCoastalDunes(elevation, u, v)
  return elevation * heightScale
}

// ── 确定性伪随机数（基于种子） ──

function seededRandom(seed: number): number {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453
  return x - Math.floor(x)
}

// ── 辅助类型 ──

interface ElementData {
  position: [number, number, number]
  rotation: [number, number, number]
  scale: [number, number, number]
  color: string
}

// ── 主组件 ──

export function StructuralElements() {
  const seaLevel = TERRAIN_CONFIG.seaLevel * TERRAIN_CONFIG.heightScale

  // ── 海滩岩石 ──
  const beachRocks = useMemo<ElementData[]>(() => {
    const rocks: ElementData[] = []
    const count = 10
    const rockColors = [COLORS.rock.light, COLORS.rock.medium, COLORS.rock.dark, COLORS.rock.cliff]
    for (let i = 0; i < count; i++) {
      const r = seededRandom(100 + i)
      const x = -3 + r * 7          // X: -3 ~ 4
      const z = -10 + seededRandom(200 + i) * 18 // Z: -10 ~ 8
      const h = getTerrainHeight(x, z)
      const sx = 0.3 + seededRandom(300 + i) * 0.6
      const sy = 0.2 + seededRandom(400 + i) * 0.4
      const sz = 0.3 + seededRandom(500 + i) * 0.6
      rocks.push({
        position: [x, h + sy * 0.3, z],
        rotation: [seededRandom(600 + i) * Math.PI, seededRandom(700 + i) * Math.PI, seededRandom(800 + i) * Math.PI],
        scale: [sx, sy, sz],
        color: rockColors[Math.floor(seededRandom(900 + i) * rockColors.length)],
      })
    }
    return rocks
  }, [])

  // ── 山坡岩石 ──
  const hillsideRocks = useMemo<ElementData[]>(() => {
    const rocks: ElementData[] = []
    const count = 6
    const rockColors = [COLORS.rock.dark, COLORS.rock.cliff, COLORS.rock.medium]
    for (let i = 0; i < count; i++) {
      const r = seededRandom(1000 + i)
      const x = -12 + r * 5          // X: -12 ~ -7
      const z = -6 + seededRandom(1100 + i) * 12 // Z: -6 ~ 6
      const h = getTerrainHeight(x, z)
      const sx = 0.5 + seededRandom(1200 + i) * 1.2
      const sy = 0.4 + seededRandom(1300 + i) * 0.8
      const sz = 0.5 + seededRandom(1400 + i) * 1.2
      rocks.push({
        position: [x, h + sy * 0.2, z],
        rotation: [seededRandom(1500 + i) * Math.PI, seededRandom(1600 + i) * Math.PI, seededRandom(1700 + i) * Math.PI],
        scale: [sx, sy, sz],
        color: rockColors[Math.floor(seededRandom(1800 + i) * rockColors.length)],
      })
    }
    return rocks
  }, [])

  // ── 岸边半浸没岩石 ──
  const shoreRocks = useMemo<ElementData[]>(() => {
    const rocks: ElementData[] = []
    const count = 7
    const rockColors = [COLORS.rock.medium, COLORS.rock.dark]
    for (let i = 0; i < count; i++) {
      const r = seededRandom(2000 + i)
      const x = 3 + r * 5          // X: 3 ~ 8
      const z = -8 + seededRandom(2100 + i) * 16 // Z: -8 ~ 8
      const h = getTerrainHeight(x, z)
      const sx = 0.4 + seededRandom(2200 + i) * 0.8
      const sy = 0.3 + seededRandom(2300 + i) * 0.5
      const sz = 0.4 + seededRandom(2400 + i) * 0.8
      rocks.push({
        position: [x, Math.max(h - 0.3, seaLevel - 0.6), z],
        rotation: [seededRandom(2500 + i) * Math.PI, seededRandom(2600 + i) * Math.PI, seededRandom(2700 + i) * Math.PI],
        scale: [sx, sy, sz],
        color: rockColors[Math.floor(seededRandom(2800 + i) * rockColors.length)],
      })
    }
    return rocks
  }, [seaLevel])

  // ── 木板步道（沿沙滩弯曲） ──
  const boardwalk = useMemo(() => {
    const planks: { position: [number, number, number]; rotation: [number, number, number] }[] = []
    const plankCount = 30
    // 二次贝塞尔曲线：起点 (-3, -9) → 控制点 (0, -5) → 终点 (5, -2)
    for (let i = 0; i < plankCount; i++) {
      const t = i / (plankCount - 1)
      const x = (1 - t) * (1 - t) * (-3) + 2 * (1 - t) * t * 0 + t * t * 5
      const z = (1 - t) * (1 - t) * (-9) + 2 * (1 - t) * t * (-5) + t * t * (-2)
      const h = getTerrainHeight(x, z)
      // 计算切线方向
      const tNext = Math.min(t + 0.01, 1)
      const xNext = (1 - tNext) * (1 - tNext) * (-3) + 2 * (1 - tNext) * tNext * 0 + tNext * tNext * 5
      const zNext = (1 - tNext) * (1 - tNext) * (-9) + 2 * (1 - tNext) * tNext * (-5) + tNext * tNext * (-2)
      const angle = Math.atan2(zNext - z, xNext - x)
      planks.push({
        position: [x, h + 0.12, z],
        rotation: [0, -angle, 0],
      })
    }
    return planks
  }, [])

  // 步道支柱
  const boardwalkPosts = useMemo(() => {
    const posts: { position: [number, number, number] }[] = []
    const postCount = 5
    for (let i = 0; i < postCount; i++) {
      const t = (i + 0.25) / postCount
      const x = (1 - t) * (1 - t) * (-3) + 2 * (1 - t) * t * 0 + t * t * 5
      const z = (1 - t) * (1 - t) * (-9) + 2 * (1 - t) * t * (-5) + t * t * (-2)
      const h = getTerrainHeight(x, z)
      posts.push({ position: [x, h / 2 + 0.06, z] })
    }
    return posts
  }, [])

  // ── 木桥（横跨河流） ──
  const bridgeData = useMemo(() => {
    const bridgeX = -6
    // 计算河流在 X=-6 处的位置
    const u = (bridgeX + TERRAIN_CONFIG.width / 2) / TERRAIN_CONFIG.width
    const riverV = 0.85 - 0.35 * u - 0.08 * Math.sin(u * Math.PI * 1.8)
    const riverZ = (-TERRAIN_CONFIG.depth / 2) + riverV * TERRAIN_CONFIG.depth
    const riverWidth = (0.03 + u * 0.07) * TERRAIN_CONFIG.depth
    const spanHalf = riverWidth * 1.5 + 0.8
    const bridgeZX = riverZ
    const zStart = bridgeZX - spanHalf
    const zEnd = bridgeZX + spanHalf
    const hLeft = getTerrainHeight(bridgeX - 0.8, bridgeZX)
    const hRight = getTerrainHeight(bridgeX + 0.8, bridgeZX)
    const bridgeY = Math.max(hLeft, hRight) + 0.15
    return { bridgeX, zStart, zEnd, bridgeY, bridgeZX }
  }, [])

  // ── 小码头（从沙滩延伸入海） ──
  const dockData = useMemo(() => {
    const dockZ = -5
    const dockPlanks: { position: [number, number, number] }[] = []
    const dockPosts: { position: [number, number, number] }[] = []
    const plankCount = 8
    for (let i = 0; i < plankCount; i++) {
      const x = 2 + i * 0.6
      const h = getTerrainHeight(x, dockZ)
      const dockY = Math.max(h, seaLevel - 0.1) + 0.2
      dockPlanks.push({ position: [x, dockY, dockZ] })
      if (i % 2 === 0) {
        dockPosts.push({ position: [x, dockY - 0.25, dockZ - 0.6] })
        dockPosts.push({ position: [x, dockY - 0.25, dockZ + 0.6] })
      }
    }
    return { dockPlanks, dockPosts }
  }, [seaLevel])

  // ── 漂流木 ──
  const driftwood = useMemo(() => {
    const pieces: ElementData[] = []
    const count = 8
    for (let i = 0; i < count; i++) {
      const r = seededRandom(3000 + i)
      const x = -2 + r * 7          // X: -2 ~ 5
      const z = -8 + seededRandom(3100 + i) * 16 // Z: -8 ~ 8
      const h = getTerrainHeight(x, z)
      const length = 0.8 + seededRandom(3200 + i) * 2.0
      pieces.push({
        position: [x, h + 0.05, z],
        rotation: [seededRandom(3300 + i) * 0.3, seededRandom(3400 + i) * Math.PI * 2, seededRandom(3500 + i) * 0.3],
        scale: [length, 0.06, 0.08],
        color: COLORS.wood.driftwood,
      })
    }
    return pieces
  }, [])

  // ── 小岛 ──
  const islands = useMemo(() => {
    const islandDefs = [
      { x: 9, z: -7, radius: 2.0, height: 0.5, seed: 4000 },
      { x: 12, z: 2, radius: 1.5, height: 0.4, seed: 4100 },
      { x: 10.5, z: 8, radius: 1.8, height: 0.45, seed: 4200 },
    ]
    return islandDefs.map((def) => {
      const islandY = seaLevel + 0.15
      const vegSpots: { position: [number, number, number]; scale: [number, number, number]; color: string }[] = []
      const vegCount = Math.floor(4 + seededRandom(def.seed + 100) * 5)
      for (let i = 0; i < vegCount; i++) {
        const angle = seededRandom(def.seed + 200 + i) * Math.PI * 2
        const dist = seededRandom(def.seed + 300 + i) * def.radius * 0.7
        vegSpots.push({
          position: [def.x + Math.cos(angle) * dist, islandY + def.height * 0.6, def.z + Math.sin(angle) * dist],
          scale: [0.15 + seededRandom(def.seed + 400 + i) * 0.2, 0.2 + seededRandom(def.seed + 500 + i) * 0.4, 0.15 + seededRandom(def.seed + 600 + i) * 0.2],
          color: [COLORS.green.shrub, COLORS.green.medium, COLORS.green.forest][Math.floor(seededRandom(def.seed + 700 + i) * 3)],
        })
      }
      return { ...def, islandY, vegSpots }
    })
  }, [seaLevel])

  // ── 珊瑚 ──
  const coralPatches = useMemo(() => {
    const patches: ElementData[] = []
    const count = 10
    const coralColors = ['#e8a0a0', '#e8c0a0', '#f0c0c0', '#d8a0b0', '#e0b8a8']
    for (let i = 0; i < count; i++) {
      const r = seededRandom(5000 + i)
      const x = 3 + r * 4          // X: 3 ~ 7
      const z = -4 + seededRandom(5100 + i) * 8 // Z: -4 ~ 4
      const h = getTerrainHeight(x, z)
      const coralY = Math.min(h, seaLevel - 0.15)
      patches.push({
        position: [x, coralY, z],
        rotation: [0, seededRandom(5200 + i) * Math.PI * 2, 0],
        scale: [0.15 + seededRandom(5300 + i) * 0.25, 0.2 + seededRandom(5400 + i) * 0.4, 0.15 + seededRandom(5500 + i) * 0.25],
        color: coralColors[Math.floor(seededRandom(5600 + i) * coralColors.length)],
      })
    }
    return patches
  }, [seaLevel])

  // ── 水下植物 ──
  const underwaterPlants = useMemo(() => {
    const plants: ElementData[] = []
    const count = 15
    for (let i = 0; i < count; i++) {
      const r = seededRandom(6000 + i)
      const x = 3 + r * 5          // X: 3 ~ 8
      const z = -5 + seededRandom(6100 + i) * 10 // Z: -5 ~ 5
      const h = getTerrainHeight(x, z)
      const plantY = Math.min(h, seaLevel - 0.1)
      plants.push({
        position: [x, plantY, z],
        rotation: [seededRandom(6200 + i) * 0.3, seededRandom(6300 + i) * Math.PI * 2, seededRandom(6400 + i) * 0.3],
        scale: [0.04, 0.3 + seededRandom(6500 + i) * 0.6, 0.04],
        color: [COLORS.green.moss, COLORS.green.dark, COLORS.green.forest][Math.floor(seededRandom(6600 + i) * 3)],
      })
    }
    return plants
  }, [seaLevel])

  // ── 步行小径 ──
  const trailMarkers = useMemo(() => {
    const markers: ElementData[] = []
    const markerCount = 20
    // 从 (-11, -6) 到 (0, -3) 的路径
    for (let i = 0; i < markerCount; i++) {
      const t = i / (markerCount - 1)
      const x = -11 + t * 11
      const z = -6 + t * 3
      // 添加一些蜿蜒
      const wobbleZ = Math.sin(t * Math.PI * 2) * 0.8
      const h = getTerrainHeight(x, z + wobbleZ)
      markers.push({
        position: [x, h + 0.02, z + wobbleZ],
        rotation: [0, 0, 0],
        scale: [0.25, 0.03, 0.25],
        color: COLORS.sand.dark,
      })
    }
    return markers
  }, [])

  // ── 合并所有岩石 ──
  const allRocks = useMemo(() => {
    return [...beachRocks, ...hillsideRocks, ...shoreRocks]
  }, [beachRocks, hillsideRocks, shoreRocks])

  // ── 合并所有木板（步道、桥、码头） ──
  const allPlanks = useMemo(() => {
    const planks: ElementData[] = []
    // 步道木板
    for (const plank of boardwalk) {
      planks.push({
        position: plank.position,
        rotation: plank.rotation,
        scale: [0.6, 0.06, 1.8],
        color: COLORS.wood.light,
      })
    }
    // 桥面板
    for (let i = 0; i < 10; i++) {
      const t = i / 9
      const z = bridgeData.zStart + t * (bridgeData.zEnd - bridgeData.zStart)
      planks.push({
        position: [bridgeData.bridgeX, bridgeData.bridgeY, z],
        rotation: [0, 0, 0],
        scale: [1.8, 0.08, 0.4],
        color: COLORS.wood.light,
      })
    }
    // 码头木板
    for (const plank of dockData.dockPlanks) {
      planks.push({
        position: plank.position,
        rotation: [0, 0, 0],
        scale: [0.6, 0.08, 1.5],
        color: COLORS.wood.light,
      })
    }
    return planks
  }, [boardwalk, bridgeData, dockData])

  // ── 合并所有柱子（步道支柱、桥柱、码头支柱） ──
  const allPosts = useMemo(() => {
    const posts: ElementData[] = []
    // 步道支柱
    for (const post of boardwalkPosts) {
      const h = getTerrainHeight(post.position[0], post.position[2])
      posts.push({
        position: post.position,
        rotation: [0, 0, 0],
        scale: [0.12, h + 0.12, 0.12],
        color: COLORS.wood.dark,
      })
    }
    // 桥柱
    const bridgePosts = [
      [bridgeData.bridgeX - 0.8, bridgeData.zStart],
      [bridgeData.bridgeX - 0.8, bridgeData.zEnd],
      [bridgeData.bridgeX + 0.8, bridgeData.zStart],
      [bridgeData.bridgeX + 0.8, bridgeData.zEnd],
    ]
    for (const [px, pz] of bridgePosts) {
      posts.push({
        position: [px, bridgeData.bridgeY - 0.3, pz],
        rotation: [0, 0, 0],
        scale: [0.15, 0.6, 0.15],
        color: COLORS.wood.dark,
      })
    }
    // 码头支柱
    for (const post of dockData.dockPosts) {
      posts.push({
        position: post.position,
        rotation: [0, 0, 0],
        scale: [0.1, 0.5, 0.1],
        color: COLORS.wood.dark,
      })
    }
    return posts
  }, [boardwalkPosts, bridgeData, dockData])

  // ── 共享几何体和材质 ──
  const shared = useMemo(() => {
    const rockGeo = new THREE.IcosahedronGeometry(1, 1)
    const rockMat = new THREE.MeshStandardMaterial({ flatShading: true })

    // 标准盒子几何体
    const boxGeo = new THREE.BoxGeometry(1, 1, 1)
    const plankMat = new THREE.MeshStandardMaterial({ flatShading: true })
    const postMat = new THREE.MeshStandardMaterial({ flatShading: true })
    const trailMat = new THREE.MeshStandardMaterial({ flatShading: true })

    // 漂流木用圆柱体
    const driftwoodGeo = new THREE.CylinderGeometry(0.5, 0.5, 1, 6)
    const driftwoodMat = new THREE.MeshStandardMaterial({ flatShading: true })

    // 珊瑚用圆锥体
    const coralGeo = new THREE.ConeGeometry(0.5, 1, 5)
    const coralMat = new THREE.MeshStandardMaterial({ flatShading: true })

    // 水下植物用圆柱体
    const underwaterPlantGeo = new THREE.CylinderGeometry(0.5, 0.3, 1, 5)
    const underwaterPlantMat = new THREE.MeshStandardMaterial({ flatShading: true })

    return {
      rockGeo,
      rockMat,
      boxGeo,
      plankMat,
      postMat,
      trailMat,
      driftwoodGeo,
      driftwoodMat,
      coralGeo,
      coralMat,
      underwaterPlantGeo,
      underwaterPlantMat,
    }
  }, [])

  // 清理共享资源
  useEffect(() => {
    return () => {
      Object.values(shared).forEach(resource => {
        if (resource instanceof THREE.BufferGeometry) {
          resource.dispose()
        } else if (resource instanceof THREE.Material) {
          resource.dispose()
        }
      })
    }
  }, [shared])

  return (
    <group>
      {/* ── 所有岩石（合并为一个InstancedMesh） ── */}
      <InstancedGroup
        data={allRocks}
        geometry={shared.rockGeo}
        material={shared.rockMat}
        castShadow
        receiveShadow
      />

      {/* ── 所有木板（合并为一个InstancedMesh） ── */}
      <InstancedGroup
        data={allPlanks}
        geometry={shared.boxGeo}
        material={shared.plankMat}
        castShadow
        receiveShadow
      />

      {/* ── 所有柱子（合并为一个InstancedMesh） ── */}
      <InstancedGroup
        data={allPosts}
        geometry={shared.boxGeo}
        material={shared.postMat}
        castShadow
      />

      {/* ── 漂流木（合并为一个InstancedMesh） ── */}
      <InstancedGroup
        data={driftwood}
        geometry={shared.driftwoodGeo}
        material={shared.driftwoodMat}
        castShadow
      />

      {/* ── 珊瑚（合并为一个InstancedMesh） ── */}
      <InstancedGroup
        data={coralPatches}
        geometry={shared.coralGeo}
        material={shared.coralMat}
      />

      {/* ── 水下植物（合并为一个InstancedMesh） ── */}
      <InstancedGroup
        data={underwaterPlants}
        geometry={shared.underwaterPlantGeo}
        material={shared.underwaterPlantMat}
      />

      {/* ── 步行小径标记（合并为一个InstancedMesh） ── */}
      <InstancedGroup
        data={trailMarkers}
        geometry={shared.boxGeo}
        material={shared.trailMat}
      />

      {/* ── 小岛 ── 保持独立，数量很少 */}
      {islands.map((island, i) => (
        <group key={`island-${i}`}>
          {/* 岛屿基底 */}
          <mesh
            position={[island.x, island.islandY, island.z]}
            castShadow
            receiveShadow
          >
            <cylinderGeometry args={[island.radius, island.radius * 1.1, island.height, 8]} />
            <meshStandardMaterial color={COLORS.sand.medium} flatShading />
          </mesh>
        </group>
      ))}
    </group>
  )
}

export default StructuralElements