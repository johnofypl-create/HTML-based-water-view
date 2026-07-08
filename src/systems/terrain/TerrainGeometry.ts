import * as THREE from 'three'
import { fbm } from '../../utils/noise'
import { clamp, mapRange } from '../../utils/math'
import { TERRAIN_CONFIG } from '../../config/constants'

export interface TerrainGeometryResult {
  geometry: THREE.PlaneGeometry
  heightData: Float32Array
  slopeData: Float32Array
}

// 生成沿海地形高度场几何体
export function generateTerrainGeometry(): TerrainGeometryResult {
  const { width, depth, segments, heightScale } = TERRAIN_CONFIG

  // 创建基础平面几何体 (XY平面, Z=0)
  const geometry = new THREE.PlaneGeometry(width, depth, segments, segments)

  const positions = geometry.attributes.position.array as Float32Array
  const count = (segments + 1) * (segments + 1)

  const heightData = new Float32Array(count)
  const slopeData = new Float32Array(count)

  const halfW = width / 2
  const halfD = depth / 2

  // 计算每个顶点的高度
  for (let i = 0; i <= segments; i++) {
    for (let j = 0; j <= segments; j++) {
      const index = i * (segments + 1) + j

      // 世界坐标中的 X 和 Z (旋转后)
      const worldX = -halfW + i * (width / segments)
      const worldZ = -halfD + j * (depth / segments)

      const u = (worldX + halfW) / width  // 0=左, 1=右
      const v = (worldZ + halfD) / depth  // 0=前, 1=后

      let elevation = generateElevation(u, v)
      elevation = carveRiverValley(elevation, u, v)
      elevation = addCliffs(elevation, u, v)
      elevation = addCoastalDunes(elevation, u, v)

      // 设置Z分量为高度 (旋转后成为世界Y)
      positions[index * 3 + 2] = elevation * heightScale
      heightData[index] = elevation
    }
  }

  // 计算坡度
  calculateSlopes(heightData, slopeData, segments, width, depth)

  // 创建坡度属性
  geometry.setAttribute('slope', new THREE.BufferAttribute(slopeData, 1))

  // 创建顶点颜色用于材质混合
  createVertexColors(geometry, heightData, slopeData, segments)

  geometry.attributes.position.needsUpdate = true
  geometry.computeVertexNormals()

  return {
    geometry,
    heightData,
    slopeData,
  }
}

// 生成基础高度使用fbm分形噪声
function generateElevation(u: number, v: number): number {
  // 大尺度基础地形
  const largeScale = fbm(u * 2.5, v * 2.5, 6, 2.0, 0.5, 1234)

  // 中等尺度细节
  const mediumScale = fbm(u * 6.0, v * 6.0, 4, 2.2, 0.5, 2345) * 0.3

  // 小尺度细节噪波
  const smallScale = fbm(u * 15.0, v * 15.0, 3, 2.0, 0.5, 3456) * 0.15

  let elevation = largeScale + mediumScale + smallScale

  // 右侧整体降低，形成海洋倾斜
  const oceanInfluence = mapRange(u, 0.4, 1.0, 0, 1)
  elevation -= oceanInfluence * 0.35

  return clamp(elevation, 0, 1)
}

// 雕刻河谷：从左上(u≈0, v≈1)流向中右(u≈0.6, v≈0.5)
function carveRiverValley(elevation: number, u: number, v: number): number {
  // 河谷中心线的V坐标，随U变化
  const riverV = 0.85 - 0.35 * u - 0.08 * Math.sin(u * Math.PI * 1.8)

  // 河谷宽度：上游窄下游宽
  const riverWidth = 0.03 + u * 0.07

  // 到河谷中心线的距离
  const dist = Math.abs(v - riverV)

  // 河谷深度：越靠近海洋越深
  const riverDepth = 0.1 + u * 0.3

  // 平滑雕刻河谷
  if (dist < riverWidth * 2.0) {
    const t = dist / (riverWidth * 2.0)
    const smooth = 1 - t * t
    elevation -= riverDepth * smooth * 1.1
  }

  return elevation
}

// 添加左侧悬崖
function addCliffs(elevation: number, u: number, v: number): number {
  if (u < 0.25) {
    const cliffFactor = mapRange(u, 0, 0.25, 0.4, 0)
    const noise = fbm(u * 20, v * 20, 2, 2, 0.5, 4567) * 0.2
    elevation += (cliffFactor + noise) * 0.6
  }
  return elevation
}

// 添加沿海沙丘
function addCoastalDunes(elevation: number, u: number, v: number): number {
  if (u > 0.35 && u < 0.7) {
    const duneNoise = fbm(u * 8, v * 12, 3, 2, 0.5, 5678)
    const duneFactor = Math.sin(u * 10) * 0.08 + duneNoise * 0.05
    elevation += duneFactor
  }
  return elevation
}

// 计算每个顶点的坡度
function calculateSlopes(
  heightData: Float32Array,
  slopeData: Float32Array,
  segments: number,
  width: number,
  depth: number
): void {
  const cellSizeX = width / segments
  const cellSizeZ = depth / segments

  for (let i = 0; i <= segments; i++) {
    for (let j = 0; j <= segments; j++) {
      const index = i * (segments + 1) + j

      const h = heightData[index]
      const hLeft = i > 0 ? heightData[(i - 1) * (segments + 1) + j] : h
      const hRight = i < segments ? heightData[(i + 1) * (segments + 1) + j] : h
      const hDown = j > 0 ? heightData[i * (segments + 1) + (j - 1)] : h
      const hUp = j < segments ? heightData[i * (segments + 1) + (j + 1)] : h

      const dx = (hRight - hLeft) / (2 * cellSizeX)
      const dz = (hUp - hDown) / (2 * cellSizeZ)

      const gradient = Math.sqrt(dx * dx + dz * dz)
      const slope = Math.atan(gradient * TERRAIN_CONFIG.heightScale) / (Math.PI / 2)

      slopeData[index] = clamp(slope, 0, 1)
    }
  }
}

// 创建顶点颜色用于材质混合
function createVertexColors(
  geometry: THREE.PlaneGeometry,
  heightData: Float32Array,
  slopeData: Float32Array,
  segments: number
): void {
  const count = (segments + 1) * (segments + 1)
  const colors = new Float32Array(count * 3)
  const seaLevel = TERRAIN_CONFIG.seaLevel

  for (let i = 0; i < count; i++) {
    const h = heightData[i]
    const s = slopeData[i]

    // R: 沙滩权重, G: 草地权重, B: 岩石权重
    let sandWeight = 0
    let grassWeight = 0
    let rockWeight = 0

    // 沙滩：接近海平面 + 低坡度
    if (h < seaLevel + 0.1 && s < 0.35) {
      const distToSea = Math.abs(h - seaLevel)
      sandWeight = 1 - Math.min(distToSea / 0.1, 1)
    }

    // 岩石：高坡度 或 高海拔
    if (s > 0.4) {
      rockWeight = mapRange(s, 0.4, 0.75, 0, 1)
    }
    if (h > seaLevel + 0.35) {
      rockWeight = Math.max(rockWeight, mapRange(h, seaLevel + 0.35, 0.8, 0.15, 1))
    }

    // 草地：剩余权重
    const used = sandWeight + rockWeight
    grassWeight = Math.max(0, 1 - used)

    const total = sandWeight + grassWeight + rockWeight || 1
    sandWeight /= total
    grassWeight /= total
    rockWeight /= total

    colors[i * 3 + 0] = sandWeight
    colors[i * 3 + 1] = grassWeight
    colors[i * 3 + 2] = rockWeight
  }

  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
}