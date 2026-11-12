// Habillage automatique des niveaux : modénatures et équipements muraux, plafonds techniques, signalétique, taches au sol,
// halos et cônes de lumière, débris, et arrière-plans lointains. Tout est décoratif (aucune collision) et déterministe.
import * as THREE from 'three';
import type { Level } from './Level';
import { mat, softTexture, type MatName } from '../render/Materials';

export type Theme = 'helix' | 'military' | 'city' | 'temple' | 'fracture' | 'sim';

const rnd = (a: number, b: number, s = 0): number => { const v = Math.sin(a * 127.1 + b * 311.7 + s * 74.7) * 43758.5453; return v - Math.floor(v); };

// ---------------------------------------------------------------- textures et matériaux de décalcomanies

const SIGN_CELLS = 4;
let signMat: THREE.MeshStandardMaterial | null = null;
let stainMat: THREE.MeshBasicMaterial | null = null;
const glowMats = new Map<number, THREE.MeshBasicMaterial>();

function signAtlas(): THREE.MeshStandardMaterial {
  if (signMat) return signMat;
  const S = 256, c = document.createElement('canvas'); c.width = c.height = S * SIGN_CELLS;
  const x = c.getContext('2d')!;
  const cell = (i: number, draw: () => void) => { x.save(); x.translate((i % SIGN_CELLS) * S, Math.floor(i / SIGN_CELLS) * S); x.beginPath(); x.rect(0, 0, S, S); x.clip(); draw(); x.restore(); };
  const font = (px: number, w = 700) => { x.font = `${w} ${px}px "Rajdhani","Bahnschrift","Arial Narrow",Arial,sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle'; };
  const plate = (bg: string, border: string) => { x.fillStyle = bg; x.fillRect(10, 10, S - 20, S - 20); x.strokeStyle = border; x.lineWidth = 8; x.strokeRect(18, 18, S - 36, S - 36); };
  const wear = () => { for (let k = 0; k < 260; k++) { x.globalCompositeOperation = 'destination-out'; x.fillStyle = `rgba(0,0,0,${0.25 + Math.random() * 0.5})`; const px = Math.random() * S, py = Math.random() * S, r = 1 + Math.random() * 5; x.fillRect(px, py, r, r * (0.5 + Math.random())); } x.globalCompositeOperation = 'source-over'; };
  const tri = (fill: string, stroke: string) => { x.beginPath(); x.moveTo(S / 2, 30); x.lineTo(S - 26, S - 40); x.lineTo(26, S - 40); x.closePath(); x.fillStyle = fill; x.fill(); x.lineWidth = 12; x.strokeStyle = stroke; x.lineJoin = 'round'; x.stroke(); };
  // 0 danger
  cell(0, () => { tri('#d8a41c', '#15140f'); x.fillStyle = '#15140f'; font(130); x.fillText('!', S / 2, S / 2 + 30); wear(); });
  // 1 haute tension
  cell(1, () => { tri('#d8a41c', '#15140f'); x.fillStyle = '#15140f'; x.beginPath(); x.moveTo(140, 80); x.lineTo(104, 150); x.lineTo(128, 150); x.lineTo(112, 206); x.lineTo(160, 128); x.lineTo(134, 128); x.closePath(); x.fill(); wear(); });
  // 2 fracture : cercle brisé
  cell(2, () => { plate('#1a1420', '#8a5aff'); x.strokeStyle = '#b08aff'; x.lineWidth = 12; x.beginPath(); x.arc(S / 2, S / 2, 62, 0.4, 5.6); x.stroke(); x.lineWidth = 8; x.beginPath(); x.moveTo(S / 2 + 10, 50); x.lineTo(S / 2 - 14, 110); x.lineTo(S / 2 + 12, 140); x.lineTo(S / 2 - 8, 206); x.stroke(); wear(); });
  // 3 HELIX
  cell(3, () => { x.fillStyle = 'rgba(216,220,226,0.92)'; font(74, 700); x.fillText('HELIX', S / 2, 112); x.fillRect(34, 150, S - 68, 8); font(26, 600); x.fillText('DIVISION RECHERCHE', S / 2, 186); wear(); });
  // 4-7 secteurs
  ['04', '07', '12', 'B2'].forEach((n, k) => cell(4 + k, () => { x.fillStyle = 'rgba(220,214,196,0.9)'; font(34, 600); x.fillText(k % 2 ? 'NIVEAU' : 'SECTEUR', S / 2, 62); font(150, 700); x.fillText(n, S / 2, 160); wear(); }));
  // 8 flèche
  cell(8, () => { x.fillStyle = 'rgba(220,170,40,0.95)'; x.beginPath(); x.moveTo(30, 100); x.lineTo(140, 100); x.lineTo(140, 56); x.lineTo(228, 128); x.lineTo(140, 200); x.lineTo(140, 156); x.lineTo(30, 156); x.closePath(); x.fill(); wear(); });
  // 9 accès restreint
  cell(9, () => { plate('#7a1c18', '#e8e0d0'); x.fillStyle = '#e8e0d0'; font(46); x.fillText('ACCÈS', S / 2, 92); x.fillText('RESTREINT', S / 2, 142); font(22, 600); x.fillText('AUTORISATION NIVEAU 4', S / 2, 196); wear(); });
  // 10 confinement
  cell(10, () => { plate('#c8a020', '#15140f'); x.fillStyle = '#15140f'; font(40); x.fillText('ZONE DE', S / 2, 86); x.fillText('CONFINEMENT', S / 2, 132); font(22, 600); x.fillText('PROTECTION ARCANIQUE REQUISE', S / 2, 190, S - 50); wear(); });
  // 11 évacuation (affiche déchirée)
  cell(11, () => { x.fillStyle = '#b8b0a0'; x.beginPath(); x.moveTo(20, 16); x.lineTo(232, 24); x.lineTo(240, 170); x.lineTo(180, 236); x.lineTo(24, 226); x.closePath(); x.fill(); x.fillStyle = '#8a1e1a'; font(40); x.fillText('ÉVACUATION', S / 2, 70, 190); x.fillStyle = '#22201c'; font(22, 600); x.fillText('REJOIGNEZ LE POINT', S / 2, 120); x.fillText('DE RASSEMBLEMENT', S / 2, 148); x.fillRect(46, 174, 150, 5); x.fillRect(46, 190, 110, 5); wear(); wear(); });
  // 12 graffiti du Voile
  cell(12, () => { x.strokeStyle = 'rgba(150,90,255,0.9)'; x.lineWidth = 9; x.lineCap = 'round'; x.beginPath(); x.arc(S / 2, 120, 70, 0, 6.3); x.moveTo(S / 2, 34); x.lineTo(S / 2, 214); x.moveTo(70, 90); x.lineTo(186, 160); x.moveTo(186, 90); x.lineTo(70, 160); x.stroke(); x.lineWidth = 5; for (let k = 0; k < 5; k++) { x.beginPath(); x.moveTo(60 + k * 34, 190); x.lineTo(60 + k * 34 + (k % 2 ? 6 : -4), 236 - k * 5); x.stroke(); } });
  // 13 sortie
  cell(13, () => { plate('#145a34', '#d8f0e0'); x.fillStyle = '#d8f0e0'; font(64); x.fillText('SORTIE', S / 2, 112); x.beginPath(); x.moveTo(70, 176); x.lineTo(160, 176); x.lineTo(160, 156); x.lineTo(196, 186); x.lineTo(160, 216); x.lineTo(160, 196); x.lineTo(70, 196); x.closePath(); x.fill(); wear(); });
  // 14 plaque technique
  cell(14, () => { plate('#2a2e34', '#6a7078'); x.fillStyle = '#c8ccd0'; font(22, 600); x.textAlign = 'left'; ['HX-RÉSEAU 440V', 'CIRCUIT 3 / 7', 'RÉV. 11-C'].forEach((t, k) => x.fillText(t, 36, 60 + k * 34)); for (let k = 0; k < 26; k++) x.fillRect(36 + k * 7, 170, k % 3 ? 3 : 5, 44); wear(); });
  // 15 bande de danger
  cell(15, () => { for (let k = -4; k < 12; k++) { x.fillStyle = k % 2 ? '#15140f' : '#d0a01c'; x.beginPath(); x.moveTo(k * 40, 90); x.lineTo(k * 40 + 40, 90); x.lineTo(k * 40 + 100, 166); x.lineTo(k * 40 + 60, 166); x.closePath(); x.fill(); } wear(); });
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  signMat = new THREE.MeshStandardMaterial({ map: t, transparent: true, depthWrite: false, roughness: 0.75, metalness: 0.05, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
  return signMat;
}

/** Taches sombres : huile, fissures, brûlure, coulure (4 cellules). */
function stainAtlas(): THREE.MeshBasicMaterial {
  if (stainMat) return stainMat;
  const S = 256, c = document.createElement('canvas'); c.width = S * 2; c.height = S * 2;
  const x = c.getContext('2d')!;
  x.fillStyle = '#000'; x.fillRect(0, 0, S * 2, S * 2);
  const blot = (cx: number, cy: number, r: number, a: number) => { const g = x.createRadialGradient(cx, cy, 0, cx, cy, r); g.addColorStop(0, `rgba(255,255,255,${a})`); g.addColorStop(0.6, `rgba(255,255,255,${a * 0.6})`); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(cx - r, cy - r, r * 2, r * 2); };
  // huile
  for (let k = 0; k < 14; k++) blot(128 + Math.cos(k * 2.4) * (20 + k * 4), 128 + Math.sin(k * 2.4) * (16 + k * 4), 26 + (k % 5) * 9, 0.34);
  // fissures
  x.save(); x.translate(S, 0); x.strokeStyle = 'rgba(255,255,255,0.75)'; x.lineCap = 'round';
  const crack = (px: number, py: number, a: number, len: number, w: number, d: number) => { if (d > 4 || len < 8) return; const nx = px + Math.cos(a) * len, ny = py + Math.sin(a) * len; x.lineWidth = w; x.beginPath(); x.moveTo(px, py); x.lineTo(nx, ny); x.stroke(); crack(nx, ny, a + (Math.random() - 0.5) * 1.1, len * 0.8, w * 0.75, d + 1); if (Math.random() < 0.6) crack(nx, ny, a + (Math.random() < 0.5 ? 1 : -1) * (0.6 + Math.random() * 0.6), len * 0.6, w * 0.6, d + 1); };
  for (let k = 0; k < 5; k++) crack(128, 128, k * 1.26 + Math.random() * 0.5, 34, 3.2, 0);
  x.restore();
  // brûlure
  x.save(); x.translate(0, S); blot(128, 128, 120, 0.8); for (let k = 0; k < 18; k++) blot(128 + Math.cos(k * 1.7) * 70, 128 + Math.sin(k * 1.7) * 70, 30, 0.3); x.restore();
  // coulure verticale
  x.save(); x.translate(S, S); for (let k = 0; k < 9; k++) { const px = 40 + k * 22 + Math.random() * 10, len = 90 + Math.random() * 150, g = x.createLinearGradient(0, 0, 0, len); g.addColorStop(0, 'rgba(255,255,255,0.55)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(px, 0, 5 + Math.random() * 9, len); } x.restore();
  const t = new THREE.CanvasTexture(c);
  stainMat = new THREE.MeshBasicMaterial({ color: 0x0a0806, alphaMap: t, transparent: true, depthWrite: false, opacity: 0.85, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  return stainMat;
}

function glowMat(color: number): THREE.MeshBasicMaterial {
  let m = glowMats.get(color);
  if (!m) { m = new THREE.MeshBasicMaterial({ color, map: softTexture(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.2, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }); glowMats.set(color, m); }
  return m;
}

const coneMats2 = new Map<number, THREE.ShaderMaterial>();
/** Cône de lumière : additif, dense près de la source, bords fondus (la face vue de profil s'efface). */
export function coneMat(color: number): THREE.ShaderMaterial {
  let m = coneMats2.get(color);
  if (m) return m;
  m = new THREE.ShaderMaterial({
    uniforms: { color: { value: new THREE.Color(color) } },
    vertexShader: 'varying vec2 vUv; varying vec3 vN; varying vec3 vV; void main(){ vUv=uv; vec4 mv=modelViewMatrix*vec4(position,1.0); vN=normalize(normalMatrix*normal); vV=normalize(-mv.xyz); gl_Position=projectionMatrix*mv; }',
    fragmentShader: 'uniform vec3 color; varying vec2 vUv; varying vec3 vN; varying vec3 vV; void main(){ float f=abs(dot(normalize(vN),normalize(vV))); float a=pow(f,2.2)*pow(vUv.y,1.6)*0.11; gl_FragColor=vec4(color*a,a); }',
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  });
  coneMats2.set(color, m);
  return m;
}

// ---------------------------------------------------------------- primitives

function quad(w: number, h: number, cell: number, cells: number): THREE.BufferGeometry {
  const g = new THREE.PlaneGeometry(w, h);
  const u0 = (cell % cells) / cells, v0 = 1 - (Math.floor(cell / cells) + 1) / cells, s = 1 / cells;
  const uv = g.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, u0 + uv.getX(i) * s, v0 + uv.getY(i) * s);
  return g;
}

/** Repère d'un mur axial : u = le long du mur, n = normale. */
interface Frame { ax: boolean; x: number; z: number; len: number; th: number; h: number }

function at(f: Frame, u: number, out: number, side: number): [number, number] {
  return f.ax ? [f.x + u, f.z + side * out] : [f.x + side * out, f.z + u];
}
/** Boîte plaquée contre le mur. w = le long du mur, d = saillie. */
function wbox(L: Level, f: Frame, m: MatName, u: number, y: number, w: number, h: number, d: number, side: number, gap = 0): void {
  const [x, z] = at(f, u, f.th / 2 + gap + d / 2, side);
  L.box(m, x, y, z, f.ax ? w : d, h, f.ax ? d : w, { collide: false });
}
function wdecal(L: Level, f: Frame, material: THREE.Material, geo: THREE.BufferGeometry, u: number, y: number, side: number, out = 0.012): void {
  const [x, z] = at(f, u, f.th / 2 + out, side);
  L.deco(material, geo, x, y, z, 0, f.ax ? (side > 0 ? 0 : Math.PI) : side > 0 ? Math.PI / 2 : -Math.PI / 2, 0);
}
function wpipe(L: Level, f: Frame, u0: number, y0: number, u1: number, y1: number, out: number, side: number, r: number, m: MatName): void {
  const [x0, z0] = at(f, u0, f.th / 2 + out, side), [x1, z1] = at(f, u1, f.th / 2 + out, side);
  L.pipe(x0, y0, z0, x1, y1, z1, r, m);
}
/** Câble pendant entre deux points (caténaire). */
export function cable(L: Level, a: THREE.Vector3, b: THREE.Vector3, sag = 0.4, r = 0.025, m: MatName = 'cable'): void {
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= 8; i++) { const t = i / 8; const p = a.clone().lerp(b, t); p.y -= Math.sin(t * Math.PI) * sag; pts.push(p); }
  L.deco(mat(m), new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 10, r, 4, false), 0, 0, 0);
}

/** Halo de lumière simulé sur une surface (sol : flat = true). */
export function glowPatch(L: Level, x: number, y: number, z: number, r: number, color: number, flat = true, ry = 0): void {
  L.deco(glowMat(color), new THREE.PlaneGeometry(r * 2, r * 2), x, y, z, flat ? -Math.PI / 2 : 0, flat ? 0 : ry, 0);
}

/** Cône de lumière volumétrique sous une source. */
export function lightCone(L: Level, x: number, y: number, z: number, h: number, r: number, color: number): void {
  L.deco(coneMat(color), new THREE.CylinderGeometry(0.12, r, h, 14, 1, true), x, y - h / 2, z);
}

// ---------------------------------------------------------------- murs

const TRIM: Record<Theme, MatName> = { helix: 'trim', military: 'trim', city: 'darkconcrete', temple: 'stone', fracture: 'trim', sim: 'darkmetal' };

/** Modénatures et équipements d'un mur axial (appelé par Level.wall). */
export function detailWall(L: Level, m: MatName, x1: number, z1: number, x2: number, z2: number, h: number, th: number): void {
  const ax = z1 === z2;
  const len = ax ? Math.abs(x2 - x1) : Math.abs(z2 - z1);
  if (len < 2.4 || h < 2.4) return;
  const f: Frame = { ax, x: (x1 + x2) / 2, z: (z1 + z2) / 2, len, th, h };
  const th_ = L.theme, trim = TRIM[th_];
  const temple = th_ === 'temple';
  const cx = f.x, cz = f.z;
  // plinthe et couronnement
  L.box(temple ? 'stone' : trim, cx, 0, cz, ax ? len + th : th + 0.14, 0.32, ax ? th + 0.14 : len + th, { collide: false });
  L.box(temple ? 'stone' : trim, cx, h - 0.16, cz, ax ? len + th : th + 0.2, 0.2, ax ? th + 0.2 : len + th, { collide: false });
  if (h >= 4.6) L.box(temple ? 'rune' : m === 'darkconcrete' ? 'trim' : 'darkconcrete', cx, h * 0.62, cz, ax ? len : th + 0.07, temple ? 0.5 : 0.14, ax ? th + 0.07 : len, { collide: false });
  // pilastres réguliers
  const bays = Math.max(1, Math.round(len / 5.2)), bw = len / bays;
  const pm: MatName = temple ? 'stone' : m;
  for (let i = 0; i <= bays; i++) {
    const u = -len / 2 + i * bw;
    const [px, pz] = at(f, u, 0, 1);
    L.box(pm, px, 0, pz, ax ? 0.5 : th + 0.3, h, ax ? th + 0.3 : 0.5, { collide: false });
    if (!temple) L.box(trim, px, 0, pz, ax ? 0.56 : th + 0.36, 0.5, ax ? th + 0.36 : 0.56, { collide: false });
    else L.box('stone', px, h - 0.6, pz, ax ? 0.7 : th + 0.44, 0.34, ax ? th + 0.44 : 0.7, { collide: false });
  }
  // mur d'enceinte épais : poteaux et barbelés au sommet
  if (th >= 0.9 && !temple) {
    const n = Math.max(2, Math.round(len / 3));
    for (let i = 0; i <= n; i++) { const [px, pz] = at(f, -len / 2 + (i * len) / n, 0, 1); L.box('trim', px, h, pz, 0.08, 0.9, 0.08, { collide: false, noShadow: true }); }
    for (const yy of [0.35, 0.6, 0.85]) L.box('cable', cx, h + yy, cz, ax ? len : 0.025, 0.025, ax ? 0.025 : len, { collide: false });
  }
  // équipements par travée et par face
  for (let i = 0; i < bays; i++) for (const side of [1, -1]) {
    const u = -len / 2 + (i + 0.5) * bw;
    const [wx, wz] = at(f, u, 0, side);
    const k = rnd(Math.round(wx * 2), Math.round(wz * 2), side);
    const k2 = rnd(Math.round(wz * 3), Math.round(wx * 3), side + 5);
    const span = bw - 0.9;
    if (span < 1.6) continue;
    if (temple) templeBay(L, f, u, span, side, k, k2);
    else techBay(L, f, u, span, side, k, k2, th_);
  }
}

function techBay(L: Level, f: Frame, u: number, span: number, side: number, k: number, k2: number, th: Theme): void {
  const h = f.h, hi = Math.min(h - 0.7, 3.6);
  const city = th === 'city';
  const sm = signAtlas();
  if (k < 0.2) {
    // faisceau de tuyaux avec colliers et descente
    const r = 0.06 + k2 * 0.05;
    wpipe(L, f, u - span / 2 - 0.4, hi, u + span / 2 + 0.4, hi, 0.12 + r, side, r, k2 > 0.5 ? 'rust' : 'metal');
    wpipe(L, f, u - span / 2 - 0.4, hi - 0.28, u + span / 2 + 0.4, hi - 0.28, 0.1, side, 0.045, 'metal');
    for (const o of [-span / 2 + 0.2, 0, span / 2 - 0.2]) wbox(L, f, 'trim', u + o, hi - 0.4, 0.08, 0.56, 0.22, side);
    if (k2 > 0.35) { wpipe(L, f, u + span * 0.3, hi, u + span * 0.3, 0.3, 0.12 + r, side, r, k2 > 0.5 ? 'rust' : 'metal'); wbox(L, f, 'paint_red', u + span * 0.3, 1.15, 0.26, 0.26, 0.1, side, 0.2); }
  } else if (k < 0.36) {
    // chemin de câbles et boîtier de dérivation
    const [ax0, az0] = at(f, u - span / 2, f.th / 2 + 0.1, side), [ax1, az1] = at(f, u + span / 2, f.th / 2 + 0.1, side);
    for (let c = 0; c < 3; c++) cable(L, new THREE.Vector3(ax0, hi - c * 0.07, az0), new THREE.Vector3(ax1, hi - c * 0.05, az1), 0.18 + c * 0.14 + k2 * 0.2, 0.022);
    wbox(L, f, 'trim', u - span / 2 + 0.1, hi - 0.25, 0.34, 0.44, 0.16, side);
    wbox(L, f, 'trim', u + span / 2 - 0.1, hi - 0.25, 0.34, 0.44, 0.16, side);
  } else if (k < 0.5) {
    // grille de ventilation
    const w = Math.min(1.5, span * 0.6), y = Math.min(h - 1.5, 2.5);
    const vs = th === 'helix' || th === 'military' ? L.propSize('ph_airduct#vent_01') : null;
    if (vs) {
      // bouche d'aération du kit Modular Airduct (Poly Haven, CC0)
      const [vx, vz] = at(f, u, f.th / 2 + vs.z * 0.5, side), k = w / vs.x;
      L.propM('ph_airduct#vent_01', new THREE.Matrix4().compose(new THREE.Vector3(vx, y + 0.45, vz), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), f.ax ? (side > 0 ? 0 : Math.PI) : side > 0 ? Math.PI / 2 : -Math.PI / 2), new THREE.Vector3(k, k, 1)));
    } else {
      wbox(L, f, 'trim', u, y, w, 0.9, 0.07, side);
      for (let s = 0; s < 5; s++) wbox(L, f, 'black', u, y + 0.1 + s * 0.155, w - 0.16, 0.07, 0.05, side, 0.07);
    }
    wdecal(L, f, stainAtlas(), quad(w * 0.9, Math.min(2.2, y), 3, 2), u, y - Math.min(2.2, y) / 2, side, 0.02);
  } else if (k < 0.64) {
    // armoire électrique, gaine et voyant
    wbox(L, f, city ? 'darkmetal' : 'trim', u, 0.95, 0.75, 1.15, 0.2, side);
    wbox(L, f, 'metal', u, 2.1, 0.07, Math.max(0.2, h - 2.3), 0.07, side);
    wbox(L, f, k2 > 0.5 ? 'glow_green' : 'glow_orange', u + 0.22, 1.82, 0.06, 0.06, 0.03, side, 0.2);
    wdecal(L, f, sm, quad(0.34, 0.34, k2 > 0.4 ? 1 : 14, SIGN_CELLS), u - 0.1, 1.5, side, 0.215);
  } else if (k < 0.8) {
    // applique murale : source visible, halo sur le mur et flaque de lumière au sol
    const col = th === 'fracture' ? 0x8a5aff : k2 > 0.72 ? 0xff5a2a : th === 'city' ? 0xffc890 : 0xffe2b0;
    const gm: MatName = th === 'fracture' ? 'glow_violet' : k2 > 0.72 ? 'glow_orange' : 'glow_white';
    wbox(L, f, 'trim', u, hi - 0.06, 0.62, 0.1, 0.26, side);
    wbox(L, f, gm, u, hi - 0.13, 0.5, 0.07, 0.16, side, 0.03);
    const [gx, gz] = at(f, u, f.th / 2 + 0.02, side);
    glowPatch(L, gx, hi - 0.9, gz, 1.5, col, false, f.ax ? (side > 0 ? 0 : Math.PI) : side > 0 ? Math.PI / 2 : -Math.PI / 2);
    const [fx, fz] = at(f, u, f.th / 2 + 1.1, side);
    glowPatch(L, fx, 0.02, fz, 1.9, col);
    const [cx, cz] = at(f, u, f.th / 2 + 0.2, side);
    lightCone(L, cx, hi - 0.15, cz, hi - 0.2, 1.2, col);
  } else {
    // signalétique peinte ou plaque
    const cells = city ? [11, 12, 0, 13, 8, 11] : th === 'fracture' ? [2, 10, 12, 0, 9, 3] : th === 'helix' ? [3, 4, 5, 9, 10, 0, 6, 7] : [4, 5, 6, 7, 8, 0, 13, 9];
    const cell = cells[Math.floor(k2 * cells.length) % cells.length];
    const big = cell === 3 || (cell >= 4 && cell <= 7) || cell === 12;
    const s = big ? Math.min(1.9, span * 0.7) : 0.7;
    wdecal(L, f, sm, quad(s, s, cell, SIGN_CELLS), u, big ? Math.min(h - 1.2, 2.4) : 1.75, side);
    if (k2 > 0.5) wdecal(L, f, sm, quad(Math.min(span, 3), Math.min(span, 3), 15, SIGN_CELLS), u, 0.42, side);
  }
  // coulures et taches indépendantes de l'équipement
  if (k2 < 0.38) wdecal(L, f, stainAtlas(), quad(1.2 + k * 1.6, Math.min(h * 0.7, 3.2), 3, 2), u + (k - 0.5) * span * 0.6, h - 0.2 - Math.min(h * 0.7, 3.2) / 2, side, 0.008);
}

function templeBay(L: Level, f: Frame, u: number, span: number, side: number, k: number, k2: number): void {
  const h = f.h;
  if (k < 0.3) {
    // niche votive : cadre de pierre, fond runique, cristal
    const w = Math.min(1.5, span * 0.6);
    wbox(L, f, 'stone', u - w / 2 - 0.12, 0.8, 0.24, 2.3, 0.2, side); wbox(L, f, 'stone', u + w / 2 + 0.12, 0.8, 0.24, 2.3, 0.2, side);
    wbox(L, f, 'stone', u, 3.0, w + 0.6, 0.3, 0.26, side); wbox(L, f, 'stone', u, 0.5, w + 0.5, 0.3, 0.34, side);
    wbox(L, f, 'rune', u, 0.8, w, 2.2, 0.05, side);
    const [cx, cz] = at(f, u, f.th / 2 + 0.2, side);
    L.deco(mat(k2 > 0.5 ? 'crystal' : 'crystal_red'), new THREE.OctahedronGeometry(0.16, 0), cx, 1.15, cz, 0, k2 * 3, 0, 1, 1.8, 1);
    const [gx, gz] = at(f, u, f.th / 2 + 0.9, side);
    glowPatch(L, gx, 0.02, gz, 1.5, k2 > 0.5 ? 0x7a4aff : 0xff3a5a);
  } else if (k < 0.52) {
    // chaînes pendantes
    for (let c = 0; c < 3; c++) { const o = (c - 1) * span * 0.28, l = 1.2 + rnd(c, k2 * 10) * 2; wbox(L, f, 'black', u + o, h - 0.4 - l, 0.05, l, 0.05, side, 0.1); wbox(L, f, 'darkmetal', u + o, h - 0.52 - l, 0.14, 0.14, 0.14, side, 0.055); }
  } else if (k < 0.7) {
    // brasero mural : feu chaud, contrepoint à la lumière violette de la Fracture
    wbox(L, f, 'darkmetal', u, 2.1, 0.5, 0.12, 0.5, side); wbox(L, f, 'darkmetal', u, 1.9, 0.1, 0.2, 0.3, side);
    wbox(L, f, 'glow_orange', u, 2.22, 0.3, 0.14, 0.3, side, 0.1);
    const [gx, gz] = at(f, u, f.th / 2 + 0.02, side);
    glowPatch(L, gx, 2.6, gz, 2.0, 0xff8a3a, false, f.ax ? (side > 0 ? 0 : Math.PI) : side > 0 ? Math.PI / 2 : -Math.PI / 2);
    const [fx, fz] = at(f, u, f.th / 2 + 1, side);
    glowPatch(L, fx, 0.02, fz, 2.4, 0xff8a3a);
  } else if (k < 0.86) {
    // bas-relief runique
    wbox(L, f, 'stone', u, 1.0, Math.min(span * 0.8, 2.6), 0.2, 0.14, side); wbox(L, f, 'rune', u, 1.2, Math.min(span * 0.7, 2.2), 1.6, 0.06, side); wbox(L, f, 'stone', u, 2.8, Math.min(span * 0.8, 2.6), 0.2, 0.14, side);
  } else {
    // excroissance cristalline au pied du mur
    for (let c = 0; c < 4; c++) { const [cx, cz] = at(f, u + (rnd(c, k2 * 7) - 0.5) * span * 0.6, f.th / 2 + 0.15 + rnd(c, 3) * 0.3, side); L.deco(mat('crystal'), new THREE.OctahedronGeometry(0.22, 0), cx, 0.2 + rnd(c, 9) * 0.3, cz, rnd(c, 1) - 0.5, c, rnd(c, 2) - 0.5, 1, 1.6 + rnd(c, 4) * 2, 1); }
    const [gx, gz] = at(f, u, f.th / 2 + 0.7, side);
    glowPatch(L, gx, 0.02, gz, 1.4, 0x7a4aff);
  }
  if (k2 < 0.4) wdecal(L, f, stainAtlas(), quad(1.4 + k * 1.4, Math.min(h * 0.7, 3.4), 3, 2), u + (k - 0.5) * span * 0.5, h - 0.2 - Math.min(h * 0.7, 3.4) / 2, side, 0.008);
}

// ---------------------------------------------------------------- plafonds

/** Structure et réseaux sous un toit : poutres, gaine, chemin de câbles, luminaires. */
export function detailRoof(L: Level, x0: number, z0: number, x1: number, z1: number, y: number): void {
  const w = x1 - x0, d = z1 - z0;
  if (y < 3.4 || Math.min(w, d) < 3) return;
  const temple = L.theme === 'temple';
  const longX = w >= d;
  const long = longX ? w : d, short = longX ? d : w;
  const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
  const B = (m: MatName, along: number, across: number, yy: number, la: number, lc: number, hh: number) => L.box(m, longX ? cx + along : cx + across, yy, longX ? cz + across : cz + along, longX ? la : lc, hh, longX ? lc : la, { collide: false, noShadow: true });
  // poutres transversales
  const nb = Math.max(1, Math.round(long / 4.5));
  for (let i = 0; i <= nb; i++) B(temple ? 'stone' : 'trim', -long / 2 + 0.3 + (i * (long - 0.6)) / nb, 0, y - 0.34, temple ? 0.5 : 0.24, short, 0.34);
  if (temple) {
    // lanternes de cristal suspendues
    for (let i = 0; i < nb; i++) { const a = -long / 2 + ((i + 0.5) * long) / nb; const px = longX ? cx + a : cx, pz = longX ? cz : cz + a; L.box('black', px, y - 1.1, pz, 0.04, 1.1, 0.04, { collide: false, noShadow: true }); L.deco(mat('crystal'), new THREE.OctahedronGeometry(0.2, 0), px, y - 1.3, pz, 0, i, 0, 1, 1.5, 1); }
    return;
  }
  if (short >= 5) {
    // gaine de ventilation avec brides
    const off = short * 0.28;
    // gaine Modular Airduct Rectangular 01 (Poly Haven, CC0) dans le laboratoire et le hangar ; boîtes simplifiées ailleurs ou en repli
    const ds = L.theme === 'helix' || L.theme === 'military' ? L.propSize('ph_airduct#single_01') : null;
    if (ds) {
      const len = long - 0.8, n = Math.max(1, Math.round(len / (ds.x * 2))), seg = len / n, yc = y - 0.36 - ds.y / 2; // modules étirés ×2 : deux fois moins d'instances
      const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), longX ? 0 : Math.PI / 2);
      const P = (along: number, across: number, yy: number) => new THREE.Vector3(longX ? cx + along : cx + across, yy, longX ? cz + across : cz + along);
      const side = off > 0 ? -1 : 1; // grilles tournées vers le centre de la salle
      const qv = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), longX ? (side > 0 ? 0 : Math.PI) : side > 0 ? Math.PI / 2 : -Math.PI / 2);
      for (let i = 0; i < n; i++) {
        const al = -len / 2 + (i + 0.5) * seg;
        L.propM('ph_airduct#single_01', new THREE.Matrix4().compose(P(al, off, yc), q, new THREE.Vector3(seg / ds.x, 1, 1)));
        if (i % 4 === 1) L.propM(i % 8 === 1 ? 'ph_airduct#vent_02' : 'ph_airduct#vent_01', new THREE.Matrix4().compose(P(al, off + side * (ds.z / 2 + 0.02), yc), qv, new THREE.Vector3(1, 1, 1)));
        if (i % 3 === 0) for (const e of [-1, 1]) B('trim', al - seg / 2, off + e * (ds.z / 2 + 0.03), yc + ds.y / 2, 0.03, 0.03, 0.36);
      }
    } else {
      B('metal', 0, off, y - 0.86, long - 0.8, 0.7, 0.44);
      for (let i = 0; i <= Math.round(long / 3); i++) B('trim', -long / 2 + 0.5 + (i * (long - 1)) / Math.max(1, Math.round(long / 3)), off, y - 0.9, 0.08, 0.78, 0.52);
    }
    // chemin de câbles
    B('trim', 0, -off, y - 0.5, long - 0.6, 0.36, 0.05);
    for (const c of [-0.1, 0, 0.1]) B('cable', 0, -off + c, y - 0.45, long - 0.6, 0.045, 0.045);
  }
  // luminaires linéaires (source visible, sans coût d'éclairage)
  const nl = Math.max(1, Math.round(long / 7));
  for (let i = 0; i < nl; i++) for (const s of short >= 8 ? [-0.22, 0.22] : [0]) {
    const a = -long / 2 + ((i + 0.5) * long) / nl, c = s * short;
    B('trim', a, c, y - 0.46, 1.5, 0.2, 0.12);
    const broken = rnd(Math.round(cx + a), Math.round(cz + c), 3) < 0.22;
    if (!broken) {
      B(L.theme === 'fracture' ? 'glow_violet' : 'glow_white', a, c, y - 0.5, 1.3, 0.1, 0.04);
      // flaque de lumière au sol sous le luminaire
      const px = longX ? cx + a : cx + c, pz = longX ? cz + c : cz + a, gy = L.world.groundAt(px, pz, y - 1);
      if (gy > -50 && y - gy > 2) glowPatch(L, px, gy + 0.03, pz, Math.min(4.5, (y - gy) * 0.8), L.theme === 'fracture' ? 0x8a6aff : 0xdfe8f4);
    }
  }
}

// ---------------------------------------------------------------- sol : taches, fissures, débris

export function detailGround(L: Level): void {
  const b = L.bounds, area = (b.maxX - b.minX) * (b.maxZ - b.minZ);
  const sm = stainAtlas();
  const n = Math.min(260, Math.round(area / 55));
  for (let i = 0; i < n; i++) {
    const x = b.minX + 2 + rnd(i, 1, 7) * (b.maxX - b.minX - 4), z = b.minZ + 2 + rnd(i, 2, 7) * (b.maxZ - b.minZ - 4);
    const y = L.world.groundAt(x, z, 0.6);
    if (y < -0.2 || y > 0.2) continue;
    const s = 1.4 + rnd(i, 3, 7) * 3.2, cell = Math.floor(rnd(i, 4, 7) * 3);
    L.deco(sm, quad(s, s, cell, 2), x, y + 0.012, z, -Math.PI / 2, 0, rnd(i, 5, 7) * 6.28);
  }
  // petits débris instanciés
  const count = Math.min(800, Math.round(area / 20));
  const dm: MatName = L.theme === 'temple' ? 'stone' : L.theme === 'fracture' ? 'rock' : 'rubble';
  const im = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1, 0), mat(dm), count);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), sc = new THREE.Vector3();
  let k = 0;
  for (let i = 0; i < count; i++) {
    // amas : les débris se regroupent autour de foyers
    const fx = b.minX + rnd(Math.floor(i / 7), 11, 3) * (b.maxX - b.minX), fz = b.minZ + rnd(Math.floor(i / 7), 12, 3) * (b.maxZ - b.minZ);
    const x = fx + (rnd(i, 13, 3) - 0.5) * 5, z = fz + (rnd(i, 14, 3) - 0.5) * 5;
    const y = L.world.groundAt(x, z, 0.5);
    if (y < -0.2 || y > 0.2) continue;
    const s = 0.04 + rnd(i, 15, 3) * rnd(i, 16, 3) * 0.22;
    e.set(rnd(i, 17, 3) * 6, rnd(i, 18, 3) * 6, rnd(i, 19, 3) * 6); q.setFromEuler(e);
    m4.compose(p.set(x, y + s * 0.3, z), q, sc.set(s * (0.7 + rnd(i, 20, 3)), s * 0.55, s));
    im.setMatrixAt(k++, m4);
  }
  im.count = k; im.castShadow = true; im.receiveShadow = true; im.computeBoundingSphere();
  L.fxMeshes.push(im);
  L.root.add(im);
}

// ---------------------------------------------------------------- arrière-plans lointains

const silhouette = (c: number, e = 0, ei = 1) => new THREE.MeshStandardMaterial({ color: c, roughness: 1, metalness: 0, flatShading: true, emissive: e, emissiveIntensity: ei });
const SIL: Record<string, THREE.MeshStandardMaterial> = {};
const sil = (k: string, c: number, e = 0, ei = 1) => (SIL[k] ||= silhouette(c, e, ei));

/** Relief continu autour de la carte. */
function ridge(L: Level, cx: number, cz: number, r: number, hMin: number, hMax: number, m: THREE.Material, seed = 1, jag = 0.5): void {
  const N = 72, pos: number[] = [];
  const top = (i: number) => { const a = (i % N) / N * 6.2832; const h = hMin + (hMax - hMin) * (0.5 + 0.5 * Math.sin(a * 3 + seed) * Math.cos(a * 7 + seed * 2)) * (0.6 + 0.4 * rnd(i % N, seed)) ; const rr = r * (1 + (rnd(i % N, seed, 4) - 0.5) * 0.12 * jag); return [cx + Math.cos(a) * rr, h, cz + Math.sin(a) * rr]; };
  const base = (i: number, k: number) => { const a = (i % N) / N * 6.2832; return [cx + Math.cos(a) * r * k, -2, cz + Math.sin(a) * r * k]; };
  for (let i = 0; i < N; i++) {
    const t0 = top(i), t1 = top(i + 1), a0 = base(i, 0.86), a1 = base(i + 1, 0.86), b0 = base(i, 1.3), b1 = base(i + 1, 1.3);
    pos.push(...a0, ...t0, ...a1, ...a1, ...t0, ...t1, ...t0, ...b0, ...t1, ...t1, ...b0, ...b1);
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.computeVertexNormals();
  const mesh = new THREE.Mesh(g, m); mesh.matrixAutoUpdate = false; mesh.frustumCulled = false;
  L.root.add(mesh);
}

/** Tour lointaine : empilement de volumes, balise rouge clignotante optionnelle. */
function tower(L: Level, x: number, z: number, w: number, h: number, m: THREE.Material, ruined: boolean, seed: number, beacon = true): void {
  const B = (bx: number, by: number, bz: number, sx: number, sy: number, sz: number, ry = 0, mm = m) => L.deco(mm, new THREE.BoxGeometry(sx, sy, sz), bx, by + sy / 2, bz, 0, ry, 0);
  B(x, 0, z, w, h * 0.7, w * (0.7 + rnd(seed, 1) * 0.5));
  if (ruined) {
    // sommet déchiqueté : colonnes de hauteurs inégales
    for (let i = 0; i < 5; i++) { const ox = (rnd(seed, i, 2) - 0.5) * w * 0.7, oz = (rnd(seed, i, 3) - 0.5) * w * 0.6; B(x + ox, h * 0.7, z + oz, w * (0.2 + rnd(seed, i, 4) * 0.3), h * (0.08 + rnd(seed, i, 5) * 0.3), w * (0.2 + rnd(seed, i, 6) * 0.3)); }
    L.deco(m, new THREE.BoxGeometry(w * 0.5, 0.5, w * 0.9), x + w * 0.3, h * 0.55, z, 0.2, rnd(seed, 9), 0.5);
  } else {
    B(x, h * 0.7, z, w * 0.7, h * 0.22, w * 0.6);
    B(x + w * 0.15, h * 0.92, z, w * 0.12, h * 0.16, w * 0.12);
    if (beacon) {
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.9, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff2a1a, fog: false }));
      b.position.set(x + w * 0.15, h * 1.09, z); L.root.add(b);
      L.updaters.push((_dt, t) => { b.visible = (t * 0.7 + seed) % 1 < 0.55; });
    }
  }
}

function pylon(L: Level, x: number, z: number, h: number, m: THREE.Material, ry: number): void {
  for (const [ox, oz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) L.deco(m, new THREE.CylinderGeometry(0.12, 0.3, h, 4), x + ox * 1.6 * 0.6, h / 2, z + oz * 1.6 * 0.6, ox * 0.04 * -1, 0, oz * 0.04);
  for (let i = 1; i < 6; i++) L.deco(m, new THREE.BoxGeometry(3.4 - i * 0.4, 0.14, 3.4 - i * 0.4), x, (h * i) / 6, z);
  for (const yy of [0.82, 0.96]) L.deco(m, new THREE.BoxGeometry(9, 0.25, 0.25), x, h * yy, z, 0, ry, 0);
}

export type BackdropKind = 'industrial' | 'city' | 'temple' | 'fracture' | 'fort';

/** Décor lointain hors de la zone jouable : donne de la profondeur et une identité à l'horizon. */
export function backdrop(L: Level, kind: BackdropKind): void {
  const b = L.bounds, cx = (b.minX + b.maxX) / 2, cz = (b.minZ + b.maxZ) / 2;
  const hx = (b.maxX - b.minX) / 2, hz = (b.maxZ - b.minZ) / 2;
  const R = Math.hypot(hx, hz);
  /** Point sur un anneau rectangulaire à `d` mètres hors des limites. */
  const ring = (t: number, d: number): [number, number, number] => {
    const a = t * 6.2832, c = Math.cos(a), s = Math.sin(a);
    const k = Math.min((hx + d) / Math.max(Math.abs(c), 1e-3), (hz + d) / Math.max(Math.abs(s), 1e-3));
    return [cx + c * k, cz + s * k, a];
  };
  if (kind === 'industrial' || kind === 'fort') {
    const rock = sil('rockA', 0x23262c), steel = sil('steelA', 0x1c1f24), conc = sil('concA', 0x34373c);
    ridge(L, cx, cz, R + 150, 18, 70, rock, 2, 1);
    ridge(L, cx, cz, R + 85, 6, 26, sil('rockB', 0x2c2f34), 5, 1);
    const n = kind === 'fort' ? 9 : 14;
    for (let i = 0; i < n; i++) {
      const [x, z, a] = ring((i + 0.3 * rnd(i, 1)) / n, 34 + rnd(i, 2) * 40);
      const r = rnd(i, 3);
      if (r < 0.3) { // tours de refroidissement
        L.deco(conc, new THREE.CylinderGeometry(7, 11, 30, 14, 1, true), x, 15, z); L.deco(conc, new THREE.CylinderGeometry(8, 7, 6, 14, 1, true), x, 33, z);
      } else if (r < 0.6) tower(L, x, z, 9 + rnd(i, 4) * 8, 26 + rnd(i, 5) * 34, steel, false, i);
      else if (r < 0.85) pylon(L, x, z, 26 + rnd(i, 6) * 10, steel, a + Math.PI / 2);
      else { L.deco(steel, new THREE.CylinderGeometry(1.4, 2, 48, 8), x, 24, z); L.deco(sil('stackGlow', 0x200a04, 0xff5a1a, 2.4), new THREE.CylinderGeometry(1.5, 1.5, 0.6, 8), x, 48, z); }
    }
  } else if (kind === 'city') {
    const m1 = mat('facade'), dark = sil('cityDark', 0x1a1a22);
    for (let i = 0; i < 26; i++) {
      const [x, z] = ring((i + 0.4 * rnd(i, 1)) / 26, 22 + rnd(i, 2) * 70);
      const h = 34 + rnd(i, 3) * 70, w = 12 + rnd(i, 4) * 14;
      tower(L, x, z, w, h, rnd(i, 5) < 0.55 ? m1 : dark, rnd(i, 6) < 0.6, i, false);
    }
    ridge(L, cx, cz, R + 170, 20, 46, dark, 9, 0.3);
    // grue effondrée
    const [gx, gz] = ring(0.62, 40);
    L.deco(dark, new THREE.BoxGeometry(2, 60, 2), gx, 30, gz); L.deco(dark, new THREE.BoxGeometry(46, 1.6, 1.6), gx + 12, 56, gz, 0, 0.6, -0.28);
  } else if (kind === 'temple') {
    const rock = sil('tRock', 0x1c1830), stone = sil('tStone', 0x2a2440), glow = sil('tGlow', 0x140a30, 0x7a4aff, 2.2);
    ridge(L, cx, cz, R + 120, 30, 110, rock, 4, 1);
    for (let i = 0; i < 22; i++) {
      const [x, z] = ring((i + 0.4 * rnd(i, 1)) / 22, 20 + rnd(i, 2) * 60);
      const h = 24 + rnd(i, 3) * 60;
      const r = rnd(i, 4);
      if (r < 0.5) L.deco(rock, new THREE.ConeGeometry(5 + rnd(i, 5) * 7, h, 5), x, h / 2 - 2, z, (rnd(i, 6) - 0.5) * 0.3, i, (rnd(i, 7) - 0.5) * 0.3);
      else if (r < 0.75) { // colonnes colossales brisées
        L.deco(stone, new THREE.CylinderGeometry(3, 3.4, h * 0.6, 10), x, h * 0.3, z); L.deco(stone, new THREE.BoxGeometry(8.4, 2, 8.4), x, h * 0.6 + 1, z, 0, 0, rnd(i, 8) * 0.2);
      } else { // monolithes flottants gravés
        const y = 26 + rnd(i, 9) * 30;
        L.deco(stone, new THREE.BoxGeometry(5, 14, 4), x, y, z, 0.2, i, 0.25); L.deco(glow, new THREE.BoxGeometry(0.4, 9, 4.2), x, y, z, 0.2, i, 0.25);
      }
    }
    // arche monumentale au nord
    const [ax, az] = ring(0.75, 46);
    L.deco(stone, new THREE.TorusGeometry(26, 3.4, 6, 20, Math.PI), ax, 0, az);
  } else {
    const obs = sil('fObs', 0x150a1a), vein = sil('fVein', 0x18061c, 0xa040ff, 2.6), red = sil('fRed', 0x1c0608, 0xff3a4a, 2.2);
    ridge(L, cx, cz, R + 110, 20, 80, obs, 7, 1);
    for (let i = 0; i < 30; i++) {
      const [x, z, a] = ring((i + 0.4 * rnd(i, 1)) / 30, 16 + rnd(i, 2) * 70);
      const h = 22 + rnd(i, 3) * 70, lean = 0.12 + rnd(i, 4) * 0.3;
      // éclats inclinés vers l'extérieur, comme soufflés depuis le centre
      L.deco(obs, new THREE.ConeGeometry(3 + rnd(i, 5) * 5, h, 4), x, h / 2 - 3, z, Math.sin(a) * lean, i, -Math.cos(a) * lean);
      if (rnd(i, 6) < 0.5) L.deco(rnd(i, 7) < 0.7 ? vein : red, new THREE.ConeGeometry(0.5, h * 0.8, 4), x + 1.2, h * 0.42, z + 1.2, Math.sin(a) * lean, i, -Math.cos(a) * lean);
      if (rnd(i, 8) < 0.45) { const y = 30 + rnd(i, 9) * 40; L.deco(obs, new THREE.DodecahedronGeometry(3 + rnd(i, 10) * 4, 0), x * 0.9 + cx * 0.1, y, z * 0.9 + cz * 0.1, i, i * 2, i * 3, 1, 0.6, 1); }
    }
  }
}

// ---------------------------------------------------------------- immeubles

/** Relief d'un immeuble : soubassement, devantures, corniches, balcons, descentes d'eau, équipements de toit. */
export function detailBuilding(L: Level, x: number, z: number, w: number, d: number, h: number): void {
  const N = { collide: false };
  // soubassement et chaînes d'angle
  L.box('concrete_damaged', x, 0, z, w + 0.2, 3.3, d + 0.2, N); // soubassement en béton endommagé (Concrete 042 D)
  L.box('darkconcrete', x, 3.3, z, w + 0.5, 0.22, d + 0.5, N);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) L.box('plaster', x + sx * (w / 2 - 0.2), 3.5, z + sz * (d / 2 - 0.2), 0.7, h - 3.5, 0.7, N);
  for (let y = 12.2; y < h - 2; y += 9) L.box('darkconcrete', x, y - 0.3, z, w + 0.44, 0.24, d + 0.44, N);
  // parapet et équipements de toit
  for (const [px, pz, pw, pd] of [[x, z - d / 2 + 0.15, w, 0.3], [x, z + d / 2 - 0.15, w, 0.3], [x - w / 2 + 0.15, z, 0.3, d], [x + w / 2 - 0.15, z, 0.3, d]]) L.box('darkconcrete', px, h + 0.5, pz, pw, 0.7, pd, N);
  const r0 = rnd(Math.round(x), Math.round(z), 1), r1 = rnd(Math.round(z), Math.round(x), 2);
  L.box('metal', x + (r0 - 0.5) * w * 0.5, h + 0.5, z + (r1 - 0.5) * d * 0.5, 2.4, 1.3, 1.6, N);
  if (r0 > 0.4) { L.deco(mat('rust'), new THREE.CylinderGeometry(1.3, 1.3, 2.6, 10), x - (r1 - 0.5) * w * 0.5, h + 3.2, z + (r0 - 0.5) * d * 0.4); for (const o of [-0.8, 0.8]) L.box('trim', x - (r1 - 0.5) * w * 0.5 + o, h + 0.5, z + (r0 - 0.5) * d * 0.4, 0.14, 1.5, 0.14, N); }
  if (r1 > 0.5) L.box('trim', x + (r1 - 0.5) * w * 0.6, h + 0.5, z - (r0 - 0.5) * d * 0.6, 0.08, 5 + r0 * 4, 0.08, N);
  // façades
  for (const [ax, side] of [[true, 1], [true, -1], [false, 1], [false, -1]] as [boolean, number][]) {
    const f: Frame = { ax, x, z, len: ax ? w : d, th: ax ? d : w, h };
    const len = f.len;
    if (len < 5) continue;
    const base = ax ? x : z;
    // travées alignées sur la trame des fenêtres (3 m, calée sur le monde)
    const k0 = Math.ceil((base - len / 2 + 1.2) / 3 - 0.5), k1 = Math.floor((base + len / 2 - 1.2) / 3 - 0.5);
    for (let k = k0; k <= k1; k++) {
      const u = (k + 0.5) * 3 - base;
      const [wx, wz] = at(f, u, 0, side);
      const r = rnd(Math.round(wx * 2), Math.round(wz * 2), side + (ax ? 0 : 9));
      // devantures du rez-de-chaussée
      if (r < 0.7) {
        wbox(L, f, 'black', u, 0.3, 2.3, 2.3, 0.04, side, 0.1);
        wbox(L, f, 'trim', u, 2.6, 2.6, 0.14, 0.16, side, 0.1);
        for (const o of [-1.22, 1.22]) wbox(L, f, 'trim', u + o, 0, 0.14, 2.7, 0.14, side, 0.1);
        if (r < 0.22) { for (let p = 0; p < 4; p++) wbox(L, f, 'wood', u + (rnd(k, p) - 0.5) * 0.3, 0.5 + p * 0.5, 2.2, 0.26, 0.05, side, 0.14); }
        else if (r < 0.4) wbox(L, f, 'fabric', u, 2.74, 2.7, 0.1, 0.9, side, 0.1);
        else if (r < 0.48) { wbox(L, f, 'glow_white', u, 2.78, 1.6, 0.26, 0.05, side, 0.12); const [gx, gz] = at(f, u, f.th / 2 + 1.3, side); glowPatch(L, gx, 0.02, gz, 2.2, 0xffd9a0); }
      } else wdecal(L, f, signAtlas(), quad(1.6, 1.6, r > 0.85 ? 12 : 11, SIGN_CELLS), u, 1.6, side, 0.115);
      // balcons et climatiseurs aux étages
      for (let fl = 1; fl * 3 + 3 < h; fl++) {
        const rr = rnd(k * 7 + fl, Math.round(base) + (ax ? 3 : 5), side);
        const y = fl * 3 + 0.6;
        if (rr < 0.16) { wbox(L, f, 'darkconcrete', u, y, 2.2, 0.14, 0.9, side); wbox(L, f, 'trim', u, y + 0.14, 2.2, 0.9, 0.04, side, 0.86); for (const o of [-1.08, 1.08]) wbox(L, f, 'trim', u + o, y + 0.14, 0.04, 0.9, 0.86, side); }
        else if (rr < 0.26) wbox(L, f, 'metal', u + 0.5, y - 0.2, 0.8, 0.5, 0.4, side);
        else if (rr < 0.3) wbox(L, f, 'fabric', u, y + 1.7, 1.9, 0.08, 0.7, side);
      }
    }
    // descentes d'eau
    for (const t of [0.24, 0.76]) wpipe(L, f, -len / 2 + len * t, 0.2, -len / 2 + len * t, h, 0.1, side, 0.07, 'metal');
  }
}
