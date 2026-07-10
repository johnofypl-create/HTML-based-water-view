/**
 * @module water/physics/waterField
 * @layer water（域层）
 * @purpose 物理水 GPU 求解器（Virtual Pipes，GPUComputationRenderer ping-pong，P1 实时灌水）
 * @dependsOn ['three', 'three/examples/jsm/misc/GPUComputationRenderer.js', 'water/surface/heightField', 'config/constants']
 * @exports [createWaterField, WaterField]
 * @aiEdit
 *   - 调稳定性 → 改 config/world 的 SIM_K / SIM_DT / SIM_OUT_BUFFER（与 CPU 参考求解器一致）
 *   - 调分辨率 → 改 WATER_SIM_SIZE；接入地形编辑 → 调 pour()
 */
/**
 * 物理水 GPU 求解器（Virtual Pipes 方法 — GPU 实时版，P1）
 * =====================================================================
 * 把 ./shallowWater.ts 的 CPU 参考求解器移植到 GPUComputationRenderer：
 *   - 两张 ping-pong 浮点纹理：hVar(水深 h，存 .r) 与 fluxVar(四向流出 R/U/L/D)。
 *   - flux 着色器：读 h 与地形纹理，算四向期望流出并钳制（防数值爆炸）。
 *   - h 着色器：用邻居的"指向自身的流出"累加进水，更新 h；海源格钉 seaLevel（无限水库）。
 *   - 海源：地形 T < seaLevel 的格每步把 h 钉成 seaLevel - T，等价于无限水库，
 *     开海才能向洼地灌水（与 CPU 参考语义一致）。
 *
 * 数值稳定性继承自 CPU 参考（scripts/verify-shallow-water.ts 已证收敛）：
 *   K*dt 远小于 1、四向流出钳制 ≤ h*outBuffer。dt 固定不喂真实 delta，避免帧率抖动击穿。
 *
 * 对外接口：
 *   compute(delta)      每帧推进（内部跑 SIM_SUBSTEPS 趟）
 *   getHTexture()       取当前水深纹理（供水着色器采样做位移/遮罩/深度色）
 *   pour(x,z,amt,r)    往世界坐标 (x,z) 灌入 amt 水深、半径 r（地形改造 / 飞溅注入接口）
 *   dispose()           释放 GPU 资源
 */
import * as THREE from 'three'
import { GPUComputationRenderer } from 'three/examples/jsm/misc/GPUComputationRenderer.js'
import { getHeightFieldTexture, worldToHeightUV } from '../surface/heightField'
import {
  WORLD_SIZE,
  SEA_LEVEL,
  WATER_SIM_SIZE,
  SIM_K,
  SIM_DT,
  SIM_SUBSTEPS,
  SIM_OUT_BUFFER,
} from '../../config/constants'

/** flux 着色器：算四向期望流出（正数=自身向该方向流出），并钳制到 ≤ h*outBuffer */
const fluxShader = /* glsl */ `
  uniform sampler2D uTerrain;
  uniform float uSeaLevel, uK, uDt, uOutBuffer, uTexel;

  void main() {
    vec2 uv = gl_FragCoord.xy / resolution.xy;
    float h = texture2D(hVar, uv).r;
    float T = texture2D(uTerrain, uv).r;
    float S = T + h;

    float outR = 0.0, outU = 0.0, outL = 0.0, outD = 0.0;

    // 右 (+x)
    if (uv.x + uTexel < 1.0) {
      vec2 nuv = uv + vec2(uTexel, 0.0);
      float Sn = texture2D(uTerrain, nuv).r + texture2D(hVar, nuv).r;
      float f = uK * (S - Sn) * uDt;
      if (f > 0.0) outR = f;
    }
    // 上 (+y / +z)
    if (uv.y + uTexel < 1.0) {
      vec2 nuv = uv + vec2(0.0, uTexel);
      float Sn = texture2D(uTerrain, nuv).r + texture2D(hVar, nuv).r;
      float f = uK * (S - Sn) * uDt;
      if (f > 0.0) outU = f;
    }
    // 左 (-x)
    if (uv.x - uTexel > 0.0) {
      vec2 nuv = uv - vec2(uTexel, 0.0);
      float Sn = texture2D(uTerrain, nuv).r + texture2D(hVar, nuv).r;
      float f = uK * (S - Sn) * uDt;
      if (f > 0.0) outL = f;
    }
    // 下 (-y)
    if (uv.y - uTexel > 0.0) {
      vec2 nuv = uv - vec2(0.0, uTexel);
      float Sn = texture2D(uTerrain, nuv).r + texture2D(hVar, nuv).r;
      float f = uK * (S - Sn) * uDt;
      if (f > 0.0) outD = f;
    }

    // 钳制每格四向流出总和 ≤ h*outBuffer（防负水深爆炸的命门）
    float sum = outR + outU + outL + outD;
    if (sum > h * uOutBuffer && sum > 0.0) {
      float sc = (h * uOutBuffer) / sum;
      outR *= sc; outU *= sc; outL *= sc; outD *= sc;
    }
    gl_FragColor = vec4(outR, outU, outL, outD);
  }
`

/** h 着色器：施加流量（邻居指向自身的流出=进水），更新 h；海源钉 seaLevel；支持 pour 注入 */
const hShader = /* glsl */ `
  uniform sampler2D uTerrain;
  uniform float uSeaLevel, uTexel, uWorldSize;
  uniform vec4 uPour; // xy=世界 uv，z=半径(uv 单位)，w=注入量

  void main() {
    vec2 uv = gl_FragCoord.xy / resolution.xy;
    float h = texture2D(hVar, uv).r;
    float T = texture2D(uTerrain, uv).r;

    vec4 selfFlux = texture2D(fluxVar, uv); // r=outR g=outU b=outL a=outD
    float outSum = selfFlux.r + selfFlux.g + selfFlux.b + selfFlux.a;

    // 邻居"指向自身"的流出 = 自身的进水
    float inR = (uv.x + uTexel < 1.0) ? texture2D(fluxVar, uv + vec2(uTexel, 0.0)).b : 0.0;
    float inU = (uv.y + uTexel < 1.0) ? texture2D(fluxVar, uv + vec2(0.0, uTexel)).a : 0.0;
    float inL = (uv.x - uTexel > 0.0) ? texture2D(fluxVar, uv - vec2(uTexel, 0.0)).r : 0.0;
    float inD = (uv.y - uTexel > 0.0) ? texture2D(fluxVar, uv - vec2(0.0, uTexel)).g : 0.0;

    float hNew = h - outSum + inR + inU + inL + inD;

    // 海源：钉在 seaLevel（无限水库，可灌出可吸收回流）
    if (T < uSeaLevel) {
      float want = uSeaLevel - T;
      hNew = want > 0.0 ? want : 0.0;
    }

    // 灌水接口（地形改造 / 飞溅注入）：以 uv 为中心的高斯-平滑凹陷注入
    if (uPour.w > 0.0) {
      float d = distance(uv, uPour.xy);
      hNew += uPour.w * smoothstep(uPour.z, 0.0, d);
    }

    gl_FragColor = vec4(max(hNew, 0.0), 0.0, 0.0, 1.0);
  }
`

export interface WaterField {
  /** 每帧推进模拟（内部跑 SIM_SUBSTEPS 趟） */
  compute: (delta: number) => void
  /** 取当前水深纹理（供水着色器采样做位移 / 遮罩 / 深度色） */
  getHTexture: () => THREE.Texture
  /** 往世界坐标 (x,z) 灌入 amt 水深，半径 r（世界单位） */
  pour: (x: number, z: number, amount: number, radius?: number) => void
  /** 释放 GPU 资源 */
  dispose: () => void
}

/**
 * 创建并初始化 GPU 物理水场。
 * @param gl 渲染器（GPUComputationRenderer 需要在其上建 ping-pong 目标）
 */
export function createWaterField(gl: THREE.WebGLRenderer): WaterField {
  const size = WATER_SIM_SIZE
  const gpu = new GPUComputationRenderer(size, size, gl)

  const hTex = gpu.createTexture()
  const fluxTex = gpu.createTexture()
  // createTexture 返回零填充纹理：初始 h=0、flux=0（海源会在首步被钉成 seaLevel）

  const hVar = gpu.addVariable('hVar', hShader, hTex)
  const fluxVar = gpu.addVariable('fluxVar', fluxShader, fluxTex)
  gpu.setVariableDependencies(hVar, [hVar, fluxVar])
  gpu.setVariableDependencies(fluxVar, [hVar, fluxVar])

  const terrainTex = getHeightFieldTexture()
  const common = {
    uTerrain: { value: terrainTex },
    uSeaLevel: { value: SEA_LEVEL },
    uWorldSize: { value: WORLD_SIZE },
    uTexel: { value: 1.0 / size },
    uK: { value: SIM_K },
    uDt: { value: SIM_DT },
    uOutBuffer: { value: SIM_OUT_BUFFER },
  }
  Object.assign(hVar.material.uniforms, common, {
    uPour: { value: new THREE.Vector4(0, 0, 0, 0) },
  })
  Object.assign(fluxVar.material.uniforms, common)

  const err = gpu.init()
  if (err) console.error('[waterField] GPUComputationRenderer init error:', err)

  return {
    compute() {
      for (let i = 0; i < SIM_SUBSTEPS; i++) gpu.compute()
    },
    getHTexture() {
      return gpu.getCurrentRenderTarget(hVar).texture
    },
    pour(x, z, amount, radius = 3) {
      const [u, v] = worldToHeightUV(x, z)
      ;(hVar.material.uniforms.uPour.value as THREE.Vector4).set(u, v, radius / WORLD_SIZE, amount)
    },
    dispose() {
      gpu.dispose()
    },
  }
}
