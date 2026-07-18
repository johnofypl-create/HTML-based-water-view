/**
 * @module water/surface/heightField
 * @layer water（域层）
 * @purpose 地形高度场 DataTexture 生成与 UV 映射（物理水/着色器采样用）
 * @dependsOn ['utils/terrain', 'config/constants']
 * @exports [getHeightFieldTexture, getHeightFieldArray, worldToHeightUV]
 * @aiEdit
 *   - 改本文件导出的三个函数即可；依赖见 @dependsOn
 */
/**
 * 地形高度场
 * 把 heightAt 烘焙成 DataTexture（供水着色器采样）和原始 Float32Array（供 TSL compute）。
 * 世界坐标 (x, z) ↔ UV 通过 uWorldSize/uTexSize 统一映射。
 */
import * as THREE from 'three/webgpu'
import { heightAt } from '../../utils/terrain'
import { WORLD_SIZE, HEIGHT_TEX_SIZE } from '../../config/constants'

let cachedTexture: THREE.DataTexture | null = null
let cachedArray: Float32Array | null = null

function buildData(): Float32Array {
  const size = HEIGHT_TEX_SIZE
  const data = new Float32Array(size * size)
  const half = WORLD_SIZE / 2
  for (let j = 0; j < size; j++) {
    for (let i = 0; i < size; i++) {
      const u = i / (size - 1)
      const v = j / (size - 1)
      const x = (u - 0.5) * WORLD_SIZE
      const z = (v - 0.5) * WORLD_SIZE
      data[j * size + i] = heightAt(x, z)
    }
  }
  return data
}

/** 生成（或返回缓存的）地形高度 DataTexture */
export function getHeightFieldTexture(): THREE.DataTexture {
  if (cachedTexture) return cachedTexture
  const data = buildData()
  cachedArray = data
  const tex = new THREE.DataTexture(
    data, HEIGHT_TEX_SIZE, HEIGHT_TEX_SIZE,
    THREE.RedFormat, THREE.FloatType,
  )
  tex.minFilter = THREE.LinearFilter
  tex.magFilter = THREE.LinearFilter
  tex.wrapS = THREE.ClampToEdgeWrapping
  tex.wrapT = THREE.ClampToEdgeWrapping
  tex.needsUpdate = true
  cachedTexture = tex
  return tex
}

/** 获取地形高度原始数组 → TSL compute storage buffer */
export function getHeightFieldArray(): Float32Array {
  if (cachedArray) return cachedArray
  getHeightFieldTexture() // 顺便缓存 array
  return cachedArray!
}

/** 世界坐标 → 高度纹理 UV */
export function worldToHeightUV(x: number, z: number): [number, number] {
  return [(x / WORLD_SIZE) + 0.5, (z / WORLD_SIZE) + 0.5]
}
