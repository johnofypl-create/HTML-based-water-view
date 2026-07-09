/**
 * 顶点动画着色器注入
 * 为 InstancedMesh 的 MeshStandardMaterial 注入风摇摆：
 *  - 实例属性 aPhase（每实例随机相位）
 *  - uniform uTime / uWindDir / uWindStrength
 *  - 顶端顶点摇摆幅度大（按 position.y 归一化）
 *
 * 提供 makeSwayMaterial(base, opts) 返回注入后的材质 + uniforms 引用。
 */
import * as THREE from 'three'

export interface SwayUniforms {
  uTime: { value: number }
  uWindDir: { value: THREE.Vector2 }
  uWindStrength: { value: number }
}

export interface SwayOpts {
  /** 植被高度（用于归一化 position.y，顶端=1） */
  height: number
  /** 摇摆强度倍数 */
  strength: number
  /** 摇摆频率 */
  frequency: number
  /** 是否只摆顶端（草/花 true，树冠 false 用整体轻摆） */
  tipOnly: boolean
}

/** 创建带风摇摆的材质（基于 MeshStandardMaterial onBeforeCompile） */
export function makeSwayMaterial(
  base: THREE.MeshStandardMaterial,
  opts: SwayOpts,
): { material: THREE.MeshStandardMaterial; uniforms: SwayUniforms } {
  const uniforms: SwayUniforms = {
    uTime: { value: 0 },
    uWindDir: { value: new THREE.Vector2(0.7, 0.3).normalize() },
    uWindStrength: { value: 1.0 },
  }

  base.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms)

    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
         attribute float aPhase;
         uniform float uTime;
         uniform vec2 uWindDir;
         uniform float uWindStrength;`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
         {
           // 顶端归一化高度（0 基部 → 1 顶端）
           float tipFactor = clamp(position.y / ${opts.height.toFixed(3)}, 0.0, 1.0);
           float bendWeight = ${opts.tipOnly ? 'pow(tipFactor, 1.6)' : 'tipFactor * 0.5'};
           // 主摇摆
           float sway = sin(uTime * ${opts.frequency.toFixed(2)} + aPhase * 6.2831);
           // 高频细颤
           float flutter = sin(uTime * ${(opts.frequency * 2.4).toFixed(2)} + aPhase * 12.0) * 0.3;
           float wind = (sway + flutter) * bendWeight * uWindStrength * ${opts.strength.toFixed(3)};
           transformed.x += uWindDir.x * wind;
           transformed.z += uWindDir.y * wind;
           // 轻微垂直弯曲（风压弯）
           transformed.y -= abs(wind) * 0.15 * bendWeight;
         }
        `,
      )
  }

  base.customProgramCacheKey = () => `sway-${opts.height}-${opts.tipOnly}`
  return { material: base, uniforms }
}
