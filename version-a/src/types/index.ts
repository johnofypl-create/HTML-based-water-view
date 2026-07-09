// 时间系统类型
export type TimeOfDay = 'morning' | 'noon' | 'afternoon' | 'sunset' | 'night'

export interface TimeState {
  hour: number // 0-24
  timeOfDay: TimeOfDay
  sunPosition: [number, number, number]
  moonPosition: [number, number, number]
  ambientIntensity: number
  sunIntensity: number
  fogColor: string
  skyColor: string
  shadowLength: number
}

// 相机状态类型
export interface CameraState {
  position: [number, number, number]
  target: [number, number, number]
  zoom: number
  polarAngle: number
  azimuthalAngle: number
}

// 地形类型
export interface TerrainConfig {
  width: number
  depth: number
  segments: number
  heightScale: number
  seaLevel: number
  beachWidth: number
  cliffHeight: number
}

// 植被类型
export type VegetationType = 'tree' | 'shrub' | 'grass' | 'flower' | 'coral'

export interface VegetationInstance {
  type: VegetationType
  position: [number, number, number]
  rotation: [number, number, number]
  scale: [number, number, number]
}

// 水类型
export interface WaterConfig {
  seaLevel: number
  waveSpeed: number
  waveHeight: number
  waveFrequency: number
  shallowColor: string
  deepColor: string
  foamColor: string
  opacity: number
}

// 光照配置
export interface LightingConfig {
  ambientColor: string
  hemisphereSkyColor: string
  hemisphereGroundColor: string
  fogNear: number
  fogFar: number
}

// 音频类型
export type AmbientSoundType = 'waves' | 'wind' | 'birds' | 'insects' | 'river'

export interface AudioConfig {
  enabled: boolean
  volume: number
  sounds: Partial<Record<AmbientSoundType, boolean>>
}

// 游戏状态
export interface GameState {
  time: TimeState
  camera: CameraState
  audio: AudioConfig
  uiVisible: boolean
  isFullscreen: boolean
}
