// Client du serveur de salons (Cloudflare Worker + Durable Object, dossier server/).
// L'adresse du serveur vient de VITE_LOBBY_URL au moment de la construction ; sans elle, les salons en ligne
// sont désactivés et seul le duel par codes manuels reste disponible.
import { PROTOCOL_VERSION, type ClientMsg, type ModeId, type RoomView, type ServerMsg } from './lobbyProtocol';
import { BUILD } from '../render/Renderer';

export const LOBBY_URL: string = (import.meta.env.VITE_LOBBY_URL as string | undefined)?.replace(/\/$/, '') || '';
const TOKEN_KEY = 'wb-lobby-token:';

export class LobbyClient {
  ws: WebSocket | null = null;
  you = '';
  room: RoomView | null = null;
  closed = false;
  onRoom: (r: RoomView) => void = () => {};
  onStart: (host: string, r: RoomView) => void = () => {};
  onEnd: (r: RoomView) => void = () => {};
  onSignal: (from: string, data: any) => void = () => {};
  onError: (msg: string, fatal: boolean) => void = () => {};
  onClose: () => void = () => {};
  private retries = 0;
  private pingT: number | null = null;

  constructor(public code: string, private name: string, private acct: string | null = null) {}

  static available(): boolean { return !!LOBBY_URL; }

  /** Crée un salon et renvoie son code. */
  static async create(mode: ModeId, map?: string): Promise<string> {
    const r = await fetch(`${LOBBY_URL}/api/rooms`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode, map }) });
    const body = await r.json().catch(() => ({}));
    if (!r.ok || !body.code) throw new Error(body.error || `Serveur de salons indisponible (${r.status}).`);
    return body.code as string;
  }

  /** Lien d'invitation à partager. */
  static link(code: string): string { const u = new URL(location.href); u.search = `?salon=${code}`; u.hash = ''; return u.toString(); }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const url = LOBBY_URL.replace(/^http/, 'ws') + `/api/rooms/${this.code}/ws`;
      let ws: WebSocket;
      try { ws = new WebSocket(url); } catch (e) { reject(e); return; }
      this.ws = ws;
      let welcomed = false;
      ws.onopen = () => {
        let token: string | undefined;
        try { token = sessionStorage.getItem(TOKEN_KEY + this.code) || undefined; } catch { /* stockage indisponible */ }
        this.send({ t: 'join', name: this.name, token, acct: this.acct || undefined, version: PROTOCOL_VERSION, build: BUILD });
      };
      ws.onmessage = (e) => {
        let m: ServerMsg;
        try { m = JSON.parse(String(e.data)); } catch { return; }
        switch (m.t) {
          case 'welcome':
            this.you = m.you; this.room = m.room; welcomed = true; this.retries = 0;
            try { sessionStorage.setItem(TOKEN_KEY + this.code, m.token); } catch { /* */ }
            this.onRoom(m.room); resolve(); break;
          case 'room': this.room = m.room; this.onRoom(m.room); break;
          case 'start': this.room = m.room; this.onStart(m.host, m.room); break;
          case 'end': this.room = m.room; this.onEnd(m.room); break;
          case 'signal': this.onSignal(m.from, m.data); break;
          case 'error': if (!welcomed && m.fatal) reject(new Error(m.msg)); this.onError(m.msg, !!m.fatal); if (m.fatal) this.closed = true; break;
        }
      };
      ws.onclose = () => {
        if (this.pingT) { clearInterval(this.pingT); this.pingT = null; }
        if (!welcomed) { reject(new Error('Connexion au salon impossible.')); return; }
        if (this.closed) { this.onClose(); return; }
        // coupure : reconnexion automatique avec le jeton (3 essais)
        if (this.retries++ < 3) setTimeout(() => { if (!this.closed) this.connect().catch(() => this.onClose()); }, 800 * this.retries);
        else this.onClose();
      };
      // maintien : un ping toutes les 25 s (en dessous des délais d'inactivité des proxys)
      this.pingT = window.setInterval(() => this.send({ t: 'ping', n: Date.now() }), 25_000);
    });
  }

  send(m: ClientMsg): void { if (this.ws && this.ws.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(m)); }
  signal(to: string, data: unknown): void { this.send({ t: 'signal', to, data }); }

  leave(): void {
    this.closed = true;
    try { sessionStorage.removeItem(TOKEN_KEY + this.code); } catch { /* */ }
    if (this.pingT) { clearInterval(this.pingT); this.pingT = null; }
    try { this.ws?.close(1000, 'départ'); } catch { /* */ }
  }

  get isHost(): boolean { return !!this.room?.players.find((p) => p.id === this.you)?.host; }
}
