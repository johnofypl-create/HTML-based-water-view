import { useEffect } from 'react'
import { Terrain } from '../../systems/terrain/Terrain'
import { StructuralElements } from '../../systems/terrain/StructuralElements'
import { Vegetation } from '../../systems/vegetation/Vegetation'
import { Water } from '../../systems/water/Water'
import { Birds } from '../../systems/animation/Birds'
import { Fish } from '../../systems/animation/Fish'
import { Particles } from '../../systems/animation/Particles'
import { CloudShadows } from '../../systems/animation/CloudShadows'
import CameraController from '../../systems/camera/CameraController'
import TimeSystem from '../../systems/time/TimeSystem'
import { useCamera } from '../../hooks/useCamera'
import type { TimeState, TimeOfDay } from '../../types'
import PostProcessing from '../../systems/lighting/PostProcessing'

interface SceneProps {
  timeState: TimeState
  hour: number
  timeOfDay: TimeOfDay
}

function Scene({ timeState, hour, timeOfDay }: SceneProps) {
  const { controlsRef, resetCamera } = useCamera()

  // Listen for camera reset events from the UI layer
  useEffect(() => {
    const handleReset = () => resetCamera()
    window.addEventListener('camera-reset', handleReset)
    return () => window.removeEventListener('camera-reset', handleReset)
  }, [resetCamera])

  return (
    <>
      {/* 时间光照系统 */}
      <TimeSystem timeState={timeState} />

      {/* 地形 */}
      <Terrain />

      {/* 结构性环境元素 */}
      <StructuralElements />

      {/* 植被 */}
      <Vegetation />

      {/* 水体 */}
      <Water />

      {/* 环境动画 */}
      <Birds />
      <Fish />
      <Particles />
      <CloudShadows />

      {/* 相机控制 */}
      <CameraController controlsRef={controlsRef} />

      {/* 后期处理 */}
      <PostProcessing />

      {/* 展台底座 - 物理模型展示台 */}
      <mesh
        position={[0, -1.15, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
      >
        <planeGeometry args={[33, 33]} />
        <meshStandardMaterial color="#2c2c2c" roughness={0.6} metalness={0.1} />
      </mesh>
    </>
  )
}

export default Scene