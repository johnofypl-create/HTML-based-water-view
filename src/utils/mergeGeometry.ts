/**
 * 几何合并工具
 * 手动合并多个 BufferGeometry（处理 indexed/non-indexed），避免 import 路径问题。
 */
import * as THREE from 'three'

export function mergeGeometries(geos: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const merged = new THREE.BufferGeometry()
  const positions: number[] = []
  const normals: number[] = []
  const indices: number[] = []
  let offset = 0

  for (const g of geos) {
    g.computeVertexNormals()
    const p = g.attributes.position as THREE.BufferAttribute
    const n = g.attributes.normal as THREE.BufferAttribute
    const vertCount = p.count
    for (let i = 0; i < vertCount; i++) {
      positions.push(p.getX(i), p.getY(i), p.getZ(i))
      normals.push(n.getX(i), n.getY(i), n.getZ(i))
    }
    if (g.index) {
      const idx = g.index
      for (let i = 0; i < idx.count; i++) {
        indices.push(idx.getX(i) + offset)
      }
    } else {
      for (let i = 0; i < vertCount; i++) indices.push(offset + i)
    }
    offset += vertCount
  }

  merged.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  merged.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
  merged.setIndex(indices)
  return merged
}
