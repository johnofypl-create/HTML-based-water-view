/**
 * 漂流木（InstancedMesh）
 * 长条圆木，木色，搁浅在水线附近。轻摆（被浪推）。
 */
import { useMemo } from 'react'
import * as THREE from 'three'
import InstancedFoliage from './InstancedFoliage'
import { getVegetation } from './vegetationData'
import { PALETTE } from '../config/palette'

export default function Driftwood() {
  const instances = useMemo(() => getVegetation('driftwood'), [])

  const geometry = useMemo(() => {
    const g = new THREE.CylinderGeometry(0.08, 0.1, 1.1, 6)
    g.rotateZ(Math.PI / 2) // 横躺
    g.translate(0, 0.08, 0)
    // 顶点扰动
    const pos = g.attributes.position as THREE.BufferAttribute
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i)
      pos.setY(i, y + Math.sin(pos.getX(i) * 5) * 0.02)
    }
    g.computeVertexNormals()
    return g
  }, [])

  const material = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: PALETTE.woodLight,
        roughness: 0.95,
        metalness: 0,
        vertexColors: true,
        flatShading: true,
      }),
    [],
  )

  const colorFor = useMemo(
    () => () => {
      const c = (Math.random() > 0.5 ? PALETTE.woodDark : PALETTE.woodLight).clone()
      c.offsetHSL(0, 0, (Math.random() - 0.5) * 0.06)
      return c
    },
    [],
  )

  return (
    <InstancedFoliage
      geometry={geometry}
      baseMaterial={material}
      instances={instances}
      sway={{ height: 0.16, strength: 0.02, frequency: 0.6, tipOnly: false }}
      scaleBase={1.0}
      scaleJitter={0.4}
      ySink={0.04}
      colorFor={colorFor}
      castShadow
      receiveShadow
    />
  )
}
