/**
 * @module water/Water
 * @layer water（域层）
 * @purpose 水面组件（装配 Plane + 物理水 + 着色器材质）
 * @dependsOn ['water/foam/waterMaterial', 'water/physics/waterField', 'config/constants']
 * @exports [Water, Water]
 * @aiEdit
 *   - 改本文件导出的 Water、Water 即可；依赖见 @dependsOn
 */
import { useMemo, useRef, useEffect } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three/webgpu'
import { createWaterMaterial, updateWaterMaterial, WaterMaterial } from './foam/waterMaterial'
import { createWaterField } from './physics/waterField'
import { WORLD_SIZE, WATER_LEVEL } from '../config/constants'

export default function Water() {
  const material = useMemo(() => createWaterMaterial(), [])
  const matRef = useRef<WaterMaterial>(material)
  const { camera } = useThree()

  // CPU 物理水场（P5 Virtual Pipes → DataTexture）
  const waterField = useMemo(() => createWaterField(), [])
  useEffect(() => () => waterField.dispose(), [waterField])

  const geometry = useMemo(() => {
    const g = new THREE.PlaneGeometry(WORLD_SIZE * 1.6, WORLD_SIZE * 1.6, 160, 160)
    g.rotateX(-Math.PI / 2)
    return g
  }, [])

  useFrame((_, delta) => {
    const m = matRef.current
    if (!m.uniforms) return

    waterField.compute()
    // 复制物理水数据到直接纹理引用（非 uniform — TSL texture() 不接受 UniformNode 包装的纹理）
    const srcTex = waterField.getHTexture()
    if (srcTex) {
      const waterTex = (material as any).waterHeightTex
      if (waterTex && srcTex.image) {
        (waterTex.image as any).data.set((srcTex.image as any).data)
        waterTex.needsUpdate = true
      }
    }

    if (!m.uniforms.uEnablePhysics.value) {
      m.uniforms.uEnablePhysics.value = 1.0
    }

    m.uniforms.uTime.value += delta
    updateWaterMaterial(m, m.uniforms.uTime.value, camera.position)
  })

  return (
    <mesh
      geometry={geometry}
      material={material}
      position={[0, WATER_LEVEL, 0]}
      ref={(r) => {
        if (r) matRef.current = (r as THREE.Mesh).material as WaterMaterial
      }}
    />
  )
}
