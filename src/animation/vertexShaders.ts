/**
 * @module animation/vertexShaders
 * @layer animation（域层）
 * @purpose 风摆顶点着色器材质工厂 —— WebGPU/TSL 版
 * @dependsOn []
 * @exports [SwayUniforms, SwayOpts, makeSwayMaterial]
 * @aiEdit
 *   - 改本文件导出的 SwayUniforms、SwayOpts、makeSwayMaterial 即可；依赖见 @dependsOn
 */
/**
 * 顶点动画（风摇摆）—— TSL 节点版
 *
 * 原实现基于 MeshStandardMaterial.onBeforeCompile 注入 GLSL；WebGPU 下
 * onBeforeCompile 不工作，改为 MeshStandardNodeMaterial + positionNode（TSL）。
 * 逻辑完全等价：
 *  - 实例属性 aPhase（每实例随机相位）
 *  - uniform uTime / uWindDir / uWindStrength
 *  - 顶端顶点摇摆幅度大（按 positionLocal.y 归一化 tipFactor）
 *
 * 关键点：返回的 uniforms.{uTime,uWindDir,uWindStrength} 直接就是 TSL uniform
 * 节点本身（UniformNode 带可读写 .value），故 InstancedFoliage 里的
 * `uniforms.uTime.value += delta` 能真正驱动着色器（不再是独立对象）。
 */
import * as THREE from 'three/webgpu'
import * as TSL from 'three/tsl'

// @types/three 的 TSL 节点类型标注过窄，统一以 any 视图解构。
const { Fn, attribute, positionLocal, uniform, pow, sin } = TSL as any

export interface SwayUniforms {
  uTime: { value: number }
  uWindDir: { value: THREE.Vector2 }
  uWindStrength: { value: number }
}

export interface SwayOpts {
  /** 植被高度（用于归一化 positionLocal.y，顶端=1） */
  height: number
  /** 摇摆强度倍数 */
  strength: number
  /** 摇摆频率 */
  frequency: number
  /** 是否只摆顶端（草/花 true，树冠 false 用整体轻摆） */
  tipOnly: boolean
}

/** 创建带风摇摆的材质（MeshStandardNodeMaterial + TSL positionNode） */
export function makeSwayMaterial(
  base: THREE.MeshStandardMaterial,
  opts: SwayOpts,
): { material: THREE.MeshStandardNodeMaterial; uniforms: SwayUniforms } {
  // TSL uniform 节点本身即带 .value 的对象，直接作为对外 uniforms（连通着色器）
  const uTime = uniform(0)
  const uWindDir = uniform(new THREE.Vector2(0.7, 0.3).normalize())
  const uWindStrength = uniform(1.0)

  // 用 NodeMaterial 接管（WebGPU 下标准材质的节点版），拷贝 base 的外观属性
  const mat = new THREE.MeshStandardNodeMaterial()
  mat.color = base.color
  mat.roughness = base.roughness
  mat.metalness = base.metalness
  mat.flatShading = base.flatShading
  mat.vertexColors = base.vertexColors
  mat.transparent = base.transparent
  mat.opacity = base.opacity
  mat.side = base.side
  mat.map = base.map
  mat.alphaTest = base.alphaTest
  mat.emissive = base.emissive
  mat.emissiveIntensity = base.emissiveIntensity

  mat.positionNode = Fn(() => {
    const pos = positionLocal.toVar()
    const aPhase = attribute('aPhase')

    // 顶端归一化高度（0 基部 → 1 顶端）
    const tipFactor = positionLocal.y.div(opts.height).clamp(0.0, 1.0)
    // 弯曲权重（草/花只摆顶端；树冠整体轻摆），不含 strength
    const bendWeight = (opts.tipOnly ? pow(tipFactor, 1.6) : tipFactor.mul(0.5)).toVar()

    // 主摇摆 + 高频细颤
    const sway = sin(uTime.mul(opts.frequency).add(aPhase.mul(6.2831)))
    const flutter = sin(uTime.mul(opts.frequency * 2.4).add(aPhase.mul(12.0))).mul(0.3)
    const wind = sway.add(flutter).mul(bendWeight).mul(uWindStrength).mul(opts.strength)

    pos.x.addAssign(uWindDir.x.mul(wind))
    pos.z.addAssign(uWindDir.y.mul(wind))
    // 轻微垂直弯曲（风压弯）
    pos.y.subAssign(wind.abs().mul(0.15).mul(bendWeight))

    return pos
  })()

  const uniforms: SwayUniforms = {
    uTime: uTime as unknown as { value: number },
    uWindDir: uWindDir as unknown as { value: THREE.Vector2 },
    uWindStrength: uWindStrength as unknown as { value: number },
  }

  return { material: mat, uniforms }
}
