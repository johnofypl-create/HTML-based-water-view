/**
 * @module postprocessing/Effects
 * @layer postprocessing（域层）
 * @purpose 后处理链（Bloom + DoF + SMAA + 输出；frameloop=always 下用 priority=1 接管渲染，避免 R3F 二次 gl.render 双渲）
 * @dependsOn ['state/lightingState']
 * @exports [Effects, Effects]
 * @aiEdit
 *   - 改本文件导出的 Effects、Effects 即可；依赖见 @dependsOn
 */
/**
 * 后处理管线（three 内置 EffectComposer）
 *
 * 与 App.tsx Canvas `frameloop="demand"` 配合。
 * 管线：RenderPass → UnrealBloomPass → BokehPass(DoF) → SMAAPass → OutputPass
 *
 * R3P 也试了 3.0 版本——ToneMapping mode=2(ACES) 导致画面接近全黑
 * （avg RGB 13,20,24），色彩空间集成仍有问题。
 * 因此保留 three 内置方案，它已在 Phase 4 验证可行。
 */
import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { BokehPass } from 'three/examples/jsm/postprocessing/BokehPass.js'
import { SMAAPass } from 'three/examples/jsm/postprocessing/SMAAPass.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'
import { lightingState } from '../state/lightingState'

const FOCUS_POINT = new THREE.Vector3(0, 1.5, -4)

export default function Effects() {
  const { gl, scene, camera, size } = useThree()
  const bloomRef = useRef<UnrealBloomPass | null>(null)
  const bokehRef = useRef<BokehPass | null>(null)
  const composerRef = useRef<EffectComposer | null>(null)

  useEffect(() => {
    const comp = new EffectComposer(gl)
    comp.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))

    const renderPass = new RenderPass(scene, camera)
    renderPass.clearAlpha = 1
    comp.addPass(renderPass)

    const bloom = new UnrealBloomPass(
      new THREE.Vector2(size.width, size.height),
      lightingState.bloomIntensity,
      0.4,
      0.85,
    )
    comp.addPass(bloom)
    bloomRef.current = bloom

    const bokeh = new BokehPass(scene, camera, {
      focus: 28,
      aperture: 0.00015,
      maxblur: 0.004,
    })
    comp.addPass(bokeh)
    bokehRef.current = bokeh

    const smaa = new SMAAPass()
    comp.addPass(smaa)

    const output = new OutputPass()
    comp.addPass(output)

    composerRef.current = comp

    return () => {
      comp.dispose()
      composerRef.current = null
    }
  }, [gl, scene, camera]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (composerRef.current) {
      composerRef.current.setSize(size.width, size.height)
    }
  }, [size.width, size.height])

  // priority=1 接管渲染：告诉 R3F 本帧由我们调用 composer.render()，
  // 跳过其默认的 gl.render(scene,camera)，消除"composer 渲完又被无后处理的
  // 自动渲染覆盖"的双渲 bug（既省一次完整场景绘制，又让 Bloom/DoF 真正上屏）。
  useFrame(() => {
    if (!composerRef.current) return

    if (bloomRef.current) {
      bloomRef.current.strength = lightingState.bloomIntensity
      const nightFactor = Math.max(0, 1 - Math.max(0, lightingState.sunDir.y) / 0.3)
      bloomRef.current.threshold = 0.82 + nightFactor * 0.08
    }

    if (bokehRef.current) {
      const dist = camera.position.distanceTo(FOCUS_POINT)
      ;(bokehRef.current as any).uniforms.focus.value = dist
    }

    composerRef.current.render()
  }, 1)

  return null
}
