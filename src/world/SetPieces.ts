// Éléments de décor composés : structures techniques et militaires, vestiges du temple, manifestations de la Fracture.
// Les pièces hautes ou suspendues n'ont pas de collision ; les pièces au sol en ont une quand `solid` est indiqué.
import * as THREE from 'three';
import type { Level } from './Level';
import { mat, cmat, softTexture, type MatName } from '../render/Materials';
import { cable, coneMat, glowPatch } from './Detail';

const N = { collide: false };
const rnd = (a: number, b: number, s = 0): number => { const v = Math.sin(a * 127.1 + b * 311.7 + s * 74.7) * 43758.5453; return v - Math.floor(v); };
const V3 = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

// ---------------------------------------------------------------- technique / militaire

/** Mât d'éclairage : fût, projecteurs orientés, faisceaux visibles. `ry` = direction éclairée. */
export function floodlight(L: Level, x: number, z: number, h = 9, ry = 0, color = 0xffe2b4): void {
  L.box('trim', x, 0, z, 0.5, 0.4, 0.5); L.box('trim', x, 0.4, z, 0.2, h - 0.4, 0.2, N);
  L.box('trim', x, h, z, Math.abs(Math.cos(ry)) * 0.2 + Math.abs(Math.sin(ry)) * 1.6 + 0.1, 0.12, Math.abs(Math.sin(ry)) * 0.2 + Math.abs(Math.cos(ry)) * 1.6 + 0.1, N);
  const dx = Math.sin(ry), dz = Math.cos(ry);
  for (const o of [-0.55, 0.55]) {
    const px = x + dz * o + dx * 0.15, pz = z - dx * o + dz * 0.15;
    L.deco(mat('trim'), new THREE.BoxGeometry(0.46, 0.34, 0.24), px, h + 0.3, pz, -0.5, ry, 0);
    L.deco(mat('glow_white'), new THREE.BoxGeometry(0.38, 0.26, 0.04), px + dx * 0.13, h + 0.24, pz + dz * 0.13, -0.5, ry, 0);
  }
  // faisceau incliné vers le sol
  const len = h * 1.5;
  const m = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(-0.95, ry, 0, 'YXZ'));
  const g = new THREE.CylinderGeometry(0.2, len * 0.36, len, 14, 1, true); g.translate(0, -len / 2, 0); g.applyMatrix4(m);
  lightConeGeo(L, g, x + dx * 0.2, h + 0.25, z + dz * 0.2, color);
  glowPatch(L, x + dx * h * 1.05, 0.03, z + dz * h * 1.05, h * 0.75, color);
}
function lightConeGeo(L: Level, g: THREE.BufferGeometry, x: number, y: number, z: number, color: number): void { L.deco(coneMat(color), g, x, y, z); }

/** Passerelle de tuyauteries sur portiques, entre deux points alignés sur un axe. */
export function pipeRack(L: Level, x1: number, z1: number, x2: number, z2: number, h = 5, n = 3): void {
  const ax = z1 === z2, len = ax ? Math.abs(x2 - x1) : Math.abs(z2 - z1);
  const cx = (x1 + x2) / 2, cz = (z1 + z2) / 2;
  const nb = Math.max(2, Math.round(len / 7) + 1);
  for (let i = 0; i < nb; i++) {
    const t = -len / 2 + (i * len) / (nb - 1);
    const px = ax ? cx + t : cx, pz = ax ? cz : cz + t;
    for (const s of [-1, 1]) { const qx = ax ? px : px + s * 1.1, qz = ax ? pz + s * 1.1 : pz; L.box('trim', qx, 0, qz, 0.22, h + 0.5, 0.22, i === 0 || i === nb - 1 ? {} : N); L.box('darkconcrete', qx, 0, qz, 0.5, 0.3, 0.5, N); }
    L.box('trim', px, h, pz, ax ? 0.2 : 2.6, 0.2, ax ? 2.6 : 0.2, N);
    L.box('trim', px, h - 0.9, pz, ax ? 0.1 : 2.3, 0.1, ax ? 2.3 : 0.1, N);
  }
  const mats: MatName[] = ['rust', 'metal', 'paint_yellow', 'metal', 'rust'];
  for (let i = 0; i < n; i++) {
    const o = (i - (n - 1) / 2) * 0.62, r = 0.2 - (i % 2) * 0.07;
    L.pipe(ax ? x1 : cx + o, h + 0.2 + r, ax ? cz + o : z1, ax ? x2 : cx + o, h + 0.2 + r, ax ? cz + o : z2, r, mats[i % mats.length]);
  }
  L.box('grate', cx, h - 0.82, cz, ax ? len : 0.9, 0.06, ax ? 0.9 : len, N);
  cable(L, V3(ax ? x1 : cx - 1.2, h - 0.2, ax ? cz - 1.2 : z1), V3(ax ? x2 : cx - 1.2, h - 0.2, ax ? cz - 1.2 : z2), 0.9, 0.035);
}

/** Cuve verticale avec cerclages, échelle et passerelle sommitale. */
export function silo(L: Level, x: number, z: number, r = 2, h = 7, m: MatName = 'metal', solid = true): void {
  L.deco(mat(m), new THREE.CylinderGeometry(r, r, h, 20), x, h / 2 + 0.3, z);
  L.deco(mat(m), new THREE.SphereGeometry(r, 20, 8, 0, Math.PI * 2, 0, Math.PI / 2), x, h + 0.3, z, 0, 0, 0, 1, 0.35, 1);
  L.deco(mat('darkconcrete'), new THREE.CylinderGeometry(r + 0.25, r + 0.25, 0.3, 20), x, 0.15, z);
  for (let y = 1.2; y < h; y += 1.6) L.deco(mat('trim'), new THREE.CylinderGeometry(r + 0.04, r + 0.04, 0.12, 20, 1, true), x, y, z);
  L.box('trim', x + r + 0.12, 0.3, z - 0.22, 0.05, h, 0.05, N); L.box('trim', x + r + 0.12, 0.3, z + 0.22, 0.05, h, 0.05, N);
  for (let y = 0.6; y < h; y += 0.4) L.box('trim', x + r + 0.12, y, z, 0.04, 0.04, 0.46, N);
  L.deco(mat('paint_yellow'), new THREE.CylinderGeometry(r + 0.05, r + 0.05, 0.5, 20, 1, true), x, h * 0.62, z);
  if (solid) L.collider(x, 0, z, r * 1.8, h, r * 1.8, 'metal');
}

/** Tour de guet en treillis avec cabine et projecteur. */
export function watchtower(L: Level, x: number, z: number, h = 10, ry = 0, solid = true): void {
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) L.box('trim', x + sx * 1.3, 0, z + sz * 1.3, 0.2, h, 0.2, N);
  for (let y = 1.6; y < h; y += 2.4) { for (const s of [-1, 1]) { L.box('trim', x, y, z + s * 1.3, 2.6, 0.1, 0.1, N); L.box('trim', x + s * 1.3, y, z, 0.1, 0.1, 2.6, N); L.deco(mat('trim'), new THREE.BoxGeometry(3.5, 0.08, 0.08), x, y - 1.2, z + s * 1.3, 0, 0, 0.74 * s); } }
  L.box('grate', x, h, z, 3.4, 0.14, 3.4, N);
  for (const s of [-1, 1]) { L.box('darkmetal', x, h + 0.14, z + s * 1.65, 3.4, 1.0, 0.08, N); L.box('darkmetal', x + s * 1.65, h + 0.14, z, 0.08, 1.0, 3.4, N); }
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) L.box('trim', x + sx * 1.6, h + 1.14, z + sz * 1.6, 0.1, 1.2, 0.1, N);
  L.box('darkmetal', x, h + 2.34, z, 3.9, 0.14, 3.9, N);
  L.box('sandbag', x, h + 0.14, z + 1.5, 2.6, 0.5, 0.4, N);
  floodlightHead(L, x + Math.sin(ry) * 1.7, h + 1.7, z + Math.cos(ry) * 1.7, ry, h + 1.7);
  if (solid) L.collider(x, 0, z, 3, 2.4, 3, 'metal');
}
function floodlightHead(L: Level, x: number, y: number, z: number, ry: number, h: number): void {
  L.deco(mat('trim'), new THREE.BoxGeometry(0.5, 0.4, 0.3), x, y, z, -0.5, ry, 0);
  L.deco(mat('glow_white'), new THREE.BoxGeometry(0.4, 0.3, 0.04), x + Math.sin(ry) * 0.16, y - 0.07, z + Math.cos(ry) * 0.16, -0.5, ry, 0);
  const len = h * 1.6, m = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(-0.9, ry, 0, 'YXZ'));
  const g = new THREE.CylinderGeometry(0.2, len * 0.3, len, 14, 1, true); g.translate(0, -len / 2, 0); g.applyMatrix4(m);
  lightConeGeo(L, g, x, y, z, 0xdfe8ff);
  glowPatch(L, x + Math.sin(ry) * h * 1.2, 0.03, z + Math.cos(ry) * h * 1.2, h * 0.6, 0xdfe8ff);
}

/** Rangée de gabions de protection (Hesco). */
export function hesco(L: Level, x: number, z: number, alongX: boolean, n = 3, h = 1.5): void {
  for (let i = 0; i < n; i++) {
    const o = (i - (n - 1) / 2) * 1.3, px = alongX ? x + o : x, pz = alongX ? z : z + o;
    L.box('fabric', px, 0, pz, 1.24, h, 1.24, N); L.box('dirt', px, h - 0.02, pz, 1.1, 0.12, 1.1, N);
    for (const s of [-1, 1]) { L.box('trim', px + s * 0.62, 0, pz, 0.03, h, 1.26, N); L.box('trim', px, 0, pz + s * 0.62, 1.26, h, 0.03, N); }
    for (let y = 0.4; y < h; y += 0.4) L.box('trim', px, y, pz, 1.27, 0.025, 1.27, N);
  }
  L.collider(x, 0, z, alongX ? n * 1.3 : 1.24, h, alongX ? 1.24 : n * 1.3, 'dirt');
}

/** Hérisson tchèque. */
export function tankTrap(L: Level, x: number, z: number, s = 1): void {
  const g = new THREE.BoxGeometry(0.14 * s, 2.0 * s, 0.14 * s);
  L.deco(mat('rust'), g, x, 0.7 * s, z, 0.7, 0, 0.7); L.deco(mat('rust'), g, x, 0.7 * s, z, -0.7, 0.8, 0.7); L.deco(mat('rust'), g, x, 0.7 * s, z, 0.7, 1.6, -0.7);
  L.collider(x, 0, z, 1.0 * s, 1.2 * s, 1.0 * s, 'metal');
}

/** Rouleau de barbelés entre deux points. */
export function razorWire(L: Level, x1: number, z1: number, x2: number, z2: number, r = 0.4): void {
  const len = Math.hypot(x2 - x1, z2 - z1), turns = Math.round(len / 0.5), pts: THREE.Vector3[] = [];
  for (let i = 0; i <= turns * 8; i++) { const t = i / (turns * 8), a = t * turns * 6.2832; const px = x1 + (x2 - x1) * t, pz = z1 + (z2 - z1) * t; const nx = -(z2 - z1) / len, nz = (x2 - x1) / len; pts.push(V3(px + nx * Math.cos(a) * r, r + 0.05 + Math.sin(a) * r, pz + nz * Math.cos(a) * r)); }
  L.deco(mat('metal'), new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), turns * 10, 0.012, 3, false), 0, 0, 0);
  for (let i = 0; i <= Math.round(len / 3); i++) { const t = i / Math.max(1, Math.round(len / 3)); L.box('rust', x1 + (x2 - x1) * t, 0, z1 + (z2 - z1) * t, 0.06, 1.0, 0.06, N); }
}

/** Pile de palettes et de caisses sanglées. */
export function supplies(L: Level, x: number, z: number, ry = 0, tall = false): void {
  const c = Math.cos(ry), s = Math.sin(ry);
  const P = (lx: number, lz: number): [number, number] => [x + lx * c + lz * s, z - lx * s + lz * c];
  const B = (m: MatName, lx: number, y: number, lz: number, sx: number, sy: number, sz: number) => { const [px, pz] = P(lx, lz); L.deco(mat(m), new THREE.BoxGeometry(sx, sy, sz), px, y + sy / 2, pz, 0, ry, 0); };
  B('wood', 0, 0, 0, 1.3, 0.14, 1.1);
  B('olive', -0.3, 0.14, 0, 0.62, 0.5, 0.96); B('crate', 0.34, 0.14, 0.02, 0.6, 0.6, 0.9); B('olive', -0.28, 0.64, 0.05, 0.6, 0.42, 0.8);
  if (tall) { B('crate', 0.3, 0.74, 0, 0.62, 0.5, 0.86); B('fabric', 0, 1.24, 0, 1.25, 0.06, 1.05); }
  B('trim', 0, 0.14, 0.3, 1.32, tall ? 1.12 : 0.62, 0.03); B('trim', 0, 0.14, -0.3, 1.32, tall ? 1.12 : 0.62, 0.03);
  L.collider(x, 0, z, 1.25, tall ? 1.3 : 0.76, 1.25, 'dirt');
}

/** Câbles d'alimentation serpentant au sol entre des points. */
export function floorCables(L: Level, pts: [number, number][], n = 3, r = 0.04, m: MatName = 'cable'): void {
  for (let k = 0; k < n; k++) {
    const curve = new THREE.CatmullRomCurve3(pts.map(([x, z], i) => V3(x + (rnd(i, k, 1) - 0.5) * 0.5 * (i > 0 && i < pts.length - 1 ? 1 : 0.2), r + 0.004, z + (rnd(i, k, 2) - 0.5) * 0.5 * (i > 0 && i < pts.length - 1 ? 1 : 0.2))));
    L.deco(mat(m), new THREE.TubeGeometry(curve, pts.length * 8, r, 5, false), 0, 0, 0);
  }
}

/** Ligne électrique : poteaux et câbles pendants (profondeur de rue). */
export function powerLine(L: Level, pts: [number, number][], h = 8): void {
  pts.forEach(([x, z], i) => {
    const lean = (rnd(x, z) - 0.5) * 0.12;
    L.deco(mat('wood'), new THREE.CylinderGeometry(0.11, 0.15, h, 8), x, h / 2, z, lean, 0, lean * 0.7);
    L.deco(mat('wood'), new THREE.BoxGeometry(2.2, 0.12, 0.12), x, h - 0.5, z, 0, i < pts.length - 1 ? Math.atan2(pts[i + 1][0] - x, pts[i + 1][1] - z) + Math.PI / 2 : 0, 0);
    L.deco(mat('trim'), new THREE.BoxGeometry(0.4, 0.6, 0.3), x, h - 1.6, z);
    L.collider(x, 0, z, 0.3, 3, 0.3, 'dirt');
    if (i < pts.length - 1) { const [nx, nz] = pts[i + 1]; for (const o of [-0.9, 0, 0.9]) cable(L, V3(x + o * 0.3, h - 0.44, z + o * 0.3), V3(nx + o * 0.3, h - 0.44, nz + o * 0.3), 0.9 + rnd(i, o) * 0.8, 0.018); }
  });
}

/** Baie de serveurs HELIX avec voyants. */
export function serverRack(L: Level, x: number, z: number, alongX: boolean, n = 3): void {
  for (let i = 0; i < n; i++) {
    const o = (i - (n - 1) / 2) * 0.82, px = alongX ? x + o : x, pz = alongX ? z : z + o;
    L.box('trim', px, 0, pz, alongX ? 0.78 : 0.9, 2.2, alongX ? 0.9 : 0.78, N);
    for (const s of [-1, 1]) for (let y = 0.3; y < 2; y += 0.28) {
      const col: MatName = rnd(px + y, pz, s) < 0.2 ? 'glow_orange' : rnd(px, pz + y, s) < 0.55 ? 'glow_green' : 'glow_blue';
      L.box('black', alongX ? px : px + s * 0.455, y, alongX ? pz + s * 0.455 : pz, alongX ? 0.66 : 0.012, 0.2, alongX ? 0.012 : 0.66, N);
      L.box(col, alongX ? px - 0.22 + rnd(y, i) * 0.4 : px + s * 0.465, y + 0.08, alongX ? pz + s * 0.465 : pz - 0.22 + rnd(y, i) * 0.4, alongX ? 0.05 : 0.01, 0.025, alongX ? 0.01 : 0.05, N);
    }
  }
  L.collider(x, 0, z, alongX ? n * 0.82 : 0.9, 2.2, alongX ? 0.9 : n * 0.82, 'metal');
  glowPatch(L, alongX ? x : x + 1.1, 0.03, alongX ? z + 1.1 : z, 1.6, 0x3a9aff);
}

// ---------------------------------------------------------------- feu et fumée

const sprites = new Map<string, THREE.SpriteMaterial>();
function spriteMat(color: number, add: boolean, opacity: number): THREE.SpriteMaterial {
  const k = `${color}|${add}|${opacity}`;
  let m = sprites.get(k);
  if (!m) { m = new THREE.SpriteMaterial({ map: softTexture(), color, transparent: true, opacity, depthWrite: false, blending: add ? THREE.AdditiveBlending : THREE.NormalBlending }); sprites.set(k, m); }
  return m;
}

/** Colonne de fumée qui s'élève et dérive (lointains, épaves). */
export function smokeColumn(L: Level, x: number, y: number, z: number, h = 30, w = 5, color = 0x18181c, opacity = 0.5): void {
  const n = 9, list: THREE.Sprite[] = [];
  for (let i = 0; i < n; i++) { const s = new THREE.Sprite(spriteMat(color, false, opacity)); L.root.add(s); list.push(s); }
  L.updaters.push((_dt, t) => {
    for (let i = 0; i < n; i++) {
      const f = ((t * 0.035 + i / n) % 1), s = list[i];
      s.position.set(x + f * f * h * 0.5 + Math.sin(t * 0.3 + i) * w * 0.15, y + f * h, z + Math.sin(i * 2.1) * w * 0.2 + f * h * 0.12);
      const sc = w * (0.5 + f * 2.2); s.scale.set(sc, sc * 1.25, 1);
      s.scale.multiplyScalar(0.7 + 0.3 * Math.min(1, f * 6) * Math.min(1, (1 - f) * 3 + 0.3));
    }
  });
}

/** Feu : flammes additives vacillantes, lueur au sol, fumée. */
export function fire(L: Level, x: number, y: number, z: number, s = 1, smoke = true): void {
  const fl: THREE.Sprite[] = [];
  for (let i = 0; i < 4; i++) { const sp = new THREE.Sprite(spriteMat(i < 2 ? 0xff7a1a : 0xffc24a, true, 0.75)); L.root.add(sp); fl.push(sp); }
  L.updaters.push((_dt, t) => { fl.forEach((sp, i) => { const f = (t * (1.3 + i * 0.37) + i * 0.4) % 1; sp.position.set(x + Math.sin(t * 3 + i * 2) * 0.12 * s, y + (0.25 + f * 0.9) * s, z + Math.cos(t * 2.3 + i) * 0.12 * s); const k = s * (1.1 - f * 0.75); sp.scale.set(k * 0.9, k * 1.5, 1); }); });
  glowPatch(L, x, y + 0.03, z, 3.2 * s, 0xff7a2a);
  if (smoke) smokeColumn(L, x, y + s, z, 9 * s, 1.4 * s, 0x121214, 0.38);
}

// ---------------------------------------------------------------- Fracture

/** Fissure lumineuse au sol : ligne brisée émissive bordée d'un halo. */
export function riftCrack(L: Level, x: number, z: number, len: number, ang: number, color: 'violet' | 'red' = 'violet', w = 0.16): void {
  const m = mat(color === 'violet' ? 'glow_violet' : 'glow_red'), hex = color === 'violet' ? 0x8a4aff : 0xff3a4a;
  let px = x, pz = z, a = ang;
  const segs = Math.max(3, Math.round(len / 1.6));
  for (let i = 0; i < segs; i++) {
    const l = (len / segs) * (0.7 + rnd(i, x, z) * 0.6); a = ang + (rnd(i, z, x) - 0.5) * 1.3;
    const nx = px + Math.sin(a) * l, nz = pz + Math.cos(a) * l, k = 1 - i / segs;
    L.deco(m, new THREE.BoxGeometry(w * (0.4 + k), 0.02, l + 0.06), (px + nx) / 2, 0.022, (pz + nz) / 2, 0, a, 0);
    L.deco(mat('black'), new THREE.BoxGeometry(w * (1.6 + k * 2), 0.012, l + 0.2), (px + nx) / 2, 0.014, (pz + nz) / 2, 0, a, 0);
    if (i % 2 === 0) glowPatch(L, (px + nx) / 2, 0.035, (pz + nz) / 2, 1.3 + k, hex);
    if (rnd(i, 7, x) < 0.35) L.deco(m, new THREE.BoxGeometry(w * 0.5, 0.02, l * 0.6), nx + Math.sin(a + 1.1) * l * 0.3, 0.022, nz + Math.cos(a + 1.1) * l * 0.3, 0, a + 1.1, 0);
    px = nx; pz = nz;
  }
}

/** Rochers en lévitation, lentement animés. */
export function floatingRocks(L: Level, x: number, y: number, z: number, n = 5, spread = 4, m: MatName = 'rock', glow: MatName | null = 'glow_violet'): void {
  for (let i = 0; i < n; i++) {
    const s = 0.3 + rnd(i, x, 1) * 0.9;
    const g = new THREE.Group();
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(s, 0), mat(m)); rock.scale.set(1, 0.7 + rnd(i, z, 2) * 0.8, 1); rock.castShadow = true; g.add(rock);
    if (glow && rnd(i, 3, x) < 0.6) { const c = new THREE.Mesh(new THREE.OctahedronGeometry(s * 0.35, 0), mat(glow)); c.position.y = -s * 0.5; g.add(c); }
    const bx = x + (rnd(i, 4, z) - 0.5) * spread * 2, by = y + (rnd(i, 5, x) - 0.5) * spread, bz = z + (rnd(i, 6, z) - 0.5) * spread * 2;
    g.position.set(bx, by, bz); L.root.add(g);
    const ph = rnd(i, 7, x) * 6.28, sp = 0.3 + rnd(i, 8, z) * 0.4;
    L.updaters.push((_dt, t) => { g.position.y = by + Math.sin(t * sp + ph) * 0.35; g.rotation.y = t * sp * 0.3 + ph; g.rotation.x = Math.sin(t * sp * 0.5 + ph) * 0.2; });
  }
}

/** Amas de cristaux jaillissant du sol. */
export function crystalCluster(L: Level, x: number, z: number, s = 1, m: MatName = 'crystal', solid = false): void {
  const hex = m === 'crystal' ? 0x7a4aff : 0xff3a5a;
  for (let i = 0; i < 6; i++) {
    const a = i * 1.05 + rnd(i, x), r = i === 0 ? 0 : (0.25 + rnd(i, z) * 0.45) * s, h = (i === 0 ? 1.6 : 0.5 + rnd(i, x, 2) * 0.9) * s;
    L.deco(mat(m), new THREE.OctahedronGeometry(0.3 * s, 0), x + Math.cos(a) * r, h * 0.42, z + Math.sin(a) * r, i === 0 ? 0 : Math.sin(a) * 0.5, a, i === 0 ? 0 : -Math.cos(a) * 0.5, 0.7, h / (0.3 * s) * 0.5, 0.7);
  }
  L.deco(mat('rock'), new THREE.DodecahedronGeometry(0.55 * s, 0), x, 0.1, z, 0, x, 0, 1.4, 0.45, 1.4);
  glowPatch(L, x, 0.03, z, 2.4 * s, hex);
  if (solid) L.collider(x, 0, z, 0.9 * s, 1.4 * s, 0.9 * s, 'crystal');
}

/** Excroissances de la Fracture grimpant sur un mur ou un sol (veines sombres pulsant d'une lueur). */
export function tendrils(L: Level, x: number, y: number, z: number, dirX: number, dirZ: number, n = 5, len = 4, up = true): void {
  for (let i = 0; i < n; i++) {
    const pts: THREE.Vector3[] = []; const a0 = (rnd(i, x, z) - 0.5) * 1.6;
    let p = V3(x + (rnd(i, 1, x) - 0.5) * 1.5 * Math.abs(dirZ), y, z + (rnd(i, 2, z) - 0.5) * 1.5 * Math.abs(dirX));
    for (let k = 0; k <= 6; k++) { const t = k / 6; pts.push(p.clone()); const w = Math.sin(k * 1.7 + i) * 0.25; p = p.clone().add(up ? V3(dirZ * (Math.sin(a0) * 0.5 + w) * len / 6, len / 6 * (0.6 + 0.4 * Math.cos(a0)), dirX * (Math.sin(a0) * 0.5 + w) * len / 6) : V3((dirX * Math.cos(a0 * 0.6) - dirZ * Math.sin(a0 * 0.6) + w * dirZ) * len / 6, 0, (dirZ * Math.cos(a0 * 0.6) + dirX * Math.sin(a0 * 0.6) + w * dirX) * len / 6)); void t; }
    const curve = new THREE.CatmullRomCurve3(pts);
    L.deco(mat('chitin'), new THREE.TubeGeometry(curve, 14, 0.06 + rnd(i, 3, x) * 0.05, 5, false), 0, 0, 0);
    if (i % 2 === 0) L.deco(mat('glow_violet'), new THREE.TubeGeometry(curve, 14, 0.018, 3, false), up ? dirX * 0.07 : 0, up ? 0 : 0.07, up ? dirZ * 0.07 : 0);
  }
}

// ---------------------------------------------------------------- temple

/** Obélisque gravé. */
export function obelisk(L: Level, x: number, z: number, h = 7, solid = true): void {
  L.box('stone', x, 0, z, 1.6, 0.5, 1.6, N); L.box('stone', x, 0.5, z, 1.2, 0.3, 1.2, N);
  L.deco(mat('stone'), new THREE.CylinderGeometry(0.34, 0.5, h, 4), x, 0.8 + h / 2, z, 0, Math.PI / 4, 0);
  L.deco(mat('rune'), new THREE.CylinderGeometry(0.33, 0.44, h * 0.5, 4), x, 0.8 + h * 0.45, z, 0, Math.PI / 4, 0, 1.03, 1, 1.03);
  L.deco(mat('crystal'), new THREE.OctahedronGeometry(0.36, 0), x, h + 1.15, z, 0, 0, 0, 1, 1.5, 1);
  glowPatch(L, x, 0.03, z, 2.6, 0x7a4aff);
  if (solid) L.collider(x, 0, z, 1.5, h, 1.5, 'concrete');
}

/** Statue colossale d'un gardien voilé (silhouette stylisée). */
export function statue(L: Level, x: number, z: number, h = 8, ry = 0, solid = true): void {
  const s = h / 8, st = mat('stone');
  const D = (g: THREE.BufferGeometry, lx: number, y: number, lz: number, rx = 0, rz = 0) => L.deco(st, g, x + lx * Math.cos(ry) + lz * Math.sin(ry), y, z - lx * Math.sin(ry) + lz * Math.cos(ry), rx, ry, rz);
  L.box('stone', x, 0, z, 2.6 * s, 1.0 * s, 2.6 * s, N); L.box('rune', x, 0.3 * s, z, 2.64 * s, 0.4 * s, 2.64 * s, N);
  D(new THREE.CylinderGeometry(0.75 * s, 1.1 * s, 4 * s, 8), 0, 3 * s, 0);                    // robe
  D(new THREE.CylinderGeometry(0.95 * s, 0.75 * s, 1.5 * s, 8), 0, 5.6 * s, 0);               // torse
  D(new THREE.SphereGeometry(0.55 * s, 8, 6), 0, 6.9 * s, 0.1 * s);                            // tête
  D(new THREE.ConeGeometry(0.8 * s, 1.5 * s, 8), 0, 7.3 * s, -0.1 * s, -0.25);                 // capuche
  for (const sd of [-1, 1]) { D(new THREE.CylinderGeometry(0.22 * s, 0.26 * s, 2.2 * s, 6), sd * 0.95 * s, 5.2 * s, 0.45 * s, 0.7, sd * -0.25); }
  D(new THREE.BoxGeometry(0.2 * s, 5.4 * s, 0.34 * s), 0, 3.6 * s, 1.15 * s);                  // épée plantée
  D(new THREE.BoxGeometry(1.3 * s, 0.2 * s, 0.34 * s), 0, 5.3 * s, 1.15 * s);
  L.deco(mat('glow_violet'), new THREE.SphereGeometry(0.1 * s, 6, 4), x + (-0.2 * s) * Math.cos(ry) + 0.55 * s * Math.sin(ry), 6.95 * s, z - (-0.2 * s) * Math.sin(ry) + 0.55 * s * Math.cos(ry));
  L.deco(mat('glow_violet'), new THREE.SphereGeometry(0.1 * s, 6, 4), x + (0.2 * s) * Math.cos(ry) + 0.55 * s * Math.sin(ry), 6.95 * s, z - (0.2 * s) * Math.sin(ry) + 0.55 * s * Math.cos(ry));
  if (solid) L.collider(x, 0, z, 2.4 * s, h, 2.4 * s, 'concrete');
}

/** Bannière de tissu suspendue. */
export function banner(L: Level, x: number, y: number, z: number, ry = 0, h = 4, color = 0x3a1a5a, emblem: MatName = 'glow_violet'): void {
  const g = new THREE.PlaneGeometry(1.3, h, 3, 8); const p = g.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) { const yy = p.getY(i); p.setZ(i, Math.sin(yy * 1.6 + x) * 0.12 * (0.5 - yy / h)); if (yy < -h / 2 + 0.01) p.setY(i, yy + Math.abs(p.getX(i)) * 0.5); }
  g.computeVertexNormals();
  const m = cmat(color, 0.9, 0); m.side = THREE.DoubleSide;
  L.deco(m, g, x, y - h / 2, z, 0, ry, 0);
  L.deco(mat('trim'), new THREE.BoxGeometry(1.6, 0.08, 0.08), x, y, z, 0, ry, 0);
  L.deco(mat(emblem), new THREE.CircleGeometry(0.26, 6), x + Math.sin(ry) * 0.14, y - h * 0.35, z + Math.cos(ry) * 0.14, 0, ry, 0);
}

/** Brasero sur pied avec feu. */
export function brazier(L: Level, x: number, z: number, s = 1): void {
  L.deco(mat('darkmetal'), new THREE.CylinderGeometry(0.5 * s, 0.25 * s, 0.4 * s, 8), x, 1.0 * s, z);
  L.deco(mat('darkmetal'), new THREE.CylinderGeometry(0.08 * s, 0.3 * s, 0.85 * s, 6), x, 0.42 * s, z);
  L.deco(mat('glow_orange'), new THREE.CylinderGeometry(0.4 * s, 0.4 * s, 0.06 * s, 8), x, 1.2 * s, z);
  L.collider(x, 0, z, 0.7 * s, 1.2 * s, 0.7 * s, 'metal');
  fire(L, x, 1.1 * s, z, 0.8 * s, false);
}

/** Dalle effondrée appuyée, fers à béton apparents. */
export function collapsedSlab(L: Level, x: number, z: number, ry = 0, w = 5, solid = true): void {
  L.deco(mat('concrete'), new THREE.BoxGeometry(w, 0.4, 3.4), x, 1.1, z, 0.55, ry, 0.08);
  L.deco(mat('concrete'), new THREE.BoxGeometry(w * 0.5, 0.4, 2.2), x + Math.cos(ry) * w * 0.3, 0.3, z - Math.sin(ry) * w * 0.3, 0.1, ry + 0.4, -0.12);
  for (let i = 0; i < 7; i++) L.deco(mat('rust'), new THREE.CylinderGeometry(0.02, 0.02, 1.2 + rnd(i, x), 4), x + (rnd(i, 1, z) - 0.5) * w * Math.cos(ry), 2.1 + rnd(i, 2) * 0.4, z - (rnd(i, 1, z) - 0.5) * w * Math.sin(ry) + 1.3 * Math.cos(ry), 0.9 + rnd(i, 3) * 0.6, ry, rnd(i, 4) - 0.5);
  L.rubble(x, z + 0.4, 2.2, 'rubble', 9);
  if (solid) L.collider(x, 0, z, Math.abs(Math.cos(ry)) * w + Math.abs(Math.sin(ry)) * 3, 1.5, Math.abs(Math.sin(ry)) * w + Math.abs(Math.cos(ry)) * 3, 'concrete');
}

// ---------------------------------------------------------------- assets Poly Haven (CC0)

/**
 * Falaise Rock Face 01 (Poly Haven, CC0). (x, z) = centre de la masse, `h` = hauteur, `ry` = direction vers laquelle la paroi regarde.
 * Retourne false si l'asset manque (l'appelant garde alors son décor de repli).
 */
export function cliff(L: Level, x: number, z: number, h: number, ry: number, sink = 0.06, solid = false): boolean {
  const sz = L.propSize('ph_rockface#rock_face_01');
  if (!sz) return false;
  const k = h / sz.y;
  L.propM('ph_rockface#rock_face_01', new THREE.Matrix4().compose(V3(x, h * (0.5 - sink), z), new THREE.Quaternion().setFromAxisAngle(V3(0, 1, 0), ry), V3(k, k, k)));
  if (solid) { const q = Math.round(ry / (Math.PI / 2)) % 2 !== 0; L.collider(x, 0, z, (q ? sz.z : sz.x) * k * 0.8, h * 0.8, (q ? sz.x : sz.z) * k * 0.8, 'concrete'); }
  return true;
}

/** Groupe électrogène portable (Poly Haven, CC0), à sa taille réelle (0,8 m × 0,58 m). Repli : petit caisson. */
export function generator(L: Level, x: number, z: number, ry = 0): void {
  if (!L.prop('ph_generator', x, 0, z, ry, 0.585, true, 'metal')) { L.box('trim', x, 0, z, 0.8, 0.55, 0.55); L.box('paint_yellow', x, 0.55, z, 0.7, 0.04, 0.45, N); }
}
