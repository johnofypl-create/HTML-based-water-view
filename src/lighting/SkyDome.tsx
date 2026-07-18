/**
 * @module lighting/SkyDome
 * @layer lighting（域层）
 * @purpose 天空穹顶着色器（昼夜渐变）—— WebGPU/TSL 版
 * @dependsOn ['state/lightingState']
 * @exports [SkyDome, SkyDome]
 * @aiEdit
 *   - 改本文件导出的 SkyDome、SkyDome 即可；依赖见 @dependsOn
 */
/**
 * 天空穹顶（TSL 节点版）
 *
 * 原实现基于 ShaderMaterial + GLSL（vertex→vDir、fragment→三色渐变）；
 * WebGPU 下 ShaderMaterial 不兼容，改为 MeshBasicNodeMaterial + colorNode。
 * 逻辑等价：
 *  - BackSide 球壳内表面，半径 400 → 自然落在远端（无需 positionNode）
 *  - colorNode 按 direction.y 做 top/horizon/bottom 三色渐变
 *  - depthWrite=false + renderOrder=-1 保证天空在最底层
 *
 * TSL 经验：
 *  - If 是单 callback + 链式 .Else(fn)；要"返回"值需先 vec3(0).toVar() 声明可写变量
 *  - 勿自定义 positionNode（实测会让整个场景渲染异常，疑似 TSL 内置矩阵的语义陷阱）
 */
import { useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three/webgpu'
import * as TSL from 'three/tsl'
import { lightingState } from '../state/lightingState'

const { Fn, uniform, positionLocal, smoothstep, mix, If, float, vec3 } = TSL as any

export default function SkyDome() {
  const { camera } = useThree()
  const meshRef = useRef<THREE.Mesh>(null)

  const { material, uTop, uBottom, uHorizon } = useMemo(() => {
    const uTop = uniform(new THREE.Color('#5a7a9a'))
    const uBottom = uniform(new THREE.Color('#cfe0e8'))
    const uHorizon = uniform(new THREE.Color('#e8d8c0'))

    const mat = new THREE.MeshBasicNodeMaterial()
    mat.side = THREE.BackSide
    mat.depthWrite = false
    mat.fog = false

    // colorNode：y 方向三色渐变
    mat.colorNode = Fn(() => {
      const dir = positionLocal.normalize()
      const h = dir.y
      const col = vec3(0.0).toVar()
      If(h.greaterThan(0.0), () => {
        col.assign(mix(uHorizon, uTop, smoothstep(0.0, 0.55, h)))
      }).Else(() => {
        col.assign(mix(uHorizon, uBottom, float(1.0).sub(smoothstep(-0.4, 0.0, h))))
      })
      return col
    })()

    return { material: mat, uTop, uBottom, uHorizon }
  }, [])

  useFrame(() => {
    uTop.value.copy(lightingState.skyTop)
    uBottom.value.copy(lightingState.skyBottom)
    const horizon = lightingState.skyBottom.clone().lerp(lightingState.fogColor, 0.5)
    uHorizon.value.copy(horizon)
    if (meshRef.current) {
      meshRef.current.position.copy(camera.position)
    }
  })

  return (
    <mesh ref={meshRef} material={material} renderOrder={-1}>
      <sphereGeometry args={[400, 32, 16]} />
    </mesh>
  )
}
