/**
 * 后处理管线（three 内置 EffectComposer）+ 帧循环管理
 *
 * 与 App.tsx Canvas `frameloop="demand"` 配合：
 * 每次 useFrame 调用 composer.render() 后 invalidate() 请求下一帧，
 * 形成连续渲染循环。
 *
 * 管线：RenderPass → UnrealBloomPass → BokehPass(DoF) → SMAAPass → OutputPass(ACES+sRGB)
 * BokehPass 产生浅景深——微缩模型美学的关键：真实相机拍微缩模型必然有景深。
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

/** 场景焦点（世界坐标，BokehPass 合焦点随相机距离动态调整） */
const FOCUS_POINT = new THREE.Vector3(0, 1.5, -4)

export default function Effects() {
  const { gl, scene, camera, size, invalidate } = useThree()
  const bloomRef = useRef<UnrealBloomPass | null>(null)
  const bokehRef = useRef<BokehPass | null>(null)
  const composerRef = useRef<EffectComposer | null>(null)

  // 首次挂载初始化 composer（gl/scene/camera 引用稳定）
  useEffect(() => {
    const comp = new EffectComposer(gl)

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

    // DoF 景深：微缩模型美学核心
    const bokeh = new BokehPass(scene, camera, {
      focus: 28,
      aperture: 0.00035,
      maxblur: 0.012,
    })
    comp.addPass(bokeh)
    bokehRef.current = bokeh

    const smaa = new SMAAPass(size.width, size.height)
    comp.addPass(smaa)

    const output = new OutputPass()
    comp.addPass(output)

    composerRef.current = comp
    invalidate()

    return () => {
      comp.dispose()
      composerRef.current = null
    }
  }, [gl, scene, camera]) // eslint-disable-line react-hooks/exhaustive-deps

  // resize
  useEffect(() => {
    if (composerRef.current) {
      composerRef.current.setSize(size.width, size.height)
    }
  }, [size.width, size.height])

  // 每帧：更新参数 → 渲染 composer → 请求下一帧
  useFrame(() => {
    if (!composerRef.current) return

    if (bloomRef.current) {
      bloomRef.current.strength = lightingState.bloomIntensity
      const nightFactor = Math.max(0, 1 - Math.max(0, lightingState.sunDir.y) / 0.3)
      bloomRef.current.threshold = 0.82 + nightFactor * 0.08
    }

    // 动态景深：合焦点 = 相机到场景中心的距离
    // 这样用户缩放时景深自然跟随——近处清晰远处模糊，强化微缩感
    if (bokehRef.current) {
      const dist = camera.position.distanceTo(FOCUS_POINT)
      ;(bokehRef.current as any).uniforms.focus.value = dist
    }

    composerRef.current.render()
    invalidate()
  })

  return null
}
