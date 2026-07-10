/**
 * 植被放置采样
 * 对地形做网格采样，按 biome 密度 + 噪声调制决定是否放置，
 * poisson 抖动避免网格感，低频噪声形成自然集群。
 */
import { mulberry32, smoothstep } from './math'
import { noise } from './noise'
import { heightAt, slopeAt } from './terrain'
import { biomeAt } from './terrain'
import { BIOME_DENSITY, BIOME_SLOPES, Biome } from '../config/biomeConfig'
import { WORLD_SIZE } from '../config/constants'

export interface VegetationInstance {
  position: [number, number, number]
  /** Y 轴旋转 */
  rotationY: number
  /** 均匀缩放 */
  scale: number
  /** 动画相位（0-2π） */
  phase: number
  /** 贴法线的倾斜（用于贴坡） */
  normal: [number, number, number]
  /** 来源 biome，供着色/LOD */
  biome: Biome
}

export type SpeciesKey = 'grass' | 'flower' | 'bush' | 'tree' | 'rock' | 'driftwood'

/**
 * 生成某物种的实例数组
 * @param species 物种
 * @param targetCount 目标数量上限
 * @param seed 随机种子
 * @param excludeUnderwater 是否排除水下点（草/花/树排除，岩石可保留浅水）
 */
export function sampleVegetation(
  species: SpeciesKey,
  targetCount: number,
  seed: number,
  excludeUnderwater = true,
): VegetationInstance[] {
  const rng = mulberry32(seed + species.charCodeAt(0) * 131)
  const instances: VegetationInstance[] = []

  // 用比 targetCount 更密的候选网格，按密度概率接受
  const candidates = Math.ceil(targetCount * 6)
  // 候选网格半径：覆盖世界
  const half = WORLD_SIZE * 0.48

  for (let i = 0; i < candidates && instances.length < targetCount; i++) {
    // 均匀网格 + 抖动，避免纯随机聚团
    const gridN = Math.ceil(Math.sqrt(candidates))
    const gx = i % gridN
    const gz = Math.floor(i / gridN) % gridN
    const cellX = (gx / gridN) * 2 - 1
    const cellZ = (gz / gridN) * 2 - 1
    const jitterX = (rng() - 0.5) * (2 / gridN) * 1.6
    const jitterZ = (rng() - 0.5) * (2 / gridN) * 1.6
    const x = (cellX + jitterX) * half
    const z = (cellZ + jitterZ) * half

    const h = heightAt(x, z)
    if (excludeUnderwater && h < 0.05) continue

    const slope = slopeAt(x, z)
    // 陡坡不种草/花/树
    if ((species === 'grass' || species === 'flower' || species === 'tree') && slope > BIOME_SLOPES.steep) {
      continue
    }

    const biome = biomeAt(x, z)
    let density = BIOME_DENSITY[biome][species]
    if (density <= 0) continue

    // 集群：低频噪声调制密度形成"丛"
    const cluster = smoothstep(0.35, 0.7, fbm2(x * 0.04, z * 0.04))
    density *= 0.3 + 0.9 * cluster

    // 物种特化：草在林地略减（让位给灌木/树）
    if (species === 'grass' && biome === Biome.Forest) density *= 0.5
    if (species === 'tree' && biome === Biome.Grass) density *= 0.25
    // 沙滩漂流木集中在水线
    if (species === 'driftwood') density *= smoothstep(0.0, 0.5, h) * (1.0 - smoothstep(0.3, 1.5, h))

    if (rng() > density) continue

    // 法线贴坡
    const normal = normalFromHeight(x, z)
    instances.push({
      position: [x, h, z],
      rotationY: rng() * Math.PI * 2,
      scale: 0.8 + rng() * 0.5,
      phase: rng() * Math.PI * 2,
      normal,
      biome,
    })
  }

  return instances
}

function fbm2(x: number, y: number) {
  return (noise.A(x, y) + 1) * 0.5
}

function normalFromHeight(x: number, z: number): [number, number, number] {
  const eps = 0.6
  const hL = heightAt(x - eps, z)
  const hR = heightAt(x + eps, z)
  const hD = heightAt(x, z - eps)
  const hU = heightAt(x, z + eps)
  const dx = (hR - hL) / (2 * eps)
  const dz = (hU - hD) / (2 * eps)
  const nx = -dx
  const ny = 1
  const nz = -dz
  const len = Math.hypot(nx, ny, nz)
  return [nx / len, ny / len, nz / len]
}
