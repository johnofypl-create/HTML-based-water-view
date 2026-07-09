import { useEffect, useRef, useState } from 'react'

function FPSDisplay() {
  const [fps, setFps] = useState(0)
  const frameCount = useRef(0)
  const lastTime = useRef(performance.now())

  useEffect(() => {
    let rafId: number

    const tick = () => {
      frameCount.current++
      const now = performance.now()
      const elapsed = now - lastTime.current

      if (elapsed >= 1000) {
        setFps(Math.round((frameCount.current * 1000) / elapsed))
        frameCount.current = 0
        lastTime.current = now
      }

      rafId = requestAnimationFrame(tick)
    }

    rafId = requestAnimationFrame(tick)

    return () => cancelAnimationFrame(rafId)
  }, [])

  return (
    <div style={{
      position: 'fixed',
      top: '12px',
      left: '12px',
      background: 'rgba(0,0,0,0.4)',
      border: '1px solid rgba(255,255,255,0.15)',
      borderRadius: '8px',
      padding: '4px 10px',
      color: fps >= 55 ? '#4caf50' : fps >= 30 ? '#ff9800' : '#f44336',
      fontSize: '12px',
      fontFamily: 'monospace',
      fontVariantNumeric: 'tabular-nums',
      backdropFilter: 'blur(6px)',
      zIndex: 2000,
      pointerEvents: 'none',
      userSelect: 'none',
      opacity: 0.7,
      transition: 'opacity 0.3s',
    }}>
      {fps} FPS
    </div>
  )
}

export default FPSDisplay