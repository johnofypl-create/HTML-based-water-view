/**
 * 地形高度场纹理
 * 把 heightAt 烘焙成一张 DataTexture，供水着色器采样计算水深/深度色。
 * 世界坐标 (x, z) ↔ UV 通过 uWorldSize/uTexSize 统一映射。
 */
import * as THREE from 'three'
import { heightAt } from '../utils/terrain'
import { WORLD_SIZE, HEIGHT_TEX_SIZE } from '../config/constants'

let cachedTexture: THREE.DataTexture | null = null

/** 生成（或返回缓存的）地形高度 DataTexture。
 *  使用 RedFormat + HalfFloat 节省带宽且精度足够。 */
export function getHeightFieldTexture(): THREE.DataTexture {
  if (cachedTexture) return cachedTexture

  const size = HEIGHT_TEX_SIZE
  // half-float: 用 Float32Array 生成更简单，three 支持
  const data = new Float32Array(size * size)
  const half = WORLD_SIZE / 2

  for (let j = 0; j < size; j++) {
    for (let i = 0; i < size; i++) {
      // UV (i/size, j/size) → 世界坐标
      // 约定：UV.x → x, UV.y → z（与地形 PlaneGeometry 旋转后一致）
      const u = i / (size - 1)
      const v = j / (size - 1)
      const x = (u - 0.5) * WORLD_SIZE
      const z = (v - 0.5) * WORLD_SIZE
      data[j * size + i] = heightAt(x, z)
    }
  }

  const tex = new THREE.DataTexture(
    data,
    size,
    size,
    THREE.RedFormat,
    THREE.FloatType,
  )
  tex.minFilter = THREE.LinearFilter
  tex.magFilter = THREE.LinearFilter
  tex.wrapS = THREE.ClampToEdgeWrapping
  tex.wrapT = THREE.ClampToEdgeWrapping
  tex.needsUpdate = true

  cachedTexture = tex
  return tex
}

/** 世界坐标 → 高度纹理 UV */
export function worldToHeightUV(x: number, z: number): [number, number] {
  return [(x / WORLD_SIZE) + 0.5, (z / WORLD_SIZE) + 0.5]
}
