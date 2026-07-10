/**
 * @module config/time
 * @layer config（叶子层）
 * @purpose 时间 / 随机种子 / 太阳距离：保证场景可复现与昼夜定位
 * @dependsOn []
 * @exports [SEED, DEFAULT_TIME_OF_DAY, SUN_DISTANCE]
 * @aiEdit 改初始时间 / 种子 → 改此处；昼夜关键帧配色在 config/timePresets.ts
 */
/** 全局随机种子。保证地形/植被/河流可复现。 */
export const SEED = 20260708

/** 默认初始时间（午后，小时制） */
export const DEFAULT_TIME_OF_DAY = 15

/** 太阳方向光距离（用于定位光源） */
export const SUN_DISTANCE = 90
