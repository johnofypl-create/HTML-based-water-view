/**
 * @module water/foam/sprayShader
 * @layer water（域层）
 * @purpose 飞溅粒子 TSL 函数（弹道积分 + 软圆点 + 调色板）—— WebGPU 版
 * @dependsOn []
 * @exports [sprayBallisticFn, sprayColorFn, sprayAlphaFn]
 * @aiEdit
 *   - 调粒子尺寸/颜色/衰减 → 改本文件函数体
 */
/**
 * 飞溅粒子 TSL 节点函数
 *
 * 原实现基于 GLSL 字符串（sprayVertexShader / sprayFragmentShader）；
 * WebGPU 下 gl_PointSize 不支持 → 改为 InstancedMesh + billboard 四边形
 * 方案，本文件提供 positionNode / colorNode / opacityNode 的逻辑函数。
 *
 * 注意：这些是 TSL Fn 节点构建函数，返回的节点在着色器中执行。
 * 调用者在 Fn 内部调用它们（自动内联到调用者 Fn 的图）。
 */
import * as TSL from 'three/tsl'

const { Fn, float, vec3, sin, cos, sqrt, clamp, smoothstep, mix, length, dot, cross, normalize } = TSL as any

// ---- 弹道 + billboard：世界空间粒子中心 + 四边形偏移 ----
// 返回 { center: vec3 (世界空间粒子中心), offset: vec3 (世界空间 billboard 偏移) }
export const sprayBallistic = Fn(
  ([spawnPos, vel, spawnTime, life, seed, t, gravity, size, camPos]: any) => {
    // ---- 弹道 ----
    const age = t.sub(spawnTime)
    const lifeT = age.div(life)
    const gravVec = vec3(0.0, gravity, 0.0)

    // 中心 = spawnPos + vel * age + 0.5 * gravity * age²
    const center = spawnPos.add(vel.mul(age)).add(gravVec.mul(age).mul(age).mul(0.5))

    // ---- billboard（从 positionLocal 计算朝向） ----
    const toCam = normalize(camPos.sub(center))
    const worldRight = normalize(cross(vec3(0.0, 1.0, 0.0), toCam))
    const worldUp = normalize(cross(toCam, worldRight))

    // 尺寸：基础 × (1 - 0.7 * lifeT) 衰减
    const s = size.mul(float(1.0).sub(lifeT.mul(0.7)))

    // 四边形偏移（positionLocal.x 和 .y 将在调用者 Fn 中提供）
    // 返回 worldUp * pY + worldRight * pX，调用者乘以 s
    return { center, worldRight, worldUp, scale: s, lifeT, age }
  },
)

// ---- 软圆点颜色（中心辉光） ----
// pXY: vec2（四边形顶点坐标，范围 [-0.5, 0.5]）
// foamCol: vec3 基础色
export const sprayColor = Fn(([pXY, foamCol]: any) => {
  const d = length(pXY)
  // 中心更亮模拟水珠高光
  return mix(foamCol, vec3(1.0, 1.0, 1.0), clamp(float(1.0).sub(d.mul(2.0)), 0.0, 1.0).mul(0.45))
})

// ---- 软圆点 alpha + 淡入淡出 ----
// pXY: vec2, lifeT: float, age: float, opacity: float
export const sprayAlpha = Fn(([pXY, lifeT, age, opacity]: any) => {
  const d = length(pXY)
  // 圆盘衰减
  const circleAlpha = float(1.0).sub(smoothstep(0.12, 0.5, d))

  // 淡入（前 8%）+ 淡出
  const fadeIn = smoothstep(0.0, 0.08, lifeT)
  const fadeOut = float(1.0).sub(lifeT)
  const lifeFade = fadeOut.mul(fadeIn)

  return lifeFade.mul(circleAlpha).mul(opacity).clamp(0.0, 1.0)
})
