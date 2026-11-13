// Tireur d'élite HELIX : posté en hauteur, il change de perchoir après avoir tiré, quand il est touché ou si le joueur
// s'approche. Pendant le déplacement il est hors d'atteinte (invisible, sous le niveau) ; à son retour, un reflet de lunette
// trahit sa nouvelle position avant le tir. Le tir lui-même suit les règles du tireur existant (laser d'avertissement).
import * as THREE from 'three';
import type { Game } from '../core/Game';
import { Enemy, type SpawnOpts } from './Enemy';
import type { DamageInfo } from '../world/World';
import { softTexture } from '../render/Materials';

const _v = new THREE.Vector3(), _w = new THREE.Vector3();

export class Marksman extends Enemy {
  perches: THREE.Vector3[];
  private perch = 0;
  private relocT = 0;
  private nextPerch = 0;
  private pendingT = -1; // délai avant de quitter le perchoir (laisse le tir ou l'impact se jouer)
  private shots = 0;
  private hpAtPerch = 0;
  private wasAiming = false;
  private glint: THREE.Sprite;
  private glintT = 0;
  /** Nombre de changements de perchoir (pour les tests et le suivi). */
  moves = 0;
  private static lastCall = -1e9;

  constructor(g: Game, x: number, z: number, o: SpawnOpts & { perches?: THREE.Vector3[] } = {}) {
    const perches = o.perches && o.perches.length ? o.perches : [new THREE.Vector3(x, o.y ?? 0.05, z)];
    super(g, 'marksman', perches[0].x, perches[0].z, { ...o, static: true, y: perches[0].y });
    this.perches = perches;
    this.hpAtPerch = this.hp;
    // reflet de lunette : visible de loin, à travers la pluie
    this.glint = new THREE.Sprite(new THREE.SpriteMaterial({ map: softTexture(), color: 0xfff2d0, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    this.glint.position.set(0.12, this.height * 0.86, -0.35);
    this.glint.scale.setScalar(1.6);
    this.model.root.add(this.glint);
  }

  /** Hors d'atteinte pendant un déplacement. */
  get relocating(): boolean { return this.relocT > 0; }

  update(dt: number): void {
    const g = this.g;
    if (!this.alive) { this.glint.visible = false; super.update(dt); return; }
    if (this.relocT > 0) {
      this.relocT -= dt;
      if (this.relocT <= 0) this.arrive();
      return;
    }
    // en veille, il balaie le terrain dans la direction du joueur (± 35°) ; la détection garde ses règles (portée, ligne de vue)
    if (this.state !== 'combat') {
      const base = Math.atan2(this.pos.x - g.player.pos.x, this.pos.z - g.player.pos.z) + Math.sin(g.time * 0.35 + this.perch) * 0.6;
      let dy = base - this.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
      this.yaw += dy * Math.min(1, dt * 1.2);
    }
    super.update(dt);
    if (!this.alive) return;
    // reflet : pendant la visée et une seconde après l'arrivée
    if (this.glintT > 0) this.glintT -= dt;
    const on = this.aiming || this.glintT > 0;
    const m = this.glint.material as THREE.SpriteMaterial;
    m.opacity = on ? 0.55 + 0.45 * Math.abs(Math.sin(g.time * 9)) : Math.max(0, m.opacity - dt * 3);
    // un tir vient de partir (fin de visée) : deux tirs au plus depuis le même perchoir
    if (this.wasAiming && !this.aiming && this.cdT > 0.5) { this.shots++; if (this.shots >= 2 || Math.random() < 0.55) this.queueMove(0.7); }
    this.wasAiming = this.aiming;
    // joueur trop proche
    if (this.pendingT < 0 && this.state === 'combat' && Math.hypot(g.player.pos.x - this.pos.x, g.player.pos.z - this.pos.z) < 13) this.queueMove(0.4);
    if (this.pendingT >= 0) { this.pendingT -= dt; if (this.pendingT < 0) this.leave(); }
  }

  takeDamage(amount: number, info: DamageInfo): number {
    if (this.relocT > 0) return -1;
    const r = super.takeDamage(amount, info);
    if (this.alive && r > 0 && this.hpAtPerch - this.hp > this.maxHp * 0.22) this.queueMove(0.3);
    return r;
  }

  private queueMove(delay: number): void { if (this.pendingT < 0 && this.perches.length > 1) this.pendingT = delay; }

  /** Choisit le perchoir suivant : à bonne distance du joueur, avec une ligne de tir si possible. */
  private pickPerch(): number {
    const g = this.g, p = g.player.pos, w = g.level!.world;
    _w.set(p.x, p.y + 1.5, p.z);
    let best = -1, bs = -1e9;
    this.perches.forEach((c, i) => {
      if (i === this.perch) return;
      const d = Math.hypot(c.x - p.x, c.z - p.z);
      let s = -Math.abs(d - 45) * 0.05 + Math.random() * 0.8;
      if (d < 15) s -= 5;
      if (w.los(_v.set(c.x, c.y + 1.6, c.z), _w)) s += 3;
      if (s > bs) { bs = s; best = i; }
    });
    return best < 0 ? (this.perch + 1) % this.perches.length : best;
  }

  private leave(): void {
    const g = this.g;
    this.nextPerch = this.pickPerch();
    const a = this.perches[this.perch], b = this.perches[this.nextPerch];
    this.relocT = Math.min(7, 2.5 + a.distanceTo(b) / 12);
    this.aiming = false; this.burstLeft = 0;
    g.fx.burst(_v.set(this.pos.x, this.pos.y + 1, this.pos.z), { count: 10, color: 0x6a6a70, speed: 1.5, life: 0.8, size: 0.5, gravity: -1 });
    this.model.root.visible = false;
    this.pos.set(b.x, -60, b.z); // hors d'atteinte : ni rayon, ni explosion, ni ligne de vue
    this.model.root.position.copy(this.pos);
    if (g.time - Marksman.lastCall > 25 && g.mission) { Marksman.lastCall = g.time; g.mission.say('ORACLE', 'Le tireur d’élite change de position ! Surveillez les hauteurs.'); }
  }

  private arrive(): void {
    const b = this.perches[this.nextPerch];
    this.perch = this.nextPerch; this.moves++;
    this.pos.copy(b); this.lastPos.copy(b);
    this.model.root.position.copy(b);
    this.model.root.visible = true;
    this.shots = 0; this.hpAtPerch = this.hp; this.pendingT = -1;
    this.cdT = Math.max(this.cdT, 1.4); this.glintT = 1.6;
    this.g.fx.burst(_v.set(b.x, b.y + 1, b.z), { count: 8, color: 0x6a6a70, speed: 1.2, life: 0.7, size: 0.4, gravity: -1 });
  }
}
