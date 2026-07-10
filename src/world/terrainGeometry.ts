/**
 * @module world/terrainGeometry
 * @layer world（域层）
 * @purpose 地形几何生成（高度场 → 网格 + 岩层裙边）
 * @dependsOn ['utils/terrain', 'config/constants']
 * @exports [TerrainGeometryResult, createTerrainGeometry]
 * @aiEdit
 *   - 改本文件导出的 TerrainGeometryResult、createTerrainGeometry 即可；依赖见 @dependsOn
 */
/**
 * 地形几何生成
 *  - PlaneGeometry grid，用 heightAt 位移每个顶点 Y
 *  - 四边向下 extrude 到 BASE_Y 形成截面裙边（物理模型感）
 *  - 顶面用解析法线（更平滑），裙边法线水平朝外
 *  - 自定义 attribute：aSide(0顶面/1侧面)、aHeight(供材质 biome 混色与岩层条纹)
 */
import * as THREE from 'three'
import { heightAt, normalAt } from '../utils/terrain'
import { WORLD_SIZE, TERRAIN_SEGMENTS, BASE_Y } from '../config/constants'

export interface TerrainGeometryResult {
  geometry: THREE.BufferGeometry
  /** 顶面顶点数（裙边顶点在其后） */
  topVertexCount: number
}

export function createTerrainGeometry(): TerrainGeometryResult {
  const SEG = TERRAIN_SEGMENTS
  const half = WORLD_SIZE / 2
  const cols = SEG + 1
  const topCount = cols * cols

  // 四条边各 cols 个裙边顶点
  const skirtCount = cols * 4
  const total = topCount + skirtCount

  const positions = new Float32Array(total * 3)
  const normals = new Float32Array(total * 3)
  const sides = new Float32Array(total) // 0 顶面 / 1 侧面
  const heights = new Float32Array(total) // 原始地形高度（侧面用对应边缘高度）

  // ---- 顶面顶点 ----
  let p = 0
  for (let j = 0; j < cols; j++) {
    for (let i = 0; i < cols; i++) {
      const x = (i / SEG) * WORLD_SIZE - half
      const z = (j / SEG) * WORLD_SIZE - half
      const y = heightAt(x, z)
      positions[p * 3] = x
      positions[p * 3 + 1] = y
      positions[p * 3 + 2] = z
      const n = normalAt(x, z)
      normals[p * 3] = n[0]
      normals[p * 3 + 1] = n[1]
      normals[p * 3 + 2] = n[2]
      sides[p] = 0
      heights[p] = y
      p++
    }
  }

  // ---- 裙边顶点 ----
  // 边索引辅助：给定 (i, j) 返回顶面顶点索引
  const topIdx = (i: number, j: number) => j * cols + i

  // 四条边的顶点序列（每条 cols 个，顺序连贯）
  type EdgeV = { i: number; j: number; nx: number; nz: number } // nx,nz 朝外法线
  const edges: EdgeV[][] = [
    // j=0 (z=-half)，法线朝 -z
    Array.from({ length: cols }, (_, i) => ({ i, j: 0, nx: 0, nz: -1 })),
    // i=SEG (x=+half)，法线朝 +x
    Array.from({ length: cols }, (_, j) => ({ i: SEG, j, nx: 1, nz: 0 })),
    // j=SEG (z=+half)，法线朝 +z（反向遍历保持外法线连贯）
    Array.from({ length: cols }, (_, i) => ({ i: SEG - i, j: SEG, nx: 0, nz: 1 })),
    // i=0 (x=-half)，法线朝 -x
    Array.from({ length: cols }, (_, j) => ({ i: 0, j: SEG - j, nx: -1, nz: 0 })),
  ]

  const skirtStart = topCount
  let sp = skirtStart
  for (const edge of edges) {
    for (const ev of edge) {
      const x = (ev.i / SEG) * WORLD_SIZE - half
      const z = (ev.j / SEG) * WORLD_SIZE - half
      const topY = heightAt(x, z)
      positions[sp * 3] = x
      positions[sp * 3 + 1] = BASE_Y
      positions[sp * 3 + 2] = z
      // 侧面法线水平朝外，略带垂直分量避免完全黑
      normals[sp * 3] = ev.nx
      normals[sp * 3 + 1] = 0.15
      normals[sp * 3 + 2] = ev.nz
      // 归一化
      const len = Math.hypot(ev.nx, 0.15, ev.nz)
      normals[sp * 3] /= len
      normals[sp * 3 + 1] /= len
      normals[sp * 3 + 2] /= len
      sides[sp] = 1
      heights[sp] = topY // 用边缘地形高度做岩层条纹
      sp++
    }
  }

  // ---- 索引 ----
  // 顶面三角形
  const indices: number[] = []
  for (let j = 0; j < SEG; j++) {
    for (let i = 0; i < SEG; i++) {
      const a = topIdx(i, j)
      const b = topIdx(i + 1, j)
      const c = topIdx(i + 1, j + 1)
      const d = topIdx(i, j + 1)
      // 注意 winding：从 +y 看下去 CCW
      indices.push(a, d, c)
      indices.push(a, c, b)
    }
  }

  // 裙边侧面四边形
  // 每条边 cols-1 段，连接 topVertex 与 skirtVertex
  let skirtBase = skirtStart
  for (const edge of edges) {
    for (let k = 0; k < edge.length - 1; k++) {
      const ev0 = edge[k]
      const ev1 = edge[k + 1]
      const t0 = topIdx(ev0.i, ev0.j)
      const t1 = topIdx(ev1.i, ev1.j)
      const s0 = skirtBase + k
      const s1 = skirtBase + k + 1
      // 侧面朝外：t0->s0->s1->t1
      indices.push(t0, s0, s1)
      indices.push(t0, s1, t1)
    }
    skirtBase += edge.length
  }

  // ---- 组装 ----
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3))
  geometry.setAttribute('aSide', new THREE.BufferAttribute(sides, 1))
  geometry.setAttribute('aHeight', new THREE.BufferAttribute(heights, 1))
  geometry.setIndex(indices)
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()

  return { geometry, topVertexCount: topCount }
}
