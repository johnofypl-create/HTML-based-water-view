/**
 * 全局游戏状态（zustand）
 * UI 与音频只读写 state，不直接碰 Three 对象。
 * timeOfDay / uiVisible / started(音频) / cameraResetSignal
 */
import { create } from 'zustand'
import { DEFAULT_TIME_OF_DAY } from '../config/constants'

export interface GameStore {
  /** 一天中的时间，0-24 小时 */
  timeOfDay: number
  setTimeOfDay: (t: number) => void

  /** UI 是否可见 */
  uiVisible: boolean
  toggleUI: () => void
  setUIVisible: (v: boolean) => void

  /** 音频是否已启动（用户手势触发） */
  started: boolean
  start: () => void

  /** 相机重置信号（自增整数，每次重置 +1 触发 effect） */
  cameraResetSignal: number
  requestCameraReset: () => void

  /** UI 是否处于拖拽过渡 */
  isReady: boolean
  setReady: (v: boolean) => void
}

export const useGameStore = create<GameStore>((set) => ({
  timeOfDay: DEFAULT_TIME_OF_DAY,
  setTimeOfDay: (t) => set({ timeOfDay: ((t % 24) + 24) % 24 }),

  uiVisible: true,
  toggleUI: () => set((s) => ({ uiVisible: !s.uiVisible })),
  setUIVisible: (v) => set({ uiVisible: v }),

  started: false,
  start: () => set({ started: true }),

  cameraResetSignal: 0,
  requestCameraReset: () => set((s) => ({ cameraResetSignal: s.cameraResetSignal + 1 })),

  isReady: false,
  setReady: (v) => set({ isReady: v }),
}))
