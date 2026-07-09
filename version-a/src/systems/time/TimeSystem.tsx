import { useThree, useFrame } from '@react-three/fiber'
import { useRef, useEffect, useMemo } from 'react'
import * as THREE from 'three'
import type { TimeState } from '../../types'
import Lighting from '../lighting/Lighting'
import { LIGHTING_CONFIG } from '../../config/constants'

interface TimeSystemProps {
  timeState: TimeState
}

function TimeSystem({ timeState }: TimeSystemProps) {
  const { scene } = useThree()

  // 当前插值状态（用于平滑过渡）
  const currentFogColor = useRef(new THREE.Color('#c8d8e8'))
  const currentSkyColor = useRef(new THREE.Color('#c8d8e8'))

  const targetFogColor = useMemo(() => new THREE.Color(timeState.fogColor), [timeState.fogColor])
  const targetSkyColor = useMemo(() => new THREE.Color(timeState.skyColor), [timeState.skyColor])

  // 初始化场景背景和雾
  useEffect(() => {
    scene.background = new THREE.Color(timeState.skyColor)
    scene.fog = new THREE.Fog(timeState.fogColor, LIGHTING_CONFIG.fogNear, LIGHTING_CONFIG.fogFar)

    return () => {
      scene.background = null
      scene.fog = null
    }
  }, [scene])

  // 每帧平滑过渡雾色和天空色
  useFrame((_, delta) => {
    const t = Math.min(delta * 2, 1) // 平滑因子
    currentFogColor.current.lerp(targetFogColor, t)
    currentSkyColor.current.lerp(targetSkyColor, t)

    if (scene.fog) {
      scene.fog.color.copy(currentFogColor.current)
    }
    if (scene.background) {
      (scene.background as THREE.Color).copy(currentSkyColor.current)
    }
  })

  return <Lighting timeState={timeState} />
}

export default TimeSystem