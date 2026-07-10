# ARCHITECTURE — coast-diorama（AI-Agent 友好重构）

> 目标：在不引入任何行为变更的前提下，理清模块划分与依赖关系、统一命名、补充结构化元信息，使 AI Agent 能快速定位 / 理解 / 修改目标代码段。
> 范围：纯结构性调整（重命名、拆分、barrel、注释、文档）。**禁止**改动着色器算法、波函数、物理求解器数值、渲染逻辑。

---

## 1. 分层模型（依赖只允许向下）

```
┌─────────────────────────────────────────────┐
│  App.tsx  —— 唯一组合根（只装配，不含逻辑）  │
├─────────────────────────────────────────────┤
│  Leaf 组件层 (world/*, lighting/*,          │
│   environment/*, water/*.tsx, camera, ui)    │
├─────────────────────────────────────────────┤
│  状态层 state/  —— 跨层共享数据的唯一通道     │
├─────────────────────────────────────────────┤
│  工具/算法层 utils/  +  配置层 config/  —— 叶子  │
└─────────────────────────────────────────────┘
```

- `App.tsx` 是唯一组合根，只装配组件树，不含业务逻辑。
- Leaf 组件层（world/lighting/environment/water/camera/ui/postprocessing/animation）向 `state/` 取共享数据，向 `utils/`/`config/` 取纯函数/常量。
- `state/`、`utils/`、`config/` 是叶子层，**不得反向 import 任何 `src/` 内部模块**（除第三方）。

---

## 2. 依赖硬规则

- **R1 叶子不可反向依赖**：`utils/`、`config/` 不得 import 任何 `src/` 内部模块（只可 import 第三方）。
- **R2 禁止循环依赖**：A 若需 B 的数据，B 必须通过 `state/` 或本层 **barrel** 暴露，A 不得 `import` B 的某个内部文件。
- **R3 域间通信走 state/ 或 barrel**：如 `environment` 需要浪花目标，只 `import { registerSplashTarget } from '../water'`（barrel）或 `from '../water/state/splashTargets'`，不得抓 `SprayParticles` 内部。
- **R4 组合根唯一**：只有 `App.tsx` 能直接 new 组件树；域组件之间不直接互相实例化。

---

## 3. 命名规范（强制）

| 类型 | 命名 | 示例 |
|---|---|---|
| React 组件 / 可实例化类 | `PascalCase.tsx` | `Water.tsx`、`Terrain.tsx` |
| 普通模块 / 工具 / 配置 | `kebab-case.ts` | `terrainGeometry.ts`、`useGameStore.ts` |
| 着色器源（GLSL 存于 .ts） | `*.glsl.ts` 约定 | `gerstner.glsl.ts`、`sprayShader.ts` |
| 导出类型 | `PascalCase`，与载体同文件或 `types.ts` | `LightingState`、`SplashEvent` |
| 常量 | `UPPER_SNAKE` | `WORLD_SIZE`、`SPRAY` |
| 文件夹 | `kebab-case`（单数优先） | `water/`、`state/`、`postprocessing/` |

> **命名更正记录（实测，非文档 typo）**：`config/timePresets.ts`（time+Presets）、`environment/InstancedFoliage.tsx`（Instanced+Foliage）经字节级核验拼写**已正确**，原计划文档误判为拼写错误（文档前后名相同即为佐证）。本次**不重命名**，避免无谓 import 改动、违反零行为变更闸门。

---

## 4. 目录结构与 barrel 约定

- 每个域文件夹含 `index.ts` 作为公开 API 清单（AI 看 `index.ts` 即知可改 / 可 import 什么）。
- `config/` 以 `constants.ts` 为 barrel，按域拆 `world/camera/perf/spray/time.ts`；下游 `import ... from '../config/constants'` **路径不变**。
- barrel 只暴露各文件的**公开导出**（即其 `export` 表面），不重新导出文件内部未导出的私有成员。
- `water/` 进一步按职责子分组（P7）：`surface/`（高度场/波/水面抽象）、`foam/`（材质/着色器/粒子/组件）、`physics/`（浅水求解器）、`state/`（溅水目标）；`Water.tsx` 留在 `water/` 根作域主组件。域外只经 `water/index.ts` barrel 取数，不直接抓子目录内部文件。

---

## 5. 状态层三种模式（state/）

| 模式 | 文件 | 用途 | 何时用 |
|---|---|---|---|
| **zustand 响应式** | `useGameStore.ts` | UI/时间/相机状态，组件用 hook 订阅 | 需要"组件响应状态变化重渲染" |
| **可变单例（非响应式）** | `lightingState.ts` | 跨层共享的场景光状态（天空/太阳/雾/海色）；`computeLighting` 每帧写入、各材质每帧读取 | 需要"每帧高频读写的全局量"，不触发 React 重渲染 |
| **事件总线** | `splashBus.ts` | 地形改造溅水发布/订阅 | 需要"一次性事件通知"，解耦发射与渲染 |

⚠️ **别混用**：组件要响应变化 → `useGameStore`；每帧高频读写全局量 → `lightingState`；一次性事件 → `splashBus`。

---

## 6. "需求 → 改哪个文件 → 改哪一段" 速查索引

| 想改什么 | 改哪个文件 | 改哪一段 / 注意 |
|---|---|---|
| 浪花粒子数 / 寿命 / 尺寸 | `config/spray.ts`（`SPRAY`） | 唯一定义处，下游经 barrel 引用 |
| 波形 / 风向 | `water/surface/gerstner.ts` + `water/surface/gerstner.glsl.ts` | 两文件**同源**（同一波参数数组），改一处两处一致 |
| 泡沫密度 / 颜色 | `water/foam/waterMaterial.ts` | 片段 `applyFoam` 与 `uFoam*` uniform |
| 水体 / 天空昼夜配色 | `config/timePresets.ts` 关键帧 + `lighting/computeLighting.ts` | 关键帧插值写入 `lightingState` |
| 地形形状 | `utils/terrain.ts` 的 `heightAt` | **全库单一事实源**，改一处全局生效 |
| 植被 / 岩石布点 | `utils/sampling.ts` + `environment/vegetationData.ts` | 按生物群系密度 |
| 相机约束（距离 / 角度 / 阻尼） | `config/camera.ts`（`CAMERA`） | — |
| 性能档位（实例数 / 阴影 / 像素比） | `config/perf.ts`（`PERF`） | 实例数↑画质↑但更慢 |
| 接入高度场灌水（物理水 P1） | `water/surface/waterSurface.ts` 的 `sampleWaterSurface` | 改 `surfaceY = T + h`；求解器见 `water/physics/shallowWater.ts` |
| 触发地形改造溅水 | `state/splashBus.ts` | `splashBus.emit({pos,intensity})`，无需改 `SprayParticles` |
| 新增溅水目标（礁石 / 岛屿） | `water/state/splashTargets.ts` | `registerSplashTarget({pos,radius,...})` |
| 后处理（Bloom / DoF / SMAA） | `postprocessing/Effects.tsx` | `frameloop="demand"` 下每帧 `invalidate()` 常驻 |

---

## 7. 重构安全边界（本次）

- **禁止改动**：GLSL 字符串内容、Gerstner 数值、`shallowWater` 求解器、`heightAt` 算法、`frameloop`/`invalidate` 逻辑、任何 `uniform` 默认值。
- **每阶段 `npm run build` 必须 0 错误**（绿 = 行为等价）；不绿立即 `git revert` 该阶段提交。
- 文件级 `@module/@layer/@purpose/@dependsOn/@exports/@aiEdit` 头注释统一模板，便于 AI 上下文感知编辑。
