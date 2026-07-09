/**
 * 音频管理器（单例）
 * 全 Web Audio 程序化合成环境音：海浪/风/河/鸟鸣/虫鸣。
 * 用户手势（StartOverlay）触发 start()，每帧 update(timeOfDay) 调各层增益。
 */
import { getWhiteNoise, getPinkNoise } from './noiseBuffer'

type Layer = {
  out: GainNode // 层总增益（由 mixer 控制）
  dispose?: () => void
}

class AudioManager {
  ctx: AudioContext | null = null
  master: GainNode | null = null
  private layers: Record<string, Layer> = {}
  private birdTimer: number | null = null
  started = false
  masterVolume = 0.6

  /** 用户手势触发：创建 context + 所有层 */
  start() {
    if (this.started) return
    const Ctx = window.AudioContext || (window as any).webkitAudioContext
    this.ctx = new Ctx()
    this.master = this.ctx.createGain()
    this.master.gain.value = this.masterVolume
    this.master.connect(this.ctx.destination)
    this.ctx.resume()

    this.layers.wave = this.makeWave()
    this.layers.wind = this.makeWind()
    this.layers.river = this.makeRiver()
    this.layers.insect = this.makeInsect()
    this.layers.bird = this.makeBird()
    this.started = true
  }

  setMasterVolume(v: number) {
    this.masterVolume = v
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(v, this.ctx.currentTime, 0.1)
    }
  }

  /** 海浪：粉噪 → bandpass(LFO 调频) → gain(慢 LFO 起伏) → 层增益。两层不同相位 */
  private makeWave(): Layer {
    const ctx = this.ctx!
    const out = ctx.createGain()
    out.gain.value = 0.0
    out.connect(this.master!)

    const buildLayer = (phase: number) => {
      const src = ctx.createBufferSource()
      src.buffer = getPinkNoise(ctx)
      src.loop = true
      const bp = ctx.createBiquadFilter()
      bp.type = 'bandpass'
      bp.Q.value = 0.8
      const gain = ctx.createGain()
      gain.gain.value = 0.0
      src.connect(bp).connect(gain).connect(out)
      src.start()
      // LFO 调带通频率
      const lfoF = ctx.createOscillator()
      lfoF.frequency.value = 0.08
      const lfoFG = ctx.createGain()
      lfoFG.gain.value = 300
      lfoF.connect(lfoFG).connect(bp.frequency)
      lfoF.start()
      lfoF.frequency.value = 0.08 + phase * 0.02
      // 慢 LFO 调 gain（浪涌）
      const lfoG = ctx.createOscillator()
      lfoG.frequency.value = 0.12 + phase * 0.03
      const lfoGG = ctx.createGain()
      lfoGG.gain.value = 0.25
      lfoG.connect(lfoGG).connect(gain.gain)
      gain.gain.value = 0.3
      lfoG.start()
    }
    buildLayer(0)
    buildLayer(1)
    return { out }
  }

  /** 风：粉噪 → lowpass(LFO 调截止) → 层增益 */
  private makeWind(): Layer {
    const ctx = this.ctx!
    const out = ctx.createGain()
    out.gain.value = 0.0
    out.connect(this.master!)
    const src = ctx.createBufferSource()
    src.buffer = getPinkNoise(ctx)
    src.loop = true
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 500
    lp.Q.value = 0.5
    const g = ctx.createGain()
    g.gain.value = 0.5
    src.connect(lp).connect(g).connect(out)
    src.start()
    // LFO 调截止频率
    const lfo = ctx.createOscillator()
    lfo.frequency.value = 0.06
    const lfoG = ctx.createGain()
    lfoG.gain.value = 250
    lfo.connect(lfoG).connect(lp.frequency)
    lfo.start()
    return { out }
  }

  /** 河流：白噪 → bandpass 高频 → 层增益 */
  private makeRiver(): Layer {
    const ctx = this.ctx!
    const out = ctx.createGain()
    out.gain.value = 0.0
    out.connect(this.master!)
    const src = ctx.createBufferSource()
    src.buffer = getWhiteNoise(ctx)
    src.loop = true
    const bp = ctx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.value = 2200
    bp.Q.value = 0.6
    const g = ctx.createGain()
    g.gain.value = 0.35
    src.connect(bp).connect(g).connect(out)
    src.start()
    // 轻微 LFO
    const lfo = ctx.createOscillator()
    lfo.frequency.value = 0.4
    const lfoG = ctx.createGain()
    lfoG.gain.value = 0.1
    lfo.connect(lfoG).connect(g.gain)
    lfo.start()
    return { out }
  }

  /** 虫鸣：高频 osc + 脉冲 gain 调制（断续） */
  private makeInsect(): Layer {
    const ctx = this.ctx!
    const out = ctx.createGain()
    out.gain.value = 0.0
    out.connect(this.master!)
    const osc = ctx.createOscillator()
    osc.type = 'sine'
    osc.frequency.value = 4800
    const g = ctx.createGain()
    g.gain.value = 0.0
    osc.connect(g).connect(out)
    osc.start()
    // 脉冲调制（20-40ms 周期的开关）
    const lfo = ctx.createOscillator()
    lfo.type = 'square'
    lfo.frequency.value = 8
    const lfoG = ctx.createGain()
    lfoG.gain.value = 0.04
    lfo.connect(lfoG).connect(g.gain)
    lfo.start()
    return { out }
  }

  /** 鸟鸣：定时器随机触发 chirp（oscillator 频率扫 + 包络） */
  private makeBird(): Layer {
    const ctx = this.ctx!
    const out = ctx.createGain()
    out.gain.value = 1.0
    out.connect(this.master!)
    // 实际 gain 由 mixer 控制 out

    const chirp = () => {
      if (!this.ctx || this.ctx.state !== 'running') return
      const t = this.ctx.currentTime
      const osc = this.ctx.createOscillator()
      osc.type = 'triangle'
      const baseF = 700 + Math.random() * 500
      osc.frequency.setValueAtTime(baseF, t)
      osc.frequency.linearRampToValueAtTime(baseF + 400, t + 0.04)
      osc.frequency.linearRampToValueAtTime(baseF - 100, t + 0.12)
      const g = this.ctx.createGain()
      g.gain.setValueAtTime(0, t)
      g.gain.linearRampToValueAtTime(0.12, t + 0.01)
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.18)
      osc.connect(g).connect(out)
      osc.start(t)
      osc.stop(t + 0.2)
      // 偶尔连叫两声
      if (Math.random() < 0.4) {
        const t2 = t + 0.22
        const osc2 = this.ctx.createOscillator()
        osc2.type = 'triangle'
        osc2.frequency.setValueAtTime(baseF + 200, t2)
        osc2.frequency.linearRampToValueAtTime(baseF + 500, t2 + 0.05)
        const g2 = this.ctx.createGain()
        g2.gain.setValueAtTime(0, t2)
        g2.gain.linearRampToValueAtTime(0.1, t2 + 0.01)
        g2.gain.exponentialRampToValueAtTime(0.001, t2 + 0.16)
        osc2.connect(g2).connect(out)
        osc2.start(t2)
        osc2.stop(t2 + 0.18)
      }
    }

    const schedule = () => {
      if (!this.started) return
      chirp()
      this.birdTimer = window.setTimeout(schedule, 1500 + Math.random() * 5000)
    }
    this.birdTimer = window.setTimeout(schedule, 2000)

    return { out, dispose: () => { if (this.birdTimer) clearTimeout(this.birdTimer) } }
  }

  /** 每帧按 timeOfDay 调各层增益 */
  update(timeOfDay: number) {
    if (!this.ctx || !this.started) return
    const t = this.ctx.currentTime
    const dayFactor = Math.max(0, Math.sin(((timeOfDay - 6) / 12) * Math.PI))
    const isNight = timeOfDay < 6 || timeOfDay > 19
    const setG = (layer: Layer, v: number) => {
      layer.out.gain.setTargetAtTime(v, t, 0.5)
    }
    setG(this.layers.wave, 0.28)              // 浪恒定
    setG(this.layers.wind, 0.05 + dayFactor * 0.07)  // 风白天略强
    setG(this.layers.river, 0.14)             // 河恒定
    setG(this.layers.bird, dayFactor * 0.22)  // 鸟白天
    setG(this.layers.insect, isNight ? 0.12 : 0.02)  // 虫夜晚
  }

  dispose() {
    if (this.birdTimer) clearTimeout(this.birdTimer)
    Object.values(this.layers).forEach((l) => l.dispose?.())
    this.ctx?.close()
    this.started = false
  }
}

export const audioManager = new AudioManager()
