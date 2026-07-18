/**
 * @module water/physics/waterField
 * @layer water（域层）
 * @purpose 物理水求解器（Virtual Pipes — Web Worker 版，P5B 主线程卸荷）
 * @dependsOn ['water/surface/heightField', 'config/constants']
 * @exports [createWaterField, WaterField]
 * @aiEdit
 *   - 调稳定性 → 改 config/world 的 SIM_K/SIM_DT/SIM_SUBSTEPS/SIM_OUT_BUFFER
 *   - 调分辨率 → 改 WATER_SIM_SIZE
 */
/**
 * 物理水求解器 — Web Worker 版
 *
 * P5A 用 CPU 主线程模拟 → P5B 改为 Web Worker 卸荷：
 *   Worker 线程运行 Virtual Pipes，每帧 postMessage 回传 h[] 到主线程，
 *   主线程写入 DataTexture → 无主线程计算阻塞 → 消除卡顿。
 */
import * as THREE from 'three/webgpu'
import { getHeightFieldArray } from '../surface/heightField'
import {
  WATER_SIM_SIZE,
  SEA_LEVEL,
  SIM_K,
  SIM_DT,
  SIM_SUBSTEPS,
  SIM_OUT_BUFFER,
} from '../../config/constants'

const SIZE = WATER_SIM_SIZE

export interface WaterField {
  compute: () => void
  getHTexture: () => THREE.Texture
  pour: (x: number, z: number, amount: number, radius?: number) => void
  dispose: () => void
}

export function createWaterField(): WaterField {
  // ===== 输出纹理（主线程写入）=====
  const hData = new Float32Array(SIZE * SIZE)
  const hTex = new THREE.DataTexture(hData, SIZE, SIZE, THREE.RedFormat, THREE.FloatType)
  hTex.minFilter = THREE.LinearFilter
  hTex.magFilter = THREE.LinearFilter
  hTex.wrapS = THREE.ClampToEdgeWrapping
  hTex.wrapT = THREE.ClampToEdgeWrapping
  hTex.needsUpdate = true

  // ===== Worker =====
  const worker = new Worker(new URL('./waterWorker.ts', import.meta.url), { type: 'module' })

  // 初始化：发送地形 + 参数
  const terrainArr = getHeightFieldArray()
  const terrainBuf = new Float32Array(terrainArr).buffer // transferable copy
  worker.postMessage(
    {
      cmd: 'init',
      terrain: terrainBuf,
      size: SIZE,
      seaLevel: SEA_LEVEL,
      k: SIM_K,
      dt: SIM_DT,
      substeps: SIM_SUBSTEPS,
      outBuffer: SIM_OUT_BUFFER,
    },
    [terrainBuf],
  )

  // 异步接收结果
  worker.onmessage = (e: MessageEvent) => {
    if (e.data.cmd === 'inited') {
      const resultH = new Float32Array(e.data.h)
      hData.set(resultH)
      hTex.needsUpdate = true
    }
    if (e.data.cmd === 'result') {
      const resultH = new Float32Array(e.data.h)
      hData.set(resultH)
      hTex.needsUpdate = true
    }
  }

  return {
    /** 触发 Worker 计算（异步，用户不等待） */
    compute() {
      worker.postMessage({ cmd: 'compute' })
    },

    getHTexture(): THREE.Texture {
      return hTex
    },

    pour(_x: number, _z: number, _amount: number, _radius?: number) {
      // TODO: 未来通过 worker 消息传递灌水事件
    },

    dispose() {
      worker.terminate()
      hTex.dispose()
    },
  }
}
