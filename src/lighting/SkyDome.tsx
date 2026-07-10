/**
 * @module lighting/SkyDome
 * @layer lighting（域层）
 * @purpose 天空穹顶着色器（昼夜渐变）
 * @dependsOn ['state/lightingState']
 * @exports [SkyDome, SkyDome]
 * @aiEdit
 *   - 改本文件导出的 SkyDome、SkyDome 即可；依赖见 @dependsOn
 */
/**
 * 天空穹顶
 * 大球壳内表面，渐变 shader（skyTop → skyBottom 按 y 方向）。
 * 跟随相机位置，永远包围相机。颜色每帧从 lightingState 更新。
 */
import { useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { lightingState } from '../state/lightingState'

export default function SkyDome() {
  const { camera } = useThree()
  const meshRef = useRef<THREE.Mesh>(null)

  const material = useMemo(() => {
    return new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: {
        uTop: { value: new THREE.Color('#5a7a9a') },
        uBottom: { value: new THREE.Color('#cfe0e8') },
        uHorizon: { value: new THREE.Color('#e8d8c0') },
      },
      vertexShader: /* glsl */ `
        varying vec3 vDir;
        void main() {
          vDir = normalize(position);
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mvPosition;
          gl_Position.z = gl_Position.w; // 推到最远
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 uTop;
        uniform vec3 uBottom;
        uniform vec3 uHorizon;
        varying vec3 vDir;
        void main() {
          float h = normalize(vDir).y;
          vec3 col;
          if (h > 0.0) {
            col = mix(uHorizon, uTop, smoothstep(0.0, 0.55, h));
          } else {
            col = mix(uHorizon, uBottom, (1.0 - smoothstep(-0.4, 0.0, h)));
          }
          gl_FragColor = vec4(col, 1.0);
        }
      `,
    })
  }, [])

  useFrame(() => {
    material.uniforms.uTop.value.copy(lightingState.skyTop)
    material.uniforms.uBottom.value.copy(lightingState.skyBottom)
    const horizon = lightingState.skyBottom.clone().lerp(lightingState.fogColor, 0.5)
    material.uniforms.uHorizon.value.copy(horizon)
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
