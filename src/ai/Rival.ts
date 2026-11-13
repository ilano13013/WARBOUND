// Adversaire humain du Défi d'armes. Il réutilise la silhouette, les zones de touche (tête / corps) et
// les animations d'un ennemi, mais sa position vient du réseau et ses dégâts sont appliqués chez lui :
// le tireur détecte la touche sur ce qu'il voit et l'envoie, la victime fait foi pour sa santé.
import * as THREE from 'three';
import type { Game } from '../core/Game';
import { Enemy } from './Enemy';
import type { DamageInfo } from '../world/World';

export interface RivalState { x: number; y: number; z: number; yaw: number; pitch: number; sp: number; h: number; ads: boolean; hp: number; inv: boolean }

const _a = new THREE.Vector3();

export class Rival extends Enemy {
  private target = new THREE.Vector3();
  private targetYaw = 0;
  private remoteSpeed = 0;
  /** Hauteur annoncée (accroupi ou debout) : la zone de touche et la silhouette suivent. */
  private remoteH = 1.8;
  /** Invulnérabilité d'apparition annoncée par l'adversaire. */
  invulnerable = false;
  hasState = false;
  /** Appelé quand une touche locale doit être transmise. */
  onHit: (dmg: number, head: boolean) => void = () => {};

  /** Coéquipier (4v4) : jamais visé ni touché par le joueur local, toujours visible sur la mini-carte. */
  friendly = false;
  team: 'red' | 'blue' | null = null;

  constructor(g: Game, x: number, y: number, z: number, public displayName: string, team: 'red' | 'blue' | null = null, friendly = false) {
    super(g, team === 'red' ? 'rival_red' : team === 'blue' ? 'rival_blue' : 'rival', x, z, { y, noLoot: true });
    this.team = team; this.friendly = friendly;
    this.name = displayName;
    this.maxHp = this.hp = 100;
    this.target.set(x, y, z);
    // jamais « en combat » : la carte tactique ne révèle pas sa position
    this.state = 'idle';
  }

  /** Nouvel état reçu (environ 20 fois par seconde). */
  apply(s: RivalState): void {
    this.target.set(s.x, s.y, s.z);
    this.targetYaw = s.yaw;
    this.remoteSpeed = s.sp;
    this.remoteH = Math.max(0.9, Math.min(1.9, s.h));
    this.hp = Math.max(0, s.hp);
    this.invulnerable = s.inv;
    if (!this.hasState) { this.pos.copy(this.target); this.yaw = s.yaw; this.hasState = true; }
  }

  override takeDamage(amount: number, info: DamageInfo): number {
    if (!this.alive || info.source !== 'player' || this.friendly) return -1;
    const g = this.g;
    if (this.invulnerable) { g.ui.hud.immune(); return -1; }
    const dmg = Math.max(1, Math.round(amount));
    this.hp = Math.max(0, this.hp - dmg);
    this.flinch = Math.min(1, this.flinch + 0.3);
    this.rig?.flash(1); this.flashT = 0.07;
    if (this.rig && (info.head || dmg > 25)) this.rig.hit(!!info.head);
    if (info.point) {
      g.fx.impact(info.point, info.dir ? _a.copy(info.dir).negate() : _a.set(0, 1, 0), 'flesh');
      if (info.type === 'bullet') g.audio.impact('flesh', info.point);
    }
    g.combat.onDamageDealt(this, dmg, info, this.hp <= 0, false);
    this.onHit(dmg, !!info.head);
    return dmg;
  }

  // aucune altération ni poussée : l'adversaire est maître de ses déplacements
  override applyBurn(): void { /* */ }
  override applySlow(): void { /* */ }
  override applyRoot(): void { /* */ }
  override applyStun(): void { /* */ }
  override knockback(): void { /* */ }
  override alertTo(): void { /* */ }

  /** Mort confirmée par l'adversaire : animation seulement (aucune récompense de campagne). */
  kill(): void {
    if (!this.alive) return;
    this.alive = false; this.hp = 0; this.deathT = 0;
    this.rig?.flash(0);
    this.model.marker.visible = false;
    this.rig?.die();
    this.g.audio.enemyDeath('grunt', this.pos);
  }

  override update(dt: number): void {
    if (!this.alive) { this.updateDeath(dt); return; }
    if (this.firedT > 0) this.firedT -= dt;
    if (this.flashT > 0) { this.flashT -= dt; if (this.flashT <= 0) this.rig?.flash(0); }
    this.flinch = Math.max(0, this.flinch - dt * 4);
    // lissage vers le dernier état reçu ; un saut de plus de 4 m (réapparition) est appliqué tel quel
    const d = this.pos.distanceTo(this.target);
    const prev = _a.copy(this.pos);
    if (d > 4) this.pos.copy(this.target); else this.pos.lerp(this.target, Math.min(1, dt * 14));
    this.vel.subVectors(this.pos, prev).divideScalar(Math.max(dt, 1e-3));
    let dy = this.targetYaw - this.yaw;
    while (dy > Math.PI) dy -= Math.PI * 2;
    while (dy < -Math.PI) dy += Math.PI * 2;
    this.yaw += dy * Math.min(1, dt * 16);
    this.height += (this.remoteH - this.height) * Math.min(1, dt * 12);
    this.model.root.scale.y = this.height / 1.8;
    if (this.rig) {
      this.rig.setMotion(this.remoteSpeed, true, dt);
      this.rig.far = this.pos.distanceTo(this.g.r.camera.position);
      this.rig.update(dt);
    }
    this.syncModel();
  }

  /** Le corps disparaît à la réapparition (gérée par le duel). */
  protected override updateDeath(dt: number): void {
    if (this.removed) return;
    this.deathT += dt;
    this.rig?.update(dt);
  }
}
