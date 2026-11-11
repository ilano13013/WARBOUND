// Contrôleur FPS : déplacements, sprint tactique, glissade, franchissement, caméra, santé, énergie et buffs.
import * as THREE from 'three';
import type { Game } from '../core/Game';
import { CLASSES, type ClassDef } from '../data/classes';
import { gatherMods } from '../rpg/Stats';

const WALK = 5.5, SPRINT = 8.0, TAC = 9.8, CROUCH = 2.9, GRAV = 19, JUMP = 6.4;
const H_STAND = 1.8, H_CROUCH = 1.15, EYE_STAND = 1.65, EYE_CROUCH = 1.0, EYE_SLIDE = 0.72;

export interface HurtInfo { from?: THREE.Vector3; type?: string; melee?: boolean; attacker?: any; pierce?: boolean }

export class Player {
  pos = new THREE.Vector3();
  vel = new THREE.Vector3();
  yaw = 0; pitch = 0;
  radius = 0.36; height = H_STAND; eye = EYE_STAND;
  grounded = false; crouching = false; sprinting = false; moving = false;
  slideT = 0; slideCd = 0; private slideDir = new THREE.Vector3();
  tacT = 0; tacCd = 0; noSprintT = 0;
  private mantleT = 0; private mantleFrom = new THREE.Vector3(); private mantleTo = new THREE.Vector3();
  hp = 100; maxHp = 100; shield = 0; shieldT = 0;
  energy = 100; maxEnergy = 100; ult = 0;
  buffs = new Map<string, number>();
  cds = [0, 0, 0]; cdMax = [1, 1, 1];
  grenades = 2; grenadeCd = 0;
  dead = false; invuln = 0; lastHurt = -99; lastShot = -99;
  cls!: ClassDef;
  mods: Record<string, number> = {};
  legends = new Set<string>();
  slow = 0; // ralentissement infligé par les ennemis (temps restant)
  killStacks = 0; killStackT = 0;
  secondWindUsed = false;
  godMode = false;
  // caméra
  private bob = 0; private bobAmp = 0; landDip = 0; private roll = 0; shakeAmt = 0; private fovCur = 100;
  private stepDist = 0; private eyeSmoothY = 0;
  private recoilPending = new THREE.Vector2(); private recoilAccum = 0;
  lastSafe = new THREE.Vector3(); private safeT = 0;
  airTime = 0; private wasDashing = false;
  cloaked = false;
  speedNow = 0;
  private tmp = new THREE.Vector3(); private wish = new THREE.Vector3(); private delta = new THREE.Vector3();

  constructor(private g: Game) {}

  /** Recalcule les statistiques à partir du profil (talents, équipement). */
  refreshStats(full = false): void {
    const p = this.g.profile!;
    this.cls = CLASSES[p.classId];
    const m = gatherMods(p);
    this.mods = m.mods; this.legends = m.legends;
    const oldMax = this.maxHp;
    this.maxHp = Math.round(this.cls.hp + (this.mods.maxHp || 0));
    this.maxEnergy = Math.round(this.cls.energy + (this.mods.maxEnergy || 0));
    if (full) { this.hp = this.maxHp; this.energy = this.maxEnergy; } else { this.hp = Math.min(this.maxHp, this.hp + Math.max(0, this.maxHp - oldMax)); this.energy = Math.min(this.energy, this.maxEnergy); }
    for (let i = 0; i < 3; i++) this.cdMax[i] = this.cls.skills[i].cd * Math.max(0.4, 1 - (this.mods.cdr || 0) - (this.mods['cd' + (i + 1)] || 0));
  }

  mod(k: string): number { return this.mods[k] || 0; }
  has(b: string): boolean { return (this.buffs.get(b) || 0) > 0; }
  addBuff(b: string, t: number): void { this.buffs.set(b, Math.max(this.buffs.get(b) || 0, t)); }
  clearBuff(b: string): void { this.buffs.delete(b); }

  spawn(pos: THREE.Vector3, yaw: number, full = true): void {
    this.pos.copy(pos); this.vel.set(0, 0, 0); this.yaw = yaw; this.pitch = 0;
    this.dead = false; this.crouching = false; this.slideT = 0; this.height = H_STAND; this.eye = EYE_STAND; this.mantleT = 0;
    this.buffs.clear(); this.shield = 0; this.slow = 0; this.invuln = 1.5; this.cloaked = false;
    this.lastSafe.copy(pos); this.eyeSmoothY = pos.y;
    this.recoilPending.set(0, 0); this.recoilAccum = 0; this.shakeAmt = 0; this.landDip = 0;
    if (full) { this.hp = this.maxHp; this.energy = this.maxEnergy; this.cds = [0, 0, 0]; this.grenades = 2; this.secondWindUsed = false; }
  }

  heal(amount: number, overhealToShield = false): number {
    if (this.dead) return 0;
    amount *= 1 + this.mod('healPower');
    const before = this.hp;
    this.hp = Math.min(this.maxHp, this.hp + amount);
    const used = this.hp - before;
    const extra = amount - used;
    if (extra > 0 && (overhealToShield || this.mod('overheal') > 0)) {
      const cap = overhealToShield ? 120 : this.mod('overheal');
      if (this.shield < cap) { this.shield = Math.min(cap, this.shield + extra); this.shieldT = 8; }
    }
    return used;
  }

  addEnergy(v: number): void { this.energy = Math.min(this.maxEnergy, this.energy + v); }
  addUlt(v: number): void {
    const before = this.ult;
    this.ult = Math.min(100, this.ult + v * (1 + this.mod('ultCharge')));
    if (before < 100 && this.ult >= 100) { this.g.audio.skill('ultReady'); this.g.ui.hud.toast('CAPACITÉ ULTIME PRÊTE', this.cls.css); }
  }

  /** Réduction totale des dégâts (0..0.9). */
  private reduction(): number {
    let dr = this.mod('dr');
    if (this.has('armor')) dr += 0.5;
    if (this.has('colossus')) dr += 0.7;
    if (this.has('rebirth')) dr += 0.3;
    if (this.mod('lowHpDr') && this.hp < this.maxHp * 0.3) dr += this.mod('lowHpDr');
    return Math.min(0.88, dr);
  }

  takeDamage(amount: number, info: HurtInfo = {}): number {
    if (this.dead || this.godMode) return 0;
    if (this.invuln > 0 || this.has('dashing')) return 0;
    const g = this.g;
    amount *= 1 - this.reduction();
    // Égide : bouclier frontal
    if (this.has('aegis') && info.from && !info.pierce) {
      this.tmp.subVectors(info.from, this.pos).setY(0).normalize();
      const fx = -Math.sin(this.yaw), fz = -Math.cos(this.yaw);
      if (this.tmp.x * fx + this.tmp.z * fz > 0.25) {
        const pool = this.buffs.get('aegisPool') || 0;
        const abs = Math.min(pool, amount);
        this.buffs.set('aegisPool', pool - abs);
        amount -= abs;
        g.audio.shieldHit();
        g.ui.hud.flashShield();
        if (pool - abs <= 0) { this.clearBuff('aegis'); this.clearBuff('aegisPool'); }
        if (amount <= 0.01) return 0;
      }
    }
    if (this.mod('manaShield') > 0 && this.energy > 0) {
      const part = Math.min(this.energy, amount * this.mod('manaShield'));
      this.energy -= part; amount -= part;
    }
    if (this.shield > 0) {
      const abs = Math.min(this.shield, amount);
      this.shield -= abs; amount -= abs;
      g.audio.shieldHit();
    }
    if (info.melee && this.legends.has('thorns') && info.attacker?.takeDamage) info.attacker.takeDamage(30, { source: 'player', type: 'arcane' });
    if (amount <= 0) return 0;
    this.hp -= amount;
    this.lastHurt = g.time;
    this.shakeAmt = Math.min(1, this.shakeAmt + amount / 60);
    g.audio.hurt();
    g.ui.hud.damageIndicator(info.from ? Math.atan2(info.from.x - this.pos.x, info.from.z - this.pos.z) - this.yaw + Math.PI : null, amount);
    if (g.mission) g.mission.stats.damageTaken += amount;
    if (this.hp <= 0) {
      if (this.legends.has('secondwind') && !this.secondWindUsed) {
        this.secondWindUsed = true; this.hp = this.maxHp * 0.5; this.invuln = 3;
        g.ui.hud.toast('SECOND SOUFFLE', '#ff9a2a'); g.audio.skill('rebirth');
        g.fx.ring(this.pos, 0.5, 6, 0xff9a2a, 0.6);
        return amount;
      }
      this.hp = 0; this.dead = true;
      g.onPlayerDeath();
    }
    return amount;
  }

  /** Recul réel appliqué à la visée (degrés). */
  kick(pitchDeg: number, yawDeg: number): void {
    this.recoilPending.x += THREE.MathUtils.degToRad(pitchDeg);
    this.recoilPending.y += THREE.MathUtils.degToRad(yawDeg);
  }

  get eyePos(): THREE.Vector3 { return this.g.r.camera.position; }
  forward(out: THREE.Vector3): THREE.Vector3 {
    const cp = Math.cos(this.pitch);
    return out.set(-Math.sin(this.yaw) * cp, Math.sin(this.pitch), -Math.cos(this.yaw) * cp);
  }

  get sliding(): boolean { return this.slideT > 0; }
  get tactical(): boolean { return this.tacT > 0 && this.sprinting; }

  update(dt: number): void {
    const g = this.g, inp = g.input, world = g.level!.world;
    for (const [k, v] of this.buffs) { if (k === 'aegisPool') continue; const n = v - dt; if (n <= 0) this.buffs.delete(k); else this.buffs.set(k, n); }
    if (!this.has('aegis')) this.buffs.delete('aegisPool');
    for (let i = 0; i < 3; i++) if (this.cds[i] > 0) this.cds[i] = Math.max(0, this.cds[i] - dt);
    if (this.invuln > 0) this.invuln -= dt;
    if (this.slow > 0) this.slow -= dt;
    if (this.slideCd > 0) this.slideCd -= dt;
    if (this.tacCd > 0) this.tacCd -= dt;
    if (this.noSprintT > 0) this.noSprintT -= dt;
    if (this.shieldT > 0) { this.shieldT -= dt; if (this.shieldT <= 0) this.shield = 0; }
    if (this.killStackT > 0) { this.killStackT -= dt; if (this.killStackT <= 0) this.killStacks = 0; }
    if (this.grenades < 2) { this.grenadeCd -= dt; if (this.grenadeCd <= 0) { this.grenades++; this.grenadeCd = 22; } }
    if (this.dead) { this.eye += (0.35 - this.eye) * Math.min(1, dt * 3); this.updateCamera(dt, 0); return; }

    // régénération
    this.addEnergyRegen(dt);
    const regenDelay = g.diff.regenDelay;
    if (g.time - this.lastHurt > regenDelay && this.hp < this.maxHp * 0.6) this.hp = Math.min(this.maxHp * 0.6, this.hp + 9 * dt);
    if (this.mod('hpRegen')) this.hp = Math.min(this.maxHp, this.hp + this.mod('hpRegen') * dt);

    // visée
    const sens = 0.0022 * g.settings.sens * (g.weapons.adsK > 0.5 ? 0.35 + 0.65 * g.weapons.zoomNow : 1);
    this.yaw -= inp.mouseDX * sens;
    const dp = inp.mouseDY * sens;
    this.pitch -= dp;
    if (dp > 0 && this.recoilAccum > 0) this.recoilAccum = Math.max(0, this.recoilAccum - dp);
    // application progressive du recul
    const k = Math.min(1, dt * 28);
    const rp = this.recoilPending.x * k, ry = this.recoilPending.y * k;
    this.pitch += rp; this.yaw += ry; this.recoilPending.x -= rp; this.recoilPending.y -= ry; this.recoilAccum += rp;
    if (g.time - this.lastShot > 0.14 && this.recoilAccum > 0) {
      const rec = Math.min(this.recoilAccum, (this.recoilAccum * 7 + 0.01) * dt);
      this.pitch -= rec * 0.75; this.recoilAccum -= rec;
    }
    this.pitch = Math.max(-1.5, Math.min(1.5, this.pitch));

    if (this.mantleT > 0) { this.updateMantle(dt); this.updateCamera(dt, 0); return; }

    // direction souhaitée
    const f = (inp.held('forward') ? 1 : 0) - (inp.held('back') ? 1 : 0);
    const s = (inp.held('right') ? 1 : 0) - (inp.held('left') ? 1 : 0);
    const sin = Math.sin(this.yaw), cos = Math.cos(this.yaw);
    this.wish.set(-sin * f + cos * s, 0, -cos * f - sin * s);
    const wl = this.wish.length();
    if (wl > 0) this.wish.multiplyScalar(1 / wl);
    this.moving = wl > 0;

    // sprint / sprint tactique
    const wantSprint = inp.held('sprint') && f > 0 && !this.crouching && !this.sliding && g.weapons.adsK < 0.3 && this.noSprintT <= 0;
    if (inp.doubleSprint && this.tacCd <= 0 && f > 0) { this.tacT = 3.2; this.tacCd = 6; }
    if (this.tacT > 0) { this.tacT -= dt; if (!wantSprint) this.tacT = 0; }
    this.sprinting = wantSprint && this.grounded || (wantSprint && this.sprinting);
    if (!wantSprint) this.sprinting = false;

    // accroupissement / glissade
    const crouchHeld = inp.held('crouch');
    if (inp.pressed('crouch') && this.sprinting && this.grounded && this.slideCd <= 0 && this.speedNow > 6) {
      this.slideT = 0.75; this.slideCd = 1.0;
      this.slideDir.copy(this.vel).setY(0).normalize();
      const sp = Math.min(12, this.speedNow * 1.3);
      this.vel.x = this.slideDir.x * sp; this.vel.z = this.slideDir.z * sp;
      this.sprinting = false; this.tacT = 0;
      g.audio.slide();
      if (this.legends.has('slidecharge')) this.addBuff('slidecharge', 3.75);
    }
    if (this.slideT > 0) {
      this.slideT -= dt;
      if (this.slideT <= 0 || this.speedNow < 2.5) { this.slideT = 0; this.crouching = crouchHeld; }
    }
    const wantCrouch = (crouchHeld && !this.sprinting) || this.sliding;
    if (wantCrouch && !this.crouching) { this.crouching = true; }
    else if (!wantCrouch && this.crouching) {
      if (!world.overlaps(this.pos.x, this.pos.y + 0.02, this.pos.z, this.radius, H_STAND)) this.crouching = false;
    }
    this.height = this.crouching ? H_CROUCH : H_STAND;

    // vitesse cible
    let speed = this.sprinting ? (this.tacT > 0 ? TAC : SPRINT) : this.crouching ? CROUCH : WALK;
    speed *= this.cls.speed * g.weapons.mobility * (1 + this.mod('moveSpeed'));
    if (g.weapons.adsK > 0.3 && !this.sprinting) speed *= 0.62;
    if (this.slow > 0) speed *= 0.6;
    if (this.has('cloak')) speed *= 1.15;
    if (this.has('colossus')) speed *= 0.9;
    if (f < 0) speed *= 0.82;

    const dashing = this.has('dashing');
    if (this.wasDashing && !dashing) { const hs = Math.hypot(this.vel.x, this.vel.z); if (hs > SPRINT) { this.vel.x *= SPRINT / hs; this.vel.z *= SPRINT / hs; } }
    this.wasDashing = dashing;
    if (dashing) { /* la ruée conserve sa vélocité */ }
    else if (this.sliding) {
      const fr = Math.max(0, 1 - 1.5 * dt);
      this.vel.x *= fr; this.vel.z *= fr;
      // léger contrôle directionnel
      this.vel.x += this.wish.x * 3 * dt; this.vel.z += this.wish.z * 3 * dt;
    } else if (this.grounded) {
      const tx = this.wish.x * speed, tz = this.wish.z * speed;
      const accel = (wl > 0 ? 55 : 40) * dt;
      const dx = tx - this.vel.x, dz = tz - this.vel.z;
      const dl = Math.hypot(dx, dz);
      if (dl <= accel) { this.vel.x = tx; this.vel.z = tz; } else { this.vel.x += (dx / dl) * accel; this.vel.z += (dz / dl) * accel; }
    } else {
      // contrôle aérien modéré
      const a = 14 * dt;
      this.vel.x += this.wish.x * a; this.vel.z += this.wish.z * a;
      const hs = Math.hypot(this.vel.x, this.vel.z), cap = Math.max(speed, 6.5);
      if (hs > cap) { const d = Math.max(cap / hs, 1 - 2 * dt); this.vel.x *= d; this.vel.z *= d; }
    }

    // saut / franchissement
    if (inp.pressed('jump')) {
      if (this.tryMantle()) { /* franchissement lancé */ }
      else if (this.grounded || this.airTime < 0.12) {
        this.vel.y = JUMP; this.grounded = false; this.airTime = 1;
        if (this.sliding) { this.slideT = 0; this.crouching = false; }
        g.audio.jump();
      }
    } else if (inp.held('jump') && !this.grounded && this.vel.y < 1) this.tryMantle();

    if (!dashing) this.vel.y -= GRAV * dt;
    if (this.vel.y < -40) this.vel.y = -40;
    const wasGrounded = this.grounded, vyBefore = this.vel.y;
    this.delta.copy(this.vel).multiplyScalar(dt);
    const res = world.moveCharacter(this.pos, this.delta, this.radius, this.height, 0.42, wasGrounded);
    if (res.grounded) {
      if (!wasGrounded && vyBefore < -5) { this.landDip = Math.min(0.25, -vyBefore * 0.018); g.audio.land(); if (vyBefore < -17) this.takeDamage((-vyBefore - 17) * 4, { pierce: true }); }
      this.vel.y = 0; this.grounded = true; this.airTime = 0;
    } else { this.grounded = false; this.airTime += dt; if (res.ceil && this.vel.y > 0) this.vel.y = 0; }
    this.speedNow = Math.hypot(this.vel.x, this.vel.z);
    if (res.wall && this.sliding && this.speedNow < 3) this.slideT = 0.01;

    // dernière position sûre et chute hors du monde
    this.safeT -= dt;
    if (this.grounded && this.safeT <= 0) { this.lastSafe.copy(this.pos); this.safeT = 1.5; }
    if (this.pos.y < world.killY) { this.pos.copy(this.lastSafe); this.pos.y += 0.2; this.vel.set(0, 0, 0); this.takeDamage(20, { pierce: true }); }

    // bruits de pas
    if (this.grounded && this.speedNow > 1.5 && !this.sliding) {
      this.stepDist += this.speedNow * dt;
      const stride = this.sprinting ? 2.6 : 2.1;
      if (this.stepDist > stride) { this.stepDist = 0; if (!this.cloaked) g.audio.footstep(this.surfaceBelow(), this.sprinting); }
    }
    this.updateCamera(dt, s);
  }

  private addEnergyRegen(dt: number): void {
    this.energy = Math.min(this.maxEnergy, this.energy + 5.5 * (1 + this.mod('energyRegen')) * dt);
  }

  private surfaceBelow(): string {
    const w = this.g.level!.world;
    for (const c of w.query(this.pos.x - 0.1, this.pos.z - 0.1, this.pos.x + 0.1, this.pos.z + 0.1)) {
      if (this.pos.x >= c.minX && this.pos.x <= c.maxX && this.pos.z >= c.minZ && this.pos.z <= c.maxZ && Math.abs(c.maxY - this.pos.y) < 0.1) return c.surf;
    }
    return 'concrete';
  }

  private tryMantle(): boolean {
    if (this.mantleT > 0) return false;
    const w = this.g.level!.world;
    const fx = -Math.sin(this.yaw), fz = -Math.cos(this.yaw);
    const px = this.pos.x + fx * (this.radius + 0.45), pz = this.pos.z + fz * (this.radius + 0.45);
    let top = -Infinity;
    for (const c of w.query(px - 0.2, pz - 0.2, px + 0.2, pz + 0.2)) {
      if (!c.walk) continue;
      if (px + 0.2 > c.minX && px - 0.2 < c.maxX && pz + 0.2 > c.minZ && pz - 0.2 < c.maxZ && c.maxY > this.pos.y + 0.45 && c.minY < this.pos.y + 1.7) top = Math.max(top, c.maxY);
    }
    const up = top - this.pos.y;
    if (up < 0.45 || up > 1.75) return false;
    const tx = this.pos.x + fx * (this.radius + 0.5), tz = this.pos.z + fz * (this.radius + 0.5);
    if (w.overlaps(tx, top + 0.03, tz, this.radius, H_CROUCH)) return false;
    if (w.overlaps(this.pos.x, top + 0.03, this.pos.z, this.radius, H_CROUCH)) return false;
    this.mantleFrom.copy(this.pos); this.mantleTo.set(tx, top + 0.03, tz);
    this.mantleT = 0.0001; this.vel.set(fx * 3, 0, fz * 3);
    this.slideT = 0; this.sprinting = false;
    this.g.audio.jump();
    this.g.weapons.lower(0.3);
    return true;
  }

  private updateMantle(dt: number): void {
    const dur = 0.3;
    this.mantleT += dt;
    const k = Math.min(1, this.mantleT / dur);
    const ky = Math.min(1, k * 1.5), kxz = Math.max(0, (k - 0.35) / 0.65);
    this.pos.x = this.mantleFrom.x + (this.mantleTo.x - this.mantleFrom.x) * kxz;
    this.pos.z = this.mantleFrom.z + (this.mantleTo.z - this.mantleFrom.z) * kxz;
    this.pos.y = this.mantleFrom.y + (this.mantleTo.y - this.mantleFrom.y) * ky;
    if (k >= 1) { this.mantleT = 0; this.grounded = true; this.vel.y = 0; this.crouching = this.g.level!.world.overlaps(this.pos.x, this.pos.y, this.pos.z, this.radius, H_STAND) !== null; this.height = this.crouching ? H_CROUCH : H_STAND; }
  }

  private updateCamera(dt: number, strafe: number): void {
    const g = this.g, cam = g.r.camera, reduce = g.settings.reduceMotion;
    const targetEye = this.dead ? this.eye : this.sliding ? EYE_SLIDE : this.crouching ? EYE_CROUCH : EYE_STAND;
    this.eye += (targetEye - this.eye) * Math.min(1, dt * 12);
    // lissage vertical pour la montée des marches
    if (Math.abs(this.pos.y - this.eyeSmoothY) > 1.2 || !this.grounded) this.eyeSmoothY = this.pos.y;
    else this.eyeSmoothY += (this.pos.y - this.eyeSmoothY) * Math.min(1, dt * 16);
    const sp = this.grounded && !this.sliding ? this.speedNow : 0;
    this.bob += dt * (6 + sp * 1.25);
    const ampT = sp > 0.5 ? Math.min(1, sp / 8) : 0;
    this.bobAmp += (ampT - this.bobAmp) * Math.min(1, dt * 8);
    const amp = reduce ? 0 : this.bobAmp;
    this.landDip = Math.max(0, this.landDip - dt * 1.4);
    const rollT = reduce ? 0 : -strafe * 0.018 + (this.sliding ? 0.07 : 0);
    this.roll += (rollT - this.roll) * Math.min(1, dt * 9);
    this.shakeAmt = Math.max(0, this.shakeAmt - dt * 2.8);
    const sh = reduce ? this.shakeAmt * 0.25 : this.shakeAmt;
    cam.position.set(
      this.pos.x + (Math.random() - 0.5) * sh * 0.08,
      this.eyeSmoothY + this.eye + Math.sin(this.bob * 2) * 0.035 * amp - (reduce ? this.landDip * 0.3 : this.landDip) + (Math.random() - 0.5) * sh * 0.08,
      this.pos.z + (Math.random() - 0.5) * sh * 0.08,
    );
    cam.rotation.order = 'YXZ';
    cam.rotation.set(this.pitch + (Math.random() - 0.5) * sh * 0.02, this.yaw + Math.cos(this.bob) * 0.0025 * amp, this.roll + (Math.random() - 0.5) * sh * 0.02);
    // champ de vision dynamique
    let fov = g.settings.fov;
    if (this.sprinting && !reduce) fov += this.tacT > 0 ? 9 : 5;
    if (this.sliding && !reduce) fov += 6;
    if (this.has('dashing') && !reduce) fov += 12;
    const hfovScale = g.weapons.zoomNow;
    fov = THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(fov) / 2) * hfovScale));
    this.fovCur += (fov - this.fovCur) * Math.min(1, dt * 14);
    // le FOV configuré est horizontal (convention FPS) : conversion en vertical
    const v = THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(this.fovCur) / 2) / cam.aspect));
    if (Math.abs(cam.fov - v) > 0.01) { cam.fov = v; cam.updateProjectionMatrix(); }
    this.bobPhase = this.bob; this.bobLevel = this.bobAmp;
  }
  bobPhase = 0; bobLevel = 0;
}
