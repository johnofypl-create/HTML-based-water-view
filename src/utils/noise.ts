/**
 * 噪声封装
 * 基于 simplex-noise，种子化、可复现。提供多层 fBm。
 * heightAt / 植被分布 / 河流样条共用同一实例，保证一致。
 */
import { createNoise2D } from 'simplex-noise'
import { mulberry32 } from './math'
import { SEED } from '../config/constants'

/** 主噪声工厂（种子化） */
function makeNoise2D(seed: number) {
  const rng = mulberry32(seed)
  return createNoise2D(rng)
}

/** 三组不同频率的噪声实例，避免相位耦合 */
const noise2D_A = makeNoise2D(SEED)
const noise2D_B = makeNoise2D(SEED + 7919)
const noise2D_C = makeNoise2D(SEED + 65537)
const noise2D_D = makeNoise2D(SEED + 2654435761)

/** 分形布朗运动（fBm）：多层叠加噪声
 *  @param x, y 采样坐标（注意：传入前已乘频率）
 *  @param octaves 层数
 *  @param lacunarity 每层频率倍增（默认2）
 *  @param gain 每层振幅衰减（默认0.5）
 *  @param noise 使用的噪声实例
 */
export function fbm(
  x: number,
  y: number,
  octaves = 4,
  lacunarity = 2,
  gain = 0.5,
  noise: (x: number, y: number) => number = noise2D_A,
): number {
  let amp = 1
  let freq = 1
  let sum = 0
  let norm = 0
  for (let i = 0; i < octaves; i++) {
    sum += amp * noise(x * freq, y * freq)
    norm += amp
    amp *= gain
    freq *= lacunarity
  }
  return sum / norm
}

/** 脊状噪声（ridge）：用于悬崖/岩石的锐利感 */
export function ridge(
  x: number,
  y: number,
  octaves = 4,
  noise: (x: number, y: number) => number = noise2D_A,
): number {
  let amp = 1
  let freq = 1
  let sum = 0
  let norm = 0
  for (let i = 0; i < octaves; i++) {
    const n = 1 - Math.abs(noise(x * freq, y * freq))
    sum += amp * n * n
    norm += amp
    amp *= 0.5
    freq *= 2
  }
  return sum / norm
}

export const noise = {
  A: noise2D_A,
  B: noise2D_B,
  C: noise2D_C,
  D: noise2D_D,
}
