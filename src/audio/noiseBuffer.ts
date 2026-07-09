/**
 * 噪声 AudioBuffer（白噪/粉噪），各声音层复用。
 * 一次性生成 2 秒循环 buffer。
 */
let whiteBuf: AudioBuffer | null = null
let pinkBuf: AudioBuffer | null = null

export function getWhiteNoise(ctx: AudioContext): AudioBuffer {
  if (whiteBuf && whiteBuf.sampleRate === ctx.sampleRate) return whiteBuf
  const len = ctx.sampleRate * 2
  const buf = ctx.createBuffer(1, len, ctx.sampleRate)
  const d = buf.getChannelData(0)
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1
  whiteBuf = buf
  return buf
}

/** 粉噪声（Voss-McCartney 简化）：低频更丰富，听起来更像自然声 */
export function getPinkNoise(ctx: AudioContext): AudioBuffer {
  if (pinkBuf && pinkBuf.sampleRate === ctx.sampleRate) return pinkBuf
  const len = ctx.sampleRate * 2
  const buf = ctx.createBuffer(1, len, ctx.sampleRate)
  const d = buf.getChannelData(0)
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0
  for (let i = 0; i < len; i++) {
    const w = Math.random() * 2 - 1
    b0 = 0.99886 * b0 + w * 0.0555179
    b1 = 0.99332 * b1 + w * 0.0750759
    b2 = 0.96900 * b2 + w * 0.1538520
    b3 = 0.86650 * b3 + w * 0.3104856
    b4 = 0.55000 * b4 + w * 0.5329522
    b5 = -0.7616 * b5 - w * 0.0168980
    d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11
    b6 = w * 0.115926
  }
  pinkBuf = buf
  return buf
}
