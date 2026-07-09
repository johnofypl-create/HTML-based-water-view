// 简化版噪声函数用于地形生成
// 使用正弦波组合模拟，避免引入额外依赖

export function noise2D(x: number, y: number, seed: number = 0): number {
  const n = Math.sin(x * 12.9898 + y * 78.233 + seed) * 43758.5453
  return n - Math.floor(n)
}

export function smoothNoise2D(x: number, y: number, seed: number = 0): number {
  const ix = Math.floor(x)
  const iy = Math.floor(y)
  const fx = x - ix
  const fy = y - iy

  // Smoothstep
  const sx = fx * fx * (3 - 2 * fx)
  const sy = fy * fy * (3 - 2 * fy)

  const n00 = noise2D(ix, iy, seed)
  const n10 = noise2D(ix + 1, iy, seed)
  const n01 = noise2D(ix, iy + 1, seed)
  const n11 = noise2D(ix + 1, iy + 1, seed)

  const nx0 = n00 + (n10 - n00) * sx
  const nx1 = n01 + (n11 - n01) * sx

  return nx0 + (nx1 - nx0) * sy
}

export function fbm(
  x: number,
  y: number,
  octaves: number = 4,
  lacunarity: number = 2.0,
  gain: number = 0.5,
  seed: number = 0
): number {
  let value = 0
  let amplitude = 1
  let frequency = 1
  let maxValue = 0

  for (let i = 0; i < octaves; i++) {
    value += amplitude * smoothNoise2D(x * frequency, y * frequency, seed + i * 100)
    maxValue += amplitude
    amplitude *= gain
    frequency *= lacunarity
  }

  return value / maxValue
}
