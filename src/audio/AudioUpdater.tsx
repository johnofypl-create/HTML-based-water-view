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
