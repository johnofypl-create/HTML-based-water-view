/**
 * @module water/foam/waterMaterial
 * @layer water（域层）
 * @purpose 海面着色器材质工厂（Gerstner 位移 + Jacobian 白帽 + 岸线湿边）
 * @dependsOn ['utils/glslChunks', 'config/constants', 'water/surface/heightField', 'water/surface/gerstner.glsl', 'state/lightingState']
 * @exports [WaterMaterial, createWaterMaterial, updateWaterMaterial]
 * @aiEdit
 *   - 调泡沫密度/颜色 → 改 fragment 的 applyFoam 与 uFoam*；调波形 → 改 gerstner.glsl.ts；调昼夜响应 → 改 updateWaterMaterial 中 lightingState.* 读取
 */
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
import { GLSL_HASH } from '../../utils/glslChunks'
import { WATER_LEVEL, WORLD_SIZE, WATER_SIM_SIZE, SEA_LEVEL } from '../../config/constants'
import { getHeightFieldTexture } from '../surface/heightField'
import { GERSTNER_GLSL } from '../surface/gerstner.glsl'
import { lightingState } from '../../state/lightingState'

export interface WaterMaterial extends THREE.ShaderMaterial {
  uniforms: {
    uTime: { value: number }
    uCameraPos: { value: THREE.Vector3 }
    uSunDir: { value: THREE.Vector3 }
    uSunColor: { value: THREE.Color }
    uHeightTex: { value: THREE.DataTexture | null }
    uWaterHeight: { value: THREE.Texture | null }
    uEnablePhysics: { value: boolean }
    uWorldSize: { value: number }
    uWaterLevel: { value: number }
    uShallowCol: { value: THREE.Color }
    uMidCol: { value: THREE.Color }
    uDeepCol: { value: THREE.Color }
    uFoamCol: { value: THREE.Color }
    uFogColor: { value: THREE.Color }
    uFogDensity: { value: number }
    uSkyColor: { value: THREE.Color }
    // ── 泡沫升级（Jacobian 白帽 + 滚动噪声 + 岸线湿边） ──
    uFoamScale: { value: number }
    uFoamSpeed: { value: number }
    uFoamJacLo: { value: number }
    uFoamJacHi: { value: number }
    uFoamAmount: { value: number }
    uFoamShoreDepth: { value: number }
    uFoamShoreSpeed: { value: number }
  }
}

const vertexShader = /* glsl */ `
  uniform float uTime;
  uniform float uWorldSize;
  uniform sampler2D uHeightTex;
  uniform sampler2D uWaterHeight;
  uniform bool uEnablePhysics;       // GPU 物理水是否就绪（GCR 首次 compute 后置 true）
  varying vec3 vWorldPos;
  varying vec3 vNormal;
  varying float vWaveHeight;
  varying float vJacobian;
  varying float vSurfaceY;
  varying float vDepth;

  // 标准 Gerstner（含水平位移 + 解析法线 + 雅可比），由 gerstner.ts 生成
  ${GERSTNER_GLSL}

  void main() {
    vec3 pos = position;
    // position 在 XZ 平面（PlaneGeometry 旋转后），y=0
    vec2 uv = (pos.xz / uWorldSize) + 0.5;
    float terrainH = texture2D(uHeightTex, uv).r;
    float h = 10.0;            // fallback 假深水（物理未就绪时片元不触发 discard）

    if (uEnablePhysics) {
      // P1 物理模式：基面 = 地形 + 水深（海区=海平面，淹没区随水位）
      h = texture2D(uWaterHeight, uv).r;
      pos.y = (terrainH + h) - uWaterLevel;
    } else {
      // fallback：原始平面行为（无物理数据时保持全水面可见）
      pos.y = 0.0;
    }

    vec3 n;
    float jac;
    vec3 disp = gerstnerSolve(pos.xz, uTime, n, jac);
    pos += disp;                 // 含水平位移的标准 Gerstner
    vWaveHeight = disp.y;
    vJacobian = jac;
    vDepth = h;

    vec4 worldPos = modelMatrix * vec4(pos, 1.0);
    vWorldPos = worldPos.xyz;
    vSurfaceY = worldPos.y;      // = 海平面 + 波高（海区）/ 淹没区基面 + 波高
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
  uniform bool uEnablePhysics;       // 与顶点同步：物理模式才遮罩干地
  uniform float uWorldSize;
  uniform float uWaterLevel;
  uniform vec3 uShallowCol;
  uniform vec3 uMidCol;
  uniform vec3 uDeepCol;
  uniform vec3 uFoamCol;
  uniform vec3 uFogColor;
  uniform float uFogDensity;
  uniform vec3 uSkyColor;
  uniform float uFoamScale;
  uniform float uFoamSpeed;
  uniform float uFoamJacLo;
  uniform float uFoamJacHi;
  uniform float uFoamAmount;
  uniform float uFoamShoreDepth;
  uniform float uFoamShoreSpeed;

  varying vec3 vWorldPos;
  varying vec3 vNormal;
  varying float vWaveHeight;
  varying float vJacobian;
  varying float vSurfaceY;
  varying float vDepth;

  // 岸线「湿边/消退」泡沫：浅水带内随波相位来回拉退，紧贴水线再补一道细湿线
  float shorelineFoam(float depth, float t, vec2 xz, float fn) {
    float retreat = 0.5 + 0.5 * sin(t * uFoamShoreSpeed + xz.x * 0.5 + xz.y * 0.3);
    float band = (1.0 - smoothstep(0.0, uFoamShoreDepth, depth)) * mix(0.4, 1.0, retreat);
    float wet = (1.0 - smoothstep(0.0, uFoamShoreDepth * 0.18, depth)) * retreat;
    return band * (0.6 + 0.4 * fn) + wet * 0.5;
  }

  void main() {
    // 世界坐标 → 高度纹理 UV
    vec2 uv = (vWorldPos.xz / uWorldSize) + 0.5;
    float h = vDepth;                       // GPU 物理水深（fallback=10.0）
    // 干地遮罩：仅在物理模式下，h≈0（无水体）处丢弃/渐隐
    float waterMask = uEnablePhysics ? smoothstep(0.0, 0.05, h) : 1.0;
    if (waterMask < 0.001) discard;
    float terrainH = texture2D(uHeightTex, uv).r;
    float depth = max(h, 0.0);          // 水柱深 ≈ h（满淹时 = 海平面 - 地形）

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

    // ── 泡沫升级 ──
    // 实际水面深度用物理水深 h（波面起伏叠加在 h 基面上，h 即水柱深）
    float fdepth = depth;
    // 程序化滚动噪声（零贴图，复用 glslChunks 的 fbm2）
    float fn = fbm2(vWorldPos.xz * uFoamScale + uTime * uFoamSpeed * vec2(0.3, -0.2));
    // ① Jacobian 白帽：波面折叠/破碎处（J 跌破阈值）生成，乘噪声做纹理感
    float jacFoam = (1.0 - smoothstep(uFoamJacLo, uFoamJacHi, vJacobian)) * mix(0.55, 1.0, fn);
    // ② 波峰泡沫（保留并细调）
    float foamCrest = smoothstep(0.12, 0.24, vWaveHeight) * (0.4 + 0.5 * fn);
    // ③ 岸线湿边消退
    float shore = shorelineFoam(fdepth, uTime, vWorldPos.xz, fn);
    float foam = clamp(jacFoam + foamCrest * 0.5 + shore, 0.0, 1.0);
    lit = mix(lit, uFoamCol, foam * uFoamAmount);

    // 透明度：浅水更透显沙底，深水近不透明（清澈感）
    float alpha = mix(0.58, 0.93, smoothstep(0.0, 2.5, depth));
    alpha = mix(alpha, 1.0, foam * 0.6);
    alpha = mix(alpha, 1.0, fres * 0.35);
    alpha *= waterMask;   // 干地渐隐到全透（与 discard 共同剔除无水区）

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
    uWaterHeight: { value: null },
    uEnablePhysics: { value: false },
    uWorldSize: { value: WORLD_SIZE },
    uWaterLevel: { value: WATER_LEVEL },
    uShallowCol: { value: new THREE.Color('#56d6c8') },
    uMidCol: { value: new THREE.Color('#2fb0c4') },
    uDeepCol: { value: new THREE.Color('#15688f') },
    uFoamCol: { value: new THREE.Color('#f4f0e6') },
    uFogColor: { value: new THREE.Color('#d4e2ea') },
    uFogDensity: { value: 0.006 },
    uSkyColor: { value: new THREE.Color('#bcd4e6') },
    // 泡沫升级默认参数（可调）
    uFoamScale: { value: 1.6 },
    uFoamSpeed: { value: 0.25 },
    uFoamJacLo: { value: 0.5 },
    uFoamJacHi: { value: 0.86 },
    uFoamAmount: { value: 0.9 },
    uFoamShoreDepth: { value: 0.6 },
    uFoamShoreSpeed: { value: 1.0 },
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
  mat.uniforms.uSunDir.value.copy(lightingState.sunDir)
  mat.uniforms.uSunColor.value.copy(lightingState.sunColor)
  mat.uniforms.uFogColor.value.copy(lightingState.fogColor)
  mat.uniforms.uFogDensity.value = lightingState.fogDensity
  mat.uniforms.uSkyColor.value.copy(lightingState.hemiSky)
}

// 直接从已 import 的 lightingState 读取（见顶部 import；实测不构成循环依赖，无需 wrapper）

