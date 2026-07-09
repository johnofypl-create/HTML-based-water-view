/**
 * 水着色器材质（海洋）
 * 自定义 ShaderMaterial：
 *  顶点：Gerstner 波位移 + 解析法线重算
 *  片段：深度色（采样地形高度纹理）+ 岸线泡沫 + 菲涅尔 + 手动指数雾
 * 输出线性色，tone mapping 交给后处理。
 *
 * 阶段2 会扩展：完整 Gerstner 多波、envMap 反射、波峰白帽。
 */
import * as THREE from 'three'
import { GLSL_HASH } from '../utils/glslChunks'
import { WATER_LEVEL, WORLD_SIZE } from '../config/constants'
import { getHeightFieldTexture } from './heightField'

export interface WaterMaterial extends THREE.ShaderMaterial {
  uniforms: {
    uTime: { value: number }
    uCameraPos: { value: THREE.Vector3 }
    uSunDir: { value: THREE.Vector3 }
    uSunColor: { value: THREE.Color }
    uHeightTex: { value: THREE.DataTexture | null }
    uWorldSize: { value: number }
    uWaterLevel: { value: number }
    uShallowCol: { value: THREE.Color }
    uMidCol: { value: THREE.Color }
    uDeepCol: { value: THREE.Color }
    uFoamCol: { value: THREE.Color }
    uFogColor: { value: THREE.Color }
    uFogDensity: { value: number }
    uSkyColor: { value: THREE.Color }
  }
}

const vertexShader = /* glsl */ `
  uniform float uTime;
  uniform float uWorldSize;
  varying vec3 vWorldPos;
  varying vec3 vNormal;
  varying float vWaveHeight;

  // 简单 Gerstner 波（3 个方向叠加）
  vec3 gerstner(vec2 pos, float t, out vec3 normal) {
    float amp1 = 0.18, amp2 = 0.12, amp3 = 0.07;
    vec2 d1 = normalize(vec2(1.0, 0.4));
    vec2 d2 = normalize(vec2(-0.5, 1.0));
    vec2 d3 = normalize(vec2(0.3, -0.8));
    float f1 = 0.45, f2 = 0.7, f3 = 1.1;
    float s1 = 0.8, s2 = 1.1, s3 = 1.5;

    float p1 = dot(d1, pos) * f1 + t * s1;
    float p2 = dot(d2, pos) * f2 + t * s2;
    float p3 = dot(d3, pos) * f3 + t * s3;

    float h = amp1 * sin(p1) + amp2 * sin(p2) + amp3 * sin(p3);

    // 解析法线（对 pos 求偏导）
    float dx = amp1 * d1.x * f1 * cos(p1) + amp2 * d2.x * f2 * cos(p2) + amp3 * d3.x * f3 * cos(p3);
    float dz = amp1 * d1.y * f1 * cos(p1) + amp2 * d2.y * f2 * cos(p2) + amp3 * d3.y * f3 * cos(p3);
    normal = normalize(vec3(-dx, 1.0, -dz));
    return vec3(0.0, h, 0.0);
  }

  void main() {
    vec3 pos = position;
    // position 在 XZ 平面（PlaneGeometry 旋转后），y=0
    vec2 worldXZ = pos.xz;
    vec3 n;
    vec3 disp = gerstner(worldXZ, uTime, n);
    pos += disp;
    vWaveHeight = disp.y;

    vec4 worldPos = modelMatrix * vec4(pos, 1.0);
    vWorldPos = worldPos.xyz;
    vNormal = n;
    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`

const fragmentShader = /* glsl */ `
  precision highp float;
  ${GLSL_HASH}
  uniform float uTime;
  uniform vec3 uCameraPos;
  uniform vec3 uSunDir;
  uniform vec3 uSunColor;
  uniform sampler2D uHeightTex;
  uniform float uWorldSize;
  uniform float uWaterLevel;
  uniform vec3 uShallowCol;
  uniform vec3 uMidCol;
  uniform vec3 uDeepCol;
  uniform vec3 uFoamCol;
  uniform vec3 uFogColor;
  uniform float uFogDensity;
  uniform vec3 uSkyColor;

  varying vec3 vWorldPos;
  varying vec3 vNormal;
  varying float vWaveHeight;

  void main() {
    // 世界坐标 → 高度纹理 UV
    vec2 uv = (vWorldPos.xz / uWorldSize) + 0.5;
    float terrainH = texture2D(uHeightTex, uv).r;
    float depth = uWaterLevel - terrainH;

    // 深度色：浅绿松石 → 青 → 深蓝
    vec3 waterCol;
    if (depth < 1.5) {
      waterCol = mix(uShallowCol, uMidCol, smoothstep(0.0, 1.5, depth));
    } else {
      waterCol = mix(uMidCol, uDeepCol, smoothstep(1.5, 7.0, depth));
    }
    // 深水压暗
    waterCol *= mix(1.0, 0.75, smoothstep(0.0, 8.0, depth));

    // 漫反射光照（基于太阳方向）
    vec3 N = normalize(vNormal);
    float diff = max(dot(N, normalize(uSunDir)), 0.0);
    vec3 lit = waterCol * (0.55 + 0.6 * diff) * uSunColor;

    // 高光（Blinn-Phong）
    vec3 V = normalize(uCameraPos - vWorldPos);
    vec3 H = normalize(uSunDir + V);
    float spec = pow(max(dot(N, H), 0.0), 120.0);
    lit += uSunColor * spec * 0.6;

    // 菲涅尔（掠射角反射天空色）
    float fres = pow(1.0 - max(dot(N, V), 0.0), 4.0);
    lit = mix(lit, uSkyColor, fres * 0.45);

    // 岸线泡沫（浅水 + 波峰）
    float foamLine = smoothstep(0.5, 0.0, depth) * (0.6 + 0.4 * vnoise(vWorldPos.xz * 6.0 + uTime * 0.3));
    float foamCrest = smoothstep(0.18, 0.28, vWaveHeight) * 0.5;
    float foam = clamp(foamLine + foamCrest, 0.0, 1.0);
    lit = mix(lit, uFoamCol, foam * 0.85);

    // 透明度：浅水更透显沙底，深水近不透明（清澈感）
    float alpha = mix(0.58, 0.93, smoothstep(0.0, 2.5, depth));
    alpha = mix(alpha, 1.0, foam * 0.6);
    alpha = mix(alpha, 1.0, fres * 0.35);

    // 手动指数雾
    float dist = length(uCameraPos - vWorldPos);
    float fogF = 1.0 - exp(-uFogDensity * uFogDensity * dist * dist);
    fogF = clamp(fogF, 0.0, 1.0);
    lit = mix(lit, uFogColor, fogF);

    gl_FragColor = vec4(lit, alpha);
  }
`

export function createWaterMaterial(): WaterMaterial {
  const mat = new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  }) as WaterMaterial

  mat.uniforms = {
    uTime: { value: 0 },
    uCameraPos: { value: new THREE.Vector3() },
    uSunDir: { value: new THREE.Vector3(0.45, 0.78, 0.35).normalize() },
    uSunColor: { value: new THREE.Color('#ffe9c4') },
    uHeightTex: { value: getHeightFieldTexture() },
    uWorldSize: { value: WORLD_SIZE },
    uWaterLevel: { value: WATER_LEVEL },
    uShallowCol: { value: new THREE.Color('#56d6c8') },
    uMidCol: { value: new THREE.Color('#2fb0c4') },
    uDeepCol: { value: new THREE.Color('#15688f') },
    uFoamCol: { value: new THREE.Color('#f4f0e6') },
    uFogColor: { value: new THREE.Color('#d4e2ea') },
    uFogDensity: { value: 0.011 },
    uSkyColor: { value: new THREE.Color('#bcd4e6') },
  }

  return mat
}

/** 每帧更新水材质 uniform */
export function updateWaterMaterial(
  mat: WaterMaterial,
  time: number,
  cameraPos: THREE.Vector3,
) {
  mat.uniforms.uTime.value = time
  mat.uniforms.uCameraPos.value.copy(cameraPos)
  mat.uniforms.uSunDir.value.copy(lightingStateSunDir())
  mat.uniforms.uSunColor.value.copy(lightingStateSunColor())
  mat.uniforms.uFogColor.value.copy(lightingStateFogColor())
  mat.uniforms.uFogDensity.value = lightingStateFogDensity()
  mat.uniforms.uSkyColor.value.copy(lightingStateSkyColor())
}

// 从 lightingState 读取（避免循环依赖直接 import）
import { lightingState } from '../state/lightingState'
const lightingStateSunDir = () => lightingState.sunDir
const lightingStateSunColor = () => lightingState.sunColor
const lightingStateFogColor = () => lightingState.fogColor
const lightingStateFogDensity = () => lightingState.fogDensity
const lightingStateSkyColor = () => lightingState.hemiSky
