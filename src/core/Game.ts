// Chef d'orchestre : boucle de jeu, états, chargement des niveaux, transitions et progression.
import * as THREE from 'three';
import { DIAG } from '../render/Renderer';
import { Renderer } from '../render/Renderer';
import { FX } from '../render/FX';
import { AudioSys } from '../audio/Audio';
import { Input } from './Input';
import { Combat } from './Combat';
import { Player } from '../player/Player';
import { WeaponSystem } from '../player/WeaponSystem';
import { Abilities } from '../player/Abilities';
import { Marksman } from '../ai/Marksman';
import { Enemy, type SpawnOpts } from '../ai/Enemy';
import type { Ally } from '../ai/Ally';
import { DIFFICULTIES, type DifficultyDef, type EnemyKind } from '../data/enemies';
import { MISSION_BY_ID, MISSIONS } from '../data/missions';
import { SaveStore, defaultSettings, type Profile, type Settings } from '../save/Save';
import { addXp } from '../rpg/Stats';
import { rollLoot, scrapValue, type Item } from '../rpg/items';
import { Level } from '../world/Level';
import { Mission } from '../mission/Mission';
import { UI } from '../ui/UI';
import { buildHub } from '../levels/hub';
import { buildOp1 } from '../levels/op1';
import { buildOp2 } from '../levels/op2';
import { buildOp3 } from '../levels/op3';
import { buildOp4 } from '../levels/op4';
import { buildOp5 } from '../levels/op5';
import { buildSurvival } from '../levels/survival';
import { buildDuel } from '../levels/duel';
import { Duel } from '../net/Duel';
import { Match, LOADOUTS } from '../net/Match';
import { MODES } from '../net/lobbyProtocol';
import { Cinematics } from '../cinematic/Cinematics';
import { Assets } from '../assets/Assets';

export type GameState = 'boot' | 'menu' | 'cinematic' | 'play' | 'dead' | 'results';

export interface ResultsData {
  title: string; subtitle: string; victory: boolean; mode: 'campaign' | 'survival' | 'duel' | 'match';
  time: number; kills: number; accuracy: number; deaths: number; headshots: number;
  xp: number; items: Item[]; materials: number; levelBefore: number; levelAfter: number;
  wave?: number; score?: number; record?: boolean; final?: boolean;
  duel?: { me: number; opp: number; total: number; oppName: string };
  match?: { board: ReturnType<Match['scoreboard']>; teams: boolean; red: number; blue: number };
}

export const INVENTORY_CAP = 48;

export class Game {
  settings: Settings = defaultSettings();
  store = new SaveStore();
  profile: Profile | null = null;
  r: Renderer;
  fx = new FX();
  audio: AudioSys;
  input: Input;
  ui: UI;
  combat: Combat;
  player: Player;
  weapons: WeaponSystem;
  abilities: Abilities;
  cine: Cinematics;
  duel: Duel;
  match: Match;
  level: Level | null = null;
  mission: Mission | null = null;
  enemies: Enemy[] = [];
  allies: Ally[] = [];
  state: GameState = 'boot';
  paused = false;
  time = 0;
  timeScale = 1;
  diff: DifficultyDef = DIFFICULTIES.soldat;
  testMode: boolean;
  testSpeed = 1;
  runMods: Record<string, number> = {};
  private timers: { t: number; fn: () => void }[] = [];
  private last = 0;
  private saveT = -1;
  private combatT = 0;
  private holdT = 0;
  private fpsAcc = 0; private fpsN = 0; fps = 60;
  private levelStartLevel = 1;
  errors: string[] = [];

  constructor(canvas: HTMLCanvasElement) {
    this.testMode = new URLSearchParams(location.search).has('autotest');
    this.r = new Renderer(canvas);
    // en mode test, l'autodiagnostic ne tourne que si un test le demande (injection de défaut)
    this.r.selfCheck = !this.testMode || DIAG.has('simnan') || DIAG.has('check');
    this.r.scene.add(this.fx.group);
    this.fx.camera = this.r.camera;
    this.audio = new AudioSys(this.settings);
    this.input = new Input(canvas, this.settings, this.testMode);
    this.player = new Player(this);
    this.combat = new Combat(this);
    this.weapons = new WeaponSystem(this);
    this.abilities = new Abilities(this);
    this.cine = new Cinematics(this);
    this.duel = new Duel(this);
    this.match = new Match(this);
    this.ui = new UI(this);
    this.input.onEscape = () => this.ui.onEscape();
    this.input.onLockChange = (locked) => { if (!locked && this.state === 'play' && !this.paused && !this.ui.blocking && !this.testMode) this.ui.showPause(); };
    window.addEventListener('error', (e) => { this.errors.push(String(e.message)); });
    window.addEventListener('beforeunload', () => { if (this.profile && this.state !== 'menu') void this.store.saveProfile(this.profile); });
    document.addEventListener('visibilitychange', () => { if (document.hidden && this.state === 'play' && !this.paused && !this.ui.blocking && !this.testMode) this.ui.showPause(); });
  }

  async init(): Promise<void> {
    const s = await this.store.loadSettings();
    Object.assign(this.settings, s);
    this.applySettings();
    this.profile = await this.store.loadProfile();
    this.last = performance.now();
    this.ui.showLoading(0, '');
    await Assets.loadAll((k, label) => this.ui.showLoading(k, label));
    this.toMenu();
    // lien d'invitation : ?salon=CODE
    const salon = new URLSearchParams(location.search).get('salon');
    if (salon && /^[A-Za-z0-9]{6}$/.test(salon) && !this.testMode) {
      if (this.profile) this.ui.showLobby(salon.toUpperCase());
      else this.ui.confirm('Invitation à un salon', 'Créez d’abord votre opérateur (Nouvelle partie), puis rouvrez le lien d’invitation.', () => this.ui.showMenu(), () => this.ui.showMenu());
    }
    this.last = performance.now();
    requestAnimationFrame((t) => this.loop(t));
  }

  applySettings(): void {
    Level.lightCap = this.settings.quality === 'low' ? 2 : this.settings.quality === 'high' ? 8 : 4;
    this.r.applySettings(this.settings);
    this.level?.setFx(this.settings.quality !== 'low' && !DIAG.has('nofx'));
    this.fx.setQuality(this.settings.quality);
    this.audio.applyVolumes();
    this.ui.settingsChanged();
  }
  saveSettings(): void { void this.store.saveSettings(this.settings); }

  get canAct(): boolean { return this.state === 'play' && !this.paused && !this.ui.blocking; }

  after(sec: number, fn: () => void): void { this.timers.push({ t: sec, fn }); }

  // ---------- sauvegarde ----------

  save(): void { if (this.profile) void this.store.saveProfile(this.profile); }
  autosaveSoon(): void { this.saveT = 1.5; }

  // ---------- chargement ----------

  private unload(): void {
    for (const e of this.enemies) e.remove();
    this.enemies.length = 0;
    for (const a of this.allies) a.remove();
    this.allies.length = 0;
    this.combat.clear();
    this.fx.clear();
    this.timers.length = 0;
    this.timeScale = 1;
    if (this.level) { this.level.dispose(); this.level = null; }
    this.mission = null;
    this.cine.stop();
    this.weapons.override = null;
    this.ui.hud.root.classList.remove('duel-mode');
    this.ui.hud.reset();
  }

  /** Construit un niveau ; en cas d'erreur, retour au menu plutôt qu'un état incohérent. */
  private safeBuild(fn: () => void): void {
    try { fn(); } catch (err) {
      this.errors.push(String((err as Error)?.stack || err));
      console.error(err);
      this.toMenu();
    }
  }

  private load(level: Level, mission: Mission): void {
    this.level = level; this.mission = mission; mission.level = level;
    this.r.scene.add(level.root);
    level.setFx(this.settings.quality !== 'low' && !DIAG.has('nofx'));
    this.r.setAmbience(level.ambience);
    this.r.precompile();
    this.player.refreshStats(true);
    this.applyRunMods();
    this.player.spawn(level.spawn, level.spawnYaw, true);
    this.weapons.rebuild();
    this.levelStartLevel = this.profile!.level;
    this.paused = false;
    this.state = 'play';
    this.r.drawVm = true;
    this.ui.closeAll();
    this.ui.hud.setVisible(true);
    this.ui.hud.rebuild();
    mission.begin();
    this.input.lock();
  }

  applyRunMods(): void {
    const p = this.player;
    for (const k of Object.keys(this.runMods)) p.mods[k] = (p.mods[k] || 0) + this.runMods[k];
    if (this.runMods.maxHp) p.maxHp += this.runMods.maxHp;
    if (this.runMods.maxEnergy) p.maxEnergy += this.runMods.maxEnergy;
  }

  toMenu(): void {
    this.unload();
    this.state = 'menu';
    this.ui.hud.setVisible(false);
    this.cine.menuBackdrop();
    this.audio.setMusic('menu');
    this.ui.showMenu();
    this.input.unlock();
  }

  startHub(): void {
    if (!this.profile) return;
    this.ui.fade(() => this.safeBuild(() => {
      this.unload();
      this.runMods = {};
      this.diff = DIFFICULTIES[this.profile!.difficulty];
      const m = new Mission(this, 'hub', 'FORT AEGIS', 'hub');
      const level = buildHub(this, m);
      this.load(level, m);
      this.audio.setMusic('hub');
      this.save();
      this.ui.hud.banner('FORT AEGIS', 'Quartier général de la Coalition');
    }));
  }

  startMission(id: string): void {
    if (!this.profile) return;
    const def = MISSION_BY_ID[id];
    if (!def) return;
    this.ui.fade(() => this.safeBuild(() => {
      this.unload();
      this.runMods = {};
      this.diff = DIFFICULTIES[this.profile!.difficulty];
      const m = new Mission(this, id, def.name, 'campaign');
      m.rewardXp = def.xp; m.bossLootTable = def.bossLoot || '';
      m.lootTable = this.profile!.difficulty === 'veteran' ? 'missionHard' : 'mission';
      const build = { op1: buildOp1, op2: buildOp2, op3: buildOp3, op4: buildOp4, op5: buildOp5 }[id]!;
      const level = build(this, m);
      this.load(level, m);
      this.audio.setMusic('explore', def.theme);
      this.ui.hud.banner(`OPÉRATION ${def.num} — ${def.name}`, def.location);
    }));
  }

  startSurvival(): void {
    if (!this.profile) return;
    this.ui.fade(() => this.safeBuild(() => {
      this.unload();
      this.runMods = {};
      this.diff = DIFFICULTIES[this.profile!.difficulty];
      const m = new Mission(this, 'survival', 'PROTOCOLE INFINI', 'survival');
      const level = buildSurvival(this, m);
      this.load(level, m);
      this.audio.setMusic('explore', 4);
      this.ui.hud.banner('PROTOCOLE INFINI', 'Simulation de survie — vagues illimitées');
    }));
  }

  /** Défi d'armes : lancé par le gestionnaire de duel une fois la liaison établie. */
  startDuel(): void {
    if (!this.profile) return;
    this.ui.fade(() => this.safeBuild(() => {
      this.unload();
      this.runMods = {};
      this.diff = DIFFICULTIES.soldat;
      const m = new Mission(this, 'duel', 'DÉFI D’ARMES', 'duel');
      this.duel.prepare(m);
      const level = buildDuel(this, m);
      this.load(level, m);
      this.duel.begin();
      this.ui.hud.root.classList.add('duel-mode');
      this.audio.setMusic('combat');
    }));
  }

  /** Partie en ligne (salon) : arène chargée quand la liaison avec l'hôte est établie. */
  startMatch(): void {
    if (!this.profile) return;
    const mt = this.match;
    this.ui.fade(() => this.safeBuild(() => {
      this.unload();
      this.runMods = {};
      this.diff = DIFFICULTIES.soldat;
      const m = new Mission(this, 'match', MODES[mt.mode].name.toUpperCase(), 'match');
      m.custom({
        text: MODES[mt.mode].name,
        done: () => false,
        progress: () => {
          const me = mt.mine;
          if (mt.mode === 'duel') return `Arme ${(me?.rung ?? 0) + 1}/${mt.rules.score} — ${me?.step.label ?? ''}`;
          return `${mt.mode === 'dom' ? 'Tenez les zones' : 'Éliminez l’équipe adverse'} — objectif ${mt.rules.score}`;
        },
      });
      const level = buildDuel(this, m);
      this.load(level, m);
      mt.onLoaded();
      this.ui.hud.root.classList.add('duel-mode');
      this.audio.setMusic('combat');
      this.ui.hud.banner(MODES[mt.mode].name.toUpperCase(), mt.mine?.team ? `Vous êtes dans l’équipe ${mt.mine.team === 'red' ? 'ROUGE' : 'BLEUE'}` : `Arme : ${mt.mine?.step.label ?? ''}`);
    }));
  }

  finishMatch(): void {
    const m = this.mission, p = this.profile!, mt = this.match;
    if (!m || m.mode !== 'match' || this.state === 'results') return;
    this.state = 'results';
    this.timeScale = 1;
    this.input.unlock();
    const r = mt.result!;
    this.gainXp(r.victory ? 300 : 120, 'Partie en ligne');
    p.stats.playtime += m.stats.time;
    this.save();
    this.audio.setMusic('menu');
    this.ui.hud.setVisible(false);
    const me = mt.mine;
    this.ui.showResults({
      title: r.title, subtitle: r.sub, victory: r.victory !== false, mode: 'match',
      time: m.stats.time, kills: me?.k ?? 0, accuracy: m.stats.shots ? m.stats.hits / m.stats.shots : 0, deaths: me?.d ?? 0, headshots: m.stats.headshots,
      xp: m.stats.xp, items: [], materials: 0, levelBefore: this.levelStartLevel, levelAfter: p.level,
      match: { board: mt.scoreboard(), teams: mt.mode !== 'duel', red: mt.teamScore.red, blue: mt.teamScore.blue },
    });
  }

  finishDuel(victory: boolean, reason: string): void {
    const m = this.mission, p = this.profile!, d = this.duel;
    if (!m || m.mode !== 'duel' || this.state === 'results') return;
    this.state = 'results';
    this.timeScale = 1;
    this.input.unlock();
    this.gainXp(victory ? 400 : 150, victory ? 'Défi d’armes remporté' : 'Défi d’armes');
    p.stats.playtime += m.stats.time;
    this.save();
    this.audio.setMusic('menu');
    this.ui.hud.setVisible(false);
    this.ui.showResults({
      title: victory ? 'VICTOIRE' : 'DÉFAITE', subtitle: reason, victory, mode: 'duel',
      time: m.stats.time, kills: d.kills, accuracy: m.stats.shots ? m.stats.hits / m.stats.shots : 0, deaths: d.deaths, headshots: m.stats.headshots,
      xp: m.stats.xp, items: [], materials: 0, levelBefore: this.levelStartLevel, levelAfter: p.level,
      duel: { me: victory && reason.startsWith('Échelle') ? d.ladder.length : d.myRung + 1, opp: d.oppRung + 1, total: d.ladder.length, oppName: d.oppName },
    });
  }

  spawnEnemy(kind: EnemyKind, x: number, z: number, o: SpawnOpts = {}): Enemy {
    const e = kind === 'marksman' ? new Marksman(this, x, z, o) : new Enemy(this, kind, x, z, o);
    this.enemies.push(e);
    return e;
  }

  // ---------- progression ----------

  gainXp(amount: number, label: string): void {
    const p = this.profile;
    if (!p || amount <= 0) return;
    if (this.mission) this.mission.stats.xp += amount;
    const res = addXp(p, amount);
    this.ui.hud.xpFeed(amount, label);
    if (res.levels > 0) {
      this.audio.levelUp();
      this.ui.hud.levelUp(p.level);
      this.player.refreshStats();
      this.applyRunMods();
      this.player.hp = this.player.maxHp;
      this.fx.ring(this.player.pos, 0.5, 6, 0xffd24a, 0.8);
      for (const it of res.unlocked) this.ui.hud.toast(`ARME DÉBLOQUÉE : ${it.name}`, '#ffd24a');
      this.autosaveSoon();
    }
  }

  /** Ajoute des objets à l'inventaire ; l'excédent est recyclé automatiquement. */
  giveItems(items: Item[]): number {
    const p = this.profile!;
    let scrapped = 0;
    for (const it of items) {
      if (p.inventory.length >= INVENTORY_CAP) { scrapped += scrapValue(it); continue; }
      p.inventory.push(it);
      p.stats.lootFound++;
    }
    p.materials += scrapped;
    return scrapped;
  }

  onPlayerDeath(): void {
    if (this.state !== 'play') return;
    const p = this.profile!;
    p.stats.deaths++;
    if (this.mission) this.mission.stats.deaths++;
    this.state = 'dead';
    // duel : le pointeur reste capturé, la réapparition est automatique
    if (this.mission?.mode === 'duel') { this.duel.onLocalDeath(); return; }
    this.timeScale = 0.35;
    this.audio.tone(110, 1.2, { type: 'sawtooth', to: 40, vol: 0.3, filter: 500 });
    this.input.unlock();
    const m = this.mission!;
    if (m.mode === 'survival') { this.after(0.9, () => this.finishSurvival()); return; }
    if (m.mode === 'hub') { this.after(0.6, () => this.respawn()); return; }
    this.after(0.6, () => this.ui.showDeath('VOUS ÊTES TOMBÉ AU COMBAT', 'La mission n’est pas terminée. Votre progression est conservée.'));
  }

  onMissionFailed(reason: string): void {
    if (this.state !== 'play') return;
    this.state = 'dead';
    this.input.unlock();
    this.ui.showDeath('MISSION ÉCHOUÉE', reason);
  }

  /** Reprise au dernier point de contrôle. */
  respawn(): void {
    const m = this.mission;
    if (!m || !this.level) return;
    this.timeScale = 1;
    this.combat.clear();
    for (const a of this.allies) a.remove();
    this.allies.length = 0;
    // les ennemis en alerte retournent à leur poste
    for (const e of this.enemies) if (e.alive && !e.isBoss) { e.state = 'idle'; e.canSee = false; }
    m.retry();
    this.player.refreshStats(true);
    this.applyRunMods();
    this.player.spawn(m.checkpoint, m.checkpointYaw, true);
    this.weapons.rebuild();
    this.weapons.refill(0.5);
    this.state = 'play';
    this.ui.closeAll();
    this.input.lock();
  }

  abandon(): void { if (this.match.active) { this.match.quit(); return; } if (this.duel.active) { this.duel.leave(); return; } this.save(); this.startHub(); }

  onMissionComplete(): void {
    const m = this.mission!, p = this.profile!;
    if (this.state === 'results') return;
    const def = MISSION_BY_ID[m.id];
    const final = m.id === 'op4';
    const finish = () => {
      this.state = 'results';
      this.input.unlock();
      const firstTime = !p.missions[m.id]?.done;
      const xpBonus = Math.round(m.rewardXp * this.diff.xp * (firstTime ? 1 : 0.6));
      this.gainXp(xpBonus, 'Mission accomplie');
      const items = [...m.loot, ...rollLoot(m.lootTable, p.level, this.diff.loot, firstTime)];
      const mats = 4 + def.num * 2 + (this.diff.id === 'veteran' ? 4 : 0);
      const scrapped = this.giveItems(items);
      p.materials += mats;
      const prev = p.missions[m.id];
      p.missions[m.id] = { done: true, bestTime: prev?.done ? Math.min(prev.bestTime, m.stats.time) : m.stats.time, difficulty: this.diff.id };
      p.stats.missions++;
      p.stats.playtime += m.stats.time;
      if (final) p.campaignDone = true;
      this.save();
      this.audio.setMusic(final ? 'ending' : 'menu');
      this.ui.hud.setVisible(false);
      this.ui.showResults({
        title: final ? 'CAMPAGNE TERMINÉE' : 'MISSION ACCOMPLIE', subtitle: `Opération ${def.num} — ${def.name}`, victory: true, mode: 'campaign',
        time: m.stats.time, kills: m.stats.kills, accuracy: m.stats.shots ? m.stats.hits / m.stats.shots : 0, deaths: m.stats.deaths, headshots: m.stats.headshots,
        xp: m.stats.xp, items, materials: mats + scrapped, levelBefore: this.levelStartLevel, levelAfter: p.level, final,
      });
    };
    if (final) { this.state = 'cinematic'; this.ui.hud.setVisible(false); this.cine.playEnding(finish); }
    else finish();
  }

  finishSurvival(): void {
    const m = this.mission!, p = this.profile!;
    if (this.state === 'results') return;
    this.state = 'results';
    this.timeScale = 1;
    this.input.unlock();
    const sv = (m as any).survival as { wave: number; score: number };
    const wave = sv.wave, score = Math.round(sv.score);
    const record = score > p.survival.bestScore;
    p.survival.bestWave = Math.max(p.survival.bestWave, wave);
    p.survival.bestScore = Math.max(p.survival.bestScore, score);
    const items: Item[] = [...m.loot];
    for (let i = 0; i < Math.floor(wave / 5); i++) items.push(...rollLoot('survival', p.level, this.diff.loot * (1 + wave * 0.03), false));
    const mats = wave * 2;
    const scrapped = this.giveItems(items);
    p.materials += mats;
    p.stats.playtime += m.stats.time;
    this.save();
    this.audio.setMusic('menu');
    this.ui.hud.setVisible(false);
    this.ui.showResults({
      title: 'PROTOCOLE TERMINÉ', subtitle: `Vague atteinte : ${wave}`, victory: !this.player.dead, mode: 'survival',
      time: m.stats.time, kills: m.stats.kills, accuracy: m.stats.shots ? m.stats.hits / m.stats.shots : 0, deaths: m.stats.deaths, headshots: m.stats.headshots,
      xp: m.stats.xp, items, materials: mats + scrapped, levelBefore: this.levelStartLevel, levelAfter: p.level, wave, score, record,
    });
  }

  nextMissionId(): string | null {
    const p = this.profile;
    if (!p) return null;
    for (const m of MISSIONS) if (!p.missions[m.id]?.done) return m.id;
    return null;
  }

  // ---------- boucle ----------

  private loop(now: number): void {
    requestAnimationFrame((t) => this.loop(t));
    let real = (now - this.last) / 1000;
    this.last = now;
    if (real > (this.testMode ? 1.5 : 0.25)) real = this.testMode ? 1.5 : 0.25;
    this.fpsAcc += real; this.fpsN++;
    if (this.fpsAcc >= 0.5) { this.fps = Math.round(this.fpsN / this.fpsAcc); this.fpsAcc = 0; this.fpsN = 0; }
    try {
      if (this.testMode) {
        // mode test : le temps de jeu suit le temps réel (× testSpeed) même à très faible fréquence d'images
        const total = real * this.testSpeed;
        const n = Math.max(1, Math.ceil(total / (1 / 30)));
        for (let i = 0; i < n; i++) this.step(total / n, i === n - 1);
      } else this.step(Math.min(real, 0.05), true);
    } catch (err) {
      this.errors.push(String((err as Error)?.stack || err));
      console.error(err);
    }
  }

  private step(realDt: number, render: boolean): void {
    const dt = realDt * this.timeScale;
    if ((this.state === 'play' || this.state === 'dead') && this.level) {
      const sim = !this.paused && !this.ui.blocking;
      if (sim) this.simulate(dt, realDt);
      else this.weaponsIdle();
      if (this.duel.active && this.level) this.duel.tick(realDt, sim, dt);
      if (this.match.active && this.level) this.match.frame(realDt, sim);
    } else if (this.state === 'menu' || this.state === 'cinematic' || this.state === 'results') {
      this.cine.update(realDt);
      this.fx.update(realDt);
      if (this.level) { this.level.viewer.copy(this.r.camera.position); this.level.update(realDt); }
    }
    this.ui.update(realDt);
    if (this.saveT > 0) { this.saveT -= realDt; if (this.saveT <= 0) this.save(); }
    this.input.endFrame();
    if (render) { this.audio.setListener(this.r.camera); this.r.render(realDt, performance.now() / 1000); }
  }

  private weaponsIdle(): void { /* jeu en pause : rien à simuler */ }

  private simulate(dt: number, realDt: number): void {
    const level = this.level!, p = this.player;
    this.time += dt;
    for (let i = this.timers.length - 1; i >= 0; i--) {
      const t = this.timers[i];
      t.t -= dt;
      if (t.t <= 0) { this.timers.splice(i, 1); t.fn(); if (!this.level) return; }
    }
    p.update(dt);
    this.weapons.update(dt);
    this.abilities.update(dt);
    for (const e of this.enemies) e.update(dt);
    for (let i = this.enemies.length - 1; i >= 0; i--) if (this.enemies[i].removed) this.enemies.splice(i, 1);
    for (const a of this.allies) a.update(dt);
    for (let i = this.allies.length - 1; i >= 0; i--) if (!this.allies[i].alive) this.allies.splice(i, 1);
    this.combat.update(dt);
    level.viewer.copy(this.r.camera.position);
    level.update(dt);
    this.fx.update(dt);
    this.mission?.update(dt);
    if (!this.level) return;
    this.updateInteraction(realDt);
    this.updatePickups(dt);
    // luminosité selon la zone
    const z = level.zoneAt(p.pos.x, p.pos.z);
    this.r.setZone(z ? z.light : 1, z?.fogDensity);
    // musique dynamique
    if (this.mission && this.mission.mode !== 'hub' && !(this.mission.boss && this.mission.boss.alive)) {
      let fighting = false;
      for (const e of this.enemies) if (e.alive && e.state === 'combat') { fighting = true; break; }
      if (fighting) this.combatT = 5; else this.combatT -= dt;
      const want = this.combatT > 0 ? 'combat' : 'explore';
      if (this.audio.musicMode === 'combat' || this.audio.musicMode === 'explore') { if (this.audio.musicMode !== want) this.audio.setMusic(want); }
    }
    if (this.profile) this.profile.stats.playtime += 0; // le temps de jeu est cumulé en fin de mission
  }

  private updateInteraction(realDt: number): void {
    const level = this.level!, p = this.player, hud = this.ui.hud;
    if (p.dead || this.state !== 'play') { hud.prompt(null, 0); return; }
    let best = null as (typeof level.interactables)[number] | null, bd = Infinity;
    const eye = this.r.camera.position;
    const fwd = p.forward(new THREE.Vector3());
    for (const it of level.interactables) {
      if (!it.enabled) continue;
      const dx = it.pos.x - eye.x, dy = it.pos.y - eye.y, dz = it.pos.z - eye.z;
      const d = Math.hypot(dx, dy, dz);
      if (d > it.radius) continue;
      const dot = (dx * fwd.x + dy * fwd.y + dz * fwd.z) / (d || 1);
      if (dot < 0.35 && d > 1.2) continue;
      if (d < bd) { bd = d; best = it; }
    }
    if (!best) { hud.prompt(null, 0); this.holdT = 0; return; }
    if (best.hold > 0) {
      if (this.input.held('interact')) {
        this.holdT += realDt;
        if (this.holdT >= best.hold) { this.holdT = 0; this.audio.uiOpen(); best.onUse(); }
      } else this.holdT = 0;
      hud.prompt(best.prompt, this.holdT / best.hold, true);
    } else {
      hud.prompt(best.prompt, 0);
      if (this.input.pressed('interact')) { this.audio.uiOpen(); best.onUse(); }
    }
  }

  private updatePickups(dt: number): void {
    const level = this.level!, p = this.player;
    for (let i = level.pickups.length - 1; i >= 0; i--) {
      const pk = level.pickups[i];
      pk.life -= dt;
      pk.mesh.rotation.y += dt * 2;
      const d = Math.hypot(pk.pos.x - p.pos.x, pk.pos.z - p.pos.z);
      let taken = false;
      if (d < 3.2 && Math.abs(pk.pos.y - p.pos.y) < 2.5 && !p.dead) {
        const need = pk.kind === 'health' ? p.hp < p.maxHp : pk.kind === 'energy' ? p.energy < p.maxEnergy : this.weapons.slots.some((s) => s.reserve < s.st.def.reserve) || p.grenades < 2;
        if (need) {
          // attraction vers le joueur
          pk.pos.x += ((p.pos.x - pk.pos.x) / (d || 1)) * 9 * dt; pk.pos.z += ((p.pos.z - pk.pos.z) / (d || 1)) * 9 * dt;
          pk.mesh.position.set(pk.pos.x, pk.pos.y + 0.45, pk.pos.z);
          if (d < 1.1) {
            taken = true;
            if (pk.kind === 'health') { p.heal(25); this.ui.hud.flashHeal(); this.ui.hud.pickup('+25 SANTÉ', '#3aff8a'); }
            else if (pk.kind === 'energy') { p.addEnergy(30); this.ui.hud.pickup('+30 ÉNERGIE', '#4ad8ff'); }
            else { this.weapons.addMags(1); if (p.grenades < 2 && Math.random() < 0.35) p.grenades++; this.ui.hud.pickup('+ MUNITIONS', '#ffb04a'); }
            this.audio.pickup();
          }
        }
      }
      if (taken || pk.life <= 0) { pk.mesh.removeFromParent(); level.pickups.splice(i, 1); }
    }
  }
}
