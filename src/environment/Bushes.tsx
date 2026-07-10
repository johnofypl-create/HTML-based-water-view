/**
 * @module environment/Bushes
 * @layer environment（域层）
 * @purpose 灌木实例层
 * @dependsOn ['environment/InstancedFoliage', 'environment/vegetationData', 'config/palette']
 * @exports [Bushes, Bushes]
 * @aiEdit
 *   - 改本文件导出的 Bushes、Bushes 即可；依赖见 @dependsOn
 */
/**
 * 灌木（InstancedMesh）
 * 低多边形球状，压扁，深绿多色。轻摆。
 */
import { useMemo } from 'react'
import * as THREE from 'three'
import InstancedFoliage from './InstancedFoliage'
import { getVegetation } from './vegetationData'
import { PALETTE } from '../config/palette'

export default function Bushes() {
  const instances = useMemo(() => getVegetation('bush'), [])

  const geometry = useMemo(() => {
    const g = new THREE.IcosahedronGeometry(0.45, 1)
    // 压扁 + 顶点扰动
    const pos = g.attributes.position as THREE.BufferAttribute
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i)
      const y = pos.getY(i)
      const z = pos.getZ(i)
      const n = Math.sin(x * 8 + y * 5) * 0.06
      pos.setXYZ(i, x * 1.15 + n, y * 0.7 + n * 0.5, z * 1.15 - n)
    }
    g.computeVertexNormals()
    g.translate(0, 0.3, 0)
    return g
  }, [])

  const material = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: PALETTE.bushMid,
        roughness: 0.92,
        metalness: 0,
        vertexColors: true,
        flatShading: true,
      }),
    [],
  )

  const colorFor = useMemo(
    () => (_inst: any, i: number) => {
      const colors = [PALETTE.bushDark, PALETTE.bushMid, PALETTE.forestLight]
      const c = colors[i % 3].clone()
      c.offsetHSL(0, 0, (Math.random() - 0.5) * 0.05)
      return c
    },
    [],
  )

  return (
    <InstancedFoliage
      geometry={geometry}
      baseMaterial={material}
      instances={instances}
      sway={{ height: 0.6, strength: 0.03, frequency: 1.2, tipOnly: false }}
      scaleBase={1.0}
      scaleJitter={0.45}
      alignNormal
      ySink={0.08}
      colorFor={colorFor}
      castShadow
      receiveShadow
    />
  )
}
