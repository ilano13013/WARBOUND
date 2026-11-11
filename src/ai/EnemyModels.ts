// Modèles 3D procéduraux des ennemis : silhouettes distinctes par archétype, articulées pour l'animation.
import * as THREE from 'three';
import { cmat, mat } from '../render/Materials';
import type { EnemyKind } from '../data/enemies';

const geos = new Map<string, THREE.BufferGeometry>();
function G<T extends THREE.BufferGeometry>(k: string, f: () => T): T {
  let g = geos.get(k);
  if (!g) { g = f(); (g as any).__shared = true; geos.set(k, g); }
  return g as T;
}
export const box = (w: number, h: number, d: number) => G(`b${w},${h},${d}`, () => new THREE.BoxGeometry(w, h, d));
export const cyl = (a: number, b: number, h: number, s = 8) => G(`c${a},${b},${h},${s}`, () => new THREE.CylinderGeometry(a, b, h, s));
export const sph = (r: number, w = 10, h = 8) => G(`s${r},${w},${h}`, () => new THREE.SphereGeometry(r, w, h));
export const oct = (r: number) => G(`o${r}`, () => new THREE.OctahedronGeometry(r, 0));
export const cone = (r: number, h: number, s = 8) => G(`k${r},${h},${s}`, () => new THREE.ConeGeometry(r, h, s));

export function add(parent: THREE.Object3D, geo: THREE.BufferGeometry, m: THREE.Material, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0): THREE.Mesh {
  const mesh = new THREE.Mesh(geo, m);
  mesh.position.set(x, y, z); mesh.rotation.set(rx, ry, rz);
  mesh.castShadow = true;
  parent.add(mesh);
  return mesh;
}
export function pivot(parent: THREE.Object3D, x: number, y: number, z: number): THREE.Group {
  const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); return g;
}

export interface EnemyModel {
  root: THREE.Group;
  body: THREE.Object3D; // partie supérieure (inclinaison, recul)
  head: THREE.Object3D | null;
  legL: THREE.Object3D | null; legR: THREE.Object3D | null;
  armL: THREE.Object3D | null; armR: THREE.Object3D | null;
  extra: THREE.Object3D[]; // éléments animés spécifiques (rotors, cristaux, pattes)
  muzzle: THREE.Object3D;
  shield: THREE.Object3D | null;
  marker: THREE.Sprite;
}

export function markerSprite(): THREE.Sprite {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const x = c.getContext('2d')!;
  x.strokeStyle = '#fff'; x.lineWidth = 6; x.translate(32, 32); x.rotate(Math.PI / 4); x.strokeRect(-14, -14, 28, 28);
  x.fillStyle = '#fff'; x.fillRect(-4, -4, 8, 8);
  const t = new THREE.CanvasTexture(c);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, color: 0xff3a5a, depthTest: false, transparent: true, fog: false }));
  s.scale.setScalar(0.45); s.visible = false; s.renderOrder = 20;
  return s;
}

function humanoid(o: { cloth: number; armor: number; eye: number; bulk?: number; helmet?: boolean; gunLen?: number }): EnemyModel {
  const root = new THREE.Group();
  const k = o.bulk ?? 1;
  const cloth = cmat(o.cloth, 0.9, 0), armor = cmat(o.armor, 0.5, 0.5), dark = cmat(0x121416, 0.6, 0.4);
  const eye = cmat(0x050505, 0.4, 0, o.eye, 3);
  const hips = pivot(root, 0, 0.95, 0);
  const legL = pivot(hips, -0.13 * k, 0, 0), legR = pivot(hips, 0.13 * k, 0, 0);
  for (const l of [legL, legR]) {
    add(l, box(0.17 * k, 0.48, 0.19 * k), cloth, 0, -0.24, 0);
    add(l, box(0.15 * k, 0.46, 0.17 * k), cloth, 0, -0.68, 0.01);
    add(l, box(0.17 * k, 0.1, 0.28), dark, 0, -0.9, -0.04);
    add(l, box(0.19 * k, 0.14, 0.2 * k), armor, 0, -0.48, -0.02); // genouillère
  }
  const body = pivot(hips, 0, 0, 0);
  add(body, box(0.42 * k, 0.24, 0.24 * k), cloth, 0, 0.1, 0);
  add(body, box(0.48 * k, 0.42, 0.3 * k), armor, 0, 0.42, 0); // gilet
  add(body, box(0.36 * k, 0.2, 0.08), dark, 0, 0.34, -0.17); // poches
  add(body, box(0.3 * k, 0.34, 0.12), dark, 0, 0.44, 0.2); // sac
  const head = pivot(body, 0, 0.72, 0);
  add(head, box(0.2, 0.22, 0.22), cmat(0x6a5a52, 0.8, 0), 0, 0.06, 0);
  if (o.helmet !== false) { add(head, sph(0.16, 10, 6), armor, 0, 0.13, 0.01); add(head, box(0.3, 0.03, 0.3), armor, 0, 0.1, 0); }
  add(head, box(0.2, 0.06, 0.04), eye, 0, 0.08, -0.115); // visière lumineuse
  add(head, box(0.21, 0.09, 0.1), dark, 0, -0.01, -0.08); // masque
  const armL = pivot(body, -0.3 * k, 0.56, 0), armR = pivot(body, 0.3 * k, 0.56, 0);
  for (const a of [armL, armR]) {
    add(a, box(0.14 * k, 0.16, 0.18 * k), armor, 0, 0.02, 0);
    add(a, box(0.12 * k, 0.34, 0.13 * k), cloth, 0, -0.2, 0);
    add(a, box(0.11 * k, 0.32, 0.12 * k), cloth, 0, -0.5, -0.02);
    add(a, box(0.1, 0.1, 0.1), dark, 0, -0.7, -0.02);
  }
  // fusil tenu devant
  const gun = pivot(body, 0.12, 0.38, -0.32);
  const gl = o.gunLen ?? 0.7;
  add(gun, box(0.05, 0.09, gl * 0.55), dark, 0, 0, 0);
  add(gun, cyl(0.014, 0.014, gl * 0.5, 6), cmat(0x3a3e44, 0.3, 0.9), 0, 0.01, -gl * 0.5, Math.PI / 2);
  add(gun, box(0.035, 0.14, 0.05), dark, 0, -0.1, -0.04, -0.2);
  add(gun, box(0.04, 0.08, 0.2), dark, 0, -0.01, gl * 0.36);
  const muzzle = pivot(gun, 0, 0.01, -gl * 0.78);
  armR.rotation.set(-1.15, 0, -0.15); armL.rotation.set(-1.25, 0, 0.55);
  const marker = markerSprite(); marker.position.y = 2.2; root.add(marker);
  return { root, body, head, legL, legR, armL, armR, extra: [], muzzle, shield: null, marker };
}

export { humanoid };

export function buildEnemyModel(kind: EnemyKind | 'wolf' | 'meddrone'): EnemyModel {
  switch (kind) {
    case 'grunt': {
      const m = humanoid({ cloth: 0x2e3328, armor: 0x23262a, eye: 0x9a4aff });
      add(m.body, oct(0.12), mat('crystal'), -0.26, 0.74, 0.02, 0.3, 0.2, 0.4);
      add(m.body, oct(0.07), mat('crystal'), -0.16, 0.8, 0.12, 0.6, 0.1, -0.3);
      return m;
    }
    case 'sniper': {
      const m = humanoid({ cloth: 0x3a3a2a, armor: 0x2a2c24, eye: 0xff2a2a, bulk: 0.9, helmet: false, gunLen: 1.15 });
      add(m.head!, cone(0.2, 0.3, 6), mat('fabric'), 0, 0.2, 0.03);
      add(m.body, box(0.56, 0.6, 0.06), mat('fabric'), 0, 0.3, 0.24, 0.12);
      add(m.muzzle.parent!, cyl(0.03, 0.03, 0.26, 8), cmat(0x111214, 0.4, 0.6), 0, 0.085, -0.05, Math.PI / 2);
      return m;
    }
    case 'breaker': {
      const m = humanoid({ cloth: 0x26282c, armor: 0x3a3e46, eye: 0xff7a2a, bulk: 1.3, gunLen: 0.55 });
      add(m.head!, box(0.3, 0.3, 0.3), cmat(0x3a3e46, 0.4, 0.7), 0, 0.08, 0.02);
      add(m.head!, box(0.22, 0.05, 0.02), cmat(0x050505, 0.4, 0, 0xff7a2a, 3), 0, 0.08, -0.16);
      const sh = pivot(m.body, -0.2, 0.3, -0.48);
      add(sh, box(0.85, 1.35, 0.07), cmat(0x2c3038, 0.35, 0.8), 0, 0, 0);
      add(sh, box(0.5, 0.1, 0.02), mat('glass'), 0, 0.4, -0.04);
      add(sh, box(0.87, 0.06, 0.09), mat('hazard'), 0, -0.55, 0);
      add(sh, box(0.06, 0.9, 0.02), mat('glow_orange'), 0, -0.1, -0.045);
      m.shield = sh;
      m.armL!.rotation.set(-1.3, 0, 0.2);
      m.marker.position.y = 2.5;
      return m;
    }
    case 'caster': {
      const m = humanoid({ cloth: 0x2a1e3e, armor: 0x3a2a5a, eye: 0xb06aff, bulk: 0.95, helmet: false, gunLen: 0.01 });
      m.muzzle.parent!.visible = false;
      add(m.root, cone(0.42, 0.95, 8), cmat(0x2a1e3e, 0.9, 0), 0, 0.5, 0);
      add(m.head!, cone(0.22, 0.36, 6), cmat(0x1e1430, 0.9, 0), 0, 0.22, 0.03);
      const staff = pivot(m.body, 0.38, 0.2, -0.25);
      add(staff, cyl(0.02, 0.025, 1.7, 6), cmat(0x1a1420, 0.6, 0.4), 0, 0, 0);
      const cr = add(staff, oct(0.14), mat('crystal'), 0, 0.95, 0);
      m.extra.push(cr);
      m.muzzle = pivot(staff, 0, 0.95, 0);
      for (let i = 0; i < 3; i++) { const c = add(m.root, oct(0.07), mat('crystal'), 0, 1.5, 0); m.extra.push(c); }
      m.armR!.rotation.set(-1.0, 0, -0.5);
      m.armL!.rotation.set(-0.3, 0, 0.3);
      return m;
    }
    case 'commander': {
      const m = humanoid({ cloth: 0x1c1e22, armor: 0x4a1a1a, eye: 0xff2a2a, bulk: 1.12 });
      add(m.body, box(0.6, 0.9, 0.04), cmat(0x5a1414, 0.9, 0), 0, 0.2, 0.26, 0.15); // cape
      add(m.body, cyl(0.008, 0.008, 0.7, 4), cmat(0x111, 0.5, 0.5), 0.12, 0.95, 0.22);
      add(m.body, box(0.03, 0.03, 0.03), mat('glow_red'), 0.12, 1.3, 0.22);
      for (const s of [-1, 1]) add(m.body, box(0.2, 0.08, 0.26), cmat(0x7a2020, 0.4, 0.6), s * 0.33, 0.66, 0);
      const ring = new THREE.Mesh(G('ring-aura', () => { const g = new THREE.RingGeometry(0.9, 1, 40); g.rotateX(-Math.PI / 2); return g; }), new THREE.MeshBasicMaterial({ color: 0xff3a2a, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
      ring.position.y = 0.06; ring.scale.setScalar(1.2); m.root.add(ring); m.extra.push(ring);
      m.marker.position.y = 2.4;
      return m;
    }
    case 'sentinel': {
      const root = new THREE.Group();
      const stone = mat('stone'), rune = mat('rune');
      const hips = pivot(root, 0, 1.0, 0);
      const legL = pivot(hips, -0.22, 0, 0), legR = pivot(hips, 0.22, 0, 0);
      for (const l of [legL, legR]) { add(l, box(0.26, 0.55, 0.28), stone, 0, -0.28, 0); add(l, box(0.3, 0.5, 0.32), rune, 0, -0.75, 0); }
      const body = pivot(hips, 0, 0, 0);
      add(body, box(0.8, 0.75, 0.5), stone, 0, 0.45, 0);
      add(body, box(1.0, 0.3, 0.55), rune, 0, 0.85, 0);
      const core = add(body, oct(0.2), mat('crystal'), 0, 0.5, -0.24);
      const head = pivot(body, 0, 1.1, 0);
      add(head, box(0.3, 0.34, 0.3), stone, 0, 0.1, 0);
      add(head, box(0.22, 0.05, 0.02), mat('glow_violet'), 0, 0.12, -0.16);
      add(head, cone(0.1, 0.35, 4), mat('crystal'), 0, 0.42, 0);
      const armL = pivot(body, -0.62, 0.85, 0), armR = pivot(body, 0.62, 0.85, 0);
      add(armL, box(0.24, 0.9, 0.26), stone, 0, -0.45, 0); add(armL, box(0.3, 0.3, 0.3), rune, 0, -0.95, 0);
      add(armR, box(0.24, 0.9, 0.26), stone, 0, -0.45, 0);
      add(armR, box(0.08, 1.5, 0.22), mat('crystal'), 0, -1.3, -0.1, 0.5); // lame
      const marker = markerSprite(); marker.position.y = 2.9; root.add(marker);
      return { root, body, head, legL, legR, armL, armR, extra: [core], muzzle: pivot(body, 0, 0.5, -0.4), shield: null, marker };
    }
    case 'devourer':
    case 'wolf': {
      const root = new THREE.Group();
      const wolf = kind === 'wolf';
      const skin = wolf ? new THREE.MeshStandardMaterial({ color: 0x9af0d0, emissive: 0x4ad0b0, emissiveIntensity: 1.2, transparent: true, opacity: 0.6, roughness: 0.3 }) : mat('chitin');
      const glow = wolf ? mat('glow_green') : mat('glow_violet');
      const body = pivot(root, 0, 0.62, 0);
      const torso = add(body, sph(0.36, 10, 8), skin, 0, 0, 0.05); torso.scale.set(0.85, 0.8, 1.6);
      const head = pivot(body, 0, 0.1, -0.62);
      const hd = add(head, sph(0.24, 8, 6), skin, 0, 0, 0); hd.scale.set(0.9, 0.8, 1.25);
      add(head, box(0.3, 0.04, 0.3), glow, 0, -0.07, -0.12); // gueule lumineuse
      for (const s of [-1, 1]) { add(head, cone(0.03, 0.14, 4), mat('bone'), s * 0.1, -0.13, -0.26, Math.PI); add(head, box(0.05, 0.03, 0.02), glow, s * 0.1, 0.07, -0.26); }
      if (!wolf) for (let i = 0; i < 4; i++) add(body, cone(0.06, 0.34 - i * 0.04, 4), mat('bone'), 0, 0.3, -0.25 + i * 0.22, -0.4);
      else { add(head, cone(0.05, 0.16, 4), skin, -0.1, 0.2, 0.05); add(head, cone(0.05, 0.16, 4), skin, 0.1, 0.2, 0.05); }
      const legs: THREE.Object3D[] = [];
      for (const [x, z] of [[-0.24, -0.35], [0.24, -0.35], [-0.24, 0.45], [0.24, 0.45]]) {
        const l = pivot(body, x, -0.05, z);
        add(l, box(0.1, 0.36, 0.12), skin, 0, -0.17, 0, 0.3);
        add(l, box(0.08, 0.34, 0.1), skin, 0, -0.43, 0.04, -0.4);
        if (!wolf) add(l, cone(0.04, 0.12, 4), mat('bone'), 0, -0.6, -0.04, Math.PI);
        legs.push(l);
      }
      const tail = add(body, cone(0.08, 0.6, 5), skin, 0, 0.08, 0.85, -1.3);
      const marker = markerSprite(); marker.position.y = 1.5; root.add(marker);
      return { root, body, head, legL: null, legR: null, armL: null, armR: null, extra: [...legs, tail], muzzle: pivot(head, 0, 0, -0.3), shield: null, marker };
    }
    case 'drone':
    case 'meddrone': {
      const root = new THREE.Group();
      const med = kind === 'meddrone';
      const sc = med ? 0.55 : 1;
      const body = pivot(root, 0, 0, 0);
      body.scale.setScalar(sc);
      const shell = cmat(med ? 0xd8e0d8 : 0x2a2e34, 0.4, 0.7);
      const b = add(body, sph(0.3, 12, 8), shell, 0, 0, 0); b.scale.set(1, 0.6, 1.2);
      add(body, sph(0.11, 8, 6), med ? mat('glow_green') : mat('glow_red'), 0, -0.02, -0.3);
      const rotors: THREE.Object3D[] = [];
      for (const [x, z] of [[-0.42, -0.3], [0.42, -0.3], [-0.42, 0.3], [0.42, 0.3]]) {
        add(body, box(0.05, 0.03, 0.05), shell, x * 0.6, 0.04, z * 0.6);
        add(body, cyl(0.02, 0.02, 0.1, 5), shell, x, 0.08, z);
        const r = add(body, cyl(0.2, 0.2, 0.01, 12), new THREE.MeshBasicMaterial({ color: med ? 0x8affc0 : 0x8090a0, transparent: true, opacity: 0.3, depthWrite: false }), x, 0.14, z);
        r.castShadow = false; rotors.push(r);
      }
      if (!med) { add(body, box(0.08, 0.1, 0.34), cmat(0x15171a, 0.5, 0.6), 0, -0.2, -0.1); add(body, box(0.3, 0.02, 0.02), mat('glow_red'), 0, 0.06, -0.33); }
      else add(body, box(0.14, 0.14, 0.02), mat('glow_green'), 0, 0.02, 0.36);
      const marker = markerSprite(); marker.position.y = 0.7; root.add(marker);
      return { root, body, head: null, legL: null, legR: null, armL: null, armR: null, extra: rotors, muzzle: pivot(body, 0, -0.2, -0.3), shield: null, marker };
    }
  }
  // boss : le modèle est fourni par la classe du boss
  const root = new THREE.Group();
  const marker = markerSprite(); root.add(marker);
  return { root, body: root, head: null, legL: null, legR: null, armL: null, armR: null, extra: [], muzzle: pivot(root, 0, 1.5, 0), shield: null, marker };
}

/** Modèle d'opérateur allié (écran de sélection de classe, PNJ du QG). */
export function buildOperatorModel(color: number): THREE.Group {
  const m = humanoid({ cloth: 0x3a4232, armor: 0x23272c, eye: color, bulk: 1.02 });
  add(m.body, box(0.5, 0.04, 0.32), cmat(0x050505, 0.4, 0, color, 2.5), 0, 0.3, 0);
  for (const s of [-1, 1]) add(m.body, box(0.16, 0.05, 0.2), cmat(0x050505, 0.4, 0, color, 2.5), s * 0.3, 0.66, 0);
  add(m.body, box(0.12, 0.12, 0.02), cmat(0x050505, 0.4, 0, color, 3), 0, 0.5, -0.16);
  m.marker.removeFromParent();
  return m.root;
}
