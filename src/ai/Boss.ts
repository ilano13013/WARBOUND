// Les trois boss de la campagne : phases distinctes, attaques annoncées, boucliers liés à l'environnement.
import * as THREE from 'three';
import type { Game } from '../core/Game';
import type { EnemyKind } from '../data/enemies';
import type { DamageInfo } from '../world/World';
import type { Destructible } from '../world/Level';
import { cmat, mat } from '../render/Materials';
import { Enemy } from './Enemy';
import { add, box, cone, cyl, humanoid, markerSprite, oct, pivot, sph, type EnemyModel } from './EnemyModels';
import { buildRiggedEnemy } from './EnemyRigs';

const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3();

export abstract class Boss extends Enemy {
  phase = 1;
  phases = 3;
  shielded = false;
  exposedT = 0; // fenêtre de dégâts bonus
  protected actT = 2.5; // délai avant la prochaine action
  protected busyT = 0;
  protected attackI = 0;
  protected summonT = 8;
  protected introT = 2.2;
  arena = new THREE.Vector3();
  arenaR = 20;
  onPhase: ((phase: number) => void) | null = null;
  onShield: ((up: boolean) => void) | null = null;
  protected shieldMesh: THREE.Mesh;
  subtitle = '';

  constructor(g: Game, kind: EnemyKind, x: number, z: number, model: EnemyModel) {
    super(g, kind, x, z, { noLoot: true });
    this.isBoss = true;
    this.model.root.removeFromParent();
    this.rig?.dispose(); this.rig = null;
    const rg = buildRiggedEnemy(kind);
    if (rg) {
      // modèle animé : les ornements procéduraux (halos, cristaux) sont conservés et rattachés au nouveau modèle
      for (const o of model.extra) { const w = o.getWorldPosition(new THREE.Vector3()); rg.model.root.add(o); o.position.copy(w); }
      rg.model.extra = model.extra;
      model = rg.model; this.rig = rg.rig;
    }
    this.model = model;
    g.r.scene.add(model.root);
    this.shieldMesh = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), new THREE.MeshBasicMaterial({ color: 0x4ad8ff, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    this.shieldMesh.visible = false;
    this.shieldMesh.scale.set(this.radius * 2.2, this.height * 0.65, this.radius * 2.2);
    this.shieldMesh.position.y = this.height * 0.5;
    model.root.add(this.shieldMesh);
    this.state = 'combat';
    this.arena.set(x, 0, z);
    this.syncModel();
  }

  protected setShield(up: boolean): void {
    this.shielded = up; this.shieldMesh.visible = up;
    this.onShield?.(up);
    if (up) this.g.audio.skill('fortress');
    else { this.exposedT = 5; this.g.audio.explosion(this.pos, 0.8); this.g.fx.shock(this.center(_a), this.height, 0x4ad8ff, 0.5); this.g.ui.hud.toast('BOUCLIER BRISÉ — DÉGÂTS AMPLIFIÉS', '#4ad8ff'); }
  }

  protected modifyDamage(dmg: number, _info: DamageInfo): number {
    if (this.shielded || this.introT > 0) return 0;
    if (this.exposedT > 0) dmg *= 1.5;
    return dmg;
  }

  protected setPhase(n: number): void {
    if (n <= this.phase) return;
    this.phase = n;
    this.g.audio.bossRoar(this.pos);
    this.g.player.shakeAmt = 0.8;
    this.g.fx.shock(this.center(_a), this.height * 1.5, 0xffffff, 0.5);
    this.g.fx.explosion(this.center(_a), this.height * 1.2, this.kind === 'guardian' ? 0xff8a2a : this.kind === 'archon' ? 0x9a5aff : 0xff3a5a);
    this.g.fx.ring(this.pos, 1, this.arenaR, 0xffffff, 0.9);
    this.busyT = Math.max(this.busyT, 1.6);
    this.onPhase?.(n);
    this.enterPhase(n);
  }
  protected enterPhase(_n: number): void { /* spécifique */ }

  protected think(dt: number): void {
    this.state = 'combat';
    if (this.introT > 0) { this.introT -= dt; return; }
    if (this.exposedT > 0) this.exposedT -= dt;
    if (this.g.player.dead) return;
    const hpK = this.hp / this.maxHp;
    if (this.phase === 1 && hpK <= 0.66) this.setPhase(2);
    else if (this.phase === 2 && hpK <= 0.33 && !this.shielded) this.setPhase(3);
    this.bossThink(dt);
  }
  protected abstract bossThink(dt: number): void;

  protected playerPos(out: THREE.Vector3): THREE.Vector3 { return out.copy(this.g.player.pos); }

  protected countAdds(): number { let n = 0; for (const e of this.g.enemies) if (e.alive && !e.isBoss && e.group === 'boss-add') n++; return n; }

  protected summon(kind: EnemyKind, n: number): void {
    const g = this.g, nav = g.level!.world.nav;
    for (let i = 0; i < n; i++) {
      // jamais directement sur le joueur
      for (let k = 0; k < 10; k++) {
        if (!nav.randomOpen(this.arena.x, this.arena.z, 4, this.arenaR - 2, _a)) continue;
        if (_a.distanceTo(g.player.pos) < 9) continue;
        const p = _a.clone();
        g.fx.ring(p, 0.3, 2.2, 0x9a5aff, 0.9);
        g.fx.burst(p.clone().setY(1), { count: 20, color: 0x9a5aff, speed: 3, life: 0.9, size: 0.2, gravity: -2 });
        g.after(0.9, () => { if (this.alive) g.spawnEnemy(kind, p.x, p.z, { alert: true, noLoot: true, group: 'boss-add' }); });
        break;
      }
    }
  }

  protected onDeath(): void {
    const g = this.g;
    this.shieldMesh.visible = false;
    for (const e of g.enemies) if (e.alive && e.group === 'boss-add') e.takeDamage(99999, { source: 'world', type: 'explosion' });
    for (let i = 0; i < 6; i++) g.after(i * 0.35, () => { _a.set(this.pos.x + (Math.random() - 0.5) * 3, this.pos.y + 0.5 + Math.random() * this.height, this.pos.z + (Math.random() - 0.5) * 3); g.fx.explosion(_a, 3, i % 2 ? 0x9a5aff : 0xff8a2a); g.audio.explosion(_a, 0.8); });
    g.profile!.stats.bossKills++;
  }

  private castPrev = 0;
  /** Animation commune des boss animés ; `cast` > valeur précédente déclenche un sort. */
  protected bossRig(dt: number, gunUp: boolean, cast = 0, lift = 0): void {
    const rig = this.rig!;
    if (cast > this.castPrev + 0.05) rig.cast();
    this.castPrev = cast;
    rig.setMotion(Math.hypot(this.vel.x, this.vel.z), gunUp, dt);
    rig.update(dt);
    rig.model.position.y = lift;
    if (this.exposedT > 0) rig.root.rotation.z = Math.sin(this.walkPhase * 8) * 0.02; else rig.root.rotation.z = 0;
    this.walkPhase += dt;
    this.shieldMesh.rotation.y += dt;
  }

  protected updateDeath(dt: number): void {
    if (this.removed) return;
    this.deathT += dt;
    const r = this.model.root;
    if (this.rig) {
      this.rig.update(dt);
      if (this.deathT > 3) r.position.y = this.pos.y - (this.deathT - 3) * 0.6;
      if (this.deathT > 6) this.remove();
      return;
    }
    r.rotation.x = Math.min(0.5, this.deathT * 0.25);
    r.position.y = this.pos.y - Math.max(0, this.deathT - 2) * 0.8;
    r.position.x = this.pos.x + (Math.random() - 0.5) * 0.08;
    if (this.deathT > 5) this.remove();
  }
}

// =====================================================================
// BOSS 1 — LE GARDIEN D'HELIX
// =====================================================================

function guardianModel(): EnemyModel {
  const root = new THREE.Group();
  const hull = cmat(0x3a4048, 0.4, 0.8), dark = cmat(0x16181c, 0.5, 0.7), glow = mat('glow_orange'), haz = mat('hazard');
  const hips = pivot(root, 0, 1.7, 0);
  add(hips, box(1.5, 0.5, 1.1), dark, 0, 0, 0);
  const legL = pivot(hips, -0.85, 0, 0), legR = pivot(hips, 0.85, 0, 0);
  for (const l of [legL, legR]) {
    add(l, box(0.55, 0.9, 0.65), hull, 0, -0.4, -0.1, 0.25);
    add(l, box(0.45, 0.95, 0.5), hull, 0, -1.05, 0.1, -0.3);
    add(l, box(0.75, 0.3, 1.1), dark, 0, -1.55, -0.1);
    add(l, box(0.6, 0.12, 0.7), haz, 0, -0.75, -0.25);
    add(l, cyl(0.2, 0.2, 0.62, 8), dark, 0, -0.75, 0, 0, 0, Math.PI / 2);
  }
  const body = pivot(hips, 0, 0.25, 0);
  add(body, box(2.1, 1.1, 1.5), hull, 0, 0.6, 0);
  add(body, box(1.5, 0.5, 1.2), hull, 0, 1.35, 0.05);
  add(body, box(1.2, 0.35, 0.1), haz, 0, 0.3, -0.78);
  const eye = add(body, box(0.9, 0.16, 0.06), glow, 0, 1.0, -0.77);
  add(body, sph(0.36, 12, 8), glow, 0, 0.62, -0.62);
  add(body, box(0.5, 0.8, 0.5), dark, 0, 0.7, 0.9); // réacteur dorsal
  for (const s of [-1, 1]) { add(body, cyl(0.1, 0.14, 1.1, 6), dark, s * 0.5, 1.9, 0.5, -0.3); add(body, box(0.08, 0.08, 0.08), mat('glow_red'), s * 0.5, 2.45, 0.34); }
  const armL = pivot(body, -1.35, 1.0, 0), armR = pivot(body, 1.35, 1.0, 0);
  for (const a of [armL, armR]) {
    add(a, box(0.6, 0.6, 0.7), hull, 0, 0, 0);
    add(a, box(0.42, 1.0, 0.45), dark, 0, -0.7, 0);
  }
  // bras droit : canon ; bras gauche : poing-masse
  add(armR, cyl(0.26, 0.3, 1.5, 10), hull, 0, -1.2, -0.5, Math.PI / 2);
  add(armR, cyl(0.16, 0.16, 0.5, 10), glow, 0, -1.2, -1.15, Math.PI / 2);
  const muzzle = pivot(armR, 0, -1.2, -1.4);
  add(armL, box(0.75, 0.75, 0.85), hull, 0, -1.35, 0);
  add(armL, box(0.8, 0.14, 0.9), haz, 0, -1.2, 0);
  const marker = markerSprite(); marker.position.y = 4.4; root.add(marker);
  return { root, body, head: null, legL, legR, armL, armR, extra: [eye], muzzle, shield: null, marker };
}

export class Guardian extends Boss {
  conduits: Destructible[] = [];
  private stompAnim = 0;
  private barrage = 0; private barrageT = 0;

  constructor(g: Game, x: number, z: number) {
    super(g, 'guardian', x, z, guardianModel());
    this.shieldMesh.material = new THREE.MeshBasicMaterial({ color: 0xff8a2a, transparent: true, opacity: 0.24, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    this.subtitle = 'Prototype de défense HX-9';
  }

  hitTest(o: THREE.Vector3, d: THREE.Vector3, maxT: number): { t: number; head: boolean } | null {
    // point faible : le cœur lumineux sur le torse
    const h = super.hitTest(o, d, maxT);
    if (!h) return null;
    const py = o.y + d.y * h.t;
    const rel = py - this.pos.y;
    const fx = -Math.sin(this.yaw), fz = -Math.cos(this.yaw);
    const front = -(d.x * fx + d.z * fz) > 0.5;
    return { t: h.t, head: front && rel > 2.2 && rel < 3.0 };
  }

  protected enterPhase(n: number): void {
    if (n === 2) {
      for (const c of this.conduits) { c.revive(260); c.invulnerable = false; }
      this.setShield(true);
      this.g.ui.hud.toast('DÉTRUISEZ LES DEUX CONDUITS D’ÉNERGIE', '#ff8a2a');
    } else if (n === 3) { this.summonT = 1.5; }
  }

  protected bossThink(dt: number): void {
    const g = this.g, p = g.player;
    this.playerPos(_a);
    const dist = Math.hypot(_a.x - this.pos.x, _a.z - this.pos.z);
    if (this.shielded && this.conduits.every((c) => !c.alive)) { this.setShield(false); this.busyT = 4; g.audio.bossRoar(this.pos); }
    if (this.shielded) for (const c of this.conduits) if (c.alive && Math.random() < 0.25) { _b.copy(c.center); g.fx.tracer(_b, this.center(_c), 0xff8a2a, 0.04, 0.1); }
    // salve d'explosions (phase 3)
    if (this.barrage > 0) {
      this.barrageT -= dt;
      if (this.barrageT <= 0) {
        this.barrageT = 0.32; this.barrage--;
        _b.set(p.pos.x + (Math.random() - 0.5) * 9 + p.vel.x * 0.6, 0, p.pos.z + (Math.random() - 0.5) * 9 + p.vel.z * 0.6);
        _b.y = Math.max(0, g.level!.world.groundAt(_b.x, _b.z, p.pos.y + 1));
        g.combat.hazardCircle(_b, 3.2, 1.35, 34 * g.diff.damage, 0xff5a1a);
      }
    }
    if (this.busyT > 0) { this.busyT -= dt; this.facePoint(_a, dt, 1.2); return; }
    this.facePoint(_a, dt, 2.2);
    // avance lentement vers le joueur
    if (dist > 7) { this.moving = true; this.goTo(_a.x, _a.z); this.follow(dt, this.def.speed * (this.phase === 3 ? 1.25 : 1), false); }
    if (this.phase === 3) {
      this.summonT -= dt;
      if (this.summonT <= 0) { this.summonT = 15; if (this.countAdds() < 5) this.summon('devourer', 3); }
    }
    this.actT -= dt;
    if (this.actT > 0) return;
    const cdK = g.diff.cooldown * (this.phase === 3 ? 0.8 : 1);
    this.attackI++;
    if (dist < 6) {
      // frappe au sol rapprochée
      g.combat.hazardCircle(this.pos.clone(), 6, 0.9, 42 * g.diff.damage, 0xff5a1a);
      g.audio.charge(this.pos, 0.8); this.stompAnim = 0.9; this.busyT = 1.2; this.actT = 2.2 * cdK; this.rig?.attack(true);
    } else if (this.attackI % 3 === 0) {
      // onde de choc : sauter pour l'éviter
      this.stompAnim = 0.8; this.busyT = 1.3; this.actT = 3.0 * cdK; this.rig?.attack(false);
      g.audio.charge(this.pos, 0.7);
      g.combat.hazardWave(this.pos.clone(), 26, 13, 26 * g.diff.damage, 0xff8a2a, 0.75);
      g.after(0.75, () => { if (this.alive) { g.audio.explosion(this.pos, 1); g.player.shakeAmt = Math.min(1, g.player.shakeAmt + 0.5); } });
      if (this.phase >= 2) g.after(1.5, () => { if (this.alive) g.combat.hazardWave(this.pos.clone(), 26, 13, 26 * g.diff.damage, 0xff8a2a, 0.5); });
    } else if (this.phase === 3 && this.attackI % 3 === 1) {
      this.barrage = 6; this.barrageT = 0; this.busyT = 1.5; this.actT = 3.6 * cdK;
      g.audio.warn(null);
    } else {
      // tirs de canon annoncés par une ligne au sol
      const n = this.phase === 1 ? 2 : 3;
      this.busyT = n * 0.9 + 0.4; this.actT = (n * 0.9 + 2.2) * cdK;
      for (let i = 0; i < n; i++) g.after(i * 0.9, () => {
        if (!this.alive) return;
        this.muzzlePos(_b); _b.y = Math.max(0, g.level!.world.groundAt(this.pos.x, this.pos.z, this.pos.y + 1));
        _c.set(p.pos.x + p.vel.x * 0.35 - this.pos.x, 0, p.pos.z + p.vel.z * 0.35 - this.pos.z).normalize();
        const origin = new THREE.Vector3(this.pos.x, _b.y, this.pos.z);
        g.audio.charge(this.pos, 0.9);
        g.combat.hazardLine(origin, _c.clone(), 46, 2.4, 1.0, 30 * g.diff.damage, 0xff5a1a, () => { g.audio.enemyShot('sniper', this.pos); this.rig?.fire(); });
      });
    }
  }

  protected animate(dt: number): void {
    if (this.rig) { this.bossRig(dt, false); return; }
    const m = this.model;
    const sp = Math.hypot(this.vel.x, this.vel.z);
    this.walkPhase += dt * (1.5 + sp * 1.6);
    const sw = Math.min(1, sp / 2) * 0.45;
    m.legL!.rotation.x = Math.sin(this.walkPhase) * sw; m.legR!.rotation.x = -Math.sin(this.walkPhase) * sw;
    if (this.stompAnim > 0) { this.stompAnim -= dt; m.legR!.rotation.x = -Math.sin(Math.min(1, this.stompAnim / 0.8) * Math.PI) * 0.9; m.armL!.rotation.x = -Math.sin(Math.min(1, this.stompAnim / 0.8) * Math.PI) * 1.4; }
    else m.armL!.rotation.x *= 0.9;
    m.body.rotation.x = -this.flinch * 0.06;
    m.body.position.y = 0.25 + Math.abs(Math.sin(this.walkPhase)) * 0.06 * sw;
    m.armR!.rotation.x = -0.9 + Math.sin(this.walkPhase * 0.5) * 0.05;
    if (this.exposedT > 0) m.body.rotation.z = Math.sin(this.walkPhase * 8) * 0.03; else m.body.rotation.z = 0;
    this.shieldMesh.rotation.y += dt;
  }
}

// =====================================================================
// BOSS 2 — L'ARCHONTE DU VOILE
// =====================================================================

function archonModel(): EnemyModel {
  const root = new THREE.Group();
  const robe = cmat(0x1c1230, 0.8, 0.1), gold = cmat(0x8a6a2a, 0.3, 0.9), cr = mat('crystal');
  const body = pivot(root, 0, 0.6, 0);
  add(body, cone(0.95, 2.4, 10), robe, 0, 0.9, 0);
  add(body, cyl(0.42, 0.6, 0.9, 10), robe, 0, 2.0, 0);
  add(body, box(1.5, 0.22, 0.5), gold, 0, 2.4, 0);
  for (const s of [-1, 1]) { add(body, cone(0.22, 0.7, 5), gold, s * 0.8, 2.65, 0, 0, 0, -s * 0.5); }
  const head = pivot(body, 0, 2.75, 0);
  add(head, sph(0.24, 10, 8), cmat(0x0a0812, 0.3, 0.3), 0, 0, 0);
  add(head, box(0.3, 0.05, 0.05), mat('glow_violet'), 0, 0.02, -0.22);
  for (let i = 0; i < 5; i++) { const a = (i - 2) * 0.45; add(head, cone(0.05, 0.42 - Math.abs(i - 2) * 0.08, 4), cr, Math.sin(a) * 0.3, 0.36, Math.cos(a) * 0.1 - 0.05, 0, 0, -a * 0.6); }
  const armL = pivot(body, -0.7, 2.3, 0), armR = pivot(body, 0.7, 2.3, 0);
  for (const a of [armL, armR]) { add(a, box(0.2, 0.95, 0.24), robe, 0, -0.45, 0); add(a, sph(0.16, 8, 6), mat('glow_violet'), 0, -1.0, 0); }
  armL.rotation.z = -0.5; armR.rotation.z = 0.5;
  const extra: THREE.Object3D[] = [];
  const halo = new THREE.Mesh(new THREE.TorusGeometry(1.25, 0.04, 6, 40), mat('glow_violet')); halo.position.y = 2.2; halo.rotation.x = Math.PI / 2; body.add(halo); extra.push(halo);
  const halo2 = new THREE.Mesh(new THREE.TorusGeometry(0.75, 0.03, 6, 32), mat('glow_blue')); halo2.position.y = 3.2; halo2.rotation.x = Math.PI / 2; body.add(halo2); extra.push(halo2);
  for (let i = 0; i < 4; i++) extra.push(add(body, oct(0.16), cr, 0, 1.6, 0));
  const marker = markerSprite(); marker.position.y = 4.4; root.add(marker);
  return { root, body, head, legL: null, legR: null, armL, armR, extra, muzzle: pivot(body, 0, 2.0, -0.7), shield: null, marker };
}

export class Archon extends Boss {
  crystals: Destructible[] = [];
  anchors: THREE.Vector3[] = [];
  private tpT = 5; private shieldsUsed = 0; private volley = 0; private volleyT = 0; private castAnim = 0; private fading = 0; private tpTarget = new THREE.Vector3();

  constructor(g: Game, x: number, z: number) {
    super(g, 'archon', x, z, archonModel());
    this.shieldMesh.material = new THREE.MeshBasicMaterial({ color: 0x9a5aff, transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    this.subtitle = 'Voix de l’Ordre du Voile';
    this.pos.y = 0.05;
  }

  protected integrate(): void { /* l'Archonte lévite et ne se déplace que par téléportation */ }

  private raiseShield(): void {
    this.shieldsUsed++;
    for (const c of this.crystals) { c.revive(190); c.invulnerable = false; }
    this.setShield(true);
    this.g.ui.hud.toast('BOUCLIER DU VOILE — BRISEZ LES CRISTAUX', '#b06aff');
  }

  protected enterPhase(n: number): void {
    if (n === 2) this.raiseShield();
    if (n === 3) { this.raiseShield(); }
  }

  private teleport(): void {
    const g = this.g;
    if (!this.anchors.length) return;
    let best = this.anchors[0], tries = 0;
    do { best = this.anchors[Math.floor(Math.random() * this.anchors.length)]; tries++; } while (tries < 8 && (best.distanceTo(this.pos) < 3 || best.distanceTo(g.player.pos) < 7));
    this.tpTarget.copy(best); this.fading = 0.5;
    g.fx.burst(this.center(_a), { count: 30, color: 0x9a5aff, speed: 5, life: 0.6, size: 0.22, gravity: 0 });
    g.audio.skill('blink');
    g.fx.ring(best, 0.5, 3, 0x9a5aff, 0.5);
  }

  protected bossThink(dt: number): void {
    const g = this.g, p = g.player;
    this.playerPos(_a);
    this.facePoint(_a, dt, 5);
    if (this.fading > 0) {
      this.fading -= dt;
      this.model.root.scale.setScalar(Math.max(0.05, this.fading / 0.5));
      if (this.fading <= 0) { this.pos.copy(this.tpTarget); this.pos.y = 0.05; this.model.root.scale.setScalar(1); g.fx.burst(this.center(_a), { count: 30, color: 0xc09aff, speed: 5, life: 0.6, size: 0.22, gravity: 0 }); }
      return;
    }
    if (this.shielded && this.crystals.every((c) => !c.alive)) { this.setShield(false); this.busyT = 3.5; }
    if (this.shielded) for (const c of this.crystals) if (c.alive && Math.random() < 0.2) g.fx.tracer(c.center, this.center(_c), 0x9a5aff, 0.04, 0.12);
    const fast = this.phase === 3 && !this.shielded;
    // salve de projectiles en cours
    if (this.volley > 0) {
      this.volleyT -= dt;
      if (this.volleyT <= 0) {
        this.volleyT = fast ? 0.13 : 0.2; this.volley--;
        this.muzzlePos(_b);
        _c.set(p.pos.x + p.vel.x * 0.4, p.pos.y + 1, p.pos.z + p.vel.z * 0.4).sub(_b).normalize();
        const spread = (this.volley % 5 - 2) * 0.09;
        _c.applyAxisAngle(_a.set(0, 1, 0), spread);
        g.combat.spawnProjectile({ pos: _b, vel: _c.multiplyScalar(fast ? 19 : 15), damage: this.def.damage * g.diff.damage, radius: 0.32, color: 0xb06aff, owner: 'enemy', life: 6, aoe: 1.8, homing: this.volley % 3 === 0 ? 0.5 : 0 });
        g.audio.enemyShot('orb', this.pos); this.castAnim = 0.3;
      }
    }
    if (this.busyT > 0) { this.busyT -= dt; return; }
    this.tpT -= dt;
    if (this.tpT <= 0 && this.volley <= 0) { this.tpT = (fast ? 3.2 : this.shielded ? 7 : 5.5) + Math.random() * 1.5; this.teleport(); return; }
    this.actT -= dt;
    if (this.actT > 0) return;
    const cdK = g.diff.cooldown * (fast ? 0.55 : 1);
    this.attackI++;
    const kind = this.attackI % 3;
    if (kind === 0 || (this.shielded && kind === 1)) {
      // zones dangereuses sous et autour du joueur
      const n = this.shielded ? 4 : fast ? 5 : 3;
      for (let i = 0; i < n; i++) {
        _b.set(p.pos.x + (i === 0 ? 0 : (Math.random() - 0.5) * 10) + p.vel.x * 0.5, 0, p.pos.z + (i === 0 ? 0 : (Math.random() - 0.5) * 10) + p.vel.z * 0.5);
        _b.y = Math.max(0, g.level!.world.groundAt(_b.x, _b.z, p.pos.y + 1));
        g.combat.hazardCircle(_b, 3, 1.3 + i * 0.18, 30 * g.diff.damage, 0x9a5aff);
      }
      g.audio.charge(this.pos, 1.0); this.castAnim = 1; this.actT = 3.0 * cdK;
    } else if (kind === 1) {
      this.volley = fast ? 9 : 6; this.volleyT = 0.4; g.audio.charge(this.pos, 0.4); this.actT = 3.4 * cdK;
    } else {
      // rayons en éventail
      const n = fast ? 5 : 3;
      const base = Math.atan2(p.pos.x - this.pos.x, p.pos.z - this.pos.z);
      for (let i = 0; i < n; i++) {
        const a = base + (i - (n - 1) / 2) * 0.4;
        g.combat.hazardLine(new THREE.Vector3(this.pos.x, Math.max(0, this.pos.y - 0.05), this.pos.z), new THREE.Vector3(Math.sin(a), 0, Math.cos(a)), 40, 1.8, 1.25, 28 * g.diff.damage, 0xb06aff);
      }
      g.audio.charge(this.pos, 1.1); this.castAnim = 1.1; this.actT = 3.2 * cdK;
    }
  }

  protected animate(dt: number): void {
    if (this.rig) {
      const m = this.model; this.walkPhase += dt;
      if (m.extra.length >= 6) { m.extra[0].rotation.z += dt * 0.8; m.extra[1].rotation.z -= dt * 1.4; for (let i = 2; i < 6; i++) { const a = this.walkPhase * 0.9 + i * Math.PI / 2; m.extra[i].position.set(Math.cos(a) * 1.6, 1.8 + Math.sin(a * 2) * 0.3, Math.sin(a) * 1.6); m.extra[i].rotation.y += dt * 2; } }
      if (this.castAnim > 0) this.castAnim -= dt;
      this.bossRig(dt, false, this.castAnim, 0.35 + Math.sin(this.walkPhase * 1.4) * 0.18);
      return;
    }
    const m = this.model;
    this.walkPhase += dt;
    m.body.position.y = 0.6 + Math.sin(this.walkPhase * 1.4) * 0.18;
    m.extra[0].rotation.z += dt * 0.8; m.extra[1].rotation.z -= dt * 1.4;
    for (let i = 2; i < 6; i++) { const a = this.walkPhase * 0.9 + i * Math.PI / 2; m.extra[i].position.set(Math.cos(a) * 1.5, 1.6 + Math.sin(a * 2) * 0.3, Math.sin(a) * 1.5); m.extra[i].rotation.y += dt * 2; }
    if (this.castAnim > 0) this.castAnim -= dt;
    const up = this.castAnim > 0 ? -2.4 : -0.2;
    m.armL!.rotation.x += (up - m.armL!.rotation.x) * Math.min(1, dt * 8); m.armR!.rotation.x += (up - m.armR!.rotation.x) * Math.min(1, dt * 8);
    this.shieldMesh.rotation.y += dt;
  }
}

// =====================================================================
// BOSS FINAL — LE SOUVERAIN FRACTURÉ
// =====================================================================

function sovereignModel(): EnemyModel & { wings: THREE.Group } {
  const m = humanoid({ cloth: 0x15161a, armor: 0x2a2030, eye: 0xff3a5a, bulk: 1.25, gunLen: 0.95 });
  const gold = cmat(0x7a5a2a, 0.3, 0.9);
  add(m.body, box(0.75, 1.1, 0.05), cmat(0x3a0a14, 0.9, 0), 0, 0.15, 0.3, 0.12); // cape
  for (const s of [-1, 1]) { add(m.body, box(0.3, 0.12, 0.34), gold, s * 0.42, 0.68, 0); add(m.body, cone(0.07, 0.3, 4), mat('crystal_red'), s * 0.46, 0.86, 0); }
  add(m.head!, cone(0.06, 0.26, 4), mat('crystal_red'), 0, 0.36, -0.02);
  for (const s of [-1, 1]) add(m.head!, cone(0.045, 0.2, 4), mat('crystal_red'), s * 0.12, 0.3, 0);
  add(m.body, oct(0.11), mat('crystal_red'), 0, 0.5, -0.19);
  // attributs de la forme dimensionnelle (phase 2+)
  const wings = new THREE.Group();
  for (const s of [-1, 1]) for (let i = 0; i < 4; i++) {
    const w = add(wings, oct(0.3), mat('crystal_red'), s * (0.5 + i * 0.36), 0.75 + i * 0.26, 0.35, 0, 0, -s * (0.5 + i * 0.2));
    w.scale.set(0.35, 2.0 - i * 0.25, 0.25);
  }
  const halo = new THREE.Mesh(new THREE.TorusGeometry(0.75, 0.035, 6, 36), mat('glow_red')); halo.position.set(0, 1.25, 0.25); wings.add(halo);
  wings.visible = false;
  m.body.add(wings);
  m.root.scale.setScalar(1.5);
  m.marker.position.y = 2.3;
  return Object.assign(m, { wings });
}

export class Sovereign extends Boss {
  anchors: THREE.Vector3[] = [];
  private wings: THREE.Group;
  private burstN = 0; private burstTm = 0; private dashT = 0; private dashDir = new THREE.Vector3();
  private rootScale = 1.5;
  private volley = 0; private volleyT = 0; private transformT = 0; private fading = 0; private tpTarget = new THREE.Vector3(); private tpT = 6; private pulseI = 0; private castAnim = 0;

  constructor(g: Game, x: number, z: number) {
    const m = sovereignModel();
    super(g, 'sovereign', x, z, m);
    this.wings = m.wings;
    if (this.rig) { this.rootScale = 1; this.rig.root.add(this.wings); this.wings.position.set(0, 1.55, 0.15); this.wings.scale.setScalar(1.5); }
    this.subtitle = 'Commandant Aldric Voss — Directeur du projet HELIX';
    this.shieldMesh.material = new THREE.MeshBasicMaterial({ color: 0xff3a5a, transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  }

  protected enterPhase(n: number): void {
    const g = this.g;
    if (n === 2) {
      // transformation : brève invulnérabilité annoncée
      this.transformT = 3; this.busyT = 3; this.shielded = true; this.shieldMesh.visible = true;
      this.burstN = 0; this.dashT = 0;
      g.ui.hud.toast('LE SOUVERAIN SE TRANSFORME', '#ff3a5a');
    } else if (n === 3) {
      this.summonT = 2; this.pulseI = 0;
      g.ui.hud.toast('L’ARÈNE SE DÉSTABILISE', '#ff3a5a');
    }
  }

  protected integrate(dt: number): void {
    if (this.phase >= 2) { this.vel.set(0, 0, 0); return; }
    super.integrate(dt);
  }

  private teleport(): void {
    const g = this.g;
    if (!this.anchors.length) return;
    let best = this.anchors[0], tries = 0;
    do { best = this.anchors[Math.floor(Math.random() * this.anchors.length)]; tries++; } while (tries < 8 && (best.distanceTo(this.pos) < 4 || best.distanceTo(g.player.pos) < 8));
    this.tpTarget.copy(best); this.fading = 0.45;
    g.fx.burst(this.center(_a), { count: 30, color: 0xff3a5a, speed: 5, life: 0.6, size: 0.22, gravity: 0 });
    g.audio.skill('blink'); g.fx.ring(best, 0.5, 3, 0xff3a5a, 0.5);
  }

  private zones(n: number, r: number, delay: number, dmg: number): void {
    const g = this.g, p = g.player;
    for (let i = 0; i < n; i++) {
      _b.set(p.pos.x + (i === 0 ? 0 : (Math.random() - 0.5) * 12) + p.vel.x * 0.5, 0, p.pos.z + (i === 0 ? 0 : (Math.random() - 0.5) * 12) + p.vel.z * 0.5);
      _b.y = Math.max(0, g.level!.world.groundAt(_b.x, _b.z, p.pos.y + 1));
      g.combat.hazardCircle(_b, r, delay + i * 0.15, dmg * g.diff.damage, 0xff3a5a);
    }
  }

  protected bossThink(dt: number): void {
    const g = this.g, p = g.player;
    this.playerPos(_a);
    const dist = Math.hypot(_a.x - this.pos.x, _a.z - this.pos.z);
    this.facePoint(_a, dt, this.dashT > 0 ? 0 : 5);
    if (this.transformT > 0) {
      this.transformT -= dt;
      if (Math.random() < 0.7) g.fx.burst(this.center(_b), { count: 3, color: 0xff3a5a, color2: 0x9a5aff, speed: 6, life: 0.7, size: 0.22, gravity: -2 });
      this.pos.y = Math.min(1.2, this.pos.y + dt * 0.5);
      if (this.transformT <= 0) { this.wings.visible = true; this.shielded = false; this.shieldMesh.visible = false; g.audio.bossRoar(this.pos); g.fx.shock(this.center(_b), 8, 0xff3a5a, 0.5); g.combat.hazardWave(new THREE.Vector3(this.pos.x, 0, this.pos.z), 28, 14, 24 * g.diff.damage, 0xff3a5a, 0.3); }
      return;
    }
    if (this.fading > 0) {
      this.fading -= dt;
      this.model.root.scale.setScalar(Math.max(0.05, this.fading / 0.45) * this.rootScale);
      if (this.fading <= 0) { this.pos.set(this.tpTarget.x, 1.2, this.tpTarget.z); this.model.root.scale.setScalar(this.rootScale); g.fx.burst(this.center(_b), { count: 30, color: 0xff7a8a, speed: 5, life: 0.6, size: 0.22, gravity: 0 }); }
      return;
    }

    // ---------- PHASE 1 : combat armé ----------
    if (this.phase === 1) {
      if (this.dashT > 0) {
        this.dashT -= dt;
        this.vel.x = this.dashDir.x * 22; this.vel.z = this.dashDir.z * 22; this.moving = true;
        if (this.pos.distanceTo(p.pos) < 2.2) { p.takeDamage(34 * g.diff.damage, { from: this.pos, melee: true, attacker: this }); this.dashT = 0; }
        return;
      }
      if (this.burstN > 0) {
        this.burstTm -= dt;
        if (this.burstTm <= 0) { this.burstTm = 0.09; this.burstN--; this.shoot(this.targetPoint(_c), this.canSee, dist); }
      }
      if (this.busyT > 0) { this.busyT -= dt; return; }
      // se déplace pour garder la pression
      this.tacticT -= dt;
      if (this.tacticT <= 0) { this.tacticT = 2.5; if (dist > 16 || !this.canSee) this.goTo(_a.x, _a.z); else this.pickPoint(_a, 8, 15, false, true); }
      if (this.hasDest) { this.moving = true; if (this.follow(dt, this.def.speed, false)) this.hasDest = false; }
      this.actT -= dt;
      if (this.actT > 0) return;
      this.attackI++;
      const cdK = g.diff.cooldown;
      const k = this.attackI % 4;
      if (k === 1) {
        // grenades annoncées
        this.zones(3, 3.6, 1.2, 34); g.audio.skill('grenadeThrow'); this.actT = 2.6 * cdK; this.busyT = 0.5;
      } else if (k === 3 && dist < 26 && this.canSee) {
        // charge annoncée
        _c.set(_a.x - this.pos.x, 0, _a.z - this.pos.z).normalize();
        this.dashDir.copy(_c);
        const len = Math.min(24, dist + 4);
        g.combat.hazardLine(new THREE.Vector3(this.pos.x, this.pos.y, this.pos.z), _c.clone(), len, 2.6, 0.9, 0, 0xff3a5a, () => { if (this.alive && this.phase === 1) { this.dashT = len / 22; } });
        g.audio.charge(this.pos, 0.9); this.busyT = 0.95; this.actT = 3.2 * cdK; this.hasDest = false;
      } else { this.burstN = 8; this.burstTm = 0.35; g.audio.warn(this.pos); this.actT = 2.4 * cdK; this.firstBurst = false; }
      return;
    }

    // ---------- PHASES 2 et 3 : forme dimensionnelle ----------
    this.pos.y += (1.2 - this.pos.y) * Math.min(1, dt * 2);
    const p3 = this.phase === 3;
    if (this.volley > 0) {
      this.volleyT -= dt;
      if (this.volleyT <= 0) {
        this.volleyT = 0.16; this.volley--;
        this.center(_b);
        _c.set(p.pos.x + p.vel.x * 0.4, p.pos.y + 1, p.pos.z + p.vel.z * 0.4).sub(_b).normalize();
        _c.applyAxisAngle(_a.set(0, 1, 0), (this.volley % 5 - 2) * 0.11);
        g.combat.spawnProjectile({ pos: _b, vel: _c.multiplyScalar(17), damage: 24 * g.diff.damage, radius: 0.32, color: 0xff3a5a, owner: 'enemy', life: 6, aoe: 1.8, homing: this.volley % 2 === 0 ? 0.6 : 0 });
        g.audio.enemyShot('orb', this.pos); this.castAnim = 0.3;
      }
    }
    if (p3) {
      this.summonT -= dt;
      if (this.summonT <= 0) { this.summonT = 17; if (this.countAdds() < 4) { this.summon('devourer', 2); this.summon('caster', 1); } }
    }
    if (this.busyT > 0) { this.busyT -= dt; return; }
    this.tpT -= dt;
    if (this.tpT <= 0 && this.volley <= 0) { this.tpT = (p3 ? 5 : 6.5) + Math.random() * 2; this.teleport(); return; }
    this.actT -= dt;
    if (this.actT > 0) return;
    this.attackI++;
    const cdK = g.diff.cooldown * (p3 ? 0.8 : 1);
    const k = this.attackI % (p3 ? 5 : 4);
    const ground = new THREE.Vector3(this.pos.x, 0, this.pos.z);
    if (k === 0) { this.volley = p3 ? 10 : 7; this.volleyT = 0.4; g.audio.charge(this.pos, 0.4); this.actT = 3.2 * cdK; }
    else if (k === 1) {
      const n = p3 ? 6 : 4;
      const base = Math.atan2(p.pos.x - this.pos.x, p.pos.z - this.pos.z);
      for (let i = 0; i < n; i++) { const a = base + (i - (n - 1) / 2) * 0.36; g.combat.hazardLine(ground.clone(), new THREE.Vector3(Math.sin(a), 0, Math.cos(a)), 45, 2, 1.2, 30 * g.diff.damage, 0xff3a5a); }
      g.audio.charge(this.pos, 1.1); this.castAnim = 1.1; this.actT = 3.0 * cdK;
    } else if (k === 2) { this.zones(p3 ? 6 : 4, 3.4, 1.25, 32); g.audio.charge(this.pos, 1); this.castAnim = 1; this.actT = 2.8 * cdK; }
    else if (k === 3) { g.combat.hazardWave(ground, 30, 14, 26 * g.diff.damage, 0xff3a5a, 0.8); g.audio.charge(this.pos, 0.8); this.castAnim = 0.8; this.actT = 2.6 * cdK; if (p3) { this.volley = 5; this.volleyT = 1.0; } }
    else {
      // phase 3 : fracture de l'arène — couronnes alternées, une zone sûre subsiste toujours
      this.pulseI++;
      const inner = this.pulseI % 2 === 0;
      const R = this.arenaR;
      if (inner) g.combat.hazardCircle(this.arena.clone(), R * 0.5, 1.9, 40 * g.diff.damage, 0xff3a5a);
      else for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2; g.combat.hazardCircle(new THREE.Vector3(this.arena.x + Math.cos(a) * R * 0.78, this.arena.y, this.arena.z + Math.sin(a) * R * 0.78), R * 0.27, 1.9, 40 * g.diff.damage, 0xff3a5a); }
      g.ui.hud.toast(inner ? 'FRACTURE CENTRALE — ÉLOIGNEZ-VOUS DU CENTRE' : 'FRACTURE EXTÉRIEURE — REJOIGNEZ LE CENTRE', '#ff3a5a');
      g.audio.alarm(); this.castAnim = 1.8; this.actT = 4.0 * cdK; this.busyT = 1.0;
    }
  }

  protected animate(dt: number): void {
    if (this.rig && !(this.phase === 1 && this.transformT <= 0)) {
      if (this.castAnim > 0) this.castAnim -= dt;
      this.walkPhase += dt;
      this.wings.rotation.y = Math.sin(this.walkPhase * 2) * 0.12;
      this.wings.children[this.wings.children.length - 1].rotation.z += dt * 2;
      this.bossRig(dt, false, this.castAnim, Math.sin(this.walkPhase * 1.6) * 0.08);
      return;
    }
    if (this.rig) { this.bossRig(dt, true); return; }
    if (this.phase === 1 && this.transformT <= 0) { super.animate(dt); if (this.dashT > 0) this.model.body.rotation.x = 0.5; return; }
    const m = this.model;
    this.walkPhase += dt;
    m.body.position.y = Math.sin(this.walkPhase * 1.6) * 0.08;
    m.legL!.rotation.x = 0.15; m.legR!.rotation.x = -0.1;
    if (this.castAnim > 0) this.castAnim -= dt;
    const up = this.castAnim > 0 ? -2.6 : -0.5;
    m.armL!.rotation.x += (up - m.armL!.rotation.x) * Math.min(1, dt * 8); m.armR!.rotation.x += (up - m.armR!.rotation.x) * Math.min(1, dt * 8);
    this.wings.rotation.y = Math.sin(this.walkPhase * 2) * 0.12;
    this.wings.children[this.wings.children.length - 1].rotation.z += dt * 2;
    this.shieldMesh.rotation.y += dt;
  }
}
