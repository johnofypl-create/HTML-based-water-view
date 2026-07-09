/**
 * 时间 → 光照参数计算
 * 在 5 个关键帧之间按 24h 环形插值，写入 lightingState 单例。
 * 颜色用线性插值，方向向量插值后归一化。
 */
import * as THREE from 'three'
import { TIME_KEYFRAMES, KEYFRAME_TIMES, TimeKeyframe } from '../config/timePresets'
import { findKeyframe, lerp, lerpVec3 } from '../utils/math'
import { lightingState } from '../state/lightingState'

function lerp3(a: [number, number, number], b: [number, number, number], t: number): [number, number, number] {
  return lerpVec3(a, b, t)
}

/** 颜色平滑插值（用 smootherstep 让过渡更柔和） */
function smoothT(t: number) {
  return t * t * t * (t * (t * 6 - 15) + 10)
}

/** 计算时间 t 对应的光照参数并写入 lightingState */
export function computeLighting(t: number): void {
  const [i0, i1, rawT] = findKeyframe(KEYFRAME_TIMES, t)
  const k0 = TIME_KEYFRAMES[i0]
  const k1 = TIME_KEYFRAMES[i1]
  const tt = smoothT(rawT)

  const sunDirRaw = lerp3(k0.sunDir, k1.sunDir, tt)
  const sunDir = new THREE.Vector3(...sunDirRaw)
  // 归一化（若在地平线下也保留方向，强度由 sunIntensity 控制）
  if (sunDir.lengthSq() > 1e-6) sunDir.normalize()

  const sunColor = new THREE.Color(...lerp3(k0.sunColor, k1.sunColor, tt))
  const ambientColor = new THREE.Color(...lerp3(k0.ambientColor, k1.ambientColor, tt))
  const hemiSky = new THREE.Color(...lerp3(k0.hemiSky, k1.hemiSky, tt))
  const hemiGround = new THREE.Color(...lerp3(k0.hemiGround, k1.hemiGround, tt))
  const fogColor = new THREE.Color(...lerp3(k0.fogColor, k1.fogColor, tt))
  const skyTop = new THREE.Color(...lerp3(k0.skyTop, k1.skyTop, tt))
  const skyBottom = new THREE.Color(...lerp3(k0.skyBottom, k1.skyBottom, tt))

  lightingState.timeOfDay = t
  lightingState.sunDir.copy(sunDir)
  lightingState.sunColor.copy(sunColor)
  lightingState.sunIntensity = lerp(k0.sunIntensity, k1.sunIntensity, tt)
  lightingState.moonIntensity = lerp(k0.moonIntensity, k1.moonIntensity, tt)
  lightingState.ambientColor.copy(ambientColor)
  lightingState.ambientIntensity = lerp(k0.ambientIntensity, k1.ambientIntensity, tt)
  lightingState.hemiSky.copy(hemiSky)
  lightingState.hemiGround.copy(hemiGround)
  lightingState.fogColor.copy(fogColor)
  lightingState.fogDensity = lerp(k0.fogDensity, k1.fogDensity, tt)
  lightingState.skyTop.copy(skyTop)
  lightingState.skyBottom.copy(skyBottom)
  lightingState.bloomIntensity = lerp(k0.bloomIntensity, k1.bloomIntensity, tt)
  lightingState.exposure = lerp(k0.exposure, k1.exposure, tt)
}
