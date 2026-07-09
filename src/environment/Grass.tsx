/**
 * 草地（InstancedMesh）
 * 细长 blade 几何，顶端摇摆，多色绿变化。tipOnly 摇摆。
 */
import { useMemo } from 'react'
import * as THREE from 'three'
import InstancedFoliage from './InstancedFoliage'
import { getVegetation } from './vegetationData'
import { PALETTE } from '../config/palette'

export default function Grass() {
  const instances = useMemo(() => getVegetation('grass'), [])

  const geometry = useMemo(() => {
    const g = new THREE.PlaneGeometry(0.09, 0.55, 1, 3)
    g.translate(0, 0.275, 0)
    // 顶端收窄成尖
    const pos = g.attributes.position as THREE.BufferAttribute
    for (let i = 0; i < pos.count; i++) {
      if (pos.getY(i) > 0.45) pos.setX(i, pos.getX(i) * 0.08)
    }
    g.computeVertexNormals()
    return g
  }, [])

  const material = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: PALETTE.grassMid,
        roughness: 0.95,
        metalness: 0,
        side: THREE.DoubleSide,
      }),
    [],
  )

  const colorFor = useMemo(
    () => (inst: any) => {
      // 草地 vs 干草地色变化
      const colors = [PALETTE.grassBright, PALETTE.grassMid, PALETTE.grassDry]
      const c = colors[Math.floor(inst.phase * 3 / (Math.PI * 2)) % 3].clone()
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
      sway={{ height: 0.55, strength: 0.12, frequency: 1.8, tipOnly: true }}
      scaleBase={1.0}
      scaleJitter={0.4}
      alignNormal
      ySink={0.05}
      colorFor={colorFor}
      castShadow={false}
      receiveShadow={false}
    />
  )
}
