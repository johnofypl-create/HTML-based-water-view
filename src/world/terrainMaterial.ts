/**
 * 地形材质
 * MeshStandardMaterial + onBeforeCompile，注入：
 *  1. biome 混色（按高度 + 坡度）
 *  2. 水下焦散（worldY < waterLevel 时加 voronoi 暖光）
 *  3. 侧面岩层条纹（aSide=1 按 aHeight 做沙/壤/岩交替）→ 物理模型感
 *  4. 噪声微变化避免单调
 *
 * 用 onBeforeCompile 而非纯 ShaderMaterial：自动兼容 PBR 光照、fog、阴影、tonemapping。
 */
import * as THREE from 'three'
import { GLSL_HASH, GLSL_VORONOI } from '../utils/glslChunks'
import { WATER_LEVEL } from '../config/constants'

export interface TerrainMaterial extends THREE.MeshStandardMaterial {
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

export function createTerrainMaterial(): TerrainMaterial {
  const mat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#6f8246'),
    roughness: 0.92,
    metalness: 0.0,
    flatShading: false,
  }) as TerrainMaterial

  const uniforms = {
    uTime: { value: 0 },
    uWaterLevel: { value: WATER_LEVEL },
    uSunDir: { value: new THREE.Vector3(0.4, 0.8, 0.3).normalize() },
    uSunColor: { value: new THREE.Color('#fff0d0') },
    uCausticStrength: { value: 0.6 },
    uFogColor: { value: new THREE.Color('#cfe0e8') },
    uFogDensity: { value: 0.012 },
  }
  mat.uniforms = uniforms

  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms)

    // ---- 顶点：传世界坐标、高度、侧面标记 ----
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
         attribute float aSide;
         attribute float aHeight;
         varying vec3 vWorldPos;
         varying float vSide;
         varying float vHeight;
         varying vec3 vWorldNormal;`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
         vSide = aSide;
         vHeight = aHeight;`,
      )
      .replace(
        '#include <worldpos_vertex>',
        `#include <worldpos_vertex>
         vWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
         vWorldNormal = normalize(mat3(modelMatrix) * normal);`,
      )

    // ---- 片段：biome 混色 + 焦散 + 侧面条纹 ----
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
         ${GLSL_HASH}
         ${GLSL_VORONOI}
         uniform float uTime;
         uniform float uWaterLevel;
         uniform vec3 uSunDir;
         uniform vec3 uSunColor;
         uniform float uCausticStrength;
         varying vec3 vWorldPos;
         varying float vSide;
         varying float vHeight;
         varying vec3 vWorldNormal;

         // 自然调色板（提亮+增饱和，向明亮玩具感靠拢）
         vec3 sandDry()   { return vec3(0.90, 0.81, 0.64); }
         vec3 sandWet()   { return vec3(0.77, 0.65, 0.49); }
         vec3 duneCol()   { return vec3(0.84, 0.73, 0.56); }
         vec3 grassBright(){ return vec3(0.62, 0.70, 0.42); }
         vec3 grassMid()  { return vec3(0.52, 0.61, 0.33); }
         vec3 grassDry()  { return vec3(0.70, 0.66, 0.42); }
         vec3 bushCol()   { return vec3(0.30, 0.42, 0.25); }
         vec3 forestDeep(){ return vec3(0.21, 0.33, 0.22); }
         vec3 forestMid() { return vec3(0.28, 0.42, 0.27); }
         vec3 forestLight(){ return vec3(0.35, 0.50, 0.30); }
         vec3 rockLight() { return vec3(0.64, 0.60, 0.56); }
         vec3 rockMid()   { return vec3(0.52, 0.47, 0.43); }
         vec3 rockDark()  { return vec3(0.39, 0.34, 0.30); }
         vec3 wetSeaBed() { return vec3(0.58, 0.55, 0.45); }
         vec3 deepSeaBed(){ return vec3(0.33, 0.37, 0.41); }

         // 顶面 biome 颜色（按高度 + 坡度）
         vec3 topBiomeColor(float h, float slope, vec2 wp) {
           float n = vnoise(wp * 0.5) * 0.05 - 0.025; // 微变化（减弱，大色块感）
           vec3 col;
           if (h < -2.0) {
             col = mix(deepSeaBed(), wetSeaBed(), smoothstep(-4.0, -2.0, h));
           } else if (h < -0.35) {
             col = mix(wetSeaBed(), sandWet(), smoothstep(-2.0, -0.35, h));
           } else if (h < 0.12) {
             col = mix(sandWet(), sandDry(), smoothstep(-0.35, 0.12, h));
           } else if (h < 0.55) {
             col = mix(sandDry(), duneCol(), smoothstep(0.12, 0.55, h));
           } else if (h < 1.1) {
             float g = smoothstep(0.6, 1.1, h);
             col = mix(duneCol(), mix(grassDry(), grassBright(), 0.5), g);
           } else if (slope > 0.56) { // ~32°
             col = mix(rockMid(), rockDark(), vnoise(wp * 0.3));
           } else if (h < 2.6) {
             col = mix(grassBright(), grassMid(), vnoise(wp * 0.4));
           } else if (h < 5.2) {
             float t = smoothstep(2.6, 5.2, h);
             vec3 g = mix(grassMid(), grassBright(), 0.4);
             col = mix(g, mix(forestLight(), forestMid(), vnoise(wp*0.5)), t);
             if (slope > 0.49) col = mix(col, rockMid(), 0.4); // ~28°
           } else {
             col = mix(rockMid(), rockLight(), vnoise(wp * 0.25));
           }
           return col + n;
         }

         // 侧面岩层条纹（物理模型截面）
         vec3 sideStrataColor(float h, vec2 wp) {
           // 按高度分层：沙/壤/岩交替
           float bands = sin(h * 1.8 + vnoise(wp * 0.15) * 1.5);
           vec3 sand = vec3(0.79, 0.69, 0.53);
           vec3 soil = vec3(0.48, 0.39, 0.31);
           vec3 rock = vec3(0.36, 0.32, 0.28);
           vec3 col = mix(soil, rock, smoothstep(0.0, 1.0, bands));
           col = mix(sand, col, smoothstep(-1.0, 0.5, bands) * 0.7);
           // 细节噪声
           col += (vnoise(wp * 3.0) - 0.5) * 0.05;
           // 底部偏暗
           col *= 0.7 + 0.3 * smoothstep(-9.0, 0.0, h);
           return col;
         }

         // 水下焦散（双层 voronoi，更丰富的光斑）
         vec3 causticColor(vec3 wp, float depth) {
           float t = uTime * 0.4;
           // 层1：大尺度，慢移动
           vec3 c1 = voronoi3(wp * 0.55 + vec3(t * 0.5, 0.0, t * 0.4));
           vec3 c2 = voronoi3(wp * 0.55 + vec3(-t * 0.6, t * 0.4, 0.0) + 11.0);
           float caustic1 = pow(1.0 - min(c1.x, c2.x), 6.0);
           // 层2：小尺度，快移动，更锐利
           vec3 c3 = voronoi3(wp * 1.3 + vec3(t * 0.7, t * 0.3, -t * 0.5) + 5.0);
           float caustic2 = pow(1.0 - c3.x, 3.5) * 0.55;
           float caustic = max(caustic1, caustic2);
           float atten = clamp(1.0 - depth / 5.0, 0.0, 1.0);
           return uSunColor * caustic * atten * uCausticStrength;
         }
        `,
      )
      .replace(
        '#include <map_fragment>',
        `#include <map_fragment>
         vec2 wp = vWorldPos.xz;
         if (vSide > 0.5) {
           // 侧面岩层条纹
           diffuseColor.rgb = sideStrataColor(vHeight, wp);
         } else {
           // 顶面 biome
           float slope = acos(clamp(vWorldNormal.y, -1.0, 1.0));
           diffuseColor.rgb = topBiomeColor(vHeight, slope, wp);
           // 水下焦散
           if (vWorldPos.y < uWaterLevel) {
             float depth = uWaterLevel - vWorldPos.y;
             diffuseColor.rgb += causticColor(vWorldPos, depth);
             // 水下整体偏冷偏暗
            diffuseColor.rgb *= mix(1.0, 0.55, smoothstep(0.0, 3.0, depth));
          }
          // 饱和度补偿（ACES tonemapping 会降饱和，主动拉回）
          float lum = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
          diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * 1.18 - lum * 0.09, 0.55);
        }
        `,
      )
  }

  mat.customProgramCacheKey = () => 'terrain-material-v1'
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
