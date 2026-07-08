import { useRef, useMemo, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import waterVertexShader from '../../shaders/water/waterVertex.glsl?raw'
import waterFragmentShader from '../../shaders/water/waterFragment.glsl?raw'
import { createOceanPlane, createRiverGeometry, getDefaultRiverPath } from './WaterGeometry'
import { COLORS } from '../../config/palette'
import { WATER_CONFIG, SEA_LEVEL, TERRAIN_CONFIG } from '../../config/constants'

export function Water() {
  const oceanRef = useRef<THREE.ShaderMaterial>(null!)
  const riverRef = useRef<THREE.ShaderMaterial>(null!)

  const seaLevelWorld = SEA_LEVEL * TERRAIN_CONFIG.heightScale

  // 海洋几何体
  const oceanGeometry = useMemo(() => createOceanPlane(), [])

  // 河流几何体
  const riverGeometry = useMemo(() => {
    const riverPath = getDefaultRiverPath()
    return createRiverGeometry(riverPath)
  }, [])

  // 海洋材质
  const oceanMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uWaterColor: { value: new THREE.Color(COLORS.water.turquoise) },
        uDeepColor: { value: new THREE.Color(WATER_CONFIG.deepColor) },
        uFoamColor: { value: new THREE.Color(COLORS.water.foam) },
        uOpacity: { value: WATER_CONFIG.opacity },
      },
      vertexShader: waterVertexShader,
      fragmentShader: waterFragmentShader,
      transparent: true,
      depthWrite: true,
      side: THREE.DoubleSide,
    })
  }, [])

  // 河流材质
  const riverMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uWaterColor: { value: new THREE.Color(COLORS.water.river) },
        uDeepColor: { value: new THREE.Color(COLORS.water.medium) },
        uFoamColor: { value: new THREE.Color(COLORS.water.foam) },
        uOpacity: { value: 0.9 },
      },
      vertexShader: waterVertexShader,
      fragmentShader: waterFragmentShader,
      transparent: true,
      depthWrite: true,
      side: THREE.DoubleSide,
    })
  }, [])

  // 清理材质和几何体
  useEffect(() => {
    return () => {
      oceanMaterial.dispose()
      riverMaterial.dispose()
      oceanGeometry.dispose()
      riverGeometry.dispose()
    }
  }, [oceanMaterial, riverMaterial, oceanGeometry, riverGeometry])

  // 动画更新
  useFrame((_, delta) => {
    if (oceanRef.current) {
      oceanRef.current.uniforms.uTime.value += delta * WATER_CONFIG.waveSpeed
    }
    if (riverRef.current) {
      riverRef.current.uniforms.uTime.value += delta * WATER_CONFIG.waveSpeed * 0.7
    }
  })

  // 海洋平面位置：在右侧，海平面高度
  const oceanCenterX = TERRAIN_CONFIG.width / 4 + 2

  return (
    <group>
      {/* 海洋 */}
      <mesh
        geometry={oceanGeometry}
        material={oceanMaterial}
        position={[oceanCenterX, seaLevelWorld, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        renderOrder={1}
      />

      {/* 河流 */}
      <mesh
        geometry={riverGeometry}
        material={riverMaterial}
        position={[0, seaLevelWorld + 0.01, 0]}
        renderOrder={2}
      />
    </group>
  )
}

export default Water