/**
 * @module water/physics/waterField
 * @layer water（域层）
 * @purpose 物理水求解器（Virtual Pipes — CPU 版，P5 替换 GCR）
 * @dependsOn ['three/webgpu', 'water/surface/heightField', 'config/constants']
 * @exports [createWaterField, WaterField]
 * @aiEdit
 *   - 调稳定性 → 改 config/world 的 SIM_K/SIM_DT/SIM_SUBSTEPS/SIM_OUT_BUFFER
 *   - 调分辨率 → 改 WATER_SIM_SIZE
 */
/**
 * 物理水 GPU 求解器（Virtual Pipes — P5 CPU 版）
 *
 * 原实现基于 GPUComputationRenderer（WebGL-only，在 WebGPU 下崩溃）；
 * P5 改为**CPU Virtual Pipes 模拟**（128² 网格 ≈ 49K ops/帧，< 0.1ms），
 * 结果上传到 DataTexture 供水材质采样。
 *
 * 数值参数与 CPU 参考求解器一致（scripts/verify-shallow-water.ts 已验证收敛）。
 * 海源：地形 < seaLevel → 钉在 seaLevel - terrain（无限水库）。
 */
import * as THREE from 'three/webgpu'
import { getHeightFieldArray, worldToHeightUV } from '../surface/heightField'
import {
  WATER_SIM_SIZE,
  SEA_LEVEL,
  SIM_K,
  SIM_DT,
  SIM_SUBSTEPS,
  SIM_OUT_BUFFER,
  WORLD_SIZE,
} from '../../config/constants'

const SIZE = WATER_SIM_SIZE

export interface WaterField {
  compute: () => void
  getHTexture: () => THREE.Texture
  pour: (x: number, z: number, amount: number, radius?: number) => void
  dispose: () => void
}

export function createWaterField(): WaterField {
  // ========== 初始化数据 ==========
  const terrain = getHeightFieldArray()
  const h = new Float32Array(SIZE * SIZE)
  const flux = new Float32Array(SIZE * SIZE * 4) // R, U, L, D per cell
  const texel = 1.0 / SIZE

  // 海源初始化：地形 < seaLevel → h = max(seaLevel - terrain, 0)
  for (let i = 0; i < SIZE * SIZE; i++) {
    if (terrain[i] < SEA_LEVEL) {
      h[i] = SEA_LEVEL - terrain[i]
    }
  }

  // ========== 输出纹理 ==========
  const hTex = new THREE.DataTexture(h, SIZE, SIZE, THREE.RedFormat, THREE.FloatType)
  hTex.minFilter = THREE.LinearFilter
  hTex.magFilter = THREE.LinearFilter
  hTex.wrapS = THREE.ClampToEdgeWrapping
  hTex.wrapT = THREE.ClampToEdgeWrapping
  hTex.needsUpdate = true

  // 灌水缓冲区
  let pourPending = false
  let pourUVX = 0; let pourUVY = 0; let pourR = 0; let pourAmt = 0

  /** 单步 Virtual Pipes 求解（CPU — 简单高效） */
  function step() {
    // ---- Phase 1: Compute fluxes ----
    for (let i = 0; i < SIZE * SIZE; i++) {
      const y = (i / SIZE) | 0
      const x = i % SIZE
      const hi = h[i]
      const S = terrain[i] + hi

      // 右 (+x)
      let outR = 0
      if (x + 1 < SIZE) {
        const j = i + 1
        const Sn = terrain[j] + h[j]
        const f = SIM_K * (S - Sn) * SIM_DT
        if (f > 0) outR = f
      }
      // 上 (+z)
      let outU = 0
      if (y + 1 < SIZE) {
        const j = i + SIZE
        const Sn = terrain[j] + h[j]
        const f = SIM_K * (S - Sn) * SIM_DT
        if (f > 0) outU = f
      }
      // 左 (-x)
      let outL = 0
      if (x > 0) {
        const j = i - 1
        const Sn = terrain[j] + h[j]
        const f = SIM_K * (S - Sn) * SIM_DT
        if (f > 0) outL = f
      }
      // 下 (-z)
      let outD = 0
      if (y > 0) {
        const j = i - SIZE
        const Sn = terrain[j] + h[j]
        const f = SIM_K * (S - Sn) * SIM_DT
        if (f > 0) outD = f
      }

      // 钳制：四向流出总和 ≤ h * SIM_OUT_BUFFER
      const sum = outR + outU + outL + outD
      if (sum > hi * SIM_OUT_BUFFER && sum > 0) {
        const sc = (hi * SIM_OUT_BUFFER) / sum
        outR *= sc; outU *= sc; outL *= sc; outD *= sc
      }

      const fi = i * 4
      flux[fi] = outR
      flux[fi + 1] = outU
      flux[fi + 2] = outL
      flux[fi + 3] = outD
    }

    // ---- Phase 2: Update h ----
    for (let i = 0; i < SIZE * SIZE; i++) {
      const y = (i / SIZE) | 0
      const x = i % SIZE

      // Self outflow
      const fi = i * 4
      const outR = flux[fi]
      const outU = flux[fi + 1]
      const outL = flux[fi + 2]
      const outD = flux[fi + 3]
      const outSum = outR + outU + outL + outD

      // Neighbor flow INTO this cell
      let inR = 0, inU = 0, inL = 0, inD = 0
      if (x + 1 < SIZE) inL = flux[(i + 1) * 4 + 2] // right neighbor's left flow
      if (y + 1 < SIZE) inD = flux[(i + SIZE) * 4 + 3] // up neighbor's down flow
      if (x > 0) inR = flux[(i - 1) * 4] // left neighbor's right flow
      if (y > 0) inU = flux[(i - SIZE) * 4 + 1] // down neighbor's up flow

      let hNew = h[i] - outSum + inR + inU + inL + inD

      // 海源：地形低于海平面 → 钉住（无限水库）
      if (terrain[i] < SEA_LEVEL) {
        const want = SEA_LEVEL - terrain[i]
        hNew = want > 0 ? want : 0
      }

      // 灌水注入
      if (pourPending) {
        const ux = x / (SIZE - 1)
        const uy = y / (SIZE - 1)
        const dx = ux - pourUVX
        const dy = uy - pourUVY
        const d = Math.sqrt(dx * dx + dy * dy)
        if (d < pourR) {
          hNew += pourAmt * (1 - d / pourR)
        }
      }

      h[i] = Math.max(0, hNew)
    }

    // 灌水只执行一帧
    if (pourPending) {
      pourPending = false
    }
  }

  return {
    compute() {
      for (let s = 0; s < SIM_SUBSTEPS; s++) step()
      hTex.needsUpdate = true
    },

    getHTexture(): THREE.Texture {
      return hTex
    },

    pour(x, z, amount, radius = 3) {
      const [u, v] = worldToHeightUV(x, z)
      pourUVX = u
      pourUVY = v
      pourR = radius / WORLD_SIZE
      pourAmt = amount
      pourPending = true
    },

    dispose() {
      hTex.dispose()
    },
  }
}
