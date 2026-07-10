/**
 * water/ 公开 API。
 * 水面 / 浪花 / 物理水的对外入口；
 * environment 等通过此处拿 registerSplashTarget，不直接抓内部文件。
 *
 * 子分组（P7）：
 *   surface/  水面几何与高度场：heightField / gerstner / gerstner.glsl / waterSurface
 *   foam/     视觉层（材质 + 着色器 + 粒子 + 组件）：waterMaterial / sprayShader / SprayParticles / Water
 *   physics/  物理水：shallowWater（CPU 参考）/ waterField（GPU 实时灌水 P1）
 *   state/    溅水目标注册表：splashTargets
 */
export * from './surface/heightField'
export * from './surface/gerstner'
export * from './surface/gerstner.glsl'
export * from './surface/waterSurface'
export * from './foam/waterMaterial'
export * from './foam/sprayShader'
export * from './state/splashTargets'
export * from './physics/shallowWater'
export * from './physics/waterField'
export { default as Water } from './Water'
export { default as SprayParticles } from './foam/SprayParticles'
