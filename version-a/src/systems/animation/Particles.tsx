import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { WORLD_SIZE } from '../../config/constants'

const PARTICLE_COUNT = 150

export function Particles() {
  const pointsRef = useRef<THREE.Points>(null)
  const initialPositions = useRef<Float32Array | null>(null)

  // 粒子几何体
  const geometry = useMemo(() => {
    const positions = new Float32Array(PARTICLE_COUNT * 3)
    const halfWorld = WORLD_SIZE / 2

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      // 分布在场景上方和周围
      positions[i * 3] = (Math.random() - 0.5) * WORLD_SIZE * 1.2
      positions[i * 3 + 1] = 1 + Math.random() * 10
      positions[i * 3 + 2] = (Math.random() - 0.5) * WORLD_SIZE * 1.2
    }

    initialPositions.current = new Float32Array(positions)

    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    return geo
  }, [])

  // 粒子材质 - 柔和半透明
  const material = useMemo(() => {
    // 创建圆形粒子纹理
    const canvas = document.createElement('canvas')
    canvas.width = 16
    canvas.height = 16
    const ctx = canvas.getContext('2d')!
    const gradient = ctx.createRadialGradient(8, 8, 0, 8, 8, 8)
    gradient.addColorStop(0, 'rgba(255, 255, 240, 0.6)')
    gradient.addColorStop(0.4, 'rgba(255, 250, 230, 0.3)')
    gradient.addColorStop(1, 'rgba(255, 250, 230, 0)')
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, 16, 16)

    const texture = new THREE.CanvasTexture(canvas)
    texture.needsUpdate = true

    return new THREE.PointsMaterial({
      size: 0.15,
      map: texture,
      blending: THREE.NormalBlending,
      depthWrite: false,
      transparent: true,
      opacity: 0.5,
      color: new THREE.Color('#faf5e8'),
    })
  }, [])

  useFrame((state) => {
    if (!pointsRef.current || !initialPositions.current) return

    const time = state.clock.elapsedTime
    const posAttr = pointsRef.current.geometry.attributes.position
    const positions = posAttr.array as Float32Array
    const initPos = initialPositions.current

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const i3 = i * 3
      const ix = initPos[i3]
      const iy = initPos[i3 + 1]
      const iz = initPos[i3 + 2]

      // 缓慢上升并循环
      const riseSpeed = 0.15 + (i % 5) * 0.03
      const yOffset = (time * riseSpeed + i * 0.7) % 10

      // 水平漂移（模拟微风）
      const driftX = Math.sin(time * 0.3 + i * 0.5) * 1.5
      const driftZ = Math.cos(time * 0.25 + i * 0.4) * 1.2

      positions[i3] = ix + driftX
      positions[i3 + 1] = iy + yOffset
      positions[i3 + 2] = iz + driftZ
    }

    posAttr.needsUpdate = true
  })

  return (
    <points ref={pointsRef} geometry={geometry} material={material} />
  )
}

export default Particles