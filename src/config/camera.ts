/**
 * @module config/camera
 * @layer config（叶子层）
 * @purpose 相机轨道约束：初始位姿、缩放距离、极角范围、阻尼
 * @dependsOn []
 * @exports [CAMERA]
 * @aiEdit 调相机距离 / 角度 / 平滑 → 改 CAMERA
 */
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
