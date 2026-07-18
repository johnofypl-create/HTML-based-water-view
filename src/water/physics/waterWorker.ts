/**
 * Virtual Pipes Web Worker — 128² 网格，接收主线程配置 + compute 指令
 */

let SIZE = 128
let SEA_LEVEL = -0.5
let SIM_K = 0.2
let SIM_DT = 1.0
let SIM_SUBSTEPS = 3
let SIM_OUT_BUFFER = 0.9

let terrain: Float32Array
let h: Float32Array
let flux: Float32Array

function step() {
  // Phase 1: Compute fluxes
  for (let i = 0; i < SIZE * SIZE; i++) {
    const y = (i / SIZE) | 0
    const x = i % SIZE
    const hi = h[i]
    const S = terrain[i] + hi

    let outR = 0, outU = 0, outL = 0, outD = 0
    if (x + 1 < SIZE) { const j = i + 1; const f = SIM_K * (S - (terrain[j] + h[j])) * SIM_DT; if (f > 0) outR = f }
    if (y + 1 < SIZE) { const j = i + SIZE; const f = SIM_K * (S - (terrain[j] + h[j])) * SIM_DT; if (f > 0) outU = f }
    if (x > 0) { const j = i - 1; const f = SIM_K * (S - (terrain[j] + h[j])) * SIM_DT; if (f > 0) outL = f }
    if (y > 0) { const j = i - SIZE; const f = SIM_K * (S - (terrain[j] + h[j])) * SIM_DT; if (f > 0) outD = f }

    const sum = outR + outU + outL + outD
    if (sum > hi * SIM_OUT_BUFFER && sum > 0) {
      const sc = (hi * SIM_OUT_BUFFER) / sum
      outR *= sc; outU *= sc; outL *= sc; outD *= sc
    }

    const fi = i * 4
    flux[fi] = outR; flux[fi + 1] = outU; flux[fi + 2] = outL; flux[fi + 3] = outD
  }

  // Phase 2: Update h
  for (let i = 0; i < SIZE * SIZE; i++) {
    const y = (i / SIZE) | 0
    const x = i % SIZE
    const fi = i * 4
    const outSum = flux[fi] + flux[fi + 1] + flux[fi + 2] + flux[fi + 3]

    let inR = 0, inU = 0, inL = 0, inD = 0
    if (x + 1 < SIZE) inL = flux[(i + 1) * 4 + 2]
    if (y + 1 < SIZE) inD = flux[(i + SIZE) * 4 + 3]
    if (x > 0) inR = flux[(i - 1) * 4]
    if (y > 0) inU = flux[(i - SIZE) * 4 + 1]

    let hNew = h[i] - outSum + inR + inU + inL + inD
    if (terrain[i] < SEA_LEVEL) {
      const want = SEA_LEVEL - terrain[i]
      hNew = want > 0 ? want : 0
    }
    h[i] = Math.max(0, hNew)
  }
}

self.onmessage = (e: MessageEvent) => {
  switch (e.data.cmd) {
    case 'init': {
      SIZE = e.data.size
      SEA_LEVEL = e.data.seaLevel
      SIM_K = e.data.k
      SIM_DT = e.data.dt
      SIM_SUBSTEPS = e.data.substeps
      SIM_OUT_BUFFER = e.data.outBuffer

      terrain = new Float32Array(e.data.terrain)
      h = new Float32Array(SIZE * SIZE)
      flux = new Float32Array(SIZE * SIZE * 4)

      for (let i = 0; i < SIZE * SIZE; i++) {
        if (terrain[i] < SEA_LEVEL) {
          h[i] = SEA_LEVEL - terrain[i]
        }
      }
      // 回传初始 h（transferable）
      const hCopy = new Float32Array(h); (self as any).postMessage({ cmd: "inited", h: hCopy.buffer }, [hCopy.buffer])
      break
    }

    case 'compute': {
      for (let s = 0; s < SIM_SUBSTEPS; s++) step()
      // 复制一份发送（transferable），worker 保留原 h 供下帧继续
      const hCopy = new Float32Array(h)
      ;(self as any).postMessage({ cmd: 'result', h: hCopy.buffer }, [hCopy.buffer])
      break
    }
  }
}
