/**
 * @module water/gerstner.glsl
 * @layer water（域层）
 * @purpose Gerstner 波 GLSL 生成（与 gerstner.ts 同源，供顶点位移）
 * @dependsOn ['water/gerstner']
 * @exports [GERSTNER_GLSL]
 * @aiEdit
 *   - 调波形/风向 → 改本文件（与 gerstner.ts 同源）；数值改动属算法层，本次重构不动
 */
/**
 * 由 GERSTNER_WAVES（单一事实源）「生成」的 GLSL 函数字符串。
 *
 * 导出 GERSTNER_GLSL，内含：
 *   vec3 gerstnerSolve(vec2 p, float t, out vec3 nrm, out float jac)
 * 返回水面位移 (dispX, dispY, dispZ)，并输出解析法线 nrm 与雅可比 jac。
 *
 * 波参数在此被内联为数值常量（编译期展开，无 uniform 数组、无循环开销），
 * 且与 gerstner.ts 的 sampleGerstner 使用同一份 GERSTNER_WAVES → 永不漂移。
 */
import { GERSTNER_WAVES } from './gerstner'

/** 把 JS number 格式化为带小数点的 GLSL float 字面量 */
function glf(n: number): string {
  let s = n.toPrecision(8)
  // 去掉多余尾零但保留小数点
  if (s.indexOf('e') === -1 && s.indexOf('E') === -1) {
    if (s.indexOf('.') === -1) s += '.0'
  }
  return s
}

function buildGerstnerGLSL(): string {
  let lines = ''
  GERSTNER_WAVES.forEach((w, i) => {
    const dx = glf(w.dirX)
    const dz = glf(w.dirZ)
    const freq = glf(w.freq)
    const speed = glf(w.speed)
    const amp = glf(w.amp)
    const steep = glf(w.steep)
    lines += `
    // wave ${i}
    {
      float ph = (${dx} * p.x + ${dz} * p.y) * ${freq} + t * ${speed};
      float s = sin(ph);
      float c = cos(ph);
      dispX += ${steep} * ${amp} * ${dx} * c;
      dispZ += ${steep} * ${amp} * ${dz} * c;
      dispY += ${amp} * s;
      float waK = ${freq} * ${amp};
      nx -= ${dx} * waK * c;
      nz -= ${dz} * waK * c;
      ny -= ${steep} * waK * s;
      float qaf = ${steep} * ${amp} * ${freq};
      Jxx -= qaf * ${dx} * ${dx} * s;
      Jzz -= qaf * ${dz} * ${dz} * s;
      Jxz -= qaf * ${dx} * ${dz} * s;
    }`
  })

  return /* glsl */ `
vec3 gerstnerSolve(vec2 p, float t, out vec3 nrm, out float jac) {
  float dispX = 0.0;
  float dispY = 0.0;
  float dispZ = 0.0;
  float nx = 0.0;
  float ny = 1.0;
  float nz = 0.0;
  float Jxx = 1.0;
  float Jzz = 1.0;
  float Jxz = 0.0;
${lines}
  nrm = normalize(vec3(nx, ny, nz));
  jac = Jxx * Jzz - Jxz * Jxz;
  return vec3(dispX, dispY, dispZ);
}
`
}

export const GERSTNER_GLSL = buildGerstnerGLSL()
