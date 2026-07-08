import * as THREE from 'three'
import { WORLD_SIZE } from '../../config/constants'

// 创建海洋平面几何体 - 覆盖地形右侧（海洋区）
export function createOceanPlane(): THREE.PlaneGeometry {
  // 覆盖从x=0到x=WORLD_SIZE/2+10，覆盖整个y(z)范围
  const width = WORLD_SIZE / 2 + 4
  const height = WORLD_SIZE + 4
  const segments = 64
  const geometry = new THREE.PlaneGeometry(width, height, segments, segments)
  return geometry
}

// 创建河流几何体 - 根据路径生成带状几何体
export function createRiverGeometry(riverPath: [number, number][]): THREE.BufferGeometry {
  const points: THREE.Vector3[] = []
  const uvs: number[] = []
  const indices: number[] = []

  const segments = riverPath.length

  // 为每个路径点计算宽度
  for (let i = 0; i < segments; i++) {
    const [x, z] = riverPath[i]
    // 宽度从上游窄到下游宽
    const t = i / (segments - 1)
    const halfWidth = lerp(0.3, 1.2, t) / 2

    // 计算路径切线
    let tangentX: number, tangentZ: number
    if (i === 0) {
      const [nx, nz] = riverPath[i + 1]
      tangentX = nx - x
      tangentZ = nz - z
    } else if (i === segments - 1) {
      const [px, pz] = riverPath[i - 1]
      tangentX = x - px
      tangentZ = z - pz
    } else {
      const [px, pz] = riverPath[i - 1]
      const [nx, nz] = riverPath[i + 1]
      tangentX = (nx - px) / 2
      tangentZ = (nz - pz) / 2
    }

    // 归一化切线
    const len = Math.sqrt(tangentX * tangentX + tangentZ * tangentZ)
    tangentX /= len
    tangentZ /= len

    // 法向量（垂直切线）
    const normalX = -tangentZ
    const normalZ = tangentX

    // 创建左右两个顶点
    const leftX = x + normalX * halfWidth
    const leftZ = z + normalZ * halfWidth
    const rightX = x - normalX * halfWidth
    const rightZ = z - normalZ * halfWidth

    // 顶点在y=0处，水在海平面y
    points.push(new THREE.Vector3(leftX, 0, leftZ))
    points.push(new THREE.Vector3(rightX, 0, rightZ))

    // UV坐标：v沿河流流向，u从左到右
    const v = i / (segments - 1)
    uvs.push(0, v)
    uvs.push(1, v)
  }

  // 创建三角形索引
  for (let i = 0; i < segments - 1; i++) {
    const a = i * 2
    const b = i * 2 + 1
    const c = (i + 1) * 2
    const d = (i + 1) * 2 + 1

    // 两个三角形组成四边形
    indices.push(a, b, c)
    indices.push(b, d, c)
  }

  // 创建BufferGeometry
  const geometry = new THREE.BufferGeometry()
  const positions = new Float32Array(points.length * 3)
  for (let i = 0; i < points.length; i++) {
    positions[i * 3] = points[i].x
    positions[i * 3 + 1] = points[i].y
    positions[i * 3 + 2] = points[i].z
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geometry.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(uvs), 2))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()

  return geometry
}

// 获取预定义河流路径，匹配地形的河谷雕刻
export function getDefaultRiverPath(): [number, number][] {
  const path: [number, number][] = []
  const segments = 30

  for (let i = 0; i <= segments; i++) {
    const u = (i / segments) * 0.65 // 从u=0到u=0.65
    // 河谷中心线的V坐标，匹配地形CarveRiverValley中的曲线
    const riverV = 0.85 - 0.35 * u - 0.08 * Math.sin(u * Math.PI * 1.8)

    // 世界坐标转换：[-WORLD_SIZE/2, WORLD_SIZE/2]
    const worldX = (-WORLD_SIZE / 2) + u * WORLD_SIZE
    const worldZ = (-WORLD_SIZE / 2) + riverV * WORLD_SIZE

    path.push([worldX, worldZ])
  }

  return path
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}
