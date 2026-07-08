import { useMemo, useEffect } from 'react'
import * as THREE from 'three'
import { generateTerrainGeometry } from './TerrainGeometry'
import { COLORS } from '../../config/palette'

export function Terrain() {
  const { geometry } = useMemo(() => {
    return generateTerrainGeometry()
  }, [])

  const terrainMaterial = useMemo(() => {
    const sandColor = new THREE.Color(COLORS.sand.medium)
    const grassColor = new THREE.Color(COLORS.green.grass)
    const rockColor = new THREE.Color(COLORS.rock.cliff)

    const vertexShader = `
      varying vec3 vColor;
      varying vec3 vWorldPosition;

      void main() {
        vColor = color;
        vec4 worldPos = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPos.xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `

    const fragmentShader = `
      varying vec3 vColor;
      varying vec3 vWorldPosition;
      uniform vec3 sandColor;
      uniform vec3 grassColor;
      uniform vec3 rockColor;
      uniform vec3 lightDirection;

      void main() {
        float sandWeight = vColor.r;
        float grassWeight = vColor.g;
        float rockWeight = vColor.b;

        vec3 baseColor = sandWeight * sandColor +
                     grassWeight * grassColor +
                     rockWeight * rockColor;

        // 简单光照模拟
        float light = 0.5 + 0.5 * dot(normalize(vec3(0.5, 0.8, 0.3)), vec3(0.0, 0.0, 1.0));
        vec3 color = baseColor * (0.7 + light * 0.3);

        gl_FragColor = vec4(color, 1.0);
      }
    `

    return new THREE.ShaderMaterial({
      uniforms: {
        sandColor: { value: sandColor },
        grassColor: { value: grassColor },
        rockColor: { value: rockColor },
      },
      vertexShader,
      fragmentShader,
      vertexColors: true,
    })
  }, [])

  const sideGeometry = useMemo(() => {
    return buildSideGeometry(geometry)
  }, [geometry])

  const sideMaterial = useMemo(() => {
    const sandColor = new THREE.Color(COLORS.sand.medium)
    const grassColor = new THREE.Color(COLORS.green.grass)
    const rockColor = new THREE.Color(COLORS.rock.cliff)

    const vertexShader = `
      varying vec3 vColor;
      attribute vec3 color;

      void main() {
        vColor = color;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `

    const fragmentShader = `
      varying vec3 vColor;
      uniform vec3 sandColor;
      uniform vec3 grassColor;
      uniform vec3 rockColor;

      void main() {
        float sandWeight = vColor.r;
        float grassWeight = vColor.g;
        float rockWeight = vColor.b;

        vec3 color = sandWeight * sandColor +
                     grassWeight * grassColor +
                     rockWeight * rockColor;
        color *= 0.85;

        gl_FragColor = vec4(color, 1.0);
      }
    `

    return new THREE.ShaderMaterial({
      uniforms: {
        sandColor: { value: sandColor },
        grassColor: { value: grassColor },
        rockColor: { value: rockColor },
      },
      vertexShader,
      fragmentShader,
      vertexColors: true,
    })
  }, [])

  // 清理材质和几何体
  useEffect(() => {
    return () => {
      terrainMaterial.dispose()
      sideMaterial.dispose()
      geometry.dispose()
      sideGeometry.dispose()
    }
  }, [terrainMaterial, sideMaterial, geometry, sideGeometry])

  return (
    <group position={[0, 0, 0]}>
      <mesh
        geometry={geometry}
        material={terrainMaterial}
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
        castShadow
      />

      <mesh
        geometry={sideGeometry}
        material={sideMaterial}
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
        castShadow
      />
    </group>
  )
}

// 构建侧面垂直壁，形成从方块切割出来的效果
function buildSideGeometry(planeGeometry: THREE.PlaneGeometry): THREE.BufferGeometry {
  const positions = planeGeometry.attributes.position.array as Float32Array
  const colors = planeGeometry.attributes.color.array as Float32Array
  const vertexCount = positions.length / 3
  const segCount = Math.sqrt(vertexCount)
  const baseLevel = -1.0

  const sidePositions: number[] = []
  const sideColors: number[] = []

  // 辅助函数：获取顶点数据
  function getVertex(i: number, j: number): { x: number; y: number; z: number; r: number; g: number; b: number } {
    const idx = i * segCount + j
    return {
      x: positions[idx * 3 + 0],
      y: positions[idx * 3 + 1],
      z: positions[idx * 3 + 2],
      r: colors[idx * 3 + 0],
      g: colors[idx * 3 + 1],
      b: colors[idx * 3 + 2],
    }
  }

  // 添加一个四边形（两个三角形）形成侧壁
  function addQuad(
    v0: ReturnType<typeof getVertex>,
    v1: ReturnType<typeof getVertex>,
    topZ0: number,
    topZ1: number,
    isHorizontal: boolean
  ) {
    // 顶部边上两个顶点
    const h0 = topZ0
    const h1 = topZ1

    // 顶点：顶部左/前, 底部左/前, 顶部右/后, 底部右/后
    let x0, y0, x1, y1
    if (isHorizontal) {
      x0 = v0.x; y0 = v0.y
      x1 = v1.x; y1 = v1.y
    } else {
      x0 = v0.x; y0 = v0.y
      x1 = v1.x; y1 = v1.y
    }

    sidePositions.push(x0, y0, h0)
    sidePositions.push(x0, y0, baseLevel)
    sidePositions.push(x1, y1, h1)
    sidePositions.push(x1, y1, baseLevel)

    // 颜色用两个顶点的平均
    const r = (v0.r + v1.r) / 2
    const g = (v0.g + v1.g) / 2
    const b = (v0.b + v1.b) / 2
    sideColors.push(r, g, b)
    sideColors.push(r, g, b)
    sideColors.push(r, g, b)
    sideColors.push(r, g, b)
  }

  // 左边缘 (i = 0)
  for (let j = 0; j < segCount - 1; j++) {
    const v0 = getVertex(0, j)
    const v1 = getVertex(0, j + 1)
    addQuad(v0, v1, v0.z, v1.z, false)
  }

  // 右边缘 (i = segCount - 1)
  for (let j = 0; j < segCount - 1; j++) {
    const v0 = getVertex(segCount - 1, j)
    const v1 = getVertex(segCount - 1, j + 1)
    addQuad(v0, v1, v0.z, v1.z, false)
  }

  // 下边缘 (j = 0)
  for (let i = 0; i < segCount - 1; i++) {
    const v0 = getVertex(i, 0)
    const v1 = getVertex(i + 1, 0)
    addQuad(v0, v1, v0.z, v1.z, true)
  }

  // 上边缘 (j = segCount - 1)
  for (let i = 0; i < segCount - 1; i++) {
    const v0 = getVertex(i, segCount - 1)
    const v1 = getVertex(i + 1, segCount - 1)
    addQuad(v0, v1, v0.z, v1.z, true)
  }

  // 构建索引（每4个顶点为一个四边形，两个三角形）
  const indices: number[] = []
  const quadCount = sidePositions.length / 12
  for (let q = 0; q < quadCount; q++) {
    const base = q * 4
    indices.push(base, base + 1, base + 2)
    indices.push(base + 2, base + 1, base + 3)
  }

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(sidePositions, 3))
  geo.setAttribute('color', new THREE.Float32BufferAttribute(sideColors, 3))
  geo.setIndex(indices)
  geo.computeVertexNormals()

  return geo
}

export default Terrain