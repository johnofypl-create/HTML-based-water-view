import { useState, useCallback } from 'react'
import { TIME_PRESETS } from '../../config/constants'
import type { TimeOfDay } from '../../types'

interface UIProps {
  hour: number
  timeOfDay: TimeOfDay
  onHourChange: (hour: number) => void
  onTimePreset: (preset: keyof typeof TIME_PRESETS) => void
  onCameraReset: () => void
}

function UI({ hour, timeOfDay, onHourChange, onTimePreset, onCameraReset }: UIProps) {
  const [uiVisible, setUiVisible] = useState(true)

  const handleFullscreen = useCallback(() => {
    if (document.fullscreenElement) {
      document.exitFullscreen()
    } else {
      document.documentElement.requestFullscreen()
    }
  }, [])

  const presets = Object.entries(TIME_PRESETS) as [keyof typeof TIME_PRESETS, { hour: number; label: string }][]

  if (!uiVisible) {
    return (
      <div style={{
        position: 'fixed',
        bottom: '20px',
        right: '20px',
        zIndex: 1000,
      }}>
        <button
          onClick={() => setUiVisible(true)}
          style={{
            background: 'rgba(0,0,0,0.3)',
            border: '1px solid rgba(255,255,255,0.2)',
            color: 'rgba(255,255,255,0.8)',
            padding: '8px 12px',
            borderRadius: '20px',
            cursor: 'pointer',
            fontSize: '14px',
            fontFamily: 'serif',
            backdropFilter: 'blur(10px)',
          }}
        >
          ☰
        </button>
      </div>
    )
  }

  return (
    <div style={{
      position: 'fixed',
      bottom: '20px',
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 1000,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '12px',
      pointerEvents: 'none',
    }}>
      {/* Main control panel */}
      <div style={{
        background: 'rgba(0,0,0,0.3)',
        border: '1px solid rgba(255,255,255,0.15)',
        borderRadius: '24px',
        padding: '12px 20px',
        backdropFilter: 'blur(12px)',
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        pointerEvents: 'auto',
        fontFamily: 'serif',
      }}>
        {/* Time presets */}
        {presets.map(([key, preset]) => (
          <button
            key={key}
            onClick={() => onTimePreset(key)}
            style={{
              background: timeOfDay === key ? 'rgba(255,255,255,0.2)' : 'transparent',
              border: 'none',
              color: 'rgba(255,255,255,0.9)',
              padding: '6px 12px',
              borderRadius: '16px',
              cursor: 'pointer',
              fontSize: '13px',
              fontFamily: 'serif',
              transition: 'background 0.3s',
              whiteSpace: 'nowrap',
            }}
          >
            {preset.label}
          </button>
        ))}

        {/* Divider */}
        <div style={{ width: '1px', height: '20px', background: 'rgba(255,255,255,0.2)' }} />

        {/* Time slider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '12px', minWidth: '40px', textAlign: 'right' }}>
            {Math.floor(hour)}:{String(Math.floor((hour % 1) * 60)).padStart(2, '0')}
          </span>
          <input
            type="range"
            min="0"
            max="24"
            step="0.1"
            value={hour}
            onChange={(e) => onHourChange(parseFloat(e.target.value))}
            style={{
              width: '120px',
              accentColor: 'rgba(255,255,255,0.7)',
              cursor: 'pointer',
            }}
          />
        </div>

        {/* Divider */}
        <div style={{ width: '1px', height: '20px', background: 'rgba(255,255,255,0.2)' }} />

        {/* Action buttons */}
        <button
          onClick={onCameraReset}
          title="重置相机"
          style={{
            background: 'transparent',
            border: 'none',
            color: 'rgba(255,255,255,0.8)',
            cursor: 'pointer',
            fontSize: '16px',
            padding: '4px 8px',
          }}
        >
          ⟳
        </button>

        <button
          onClick={handleFullscreen}
          title="全屏"
          style={{
            background: 'transparent',
            border: 'none',
            color: 'rgba(255,255,255,0.8)',
            cursor: 'pointer',
            fontSize: '16px',
            padding: '4px 8px',
          }}
        >
          ⛶
        </button>

        <button
          onClick={() => setUiVisible(false)}
          title="隐藏UI"
          style={{
            background: 'transparent',
            border: 'none',
            color: 'rgba(255,255,255,0.6)',
            cursor: 'pointer',
            fontSize: '16px',
            padding: '4px 8px',
          }}
        >
          ✕
        </button>
      </div>
    </div>
  )
}

export default UI