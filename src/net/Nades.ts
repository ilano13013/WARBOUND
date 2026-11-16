// Grenades du multijoueur (Frag, Semtex). La même trajectoire est simulée chez l'hôte, qui fait autorité
// (explosion, dégâts, éliminations), et chez les clients pour l'affichage seulement : l'explosion n'y est
// montrée qu'à la réception de l'événement de l'hôte, à l'endroit exact qu'il indique.
import * as THREE from 'three';
import type { Game } from '../core/Game';
import { LETHALS } from '../data/mpProgress';

const GRAV = 15, R = 0.09;
export const THROW_SPEED = 17, THROW_UP = 3.5;

export interface Nade {
  id: number; kind: string; owner: number;
  pos: THREE.Vector3; vel: THREE.Vector3; age: number;
  stuck: boolean; stickTo: number; off: THREE.Vector3;
  mesh: THREE.Mesh | null; done: boolean;
}

const geo = new THREE.SphereGeometry(1, 10, 8);
const MAT: Record<string, THREE.Material> = {};
const _a = new THREE.Vector3();

export class Nades {
  list: Nade[] = [];
  constructor(private g: Game) {}

  /** Ajoute une grenade lancée (hôte : simulation officielle ; client : affichage). */
  add(id: number, kind: string, owner: number, pos: THREE.Vector3, vel: THREE.Vector3): Nade {
    const n: Nade = { id, kind, owner, pos: pos.clone(), vel: vel.clone(), age: 0, stuck: false, stickTo: -1, off: new THREE.Vector3(), mesh: null, done: false };
    if (this.g.level) {
      const mat = MAT[kind] || (MAT[kind] = new THREE.MeshStandardMaterial({ color: kind === 'semtex' ? 0x8a9a3a : 0x3a4a2a, emissive: kind === 'semtex' ? 0x2a3a00 : 0x000000, roughness: 0.6, metalness: 0.3 }));
      n.mesh = new THREE.Mesh(geo, mat);
      n.mesh.scale.setScalar(kind === 'semtex' ? 0.11 : R);
      n.mesh.position.copy(n.pos);
      this.g.r.scene.add(n.mesh);
    }
    this.list.push(n);
    return n;
  }

  /**
   * Avance la simulation. `players` donne la position d'un joueur par index (pour une Semtex collée) ;
   * `hitPlayer` (hôte seulement) renvoie l'index d'un joueur touché par une Semtex en vol.
   * Renvoie les grenades dont la mèche est écoulée (l'hôte les fait exploser).
   */
  update(dt: number, players: (i: number) => THREE.Vector3 | null, hitPlayer?: (n: Nade) => number): Nade[] {
    const world = this.g.level?.world, out: Nade[] = [];
    for (const n of this.list) {
      if (n.done) continue;
      n.age += dt;
      const def = LETHALS[n.kind];
      if (n.stickTo >= 0) {
        const p = players(n.stickTo);
        if (p) n.pos.copy(p).add(n.off);
      } else if (!n.stuck && world) {
        n.vel.y -= GRAV * dt;
        const sp = n.vel.length();
        _a.copy(n.vel).multiplyScalar(1 / (sp || 1));
        const h = world.raycast(n.pos, _a, sp * dt + R, 'walk');
        if (h) {
          n.pos.copy(h.point).addScaledVector(h.normal, R + 0.01);
          if (def?.sticky) { n.stuck = true; n.vel.set(0, 0, 0); this.g.audio.grenadeBounce(n.pos); }
          else {
            const dn = n.vel.dot(h.normal);
            n.vel.addScaledVector(h.normal, -1.5 * dn).multiplyScalar(0.6);
            if (Math.abs(dn) > 1.5) this.g.audio.grenadeBounce(n.pos);
          }
        } else n.pos.addScaledVector(n.vel, dt);
        if (def?.sticky && hitPlayer && !n.stuck) {
          const i = hitPlayer(n);
          if (i >= 0) { const p = players(i); if (p) { n.stickTo = i; n.off.copy(n.pos).sub(p); n.vel.set(0, 0, 0); } }
        }
        if (n.pos.y < world.killY) n.done = true;
      }
      if (n.mesh) n.mesh.position.copy(n.pos);
      if (def && n.age >= def.fuse) out.push(n);
      if (n.age > 8) n.done = true; // sécurité (client sans événement d'explosion)
    }
    for (let i = this.list.length - 1; i >= 0; i--) if (this.list[i].done) { this.list[i].mesh?.removeFromParent(); this.list.splice(i, 1); }
    return out;
  }

  get(id: number): Nade | undefined { return this.list.find((n) => n.id === id); }
  remove(n: Nade): void { n.done = true; n.mesh?.removeFromParent(); n.mesh = null; }

  /** Effet visuel et sonore d'une explosion. */
  boom(kind: string, pos: THREE.Vector3): void {
    if (!this.g.level) return;
    const r = LETHALS[kind]?.radius || 5;
    this.g.fx.explosion(pos, r * 0.8, kind === 'semtex' ? 0xffb03a : 0xff8a2a);
    this.g.audio.explosion(pos, Math.min(1.3, r / 5));
  }

  clear(): void { for (const n of this.list) n.mesh?.removeFromParent(); this.list = []; }
}
