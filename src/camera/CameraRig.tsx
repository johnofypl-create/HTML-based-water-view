/**
 * 相机系统
 * OrbitControls 封装：阻尼平滑、约束、重置 + 空闲自动缓移
 *
 * 空闲缓移：用户停止交互 3 秒后，相机自动缓慢绕场景旋转（0.25°/s），
 * 模拟博物馆展品转台——强化"活的微缩模型"感。
 * 用户任何点击/滚轮操作立即暂停自动旋转，3 秒后恢复。
 */
import { useRef, useEffect, useCallback } from 'react'
import { useThree, useFrame } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import * as THREE from 'three'
import { CAMERA } from '../config/constants'
import { useGameStore } from '../state/useGameStore'

/** 空闲开始自动旋转的等待时间（毫秒） */
const IDLE_TIMEOUT = 3000
/** 自动旋转速度（°/s） */
const AUTO_ROTATE_SPEED = 0.25

export default function CameraRig() {
  const controlsRef = useRef<OrbitControlsImpl>(null)
  const { camera, gl } = useThree()
  const resetSignal = useGameStore((s) => s.cameraResetSignal)

  // 重置状态
  const resetting = useRef(false)
  const resetStart = useRef(0)
  const fromPos = useRef(new THREE.Vector3())
  const fromTarget = useRef(new THREE.Vector3())
  const toPos = useRef(new THREE.Vector3(...CAMERA.initialPosition))
  const toTarget = useRef(new THREE.Vector3(...CAMERA.initialTarget))

  // 空闲旋转状态
  const lastInteraction = useRef(performance.now())

  // 用户交互：暂停自动旋转，重置空闲计时
  const onUserInteract = useCallback(() => {
    lastInteraction.current = performance.now()
    if (controlsRef.current) {
      controlsRef.current.autoRotate = false
    }
  }, [])

  // 监听 canvas 交互事件
  useEffect(() => {
    const canvas = gl.domElement
    canvas.addEventListener('pointerdown', onUserInteract)
    canvas.addEventListener('wheel', onUserInteract)
    return () => {
      canvas.removeEventListener('pointerdown', onUserInteract)
      canvas.removeEventListener('wheel', onUserInteract)
    }
  }, [gl, onUserInteract])

  // 初始相机位置
  useEffect(() => {
    camera.position.set(...CAMERA.initialPosition)
    if (controlsRef.current) {
      controlsRef.current.target.set(...CAMERA.initialTarget)
      controlsRef.current.update()
    }
  }, [camera])

  // 监听重置信号
  useEffect(() => {
    if (resetSignal > 0 && controlsRef.current) {
      resetting.current = true
      resetStart.current = performance.now()
      fromPos.current.copy(camera.position)
      fromTarget.current.copy(controlsRef.current.target)
      // 重置时也暂停自动旋转
      lastInteraction.current = performance.now()
    }
  }, [resetSignal, camera])

  useFrame(() => {
    const controls = controlsRef.current
    if (!controls) return

    // 相机重置插值
    if (resetting.current) {
      const elapsed = (performance.now() - resetStart.current) / 1000
      const dur = 1.2
      const t = Math.min(1, elapsed / dur)
      const e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
      camera.position.lerpVectors(fromPos.current, toPos.current, e)
      controls.target.lerpVectors(fromTarget.current, toTarget.current, e)
      controls.update()
      if (t >= 1) resetting.current = false
      return
    }

    // 空闲自动旋转：检测 3 秒无交互后启动
    const idle = performance.now() - lastInteraction.current > IDLE_TIMEOUT
    if (idle && !controls.autoRotate) {
      controls.autoRotate = true
      controls.autoRotateSpeed = AUTO_ROTATE_SPEED
    }
  })

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      enableDamping
      dampingFactor={CAMERA.dampingFactor}
      minDistance={CAMERA.minDistance}
      maxDistance={CAMERA.maxDistance}
      maxPolarAngle={CAMERA.maxPolarAngle}
      minPolarAngle={CAMERA.minPolarAngle}
      enablePan
      panSpeed={0.6}
      rotateSpeed={0.55}
      zoomSpeed={0.8}
      target={CAMERA.initialTarget}
    />
  )
}
