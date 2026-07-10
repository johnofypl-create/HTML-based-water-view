/**
 * @module lighting/Lighting
 * @layer lighting（域层）
 * @purpose 场景灯光组件（方向光/环境光/阴影）
 * @dependsOn ['lighting/computeLighting', 'state/lightingState', 'state/useGameStore', 'config/constants']
 * @exports [Lighting, Lighting]
 * @aiEdit
 *   - 改本文件导出的 Lighting、Lighting 即可；依赖见 @dependsOn
 */
/**
 * 光照总控
 *  - directionalLight（太阳/月亮，投射阴影）
 *  - ambientLight + hemisphereLight（环境填充）
 *  - scene.fog（FogExp2，颜色/密度随时间）
 *  每帧从 useGameStore.timeOfDay 调 computeLighting 写 lightingState，并同步光源参数。
 */
import { useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { computeLighting } from './computeLighting'
import { lightingState } from '../state/lightingState'
import { useGameStore } from '../state/useGameStore'
import { SUN_DISTANCE, PERF } from '../config/constants'

export default function Lighting() {
  const sunRef = useRef<THREE.DirectionalLight>(null)
  const ambientRef = useRef<THREE.AmbientLight>(null)
  const hemiRef = useRef<THREE.HemisphereLight>(null)
  const { scene } = useThree()

  // 初始化雾
  if (!scene.fog) {
    scene.fog = new THREE.FogExp2(lightingState.fogColor.getHex(), lightingState.fogDensity)
  }

  useFrame(() => {
    const t = useGameStore.getState().timeOfDay
    computeLighting(t)

    const s = lightingState
    const sun = sunRef.current
    if (sun) {
      sun.position.set(s.sunDir.x * SUN_DISTANCE, s.sunDir.y * SUN_DISTANCE, s.sunDir.z * SUN_DISTANCE)
      // 太阳强度（白天）+ 月光（夜晚，冷蓝）。用同一盏灯近似月光。
      const isNight = s.sunDir.y < 0.02
      sun.intensity = isNight ? s.moonIntensity : s.sunIntensity
      sun.color.copy(isNight ? new THREE.Color('#a8bcde') : s.sunColor)
      sun.visible = sun.intensity > 0.001
    }
    if (ambientRef.current) {
      ambientRef.current.color.copy(s.ambientColor)
      ambientRef.current.intensity = s.ambientIntensity
    }
    if (hemiRef.current) {
      hemiRef.current.color.copy(s.hemiSky)
      hemiRef.current.groundColor.copy(s.hemiGround)
      hemiRef.current.intensity = s.ambientIntensity * 0.9
    }
    if (scene.fog && (scene.fog as THREE.FogExp2).density !== undefined) {
      const fog = scene.fog as THREE.FogExp2
      fog.color.copy(s.fogColor)
      fog.density = s.fogDensity
    }
  })

  return (
    <>
      <ambientLight ref={ambientRef} intensity={lightingState.ambientIntensity} color={lightingState.ambientColor} />
      <hemisphereLight
        ref={hemiRef}
        args={[lightingState.hemiSky, lightingState.hemiGround, lightingState.ambientIntensity * 0.9]}
      />
      <directionalLight
        ref={sunRef}
        castShadow
        intensity={lightingState.sunIntensity}
        color={lightingState.sunColor}
        shadow-mapSize-width={PERF.shadowMapSize}
        shadow-mapSize-height={PERF.shadowMapSize}
        shadow-camera-near={1}
        shadow-camera-far={PERF.shadowCameraSize * 2.4}
        shadow-camera-left={-PERF.shadowCameraSize}
        shadow-camera-right={PERF.shadowCameraSize}
        shadow-camera-top={PERF.shadowCameraSize}
        shadow-camera-bottom={-PERF.shadowCameraSize}
        shadow-bias={-0.0004}
        shadow-normalBias={0.02}
      />
    </>
  )
}
