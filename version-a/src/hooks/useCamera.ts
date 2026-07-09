import { useRef, useCallback } from 'react'
import * as THREE from 'three'

export function useCamera() {
  const controlsRef = useRef<any>(null)

  const resetCamera = useCallback(() => {
    if (controlsRef.current) {
      controlsRef.current.target.set(0, 0, 0)
      controlsRef.current.update()
    }
  }, [])

  return { controlsRef, resetCamera }
}