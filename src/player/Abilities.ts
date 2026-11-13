// Compétences des six classes : 18 compétences actives, 6 ultimes et la grenade. Chaque capacité a un effet de jeu réel.
import * as THREE from 'three';
import type { Game } from '../core/Game';
import type { Field } from '../core/Combat';
import type { Enemy } from '../ai/Enemy';
import { Ally } from '../ai/Ally';

const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3();
const discGeo = (() => { const g = new THREE.CircleGeometry(1, 48); g.rotateX(-Math.PI / 2); return g; })();
const ringGeo = (() => { const g = new THREE.RingGeometry(0.95, 1, 56); g.rotateX(-Math.PI / 2); return g; })();

function zoneMesh(color: number, r: number, opacity = 0.16): THREE.Group {
  const g = new THREE.Group();
  const mk = (geo: THREE.BufferGeometry, op: number) => new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2 }));
  const d = mk(discGeo, opacity), ring = mk(ringGeo, 0.85), ring2 = mk(ringGeo, 0.4);
  d.scale.setScalar(r); ring.scale.setScalar(r); ring2.scale.setScalar(r * 0.6);
  g.add(d, ring, ring2);
  return g;
}
function disposeGroup(g: THREE.Object3D): void {
  g.removeFromParent();
  g.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) { (m.material as THREE.Material).dispose(); if (!(m.geometry === discGeo || m.geometry === ringGeo)) m.geometry.dispose(); } });
}

export class Abilities {
  private aegisMesh: THREE.Mesh;
  private tmpEnemies: Enemy[] = [];
  private slowMoT = 0;

  constructor(private g: Game) {
    // bouclier frontal de l'Égide, attaché à la caméra
    const geo = new THREE.CircleGeometry(0.75, 6);
    this.aegisMesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xffb04a, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    const rim = new THREE.Mesh(new THREE.RingGeometry(0.7, 0.75, 6), new THREE.MeshBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    this.aegisMesh.add(rim);
    this.aegisMesh.position.set(0, -0.1, -1.1);
    this.aegisMesh.visible = false;
    g.r.camera.add(this.aegisMesh);
  }

  private power(): number { return 1 + this.g.player.mod('skillPower'); }
  private dur(i: number): number { const p = this.g.player; return (p.cls.skills[i].dur || 0) + p.mod('dur' + (i + 1)); }
  private ultDur(): number { const p = this.g.player; return (p.cls.ult.dur || 0) + p.mod('durUlt'); }
  private fail(msg: string): boolean { this.g.ui.hud.toast(msg, '#ff8a6a'); this.g.audio.denied(); return false; }

  update(dt: number): void {
    const g = this.g, p = g.player, inp = g.input;
    if (this.slowMoT > 0) { this.slowMoT -= dt / Math.max(0.05, g.timeScale); if (this.slowMoT <= 0) g.timeScale = 1; }
    p.cloaked = p.has('cloak');
    this.aegisMesh.visible = p.has('aegis') && !p.dead;
    if (this.aegisMesh.visible) { const k = (p.buffs.get('aegisPool') || 0) / (150 * (1 + p.mod('aegisPower'))); (this.aegisMesh.material as THREE.MeshBasicMaterial).opacity = 0.06 + 0.16 * k; this.aegisMesh.rotation.z += dt * 0.4; }
    if (!g.canAct || p.dead || g.duel.active || g.match.active) return;
    if (inp.pressed('skill1')) this.useSkill(0);
    if (inp.pressed('skill2')) this.useSkill(1);
    if (inp.pressed('skill3')) this.useSkill(2);
    if (inp.pressed('ult')) this.useUlt();
    if (inp.pressed('grenade')) this.grenade();
    // traînée d'aura pour les buffs offensifs
    if (p.has('inferno') && Math.random() < 0.5) { p.forward(_a); g.fx.spark(p.pos.x + _a.x * 1.2 + (Math.random() - 0.5), p.pos.y + 0.2, p.pos.z + _a.z * 1.2 + (Math.random() - 0.5), 0xff5a1a, 0.2, 0.6, 2); }
  }

  useSkill(i: number): boolean {
    const g = this.g, p = g.player, s = p.cls.skills[i];
    if (p.cds[i] > 0) { g.audio.denied(); return false; }
    if (p.energy < s.cost) return this.fail('ÉNERGIE INSUFFISANTE');
    if (!this.cast(s.id, i)) return false;
    p.energy -= s.cost;
    const echo = p.legends.has('echo') && Math.random() < 0.2;
    p.cds[i] = echo ? 0.5 : p.cdMax[i];
    if (echo) g.ui.hud.toast('ÉCHO', '#ff9a2a');
    g.audio.skill(s.id);
    g.weapons.lower(0.18);
    g.ui.hud.skillUsed(i);
    if (g.mission) g.mission.stats.skills++;
    return true;
  }

  useUlt(): boolean {
    const g = this.g, p = g.player;
    if (p.ult < 100) { g.audio.denied(); return false; }
    if (!this.cast(p.cls.ult.id, 3)) return false;
    p.ult = 0;
    g.audio.skill(p.cls.ult.id);
    g.ui.hud.ultUsed(p.cls.ult.name, p.cls.css);
    p.shakeAmt = Math.min(1, p.shakeAmt + 0.5);
    if (g.mission) g.mission.stats.skills++;
    return true;
  }

  grenade(): boolean {
    const g = this.g, p = g.player;
    if (p.grenades <= 0) { g.audio.denied(); return false; }
    p.grenades--; if (p.grenadeCd <= 0) p.grenadeCd = 22;
    p.forward(_a);
    _b.copy(g.r.camera.position).addScaledVector(_a, 0.6);
    _c.copy(_a).multiplyScalar(17); _c.y += 3.5; _c.addScaledVector(p.vel, 0.5);
    g.combat.spawnProjectile({ pos: _b, vel: _c, damage: 150, radius: 0.09, color: 0x3a4a2a, owner: 'player', life: 5, gravity: 15, bounce: true, fuse: 1.9, aoe: 6 });
    g.audio.skill('grenadeThrow');
    g.weapons.lower(0.3);
    return true;
  }

  private cast(id: string, slot: number): boolean {
    const g = this.g, p = g.player, fx = g.fx, pw = this.power();
    switch (id) {
      // ----- VANGUARD -----
      case 'ember': p.addBuff('ember', this.dur(slot)); fx.ring(p.pos, 0.5, 4, 0xff6a1a, 0.5); return true;
      case 'dash': {
        const f = (g.input.held('forward') ? 1 : 0) - (g.input.held('back') ? 1 : 0), s = (g.input.held('right') ? 1 : 0) - (g.input.held('left') ? 1 : 0);
        const sin = Math.sin(p.yaw), cos = Math.cos(p.yaw);
        _a.set(-sin * f + cos * s, 0, -cos * f - sin * s);
        if (_a.lengthSq() < 0.01) _a.set(-sin, 0, -cos);
        _a.normalize();
        p.vel.set(_a.x * 34, Math.max(0, p.vel.y * 0.2) + 1.2, _a.z * 34);
        p.addBuff('dashing', 0.24);
        fx.burst(p.pos.clone().setY(p.pos.y + 1), { count: 20, color: 0xffb04a, speed: 3, life: 0.4, size: 0.2, gravity: 0 });
        const dmg = p.mod('dashDmg');
        if (dmg > 0) {
          const hit = new Set<Enemy>();
          let t = 0.26;
          g.combat.fields.push({ update: (dt) => { t -= dt; for (const e of g.combat.enemiesNear(p.pos, 1.9, this.tmpEnemies)) if (!hit.has(e)) { hit.add(e); e.takeDamage(dmg * pw, { source: 'player', type: 'fire', point: e.center(new THREE.Vector3()) }); e.applyBurn(10, 3); } return t > 0; }, dispose: () => undefined });
        }
        return true;
      }
      case 'aegis': {
        p.addBuff('aegis', this.dur(slot)); p.buffs.set('aegisPool', 150 * (1 + p.mod('aegisPower')));
        if (p.mod('aegisReload')) g.weapons.instantReload();
        return true;
      }
      case 'inferno': p.addBuff('inferno', this.ultDur()); fx.ring(p.pos, 0.5, 9, 0xff4a1a, 0.7); fx.burst(p.pos.clone().setY(p.pos.y + 1), { count: 40, color: 0xff5a1a, color2: 0xffc04a, speed: 7, life: 0.8, size: 0.3, gravity: -2 }); return true;

      // ----- BULWARK -----
      case 'armor': p.addBuff('armor', this.dur(slot)); fx.ring(p.pos, 0.5, 3, 0x6ab0ff, 0.5); return true;
      case 'shockwave': {
        const sp = 1 + p.mod('shockPower');
        fx.ring(p.pos, 0.5, 8, 0x9ad0ff, 0.45); fx.shock(_a.copy(p.pos).setY(p.pos.y + 1), 7, 0x6ab0ff, 0.3);
        for (const e of g.combat.enemiesNear(p.pos, 7.5, this.tmpEnemies)) {
          e.takeDamage(45 * sp * pw, { source: 'player', type: 'shock', point: e.center(new THREE.Vector3()) });
          e.knockback(p.pos, 13); e.applyStun(1.6 * sp);
        }
        for (const pr of g.combat.projectiles) if (pr.owner === 'enemy' && pr.pos.distanceTo(p.pos) < 8) pr.dead = true;
        p.shakeAmt = 0.6;
        return true;
      }
      case 'fortress': {
        const pos = p.pos.clone(), r = 4.5;
        let t = this.dur(slot);
        const dome = new THREE.Mesh(new THREE.SphereGeometry(r, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x4a9aff, transparent: true, opacity: 0.13, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
        const wire = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x8ac0ff, wireframe: true, transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending, depthWrite: false }));
        const grp = new THREE.Group(); grp.add(dome, wire, zoneMesh(0x4a9aff, r, 0.08)); grp.position.copy(pos);
        g.r.scene.add(grp);
        g.combat.dome = { pos, r };
        const field: Field = {
          update: (dt) => { t -= dt; wire.rotation.y += dt * 0.3; if (p.pos.distanceTo(pos) < r) p.addBuff('fortressIn', 0.2); (dome.material as THREE.MeshBasicMaterial).opacity = t < 1 ? 0.13 * t : 0.13; return t > 0; },
          dispose: () => { disposeGroup(grp); if (g.combat.dome && g.combat.dome.pos === pos) g.combat.dome = null; },
        };
        g.combat.fields.push(field);
        return true;
      }
      case 'colossus': p.addBuff('colossus', this.ultDur()); p.heal(p.maxHp * 0.5); g.weapons.instantReload(); fx.ring(p.pos, 0.5, 8, 0x2a7aff, 0.7); fx.shock(_a.copy(p.pos).setY(p.pos.y + 1), 5, 0x2a7aff, 0.4); return true;

      // ----- LIFEBINDER -----
      case 'pulse': {
        p.heal(45 * pw); g.audio.heal();
        if (p.mod('pulseDmg')) p.addBuff('adrenaline', 5);
        fx.ring(p.pos, 0.3, 3.5, 0x5af0a0, 0.5);
        fx.burst(_a.copy(p.pos).setY(p.pos.y + 0.8), { count: 18, color: 0x5af0a0, speed: 2.5, life: 0.8, size: 0.16, gravity: -3 });
        g.ui.hud.flashHeal();
        return true;
      }
      case 'meddrone': g.allies.push(new Ally(g, 'meddrone', this.dur(slot), p.mod('droneDmg') * pw)); return true;
      case 'regenfield': {
        const pos = p.pos.clone(); pos.y = Math.max(pos.y, g.level!.world.groundAt(pos.x, pos.z, pos.y + 0.5));
        const r = 5.5; let t = this.dur(slot), tick = 0;
        const mesh = zoneMesh(0x3ae08a, r); mesh.position.copy(pos).setY(pos.y + 0.06); g.r.scene.add(mesh);
        g.combat.fields.push({
          update: (dt) => {
            t -= dt; tick -= dt; mesh.children[2].rotation.y += dt;
            const inside = Math.hypot(p.pos.x - pos.x, p.pos.z - pos.z) < r && Math.abs(p.pos.y - pos.y) < 3;
            if (inside) p.heal(10 * pw * dt);
            if (Math.random() < 0.4) { const a = Math.random() * 6.28, rr = Math.random() * r; fx.spark(pos.x + Math.cos(a) * rr, pos.y + 0.1, pos.z + Math.sin(a) * rr, 0x5af0a0, 0.14, 1, 1.4); }
            if (tick <= 0) {
              tick = 0.5;
              for (const e of g.combat.enemiesNear(pos, r, this.tmpEnemies)) {
                const d = 14 * (1 + p.mod('fieldDmg')) * pw * 0.5;
                e.takeDamage(d, { source: 'player', type: 'arcane', silent: true, point: e.center(new THREE.Vector3()) });
                p.heal(d * 0.25);
                fx.tracer(e.center(_a), _b.set(p.pos.x, p.pos.y + 1, p.pos.z), 0x3ae08a, 0.02, 0.2);
              }
            }
            return t > 0;
          },
          dispose: () => disposeGroup(mesh),
        });
        return true;
      }
      case 'rebirth': {
        p.hp = Math.min(p.hp, p.maxHp); p.heal(p.maxHp, true); p.shield = 120; p.shieldT = this.ultDur();
        p.slow = 0; p.addBuff('rebirth', this.ultDur()); p.invuln = Math.max(p.invuln, 0.6);
        fx.ring(p.pos, 0.5, 9, 0x2aff9a, 0.7); fx.shock(_a.copy(p.pos).setY(p.pos.y + 1), 8, 0x2aff9a, 0.4);
        fx.burst(_a, { count: 40, color: 0x2aff9a, color2: 0xffffff, speed: 8, life: 0.9, size: 0.25, gravity: -1 });
        for (const e of g.combat.enemiesNear(p.pos, 9, this.tmpEnemies)) { e.takeDamage(70 * pw, { source: 'player', type: 'arcane', point: e.center(new THREE.Vector3()) }); e.knockback(p.pos, 10); }
        g.ui.hud.flashHeal();
        return true;
      }

      // ----- WRAITH -----
      case 'cloak': {
        p.addBuff('cloak', this.dur(slot)); p.cloaked = true;
        fx.burst(_a.copy(p.pos).setY(p.pos.y + 1), { count: 24, color: 0x9a6aff, speed: 3, life: 0.6, size: 0.2, gravity: 0, smoke: false });
        return true;
      }
      case 'blink': {
        const w = g.level!.world;
        g.r.camera.getWorldDirection(_a);
        const h = w.raycast(g.r.camera.position, _a, 12, 'walk');
        const maxD = h ? Math.max(0, h.t - 0.6) : 12;
        for (let d = maxD; d >= 1.5; d -= 0.5) {
          _b.copy(g.r.camera.position).addScaledVector(_a, d);
          const gy = w.groundAt(_b.x, _b.z, _b.y + 0.3);
          if (gy < -1000) continue;
          const y = _b.y - gy > 5 ? _b.y - 1.6 : gy + 0.03;
          if (!w.overlaps(_b.x, y, _b.z, p.radius, 1.8)) {
            fx.burst(_c.copy(p.pos).setY(p.pos.y + 1), { count: 20, color: 0x9a6aff, speed: 3, life: 0.5, size: 0.2, gravity: 0 });
            fx.tracer(_c, _b, 0xb08aff, 0.08, 0.25);
            p.pos.set(_b.x, y, _b.z); p.vel.y = 0; p.lastSafe.copy(p.pos);
            fx.burst(_c.copy(p.pos).setY(p.pos.y + 1), { count: 20, color: 0xc0a0ff, speed: 3, life: 0.5, size: 0.2, gravity: 0 });
            g.ui.hud.flash('rgba(150,100,255,0.25)');
            return true;
          }
        }
        return this.fail('DESTINATION INVALIDE');
      }
      case 'mark': {
        const e = g.combat.crosshairTarget(12, 90, true);
        if (!e) return this.fail('AUCUNE CIBLE DANS LE VISEUR');
        e.applyMark(0.35 + p.mod('markPower'), this.dur(slot)); e.revealT = this.dur(slot);
        fx.ring(e.pos, 0.3, 2, 0xff5a8a, 0.5);
        return true;
      }
      case 'execute': {
        const e = g.combat.crosshairTarget(16, 160, true);
        if (!e) return this.fail('AUCUNE CIBLE DANS LE VISEUR');
        const mult = 1 + p.mod('execPower');
        const dmg = e.isBoss ? Math.min(1600, Math.max(700, e.maxHp * 0.09)) * mult : e.def.elite ? 650 * mult : 99999;
        e.center(_b);
        _c.copy(g.r.camera.position); _c.y -= 0.2;
        fx.bolt(_c, _b, 0xd08aff, 0.2, 0.5); fx.tracer(_c, _b, 0xffffff, 0.14, 0.4);
        fx.burst(_b, { count: 40, color: 0xd08aff, color2: 0xffffff, speed: 9, life: 0.7, size: 0.25, gravity: 0 });
        fx.flash(_b, 0xd08aff, 80, 0.3, 20);
        e.takeDamage(dmg, { source: 'player', type: 'arcane', head: true, point: _b.clone() });
        g.timeScale = 0.25; this.slowMoT = 0.35;
        p.kick(3, 0);
        return true;
      }

      // ----- ARCANIST -----
      case 'chain': {
        const e = g.combat.crosshairTarget(14, 50);
        if (!e) return this.fail('AUCUNE CIBLE DANS LE VISEUR');
        g.weapons.w.model.muzzle.getWorldPosition(_a).applyMatrix4(g.r.camera.matrixWorld);
        g.combat.chain(e, 62 * pw, 4 + p.mod('chainTargets'), 9, 0x6ae0ff, _a);
        return true;
      }
      case 'gravity': {
        const pos = g.combat.aimPoint(26, new THREE.Vector3());
        const r = 6.5; let t = this.dur(slot), tick = 0;
        const mesh = zoneMesh(0x8a7aff, r); mesh.position.copy(pos).setY(pos.y + 0.06);
        const core = new THREE.Mesh(new THREE.SphereGeometry(0.5, 12, 8), new THREE.MeshBasicMaterial({ color: 0x1a0a3a })); core.position.y = 1.6; mesh.add(core);
        g.r.scene.add(mesh);
        g.combat.fields.push({
          update: (dt) => {
            t -= dt; tick -= dt; mesh.children[2].rotation.y -= dt * 2; core.scale.setScalar(1 + Math.sin(t * 9) * 0.15);
            for (let i = 0; i < 2; i++) { const a = Math.random() * 6.28, rr = r * (0.4 + Math.random() * 0.6); fx.spark(pos.x + Math.cos(a) * rr, pos.y + Math.random() * 2.5, pos.z + Math.sin(a) * rr, 0x8a7aff, 0.12, 0.5, -0.5); }
            for (const e of g.combat.enemiesNear(pos, r, this.tmpEnemies)) {
              e.applySlow(0.65, 0.4);
              if (!e.isBoss && !e.static) { _a.subVectors(pos, e.pos).setY(0); const l = _a.length(); if (l > 0.8) { e.vel.x += (_a.x / l) * 16 * dt; e.vel.z += (_a.z / l) * 16 * dt; } }
            }
            if (tick <= 0) { tick = 0.5; for (const e of g.combat.enemiesNear(pos, r, this.tmpEnemies)) e.takeDamage(9 * (1 + p.mod('gravityDmg')) * pw * 0.5, { source: 'player', type: 'arcane', silent: true, point: e.center(new THREE.Vector3()) }); }
            return t > 0;
          },
          dispose: () => disposeGroup(mesh),
        });
        return true;
      }
      case 'overcharge': p.addBuff('overcharge', this.dur(slot)); fx.ring(p.pos, 0.5, 4, 0x4ad8ff, 0.5); return true;
      case 'storm': {
        const pos = g.combat.aimPoint(32, new THREE.Vector3());
        const r = 9; let t = this.ultDur(), tick = 0;
        const mesh = zoneMesh(0x7a5aff, r, 0.1); mesh.position.copy(pos).setY(pos.y + 0.06); g.r.scene.add(mesh);
        g.combat.fields.push({
          update: (dt) => {
            t -= dt; tick -= dt; mesh.children[2].rotation.y += dt * 3;
            for (let i = 0; i < 3; i++) { const a = Math.random() * 6.28, rr = Math.random() * r; fx.spark(pos.x + Math.cos(a) * rr, pos.y + 7 + Math.random() * 2, pos.z + Math.sin(a) * rr, 0x2a1a4a, 2.2, 1.2, 0, true); }
            for (const e of g.combat.enemiesNear(pos, r, this.tmpEnemies)) e.applySlow(0.45, 0.4);
            if (tick <= 0) {
              tick = 0.22;
              const list = g.combat.enemiesNear(pos, r, this.tmpEnemies);
              let tx: number, tz: number, target: Enemy | null = null;
              if (list.length && Math.random() < 0.85) { target = list[Math.floor(Math.random() * list.length)]; tx = target.pos.x; tz = target.pos.z; }
              else { const a = Math.random() * 6.28, rr = Math.random() * r; tx = pos.x + Math.cos(a) * rr; tz = pos.z + Math.sin(a) * rr; }
              _a.set(tx + (Math.random() - 0.5) * 2, pos.y + 9, tz + (Math.random() - 0.5) * 2);
              _b.set(tx, target ? target.pos.y + 0.8 : pos.y, tz);
              fx.bolt(_a, _b, 0xb09aff, 0.9, 0.16); fx.flash(_b, 0x9a7aff, 30, 0.1, 12);
              fx.burst(_b, { count: 6, color: 0xb09aff, speed: 4, life: 0.3, size: 0.14, gravity: 0 });
              if (target) target.takeDamage(30 * pw, { source: 'player', type: 'shock', silent: true, point: _b.clone() });
              if (Math.random() < 0.5) g.audio.skill('zap', _b);
            }
            return t > 0;
          },
          dispose: () => disposeGroup(mesh),
        });
        return true;
      }

      // ----- RANGER -----
      case 'scout': {
        let t = this.dur(slot), pulse = 0;
        const mark = 0.15 + p.mod('markPower');
        const drone = new THREE.Mesh(new THREE.OctahedronGeometry(0.2, 0), new THREE.MeshBasicMaterial({ color: 0xe8d85a }));
        drone.position.copy(p.pos).setY(p.pos.y + 2); g.r.scene.add(drone);
        g.combat.fields.push({
          update: (dt) => {
            t -= dt; pulse -= dt;
            drone.position.lerp(_a.set(p.pos.x, p.pos.y + 6, p.pos.z), Math.min(1, dt * 2)); drone.rotation.y += dt * 4;
            if (pulse <= 0) {
              pulse = 2;
              g.fx.ring(_a.set(drone.position.x, p.pos.y, drone.position.z), 1, 45, 0xe8d85a, 1.0);
              for (const e of g.enemies) if (e.alive && e.pos.distanceTo(p.pos) < 48) { e.revealT = Math.max(e.revealT, Math.min(t, 2.5)); e.applyMark(mark, Math.min(t, 2.5)); }
            }
            return t > 0;
          },
          dispose: () => { drone.removeFromParent(); drone.geometry.dispose(); (drone.material as THREE.Material).dispose(); },
        });
        return true;
      }
      case 'trap': {
        const pos = g.combat.aimPoint(22, new THREE.Vector3());
        let t = 45, armed = 0.4;
        const tp = 1 + p.mod('trapPower') * 0.5;
        const mesh = zoneMesh(0xffb04a, 2.4, 0.06); mesh.position.copy(pos).setY(pos.y + 0.06);
        const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.16, 0), new THREE.MeshBasicMaterial({ color: 0xffb04a })); core.position.y = 0.3; mesh.add(core);
        g.r.scene.add(mesh);
        g.combat.fields.push({
          update: (dt) => {
            t -= dt; armed -= dt; core.rotation.y += dt * 3;
            if (armed > 0) return true;
            const list = g.combat.enemiesNear(pos, 2.4, this.tmpEnemies);
            if (list.length) {
              for (const e of list) { e.applyRoot(4 + p.mod('trapPower')); e.takeDamage(35 * tp * pw, { source: 'player', type: 'arcane', point: e.center(new THREE.Vector3()) }); fx.bolt(_a.copy(pos).setY(pos.y + 0.2), e.center(_b), 0xffb04a, 0.3, 0.4); }
              fx.ring(pos, 0.3, 3, 0xffb04a, 0.5); g.audio.skill('trapSnap', pos);
              return false;
            }
            return t > 0;
          },
          dispose: () => disposeGroup(mesh),
        });
        return true;
      }
      case 'companion': {
        const n = 1 + (p.mod('extraPet') > 0 ? 1 : 0);
        for (let i = 0; i < n; i++) g.allies.push(new Ally(g, 'wolf', this.dur(slot), (1 + p.mod('petDmg')) * pw));
        return true;
      }
      case 'hunt': {
        const d = this.ultDur();
        p.addBuff('hunt', d);
        for (let i = 0; i < 2; i++) g.allies.push(new Ally(g, 'wolf', d, (1 + p.mod('petDmg')) * pw * 1.2));
        for (const e of g.enemies) if (e.alive && e.pos.distanceTo(p.pos) < 70) { e.revealT = d; e.applyMark(0.1 + p.mod('markPower'), d); }
        fx.ring(p.pos, 1, 30, 0xf0e06a, 0.9);
        return true;
      }
    }
    return false;
  }
}
