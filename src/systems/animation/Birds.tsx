import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

interface BirdConfig {
  position: [number, number, number]
  radius: number
  speed: number
  phase: number
  height: number
}

// 单个飞鸟组件 - V形三角形造型
function Bird({ config, index }: { config: BirdConfig; index: number }) {
  const meshRef = useRef<THREE.Mesh>(null)

  // 创建简单的V形飞鸟几何体（两个三角形）
  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry()
    // V形飞鸟 - 两个三角形形成翅膀
    const vertices = new Float32Array([
      // 左翼三角形
      0, 0, 0,
      -0.4, 0, -0.3,
      -0.2, -0.15, 0,
      // 右翼三角形
      0, 0, 0,
      0.2, -0.15, 0,
      0.4, 0, -0.3,
      // 身体小三角形
      0, 0, 0,
      -0.1, -0.2, 0,
      0.1, -0.2, 0,
    ])
    geo.setAttribute('position', new THREE.BufferAttribute(vertices, 3))
    geo.computeVertexNormals()
    return geo
  }, [])

  // 深灰色飞鸟，与天空融合
  const material = useMemo(() => {
    return new THREE.MeshBasicMaterial({
      color: new THREE.Color('#3a4a5a'),
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.8,
    })
  }, [])

  useFrame((state) => {
    if (!meshRef.current) return

    const time = state.clock.elapsedTime
    const { radius, speed, phase, height } = config

    // 圆周飞行轨迹
    const angle = time * speed + phase
    const x = Math.cos(angle) * radius + config.position[0]
    const z = Math.sin(angle) * radius + config.position[2]
    const y = height + Math.sin(angle * 2) * 0.5

    meshRef.current.position.set(x, y, z)

    // 让鸟面向飞行方向
    const tangentAngle = angle + Math.PI / 2
    meshRef.current.rotation.y = tangentAngle
    // 添加微小的上下翅膀摆动
    meshRef.current.rotation.x = Math.sin(time * 8 + index) * 0.1
  })

  return (
    <mesh
      ref={meshRef}
      geometry={geometry}
      material={material}
      scale={[0.6, 0.6, 0.6]}
    />
  )
}

// 飞鸟群组件
export function Birds() {
  // 创建6只飞鸟，分布在场景上方不同位置和高度
  const birdConfigs = useMemo<BirdConfig[]>(() => {
    const configs: BirdConfig[] = []
    const birdCount = 6

    for (let i = 0; i < birdCount; i++) {
      // 分布在场景中心周围
      const angle = (i / birdCount) * Math.PI * 2
      const distance = 6 + Math.random() * 6
      const x = Math.cos(angle) * distance
      const z = Math.sin(angle) * distance
      const height = 8 + Math.random() * 4
      const radius = 4 + Math.random() * 8
      const speed = 0.15 + Math.random() * 0.15
      const phase = Math.random() * Math.PI * 2

      configs.push({
        position: [x, height, z],
        radius,
        speed,
        phase,
        height,
      })
    }
    return configs
  }, [])

  return (
    <group>
      {birdConfigs.map((config, i) => (
        <Bird key={i} config={config} index={i} />
      ))}
    </group>
  )
}

export default Birds
