/**
 * @module config/spray
 * @layer config（叶子层）
 * @purpose 飞溅粒子（浪花 / 水花）参数：池大小、重力、寿命、发射节流、触发阈值
 * @dependsOn []
 * @exports [SPRAY]
 * @aiEdit 调粒子数 / 尺寸 / 寿命 / 触发密度 → 改 SPRAY（消费方见 water/SprayParticles.tsx）
 */
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
