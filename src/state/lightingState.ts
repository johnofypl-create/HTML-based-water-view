/**
 * @module state/lightingState
 * @layer state（状态层）
 * @purpose 可变单例场景光状态（天空/太阳/雾/海色），跨层共享，非响应式
 * @dependsOn []
 * @exports [LightingState, lightingState]
 * @aiEdit
 *   - 改本文件导出的 LightingState、lightingState 即可；依赖见 @dependsOn
 */
/**
 * 光照状态单例（非响应式）
 * Lighting 组件用 useFrame 写入（从 timeOfDay 插值），
 * Terrain/Water/Sky 等用 useFrame 读取，避免 zustand 触发重渲染。
 */
import * as THREE from 'three'

export interface LightingState {
  /** 一天中的时间（小时），由 useGameStore 同步过来 */
  timeOfDay: number
  /** 太阳方向（归一化，从地表指向太阳） */
  sunDir: THREE.Vector3
  /** 太阳颜色 */
  sunColor: THREE.Color
  /** 太阳强度 */
  sunIntensity: number
  /** 月光强度（夜晚） */
  moonIntensity: number
  /** 环境光颜色 */
  ambientColor: THREE.Color
  /** 环境光强度 */
  ambientIntensity: number
  /** 半球光天空色 */
  hemiSky: THREE.Color
  /** 半球光地面色 */
  hemiGround: THREE.Color
  /** 雾色 */
  fogColor: THREE.Color
  /** 雾密度 */
  fogDensity: number
  /** 天空顶色 */
  skyTop: THREE.Color
  /** 天空底色 */
  skyBottom: THREE.Color
  /** bloom 强度 */
  bloomIntensity: number
  /** 曝光 */
  exposure: number
}

export const lightingState: LightingState = {
  timeOfDay: 15,
  sunDir: new THREE.Vector3(0.45, 0.78, 0.35).normalize(),
  sunColor: new THREE.Color('#ffe9c4'),
  sunIntensity: 1.35,
  moonIntensity: 0,
  ambientColor: new THREE.Color('#b8c8d4'),
  ambientIntensity: 0.55,
  hemiSky: new THREE.Color('#bcd4e6'),
  hemiGround: new THREE.Color('#7a6a52'),
  fogColor: new THREE.Color('#d4e2ea'),
  fogDensity: 0.011,
  skyTop: new THREE.Color('#5a7a9a'),
  skyBottom: new THREE.Color('#e8d8c0'),
  bloomIntensity: 0.45,
  exposure: 1.0,
}
