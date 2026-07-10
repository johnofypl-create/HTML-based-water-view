/**
 * @module config/world
 * @layer config（叶子层）
 * @purpose 世界几何常量：世界尺寸、海平面、地形网格分段、高度场纹理分辨率、展示底座
 * @dependsOn []
 * @exports [WORLD_SIZE, TERRAIN_SEGMENTS, SEA_LEVEL, WATER_LEVEL, BASE_Y, HEIGHT_TEX_SIZE]
 * @aiEdit 改世界尺度 / 地形精度 → 直接改对应常量；下游经 config/constants barrel 引用，路径不变
 */

/** 世界边长（Three.js 单位）。80-120 之间视觉与性能平衡。 */
export const WORLD_SIZE = 96

/** 地形网格分段数。越高越精细，draw call 不变但顶点数上升。 */
export const TERRAIN_SEGMENTS = 256

/** 海平面 Y 坐标。地形高度函数以此为参考。 */
export const SEA_LEVEL = 0

/** 水面平面 Y（略高于海平面避免与河床 Z-fighting） */
export const WATER_LEVEL = 0.02

/** 地形裙边（截面）下沉到的基面 Y，形成实体块侧面。 */
export const BASE_Y = -9

/** 水着色器采样地形高度用的纹理分辨率。需覆盖世界精度。 */
export const HEIGHT_TEX_SIZE = 512
