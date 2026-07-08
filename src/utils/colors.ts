// 将 hex 颜色转换为 Three.js Color
export function hexToColor(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  if (!result) return { r: 1, g: 1, b: 1 }
  return {
    r: parseInt(result[1], 16) / 255,
    g: parseInt(result[2], 16) / 255,
    b: parseInt(result[3], 16) / 255,
  }
}

export function lerpColor(
  color1: string,
  color2: string,
  t: number
): string {
  const c1 = hexToColor(color1)
  const c2 = hexToColor(color2)
  
  const r = Math.round((c1.r + (c2.r - c1.r) * t) * 255)
  const g = Math.round((c1.g + (c2.g - c1.g) * t) * 255)
  const b = Math.round((c1.b + (c2.b - c1.b) * t) * 255)
  
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
}
