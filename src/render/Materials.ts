// Textures procédurales (albédo + normal map) et bibliothèque de matériaux PBR partagés.
import * as THREE from 'three';
import { Assets } from '../assets/Assets';

function hash(x: number, y: number, s: number): number {
  let h = (x * 374761393 + y * 668265263 + s * 1274126177) | 0;
  h = ((h ^ (h >>> 13)) * 1274126177) | 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

function vnoise(x: number, y: number, s: number, wrap: number): number {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const w = (n: number) => ((n % wrap) + wrap) % wrap;
  const a = hash(w(xi), w(yi), s), b = hash(w(xi + 1), w(yi), s), c = hash(w(xi), w(yi + 1), s), d = hash(w(xi + 1), w(yi + 1), s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

/** Bruit fractal tuilable dans [0,1]. */
export function fbm(x: number, y: number, seed: number, oct = 4, base = 4): number {
  let v = 0, amp = 0.5, f = base, tot = 0;
  for (let i = 0; i < oct; i++) { v += vnoise(x * f, y * f, seed + i * 17, f) * amp; tot += amp; amp *= 0.5; f *= 2; }
  return v / tot;
}

type Painter = (u: number, v: number, x: number, y: number) => { r: number; g: number; b: number; h: number; rough?: number };

interface TexSet { map: THREE.CanvasTexture; normalMap: THREE.CanvasTexture; roughnessMap: THREE.CanvasTexture }

function build(size: number, paint: Painter, normalStrength = 2): TexSet {
  const mk = () => { const c = document.createElement('canvas'); c.width = c.height = size; return c; };
  const cc = mk(), cn = mk(), cr = mk();
  const xc = cc.getContext('2d')!, xn = cn.getContext('2d')!, xr = cr.getContext('2d')!;
  const ic = xc.createImageData(size, size), inn = xn.createImageData(size, size), ir = xr.createImageData(size, size);
  const H = new Float32Array(size * size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const p = paint(x / size, y / size, x, y);
    const i = (y * size + x) * 4;
    ic.data[i] = Math.max(0, Math.min(255, p.r)); ic.data[i + 1] = Math.max(0, Math.min(255, p.g)); ic.data[i + 2] = Math.max(0, Math.min(255, p.b)); ic.data[i + 3] = 255;
    H[y * size + x] = p.h;
    const ro = Math.max(0, Math.min(255, (p.rough ?? 0.8) * 255));
    ir.data[i] = ro; ir.data[i + 1] = ro; ir.data[i + 2] = ro; ir.data[i + 3] = 255;
  }
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const l = H[y * size + ((x - 1 + size) % size)], r = H[y * size + ((x + 1) % size)];
    const u = H[((y - 1 + size) % size) * size + x], d = H[((y + 1) % size) * size + x];
    let nx = (l - r) * normalStrength, ny = (u - d) * normalStrength, nz = 1;
    const len = Math.hypot(nx, ny, nz); nx /= len; ny /= len; nz /= len;
    const i = (y * size + x) * 4;
    inn.data[i] = (nx * 0.5 + 0.5) * 255; inn.data[i + 1] = (ny * 0.5 + 0.5) * 255; inn.data[i + 2] = (nz * 0.5 + 0.5) * 255; inn.data[i + 3] = 255;
  }
  xc.putImageData(ic, 0, 0); xn.putImageData(inn, 0, 0); xr.putImageData(ir, 0, 0);
  const tex = (c: HTMLCanvasElement, srgb: boolean) => {
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = 4;
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    return t;
  };
  return { map: tex(cc, true), normalMap: tex(cn, false), roughnessMap: tex(cr, false) };
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const sstep = (a: number, b: number, x: number) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

const painters: Record<string, { size: number; ns: number; paint: Painter }> = {
  concrete: { size: 256, ns: 2.5, paint: (u, v) => {
    const n = fbm(u, v, 1, 5, 4), st = fbm(u, v, 9, 3, 2);
    const seam = Math.min(Math.abs(((u * 2) % 1) - 0.5), Math.abs(((v * 2) % 1) - 0.5)) > 0.485 ? 1 : 0;
    const pit = hash(Math.floor(u * 256), Math.floor(v * 256), 3) > 0.985 ? 1 : 0;
    const c = 118 + n * 60 - st * 34 - seam * 40 - pit * 35;
    return { r: c * 0.98, g: c, b: c * 1.03, h: n * 0.5 - seam * 0.5 - pit * 0.4, rough: 0.82 + n * 0.15 };
  } },
  darkconcrete: { size: 256, ns: 2.5, paint: (u, v) => {
    const n = fbm(u, v, 21, 5, 4), st = fbm(u, v, 29, 3, 2);
    const seam = Math.min(Math.abs(((u * 2) % 1) - 0.5), Math.abs(((v * 2) % 1) - 0.5)) > 0.485 ? 1 : 0;
    const c = 62 + n * 38 - st * 22 - seam * 22;
    return { r: c, g: c * 1.02, b: c * 1.06, h: n * 0.5 - seam * 0.5, rough: 0.78 + n * 0.15 };
  } },
  metal: { size: 256, ns: 2, paint: (u, v, x, y) => {
    const brushed = fbm(u * 0.25, v * 6, 4, 3, 8), n = fbm(u, v, 5, 4, 4);
    const pu = (u * 2) % 1, pv = (v * 2) % 1;
    const seam = pu < 0.012 || pv < 0.012 ? 1 : 0;
    const rx = Math.abs(pu - 0.06) < 0.014 || Math.abs(pu - 0.94) < 0.014, ry = Math.abs(pv - 0.06) < 0.014 || Math.abs(pv - 0.94) < 0.014;
    const rivet = rx && ry ? 1 : 0;
    const c = 92 + brushed * 34 + n * 22 - seam * 50 + rivet * 30;
    return { r: c * 0.96, g: c, b: c * 1.05, h: -seam * 0.6 + rivet * 0.6 + brushed * 0.08, rough: 0.42 + n * 0.3 };
  } },
  darkmetal: { size: 256, ns: 2, paint: (u, v) => {
    const brushed = fbm(u * 0.25, v * 6, 34, 3, 8), n = fbm(u, v, 35, 4, 4);
    const pu = (u * 2) % 1, pv = (v * 2) % 1;
    const seam = pu < 0.012 || pv < 0.012 ? 1 : 0;
    const c = 40 + brushed * 20 + n * 16 - seam * 22;
    return { r: c * 0.95, g: c, b: c * 1.08, h: -seam * 0.6 + brushed * 0.08, rough: 0.38 + n * 0.3 };
  } },
  rust: { size: 256, ns: 2.5, paint: (u, v) => {
    const n = fbm(u, v, 41, 5, 4), r = sstep(0.45, 0.7, fbm(u, v, 43, 4, 3));
    const ridge = Math.abs(((u * 10) % 1) - 0.5) < 0.22 ? 1 : 0;
    const base = 70 + n * 30 + ridge * 16;
    return { r: lerp(base * 0.8, 140 + n * 40, r), g: lerp(base * 0.95, 78 + n * 25, r), b: lerp(base, 44, r), h: ridge * 0.5 + n * 0.2, rough: 0.6 + r * 0.35 };
  } },
  container: { size: 256, ns: 3, paint: (u, v) => {
    const n = fbm(u, v, 51, 4, 4), r = sstep(0.6, 0.85, fbm(u, v, 53, 5, 6)) * 0.55;
    const ridge = 0.5 + 0.5 * Math.sin(u * Math.PI * 2 * 14);
    const base = 150 + n * 40 + ridge * 30;
    return { r: lerp(base, 120, r), g: lerp(base, 70, r), b: lerp(base, 45, r), h: ridge * 0.6, rough: 0.55 + r * 0.35 };
  } },
  asphalt: { size: 256, ns: 3, paint: (u, v, x, y) => {
    const n = fbm(u, v, 61, 5, 8), g = hash(x, y, 62);
    const crack = sstep(0.02, 0.0, Math.abs(fbm(u, v, 63, 4, 3) - 0.5));
    const c = 46 + n * 26 + g * 14 - crack * 30;
    return { r: c, g: c, b: c * 1.04, h: g * 0.25 + n * 0.3 - crack * 0.8, rough: 0.9 };
  } },
  dirt: { size: 256, ns: 3, paint: (u, v, x, y) => {
    const n = fbm(u, v, 71, 5, 4), g = hash(x, y, 72), m = fbm(u, v, 73, 3, 2);
    const c = 70 + n * 50 + g * 12;
    return { r: c * (0.95 + m * 0.1), g: c * 0.86, b: c * 0.68, h: n * 0.6 + g * 0.15, rough: 0.95 };
  } },
  ash: { size: 256, ns: 3, paint: (u, v, x, y) => {
    const n = fbm(u, v, 75, 5, 4), g = hash(x, y, 76), vein = sstep(0.03, 0.0, Math.abs(fbm(u, v, 77, 4, 3) - 0.5));
    const c = 34 + n * 30 + g * 8;
    return { r: c + vein * 90, g: c * 0.95 + vein * 20, b: c * 1.1 + vein * 120, h: n * 0.6 - vein * 0.5, rough: 0.9 };
  } },
  stone: { size: 256, ns: 3, paint: (u, v) => {
    const row = Math.floor(v * 4), off = row % 2 ? 0.5 : 0;
    const bu = ((u * 2 + off) % 1), bv = (v * 4) % 1;
    const edge = Math.min(bu, 1 - bu) < 0.03 || Math.min(bv, 1 - bv) < 0.06 ? 1 : 0;
    const id = hash(Math.floor(u * 2 + off), row, 81);
    const n = fbm(u, v, 82, 5, 4);
    const c = 88 + n * 50 + id * 26 - edge * 50;
    return { r: c * 0.94, g: c * 0.96, b: c * 1.08, h: n * 0.4 - edge * 0.9 + id * 0.2, rough: 0.85 };
  } },
  rune: { size: 256, ns: 3, paint: (u, v) => {
    const n = fbm(u, v, 91, 5, 4);
    const gu = (u * 4) % 1, gv = (v * 4) % 1;
    const id = hash(Math.floor(u * 4), Math.floor(v * 4), 92);
    const line = (Math.abs(gu - 0.5) < 0.04 && gv > 0.2 && gv < 0.8) || (Math.abs(gv - (0.3 + id * 0.4)) < 0.04 && gu > 0.25 && gu < 0.75) || (Math.abs(gu - gv) < 0.04 && id > 0.5 && gu > 0.25 && gu < 0.75);
    const c = 52 + n * 34;
    const e = line ? 1 : 0;
    return { r: c * 0.9 + e * 80, g: c * 0.9 + e * 30, b: c * 1.15 + e * 160, h: n * 0.4 - e * 0.6, rough: 0.8 };
  } },
  tiles: { size: 256, ns: 2, paint: (u, v) => {
    const tu = (u * 4) % 1, tv = (v * 4) % 1;
    const edge = Math.min(tu, 1 - tu) < 0.03 || Math.min(tv, 1 - tv) < 0.03 ? 1 : 0;
    const n = fbm(u, v, 101, 4, 4), id = hash(Math.floor(u * 4), Math.floor(v * 4), 102);
    const c = 150 + n * 30 + id * 16 - edge * 70;
    return { r: c * 0.97, g: c, b: c * 1.03, h: -edge * 0.7 + n * 0.1, rough: 0.35 + n * 0.25 };
  } },
  grate: { size: 128, ns: 3, paint: (u, v) => {
    const gu = (u * 8) % 1, gv = (v * 8) % 1;
    const bar = gu < 0.25 || gv < 0.25 ? 1 : 0;
    const c = bar ? 78 : 16;
    return { r: c, g: c * 1.02, b: c * 1.08, h: bar, rough: 0.5 };
  } },
  hazard: { size: 128, ns: 1, paint: (u, v) => {
    const s = ((u + v) * 6) % 1 < 0.5;
    const n = fbm(u, v, 111, 3, 4);
    return s ? { r: 210 - n * 40, g: 160 - n * 30, b: 20, h: 0, rough: 0.6 } : { r: 24 + n * 10, g: 24 + n * 10, b: 26 + n * 10, h: 0, rough: 0.6 };
  } },
  facade: { size: 256, ns: 2, paint: (u, v) => {
    const n = fbm(u, v, 121, 4, 4);
    const wu = (u * 4) % 1, wv = (v * 4) % 1;
    const win = wu > 0.2 && wu < 0.8 && wv > 0.25 && wv < 0.8;
    const id = hash(Math.floor(u * 4), Math.floor(v * 4), 122);
    if (win) { const lit = id > 0.9; const broken = id < 0.25; const c = broken ? 8 : 26 + n * 16; return { r: lit ? 200 : c, g: lit ? 150 : c * 1.1, b: lit ? 70 : c * 1.35, h: -0.5, rough: lit ? 0.9 : 0.15 }; }
    const c = 96 + n * 44 - fbm(u, v, 123, 3, 2) * 24;
    return { r: c, g: c * 0.97, b: c * 0.92, h: n * 0.3, rough: 0.85 };
  } },
  crate: { size: 128, ns: 2.5, paint: (u, v) => {
    const n = fbm(u, v * 0.2, 131, 4, 8);
    const border = Math.min(u, 1 - u) < 0.08 || Math.min(v, 1 - v) < 0.08 ? 1 : 0;
    const plank = (u * 5) % 1 < 0.04 ? 1 : 0;
    const c = 78 + n * 36 - plank * 30;
    return border ? { r: 44, g: 48, b: 46, h: 0.6, rough: 0.5 } : { r: c * 0.82, g: c * 0.9, b: c * 0.62, h: n * 0.3 - plank * 0.5, rough: 0.8 };
  } },
  fabric: { size: 128, ns: 1.5, paint: (u, v, x, y) => {
    const n = fbm(u, v, 141, 3, 3), w = ((x + y) % 2) * 6;
    const blot = sstep(0.5, 0.56, fbm(u, v, 143, 3, 3));
    const c = 70 + n * 24 + w;
    return { r: lerp(c * 0.75, c * 0.5, blot), g: lerp(c * 0.85, c * 0.6, blot), b: lerp(c * 0.55, c * 0.42, blot), h: w / 12, rough: 0.92 };
  } },
};

const texCache = new Map<string, TexSet>();
function tex(name: string): TexSet {
  let t = texCache.get(name);
  if (!t) { const p = painters[name]; t = build(p.size, p.paint, p.ns); texCache.set(name, t); }
  return t;
}

export type MatName =
  | 'concrete' | 'darkconcrete' | 'metal' | 'darkmetal' | 'rust' | 'container_red' | 'container_blue' | 'container_green' | 'asphalt' | 'dirt' | 'ash'
  | 'stone' | 'rune' | 'tiles' | 'grate' | 'hazard' | 'facade' | 'crate' | 'fabric' | 'olive' | 'black' | 'glass' | 'sandbag'
  | 'glow_violet' | 'glow_blue' | 'glow_orange' | 'glow_green' | 'glow_red' | 'glow_white' | 'screen' | 'crystal' | 'crystal_red' | 'chitin' | 'bone';

const matCache = new Map<string, THREE.MeshStandardMaterial>();

/** Taille en mètres d'une répétition de texture. */
export const TILE: Partial<Record<MatName, number>> = {
  concrete: 4, darkconcrete: 4, metal: 3, darkmetal: 3, rust: 3, container_red: 2.4, container_blue: 2.4, container_green: 2.4,
  asphalt: 5, dirt: 5, ash: 6, stone: 3, rune: 4, tiles: 3, grate: 1.5, hazard: 1.2, facade: 12, crate: 1.2, fabric: 1.5, sandbag: 1,
};

/** Matériaux PBR photographiques (ambientCG, CC0) quand ils sont chargés. */
const PBR: Partial<Record<MatName, { set: string; color?: number; metal?: number; rough?: number; emissive?: number; ei?: number; emissiveFrom?: string }>> = {
  concrete: { set: 'concrete', color: 0xd8d8d8 },
  darkconcrete: { set: 'concrete2', color: 0x7c8088 },
  metal: { set: 'metal', color: 0xb8bcc4, metal: 0.85 },
  darkmetal: { set: 'plate', color: 0x707680, metal: 0.55 },
  rust: { set: 'metal2', color: 0xc89a7a, metal: 0.55 },
  asphalt: { set: 'asphalt', color: 0x9a9a9e },
  dirt: { set: 'dirt', color: 0xc8b8a0 },
  ash: { set: 'mud', color: 0x5a4c66, emissive: 0x3a1a6a, ei: 0.3, emissiveFrom: 'ash' },
  stone: { set: 'bricks', color: 0xa0a4b8 },
  tiles: { set: 'tiles', color: 0xc8ccd0 },
};

export function mat(name: MatName): THREE.MeshStandardMaterial {
  let m = matCache.get(name);
  if (m) return m;
  const pb = PBR[name];
  if (pb && Assets.tex(pb.set + '_color')) {
    const orm = Assets.tex(pb.set + '_orm');
    m = new THREE.MeshStandardMaterial({
      map: Assets.tex(pb.set + '_color'), normalMap: Assets.tex(pb.set + '_normal'), roughnessMap: orm, aoMap: orm, aoMapIntensity: 0.8,
      color: pb.color ?? 0xffffff, roughness: pb.rough ?? 1, metalness: pb.metal ?? 0,
    });
    if (pb.emissive) { m.emissive.setHex(pb.emissive); m.emissiveIntensity = pb.ei ?? 0.3; if (pb.emissiveFrom) m.emissiveMap = tex(pb.emissiveFrom).map; }
    m.name = name;
    matCache.set(name, m);
    return m;
  }
  const T = (n: string, o: THREE.MeshStandardMaterialParameters = {}) => { const t = tex(n); return new THREE.MeshStandardMaterial({ map: t.map, normalMap: t.normalMap, roughnessMap: t.roughnessMap, roughness: 1, ...o }); };
  const glow = (c: number, i = 2.2) => new THREE.MeshStandardMaterial({ color: 0x050505, emissive: c, emissiveIntensity: i, roughness: 0.4 });
  switch (name) {
    case 'concrete': m = T('concrete'); break;
    case 'darkconcrete': m = T('darkconcrete'); break;
    case 'metal': m = T('metal', { metalness: 0.75 }); break;
    case 'darkmetal': m = T('darkmetal', { metalness: 0.8 }); break;
    case 'rust': m = T('rust', { metalness: 0.5 }); break;
    case 'container_red': m = T('container', { color: 0xb8553f, metalness: 0.4 }); break;
    case 'container_blue': m = T('container', { color: 0x4a6e96, metalness: 0.4 }); break;
    case 'container_green': m = T('container', { color: 0x5c7350, metalness: 0.4 }); break;
    case 'asphalt': m = T('asphalt'); break;
    case 'dirt': m = T('dirt'); break;
    case 'ash': m = T('ash', { emissive: 0x3a1a6a, emissiveMap: tex('ash').map, emissiveIntensity: 0.25 }); break;
    case 'stone': m = T('stone'); break;
    case 'rune': m = T('rune', { emissive: 0x8a5aff, emissiveMap: tex('rune').map, emissiveIntensity: 0.55 }); break;
    case 'tiles': m = T('tiles', { metalness: 0.1 }); break;
    case 'grate': m = T('grate', { metalness: 0.8 }); break;
    case 'hazard': m = T('hazard'); break;
    case 'facade': m = T('facade', { emissive: 0xffb060, emissiveMap: tex('facade').map, emissiveIntensity: 0.12 }); break;
    case 'crate': m = T('crate'); break;
    case 'fabric': m = T('fabric'); break;
    case 'sandbag': m = T('fabric', { color: 0xd8c8a0 }); break;
    case 'olive': m = new THREE.MeshStandardMaterial({ color: 0x4a5236, roughness: 0.7, metalness: 0.2 }); break;
    case 'black': m = new THREE.MeshStandardMaterial({ color: 0x14161a, roughness: 0.55, metalness: 0.5 }); break;
    case 'glass': m = new THREE.MeshStandardMaterial({ color: 0x88aacc, roughness: 0.08, metalness: 0.6, transparent: true, opacity: 0.35 }); break;
    case 'glow_violet': m = glow(0x8a4aff); break;
    case 'glow_blue': m = glow(0x3a9aff); break;
    case 'glow_orange': m = glow(0xff7a2a); break;
    case 'glow_green': m = glow(0x3aff8a); break;
    case 'glow_red': m = glow(0xff2a2a); break;
    case 'glow_white': m = glow(0xfff0d8, 1.6); break;
    case 'screen': m = glow(0x2ad0ff, 1.2); break;
    case 'crystal': m = new THREE.MeshStandardMaterial({ color: 0x6a3aff, emissive: 0x7a4aff, emissiveIntensity: 1.6, roughness: 0.15, metalness: 0.3, flatShading: true }); break;
    case 'crystal_red': m = new THREE.MeshStandardMaterial({ color: 0xff3a5a, emissive: 0xff2a4a, emissiveIntensity: 1.6, roughness: 0.15, metalness: 0.3, flatShading: true }); break;
    case 'chitin': m = new THREE.MeshStandardMaterial({ color: 0x241a2e, roughness: 0.35, metalness: 0.5, flatShading: true }); break;
    case 'bone': m = new THREE.MeshStandardMaterial({ color: 0xb8b0a0, roughness: 0.7, flatShading: true }); break;
    default: m = new THREE.MeshStandardMaterial({ color: 0x888888 });
  }
  m.name = name;
  matCache.set(name, m);
  return m;
}

/** Matériau coloré simple mis en cache (équipements, armes, personnages). */
const colorCache = new Map<string, THREE.MeshStandardMaterial>();
export function cmat(color: number, rough = 0.6, metal = 0.2, emissive = 0, ei = 1): THREE.MeshStandardMaterial {
  const k = `${color}|${rough}|${metal}|${emissive}|${ei}`;
  let m = colorCache.get(k);
  if (!m) { m = new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, emissive, emissiveIntensity: ei }); colorCache.set(k, m); }
  return m;
}

/** Texture radiale douce pour particules et halos. */
let glowTex: THREE.CanvasTexture | null = null;
export function softTexture(): THREE.CanvasTexture {
  if (glowTex) return glowTex;
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const x = c.getContext('2d')!;
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.3, 'rgba(255,255,255,0.6)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  glowTex = new THREE.CanvasTexture(c);
  return glowTex;
}
