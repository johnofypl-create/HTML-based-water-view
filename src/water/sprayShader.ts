/**
 * @module water/sprayShader
 * @layer water（域层）
 * @purpose 飞溅粒子顶点/片段着色器（弹道积分 + 软圆点）
 * @dependsOn []
 * @exports [sprayVertexShader, sprayFragmentShader]
 * @aiEdit
 *   - 改本文件导出的 sprayVertexShader、sprayFragmentShader 即可；依赖见 @dependsOn
 */
/**
 * 飞溅粒子 GLSL：顶点闭式弹道积分 + 软圆点 + 淡入淡出。
 * 无状态（粒子轨迹只依赖 {spawnPos, aVel, aSpawnTime, aLife, aSeed}）。
 *
 * 设计取舍（见计划 §3.1）：不采用 FBO ping-pong。
 * 粒子数 ≤ 4096，弹道是 `pos = p0 + v0·age + ½g·age²` 的闭式解，
 * 整条轨迹只依赖 spawn 时写入的属性，GPU 仅做「求值 + 淡出 + 软圆点」。
 */

export const sprayVertexShader = /* glsl */ `
  uniform float uTime;
  uniform float uGravity;
  uniform float uSize;
  uniform float uPixelRatio;

  attribute vec3 aVel;
  attribute float aSpawnTime;
  attribute float aLife;
  attribute float aSeed;

  varying float vAlpha;
  varying float vSeed;

  void main() {
    float age = uTime - aSpawnTime;
    // 未出生或已死亡：移出裁剪空间 + 零尺寸
    if (age < 0.0 || age > aLife) {
      gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
      gl_PointSize = 0.0;
      vAlpha = 0.0;
      vSeed = 0.0;
      return;
    }
    // 闭式弹道：仅依赖 spawn 时写入的常量属性，无逐帧积分
    vec3 p = position + aVel * age + 0.5 * vec3(0.0, uGravity, 0.0) * age * age;
    vec4 mv = viewMatrix * vec4(p, 1.0);
    float lifeT = age / aLife;
    // 尺寸：基础 × 寿命衰减 × 透视缩放
    gl_PointSize = uSize * uPixelRatio * (1.0 - lifeT * 0.7) * (40.0 / max(-mv.z, 0.1));
    // 淡入（前 8%） + 淡出
    vAlpha = (1.0 - lifeT) * smoothstep(0.0, 0.08, lifeT);
    vSeed = aSeed;
    gl_Position = projectionMatrix * mv;
  }
`

export const sprayFragmentShader = /* glsl */ `
  precision highp float;
  uniform vec3 uFoamCol;
  uniform float uOpacity;
  varying float vAlpha;
  varying float vSeed;

  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float d = length(c);
    if (d > 0.5) discard;
    float a = (1.0 - smoothstep(0.12, 0.5, d)) * vAlpha * uOpacity;
    // 中心更亮，模拟水珠高光 → 被 UnrealBloom 自然拾取发光
    vec3 col = mix(uFoamCol, vec3(1.0), (1.0 - d * 2.0) * 0.45);
    gl_FragColor = vec4(col, a);
  }
`
