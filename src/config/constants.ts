// 场景尺寸
export const WORLD_SIZE = 30
export const WORLD_SEGMENTS = 64
export const SEA_LEVEL = 0.5
export const MAX_HEIGHT = 4

// 相机默认值
export const CAMERA_DEFAULTS = {
  position: [14, 14, 14] as [number, number, number],
  target: [0, 0, 0] as [number, number, number],
  minDistance: 5,
  maxDistance: 50,
  maxPolarAngle: Math.PI / 2.1,
  dampingFactor: 0.08,
}

// 时间预设
export const TIME_PRESETS = {
  morning: { hour: 7, label: '早晨' },
  noon: { hour: 12, label: '中午' },
  afternoon: { hour: 16, label: '下午' },
  sunset: { hour: 17.5, label: '日落' },
  night: { hour: 21, label: '夜晚' },
} as const

// 水配置
export const WATER_CONFIG = {
  waveSpeed: 0.5,
  waveHeight: 0.15,
  waveFrequency: 2.5,
  shallowColor: '#5ce1e6',
  deepColor: '#0f3460',
  foamColor: '#ffffff',
  opacity: 0.85,
}

// 地形配置
export const TERRAIN_CONFIG = {
  width: 30,
  depth: 30,
  segments: 64,
  heightScale: 3.0,
  seaLevel: 0.5,
  beachWidth: 0.15,
  cliffHeight: 2.5,
}

// 植被配置
export const VEGETATION_COUNTS = {
  trees: 300,
  shrubs: 500,
  grass: 2000,
  flowers: 400,
  coral: 100,
}

// 光照配置
export const LIGHTING_CONFIG = {
  ambientColor: '#b8c8d8',
  hemisphereSkyColor: '#87ceeb',
  hemisphereGroundColor: '#6b4423',
  fogNear: 8,
  fogFar: 45,
}
