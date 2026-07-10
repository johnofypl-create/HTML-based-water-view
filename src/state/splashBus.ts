/**
 * @module state/splashBus
 * @layer state（状态层）
 * @purpose 事件总线（地形改造溅水发布/订阅），解耦发射与渲染
 * @dependsOn []
 * @exports [SplashEvent, splashBus]
 * @aiEdit
 *   - 触发地形改造溅水 → splashBus.emit({pos,intensity})，无需改 SprayParticles
 */
import * as THREE from 'three'

export interface SplashEvent {
  /** 世界坐标（溅水中心） */
  pos: THREE.Vector3
  /** 强度 0~1+，决定 burst 粒子数 */
  intensity: number
}

type SplashListener = (e: SplashEvent) => void

/**
 * 极简溅水事件总线（无外部依赖）。
 *
 * 这是「地形改造溅水」与未来地形编辑系统的对接缝：
 *   - SprayParticles 订阅此总线，收到事件即在中心 burst 一簇粒子；
 *   - 未来地形编辑器只需 `import { splashBus }` 并 `splashBus.emit({ pos, intensity })`，
 *     无需改动飞溅组件本身。
 */
class SplashBus {
  private listeners = new Set<SplashListener>()

  emit(e: SplashEvent) {
    for (const l of this.listeners) l(e)
  }

  on(l: SplashListener): () => void {
    this.listeners.add(l)
    return () => {
      this.listeners.delete(l)
    }
  }
}

export const splashBus = new SplashBus()
