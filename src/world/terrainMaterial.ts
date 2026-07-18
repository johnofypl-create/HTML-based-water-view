/**
 * @module world/terrainMaterial
 * @layer world（域层）
 * @purpose 地形材质工厂（生物群系配色 + 噪声细节）—— WebGPU/TSL 版
 * @dependsOn ['config/constants']
 * @exports [TerrainMaterial, createTerrainMaterial, updateTerrainMaterial]
 * @aiEdit
 *   - 改本文件导出的 TerrainMaterial、createTerrainMaterial、updateTerrainMaterial 即可；依赖见 @dependsOn
 */
/**
 * 地形材质（TSL 节点版）
 *
 * 原实现基于 MeshStandardMaterial.onBeforeCompile 注入 GLSL；WebGPU 下
 * onBeforeCompile 不工作，改为 MeshStandardNodeMaterial + colorNode（TSL）。
 * 逻辑完全等价：
 *  1. biome 混色（按高度 aHeight + 坡度 normalWorld）
 *  2. 侧面岩层条纹（aSide=1 时按 aHeight 做沙/壤/岩交替）
 *  3. 水下焦散（worldY < waterLevel 时加双层 voronoi 暖光）
 *  4. 饱和度补偿（抵消 ACES tonemapping 降饱和）
 *
 * colorNode 只提供反照率（diffuse），PBR 光照 / fog / 阴影 / tonemapping 由
 * MeshStandardNodeMaterial 自动承接（等价原 onBeforeCompile 改 diffuseColor 的思路）。
 */
import * as THREE from 'three/webgpu'
import * as TSL from 'three/tsl'
import { WATER_LEVEL } from '../config/constants'

// @types/three 的 TSL 节点类型标注过窄（swizzle / Fn 调用参数会被误报），
// 统一以 any 视图解构，节点方法链按运行期真实 API 使用。
const {
  Fn,
  float,
  vec2,
  vec3,
  uniform,
  attribute,
  positionWorld,
  normalWorld,
  floor,
  fract,
  sin,
  dot,
  pow,
  sqrt,
  max,
  min,
  clamp,
  mix,
  smoothstep,
  acos,
  Loop,
  If,
} = TSL as any

export interface TerrainMaterial extends THREE.MeshStandardNodeMaterial {
  uniforms: {
    uTime: { value: number }
    uWaterLevel: { value: number }
    uSunDir: { value: THREE.Vector3 }
    uSunColor: { value: THREE.Color }
    uCausticStrength: { value: number }
    uFogColor: { value: THREE.Color }
    uFogDensity: { value: number }
  }
}

// ============ TSL 复用函数（等价 utils/glslChunks 的 GLSL_HASH / GLSL_VORONOI）============

/** hash21：vec2 → float 哈希 */
const hash21 = Fn(([p]: any) => {
  const p3 = fract(vec3(p.x, p.y, p.x).mul(0.1031)).toVar()
  p3.addAssign(dot(p3, p3.yzx.add(33.33)))
  return fract(p3.x.add(p3.y).mul(p3.z))
})

/** vnoise：2D 值噪声 */
const vnoise = Fn(([p]: any) => {
  const i = floor(p).toVar()
  const f = fract(p).toVar()
  const u = f.mul(f).mul(float(3.0).sub(f.mul(2.0))).toVar()
  const a = hash21(i)
  const b = hash21(i.add(vec2(1.0, 0.0)))
  const c = hash21(i.add(vec2(0.0, 1.0)))
  const d = hash21(i.add(vec2(1.0, 1.0)))
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y)
})

/** voronoi3：3D voronoi（用于水下焦散），返回 vec3(sqrt(md), id, 8) */
const voronoi3 = Fn(([x]: any) => {
  const p = floor(x).toVar()
  const f = fract(x).toVar()
  const id = float(0.0).toVar()
  const md = float(8.0).toVar()

  Loop({ start: -1, end: 2 }, ({ i: kk }: any) => {
    Loop({ start: -1, end: 2 }, ({ i: jj }: any) => {
      Loop({ start: -1, end: 2 }, ({ i: ii }: any) => {
        const b = vec3(float(ii), float(jj), float(kk)).toVar()
        const pb = p.add(b).toVar()
        const hv = hash21(pb.xy.add(pb.z.mul(17.0)))
        const s = sin(hv.mul(6.2831)).mul(0.5)
        const r = b.add(0.5).add(s)
        const d = b.sub(f).add(r)
        const dd = dot(d, d)
        If(dd.lessThan(md), () => {
          md.assign(dd)
          id.assign(hash21(pb.xy))
        })
      })
    })
  })

  return vec3(sqrt(md), id, float(8.0))
})

// ============ 自然调色板（提亮+增饱和，向明亮玩具感靠拢）============
const sandDry = vec3(0.9, 0.81, 0.64)
const sandWet = vec3(0.77, 0.65, 0.49)
const duneCol = vec3(0.84, 0.73, 0.56)
const grassBright = vec3(0.62, 0.7, 0.42)
const grassMid = vec3(0.52, 0.61, 0.33)
const grassDry = vec3(0.7, 0.66, 0.42)
const forestMid = vec3(0.28, 0.42, 0.27)
const forestLight = vec3(0.35, 0.5, 0.3)
const rockLight = vec3(0.64, 0.6, 0.56)
const rockMid = vec3(0.52, 0.47, 0.43)
const rockDark = vec3(0.39, 0.34, 0.3)
const wetSeaBed = vec3(0.58, 0.55, 0.45)
const deepSeaBed = vec3(0.33, 0.37, 0.41)

/** 顶面 biome 颜色（按高度 h + 坡度 slope + 世界 xz） */
const topBiomeColor = Fn(([h, slope, wp]: any) => {
  const n = vnoise(wp.mul(0.5)).mul(0.05).sub(0.025) // 微变化（大色块感）
  const col = vec3(0.0).toVar()
  If(h.lessThan(-2.0), () => {
    col.assign(mix(deepSeaBed, wetSeaBed, smoothstep(-4.0, -2.0, h)))
  })
    .ElseIf(h.lessThan(-0.35), () => {
      col.assign(mix(wetSeaBed, sandWet, smoothstep(-2.0, -0.35, h)))
    })
    .ElseIf(h.lessThan(0.12), () => {
      col.assign(mix(sandWet, sandDry, smoothstep(-0.35, 0.12, h)))
    })
    .ElseIf(h.lessThan(0.55), () => {
      col.assign(mix(sandDry, duneCol, smoothstep(0.12, 0.55, h)))
    })
    .ElseIf(h.lessThan(1.1), () => {
      const g = smoothstep(0.6, 1.1, h)
      col.assign(mix(duneCol, mix(grassDry, grassBright, 0.5), g))
    })
    .ElseIf(slope.greaterThan(0.56), () => {
      // ~32°
      col.assign(mix(rockMid, rockDark, vnoise(wp.mul(0.3))))
    })
    .ElseIf(h.lessThan(2.6), () => {
      col.assign(mix(grassBright, grassMid, vnoise(wp.mul(0.4))))
    })
    .ElseIf(h.lessThan(5.2), () => {
      const t = smoothstep(2.6, 5.2, h)
      const g = mix(grassMid, grassBright, 0.4)
      col.assign(mix(g, mix(forestLight, forestMid, vnoise(wp.mul(0.5))), t))
      If(slope.greaterThan(0.49), () => {
        // ~28°
        col.assign(mix(col, rockMid, 0.4))
      })
    })
    .Else(() => {
      col.assign(mix(rockMid, rockLight, vnoise(wp.mul(0.25))))
    })
  return col.add(n)
})

/** 侧面岩层条纹（物理模型截面） */
const sideStrataColor = Fn(([h, wp]: any) => {
  const bands = sin(h.mul(1.8).add(vnoise(wp.mul(0.15)).mul(1.5)))
  const sand = vec3(0.79, 0.69, 0.53)
  const soil = vec3(0.48, 0.39, 0.31)
  const rock = vec3(0.36, 0.32, 0.28)
  const col = mix(soil, rock, smoothstep(0.0, 1.0, bands)).toVar()
  col.assign(mix(sand, col, smoothstep(-1.0, 0.5, bands).mul(0.7)))
  col.addAssign(vnoise(wp.mul(3.0)).sub(0.5).mul(0.05)) // 细节噪声
  col.mulAssign(float(0.7).add(smoothstep(-9.0, 0.0, h).mul(0.3))) // 底部偏暗
  return col
})

export function createTerrainMaterial(): TerrainMaterial {
  const mat = new THREE.MeshStandardNodeMaterial({
    color: new THREE.Color('#6f8246'),
    roughness: 0.92,
    metalness: 0.0,
    flatShading: false,
  }) as TerrainMaterial

  // TSL uniform 节点（.value 与旧接口一致，updateTerrainMaterial 每帧写入）
  const uTime = uniform(0)
  const uWaterLevel = uniform(WATER_LEVEL)
  const uSunColor = uniform(new THREE.Color('#fff0d0'))
  const uCausticStrength = uniform(0.6)

  /** 水下焦散（双层 voronoi） */
  const causticColor = Fn(([wp, depth]: any) => {
    const t = uTime.mul(0.4)
    // 层1：大尺度，慢移动
    const c1 = voronoi3(wp.mul(0.55).add(vec3(t.mul(0.5), 0.0, t.mul(0.4))))
    const c2 = voronoi3(wp.mul(0.55).add(vec3(t.mul(-0.6), t.mul(0.4), 0.0)).add(11.0))
    const caustic1 = pow(float(1.0).sub(min(c1.x, c2.x)), 6.0)
    // 层2：小尺度，快移动，更锐利
    const c3 = voronoi3(wp.mul(1.3).add(vec3(t.mul(0.7), t.mul(0.3), t.mul(-0.5))).add(5.0))
    const caustic2 = pow(float(1.0).sub(c3.x), 3.5).mul(0.55)
    const caustic = max(caustic1, caustic2)
    const atten = clamp(float(1.0).sub(depth.div(5.0)), 0.0, 1.0)
    return uSunColor.mul(caustic).mul(atten).mul(uCausticStrength)
  })

  // ---- colorNode：反照率（等价原 onBeforeCompile 改 diffuseColor.rgb）----
  mat.colorNode = Fn(() => {
    const vHeight = attribute('aHeight')
    const vSide = attribute('aSide')
    const wp = positionWorld.xz.toVar()
    const outCol = vec3(0.0).toVar()

    If(vSide.greaterThan(0.5), () => {
      // 侧面岩层条纹
      outCol.assign(sideStrataColor(vHeight, wp))
    }).Else(() => {
      // 顶面 biome
      const slope = acos(clamp(normalWorld.y, -1.0, 1.0))
      outCol.assign(topBiomeColor(vHeight, slope, wp))
      // 水下焦散
      If(positionWorld.y.lessThan(uWaterLevel), () => {
        const depth = uWaterLevel.sub(positionWorld.y)
        outCol.addAssign(causticColor(positionWorld, depth))
        // 水下整体偏冷偏暗
        outCol.mulAssign(mix(float(1.0), float(0.55), smoothstep(0.0, 3.0, depth)))
      })
      // 饱和度补偿（ACES tonemapping 会降饱和，主动拉回）
      const lum = dot(outCol, vec3(0.299, 0.587, 0.114))
      outCol.assign(mix(outCol, outCol.mul(1.18).sub(lum.mul(0.09)), 0.55))
    })

    return outCol
  })()

  // 保留 uniforms 引用供 updateTerrainMaterial（uSunDir/uFogColor/uFogDensity 当前
  // 不参与节点图，占位以维持接口稳定）
  mat.uniforms = {
    uTime,
    uWaterLevel: uWaterLevel as unknown as { value: number },
    uSunDir: { value: new THREE.Vector3(0.4, 0.8, 0.3).normalize() },
    uSunColor: uSunColor as unknown as { value: THREE.Color },
    uCausticStrength: uCausticStrength as unknown as { value: number },
    uFogColor: { value: new THREE.Color('#cfe0e8') },
    uFogDensity: { value: 0.012 },
  } as TerrainMaterial['uniforms']

  return mat
}

/** 每帧更新地形材质 uniform（时间、光照） */
export function updateTerrainMaterial(
  mat: TerrainMaterial,
  time: number,
  sunDir: THREE.Vector3,
  sunColor: THREE.Color,
  fogColor: THREE.Color,
  fogDensity: number,
) {
  mat.uniforms.uTime.value = time
  mat.uniforms.uSunDir.value.copy(sunDir)
  mat.uniforms.uSunColor.value.copy(sunColor)
  mat.uniforms.uFogColor.value.copy(fogColor)
  mat.uniforms.uFogDensity.value = fogDensity
}
