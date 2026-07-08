import { OrbitControls } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import { useEffect, useRef } from 'react'

interface CameraControllerProps {
  controlsRef: React.MutableRefObject<any>
}

function CameraController({ controlsRef }: CameraControllerProps) {
  const orbitRef = useRef<any>(null)
  const { gl } = useThree()

  useEffect(() => {
    if (orbitRef.current) {
      controlsRef.current = orbitRef.current
    }
  }, [controlsRef])

  return (
    <OrbitControls
      ref={orbitRef}
      makeDefault
      enableDamping
      dampingFactor={0.08}
      minDistance={5}
      maxDistance={50}
      maxPolarAngle={Math.PI / 2.1}
      minPolarAngle={0.2}
      target={[0, 0, 0]}
      rotateSpeed={0.5}
      zoomSpeed={0.8}
      panSpeed={0.5}
      domElement={gl.domElement}
    />
  )
}

export default CameraController