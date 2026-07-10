/**
 * 高度场浅水收敛验证（P0 原型）
 * 用 node --experimental-strip-types 运行：
 *   node --experimental-strip-types scripts/verify-shallow-water.ts
 *
 * 两个场景：
 *   Test 1 封闭盆地（无海）  —— 断言"质量守恒"与"自由面平息"
 *   Test 2 开海灌入洼地（用户核心场景） —— 断言"洼地进水"与"自由面趋平≈海平面"
 */
import {
  makeState,
  step,
  totalWater,
  maxSurfaceSlope,
  pour,
  type ShallowState,
} from '../src/water/shallowWater.ts'

const G = 64
// 显式稳定需要 K*dt ≪ 0.25（4 邻居），0.2 稳妥
const K = 0.2
const DT = 1.0

/**
 * 中央圆形洼地。rim = 洼地外地形高度。
 *   rim = 0    → 洼地外是干陆（Test 1 封闭用）
 *   rim = -0.5 → 洼地外低于海平面（Test 2 开海灌入用）
 */
function bowlTerrain(G: number, rim: number, depth = 4, r = 12): Float32Array {
  const t = new Float32Array(G * G)
  const c = (G - 1) / 2
  for (let z = 0; z < G; z++) {
    for (let x = 0; x < G; x++) {
      const d = Math.hypot(x - c, z - c)
      t[z * G + x] = d < r ? -depth * (1 - d / r) : rim
    }
  }
  return t
}

function report(name: string, ok: boolean, extra: string): void {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}  ${extra}`)
  if (!ok) process.exitCode = 1
}

// ===== Test 1：封闭盆地（无海）—— 质量守恒 + 表面平息 =====
{
  const s: ShallowState = makeState(G, bowlTerrain(G, 0))
  // 灌足量水（> 填满碗所需 ~603 单位） -> 表面应趋于平
  pour(s, 32, 32, 900)
  const m0 = totalWater(s)
  let steps = 0
  const maxSteps = 20000
  let lastSlope = 0
  while (steps < maxSteps && maxSurfaceSlope(s) > 0.01) {
    step(s, { dt: DT, conductivity: K })
    steps++
    if (steps % 4000 === 0) {
      lastSlope = maxSurfaceSlope(s)
      console.log(`   [diag] Test1 step=${steps} maxSlope=${lastSlope.toFixed(4)}`)
    }
  }
  lastSlope = maxSurfaceSlope(s)
  const m1 = totalWater(s)
  const massErr = Math.abs(m1 - m0) / m0
  report('封闭盆地-质量守恒', massErr < 1e-4,
    `massErr=${massErr.toExponential(2)} steps=${steps}`)
  report('封闭盆地-表面平息', lastSlope < 0.01,
    `maxSlope=${lastSlope.toFixed(4)}`)
}

// ===== Test 2：开海灌入洼地（用户核心场景）=====
{
  // 洼地外设为低于海平面，海会漫过来填满洼地
  const t = bowlTerrain(G, -0.5)
  const isSea = new Uint8Array(G * G)
  for (let z = 0; z < G; z++) {
    isSea[z * G + 0] = 1 // 左列为海（地形压到 -1）
    t[z * G + 0] = -1
  }
  const s: ShallowState = makeState(G, t, { seaLevel: 0, isSea })
  // 初始全干（海在 step 内自动补满到 seaLevel）
  let steps = 0
  const maxSteps = 20000
  let lastSlope = 0
  while (steps < maxSteps && maxSurfaceSlope(s) > 0.02) {
    step(s, { dt: DT, conductivity: K })
    steps++
    if (steps % 4000 === 0) {
      lastSlope = maxSurfaceSlope(s)
      console.log(`   [diag] Test2 step=${steps} maxSlope=${lastSlope.toFixed(4)} h_center=${s.h[32 * G + 32].toFixed(3)}`)
    }
  }
  lastSlope = maxSurfaceSlope(s)
  const center = 32 * G + 32
  const surfaceCenter = t[center] + s.h[center]
  report('开海灌地-洼地进水', s.h[center] > 0.5,
    `h_center=${s.h[center].toFixed(3)} steps=${steps}`)
  report('开海灌地-自由面趋平', lastSlope < 0.05,
    `maxSlope=${lastSlope.toFixed(4)}`)
  report('开海灌地-洼地面≈海平面', Math.abs(surfaceCenter - 0) < 0.3,
    `S_center=${surfaceCenter.toFixed(3)}`)
}
