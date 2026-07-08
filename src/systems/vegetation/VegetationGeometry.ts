import * as THREE from 'three'

// 合并多个 BufferGeometry 为一个
function mergeBufferGeometries(geometries: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const positions: number[] = []
  const normals: number[] = []
  const indices: number[] = []
  let vertexOffset = 0

  for (const geo of geometries) {
    const pos = geo.getAttribute('position') as THREE.BufferAttribute
    const norm = (geo.getAttribute('normal') as THREE.BufferAttribute | undefined)
    const idx = geo.index

    for (let i = 0; i < pos.count; i++) {
      positions.push(pos.getX(i), pos.getY(i), pos.getZ(i))
      if (norm) {
        normals.push(norm.getX(i), norm.getY(i), norm.getZ(i))
      }
    }

    if (idx) {
      for (let i = 0; i < idx.count; i++) {
        indices.push(idx.getX(i) + vertexOffset)
      }
    }

    vertexOffset += pos.count
  }

  const merged = new THREE.BufferGeometry()
  merged.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  if (normals.length > 0) {
    merged.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
  }
  if (indices.length > 0) {
    merged.setIndex(indices)
  }
  merged.computeVertexNormals()
  return merged
}

// 创建树几何体：圆柱树干 + 圆锥树冠，总高度约 1.5-2.5 单位
export function createTreeGeometry(): THREE.BufferGeometry {
  const segments = 6
  const trunkHeight = 1.0
  const trunkRadiusBottom = 0.1
  const trunkRadiusTop = 0.07
  const canopyHeight = 1.2
  const canopyRadius = 0.45

  const trunkGeo = new THREE.CylinderGeometry(trunkRadiusTop, trunkRadiusBottom, trunkHeight, segments)
  trunkGeo.translate(0, trunkHeight / 2, 0)

  const canopyGeo = new THREE.ConeGeometry(canopyRadius, canopyHeight, segments, 2)
  canopyGeo.translate(0, trunkHeight + canopyHeight * 0.35, 0)

  const merged = mergeBufferGeometries([trunkGeo, canopyGeo])
  trunkGeo.dispose()
  canopyGeo.dispose()
  return merged
}

// 创建灌木几何体：半球，约 0.5-1.0 单位
export function createShrubGeometry(): THREE.BufferGeometry {
  const segments = 6
  const radius = 0.5

  const geo = new THREE.SphereGeometry(radius, segments, Math.floor(segments / 2), 0, Math.PI * 2, 0, Math.PI / 2)
  // 压扁一点，更像灌木
  const positions = geo.getAttribute('position') as THREE.BufferAttribute
  for (let i = 0; i < positions.count; i++) {
    positions.setY(i, positions.getY(i) * 0.6)
  }
  geo.computeVertexNormals()
  return geo
}

// 创建草几何体：细长锥体，约 0.3-0.8 单位
export function createGrassGeometry(): THREE.BufferGeometry {
  const segments = 5
  const height = 0.6
  const radius = 0.04

  const geo = new THREE.ConeGeometry(radius, height, segments, 1)
  geo.translate(0, height / 2, 0)
  return geo
}

// 创建花朵几何体：细圆柱 + 顶部小球，约 0.2-0.5 单位
export function createFlowerGeometry(): THREE.BufferGeometry {
  const stemSegments = 6
  const stemHeight = 0.3
  const stemRadius = 0.015
  const headRadius = 0.06
  const headSegments = 6

  const stemGeo = new THREE.CylinderGeometry(stemRadius, stemRadius, stemHeight, stemSegments)
  stemGeo.translate(0, stemHeight / 2, 0)

  const headGeo = new THREE.SphereGeometry(headRadius, headSegments, Math.floor(headSegments / 2))
  headGeo.translate(0, stemHeight, 0)

  const merged = mergeBufferGeometries([stemGeo, headGeo])
  stemGeo.dispose()
  headGeo.dispose()
  return merged
}