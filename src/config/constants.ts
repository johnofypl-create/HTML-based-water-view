/**
 * 全局常量配置
 * 世界尺寸、种子、分段数、性能开关、相机约束等
 * 集中管理便于后续质量档位切换（阶段5）
 */

/** 世界边长（Three.js 单位）。80-120 之间视觉与性能平衡。 */
export const WORLD_SIZE = 96

/** 地形网格分段数。越高越精细，draw call 不变但顶点数上升。
 *  256 在中端机可稳 60fps；阶段5 可升 384。 */
export const TERRAIN_SEGMENTS = 256

/** 全局随机种子。保证地形/植被/河流可复现。 */
export const SEED = 20260708

/** 海平面 Y 坐标。地形高度函数以此为参考。 */
export const SEA_LEVEL = 0

/** 水面平面 Y（略高于海平面避免与河床 Z-fighting） */
export const WATER_LEVEL = 0.02

/** 地形裙边（截面）下沉到的基面 Y，形成实体块侧面。 */
export const BASE_Y = -9

/** 水着色器采样地形高度用的纹理分辨率。需覆盖世界精度。 */
export const HEIGHT_TEX_SIZE = 512

/** 默认初始时间（午后，小时制） */
export const DEFAULT_TIME_OF_DAY = 15

/** 太阳方向光距离（用于定位光源） */
export const SUN_DISTANCE = 90

/** 相机约束 */
export const CAMERA = {
  /** 初始位置 */
  initialPosition: [38, 30, 38] as [number, number, number],
  /** 初始注视目标 */
  initialTarget: [0, 2, -4] as [number, number, number],
  /** 最近缩放距离 */
  minDistance: 18,
  /** 最远缩放距离 */
  maxDistance: 95,
  /** 最大极角（防止翻到地下） */
  maxPolarAngle: Math.PI * 0.495,
  /** 最小极角（接近顶视） */
  minPolarAngle: Math.PI * 0.12,
  /** 阻尼系数，越小越平滑 */
  dampingFactor: 0.06,
} as const

/** 性能开关 */
export const PERF = {
  /** 草实例数上限 */
  grassCount: 9000,
  /** 花实例数上限 */
  flowerCount: 1500,
  /** 灌木实例数上限 */
  bushCount: 700,
  /** 树实例数上限 */
  treeCount: 320,
  /** 岩石实例数上限 */
  rockCount: 140,
  /** 漂流木实例数上限 */
  driftwoodCount: 26,
  /** 阴影贴图分辨率 */
  shadowMapSize: 2048,
  /** 阴影相机范围 */
  shadowCameraSize: 60,
  /** 像素比上限 */
  maxDpr: 2,
} as const

/** 飞溅粒子（浪花 / 水花）参数 */
export const SPRAY = {
  /** 粒子池上限（环形缓冲） */
  count: 4096,
  /** 重力加速度（世界单位/秒²，向下为负） */
  gravity: -9.8,
  /** 粒子基础尺寸（屏幕像素基准，最终还受透视/寿命衰减） */
  size: 30,
  /** 整体不透明度 */
  opacity: 0.92,
  /** 单粒基准寿命（秒），实际随机 [0.6,1.4]×life */
  life: 1.1,
  /** 每帧 spawn 上限（全局节流） */
  perFrameMax: 80,
  /** 每秒 spawn 上限 */
  perSecondMax: 600,
  /** 波峰碎浪：Jacobian 触发阈值（J < 此值才发射）。与着色器白帽阈值配合 */
  crestJacMargin: 0.78,
  /** 礁石拍浪冷却（秒） */
  rockCooldown: 0.3,
  /** 地形溅水：每次 burst 粒子数 = round(intensity × perIntensity) */
  splashPerIntensity: 18,
  /** 波峰扫描网格分辨率（一维），覆盖近岸世界范围 */
  scanGrid: 40,
  /** 波峰扫描覆盖范围（世界半边长） */
  scanExtent: 42,
} as const
