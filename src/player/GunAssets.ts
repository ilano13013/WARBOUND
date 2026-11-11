// Armes en vue subjective à partir des modèles glTF riggés (Flat Guns, Quaternius).
// Chaque modèle est normalisé : canon vers -Z, haut vers +Y, origine au point de prise de la main droite.
import * as THREE from 'three';
import { Assets } from '../assets/Assets';
import { ATTACHMENTS, type AttachSlot, type WeaponDef } from '../data/weapons';
import { cmat, mat } from '../render/Materials';

export interface GunAsset {
  root: THREE.Group;
  muzzle: THREE.Object3D;
  rightGrip: THREE.Vector3; // toujours l'origine
  leftGrip: THREE.Vector3;
  sightY: number;
  scoped: boolean;
  length: number;
  pistol: boolean;
  mag: THREE.Object3D | null; magRest: THREE.Vector3; magAttached: boolean;
  bolt: THREE.Object3D | null; boltRest: THREE.Vector3; boltAxis: THREE.Vector3; boltTravel: number;
  charging: THREE.Object3D | null; chargingRest: THREE.Vector3;
  magLocalDown: THREE.Vector3; // 1 m « vers le bas » exprimé dans l'espace parent du chargeur
  magPoint: THREE.Vector3; // point de saisie du chargeur (repère de l'arme)
  boltPoint: THREE.Vector3; // poignée de culasse / levier d'armement (repère de l'arme)
  eject: THREE.Vector3; // fenêtre d'éjection
}

// réglages fins par arme : décalages en mètres dans le repère normalisé
const TUNE: Record<string, { scale?: number; grip?: [number, number, number]; left?: [number, number, number]; flip?: boolean; boltTravel?: number }> = {
  ash: { scale: 0.16, grip: [0, -0.035, 0.06] },
  p9: { grip: [0, -0.035, 0.02] },
  frostbite: { left: [0, 0.0, 0.06], boltTravel: 0.07 },
  requiem: { left: [0, 0.0, 0.05], boltTravel: 0.05 },
  titan: { left: [0, -0.01, 0.04] },
};

const _v = new THREE.Vector3(), _box = new THREE.Box3();

/** Matériaux PBR « premium » remplaçant les aplats d'origine. */
function remapMaterials(o: THREE.Object3D, def: WeaponDef): void {
  const accent = new THREE.Color(def.look.accent);
  const cache = new Map<string, THREE.Material>();
  o.traverse((n) => {
    const m = n as THREE.Mesh;
    if (!m.isMesh) return;
    m.castShadow = true; m.frustumCulled = false;
    const conv = (src: THREE.Material): THREE.Material => {
      const k = src.name;
      let r = cache.get(k);
      if (r) return r;
      const base = (src as THREE.MeshStandardMaterial).color?.clone() || new THREE.Color(0x222222);
      const p: THREE.MeshPhysicalMaterialParameters = { color: base, roughness: 0.5, metalness: 0.4, clearcoat: 0, clearcoatRoughness: 0.4 };
      if (/Black$/.test(k)) Object.assign(p, { color: new THREE.Color(0x0e0f11), metalness: 0.85, roughness: 0.38, clearcoat: 0.35 }); // acier bronzé
      else if (/Black_Lighter/.test(k)) Object.assign(p, { color: new THREE.Color(0x17181a), metalness: 0.05, roughness: 0.62 }); // polymère
      else if (/Grey_Darker/.test(k)) Object.assign(p, { color: new THREE.Color(0x2a2c30), metalness: 0.9, roughness: 0.3, clearcoat: 0.2 });
      else if (/Grey/.test(k)) Object.assign(p, { color: new THREE.Color(0x4a4d52), metalness: 0.9, roughness: 0.28 });
      else if (/White/.test(k)) Object.assign(p, { color: accent.clone().multiplyScalar(1.4), metalness: 0.2, roughness: 0.55 });
      else if (/Brown|Wood/.test(k)) Object.assign(p, { color: accent.clone(), metalness: 0.05, roughness: 0.6, clearcoat: 0.25 });
      else if (/Red/.test(k)) Object.assign(p, { color: accent.clone(), metalness: 0.1, roughness: 0.6 });
      else if (/Brass|Yellow/.test(k)) Object.assign(p, { color: new THREE.Color(0xb8862a), metalness: 1, roughness: 0.3 });
      else if (/^Metal$|LightMetal/.test(k)) Object.assign(p, { color: new THREE.Color(k === 'Metal' ? 0x2a2b2e : 0x6a6d72), metalness: 0.95, roughness: 0.3, clearcoat: 0.3 });
      r = new THREE.MeshPhysicalMaterial(p);
      r.name = k;
      cache.set(k, r);
      return r;
    };
    m.material = Array.isArray(m.material) ? m.material.map(conv) : conv(m.material);
  });
}

function findNode(o: THREE.Object3D, re: RegExp): THREE.Object3D | null {
  let r: THREE.Object3D | null = null;
  o.traverse((n) => { if (!r && re.test(n.name)) r = n; });
  return r;
}

const geo = new Map<string, THREE.BufferGeometry>();
const G = (k: string, f: () => THREE.BufferGeometry) => { let g = geo.get(k); if (!g) { g = f(); geo.set(k, g); } return g; };
function part(parent: THREE.Object3D, g: THREE.BufferGeometry, m: THREE.Material, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0): THREE.Mesh {
  const me = new THREE.Mesh(g, m); me.position.set(x, y, z); me.rotation.set(rx, ry, rz); me.castShadow = true; parent.add(me); return me;
}

/** Construit l'arme normalisée ; null si le modèle n'est pas disponible. */
export function buildGunAsset(def: WeaponDef, attach: Partial<Record<AttachSlot, string>> = {}): GunAsset | null {
  const src = Assets.clone('weapons/' + def.id);
  if (!src) return null;
  const t = TUNE[def.id] || {};
  const pistol = def.family === 'pistol';
  remapMaterials(src, def);
  const inner = new THREE.Group();
  inner.add(src);
  if (t.scale) src.scale.setScalar(t.scale);
  src.updateMatrixWorld(true);
  // axe du canon : axe le plus long de la boîte englobante, sens donné par le point de bouche
  _box.setFromObject(src);
  const size = _box.getSize(new THREE.Vector3()), center = _box.getCenter(new THREE.Vector3());
  const axis = size.x >= size.z ? 'x' : 'z';
  const muzzleNode = findNode(src, /^Attach_Muzzle$/);
  let sign = 1;
  if (muzzleNode) { muzzleNode.getWorldPosition(_v); sign = Math.sign(_v[axis] - center[axis]) || 1; }
  else {
    // sans point de bouche : le côté le plus haut de l'arme (canon au-dessus de la poignée)
    const lo = new THREE.Box3(), hi = new THREE.Box3();
    src.traverse((n) => { const m = n as THREE.Mesh; if (!m.isMesh) return; const pos = m.geometry.attributes.position; void pos; });
    void lo; void hi;
    sign = def.id === 'ash' ? 1 : -1;
  }
  if (t.flip) sign = -sign;
  inner.rotation.y = axis === 'x' ? (sign > 0 ? Math.PI / 2 : -Math.PI / 2) : (sign > 0 ? Math.PI : 0);
  inner.updateMatrixWorld(true);
  _box.setFromObject(inner);
  const nb = _box.clone();
  const length = nb.max.z - nb.min.z;
  // points de prise
  const world = (n: THREE.Object3D | null, fallback: THREE.Vector3) => (n ? n.getWorldPosition(new THREE.Vector3()) : fallback.clone());
  const trigger = findNode(src, /^Trigger$/);
  const grip = world(trigger, new THREE.Vector3(0, nb.min.y * 0.6 + nb.max.y * 0.4, nb.max.z - length * (pistol ? 0.3 : 0.38)));
  grip.add(new THREE.Vector3(0, pistol ? -0.035 : -0.05, pistol ? 0.03 : 0.045));
  if (t.grip) grip.add(new THREE.Vector3(...t.grip));
  const railB = findNode(src, /^Attach_RailBottom$/);
  let left = world(railB, new THREE.Vector3(0, grip.y + 0.05, grip.z - length * 0.4));
  left.y -= 0.025;
  if (pistol) left = grip.clone().add(new THREE.Vector3(-0.01, -0.03, 0.01));
  else if (!railB) left.set(0, grip.y + 0.06, nb.min.z + length * 0.3);
  if (t.left) left.add(new THREE.Vector3(...t.left));
  const muzzleW = muzzleNode ? muzzleNode.getWorldPosition(new THREE.Vector3()) : new THREE.Vector3(0, nb.max.y - (nb.max.y - nb.min.y) * 0.25, nb.min.z);
  // ligne de visée : haut des organes de visée, ou du rail de lunette
  const rear = findNode(src, /^Rear_Sights$/), scopeN = findNode(src, /^Attach_Scope$/);
  let sightY = rear ? world(rear, new THREE.Vector3()).y + 0.006 : scopeN ? world(scopeN, new THREE.Vector3()).y + 0.03 : nb.max.y;
  // hauteur réelle du dessus de la carcasse sous le rail de lunette (lancer de rayon vertical sur le maillage)
  const topAt = (z: number): number | null => {
    const rc = new THREE.Raycaster(new THREE.Vector3(0, nb.max.y + 0.5, z), new THREE.Vector3(0, -1, 0));
    const hits = rc.intersectObject(inner, true);
    return hits.length ? hits[0].point.y : null;
  };
  // recentrage : origine = prise main droite
  const root = new THREE.Group();
  root.add(inner);
  inner.position.sub(grip);
  const off = grip.clone().negate();
  left.add(off); muzzleW.add(off); sightY += off.y;
  const scopeMount = scopeN ? world(scopeN, new THREE.Vector3()).add(off) : new THREE.Vector3(0, sightY - 0.02, -length * 0.25);
  root.updateMatrixWorld(true);
  { const ty = topAt(scopeMount.z); if (ty !== null) scopeMount.y = ty; }
  const muzzle = new THREE.Object3D(); muzzle.position.copy(muzzleW); root.add(muzzle);
  // accessoires (montés aux points d'attache du modèle)
  let scoped = def.family === 'sniper';
  const dark = cmat(0x111214, 0.45, 0.7), steel = cmat(0x3c3f44, 0.3, 0.9);
  const optic = attach.optic || (def.family === 'sniper' ? 'longscope' : undefined);
  if (optic === 'reflex') {
    const y = scopeMount.y, z = scopeMount.z - 0.02;
    part(root, G('rx1', () => new THREE.BoxGeometry(0.03, 0.012, 0.06)), dark, 0, y + 0.006, z);
    for (const s of [-1, 1]) part(root, G('rx2', () => new THREE.BoxGeometry(0.004, 0.038, 0.01)), dark, s * 0.016, y + 0.03, z - 0.02);
    part(root, G('rx3', () => new THREE.BoxGeometry(0.036, 0.005, 0.01)), dark, 0, y + 0.05, z - 0.02);
    const lens = part(root, G('rx4', () => new THREE.PlaneGeometry(0.028, 0.032)), new THREE.MeshBasicMaterial({ color: 0x60c0ff, transparent: true, opacity: 0.14, depthWrite: false }), 0, y + 0.03, z - 0.02);
    part(lens, G('rx5', () => new THREE.CircleGeometry(0.0016, 10)), new THREE.MeshBasicMaterial({ color: 0xff3020 }), 0, 0, 0.001);
    sightY = y + 0.03;
  } else if (optic === 'acog' || optic === 'longscope') {
    const long = optic === 'longscope';
    const len = long ? 0.3 : 0.16, y = scopeMount.y + 0.045, z = scopeMount.z - 0.02;
    part(root, G('sc' + len, () => new THREE.CylinderGeometry(0.021, 0.021, len, 16)), dark, 0, y, z, Math.PI / 2);
    part(root, G('sc-f', () => new THREE.CylinderGeometry(0.028, 0.022, 0.06, 16)), dark, 0, y, z - len / 2, Math.PI / 2);
    part(root, G('sc-r', () => new THREE.CylinderGeometry(0.025, 0.021, 0.04, 16)), dark, 0, y, z + len / 2, Math.PI / 2);
    part(root, G('sc-l', () => new THREE.CircleGeometry(0.026, 16)), new THREE.MeshPhysicalMaterial({ color: 0x2a5aa0, metalness: 0.2, roughness: 0.05, clearcoat: 1 }), 0, y, z - len / 2 - 0.031, 0, Math.PI);
    for (const dz of [-len * 0.25, len * 0.25]) part(root, G('sc-m', () => new THREE.BoxGeometry(0.022, 0.045, 0.018)), dark, 0, y - 0.03, z + dz);
    part(root, G('sc-t', () => new THREE.CylinderGeometry(0.009, 0.009, 0.022, 10)), steel, 0, y + 0.03, z);
    sightY = y; scoped = scoped || long;
  }
  if (attach.muzzle === 'silencer') { part(root, G('sil', () => new THREE.CylinderGeometry(0.02, 0.02, 0.17, 16)), dark, 0, muzzle.position.y, muzzle.position.z - 0.08, Math.PI / 2); muzzle.position.z -= 0.17; }
  if (attach.muzzle === 'compensator') { part(root, G('comp', () => new THREE.CylinderGeometry(0.016, 0.016, 0.05, 6)), steel, 0, muzzle.position.y, muzzle.position.z - 0.02, Math.PI / 2); muzzle.position.z -= 0.05; }
  if (attach.muzzle === 'heavybarrel') { part(root, G('hb', () => new THREE.CylinderGeometry(0.018, 0.018, 0.1, 12)), steel, 0, muzzle.position.y, muzzle.position.z - 0.04, Math.PI / 2); muzzle.position.z -= 0.09; }
  if (attach.grip === 'vgrip' && !pistol) { part(root, G('vg', () => new THREE.CylinderGeometry(0.013, 0.016, 0.085, 10)), dark, left.x, left.y - 0.035, left.z); left.y -= 0.06; }
  if (attach.grip === 'agrip' && !pistol) { part(root, G('ag', () => new THREE.BoxGeometry(0.026, 0.03, 0.09)), dark, left.x, left.y - 0.012, left.z, 0.35); left.y -= 0.02; }
  if (attach.arcane && ATTACHMENTS[attach.arcane]) {
    const col = attach.arcane === 'emberCore' ? 'glow_orange' : attach.arcane === 'stormCoil' ? 'glow_blue' : 'glow_violet';
    for (const s of [-1, 1]) part(root, G('arc' + pistol, () => new THREE.BoxGeometry(0.003, 0.01, pistol ? 0.08 : 0.2)), mat(col), s * (pistol ? 0.017 : 0.024), 0.03, pistol ? -0.05 : -0.12);
  }
  // pièces mobiles
  const mag = findNode(src, /^Magazine$/);
  if (mag && attach.mag === 'extmag') mag.scale.set(1, 1.35, 1);
  const bolt = findNode(src, /^(Slide|Bolt)$/), charging = findNode(src, /^Charging_Handle$/);
  // direction de recul de la culasse : vers l'arrière (+Z normalisé), exprimée dans l'espace parent de l'os
  const boltAxis = new THREE.Vector3();
  if (bolt && bolt.parent) {
    root.updateMatrixWorld(true);
    const a = bolt.parent.worldToLocal(root.localToWorld(new THREE.Vector3(0, 0, 0)));
    const b = bolt.parent.worldToLocal(root.localToWorld(new THREE.Vector3(0, 0, 1)));
    boltAxis.subVectors(b, a);
  }
  const magLocalDown = new THREE.Vector3(0, -1, 0);
  if (mag && mag.parent) {
    root.updateMatrixWorld(true);
    const a = mag.parent.worldToLocal(root.localToWorld(new THREE.Vector3(0, 0, 0)));
    const b = mag.parent.worldToLocal(root.localToWorld(new THREE.Vector3(0, -1, 0)));
    magLocalDown.subVectors(b, a);
  }
  root.updateMatrixWorld(true);
  const toLocal = (n: THREE.Object3D | null, fb: THREE.Vector3) => (n ? root.worldToLocal(n.getWorldPosition(new THREE.Vector3())) : fb);
  const magPoint = toLocal(mag, new THREE.Vector3(0, -0.08, -0.06)).add(new THREE.Vector3(-0.01, pistol ? -0.06 : -0.09, 0));
  const boltPoint = toLocal(charging || bolt, new THREE.Vector3(0.03, sightY - 0.04, -0.05)).add(new THREE.Vector3(0.035, -0.005, 0));
  const eject = toLocal(bolt, new THREE.Vector3(0.02, sightY - 0.05, -0.06)).add(new THREE.Vector3(0.02, 0.0, 0));
  return {
    root, muzzle, rightGrip: new THREE.Vector3(), leftGrip: left, sightY, scoped, length, pistol,
    mag, magRest: mag ? mag.position.clone() : new THREE.Vector3(), magAttached: true,
    bolt, boltRest: bolt ? bolt.position.clone() : new THREE.Vector3(), boltAxis, boltTravel: t.boltTravel ?? (pistol ? 0.03 : 0.04),
    charging, chargingRest: charging ? charging.position.clone() : new THREE.Vector3(), magLocalDown, magPoint, boltPoint, eject,
  };
}

/** Arme portée par un ennemi : le même modèle, à l'échelle, sans accessoires. */
export function buildEnemyGun(id = 'enemy_rifle'): { root: THREE.Group; muzzle: THREE.Object3D } | null {
  const src = Assets.clone('weapons/' + id);
  if (!src) return null;
  remapMaterials(src, { look: { accent: 0x3a3028 } } as WeaponDef);
  const root = new THREE.Group(); root.add(src);
  src.updateMatrixWorld(true);
  _box.setFromObject(src);
  const size = _box.getSize(new THREE.Vector3()), center = _box.getCenter(new THREE.Vector3());
  const axis = size.x >= size.z ? 'x' : 'z';
  const mz = findNode(src, /^Attach_Muzzle$/);
  let sign = 1; if (mz) { mz.getWorldPosition(_v); sign = Math.sign(_v[axis] - center[axis]) || 1; }
  src.rotation.y = axis === 'x' ? (sign > 0 ? Math.PI / 2 : -Math.PI / 2) : (sign > 0 ? Math.PI : 0);
  src.updateMatrixWorld(true);
  const trig = findNode(src, /^Trigger$/);
  const grip = trig ? trig.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, -0.05, 0.045)) : new THREE.Vector3();
  src.position.sub(grip);
  root.updateMatrixWorld(true);
  const muzzle = new THREE.Object3D();
  if (mz) mz.getWorldPosition(muzzle.position); else muzzle.position.set(0, 0.05, -0.5);
  root.add(muzzle);
  return { root, muzzle };
}
