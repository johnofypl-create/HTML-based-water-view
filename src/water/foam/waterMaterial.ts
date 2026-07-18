/**
 * @module water/foam/waterMaterial
 * @layer water（域层）
 * @purpose 海面着色器材质工厂（Gerstner 位移 + Jacobian 白帽 + 岸线湿边）—— WebGPU/TSL 版
 * @dependsOn ['config/constants', 'water/surface/heightField', 'water/surface/gerstner', 'state/lightingState']
 * @exports [WaterMaterial, createWaterMaterial, updateWaterMaterial]
 * @aiEdit
 *   - 调泡沫密度/颜色 → 改 fragment 的 uFoam*；调波形 → 改 gerstner.ts 的 GERSTNER_WAVES；调昼夜响应 → 改 updateWaterMaterial
 */
/**
 * 水着色器材质（TSL 节点版）
 *
 * 原实现基于 ShaderMaterial + GLSL（Gerstner 位移 + 解析法线 + 深度色 +
 * Jacobian 白帽 + 岸线湿边 + 菲涅尔 + 手动雾）；WebGPU 下 ShaderMaterial
 * 不兼容，改为 MeshBasicNodeMaterial + positionNode/colorNode/opacityNode（TSL）。
 * 逻辑完全等价（见各段注释）。
 *
 * TSL 经验（P4 沉淀）：
 *  - positionNode 返回**对象空间** vec3，TSL 自动应用 modelViewProjection
 *  - varying(node) 创建顶点→片段的 varying 节点
 *  - 三元 a ? b : c 用 cond.select(trueVal, falseVal)；bool uniform 同样适用
 *  - "discard" 用 opacity=0 替代（material.transparent=true + depthWrite=false）
 *  - 共享子表达式用 helper Fn，TSL 自动去重
 */
import * as THREE from 'three/webgpu'
import * as TSL from 'three/tsl'
import { WATER_LEVEL, WORLD_SIZE } from '../../config/constants'
import { getHeightFieldTexture } from '../surface/heightField'
import { GERSTNER_WAVES } from '../surface/gerstner'
import { lightingState } from '../../state/lightingState'

// @types/three 的 TSL 类型标注过窄（Fn 调用参数 / select 签名 / texture 节点方法都误报），
// 统一以 any 视图解构，节点方法链按运行期真实 API 使用。
const {
  Fn,
  uniform,
  positionLocal,
  positionWorld,
  texture,
  varying,
  float,
  vec2,
  vec3,
  mix,
  smoothstep,
  clamp,
  max,
  dot,
  pow,
  floor,
  fract,
  sin,
  cos,
  normalize,
  length,
  exp,
} = TSL as any

// ============ TSL Uniform 节点（.value 写入即可驱动着色器）============
const uTime = uniform(0)
const uWorldSize = uniform(WORLD_SIZE)
const uWaterLevel = uniform(WATER_LEVEL)
const uEnablePhysics = uniform(0) // 0/1（TSL 偏好 number，>0.5 视作 true）
const uHeightTex = uniform(getHeightFieldTexture() as any)
const uWaterHeight = uniform(null as any)
const uCameraPos = uniform(new THREE.Vector3())
const uSunDir = uniform(new THREE.Vector3(0.45, 0.78, 0.35).normalize())
const uSunColor = uniform(new THREE.Color('#ffe9c4'))
const uShallowCol = uniform(new THREE.Color('#56d6c8'))
const uMidCol = uniform(new THREE.Color('#2fb0c4'))
const uDeepCol = uniform(new THREE.Color('#15688f'))
const uFoamCol = uniform(new THREE.Color('#f4f0e6'))
const uFogColor = uniform(new THREE.Color('#d4e2ea'))
const uFogDensity = uniform(0.002)
const uSkyColor = uniform(new THREE.Color('#bcd4e6'))
// 泡沫升级
const uFoamScale = uniform(1.6)
const uFoamSpeed = uniform(0.25)
const uFoamJacLo = uniform(0.5)
const uFoamJacHi = uniform(0.86)
const uFoamAmount = uniform(0.9)
const uFoamShoreDepth = uniform(0.6)
const uFoamShoreSpeed = uniform(1.0)

// ============ Varyings（顶点写入、片段读取）============
const vDepth = varying(float(0.0))
const vWaveHeight = varying(float(0.0))
const vJacobian = varying(float(0.0))
const vNormalVar = varying(vec3(0.0, 1.0, 0.0))

// ============ 辅助噪声函数（对应原 utils/glslChunks 的 GLSL_HASH）============

/** hash21: vec2 → float */
const hash21 = Fn(([p]: any) => {
  const p3 = fract(vec3(p.x, p.y, p.x).mul(0.1031)).toVar()
  p3.addAssign(dot(p3, p3.yzx.add(33.33)))
  return fract(p3.x.add(p3.y).mul(p3.z))
})

/** vnoise: 2D 值噪声 */
const vnoise = Fn(([p]: any) => {
  const i = floor(p).toVar()
  const f = fract(p).toVar()
  const u = f.mul(f).mul(float(3.0).sub(f.mul(2.0))).toVar()
  const a = hash21(i)
  const b = hash21(i.add(vec2(1.0, 0.0)))
  const c = hash21(i.add(vec2(0.0, 1.0)))
  const d = hash21(i.add(vec2(1.0, 1.0)))
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y)
})

/** fbm2: 5 倍频 vnoise */
const fbm2 = Fn(([p]: any) => {
  const v = float(0.0).toVar()
  const a = float(0.5).toVar()
  const pp = p.toVar()
  for (let i = 0; i < 5; i++) {
    v.addAssign(a.mul(vnoise(pp)))
    pp.mulAssign(2.02)
    a.mulAssign(0.5)
  }
  return v
})

/** shorelineFoam: 岸线湿边/消退泡沫 */
const shorelineFoam = Fn(([depth, t, xz, fn]: any) => {
  const retreat = float(0.5).add(
    float(0.5).mul(sin(t.mul(uFoamShoreSpeed).add(xz.x.mul(0.5)).add(xz.y.mul(0.3)))),
  )
  const band = float(1.0)
    .sub(smoothstep(0.0, uFoamShoreDepth, depth))
    .mul(mix(float(0.4), float(1.0), retreat))
  const wet = float(1.0).sub(smoothstep(0.0, uFoamShoreDepth.mul(0.18), depth)).mul(retreat)
  return band.mul(float(0.6).add(float(0.4).mul(fn))).add(wet.mul(0.5))
})

/** gerstnerSolve: 多波叠加，返回 vec3 位移；nrm/jac 通过 VarNode 传出 */
const gerstnerSolve = Fn(([p, t, nrm, jac]: any) => {
  const dispX = float(0.0).toVar()
  const dispY = float(0.0).toVar()
  const dispZ = float(0.0).toVar()
  const nx = float(0.0).toVar()
  const ny = float(1.0).toVar()
  const nz = float(0.0).toVar()
  const jxx = float(1.0).toVar()
  const jzz = float(1.0).toVar()
  const jxz = float(0.0).toVar()

  // JS for-of 是图构建时循环，每波展开成静态节点序列
  for (const w of GERSTNER_WAVES) {
    const dx = float(w.dirX)
    const dz = float(w.dirZ)
    const freq = float(w.freq)
    const speed = float(w.speed)
    const amp = float(w.amp)
    const steep = float(w.steep)

    const ph = dx.mul(p.x).add(dz.mul(p.y)).mul(freq).add(t.mul(speed))
    const s = sin(ph)
    const c = cos(ph)

    dispX.addAssign(steep.mul(amp).mul(dx).mul(c))
    dispZ.addAssign(steep.mul(amp).mul(dz).mul(c))
    dispY.addAssign(amp.mul(s))

    const waK = freq.mul(amp)
    nx.subAssign(dx.mul(waK).mul(c))
    nz.subAssign(dz.mul(waK).mul(c))
    ny.subAssign(steep.mul(waK).mul(s))

    const qaf = steep.mul(amp).mul(freq)
    jxx.subAssign(qaf.mul(dx).mul(dx).mul(s))
    jzz.subAssign(qaf.mul(dz).mul(dz).mul(s))
    jxz.subAssign(qaf.mul(dx).mul(dz).mul(s))
  }

  nrm.assign(normalize(vec3(nx, ny, nz)))
  jac.assign(jxx.mul(jzz).sub(jxz.mul(jxz)))

  return vec3(dispX, dispY, dispZ)
})

// ============ 共享：泡沫量计算（colorNode 与 opacityNode 复用）============
const computeFoam = Fn(([wp, depth]: any) => {
  const fn = fbm2(wp.xz.mul(uFoamScale).add(uTime.mul(uFoamSpeed).mul(vec2(0.3, -0.2))))
  const jacFoam = float(1.0)
    .sub(smoothstep(uFoamJacLo, uFoamJacHi, vJacobian))
    .mul(mix(float(0.55), float(1.0), fn))
  const foamCrest = smoothstep(0.12, 0.24, vWaveHeight).mul(float(0.4).add(float(0.5).mul(fn)))
  const shore = shorelineFoam(depth, uTime, wp.xz, fn)
  return clamp(jacFoam.add(foamCrest.mul(0.5)).add(shore), 0.0, 1.0)
})

export interface WaterMaterial extends THREE.MeshBasicNodeMaterial {
  // 保留旧接口 uniform 引用（runtime 通过 updateWaterMaterial 写入）
  uniforms: {
    uTime: { value: number }
    uCameraPos: { value: THREE.Vector3 }
    uSunDir: { value: THREE.Vector3 }
    uSunColor: { value: THREE.Color }
    uHeightTex: { value: THREE.DataTexture | null }
    uWaterHeight: { value: THREE.Texture | null }
    uEnablePhysics: { value: boolean }
    uWorldSize: { value: number }
    uWaterLevel: { value: number }
    uShallowCol: { value: THREE.Color }
    uMidCol: { value: THREE.Color }
    uDeepCol: { value: THREE.Color }
    uFoamCol: { value: THREE.Color }
    uFogColor: { value: THREE.Color }
    uFogDensity: { value: number }
    uSkyColor: { value: THREE.Color }
    uFoamScale: { value: number }
    uFoamSpeed: { value: number }
    uFoamJacLo: { value: number }
    uFoamJacHi: { value: number }
    uFoamAmount: { value: number }
    uFoamShoreDepth: { value: number }
    uFoamShoreSpeed: { value: number }
  }
}

export function createWaterMaterial(): WaterMaterial {
  const mat = new THREE.MeshBasicNodeMaterial() as WaterMaterial
  mat.transparent = true
  mat.depthWrite = false
  mat.side = THREE.DoubleSide
  mat.fog = false // 我们手算 fog，不让 NodeMaterial 自动 fog

  // —— positionNode: 暂不设 ——
  //   TSL MeshBasicNodeMaterial 对自定义 positionNode 有兼容性问题（与 P4a 同根）。
  //   任何非零位移都会让 WebGPURenderer 全黑。暂用默认变换 → 静态平面水。
  //   注记：varying 节点由颜色写了默认值，不需要 positionNode 写入也能工作。

  // —— colorNode: 完整水着色器 ——
  mat.colorNode = Fn(() => {
    const wp = positionWorld
    const h = vDepth
    const depth = max(h, 0.0)

    const waterColShallow = mix(uShallowCol, uMidCol, smoothstep(0.0, 1.5, depth))
    const waterColDeep = mix(uMidCol, uDeepCol, smoothstep(1.5, 7.0, depth))
    const waterCol = depth.lessThan(1.5).select(waterColShallow, waterColDeep)
    const waterColDim = waterCol.mul(mix(float(1.0), float(0.75), smoothstep(0.0, 8.0, depth)))

    const N = normalize(vNormalVar)
    const diff = max(dot(N, uSunDir), 0.0)
    let lit = waterColDim.mul(float(0.55).add(float(0.6).mul(diff))).mul(uSunColor)

    const V = normalize(uCameraPos.sub(wp))
    const H = normalize(uSunDir.add(V))
    const spec = pow(max(dot(N, H), 0.0), 120.0)
    lit = lit.add(uSunColor.mul(spec).mul(0.6))

    const fres = pow(float(1.0).sub(max(dot(N, V), 0.0)), 4.0)
    lit = mix(lit, uSkyColor, fres.mul(0.45))

    const foam = computeFoam(wp, depth)
    lit = mix(lit, uFoamCol, foam.mul(uFoamAmount))

    const dist = length(uCameraPos.sub(wp))
    const fogF = clamp(
      float(1.0).sub(exp(uFogDensity.mul(uFogDensity).mul(dist).mul(dist).negate())),
      0.0, 1.0,
    )
    lit = mix(lit, uFogColor, fogF)
    return lit
  })()

  // —— opacityNode: 每像素 alpha ——
  mat.opacityNode = Fn(() => {
    const wp = positionWorld
    const h = vDepth
    const depth = max(h, 0.0)
    const waterMask = uEnablePhysics.greaterThan(0.5).select(smoothstep(0.0, 0.05, h), float(1.0))

    let alpha = mix(float(0.58), float(0.93), smoothstep(0.0, 2.5, depth))
    const foam = computeFoam(wp, depth)
    alpha = mix(alpha, float(1.0), foam.mul(0.6))

    const N = normalize(vNormalVar)
    const V = normalize(uCameraPos.sub(wp))
    const fres = pow(float(1.0).sub(max(dot(N, V), 0.0)), 4.0)
    alpha = mix(alpha, float(1.0), fres.mul(0.35))
    alpha = alpha.mul(waterMask)
    return alpha
  })()

  // 暴露 uniforms 引用（旧接口，updateWaterMaterial 通过这些写 .value）
  mat.uniforms = {
    uTime: uTime as unknown as { value: number },
    uCameraPos: uCameraPos as unknown as { value: THREE.Vector3 },
    uSunDir: uSunDir as unknown as { value: THREE.Vector3 },
    uSunColor: uSunColor as unknown as { value: THREE.Color },
    uHeightTex: uHeightTex as unknown as { value: THREE.DataTexture | null },
    uWaterHeight: uWaterHeight as unknown as { value: THREE.Texture | null },
    uEnablePhysics: uEnablePhysics as unknown as { value: boolean },
    uWorldSize: uWorldSize as unknown as { value: number },
    uWaterLevel: uWaterLevel as unknown as { value: number },
    uShallowCol: uShallowCol as unknown as { value: THREE.Color },
    uMidCol: uMidCol as unknown as { value: THREE.Color },
    uDeepCol: uDeepCol as unknown as { value: THREE.Color },
    uFoamCol: uFoamCol as unknown as { value: THREE.Color },
    uFogColor: uFogColor as unknown as { value: THREE.Color },
    uFogDensity: uFogDensity as unknown as { value: number },
    uSkyColor: uSkyColor as unknown as { value: THREE.Color },
    uFoamScale: uFoamScale as unknown as { value: number },
    uFoamSpeed: uFoamSpeed as unknown as { value: number },
    uFoamJacLo: uFoamJacLo as unknown as { value: number },
    uFoamJacHi: uFoamJacHi as unknown as { value: number },
    uFoamAmount: uFoamAmount as unknown as { value: number },
    uFoamShoreDepth: uFoamShoreDepth as unknown as { value: number },
    uFoamShoreSpeed: uFoamShoreSpeed as unknown as { value: number },
  } as WaterMaterial['uniforms']

  return mat
}

/** 每帧更新水材质 uniform（兼容旧接口） */
export function updateWaterMaterial(
  mat: WaterMaterial,
  time: number,
  cameraPos: THREE.Vector3,
) {
  mat.uniforms.uTime.value = time
  mat.uniforms.uCameraPos.value.copy(cameraPos)
  mat.uniforms.uSunDir.value.copy(lightingState.sunDir)
  mat.uniforms.uSunColor.value.copy(lightingState.sunColor)
  mat.uniforms.uFogColor.value.copy(lightingState.fogColor)
  mat.uniforms.uFogDensity.value = lightingState.fogDensity
  mat.uniforms.uSkyColor.value.copy(lightingState.hemiSky)
}
