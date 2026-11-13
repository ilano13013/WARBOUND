// Point d'entrée du Worker : API des salons WARBOUND.
//   GET  /api/health                    état du service (et des garde-fous)
//   POST /api/rooms                     crée un salon { mode, map } -> { code }
//   GET  /api/rooms/:code               informations publiques d'un salon (existe, mode, places)
//   GET  /api/rooms/:code/ws            WebSocket du salon (joueurs, équipes, prêt, signalisation WebRTC)
// La partie elle-même se joue en WebRTC entre les navigateurs : le serveur ne voit passer que le salon
// et l'établissement des connexions, ce qui garde la consommation très en dessous des quotas gratuits.
import { Lobby } from './lobby';
import { Guard } from './guard';
import { MODES, ROOM_CODE_RE, newRoomCode, type ModeId } from './protocol';

export { Lobby, Guard };

export interface Env {
  LOBBY: DurableObjectNamespace<Lobby>;
  GUARD: DurableObjectNamespace<Guard>;
  ALLOWED_ORIGINS: string;
  MAX_ROOMS_PER_DAY: string;
  MAX_JOINS_PER_DAY: string;
  MAX_ROOMS_PER_IP_PER_HOUR: string;
}

function cors(origin: string | null, env: Env): Record<string, string> {
  const ok = !!origin && env.ALLOWED_ORIGINS.split(',').map((s) => s.trim()).includes(origin);
  return ok ? { 'Access-Control-Allow-Origin': origin!, 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', Vary: 'Origin' } : {};
}

function json(data: unknown, status: number, headers: Record<string, string>): Response {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers } });
}

const guard = (env: Env) => env.GUARD.get(env.GUARD.idFromName('global'));

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    const origin = req.headers.get('Origin');
    const h = cors(origin, env);
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: h });
    const allowed = Object.keys(h).length > 0;
    const ip = req.headers.get('CF-Connecting-IP') || 'local';

    if (url.pathname === '/api/health') {
      const s = await guard(env).status();
      return json({ ok: true, ...s }, 200, h);
    }

    if (url.pathname === '/api/rooms' && req.method === 'POST') {
      if (!allowed) return json({ error: 'Origine non autorisée.' }, 403, h);
      let body: { mode?: string; map?: string } = {};
      try { body = await req.json(); } catch { /* corps vide : valeurs par défaut */ }
      const mode = (body.mode && body.mode in MODES ? body.mode : 'duel') as ModeId;
      const map = MODES[mode].maps.includes(String(body.map)) ? String(body.map) : MODES[mode].maps[0];
      const verdict = await guard(env).allowRoom(ip, Number(env.MAX_ROOMS_PER_DAY), Number(env.MAX_ROOMS_PER_IP_PER_HOUR));
      if (!verdict.ok) return json({ error: verdict.reason }, 429, h);
      // code unique : en cas de collision (très rare), on retire un code
      for (let i = 0; i < 5; i++) {
        const code = newRoomCode();
        const stub = env.LOBBY.get(env.LOBBY.idFromName(code));
        if (await stub.init(code, mode, map)) return json({ code, mode, map }, 201, h);
      }
      return json({ error: 'Impossible de créer le salon, réessayez.' }, 503, h);
    }

    const m = url.pathname.match(/^\/api\/rooms\/([A-Z0-9]+)(\/ws)?$/);
    if (m && ROOM_CODE_RE.test(m[1])) {
      const stub = env.LOBBY.get(env.LOBBY.idFromName(m[1]));
      if (!m[2]) {
        const info = await stub.info();
        return info ? json(info, 200, h) : json({ error: 'Salon introuvable ou expiré.' }, 404, h);
      }
      if (req.headers.get('Upgrade') !== 'websocket') return json({ error: 'WebSocket attendu.' }, 426, h);
      if (!allowed) return new Response('Origine non autorisée.', { status: 403 });
      const verdict = await guard(env).allowJoin(Number(env.MAX_JOINS_PER_DAY));
      if (!verdict.ok) return new Response(verdict.reason, { status: 429 });
      return stub.fetch(req);
    }

    return json({ error: 'Introuvable.' }, 404, h);
  },
} satisfies ExportedHandler<Env>;
