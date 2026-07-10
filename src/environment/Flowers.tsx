/**
 * @module environment/Flowers
 * @layer environment（域层）
 * @purpose 花实例层
 * @dependsOn ['environment/InstancedFoliage', 'environment/vegetationData', 'config/palette']
 * @exports [Flowers, Flowers]
 * @aiEdit
 *   - 改本文件导出的 Flowers、Flowers 即可；依赖见 @dependsOn
 */
/**
 * 花朵（InstancedMesh）
 * 小花球（茎被草丛遮盖），多色变化（白/黄/粉/淡紫），顶端轻摇。
 */
import { useMemo } from 'react'
import * as THREE from 'three'
import InstancedFoliage from './InstancedFoliage'
import { getVegetation } from './vegetationData'
import { PALETTE } from '../config/palette'

const FLOWER_COLORS = [
  PALETTE.flowerWhite,
  PALETTE.flowerYellow,
  PALETTE.flowerPink,
  PALETTE.flowerLavender,
]

export default function Flowers() {
  const instances = useMemo(() => getVegetation('flower'), [])

  const geometry = useMemo(() => {
    // 单一花球，居中略高
    const g = new THREE.IcosahedronGeometry(0.055, 0)
    g.translate(0, 0.2, 0)
    return g
  }, [])

  const material = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#ffffff',
        roughness: 0.75,
        metalness: 0,
        vertexColors: true,
      }),
    [],
  )

  const colorFor = useMemo(
    () => (_inst: any, i: number) => {
      const c = FLOWER_COLORS[i % FLOWER_COLORS.length].clone()
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
      sway={{ height: 0.22, strength: 0.05, frequency: 2.2, tipOnly: true }}
      scaleBase={1.0}
      scaleJitter={0.45}
      alignNormal
      ySink={0.0}
      colorFor={colorFor}
      castShadow={false}
      receiveShadow={false}
    />
  )
}
