varying vec2 vUv;
varying vec3 vWorldPosition;
varying float vWaveHeight;
varying float vDepth;

uniform float uTime;

// 简易噪声函数
float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);

  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));

  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

void main() {
  vUv = uv;

  // 简化波浪位移（2层正弦波 + 1层噪声）
  float wave1 = sin(position.x * 1.8 + uTime * 0.6) * cos(position.y * 2.1 + uTime * 0.4) * 0.10;
  float wave2 = sin(position.x * 3.5 - uTime * 0.8) * cos(position.y * 4.3 + uTime * 0.55) * 0.06;

  float n = noise(vec2(position.x * 2.0, position.y * 2.0) + uTime * 0.3) * 0.06;

  float displacement = wave1 + wave2 + n;
  vWaveHeight = displacement;

  vec3 newPosition = position + vec3(0.0, 0.0, displacement);
  vec4 worldPos = modelMatrix * vec4(newPosition, 1.0);
  vWorldPosition = worldPos.xyz;

  // 深度因子：基于世界坐标X，越往右（远离海岸）越深
  // 从海岸线(X≈0)到深海(X≈14)渐变
  vDepth = clamp((worldPos.x - 0.5) / 13.0, 0.0, 1.0);

  gl_Position = projectionMatrix * modelViewMatrix * vec4(newPosition, 1.0);
}