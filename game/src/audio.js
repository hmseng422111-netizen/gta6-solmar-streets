// Synthesised sound for Solmar Streets.
// Every sound is built with the Web Audio API at runtime: an engine hum
// whose pitch follows the car's speed, a two-tone police siren, a noise
// burst for gunshots, and a short arpeggio when a mission pays out. No
// audio files are loaded. In a non-browser environment every call is a
// harmless no-op, so the simulation can be tested headlessly.

export function makeAudio() {
  const audio = {
    ctx: null,
    engineOsc: null,
    engineGain: null,
    sirenOsc: null,
    sirenGain: null,
    sirenTimer: 0,
    sirenHigh: false,
    muted: false,
  };

  audio.ensure = function ensure() {
    if (typeof window === 'undefined' || !window.AudioContext) return false;
    if (!audio.ctx) {
      audio.ctx = new window.AudioContext();
      audio.engineGain = audio.ctx.createGain();
      audio.engineGain.gain.value = 0;
      audio.engineGain.connect(audio.ctx.destination);
      audio.engineOsc = audio.ctx.createOscillator();
      audio.engineOsc.type = 'sawtooth';
      audio.engineOsc.frequency.value = 50;
      audio.engineOsc.connect(audio.engineGain);
      audio.engineOsc.start();
      audio.sirenGain = audio.ctx.createGain();
      audio.sirenGain.gain.value = 0;
      audio.sirenGain.connect(audio.ctx.destination);
      audio.sirenOsc = audio.ctx.createOscillator();
      audio.sirenOsc.type = 'sine';
      audio.sirenOsc.frequency.value = 700;
      audio.sirenOsc.connect(audio.sirenGain);
      audio.sirenOsc.start();
    }
    if (audio.ctx.state === 'suspended') audio.ctx.resume();
    return true;
  };

  audio.setEngine = function setEngine(speed, topSpeed) {
    if (!audio.ctx) return;
    const ratio = Math.min(1, Math.abs(speed) / topSpeed);
    audio.engineOsc.frequency.value = 50 + ratio * 130;
    audio.engineGain.gain.value = Math.abs(speed) > 5 ? 0.03 + ratio * 0.03 : 0;
  };

  audio.setSiren = function setSiren(on, dt) {
    if (!audio.ctx) return;
    audio.sirenGain.gain.value = on ? 0.035 : 0;
    if (on) {
      audio.sirenTimer += dt;
      if (audio.sirenTimer > 0.45) {
        audio.sirenTimer = 0;
        audio.sirenHigh = !audio.sirenHigh;
        audio.sirenOsc.frequency.value = audio.sirenHigh ? 880 : 660;
      }
    }
  };

  function blip(freq, duration, type, volume) {
    if (!audio.ctx) return;
    const osc = audio.ctx.createOscillator();
    const gain = audio.ctx.createGain();
    osc.type = type || 'square';
    osc.frequency.value = freq;
    gain.gain.value = volume || 0.08;
    gain.gain.exponentialRampToValueAtTime(0.001, audio.ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(audio.ctx.destination);
    osc.start();
    osc.stop(audio.ctx.currentTime + duration);
  }

  audio.shot = function shot() {
    if (!audio.ctx) return;
    const len = audio.ctx.sampleRate * 0.12;
    const buffer = audio.ctx.createBuffer(1, len, audio.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i += 1) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    }
    const source = audio.ctx.createBufferSource();
    source.buffer = buffer;
    const gain = audio.ctx.createGain();
    gain.gain.value = 0.25;
    source.connect(gain);
    gain.connect(audio.ctx.destination);
    source.start();
  };

  audio.pickup = function pickup() {
    blip(660, 0.09, 'sine', 0.1);
    setTimeout(() => blip(990, 0.12, 'sine', 0.1), 90);
  };

  audio.jingle = function jingle() {
    const notes = [523, 659, 784, 1047];
    notes.forEach((freq, i) => {
      setTimeout(() => blip(freq, 0.18, 'triangle', 0.12), i * 110);
    });
  };

  audio.crash = function crash() {
    blip(90, 0.25, 'sawtooth', 0.15);
  };

  audio.step = function step(dt, speed, topSpeed, wanted) {
    audio.setEngine(speed, topSpeed);
    audio.setSiren(wanted > 0, dt);
  };

  return audio;
}
