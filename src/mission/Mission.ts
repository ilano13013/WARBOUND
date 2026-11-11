// Moteur de mission : objectifs séquentiels, déclencheurs, points de contrôle, communications radio, butin et statistiques.
import * as THREE from 'three';
import type { Game } from '../core/Game';
import type { Enemy, SpawnOpts } from '../ai/Enemy';
import type { Boss } from '../ai/Boss';
import type { EnemyKind } from '../data/enemies';
import type { Destructible, Interactable, Level } from '../world/Level';
import { rollLoot, type Item } from '../rpg/items';

export interface Objective {
  text: string;
  marker?: THREE.Vector3 | (() => THREE.Vector3 | null) | null;
  start?: () => void;
  update?: (dt: number) => void;
  done: () => boolean;
  progress?: () => string;
  onDone?: () => void;
  /** Rejoué lors d'une reprise au point de contrôle pendant cet objectif. */
  restart?: () => void;
  checkpoint?: THREE.Vector3;
  checkpointYaw?: number;
  targets?: Destructible[];
}

export interface Trigger { x: number; z: number; r: number; fn: () => void; fired: boolean; minY?: number }

export interface MissionStats { kills: number; shots: number; hits: number; headshots: number; deaths: number; time: number; damageDealt: number; damageTaken: number; skills: number; xp: number }

export type SpawnSpec = [EnemyKind, number, number, SpawnOpts?];

export class Mission {
  objectives: Objective[] = [];
  index = -1;
  triggers: Trigger[] = [];
  stats: MissionStats = { kills: 0, shots: 0, hits: 0, headshots: 0, deaths: 0, time: 0, damageDealt: 0, damageTaken: 0, skills: 0, xp: 0 };
  loot: Item[] = [];
  boss: Boss | null = null;
  completed = false;
  failed = false;
  checkpoint = new THREE.Vector3();
  checkpointYaw = 0;
  level!: Level;
  /** Minuteur affiché dans le HUD (défense, téléchargement). */
  timer: { label: string; t: number; max: number } | null = null;
  onComplete: (() => void) | null = null;
  rewardXp = 0;
  lootTable = 'mission';
  bossLootTable = '';
  private lines: { who: string; text: string; dur: number }[] = [];
  private lineT = 0;
  private doneDelay = 0;

  constructor(public g: Game, public id: string, public name: string, public mode: 'campaign' | 'hub' | 'survival') {}

  get current(): Objective | null { return this.objectives[this.index] || null; }

  begin(): void {
    this.checkpoint.copy(this.level.spawn); this.checkpointYaw = this.level.spawnYaw;
    if (this.objectives.length) this.advance();
  }

  private advance(): void {
    const g = this.g;
    const prev = this.current;
    if (prev) {
      prev.onDone?.();
      // point de contrôle : position sûre actuelle du joueur
      if (!g.player.dead) { this.checkpoint.copy(g.player.lastSafe); this.checkpointYaw = g.player.yaw; }
      if (prev.checkpoint) { this.checkpoint.copy(prev.checkpoint); this.checkpointYaw = prev.checkpointYaw ?? this.checkpointYaw; }
      g.audio.objective();
      g.gainXp(120, 'Objectif accompli');
      g.autosaveSoon();
    }
    this.index++;
    this.timer = null;
    const o = this.current;
    if (!o) { this.complete(); return; }
    o.start?.();
    g.ui.hud.objective(o.text, this.index, this.objectives.length);
  }

  markerPos(): THREE.Vector3 | null {
    const o = this.current;
    if (!o || !o.marker) return null;
    return typeof o.marker === 'function' ? o.marker() : o.marker;
  }

  update(dt: number): void {
    const g = this.g, p = g.player;
    if (this.completed || this.failed) return;
    this.stats.time += dt;
    // déclencheurs de zone
    for (const t of this.triggers) {
      if (t.fired) continue;
      if (Math.hypot(p.pos.x - t.x, p.pos.z - t.z) < t.r && (t.minY === undefined || p.pos.y >= t.minY)) { t.fired = true; t.fn(); }
    }
    // file de dialogues radio
    if (this.lineT > 0) this.lineT -= dt;
    if (this.lineT <= 0 && this.lines.length) {
      const l = this.lines.shift()!;
      this.lineT = l.dur;
      g.ui.hud.radio(l.who, l.text, l.dur);
      g.audio.radio();
    }
    if (this.timer) this.timer.t = Math.max(0, this.timer.t - dt);
    const o = this.current;
    if (o && !p.dead) {
      o.update?.(dt);
      if (o.done()) { this.doneDelay += dt; if (this.doneDelay > 0.35) { this.doneDelay = 0; this.advance(); } } else this.doneDelay = 0;
    }
  }

  // ---------- dialogues ----------

  say(who: string, text: string, dur?: number): void { this.lines.push({ who, text, dur: dur ?? Math.max(3.2, 1.6 + text.length * 0.052) }); }
  clearRadio(): void { this.lines.length = 0; this.lineT = 0; }

  // ---------- apparitions ----------

  spawn(group: string, specs: SpawnSpec[], alert = false): Enemy[] {
    const out: Enemy[] = [];
    for (const [kind, x, z, o] of specs) out.push(this.g.spawnEnemy(kind, x, z, { ...(o || {}), group, alert: alert || o?.alert }));
    return out;
  }

  /** Apparition annoncée par un portail (jamais sur le joueur). */
  portalSpawn(group: string, specs: SpawnSpec[], delay = 0.9): void {
    const g = this.g;
    for (const [kind, x, z, o] of specs) {
      const pos = new THREE.Vector3(x, 0, z);
      if (pos.distanceTo(g.player.pos) < 5) { pos.x += 6; }
      g.fx.ring(pos, 0.3, 2.2, 0x9a5aff, delay);
      g.fx.burst(pos.clone().setY(1), { count: 18, color: 0x9a5aff, speed: 3, life: delay, size: 0.2, gravity: -2 });
      g.after(delay, () => { if (!this.completed && !this.failed && g.mission === this) g.spawnEnemy(kind, pos.x, pos.z, { ...(o || {}), group, alert: true }); });
    }
  }

  alive(group: string): number { let n = 0; for (const e of this.g.enemies) if (e.alive && e.group === group) n++; return n; }
  pending = new Map<string, number>();

  trigger(x: number, z: number, r: number, fn: () => void, minY?: number): void { this.triggers.push({ x, z, r, fn, fired: false, minY }); }

  // ---------- fabriques d'objectifs ----------

  reach(text: string, x: number, z: number, r = 4, extra: Partial<Objective> = {}): Objective {
    const pos = new THREE.Vector3(x, 0, z);
    const o: Objective = { text, marker: pos, done: () => Math.hypot(this.g.player.pos.x - x, this.g.player.pos.z - z) < r, ...extra };
    this.objectives.push(o);
    return o;
  }

  /** Éliminer tous les ennemis d'un groupe (apparus au démarrage de l'objectif si specs est fourni). */
  kill(text: string, group: string, specs: SpawnSpec[] | null, extra: Partial<Objective> = {}): Objective {
    let total = 0, started = false;
    const o: Objective = {
      text,
      marker: () => { let best: Enemy | null = null, bd = Infinity; for (const e of this.g.enemies) if (e.alive && e.group === group) { const d = e.pos.distanceTo(this.g.player.pos); if (d < bd) { bd = d; best = e; } } return best ? best.pos : null; },
      start: () => { if (specs) this.spawn(group, specs); total = Math.max(total, this.alive(group)); started = true; extra.start?.(); },
      done: () => started && this.alive(group) === 0,
      progress: () => { total = Math.max(total, this.alive(group)); return `${total - this.alive(group)} / ${total}`; },
    };
    const { start: _s, ...rest } = extra;
    Object.assign(o, rest);
    this.objectives.push(o);
    return o;
  }

  interact(text: string, pos: THREE.Vector3, prompt: string, extra: Partial<Objective> = {}, hold = 0, onUse?: () => void): Objective {
    let used = false;
    const it: Interactable = this.level.interact(pos, prompt, () => { used = true; it.enabled = false; onUse?.(); });
    it.enabled = false; it.hold = hold;
    const o: Objective = { text, marker: pos, start: () => { it.enabled = true; extra.start?.(); }, done: () => used };
    const { start: _s, ...rest } = extra;
    Object.assign(o, rest);
    this.objectives.push(o);
    return o;
  }

  destroy(text: string, targets: Destructible[], extra: Partial<Objective> = {}): Objective {
    const o: Objective = {
      text, targets,
      marker: () => { let best: Destructible | null = null, bd = Infinity; for (const d of targets) if (d.alive) { const dist = d.center.distanceTo(this.g.player.pos); if (dist < bd) { bd = dist; best = d; } } return best ? best.center : null; },
      start: () => { for (const d of targets) d.invulnerable = false; extra.start?.(); },
      done: () => targets.every((d) => !d.alive),
      progress: () => `${targets.filter((d) => !d.alive).length} / ${targets.length}`,
    };
    const { start: _s, ...rest } = extra;
    Object.assign(o, rest);
    this.objectives.push(o);
    return o;
  }

  /** Tenir une durée donnée pendant que des vagues arrivent. `protect` : objet dont la destruction fait échouer la mission. */
  defend(text: string, label: string, duration: number, waves: { at: number; specs: SpawnSpec[] }[], group: string, extra: Partial<Objective> = {}, protect?: Destructible): Objective {
    let fired: boolean[] = [];
    const o: Objective = {
      text,
      marker: extra.marker ?? null,
      start: () => { this.timer = { label, t: duration, max: duration }; fired = waves.map(() => false); if (protect) { protect.revive(); protect.playerOnly = false; } extra.start?.(); },
      update: () => {
        const el = duration - (this.timer?.t ?? 0);
        waves.forEach((w, i) => { if (!fired[i] && el >= w.at) { fired[i] = true; this.portalSpawn(group, w.specs); } });
        if (protect && !protect.alive) this.fail('La position est tombée.');
      },
      done: () => !!this.timer && this.timer.t <= 0,
      progress: () => (protect ? `Intégrité ${Math.max(0, Math.round((protect.hp / protect.maxHp) * 100))} %` : ''),
      restart: () => {
        for (const e of this.g.enemies) if (e.group === group) e.remove();
        this.timer = { label, t: duration, max: duration }; fired = waves.map(() => false);
        if (protect) protect.revive();
      },
      onDone: () => { for (const e of this.g.enemies) if (e.alive && e.group === group) e.takeDamage(99999, { source: 'world', type: 'explosion' }); extra.onDone?.(); },
    };
    const { start: _s, onDone: _o, marker: _m, ...rest } = extra;
    Object.assign(o, rest);
    this.objectives.push(o);
    return o;
  }

  bossFight(text: string, make: () => Boss, extra: Partial<Objective> = {}): Objective {
    const o: Objective = {
      text,
      marker: () => (this.boss && this.boss.alive ? this.boss.pos : null),
      start: () => { extra.start?.(); this.boss = make(); this.g.enemies.push(this.boss); this.g.audio.setMusic('boss'); this.g.audio.bossRoar(this.boss.pos); this.g.ui.hud.bossIntro(this.boss.name, this.boss.subtitle); },
      done: () => !!this.boss && !this.boss.alive,
      restart: () => {
        // reprise : le boss est réinitialisé
        if (this.boss) this.boss.remove();
        for (const e of this.g.enemies) if (e.group === 'boss-add') e.remove();
        extra.restart?.();
        this.boss = make(); this.g.enemies.push(this.boss); this.g.audio.setMusic('boss');
      },
      onDone: () => {
        this.g.audio.setMusic('explore');
        if (this.bossLootTable) this.dropLoot(this.bossLootTable, true);
        this.g.ui.hud.toast('BOSS VAINCU', '#ff9a2a');
        extra.onDone?.();
      },
    };
    const { start: _s, onDone: _o, restart: _r, ...rest } = extra;
    Object.assign(o, rest);
    this.objectives.push(o);
    return o;
  }

  custom(o: Objective): Objective { this.objectives.push(o); return o; }

  // ---------- butin, fin, échec ----------

  dropLoot(table: string, boss = false): void {
    const g = this.g, prof = g.profile!;
    const first = boss ? !prof.missions[this.id]?.done : false;
    const items = rollLoot(table, prof.level, g.diff.loot, first);
    for (const it of items) {
      this.loot.push(it);
      g.ui.hud.lootToast(it);
      g.audio.loot(['common', 'rare', 'epic', 'legendary'].indexOf(it.rarity));
    }
  }

  onEnemyKilled(_e: Enemy): void { /* suivi par les objectifs via alive() */ }

  fail(reason: string): void {
    if (this.failed || this.completed) return;
    this.failed = true;
    this.g.onMissionFailed(reason);
  }

  private complete(): void {
    if (this.completed) return;
    this.completed = true;
    if (this.onComplete) this.onComplete(); else this.g.onMissionComplete();
  }

  /** Reprise au dernier point de contrôle après une mort ou un échec d'objectif. */
  retry(): void {
    this.failed = false;
    this.clearRadio();
    this.current?.restart?.();
    const o = this.current;
    if (o) this.g.ui.hud.objective(o.text, this.index, this.objectives.length);
  }
}
