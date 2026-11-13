// Effets visuels mutualisés : particules, traceurs, éclairs, décalques d'impact, explosions, lumières dynamiques, anneaux.
import * as THREE from 'three';
import { softTexture } from './Materials';

const MAXP = 2600;

// ---------------------------------------------------------------- textures d'effets générées
function canvasTex(size: number, draw: (x: CanvasRenderingContext2D, s: number) => void): THREE.CanvasTexture {
  const c = document.createElement('canvas'); c.width = c.height = size;
  draw(c.getContext('2d')!, size);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
const texCache = new Map<string, THREE.Texture>();
function fxTex(k: string): THREE.Texture {
  let t = texCache.get(k);
  if (t) return t;
  if (k === 'puff') t = canvasTex(128, (x, s) => {
    const img = x.createImageData(s, s);
    for (let j = 0; j < s; j++) for (let i = 0; i < s; i++) {
      const u = i / s - 0.5, v = j / s - 0.5, r = Math.hypot(u, v) * 2;
      let n = 0, a = 0.5, f = 3;
      for (let o = 0; o < 4; o++) { n += a * (Math.sin(u * f * 6.3 + o * 1.7 + Math.sin(v * f * 4 + o)) * Math.cos(v * f * 5.1 - o * 2.3) * 0.5 + 0.5); a *= 0.5; f *= 2; }
      const al = Math.max(0, 1 - r) ** 1.4 * (0.55 + 0.6 * n);
      const p = (j * s + i) * 4; img.data[p] = img.data[p + 1] = img.data[p + 2] = 200 + n * 55; img.data[p + 3] = Math.min(255, al * 255);
    }
    x.putImageData(img, 0, 0);
  });
  else if (k === 'flare') t = canvasTex(128, (x, s) => {
    x.translate(s / 2, s / 2); x.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 6; i++) { x.rotate(Math.PI / 3 + (i % 2) * 0.12); const g = x.createLinearGradient(0, 0, s / 2, 0); g.addColorStop(0, 'rgba(255,240,200,1)'); g.addColorStop(1, 'rgba(255,140,40,0)'); x.fillStyle = g; x.beginPath(); x.moveTo(0, -s * 0.035); x.lineTo(s * (i % 2 ? 0.34 : 0.5), 0); x.lineTo(0, s * 0.035); x.fill(); }
    const g = x.createRadialGradient(0, 0, 0, 0, 0, s * 0.3); g.addColorStop(0, 'rgba(255,255,240,1)'); g.addColorStop(0.35, 'rgba(255,200,110,0.8)'); g.addColorStop(1, 'rgba(255,120,30,0)'); x.fillStyle = g; x.fillRect(-s / 2, -s / 2, s, s);
  });
  else if (k === 'hole') t = canvasTex(64, (x, s) => {
    x.translate(s / 2, s / 2);
    let g = x.createRadialGradient(0, 0, 0, 0, 0, s * 0.48); g.addColorStop(0, 'rgba(0,0,0,0.95)'); g.addColorStop(0.18, 'rgba(10,10,10,0.95)'); g.addColorStop(0.3, 'rgba(60,60,60,0.7)'); g.addColorStop(0.55, 'rgba(30,30,30,0.35)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = g; x.fillRect(-s / 2, -s / 2, s, s);
    x.strokeStyle = 'rgba(15,15,15,0.7)'; x.lineWidth = 1.2;
    for (let i = 0; i < 7; i++) { const a = i * 0.9 + Math.random() * 0.4; x.beginPath(); x.moveTo(Math.cos(a) * s * 0.1, Math.sin(a) * s * 0.1); x.lineTo(Math.cos(a + 0.2) * s * 0.3, Math.sin(a + 0.2) * s * 0.3); x.lineTo(Math.cos(a - 0.1) * s * (0.38 + Math.random() * 0.08), Math.sin(a - 0.1) * s * 0.42); x.stroke(); }
  });
  else if (k === 'scorch') t = canvasTex(128, (x, s) => {
    const img = x.createImageData(s, s);
    for (let j = 0; j < s; j++) for (let i = 0; i < s; i++) {
      const u = i / s - 0.5, v = j / s - 0.5, r = Math.hypot(u, v) * 2, a = Math.atan2(v, u);
      const edge = 0.75 + 0.18 * Math.sin(a * 7) * Math.cos(a * 3 + 1) + 0.07 * Math.sin(a * 23);
      const al = Math.max(0, 1 - r / edge) ** 0.7 * 0.92;
      const p = (j * s + i) * 4; img.data[p] = img.data[p + 1] = img.data[p + 2] = 8 + (1 - al) * 20; img.data[p + 3] = al * 255;
    }
    x.putImageData(img, 0, 0);
  });
  texCache.set(k, t!);
  return t!;
}
export function flareTexture(): THREE.Texture { return fxTex('flare'); }


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
  private rot = new Float32Array(MAXP);
  private cursor = 0;
  private alive = 0;
  limit = MAXP;

  constructor(additive: boolean, map: THREE.Texture = softTexture()) {
    for (let i = 0; i < MAXP; i++) this.rot[i] = Math.random() * 6.283;
    const g = new THREE.BufferGeometry();
    g.setAttribute('rot', new THREE.BufferAttribute(this.rot, 1));
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('color', new THREE.BufferAttribute(this.col, 4).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('size', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    const m = new THREE.ShaderMaterial({
      uniforms: { map: { value: map }, scale: { value: 600 } },
      vertexShader: 'attribute float size; attribute float rot; attribute vec4 color; varying vec4 vC; varying float vR; uniform float scale; void main(){ vC=color; vR=rot; vec4 mv=modelViewMatrix*vec4(position,1.0); gl_PointSize=size*scale/max(0.1,-mv.z); gl_Position=projectionMatrix*mv; }',
      fragmentShader: 'uniform sampler2D map; varying vec4 vC; varying float vR; void main(){ vec2 p=gl_PointCoord-0.5; float c=cos(vR), s=sin(vR); p=mat2(c,-s,s,c)*p+0.5; vec4 t=texture2D(map,p); gl_FragColor=vec4(vC.rgb*t.rgb,vC.a*t.a); }',
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
interface Bolt { line: THREE.Mesh; life: number; max: number; w: number }
interface Fireball { mesh: THREE.Mesh; life: number; max: number; r: number }
interface Debris { mesh: THREE.Mesh; v: THREE.Vector3; life: number; floor: number }
interface Decal { mesh: THREE.Mesh; life: number }
interface Flash { light: THREE.PointLight; life: number; max: number; intensity: number }
interface Ring { mesh: THREE.Mesh; life: number; max: number; r0: number; r1: number }
interface Shock { mesh: THREE.Mesh; life: number; max: number; r: number }

const _v2 = new THREE.Vector3();
const _c = new THREE.Color(), _c2 = new THREE.Color(), _v = new THREE.Vector3(), _q = new THREE.Quaternion(), _up = new THREE.Vector3(0, 1, 0), _z = new THREE.Vector3(0, 0, 1);

export class FX {
  group = new THREE.Group();
  private add = new ParticlePool(true);
  private smoke = new ParticlePool(false, fxTex('puff'));
  private tracers: Tracer[] = [];
  private bolts: Bolt[] = [];
  private decals: Decal[] = [];
  private decalCursor = 0;
  private scorches: Decal[] = []; private scorchCursor = 0;
  private fireballs: Fireball[] = [];
  private debris: Debris[] = [];
  camera: THREE.Camera | null = null;
  private flashes: Flash[] = [];
  private rings: Ring[] = [];
  private shocks: Shock[] = [];
  density = 1;

  constructor() {
    this.group.add(this.add.points, this.smoke.points);
    const tg = new THREE.BoxGeometry(1, 1, 1);
    for (let i = 0; i < 96; i++) {
      const m = new THREE.Mesh(tg, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
      m.visible = false; m.frustumCulled = false; this.group.add(m);
      this.tracers.push({ mesh: m, life: 0, max: 1 });
    }
    // éclairs : rubans tournés vers la caméra, cœur blanc et halo coloré
    for (let i = 0; i < 28; i++) {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(32 * 3), 3).setUsage(THREE.DynamicDrawUsage));
      const uv = new Float32Array(32 * 2); for (let k = 0; k < 16; k++) { uv[k * 4] = k / 15; uv[k * 4 + 1] = 0; uv[k * 4 + 2] = k / 15; uv[k * 4 + 3] = 1; }
      g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
      const idx: number[] = []; for (let k = 0; k < 15; k++) { const a = k * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } g.setIndex(idx);
      const m = new THREE.ShaderMaterial({
        uniforms: { color: { value: new THREE.Color() }, opacity: { value: 1 } },
        vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
        fragmentShader: 'uniform vec3 color; uniform float opacity; varying vec2 vUv; void main(){ float d=abs(vUv.y*2.0-1.0); float core=(1.0-smoothstep(0.0,0.35,d)); float glow=pow(max(1.0-d,0.0),2.0); vec3 c=color*glow*1.6+vec3(1.0)*core*1.3; gl_FragColor=vec4(c, (glow*0.8+core)*opacity); }',
        transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false,
      });
      const l = new THREE.Mesh(g, m); l.visible = false; l.frustumCulled = false; this.group.add(l);
      this.bolts.push({ line: l, life: 0, max: 1, w: 0.06 });
    }
    // boules de feu des explosions (shader de bruit animé)
    const fbGeo = new THREE.PlaneGeometry(2, 2);
    for (let i = 0; i < 8; i++) {
      const m = new THREE.ShaderMaterial({
        uniforms: { t: { value: 0 }, seed: { value: Math.random() * 10 }, tint: { value: new THREE.Color(0xff8a2a) } },
        vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
        fragmentShader: `uniform float t; uniform float seed; uniform vec3 tint; varying vec2 vUv;
          float h(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
          float n(vec2 p){ vec2 i=floor(p),f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y); }
          float fbm(vec2 p){ float v=0.0,a=0.5; for(int i=0;i<4;i++){ v+=a*n(p); p*=2.1; a*=0.5; } return v; }
          void main(){ vec2 p=vUv*2.0-1.0; float r=length(p); float a=r<1e-4?0.0:atan(p.y,p.x);
            float nz=fbm(vec2(a*1.6+seed, r*3.0-t*4.0)+seed);
            float edge=0.62+0.38*nz; float d=1.0-smoothstep(edge*0.35,edge,r);
            float heat=clamp((1.0-t*1.5)*(1.15-r)+nz*0.25,0.0,1.0);
            vec3 c=mix(vec3(0.12,0.09,0.08), tint, smoothstep(0.05,0.45,heat));
            c=mix(c, vec3(1.0,0.92,0.7), smoothstep(0.55,0.95,heat));
            float al=d*(1.0-smoothstep(0.55,1.0,t));
            gl_FragColor=vec4(c*(0.6+heat*1.6), al); }`,
        transparent: true, depthWrite: false, blending: THREE.NormalBlending,
      });
      const me = new THREE.Mesh(fbGeo, m); me.visible = false; me.frustumCulled = false; me.renderOrder = 7; this.group.add(me);
      this.fireballs.push({ mesh: me, life: 0, max: 1, r: 1 });
    }
    // éclats projetés
    const dGeo = new THREE.DodecahedronGeometry(0.07, 0), dMat = new THREE.MeshStandardMaterial({ color: 0x2a2826, roughness: 0.9 });
    for (let i = 0; i < 28; i++) { const me = new THREE.Mesh(dGeo, dMat); me.visible = false; me.castShadow = false; this.group.add(me); this.debris.push({ mesh: me, v: new THREE.Vector3(), life: 0, floor: 0 }); }
    // brûlures au sol
    const scGeo = new THREE.PlaneGeometry(1, 1);
    for (let i = 0; i < 12; i++) {
      const me = new THREE.Mesh(scGeo, new THREE.MeshBasicMaterial({ map: fxTex('scorch'), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, color: 0xffffff }));
      me.rotation.x = -Math.PI / 2; me.visible = false; this.group.add(me); this.scorches.push({ mesh: me, life: 0 });
    }
    const dg = new THREE.PlaneGeometry(0.16, 0.16);
    for (let i = 0; i < 90; i++) {
      const m = new THREE.Mesh(dg, new THREE.MeshBasicMaterial({ map: fxTex('hole'), color: 0xffffff, transparent: true, opacity: 0.95, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 }));
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

  /** Éclair ou faisceau entre deux points : ruban épais avec ramifications. */
  bolt(from: THREE.Vector3, to: THREE.Vector3, color = 0x8ad8ff, jitter = 0.35, life = 0.18, width = 0.07, branches = true): void {
    const b = this.bolts.find((x) => x.life <= 0) || this.bolts[0];
    const arr = (b.line.geometry.attributes.position as THREE.BufferAttribute).array as Float32Array;
    const n = 16, cam = this.camera ? this.camera.position : _v.set(0, 50, 0);
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i < n; i++) {
      const k = i / (n - 1), j = i === 0 || i === n - 1 ? 0 : jitter;
      pts.push(new THREE.Vector3(from.x + (to.x - from.x) * k + (Math.random() - 0.5) * j, from.y + (to.y - from.y) * k + (Math.random() - 0.5) * j, from.z + (to.z - from.z) * k + (Math.random() - 0.5) * j));
    }
    const dir = new THREE.Vector3(), side = new THREE.Vector3(), toC = new THREE.Vector3();
    for (let i = 0; i < n; i++) {
      dir.subVectors(pts[Math.min(n - 1, i + 1)], pts[Math.max(0, i - 1)]).normalize();
      toC.subVectors(cam, pts[i]).normalize();
      side.crossVectors(dir, toC).normalize().multiplyScalar(width * (i === 0 || i === n - 1 ? 0.5 : 1));
      arr[i * 6] = pts[i].x - side.x; arr[i * 6 + 1] = pts[i].y - side.y; arr[i * 6 + 2] = pts[i].z - side.z;
      arr[i * 6 + 3] = pts[i].x + side.x; arr[i * 6 + 4] = pts[i].y + side.y; arr[i * 6 + 5] = pts[i].z + side.z;
    }
    b.line.geometry.attributes.position.needsUpdate = true;
    const mu = (b.line.material as THREE.ShaderMaterial).uniforms;
    mu.color.value.setHex(color); mu.opacity.value = 1;
    b.line.visible = true; b.life = b.max = life;
    if (branches && jitter > 0.2) for (let k = 0; k < 2; k++) {
      const a = pts[3 + Math.floor(Math.random() * 9)];
      const e = a.clone().add(new THREE.Vector3((Math.random() - 0.5) * 1.6, (Math.random() - 0.2) * 1.2, (Math.random() - 0.5) * 1.6).multiplyScalar(Math.min(2, from.distanceTo(to) * 0.25)));
      this.bolt(a, e, color, jitter * 0.6, life * 0.8, width * 0.5, false);
    }
  }

  decal(p: THREE.Vector3, n: THREE.Vector3): void {
    const d = this.decals[this.decalCursor]; this.decalCursor = (this.decalCursor + 1) % this.decals.length;
    d.mesh.position.copy(p).addScaledVector(n, 0.012);
    d.mesh.quaternion.setFromUnitVectors(_z, n);
    d.mesh.rotateZ(Math.random() * 6.28);
    d.mesh.scale.setScalar(0.6 + Math.random() * 0.6);
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
    // boule de feu, fumée volumineuse, étincelles, éclats, onde de choc, brûlure et lumière
    for (let i = 0; i < 2; i++) {
      const f = this.fireballs.find((x) => x.life <= 0) || this.fireballs[0];
      f.mesh.position.copy(p).add(_v.set((Math.random() - 0.5) * radius * 0.25, radius * 0.1 * i, (Math.random() - 0.5) * radius * 0.25));
      f.r = radius * (i ? 0.6 : 0.85); f.life = f.max = 0.55 + i * 0.15; f.mesh.visible = true;
      const u = (f.mesh.material as THREE.ShaderMaterial).uniforms; u.seed.value = Math.random() * 20; u.tint.value.setHex(color);
    }
    this.burst(p, { count: 30, color, color2: 0xffe0a0, speed: radius * 4, life: 0.5, size: 0.16, gravity: 9, drag: 1.5 });
    this.burst(p, { count: 16, color: 0x2a2622, color2: 0x4a4440, speed: radius * 1.3, life: 2.2, size: radius * 0.45, gravity: -1.4, drag: 1.6, smoke: true, grow: 2.2, up: 1 });
    for (let i = 0; i < 6; i++) { _v.set(Math.random() - 0.5, Math.random() * 0.8 + 0.2, Math.random() - 0.5).normalize(); this.tracer(p, _v2.copy(p).addScaledVector(_v, radius * (0.4 + Math.random() * 0.5)), 0xffc870, 0.03, 0.12); }
    for (let i = 0; i < Math.round(8 * this.density); i++) {
      const d = this.debris.find((x) => x.life <= 0) || this.debris[i];
      d.mesh.position.copy(p); d.v.set((Math.random() - 0.5) * 2, Math.random() * 1.2 + 0.4, (Math.random() - 0.5) * 2).normalize().multiplyScalar(radius * (1.5 + Math.random() * 1.8));
      d.floor = p.y - 0.7; d.life = 1.8; d.mesh.visible = true; d.mesh.scale.setScalar(0.6 + Math.random() * 1.2);
    }
    const sc = this.scorches[this.scorchCursor]; this.scorchCursor = (this.scorchCursor + 1) % this.scorches.length;
    sc.mesh.position.set(p.x, Math.max(0.02, p.y - 0.62), p.z); sc.mesh.scale.setScalar(radius * 1.15); sc.mesh.rotation.z = Math.random() * 6.28; sc.mesh.visible = true; sc.life = 25;
    this.shock(p, radius, color, 0.22);
    this.ring(p, 0.5, radius * 1.4, color, 0.45);
    this.flash(p, color, 120, 0.3, radius * 6);
  }

  impact(p: THREE.Vector3, n: THREE.Vector3, surf: string): void {
    if (surf === 'flesh') { this.burst(p, { count: 6, color: 0x8a1420, speed: 2.2, life: 0.35, size: 0.1, gravity: 9, dir: n, spread: 0.7, smoke: true }); return; }
    if (surf === 'energy') { this.burst(p, { count: 6, color: 0x6ab0ff, speed: 3, life: 0.3, size: 0.12, gravity: 0, dir: n, spread: 0.8 }); return; }
    this.decal(p, n);
    if (surf === 'metal') {
      this.burst(p, { count: 6, color: 0xffd080, speed: 6, life: 0.25, size: 0.06, gravity: 12, dir: n, spread: 0.8 });
      for (let i = 0; i < 2; i++) { _v.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(1.2).add(n).normalize(); this.tracer(p, _v2.copy(p).addScaledVector(_v, 0.25 + Math.random() * 0.35), 0xffd890, 0.012, 0.07); }
    }
    else if (surf === 'crystal') this.burst(p, { count: 7, color: 0xa080ff, speed: 4, life: 0.4, size: 0.1, gravity: 6, dir: n, spread: 0.8 });
    else {
      this.burst(p, { count: 4, color: surf === 'dirt' ? 0x6a5a40 : 0x8a8a88, speed: 1.6, life: 0.6, size: 0.3, gravity: -0.3, dir: n, spread: 0.6, smoke: true, grow: 1.5 });
      this.burst(p, { count: 3, color: 0xffc070, speed: 4, life: 0.15, size: 0.05, gravity: 10, dir: n, spread: 0.8 });
    }
  }

  update(dt: number): void {
    this.add.update(dt); this.smoke.update(dt);
    for (const t of this.tracers) if (t.life > 0) { t.life -= dt; (t.mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, t.life / t.max) * 0.9; if (t.life <= 0) t.mesh.visible = false; }
    for (const b of this.bolts) if (b.life > 0) { b.life -= dt; (b.line.material as THREE.ShaderMaterial).uniforms.opacity.value = Math.max(0, b.life / b.max); if (b.life <= 0) b.line.visible = false; }
    for (const f of this.fireballs) if (f.life > 0) {
      f.life -= dt; const k = 1 - Math.max(0, f.life / f.max);
      if (this.camera) f.mesh.quaternion.copy(this.camera.quaternion);
      f.mesh.scale.setScalar(f.r * (0.45 + 0.75 * Math.sqrt(k)));
      f.mesh.position.y += dt * f.r * 0.5;
      (f.mesh.material as THREE.ShaderMaterial).uniforms.t.value = k;
      if (f.life <= 0) f.mesh.visible = false;
    }
    for (const d of this.debris) if (d.life > 0) {
      d.life -= dt; d.v.y -= 16 * dt; d.mesh.position.addScaledVector(d.v, dt); d.mesh.rotation.x += dt * 9; d.mesh.rotation.z += dt * 7;
      if (d.mesh.position.y < d.floor) { d.mesh.position.y = d.floor; d.v.y *= -0.35; d.v.x *= 0.6; d.v.z *= 0.6; }
      if (d.life <= 0) d.mesh.visible = false;
    }
    for (const sc of this.scorches) if (sc.life > 0) { sc.life -= dt; (sc.mesh.material as THREE.MeshBasicMaterial).opacity = Math.min(1, sc.life * 0.25); if (sc.life <= 0) sc.mesh.visible = false; }
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
      (s.mesh.material as THREE.MeshBasicMaterial).opacity = (1 - k) * 0.28;
      if (s.life <= 0) s.mesh.visible = false;
    }
  }

  clear(): void {
    this.add.clear(); this.smoke.clear();
    for (const t of this.tracers) { t.life = 0; t.mesh.visible = false; }
    for (const b of this.bolts) { b.life = 0; b.line.visible = false; }
    for (const f of this.fireballs) { f.life = 0; f.mesh.visible = false; }
    for (const d of this.debris) { d.life = 0; d.mesh.visible = false; }
    for (const sc of this.scorches) { sc.life = 0; sc.mesh.visible = false; }
    for (const d of this.decals) { d.life = 0; d.mesh.visible = false; }
    for (const r of this.rings) { r.life = 0; r.mesh.visible = false; }
    for (const s of this.shocks) { s.life = 0; s.mesh.visible = false; }
  }
}
