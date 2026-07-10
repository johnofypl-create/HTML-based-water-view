/**
 * state/ 公开 API：跨层共享状态三种模式。
 *  - useGameStore（zustand 响应式）：UI / 时间 / 相机状态
 *  - lightingState（可变单例，每帧读写）：场景光状态
 *  - splashBus（事件总线）：地形改造溅水发布 / 订阅
 * ⚠️ 别混用，见 docs/ARCHITECTURE.md §5。
 */
export * from './useGameStore'
export * from './lightingState'
export * from './splashBus'
