import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { SEA_LEVEL, TERRAIN_CONFIG } from '../../config/constants'
import { COLORS } from '../../config/palette'

interface FishConfig {
  basePosition: [number, number, number]
  radius: number
  speed: number
  phase: number
  color: THREE.Color
  scale: number
}

// 单条鱼组件
function FishModel({ config, index }: { config: FishConfig; index: number }) {
  const meshRef = useRef<THREE.Mesh>(null)
  const materialRef = useRef<THREE.MeshBasicMaterial>(null)

  // 扁平椭球体鱼形
  const geometry = useMemo(() => {
    const geo = new THREE.SphereGeometry(0.3, 6, 4)
    // 压扁为鱼形 - 通过scale实现
    return geo
  }, [])

  const material = useMemo(() => {
    const mat = new THREE.MeshBasicMaterial({
      color: config.color,
      transparent: true,
      opacity: 0,
      depthWrite: true,
    })
    materialRef.current = mat
    return mat
  }, [config.color])

  // 鱼尾三角形
  const tailGeometry = useMemo(() => {
    const geo = new THREE.BufferGeometry()
    const vertices = new Float32Array([
      0, 0, 0,
      -0.3, 0.15, 0,
      -0.3, -0.15, 0,
    ])
    geo.setAttribute('position', new THREE.BufferAttribute(vertices, 3))
    geo.computeVertexNormals()
    return geo
  }, [])

  useFrame((state) => {
    if (!meshRef.current || !materialRef.current) return

    const time = state.clock.elapsedTime
    const { basePosition, radius, speed, phase } = config

    // 小范围圆周游动
    const angle = time * speed + phase
    const x = Math.cos(angle) * radius + basePosition[0]
    const z = Math.sin(angle * 0.8) * radius * 0.7 + basePosition[2]
    const y = basePosition[1] + Math.sin(angle * 0.6) * 0.3

    meshRef.current.position.set(x, y, z)

    // 让鱼面向游动方向
    const tangentAngle = Math.atan2(Math.cos(angle), -Math.sin(angle))
    meshRef.current.rotation.y = tangentAngle
    // 轻微上下摆动
    meshRef.current.rotation.z = Math.sin(time * 2 + index) * 0.15

    // 可见性：间歇性出现（约30%时间可见）
    const cycle = time * 0.3 + index * 1.2
    const visibility = Math.sin(cycle)
    const targetOpacity = visibility > 0.3 ? Math.min((visibility - 0.3) * 3, 0.7) : 0
    materialRef.current.opacity += (targetOpacity - materialRef.current.opacity) * 0.02
  })

  return (
    <group>
      {/* 鱼身 */}
      <mesh
        ref={meshRef}
        geometry={geometry}
        material={material}
        scale={[config.scale * 1.6, config.scale * 0.5, config.scale * 0.4]}
      />
      {/* 鱼尾 */}
      <mesh
        geometry={tailGeometry}
        material={material}
        position={[0, 0, 0]}
        scale={[config.scale, config.scale, config.scale]}
      />
    </group>
  )
}

// 鱼群组件
export function Fish() {
  const seaLevelWorld = SEA_LEVEL * TERRAIN_CONFIG.heightScale

  // 创建4条鱼，分布在海洋区域
  const fishConfigs = useMemo<FishConfig[]>(() => {
    const configs: FishConfig[] = []
    const fishCount = 4
    const oceanCenterX = TERRAIN_CONFIG.width / 4 + 2 // 约9.5

    const fishColors = [
      new THREE.Color('#e8945a'), // 暖橙色
      new THREE.Color('#d4a574'), // 沙色
      new THREE.Color('#7ec8c8'), // 浅青绿
      new THREE.Color('#e8c87a'), // 淡金色
    ]

    for (let i = 0; i < fishCount; i++) {
      const angle = (i / fishCount) * Math.PI * 2 + Math.random() * 0.5
      const distance = 2 + Math.random() * 4
      const x = oceanCenterX + Math.cos(angle) * distance
      const z = Math.sin(angle) * distance
      // 刚好在水面下方
      const y = seaLevelWorld - 0.15 - Math.random() * 0.6
      const radius = 1.5 + Math.random() * 2.5
      const speed = 0.2 + Math.random() * 0.3
      const phase = Math.random() * Math.PI * 2
      const scale = 0.5 + Math.random() * 0.5

      configs.push({
        basePosition: [x, y, z],
        radius,
        speed,
        phase,
        color: fishColors[i % fishColors.length],
        scale,
      })
    }
    return configs
  }, [seaLevelWorld])

  return (
    <group>
      {fishConfigs.map((config, i) => (
        <FishModel key={i} config={config} index={i} />
      ))}
    </group>
  )
}

export default Fish