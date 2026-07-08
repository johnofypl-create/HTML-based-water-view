import { useMemo, useRef, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { generateTerrainGeometry } from '../terrain/TerrainGeometry'
import { generateVegetationPlacement } from './VegetationPlacement'
import type { VegetationPlacementConfig } from './VegetationPlacement'
import {
  createTreeGeometry,
  createShrubGeometry,
  createGrassGeometry,
  createFlowerGeometry,
} from './VegetationGeometry'
import { COLORS } from '../../config/palette'
import { VEGETATION_COUNTS, WORLD_SIZE, TERRAIN_CONFIG } from '../../config/constants'
import type { VegetationInstance, VegetationType } from '../../types'
import { clamp } from '../../utils/math'

// 从地形数据创建高度查找函数
// 地形几何体在 XY 平面，Z 为高度，旋转 -PI/2 绕 X 后：
// worldX = originalX, worldY = originalZ, worldZ = -originalY
function createTerrainLookups(
  heightData: Float32Array,
  slopeData: Float32Array,
  segments: number,
  width: number,
  depth: number,
  heightScale: number,
) {
  const halfW = width / 2
  const halfD = depth / 2
  const cellSizeX = width / segments
  const cellSizeZ = depth / segments

  const getHeight = (worldX: number, worldZ: number): number => {
    const i = (worldX + halfW) / cellSizeX
    const j = (halfD - worldZ) / cellSizeZ

    const i0 = Math.max(0, Math.min(segments, Math.floor(i)))
    const i1 = Math.min(segments, i0 + 1)
    const j0 = Math.max(0, Math.min(segments, Math.floor(j)))
    const j1 = Math.min(segments, j0 + 1)

    const fi = clamp(i - i0, 0, 1)
    const fj = clamp(j - j0, 0, 1)

    const h00 = heightData[i0 * (segments + 1) + j0]
    const h10 = heightData[i1 * (segments + 1) + j0]
    const h01 = heightData[i0 * (segments + 1) + j1]
    const h11 = heightData[i1 * (segments + 1) + j1]

    const h0 = h00 + (h10 - h00) * fi
    const h1 = h01 + (h11 - h01) * fi
    const elevation = h0 + (h1 - h0) * fj

    return elevation * heightScale
  }

  const getSlope = (worldX: number, worldZ: number): number => {
    const i = (worldX + halfW) / cellSizeX
    const j = (halfD - worldZ) / cellSizeZ

    const i0 = Math.max(0, Math.min(segments, Math.floor(i)))
    const i1 = Math.min(segments, i0 + 1)
    const j0 = Math.max(0, Math.min(segments, Math.floor(j)))
    const j1 = Math.min(segments, j0 + 1)

    const fi = clamp(i - i0, 0, 1)
    const fj = clamp(j - j0, 0, 1)

    const s00 = slopeData[i0 * (segments + 1) + j0]
    const s10 = slopeData[i1 * (segments + 1) + j0]
    const s01 = slopeData[i0 * (segments + 1) + j1]
    const s11 = slopeData[i1 * (segments + 1) + j1]

    const s0 = s00 + (s10 - s00) * fi
    const s1 = s01 + (s11 - s01) * fi
    return s0 + (s1 - s0) * fj
  }

  return { getHeight, getSlope }
}

// 颜色配置
const VEGETATION_COLORS: Record<VegetationType, string[]> = {
  tree: [COLORS.green.forest, COLORS.green.dark, COLORS.green.medium],
  shrub: [COLORS.green.shrub, COLORS.green.medium, COLORS.green.moss],
  grass: [COLORS.green.grass, COLORS.green.light, COLORS.green.shrub],
  flower: [COLORS.flower.white, COLORS.flower.yellow, COLORS.flower.lavender, COLORS.flower.cream],
  coral: [COLORS.flower.lavender],
}

function pickColor(type: VegetationType, index: number, total: number): THREE.Color {
  const palette = VEGETATION_COLORS[type]
  const baseHex = palette[index % palette.length]
  const baseColor = new THREE.Color(baseHex)
  // 添加微小变化
  const hueShift = (Math.sin(index * 0.7) * 0.03)
  const satShift = (Math.cos(index * 1.1) * 0.05)
  baseColor.offsetHSL(hueShift, satShift, 0)
  return baseColor
}

// 为材质注入风动画
function injectWindShader(material: THREE.Material, timeRef: { current: THREE.IUniform<number> | null }): void {
  material.onBeforeCompile = (shader) => {
    const uTime = new THREE.Uniform(0)
    timeRef.current = uTime

    shader.uniforms = {
      ...shader.uniforms,
      uTime,
    }

    // 在顶点着色器中注入风摆动
    shader.vertexShader = shader.vertexShader.replace(
      'void main() {',
      `
      uniform float uTime;
      void main() {
      `,
    )

    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      `
      #include <begin_vertex>
      float windStrength = 0.06;
      float windSpeed = 1.2;
      float h = position.y;
      float wind = sin(h * 2.5 + uTime * windSpeed + position.x * 3.0)
                 * windStrength * h * h;
      transformed.x += wind;
      transformed.z += wind * 0.4;
      `,
    )
  }
}

// 单个植被类型的 InstancedMesh
function VegetationLayer({
  type,
  instances,
  geometry,
}: {
  type: VegetationType
  instances: VegetationInstance[]
  geometry: THREE.BufferGeometry
}) {
  const meshRef = useRef<THREE.InstancedMesh>(null)
  const timeRef = useRef<THREE.IUniform<number> | null>(null)
  const count = instances.length

  const material = useMemo(() => {
    const mat = new THREE.MeshStandardMaterial({
      roughness: 0.8,
      metalness: 0.05,
      flatShading: true,
      side: THREE.DoubleSide,
    })
    injectWindShader(mat, timeRef)
    return mat
  }, [])

  // 清理材质
  useEffect(() => {
    return () => {
      material.dispose()
    }
  }, [material])

  // 设置实例矩阵和颜色
  useEffect(() => {
    const mesh = meshRef.current
    if (!mesh || count === 0) return

    const dummy = new THREE.Object3D()
    const color = new THREE.Color()

    for (let i = 0; i < count; i++) {
      const inst = instances[i]
      const [px, py, pz] = inst.position
      const [rx, ry, rz] = inst.rotation
      const [sx, sy, sz] = inst.scale

      dummy.position.set(px, py, pz)
      dummy.rotation.set(rx, ry, rz)
      dummy.scale.set(sx, sy, sz)
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)

      color.copy(pickColor(type, i, count))
      mesh.setColorAt(i, color)
    }

    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) {
      mesh.instanceColor.needsUpdate = true
    }
  }, [instances, count, type])

  // 风动画更新
  useFrame((_, delta) => {
    if (timeRef.current) {
      timeRef.current.value += delta
    }
  })

  if (count === 0) return null

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, material, count]}
      castShadow
      receiveShadow
    />
  )
}

export function Vegetation() {
  // 重新生成地形数据用于高度/坡度查询
  const terrainData = useMemo(() => {
    return generateTerrainGeometry()
  }, [])

  // 创建查找函数
  const lookups = useMemo(() => {
    const { heightData, slopeData } = terrainData
    return createTerrainLookups(
      heightData,
      slopeData,
      TERRAIN_CONFIG.segments,
      TERRAIN_CONFIG.width,
      TERRAIN_CONFIG.depth,
      TERRAIN_CONFIG.heightScale,
    )
  }, [terrainData])

  // 生成植被放置
  const vegetationInstances = useMemo(() => {
    const seaLevelWorld = TERRAIN_CONFIG.seaLevel * TERRAIN_CONFIG.heightScale
    const config: VegetationPlacementConfig = {
      trees: VEGETATION_COUNTS.trees,
      shrubs: VEGETATION_COUNTS.shrubs,
      grass: VEGETATION_COUNTS.grass,
      flowers: VEGETATION_COUNTS.flowers,
    }
    return generateVegetationPlacement(
      lookups.getHeight,
      lookups.getSlope,
      WORLD_SIZE,
      seaLevelWorld,
      config,
    )
  }, [lookups])

  // 按类型分组
  const grouped = useMemo(() => {
    const groups: Record<VegetationType, VegetationInstance[]> = {
      tree: [],
      shrub: [],
      grass: [],
      flower: [],
      coral: [],
    }
    for (const inst of vegetationInstances) {
      groups[inst.type].push(inst)
    }
    return groups
  }, [vegetationInstances])

  // 几何体（各类型共享）
  const treeGeometry = useMemo(() => createTreeGeometry(), [])
  const shrubGeometry = useMemo(() => createShrubGeometry(), [])
  const grassGeometry = useMemo(() => createGrassGeometry(), [])
  const flowerGeometry = useMemo(() => createFlowerGeometry(), [])

  // 清理几何体
  useEffect(() => {
    return () => {
      treeGeometry.dispose()
      shrubGeometry.dispose()
      grassGeometry.dispose()
      flowerGeometry.dispose()
    }
  }, [treeGeometry, shrubGeometry, grassGeometry, flowerGeometry])

  return (
    <group>
      <VegetationLayer
        type="tree"
        instances={grouped.tree}
        geometry={treeGeometry}
      />
      <VegetationLayer
        type="shrub"
        instances={grouped.shrub}
        geometry={shrubGeometry}
      />
      <VegetationLayer
        type="grass"
        instances={grouped.grass}
        geometry={grassGeometry}
      />
      <VegetationLayer
        type="flower"
        instances={grouped.flower}
        geometry={flowerGeometry}
      />
    </group>
  )
}

export default Vegetation