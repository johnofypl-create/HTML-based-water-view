export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

export function mapRange(
  value: number,
  inMin: number,
  inMax: number,
  outMin: number,
  outMax: number
): number {
  return outMin + ((value - inMin) / (inMax - inMin)) * (outMax - outMin)
}

export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1)
  return t * t * (3 - 2 * t)
}

// 将小时（0-24）转换为太阳位置
export function getSunPosition(hour: number): [number, number, number] {
  // 太阳轨道：从东到西，6点为日出，18点为日落
  const angle = ((hour - 6) / 12) * Math.PI // 0 at sunrise, PI at sunset
  const distance = 20
  const height = Math.sin(angle) * distance * 0.8
  
  return [
    Math.cos(angle) * distance,
    Math.max(height, -2), // 最低点
    -5, // 稍微偏南
  ]
}

// 将小时转换为月亮位置（与太阳相对）
export function getMoonPosition(hour: number): [number, number, number] {
  const angle = ((hour - 18) / 12) * Math.PI
  const distance = 20
  const height = Math.sin(angle) * distance * 0.8
  
  return [
    Math.cos(angle) * distance,
    Math.max(height, -2),
    -5,
  ]
}
