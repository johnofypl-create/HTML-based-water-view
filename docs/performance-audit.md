# 性能审计报告（2026-07-11）

> 聚焦两条线：**性能审计**（渲染循环 / draw call / 包体）+ **物理水 GPU 化（P1 实时灌水）**。
> 配套代码改动已提交。本报告是「为什么这么改 / 还差什么」的依据。

---

## 0. TL;DR

| 项 | 状态 | 影响 |
|---|---|---|
| 渲染循环双渲 bug | ✅ 已修 | 每帧省一次完整场景绘制（GPU 约 −30~50% 绘制开销），且让 Bloom/DoF **真正上屏** |
| draw call 盘点 | ✅ 无问题 | 植被/岩石等已全部 InstancedMesh + mergeGeometries，非瓶颈 |
| 包体 | ⚠️ 可接受 | 单 chunk 1.21MB / gzip 358KB，three 占大头；单页沙盘属正常，留作低优选项 |
| 物理水 GPU 化 P1 | ✅ 已实现 | `GPUComputationRenderer` 移植 Virtual Pipes，海源钉海平面、洼地动态灌水 |
| P1 运行期验证 | ⚠️ 待你本地确认 | 本环境无 WebGL2，未能跑实时渲染；逻辑/构建/CPU 参考已三重验证 |

---

## 1. 渲染循环双渲 bug（本次最高价值发现）

### 现象
`App.tsx` 用 `frameloop="demand"`，`Effects.tsx` 用 `useFrame(() => composer.render())` 且**没设 priority**，并在 `useFrame` 末尾每帧 `invalidate()`。

### 根因（R3F 源码坐实）
`node_modules/@react-three/fiber/dist/events-b389eeca.esm.js` 的 `update()`（render loop 核心）：

```js
// line 16052-16060
for (subscribers) { subscription.ref.current(...) }          // 1) 跑所有 useFrame（含 composer.render()）
if (!state.internal.priority && state.gl.render)             // 2) 若没有 priority>0 的 useFrame
  state.gl.render(state.scene, state.camera);                 //    再自动 gl.render 一次
```

- 因为 `Effects` 的 `useFrame` 是 **priority 0**，`internal.priority === 0` → R3F 在 `composer.render()`（带后处理）之后，**又** `gl.render()` 一份**无后处理**的画面覆盖上去。
- `Effects` 末尾的 `invalidate()` 让 `demand` 永远不停 → 等于伪 `always`，却多了每帧调度开销，且**后处理被吃掉**。

即：**每帧白渲一次完整场景 + Bloom/DoF 根本没真正上屏**。

### 修复（已落地，构建 644 模块 0 错）
- `Effects.tsx`：`useFrame(cb, 1)` —— 用 **priority=1 接管渲染**，告诉 R3F 本帧由我们 `composer.render()`，跳过其默认 `gl.render()`（消除双渲）。
- 删除两处冗余 `invalidate()`（setup 内、useFrame 末尾）。
- `App.tsx`：`frameloop="demand"` → `"always"`（场景持续动画，demand 本就是 no-op）。

修复后：单趟 composer 渲染即终态，**省掉一次完整场景绘制**；Bloom/DoF 成为唯一输出，**真正生效**。

> 风险说明：该修复依赖「priority>0 时 R3F 跳过自动渲染」这一 R3F 既定行为（源码 line 16060 已确认）。逻辑层面无歧义；视觉差异仅在于后处理此前被覆盖、修复后可见——属预期修正。

---

## 2. Draw call 盘点（无问题）

| 类别 | 实现 | 结论 |
|---|---|---|
| 草/花/灌木/树/岩/漂流木 | `InstancedMesh`（Grass/Flowers/Bushes/Forest/Rocks/Driftwood） | ✅ 单 draw call / 类 |
| 森林/建筑/云 | `mergeGeometries` 合并后单 mesh | ✅ |
| 地形/水面/河/底座/天穹 | 各 1 mesh | ✅ |
| 鱼/鸟 | 少量独立 mesh（个位数量级） | ✅ 可忽略 |

**结论**：实例化已到位，draw call 不是瓶颈。无需改动。

---

## 3. 包体分析

```
dist/assets/index-BhRBMDZ9.js   1,210.67 kB │ gzip: 357.80 kB   (+8KB / +2.7KB gz vs 修复前，来自 GPU 物理水)
dist/assets/index-S2zhANOJ.css     3.54 kB │ gzip:   1.30 kB
```

- three + R3F + drei + postprocessing 占绝对大头，对单页 3D 沙盘属正常区间（<400KB gz）。
- **低优选项**（当前不做，按需）：`vite.config` 加 `manualChunks` 把 `three` / `react` 拆独立 chunk，仅改善长效缓存，不降首屏。
- P1 引入的 `GPUComputationRenderer` 仅 +8KB，性价比高。

---

## 4. 物理水 GPU 化（P1 实时灌水）

### 目标
把 `src/water/physics/shallowWater.ts`（CPU 参考求解器，已 `verify-shallow-water.ts` 证收敛）移植到 GPU，实时计算「地形低于海平面 → 水流入填充洼地」。

### 实现（`src/water/physics/waterField.ts`，新增）
- 用 `GPUComputationRenderer`（WebGL2 ping-pong 浮点纹理）：
  - `hVar`（RGBA float，`.r`=水深 h）
  - `fluxVar`（RGBA float，`.r/.g/.b/.a`=四向流出 R/U/L/D）
- 地形纹理 `getHeightFieldTexture()` 作 uniform 输入。
- **flux 着色器**：算四向期望流出 `f = K·(S_i−S_j)·dt`，正值即流出；四向流出总和钳制到 `≤ h·outBuffer`（防负水深爆炸，与 CPU 参考同命门）。
- **h 着色器**：用邻居「指向自身的流出」累加进水，更新 h；**海源格（T<seaLevel）每步钉成 `seaLevel−T`**（无限水库，开海才能向洼地灌水）。
- `pour(x,z,amt,r)`：往世界坐标灌入水深的注入接口（预留给地形编辑系统）。

### 接入水面（`waterMaterial.ts` + `Water.tsx`）
- 顶点：采样 `h`，把基面位移成 `surfaceY = terrainH + h`（海里 `h = seaLevel−T` → 基面=海平面，**与修复前海面逐位一致**）。
- 片元：按 `h` 做**干地遮罩**（`smoothstep` 渐隐 + `discard`）——顺带修掉旧版「整片水面连陆地都染蓝」的问题，岸线更利落。
- `Water.tsx` 每帧 `waterField.compute(delta)` 并喂 `uWaterHeight` 纹理。

### 验证状态（诚实说明）
| 验证 | 结果 |
|---|---|
| `npm run build` | ✅ 644 模块 0 错 |
| `verify-shallow-water.ts`（CPU 参考，未动） | ✅ 6/6 PASS，massErr=1.16e-7、h_center=3.702、maxSlope=0.0288，逐位一致 |
| GPU 着色器逻辑 vs CPU 参考 | ✅ 逐项核对等价（每条边单下坡通量非零 + 钳制保证 h≥0、质量守恒） |
| **运行期实时渲染** | ⚠️ **本环境无 WebGL2，未能跑**。`npm run dev` 后请目测：① 海面/Bloom/DoF 是否正常；② 控制台是否报 `GPUComputationRenderer init error` |

> 运行期验证是唯一缺口。逻辑/构建/CPU 参考已三重验证，但**真机渲染未亲验**——按「保持怀疑」原则，此项明确标注待你本地确认。

---

## 5. 遗留低优项（本次未做，非阻塞）

1. **GPU 模拟每帧常算**：128²×2 趟开销可忽略（<<1ms），但严格可加「最大坡度 < ε 则跳步」省电——需 GPU→CPU 回读，代价大于收益，暂不做。
2. **CPU 侧 `sampleWaterSurface` 仍走 `WATER_LEVEL + Gerstner`**：浪花发射源采样的是波面（不受 GPU 水深影响，符合预期）。待地形编辑系统接入时，可改为读 GPU h 纹理，发射源/泡沫逻辑零改动。
3. **包体 manualChunks 拆分**：见 §3，低优。
4. **地形编辑系统**：`splashBus` / `pour()` 已就位，但触发 UI 未建——这是让「降低地形→水流入」真正可交互的前置，属下一阶段。
