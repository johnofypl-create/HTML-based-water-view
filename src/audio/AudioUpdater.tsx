/**
 * @module audio/AudioUpdater
 * @layer audio（域层）
 * @purpose 音频状态每帧更新组件
 * @dependsOn ['audio/AudioManager', 'state/useGameStore']
 * @exports [AudioUpdater, AudioUpdater]
 * @aiEdit
 *   - 改本文件导出的 AudioUpdater、AudioUpdater 即可；依赖见 @dependsOn
 */
/**
 * 音频更新组件（挂在 Canvas 内，每帧驱动 audioManager.update）
 */
import { useFrame } from '@react-three/fiber'
import { audioManager } from './AudioManager'
import { useGameStore } from '../state/useGameStore'

export default function AudioUpdater() {
  useFrame(() => {
    if (audioManager.started) {
      audioManager.update(useGameStore.getState().timeOfDay)
    }
  })
  return null
}
