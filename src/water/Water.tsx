/**
 * @module water/Water
 * @layer water（域层）
 * @purpose 水面组件（装配 Plane + 波位移 + 泡沫材质）
 * @dependsOn ['water/foam/waterMaterial', 'water/physics/waterField', 'config/constants']
 * @exports [Water, Water]
 * @aiEdit
 *   - 改本文件导出的 Water、Water 即可；依赖见 @dependsOn
 */
/**
 * 海洋水面组件
 * 大水平面（略大于世界），挂水着色器材质。
 * 每帧更新 uniform（时间 + 相机位置）。
 */
import { useMemo, useRef, useEffect } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { createWaterMaterial, updateWaterMaterial, WaterMaterial } from './foam/waterMaterial'
import { createWaterField, WaterField } from './physics/waterField'
import { WORLD_SIZE, WATER_LEVEL } from '../config/constants'

export default function Water() {
  const material = useMemo(() => createWaterMaterial(), [])
  const matRef = useRef<WaterMaterial>(material)
  const { camera, gl } = useThree()

  // GPU 物理水场（Virtual Pipes ping-pong），随渲染器创建
  const waterField = useMemo(() => createWaterField(gl), [gl])
  useEffect(() => () => waterField.dispose(), [waterField])

  // 水面几何：大平面，旋转到 XZ
  const geometry = useMemo(() => {
    const g = new THREE.PlaneGeometry(WORLD_SIZE * 1.6, WORLD_SIZE * 1.6, 160, 160)
    g.rotateX(-Math.PI / 2)
    return g
  }, [])

  useFrame((_, delta) => {
    const m = matRef.current
    if (!m.uniforms) return
    // 推进物理水模拟并把当前水深纹理交给材质（顶点位移 / 干地遮罩 / 深度色）
    waterField.compute(delta)
    m.uniforms.uWaterHeight.value = waterField.getHTexture()
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
