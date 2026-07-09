import type { TimeState } from '../../types'
import { COLORS } from '../../config/palette'

interface LightingProps {
  timeState: TimeState
}

function Lighting({ timeState }: LightingProps) {
  const { sunPosition, sunIntensity, ambientIntensity, timeOfDay } = timeState

  // 根据时间调整光源颜色
  const sunColor = timeOfDay === 'sunset' ? '#ffd4a8'
    : timeOfDay === 'morning' ? '#fff0d0'
    : timeOfDay === 'night' ? '#2a3a5a'
    : '#fff5e6'

  const ambientColor = timeOfDay === 'night' ? '#1a2a4a'
    : timeOfDay === 'sunset' ? '#3a2a2a'
    : timeOfDay === 'morning' ? '#c8b8a8'
    : '#b8c8d8'

  // 半球光颜色随天空变化
  const skyColor = COLORS.sky[timeOfDay] || '#87ceeb'
  const groundColor = timeOfDay === 'night' ? '#1a1a2e'
    : timeOfDay === 'sunset' ? '#4a3020'
    : '#6b4423'

  return (
    <>
      {/* 主光源：太阳方向光 */}
      <directionalLight
        position={sunPosition}
        intensity={sunIntensity}
        color={sunColor}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-left={-15}
        shadow-camera-right={15}
        shadow-camera-top={15}
        shadow-camera-bottom={-15}
        shadow-camera-near={0.5}
        shadow-camera-far={60}
        shadow-bias={-0.0001}
        shadow-normalBias={0.02}
      />

      {/* 环境光 */}
      <ambientLight intensity={ambientIntensity} color={ambientColor} />

      {/* 天空/地面半球光 */}
      <hemisphereLight
        args={[skyColor, groundColor, 0.3 + ambientIntensity * 0.2]}
      />
    </>
  )
}

export default Lighting