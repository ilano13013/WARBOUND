// Moteur audio entièrement synthétisé (Web Audio) : armes, compétences, ambiances, audio spatial et musique procédurale.
import * as THREE from 'three';
import type { Settings } from '../save/Save';
import { Assets } from '../assets/Assets';

type MusicMode = 'none' | 'menu' | 'hub' | 'explore' | 'combat' | 'boss' | 'ending';

interface ToneOpts { type?: OscillatorType; to?: number; attack?: number; vol?: number; pos?: THREE.Vector3 | null; delay?: number; filter?: number; bus?: AudioNode }
interface NoiseOpts { vol?: number; type?: BiquadFilterType; freq?: number; to?: number; q?: number; attack?: number; pos?: THREE.Vector3 | null; delay?: number; bus?: AudioNode }

export class AudioSys {
  ctx: AudioContext | null = null;
  private master!: GainNode; private sfx!: GainNode; private music!: GainNode; private musicBus!: GainNode;
  private noiseBuf!: AudioBuffer;
  private reverb!: ConvolverNode;
  private mode: MusicMode = 'none';
  private wanted: MusicMode = 'none';
  private step = 0; private nextTime = 0; private timer: number | null = null;
  private root = 38; // note MIDI de base
  private theme = 0;
  private lastStep = 0;
  private droneNodes: { stop: () => void } | null = null;

  constructor(private settings: Settings) {}

  /** Doit être appelé après un geste utilisateur. */
  init(): void {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    try {
      const AC = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new AC();
    } catch { return; }
    const c = this.ctx!;
    this.master = c.createGain(); this.master.connect(c.destination);
    const comp = c.createDynamicsCompressor();
    comp.threshold.value = -14; comp.ratio.value = 6; comp.attack.value = 0.003; comp.release.value = 0.2;
    comp.connect(this.master);
    this.sfx = c.createGain(); this.sfx.connect(comp);
    this.music = c.createGain(); this.music.connect(comp);
    this.musicBus = c.createGain(); this.musicBus.connect(this.music);
    // réverbération synthétique pour la musique
    const len = c.sampleRate * 2.2;
    const ir = c.createBuffer(2, len, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6); }
    this.reverb = c.createConvolver(); this.reverb.buffer = ir;
    const wet = c.createGain(); wet.gain.value = 0.35;
    this.musicBus.connect(this.reverb); this.reverb.connect(wet); wet.connect(this.music);
    this.noiseBuf = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
    const nd = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    this.applyVolumes();
    this.timer = window.setInterval(() => this.schedule(), 90);
    void Assets.decodeSounds(c);
    if (this.wanted !== 'none') { const w = this.wanted; this.mode = 'none'; this.setMusic(w); }
  }

  applyVolumes(): void {
    if (!this.ctx) return;
    this.master.gain.value = this.settings.volMaster;
    this.sfx.gain.value = this.settings.volSfx;
    this.music.gain.value = this.settings.volMusic * 0.55;
  }

  setListener(cam: THREE.Camera): void {
    if (!this.ctx) return;
    const l = this.ctx.listener;
    const p = cam.position;
    const f = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion);
    if (l.positionX) {
      l.positionX.value = p.x; l.positionY.value = p.y; l.positionZ.value = p.z;
      l.forwardX.value = f.x; l.forwardY.value = f.y; l.forwardZ.value = f.z;
      l.upX.value = 0; l.upY.value = 1; l.upZ.value = 0;
    } else { (l as any).setPosition(p.x, p.y, p.z); (l as any).setOrientation(f.x, f.y, f.z, 0, 1, 0); }
  }

  private out(pos?: THREE.Vector3 | null, bus?: AudioNode): AudioNode {
    const c = this.ctx!;
    if (bus) return bus;
    if (!pos) return this.sfx;
    const p = c.createPanner();
    p.panningModel = 'equalpower'; p.distanceModel = 'inverse'; p.refDistance = 4; p.maxDistance = 120; p.rolloffFactor = 1.1;
    p.positionX.value = pos.x; p.positionY.value = pos.y; p.positionZ.value = pos.z;
    p.connect(this.sfx);
    return p;
  }

  tone(freq: number, dur: number, o: ToneOpts = {}): void {
    const c = this.ctx; if (!c) return;
    const t = c.currentTime + (o.delay || 0);
    const osc = c.createOscillator(); osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(Math.max(20, freq), t);
    if (o.to) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.to), t + dur);
    const g = c.createGain(); const v = o.vol ?? 0.2;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(v, t + (o.attack ?? 0.004));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let node: AudioNode = osc;
    if (o.filter) { const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = o.filter; node.connect(f); node = f; }
    node.connect(g); g.connect(this.out(o.pos, o.bus));
    osc.start(t); osc.stop(t + dur + 0.05);
  }

  noise(dur: number, o: NoiseOpts = {}): void {
    const c = this.ctx; if (!c) return;
    const t = c.currentTime + (o.delay || 0);
    const src = c.createBufferSource(); src.buffer = this.noiseBuf; src.loop = true;
    src.playbackRate.value = 0.8 + Math.random() * 0.4;
    const f = c.createBiquadFilter(); f.type = o.type || 'lowpass';
    f.frequency.setValueAtTime(o.freq ?? 2000, t);
    if (o.to) f.frequency.exponentialRampToValueAtTime(Math.max(30, o.to), t + dur);
    f.Q.value = o.q ?? 0.8;
    const g = c.createGain(); const v = o.vol ?? 0.2;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(v, t + (o.attack ?? 0.002));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(this.out(o.pos, o.bus));
    src.start(t, Math.random()); src.stop(t + dur + 0.05);
  }

  // ---------- échantillons enregistrés (Free Firearm Sound Library, Fantozzi, CC0) ----------

  /** Joue un son enregistré ; retourne false s'il n'est pas disponible (repli sur la synthèse). */
  sample(name: string, o: { vol?: number; rate?: number; pos?: THREE.Vector3 | null; delay?: number; lowpass?: number } = {}): boolean {
    const c = this.ctx; if (!c) return false;
    const buf = Assets.sounds.get(name);
    if (!buf) return false;
    const src = c.createBufferSource(); src.buffer = buf;
    src.playbackRate.value = (o.rate ?? 1) * (0.96 + Math.random() * 0.08);
    const g = c.createGain(); g.gain.value = o.vol ?? 1;
    let node: AudioNode = src;
    if (o.lowpass) { const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = o.lowpass; node.connect(f); node = f; }
    node.connect(g); g.connect(this.out(o.pos ?? null));
    src.start(c.currentTime + (o.delay || 0));
    return true;
  }

  // ---------- armes ----------

  gunshot(s: { pitch: number; body: number; crack: number; tail: number }, silenced = false, pos: THREE.Vector3 | null = null, vol = 1, rec?: [string, number]): void {
    if (!this.ctx) return;
    // enregistrement réel + couche synthétique grave pour le « poids » du tir
    if (rec && this.sample(rec[0], { vol: (silenced ? 0.35 : 0.95) * vol, rate: rec[1], pos, lowpass: silenced ? 1400 : undefined })) {
      if (!silenced) { this.tone(110 * s.pitch, 0.08 + s.tail * 0.12, { type: 'sine', to: 38, vol: 0.45 * s.body * vol, pos }); this.noise(0.04, { vol: 0.18 * s.crack * vol, type: 'highpass', freq: 3200, pos }); }
      else this.noise(0.08, { vol: 0.14 * vol, type: 'bandpass', freq: 1500, q: 0.8, pos });
      return;
    }
    const p = s.pitch * (0.97 + Math.random() * 0.06);
    if (silenced) {
      this.noise(0.09, { vol: 0.22 * vol, type: 'bandpass', freq: 1400 * p, q: 0.7, pos });
      this.tone(160 * p, 0.06, { type: 'triangle', to: 70, vol: 0.14 * vol, pos });
      return;
    }
    this.noise(0.05 + s.tail * 0.1, { vol: 0.55 * s.crack * vol, type: 'highpass', freq: 1800 * p, to: 500, pos });
    this.noise(0.12 + s.tail * 0.5, { vol: 0.5 * s.body * vol, type: 'lowpass', freq: 1300 * p, to: 180, pos });
    this.tone(150 * p, 0.09 + s.tail * 0.22, { type: 'triangle', to: 42, vol: 0.6 * s.body * vol, pos });
    if (s.tail > 0.3) this.noise(s.tail * 1.6, { vol: 0.12 * vol, type: 'bandpass', freq: 500, to: 160, q: 0.4, pos, delay: 0.04 });
  }

  enemyShot(kind: string, pos: THREE.Vector3): void {
    const far: Record<string, string> = { rifle: Math.random() < 0.5 ? 'ar15_far' : 'ak_far', sniper: 'sniper_far', shotgun: 'shotgun_far' };
    if (far[kind] && this.sample(far[kind], { vol: kind === 'sniper' ? 1 : 0.6, pos, rate: kind === 'rifle' ? 1.05 : 1 })) return;
    if (kind === 'sniper') this.gunshot({ pitch: 0.6, body: 1.3, crack: 1, tail: 0.5 }, false, pos, 0.8);
    else if (kind === 'shotgun') this.gunshot({ pitch: 0.7, body: 1.4, crack: 0.7, tail: 0.35 }, false, pos, 0.8);
    else if (kind === 'laser') { this.tone(1400, 0.1, { type: 'sawtooth', to: 500, vol: 0.1, pos, filter: 3000 }); }
    else if (kind === 'orb') { this.tone(300, 0.35, { type: 'sine', to: 700, vol: 0.2, pos }); this.noise(0.3, { vol: 0.08, type: 'bandpass', freq: 2400, q: 3, pos }); }
    else this.gunshot({ pitch: 0.92, body: 0.7, crack: 0.8, tail: 0.22 }, false, pos, 0.55);
  }

  dry(): void { this.tone(900, 0.03, { type: 'square', vol: 0.06 }); }
  reload(stage: 0 | 1 | 2): void {
    if (stage === 0) { this.noise(0.05, { vol: 0.2, type: 'bandpass', freq: 2600, q: 2 }); this.tone(320, 0.04, { type: 'square', vol: 0.05, delay: 0.02 }); }
    else if (stage === 1) { this.noise(0.06, { vol: 0.25, type: 'bandpass', freq: 1700, q: 2 }); this.tone(220, 0.05, { type: 'square', vol: 0.07, delay: 0.03 }); }
    else { this.noise(0.04, { vol: 0.3, type: 'highpass', freq: 3000 }); this.tone(520, 0.035, { type: 'square', vol: 0.08 }); this.noise(0.05, { vol: 0.2, type: 'bandpass', freq: 1200, q: 3, delay: 0.07 }); }
  }
  swap(): void { this.noise(0.12, { vol: 0.12, type: 'bandpass', freq: 900, to: 2200, q: 1 }); }

  private stepI = 0;
  footstep(surf: string, sprint: boolean): void {
    this.stepI++;
    const kind = surf === 'dirt' ? 'sand' : 'stone';
    const name = `step_${kind}${this.stepI % 2 ? 'l' : 'r'}${1 + (this.stepI % 3)}`;
    if (this.sample(name, { vol: (sprint ? 0.55 : 0.38) * (surf === 'metal' ? 0.8 : 1), rate: surf === 'metal' ? 1.35 : 1 })) { if (surf === 'metal') this.tone(260, 0.06, { type: 'triangle', vol: 0.03, to: 180 }); return; }
    const v = sprint ? 0.13 : 0.08;
    if (surf === 'metal') { this.noise(0.07, { vol: v, type: 'bandpass', freq: 900, q: 3 }); this.tone(190, 0.08, { type: 'triangle', vol: v * 0.6, to: 120 }); }
    else if (surf === 'dirt') this.noise(0.1, { vol: v * 1.1, type: 'lowpass', freq: 600 });
    else { this.noise(0.06, { vol: v, type: 'lowpass', freq: 1100 }); this.tone(90, 0.05, { vol: v * 0.7, to: 60 }); }
  }
  jump(): void { this.noise(0.12, { vol: 0.08, type: 'lowpass', freq: 500, to: 1200 }); }
  land(): void { this.noise(0.14, { vol: 0.2, type: 'lowpass', freq: 500, to: 120 }); this.tone(70, 0.12, { vol: 0.25, to: 40 }); }
  slide(): void { this.noise(0.6, { vol: 0.16, type: 'bandpass', freq: 700, to: 300, q: 0.6 }); }

  impact(surf: string, pos: THREE.Vector3): void {
    if (surf === 'metal') { this.tone(1800 + Math.random() * 1400, 0.09, { type: 'triangle', vol: 0.07, pos }); this.noise(0.04, { vol: 0.1, type: 'highpass', freq: 3500, pos }); }
    else if (surf === 'crystal') { this.tone(2400 + Math.random() * 800, 0.2, { type: 'sine', vol: 0.08, pos }); }
    else if (surf === 'flesh') this.noise(0.07, { vol: 0.14, type: 'lowpass', freq: 700, pos });
    else if (surf === 'energy') this.tone(700, 0.12, { type: 'sine', to: 1500, vol: 0.08, pos });
    else this.noise(0.07, { vol: 0.12, type: 'bandpass', freq: 1500, q: 0.8, pos });
  }

  hitmarker(head: boolean, kill: boolean): void {
    if (kill) { this.tone(1250, 0.07, { type: 'square', vol: 0.09, filter: 5000 }); this.tone(1900, 0.12, { type: 'square', vol: 0.09, delay: 0.05, filter: 6000 }); }
    else if (head) this.tone(1700, 0.05, { type: 'square', vol: 0.08, filter: 6000 });
    else this.tone(1050, 0.035, { type: 'square', vol: 0.05, filter: 4000 });
  }

  explosion(pos: THREE.Vector3 | null, big = 1): void {
    this.noise(0.9 * big, { vol: 0.9, type: 'lowpass', freq: 1800, to: 80, pos });
    this.tone(95, 0.6 * big, { type: 'sine', to: 28, vol: 0.9, pos });
    this.noise(0.25, { vol: 0.5, type: 'highpass', freq: 2500, pos });
  }

  hurt(): void { this.noise(0.12, { vol: 0.22, type: 'lowpass', freq: 500 }); this.tone(140, 0.15, { type: 'sawtooth', to: 80, vol: 0.12, filter: 600 }); }
  shieldHit(): void { this.tone(520, 0.12, { type: 'sine', to: 900, vol: 0.12 }); this.noise(0.06, { vol: 0.1, type: 'highpass', freq: 4000 }); }
  heal(): void { [523, 659, 784].forEach((f, i) => this.tone(f, 0.35, { type: 'sine', vol: 0.09, delay: i * 0.07 })); }
  pickup(): void { this.tone(880, 0.08, { type: 'triangle', vol: 0.1 }); this.tone(1320, 0.1, { type: 'triangle', vol: 0.1, delay: 0.06 }); }
  denied(): void { this.tone(160, 0.14, { type: 'square', vol: 0.07, filter: 800 }); }
  uiClick(): void { this.tone(700, 0.04, { type: 'square', vol: 0.05, filter: 3000 }); this.noise(0.02, { vol: 0.05, type: 'highpass', freq: 5000 }); }
  uiHover(): void { this.tone(1300, 0.02, { type: 'sine', vol: 0.025 }); }
  uiOpen(): void { this.noise(0.15, { vol: 0.07, type: 'bandpass', freq: 800, to: 2400, q: 2 }); this.tone(440, 0.1, { type: 'triangle', vol: 0.05, to: 660 }); }
  radio(): void { this.noise(0.08, { vol: 0.08, type: 'bandpass', freq: 2600, q: 4 }); this.tone(1480, 0.06, { type: 'square', vol: 0.04, delay: 0.08, filter: 3000 }); this.tone(1100, 0.06, { type: 'square', vol: 0.04, delay: 0.16, filter: 3000 }); }
  objective(): void { [392, 523, 659].forEach((f, i) => this.tone(f, 0.3, { type: 'triangle', vol: 0.1, delay: i * 0.09 })); }
  levelUp(): void { [392, 494, 587, 784, 988].forEach((f, i) => { this.tone(f, 0.5, { type: 'triangle', vol: 0.12, delay: i * 0.08 }); this.tone(f * 2, 0.4, { type: 'sine', vol: 0.04, delay: i * 0.08 }); }); }
  loot(rarity: number): void {
    const base = [523, 587, 659, 784][rarity] || 523;
    for (let i = 0; i <= rarity + 1; i++) this.tone(base * Math.pow(1.26, i), 0.5, { type: 'sine', vol: 0.1, delay: i * 0.09 });
    if (rarity >= 3) this.noise(1.2, { vol: 0.06, type: 'highpass', freq: 5000, delay: 0.3 });
  }
  door(pos: THREE.Vector3): void { this.noise(0.8, { vol: 0.2, type: 'bandpass', freq: 300, to: 700, q: 2, pos }); this.tone(70, 0.7, { type: 'sawtooth', vol: 0.12, to: 95, pos, filter: 400 }); }
  alarm(): void { for (let i = 0; i < 3; i++) this.tone(620, 0.3, { type: 'square', to: 880, vol: 0.06, delay: i * 0.4, filter: 2000 }); }
  warn(pos: THREE.Vector3 | null = null): void { this.tone(980, 0.12, { type: 'square', vol: 0.07, pos, filter: 3000 }); this.tone(980, 0.12, { type: 'square', vol: 0.07, pos, delay: 0.18, filter: 3000 }); }
  grenadeBounce(pos: THREE.Vector3): void { this.tone(700, 0.04, { type: 'triangle', vol: 0.1, pos }); }

  // ---------- compétences ----------

  skill(id: string, pos: THREE.Vector3 | null = null): void {
    switch (id) {
      case 'ember': this.noise(0.5, { vol: 0.25, type: 'bandpass', freq: 500, to: 2600, q: 0.8 }); this.tone(180, 0.4, { type: 'sawtooth', to: 420, vol: 0.1, filter: 1200 }); break;
      case 'dash': case 'blink': this.noise(0.3, { vol: 0.3, type: 'bandpass', freq: 2800, to: 400, q: 1.2 }); this.tone(id === 'blink' ? 1200 : 500, 0.22, { type: 'sine', to: id === 'blink' ? 200 : 140, vol: 0.14 }); break;
      case 'aegis': case 'armor': case 'fortress': this.tone(220, 0.5, { type: 'triangle', to: 440, vol: 0.16 }); this.tone(330, 0.5, { type: 'sine', to: 660, vol: 0.1 }); this.noise(0.3, { vol: 0.1, type: 'highpass', freq: 3000 }); break;
      case 'shockwave': this.tone(120, 0.5, { type: 'sine', to: 30, vol: 0.7 }); this.noise(0.5, { vol: 0.4, type: 'lowpass', freq: 1200, to: 100 }); break;
      case 'pulse': case 'rebirth': this.heal(); this.noise(0.4, { vol: 0.08, type: 'highpass', freq: 4000 }); if (id === 'rebirth') { this.tone(196, 1.2, { type: 'triangle', vol: 0.16 }); this.tone(392, 1.2, { type: 'sine', vol: 0.12, delay: 0.1 }); } break;
      case 'meddrone': case 'scout': this.tone(660, 0.1, { type: 'square', vol: 0.06, filter: 3000 }); this.tone(990, 0.1, { type: 'square', vol: 0.06, delay: 0.1, filter: 3000 }); this.tone(1320, 0.14, { type: 'square', vol: 0.06, delay: 0.2, filter: 3000 }); break;
      case 'regenfield': this.tone(262, 0.9, { type: 'sine', vol: 0.14 }); this.tone(330, 0.9, { type: 'sine', vol: 0.1, delay: 0.12 }); this.tone(392, 0.9, { type: 'sine', vol: 0.1, delay: 0.24 }); break;
      case 'cloak': this.noise(0.7, { vol: 0.14, type: 'bandpass', freq: 3000, to: 300, q: 2 }); this.tone(900, 0.6, { type: 'sine', to: 200, vol: 0.08 }); break;
      case 'mark': this.tone(1400, 0.08, { type: 'square', vol: 0.07, filter: 4000 }); this.tone(700, 0.25, { type: 'sawtooth', vol: 0.08, delay: 0.08, filter: 1500 }); break;
      case 'execute': this.tone(80, 0.9, { type: 'sawtooth', to: 30, vol: 0.5, filter: 500 }); this.noise(0.7, { vol: 0.5, type: 'highpass', freq: 800, to: 6000 }); this.tone(2000, 0.5, { type: 'sine', to: 200, vol: 0.15 }); break;
      case 'chain': case 'zap': this.noise(0.22, { vol: 0.3, type: 'highpass', freq: 2500, pos }); this.tone(1800, 0.2, { type: 'sawtooth', to: 200, vol: 0.12, pos, filter: 5000 }); break;
      case 'gravity': this.tone(60, 1.0, { type: 'sine', to: 110, vol: 0.4 }); this.tone(400, 0.8, { type: 'sine', to: 90, vol: 0.1 }); break;
      case 'overcharge': this.tone(300, 0.5, { type: 'sawtooth', to: 1200, vol: 0.1, filter: 2500 }); this.noise(0.4, { vol: 0.15, type: 'highpass', freq: 3500 }); break;
      case 'storm': this.noise(1.6, { vol: 0.4, type: 'lowpass', freq: 400, to: 1500 }); this.tone(50, 1.5, { type: 'sawtooth', to: 90, vol: 0.3, filter: 300 }); break;
      case 'trap': this.tone(500, 0.08, { type: 'square', vol: 0.08, filter: 2500 }); this.noise(0.1, { vol: 0.15, type: 'bandpass', freq: 1500, q: 2, delay: 0.05 }); break;
      case 'trapSnap': this.noise(0.15, { vol: 0.3, type: 'highpass', freq: 2000, pos }); this.tone(300, 0.3, { type: 'sawtooth', to: 900, vol: 0.15, pos, filter: 3000 }); break;
      case 'companion': case 'hunt': this.tone(240, 0.7, { type: 'sawtooth', to: 380, vol: 0.14, filter: 900 }); this.tone(380, 0.8, { type: 'sawtooth', to: 300, vol: 0.1, delay: 0.3, filter: 900 }); break;
      case 'inferno': this.noise(1.0, { vol: 0.4, type: 'bandpass', freq: 300, to: 3000, q: 0.7 }); this.tone(110, 1.0, { type: 'sawtooth', to: 440, vol: 0.2, filter: 1500 }); break;
      case 'colossus': this.tone(70, 1.1, { type: 'sawtooth', to: 140, vol: 0.4, filter: 500 }); this.noise(0.6, { vol: 0.3, type: 'lowpass', freq: 800 }); break;
      case 'grenadeThrow': this.noise(0.15, { vol: 0.1, type: 'bandpass', freq: 800, to: 2000, q: 1 }); break;
      case 'ultReady': [523, 784, 1047].forEach((f, i) => this.tone(f, 0.25, { type: 'triangle', vol: 0.08, delay: i * 0.06 })); break;
      default: this.tone(600, 0.2, { type: 'sine', vol: 0.1 });
    }
  }

  // ---------- ennemis ----------

  enemyAlert(kind: string, pos: THREE.Vector3): void {
    if (kind === 'devourer') { this.tone(300, 0.4, { type: 'sawtooth', to: 110, vol: 0.2, pos, filter: 1200 }); this.noise(0.3, { vol: 0.12, type: 'bandpass', freq: 1800, q: 4, pos }); }
    else if (kind === 'drone') this.tone(1200, 0.2, { type: 'square', to: 1800, vol: 0.07, pos, filter: 4000 });
    else this.noise(0.18, { vol: 0.12, type: 'bandpass', freq: 900, q: 3, pos });
  }
  enemyDeath(kind: string, pos: THREE.Vector3): void {
    if (kind === 'devourer') { this.tone(260, 0.5, { type: 'sawtooth', to: 50, vol: 0.2, pos, filter: 900 }); }
    else if (kind === 'drone') { this.explosion(pos, 0.5); }
    else { this.tone(170, 0.3, { type: 'sawtooth', to: 70, vol: 0.14, pos, filter: 700 }); this.noise(0.2, { vol: 0.1, type: 'lowpass', freq: 500, pos, delay: 0.25 }); }
  }
  bossRoar(pos: THREE.Vector3 | null = null): void {
    this.tone(90, 1.6, { type: 'sawtooth', to: 40, vol: 0.5, pos, filter: 600 });
    this.tone(137, 1.4, { type: 'sawtooth', to: 55, vol: 0.3, pos, filter: 800 });
    this.noise(1.4, { vol: 0.35, type: 'bandpass', freq: 400, to: 1200, q: 1.5, pos });
  }
  charge(pos: THREE.Vector3 | null, dur = 1): void { this.tone(200, dur, { type: 'sawtooth', to: 1400, vol: 0.12, pos, filter: 3000, attack: dur * 0.8 }); }

  // ---------- musique procédurale ----------

  setMusic(mode: MusicMode, theme = this.theme): void {
    this.wanted = mode; this.theme = theme;
    if (!this.ctx || mode === this.mode) return;
    this.mode = mode;
    this.step = 0; this.nextTime = this.ctx.currentTime + 0.1;
    this.root = [38, 36, 41, 34, 39][theme % 5];
    this.droneNodes?.stop(); this.droneNodes = null;
    if (mode === 'explore' || mode === 'hub' || mode === 'ending') this.startDrone();
  }
  get musicMode(): MusicMode { return this.wanted; }

  private hz(n: number): number { return 440 * Math.pow(2, (n - 69) / 12); }

  private startDrone(): void {
    const c = this.ctx!;
    const g = c.createGain(); g.gain.value = 0; g.gain.linearRampToValueAtTime(this.mode === 'hub' ? 0.05 : 0.08, c.currentTime + 3);
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 320;
    const lfo = c.createOscillator(); lfo.frequency.value = 0.07; const lg = c.createGain(); lg.gain.value = 140; lfo.connect(lg); lg.connect(f.frequency); lfo.start();
    const oscs = [0, 7, 12].map((iv, i) => { const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = this.hz(this.root + iv) * (1 + (i - 1) * 0.004); o.connect(f); o.start(); return o; });
    f.connect(g); g.connect(this.musicBus);
    this.droneNodes = { stop: () => { const t = c.currentTime; g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(g.gain.value, t); g.gain.linearRampToValueAtTime(0, t + 1.5); setTimeout(() => { oscs.forEach((o) => o.stop()); lfo.stop(); }, 1700); } };
  }

  private pad(notes: number[], t: number, dur: number, vol: number): void {
    const c = this.ctx!;
    for (const n of notes) for (const det of [-6, 6]) {
      const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = this.hz(n); o.detune.value = det;
      const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(300, t); f.frequency.linearRampToValueAtTime(1100, t + dur * 0.5); f.frequency.linearRampToValueAtTime(300, t + dur);
      const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + dur * 0.3); g.gain.linearRampToValueAtTime(0.0001, t + dur);
      o.connect(f); f.connect(g); g.connect(this.musicBus); o.start(t); o.stop(t + dur + 0.1);
    }
  }
  private note(n: number, t: number, dur: number, vol: number, type: OscillatorType = 'triangle', cutoff = 2000): void {
    const c = this.ctx!;
    const o = c.createOscillator(); o.type = type; o.frequency.value = this.hz(n);
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(cutoff, t); f.frequency.exponentialRampToValueAtTime(Math.max(80, cutoff * 0.25), t + dur);
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(f); f.connect(g); g.connect(this.musicBus); o.start(t); o.stop(t + dur + 0.05);
  }
  private kick(t: number, vol: number): void {
    const c = this.ctx!; const o = c.createOscillator(); o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(38, t + 0.16);
    const g = c.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
    o.connect(g); g.connect(this.music); o.start(t); o.stop(t + 0.25);
  }
  private drum(t: number, vol: number, freq: number, dur: number, type: BiquadFilterType = 'bandpass'): void {
    const c = this.ctx!; const s = c.createBufferSource(); s.buffer = this.noiseBuf;
    const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = 0.9;
    const g = c.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(this.music); s.start(t, Math.random()); s.stop(t + dur + 0.02);
  }

  private schedule(): void {
    const c = this.ctx; if (!c || this.mode === 'none') return;
    if (c.state !== 'running') return;
    if (this.nextTime < c.currentTime) this.nextTime = c.currentTime + 0.05;
    const bpm = this.mode === 'boss' ? 148 : this.mode === 'combat' ? 128 : this.mode === 'menu' ? 72 : 60;
    const sp = 60 / bpm / 4; // double-croche
    while (this.nextTime < c.currentTime + 0.35) {
      this.playStep(this.step, this.nextTime, sp);
      this.step++; this.nextTime += sp;
    }
  }

  private playStep(s: number, t: number, sp: number): void {
    const r = this.root;
    const bar = Math.floor(s / 16), b = s % 16;
    const prog = [0, -4, -7, -2][bar % 4]; // progression mineure
    if (this.mode === 'menu' || this.mode === 'ending') {
      const major = this.mode === 'ending';
      if (b === 0) this.pad([r + 12 + prog, r + 19 + prog, r + (major ? 28 : 27) + prog], t, sp * 16, 0.035);
      const arp = major ? [24, 28, 31, 36, 31, 28] : [24, 27, 31, 34, 31, 27];
      if (b % 4 === 0) this.note(r + prog + arp[(s / 4) % arp.length | 0] + 12, t, sp * 6, 0.05, 'sine', 3000);
      if (b === 0) this.note(r + prog - 12, t, sp * 14, 0.12, 'sine', 300);
      if (this.mode === 'menu' && b === 8 && bar % 2 === 1) this.drum(t, 0.05, 200, 0.6, 'lowpass');
    } else if (this.mode === 'hub') {
      if (b === 0 && bar % 2 === 0) this.pad([r + 12 + prog, r + 19 + prog], t, sp * 32, 0.022);
      if (b % 8 === 4 && Math.random() < 0.6) this.note(r + prog + [24, 31, 34, 36][Math.random() * 4 | 0], t, sp * 8, 0.03, 'sine', 2500);
    } else if (this.mode === 'explore') {
      if (b === 0 && bar % 2 === 0) this.pad([r + 12 + prog, r + 15 + prog], t, sp * 32, 0.02);
      if (b % 8 === 0 && Math.random() < 0.4) this.note(r + [24, 27, 30, 31][Math.random() * 4 | 0], t, sp * 10, 0.035, 'sine', 1800);
      if (b === 12 && bar % 4 === 3) this.drum(t, 0.06, 120, 0.9, 'lowpass');
    } else {
      const boss = this.mode === 'boss';
      // batterie
      if (b % 4 === 0 || (boss && (b === 10 || b === 14 && bar % 2 === 1))) this.kick(t, 0.5);
      if (b === 4 || b === 12) this.drum(t, 0.22, 1700, 0.14);
      if (b % 2 === 0) this.drum(t, b % 4 === 2 ? 0.07 : 0.04, 7000, 0.04, 'highpass');
      // basse pulsée
      const bassPat = boss ? [0, 0, 12, 0, 0, 12, 0, 3, 0, 0, 12, 0, 0, 10, 7, 3] : [0, -1, 0, 0, -1, 0, 12, -1, 0, -1, 0, 0, -1, 0, 7, -1];
      const bn = bassPat[b];
      if (bn >= 0) this.note(r + prog - 12 + bn, t, sp * 1.6, 0.16, 'sawtooth', boss ? 900 : 650);
      // nappe et motif
      if (b === 0) this.pad([r + 12 + prog, r + 19 + prog, r + 24 + prog + 3], t, sp * 16, boss ? 0.03 : 0.02);
      const lead = boss ? [36, -1, 34, -1, 31, -1, 34, 36, 39, -1, 36, -1, 34, 31, -1, 30] : [24, -1, -1, 27, -1, -1, 31, -1, 24, -1, -1, 27, -1, 30, -1, -1];
      const ln = lead[b];
      if (ln >= 0 && (boss || bar % 2 === 1)) this.note(r + prog + ln, t, sp * 2.2, 0.045, 'square', 2200);
      if (boss && b === 0 && bar % 4 === 0) this.drum(t, 0.12, 300, 1.2, 'lowpass');
    }
  }
}
