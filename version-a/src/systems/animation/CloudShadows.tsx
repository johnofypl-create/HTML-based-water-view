import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { TERRAIN_CONFIG } from '../../config/constants'

export function CloudShadows() {
  const meshRef = useRef<THREE.Mesh>(null)
  const shaderRef = useRef<THREE.ShaderMaterial>(null!)

  const geometry = useMemo(() => {
    const size = Math.max(TERRAIN_CONFIG.width, TERRAIN_CONFIG.depth) + 10
    return new THREE.PlaneGeometry(size, size)
  }, [])

  const material = useMemo(() => {
    const canvas = document.createElement('canvas')
    const texSize = 128
    canvas.width = texSize
    canvas.height = texSize
    const ctx = canvas.getContext('2d')!

    const imageData = ctx.createImageData(texSize, texSize)
    const data = imageData.data

    for (let i = 0; i < data.length; i += 4) {
      const x = (i / 4) % texSize
      const y = Math.floor((i / 4) / texSize)

      let value = 0
      let scale = 1
      let weightSum = 0

      for (let o = 0; o < 4; o++) {
        const sx = Math.floor((x * scale) / 4)
        const sy = Math.floor((y * scale) / 4)
        const noise = (Math.sin(sx * 0.5 + sy * 0.7) * Math.cos(sx * 0.3 - sy * 0.5)) * 0.5 + 0.5
        value += noise * scale
        weightSum += scale
        scale *= 0.5
      }

      value /= weightSum
      value = 0.5 + (value - 0.5) * 0.6

      data[i] = data[i + 1] = data[i + 2] = Math.floor(value * 255)
      data[i + 3] = 255
    }

    ctx.putImageData(imageData, 0, 0)
    const noiseTexture = new THREE.CanvasTexture(canvas)
    noiseTexture.needsUpdate = true
    noiseTexture.wrapS = THREE.RepeatWrapping
    noiseTexture.wrapT = THREE.RepeatWrapping

    const shaderMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uNoiseTexture: { value: noiseTexture },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform sampler2D uNoiseTexture;
        varying vec2 vUv;

        void main() {
          vec2 uv = vUv + uTime * 0.005;
          float noise1 = texture2D(uNoiseTexture, uv).r;
          float noise2 = texture2D(uNoiseTexture, uv * 0.5 + uTime * 0.002).r * 0.5;
          float noise = mix(noise1, noise2, 0.3);
          float shadowStrength = (noise - 0.5) * 0.3;
          vec3 color = vec3(1.0 - shadowStrength);
          float alpha = 0.15 + shadowStrength;
          gl_FragColor = vec4(color, alpha);
        }
      `,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    })

    shaderRef.current = shaderMaterial
    return shaderMaterial
  }, [])

  useFrame((_, delta) => {
    if (shaderRef.current) {
      shaderRef.current.uniforms.uTime.value += delta
    }
  })

  return (
    <mesh
      ref={meshRef}
      geometry={geometry}
      material={material}
      position={[0, 7, 0]}
      rotation={[-Math.PI / 2, 0, 0]}
    />
  )
}

export default CloudShadows