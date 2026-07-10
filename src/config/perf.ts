/**
 * @module config/perf
 * @layer config（叶子层）
 * @purpose 性能开关：植被 / 岩石实例上限、阴影分辨率、像素比
 * @dependsOn []
 * @exports [PERF]
 * @aiEdit 调画质 / 性能档位 → 改 PERF（实例数↑画质↑但更慢）
 */
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
