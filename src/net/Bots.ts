// Bots des parties publiques : ils remplacent les joueurs manquants. Simulés chez l'hôte, ils passent par
// exactement les mêmes règles que les joueurs (déplacement validé, tir résolu par l'autorité, mêmes armes et dégâts).
// Niveau ajusté après les premiers retours (trop forts) : réaction 0,55 à 0,95 s, rotation plus lente, erreur de visée
// d'environ 2,2°, tir en rafales courtes avec pauses, tête visée rarement, vue limitée à 60 m.
import * as THREE from 'three';
import type { Match, MP } from './Match';
import { THROW_SPEED, THROW_UP } from './Nades';

const R = 0.36, H = 1.8, EYE = 1.62, GRAV = 20;
const REACT = [0.55, 0.95], TURN = 4, ERR_DEG = 2.2, SIGHT = 60;
const BURST = [3, 6], BURST_PAUSE = [0.35, 0.7], HEAD_CHANCE = 0.12;
/** Accès à l'étage central (zone B) : pied d'escalier de chaque camp, puis ligne droite par le conteneur. */
const STAIRS = { red: new THREE.Vector3(-18, 0, 0), blue: new THREE.Vector3(18, 0, 0) };

const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _d = new THREE.Vector3(), _pos = new THREE.Vector3();

export class BotBrain {
  private vy = 0; private grounded = true;
  private path: THREE.Vector3[] | null = null; private pathI = 0; private repathT = 0;
  private goal = new THREE.Vector3(); private hasGoal = false;
  private target: MP | null = null; private reactT = 0; private thinkT = 0; private fireT = 0;
  private strafeT = 0; private strafeDir = 1; private aimHead = false;
  private burstLeft = 0;
  private nadeT = 6 + Math.random() * 8;
  private wasAlive = false;

  constructor(private m: Match, private p: MP) {}

  update(dt: number, now: number): void {
    const p = this.p, g = this.m.g, level = g.level;
    if (!level) return;
    if (!p.alive) { this.wasAlive = false; return; }
    if (!this.wasAlive) { this.wasAlive = true; this.path = null; this.target = null; this.vy = 0; this.hasGoal = false; }
    for (const w of Object.values(p.wpn)) w.reserve = 999; // munitions de réserve illimitées pour les bots
    this.thinkT -= dt; this.repathT -= dt; this.fireT -= dt; this.strafeT -= dt; this.nadeT -= dt;
    if (this.thinkT <= 0) { this.thinkT = 0.25; this.think(); }

    // ---- déplacement ----
    const world = level.world;
    let mx = 0, mz = 0, speed = 0;
    const t = this.target;
    if (t && t.alive) {
      // en combat : décalages latéraux, approche si trop loin
      if (this.strafeT <= 0) { this.strafeT = 0.7 + Math.random() * 0.9; this.strafeDir = Math.random() < 0.5 ? -1 : 1; }
      const dx = t.x - p.x, dz = t.z - p.z, dist = Math.hypot(dx, dz) || 1;
      const ideal = p.st ? Math.min(28, Math.max(10, p.st.rangeStart * 0.7)) : 18;
      const fwd = dist > ideal ? 1 : dist < ideal * 0.5 ? -0.6 : 0;
      mx = (dx / dist) * fwd + (-dz / dist) * this.strafeDir;
      mz = (dz / dist) * fwd + (dx / dist) * this.strafeDir;
      speed = 4.2;
    } else if (this.hasGoal) {
      const wp = this.nextWaypoint();
      if (wp) { const dx = wp.x - p.x, dz = wp.z - p.z, d = Math.hypot(dx, dz) || 1; mx = dx / d; mz = dz / d; speed = 6.5; }
    }
    const ml = Math.hypot(mx, mz);
    if (ml > 0) { mx /= ml; mz /= ml; }
    this.vy -= GRAV * dt;
    _pos.set(p.x, p.y, p.z);
    _d.set(mx * speed * dt, this.vy * dt, mz * speed * dt);
    const res = world.moveCharacter(_pos, _d, R, H, 0.5, this.grounded);
    this.grounded = res.grounded;
    if (this.grounded && this.vy < 0) this.vy = 0;
    if (_pos.y < world.killY) { _pos.set(p.x, Math.max(0.1, p.y), p.z); this.vy = 0; }
    const moved = Math.hypot(_pos.x - p.x, _pos.z - p.z) / Math.max(dt, 1e-3);

    // ---- visée et tir ----
    let yaw = p.yaw, pitch = p.pitch, ads = false;
    if (t && t.alive) {
      const ty = t.y + (this.aimHead ? t.height * 0.9 : t.height * 0.6);
      const dx = t.x - _pos.x, dy = ty - (_pos.y + EYE), dz = t.z - _pos.z;
      const wantYaw = Math.atan2(-dx, -dz), wantPitch = Math.atan2(dy, Math.hypot(dx, dz));
      let dyaw = wantYaw - yaw;
      while (dyaw > Math.PI) dyaw -= Math.PI * 2;
      while (dyaw < -Math.PI) dyaw += Math.PI * 2;
      const step = TURN * dt;
      yaw += Math.max(-step, Math.min(step, dyaw));
      pitch += Math.max(-step, Math.min(step, wantPitch - pitch));
      ads = true;
      this.reactT -= dt;
      if (this.reactT <= 0 && Math.abs(dyaw) < 0.08 && this.fireT <= 0 && p.st) {
        // direction réelle du tir : vers la cible, avec une petite erreur (plus grande si la cible bouge vite)
        const err = (ERR_DEG + Math.min(2, t.speed * 0.2) + (moved > 1 ? 0.8 : 0)) * Math.PI / 180;
        _a.set(_pos.x, _pos.y + EYE, _pos.z);
        _b.set(dx, dy, dz).normalize();
        const ex = (Math.random() * 2 - 1) * err, ey = (Math.random() * 2 - 1) * err;
        _d.set(-_b.z, 0, _b.x).normalize();
        _b.addScaledVector(_d, Math.tan(ex)).add(_d.set(0, Math.tan(ey), 0)).normalize();
        this.m.hostFire(p, { w: p.step.base, ox: _a.x, oy: _a.y, oz: _a.z, dx: _b.x, dy: _b.y, dz: _b.z });
        const auto = p.st.def.auto;
        if (auto) {
          // rafales courtes puis pause, au lieu d'un tir continu
          if (this.burstLeft <= 0) this.burstLeft = BURST[0] + Math.floor(Math.random() * (BURST[1] - BURST[0] + 1));
          this.burstLeft--;
          this.fireT = 60 / p.st.rpm + (this.burstLeft <= 0 ? BURST_PAUSE[0] + Math.random() * (BURST_PAUSE[1] - BURST_PAUSE[0]) : 0.01);
        } else this.fireT = 60 / p.st.rpm + 0.25 + Math.random() * 0.4;
        if (Math.random() < HEAD_CHANCE) this.aimHead = !this.aimHead;
      }
      // grenade de temps en temps, vers une cible à moyenne distance
      const dist = Math.hypot(dx, dz);
      if (this.nadeT <= 0 && p.nades > 0 && dist > 8 && dist < 24 && this.reactT <= 0) {
        this.nadeT = 12 + Math.random() * 10;
        if (Math.random() < 0.6) this.throwAt(_pos, t, dist);
      }
    } else {
      // pas de cible : regarder dans le sens de la marche
      if (moved > 0.5) { const wy = Math.atan2(-mx, -mz); let dyaw = wy - yaw; while (dyaw > Math.PI) dyaw -= Math.PI * 2; while (dyaw < -Math.PI) dyaw += Math.PI * 2; yaw += dyaw * Math.min(1, dt * 6); }
      pitch *= Math.max(0, 1 - dt * 4);
    }
    this.m.acceptMove(p, { x: _pos.x, y: _pos.y, z: _pos.z, yaw, pitch, speed: moved, height: H, ads, crouch: false }, now, true);
  }

  /** Lancer en cloche : angle choisi pour que la grenade retombe près de la cible (sol plat, approximation). */
  private throwAt(from: THREE.Vector3, t: MP, dist: number): void {
    let best = 0.3, be = Infinity;
    for (let th = -0.2; th <= 0.9; th += 0.05) {
      const vx = THROW_SPEED * Math.cos(th), vy = THROW_SPEED * Math.sin(th) + THROW_UP;
      const tf = (vy + Math.sqrt(vy * vy + 2 * 15 * (EYE))) / 15;
      const e = Math.abs(vx * tf - dist);
      if (e < be) { be = e; best = th; }
    }
    const h = Math.atan2(t.z - from.z, t.x - from.x) + (Math.random() - 0.5) * 0.12;
    const c = Math.cos(best);
    this.m.hostNade(this.p, { ox: from.x, oy: from.y + EYE, oz: from.z, dx: Math.cos(h) * c, dy: Math.sin(best), dz: Math.sin(h) * c });
  }

  /** Choix de la cible (ennemi visible le plus proche) et de l'objectif de déplacement. */
  private think(): void {
    const p = this.p, m = this.m, world = m.g.level!.world;
    _a.set(p.x, p.y + EYE, p.z);
    let best: MP | null = null, bd = SIGHT;
    for (const q of m.players) {
      if (q === p || !q.alive || (!q.connected && !q.bot) || (p.team && q.team === p.team)) continue;
      const d = Math.hypot(q.x - p.x, q.z - p.z, q.y - p.y);
      if (d > bd) continue;
      _b.set(q.x, q.y + q.height * 0.6, q.z);
      if (!world.los(_a, _b)) continue;
      bd = d; best = q;
    }
    if (best !== this.target) {
      this.target = best;
      if (best) { this.reactT = REACT[0] + Math.random() * (REACT[1] - REACT[0]); this.aimHead = Math.random() < HEAD_CHANCE; this.burstLeft = 0; }
    }
    if (best) return;
    // objectif sans cible
    const goal = this.pickGoal();
    if (goal && (!this.hasGoal || goal.distanceTo(this.goal) > 3 || this.repathT <= 0)) {
      this.goal.copy(goal); this.hasGoal = true; this.repathT = 2;
      const nav = world.nav;
      const dest = goal.y > 1.5 && p.team ? STAIRS[p.team] : goal; // zone B : d'abord le pied d'escalier de son camp
      this.path = nav ? nav.findPath(p.x, p.z, dest.x, dest.z) : null;
      this.pathI = 0;
    }
  }

  private pickGoal(): THREE.Vector3 | null {
    const p = this.p, m = this.m;
    if (m.mode === 'dom' && m.zones.length) {
      // zones que l'équipe ne tient pas, la plus proche ; sinon défendre la plus proche
      const mine = m.zones.filter((z) => z.owner !== p.team);
      const pool = mine.length ? mine : m.zones;
      let best = pool[0], bd = Infinity;
      for (const z of pool) { const d = Math.hypot(z.pos.x - p.x, z.pos.z - p.z) + (z.pos.y > 1 ? 12 : 0); if (d < bd) { bd = d; best = z; } }
      _b.set(best.pos.x + (Math.random() - 0.5) * 2, best.pos.y, best.pos.z + (Math.random() - 0.5) * 2);
      return _b;
    }
    // chasse : ennemi vivant le plus proche (position connue de l'hôte, sans tricher sur la vue : il faut encore le voir pour tirer)
    let best: MP | null = null, bd = Infinity;
    for (const q of m.players) {
      if (q === p || !q.alive || (p.team && q.team === p.team)) continue;
      const d = Math.hypot(q.x - p.x, q.z - p.z);
      if (d < bd) { bd = d; best = q; }
    }
    return best ? _b.set(best.x, best.y, best.z) : _b.set(0, 0, 0);
  }

  private nextWaypoint(): THREE.Vector3 | null {
    const p = this.p;
    // dernière portion vers l'étage : ligne droite depuis le pied d'escalier
    if (this.goal.y > 1.5 && p.team && Math.hypot(p.x - STAIRS[p.team].x, p.z - STAIRS[p.team].z) < 2.5) return this.goal;
    if (this.goal.y > 1.5 && p.y > 1.5) return this.goal;
    const path = this.path;
    if (!path || this.pathI >= path.length) { this.repathT = 0; return Math.hypot(this.goal.x - p.x, this.goal.z - p.z) > 1.5 ? this.goal : null; }
    const wp = path[this.pathI];
    if (Math.hypot(wp.x - p.x, wp.z - p.z) < 0.8) this.pathI++;
    return wp;
  }
}
