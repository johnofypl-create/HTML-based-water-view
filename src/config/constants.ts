/**
 * 配置总入口（barrel）。
 * 具体常量按域拆分到 world/camera/perf/spray/time.ts；
 * 下游 import 路径保持不变，例如：
 *   import { WORLD_SIZE, CAMERA, PERF, SPRAY } from '../config/constants'
 */
export * from './world'
export * from './camera'
export * from './perf'
export * from './spray'
export * from './time'
