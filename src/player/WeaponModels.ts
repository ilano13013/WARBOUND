// Modèles 3D procéduraux des armes : une silhouette par famille, des variations par arme et des accessoires visibles.
import * as THREE from 'three';
import { cmat, mat } from '../render/Materials';
import { ATTACHMENTS, type AttachSlot, type WeaponDef } from '../data/weapons';

const geoCache = new Map<string, THREE.BufferGeometry>();
function bg(w: number, h: number, d: number): THREE.BufferGeometry {
  const k = `b${w}|${h}|${d}`;
  let g = geoCache.get(k);
  if (!g) { g = new THREE.BoxGeometry(w, h, d); (g as any).__shared = true; geoCache.set(k, g); }
  return g;
}
function cg(r1: number, r2: number, h: number, seg = 10): THREE.BufferGeometry {
  const k = `c${r1}|${r2}|${h}|${seg}`;
  let g = geoCache.get(k);
  if (!g) { g = new THREE.CylinderGeometry(r1, r2, h, seg); (g as any).__shared = true; geoCache.set(k, g); }
  return g;
}

function part(parent: THREE.Object3D, geo: THREE.BufferGeometry, m: THREE.Material, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0): THREE.Mesh {
  const mesh = new THREE.Mesh(geo, m);
  mesh.position.set(x, y, z); mesh.rotation.set(rx, ry, rz);
  parent.add(mesh);
  return mesh;
}

export interface WeaponModel {
  group: THREE.Group;
  muzzle: THREE.Object3D;
  mag: THREE.Object3D | null;
  sightY: number; // hauteur de la ligne de visée
  scoped: boolean;
}

const r2 = (n: number) => Math.round(n * 1000) / 1000;

/** Construit le modèle d'une arme avec ses accessoires. L'origine est à la poignée, canon vers -Z. */
export function buildWeaponModel(def: WeaponDef, attach: Partial<Record<AttachSlot, string>> = {}, withArms = true): WeaponModel {
  const g = new THREE.Group();
  const L = def.look;
  const body = cmat(L.tint, 0.45, 0.7);
  const accent = cmat(L.accent, 0.6, 0.3);
  const dark = cmat(0x15171a, 0.5, 0.6);
  const steel = cmat(0x4a4e54, 0.3, 0.9);
  let muzzleZ = 0, sightY = 0.07, magObj: THREE.Object3D | null = null, scoped = false;
  const bh = L.body;
  const fam = def.family;

  if (fam === 'pistol') {
    const rev = def.id === 'ash';
    part(g, bg(0.03, 0.11, 0.045), accent, 0, -0.045, 0.02, 0.22); // poignée
    if (rev) {
      part(g, bg(0.032, 0.05, 0.1), body, 0, 0.02, -0.03);
      part(g, cg(0.027, 0.027, 0.055, 8), steel, 0, 0.022, -0.045, Math.PI / 2);
      part(g, cg(0.012, 0.012, r2(L.barrel + 0.06), 8), steel, 0, 0.034, r2(-0.1 - L.barrel / 2), Math.PI / 2);
      part(g, bg(0.014, 0.022, r2(L.barrel + 0.04)), body, 0, 0.012, r2(-0.1 - L.barrel / 2));
      part(g, bg(0.01, 0.03, 0.02), dark, 0, 0.05, 0.028, -0.5); // chien
      part(g, bg(0.008, 0.014, 0.01), mat('glow_orange'), 0, 0.052, r2(-0.1 - L.barrel));
      muzzleZ = -0.13 - L.barrel; sightY = 0.058;
    } else {
      part(g, bg(0.032, 0.04, r2(L.len)), body, 0, 0.03, -0.06); // culasse
      part(g, bg(0.03, 0.028, r2(L.len * 0.85)), dark, 0, 0.0, -0.05);
      part(g, bg(0.006, 0.01, 0.012), mat('glow_green'), 0, 0.054, 0.03);
      part(g, bg(0.006, 0.012, 0.008), dark, 0, 0.055, -0.15);
      const m = part(g, bg(0.024, 0.1, 0.034), dark, 0, -0.05, 0.022, 0.22); magObj = m;
      part(g, bg(0.012, 0.03, 0.05), dark, 0, -0.02, -0.03); // pontet
      muzzleZ = -0.06 - L.len / 2; sightY = 0.062;
    }
  } else {
    const recLen = fam === 'smg' ? 0.26 : fam === 'lmg' ? 0.4 : fam === 'sniper' ? 0.36 : 0.32;
    // boîtier
    part(g, bg(0.045, r2(bh), recLen), body, 0, 0.02, r2(-recLen / 2 + 0.06));
    part(g, bg(0.03, 0.02, r2(recLen * 0.9)), dark, 0, r2(0.02 + bh / 2 + 0.008), r2(-recLen / 2 + 0.06)); // rail
    // poignée pistolet
    part(g, bg(0.032, 0.1, 0.042), accent, 0, -0.05, 0.03, 0.3);
    part(g, bg(0.01, 0.03, 0.06), dark, 0, -0.025, -0.02);
    // garde-main
    const hgLen = r2(L.len - recLen - (fam === 'sniper' ? 0.1 : 0));
    const hgZ = r2(-recLen + 0.06 - hgLen / 2);
    if (fam === 'lmg') {
      part(g, bg(0.05, 0.05, hgLen), accent, 0, 0.012, hgZ);
      for (let i = 0; i < 5; i++) part(g, bg(0.054, 0.008, 0.02), dark, 0, 0.04, r2(hgZ - hgLen / 2 + 0.03 + i * (hgLen - 0.06) / 4));
    } else if (fam === 'sniper') {
      part(g, bg(0.04, 0.045, hgLen), accent, 0, 0.008, hgZ);
    } else {
      part(g, bg(0.042, 0.05, hgLen), accent, 0, 0.018, hgZ);
      for (const s of [-1, 1]) for (let i = 0; i < 3; i++) part(g, bg(0.004, 0.012, r2(hgLen * 0.2)), dark, s * 0.022, 0.02, r2(hgZ - hgLen * 0.3 + i * hgLen * 0.3));
    }
    // canon
    const bz = r2(-recLen + 0.06 - hgLen);
    const br = fam === 'sniper' ? 0.013 : fam === 'lmg' ? 0.015 : 0.011;
    part(g, cg(br, br, r2(L.barrel), 8), steel, 0, 0.025, r2(bz - L.barrel / 2 + 0.04), Math.PI / 2);
    muzzleZ = bz - L.barrel + 0.04;
    if (fam === 'sniper') part(g, bg(0.04, 0.03, 0.06), dark, 0, 0.025, r2(muzzleZ + 0.03)); // frein de bouche
    else part(g, cg(0.016, 0.014, 0.04, 8), dark, 0, 0.025, r2(muzzleZ + 0.02), Math.PI / 2);
    // crosse
    if (L.stock > 0) {
      if (fam === 'smg') {
        part(g, bg(0.012, 0.012, r2(L.stock)), steel, 0.018, 0.03, r2(0.06 + L.stock / 2));
        part(g, bg(0.012, 0.012, r2(L.stock)), steel, -0.018, 0.03, r2(0.06 + L.stock / 2));
        part(g, bg(0.05, 0.08, 0.02), dark, 0, 0.01, r2(0.06 + L.stock));
      } else {
        part(g, bg(0.03, 0.035, r2(L.stock * 0.6)), dark, 0, 0.025, r2(0.06 + L.stock * 0.3));
        part(g, bg(0.04, fam === 'sniper' ? 0.11 : 0.09, r2(L.stock * 0.5)), accent, 0, 0.0, r2(0.06 + L.stock * 0.75));
        part(g, bg(0.042, 0.1, 0.015), dark, 0, 0.0, r2(0.06 + L.stock));
      }
    }
    // chargeur
    if (fam === 'lmg') {
      const m = part(g, bg(0.09, 0.1, 0.11), accent, -0.02, -0.06, -0.1); magObj = m;
      part(m, bg(0.092, 0.02, 0.112), dark, 0, 0.03, 0);
      // bipied replié
      for (const s of [-1, 1]) part(g, cg(0.005, 0.005, 0.2, 5), steel, s * 0.02, -0.012, r2(hgZ - hgLen * 0.2), Math.PI / 2);
    } else {
      const ml = r2(L.magLen);
      const m = part(g, bg(0.026, ml, fam === 'smg' ? 0.035 : 0.055), dark, 0, r2(-0.01 - ml / 2), fam === 'smg' ? -0.05 : -0.09, fam === 'ar' ? -0.16 : 0); magObj = m;
    }
    if (fam === 'sniper') {
      part(g, cg(0.006, 0.006, 0.06, 6), steel, 0.04, 0.03, 0.0, 0, 0, Math.PI / 2); // levier
      part(g, cg(0.011, 0.011, 0.012, 6), dark, 0.07, 0.03, 0.0, 0, 0, Math.PI / 2);
      for (const s of [-1, 1]) part(g, cg(0.005, 0.005, 0.22, 5), steel, s * 0.03, -0.03, r2(hgZ - hgLen * 0.3), Math.PI / 2 - 0.2, 0, s * 0.15);
    }
    sightY = r2(0.02 + bh / 2 + 0.02);
    // organes de visée par défaut
    const optic = attach.optic;
    const defaultScope = fam === 'sniper' && !optic;
    if (!optic && !defaultScope) {
      part(g, bg(0.006, 0.03, 0.006), dark, 0, r2(sightY + 0.015), r2(hgZ - hgLen / 2 + 0.02));
      part(g, bg(0.022, 0.022, 0.008), dark, 0, r2(sightY + 0.011), 0.03);
      sightY += 0.028;
    } else if (optic === 'reflex') {
      part(g, bg(0.032, 0.012, 0.05), dark, 0, r2(sightY + 0.006), -0.06);
      for (const s of [-1, 1]) part(g, bg(0.004, 0.036, 0.008), dark, s * 0.015, r2(sightY + 0.03), -0.08);
      part(g, bg(0.03, 0.004, 0.008), dark, 0, r2(sightY + 0.048), -0.08);
      const lens = part(g, bg(0.028, 0.034, 0.002), new THREE.MeshBasicMaterial({ color: 0x60c0ff, transparent: true, opacity: 0.12 }), 0, r2(sightY + 0.03), -0.08);
      part(lens, bg(0.003, 0.003, 0.001), new THREE.MeshBasicMaterial({ color: 0xff3020 }), 0, 0, 0.002);
      sightY += 0.03;
    } else {
      const long = optic === 'longscope' || defaultScope;
      const len = long ? 0.26 : 0.15;
      part(g, cg(0.02, 0.02, len, 10), dark, 0, r2(sightY + 0.034), -0.07, Math.PI / 2);
      part(g, cg(0.026, 0.022, 0.05, 10), dark, 0, r2(sightY + 0.034), r2(-0.07 - len / 2), Math.PI / 2);
      part(g, cg(0.024, 0.02, 0.03, 10), dark, 0, r2(sightY + 0.034), r2(-0.07 + len / 2), Math.PI / 2);
      part(g, cg(0.022, 0.022, 0.004, 10), new THREE.MeshBasicMaterial({ color: 0x3a70c0 }), 0, r2(sightY + 0.034), r2(-0.07 - len / 2 - 0.026), Math.PI / 2);
      for (const z of [-0.03, -0.11]) part(g, bg(0.02, 0.022, 0.016), dark, 0, r2(sightY + 0.01), z);
      part(g, cg(0.008, 0.008, 0.02, 6), steel, 0, r2(sightY + 0.06), -0.07);
      sightY += 0.034; scoped = true;
    }
    // accessoires
    if (attach.grip === 'vgrip') part(g, cg(0.012, 0.014, 0.08, 8), dark, 0, -0.045, r2(hgZ));
    if (attach.grip === 'agrip') part(g, bg(0.026, 0.03, 0.09), dark, 0, -0.022, r2(hgZ), 0.35);
    if (attach.mag === 'extmag' && magObj && fam !== 'lmg') { magObj.scale.y = 1.4; magObj.position.y -= L.magLen * 0.2; }
    if (attach.mag === 'fastmag' && magObj) part(magObj, bg(0.03, 0.02, 0.058), mat('hazard'), 0, r2(-L.magLen / 2 + 0.01), 0);
  }
  // bouche
  const muzzle = new THREE.Object3D();
  if (attach.muzzle === 'silencer') { part(g, cg(0.02, 0.02, 0.16, 10), dark, 0, fam === 'pistol' ? 0.03 : 0.025, r2(muzzleZ - 0.07), Math.PI / 2); muzzleZ -= 0.15; }
  if (attach.muzzle === 'compensator') { part(g, bg(0.03, 0.03, 0.05), steel, 0, fam === 'pistol' ? 0.03 : 0.025, r2(muzzleZ - 0.02)); muzzleZ -= 0.045; }
  if (attach.muzzle === 'heavybarrel') { part(g, cg(0.019, 0.019, 0.14, 8), steel, 0, 0.025, r2(muzzleZ + 0.09), Math.PI / 2); }
  muzzle.position.set(0, fam === 'pistol' ? 0.03 : 0.025, muzzleZ - 0.01);
  g.add(muzzle);
  // modification arcanique : bande lumineuse
  if (attach.arcane && ATTACHMENTS[attach.arcane]) {
    const col = attach.arcane === 'emberCore' ? 'glow_orange' : attach.arcane === 'stormCoil' ? 'glow_blue' : 'glow_violet';
    for (const s of [-1, 1]) part(g, bg(0.003, 0.012, fam === 'pistol' ? 0.08 : 0.2), mat(col), s * (fam === 'pistol' ? 0.017 : 0.0235), 0.02, fam === 'pistol' ? -0.06 : -0.1);
  }

  if (withArms) {
    const sleeve = cmat(0x3a4030, 0.9, 0);
    const glove = cmat(0x1a1c1e, 0.8, 0.1);
    // main droite sur la poignée
    const rh = new THREE.Group();
    part(rh, bg(0.05, 0.07, 0.075), glove, 0, 0, 0);
    part(rh, bg(0.065, 0.065, 0.34), sleeve, 0.02, -0.03, 0.2, -0.12, 0.1, 0);
    rh.position.set(0.012, -0.06, 0.035);
    g.add(rh);
    if (fam !== 'pistol') {
      const lh = new THREE.Group();
      part(lh, bg(0.055, 0.05, 0.08), glove, 0, 0, 0);
      part(lh, bg(0.065, 0.065, 0.4), sleeve, -0.1, -0.05, 0.2, -0.15, -0.5, 0);
      lh.position.set(-0.005, -0.02, fam === 'smg' ? -0.2 : fam === 'sniper' ? -0.36 : -0.3);
      g.add(lh);
    } else {
      const lh = new THREE.Group();
      part(lh, bg(0.05, 0.06, 0.06), glove, 0, 0, 0);
      part(lh, bg(0.065, 0.065, 0.34), sleeve, -0.08, -0.04, 0.18, -0.1, -0.45, 0);
      lh.position.set(-0.02, -0.075, 0.03);
      g.add(lh);
    }
  }
  return { group: g, muzzle, mag: magObj, sightY, scoped };
}
