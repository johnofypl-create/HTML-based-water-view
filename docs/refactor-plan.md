# 重构方案：coast-diorama 代码库架构整理（AI-Agent 友好）

> 目标：在不引入任何行为变更的前提下，理清模块划分与依赖关系、统一命名、补充结构化元信息，使 AI Agent 能快速定位 / 理解 / 修改目标代码段。
> 范围：纯结构性调整（重命名、拆分、barrel、注释、文档）。**禁止**改动着色器算法、波函数、物理求解器数值、渲染逻辑。

---

## 0. 现状诊断（基于真实代码扫描，非凭记忆）

### 0.1 目录树（57 个源文件，10 个域文件夹）

```
src/
  main.tsx  index.css  vite-env.d.ts  App.tsx        ← 组合根（干净）
  config/      constants.ts  palette.ts  biomeConfig.ts  timePresets.ts
  utils/       math.ts  noise.ts  glslChunks.ts  terrain.ts  sampling.ts  mergeGeometry.ts
  state/       useGameStore.ts  lightingState.ts  splashBus.ts
  water/       heightField.ts  Water.tsx  gerstner.ts  gerstner.glsl.ts
               waterSurface.ts  waterMaterial.ts  SprayParticles.tsx  splashTargets.ts
               sprayShader.ts  shallowWater.ts
  world/       terrainGeometry.ts  Terrain.tsx  terrainMaterial.ts  River.tsx  Structures.tsx  ExhibitionBase.tsx
  lighting/     computeLighting.ts  Lighting.tsx  SkyDome.tsx
  animation/    vertexShaders.ts
  environment/  vegetationData.ts  Grass.tsx  Flowers.tsx  Forest.tsx  Bushes.tsx
               Driftwood.tsx  InstancedFoliage.tsx  Birds.tsx  Fish.tsx  Clouds.tsx
               Particles.tsx  Vegetation.tsx  MarineElements.tsx  Rocks.tsx
  audio/        noiseBuffer.ts  AudioManager.ts  AudioUpdater.tsx
  camera/       CameraRig.tsx
  postprocessing/ Effects.tsx
  ui/           UI.tsx
```

### 0.2 依赖关系实测结论

| 被依赖方 | 被谁依赖 | 评估 |
|---|---|---|
| `utils/terrain.ts`（`heightAt` 单一事实源） | terrainGeometry / sampling / Structures / MarineElements / heightField / biomeConfig / Vegetation 等 9+ 处 | ✅ **好模式**，全库共用同一高度函数，需保留并在别处复制 |
| `state/lightingState.ts`（场景状态单例） | computeLighting / Lighting / SkyDome / Terrain / River / waterMaterial / InstancedFoliage / Effects（跨 5 层 8 文件） | ✅ 集中式场景状态中枢，合理；但 waterMaterial 用了一层多余 wrapper |
| `state/useGameStore.ts`（zustand：timeOfDay/uiVisible/cameraReset） | Lighting / AudioUpdater / CameraRig / UI | ✅ 非孤儿，是 UI/时间中枢 |
| `state/splashBus.ts` + `water/splashTargets.ts`（事件总线 + 注册表） | SprayParticles / Rocks / MarineElements | ✅ 解耦范本，保留 |
| `animation/vertexShaders.ts`（`makeSwayMaterial` 等风摆材质工厂） | environment/InstancedFoliage | ✅ 非孤儿 |
| `config/constants.ts` | App / 几乎全库 | ⚠️ **上帝对象**：混入世界尺寸 / 相机 / 性能计数 / 浪花参数 / 时间，~100 行 |

**未发现循环依赖。** `utils/` 与 `config/` 是叶子层；`state/` 只依赖 utils/config；域文件夹向 utils/config/state 取数，基本不互相抓内部文件。整体分层方向是健康的。

### 0.3 待改进项（精确对应 5 条要求）

1. **命名不一致（要求 #2）**
   - `config/timePresets.ts` → 拼写错误，应为 `timePresets.ts`（`Presets`）。
   - `environment/InstancedFoliage.tsx` → 拼写错误，应为 `InstancedFoliage.tsx`（`Foliage`）。
   - `world/Terrain.tsx` 用 PascalCase，同级 `terrainGeometry.ts`/`terrainMaterial.ts` 用 kebab。**这不是 bug**：`.tsx` 组件用 PascalCase、`.ts` 模块用 kebab 本身是合理约定。本次**只修正 2 处拼写**，不强行统一大小写。
2. **配置上帝对象（要求 #1/#3）**：`constants.ts` 一锅炖，AI 定位某参数要通读全文件。
3. **缺模块级元信息（要求 #4）**：仅少数文件有顶部注释，无统一 `@module/@purpose/@dependsOn/@exports` 头。
4. **缺 barrel 稳定接口（要求 #3）**：AI 必须猜确切文件名才能 import；没有"本层对外暴露什么"的清单。
5. **轻微冗余耦合（要求 #1）**：`waterMaterial.ts:226` 已直接 `import { lightingState }`，却还定义了 5 个 wrapper（`lightingStateSunDir = () => lightingState.sunDir` …），注释称"避免循环依赖"——但实际不构成环，属于过时防御代码。

---

## 1. 设计原则与边界规则（回答要求 #2）

### 1.1 分层模型（依赖只允许向下）

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

### 1.2 依赖硬规则（写入 ARCHITECTURE.md，CI 可 lint）

- **R1 叶子不可反向依赖**：`utils/`、`config/` 不得 import 任何 `src/` 内部模块（只可 import 第三方）。
- **R2 禁止循环依赖**：A 若需 B 的数据，B 必须通过 `state/` 或本层 **barrel** 暴露，A 不得 `import` B 的某个内部文件。
- **R3 域间通信走 state/ 或 barrel**：如 `environment` 需要浪花目标，只 `import { registerSplashTarget } from '../water'`（barrel）或 `from '../water/splashTargets'`，不得抓 `SprayParticles` 内部。
- **R4 组合根唯一**：只有 `App.tsx` 能直接 new 组件树；域组件之间不直接互相实例化。

### 1.3 命名规范（强制）

| 类型 | 命名 | 示例 |
|---|---|---|
| React 组件 / 可实例化类 | `PascalCase.tsx` | `Water.tsx`、`Terrain.tsx` |
| 普通模块 / 工具 / 配置 | `kebab-case.ts` | `terrainGeometry.ts`、`useGameStore.ts` |
| 着色器源（GLSL 存于 .ts） | `*.glsl.ts` 约定 | `gerstner.glsl.ts`、`sprayShader.ts` |
| 导出类型 | `PascalCase`，与载体同文件或 `types.ts` | `LightingState`、`SplashEvent` |
| 常量 | `UPPER_SNAKE` | `WORLD_SIZE`、`SPRAY` |
| 文件夹 | `kebab-case`（单数优先） | `water/`、`state/`、`postprocessing/` |

修正：`timePresets.ts` → `timePresets.ts`；`InstancedFoliage.tsx` → `InstancedFoliage.tsx`。

---

## 2. 目标目录结构（仅展示与现状差异部分）

```
src/
  config/
    constants.ts        ← 改为 barrel：re-export 下列子文件（下游 import 路径不变）
    world.ts            ← WORLD_SIZE / SEA_LEVEL / WATER_LEVEL / BASE_Y / HEIGHT_TEX_SIZE / TERRAIN_SEGMENTS
    camera.ts           ← CAMERA
    perf.ts             ← PERF
    spray.ts            ← SPRAY
    time.ts             ← DEFAULT_TIME_OF_DAY / SUN_DISTANCE / SEED
    palette.ts  biomeConfig.ts  timePresets.ts   ← 保持不变
    index.ts            ← barrel：export * from 全部 config 子文件
  water/
    index.ts            ← 新增 barrel（对外稳定 API）
    surface/  (可选 Phase 7)  gerstner.ts  gerstner.glsl.ts  waterSurface.ts  heightField.ts
    foam/    (可选 Phase 7)  waterMaterial.ts  sprayShader.ts  SprayParticles.tsx
    physics/ (可选 Phase 7)  shallowWater.ts  (+ 未来 GPU 求解器)
    state/   (可选 Phase 7)  splashTargets.ts
  world/  lighting/  environment/  audio/  camera/  postprocessing/  animation/  state/  utils/
    └ 各加 index.ts barrel
  ARCHITECTURE.md       ← 新增：分层图 + 依赖规则 + "在哪改 X" 索引
```

> **零改动拆分技巧（config）**：`constants.ts` 重写为 `export * from './world'; export * from './camera'; …`。所有现有 `import { CAMERA } from '../config/constants'` **完全不用改**，行为零风险。这是本次重构的核心安全策略——能 barrel 化的一律 barrel 化，避免触碰下游 import。

---

## 3. 逐条对应 5 项要求

### 要求 #1 — 梳理模块划分与依赖、消除冗余耦合
- 输出 `ARCHITECTURE.md` 依赖图（见 §2 / §6），固化当前健康分层。
- 删除 `waterMaterial.ts` 中 5 个多余 `lightingStateSunDir` 等 wrapper，直接复用已 import 的 `lightingState`（实测不构成环）。
- 明确 `state/` 内含 3 种不同状态模式（zustand 单例 `useGameStore` / 可变单例 `lightingState` / 事件总线 `splashBus`），在各自文件头注释说明"用哪种、为什么、别混用"。

### 要求 #2 — 目录结构 / 命名 / 职责单一
- 落地 §1.3 命名规范；修正 2 处拼写。
- 每文件职责单一：如 `terrain.ts` 同时含 `heightAt` + `getRiverPath` + `isUnderwater` —— 仅文档标注边界，**不强行拆**（拆会触达 Structures/MarineElements，风险 > 收益）；若后续要拆，`getRiverPath` 归 `utils/river.ts`。
- `water/` 密集（12 文件）先靠 barrel 收敛对外接口；子分组列为可选 Phase 7，不阻塞主目标。

### 要求 #3 — 文件 / 函数粒度优化（AI 可定位）
- **每个域文件夹加 `index.ts` barrel**，作为"本层对外暴露清单"——AI 一看 barrel 就知道能改什么、从哪 import。
- `config` 按域拆子文件 + barrel（§2 零改动技巧）。
- 大函数加 `// === SECTION: xxx ===` 分段注释（如 `waterMaterial.ts` 的 vertex/fragment/uniform 三大块），让 AI 能定位到"改泡沫看 fragment 的 `applyFoam` 段"。

### 要求 #4 — 结构化注释 / 元信息（AI 上下文感知编辑）
- **统一模块头模板**（每个文件顶部）：
  ```ts
  /**
   * @module water/waterMaterial
   * @layer water（域层）
   * @purpose 海面着色器材质工厂：Gerstner 波位移 + Jacobian 白帽泡沫 + 岸线湿边 + 与水/雾/天空状态同步
   * @dependsOn ['state/lightingState', 'water/heightField', 'utils/glslChunks']
   * @exports [createWaterMaterial, updateWaterMaterial]
   * @aiEdit
   *   - 调泡沫密度/颜色 → 改 fragment 的 `applyFoam()` 与 uniforms uFoam*
   *   - 调波形 → 改 `gerstner.glsl.ts`（与 CPU 端 gerstner.ts 同源）
   *   - 调昼夜响应 → 改本文件 updateWaterMaterial 中 lightingState.* 读取
   */
  ```
- **导出函数 JSDoc**：`@param` / `@returns` / `@sideEffects`（如"写入 lightingState"）。
- `ARCHITECTURE.md` 末尾附 **"需求 → 改哪个文件 → 改哪一段"** 速查索引（AI 最高频使用）。

### 要求 #5 — 功能完整 / 无行为变更（硬性闸门）
- 所有改动限于：重命名（import 同步更新）、拆分+barrel（re-export 等价）、新增注释、新增 index.ts、删除已确认冗余的 wrapper。
- **禁止**触碰：GLSL 字符串内容、Gerstner 数值、shallowWater 求解器、`heightAt` 算法、`frameloop`/invalidate 逻辑、任何 `uniform` 默认值。
- 每阶段结束必须 `npm run build` 绿（= tsc -b && vite build 通过）。绿即行为等价；不绿立即回滚该阶段。

---

## 4. 执行路线图（每阶段独立可回滚）

| 阶段 | 内容 | 行为风险 | 验证 |
|---|---|---|---|
| **P0 基线** | 跑 `npm run build` + `node --experimental-strip-types scripts/verify-shallow-water.ts` 记录基线；`git commit` 打点 | 无 | 双绿 |
| **P1 命名修正** | 修正 `timePresets` / `InstancedFoliage` 两处拼写，全库 import 同步；补 §1.3 规范到 ARCHITECTURE（先建文档壳） | 低（机械替换） | build 绿 |
| **P2 config 拆分** | 拆 `world/camera/perf/spray/time.ts` + 重写 `constants.ts` 为 barrel | 零（re-export 等价） | build 绿 + 抽查 3 处 import 未变 |
| **P3 各域 barrel** | 给 water/world/lighting/environment/state/utils/audio/camera/postprocessing/animation 加 `index.ts` | 零（仅新增，不改现有 import） | build 绿 |
| **P4 模块头注释** | 全 57 文件加 §3.4 模板头 + 导出函数 JSDoc | 零（纯注释） | build 绿（注释不影响类型） |
| **P5 去冗余** | 删 waterMaterial 的 5 个 wrapper，直接复用 lightingState；state/ 三模式头注释 | 低 | build 绿 + 目视确认水面渲染无变化 |
| **P6 架构文档** | 完成 `ARCHITECTURE.md`：分层图 + R1-R4 规则 + "在哪改 X" 索引 | 零 | 文档评审 |
| **P7（可选）** | `water/` 子分组 surface/foam/physics/state + 调整 barrel | 中（多文件移动） | build 绿 + 现有 verify 脚本绿 |

> 建议 P0→P6 一次性走完（都是零/低风险），P7 视你需要再单独排期。

---

## 5. 验证与回滚（保证 #5）

1. **每阶段闸门**：`npm run build` 必须 0 错误；P0 基线的 `verify-shallow-water.ts` 在 P5 后再跑一次确认物理求解器未被误伤。
2. **Git 检查点**：每阶段结束 `env -u HTTP_PROXY -u HTTPS_PROXY git add -A && git commit`（push 单独按需），任一阶段出问题 `git revert` 该提交即可，不影响其它阶段。
3. **AI 验收**：重构后让 Agent 执行"把浪花粒子数从 4096 改成 2048"——应只需改 `config/spray.ts` 一处（验证 barrel + 配置拆分生效）。

---

## 6. 架构分层图（ASCII，同时进 ARCHITECTURE.md）

```
                         App.tsx（组合根，只装配）
                                  │
        ┌─────────────┬──────────┼──────────┬──────────────┐
        ▼             ▼          ▼          ▼              ▼
   world/*       lighting/*  environment/*  water/*      camera/ui/audio/
   (地形/河/构筑物) (天空/光)  (植被/礁石/生物) (水面/浪花/物理) (相机/UI/音)
        │             │          │            │
        └─────────────┴────┬─────┴────────┘
                            ▼
                     state/（跨层共享：useGameStore / lightingState / splashBus）
                            │
                  ┌─────────┴─────────┐
                  ▼                   ▼
            utils/（heightAt 等）   config/（constants barrel + 域子文件）
            （叶子，纯函数）        （叶子，常量）
```

---

## 7. 风险与权衡

- **重命名触达多文件**：2 处拼写修正会更新若干 import。用编辑器/脚本批量替换 + build 校验，风险可控；不扩大修正范围（不碰 Terrain.tsx 大小写）。
- **barrel 滥用反模式**：barrel 只暴露"对外 API"，**不要**把所有内部文件都 re-export（会掩盖真实依赖、拖慢 tree-shaking）。`index.ts` 仅列公开符号。
- **不碰算法/着色器**：本次是"整理"，不是"改进"。任何视觉效果、数值、性能的实质改动都不在此方案内（见 §8）。

## 8. 明确不在本次范围（避免范围蔓延）

- 性能优化（之前讨论的 `Effects` 每帧强制 invalidate 导致常驻渲染、draw call 审计、包体 code-split）—— 独立任务。
- 物理水 GPU 化（P1 实时灌水）—— 独立任务，沿用本次整理的 `water/physics/` 落点。
- 任何新功能（地形编辑、物体入水溅射等）—— 独立任务。

---

## 9. 落地后预期收益（AI-Agent 视角）

- **定位**：想改浪花 → 直接看 `water/index.ts` → `SprayParticles` / `sprayShader`；想改参数 → `config/spray.ts`。
- **理解**：每个文件头 5 行说清"干什么、依赖谁、导出啥、改哪段"。
- **编辑**：改一处常量即全局生效（barrel + 单一事实源），不会出现"改了 A 文件 B 文件还是旧值"。
- **安全**：R1-R4 规则 + 每阶段 build 闸门，重构不引入回归。
