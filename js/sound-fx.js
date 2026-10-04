/* Web Audio 合成音效 */

class SoundFX {
  constructor() {
    this.ctx = null;
    this.enabled = true;
  }

  init() {
    if (!this.enabled) return;
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
    }
    if (this.ctx.state === "suspended") {
      const r = this.ctx.resume();
      if (r && typeof r.catch === "function") r.catch(() => {});
    }
  }

  warmup() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.00001, this.ctx.currentTime);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.015);
    } catch (e) {}
  }

  beep(freq = 440, duration = 0.1, type = "sine", volume = 0.05) {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
    gain.gain.setValueAtTime(volume, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + duration);
  }

  noise(duration = 0.08, volume = 0.04) {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    const sampleRate = this.ctx.sampleRate;
    const length = Math.floor(sampleRate * duration);
    const buffer = this.ctx.createBuffer(1, length, sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    }
    const src = this.ctx.createBufferSource();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();
    src.buffer = buffer;
    filter.type = "bandpass";
    filter.frequency.value = 1200;
    filter.Q.value = 0.8;
    gain.gain.setValueAtTime(volume, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);
    src.start();
  }

  click() {
    this.beep(720, 0.045, "square", 0.035);
  }

  leverGrip() {
    this.noise(0.05, 0.035);
    this.beep(180, 0.06, "triangle", 0.05);
    setTimeout(() => this.beep(320, 0.04, "square", 0.03), 40);
    setTimeout(() => this.beep(90, 0.08, "sine", 0.04), 70);
  }

  leverPull() {
    this.noise(0.18, 0.045);
    this.beep(220, 0.12, "sawtooth", 0.05);
    setTimeout(() => this.beep(160, 0.1, "sawtooth", 0.045), 60);
    setTimeout(() => this.beep(110, 0.1, "square", 0.04), 120);
    setTimeout(() => {
      this.noise(0.1, 0.06);
      this.beep(70, 0.14, "triangle", 0.08);
      this.beep(140, 0.08, "square", 0.05);
    }, 260);
    setTimeout(() => this.beep(55, 0.12, "sine", 0.045), 320);
  }

  leverReset() {
    this.beep(140, 0.06, "triangle", 0.035);
    setTimeout(() => this.beep(210, 0.05, "triangle", 0.03), 50);
    setTimeout(() => {
      this.noise(0.04, 0.025);
      this.beep(380, 0.04, "square", 0.028);
    }, 120);
    setTimeout(() => this.beep(280, 0.05, "sine", 0.02), 180);
  }

  spinTick() {
    this.beep(120, 0.025, "sawtooth", 0.018);
  }

  reelStop() {
    this.beep(220, 0.06, "triangle", 0.05);
    setTimeout(() => this.beep(420, 0.06, "triangle", 0.035), 55);
  }

  smallWin() {
    this.beep(520, 0.09, "sine", 0.06);
    setTimeout(() => this.beep(720, 0.09, "sine", 0.06), 110);
    setTimeout(() => this.beep(920, 0.12, "sine", 0.07), 220);
  }

  bigWin() {
    [392, 523, 659, 784, 1046, 1318].forEach((note, i) => {
      setTimeout(() => this.beep(note, 0.18, "triangle", 0.08), i * 115);
    });
  }

  jackpot() {
    [523, 659, 784, 1046, 1318, 1568, 2093].forEach((note, i) => {
      setTimeout(() => this.beep(note, 0.22, "triangle", 0.09), i * 120);
    });
  }

  lose() {
    this.beep(180, 0.08, "sawtooth", 0.025);
  }

  coinChime(direction = "out") {
    if (direction === "out") {
      this.beep(1046, 0.05, "sine", 0.05);
      setTimeout(() => this.beep(1318, 0.06, "sine", 0.05), 70);
      setTimeout(() => this.beep(1568, 0.08, "sine", 0.045), 140);
    } else {
      this.beep(1568, 0.05, "sine", 0.045);
      setTimeout(() => this.beep(1318, 0.05, "sine", 0.045), 70);
      setTimeout(() => this.beep(1046, 0.07, "sine", 0.05), 140);
    }
  }
}
