/**
 * @module world/Terrain
 * @layer world（域层）
 * @purpose 地形组件（装配几何 + 材质 + 昼夜响应）
 * @dependsOn ['world/terrainGeometry', 'world/terrainMaterial', 'state/lightingState']
 * @exports [Terrain, Terrain]
 * @aiEdit
 *   - 改本文件导出的 Terrain、Terrain 即可；依赖见 @dependsOn
 */
/**
 * 地形组件
 * 组装几何 + 材质，挂为 mesh，接收与投射阴影。
 * 每帧更新材质 uniform（uTime + 从 lightingState 读 sun/fog）。
 */
import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { createTerrainGeometry } from './terrainGeometry'
import { createTerrainMaterial, updateTerrainMaterial, TerrainMaterial } from './terrainMaterial'
import { lightingState } from '../state/lightingState'

export default function Terrain() {
  const { geometry } = useMemo(() => createTerrainGeometry(), [])
  const material = useMemo(() => createTerrainMaterial(), [])
  const matRef = useRef<TerrainMaterial>(material)

  useFrame((_, delta) => {
    const m = matRef.current
    if (!m.uniforms) return
    m.uniforms.uTime.value += delta
    updateTerrainMaterial(
      m,
      m.uniforms.uTime.value,
      lightingState.sunDir,
      lightingState.sunColor,
      lightingState.fogColor,
      lightingState.fogDensity,
    )
  })

  return (
    <mesh
      geometry={geometry}
      material={material}
      receiveShadow
      castShadow
      ref={(r) => {
        if (r) matRef.current = (r as THREE.Mesh).material as TerrainMaterial
      }}
    />
  )
}
