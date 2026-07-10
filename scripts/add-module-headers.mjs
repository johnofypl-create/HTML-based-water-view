// 一次性脚本：为 src/ 下所有 .ts/.tsx 文件注入结构化模块头注释。
// 幂等：已含 @module 的文件跳过；index.ts（barrel）跳过。
// 仅新增注释，不改任何逻辑；运行后由 npm run build 验证 0 错误。
import fs from 'node:fs'
import path from 'node:path'

const SRC = path.resolve('src')

// 精选 @purpose / @aiEdit 映射（其余走通用兜底）
const PURPOSE = {
  'src/config/world': '世界几何常量：世界尺寸、海平面、地形网格分段、高度场纹理分辨率、展示底座',
  'src/config/camera': '相机轨道约束：初始位姿、缩放距离、极角范围、阻尼',
  'src/config/perf': '性能开关：植被/岩石实例上限、阴影分辨率、像素比',
  'src/config/spray': '飞溅粒子（浪花/水花）参数：池大小、重力、寿命、发射节流、触发阈值',
  'src/config/time': '时间/随机种子/太阳距离：保证场景可复现与昼夜定位',
  'src/config/palette': '全局调色板与水深配色采样',
  'src/config/biomeConfig': '生物群系枚举/高度带/密度配置',
  'src/config/timePresets': '昼夜关键帧（天空/光/雾/海色）',
  'src/utils/math': '数学工具（clamp/lerp/smoothstep/噪声种子等纯函数）',
  'src/utils/noise': '值噪声/fBm/ridge 噪声函数',
  'src/utils/glslChunks': '可复用 GLSL 片段（哈希/缓动/雾/voronoi/fbm）',
  'src/utils/terrain': '地形高度单一事实源 heightAt + 河流路径/坡度/法线/生物群系',
  'src/utils/sampling': '植被/岩石实例采样（按生物群系密度布点）',
  'src/utils/mergeGeometry': '几何合并工具',
  'src/state/useGameStore': 'zustand 全局 UI/时间/相机状态（响应式，组件用 hook 订阅）',
  'src/state/lightingState': '可变单例场景光状态（天空/太阳/雾/海色），跨层共享，非响应式',
  'src/state/splashBus': '事件总线（地形改造溅水发布/订阅），解耦发射与渲染',
  'src/water/heightField': '地形高度场 DataTexture 生成与 UV 映射（物理水/着色器采样用）',
  'src/water/Water': '水面组件（装配 Plane + 波位移 + 泡沫材质）',
  'src/water/gerstner': 'Gerstner 波单一事实源（TS 端采样，供 CPU 发射器/物理用）',
  'src/water/gerstner.glsl': 'Gerstner 波 GLSL 生成（与 gerstner.ts 同源，供顶点位移）',
  'src/water/waterSurface': '水面高度统一抽象 sampleWaterSurface（未来接高度场灌水只改此处）',
  'src/water/waterMaterial': '海面着色器材质工厂（Gerstner 位移 + Jacobian 白帽 + 岸线湿边）',
  'src/water/SprayParticles': '轻量 GPU 飞溅粒子层（环形缓冲 + 闭式弹道 + 三触发源）',
  'src/water/splashTargets': '溅水目标注册表（礁石/岛屿登记，供拍浪判定）',
  'src/water/sprayShader': '飞溅粒子顶点/片段着色器（弹道积分 + 软圆点）',
  'src/water/shallowWater': '高度场浅水 Virtual Pipes 参考求解器（CPU，物理水 P0）',
  'src/world/terrainGeometry': '地形几何生成（高度场 → 网格 + 岩层裙边）',
  'src/world/terrainMaterial': '地形材质工厂（生物群系配色 + 噪声细节）',
  'src/world/Terrain': '地形组件（装配几何 + 材质 + 昼夜响应）',
  'src/world/River': '河流组件',
  'src/world/Structures': '人工构筑物（灯塔/房屋等）',
  'src/world/ExhibitionBase': '展示底座（暗色台面）',
  'src/lighting/computeLighting': '按 timeOfDay 计算昼夜关键帧插值（写入 lightingState）',
  'src/lighting/Lighting': '场景灯光组件（方向光/环境光/阴影）',
  'src/lighting/SkyDome': '天空穹顶着色器（昼夜渐变）',
  'src/environment/vegetationData': '植被实例数据（草/花/灌木/树/漂流木布点）',
  'src/environment/Grass': '草实例层',
  'src/environment/Flowers': '花实例层',
  'src/environment/Bushes': '灌木实例层',
  'src/environment/Forest': '树森林实例层',
  'src/environment/Driftwood': '漂流木实例层',
  'src/environment/InstancedFoliage': '实例化植被材质工厂（风摆）',
  'src/environment/Birds': '飞鸟',
  'src/environment/Fish': '鱼群',
  'src/environment/Clouds': '云',
  'src/environment/Particles': '漂浮光点粒子',
  'src/environment/Vegetation': '植被总装（聚合各实例层 + 海洋元素）',
  'src/environment/MarineElements': '海洋元素（珊瑚/水下植物/岛屿/礁石标记 + 溅水目标注册）',
  'src/environment/Rocks': '岩石实例层（+ 溅水目标注册）',
  'src/audio/noiseBuffer': '白/粉噪声缓冲生成',
  'src/audio/AudioManager': '程序化环境音管理（浪/风/河/鸟/虫）',
  'src/audio/AudioUpdater': '音频状态每帧更新组件',
  'src/camera/CameraRig': '相机绑定（轨道控制 + 空闲自转 + 重置）',
  'src/postprocessing/Effects': '后处理链（Bloom + DoF + SMAA + 输出，frameloop=demand 常驻 invalidate）',
  'src/ui/UI': 'UI 叠层（时间/可见性控制）',
  'src/animation/vertexShaders': '风摆顶点着色器材质工厂',
  'src/App': '组合根（只装配各层组件，不含逻辑）',
  'src/main': '应用入口（挂载 React + Canvas）',
}

const AIEDIT = {
  'src/water/waterMaterial': '调泡沫密度/颜色 → 改 fragment 的 applyFoam 与 uFoam*；调波形 → 改 gerstner.glsl.ts；调昼夜响应 → 改 updateWaterMaterial 中 lightingState.* 读取',
  'src/water/gerstner': '调波形/风向 → 改 GERSTNER_WAVES 数组与 primaryWindDir（与 gerstner.glsl.ts 同源）',
  'src/water/gerstner.glsl': '调波形/风向 → 改本文件（与 gerstner.ts 同源）；数值改动属算法层，本次重构不动',
  'src/water/SprayParticles': '调粒子数/寿命/尺寸 → 改 config/spray.ts；调触发逻辑 → 改本文件 spawn 段（波峰/地形事件/礁石拍浪）',
  'src/water/shallowWater': '调物理稳定性 → 改 K/dt 与 outBuffer 钳制（见本文件注释）；数值改动属算法层，本次重构不动',
  'src/utils/terrain': '改地形形状 → 只改 heightAt（全库单一事实源，改一处全局生效）；算法改动属核心层，本次重构不动',
  'src/lighting/computeLighting': '调昼夜配色 → 配合 config/timePresets.ts 关键帧',
  'src/config/timePresets': '调昼夜关键帧（天空/光/雾/海色）→ 直接改 TIME_KEYFRAMES',
  'src/water/waterSurface': '接入高度场灌水 → 改 sampleWaterSurface 的 surfaceY = T + h（未来 P1）',
  'src/state/splashBus': '触发地形改造溅水 → splashBus.emit({pos,intensity})，无需改 SprayParticles',
  'src/water/splashTargets': '新增溅水目标（礁石/岛屿）→ registerSplashTarget({pos,radius,...})',
}

// 递归收集 src 下 .ts/.tsx
function walk(dir, acc = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) walk(p, acc)
    else if (/\.(ts|tsx)$/.test(e.name)) acc.push(p)
  }
  return acc
}

const LAYER_CN = {
  config: '叶子层', utils: '叶子层', state: '状态层',
  water: '域层', world: '域层', lighting: '域层',
  environment: '域层', audio: '域层', camera: '域层',
  postprocessing: '域层', animation: '域层', ui: '域层', root: '根层',
}

function moduleKey(abs) {
  const rel = path.relative(SRC, abs).replace(/\\/g, '/').replace(/\.(ts|tsx)$/, '')
  return 'src/' + rel
}
function layerOf(relNoExt) {
  const seg = relNoExt.split('/')
  return seg.length > 1 ? seg[0] : 'root'
}

const importRe = /(?:from|import\()\s*['"]([^'"]+)['"]/g
const exportRe = /export\s+(?:default\s+)?(?:async\s+)?(?:function|const|let|var|class|interface|type|enum)\s+([A-Za-z0-9_]+)/g

let count = 0
for (const abs of walk(SRC)) {
  const base = path.basename(abs)
  if (base === 'index.ts') continue // barrel 自说明，跳过
  let src = fs.readFileSync(abs, 'utf8')
  if (src.includes('@module')) continue // 已含头注释，跳过

  const rel = path.relative(SRC, abs).replace(/\\/g, '/').replace(/\.(ts|tsx)$/, '')
  const mod = rel
  const layer = layerOf(rel)
  const key = 'src/' + rel

  // dependsOn：内部相对 import
  const deps = new Set()
  let m
  importRe.lastIndex = 0
  while ((m = importRe.exec(src))) {
    const spec = m[1]
    if (!spec.startsWith('.')) continue
    let resolved
    if (spec.startsWith('../')) resolved = spec.slice(3)
    else if (spec.startsWith('./')) resolved = layer === 'root' ? spec.slice(2) : layer + '/' + spec.slice(2)
    else resolved = spec
    resolved = resolved.replace(/\.(ts|tsx)$/, '')
    // 去掉末尾 /index
    if (resolved.endsWith('/index')) resolved = resolved.slice(0, -('/index'.length))
    deps.add(resolved)
  }

  // exports
  const exps = []
  exportRe.lastIndex = 0
  while ((m = exportRe.exec(src))) exps.push(m[1])
  if (/export\s+default/.test(src) && !exps.some((e) => e === 'default')) {
    const dm = src.match(/export\s+default\s+function\s+([A-Za-z0-9_]+)/)
    exps.push(dm ? dm[1] : '<default>')
  }

  const purpose = PURPOSE[key] ?? `见文件内容（${mod}）`
  const aiEdit = AIEDIT[key] ?? `改本文件导出的 ${exps.join('、') || '组件'} 即可；依赖见 @dependsOn`

  const header =
`/**
 * @module ${mod}
 * @layer ${layer}（${LAYER_CN[layer] || '域层'}）
 * @purpose ${purpose}
 * @dependsOn [${[...deps].map((d) => `'${d}'`).join(', ')}]
 * @exports [${exps.map((e) => e === '<default>' ? 'default' : e).join(', ')}]
 * @aiEdit
 *   - ${aiEdit}
 */
`

  fs.writeFileSync(abs, header + src)
  count++
  console.log(`+ ${rel}`)
}
console.log(`\nDone. ${count} 文件已注入模块头注释。`)
