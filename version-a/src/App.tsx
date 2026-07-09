import { Canvas } from '@react-three/fiber'
import { Suspense, useCallback } from 'react'
import * as THREE from 'three'
import Scene from './components/scene/Scene'
import UI from './components/ui/UI'
import FPSDisplay from './components/ui/FPSDisplay'
import { useTime } from './hooks/useTime'
import type { TimeOfDay } from './types'

function App() {
  const { hour, setHour, timeOfDay, timeState, setTimePreset } = useTime(16)

  const handleCameraReset = useCallback(() => {
    window.dispatchEvent(new CustomEvent('camera-reset'))
  }, [])

  return (
    <div style={{ width: '100vw', height: '100vh', background: '#1a1a2e' }}>
      <Canvas
        shadows
        camera={{ position: [14, 14, 14], fov: 45, near: 0.1, far: 200 }}
        gl={{
          antialias: true,
          outputColorSpace: 'srgb',
        }}
        dpr={[1, 2]}
        onCreated={({ gl }) => {
          gl.shadowMap.type = THREE.PCFSoftShadowMap
        }}
      >
        <Suspense fallback={null}>
          <Scene
            timeState={timeState}
            hour={hour}
            timeOfDay={timeOfDay}
          />
        </Suspense>
      </Canvas>

      {/* UI overlay - outside Canvas */}
      <FPSDisplay />
      <UI
        hour={hour}
        timeOfDay={timeOfDay}
        onHourChange={setHour}
        onTimePreset={setTimePreset}
        onCameraReset={handleCameraReset}
      />
    </div>
  )
}

export default App