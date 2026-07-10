/**
 * utils/ 公开 API：纯函数工具（数学 / 噪声 / 地形 / 采样 / 合并 / GLSL 片段）。
 * 叶子层，不得 import 任何 src/ 内部模块（R1）。
 */
export * from './math'
export * from './noise'
export * from './glslChunks'
export * from './terrain'
export * from './sampling'
export * from './mergeGeometry'
