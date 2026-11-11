// Résolution du combat : hitscan, dégâts, éliminations, explosions, éclairs, projectiles et zones de danger annoncées.
import * as THREE from 'three';
import type { Game } from './Game';
import type { Enemy } from '../ai/Enemy';
import type { Collider, DamageInfo } from '../world/World';
import { softTexture } from '../render/Materials';

export interface HitResult { t: number; point: THREE.Vector3; normal: THREE.Vector3 | null; enemy: Enemy | null; head: boolean; collider: Collider | null }

export interface ProjectileOpts {
  pos: THREE.Vector3; vel: THREE.Vector3; damage: number; radius: number; color: number; owner: 'enemy' | 'player'; life: number;
  aoe?: number; gravity?: number; bounce?: boolean; fuse?: number; homing?: number; onExplode?: (pos: THREE.Vector3) => void;
}
interface Projectile extends ProjectileOpts { mesh: THREE.Mesh; dead: boolean; age: number }

export interface Hazard {
  kind: 'circle' | 'wave' | 'line';
  pos: THREE.Vector3; radius: number; delay: number; t: number; damage: number; color: number;
  mesh: THREE.Object3D; fill?: THREE.Mesh;
  // wave : anneau qui s'étend, évitable en sautant
  speed?: number; maxR?: number; hitDone?: boolean;
  // line
  dir?: THREE.Vector3; len?: number; width?: number;
  onBoom?: () => void;
}

export interface Field { update(dt: number): boolean; dispose(): void }

const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _d = new THREE.Vector3();
const projGeo = new THREE.SphereGeometry(1, 10, 8);
const discGeo = (() => { const g = new THREE.CircleGeometry(1, 40); g.rotateX(-Math.PI / 2); return g; })();
const ringGeo = (() => { const g = new THREE.RingGeometry(0.94, 1, 48); g.rotateX(-Math.PI / 2); return g; })();
const waveGeo = (() => { const g = new THREE.RingGeometry(0.86, 1, 56); g.rotateX(-Math.PI / 2); return g; })();
const lineGeo = (() => { const g = new THREE.PlaneGeometry(1, 1); g.rotateX(-Math.PI / 2); g.translate(0, 0, -0.5); return g; })();

export class Combat {
  projectiles: Projectile[] = [];
  hazards: Hazard[] = [];
  fields: Field[] = [];
  dome: { pos: THREE.Vector3; r: number } | null = null;
  pathBudget = 3;
  private hit: HitResult = { t: 0, point: new THREE.Vector3(), normal: null, enemy: null, head: false, collider: null };
  private group = new THREE.Group();

  constructor(private g: Game) { g.r.scene.add(this.group); }

  // ---------- requêtes ----------

  rayEnemies(o: THREE.Vector3, d: THREE.Vector3, maxT: number): { enemy: Enemy; t: number; head: boolean } | null {
    let best: { enemy: Enemy; t: number; head: boolean } | null = null;
    for (const e of this.g.enemies) {
      if (!e.alive) continue;
      // rejet rapide par sphère englobante
      const cx = e.pos.x - o.x, cy = e.pos.y + e.height * 0.5 - o.y, cz = e.pos.z - o.z;
      const proj = cx * d.x + cy * d.y + cz * d.z;
      if (proj < -2 || proj > maxT + 2) continue;
      const perp2 = cx * cx + cy * cy + cz * cz - proj * proj;
      const br = e.height * 0.7 + e.radius;
      if (perp2 > br * br) continue;
      const h = e.hitTest(o, d, best ? best.t : maxT);
      if (h) best = { enemy: e, t: h.t, head: h.head };
    }
    return best;
  }

  /** Tir du joueur : résout monde + ennemis. Le résultat est réutilisé. */
  playerHitscan(o: THREE.Vector3, d: THREE.Vector3, maxT: number): HitResult | null {
    const w = this.g.level!.world.raycast(o, d, maxT, 'shoot');
    const wt = w ? w.t : maxT;
    const e = this.rayEnemies(o, d, wt);
    const h = this.hit;
    if (e) { h.t = e.t; h.enemy = e.enemy; h.head = e.head; h.collider = null; h.normal = null; h.point.copy(o).addScaledVector(d, e.t); return h; }
    if (w) { h.t = w.t; h.enemy = null; h.head = false; h.collider = w.collider; h.normal = w.normal; h.point.copy(w.point); return h; }
    return null;
  }

  enemiesNear(pos: THREE.Vector3, r: number, out: Enemy[] = []): Enemy[] {
    out.length = 0;
    for (const e of this.g.enemies) { if (!e.alive) continue; const dx = e.pos.x - pos.x, dz = e.pos.z - pos.z, dy = e.pos.y - pos.y; if (dx * dx + dz * dz + dy * dy * 0.3 < (r + e.radius) * (r + e.radius)) out.push(e); }
    return out;
  }

  /** Ennemi le plus proche du réticule. */
  crosshairTarget(maxAngleDeg: number, maxDist: number, preferElite = false): Enemy | null {
    const g = this.g, cam = g.r.camera;
    cam.getWorldDirection(_a);
    let best: Enemy | null = null, bs = -Infinity;
    const cosMax = Math.cos(THREE.MathUtils.degToRad(maxAngleDeg));
    for (const e of g.enemies) {
      if (!e.alive) continue;
      e.center(_b);
      _c.subVectors(_b, cam.position);
      const dist = _c.length();
      if (dist > maxDist) continue;
      const dot = _c.dot(_a) / dist;
      if (dot < cosMax) continue;
      if (!g.level!.world.los(cam.position, _b)) continue;
      let score = dot * 10 - dist * 0.01;
      if (preferElite && (e.def.elite || e.isBoss)) score += 0.4;
      if (score > bs) { bs = score; best = e; }
    }
    return best;
  }

  /** Point visé par le joueur (monde ou ennemi), limité à maxDist. */
  aimPoint(maxDist: number, out: THREE.Vector3, ground = true): THREE.Vector3 {
    const g = this.g, cam = g.r.camera;
    cam.getWorldDirection(_a);
    const h = this.playerHitscan(cam.position, _a, maxDist);
    if (h) out.copy(h.point).addScaledVector(_a, -0.3); else out.copy(cam.position).addScaledVector(_a, maxDist);
    if (ground) { const gy = g.level!.world.groundAt(out.x, out.z, out.y + 0.5); out.y = gy > -1000 ? gy : Math.max(0, out.y - 1); }
    return out;
  }

  // ---------- événements de combat ----------

  onDamageDealt(e: Enemy, dmg: number, info: DamageInfo, killed: boolean, blocked: boolean): void {
    const g = this.g, p = g.player;
    if (info.source === 'player') {
      if (info.type === 'bullet') { g.ui.hud.hitmarker(!!info.head, killed, blocked); g.audio.hitmarker(!!info.head, killed); }
      else if (killed) { g.ui.hud.hitmarker(false, true); g.audio.hitmarker(false, true); }
      p.addUlt(dmg / (e.isBoss ? 90 : 55));
    }
    g.ui.hud.damageNumber(info.point || e.center(_d), dmg, !!info.head, info.type);
    if (g.mission) g.mission.stats.damageDealt += dmg;
  }

  onKill(e: Enemy, info: DamageInfo): void {
    const g = this.g, p = g.player, prof = g.profile!;
    prof.stats.kills++;
    if (g.mission) g.mission.stats.kills++;
    const xp = Math.round(e.def.xp * g.diff.xp * (e.isBoss ? 1 : 1));
    if (!e.noLoot || e.isBoss) g.gainXp(xp, e.name);
    p.addUlt(e.def.elite || e.isBoss ? 10 : 4);
    if (p.mod('energyOnKill')) p.addEnergy(p.mod('energyOnKill'));
    if (p.mod('lifeOnKill')) p.heal(p.mod('lifeOnKill'));
    if (info.head && info.source === 'player') {
      if (info.legend === 'vampiric') p.heal(12);
      if (p.mod('headKillCdr')) for (let i = 0; i < 3; i++) p.cds[i] = Math.max(0, p.cds[i] - p.mod('headKillCdr'));
    }
    if (e.markT > 0 && p.mod('markEnergy')) p.addEnergy(p.mod('markEnergy'));
    if (p.legends.has('killsurge')) { p.killStacks = Math.min(5, p.killStacks + 1); p.killStackT = 6; }
    const c = e.center(new THREE.Vector3());
    if (p.has('inferno')) g.after(0.08, () => this.explode(c, 5, 80 * (1 + p.mod('skillPower')), 'player', { color: 0xff5a1a, noSelf: true }));
    else if (e.burnT > 0 && p.mod('burnExplode')) g.after(0.08, () => this.explode(c, 4, p.mod('burnExplode'), 'player', { color: 0xff7a2a, noSelf: true }));
    if (info.legend === 'explosive') g.after(0.05, () => this.explode(c, 4.5, 60, 'player', { color: 0xffa040, noSelf: true }));
    // butin au sol
    if (!e.noLoot && !e.isBoss) {
      const r = Math.random();
      const low = p.hp < p.maxHp * 0.5;
      _a.set(e.pos.x, Math.max(0, g.level!.world.groundAt(e.pos.x, e.pos.z, e.pos.y + 1)), e.pos.z);
      if (r < (low ? 0.3 : 0.12)) g.level!.spawnPickup('health', _a);
      else if (r < 0.42) g.level!.spawnPickup('ammo', _a);
      else if (r < 0.5) g.level!.spawnPickup('energy', _a);
      if (e.def.elite && g.mission && Math.random() < 0.35) g.mission.dropLoot('elite');
    }
    g.mission?.onEnemyKilled(e);
  }

  alertNear(pos: THREE.Vector3, r: number, lastKnown: THREE.Vector3): void {
    for (const e of this.g.enemies) {
      if (!e.alive || e.state === 'combat') continue;
      if (e.pos.distanceTo(pos) < r) e.alertTo(lastKnown, true);
    }
  }

  /** Bruit (tir, explosion) : alerte les ennemis à portée d'ouïe. */
  noise(pos: THREE.Vector3, r: number): void {
    for (const e of this.g.enemies) {
      if (!e.alive || e.state === 'combat') continue;
      const d = e.pos.distanceTo(pos);
      if (d < r * 0.45) e.alertTo(pos, true);
      else if (d < r) e.alertTo(_a.set(pos.x + (Math.random() - 0.5) * 6, pos.y, pos.z + (Math.random() - 0.5) * 6), false);
    }
  }

  explode(pos: THREE.Vector3, radius: number, dmg: number, source: 'player' | 'enemy' | 'world', o: { color?: number; noSelf?: boolean; silentFx?: boolean } = {}): void {
    const g = this.g, p = g.player;
    if (!g.level) return;
    if (!o.silentFx) { g.fx.explosion(pos, radius, o.color ?? 0xff8a2a); g.audio.explosion(pos, Math.min(1.4, radius / 5)); }
    if (source !== 'enemy') {
      for (const e of this.enemiesNear(pos, radius)) {
        const d = e.center(_a).distanceTo(pos);
        const k = 1 - 0.6 * Math.min(1, d / radius);
        e.takeDamage(dmg * k, { source: source === 'player' ? 'player' : 'world', type: 'explosion', point: e.center(new THREE.Vector3()) });
        e.knockback(pos, 7 * k);
        if (e.alive && !e.isBoss) e.applyStun(0.5);
      }
    }
    const pd = _b.set(p.pos.x, p.pos.y + 0.9, p.pos.z).distanceTo(pos);
    if (pd < radius + 0.4 && !(source === 'player' && o.noSelf)) {
      const k = 1 - 0.6 * Math.min(1, pd / radius);
      p.takeDamage(dmg * k * (source === 'player' ? 0.3 : 1), { from: pos, type: 'explosion' });
    }
    if (pd < radius * 3) p.shakeAmt = Math.min(1, p.shakeAmt + 0.6 * (1 - pd / (radius * 3)));
    for (const d of g.level.destructibles) {
      if (!d.alive) continue;
      if (d.center.distanceTo(pos) < radius + 0.6) { const dd = d; g.after(0.1, () => dd.takeDamage(dmg, { source: source === 'enemy' ? 'enemy' : 'player', type: 'explosion' })); }
    }
    this.noise(pos, 45);
  }

  /** Arc électrique rebondissant entre ennemis proches. */
  chain(first: Enemy, dmg: number, bounces: number, range: number, color = 0x6ad8ff, from?: THREE.Vector3): void {
    const g = this.g;
    const visited = new Set<Enemy>();
    let cur: Enemy | null = first;
    const prev = (from ? from.clone() : first.center(new THREE.Vector3()));
    let d = dmg;
    for (let i = 0; i <= bounces && cur; i++) {
      visited.add(cur);
      const c = cur.center(new THREE.Vector3());
      if (i > 0 || from) g.fx.bolt(prev, c, color, 0.5, 0.2);
      g.fx.burst(c, { count: 6, color, speed: 3, life: 0.25, size: 0.12, gravity: 0 });
      cur.takeDamage(d, { source: 'player', type: 'shock', point: c, silent: true });
      if (cur.alive && !cur.isBoss) cur.applyStun(0.35);
      prev.copy(c); d *= 0.85;
      let next: Enemy | null = null, bd = range;
      for (const e of g.enemies) { if (!e.alive || visited.has(e)) continue; const dist = e.center(_a).distanceTo(c); if (dist < bd) { bd = dist; next = e; } }
      cur = next;
    }
    g.audio.skill('zap', prev);
  }

  /** Vrai si un tir venant de l'extérieur est arrêté par le dôme Forteresse. */
  fortressBlocks(from: THREE.Vector3, to: THREE.Vector3): boolean {
    const d = this.dome;
    if (!d) return false;
    const inTo = to.distanceTo(d.pos) < d.r, inFrom = from.distanceTo(d.pos) < d.r;
    if (inTo && !inFrom) {
      _c.subVectors(from, d.pos).normalize().multiplyScalar(d.r).add(d.pos);
      this.g.fx.burst(_c, { count: 5, color: 0x4a9aff, speed: 2, life: 0.3, size: 0.14, gravity: 0 });
      this.g.fx.tracer(from, _c, 0xffd0a0, 0.02, 0.07);
      this.g.audio.impact('energy', _c);
      return true;
    }
    return false;
  }

  // ---------- projectiles ----------

  spawnProjectile(o: ProjectileOpts): void {
    const mesh = new THREE.Mesh(projGeo, new THREE.MeshBasicMaterial({ color: new THREE.Color(o.color).lerp(new THREE.Color(0xffffff), 0.55) }));
    mesh.scale.setScalar(o.radius * 0.7);
    // halo coloré autour du cœur lumineux
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: softTexture(), color: o.color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    halo.scale.setScalar(o.bounce ? 0 : 5.5);
    mesh.add(halo);
    mesh.position.copy(o.pos);
    this.group.add(mesh);
    this.projectiles.push({ ...o, pos: o.pos.clone(), vel: o.vel.clone(), mesh, dead: false, age: 0 });
  }

  private updateProjectiles(dt: number): void {
    const g = this.g, p = g.player, world = g.level!.world;
    for (const pr of this.projectiles) {
      pr.age += dt;
      if (pr.gravity) pr.vel.y -= pr.gravity * dt;
      if (pr.homing && pr.owner === 'enemy' && !p.dead) {
        _a.set(p.pos.x, p.pos.y + 1, p.pos.z).sub(pr.pos).normalize();
        const sp = pr.vel.length();
        pr.vel.addScaledVector(_a, pr.homing * dt * sp).setLength(sp);
      }
      const sp = pr.vel.length();
      _a.copy(pr.vel).multiplyScalar(1 / (sp || 1));
      const step = sp * dt;
      const h = world.raycast(pr.pos, _a, step + pr.radius, pr.bounce ? 'walk' : 'shoot');
      let boom = false;
      if (h) {
        if (pr.bounce) {
          pr.pos.copy(h.point).addScaledVector(h.normal, pr.radius + 0.01);
          const dn = pr.vel.dot(h.normal);
          pr.vel.addScaledVector(h.normal, -1.5 * dn).multiplyScalar(0.6);
          if (Math.abs(dn) > 1.5) g.audio.grenadeBounce(pr.pos);
        } else { pr.pos.copy(h.point); boom = true; }
      } else pr.pos.addScaledVector(pr.vel, dt);
      if (pr.owner === 'enemy') {
        // collision avec le joueur (capsule approchée)
        const py = THREE.MathUtils.clamp(pr.pos.y, p.pos.y + 0.2, p.pos.y + p.height - 0.1);
        if (!p.dead && Math.hypot(pr.pos.x - p.pos.x, pr.pos.y - py, pr.pos.z - p.pos.z) < pr.radius + 0.42) boom = true;
        if (this.dome && pr.pos.distanceTo(this.dome.pos) < this.dome.r && pr.age > 0.05) {
          _b.copy(pr.pos).addScaledVector(pr.vel, -dt);
          if (_b.distanceTo(this.dome.pos) >= this.dome.r) { pr.dead = true; g.fx.burst(pr.pos, { count: 8, color: 0x4a9aff, speed: 3, life: 0.3, size: 0.14, gravity: 0 }); g.audio.impact('energy', pr.pos); }
        }
        for (const a of g.allies) if (a.alive && a.taunts && a.pos.distanceTo(pr.pos) < 0.9) boom = true;
      } else if (!pr.bounce) {
        for (const e of g.enemies) if (e.alive && e.center(_b).distanceTo(pr.pos) < e.radius + pr.radius + 0.3) boom = true;
      }
      if (pr.fuse !== undefined && pr.age >= pr.fuse) boom = true;
      if (pr.age > pr.life) pr.dead = true;
      if (boom && !pr.dead) {
        pr.dead = true;
        if (pr.onExplode) pr.onExplode(pr.pos);
        else if (pr.owner === 'enemy') {
          g.fx.burst(pr.pos, { count: 14, color: pr.color, speed: 5, life: 0.4, size: 0.18, gravity: 0 });
          g.fx.flash(pr.pos, pr.color, 20, 0.12, 8);
          g.audio.tone(240, 0.2, { type: 'sawtooth', to: 80, vol: 0.14, pos: pr.pos, filter: 1200 });
          const pd = _b.set(p.pos.x, p.pos.y + 0.9, p.pos.z).distanceTo(pr.pos);
          const r = pr.aoe ?? 1.2;
          if (pd < r + 0.4) p.takeDamage(pr.damage * (pd < 0.9 ? 1 : 0.6), { from: pr.pos, type: 'arcane' });
          for (const a of g.allies) if (a.alive && a.pos.distanceTo(pr.pos) < r + 0.5) a.takeDamage(pr.damage);
        } else this.explode(pr.pos, pr.aoe ?? 5, pr.damage, 'player');
      }
      pr.mesh.position.copy(pr.pos);
      if (!pr.bounce) g.fx.spark(pr.pos.x, pr.pos.y, pr.pos.z, pr.color, pr.radius * 1.6, 0.25);
    }
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const pr = this.projectiles[i];
      if (pr.dead) { pr.mesh.removeFromParent(); (pr.mesh.material as THREE.Material).dispose(); ((pr.mesh.children[0] as THREE.Sprite)?.material as THREE.Material)?.dispose(); this.projectiles.splice(i, 1); }
    }
  }

  // ---------- zones de danger annoncées ----------

  private hazMat(color: number, opacity: number): THREE.MeshBasicMaterial {
    return new THREE.MeshBasicMaterial({ color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2 });
  }

  /** Cercle au sol qui explose après un délai : laisse au joueur le temps d'en sortir. */
  hazardCircle(pos: THREE.Vector3, radius: number, delay: number, damage: number, color = 0xff3a2a, onBoom?: () => void): Hazard {
    const grp = new THREE.Group();
    const ring = new THREE.Mesh(ringGeo, this.hazMat(color, 0.9)); ring.scale.setScalar(radius);
    const fill = new THREE.Mesh(discGeo, this.hazMat(color, 0.28)); fill.scale.setScalar(0.01);
    grp.add(ring, fill);
    grp.position.set(pos.x, pos.y + 0.07, pos.z);
    this.group.add(grp);
    const h: Hazard = { kind: 'circle', pos: pos.clone(), radius, delay, t: 0, damage, color, mesh: grp, fill, onBoom };
    this.hazards.push(h);
    return h;
  }

  /** Onde de choc circulaire qui s'étend : évitable en sautant. */
  hazardWave(pos: THREE.Vector3, maxR: number, speed: number, damage: number, color = 0xff8a2a, delay = 0.6): Hazard {
    const ring = new THREE.Mesh(waveGeo, this.hazMat(color, 0.95));
    ring.scale.setScalar(0.5);
    ring.position.set(pos.x, pos.y + 0.1, pos.z);
    this.group.add(ring);
    const h: Hazard = { kind: 'wave', pos: pos.clone(), radius: 0.5, delay, t: 0, damage, color, mesh: ring, speed, maxR };
    this.hazards.push(h);
    return h;
  }

  /** Bande au sol (rayon, charge) qui frappe après un délai. */
  hazardLine(pos: THREE.Vector3, dir: THREE.Vector3, len: number, width: number, delay: number, damage: number, color = 0xff3a2a, onBoom?: () => void): Hazard {
    const grp = new THREE.Group();
    const m = new THREE.Mesh(lineGeo, this.hazMat(color, 0.3));
    m.scale.set(width, 1, len);
    const fill = new THREE.Mesh(lineGeo, this.hazMat(color, 0.45)); fill.scale.set(0.01, 1, len);
    grp.add(m, fill);
    grp.position.set(pos.x, pos.y + 0.08, pos.z);
    grp.rotation.y = Math.atan2(-dir.x, -dir.z);
    this.group.add(grp);
    const h: Hazard = { kind: 'line', pos: pos.clone(), radius: 0, delay, t: 0, damage, color, mesh: grp, fill, dir: dir.clone().setY(0).normalize(), len, width, onBoom };
    this.hazards.push(h);
    return h;
  }

  private updateHazards(dt: number): void {
    const g = this.g, p = g.player;
    for (let i = this.hazards.length - 1; i >= 0; i--) {
      const h = this.hazards[i];
      h.t += dt;
      let done = false;
      if (h.kind === 'circle') {
        const k = Math.min(1, h.t / h.delay);
        h.fill!.scale.setScalar(Math.max(0.01, h.radius * k));
        if (h.t >= h.delay) {
          done = true;
          g.fx.burst(h.pos, { count: 26, color: h.color, speed: h.radius * 2, life: 0.6, size: 0.25, gravity: -4, up: 5 });
          g.fx.ring(h.pos, h.radius * 0.3, h.radius, h.color, 0.35);
          g.fx.flash(_a.copy(h.pos).setY(h.pos.y + 1), h.color, 50, 0.2, h.radius * 4);
          g.audio.explosion(h.pos, 0.6);
          if (!p.dead && Math.hypot(p.pos.x - h.pos.x, p.pos.z - h.pos.z) < h.radius + 0.2 && Math.abs(p.pos.y - h.pos.y) < 3.5) p.takeDamage(h.damage, { from: h.pos, type: 'arcane' });
          h.onBoom?.();
        }
      } else if (h.kind === 'wave') {
        if (h.t < h.delay) { (h.mesh as THREE.Mesh).scale.setScalar(0.6 + Math.sin(h.t * 30) * 0.15); }
        else {
          const prev = h.radius;
          h.radius = 0.5 + (h.t - h.delay) * h.speed!;
          (h.mesh as THREE.Mesh).scale.setScalar(h.radius);
          ((h.mesh as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = 0.95 * (1 - h.radius / h.maxR!) + 0.15;
          const pd = Math.hypot(p.pos.x - h.pos.x, p.pos.z - h.pos.z);
          if (!h.hitDone && !p.dead && pd >= prev - 0.3 && pd <= h.radius + 0.3) {
            // l'onde rase le sol : un saut l'évite
            if (p.pos.y - h.pos.y < 0.55 && p.pos.y - h.pos.y > -1.5) { h.hitDone = true; p.takeDamage(h.damage, { from: h.pos, type: 'shock' }); p.vel.y = Math.max(p.vel.y, 4); }
          }
          if (h.radius >= h.maxR!) done = true;
        }
      } else {
        const k = Math.min(1, h.t / h.delay);
        h.fill!.scale.x = Math.max(0.01, h.width! * k);
        if (h.t >= h.delay) {
          done = true;
          _a.copy(h.pos).addScaledVector(h.dir!, h.len!);
          _b.copy(h.pos).setY(h.pos.y + 1); _c.copy(_a).setY(_a.y + 1);
          g.fx.bolt(_b, _c, h.color, 0.25, 0.35);
          g.fx.tracer(_b, _c, h.color, h.width! * 0.5, 0.3);
          g.audio.explosion(h.pos, 0.5);
          // distance du joueur au segment
          _d.set(p.pos.x - h.pos.x, 0, p.pos.z - h.pos.z);
          const along = _d.dot(h.dir!);
          const perp = Math.abs(_d.x * -h.dir!.z + _d.z * h.dir!.x);
          if (!p.dead && along > -0.5 && along < h.len! + 0.5 && perp < h.width! / 2 + 0.3 && Math.abs(p.pos.y - h.pos.y) < 3) p.takeDamage(h.damage, { from: h.pos, type: 'arcane' });
          h.onBoom?.();
        }
      }
      if (done) { this.disposeHazard(h); this.hazards.splice(i, 1); }
    }
  }

  private disposeHazard(h: Hazard): void {
    h.mesh.removeFromParent();
    h.mesh.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) (m.material as THREE.Material).dispose(); });
  }

  update(dt: number): void {
    this.pathBudget = 3;
    this.updateProjectiles(dt);
    this.updateHazards(dt);
    for (let i = this.fields.length - 1; i >= 0; i--) if (!this.fields[i].update(dt)) { this.fields[i].dispose(); this.fields.splice(i, 1); }
  }

  clear(): void {
    for (const pr of this.projectiles) { pr.mesh.removeFromParent(); (pr.mesh.material as THREE.Material).dispose(); }
    this.projectiles.length = 0;
    for (const h of this.hazards) this.disposeHazard(h);
    this.hazards.length = 0;
    for (const f of this.fields) f.dispose();
    this.fields.length = 0;
    this.dome = null;
  }
}
