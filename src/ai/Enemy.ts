// IA ennemie : perception (vue/ouïe), machine à états, navigation, couverture, attaques par archétype et altérations d'état.
import * as THREE from 'three';
import type { Game } from '../core/Game';
import { ENEMIES, type EnemyDef, type EnemyKind } from '../data/enemies';
import type { Damageable, DamageInfo } from '../world/World';
import { buildEnemyModel, type EnemyModel } from './EnemyModels';
import type { Ally } from './Ally';

export type AIState = 'idle' | 'patrol' | 'alert' | 'combat' | 'search';

const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _d = new THREE.Vector3();
const flashMat = new THREE.MeshBasicMaterial({ color: 0xffffff });

export interface SpawnOpts { patrol?: THREE.Vector3[]; static?: boolean; alert?: boolean; hpMult?: number; noLoot?: boolean; group?: string; y?: number; siege?: THREE.Vector3 }

export class Enemy implements Damageable {
  def: EnemyDef;
  pos = new THREE.Vector3();
  vel = new THREE.Vector3();
  yaw = 0;
  hp: number; maxHp: number;
  alive = true; removed = false;
  isBoss = false;
  name: string;
  radius: number; height: number;
  state: AIState = 'idle';
  model: EnemyModel;
  group = '';
  static = false;
  noLoot = false;
  /** Point à assiéger (objectifs de défense) : la créature s'y rend tant que le joueur est loin. */
  siege: THREE.Vector3 | null = null;
  // perception
  canSee = false; lastKnown = new THREE.Vector3(); protected seeT = 0; protected lostT = 0; protected percT = Math.random() * 0.2; protected stateT = 0;
  tgtAlly: Ally | null = null;
  // navigation
  protected path: THREE.Vector3[] | null = null; protected pathI = 0; protected repathT = 0; protected dest = new THREE.Vector3(); protected hasDest = false;
  protected stuckT = 0; protected lastPos = new THREE.Vector3(); protected grounded = false;
  protected patrol: THREE.Vector3[] = []; protected patrolI = 0; protected waitT = 0;
  // combat
  protected cdT = 1 + Math.random(); protected burstLeft = 0; protected burstT = 0; protected aimT = 0; protected aiming = false;
  protected tacticT = 0; protected inCover = false; protected meleeT = 0; protected meleeHit = false; protected leapCd = 2;
  protected firstBurst = true;
  // altérations
  burnT = 0; burnDps = 0; private burnTick = 0; slowT = 0; slowAmt = 0; rootT = 0; stunT = 0; markT = 0; markMult = 0; revealT = 0; buffT = 0;
  // animation
  protected walkPhase = Math.random() * 6; protected flinch = 0; protected deathT = 0; protected flashT = 0; private flashed: { m: THREE.Mesh; mat: THREE.Material | THREE.Material[] }[] = [];
  protected hover = 0; protected auraT = 0;
  eliteBarT = 0;

  constructor(protected g: Game, public kind: EnemyKind, x: number, z: number, o: SpawnOpts = {}) {
    this.def = ENEMIES[kind];
    this.name = this.def.name;
    this.maxHp = this.hp = Math.round(this.def.hp * (o.hpMult ?? 1) * g.diff.hp);
    this.radius = this.def.radius; this.height = this.def.height * (this.def.scale ?? 1);
    this.model = buildEnemyModel(kind);
    if (this.def.scale) this.model.root.scale.setScalar(this.def.scale);
    this.pos.set(x, o.y ?? (this.def.flying ? 3 : 0.05), z);
    this.lastPos.copy(this.pos);
    this.static = !!o.static; this.noLoot = !!o.noLoot; this.group = o.group || ''; this.siege = o.siege || null;
    if (o.patrol && o.patrol.length) { this.patrol = o.patrol; this.state = 'patrol'; }
    this.yaw = Math.random() * Math.PI * 2;
    g.r.scene.add(this.model.root);
    this.syncModel();
    if (o.alert) this.alertTo(g.player.pos, true);
  }

  // ---------- utilitaires ----------

  get eyeY(): number { return this.pos.y + (this.def.flying ? 0 : this.height * 0.88); }
  center(out: THREE.Vector3): THREE.Vector3 { return out.set(this.pos.x, this.pos.y + (this.def.flying ? 0 : this.height * 0.55), this.pos.z); }
  get stunned(): boolean { return this.stunT > 0; }
  get speedMult(): number { return (this.slowT > 0 ? 1 - this.slowAmt : 1) * (this.rootT > 0 || this.stunT > 0 ? 0 : 1); }

  /** Intersection rayon / hitbox. Retourne la distance et si la tête est touchée. */
  hitTest(o: THREE.Vector3, d: THREE.Vector3, maxT: number): { t: number; head: boolean } | null {
    let best = maxT, head = false, found = false;
    if (this.def.flying) {
      const t = raySphere(o, d, this.pos.x, this.pos.y, this.pos.z, this.radius * 1.1);
      if (t !== null && t < best) { best = t; found = true; }
    } else {
      const quad = this.kind === 'devourer';
      const hr = quad ? 0.26 : 0.17 * (this.def.scale ?? 1) * (this.isBoss ? 1.3 : 1);
      const hy = this.pos.y + (quad ? 0.72 : this.height * 0.9);
      const hx = quad ? this.pos.x - Math.sin(this.yaw) * 0.6 : this.pos.x, hz = quad ? this.pos.z - Math.cos(this.yaw) * 0.6 : this.pos.z;
      const th = raySphere(o, d, hx, hy, hz, hr);
      if (th !== null && th < best) { best = th; head = true; found = true; }
      const tb = rayCylinder(o, d, this.pos.x, this.pos.z, this.radius * (quad ? 1.15 : 0.95), this.pos.y, this.pos.y + (quad ? 0.95 : this.height * 0.82));
      if (tb !== null && tb < best - 0.02) { best = tb; head = false; found = true; }
    }
    return found ? { t: best, head } : null;
  }

  // ---------- dégâts et altérations ----------

  takeDamage(amount: number, info: DamageInfo): number {
    if (!this.alive) return -1;
    const g = this.g;
    let dmg = amount;
    // bouclier frontal du Briseur de ligne
    let blocked = false;
    if (this.model.shield && this.model.shield.visible && info.type === 'bullet' && !info.head && info.dir && this.stunT <= 0) {
      const fx = -Math.sin(this.yaw), fz = -Math.cos(this.yaw);
      if (-(info.dir.x * fx + info.dir.z * fz) > 0.35) { dmg *= 0.12; blocked = true; }
    }
    if (this.markT > 0) dmg *= 1 + this.markMult;
    if (this.buffT > 0) dmg *= 0.8;
    if (this.slowT > 0 && info.source === 'player') dmg *= 1 + g.player.mod('slowedDmg');
    dmg = this.modifyDamage(dmg, info);
    if (dmg <= 0) {
      if (info.point) { g.fx.impact(info.point, _a.set(0, 1, 0), 'energy'); g.audio.impact('energy', info.point); }
      if (info.source === 'player') g.ui.hud.immune();
      return -1;
    }
    this.hp -= dmg;
    this.flinch = Math.min(1, this.flinch + dmg / this.maxHp * 2.5 + 0.2);
    this.flash();
    this.eliteBarT = 5;
    if (info.point) {
      g.fx.impact(info.point, info.dir ? _a.copy(info.dir).negate() : _a.set(0, 1, 0), blocked ? 'metal' : this.kind === 'drone' ? 'metal' : this.kind === 'sentinel' ? 'crystal' : 'flesh');
      if (info.type === 'bullet') g.audio.impact(blocked ? 'metal' : 'flesh', info.point);
    }
    if (info.source === 'player' || info.source === 'ally') {
      g.combat.onDamageDealt(this, dmg, info, this.hp <= 0, blocked);
      if (this.state !== 'combat') this.alertTo(g.player.pos, !info.silent || this.canSee || this.pos.distanceTo(g.player.pos) < 25);
      else this.lastKnown.copy(g.player.pos);
      if (!info.silent) g.combat.alertNear(this.pos, 16, g.player.pos);
    }
    if (this.hp <= 0) this.die(info);
    return dmg;
  }

  /** Point d'extension pour les boss (invulnérabilités, phases). */
  protected modifyDamage(dmg: number, _info: DamageInfo): number { return dmg; }

  applyBurn(dps: number, dur: number): void { if (!this.alive) return; this.burnDps = Math.max(this.burnDps, dps); this.burnT = Math.max(this.burnT, dur); }
  applySlow(amt: number, dur: number): void { if (this.isBoss) amt *= 0.4; this.slowAmt = Math.max(this.slowT > 0 ? this.slowAmt : 0, amt); this.slowT = Math.max(this.slowT, dur); }
  applyRoot(dur: number): void { if (this.isBoss) { this.applySlow(0.6, dur); return; } this.rootT = Math.max(this.rootT, dur); }
  applyStun(dur: number): void { if (this.isBoss) return; this.stunT = Math.max(this.stunT, dur); this.burstLeft = 0; this.aiming = false; this.meleeT = 0; }
  applyMark(mult: number, dur: number): void { this.markMult = Math.max(this.markT > 0 ? this.markMult : 0, mult); this.markT = Math.max(this.markT, dur); }
  knockback(from: THREE.Vector3, force: number): void {
    if (this.isBoss || this.static) return;
    _a.subVectors(this.pos, from).setY(0);
    const l = _a.length() || 1;
    this.vel.x += (_a.x / l) * force; this.vel.z += (_a.z / l) * force; this.vel.y = Math.max(this.vel.y, force * 0.35);
  }

  private flash(): void {
    if (this.flashT > 0) { this.flashT = 0.07; return; }
    this.flashT = 0.07;
    this.flashed.length = 0;
    this.model.root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh && !(m.material as any).transparent) { this.flashed.push({ m, mat: m.material }); m.material = flashMat; }
    });
  }
  private unflash(): void { for (const f of this.flashed) f.m.material = f.mat; this.flashed.length = 0; }

  die(info: DamageInfo): void {
    if (!this.alive) return;
    this.alive = false; this.hp = 0; this.deathT = 0;
    this.unflash(); this.flashT = 0;
    this.model.marker.visible = false;
    this.g.audio.enemyDeath(this.kind, this.pos);
    this.g.combat.onKill(this, info);
    this.onDeath(info);
    if (this.def.flying) { this.g.fx.explosion(this.pos, 1.6, 0xff8a2a); }
    if (this.kind === 'devourer' || this.kind === 'sentinel' || this.kind === 'caster') this.g.fx.burst(this.center(_a), { count: 22, color: 0x9a5aff, speed: 4, life: 0.9, size: 0.16, gravity: -1 });
  }
  protected onDeath(_info: DamageInfo): void { /* boss */ }

  remove(): void {
    if (this.removed) return;
    this.removed = true; this.alive = false;
    this.unflash();
    this.model.root.removeFromParent();
  }

  // ---------- perception ----------

  alertTo(p: THREE.Vector3, direct: boolean): void {
    if (!this.alive) return;
    this.lastKnown.copy(p);
    if (direct) { if (this.state !== 'combat') this.enterCombat(); }
    else if (this.state !== 'combat') { this.state = 'alert'; this.stateT = 0; this.hasDest = false; }
  }

  protected enterCombat(): void {
    if (this.state === 'combat') return;
    this.state = 'combat'; this.stateT = 0; this.lostT = 0; this.tacticT = 0; this.hasDest = false;
    this.cdT = Math.max(this.cdT, this.g.diff.reaction + Math.random() * 0.5);
    this.firstBurst = true;
    this.g.audio.enemyAlert(this.kind, this.pos);
    this.g.combat.alertNear(this.pos, 14, this.lastKnown);
  }

  protected perceive(dt: number): void {
    const g = this.g, p = g.player;
    this.percT -= dt;
    if (this.percT > 0) return;
    const step = 0.16; this.percT = step;
    this.canSee = false;
    this.tgtAlly = null;
    // alliés proches (compagnons spectraux) : peuvent détourner l'attention
    if (this.state === 'combat' || this.state === 'alert') {
      let bd = 14;
      for (const a of g.allies) { if (!a.alive || !a.taunts) continue; const d = a.pos.distanceTo(this.pos); if (d < bd && (d < p.pos.distanceTo(this.pos) * 0.8 || p.cloaked)) { bd = d; this.tgtAlly = a; } }
    }
    if (p.dead) return;
    const dx = p.pos.x - this.pos.x, dz = p.pos.z - this.pos.z, dy = p.pos.y - this.pos.y;
    const dist = Math.hypot(dx, dz, dy);
    if (dist > this.def.sight * (this.state === 'combat' ? 1.25 : 1)) return;
    if (p.cloaked && dist > 3) return;
    if (this.state !== 'combat') {
      const fx = -Math.sin(this.yaw), fz = -Math.cos(this.yaw);
      const dot = (dx * fx + dz * fz) / (Math.hypot(dx, dz) || 1);
      if (dot < Math.cos(THREE.MathUtils.degToRad(this.def.fov)) && dist > 4) return;
    }
    _a.set(this.pos.x, this.eyeY, this.pos.z);
    _b.set(p.pos.x, p.pos.y + p.eye * 0.9, p.pos.z);
    if (!g.level!.world.los(_a, _b)) {
      _b.y = p.pos.y + 0.5;
      if (!g.level!.world.los(_a, _b)) return;
    }
    this.canSee = true;
    this.lastKnown.copy(p.pos);
    if (this.state !== 'combat') {
      // délai de détection : plus rapide de près, plus lent si le joueur est accroupi
      const rate = (dist < 8 ? 4 : dist < 20 ? 1.6 : 0.9) * (p.crouching ? 0.55 : 1) * (this.state === 'alert' || this.state === 'search' ? 2 : 1);
      this.seeT += step * rate;
      if (this.seeT > this.g.diff.reaction + 0.25) this.enterCombat();
    }
  }

  // ---------- navigation ----------

  protected goTo(x: number, z: number): void {
    if (this.hasDest && Math.abs(this.dest.x - x) < 1 && Math.abs(this.dest.z - z) < 1 && this.path) return;
    this.dest.set(x, 0, z); this.hasDest = true; this.path = null; this.repathT = 0;
  }

  /** Avance le long du chemin vers la destination. Retourne true une fois arrivé. */
  protected follow(dt: number, speed: number, faceMove: boolean): boolean {
    if (!this.hasDest || this.static) return true;
    const nav = this.g.level!.world.nav;
    this.repathT -= dt;
    if (!this.path && this.repathT <= 0) {
      this.repathT = 0.5 + Math.random() * 0.4;
      if (this.g.combat.pathBudget > 0) {
        this.g.combat.pathBudget--;
        this.path = nav.findPath(this.pos.x, this.pos.z, this.dest.x, this.dest.z);
        this.pathI = 0;
        if (!this.path) { this.hasDest = false; return true; }
      }
    }
    if (!this.path) return false;
    const wp = this.path[this.pathI];
    const dx = wp.x - this.pos.x, dz = wp.z - this.pos.z, d = Math.hypot(dx, dz);
    if (d < 0.45) {
      this.pathI++;
      if (this.pathI >= this.path.length) { this.path = null; this.hasDest = false; return true; }
      return false;
    }
    this.steer(dx / d, dz / d, speed, dt, faceMove);
    return false;
  }

  protected steer(dx: number, dz: number, speed: number, dt: number, faceMove: boolean): void {
    const sp = speed * this.speedMult;
    const acc = 22 * dt;
    const tx = dx * sp, tz = dz * sp;
    this.vel.x += THREE.MathUtils.clamp(tx - this.vel.x, -acc, acc);
    this.vel.z += THREE.MathUtils.clamp(tz - this.vel.z, -acc, acc);
    if (faceMove && sp > 0.1) this.turnTo(Math.atan2(-dx, -dz), dt, 7);
  }

  protected turnTo(target: number, dt: number, rate: number): void {
    let d = target - this.yaw;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    this.yaw += THREE.MathUtils.clamp(d, -rate * dt, rate * dt);
  }

  protected facePoint(p: THREE.Vector3, dt: number, rate = 8): void { this.turnTo(Math.atan2(-(p.x - this.pos.x), -(p.z - this.pos.z)), dt, rate); }

  protected integrate(dt: number): void {
    const w = this.g.level!.world;
    if (this.def.flying) {
      this.pos.addScaledVector(this.vel, dt);
      if (w.overlaps(this.pos.x, this.pos.y - 0.3, this.pos.z, this.radius, 0.6)) { this.pos.addScaledVector(this.vel, -dt); this.vel.multiplyScalar(-0.3); this.vel.y += 2; }
      this.vel.multiplyScalar(Math.max(0, 1 - 2.5 * dt));
      return;
    }
    this.vel.y -= 19 * dt;
    _d.copy(this.vel).multiplyScalar(dt);
    const res = w.moveCharacter(this.pos, _d, this.radius, Math.min(this.height, 1.8), 0.45, this.grounded);
    this.grounded = res.grounded;
    if (res.grounded) this.vel.y = 0;
    // frottement lorsque rien ne pousse
    const fr = Math.max(0, 1 - (this.grounded ? 9 : 1) * dt);
    if (!this.moving) { this.vel.x *= fr; this.vel.z *= fr; }
    if (this.pos.y < w.killY) { this.takeDamage(99999, { source: 'world', type: 'explosion' }); }
  }
  protected moving = false;

  protected separate(dt: number): void {
    for (const o of this.g.enemies) {
      if (o === this || !o.alive || o.def.flying !== this.def.flying) continue;
      const dx = this.pos.x - o.pos.x, dz = this.pos.z - o.pos.z;
      const min = this.radius + o.radius + 0.15, d2 = dx * dx + dz * dz;
      if (d2 < min * min && d2 > 0.0001) { const d = Math.sqrt(d2), push = (min - d) * 4 * dt; if (!this.static && !this.isBoss) { this.pos.x += (dx / d) * push; this.pos.z += (dz / d) * push; } }
    }
  }

  // ---------- boucle principale ----------

  update(dt: number): void {
    const g = this.g;
    if (!this.alive) { this.updateDeath(dt); return; }
    // altérations
    if (this.burnT > 0) {
      this.burnT -= dt; this.burnTick -= dt;
      if (this.burnTick <= 0) {
        this.burnTick = 0.5;
        this.takeDamage(this.burnDps * 0.5, { source: 'player', type: 'fire', silent: true });
        if (!this.alive) return;
        g.fx.burst(this.center(_a), { count: 4, color: 0xff6a1a, color2: 0xffc04a, speed: 1.2, life: 0.5, size: 0.2, gravity: -3 });
      }
    }
    if (this.slowT > 0) this.slowT -= dt;
    if (this.rootT > 0) this.rootT -= dt;
    if (this.stunT > 0) this.stunT -= dt;
    if (this.markT > 0) this.markT -= dt;
    if (this.revealT > 0) this.revealT -= dt;
    if (this.buffT > 0) this.buffT -= dt;
    if (this.eliteBarT > 0) this.eliteBarT -= dt;
    if (this.flashT > 0) { this.flashT -= dt; if (this.flashT <= 0) this.unflash(); }
    this.flinch = Math.max(0, this.flinch - dt * 4);
    this.model.marker.visible = this.markT > 0 || this.revealT > 0;
    if (this.model.marker.visible) (this.model.marker.material as THREE.SpriteMaterial).color.setHex(this.markT > 0 ? 0xff3a5a : 0xe8d85a);

    this.moving = false;
    this.perceive(dt);
    this.stateT += dt;
    if (this.stunT <= 0) this.think(dt);
    this.separate(dt);
    this.integrate(dt);
    // détection de blocage
    this.stuckT += dt;
    if (this.stuckT > 1.2) {
      if (this.moving && this.pos.distanceTo(this.lastPos) < 0.25) { this.path = null; this.hasDest = false; this.tacticT = 0; }
      this.lastPos.copy(this.pos); this.stuckT = 0;
    }
    // aura du commandant
    if (this.def.aura) {
      this.auraT -= dt;
      if (this.auraT <= 0) { this.auraT = 0.5; for (const e of g.enemies) if (e !== this && e.alive && !e.isBoss && e.pos.distanceTo(this.pos) < 12) e.buffT = 0.8; }
    }
    this.animate(dt);
    this.syncModel();
  }

  protected think(dt: number): void {
    const g = this.g;
    switch (this.state) {
      case 'idle':
        if (this.seeT > 0 && !this.canSee) this.seeT = Math.max(0, this.seeT - dt * 0.5);
        break;
      case 'patrol': {
        if (this.seeT > 0 && !this.canSee) this.seeT = Math.max(0, this.seeT - dt * 0.5);
        if (this.waitT > 0) { this.waitT -= dt; break; }
        const pt = this.patrol[this.patrolI];
        this.goTo(pt.x, pt.z);
        this.moving = true;
        if (this.follow(dt, this.def.speed * 0.45, true)) { this.patrolI = (this.patrolI + 1) % this.patrol.length; this.waitT = 1.5 + Math.random() * 2; }
        break;
      }
      case 'alert':
      case 'search': {
        // se rend à la dernière position connue puis fouille les environs
        if (this.stateT > (this.state === 'alert' ? 12 : 9)) { this.state = this.patrol.length ? 'patrol' : 'idle'; this.seeT = 0; this.hasDest = false; break; }
        if (!this.hasDest) {
          if (this.pos.distanceTo(this.lastKnown) > 3 && this.stateT < 1) this.goTo(this.lastKnown.x, this.lastKnown.z);
          else if (this.waitT <= 0) {
            if (g.level!.world.nav.randomOpen(this.lastKnown.x, this.lastKnown.z, 2, 9, _c)) this.goTo(_c.x, _c.z);
            this.waitT = 1 + Math.random();
          } else { this.waitT -= dt; this.turnTo(this.yaw + 1, dt, 1.5); }
        } else { this.moving = true; this.follow(dt, this.def.speed * (this.state === 'alert' ? 0.8 : 0.6), true); }
        break;
      }
      case 'combat':
        if (this.canSee || this.tgtAlly) this.lostT = 0; else this.lostT += dt;
        if (this.lostT > 4 && !this.static) { this.state = 'search'; this.stateT = 0; this.hasDest = false; this.burstLeft = 0; this.aiming = false; break; }
        this.combat(dt);
        break;
    }
  }

  protected targetPoint(out: THREE.Vector3): THREE.Vector3 {
    if (this.tgtAlly) return out.copy(this.tgtAlly.pos).setY(this.tgtAlly.pos.y + 0.6);
    const p = this.g.player;
    return out.set(p.pos.x, p.pos.y + p.eye * 0.75, p.pos.z);
  }

  protected combat(dt: number): void {
    const g = this.g, p = g.player, d = this.def;
    const tp = this.targetPoint(_c);
    const seeTarget = this.tgtAlly ? true : this.canSee;
    const dist = Math.hypot(tp.x - this.pos.x, tp.z - this.pos.z);
    const speed = d.speed * (this.buffT > 0 ? 1.1 : 1);
    this.cdT -= dt * (this.buffT > 0 ? 1.3 : 1);

    if (d.flying) { this.flyCombat(dt, tp, dist, seeTarget); return; }

    if (d.attack === 'melee') {
      // poursuite et attaque au corps à corps annoncée
      if (this.meleeT > 0) {
        this.meleeT -= dt;
        this.facePoint(tp, dt, 4);
        if (this.meleeT <= 0.18 && !this.meleeHit) {
          this.meleeHit = true;
          const reach = d.maxRange + 0.5;
          if (this.tgtAlly) { if (this.tgtAlly.pos.distanceTo(this.pos) < reach) this.tgtAlly.takeDamage(d.damage); }
          else if (this.pos.distanceTo(p.pos) < reach && Math.abs(p.pos.y - this.pos.y) < 1.8) p.takeDamage(d.damage * g.diff.damage, { from: this.pos, melee: true, attacker: this });
        }
        return;
      }
      this.leapCd -= dt;
      if (this.siege && !this.tgtAlly && this.pos.distanceTo(p.pos) > 9 && this.grounded) {
        if (this.pos.distanceTo(this.siege) > 2.6) { this.moving = true; this.goTo(this.siege.x, this.siege.z); this.follow(dt, speed, true); }
        else this.facePoint(this.siege, dt);
        return;
      }
      const tx = this.tgtAlly ? this.tgtAlly.pos.x : seeTarget ? p.pos.x : this.lastKnown.x, tz = this.tgtAlly ? this.tgtAlly.pos.z : seeTarget ? p.pos.z : this.lastKnown.z;
      if (dist <= d.range && seeTarget) {
        if (this.cdT <= 0) { this.meleeT = 0.5; this.meleeHit = false; this.cdT = d.cooldown * g.diff.cooldown; g.audio.enemyAlert(this.kind, this.pos); }
        this.facePoint(tp, dt);
      } else if (this.kind === 'devourer' && seeTarget && dist > 4.5 && dist < 10 && this.leapCd <= 0 && this.grounded && this.rootT <= 0) {
        // bond
        this.leapCd = 3.5 + Math.random() * 2;
        const l = dist || 1;
        this.vel.x = ((tp.x - this.pos.x) / l) * 13; this.vel.z = ((tp.z - this.pos.z) / l) * 13; this.vel.y = 5.5;
        this.facePoint(tp, dt, 30);
      } else if (this.grounded) {
        this.moving = true;
        if (seeTarget && dist < 6 && g.level!.world.nav.clearLine(this.pos.x, this.pos.z, tx, tz)) { const l = dist || 1; this.steer((tx - this.pos.x) / l, (tz - this.pos.z) / l, speed, dt, true); }
        else { this.goTo(tx, tz); if (this.follow(dt, speed, true)) this.hasDest = false; }
      }
      return;
    }

    // ---- tireurs ----
    this.facePoint(seeTarget ? tp : this.lastKnown, dt, 6);
    // rafale en cours
    if (this.aiming) { this.updateAim(dt, tp, seeTarget); return; }
    if (this.burstLeft > 0) {
      this.burstT -= dt;
      if (this.burstT <= 0) { this.burstT = d.burstGap; this.burstLeft--; this.shoot(tp, seeTarget, dist); if (this.burstLeft <= 0) { this.cdT = d.cooldown * g.diff.cooldown * (0.8 + Math.random() * 0.5); this.firstBurst = false; } }
    } else if (this.cdT <= 0 && seeTarget && dist < d.maxRange && this.stunT <= 0) {
      if (d.attack === 'sniper') { this.aiming = true; this.aimT = 1.5 * (0.6 + 0.4 * g.diff.cooldown); g.audio.warn(this.pos); }
      else if (d.attack === 'orb') { this.aiming = true; this.aimT = 0.7; g.audio.charge(this.pos, 0.7); }
      else { this.burstLeft = d.burst; this.burstT = 0; }
    }

    // ---- déplacements tactiques ----
    if (this.static) return;
    this.tacticT -= dt;
    if (this.kind === 'breaker') {
      // avance inexorablement, bouclier vers la cible
      if (dist > d.range * 0.7) { this.moving = true; this.goTo(seeTarget ? tp.x : this.lastKnown.x, seeTarget ? tp.z : this.lastKnown.z); this.follow(dt, speed, false); }
      return;
    }
    if (this.kind === 'sniper') {
      if (dist < 10 && this.tacticT <= 0) { this.tacticT = 3; if (this.pickPoint(tp, 14, 26, false)) this.inCover = false; }
      if (this.hasDest) { this.moving = true; this.follow(dt, speed, false); }
      return;
    }
    if (this.tacticT <= 0) {
      this.tacticT = 2.2 + Math.random() * 2.2;
      const hurt = this.hp < this.maxHp * 0.55;
      const r = Math.random();
      if (!seeTarget) { this.goTo(this.lastKnown.x, this.lastKnown.z); this.inCover = false; } // reprise de contact
      else if (d.useCover && (hurt || r < 0.4)) { this.inCover = this.pickPoint(tp, 3, 11, true); }
      else if (dist > d.range * 1.5 || r < 0.6) { this.pickPoint(tp, d.range * 0.6, d.range * 1.1, false, true); this.inCover = false; } // se rapproche / contourne
      else { this.pickPoint(_a.copy(this.pos), 2, 5, false); this.inCover = false; } // pas de côté
    }
    if (this.hasDest) { this.moving = true; if (this.follow(dt, speed * (this.burstLeft > 0 ? 0.55 : 1), false)) this.hasDest = false; }
  }

  /** Choisit un point de déplacement : à couvert (sans ligne de vue du joueur) ou offrant une ligne de tir. */
  protected pickPoint(around: THREE.Vector3, rMin: number, rMax: number, cover: boolean, aroundTarget = false): boolean {
    const g = this.g, nav = g.level!.world.nav, p = g.player;
    const cx = aroundTarget ? around.x : this.pos.x, cz = aroundTarget ? around.z : this.pos.z;
    _b.set(p.pos.x, p.pos.y + p.eye, p.pos.z);
    for (let i = 0; i < 7; i++) {
      if (!nav.randomOpen(cx, cz, rMin, rMax, _a, 4)) continue;
      if (Math.hypot(_a.x - p.pos.x, _a.z - p.pos.z) < 4) continue;
      _d.set(_a.x, 1.0, _a.z);
      const los = g.level!.world.los(_b, _d);
      if (cover ? !los : (_d.y = 1.5, g.level!.world.los(_b, _d))) { this.goTo(_a.x, _a.z); return true; }
    }
    return false;
  }

  protected muzzlePos(out: THREE.Vector3): THREE.Vector3 { return this.model.muzzle.getWorldPosition(out); }

  private aimStart = new THREE.Vector3();
  protected updateAim(dt: number, tp: THREE.Vector3, see: boolean): void {
    const g = this.g, d = this.def;
    const before = this.aimT;
    this.aimT -= dt;
    this.muzzlePos(_a);
    if (d.attack === 'sniper') {
      if (!see) { this.aiming = false; this.cdT = 1.2; return; }
      // visée laser visible : avertissement
      g.fx.tracer(_a, tp, 0xff2020, 0.012 + (1 - this.aimT / 1.5) * 0.02, 0.05);
      if (before > 0.35 && this.aimT <= 0.35) this.aimStart.copy(g.player.pos);
      if (this.aimT <= 0) {
        this.aiming = false; this.cdT = d.cooldown * g.diff.cooldown;
        g.audio.enemyShot('sniper', this.pos);
        g.fx.flash(_a, 0xffc080, 20, 0.06);
        // le tir manque si la cible s'est suffisamment déplacée pendant la fin de la visée
        const moved = this.tgtAlly ? 0 : g.player.pos.distanceTo(this.aimStart);
        const hit = moved < 1.7 && !g.player.has('dashing');
        if (hit && !g.combat.fortressBlocks(_a, tp)) {
          g.fx.tracer(_a, tp, 0xffe0c0, 0.05, 0.2);
          if (this.tgtAlly) this.tgtAlly.takeDamage(d.damage); else g.player.takeDamage(d.damage * g.diff.damage, { from: this.pos });
        } else { _b.copy(tp).add(_d.set((Math.random() - 0.5) * 1.6, (Math.random() - 0.5) * 0.8, (Math.random() - 0.5) * 1.6)); this.missTracer(_a, _b); }
      }
    } else {
      // incantation d'orbes
      g.fx.spark(_a.x, _a.y, _a.z, 0xb06aff, 0.3, 0.25);
      if (this.aimT <= 0) { this.aiming = false; this.burstLeft = d.burst; this.burstT = 0; }
    }
  }

  private missTracer(from: THREE.Vector3, toward: THREE.Vector3): void {
    const g = this.g;
    _d.subVectors(toward, from).normalize();
    const h = g.level!.world.raycast(from, _d, 90, 'shoot');
    if (h) { g.fx.tracer(from, h.point, 0xffd0a0, 0.02, 0.07); g.fx.impact(h.point, h.normal, h.collider.surf); }
    else g.fx.tracer(from, _b.copy(from).addScaledVector(_d, 80), 0xffd0a0, 0.02, 0.07);
  }

  protected shoot(tp: THREE.Vector3, see: boolean, dist: number): void {
    const g = this.g, d = this.def, p = g.player;
    this.muzzlePos(_a);
    if (d.attack === 'orb') {
      g.audio.enemyShot('orb', this.pos);
      // légère anticipation du déplacement du joueur
      _b.copy(tp);
      if (!this.tgtAlly) _b.addScaledVector(p.vel, Math.min(0.6, dist / 16) * 0.6);
      _d.subVectors(_b, _a).normalize();
      g.combat.spawnProjectile({ pos: _a, vel: _d.multiplyScalar(15), damage: d.damage * g.diff.damage, radius: 0.28, color: 0xb06aff, owner: 'enemy', life: 5, aoe: 1.6 });
      return;
    }
    g.audio.enemyShot(d.attack === 'laser' ? 'laser' : d.attack, this.pos);
    g.fx.flash(_a, d.attack === 'laser' ? 0xff3030 : 0xffc080, 10, 0.05, 8);
    if (!see) { this.missTracer(_a, _b.copy(this.lastKnown).setY(this.lastKnown.y + 1.2)); return; }
    const pellets = d.attack === 'shotgun' ? 7 : 1;
    for (let i = 0; i < pellets; i++) {
      // probabilité de toucher : distance, mouvement du joueur, difficulté
      let prob = d.accuracy * g.diff.accuracy;
      prob *= dist <= d.range ? 1 : Math.max(0.25, 1 - (dist - d.range) / (d.maxRange - d.range) * 0.75);
      if (!this.tgtAlly) {
        if (p.sliding || !p.grounded) prob *= 0.5; else if (p.sprinting) prob *= 0.6; else if (p.speedNow > 3) prob *= 0.8;
        if (p.crouching && !p.sliding) prob *= 0.85;
      }
      if (this.firstBurst) prob *= 0.55;
      if (this.buffT > 0) prob *= 1.2;
      if (this.slowT > 0) prob *= 0.7;
      prob = Math.min(0.92, Math.max(0.04, prob));
      const col = d.attack === 'laser' ? 0xff4040 : 0xffd0a0;
      if (Math.random() < prob && !g.combat.fortressBlocks(_a, tp)) {
        g.fx.tracer(_a, tp, col, 0.02, 0.07);
        if (this.tgtAlly) this.tgtAlly.takeDamage(d.damage); else p.takeDamage(d.damage * g.diff.damage, { from: this.pos });
      } else {
        _b.copy(tp).add(_d.set((Math.random() - 0.5) * 2.4, (Math.random() - 0.3) * 1.6, (Math.random() - 0.5) * 2.4));
        this.missTracer(_a, _b);
      }
    }
  }

  protected flyCombat(dt: number, tp: THREE.Vector3, dist: number, see: boolean): void {
    const g = this.g, d = this.def;
    this.hover += dt;
    // orbite autour de la cible à distance idéale
    const ang = this.hover * 0.5 + this.walkPhase;
    const tx = tp.x + Math.cos(ang) * d.range * 0.8, tz = tp.z + Math.sin(ang) * d.range * 0.8;
    const ground = Math.max(0, g.level!.world.groundAt(this.pos.x, this.pos.z, this.pos.y + 1));
    const ty = Math.max(ground + 2.4, tp.y + 1.6) + Math.sin(this.hover * 1.7) * 0.5;
    _b.set(tx - this.pos.x, ty - this.pos.y, tz - this.pos.z);
    const l = _b.length();
    if (l > 0.5) this.vel.addScaledVector(_b.multiplyScalar(1 / l), d.speed * 3 * dt * this.speedMult);
    this.facePoint(tp, dt, 6);
    if (this.aiming) {
      this.aimT -= dt;
      this.muzzlePos(_a); g.fx.spark(_a.x, _a.y, _a.z, 0xff3030, 0.22, 0.15);
      if (this.aimT <= 0) { this.aiming = false; this.burstLeft = d.burst; this.burstT = 0; }
    } else if (this.burstLeft > 0) {
      this.burstT -= dt;
      if (this.burstT <= 0) { this.burstT = d.burstGap; this.burstLeft--; this.shoot(tp, see, dist); if (this.burstLeft <= 0) { this.cdT = d.cooldown * g.diff.cooldown * (0.8 + Math.random() * 0.4); this.firstBurst = false; } }
    } else if (this.cdT <= 0 && see && dist < d.maxRange) { this.aiming = true; this.aimT = 0.55; g.audio.charge(this.pos, 0.5); }
  }

  // ---------- animation ----------

  protected animate(dt: number): void {
    const m = this.model;
    const sp = Math.hypot(this.vel.x, this.vel.z);
    this.walkPhase += dt * (3 + sp * 2.4);
    const sw = Math.min(1, sp / 3) * 0.7;
    if (m.legL && m.legR) { m.legL.rotation.x = Math.sin(this.walkPhase) * sw; m.legR.rotation.x = -Math.sin(this.walkPhase) * sw; }
    if (this.kind === 'devourer') {
      for (let i = 0; i < 4; i++) m.extra[i].rotation.x = Math.sin(this.walkPhase * 1.6 + (i % 2 ? Math.PI : 0) + (i > 1 ? 1.2 : 0)) * (0.2 + sw * 0.9);
      m.extra[4].rotation.y = Math.sin(this.walkPhase * 0.8) * 0.4;
      m.body.position.y = 0.62 + Math.abs(Math.sin(this.walkPhase * 1.6)) * 0.06 * sw - (this.meleeT > 0 ? Math.sin((1 - this.meleeT / 0.5) * Math.PI) * 0.12 : 0);
      m.body.rotation.x = this.meleeT > 0 ? Math.sin((1 - this.meleeT / 0.5) * Math.PI) * 0.5 : this.grounded ? 0 : -0.35;
    } else if (this.kind === 'drone') {
      for (const r of m.extra) r.rotation.y += dt * 40;
      m.body.rotation.z = THREE.MathUtils.clamp(-this.vel.x * 0.04, -0.4, 0.4); m.body.rotation.x = THREE.MathUtils.clamp(this.vel.z * 0.04, -0.4, 0.4);
    } else {
      m.body.rotation.x = -this.flinch * 0.25 + (sp > 2.5 ? 0.12 : 0);
      m.body.position.y = Math.abs(Math.sin(this.walkPhase)) * 0.03 * sw;
      if (this.kind === 'sentinel') {
        const k = this.meleeT > 0 ? 1 - this.meleeT / 0.5 : 0;
        m.armR!.rotation.x = this.meleeT > 0 ? -2.6 + k * 3.4 : Math.sin(this.walkPhase) * 0.3;
        m.armL!.rotation.x = -Math.sin(this.walkPhase) * 0.3;
        m.extra[0].rotation.y += dt * 2;
      } else if (this.kind === 'caster') {
        m.extra[0].rotation.y += dt * 3;
        for (let i = 1; i < 4; i++) { const a = this.walkPhase * 0.4 + i * 2.1; m.extra[i].position.set(Math.cos(a) * 0.55, 1.5 + Math.sin(a * 1.3) * 0.2, Math.sin(a) * 0.55); m.extra[i].rotation.y += dt * 2; }
        if (this.aiming) m.armR!.rotation.x = -2.2; else m.armR!.rotation.x += (-1.0 - m.armR!.rotation.x) * Math.min(1, dt * 6);
      } else if (this.kind === 'commander') {
        m.extra[0].scale.setScalar(11 + Math.sin(this.walkPhase) * 0.6);
        (m.extra[0] as THREE.Mesh).rotation.y += dt;
      }
      // l'arme suit la visée en combat, baissée sinon
      if (m.armR && this.kind !== 'sentinel' && this.kind !== 'caster') {
        const aim = this.state === 'combat' ? -1.15 : -0.75;
        m.armR.rotation.x += (aim - m.armR.rotation.x) * Math.min(1, dt * 6);
      }
    }
    if (this.stunT > 0) m.body.rotation.z = Math.sin(this.walkPhase * 3) * 0.12; else if (this.kind !== 'drone') m.body.rotation.z = 0;
  }

  protected syncModel(): void {
    const r = this.model.root;
    r.position.copy(this.pos);
    r.rotation.y = this.yaw;
  }

  protected updateDeath(dt: number): void {
    if (this.removed) return;
    this.deathT += dt;
    const r = this.model.root;
    if (this.def.flying) {
      this.vel.y -= 14 * dt; this.pos.addScaledVector(this.vel, dt); r.position.copy(this.pos); r.rotation.z += dt * 5;
      if (this.deathT > 1.2 || this.pos.y < 0.2) this.remove();
      return;
    }
    const k = Math.min(1, this.deathT / 0.45);
    if (this.kind === 'devourer') { r.rotation.z = k * 1.5; r.position.y = this.pos.y - k * 0.2; }
    else { r.rotation.x = k * k * 1.5; r.position.y = this.pos.y + Math.sin(k * Math.PI) * 0.1 - k * 0.05; }
    if (this.deathT > 5) { r.position.y -= (this.deathT - 5) * 0.5; }
    if (this.deathT > 7) this.remove();
  }
}

function raySphere(o: THREE.Vector3, d: THREE.Vector3, cx: number, cy: number, cz: number, r: number): number | null {
  const ox = o.x - cx, oy = o.y - cy, oz = o.z - cz;
  const b = ox * d.x + oy * d.y + oz * d.z, c = ox * ox + oy * oy + oz * oz - r * r;
  const disc = b * b - c;
  if (disc < 0) return null;
  const t = -b - Math.sqrt(disc);
  return t > 0 ? t : null;
}

function rayCylinder(o: THREE.Vector3, d: THREE.Vector3, cx: number, cz: number, r: number, y0: number, y1: number): number | null {
  const ox = o.x - cx, oz = o.z - cz;
  const a = d.x * d.x + d.z * d.z;
  if (a < 1e-8) return null;
  const b = ox * d.x + oz * d.z, c = ox * ox + oz * oz - r * r;
  const disc = b * b - a * c;
  if (disc < 0) return null;
  const t = (-b - Math.sqrt(disc)) / a;
  if (t <= 0) return null;
  const y = o.y + d.y * t;
  if (y < y0 || y > y1) {
    // test des capuchons
    const ty = d.y !== 0 ? ((d.y < 0 ? y1 : y0) - o.y) / d.y : -1;
    if (ty > 0) { const px = ox + d.x * ty, pz = oz + d.z * ty; if (px * px + pz * pz <= r * r) return ty; }
    return null;
  }
  return t;
}
