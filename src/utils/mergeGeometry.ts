/**
 * @module utils/mergeGeometry
 * @layer utils（叶子层）
 * @purpose 几何合并工具（position + normal + uv）
 * @dependsOn []
 * @exports [mergeGeometries]
 * @aiEdit
 *   - 改本文件导出的 mergeGeometries 即可；依赖见 @dependsOn
 */
/**
 * 几何合并工具
 * 手动合并多个 BufferGeometry（处理 indexed/non-indexed）。
 * P5 增强：同时合并 uv（TSL MeshStandardNodeMaterial PBR 依赖 uv，缺 UV → 黑色剪影）。
 * 对无 UV 的源几何体用简单顶点映射（i/(N-1), 0）生成 UV。
 */
import * as THREE from 'three/webgpu'

export function mergeGeometries(geos: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const merged = new THREE.BufferGeometry()
  const positions: number[] = []
  const normals: number[] = []
  const uvs: number[] = []
  const indices: number[] = []
  let offset = 0

  for (const g of geos) {
    g.computeVertexNormals()
    const p = g.attributes.position as THREE.BufferAttribute
    const n = g.attributes.normal as THREE.BufferAttribute
    const uv = g.attributes.uv as THREE.BufferAttribute | undefined
    const vertCount = p.count

    for (let i = 0; i < vertCount; i++) {
      positions.push(p.getX(i), p.getY(i), p.getZ(i))
      normals.push(n.getX(i), n.getY(i), n.getZ(i))
      // 有原始 UV → 直接用；否则简单线性映射
      uvs.push(uv ? uv.getX(i) : i / (vertCount - 1 || 1))
      uvs.push(uv ? uv.getY(i) : 0)
    }

    if (g.index) {
      const idx = g.index
      for (let i = 0; i < idx.count; i++) indices.push(idx.getX(i) + offset)
    } else {
      for (let i = 0; i < vertCount; i++) indices.push(offset + i)
    }
    offset += vertCount
  }

  merged.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  merged.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
  merged.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  merged.setIndex(indices)
  return merged
}
