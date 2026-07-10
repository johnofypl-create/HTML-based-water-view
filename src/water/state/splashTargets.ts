/**
 * @module water/state/splashTargets
 * @layer water（域层）
 * @purpose 溅水目标注册表（礁石/岛屿登记，供拍浪判定）
 * @dependsOn []
 * @exports [SplashTarget, registerSplashTarget, getSplashTargets, tickSplashTargetCooldowns]
 * @aiEdit
 *   - 新增溅水目标（礁石/岛屿）→ registerSplashTarget({pos,radius,...})
 */
import * as THREE from 'three'

export interface SplashTarget {
  /** 障碍物世界中心 */
  pos: THREE.Vector3
  /** 半径（用于判定迎风侧边缘与浪涌范围） */
  radius: number
  /** 水位线 Y：浪涌过此线即起花 */
  waterlineY: number
  /** 相位偏移（错开各礁石拍浪节奏） */
  phase: number
  /** 冷却计时（秒，<=0 才允许 spawn） */
  cooldown: number
}

const targets: SplashTarget[] = []

/**
 * 注册一个溅水目标（礁石 / 岛屿）。返回注销函数。
 * 组件挂载时注册、卸载时注销，避免目标数组随重渲染累积。
 */
export function registerSplashTarget(t: Omit<SplashTarget, 'cooldown'>): () => void {
  const full: SplashTarget = { ...t, cooldown: 0 }
  targets.push(full)
  return () => {
    const i = targets.indexOf(full)
    if (i >= 0) targets.splice(i, 1)
  }
}

export function getSplashTargets(): readonly SplashTarget[] {
  return targets
}

/** 每帧推进所有目标的冷却计时 */
export function tickSplashTargetCooldowns(dt: number) {
  for (const t of targets) if (t.cooldown > 0) t.cooldown -= dt
}
