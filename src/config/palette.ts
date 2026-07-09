/**
 * 自然调色板
 * 克制、柔和、暖调偏自然。所有颜色为线性 sRGB（hex 三位数→Vector3）。
 * 避免 AAAA 级饱和；追求景观建筑师的手工感。
 */
import * as THREE from 'three'

/** hex → THREE.Color（线性空间） */
const c = (hex: string) => new THREE.Color(hex)

/** biome 颜色组 */
export const PALETTE = {
  // 沙滩 / 沙丘
  sandDry: c('#d9c19a'),
  sandWet: c('#b89b72'),
  dune: c('#c9ad84'),
  // 草地（多层，避免单调）
  grassBright: c('#8a9a5a'),
  grassMid: c('#6f8246'),
  grassDry: c('#a39a5e'),
  // 灌木
  bushDark: c('#3f5a34'),
  bushMid: c('#54703f'),
  // 林地
  forestDeep: c('#2c4429'),
  forestMid: c('#3a5832'),
  forestLight: c('#4a6a3c'),
  // 岩石 / 悬崖
  rockLight: c('#9a9088'),
  rockMid: c('#7a7068'),
  rockDark: c('#5a5048'),
  cliffStrata: c('#6b5d4f'),
  // 花朵
  flowerWhite: c('#f0ead8'),
  flowerYellow: c('#e8c878'),
  flowerPink: c('#d8a0a8'),
  flowerLavender: c('#b098c0'),
  // 水体
  waterShallow: c('#5fc8c0'), // 浅绿松石
  waterMid: c('#3aa0b8'),     // 青
  waterDeep: c('#1c5a7a'),    // 深蓝
  waterFoam: c('#f4f0e6'),    // 泡沫
  // 河流
  riverShallow: c('#7ad0c8'),
  riverDeep: c('#3a98b0'),
  // 截面岩层（侧面条纹）
  strataSand: c('#cbb188'),
  strataSoil: c('#7a6450'),
  strataRock: c('#5a5048'),
  // 木结构
  woodDark: c('#5a4632'),
  woodLight: c('#7a6448'),
} as const

/** 海洋深度色梯度采样：水深 → 颜色 */
export function sampleWaterColor(depth: number): THREE.Color {
  if (depth < 1.2) return PALETTE.waterShallow.clone()
  if (depth < 3.5) {
    const t = (depth - 1.2) / (3.5 - 1.2)
    return PALETTE.waterShallow.clone().lerp(PALETTE.waterMid, t)
  }
  const t = Math.min(1, (depth - 3.5) / 6)
  return PALETTE.waterMid.clone().lerp(PALETTE.waterDeep, t)
}
