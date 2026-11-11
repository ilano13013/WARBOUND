// Alliés invoqués : loup spectral (attaque et attire l'attention) et drone médical (soigne, peut tirer).
import * as THREE from 'three';
import type { Game } from '../core/Game';
import { buildEnemyModel, type EnemyModel } from './EnemyModels';
import type { Enemy } from './Enemy';

const _a = new THREE.Vector3(), _b = new THREE.Vector3();

export class Ally {
  pos = new THREE.Vector3();
  vel = new THREE.Vector3();
  yaw = 0;
  alive = true;
  hp: number;
  taunts: boolean;
  private model: EnemyModel;
  private target: Enemy | null = null;
  private thinkT = 0; private atkT = 0; private phase = Math.random() * 6; private grounded = false;
  private path: THREE.Vector3[] | null = null; private pathI = 0; private repathT = 0;

  constructor(private g: Game, public kind: 'wolf' | 'meddrone', public life: number, private power = 1) {
    this.model = buildEnemyModel(kind);
    this.taunts = kind === 'wolf';
    this.hp = kind === 'wolf' ? 160 : 9999;
    const p = g.player;
    const side = Math.random() < 0.5 ? -1 : 1;
    this.pos.set(p.pos.x + Math.cos(p.yaw) * 1.5 * side, p.pos.y + (kind === 'wolf' ? 0.1 : 1.8), p.pos.z - Math.sin(p.yaw) * 1.5 * side);
    g.r.scene.add(this.model.root);
    g.fx.burst(this.pos, { count: 20, color: kind === 'wolf' ? 0x9af0d0 : 0x3aff8a, speed: 3, life: 0.6, size: 0.18, gravity: -1 });
  }

  takeDamage(n: number): void {
    if (!this.alive) return;
    this.hp -= n;
    if (this.hp <= 0) this.remove();
  }

  remove(): void {
    if (!this.alive) return;
    this.alive = false;
    this.g.fx.burst(this.pos, { count: 16, color: 0x9af0d0, speed: 2.5, life: 0.6, size: 0.16, gravity: -1 });
    this.model.root.removeFromParent();
  }

  update(dt: number): void {
    if (!this.alive) return;
    const g = this.g, p = g.player;
    this.life -= dt;
    if (this.life <= 0 || p.dead) { this.remove(); return; }
    this.phase += dt * 8;
    if (this.kind === 'meddrone') { this.updateDrone(dt); return; }

    // --- loup spectral ---
    this.thinkT -= dt; this.atkT -= dt;
    if (this.thinkT <= 0) {
      this.thinkT = 0.4;
      let best: Enemy | null = null, bd = 28;
      for (const e of g.enemies) { if (!e.alive || e.def.flying) continue; const d = e.pos.distanceTo(this.pos); if (d < bd && (e.state === 'combat' || d < 12)) { bd = d; best = e; } }
      this.target = best;
      if (this.pos.distanceTo(p.pos) > 34) { this.pos.copy(p.pos); this.path = null; }
    }
    const nav = g.level!.world.nav;
    let tx = p.pos.x - Math.sin(p.yaw + 2.4) * 2.2, tz = p.pos.z - Math.cos(p.yaw + 2.4) * 2.2, stop = 1.2;
    if (this.target && this.target.alive) { tx = this.target.pos.x; tz = this.target.pos.z; stop = this.target.radius + 0.9; }
    const dx = tx - this.pos.x, dz = tz - this.pos.z, dist = Math.hypot(dx, dz);
    let mx = 0, mz = 0;
    if (dist > stop) {
      if (nav.clearLine(this.pos.x, this.pos.z, tx, tz)) { mx = dx / dist; mz = dz / dist; this.path = null; }
      else {
        this.repathT -= dt;
        if ((!this.path || this.repathT <= 0) && g.combat.pathBudget > 0) { g.combat.pathBudget--; this.path = nav.findPath(this.pos.x, this.pos.z, tx, tz); this.pathI = 0; this.repathT = 0.8; }
        if (this.path && this.path[this.pathI]) {
          const wp = this.path[this.pathI];
          const wx = wp.x - this.pos.x, wz = wp.z - this.pos.z, wd = Math.hypot(wx, wz);
          if (wd < 0.5) this.pathI++; else { mx = wx / wd; mz = wz / wd; }
        }
      }
    } else if (this.target && this.target.alive && this.atkT <= 0) {
      this.atkT = 0.8;
      this.target.takeDamage(24 * this.power, { source: 'ally', type: 'melee', point: this.target.center(_a) });
      g.fx.burst(_a, { count: 6, color: 0x9af0d0, speed: 3, life: 0.3, size: 0.12 });
      this.target.alertTo(this.pos, true);
    }
    const sp = 8.5;
    this.vel.x += THREE.MathUtils.clamp(mx * sp - this.vel.x, -40 * dt, 40 * dt);
    this.vel.z += THREE.MathUtils.clamp(mz * sp - this.vel.z, -40 * dt, 40 * dt);
    this.vel.y -= 19 * dt;
    _b.copy(this.vel).multiplyScalar(dt);
    const res = g.level!.world.moveCharacter(this.pos, _b, 0.35, 1.0, 0.5, this.grounded);
    this.grounded = res.grounded; if (res.grounded) this.vel.y = 0;
    if (mx || mz) this.yaw = Math.atan2(-mx, -mz);
    else if (this.target) this.yaw = Math.atan2(-(this.target.pos.x - this.pos.x), -(this.target.pos.z - this.pos.z));
    const m = this.model, sw = Math.min(1, Math.hypot(this.vel.x, this.vel.z) / 4);
    for (let i = 0; i < 4; i++) m.extra[i].rotation.x = Math.sin(this.phase * 1.5 + (i % 2 ? Math.PI : 0) + (i > 1 ? 1.2 : 0)) * (0.15 + sw * 0.9);
    m.body.rotation.x = this.atkT > 0.55 ? 0.4 : 0;
    m.root.position.copy(this.pos); m.root.rotation.y = this.yaw;
    if (Math.random() < 0.3) g.fx.spark(this.pos.x, this.pos.y + 0.6, this.pos.z, 0x9af0d0, 0.14, 0.5, 0.5);
  }

  private updateDrone(dt: number): void {
    const g = this.g, p = g.player;
    // suit l'épaule du joueur
    _a.set(p.pos.x + Math.cos(p.yaw) * 0.9 - Math.sin(p.yaw) * -0.4, p.pos.y + 2.05 + Math.sin(this.phase * 0.25) * 0.12, p.pos.z - Math.sin(p.yaw) * 0.9 - Math.cos(p.yaw) * -0.4);
    this.pos.lerp(_a, Math.min(1, dt * 5));
    this.yaw = p.yaw;
    for (const r of this.model.extra) r.rotation.y += dt * 45;
    this.model.root.position.copy(this.pos); this.model.root.rotation.y = this.yaw;
    // soin continu
    if (p.hp < p.maxHp || p.mod('overheal') > 0) {
      const healed = p.heal(6.5 * dt);
      if (healed > 0 && Math.random() < 0.25) { g.fx.spark(p.pos.x + (Math.random() - 0.5) * 0.6, p.pos.y + 0.4 + Math.random(), p.pos.z + (Math.random() - 0.5) * 0.6, 0x3aff8a, 0.14, 0.7, 1.2); }
    }
    this.atkT -= dt;
    if (this.power > 0 && this.atkT <= 0) {
      this.atkT = 1.1;
      let best: Enemy | null = null, bd = 30;
      for (const e of g.enemies) { if (!e.alive) continue; const d = e.pos.distanceTo(this.pos); if (d < bd && g.level!.world.los(this.pos, e.center(_b))) { bd = d; best = e; } }
      if (best) {
        best.center(_b);
        g.fx.tracer(this.pos, _b, 0x8affc0, 0.03, 0.1);
        g.audio.tone(1500, 0.08, { type: 'square', to: 700, vol: 0.05, filter: 4000 });
        best.takeDamage(this.power, { source: 'ally', type: 'arcane', point: _b.clone() });
      }
    }
  }
}
