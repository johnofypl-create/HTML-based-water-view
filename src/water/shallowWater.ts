/**
 * 高度场浅水求解器（Virtual Pipes 方法 — CPU 参考实现）
 * =====================================================================
 * 用途：P0 原型 —— 验证"动态地形 → 水实时流入洼地"在数值上能收敛。
 * 后续：
 *   P1 把它移植到 GPUComputationRenderer（WebGL2 ping-pong，O(G²) 上 GPU），
 *   P3 接入 src/water/waterSurface.ts 统一水面高度抽象（地形取自
 *       getHeightFieldTexture()/heightAt，水面高度 S = T + h）。
 *
 * 模型（每格只存一个水深标量 h，地形是另一张高度场 T）：
 *   自由面   S = T + h
 *   虚拟管道流量（到 4 邻居）： f = K * (S_i - S_j) * dt
 *     - f > 0：水从 i 流向 j；f < 0：反向
 *   稳定性命门：把每格的"自身流出总量"钳制到 ≤ h_i * outBuffer，
 *     否则地形突变 / 初始不平会令数值爆炸（这也是 GPU 版必须做的）。
 *   质量守恒：每条 f 从 i 减去、加到 j，天然守恒。
 *   开边界（海）：把海源格的自由面钉在 seaLevel，等价于无限水库
 *     （可灌出、可吸收回流，故带海的场景不做全局质量守恒断言）。
 */

export interface ShallowState {
  /** 网格分辨率（G × G 格） */
  G: number
  /** 地形高度场 T[i]，长度 G*G */
  terrain: Float32Array
  /** 水深 h[i]（≥ 0），长度 G*G */
  h: Float32Array
  /** 是否海源格（1 = 钉在 seaLevel 的无限水库） */
  isSea: Uint8Array
  /** 海面高度（仅对 isSea 格生效） */
  seaLevel: number
}

export interface ShallowParams {
  /** 时间步长 */
  dt: number
  /** 管道导水系数 K（越大流得越快，过大会不稳） */
  conductivity: number
  /** 单步允许流出比例上限（默认 0.9，留缓冲防负水深） */
  outBuffer?: number
}

/** 构造一份状态（h 全 0、无海） */
export function makeState(
  G: number,
  terrain: Float32Array,
  opts?: { seaLevel?: number; isSea?: Uint8Array },
): ShallowState {
  return {
    G,
    terrain,
    h: new Float32Array(G * G),
    isSea: opts?.isSea ?? new Uint8Array(G * G),
    seaLevel: opts?.seaLevel ?? 0,
  }
}

/** 总水量（用于质量守恒断言） */
export function totalWater(s: ShallowState): number {
  let m = 0
  for (let i = 0; i < s.h.length; i++) m += s.h[i]
  return m
}

/** 最大相邻自由面落差（用于"是否已平息"断言） */
export function maxSurfaceSlope(s: ShallowState): number {
  const { G, terrain, h } = s
  let maxS = 0
  for (let z = 0; z < G; z++) {
    for (let x = 0; x < G; x++) {
      const i = z * G + x
      const Si = terrain[i] + h[i]
      if (x + 1 < G) {
        const d = Math.abs(Si - (terrain[i + 1] + h[i + 1]))
        if (d > maxS) maxS = d
      }
      if (z + 1 < G) {
        const d = Math.abs(Si - (terrain[i + G] + h[i + G]))
        if (d > maxS) maxS = d
      }
    }
  }
  return maxS
}

/**
 * 推进一帧浅水模拟。
 * 流程：海源补满 → 算期望流量 → 钳制每格流出 → 施加（守恒）→ 海源二次补满。
 */
export function step(s: ShallowState, p: ShallowParams): void {
  const { G, terrain, h, isSea, seaLevel } = s
  const dt = p.dt
  const K = p.conductivity
  const outBuffer = p.outBuffer ?? 0.9
  const N = G * G

  // 1) 海源格：把自由面钉在 seaLevel（无限水库）
  for (let i = 0; i < N; i++) {
    if (isSea[i]) {
      const want = seaLevel - terrain[i]
      h[i] = want > 0 ? want : 0
    }
  }

  // 2) 期望流量（有符号）：f > 0 表示 i → 邻居
  const fR = new Float32Array(N) // i -> i+1 (+x)
  const fD = new Float32Array(N) // i -> i+G (+z)
  for (let z = 0; z < G; z++) {
    for (let x = 0; x < G; x++) {
      const i = z * G + x
      const Si = terrain[i] + h[i]
      if (x + 1 < G) {
        const j = i + 1
        fR[i] = K * (Si - (terrain[j] + h[j])) * dt
      }
      if (z + 1 < G) {
        const j = i + G
        fD[i] = K * (Si - (terrain[j] + h[j])) * dt
      }
    }
  }

  // 3) 钳制每格"四个方向的自身流出"不超过可用水（防数值爆炸的命门）
  //    注意：向左/向上的流出存在邻居数组的负值里（fR[i-1]<0 = i 往左推，
  //    fD[i-G]<0 = i 往上推），必须一并钳制，否则会把邻居抽成负水深。
  for (let i = 0; i < N; i++) {
    if (isSea[i]) continue
    const x = i % G
    const z = (i / G) | 0
    let out = 0
    if (fR[i] > 0) out += fR[i]
    if (fD[i] > 0) out += fD[i]
    if (x > 0 && fR[i - 1] < 0) out += -fR[i - 1]
    if (z > 0 && fD[i - G] < 0) out += -fD[i - G]
    if (out > h[i] * outBuffer && out > 0) {
      const scale = (h[i] * outBuffer) / out
      if (fR[i] > 0) fR[i] *= scale
      if (fD[i] > 0) fD[i] *= scale
      if (x > 0 && fR[i - 1] < 0) fR[i - 1] *= scale
      if (z > 0 && fD[i - G] < 0) fD[i - G] *= scale
    }
  }

  // 4) 施加流量（每条 f 从 i 减、加到邻居 j → 质量守恒）
  for (let i = 0; i < N; i++) {
    if (fR[i] !== 0) {
      h[i] -= fR[i]
      h[i + 1] += fR[i]
    }
    if (fD[i] !== 0) {
      h[i] -= fD[i]
      h[i + G] += fD[i]
    }
  }

  // 5) 海源格二次补满（吸收邻居回流后维持 seaLevel）
  for (let i = 0; i < N; i++) {
    if (isSea[i]) {
      const want = seaLevel - terrain[i]
      h[i] = want > 0 ? want : 0
    }
  }
}

/** 往某格灌水（测试 / 未来地形改造接口用） */
export function pour(s: ShallowState, x: number, z: number, depth: number): void {
  s.h[z * s.G + x] += depth
}
