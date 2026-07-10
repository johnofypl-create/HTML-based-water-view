/**
 * 水面高度统一抽象层。
 *
 * 所有「某个世界坐标处的水面在哪」查询都走这里：
 *   - 波峰自动碎浪发射（采样水面高度 + 雅可比）
 *   - 礁石拍浪判定（浪是否涌上礁石水位线）
 *   - 地形改造溅水（burst 的发射高度）
 *
 * 现在：WATER_LEVEL + Gerstner 波高。
 * 未来接「高度场灌水」（见 docs/physics-water-research.md 的 P 系列）时，
 * 只需把 sampleWaterSurface 改为读取水深场纹理 h：surfaceY = T(x,z)+h(x,z)。
 * 三种发射源与泡沫深度全部自动平滑衔接，无需改其它文件。
 *
 * 参考求解器已就绪：./shallowWater.ts（Virtual Pipes CPU 参考实现 + 数值收敛验证，
 * 跑 scripts/verify-shallow-water.ts 可复现收敛证据）。
 * P1 会把它移植到 GPUComputationRenderer（WebGL2 ping-pong）做实时灌水；
 * 那时地形 T 取自 getHeightFieldTexture()/heightAt，水深 h 由 GPU 求解器产出，
 * 本文件的 sampleWaterSurface 改为 surfaceY = T + h 即可，发射源/泡沫零改动。
 */
import { WATER_LEVEL } from '../config/constants'
import { sampleGerstner } from './gerstner'

export interface WaterSurfaceSample {
  /** 世界空间水面 Y */
  surfaceY: number
  /** 雅可比（<1 挤压，趋 0/负 折叠破碎） */
  jacobian: number
  /** dH/dt，>0 表示水面正在上冲 */
  heightRate: number
}

/** 采样某点水面高度与波面状态 */
export function sampleWaterSurface(x: number, z: number, t: number): WaterSurfaceSample {
  const g = sampleGerstner(x, z, t)
  return {
    surfaceY: WATER_LEVEL + g.height,
    jacobian: g.jacobian,
    heightRate: g.heightRate,
  }
}
