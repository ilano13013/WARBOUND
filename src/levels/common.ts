// Éléments communs aux opérations : documents à découvrir, caisses de munitions, barils explosifs, interlocuteurs radio.
import * as THREE from 'three';
import type { Game } from '../core/Game';
import type { Level } from '../world/Level';
import { mat } from '../render/Materials';
import { LORE } from '../data/missions';

export const REYES = 'CDT. REYES';
export const ORACLE = 'ORACLE';
export const MAREK = 'DR MAREK';
export const VOSS = 'VOSS';
export const ARCHON = 'L’ARCHONTE';

/** Document, journal audio ou terminal consultable. */
export function lore(g: Game, L: Level, id: string, x: number, z: number, y = 0): void {
  const def = LORE[id];
  const isTerm = def.kind === 'Terminal';
  let pos: THREE.Vector3;
  if (isTerm) pos = L.terminal(x, z, 'z+');
  else {
    L.box('darkmetal', x, y, z, 0.7, 0.9, 0.7);
    const item = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.05, 0.22), mat(def.kind === 'Document' ? 'glow_white' : 'glow_orange'));
    item.position.set(x, y + 1.0, z); item.rotation.y = 0.4;
    L.root.add(item);
    L.updaters.push((_dt, t) => { item.position.y = y + 1.05 + Math.sin(t * 2 + x) * 0.04; item.rotation.y = t * 0.8; });
    pos = new THREE.Vector3(x, y + 1.0, z);
  }
  L.interact(pos, `${def.kind} — ${def.title}`, () => g.ui.panels.discover(id), 2.4);
}

export function ammo(g: Game, L: Level, x: number, z: number): void {
  const p = L.ammoCrate(x, z);
  L.interact(p, 'Caisse de munitions — réapprovisionner', () => { g.weapons.refill(1); g.player.grenades = 2; g.audio.reload(2); g.ui.hud.toast('MUNITIONS RÉAPPROVISIONNÉES', '#ffb04a'); }, 2.6);
}

export function barrel(g: Game, L: Level, x: number, z: number): void {
  L.explosiveBarrel(x, z, (pos) => g.combat.explode(pos, 5.5, 130, 'world'));
}

/** Cuve à spécimen : cylindre vitré contenant un cristal. */
export function tank(L: Level, x: number, z: number, m: 'crystal' | 'crystal_red' = 'crystal'): void {
  L.deco(mat('darkmetal'), new THREE.CylinderGeometry(0.9, 1.0, 0.5, 12), x, 0.25, z);
  L.deco(mat('darkmetal'), new THREE.CylinderGeometry(1.0, 0.9, 0.4, 12), x, 3.3, z);
  L.deco(mat('glass'), new THREE.CylinderGeometry(0.8, 0.8, 2.7, 14, 1, true), x, 1.85, z);
  L.deco(mat(m), new THREE.OctahedronGeometry(0.4, 0), x, 1.8, z, 0, x, 0.2, 0.8, 1.9, 0.8);
  L.collider(x, 0, z, 1.7, 3.5, 1.7, 'metal');
}
