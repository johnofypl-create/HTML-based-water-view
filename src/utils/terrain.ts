/**
 * @module utils/terrain
 * @layer utils（叶子层）
 * @purpose 地形高度单一事实源 heightAt + 河流路径/坡度/法线/生物群系
 * @dependsOn ['utils/noise', 'utils/math', 'config/constants', 'config/biomeConfig']
 * @exports [RIVER_CONTROL_POINTS, riverTangentAt, heightAt, slopeAt, normalAt, biomeAt, isUnderwater, getRiverPath, RIVER_HALF_WIDTH]
 * @aiEdit
 *   - 改地形形状 → 只改 heightAt（全库单一事实源，改一处全局生效）；算法改动属核心层，本次重构不动
 */
/**
 * 地形高度函数（纯函数）
 * 地形网格、水着色器（深度色）、植被分布共用同一 heightAt，保证一致性。
 *
 * 设计：
 *  - 多层 fBm 叠加（大陆/丘陵/细节）
 *  - 海岸塑形：在海平面附近压平形成沙滩
 *  - 悬崖：用 ridge 噪声在某侧形成陡岸
 *  - 河流 carve：沿 Catmull-Rom 样条挖槽，形成入海径流
 */
import { fbm, ridge, noise } from './noise'
import { smoothstep, clamp, gaussian } from './math'
import { WORLD_SIZE } from '../config/constants'
import { classifyBiome, Biome, BIOME_SLOPES } from '../config/biomeConfig'

/** 河流样条控制点（世界坐标 XZ，从西北高地流向东南入海） */
export const RIVER_CONTROL_POINTS: [number, number][] = [
  [-WORLD_SIZE * 0.42, -WORLD_SIZE * 0.30],
  [-WORLD_SIZE * 0.22, -WORLD_SIZE * 0.10],
  [-WORLD_SIZE * 0.05, -WORLD_SIZE * 0.22],
  [WORLD_SIZE * 0.12, -WORLD_SIZE * 0.02],
  [WORLD_SIZE * 0.28, WORLD_SIZE * 0.18],
  [WORLD_SIZE * 0.40, WORLD_SIZE * 0.34],
]

/** 河流宽度（世界单位） */
const RIVER_WIDTH = 3.2
/** 河流挖深 */
const RIVER_DEPTH = 1.6

/** 预采样河流样条点（用于最近距离查询），数量足够密 */
const RIVER_SAMPLES = 240

/** Catmull-Rom 样条插值（t ∈ [0,1] 跨整条线） */
function catmullRom(points: [number, number][], t: number): [number, number] {
  const n = points.length - 1
  const seg = clamp(Math.floor(t * n), 0, n - 1)
  const localT = t * n - seg
  const p0 = points[Math.max(0, seg - 1)]
  const p1 = points[seg]
  const p2 = points[seg + 1]
  const p3 = points[Math.min(n, seg + 2)]
  const t2 = localT * localT
  const t3 = t2 * localT
  const x =
    0.5 *
    (2 * p1[0] +
      (-p0[0] + p2[0]) * localT +
      (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 +
      (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3)
  const z =
    0.5 *
    (2 * p1[1] +
      (-p0[1] + p2[1]) * localT +
      (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 +
      (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3)
  return [x, z]
}

/** 预计算的河流采样点（位置 + 累计弧长归一 t） */
const riverSampled: { x: number; z: number; t: number }[] = []
for (let i = 0; i <= RIVER_SAMPLES; i++) {
  const t = i / RIVER_SAMPLES
  const [x, z] = catmullRom(RIVER_CONTROL_POINTS, t)
  riverSampled.push({ x, z, t })
}

/** 沿样条的河流流向（切线，归一化） */
export function riverTangentAt(x: number, z: number): [number, number] {
  // 找最近点
  let best = riverSampled[0]
  let bestD = Infinity
  for (const s of riverSampled) {
    const dx = s.x - x
    const dz = s.z - z
    const d = dx * dx + dz * dz
    if (d < bestD) {
      bestD = d
      best = s
    }
  }
  const next = catmullRom(RIVER_CONTROL_POINTS, clamp(best.t + 0.01, 0, 1))
  let tx = next[0] - best.x
  let tz = next[1] - best.z
  const len = Math.hypot(tx, tz) || 1
  return [tx / len, tz / len]
}

/** 求点到河流样条的最近距离 */
function distanceToRiver(x: number, z: number): number {
  let bestD = Infinity
  for (const s of riverSampled) {
    const dx = s.x - x
    const dz = s.z - z
    const d = dx * dx + dz * dz
    if (d < bestD) bestD = d
  }
  return Math.sqrt(bestD)
}

/**
 * 地形高度纯函数（世界坐标 XZ → Y）
 * 地形、水、植被共用，保证一致。
 */
export function heightAt(x: number, z: number): number {
  // 1. 大陆起伏（低频，大尺度）
  let h = fbm(x * 0.012, z * 0.012, 4) * 7.5

  // 2. 丘陵（中频）
  h += fbm(x * 0.045, z * 0.045, 3, 2, 0.5, noise.B) * 1.8

  // 3. 细节（高频，小幅）
  h += fbm(x * 0.18, z * 0.18, 2, 2, 0.5, noise.C) * 0.35

  // 整体抬高一点，让陆地多于海
  h += 1.2

  // 4. 海岸塑形：在海平面附近压平形成沙滩
  //    beach 权重在 h≈0.3 附近最大，向两侧衰减
  const beachBand = smoothstep(-0.6, 0.5, h) * (1.0 - smoothstep(0.5, 2.2, h))
  h = h * (1 - beachBand * 0.65) + 0.32 * (beachBand * 0.65)

  // 5. 悬崖：东南角用 ridge 噪声抬升形成陡岸
  //    用一个方向性遮罩限制悬崖区域
  const cliffMask = smoothstep(0.2, 0.9, fbm(x * 0.008 + 100, z * 0.008 - 50, 2))
  const cliffSide = smoothstep(WORLD_SIZE * 0.1, WORLD_SIZE * 0.42, z) * smoothstep(-WORLD_SIZE * 0.1, WORLD_SIZE * 0.35, x)
  h += ridge(x * 0.03, z * 0.03, 4) * 5.5 * cliffMask * cliffSide

  // 6. 河流 carve：沿样条挖槽
  const riverD = distanceToRiver(x, z)
  if (riverD < RIVER_WIDTH * 2.5) {
    // 河床下降量随到样条距离的高斯衰减
    const carve = gaussian(riverD, RIVER_WIDTH * 0.7) * RIVER_DEPTH
    h -= carve
    // 河岸轻微抬升形成自然堤
    const bank = (gaussian(riverD, RIVER_WIDTH * 1.4) - gaussian(riverD, RIVER_WIDTH * 0.7)) * 0.4
    h += bank
  }

  // 7. 边缘渐隐：让地形四周向下过渡到基面，配合裙边
  const edgeDist = Math.min(
    WORLD_SIZE / 2 - Math.abs(x),
    WORLD_SIZE / 2 - Math.abs(z),
  )
  const edgeFade = smoothstep(0, WORLD_SIZE * 0.12, edgeDist)
  h *= 0.35 + 0.65 * edgeFade

  return h
}

/** 解析法计算地形坡度（弧度）。用有限差分。 */
export function slopeAt(x: number, z: number): number {
  const eps = 0.6
  const hL = heightAt(x - eps, z)
  const hR = heightAt(x + eps, z)
  const hD = heightAt(x, z - eps)
  const hU = heightAt(x, z + eps)
  const dx = (hR - hL) / (2 * eps)
  const dz = (hU - hD) / (2 * eps)
  return Math.atan(Math.hypot(dx, dz))
}

/** 解析法线 */
export function normalAt(x: number, z: number): [number, number, number] {
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

/** 高度 + 坡度 → biome */
export function biomeAt(x: number, z: number): Biome {
  const h = heightAt(x, z)
  const s = slopeAt(x, z)
  return classifyBiome(h, s)
}

/** 是否在水下（用于植被/焦散判定） */
export function isUnderwater(x: number, z: number): boolean {
  return heightAt(x, z) < 0.02
}

/** 河流样条采样点（供 River.tsx 生成水面几何） */
export function getRiverPath(samples = 120): [number, number][] {
  const pts: [number, number][] = []
  for (let i = 0; i <= samples; i++) {
    pts.push(catmullRom(RIVER_CONTROL_POINTS, i / samples))
  }
  return pts
}

/** 河流宽度（供 River.tsx） */
export const RIVER_HALF_WIDTH = RIVER_WIDTH

export { BIOME_SLOPES }
