/**
 * @module config/timePresets
 * @layer config（叶子层）
 * @purpose 昼夜关键帧（天空/光/雾/海色）
 * @dependsOn []
 * @exports [TimeKeyframe, TIME_KEYFRAMES, KEYFRAME_TIMES]
 * @aiEdit
 *   - 调昼夜关键帧（天空/光/雾/海色）→ 直接改 TIME_KEYFRAMES
 */
/**
 * 日夜关键帧
 * 5 个关键时刻：dawn(5) / noon(12) / afternoon(15) / sunset(18.5) / night(23)
 * 每帧含完整光照/雾/天空/后处理参数。computeLighting 按小时环形插值。
 */

export interface TimeKeyframe {
  time: number
  /** 太阳方向（未归一化，插值后归一化）。夜晚指向地平线下。 */
  sunDir: [number, number, number]
  sunColor: [number, number, number]
  sunIntensity: number
  moonIntensity: number
  ambientColor: [number, number, number]
  ambientIntensity: number
  hemiSky: [number, number, number]
  hemiGround: [number, number, number]
  fogColor: [number, number, number]
  fogDensity: number
  skyTop: [number, number, number]
  skyBottom: [number, number, number]
  bloomIntensity: number
  exposure: number
}

export const TIME_KEYFRAMES: TimeKeyframe[] = [
  // 黎明 5:00
  {
    time: 5,
    sunDir: [0.92, 0.08, 0.18],
    sunColor: [1.0, 0.79, 0.62],
    sunIntensity: 0.75,
    moonIntensity: 0.0,
    ambientColor: [0.38, 0.50, 0.66],
    ambientIntensity: 0.42,
    hemiSky: [0.42, 0.55, 0.72],
    hemiGround: [0.50, 0.42, 0.36],
    fogColor: [0.84, 0.72, 0.58],
    fogDensity: 0.003,
    skyTop: [0.30, 0.40, 0.56],
    skyBottom: [0.92, 0.78, 0.58],
    bloomIntensity: 0.62,
    exposure: 0.95,
  },
  // 正午 12:00
  {
    time: 12,
    sunDir: [0.0, 0.96, -0.42],
    sunColor: [1.0, 0.96, 0.88],
    sunIntensity: 1.4,
    moonIntensity: 0.0,
    ambientColor: [0.72, 0.80, 0.88],
    ambientIntensity: 0.6,
    hemiSky: [0.74, 0.84, 0.92],
    hemiGround: [0.62, 0.54, 0.44],
    fogColor: [0.83, 0.89, 0.93],
    fogDensity: 0.002,
    skyTop: [0.36, 0.50, 0.66],
    skyBottom: [0.82, 0.88, 0.93],
    bloomIntensity: 0.4,
    exposure: 1.0,
  },
  // 午后 15:00（默认）
  {
    time: 15,
    sunDir: [-0.42, 0.82, -0.38],
    sunColor: [1.0, 0.88, 0.69],
    sunIntensity: 1.32,
    moonIntensity: 0.0,
    ambientColor: [0.70, 0.76, 0.84],
    ambientIntensity: 0.56,
    hemiSky: [0.70, 0.80, 0.90],
    hemiGround: [0.62, 0.52, 0.42],
    fogColor: [0.85, 0.88, 0.90],
    fogDensity: 0.002,
    skyTop: [0.40, 0.56, 0.70],
    skyBottom: [0.90, 0.84, 0.74],
    bloomIntensity: 0.46,
    exposure: 1.0,
  },
  // 日落 18:30
  {
    time: 18.5,
    sunDir: [-0.92, 0.06, 0.12],
    sunColor: [1.0, 0.54, 0.35],
    sunIntensity: 1.0,
    moonIntensity: 0.0,
    ambientColor: [0.50, 0.44, 0.56],
    ambientIntensity: 0.44,
    hemiSky: [0.55, 0.40, 0.50],
    hemiGround: [0.45, 0.36, 0.30],
    fogColor: [0.82, 0.66, 0.52],
    fogDensity: 0.004,
    skyTop: [0.24, 0.26, 0.40],
    skyBottom: [1.0, 0.70, 0.44],
    bloomIntensity: 0.72,
    exposure: 1.05,
  },
  // 夜晚 23:00
  {
    time: 23,
    sunDir: [0.25, -0.52, 0.32],
    sunColor: [0.62, 0.72, 0.92],
    sunIntensity: 0.0,
    moonIntensity: 0.36,
    ambientColor: [0.14, 0.20, 0.30],
    ambientIntensity: 0.26,
    hemiSky: [0.10, 0.16, 0.26],
    hemiGround: [0.12, 0.12, 0.16],
    fogColor: [0.08, 0.12, 0.20],
    fogDensity: 0.004,
    skyTop: [0.02, 0.04, 0.08],
    skyBottom: [0.06, 0.10, 0.18],
    bloomIntensity: 0.52,
    exposure: 0.85,
  },
]

export const KEYFRAME_TIMES = TIME_KEYFRAMES.map((k) => k.time)
