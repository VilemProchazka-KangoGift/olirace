// ---------------------------------------------------------------------------
// Audio system – all sounds generated programmatically via Web Audio API.
// ---------------------------------------------------------------------------

// ---- helpers --------------------------------------------------------------

function createNoiseBuffer(ctx: AudioContext, duration: number): AudioBuffer {
  const sampleRate = ctx.sampleRate;
  const length = Math.ceil(sampleRate * duration);
  const buffer = ctx.createBuffer(1, length, sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  return buffer;
}

/** MIDI-style note helpers */
const NOTE: Record<string, number> = {
  G3: 196.0,
  Ab3: 207.65,
  A3: 220.0,
  Bb3: 233.08,
  C4: 261.63,
  D4: 293.66,
  E4: 329.63,
  F4: 349.23,
  G4: 392.0,
  A4: 440.0,
  Bb4: 466.16,
  B4: 493.88,
  C5: 523.25,
  D5: 587.33,
  E5: 659.25,
  F5: 698.46,
  G5: 783.99,
  A5: 880.0,
  B5: 987.77,
  C6: 1046.5,
};

// ---- types ----------------------------------------------------------------

interface ActiveSound {
  source: AudioBufferSourceNode | OscillatorNode | null;
  gain: GainNode;
  /** Extra nodes to disconnect on stop. */
  extras: AudioNode[];
}

interface SequencerHandle {
  timerId: number;
  gain: GainNode;
}

// ---- AudioManager ---------------------------------------------------------

class AudioManager {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private active: Map<string, ActiveSound> = new Map();
  private loops: Map<string, SequencerHandle> = new Map();
  private engineOsc: OscillatorNode | null = null;
  private engineGain: GainNode | null = null;
  private resumed = false;

  // -- lifecycle ------------------------------------------------------------

  init(): void {
    try {
      this.ctx = new AudioContext();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 1;
      this.masterGain.connect(this.ctx.destination);

      // Many browsers require a user-gesture before the AudioContext runs.
      const resume = () => {
        if (this.ctx && this.ctx.state === 'suspended') {
          this.ctx.resume();
        }
        if (!this.resumed) {
          this.resumed = true;
          window.removeEventListener('click', resume);
          window.removeEventListener('keydown', resume);
          window.removeEventListener('touchstart', resume);
        }
      };
      window.addEventListener('click', resume);
      window.addEventListener('keydown', resume);
      window.addEventListener('touchstart', resume);
    } catch {
      // AudioContext unavailable (e.g. tests) – every method becomes a no-op.
      this.ctx = null;
    }
  }

  // -- public API -----------------------------------------------------------

  play(soundId: string): void {
    if (!this.ctx || !this.masterGain) return;
    // Stop previous instance of the same one-shot so they don't stack
    this.stop(soundId);

    switch (soundId) {
      case 'sfx_engine':
        this.startEngine();
        break;
      case 'sfx_boost':
        this.playBoost();
        break;
      case 'sfx_death':
        this.playDeath();
        break;
      case 'sfx_log':
        this.playLog();
        break;
      case 'sfx_spike':
        this.playSpike();
        break;
      case 'sfx_honk':
        this.playHonk();
        break;
      case 'sfx_countdown_beep':
        this.playCountdownBeep(220);
        break;
      case 'sfx_go':
        this.playGo();
        break;
      case 'sfx_finish':
        this.playFinish();
        break;
      case 'sfx_respawn':
        this.playRespawn();
        break;
      case 'sfx_tether_woosh':
        this.playTetherWoosh();
        break;
      case 'sfx_sad_trombone':
        this.playSadTrombone();
        break;
      default:
        break;
    }
  }

  playLoop(soundId: string): void {
    if (!this.ctx || !this.masterGain) return;
    // Avoid double-start
    if (this.loops.has(soundId)) return;

    switch (soundId) {
      case 'sfx_engine':
        this.startEngine();
        break;
      case 'music_menu':
        this.startMusicMenu();
        break;
      case 'music_race':
        this.startMusicRace();
        break;
      case 'music_results':
        this.startMusicResults();
        break;
      default:
        break;
    }
  }

  stop(soundId: string): void {
    // Stop one-shot
    const a = this.active.get(soundId);
    if (a) {
      try {
        a.gain.gain.cancelScheduledValues(0);
        a.gain.gain.setValueAtTime(0, 0);
        if (a.source) a.source.stop(0);
      } catch {
        /* already stopped */
      }
      a.extras.forEach((n) => {
        try {
          n.disconnect();
        } catch {
          /* ok */
        }
      });
      this.active.delete(soundId);
    }

    // Stop loop / music sequencer
    const l = this.loops.get(soundId);
    if (l) {
      clearTimeout(l.timerId);
      try {
        l.gain.gain.cancelScheduledValues(0);
        l.gain.gain.setValueAtTime(0, 0);
      } catch {
        /* ok */
      }
      this.loops.delete(soundId);
    }

    // Engine-specific
    if (soundId === 'sfx_engine') {
      this.stopEngine();
    }
  }

  setVolume(soundId: string, vol: number): void {
    const clamped = Math.max(0, Math.min(1, vol));
    const a = this.active.get(soundId);
    if (a) {
      a.gain.gain.setValueAtTime(clamped, 0);
    }
    const l = this.loops.get(soundId);
    if (l) {
      l.gain.gain.setValueAtTime(clamped, 0);
    }
    if (soundId === 'sfx_engine' && this.engineGain) {
      this.engineGain.gain.setValueAtTime(clamped, 0);
    }
  }

  stopAll(): void {
    for (const id of this.active.keys()) {
      this.stop(id);
    }
    for (const id of this.loops.keys()) {
      this.stop(id);
    }
    this.stopEngine();
  }

  /** Call every frame during gameplay to modulate engine pitch / volume.
   *  Simulates 4-gear transmission: each gear starts at a lower freq and rises,
   *  creating the characteristic rising-then-dropping pitch of gear shifts. */
  updateEngineSound(speed: number, maxSpeed: number): void {
    if (!this.ctx || !this.engineOsc || !this.engineGain) return;
    const t = Math.max(0, Math.min(1, speed / maxSpeed));

    // Determine gear (0-3) and position within gear (0-1)
    let gear: number;
    let gearT: number;
    if (t < 0.25) {
      gear = 0; gearT = t / 0.25;
    } else if (t < 0.5) {
      gear = 1; gearT = (t - 0.25) / 0.25;
    } else if (t < 0.75) {
      gear = 2; gearT = (t - 0.5) / 0.25;
    } else {
      gear = 3; gearT = (t - 0.75) / 0.25;
    }

    // Each gear: base freq rises, range rises within gear
    const gearBases = [80, 100, 120, 140];
    const gearTops  = [160, 180, 200, 220];
    const freq = gearBases[gear] + gearT * (gearTops[gear] - gearBases[gear]);

    const gain = 0.02 + t * (0.08 - 0.02);
    const now = this.ctx.currentTime;
    this.engineOsc.frequency.setTargetAtTime(freq, now, 0.05);
    this.engineGain.gain.setTargetAtTime(gain, now, 0.05);
  }

  // -- countdown helper: frequency depends on which beat ----------------------

  playCountdownBeep(freq: number): void {
    if (!this.ctx || !this.masterGain) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    gain.connect(this.masterGain);

    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now);
    osc.connect(gain);
    osc.start(now);
    osc.stop(now + 0.15);

    this.registerOneShot('sfx_countdown_beep', osc, gain, []);
  }

  // -- SFX implementations --------------------------------------------------

  private startEngine(): void {
    if (!this.ctx || !this.masterGain || this.engineOsc) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;

    this.engineGain = ctx.createGain();
    this.engineGain.gain.setValueAtTime(0.05, now);
    this.engineGain.connect(this.masterGain);

    this.engineOsc = ctx.createOscillator();
    this.engineOsc.type = 'sawtooth';
    this.engineOsc.frequency.setValueAtTime(80, now);
    this.engineOsc.connect(this.engineGain);
    this.engineOsc.start(now);
  }

  private stopEngine(): void {
    try {
      if (this.engineOsc) {
        this.engineOsc.stop(0);
        this.engineOsc.disconnect();
      }
    } catch {
      /* ok */
    }
    try {
      if (this.engineGain) this.engineGain.disconnect();
    } catch {
      /* ok */
    }
    this.engineOsc = null;
    this.engineGain = null;
  }

  private playBoost(): void {
    const ctx = this.ctx!;
    const master = this.masterGain!;
    const now = ctx.currentTime;
    const dur = 0.3;

    const noiseBuffer = createNoiseBuffer(ctx, dur);
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer;

    const bandpass = ctx.createBiquadFilter();
    bandpass.type = 'bandpass';
    bandpass.Q.setValueAtTime(2, now);
    bandpass.frequency.setValueAtTime(200, now);
    bandpass.frequency.exponentialRampToValueAtTime(2000, now + dur);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + dur);

    src.connect(bandpass);
    bandpass.connect(gain);
    gain.connect(master);
    src.start(now);
    src.stop(now + dur);

    this.registerOneShot('sfx_boost', src, gain, [bandpass]);
  }

  private playDeath(): void {
    const ctx = this.ctx!;
    const master = this.masterGain!;
    const now = ctx.currentTime;
    const dur = 0.2;

    // Noise burst
    const noiseBuf = createNoiseBuffer(ctx, dur);
    const noiseSrc = ctx.createBufferSource();
    noiseSrc.buffer = noiseBuf;
    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.3, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + dur);
    noiseSrc.connect(noiseGain);
    noiseGain.connect(master);
    noiseSrc.start(now);
    noiseSrc.stop(now + dur);

    // Sine sweep 400→100 Hz
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(400, now);
    osc.frequency.exponentialRampToValueAtTime(100, now + dur);
    const oscGain = ctx.createGain();
    oscGain.gain.setValueAtTime(0.3, now);
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + dur);
    osc.connect(oscGain);
    oscGain.connect(master);
    osc.start(now);
    osc.stop(now + dur);

    this.registerOneShot('sfx_death', osc, oscGain, [noiseSrc, noiseGain]);
  }

  private playLog(): void {
    const ctx = this.ctx!;
    const master = this.masterGain!;
    const now = ctx.currentTime;
    const dur = 0.15;

    const noiseBuf = createNoiseBuffer(ctx, dur);
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;

    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(300, now);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.35, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + dur);

    src.connect(lp);
    lp.connect(gain);
    gain.connect(master);
    src.start(now);
    src.stop(now + dur);

    this.registerOneShot('sfx_log', src, gain, [lp]);
  }

  private playSpike(): void {
    const ctx = this.ctx!;
    const master = this.masterGain!;
    const now = ctx.currentTime;
    const dur = 0.2;

    // Square wave 800 Hz
    const osc = ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.setValueAtTime(800, now);
    const oscGain = ctx.createGain();
    oscGain.gain.setValueAtTime(0.2, now);
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + dur);
    osc.connect(oscGain);
    oscGain.connect(master);
    osc.start(now);
    osc.stop(now + dur);

    // Noise layer
    const noiseBuf = createNoiseBuffer(ctx, dur);
    const noiseSrc = ctx.createBufferSource();
    noiseSrc.buffer = noiseBuf;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.setValueAtTime(3000, now);
    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.15, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + dur);
    noiseSrc.connect(hp);
    hp.connect(noiseGain);
    noiseGain.connect(master);
    noiseSrc.start(now);
    noiseSrc.stop(now + dur);

    this.registerOneShot('sfx_spike', osc, oscGain, [noiseSrc, hp, noiseGain]);
  }

  private playHonk(): void {
    const ctx = this.ctx!;
    const master = this.masterGain!;
    const now = ctx.currentTime;
    const dur = 0.3;

    const osc = ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.setValueAtTime(300, now);

    // Vibrato via LFO
    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.setValueAtTime(12, now);
    const lfoGain = ctx.createGain();
    lfoGain.gain.setValueAtTime(20, now); // +/-20 Hz wobble
    lfo.connect(lfoGain);
    lfoGain.connect(osc.frequency);
    lfo.start(now);
    lfo.stop(now + dur);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.2, now);
    gain.gain.setValueAtTime(0.2, now + dur * 0.7);
    gain.gain.exponentialRampToValueAtTime(0.001, now + dur);

    osc.connect(gain);
    gain.connect(master);
    osc.start(now);
    osc.stop(now + dur);

    this.registerOneShot('sfx_honk', osc, gain, [lfo, lfoGain]);
  }

  private playGo(): void {
    const ctx = this.ctx!;
    const master = this.masterGain!;
    const now = ctx.currentTime;
    const dur = 0.3;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.25, now);
    gain.gain.setValueAtTime(0.25, now + dur * 0.7);
    gain.gain.exponentialRampToValueAtTime(0.001, now + dur);
    gain.connect(master);

    const osc1 = ctx.createOscillator();
    osc1.type = 'sawtooth';
    osc1.frequency.setValueAtTime(440, now);
    osc1.connect(gain);
    osc1.start(now);
    osc1.stop(now + dur);

    const osc2 = ctx.createOscillator();
    osc2.type = 'sawtooth';
    osc2.frequency.setValueAtTime(554, now); // major third
    osc2.connect(gain);
    osc2.start(now);
    osc2.stop(now + dur);

    this.registerOneShot('sfx_go', osc1, gain, [osc2]);
  }

  private playFinish(): void {
    const ctx = this.ctx!;
    const master = this.masterGain!;
    const now = ctx.currentTime;
    const notes = [NOTE.C5, NOTE.E5, NOTE.G5, NOTE.C6];
    const noteDur = 0.2;
    const totalDur = notes.length * noteDur + 0.2; // small tail

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.25, now);
    gain.connect(master);

    const extras: AudioNode[] = [];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now);
      const noteGain = ctx.createGain();
      noteGain.gain.setValueAtTime(0, now);
      noteGain.gain.setValueAtTime(0.25, now + i * noteDur);
      noteGain.gain.exponentialRampToValueAtTime(0.001, now + (i + 1) * noteDur);
      osc.connect(noteGain);
      noteGain.connect(gain);
      osc.start(now + i * noteDur);
      osc.stop(now + (i + 1) * noteDur + 0.05);
      extras.push(osc, noteGain);
    });

    // Schedule gain ramp-down at end
    gain.gain.setValueAtTime(0.25, now + totalDur - 0.2);
    gain.gain.exponentialRampToValueAtTime(0.001, now + totalDur);

    // Use first osc just for the active-map bookkeeping (it will auto-stop)
    this.active.set('sfx_finish', { source: null, gain, extras });
  }

  private playRespawn(): void {
    const ctx = this.ctx!;
    const master = this.masterGain!;
    const now = ctx.currentTime;
    const dur = 0.3;

    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, now);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.25, now + dur * 0.4); // slow attack
    gain.gain.exponentialRampToValueAtTime(0.001, now + dur);

    osc.connect(gain);
    gain.connect(master);
    osc.start(now);
    osc.stop(now + dur);

    this.registerOneShot('sfx_respawn', osc, gain, []);
  }

  private playTetherWoosh(): void {
    const ctx = this.ctx!;
    const master = this.masterGain!;
    const now = ctx.currentTime;
    const dur = 0.2;

    const noiseBuf = createNoiseBuffer(ctx, dur);
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;

    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.setValueAtTime(3, now);
    bp.frequency.setValueAtTime(4000, now);
    bp.frequency.exponentialRampToValueAtTime(200, now + dur);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + dur);

    src.connect(bp);
    bp.connect(gain);
    gain.connect(master);
    src.start(now);
    src.stop(now + dur);

    this.registerOneShot('sfx_tether_woosh', src, gain, [bp]);
  }

  private playSadTrombone(): void {
    const ctx = this.ctx!;
    const master = this.masterGain!;
    const now = ctx.currentTime;
    const notes = [NOTE.Bb3, NOTE.A3, NOTE.Ab3, NOTE.G3];
    const noteDur = 0.25;
    const totalDur = notes.length * noteDur;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.2, now);
    gain.connect(master);

    const extras: AudioNode[] = [];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, now + i * noteDur);
      const noteGain = ctx.createGain();
      noteGain.gain.setValueAtTime(0, now);
      noteGain.gain.setValueAtTime(0.2, now + i * noteDur);
      noteGain.gain.setValueAtTime(0.2, now + (i + 0.9) * noteDur);
      noteGain.gain.exponentialRampToValueAtTime(0.001, now + (i + 1) * noteDur);
      osc.connect(noteGain);
      noteGain.connect(gain);
      osc.start(now + i * noteDur);
      osc.stop(now + (i + 1) * noteDur + 0.02);
      extras.push(osc, noteGain);
    });

    gain.gain.setValueAtTime(0.2, now + totalDur - 0.05);
    gain.gain.exponentialRampToValueAtTime(0.001, now + totalDur);

    this.active.set('sfx_sad_trombone', { source: null, gain, extras });
  }

  // -- music loops ----------------------------------------------------------

  private startMusicMenu(): void {
    if (!this.ctx || !this.masterGain) return;
    const ctx = this.ctx;
    const master = this.masterGain;

    // 120 BPM, C major, 8 bars of 4 beats = 32 beats
    const bpm = 120;
    const beatSec = 60 / bpm;

    // Melody (square) – bouncy C major pattern
    const melody: [number, number][] = [
      // [freq, beats]
      [NOTE.C5, 1], [NOTE.E5, 1], [NOTE.G5, 1], [NOTE.E5, 1],
      [NOTE.F5, 1], [NOTE.A5, 1], [NOTE.G5, 2],
      [NOTE.C5, 1], [NOTE.D5, 1], [NOTE.E5, 1], [NOTE.G5, 1],
      [NOTE.A5, 2], [NOTE.G5, 2],
      [NOTE.E5, 1], [NOTE.D5, 1], [NOTE.C5, 1], [NOTE.E5, 1],
      [NOTE.F5, 1], [NOTE.E5, 1], [NOTE.D5, 2],
      [NOTE.C5, 1], [NOTE.E5, 1], [NOTE.G5, 1], [NOTE.C6, 1],
      [NOTE.B5, 1], [NOTE.G5, 1], [NOTE.C5, 2],
    ];

    // Bass (triangle) – root notes
    const bass: [number, number][] = [
      [NOTE.C4, 4], [NOTE.F4, 4],
      [NOTE.C4, 4], [NOTE.G4, 4],
      [NOTE.C4, 4], [NOTE.F4, 4],
      [NOTE.C4, 4], [NOTE.G4, 4],
    ];

    const loopGain = ctx.createGain();
    loopGain.gain.setValueAtTime(0.12, ctx.currentTime);
    loopGain.connect(master);

    const scheduleLoop = () => {
      const startTime = ctx.currentTime + 0.05;

      // Melody
      let t = startTime;
      for (const [freq, beats] of melody) {
        const dur = beats * beatSec;
        const osc = ctx.createOscillator();
        osc.type = 'square';
        osc.frequency.setValueAtTime(freq, t);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.12, t);
        g.gain.setValueAtTime(0.12, t + dur * 0.7);
        g.gain.exponentialRampToValueAtTime(0.001, t + dur * 0.95);
        osc.connect(g);
        g.connect(loopGain);
        osc.start(t);
        osc.stop(t + dur);
        t += dur;
      }

      // Bass
      let bt = startTime;
      for (const [freq, beats] of bass) {
        const dur = beats * beatSec;
        const osc = ctx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, bt);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.15, bt);
        g.gain.setValueAtTime(0.15, bt + dur * 0.8);
        g.gain.exponentialRampToValueAtTime(0.001, bt + dur * 0.95);
        osc.connect(g);
        g.connect(loopGain);
        osc.start(bt);
        osc.stop(bt + dur);
        bt += dur;
      }

      // Total loop duration in ms
      const totalBeats = melody.reduce((s, [, b]) => s + b, 0);
      const loopMs = totalBeats * beatSec * 1000;

      const timerId = window.setTimeout(scheduleLoop, loopMs - 100);
      this.loops.set('music_menu', { timerId, gain: loopGain });
    };

    scheduleLoop();
  }

  private startMusicRace(): void {
    if (!this.ctx || !this.masterGain) return;
    const ctx = this.ctx;
    const master = this.masterGain;

    // 140 BPM, A minor, 16 bars of 4 beats = 64 beats
    const bpm = 140;
    const beatSec = 60 / bpm;

    // Lead (pulse / square)
    const lead: [number, number][] = [
      [NOTE.A4, 1], [NOTE.C5, 1], [NOTE.E5, 1], [NOTE.C5, 1],
      [NOTE.D5, 1], [NOTE.C5, 1], [NOTE.A4, 2],
      [NOTE.G4, 1], [NOTE.A4, 1], [NOTE.C5, 1], [NOTE.D5, 1],
      [NOTE.E5, 2], [NOTE.D5, 2],
      [NOTE.A4, 1], [NOTE.C5, 1], [NOTE.E5, 1], [NOTE.A5, 1],
      [NOTE.G5, 1], [NOTE.E5, 1], [NOTE.D5, 2],
      [NOTE.C5, 1], [NOTE.D5, 1], [NOTE.E5, 1], [NOTE.C5, 1],
      [NOTE.A4, 2], [NOTE.A4, 2],
      // Bars 5–8 repeat variation
      [NOTE.A4, 1], [NOTE.E5, 0.5], [NOTE.E5, 0.5], [NOTE.D5, 1], [NOTE.C5, 1],
      [NOTE.D5, 1], [NOTE.E5, 1], [NOTE.A4, 2],
      [NOTE.G4, 1], [NOTE.A4, 1], [NOTE.C5, 2],
      [NOTE.D5, 1], [NOTE.E5, 1], [NOTE.A5, 2],
      [NOTE.E5, 1], [NOTE.D5, 1], [NOTE.C5, 1], [NOTE.D5, 1],
      [NOTE.E5, 2], [NOTE.C5, 2],
      [NOTE.A4, 1], [NOTE.C5, 1], [NOTE.D5, 1], [NOTE.E5, 1],
      [NOTE.A4, 2], [NOTE.A4, 2],
    ];

    // Bass (sawtooth)
    const bass: [number, number][] = [
      [NOTE.A3, 4], [NOTE.A3, 4],
      [NOTE.G3, 4], [NOTE.G3, 4],
      [NOTE.A3, 4], [NOTE.A3, 4],
      [NOTE.G3, 4], [NOTE.A3, 4],
      [NOTE.A3, 4], [NOTE.A3, 4],
      [NOTE.G3, 4], [NOTE.G3, 4],
      [NOTE.A3, 4], [NOTE.A3, 4],
      [NOTE.G3, 4], [NOTE.A3, 4],
    ];

    const loopGain = ctx.createGain();
    loopGain.gain.setValueAtTime(0.10, ctx.currentTime);
    loopGain.connect(master);

    const scheduleLoop = () => {
      const startTime = ctx.currentTime + 0.05;

      // Lead
      let t = startTime;
      for (const [freq, beats] of lead) {
        const dur = beats * beatSec;
        const osc = ctx.createOscillator();
        osc.type = 'square';
        osc.frequency.setValueAtTime(freq, t);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.10, t);
        g.gain.setValueAtTime(0.10, t + dur * 0.6);
        g.gain.exponentialRampToValueAtTime(0.001, t + dur * 0.9);
        osc.connect(g);
        g.connect(loopGain);
        osc.start(t);
        osc.stop(t + dur);
        t += dur;
      }

      // Bass
      let bt = startTime;
      for (const [freq, beats] of bass) {
        const dur = beats * beatSec;
        const osc = ctx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq, bt);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.08, bt);
        g.gain.setValueAtTime(0.08, bt + dur * 0.8);
        g.gain.exponentialRampToValueAtTime(0.001, bt + dur * 0.95);
        osc.connect(g);
        g.connect(loopGain);
        osc.start(bt);
        osc.stop(bt + dur);
        bt += dur;
      }

      // Noise hi-hat – eighth notes
      const totalBeats = lead.reduce((s, [, b]) => s + b, 0);
      const eighthCount = Math.floor(totalBeats * 2);
      const eighthDur = beatSec / 2;
      for (let i = 0; i < eighthCount; i++) {
        const ht = startTime + i * eighthDur;
        const nBuf = createNoiseBuffer(ctx, 0.04);
        const nSrc = ctx.createBufferSource();
        nSrc.buffer = nBuf;
        const hp = ctx.createBiquadFilter();
        hp.type = 'highpass';
        hp.frequency.setValueAtTime(8000, ht);
        const ng = ctx.createGain();
        ng.gain.setValueAtTime(0.06, ht);
        ng.gain.exponentialRampToValueAtTime(0.001, ht + 0.04);
        nSrc.connect(hp);
        hp.connect(ng);
        ng.connect(loopGain);
        nSrc.start(ht);
        nSrc.stop(ht + 0.05);
      }

      const loopMs = totalBeats * beatSec * 1000;
      const timerId = window.setTimeout(scheduleLoop, loopMs - 100);
      this.loops.set('music_race', { timerId, gain: loopGain });
    };

    scheduleLoop();
  }

  private startMusicResults(): void {
    if (!this.ctx || !this.masterGain) return;
    const ctx = this.ctx;
    const master = this.masterGain;

    // 100 BPM, F major, 8 bars
    const bpm = 100;
    const beatSec = 60 / bpm;

    // Melody (sine) – chill F major
    const melody: [number, number][] = [
      [NOTE.F5, 2], [NOTE.A5, 1], [NOTE.G5, 1],
      [NOTE.F5, 2], [NOTE.C5, 2],
      [NOTE.D5, 2], [NOTE.F5, 1], [NOTE.E5, 1],
      [NOTE.D5, 2], [NOTE.C5, 2],
      [NOTE.F5, 2], [NOTE.A5, 1], [NOTE.C6, 1],
      [NOTE.A5, 2], [NOTE.G5, 2],
      [NOTE.F5, 1], [NOTE.E5, 1], [NOTE.D5, 1], [NOTE.C5, 1],
      [NOTE.F4, 2], [NOTE.F4, 2],
    ];

    // Pad (triangle) – whole notes
    const pad: [number, number][] = [
      [NOTE.F4, 4], [NOTE.C4, 4],
      [NOTE.D4, 4], [NOTE.C4, 4],
      [NOTE.F4, 4], [NOTE.C4, 4],
      [NOTE.D4, 4], [NOTE.F4, 4],
    ];

    const loopGain = ctx.createGain();
    loopGain.gain.setValueAtTime(0.12, ctx.currentTime);
    loopGain.connect(master);

    const scheduleLoop = () => {
      const startTime = ctx.currentTime + 0.05;

      // Melody
      let t = startTime;
      for (const [freq, beats] of melody) {
        const dur = beats * beatSec;
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, t);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(0.12, t + 0.03);
        g.gain.setValueAtTime(0.12, t + dur * 0.7);
        g.gain.exponentialRampToValueAtTime(0.001, t + dur * 0.95);
        osc.connect(g);
        g.connect(loopGain);
        osc.start(t);
        osc.stop(t + dur);
        t += dur;
      }

      // Pad
      let pt = startTime;
      for (const [freq, beats] of pad) {
        const dur = beats * beatSec;
        const osc = ctx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, pt);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0, pt);
        g.gain.linearRampToValueAtTime(0.10, pt + 0.1);
        g.gain.setValueAtTime(0.10, pt + dur * 0.8);
        g.gain.exponentialRampToValueAtTime(0.001, pt + dur * 0.95);
        osc.connect(g);
        g.connect(loopGain);
        osc.start(pt);
        osc.stop(pt + dur);
        pt += dur;
      }

      const totalBeats = melody.reduce((s, [, b]) => s + b, 0);
      const loopMs = totalBeats * beatSec * 1000;
      const timerId = window.setTimeout(scheduleLoop, loopMs - 100);
      this.loops.set('music_results', { timerId, gain: loopGain });
    };

    scheduleLoop();
  }

  // -- internal bookkeeping -------------------------------------------------

  private registerOneShot(
    id: string,
    source: AudioBufferSourceNode | OscillatorNode,
    gain: GainNode,
    extras: AudioNode[],
  ): void {
    this.active.set(id, { source, gain, extras });
    const cleanup = () => {
      // Only remove if this exact entry is still the active one
      const current = this.active.get(id);
      if (current && current.source === source) {
        this.active.delete(id);
      }
    };
    source.onended = cleanup;
  }
}

// ---- singleton ------------------------------------------------------------

export const audioManager = new AudioManager();
