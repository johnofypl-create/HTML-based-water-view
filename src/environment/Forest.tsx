/**
 * 森林（InstancedMesh）
 * 两种树几何（针叶锥 + 阔叶球），合并干+冠，冠层整体轻摆。
 * 颜色按实例相位在深绿→中绿间变化。
 */
import { useMemo } from 'react'
import * as THREE from 'three'
import InstancedFoliage from './InstancedFoliage'
import { getVegetation } from './vegetationData'
import { PALETTE } from '../config/palette'
import { mergeGeometries } from '../utils/mergeGeometry'

export default function Forest() {
  const instances = useMemo(() => getVegetation('tree'), [])

  // 针叶树几何：圆柱干 + 圆锥冠
  const coniferGeo = useMemo(() => {
    const trunk = new THREE.CylinderGeometry(0.06, 0.09, 0.8, 5)
    trunk.translate(0, 0.4, 0)
    const crown = new THREE.ConeGeometry(0.55, 1.6, 7)
    crown.translate(0, 1.5, 0)
    return mergeGeometries([trunk, crown])
  }, [])

  // 阔叶树几何：圆柱干 + 球冠
  const broadGeo = useMemo(() => {
    const trunk = new THREE.CylinderGeometry(0.07, 0.1, 0.9, 5)
    trunk.translate(0, 0.45, 0)
    const crown = new THREE.IcosahedronGeometry(0.7, 1)
    crown.translate(0, 1.5, 0)
    return mergeGeometries([trunk, crown])
  }, [])

  const trunkMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: PALETTE.woodDark,
        roughness: 0.95,
        metalness: 0,
        vertexColors: true,
      }),
    [],
  )

  // 按实例分配针叶/阔叶
  const coniferInstances = useMemo(
    () => instances.filter((_, i) => i % 3 !== 0),
    [instances],
  )
  const broadInstances = useMemo(
    () => instances.filter((_, i) => i % 3 === 0),
    [instances],
  )

  const colorFor = useMemo(
    () => (inst: any, i: number) => {
      // 树冠绿变化
      const colors = [PALETTE.forestDeep, PALETTE.forestMid, PALETTE.forestLight]
      const c = colors[i % 3].clone()
      c.offsetHSL(0, 0, (Math.random() - 0.5) * 0.04)
      return c
    },
    [],
  )

  return (
    <group>
      <InstancedFoliage
        geometry={coniferGeo}
        baseMaterial={trunkMat.clone()}
        instances={coniferInstances}
        sway={{ height: 2.2, strength: 0.04, frequency: 0.9, tipOnly: false }}
        scaleBase={1.1}
        scaleJitter={0.5}
        ySink={0.1}
        colorFor={colorFor}
        castShadow
        receiveShadow
      />
      <InstancedFoliage
        geometry={broadGeo}
        baseMaterial={trunkMat.clone()}
        instances={broadInstances}
        sway={{ height: 2.3, strength: 0.05, frequency: 0.8, tipOnly: false }}
        scaleBase={1.0}
        scaleJitter={0.5}
        ySink={0.1}
        colorFor={colorFor}
        castShadow
        receiveShadow
      />
    </group>
  )
}
