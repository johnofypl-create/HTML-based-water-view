/**
 * water/ 公开 API。
 * 水面 / 浪花 / 物理水的对外入口；
 * environment 等通过此处拿 registerSplashTarget，不直接抓内部文件。
 */
export * from './heightField'
export * from './gerstner'
export * from './gerstner.glsl'
export * from './waterSurface'
export * from './waterMaterial'
export * from './sprayShader'
export * from './splashTargets'
export * from './shallowWater'
export { default as Water } from './Water'
export { default as SprayParticles } from './SprayParticles'
