// Sound, all synthesised with the Web Audio API: no audio files, no network. Engine hum
// follows the car's speed, the siren wails two tones while police chase, and one-shots
// cover gunfire, pickups, crashes and mission jingles. Everything starts on the first
// user gesture, since browsers block audio before one.

export function createAudio() {
  let context = null;
  let master = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let sirenTimer = 0;
  let musicTimer = 0;
  let musicStep = 0;
  let enabled = true;

  function ensure() {
    if (context) return true;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return false;
      context = new AudioContext();
      master = context.createGain();
      master.gain.value = 0.5;
      master.connect(context.destination);
      engineOsc = context.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 60;
      engineGain = context.createGain();
      engineGain.gain.value = 0;
      engineOsc.connect(engineGain);
      engineGain.connect(master);
      engineOsc.start();
      sirenOsc = context.createOscillator();
      sirenOsc.type = 'sine';
      sirenOsc.frequency.value = 700;
      sirenGain = context.createGain();
      sirenGain.gain.value = 0;
      sirenOsc.connect(sirenGain);
      sirenGain.connect(master);
      sirenOsc.start();
    } catch {
      return false;
    }
    return true;
  }

  function tone(freq, dur, type, volume, slideTo) {
    if (!ensure() || !enabled) return;
    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, context.currentTime);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, context.currentTime + dur);
    gain.gain.setValueAtTime(volume, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + dur);
    osc.connect(gain);
    gain.connect(master);
    osc.start();
    osc.stop(context.currentTime + dur);
  }

  function noise(dur, volume, lowpass) {
    if (!ensure() || !enabled) return;
    const length = Math.floor(context.sampleRate * dur);
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const source = context.createBufferSource();
    source.buffer = buffer;
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = lowpass;
    const gain = context.createGain();
    gain.gain.value = volume;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    source.start();
  }

  /** A tiny bass line that loops while driving, stepped on the beat. */
  const BASSLINE = [55, 0, 55, 65.4, 55, 0, 82.4, 73.4];

  return {
    /** Call on the first key or pointer press: unlocks the audio context. */
    unlock() {
      ensure();
      if (context && context.state === 'suspended') context.resume();
    },
    setEnabled(value) {
      enabled = value;
      if (master) master.gain.value = value ? 0.5 : 0;
    },
    /** Engine hum and siren, updated every frame from the game state. */
    update(dt, speed, maxSpeed, wanted) {
      if (!context || !enabled) return;
      engineGain.gain.value = speed > 20 ? 0.05 + 0.05 * (speed / maxSpeed) : 0;
      engineOsc.frequency.value = 55 + 90 * (speed / maxSpeed);
      if (wanted > 0) {
        sirenTimer += dt;
        sirenOsc.frequency.value = Math.sin(sirenTimer * 5) > 0 ? 720 : 540;
        sirenGain.gain.value = 0.045;
      } else {
        sirenGain.gain.value = 0;
      }
      musicTimer += dt;
      if (musicTimer > 0.22 && speed > 60) {
        musicTimer = 0;
        const note = BASSLINE[musicStep % BASSLINE.length];
        musicStep += 1;
        if (note) tone(note, 0.2, 'triangle', 0.12);
      }
    },
    shoot() {
      noise(0.12, 0.5, 2400);
    },
    punch() {
      noise(0.08, 0.35, 900);
    },
    crash() {
      noise(0.25, 0.6, 500);
    },
    pickup() {
      tone(660, 0.12, 'sine', 0.25);
      tone(990, 0.18, 'sine', 0.22);
    },
    cash() {
      tone(880, 0.1, 'sine', 0.25);
      tone(1174, 0.14, 'sine', 0.25);
      tone(1568, 0.22, 'sine', 0.22);
    },
    missionDone() {
      tone(523, 0.14, 'triangle', 0.3);
      tone(659, 0.14, 'triangle', 0.3);
      tone(784, 0.14, 'triangle', 0.3);
      tone(1046, 0.3, 'triangle', 0.3);
    },
    busted() {
      tone(220, 0.5, 'sawtooth', 0.3, 110);
    },
  };
}
