/**
 * @module water/surface/gerstner
 * @layer water（域层）
 * @purpose Gerstner 波单一事实源（TS 端采样，供 CPU 发射器/物理用）
 * @dependsOn []
 * @exports [GerstnerWave, GERSTNER_WAVES, primaryWindDir, GerstnerSample, sampleGerstner]
 * @aiEdit
 *   - 调波形/风向 → 改 GERSTNER_WAVES 数组与 primaryWindDir（与 gerstner.glsl.ts 同源）
 */
/**
 * Gerstner 波「单一事实源」
 *
 * 这里定义唯一一份波参数数组 GERSTNER_WAVES。
 *  - CPU 端：sampleGerstner(x,z,t) 供飞溅发射器（波峰碎浪 / 礁石拍浪）复用；
 *  - GPU 端：gerstner.glsl.ts 由同一数组「生成」GLSL 函数字符串供顶点着色器用。
 * 波参数只在此定义一次，CPU 与 GPU 永不漂移。
 *
 * 采用标准 Gerstner（含陡度 Q / 水平位移），因此可解析出雅可比 J，
 * 用于判断波面「折叠/破碎」处生成白帽（whitecap）。
 */

export interface GerstnerWave {
  /** 传播方向（已在此归一化的 xz 二维向量） */
  dirX: number
  dirZ: number
  /** 波数（空间频率），越大波长越短 */
  freq: number
  /** 相速度（时间频率） */
  speed: number
  /** 振幅（高度） */
  amp: number
  /** 陡度 Q：水平位移强度，越大波峰越尖、越易破碎。
   *  安全上限 Q <= 1/(freq*amp) 以避免自交打结。 */
  steep: number
}

/** 归一化二维方向，避免手写常量误差 */
function norm2(x: number, z: number): [number, number] {
  const l = Math.hypot(x, z) || 1
  return [x / l, z / l]
}

const D1 = norm2(1.0, 0.4)
const D2 = norm2(-0.5, 1.0)
const D3 = norm2(0.3, -0.8)

/**
 * 三个叠加波。振幅/频率/速度沿用旧 waterMaterial 的手感，
 * 额外补上陡度 steep 使其成为标准 Gerstner（旧实现只有 Y 位移）。
 * steep 远低于自交上限（如 wave1 上限 ≈ 1/(0.45*0.18)=12.3），安全。
 */
export const GERSTNER_WAVES: GerstnerWave[] = [
  { dirX: D1[0], dirZ: D1[1], freq: 0.45, speed: 0.8, amp: 0.18, steep: 2.0 },
  { dirX: D2[0], dirZ: D2[1], freq: 0.7, speed: 1.1, amp: 0.12, steep: 1.8 },
  { dirX: D3[0], dirZ: D3[1], freq: 1.1, speed: 1.5, amp: 0.07, steep: 1.5 },
]

/** 主波方向（用于风向 / 迎风侧判定），取振幅最大的波 */
export function primaryWindDir(): [number, number] {
  let best = GERSTNER_WAVES[0]
  for (const w of GERSTNER_WAVES) if (w.amp > best.amp) best = w
  return [best.dirX, best.dirZ]
}

export interface GerstnerSample {
  /** 水面相对基准的高度位移（叠加到 WATER_LEVEL） */
  height: number
  /** 水平位移 x/z（标准 Gerstner） */
  dispX: number
  dispZ: number
  /** 雅可比行列式；<1 表示波面被挤压，趋近 0/负数表示折叠破碎 */
  jacobian: number
  /** 高度对时间的变化率 dH/dt，判断波峰是否处于「上冲」段 */
  heightRate: number
}

/**
 * CPU 端 Gerstner 求值（与 GLSL 版数学完全一致）。
 * @param x 世界 X
 * @param z 世界 Z
 * @param t 时间（秒）
 */
export function sampleGerstner(x: number, z: number, t: number): GerstnerSample {
  let dispX = 0
  let dispZ = 0
  let height = 0
  let heightRate = 0
  let Jxx = 1
  let Jzz = 1
  let Jxz = 0

  for (const w of GERSTNER_WAVES) {
    const phase = (w.dirX * x + w.dirZ * z) * w.freq + t * w.speed
    const s = Math.sin(phase)
    const c = Math.cos(phase)
    dispX += w.steep * w.amp * w.dirX * c
    dispZ += w.steep * w.amp * w.dirZ * c
    height += w.amp * s
    heightRate += w.amp * c * w.speed // d/dt sin(phase) = cos*speed
    const qaf = w.steep * w.amp * w.freq
    Jxx -= qaf * w.dirX * w.dirX * s
    Jzz -= qaf * w.dirZ * w.dirZ * s
    Jxz -= qaf * w.dirX * w.dirZ * s
  }

  return {
    height,
    dispX,
    dispZ,
    jacobian: Jxx * Jzz - Jxz * Jxz,
    heightRate,
  }
}
