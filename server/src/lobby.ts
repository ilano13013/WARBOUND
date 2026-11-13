// Salon WARBOUND : un Durable Object par code de salon.
// Rôle : liste des joueurs, équipes, statut prêt, choix du mode et de la carte, lancement par l'hôte,
// relais de la signalisation WebRTC, reconnexion par jeton, expiration automatique.
// Les WebSockets utilisent l'API d'hibernation : l'objet est évincé de la mémoire entre deux messages,
// la durée facturable reste donc quasi nulle (offre gratuite : 13 000 Go·s par jour).
import { DurableObject } from 'cloudflare:workers';
import { playerFromToken, verifiedCosmetics, type AccountEnv } from './accounts';
import { MODES, PROTOCOL_VERSION, type ClientMsg, type ModeId, type PlayerView, type RoomView, type ServerMsg, type Team } from './protocol';

interface PlayerRec { id: string; name: string; team: Team; ready: boolean; tokenHash: string; joinedAt: number; leftAt: number | null; badge: string | null; cos?: Record<string, string> }
interface RoomRec { code: string; mode: ModeId; map: string; phase: 'lobby' | 'playing'; hostId: string | null; createdAt: number; lastActive: number; players: PlayerRec[] }
interface Attach { id: string | null }

const IDLE_MS = 30 * 60_000;          // salon sans activité : fermé après 30 min
const EMPTY_MS = 10 * 60_000;         // salon sans aucun joueur connecté : fermé après 10 min
const GRACE_LOBBY_MS = 60_000;        // un joueur déconnecté garde sa place 60 s dans le salon
const GRACE_GAME_MS = 120_000;        // ... et 120 s pendant une partie (reconnexion)
const MAX_SIGNAL = 16_384;            // taille maximale d'un message de signalisation (octets)
const NAME_RE = /[^\p{L}\p{N} _\-.'’]/gu;

async function sha256(s: string): Promise<string> {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return Array.from(new Uint8Array(d), (b) => b.toString(16).padStart(2, '0')).join('');
}
function randomId(bytes: number): string {
  const b = new Uint8Array(bytes); crypto.getRandomValues(b);
  return Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
}

export class Lobby extends DurableObject<AccountEnv> {
  private room: RoomRec | null = null;

  constructor(ctx: DurableObjectState, env: AccountEnv) {
    super(ctx, env);
    ctx.blockConcurrencyWhile(async () => { this.room = (await ctx.storage.get<RoomRec>('room')) || null; });
  }

  // ---------- appels du Worker ----------

  async init(code: string, mode: ModeId, map: string): Promise<boolean> {
    if (this.room) return false;
    const now = Date.now();
    this.room = { code, mode, map, phase: 'lobby', hostId: null, createdAt: now, lastActive: now, players: [] };
    await this.save();
    await this.ctx.storage.setAlarm(now + EMPTY_MS);
    return true;
  }

  async info(): Promise<{ code: string; mode: ModeId; map: string; max: number; players: number; phase: string } | null> {
    const r = this.room;
    if (!r) return null;
    return { code: r.code, mode: r.mode, map: r.map, max: MODES[r.mode].max, players: r.players.length, phase: r.phase };
  }

  async fetch(req: Request): Promise<Response> {
    if (!this.room) return new Response('Salon introuvable ou expiré.', { status: 404 });
    if (req.headers.get('Upgrade') !== 'websocket') return new Response('WebSocket attendu.', { status: 426 });
    const pair = new WebSocketPair();
    this.ctx.acceptWebSocket(pair[1]);
    pair[1].serializeAttachment({ id: null } satisfies Attach);
    return new Response(null, { status: 101, webSocket: pair[0] });
  }

  // ---------- WebSockets (hibernation) ----------

  async webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer): Promise<void> {
    const r = this.room;
    if (!r) { this.send(ws, { t: 'error', msg: 'Salon expiré.', fatal: true }); ws.close(4004, 'expiré'); return; }
    if (typeof raw !== 'string' || raw.length > MAX_SIGNAL + 512) return;
    let m: ClientMsg;
    try { m = JSON.parse(raw); } catch { return; }
    r.lastActive = Date.now();
    const att = (ws.deserializeAttachment() || { id: null }) as Attach;
    if (!att.id) {
      if (m.t === 'join') await this.join(ws, m);
      return;
    }
    const me = r.players.find((p) => p.id === att.id);
    if (!me) { ws.close(4003, 'retiré'); return; }
    const isHost = r.hostId === me.id;
    switch (m.t) {
      case 'ping': this.send(ws, { t: 'pong', n: m.n }); return;
      case 'signal': {
        const data = JSON.stringify(m.data ?? null);
        if (data.length > MAX_SIGNAL) return;
        const target = this.socketOf(String(m.to));
        if (target) this.send(target, { t: 'signal', from: me.id, data: m.data });
        return;
      }
      case 'ready':
        if (r.phase !== 'lobby') return;
        me.ready = !!m.v; break;
      case 'team':
        if (!isHost || r.phase !== 'lobby' || !MODES[r.mode].teams || (m.team !== 'red' && m.team !== 'blue')) return;
        { const p = r.players.find((x) => x.id === m.id); if (!p) return; p.team = m.team; }
        break;
      case 'balance':
        if (!isHost || r.phase !== 'lobby') return;
        this.balance(); break;
      case 'config': {
        if (!isHost || r.phase !== 'lobby' || !(m.mode in MODES)) return;
        const def = MODES[m.mode];
        if (r.players.length > def.max) { this.send(ws, { t: 'error', msg: `Trop de joueurs pour ce mode (${def.max} au maximum).` }); return; }
        r.mode = m.mode; r.map = def.maps.includes(m.map) ? m.map : def.maps[0];
        for (const p of r.players) p.ready = false;
        this.balance(); break;
      }
      case 'start': {
        if (!isHost || r.phase !== 'lobby') return;
        const err = this.canStart();
        if (err) { this.send(ws, { t: 'error', msg: err }); return; }
        r.phase = 'playing';
        await this.save();
        this.broadcast({ t: 'start', host: r.hostId!, room: this.view() });
        return;
      }
      case 'end':
        if (!isHost || r.phase !== 'playing') return;
        r.phase = 'lobby';
        for (const p of r.players) p.ready = false;
        await this.save();
        this.broadcast({ t: 'end', room: this.view() });
        return;
      default: return;
    }
    await this.save();
    this.broadcastRoom();
  }

  async webSocketClose(ws: WebSocket): Promise<void> { await this.left(ws); }
  async webSocketError(ws: WebSocket): Promise<void> { await this.left(ws); }

  /** Ménage périodique : joueurs partis depuis trop longtemps, salon vide ou inactif. */
  async alarm(): Promise<void> {
    const r = this.room;
    if (!r) return;
    const now = Date.now();
    const connected = this.connectedIds();
    const grace = r.phase === 'playing' ? GRACE_GAME_MS : GRACE_LOBBY_MS;
    const before = r.players.length;
    r.players = r.players.filter((p) => connected.has(p.id) || (p.leftAt !== null && now - p.leftAt < grace));
    if (r.hostId && !r.players.some((p) => p.id === r.hostId)) this.pickHost();
    const empty = connected.size === 0 && now - r.lastActive > EMPTY_MS;
    if (empty || now - r.lastActive > IDLE_MS) { await this.expire(); return; }
    if (r.players.length !== before) { await this.save(); this.broadcastRoom(); }
    await this.ctx.storage.setAlarm(now + (r.players.some((p) => p.leftAt !== null) ? 15_000 : 60_000));
  }

  // ---------- logique ----------

  private async join(ws: WebSocket, m: Extract<ClientMsg, { t: 'join' }>): Promise<void> {
    const r = this.room!;
    if (m.version !== PROTOCOL_VERSION) { this.send(ws, { t: 'error', msg: 'Version du jeu différente de celle du serveur : rechargez la page.', fatal: true }); ws.close(4001, 'version'); return; }
    const name = String(m.name || 'Opérateur').replace(NAME_RE, '').trim().slice(0, 20) || 'Opérateur';
    let p: PlayerRec | undefined;
    // reconnexion : le jeton prouve qu'il s'agit du même joueur
    if (m.token) {
      const h = await sha256(String(m.token));
      p = r.players.find((x) => x.tokenHash === h);
      if (p) { for (const old of this.socketsOf(p.id)) old.close(4002, 'remplacé'); p.leftAt = null; }
    }
    let token = '';
    if (!p) {
      if (r.phase === 'playing') { this.send(ws, { t: 'error', msg: 'Une partie est en cours dans ce salon. Réessayez à la fin de la manche.', fatal: true }); ws.close(4005, 'en cours'); return; }
      if (r.players.length >= MODES[r.mode].max) { this.send(ws, { t: 'error', msg: 'Salon complet.', fatal: true }); ws.close(4006, 'complet'); return; }
      token = randomId(18);
      p = { id: randomId(4), name, team: null, ready: false, tokenHash: await sha256(token), joinedAt: Date.now(), leftAt: null, badge: null };
      r.players.push(p);
      if (MODES[r.mode].teams) p.team = this.smallerTeam();
    } else token = String(m.token);
    // compte joueur facultatif : badge et cosmétiques lus dans la base des achats
    if (m.acct && this.env.DB) {
      try {
        const acc = await playerFromToken(this.env, String(m.acct));
        if (acc) { const c = await verifiedCosmetics(this.env, acc.id); p.badge = c.badge; p.cos = c.equipped; }
      } catch { /* base indisponible : on joue sans cosmétiques */ }
    }
    if (!r.hostId) r.hostId = p.id;
    ws.serializeAttachment({ id: p.id } satisfies Attach);
    await this.save();
    this.send(ws, { t: 'welcome', you: p.id, token, room: this.view() });
    this.broadcastRoom(ws);
  }

  private async left(ws: WebSocket): Promise<void> {
    const r = this.room;
    const att = ws.deserializeAttachment() as Attach | null;
    if (!r || !att?.id) return;
    if (this.socketsOf(att.id).some((s) => s !== ws)) return; // une autre connexion du même joueur est active
    const p = r.players.find((x) => x.id === att.id);
    if (!p) return;
    p.leftAt = Date.now();
    if (r.phase === 'lobby') p.ready = false;
    // dans le salon, l'hôte parti est remplacé tout de suite ; en partie, la reconnexion reste possible
    if (r.phase === 'lobby' && r.hostId === p.id) this.pickHost(p.id);
    await this.save();
    this.broadcastRoom();
    await this.ctx.storage.setAlarm(Date.now() + 15_000);
  }

  private canStart(): string | null {
    const r = this.room!, def = MODES[r.mode];
    const conn = this.connectedIds();
    const players = r.players.filter((p) => conn.has(p.id));
    if (players.length < def.min) return `Il faut au moins ${def.min} joueurs connectés.`;
    if (players.length !== r.players.length) return 'Un joueur est déconnecté : attendez son retour ou qu’il quitte le salon.';
    if (players.some((p) => p.id !== r.hostId && !p.ready)) return 'Tous les joueurs doivent être prêts.';
    if (def.teams) {
      const red = players.filter((p) => p.team === 'red').length, blue = players.filter((p) => p.team === 'blue').length;
      if (!red || !blue) return 'Chaque équipe doit compter au moins un joueur.';
      if (Math.abs(red - blue) > 1) return 'Équipes déséquilibrées : utilisez « Équilibrer ».';
    }
    return null;
  }

  private smallerTeam(): 'red' | 'blue' {
    const r = this.room!;
    const red = r.players.filter((p) => p.team === 'red').length, blue = r.players.filter((p) => p.team === 'blue').length;
    return red <= blue ? 'red' : 'blue';
  }

  /** Répartition alternée par ordre d'arrivée (équipes à un joueur d'écart au plus). */
  private balance(): void {
    const r = this.room!;
    const teams = MODES[r.mode].teams;
    r.players.sort((a, b) => a.joinedAt - b.joinedAt).forEach((p, i) => { p.team = teams ? (i % 2 === 0 ? 'red' : 'blue') : null; });
  }

  private pickHost(except?: string): void {
    const r = this.room!, conn = this.connectedIds();
    const next = r.players.filter((p) => p.id !== except && conn.has(p.id)).sort((a, b) => a.joinedAt - b.joinedAt)[0];
    r.hostId = next ? next.id : null;
  }

  private async expire(): Promise<void> {
    for (const ws of this.ctx.getWebSockets()) { this.send(ws, { t: 'error', msg: 'Salon fermé pour inactivité.', fatal: true }); ws.close(4004, 'expiré'); }
    this.room = null;
    await this.ctx.storage.deleteAll();
  }

  // ---------- utilitaires ----------

  /** Sockets ouvertes (une socket en cours de fermeture reste listée pendant webSocketClose). */
  private open(): WebSocket[] { return this.ctx.getWebSockets().filter((ws) => ws.readyState === 1); }
  private connectedIds(): Set<string> {
    const s = new Set<string>();
    for (const ws of this.open()) { const a = ws.deserializeAttachment() as Attach | null; if (a?.id) s.add(a.id); }
    return s;
  }
  private socketsOf(id: string): WebSocket[] { return this.open().filter((ws) => (ws.deserializeAttachment() as Attach | null)?.id === id); }
  private socketOf(id: string): WebSocket | null { return this.socketsOf(id)[0] || null; }

  private view(): RoomView {
    const r = this.room!, conn = this.connectedIds();
    const players: PlayerView[] = r.players.map((p) => ({ id: p.id, name: p.name, team: p.team, ready: p.ready, connected: conn.has(p.id), host: p.id === r.hostId, badge: p.badge, cos: p.cos || {} }));
    return { code: r.code, mode: r.mode, map: r.map, max: MODES[r.mode].max, phase: r.phase, players, version: PROTOCOL_VERSION };
  }

  private send(ws: WebSocket, m: ServerMsg): void { try { ws.send(JSON.stringify(m)); } catch { /* socket fermée */ } }
  private broadcast(m: ServerMsg, except?: WebSocket): void {
    const s = JSON.stringify(m);
    for (const ws of this.open()) { if (ws === except || !(ws.deserializeAttachment() as Attach | null)?.id) continue; try { ws.send(s); } catch { /* */ } }
  }
  private broadcastRoom(except?: WebSocket): void { this.broadcast({ t: 'room', room: this.view() }, except); }
  private async save(): Promise<void> { if (this.room) await this.ctx.storage.put('room', this.room); }
}
