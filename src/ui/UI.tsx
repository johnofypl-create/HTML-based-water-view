/**
 * @module ui/UI
 * @layer ui（域层）
 * @purpose UI 叠层（时间/可见性控制）
 * @dependsOn ['state/useGameStore', 'audio/AudioManager', 'config/constants']
 * @exports [UI, UI]
 * @aiEdit
 *   - 改本文件导出的 UI、UI 即可；依赖见 @dependsOn
 */
/**
 * UI 覆盖层
 * 极简：启动遮罩 + 时间滑块/预设 + 相机重置/隐藏UI/全屏
 * 纯 HTML，pointer-events 分层。读写 useGameStore，不碰 Three。
 */
import { useCallback, useEffect, useState } from 'react'
import { useGameStore } from '../state/useGameStore'
import { audioManager } from '../audio/AudioManager'
import { DEFAULT_TIME_OF_DAY } from '../config/constants'

const PRESETS: { label: string; time: number }[] = [
  { label: '清晨', time: 5 },
  { label: '正午', time: 12 },
  { label: '午后', time: 15 },
  { label: '日落', time: 18.5 },
  { label: '夜晚', time: 23 },
]

function formatTime(t: number) {
  const h = Math.floor(t)
  const m = Math.floor((t - h) * 60)
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

export default function UI() {
  const timeOfDay = useGameStore((s) => s.timeOfDay)
  const setTimeOfDay = useGameStore((s) => s.setTimeOfDay)
  const uiVisible = useGameStore((s) => s.uiVisible)
  const toggleUI = useGameStore((s) => s.toggleUI)
  const started = useGameStore((s) => s.started)
  const start = useGameStore((s) => s.start)
  const requestCameraReset = useGameStore((s) => s.requestCameraReset)

  const [isFullscreen, setIsFullscreen] = useState(false)

  useEffect(() => {
    const onFs = () => setIsFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', onFs)
    return () => document.removeEventListener('fullscreenchange', onFs)
  }, [])

  const handleStart = useCallback(() => {
    audioManager.start()
    start()
  }, [start])

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) {
      document.exitFullscreen()
    } else {
      document.documentElement.requestFullscreen().catch(() => {})
    }
  }, [])

  return (
    <>
      {/* 启动遮罩 */}
      <div className={`start-overlay ${started ? 'hidden' : ''}`}>
        <h1 className="start-title">海岸微缩景观</h1>
        <p className="start-sub">Coastal Diorama</p>
        <button className="start-btn" onClick={handleStart}>
          进 入
        </button>
        <p className="start-hint">点击进入 · 建议使用桌面浏览器获得最佳体验</p>
      </div>

      {/* 控制层 */}
      <div className={`ui-layer ${uiVisible ? '' : 'hidden'}`}>
        {/* 右上角 */}
        <div className="ui-corner">
          <button className="ui-icon-btn" title="重置相机" onClick={requestCameraReset}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M3 12a9 9 0 1 0 3-6.7" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M3 4v4h4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <button className="ui-icon-btn" title={isFullscreen ? '退出全屏' : '全屏'} onClick={toggleFullscreen}>
            {isFullscreen ? (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M8 3v3a2 2 0 0 1-2 2H3M21 8h-3a2 2 0 0 1-2-2V3M3 16h3a2 2 0 0 1 2 2v3M16 21v-3a2 2 0 0 1 2-2h3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M3 8V5a2 2 0 0 1 2-2h3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M21 16v3a2 2 0 0 1-2 2h-3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </button>
          <button className="ui-icon-btn" title="隐藏界面" onClick={toggleUI}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" strokeLinecap="round" strokeLinejoin="round" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          </button>
        </div>

        {/* 底部控制栏 */}
        <div className="ui-bar ui-panel">
          <div className="time-slider-wrap">
            <input
              className="time-slider"
              type="range"
              min={0}
              max={24}
              step={0.05}
              value={timeOfDay}
              onChange={(e) => setTimeOfDay(parseFloat(e.target.value))}
            />
            <span className="time-label">{formatTime(timeOfDay)}</span>
          </div>
          <div style={{ width: 1, height: 24, background: 'var(--ui-border)' }} />
          {PRESETS.map((p) => (
            <button
              key={p.label}
              className={`ui-btn ${Math.abs(timeOfDay - p.time) < 0.1 ? 'active' : ''}`}
              onClick={() => setTimeOfDay(p.time)}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* 隐藏 UI 后的小恢复按钮 */}
      {!uiVisible && started && (
        <button
          className="ui-icon-btn"
          style={{ position: 'fixed', top: 20, right: 20, zIndex: 11 }}
          title="显示界面"
          onClick={toggleUI}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        </button>
      )}
    </>
  )
}

// 避免 DEFAULT_TIME_OF_DAY 未使用警告
void DEFAULT_TIME_OF_DAY
