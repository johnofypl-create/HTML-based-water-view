# 海岸微缩景观 · Coastal Diorama

一个浏览器端的"活的微缩海岸模型"放置类沙盒。玩家不操控角色，只是观察一个动画化的微缩世界——放松、氛围、美丽的程序化风景。无玩法机制、无目标、无资源管理，场景本身即是目的。

## 视觉特色

- **手工模型感**：地形像从材料块切下，四边可见截面岩层条纹
- **海岸生态**：沙滩、沙丘、草地、灌木、森林、悬崖、河流入海的自然过渡
- **质感海面**：基于深度的颜色（浅绿松石→青→深蓝）、岸线泡沫、Gerstner 波、菲涅尔反射、水下焦散
- **葱郁植被**：草/花/灌木/树/漂流木实例化渲染，风吹摇摆，自然集群
- **木结构**：木板路、跨河木桥、伸入水中码头
- **氛围生物**：飘移云朵 + 云影、盘旋飞鸟、水下鱼群
- **昼夜循环**：清晨/正午/午后/日落/夜晚五预设，太阳/天空/雾/水色/光照实时联动
- **程序化环境音**：全 Web Audio 合成海浪、风、河流、鸟鸣、虫鸣，随昼夜混合

## 技术栈

- **TypeScript** + **Vite** 5
- **Three.js** 0.169 + **React Three Fiber** 8 + **Drei** 9
- **zustand** 状态管理
- **simplex-noise** 种子化噪声
- **Web Audio API** 程序化音频（零外部资源）

## 快速开始

```bash
npm install
npm run dev      # 开发服务器 http://localhost:5173
npm run build    # 生产构建到 dist/
npm run preview  # 预览构建产物
```

点击"进入"按钮启动（同时解锁音频自动播放限制）。

## 操作

- **鼠标左键拖动**：旋转视角
- **滚轮**：缩放
- **右键拖动**：平移
- **时间滑块 / 预设按钮**：调整一天中的时间
- **右上角按钮**：重置相机、全屏、隐藏界面

## 架构

模块化分层，单向依赖，UI 与音频只读写状态不碰 Three 对象：

```
src/
├─ config/        配置层：常量、调色板、biome、时间关键帧
├─ state/         状态层：zustand store + 光照状态单例
├─ utils/         工具层：噪声、数学、地形高度纯函数、采样、GLSL 片段、几何合并
├─ world/         世界生成：地形（含裙边截面）、河流、木结构
├─ environment/   环境：植被总管 + 草/花/灌木/树/漂流木/岩石/云/鸟/鱼
├─ water/         水渲染：海洋着色器、高度场纹理
├─ lighting/      光照：太阳/环境/半球光、雾、天空穹顶、时间→光照计算
├─ camera/        相机：OrbitControls 封装 + 重置插值
├─ postprocessing/后处理：Bloom/Vignette/SMAA（阶段4 启用）
├─ animation/     动画：风摇摆着色器注入
├─ audio/         音频：AudioManager + 各声音层 Web Audio 合成
├─ ui/            UI：启动遮罩、时间滑块/预设、相机重置、全屏、隐藏
└─ App.tsx        根：Canvas + Scene + UI
```

## 核心技术决策

- **地形**：`PlaneGeometry` 256 分段 + 多层 fBm 噪声位移 + 海岸压平 + 河流样条 carve。`heightAt(x,z)` 纯函数被地形/水/植被共用保证一致。四边 extrude 到基面形成截面，材质按法线判定侧面走岩层条纹。
- **水**：自定义 ShaderMaterial，采样地形高度 DataTexture 算水深 → 深度色；Gerstner 波顶点位移 + 解析法线；岸线泡沫 + 菲涅尔 + 手动指数雾。水下焦散放在地形着色器（更正确，光照海底）。
- **植被**：每物种单 InstancedMesh 单 draw call；`InstancedBufferAttribute` 传相位做顶点摇摆；密度噪声 + 集群调制避免网格感。
- **时间系统**：5 关键帧（dawn/noon/afternoon/sunset/night）按 24h 环形插值，统一驱动太阳/雾/天空/着色器 uniform/光照。
- **音频**：粉噪滤波做浪/风/河，振荡器+包络做鸟鸣，高频脉冲做虫鸣，AmbientMixer 按时间调层增益。

## 已知限制 / 后续

- **LOD / 性能档位**：待实现。
- **DoF 微缩景观景深**：已实现（BokehPass），需根据场景微调参数。

## 在线预览

🔗 **CloudStudio**: https://138b9048db0349c7818730f12f123e26.app.codebuddy.work

## 开发阶段

- ✅ 阶段 1：项目初始化 + 静态海岸微缩景观
- ✅ 阶段 2：完整地形、植被、水、河流、构筑物
- ✅ 阶段 3：相机控制、昼夜系统、音频、UI
- ✅ 阶段 4：渲染质量提升 —— Bloom（three 内置 UnrealBloomPass + OutputPass ACES）、焦散双层 voronoi 精调、4 层动态云影、色彩饱和度补偿
- ✅ 阶段 5：相机空闲缓移（博物馆转台感）、BokehPass 浅景深（微缩模型美学）、CloudStudio 部署

---

一个让人什么都不做也想一直看着的、活的微缩海岸。
