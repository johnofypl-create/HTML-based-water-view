/**
 * @module world/River
 * @layer world（域层）
 * @purpose 河流组件
 * @dependsOn ['utils/terrain', 'config/constants', 'state/lightingState']
 * @exports [River, River]
 * @aiEdit
 *   - 改本文件导出的 River、River 即可；依赖见 @dependsOn
 */
/**
 * 河流
 * 沿 Catmull-Rom 样条生成水面 strip，复用水着色器但加流向。
 * 河流水面略高于海面避免 Z-fighting，入海口用泡沫过渡。
 */
import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { getRiverPath, RIVER_HALF_WIDTH, riverTangentAt } from '../utils/terrain'
import { WATER_LEVEL } from '../config/constants'
import { lightingState } from '../state/lightingState'

export default function River() {
  const matRef = useRef<THREE.ShaderMaterial>(null)

  const geometry = useMemo(() => {
    const path = getRiverPath(160)
    const verts: number[] = []
    const indices: number[] = []
    const uvs: number[] = []
    for (let i = 0; i < path.length; i++) {
      const [x, z] = path[i]
      const [tx, tz] = riverTangentAt(x, z)
      // 法向量（垂直于切线）
      const nx = -tz
      const nz = tx
      const hw = RIVER_HALF_WIDTH
      // 左右岸点
      verts.push(x + nx * hw, WATER_LEVEL + 0.03, z + nz * hw)
      verts.push(x - nx * hw, WATER_LEVEL + 0.03, z - nz * hw)
      uvs.push(0, i / path.length)
      uvs.push(1, i / path.length)
    }
    for (let i = 0; i < path.length - 1; i++) {
      const a = i * 2
      indices.push(a, a + 1, a + 3)
      indices.push(a, a + 3, a + 2)
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3))
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
    g.setIndex(indices)
    g.computeVertexNormals()
    return g
  }, [])

  const material = useMemo(() => {
    return new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      uniforms: {
        uTime: { value: 0 },
        uColor: { value: new THREE.Color('#4ab0b8') },
        uDeepColor: { value: new THREE.Color('#2a7888') },
        uFoam: { value: new THREE.Color('#eef0e8') },
        uSunColor: { value: new THREE.Color('#ffe9c4') },
        uFogColor: { value: new THREE.Color('#d4e2ea') },
        uFogDensity: { value: 0.011 },
      },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        varying vec3 vWorldPos;
        void main() {
          vUv = uv;
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWorldPos = wp.xyz;
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uTime;
        uniform vec3 uColor;
        uniform vec3 uDeepColor;
        uniform vec3 uFoam;
        uniform vec3 uSunColor;
        uniform vec3 uFogColor;
        uniform float uFogDensity;
        varying vec2 vUv;
        varying vec3 vWorldPos;

        float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float vnoise(vec2 p){
          vec2 i=floor(p), f=fract(p);
          vec2 u=f*f*(3.0-2.0*f);
          return mix(mix(hash(i),hash(i+vec2(1,0)),u.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),u.x),u.y);
        }

        void main() {
          // 沿流向滚动 UV 制造流动感
          float flow = vUv.y * 8.0 - uTime * 1.2;
          float ripple = vnoise(vec2(vUv.x * 6.0, flow)) * 0.5 + 0.5;
          float ripple2 = vnoise(vec2(vUv.x * 12.0, flow * 1.5 + 5.0)) * 0.5 + 0.5;

          // 中心深、两岸浅
          float center = abs(vUv.x - 0.5) * 2.0;
          vec3 col = mix(uColor, uDeepColor, 1.0 - center);
          col += (ripple - 0.5) * 0.08 * uSunColor;
          col += (ripple2 - 0.5) * 0.05;

          // 岸边泡沫
          float foam = smoothstep(0.85, 1.0, center) * (vnoise(vec2(vUv.x*10.0, flow*2.0))*0.5+0.5);
          col = mix(col, uFoam, foam * 0.7);

          float alpha = 0.82;

          gl_FragColor = vec4(col, alpha);
        }
      `,
    })
  }, [])

  useFrame((_, delta) => {
    if (matRef.current) {
      matRef.current.uniforms.uTime.value += delta
      matRef.current.uniforms.uSunColor.value.copy(lightingState.sunColor)
      matRef.current.uniforms.uFogColor.value.copy(lightingState.fogColor)
      matRef.current.uniforms.uFogDensity.value = lightingState.fogDensity
      // 夜晚河流色偏冷暗
      const nightFactor = lightingState.sunDir.y < 0.1 ? 1 - Math.max(0, lightingState.sunDir.y / 0.1) : 0
      ;(matRef.current.uniforms.uColor.value as THREE.Color).setRGB(
        0.29 - nightFactor * 0.1, 0.69 - nightFactor * 0.2, 0.72 - nightFactor * 0.15,
      )
    }
  })

  return (
    <mesh geometry={geometry}>
      <primitive object={material} ref={matRef} attach="material" />
    </mesh>
  )
}
