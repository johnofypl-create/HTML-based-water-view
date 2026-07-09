import type { VegetationInstance, VegetationType } from '../../types'
import { fbm } from '../../utils/noise'
import { clamp, mapRange } from '../../utils/math'
import { TERRAIN_CONFIG } from '../../config/constants'

// 简单的种子随机数生成器 (mulberry32)
function createRNG(seed: number): () => number {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export interface VegetationPlacementConfig {
  trees: number
  shrubs: number
  grass: number
  flowers: number
}

// 生成植被放置数据
export function generateVegetationPlacement(
  terrainHeight: (x: number, z: number) => number,
  terrainSlope: (x: number, z: number) => number,
  worldSize: number,
  seaLevel: number,
  config: VegetationPlacementConfig
): VegetationInstance[] {
  const rng = createRNG(42)
  const halfSize = worldSize / 2
  const instances: VegetationInstance[] = []

  // 每种类型的规则
  const typeRules: {
    type: VegetationType
    count: number
    minHeight: number
    maxSlope: number
    cellSize: number
  }[] = [
    {
      type: 'tree',
      count: config.trees,
      minHeight: seaLevel + 0.5,
      maxSlope: 0.3,
      cellSize: calculateCellSize(worldSize, config.trees, 0.7),
    },
    {
      type: 'shrub',
      count: config.shrubs,
      minHeight: seaLevel + 0.2,
      maxSlope: 0.5,
      cellSize: calculateCellSize(worldSize, config.shrubs, 0.8),
    },
    {
      type: 'grass',
      count: config.grass,
      minHeight: seaLevel + 0.08,
      maxSlope: 0.8,
      cellSize: calculateCellSize(worldSize, config.grass, 1.0),
    },
    {
      type: 'flower',
      count: config.flowers,
      minHeight: seaLevel + 0.15,
      maxSlope: 0.5,
      cellSize: calculateCellSize(worldSize, config.flowers, 0.6),
    },
  ]

  // 为每种类型独立生成候选
  for (const rule of typeRules) {
    const candidates = generateCandidatesForType(
      rule,
      terrainHeight,
      terrainSlope,
      halfSize,
      rng,
    )
    // 随机选择所需数量
    const selected = selectRandom(candidates, rule.count, rng)
    for (const c of selected) {
      instances.push(c)
    }
  }

  return instances
}

function calculateCellSize(worldSize: number, count: number, densityFactor: number): number {
  if (count <= 0) return worldSize
  const area = worldSize * worldSize
  const density = (count / area) * densityFactor
  return Math.sqrt(1 / Math.max(density, 0.001))
}

interface Candidate {
  x: number
  z: number
  height: number
  slope: number
}

function generateCandidatesForType(
  rule: {
    type: VegetationType
    minHeight: number
    maxSlope: number
    cellSize: number
  },
  terrainHeight: (x: number, z: number) => number,
  terrainSlope: (x: number, z: number) => number,
  halfSize: number,
  rng: () => number,
): VegetationInstance[] {
  const instances: VegetationInstance[] = []
  const cols = Math.ceil((halfSize * 2) / rule.cellSize)
  const rows = cols

  // 使用分形噪声作为密度掩码，实现自然聚类
  const densityScale = 0.15

  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      const baseX = -halfSize + (i + 0.5) * rule.cellSize
      const baseZ = -halfSize + (j + 0.5) * rule.cellSize

      // 抖动
      const jitterX = (rng() - 0.5) * rule.cellSize * 0.9
      const jitterZ = (rng() - 0.5) * rule.cellSize * 0.9
      const x = clamp(baseX + jitterX, -halfSize + 0.1, halfSize - 0.1)
      const z = clamp(baseZ + jitterZ, -halfSize + 0.1, halfSize - 0.1)

      const h = terrainHeight(x, z)
      const s = terrainSlope(x, z)

      if (h < rule.minHeight || s > rule.maxSlope) {
        continue
      }

      // 密度掩码：用噪声值决定是否放置
      const density = fbm(x * densityScale, z * densityScale, 3, 2.0, 0.5, 7890 + rule.type.length)
      const threshold = 0.3
      if (density < threshold) {
        continue
      }

      // 为不同植被类型添加额外的分布约束
      if (!passesTypeSpecificCheck(rule.type, x, z, h, s, halfSize)) {
        continue
      }

      const instance = createInstance(rule.type, x, h, z, rng)
      instances.push(instance)
    }
  }

  return instances
}

function passesTypeSpecificCheck(
  type: VegetationType,
  x: number,
  z: number,
  height: number,
  _slope: number,
  halfSize: number,
): boolean {
  // 树：远离海岸线，在较高地带聚集
  if (type === 'tree') {
    const distFromCenter = Math.sqrt(x * x + z * z) / halfSize
    // 树不应该太靠近边缘（避免悬崖边缘）
    const edgeDist = Math.min(
      Math.abs(x + halfSize),
      Math.abs(x - halfSize),
      Math.abs(z + halfSize),
      Math.abs(z - halfSize),
    )
    if (edgeDist < 1.5) return false
    // 在左半部分（高地）密度更高
    const densityBias = fbm(x * 0.1, z * 0.1, 2, 2.0, 0.5, 4321)
    const threshold = mapRange(distFromCenter, 0, 0.8, 0.25, 0.55)
    return densityBias > threshold
  }

  // 灌木：过渡区域，在森林和草地之间
  if (type === 'shrub') {
    // 灌木在中等高度区域
    return true
  }

  // 草：大多数区域都可以
  if (type === 'grass') {
    return true
  }

  // 花：在草地中散射
  if (type === 'flower') {
    // 花倾向出现在较低密度的草地中
    const grassDensity = fbm(x * 0.2, z * 0.2, 2, 2.0, 0.5, 5432)
    return grassDensity > 0.4
  }

  return true
}

function createInstance(
  type: VegetationType,
  x: number,
  h: number,
  z: number,
  rng: () => number,
): VegetationInstance {
  const rotation: [number, number, number] = [
    0,
    rng() * Math.PI * 2,
    0,
  ]

  let scale: [number, number, number]
  switch (type) {
    case 'tree':
      scale = [
        0.7 + rng() * 0.8,
        0.8 + rng() * 0.7,
        0.7 + rng() * 0.8,
      ]
      break
    case 'shrub':
      scale = [
        0.6 + rng() * 0.6,
        0.5 + rng() * 0.5,
        0.6 + rng() * 0.6,
      ]
      break
    case 'grass':
      scale = [
        0.6 + rng() * 0.6,
        0.7 + rng() * 0.8,
        0.6 + rng() * 0.6,
      ]
      break
    case 'flower':
      scale = [
        0.8 + rng() * 0.4,
        0.8 + rng() * 0.4,
        0.8 + rng() * 0.4,
      ]
      break
    default:
      scale = [1, 1, 1]
  }

  // 稍微随机倾斜
  if (type === 'grass' || type === 'flower') {
    rotation[0] = (rng() - 0.5) * 0.3
    rotation[2] = (rng() - 0.5) * 0.3
  }

  return {
    type,
    position: [x, h, z],
    rotation,
    scale,
  }
}

function selectRandom<T>(arr: T[], count: number, rng: () => number): T[] {
  if (arr.length <= count) return arr

  // Fisher-Yates shuffle 部分选择
  const result = [...arr]
  for (let i = 0; i < count; i++) {
    const j = i + Math.floor(rng() * (result.length - i))
    const tmp = result[i]
    result[i] = result[j]
    result[j] = tmp
  }
  return result.slice(0, count)
}