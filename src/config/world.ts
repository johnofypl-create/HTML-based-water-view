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

/** 物理水 GPU 模拟网格分辨率（Virtual Pipes ping-pong 纹理边长）。
 *  128 在 GPU 上每帧 2 趟约 3.3万 texel，开销可忽略；如需更精细岸线可调 256。 */
export const WATER_SIM_SIZE = 128

/** 虚拟管道导水系数 K（越大流得越快，过大不稳；与 CPU 参考求解器一致） */
export const SIM_K = 0.2

/** 单步时间步长 dt（固定，不喂真实 delta 以防帧率抖动击穿稳定条件） */
export const SIM_DT = 1.0

/** 每帧子步数（加速收敛 / 灌水观感） */
export const SIM_SUBSTEPS = 2

/** 单步允许流出比例上限（留缓冲防负水深爆炸，与 CPU 参考一致） */
export const SIM_OUT_BUFFER = 0.9
