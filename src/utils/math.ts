/**
 * 通用数学工具
 * clamp / lerp / remap / smoothstep / easing / 色相工具
 */

export const clamp = (v: number, lo: number, hi: number) =>
  v < lo ? lo : v > hi ? hi : v

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t

export const remap = (
  v: number,
  inMin: number,
  inMax: number,
  outMin: number,
  outMax: number,
) => {
  const t = clamp((v - inMin) / (inMax - inMin), 0, 1)
  return lerp(outMin, outMax, t)
}

/** GLSL 风格 smoothstep */
export const smoothstep = (edge0: number, edge1: number, x: number) => {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1)
  return t * t * (3 - 2 * t)
}

/** 更陡的 smootherstep */
export const smootherstep = (edge0: number, edge1: number, x: number) => {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1)
  return t * t * t * (t * (t * 6 - 15) + 10)
}

export const TAU = Math.PI * 2

/** 环形插值角度（最短路径） */
export const lerpAngle = (a: number, b: number, t: number) => {
  let diff = ((b - a) % TAU + TAU + Math.PI) % TAU - Math.PI
  return a + diff * t
}

/** 24h 环形插值（用于时间系统，跨越 23→0→5） */
export const lerpTime = (a: number, b: number, t: number) => {
  let diff = b - a
  if (diff > 12) diff -= 24
  else if (diff < -12) diff += 24
  return (a + diff * t + 24) % 24
}

/** 三维向量插值（数组形式） */
export const lerpVec3 = (
  a: [number, number, number],
  b: [number, number, number],
  t: number,
): [number, number, number] => [
  lerp(a[0], b[0], t),
  lerp(a[1], b[1], t),
  lerp(a[2], b[2], t),
]

/** 在排序的关键帧时间数组中找到包围 t 的两帧索引与局部插值因子 */
export function findKeyframe(times: number[], t: number): [number, number, number] {
  const n = times.length
  // 找到 t 落在哪一段
  let i = 0
  for (let k = 0; k < n; k++) {
    const next = times[(k + 1) % n]
    const cur = times[k]
    // 处理跨夜
    let lo = cur
    let hi = next
    if (hi <= lo) hi += 24
    let tt = t
    if (tt < lo) tt += 24
    if (tt >= lo && tt < hi) {
      i = k
      const span = hi - lo
      const localT = span > 0 ? (tt - lo) / span : 0
      return [i, (k + 1) % n, localT]
    }
  }
  return [0, 1, 0]
}

/** 高斯函数 */
export const gaussian = (x: number, sigma: number) =>
  Math.exp(-(x * x) / (2 * sigma * sigma))

/** 随机数生成器（mulberry32，种子化） */
export function mulberry32(seed: number) {
  let a = seed >>> 0
  return function () {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
