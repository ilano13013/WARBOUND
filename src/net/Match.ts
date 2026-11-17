// Partie multijoueur en ligne (2 à 8 joueurs) : 1v1 aux fusils de précision, Match à mort par équipe, Domination.
// Topologie en étoile : chaque client est relié en WebRTC à l'hôte (connexions établies par le salon).
// L'HÔTE FAIT AUTORITÉ : il valide les déplacements (vitesse), les tirs (arme, cadence, munitions, rechargement),
// refait lui-même le calcul de chaque tir sur les positions passées (compensation de latence bornée),
// calcule les dégâts à partir de l'arme (jamais repris du client), décide des éliminations, des scores,
// des captures, du chronomètre et de la fin de partie. Les clients prédisent leurs propres déplacements.
// Limite assumée : un hôte modifié peut tricher (voir docs/AUDIT-MULTIJOUEUR-F2P.md).
import * as THREE from 'three';
import type { Game } from '../core/Game';
import { Peer } from './Peer';
import { LobbyClient } from './LobbyClient';
import type { ModeId, RoomView } from './lobbyProtocol';
import { Ticker } from './Ticker';
import { decodeInput, decodeSnap, encodeInput, encodeSnap, T_INPUT, T_SNAP, type SnapPlayer } from './wire';
import { LADDER, type LadderStep } from './Duel';
import { Rival } from '../ai/Rival';
import { raySphere, rayCylinder } from '../ai/Enemy';
import { WEAPONS } from '../data/weapons';
import { makeWeaponItem } from '../rpg/items';
import { weaponStats, type WStats } from '../rpg/Stats';
import { DUEL_SPAWNS, TEAM_SPAWNS, DOM_ZONES } from '../levels/duel';
import { outfitMats } from '../render/Cosmetics';
import { PRESET_CLASSES, sanitizeClass, MP_XP, LETHALS, RELOAD_FAST, REGEN_DELAY, REGEN_DELAY_FAST, REGEN_RATE, WEAPON_FINISH_XP, type ClassDef } from '../data/mpProgress';
import { Nades, THROW_SPEED, THROW_UP, type Nade } from './Nades';
import { BotBrain } from './Bots';
import { vmLoad } from '../player/ViewModel';
import { MODES } from './lobbyProtocol';

export type TeamId = 'red' | 'blue';
export interface Rules { score: number; time: number; respawn: number }
export const RULES: Record<ModeId, Rules> = {
  duel: { score: LADDER.length, time: 0, respawn: 3 },
  tdm: { score: 75, time: 600, respawn: 3 },
  dom: { score: 200, time: 720, respawn: 5 },
};
/** Équipement d'une classe : arme principale (avec accessoires) puis arme secondaire. Statistiques de base pour tous. */
export function classKit(c: ClassDef): LadderStep[] {
  return [
    { base: c.primary, attach: { ...c.pAttach } as Record<string, string>, label: WEAPONS[c.primary]?.name || c.primary },
    { base: c.secondary, attach: {}, label: WEAPONS[c.secondary]?.name || c.secondary },
  ];
}
interface WeaponSlot { st: WStats; ammo: number; reserve: number; reloadT: number }

const SNAP_HZ = 20, INPUT_HZ = 20;
const MAX_SPEED = 9.5;            // m/s (sprint tactique 8,2 + marge)
const REWIND_MAX = 0.25;          // compensation de latence maximale (s)
const SPAWN_PROTECT = 1.5;
const CONNECT_TIMEOUT = 15_000;
const ZONE_CAP_TIME = 10;         // s pour capturer seul
const ZONE_POINT_EVERY = 5;       // s entre deux points par zone tenue
const EYE = 1.62;

export interface MP {
  idx: number; id: string; name: string; team: TeamId | null;
  /** Classe jouée et classe choisie pour la prochaine apparition. */
  cls: ClassDef; pendingCls: ClassDef | null;
  /** Équipement en cours (arme principale en tête) et état de chaque arme chez l'hôte. */
  kit: LadderStep[]; wpn: Record<string, WeaponSlot>; lastW: string;
  x: number; y: number; z: number; yaw: number; pitch: number; speed: number; height: number; ads: boolean; crouch: boolean;
  hp: number; alive: boolean; invT: number; respawnT: number; lastIn: number; hist: { t: number; x: number; y: number; z: number; h: number }[];
  step: LadderStep; st: WStats | null; lastFire: number; firingT: number;
  k: number; d: number; a: number; rung: number; ping: number; dmgBy: Map<number, { dmg: number; t: number }>;
  peer: Peer | null; hello: boolean; connected: boolean; rival: Rival | null; corrT: number;
  /** Cosmétiques équipés, vérifiés par le serveur de salons (lus dans la vue du salon, jamais dans un message de joueur). */
  cos: Record<string, string>;
  /** Bot de remplacement (parties publiques), simulé par l'hôte. */
  bot: boolean;
  brain?: BotBrain;
  /** Grenades restantes, dernière blessure (régénération) et dernier lancer (hôte). */
  nades: number; hurtT: number; nadeT: number;
}
/** Équipement létal et atouts en vigueur pour un joueur (communiqués au joueur à chaque apparition). */
export interface Loadout { n: number; lt: string | null; pk: string[] }
export interface Zone { id: 'A' | 'B' | 'C'; pos: THREE.Vector3; r: number; owner: TeamId | null; prog: number; cap: TeamId | null; contested: boolean; pointT: number }
export interface FeedLine { text: string; t: number; mine: boolean }

const _o = new THREE.Vector3(), _d = new THREE.Vector3(), _a = new THREE.Vector3();

export class Match {
  lobby: LobbyClient | null = null;
  role: 'host' | 'client' = 'host';
  phase: 'idle' | 'connecting' | 'playing' | 'over' = 'idle';
  mode: ModeId = 'tdm';
  rules: Rules = RULES.tdm;
  players: MP[] = [];
  me = 0;
  status = '';
  teamScore = { red: 0, blue: 0 };
  timeLeft = 0;
  zones: Zone[] = [];
  feed: FeedLine[] = [];
  loaded = false;
  result: { title: string; sub: string; victory: boolean | null } | null = null;
  /** Classe choisie localement (4v4) et XP multijoueur gagnée dans la partie en cours. */
  cls: ClassDef = PRESET_CLASSES[0];
  xpEvents: { label: string; xp: number }[] = [];
  /** XP d'arme gagnée dans la partie en cours (par arme). */
  wXp: Record<string, number> = {};
  /** Équipement létal et atouts du joueur local (reçus de l'hôte). */
  myLoad: Loadout = { n: 0, lt: null, pk: [] };
  nades: Nades;
  private nadeSeq = 0;
  onStatus: () => void = () => {};
  /** Tests automatisés uniquement : règles raccourcies (score, durée). */
  testRules: Partial<Rules> | null = null;
  private hostPeer: Peer | null = null;
  private ticker = new Ticker((dt) => { if (document.hidden) this.tick(dt, false); });
  private snapT = 0; private inputT = 0; private scoreT = 0; private pingT = 0; private zoneT = 0;
  private seq = 0; private tickN = 0; private t0 = 0; private endsAt = 0;
  private connectTimer: number | null = null;
  private predictedHit = 0;

  constructor(readonly g: Game) { this.nades = new Nades(g); }

  /** Partie publique (matchmaking) : les places libres sont prises par des bots. */
  pub = false;
  /** Heure locale de réception du dernier état du salon (compte à rebours affiché). */
  lobbyRecvAt = 0;

  get active(): boolean { return this.phase === 'playing'; }
  get isHost(): boolean { return this.role === 'host'; }
  get mine(): MP | undefined { return this.players[this.me]; }
  private now(): number { return performance.now(); }
  private setStatus(s: string): void { this.status = s; this.onStatus(); }

  // =====================================================================
  // Mise en place (déclenchée par le salon)
  // =====================================================================

  /** Le salon a lancé la partie : établissement des connexions WebRTC en étoile. */
  begin(lobby: LobbyClient, hostId: string, room: RoomView): void {
    this.reset();
    this.lobby = lobby;
    this.mode = room.mode; this.rules = { ...RULES[room.mode], ...(this.g.testMode && this.testRules ? this.testRules : {}) };
    this.pub = !!room.pub;
    this.role = hostId === lobby.you ? 'host' : 'client';
    this.players = room.players.filter((p) => p.connected).map((p, i) => this.newPlayer(i, p.id, p.name, p.team as TeamId | null));
    this.me = this.players.findIndex((p) => p.id === lobby.you);
    this.mine!.cls = this.cls;
    // ensembles d'armes de la partie chargés pendant la connexion (classe choisie, ou échelle du duel)
    for (const st of this.mode === 'duel' ? LADDER : classKit(this.cls)) void vmLoad(st.base);
    this.phase = 'connecting';
    lobby.onSignal = (from, data) => void this.onSignal(from, data);
    if (this.isHost) {
      this.mine!.hello = true; this.mine!.connected = true;
      this.setStatus('Connexion aux joueurs…');
      for (const p of this.players) if (p.idx !== this.me) void this.offer(p);
      // seul dans la partie (publique, les autres places seront des bots) : lancement immédiat
      this.connectTimer = window.setTimeout(() => this.hostStart(), this.players.length > 1 ? CONNECT_TIMEOUT : 50);
    } else this.setStatus('Connexion à l’hôte…');
  }

  private newPlayer(idx: number, id: string, name: string, team: TeamId | null): MP {
    return { idx, id, name, team, cls: PRESET_CLASSES[0], pendingCls: null, kit: [], wpn: {}, lastW: '', x: 0, y: 0, z: 0, yaw: 0, pitch: 0, speed: 0, height: 1.8, ads: false, crouch: false,
      hp: 100, alive: false, invT: 0, respawnT: 0, lastIn: 0, hist: [], step: LADDER[0], st: null, lastFire: 0, firingT: 0,
      k: 0, d: 0, a: 0, rung: 0, ping: 0, dmgBy: new Map(), peer: null, hello: false, connected: false, rival: null, corrT: 0, cos: this.cosOf(id), bot: false, nades: 0, hurtT: 0, nadeT: 0 };
  }

  /** Hôte : crée l'invitation WebRTC d'un joueur et l'envoie par le salon. */
  private async offer(p: MP): Promise<void> {
    const peer = new Peer('host', !this.g.testMode);
    p.peer = peer;
    peer.onOpen = () => { p.connected = true; };
    peer.onMessage = (m) => this.hostMsg(p, m);
    peer.onBinary = (b) => this.hostBinary(p, b);
    peer.onClose = () => this.hostLost(p);
    try { this.lobby?.signal(p.id, { k: 'offer', code: await peer.createInvite(this.g.testMode ? 1200 : 4000) }); } catch { /* le joueur sera retiré au délai */ }
  }

  private async onSignal(from: string, data: any): Promise<void> {
    if (!data || typeof data !== 'object') return;
    if (this.isHost && data.k === 'answer') {
      const p = this.players.find((x) => x.id === from);
      if (p?.peer) { try { await p.peer.acceptAnswer(String(data.code)); } catch { /* */ } }
    } else if (!this.isHost && data.k === 'offer') {
      this.hostPeer?.close();
      const peer = new Peer('guest', !this.g.testMode);
      this.hostPeer = peer;
      peer.onOpen = () => { this.setStatus('Connecté à l’hôte. Chargement…'); peer.send({ t: 'hello', cls: this.cls }); };
      peer.onMessage = (m) => this.clientMsg(m);
      peer.onBinary = (b) => this.clientBinary(b);
      peer.onClose = () => { if (this.phase === 'playing' || this.phase === 'connecting') this.finishLocal(null, 'L’hôte a quitté la partie.'); };
      try { this.lobby?.signal(from, { k: 'answer', code: await peer.acceptInvite(String(data.code), this.g.testMode ? 1200 : 4000) }); } catch { /* */ }
    }
  }

  /** Hôte : tout le monde est prêt (ou délai écoulé) -> lancement. */
  private hostStart(): void {
    if (this.phase !== 'connecting' || !this.isHost) return;
    if (this.connectTimer) { clearTimeout(this.connectTimer); this.connectTimer = null; }
    // les joueurs injoignables sont retirés de la partie
    for (const p of this.players) if (p.idx !== this.me && !p.hello) { p.connected = false; p.peer?.close(); p.peer = null; }
    if (this.pub) this.addBots();
    this.t0 = this.now();
    this.endsAt = this.rules.time ? this.t0 + this.rules.time * 1000 : 0;
    if (this.mode === 'dom') this.zones = DOM_ZONES.map((z) => ({ id: z.id, pos: z.pos.clone(), r: z.r, owner: null, prog: 0, cap: null, contested: false, pointT: 0 }));
    for (const p of this.players) if (p.connected || p.idx === this.me) { this.giveKit(p, this.mode === 'duel' ? [LADDER[0]] : classKit(p.cls)); this.respawn(p, true); }
    for (const p of this.players) if (p.peer && p.hello) p.peer.send(this.initMsg(p.idx));
    this.setLoad(this.loadOf(this.mine!));
    this.phase = 'playing';
    this.g.startMatch();
  }

  /** Complète la partie publique avec des bots vétérans (équipes équilibrées). */
  private addBots(): void {
    const names = ['Vipère', 'Corbeau', 'Spectre', 'Goliath', 'Faucon', 'Lynx', 'Orage', 'Basilic'];
    const active = () => this.players.filter((p) => p.connected || p.idx === this.me || p.bot);
    let i = 0;
    while (active().length < MODES[this.mode].max && this.players.length < 16) {
      const teams = MODES[this.mode].teams;
      const red = active().filter((p) => p.team === 'red').length, blue = active().filter((p) => p.team === 'blue').length;
      const p = this.newPlayer(this.players.length, `bot-${i}`, `${names[i % names.length]} [BOT]`, teams ? (red <= blue ? 'red' : 'blue') : null);
      p.bot = true; p.connected = true; p.hello = true;
      p.cls = { ...PRESET_CLASSES[Math.floor(Math.random() * PRESET_CLASSES.length)], lethal: 'frag' };
      p.brain = new BotBrain(this, p);
      this.players.push(p);
      i++;
    }
  }

  private initMsg(you: number): unknown {
    return { t: 'init', you, mode: this.mode, rules: this.rules, players: this.players.map((p) => ({ idx: p.idx, id: p.id, name: p.name, team: p.team, connected: p.connected, bot: p.bot, x: p.x, y: p.y, z: p.z, yaw: p.yaw, alive: p.alive, step: p.step, kit: p.kit, k: p.k, d: p.d, a: p.a, rung: p.rung })), load: this.player(you) ? this.loadOf(this.players[you]) : null, zones: this.zones.map((z) => ({ id: z.id, owner: z.owner })), timeLeft: this.endsAt ? (this.endsAt - this.now()) / 1000 : 0, score: this.teamScore };
  }

  private player(i: number): MP | undefined { return this.players[i]; }
  /** Atout actif (jamais en duel). */
  perk(p: MP, id: string): boolean { return this.mode !== 'duel' && p.cls.perks.includes(id); }
  private lethalOf(p: MP): string | null { return this.mode === 'duel' ? null : p.cls.lethal; }
  loadOf(p: MP): Loadout { return { n: p.nades, lt: this.lethalOf(p), pk: this.mode === 'duel' ? [] : p.cls.perks.filter((k): k is string => !!k) }; }
  private reserveMags(p: MP): number { return this.perk(p, 'munitions') ? 7 : 5; }

  /** Appelé par Game.startMatch une fois l'arène chargée. */
  onLoaded(): void {
    const g = this.g, p = g.player;
    this.loaded = true;
    p.godMode = true; // les dégâts du joueur local ne viennent que de l'hôte
    for (const mp of this.players) if (mp.idx !== this.me && (mp.connected || !this.isHost)) this.makeRival(mp);
    const me = this.mine!;
    this.applyKit(me.kit.length ? me.kit : [me.step]);
    if (me.alive) this.placeLocal(me); else { p.dead = true; g.state = 'dead'; }
    this.ticker.start(1000 / SNAP_HZ);
  }

  // =====================================================================
  // Boucle
  // =====================================================================

  /** À chaque image (rendered = boucle d'affichage) ou par le Worker quand l'onglet est masqué. */
  tick(dt: number, rendered = true): void {
    if (this.phase !== 'playing') return;
    const now = this.now();
    if (!rendered && this.loaded) for (const mp of this.players) mp.rival?.update(dt);
    if (this.isHost) this.hostTick(dt, now);
    else this.clientTick(dt);
    for (let i = this.feed.length - 1; i >= 0; i--) if (now - this.feed[i].t > 6000) this.feed.splice(i, 1);
  }

  private localState(): { x: number; y: number; z: number; yaw: number; pitch: number; speed: number; height: number; ads: boolean; crouch: boolean } {
    const p = this.g.player;
    return { x: p.pos.x, y: p.pos.y, z: p.pos.z, yaw: p.yaw, pitch: p.pitch, speed: p.speedNow, height: p.height, ads: this.g.weapons.adsK > 0.5, crouch: p.crouching };
  }

  private clientTick(dt: number): void {
    this.inputT -= dt;
    if (this.inputT <= 0 && this.hostPeer && this.loaded && this.mine?.alive) {
      this.inputT = 1 / INPUT_HZ;
      this.hostPeer.sendBinary(encodeInput(++this.seq, this.localState()));
    }
    if (this.timeLeft > 0) this.timeLeft = Math.max(0, this.timeLeft - dt);
  }

  // =====================================================================
  // Autorité (hôte)
  // =====================================================================

  private hostTick(dt: number, now: number): void {
    const me = this.mine!;
    // l'hôte joue aussi : sa position passe par la même validation
    if (this.loaded && me.alive) this.acceptMove(me, this.localState(), now, true);
    if (this.loaded) for (const p of this.players) if (p.bot && p.brain) p.brain.update(dt, now);
    for (const p of this.players) {
      if (!p.connected && p.idx !== this.me) continue;
      if (p.invT > 0) p.invT -= dt;
      if (p.firingT > 0) p.firingT -= dt;
      for (const w of Object.values(p.wpn)) if (w.reloadT > 0) { w.reloadT -= dt; if (w.reloadT <= 0) this.finishReload(w); }
      if (!p.alive) { p.respawnT -= dt; if (p.respawnT <= 0) this.respawn(p); }
      // régénération de la santé (plus tôt avec l'atout Vigueur)
      else if (p.hp < 100 && now - p.hurtT > (this.perk(p, 'vigueur') ? REGEN_DELAY_FAST : REGEN_DELAY) * 1000) p.hp = Math.min(100, p.hp + REGEN_RATE * dt);
    }
    if (this.loaded || this.nades.list.length) {
      const fused = this.nades.update(dt, (i) => this.bodyPos(i), (n) => this.semtexHit(n));
      for (const n of fused) this.explode(n);
    }
    if (this.mode === 'dom') this.domTick(dt);
    if (this.endsAt && now >= this.endsAt) this.hostEnd('time');
    if (this.phase !== 'playing') return;
    // instantané
    this.snapT -= dt;
    if (this.snapT <= 0) {
      this.snapT = 1 / SNAP_HZ;
      const snap = encodeSnap(++this.tickN, (now - this.t0) / 1000, this.players.filter((p) => p.connected || p.idx === this.me).map((p) => this.snapOf(p)));
      for (const p of this.players) if (p.peer && p.hello) p.peer.sendBinary(snap);
      this.applySnap(this.players.map((p) => this.snapOf(p)));
    }
    this.scoreT -= dt;
    if (this.scoreT <= 0) { this.scoreT = 1; this.broadcast(this.scoreMsg()); this.applyScore(this.scoreMsg()); }
    this.pingT -= dt;
    if (this.pingT <= 0) { this.pingT = 2; for (const p of this.players) if (p.peer && p.hello) p.peer.send({ t: 'pi', s: now }); }
    if (this.mode === 'dom') { this.zoneT -= dt; if (this.zoneT <= 0) { this.zoneT = 0.25; const zm = this.zonesMsg(); this.broadcast(zm); } }
  }

  private snapOf(p: MP): SnapPlayer {
    return { idx: p.idx, x: p.x, y: p.y, z: p.z, yaw: p.yaw, pitch: p.pitch, speed: p.speed, height: p.height, ads: p.ads, crouch: p.crouch, hp: p.hp, alive: p.alive, inv: p.invT > 0, firing: p.firingT > 0 };
  }

  private scoreMsg(): any {
    return { t: 'score', red: this.teamScore.red, blue: this.teamScore.blue, left: this.endsAt ? Math.max(0, (this.endsAt - this.now()) / 1000) : 0, p: this.players.map((p) => [p.idx, p.k, p.d, p.a, Math.round(p.ping), p.rung, p.connected || p.idx === this.me ? 1 : 0]) };
  }
  private zonesMsg(): any { return { t: 'zones', z: this.zones.map((z) => [z.id, z.owner, Math.round(z.prog * 100) / 100, z.cap, z.contested ? 1 : 0]) }; }

  private broadcast(m: unknown): void { for (const p of this.players) if (p.peer && p.hello) p.peer.send(m); }
  /** Événement destiné à tous, y compris l'hôte lui-même. */
  private emit(m: any): void { this.broadcast(m); this.clientMsg(m, true); }

  private hostMsg(p: MP, m: any): void {
    if (!m || typeof m.t !== 'string') return;
    switch (m.t) {
      case 'hello':
        if (p.hello) return;
        p.hello = true;
        p.cls = sanitizeClass(m.cls);
        if (this.phase === 'connecting' && this.players.every((x) => x.hello || x.idx === this.me)) this.hostStart();
        else if (this.phase === 'playing') {
          // arrivée en cours de partie (reconnexion)
          p.connected = true;
          this.giveKit(p, this.mode === 'duel' ? [LADDER[Math.min(p.rung, LADDER.length - 1)]] : classKit(p.cls));
          p.peer!.send(this.initMsg(p.idx));
          this.respawn(p, true);
          if (this.loaded) this.makeRival(p);
          this.emit({ t: 'join', idx: p.idx, name: p.name, team: p.team });
        }
        return;
      case 'fire': this.hostFire(p, m); return;
      case 'reload': this.startReload(p, String(m.w || p.lastW)); return;
      case 'nade': this.hostNade(p, m); return;
      case 'setclass': if (this.mode !== 'duel') p.pendingCls = sanitizeClass(m.cls); return;
      case 'po': if (Number.isFinite(m.s)) p.ping = p.ping ? p.ping * 0.7 + (this.now() - m.s) * 0.3 : this.now() - m.s; return;
      case 'quit': this.hostLost(p); return;
    }
  }

  private hostBinary(p: MP, b: ArrayBuffer): void {
    const u = decodeInput(b);
    if (!u || !p.alive) return;
    this.acceptMove(p, u.s, this.now(), false);
  }

  /** Validation du déplacement : vitesse horizontale, montée verticale et limites de la carte. */
  acceptMove(p: MP, s: { x: number; y: number; z: number; yaw: number; pitch: number; speed: number; height: number; ads: boolean; crouch: boolean }, now: number, local: boolean): void {
    const dt = Math.max(0.016, (now - (p.lastIn || now - 50)) / 1000);
    const horiz = Math.hypot(s.x - p.x, s.z - p.z), up = s.y - p.y;
    const b = this.g.level?.bounds;
    const inside = !b || (s.x > b.minX - 1 && s.x < b.maxX + 1 && s.z > b.minZ - 1 && s.z < b.maxZ + 1 && s.y > -5 && s.y < 12);
    const ok = local || (inside && horiz <= MAX_SPEED * Math.min(dt, 0.5) + 1.2 && up <= 6 * Math.min(dt, 0.5) + 1.9);
    p.yaw = s.yaw; p.pitch = Math.max(-1.6, Math.min(1.6, s.pitch)); p.speed = Math.min(12, s.speed); p.height = Math.max(0.9, Math.min(1.9, s.height)); p.ads = s.ads; p.crouch = s.crouch;
    p.lastIn = now;
    if (ok) { p.x = s.x; p.y = s.y; p.z = s.z; }
    else if (now - p.corrT > 300) { p.corrT = now; p.peer?.send({ t: 'pos', x: p.x, y: p.y, z: p.z }); }
    p.hist.push({ t: now, x: p.x, y: p.y, z: p.z, h: p.height });
    while (p.hist.length && now - p.hist[0].t > 1000) p.hist.shift();
  }

  /** Équipe un joueur (chez l'hôte) : une arme par entrée, munitions pleines. */
  private giveKit(p: MP, kit: LadderStep[]): void {
    p.kit = kit; p.step = kit[0]; p.wpn = {};
    for (const s of kit) {
      const item = makeWeaponItem(s.base, 'common', 1);
      item.attach = { ...s.attach } as typeof item.attach;
      const st = weaponStats(item, {}, 'arcanist');
      p.wpn[s.base] = { st, ammo: st.mag, reserve: st.mag * this.reserveMags(p), reloadT: 0 };
    }
    p.st = p.wpn[kit[0].base].st; p.lastW = kit[0].base;
  }

  private startReload(p: MP, w: string): void {
    const s = p.wpn[w];
    if (!s || s.reloadT > 0 || s.ammo >= s.st.mag || s.reserve <= 0 || !p.alive) return;
    s.reloadT = s.st.reload * 0.9 * (this.perk(p, 'rapide') ? RELOAD_FAST : 1); // marge : l'horloge du client et celle de l'hôte ne sont pas alignées
  }
  private finishReload(s: WeaponSlot): void {
    const take = Math.min(s.st.mag - s.ammo, s.reserve);
    s.ammo += take; s.reserve -= take;
  }

  /** Position d'un joueur à un instant passé (interpolation dans l'historique). */
  private posAt(p: MP, t: number, out: THREE.Vector3): number {
    const h = p.hist;
    if (!h.length || t >= h[h.length - 1].t) { out.set(p.x, p.y, p.z); return p.height; }
    for (let i = h.length - 1; i > 0; i--) {
      if (h[i - 1].t <= t) {
        const a = h[i - 1], b = h[i], k = (t - a.t) / Math.max(1, b.t - a.t);
        out.set(a.x + (b.x - a.x) * k, a.y + (b.y - a.y) * k, a.z + (b.z - a.z) * k);
        return a.h + (b.h - a.h) * k;
      }
    }
    out.set(h[0].x, h[0].y, h[0].z); return h[0].h;
  }

  /** Tir : validé et résolu par l'hôte. */
  hostFire(p: MP, m: any): void {
    const ws = p.wpn[String(m.w)], now = this.now();
    if (!ws || !p.alive) return;
    const st = ws.st;
    if (![m.ox, m.oy, m.oz, m.dx, m.dy, m.dz].every(Number.isFinite)) return;
    const minGap = (60 / st.rpm) * 1000 * 0.85;
    if (now - p.lastFire < minGap) return;                         // cadence impossible
    if (ws.reloadT > 0 || ws.ammo <= 0) { p.peer?.send({ t: 'ammo', a: ws.ammo, r: ws.reserve }); return; }
    _o.set(m.ox, m.oy, m.oz);
    if (_o.distanceTo(_a.set(p.x, p.y + p.height * 0.9, p.z)) > 2.2) return; // tir depuis une position qui n'est pas la sienne
    _d.set(m.dx, m.dy, m.dz).normalize();
    p.lastFire = now; ws.ammo--; p.firingT = 0.4; p.lastW = String(m.w);
    p.invT = 0; // tirer annule la protection d'apparition
    if (ws.ammo === 0 && ws.reserve > 0) this.startReload(p, p.lastW);
    // résolution sur les positions passées : latence du tireur, bornée
    const rewind = p.idx === this.me ? 0 : Math.min(REWIND_MAX, p.ping / 2000 + 0.1);
    const wall = this.g.level?.world.raycast(_o, _d, 300, 'shoot');
    let bestT = wall ? wall.t : 300, best: MP | null = null, head = false;
    for (const v of this.players) {
      if (v === p || !v.alive || (!v.connected && v.idx !== this.me)) continue;
      if (p.team && v.team === p.team) continue; // tir allié désactivé
      const h = this.posAt(v, now - rewind * 1000, _a);
      const th = raySphere(_o, _d, _a.x, _a.y + h * 0.9, _a.z, 0.19);
      if (th !== null && th < bestT) { bestT = th; best = v; head = true; }
      const tb = rayCylinder(_o, _d, _a.x, _a.z, 0.4, _a.y, _a.y + h * 0.82);
      if (tb !== null && tb < bestT - 0.02) { bestT = tb; best = v; head = false; }
    }
    const end = _a.copy(_o).addScaledVector(_d, Math.min(bestT, 120));
    const shot = { t: 'shot', i: p.idx, ex: +end.x.toFixed(2), ey: +end.y.toFixed(2), ez: +end.z.toFixed(2), sil: st.silent ? 1 : 0, gh: this.perk(p, 'fantome') ? 1 : 0, w: p.lastW };
    for (const q of this.players) if (q !== p && q.peer && q.hello) q.peer.send(shot);
    if (p.idx !== this.me) this.clientMsg(shot, true);
    if (!best) return;
    if (best.invT > 0) { this.toPlayer(p, { t: 'hitc', imm: 1 }); return; }
    const fall = bestT <= st.rangeStart ? 1 : bestT >= st.rangeEnd ? st.minDmg : 1 - (1 - st.minDmg) * ((bestT - st.rangeStart) / (st.rangeEnd - st.rangeStart));
    let dmg = st.damage * fall;
    if (head) dmg *= st.headMult;
    dmg = Math.round(dmg);
    best.hp -= dmg; best.hurtT = now;
    best.dmgBy.set(p.idx, { dmg: (best.dmgBy.get(p.idx)?.dmg || 0) + dmg, t: now });
    const killed = best.hp <= 0;
    this.toPlayer(best, { t: 'hurt', hp: Math.max(0, best.hp), fx: p.x, fz: p.z, h: head ? 1 : 0 });
    this.toPlayer(p, { t: 'hitc', h: head ? 1 : 0, k: killed ? 1 : 0, d: dmg });
    if (killed) this.kill(best, p, head);
  }

  private toPlayer(p: MP, m: any): void { if (p.idx === this.me) this.clientMsg(m, true); else p.peer?.send(m); }

  kill(v: MP, k: MP | null, head: boolean, weapon?: string): void {
    const now = this.now();
    v.alive = false; v.hp = 0; v.d++; v.respawnT = this.rules.respawn;
    let assist = -1;
    if (k && k !== v) {
      k.k++;
      if (k.team) this.teamScore[k.team] += this.mode === 'tdm' ? 1 : 0;
      for (const [idx, e] of v.dmgBy) if (idx !== k.idx && now - e.t < 10_000 && e.dmg >= 20) { const a = this.players[idx]; if (a) { a.a++; assist = idx; } }
    }
    v.dmgBy.clear();
    this.emit({ t: 'kill', k: k ? k.idx : -1, v: v.idx, w: weapon ?? (k ? k.lastW : ''), h: head ? 1 : 0, a: assist });
    if (!k || k === v) return;
    // Pillard : un chargeur récupéré pour chaque arme
    if (this.perk(k, 'pillard')) { for (const w of Object.values(k.wpn)) w.reserve += w.st.mag; this.toPlayer(k, { t: 'loot' }); }
    if (this.mode === 'duel') {
      if (k.rung >= LADDER.length - 1) { this.hostEnd('score', k); return; }
      k.rung++;
      this.giveKit(k, [LADDER[k.rung]]);
      this.toPlayer(k, { t: 'weapon', step: k.step, kit: k.kit, rung: k.rung });
    } else if (this.mode === 'tdm' && k.team && this.teamScore[k.team] >= this.rules.score) this.hostEnd('score');
  }

  /** Réapparition : point d'équipe le plus éloigné des ennemis vivants. */
  private respawn(p: MP, first = false): void {
    const pool = this.mode === 'duel' || !p.team ? DUEL_SPAWNS : TEAM_SPAWNS[p.team];
    const foes = this.players.filter((q) => q !== p && q.alive && (!p.team || q.team !== p.team));
    let best = pool[first && this.mode === 'duel' ? Math.min(p.idx, 1) : 0], bd = -1;
    for (const s of pool) {
      const taken = this.players.some((q) => q !== p && q.alive && Math.hypot(q.x - s.pos.x, q.z - s.pos.z) < 1.2);
      const d = foes.length ? Math.min(...foes.map((q) => Math.hypot(q.x - s.pos.x, q.z - s.pos.z))) : 50 - Math.random();
      if (!taken && (first && this.mode === 'duel' ? false : d > bd)) { bd = d; best = s; }
    }
    p.x = best.pos.x; p.y = best.pos.y; p.z = best.pos.z; p.yaw = best.yaw; p.pitch = 0;
    p.hp = 100; p.alive = true; p.invT = SPAWN_PROTECT; p.hist = []; p.lastIn = this.now();
    // nouvelle classe choisie pendant la mort : appliquée à cette apparition
    if (p.pendingCls && this.mode !== 'duel') { p.cls = p.pendingCls; p.pendingCls = null; this.giveKit(p, classKit(p.cls)); }
    for (const w of Object.values(p.wpn)) { w.ammo = w.st.mag; w.reserve = w.st.mag * this.reserveMags(p); w.reloadT = 0; }
    const lt = this.lethalOf(p);
    p.nades = lt ? 1 + (this.perk(p, 'munitions') ? 1 : 0) : 0; p.hurtT = 0;
    if (this.phase === 'playing') {
      this.toPlayer(p, { t: 'load', ...this.loadOf(p) });
      this.emit({ t: 'spawn', i: p.idx, x: p.x, y: p.y, z: p.z, yaw: p.yaw, step: p.step, kit: p.kit });
    }
  }

  // ---------- grenades (hôte) ----------

  /** Centre du corps d'un joueur vivant (hôte : position officielle ; client : affichage). */
  private bodyPos(i: number): THREE.Vector3 | null {
    const p = this.players[i];
    if (!p || !p.alive) return null;
    if (!this.isHost && i !== this.me && p.rival) return p.rival.pos.clone().setY(p.rival.pos.y + 0.9);
    if (i === this.me && this.loaded) return this.g.player.pos.clone().setY(this.g.player.pos.y + 0.9);
    return new THREE.Vector3(p.x, p.y + 0.9, p.z);
  }

  /** Semtex en vol : joueur (autre que le lanceur) touché. */
  private semtexHit(n: Nade): number {
    for (const v of this.players) {
      if (v.idx === n.owner || !v.alive || (!v.connected && v.idx !== this.me)) continue;
      const cy = Math.max(v.y + 0.2, Math.min(v.y + v.height - 0.1, n.pos.y));
      if (Math.hypot(n.pos.x - v.x, n.pos.y - cy, n.pos.z - v.z) < 0.5) {
        this.emit({ t: 'nstk', id: n.id, i: v.idx, ox: +(n.pos.x - v.x).toFixed(2), oy: +(n.pos.y - v.y - 0.9).toFixed(2), oz: +(n.pos.z - v.z).toFixed(2) });
        return v.idx;
      }
    }
    return -1;
  }

  /** Lancer de grenade : validé par l'hôte (grenade disponible, position du lanceur, cadence). */
  hostNade(p: MP, m: any): void {
    const kind = this.lethalOf(p), now = this.now();
    if (!kind || !LETHALS[kind] || !p.alive || p.nades <= 0 || now - p.nadeT < 800) { this.toPlayer(p, { t: 'nadec', n: p.nades }); return; }
    if (![m.ox, m.oy, m.oz, m.dx, m.dy, m.dz].every(Number.isFinite)) return;
    _o.set(m.ox, m.oy, m.oz);
    if (_o.distanceTo(_a.set(p.x, p.y + p.height * 0.9, p.z)) > 2.2) { this.toPlayer(p, { t: 'nadec', n: p.nades }); return; }
    _d.set(m.dx, m.dy, m.dz).normalize().multiplyScalar(THROW_SPEED); _d.y += THROW_UP;
    p.nades--; p.nadeT = now; p.invT = 0;
    const id = ++this.nadeSeq;
    this.nades.add(id, kind, p.idx, _o, _d);
    this.toPlayer(p, { t: 'nadec', n: p.nades });
    const msg = { t: 'nade', id, k: kind, i: p.idx, x: +_o.x.toFixed(3), y: +_o.y.toFixed(3), z: +_o.z.toFixed(3), vx: +_d.x.toFixed(3), vy: +_d.y.toFixed(3), vz: +_d.z.toFixed(3) };
    this.broadcast(msg);
    if (p.idx === this.me) this.g.audio.skill('grenadeThrow');
  }

  /** Explosion (hôte) : dégâts dégressifs, bloqués par les murs, pas de tir allié (dégâts réduits sur soi). */
  private explode(n: Nade): void {
    const def = LETHALS[n.kind], src = this.players[n.owner], now = this.now();
    this.nades.remove(n);
    this.emit({ t: 'boom', id: n.id, k: n.kind, x: +n.pos.x.toFixed(2), y: +n.pos.y.toFixed(2), z: +n.pos.z.toFixed(2) });
    if (!def) return;
    const world = this.g.level?.world;
    for (const v of this.players) {
      if (!v.alive || (!v.connected && v.idx !== this.me) || v.invT > 0) continue;
      const self = v.idx === n.owner;
      if (!self && src?.team && v.team === src.team) continue;
      _a.set(v.x, v.y + 0.9, v.z);
      const d = n.stickTo === v.idx ? 0 : _a.distanceTo(n.pos);
      if (d >= def.radius) continue;
      if (d > 0.3 && world) { _d.copy(_a).sub(n.pos).normalize(); const h = world.raycast(n.pos, _d, d, 'shoot'); if (h && h.t < d - 0.3) continue; }
      let dmg = d < 1.2 ? def.damage : def.damage * (1 - (d - 1.2) / (def.radius - 1.2));
      if (self) dmg *= 0.5;
      if (this.perk(v, 'gilet')) dmg *= 0.5;
      dmg = Math.round(Math.max(8, dmg));
      v.hp -= dmg; v.hurtT = now;
      if (src && !self) v.dmgBy.set(src.idx, { dmg: (v.dmgBy.get(src.idx)?.dmg || 0) + dmg, t: now });
      const killed = v.hp <= 0;
      this.toPlayer(v, { t: 'hurt', hp: Math.max(0, v.hp), fx: n.pos.x, fz: n.pos.z, h: 0 });
      if (src && !self) this.toPlayer(src, { t: 'hitc', h: 0, k: killed ? 1 : 0, d: dmg });
      if (killed) this.kill(v, self ? null : src || null, false, n.kind);
      if (this.phase !== 'playing') return;
    }
  }

  private domTick(dt: number): void {
    for (const z of this.zones) {
      let red = 0, blue = 0;
      for (const p of this.players) {
        if (!p.alive || (!p.connected && p.idx !== this.me)) continue;
        if (Math.hypot(p.x - z.pos.x, p.z - z.pos.z) < z.r && p.y > z.pos.y - 0.6 && p.y < z.pos.y + 2.5) { if (p.team === 'red') red++; else if (p.team === 'blue') blue++; }
      }
      z.contested = red > 0 && blue > 0;
      const team: TeamId | null = z.contested ? null : red ? 'red' : blue ? 'blue' : null;
      if (team) {
        const n = Math.min(3, team === 'red' ? red : blue);
        const rate = (1 + (n - 1) * 0.5) / ZONE_CAP_TIME; // ×1, ×1,5, ×2 au maximum
        if (z.owner === team) { z.prog = 1; z.cap = null; }
        else if (z.cap && z.cap !== team) { z.prog -= rate * dt; if (z.prog <= 0) { z.prog = 0; z.cap = team; } }
        else {
          z.cap = team; z.prog += rate * dt;
          if (z.prog >= 1) {
            const lost = z.owner;
            z.owner = team; z.prog = 1; z.cap = null; z.pointT = 0;
            const who = this.players.filter((q) => q.alive && q.team === team && Math.hypot(q.x - z.pos.x, q.z - z.pos.z) < z.r).map((q) => q.idx);
            this.emit({ t: 'zcap', id: z.id, team, lost, who });
          }
        }
      } else if (!z.contested && z.cap && z.owner !== z.cap) { z.prog = Math.max(0, z.prog - dt / ZONE_CAP_TIME / 2); if (z.prog === 0) z.cap = null; }
      if (z.owner) {
        z.pointT += dt;
        if (z.pointT >= ZONE_POINT_EVERY) { z.pointT -= ZONE_POINT_EVERY; this.teamScore[z.owner]++; if (this.teamScore[z.owner] >= this.rules.score) { this.hostEnd('score'); return; } }
      }
    }
  }

  private hostEnd(why: 'score' | 'time' | 'forfeit', winner?: MP): void {
    if (this.phase !== 'playing') return;
    let w: TeamId | 'draw' | number;
    if (this.mode === 'duel') w = winner ? winner.idx : this.players.filter((p) => p.connected || p.idx === this.me).sort((a, b) => b.rung - a.rung || b.k - a.k)[0]?.idx ?? this.me;
    else w = this.teamScore.red === this.teamScore.blue ? 'draw' : this.teamScore.red > this.teamScore.blue ? 'red' : 'blue';
    this.broadcast(this.scoreMsg());
    this.applyScore(this.scoreMsg());
    this.emit({ t: 'end', w, why });
    // le salon repasse en attente une fois les résultats affichés
    setTimeout(() => this.lobby?.send({ t: 'end' }), 1500);
  }

  private hostLost(p: MP): void {
    if (!p.connected && !p.peer) return;
    p.connected = false; p.alive = false; p.peer = null;
    if (this.phase === 'connecting') { if (this.players.every((x) => x.hello || !x.connected || x.idx === this.me)) this.hostStart(); return; }
    if (this.phase !== 'playing') return;
    this.emit({ t: 'left', i: p.idx });
    const others = this.players.filter((q) => q.idx !== this.me && q.connected && !q.bot);
    if (!others.length && !this.pub) this.hostEnd('forfeit', this.mine);
  }

  /** Le salon signale un joueur revenu pendant la partie : l'hôte lui renvoie une invitation. */
  onRoom(room: RoomView): void {
    if (!this.isHost || this.phase !== 'playing') return;
    for (const rp of room.players) {
      const p = this.players.find((x) => x.id === rp.id);
      if (p && rp.connected && !p.connected && !p.peer) { p.hello = false; void this.offer(p); }
    }
  }

  // =====================================================================
  // Client (et affichage chez l'hôte)
  // =====================================================================

  private clientBinary(b: ArrayBuffer): void {
    if (new DataView(b).getUint8(0) !== T_SNAP) return;
    const s = decodeSnap(b);
    if (s) this.applySnap(s.players);
  }

  private applySnap(list: SnapPlayer[]): void {
    for (const s of list) {
      const p = this.players[s.idx];
      if (!p) continue;
      if (s.idx === this.me) {
        p.hp = s.hp;
        if (this.loaded && !this.g.player.dead) this.g.player.hp = Math.max(1, s.hp);
        continue;
      }
      // chez l'hôte, ces champs font autorité : l'affichage ne doit jamais les réécrire
      if (!this.isHost) { p.x = s.x; p.y = s.y; p.z = s.z; p.yaw = s.yaw; p.hp = s.hp; p.invT = s.inv ? 1 : 0; }
      if (p.rival && p.rival.alive && s.alive) p.rival.apply({ x: s.x, y: s.y, z: s.z, yaw: s.yaw, pitch: s.pitch, sp: s.speed, h: s.height, ads: s.ads, hp: s.hp, inv: s.inv });
    }
  }

  private applyScore(m: any): void {
    this.teamScore = { red: m.red | 0, blue: m.blue | 0 };
    this.timeLeft = Number(m.left) || 0;
    if (Array.isArray(m.p)) for (const [idx, k, d, a, ping, rung, conn] of m.p) { const p = this.players[idx]; if (p) { p.k = k; p.d = d; p.a = a; p.ping = ping; p.rung = rung; if (!this.isHost) p.connected = !!conn; } }
  }

  /** Messages fiables de l'hôte (local = émis par l'hôte pour lui-même). */
  private clientMsg(m: any, local = false): void {
    if (!m || typeof m.t !== 'string') return;
    const g = this.g;
    switch (m.t) {
      case 'init': {
        if (local) return;
        this.me = m.you; this.mode = m.mode; this.rules = m.rules;
        this.players = m.players.map((q: any) => { const p = this.newPlayer(q.idx, String(q.id || ''), q.name, q.team); Object.assign(p, { x: q.x, y: q.y, z: q.z, yaw: q.yaw, alive: q.alive, step: q.step, kit: Array.isArray(q.kit) ? q.kit : [], k: q.k, d: q.d, a: q.a, rung: q.rung, connected: q.connected, bot: !!q.bot }); return p; });
        this.zones = (m.zones || []).map((z: any) => { const d = DOM_ZONES.find((x) => x.id === z.id)!; return { id: z.id, pos: d.pos.clone(), r: d.r, owner: z.owner, prog: z.owner ? 1 : 0, cap: null, contested: false, pointT: 0 }; });
        this.timeLeft = m.timeLeft; this.teamScore = m.score;
        if (m.load) this.setLoad(m.load);
        this.phase = 'playing';
        g.startMatch();
        return;
      }
      case 'pi': this.hostPeer?.send({ t: 'po', s: m.s }); return;
      case 'load': this.setLoad(m); return;
      case 'nadec': this.myLoad.n = m.n | 0; if (this.loaded) g.player.grenades = this.myLoad.n; return;
      case 'loot': for (const s of g.weapons.slots) s.reserve += s.st.mag; g.ui.hud.pickup('+ MUNITIONS (PILLARD)', '#ffb04a'); return;
      case 'nade': {
        if (local || !this.loaded) return;
        _o.set(m.x, m.y, m.z); _d.set(m.vx, m.vy, m.vz);
        this.nades.add(m.id, String(m.k), m.i, _o, _d);
        if (m.i !== this.me) g.audio.skill('grenadeThrow');
        return;
      }
      case 'nstk': {
        if (local) return;
        const n = this.nades.get(m.id);
        if (n) { n.stickTo = m.i; n.off.set(m.ox, m.oy, m.oz); n.vel.set(0, 0, 0); }
        if (m.i === this.me && this.loaded) g.ui.hud.toast('SEMTEX COLLÉE !', '#ff5a4a');
        return;
      }
      case 'boom': {
        const n = this.nades.get(m.id);
        if (n) this.nades.remove(n);
        if (this.loaded) this.nades.boom(String(m.k), _a.set(m.x, m.y, m.z));
        return;
      }
      case 'score': if (!local) this.applyScore(m); return;
      case 'zones': if (!local) for (const [id, owner, prog, cap, cont] of m.z) { const z = this.zones.find((x) => x.id === id); if (z) { z.owner = owner; z.prog = prog; z.cap = cap; z.contested = !!cont; } } return;
      case 'pos': if (this.loaded) { g.player.pos.set(m.x, m.y, m.z); g.player.vel.set(0, 0, 0); } return;
      case 'ammo': { const w = g.weapons.w; if (w) { w.ammo = m.a; w.reserve = m.r; } return; }
      case 'shot': {
        const p = this.players[m.i];
        if (!p?.rival || !p.rival.alive || m.i === this.me) return;
        const def = WEAPONS[m.w] || WEAPONS.ar17;
        p.rival.center(_o); _o.y += 0.35;
        _a.set(m.ex, m.ey, m.ez);
        g.fx.tracer(_o, _a, 0xffd0a0, def.family === 'sniper' ? 0.05 : 0.02, def.family === 'sniper' ? 0.16 : 0.06);
        if (!m.sil) { g.fx.flash(_o, 0xffc890, 10, 0.05, 8); if (!m.gh) p.rival.firedT = 3; }
        g.audio.gunshot(def.sound, !!m.sil, p.rival.pos, 1, def.rec);
        return;
      }
      case 'hurt': {
        const p = g.player;
        if (!this.loaded || p.dead) return;
        const lost = p.hp - m.hp;
        p.hp = Math.max(1, m.hp); p.lastHurt = g.time; p.shakeAmt = Math.min(1, p.shakeAmt + lost / 60);
        g.audio.hurt();
        g.ui.hud.damageIndicator(Math.atan2(m.fx - p.pos.x, m.fz - p.pos.z) - p.yaw + Math.PI, lost);
        return;
      }
      case 'hitc':
        if (m.imm) { g.ui.hud.immune(); return; }
        // le marqueur de touche local a déjà été affiché à la prédiction ; l'hôte confirme les éliminations
        if (m.k) { g.ui.hud.hitmarker(!!m.h, true); g.audio.hitmarker(!!m.h, true); }
        else if (this.predictedHit <= 0) { g.ui.hud.hitmarker(!!m.h, false); g.audio.hitmarker(!!m.h, false); }
        return;
      case 'kill': this.onKill(m); return;
      case 'spawn': {
        const p = this.players[m.i];
        if (!p) return;
        Object.assign(p, { x: m.x, y: m.y, z: m.z, yaw: m.yaw, alive: true, hp: 100, step: m.step, kit: Array.isArray(m.kit) ? m.kit : [m.step] });
        if (!this.loaded) return;
        if (m.i === this.me) { this.applyKit(p.kit); this.placeLocal(p); }
        else this.makeRival(p);
        return;
      }
      case 'weapon':
        if (m.rung !== undefined && this.mine) this.mine.rung = m.rung;
        if (this.mine) this.mine.kit = Array.isArray(m.kit) ? m.kit : [m.step];
        if (this.loaded) { this.applyKit(this.mine?.kit || [m.step]); g.ui.hud.banner(m.rung === LADDER.length - 1 ? 'DERNIÈRE ARME' : `ARME ${m.rung + 1} / ${LADDER.length}`, m.step.label); g.audio.swap(); }
        return;
      case 'zcap': {
        const z = this.zones.find((x) => x.id === m.id);
        if (z) { z.owner = m.team; z.prog = 1; z.cap = null; }
        const myTeam = this.mine?.team;
        if (m.team === myTeam) g.ui.hud.toast(`ZONE ${m.id} CAPTURÉE`, '#3aff8a');
        if (Array.isArray(m.who) && m.who.includes(this.me)) this.addXp(`Capture ${m.id}`, MP_XP.capture);
        else if (m.lost === myTeam) g.ui.hud.toast(`ZONE ${m.id} PERDUE`, '#ff5a4a');
        else g.ui.hud.toast(`ZONE ${m.id} PRISE PAR L’ADVERSAIRE`, '#ff9a4a');
        g.audio.objective();
        return;
      }
      case 'join': { const p = this.players[m.i ?? m.idx]; if (p) { p.connected = true; this.pushFeed(`${p.name} a rejoint la partie`, false); } return; }
      case 'left': { const p = this.players[m.i]; if (p) { p.connected = false; p.alive = false; if (p.rival) { p.rival.remove(); p.rival = null; } this.pushFeed(`${p.name} a quitté la partie`, false); } return; }
      case 'end': this.onEnd(m); return;
    }
  }

  private onKill(m: any): void {
    const g = this.g;
    const v = this.players[m.v], k = m.k >= 0 ? this.players[m.k] : null;
    if (!v) return;
    v.alive = false;
    const wname = k ? (LETHALS[m.w]?.name || WEAPONS[m.w]?.name || '') : '';
    this.pushFeed(k ? `${k.name}  [${wname}${m.h ? ' · tête' : ''}]  ${v.name}` : `${v.name} s’est éliminé`, m.v === this.me || m.k === this.me);
    if (!this.loaded) return;
    if (m.v === this.me) {
      const p = g.player;
      p.hp = 0; p.dead = true; g.state = 'dead';
      g.ui.hud.banner('ÉLIMINÉ', k ? `par ${k.name} — réapparition dans ${this.rules.respawn} s` : `Réapparition dans ${this.rules.respawn} s`);
      g.audio.tone(110, 1.0, { type: 'sawtooth', to: 40, vol: 0.25, filter: 500 });
    } else {
      v.rival?.kill();
      if (m.k === this.me) {
        g.ui.hud.toast(`${v.name} ÉLIMINÉ`, '#3aff8a');
        const xp = MP_XP.kill + (m.h ? MP_XP.head : 0);
        this.addXp(m.h ? 'Élimination (tête)' : LETHALS[m.w] ? `Élimination (${LETHALS[m.w].name})` : 'Élimination', xp);
        if (WEAPONS[m.w]) this.wXp[m.w] = (this.wXp[m.w] || 0) + xp;
      }
      if (m.a === this.me) { g.ui.hud.toast('ASSISTANCE', '#9ad8ff'); this.addXp('Assistance', MP_XP.assist); }
    }
  }

  /** XP multijoueur gagnée (envoyée au compte en fin de partie). */
  private addXp(label: string, xp: number): void {
    this.xpEvents.push({ label, xp });
    if (this.loaded) this.g.ui.hud.pickup(`+${xp} ${label.toUpperCase()}`, '#ffd24a');
  }
  get xpTotal(): number { return this.xpEvents.reduce((a, e) => a + e.xp, 0); }

  private pushFeed(text: string, mine: boolean): void { this.feed.push({ text, t: this.now(), mine }); if (this.feed.length > 6) this.feed.shift(); }

  private onEnd(m: any): void {
    if (this.phase === 'over') return;
    const me = this.mine;
    let victory: boolean | null, title: string;
    if (typeof m.w === 'number') { victory = m.w === this.me; title = victory ? 'VICTOIRE' : 'DÉFAITE'; }
    else if (m.w === 'draw') { victory = null; title = 'ÉGALITÉ'; }
    else { victory = m.w === me?.team; title = victory ? 'VICTOIRE' : 'DÉFAITE'; }
    if (m.why !== 'forfeit' || victory) {
      this.addXp('Partie terminée', MP_XP.finish); if (victory) this.addXp('Victoire', MP_XP.win); else if (victory === null) this.addXp('Égalité', MP_XP.draw);
      const prim = this.mode !== 'duel' ? me?.kit[0]?.base : undefined;
      if (prim && WEAPONS[prim]) this.wXp[prim] = (this.wXp[prim] || 0) + WEAPON_FINISH_XP;
    }
    const sub = m.why === 'time' ? 'Temps écoulé' : m.why === 'forfeit' ? 'Les adversaires ont quitté la partie' : this.mode === 'duel' ? 'Échelle d’armes terminée' : 'Limite de score atteinte';
    this.finishLocal(victory, sub, title);
  }

  /** Fin de partie chez ce joueur : écran de résultats, retour au salon possible. */
  finishLocal(victory: boolean | null, sub: string, title?: string): void {
    if (this.phase === 'over' || this.phase === 'idle') return;
    const wasPlaying = this.loaded;
    this.phase = 'over';
    this.nades.clear();
    this.result = { title: title || (victory ? 'VICTOIRE' : victory === false ? 'DÉFAITE' : 'PARTIE INTERROMPUE'), sub, victory };
    this.closePeers();
    if (wasPlaying) this.g.finishMatch();
    else this.setStatus(sub);
  }

  // =====================================================================
  // Joueur local
  // =====================================================================

  /** Équipement du joueur local (arme principale puis secondaire). */
  private applyKit(kit: LadderStep[]): void {
    this.g.weapons.override = kit.map((step) => {
      const item = makeWeaponItem(step.base, 'common', 1);
      item.attach = { ...step.attach } as typeof item.attach;
      item.name = step.label;
      return item;
    });
    this.g.weapons.cur = 0;
    this.g.weapons.rebuild();
    const mags = this.myLoad.pk.includes('munitions') ? 7 : 5;
    for (const s of this.g.weapons.slots) s.reserve = s.st.mag * mags;
    this.g.weapons.reloadMul = this.myLoad.pk.includes('rapide') ? RELOAD_FAST : 1;
    this.g.ui.hud.weaponChanged();
  }

  private placeLocal(mp: MP): void {
    const g = this.g, p = g.player;
    p.mods = {}; p.legends = new Set(); p.maxHp = 100;
    p.spawn(_a.set(mp.x, mp.y, mp.z), mp.yaw, true);
    p.grenades = this.myLoad.n; p.godMode = true; p.lastHurt = -99;
    g.state = 'play'; g.timeScale = 1;
    if (!g.ui.blocking) g.input.lock();
  }

  private makeRival(mp: MP): void {
    const g = this.g;
    if (mp.rival) { mp.rival.remove(); const i = g.enemies.indexOf(mp.rival); if (i >= 0) g.enemies.splice(i, 1); mp.rival = null; }
    if (!mp.alive || !g.level) return;
    const myTeam = this.mine?.team ?? null;
    const friendly = !!myTeam && mp.team === myTeam;
    const r = new Rival(g, mp.x, mp.y, mp.z, mp.name, mp.team, friendly, outfitMats(mp.cos.outfit, !!mp.team));
    r.onHit = () => { this.predictedHit = 0.3; };
    g.enemies.push(r);
    mp.rival = r;
  }

  /** Tir local (WeaponSystem) : envoyé à l'hôte, qui décide. */
  onShot(o: THREE.Vector3, d: THREE.Vector3, weaponId: string): void {
    const m = { t: 'fire', w: weaponId, ox: +o.x.toFixed(3), oy: +o.y.toFixed(3), oz: +o.z.toFixed(3), dx: +d.x.toFixed(4), dy: +d.y.toFixed(4), dz: +d.z.toFixed(4) };
    if (this.isHost) this.hostFire(this.mine!, m); else this.hostPeer?.send(m);
  }
  onReload(): void {
    const w = this.g.weapons.w?.st.def.id || '';
    if (this.isHost) this.startReload(this.mine!, w); else this.hostPeer?.send({ t: 'reload', w });
  }

  /** Change la classe pour la prochaine apparition (4v4). */
  setClass(c: ClassDef): void {
    this.cls = c;
    if (this.phase !== 'playing' || this.mode === 'duel') return;
    if (this.isHost) this.mine!.pendingCls = c; else this.hostPeer?.send({ t: 'setclass', cls: c });
    this.g.ui.hud.toast(`CLASSE « ${c.name.toUpperCase()} » À LA PROCHAINE APPARITION`, '#9ad8ff');
  }

  /** Image par image (affichage). */
  frame(dt: number, simulated: boolean): void {
    if (this.predictedHit > 0) this.predictedHit -= dt;
    const g = this.g;
    if (this.active && this.loaded && g.state === 'play' && g.canAct && !g.player.dead && g.input.pressed('grenade')) this.throwNade();
    if (!this.isHost && this.active) this.nades.update(dt, (i) => this.bodyPos(i));
    this.tick(dt, simulated);
  }

  /** Équipement létal et atouts reçus de l'hôte. */
  private setLoad(m: any): void {
    this.myLoad = { n: m.n | 0, lt: typeof m.lt === 'string' && LETHALS[m.lt] ? m.lt : null, pk: Array.isArray(m.pk) ? m.pk.filter((k: unknown) => typeof k === 'string') : [] };
    if (this.loaded) this.g.player.grenades = this.myLoad.n;
  }

  /** Lancer de grenade du joueur local (l'hôte décide ; le décompte local est corrigé par sa réponse). */
  throwNade(): boolean {
    const g = this.g, p = g.player;
    if (!this.myLoad.lt || this.myLoad.n <= 0 || p.grenades <= 0) { g.audio.denied(); return false; }
    p.forward(_d);
    _o.copy(g.r.camera.position).addScaledVector(_d, 0.6);
    const m = { t: 'nade', ox: +_o.x.toFixed(3), oy: +_o.y.toFixed(3), oz: +_o.z.toFixed(3), dx: +_d.x.toFixed(4), dy: +_d.y.toFixed(4), dz: +_d.z.toFixed(4) };
    p.grenades = Math.max(0, p.grenades - 1);
    g.weapons.lower(0.3);
    if (this.isHost) this.hostNade(this.mine!, m); else { this.hostPeer?.send(m); g.audio.skill('grenadeThrow'); }
    return true;
  }

  // =====================================================================
  // Sortie
  // =====================================================================

  /** Quitter volontairement (menu pause). */
  quit(): void {
    if (this.isHost && this.phase === 'playing') {
      // l'hôte part : la partie s'arrête pour tout le monde
      this.emit({ t: 'end', w: 'draw', why: 'forfeit' });
      this.lobby?.send({ t: 'end' });
    } else this.hostPeer?.send({ t: 'quit' });
    this.finishLocal(false, 'Vous avez quitté la partie.', 'PARTIE QUITTÉE');
  }

  private closePeers(): void {
    this.ticker.stop();
    if (this.connectTimer) { clearTimeout(this.connectTimer); this.connectTimer = null; }
    const hp = this.hostPeer; this.hostPeer = null;
    if (hp) { hp.onClose = () => {}; setTimeout(() => hp.close(), 600); }
    for (const p of this.players) { const pr = p.peer; p.peer = null; if (pr) { pr.onClose = () => {}; setTimeout(() => pr.close(), 600); } }
  }

  /** Remise à zéro avant une nouvelle partie (le salon est conservé). */
  reset(): void {
    this.closePeers();
    this.players = []; this.zones = []; this.feed = []; this.teamScore = { red: 0, blue: 0 };
    this.loaded = false; this.result = null; this.phase = 'idle'; this.timeLeft = 0; this.seq = 0; this.tickN = 0; this.xpEvents = [];
    this.wXp = {}; this.myLoad = { n: 0, lt: null, pk: [] }; this.nades.clear(); this.nadeSeq = 0;
  }

  /** Hôte : replace un joueur (correction de position officielle). Sert aux tests et aux sorties de carte. */
  placeFor(idx: number, x: number, y: number, z: number): void {
    const p = this.players[idx];
    if (!this.isHost || !p) return;
    p.x = x; p.y = y; p.z = z; p.hist = []; p.lastIn = this.now();
    if (idx === this.me) { this.g.player.pos.set(x, y, z); this.g.player.vel.set(0, 0, 0); }
    else this.toPlayer(p, { t: 'pos', x, y, z });
  }

  private cosOf(id: string): Record<string, string> { return this.lobby?.room?.players.find((p) => p.id === id)?.cos || {}; }

  /** Données du tableau des scores. */
  scoreboard(): { name: string; team: TeamId | null; k: number; d: number; a: number; ping: number; me: boolean; connected: boolean; rung: number }[] {
    return this.players.map((p) => ({ name: p.name, team: p.team, k: p.k, d: p.d, a: p.a, ping: p.idx === this.me && this.isHost ? 0 : p.ping, me: p.idx === this.me, connected: p.connected || p.idx === this.me, rung: p.rung }))
      .sort((a, b) => (a.team || '').localeCompare(b.team || '') || b.k - a.k);
  }
}

export { T_INPUT };
