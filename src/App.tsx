/**
 * 根组件 — 版本C（融合版）
 * Canvas: frameloop="demand" + Effects 接管渲染 + three 内置 ACES
 */
import { Suspense } from 'react'
import { Canvas } from '@react-three/fiber'
import * as THREE from 'three'
import Terrain from './world/Terrain'
import Water from './water/Water'
import River from './world/River'
import Structures from './world/Structures'
import ExhibitionBase from './world/ExhibitionBase'
import Lighting from './lighting/Lighting'
import SkyDome from './lighting/SkyDome'
import CameraRig from './camera/CameraRig'
import Effects from './postprocessing/Effects'
import Vegetation from './environment/Vegetation'
import AudioUpdater from './audio/AudioUpdater'
import UI from './ui/UI'
import { CAMERA, PERF } from './config/constants'

function Scene() {
  return (
    <>
      <SkyDome />
      <Lighting />
      <Terrain />
      <Water />
      <River />
      <Structures />
      <ExhibitionBase />
      <Vegetation />
      <CameraRig />
      <AudioUpdater />
      <Effects />
    </>
  )
}

export default function App() {
  return (
    <>
      <Canvas
        frameloop="demand"
        shadows
        dpr={[1, PERF.maxDpr]}
        gl={{
          antialias: false,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.28,
          powerPreference: 'high-performance',
        }}
        camera={{
          fov: 42,
          near: 0.1,
          far: 1000,
          position: CAMERA.initialPosition,
        }}
        onCreated={({ gl }) => {
          gl.outputColorSpace = THREE.SRGBColorSpace
          gl.toneMapping = THREE.ACESFilmicToneMapping
          gl.toneMappingExposure = 1.28
          gl.shadowMap.type = THREE.PCFShadowMap
        }}
      >
        <Suspense fallback={null}>
          <Scene />
        </Suspense>
      </Canvas>
      <UI />
    </>
  )
}
