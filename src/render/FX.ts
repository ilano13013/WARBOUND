// Effets visuels mutualisés : particules, traceurs, éclairs, décalques d'impact, explosions, lumières dynamiques, anneaux.
import * as THREE from 'three';
import { softTexture } from './Materials';

const MAXP = 2600;

class ParticlePool {
  points: THREE.Points;
  private pos = new Float32Array(MAXP * 3);
  private col = new Float32Array(MAXP * 4);
  private size = new Float32Array(MAXP);
  private vel = new Float32Array(MAXP * 3);
  private life = new Float32Array(MAXP);
  private maxLife = new Float32Array(MAXP);
  private grav = new Float32Array(MAXP);
  private drag = new Float32Array(MAXP);
  private baseSize = new Float32Array(MAXP);
  private grow = new Float32Array(MAXP);
  private rgb = new Float32Array(MAXP * 3);
  private cursor = 0;
  private alive = 0;
  limit = MAXP;

  constructor(additive: boolean) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('color', new THREE.BufferAttribute(this.col, 4).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('size', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    const m = new THREE.ShaderMaterial({
      uniforms: { map: { value: softTexture() }, scale: { value: 600 } },
      vertexShader: 'attribute float size; attribute vec4 color; varying vec4 vC; uniform float scale; void main(){ vC=color; vec4 mv=modelViewMatrix*vec4(position,1.0); gl_PointSize=size*scale/max(0.1,-mv.z); gl_Position=projectionMatrix*mv; }',
      fragmentShader: 'uniform sampler2D map; varying vec4 vC; void main(){ vec4 t=texture2D(map,gl_PointCoord); gl_FragColor=vec4(vC.rgb,vC.a*t.a); }',
      transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.points = new THREE.Points(g, m);
    this.points.frustumCulled = false;
    this.points.renderOrder = additive ? 6 : 5;
  }

  emit(x: number, y: number, z: number, vx: number, vy: number, vz: number, color: THREE.Color, size: number, life: number, gravity: number, drag: number, grow: number): void {
    const i = this.cursor; this.cursor = (this.cursor + 1) % this.limit;
    this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z;
    this.vel[i * 3] = vx; this.vel[i * 3 + 1] = vy; this.vel[i * 3 + 2] = vz;
    this.rgb[i * 3] = color.r; this.rgb[i * 3 + 1] = color.g; this.rgb[i * 3 + 2] = color.b;
    this.life[i] = life; this.maxLife[i] = life; this.grav[i] = gravity; this.drag[i] = drag; this.baseSize[i] = size; this.grow[i] = grow;
  }

  update(dt: number): void {
    let alive = 0;
    for (let i = 0; i < MAXP; i++) {
      if (this.life[i] <= 0) { if (this.col[i * 4 + 3] !== 0) { this.col[i * 4 + 3] = 0; this.size[i] = 0; } continue; }
      alive++;
      this.life[i] -= dt;
      const k = Math.max(0, this.life[i] / this.maxLife[i]);
      const d = Math.max(0, 1 - this.drag[i] * dt);
      this.vel[i * 3] *= d; this.vel[i * 3 + 1] = this.vel[i * 3 + 1] * d - this.grav[i] * dt; this.vel[i * 3 + 2] *= d;
      this.pos[i * 3] += this.vel[i * 3] * dt; this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt; this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      this.col[i * 4] = this.rgb[i * 3]; this.col[i * 4 + 1] = this.rgb[i * 3 + 1]; this.col[i * 4 + 2] = this.rgb[i * 3 + 2];
      this.col[i * 4 + 3] = Math.min(1, k * 2);
      this.size[i] = this.baseSize[i] * (1 + this.grow[i] * (1 - k));
    }
    if (alive || this.alive) {
      const g = this.points.geometry;
      g.attributes.position.needsUpdate = true; g.attributes.color.needsUpdate = true; g.attributes.size.needsUpdate = true;
    }
    this.alive = alive;
  }

  clear(): void { this.life.fill(0); }
}

export interface BurstOpts { count?: number; color?: number; color2?: number; speed?: number; life?: number; size?: number; gravity?: number; drag?: number; dir?: THREE.Vector3; spread?: number; smoke?: boolean; grow?: number; up?: number }

interface Tracer { mesh: THREE.Mesh; life: number; max: number }
interface Bolt { line: THREE.Line; life: number; max: number }
interface Decal { mesh: THREE.Mesh; life: number }
interface Flash { light: THREE.PointLight; life: number; max: number; intensity: number }
interface Ring { mesh: THREE.Mesh; life: number; max: number; r0: number; r1: number }
interface Shock { mesh: THREE.Mesh; life: number; max: number; r: number }

const _c = new THREE.Color(), _c2 = new THREE.Color(), _v = new THREE.Vector3(), _q = new THREE.Quaternion(), _up = new THREE.Vector3(0, 1, 0), _z = new THREE.Vector3(0, 0, 1);

export class FX {
  group = new THREE.Group();
  private add = new ParticlePool(true);
  private smoke = new ParticlePool(false);
  private tracers: Tracer[] = [];
  private bolts: Bolt[] = [];
  private decals: Decal[] = [];
  private decalCursor = 0;
  private flashes: Flash[] = [];
  private rings: Ring[] = [];
  private shocks: Shock[] = [];
  density = 1;

  constructor() {
    this.group.add(this.add.points, this.smoke.points);
    const tg = new THREE.BoxGeometry(1, 1, 1);
    for (let i = 0; i < 48; i++) {
      const m = new THREE.Mesh(tg, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
      m.visible = false; m.frustumCulled = false; this.group.add(m);
      this.tracers.push({ mesh: m, life: 0, max: 1 });
    }
    for (let i = 0; i < 24; i++) {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(16 * 3), 3));
      const l = new THREE.Line(g, new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
      l.visible = false; l.frustumCulled = false; this.group.add(l);
      this.bolts.push({ line: l, life: 0, max: 1 });
    }
    const dg = new THREE.CircleGeometry(0.09, 8);
    for (let i = 0; i < 70; i++) {
      const m = new THREE.Mesh(dg, new THREE.MeshBasicMaterial({ color: 0x050505, transparent: true, opacity: 0.85, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 }));
      m.visible = false; this.group.add(m);
      this.decals.push({ mesh: m, life: 0 });
    }
    for (let i = 0; i < 4; i++) {
      const l = new THREE.PointLight(0xffffff, 0, 14, 1.8);
      this.group.add(l);
      this.flashes.push({ light: l, life: 0, max: 1, intensity: 0 });
    }
    const rg = new THREE.RingGeometry(0.92, 1, 48);
    rg.rotateX(-Math.PI / 2);
    for (let i = 0; i < 14; i++) {
      const m = new THREE.Mesh(rg, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
      m.visible = false; this.group.add(m);
      this.rings.push({ mesh: m, life: 0, max: 1, r0: 1, r1: 1 });
    }
    const sg = new THREE.SphereGeometry(1, 16, 10);
    for (let i = 0; i < 8; i++) {
      const m = new THREE.Mesh(sg, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
      m.visible = false; this.group.add(m);
      this.shocks.push({ mesh: m, life: 0, max: 1, r: 1 });
    }
  }

  setQuality(q: 'low' | 'medium' | 'high'): void {
    this.density = q === 'low' ? 0.45 : q === 'medium' ? 0.8 : 1;
    this.add.limit = this.smoke.limit = q === 'low' ? 900 : q === 'medium' ? 1800 : MAXP;
  }

  burst(p: THREE.Vector3, o: BurstOpts = {}): void {
    const n = Math.max(1, Math.round((o.count ?? 10) * this.density));
    const pool = o.smoke ? this.smoke : this.add;
    _c.setHex(o.color ?? 0xffc060);
    if (o.color2 !== undefined) _c2.setHex(o.color2);
    const sp = o.speed ?? 4, spread = o.spread ?? 1;
    for (let i = 0; i < n; i++) {
      let vx = (Math.random() * 2 - 1), vy = (Math.random() * 2 - 1), vz = (Math.random() * 2 - 1);
      const l = Math.hypot(vx, vy, vz) || 1; vx /= l; vy /= l; vz /= l;
      if (o.dir) { vx = o.dir.x + vx * spread; vy = o.dir.y + vy * spread; vz = o.dir.z + vz * spread; }
      const s = sp * (0.35 + Math.random() * 0.65);
      const col = o.color2 !== undefined && Math.random() < 0.5 ? _c2 : _c;
      pool.emit(p.x, p.y, p.z, vx * s, vy * s + (o.up ?? 0), vz * s, col, (o.size ?? 0.12) * (0.6 + Math.random() * 0.8), (o.life ?? 0.5) * (0.6 + Math.random() * 0.8), o.gravity ?? 6, o.drag ?? 1.5, o.grow ?? 0);
    }
  }

  /** Particule unique (traînées de projectiles, aura). */
  spark(x: number, y: number, z: number, color: number, size = 0.15, life = 0.4, vy = 0, smoke = false): void {
    _c.setHex(color);
    (smoke ? this.smoke : this.add).emit(x, y, z, (Math.random() - 0.5) * 0.4, vy + (Math.random() - 0.5) * 0.4, (Math.random() - 0.5) * 0.4, _c, size, life, 0, 1, smoke ? 1.5 : 0);
  }

  tracer(from: THREE.Vector3, to: THREE.Vector3, color = 0xffe0a0, width = 0.025, life = 0.07): void {
    const t = this.tracers.find((x) => x.life <= 0) || this.tracers[0];
    const len = from.distanceTo(to);
    if (len < 0.5) return;
    t.mesh.position.copy(from).lerp(to, 0.5);
    t.mesh.scale.set(width, width, len);
    t.mesh.lookAt(to);
    (t.mesh.material as THREE.MeshBasicMaterial).color.setHex(color);
    (t.mesh.material as THREE.MeshBasicMaterial).opacity = 0.9;
    t.mesh.visible = true; t.life = t.max = life;
  }

  /** Éclair ou faisceau entre deux points. */
  bolt(from: THREE.Vector3, to: THREE.Vector3, color = 0x8ad8ff, jitter = 0.35, life = 0.18): void {
    const b = this.bolts.find((x) => x.life <= 0) || this.bolts[0];
    const arr = (b.line.geometry.attributes.position as THREE.BufferAttribute).array as Float32Array;
    const n = 16;
    for (let i = 0; i < n; i++) {
      const k = i / (n - 1), j = i === 0 || i === n - 1 ? 0 : jitter;
      arr[i * 3] = from.x + (to.x - from.x) * k + (Math.random() - 0.5) * j;
      arr[i * 3 + 1] = from.y + (to.y - from.y) * k + (Math.random() - 0.5) * j;
      arr[i * 3 + 2] = from.z + (to.z - from.z) * k + (Math.random() - 0.5) * j;
    }
    b.line.geometry.attributes.position.needsUpdate = true;
    (b.line.material as THREE.LineBasicMaterial).color.setHex(color);
    (b.line.material as THREE.LineBasicMaterial).opacity = 1;
    b.line.visible = true; b.life = b.max = life;
    if (jitter > 0) { this.tracer(from, to, color, 0.05, life * 0.8); }
  }

  decal(p: THREE.Vector3, n: THREE.Vector3): void {
    const d = this.decals[this.decalCursor]; this.decalCursor = (this.decalCursor + 1) % this.decals.length;
    d.mesh.position.copy(p).addScaledVector(n, 0.012);
    d.mesh.quaternion.setFromUnitVectors(_z, n);
    d.mesh.scale.setScalar(0.7 + Math.random() * 0.7);
    d.mesh.visible = true; d.life = 14;
  }

  flash(p: THREE.Vector3, color: number, intensity = 30, life = 0.08, dist = 14): void {
    const f = this.flashes.find((x) => x.life <= 0) || this.flashes[0];
    f.light.position.copy(p); f.light.color.setHex(color); f.light.distance = dist;
    f.life = f.max = life; f.intensity = intensity; f.light.intensity = intensity;
  }

  /** Anneau au sol qui s'étend (ondes de choc, impulsions). */
  ring(p: THREE.Vector3, r0: number, r1: number, color: number, life = 0.5): void {
    const r = this.rings.find((x) => x.life <= 0) || this.rings[0];
    r.mesh.position.set(p.x, p.y + 0.06, p.z);
    (r.mesh.material as THREE.MeshBasicMaterial).color.setHex(color);
    r.r0 = r0; r.r1 = r1; r.life = r.max = life; r.mesh.visible = true; r.mesh.scale.setScalar(r0);
  }

  shock(p: THREE.Vector3, r: number, color: number, life = 0.3): void {
    const s = this.shocks.find((x) => x.life <= 0) || this.shocks[0];
    s.mesh.position.copy(p); (s.mesh.material as THREE.MeshBasicMaterial).color.setHex(color);
    s.r = r; s.life = s.max = life; s.mesh.visible = true;
  }

  explosion(p: THREE.Vector3, radius = 4, color = 0xff8a2a): void {
    this.burst(p, { count: 34, color, color2: 0xffe0a0, speed: radius * 3.2, life: 0.55, size: 0.3, gravity: 5, drag: 2.5 });
    this.burst(p, { count: 14, color: 0x2a2622, speed: radius * 1.2, life: 1.6, size: 1.1, gravity: -1.2, drag: 1.8, smoke: true, grow: 2 });
    this.shock(p, radius, color, 0.28);
    this.ring(p, 0.5, radius * 1.2, color, 0.4);
    this.flash(p, color, 90, 0.22, radius * 5);
  }

  impact(p: THREE.Vector3, n: THREE.Vector3, surf: string): void {
    if (surf === 'flesh') { this.burst(p, { count: 6, color: 0x8a1420, speed: 2.2, life: 0.35, size: 0.1, gravity: 9, dir: n, spread: 0.7, smoke: true }); return; }
    if (surf === 'energy') { this.burst(p, { count: 6, color: 0x6ab0ff, speed: 3, life: 0.3, size: 0.12, gravity: 0, dir: n, spread: 0.8 }); return; }
    this.decal(p, n);
    if (surf === 'metal') this.burst(p, { count: 7, color: 0xffd080, speed: 6, life: 0.25, size: 0.07, gravity: 12, dir: n, spread: 0.8 });
    else if (surf === 'crystal') this.burst(p, { count: 7, color: 0xa080ff, speed: 4, life: 0.4, size: 0.1, gravity: 6, dir: n, spread: 0.8 });
    else {
      this.burst(p, { count: 4, color: surf === 'dirt' ? 0x6a5a40 : 0x8a8a88, speed: 1.6, life: 0.6, size: 0.3, gravity: -0.3, dir: n, spread: 0.6, smoke: true, grow: 1.5 });
      this.burst(p, { count: 3, color: 0xffc070, speed: 4, life: 0.15, size: 0.05, gravity: 10, dir: n, spread: 0.8 });
    }
  }

  update(dt: number): void {
    this.add.update(dt); this.smoke.update(dt);
    for (const t of this.tracers) if (t.life > 0) { t.life -= dt; (t.mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, t.life / t.max) * 0.9; if (t.life <= 0) t.mesh.visible = false; }
    for (const b of this.bolts) if (b.life > 0) { b.life -= dt; (b.line.material as THREE.LineBasicMaterial).opacity = Math.max(0, b.life / b.max); if (b.life <= 0) b.line.visible = false; }
    for (const d of this.decals) if (d.life > 0) { d.life -= dt; (d.mesh.material as THREE.MeshBasicMaterial).opacity = Math.min(0.85, d.life * 0.4); if (d.life <= 0) d.mesh.visible = false; }
    for (const f of this.flashes) { if (f.life > 0) { f.life -= dt; f.light.intensity = f.intensity * Math.max(0, f.life / f.max); } else if (f.light.intensity !== 0) f.light.intensity = 0; }
    for (const r of this.rings) if (r.life > 0) {
      r.life -= dt; const k = 1 - Math.max(0, r.life / r.max);
      r.mesh.scale.setScalar(r.r0 + (r.r1 - r.r0) * k);
      (r.mesh.material as THREE.MeshBasicMaterial).opacity = (1 - k) * 0.9;
      if (r.life <= 0) r.mesh.visible = false;
    }
    for (const s of this.shocks) if (s.life > 0) {
      s.life -= dt; const k = 1 - Math.max(0, s.life / s.max);
      s.mesh.scale.setScalar(s.r * (0.2 + 0.8 * k));
      (s.mesh.material as THREE.MeshBasicMaterial).opacity = (1 - k) * 0.55;
      if (s.life <= 0) s.mesh.visible = false;
    }
  }

  clear(): void {
    this.add.clear(); this.smoke.clear();
    for (const t of this.tracers) { t.life = 0; t.mesh.visible = false; }
    for (const b of this.bolts) { b.life = 0; b.line.visible = false; }
    for (const d of this.decals) { d.life = 0; d.mesh.visible = false; }
    for (const r of this.rings) { r.life = 0; r.mesh.visible = false; }
    for (const s of this.shocks) { s.life = 0; s.mesh.visible = false; }
  }
}
