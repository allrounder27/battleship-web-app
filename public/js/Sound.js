// Sound effects using Web Audio API
class SoundManager {
  constructor() {
    this.ctx = null;
    this.enabled = true;
  }
  _getCtx() {
    if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    return this.ctx;
  }
  resume() {
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  }

  playHit() {
    if (!this.enabled) return;
    const ctx = this._getCtx(); const now = ctx.currentTime;
    const dur = 0.45;
    const buf = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 2.5);
    const n = ctx.createBufferSource(); n.buffer = buf;
    const osc = ctx.createOscillator(); osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(80, now); osc.frequency.exponentialRampToValueAtTime(20, now + 0.4);
    const og = ctx.createGain(); og.gain.setValueAtTime(0.5, now); og.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
    const f = ctx.createBiquadFilter(); f.type = 'lowpass';
    f.frequency.setValueAtTime(2000, now); f.frequency.exponentialRampToValueAtTime(200, now + 0.3);
    const ng = ctx.createGain(); ng.gain.setValueAtTime(0.6, now); ng.gain.exponentialRampToValueAtTime(0.001, now + dur);
    n.connect(f); f.connect(ng); ng.connect(ctx.destination);
    osc.connect(og); og.connect(ctx.destination);
    n.start(now); n.stop(now + dur); osc.start(now); osc.stop(now + 0.4);
  }

  playMiss() {
    if (!this.enabled) return;
    const ctx = this._getCtx(); const now = ctx.currentTime;
    const dur = 0.3;
    const buf = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 4);
    const n = ctx.createBufferSource(); n.buffer = buf;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass';
    f.frequency.setValueAtTime(3000, now); f.frequency.exponentialRampToValueAtTime(800, now + dur); f.Q.value = 2;
    const g = ctx.createGain(); g.gain.setValueAtTime(0.2, now); g.gain.exponentialRampToValueAtTime(0.001, now + dur);
    n.connect(f); f.connect(g); g.connect(ctx.destination);
    n.start(now); n.stop(now + dur);
  }

  playSunk() {
    if (!this.enabled) return;
    const ctx = this._getCtx(); const now = ctx.currentTime;
    const dur = 0.8;
    const buf = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 1.8);
    const n = ctx.createBufferSource(); n.buffer = buf;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass';
    f.frequency.setValueAtTime(3000, now); f.frequency.exponentialRampToValueAtTime(100, now + 0.6);
    const ng = ctx.createGain(); ng.gain.setValueAtTime(0.7, now); ng.gain.exponentialRampToValueAtTime(0.001, now + dur);
    const osc = ctx.createOscillator(); osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(150, now); osc.frequency.exponentialRampToValueAtTime(15, now + 0.7);
    const og = ctx.createGain(); og.gain.setValueAtTime(0.6, now); og.gain.exponentialRampToValueAtTime(0.001, now + 0.7);
    n.connect(f); f.connect(ng); ng.connect(ctx.destination);
    osc.connect(og); og.connect(ctx.destination);
    n.start(now); n.stop(now + dur); osc.start(now); osc.stop(now + 0.7);
  }

  playVictory() {
    if (!this.enabled) return;
    const ctx = this._getCtx(); const now = ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.50];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator(); osc.type = 'sine';
      osc.frequency.value = freq;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, now + i * 0.15);
      g.gain.linearRampToValueAtTime(0.3, now + i * 0.15 + 0.05);
      g.gain.exponentialRampToValueAtTime(0.001, now + i * 0.15 + 0.4);
      osc.connect(g); g.connect(ctx.destination);
      osc.start(now + i * 0.15); osc.stop(now + i * 0.15 + 0.5);
    });
  }
}

const soundManager = new SoundManager();
document.addEventListener('click', () => soundManager.resume(), { once: true });
document.addEventListener('touchstart', () => soundManager.resume(), { once: true });
