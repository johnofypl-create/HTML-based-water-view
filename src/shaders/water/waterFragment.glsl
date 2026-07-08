varying vec2 vUv;
varying vec3 vWorldPosition;
varying float vWaveHeight;
varying float vDepth;

uniform float uTime;
uniform vec3 uWaterColor;
uniform vec3 uDeepColor;
uniform vec3 uFoamColor;
uniform float uOpacity;

// 简易噪声
float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
    mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x),
    f.y
  );
}

// 简化的FBM（2层）
float fbm(vec2 p) {
  float value = 0.0;
  float amplitude = 0.5;
  float frequency = 1.0;
  float total = 0.0;
  for (int i = 0; i < 2; i++) {
    value += amplitude * noise(p * frequency);
    total += amplitude;
    frequency *= 2.0;
    amplitude *= 0.5;
  }
  return value / total;
}

void main() {
  // 深度渐变颜色
  vec3 depthColor = mix(uWaterColor, uDeepColor, vDepth);

  // 波浪图案（简化：单层FBM）
  float wavePattern = fbm(vUv * 8.0 + uTime * 0.15);
  wavePattern = wavePattern * 0.5 + 0.5;

  vec3 waveColor = mix(depthColor * 0.9, depthColor * 1.1, wavePattern);

  // 海岸线泡沫
  float foamFactor = 1.0 - smoothstep(0.0, 0.25, vDepth);
  foamFactor *= 0.7 + 0.3 * abs(vWaveHeight) * 10.0;
  foamFactor = clamp(foamFactor, 0.0, 1.0);

  vec3 color = mix(waveColor, uFoamColor, foamFactor * 0.6);

  // 简化焦散
  float caustic = fbm(vUv * 10.0 + uTime * 0.25);
  caustic = caustic * 0.4 + 0.6;
  float causticStrength = (1.0 - vDepth) * 0.12;
  color += vec3(0.4, 0.5, 0.3) * caustic * causticStrength;

  gl_FragColor = vec4(color, uOpacity);
}