/**
 * 共享 GLSL 片段（字符串导出，便于在着色器中拼接复用）
 * 哈希噪声、值噪声、雾、缓动等。
 * 注意：这些是 GLSL 源码字符串，不是 TS。
 */

/** 通用 hash / 值噪声（GLSL），用于着色器内的细节变化 */
export const GLSL_HASH = /* glsl */ `
float hash11(float p) {
  p = fract(p * 0.1031);
  p *= p + 33.33;
  p *= p + p;
  return fract(p);
}

float hash21(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

vec2 hash22(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.xx + p3.yz) * p3.zy);
}

float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = hash21(i);
  float b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0));
  float d = hash21(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

float fbm2(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 5; i++) {
    v += a * vnoise(p);
    p *= 2.02;
    a *= 0.5;
  }
  return v;
}
`

/** 缓动 */
export const GLSL_EASING = /* glsl */ `
float easeInOut(float t) {
  return t * t * (3.0 - 2.0 * t);
}
`

/** 雾（指数，配合 FogExp2 的手动注入） */
export const GLSL_FOG = /* glsl */ `
uniform vec3 uFogColor;
uniform float uFogDensity;
float applyFog(float dist, vec3 color) {
  float f = 1.0 - exp(-uFogDensity * uFogDensity * dist * dist);
  f = clamp(f, 0.0, 1.0);
  return f;
}
`

/** 3D voronoi（用于水下焦散） */
export const GLSL_VORONOI = /* glsl */ `
vec3 voronoi3(vec3 x) {
  vec3 p = floor(x);
  vec3 f = fract(x);
  float id = 0.0;
  float md = 8.0;
  vec2 res = vec2(8.0, 8.0);
  for (int k = -1; k <= 1; k++)
  for (int j = -1; j <= 1; j++)
  for (int i = -1; i <= 1; i++) {
    vec3 b = vec3(float(i), float(j), float(k));
    vec3 r = b + 0.5 + 0.5 * sin(6.2831 * hash21((p + b).xy + 17.0 * (p + b).z));
    vec3 d = b - f + r;
    float dd = dot(d, d);
    if (dd < md) { md = dd; id = hash21((p + b).xy); }
  }
  return vec3(sqrt(md), id, res.x);
}
`
