// Test du serveur de salons contre `wrangler dev` local (npm run dev dans server/).
// Usage : node server/test/lobby.test.mjs [http://localhost:8787]
const BASE = process.argv[2] || 'http://localhost:8787';
const ORIGIN = 'http://localhost:4173';
let pass = 0, fail = 0;
const ok = (c, label, extra = '') => { if (c) pass++; else fail++; console.log(`${c ? 'PASS' : 'FAIL'} ${label} ${extra}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function api(path, init = {}) {
  const r = await fetch(BASE + path, { ...init, headers: { Origin: ORIGIN, 'Content-Type': 'application/json', ...(init.headers || {}) } });
  return { status: r.status, body: await r.json().catch(() => null) };
}

/** Client de salon minimal : file des messages reçus. */
function client(code, name, token) {
  const ws = new WebSocket(BASE.replace('http', 'ws') + `/api/rooms/${code}/ws`, { headers: { Origin: ORIGIN } });
  const c = { ws, msgs: [], you: null, token: null, room: null, closed: null };
  ws.onmessage = (e) => { const m = JSON.parse(e.data); c.msgs.push(m); if (m.t === 'welcome') { c.you = m.you; c.token = m.token; } if (m.room) c.room = m.room; };
  ws.onclose = (e) => { c.closed = e.code; };
  c.send = (m) => ws.send(JSON.stringify(m));
  c.wait = async (pred, ms = 3000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { const m = c.msgs.find(pred); if (m) return m; await sleep(30); } return null; };
  c.open = new Promise((res, rej) => { ws.onopen = () => { c.send({ t: 'join', name, token, version: 1, build: 'test' }); res(); }; ws.onerror = rej; });
  return c;
}

// origine refusée
const bad = await fetch(BASE + '/api/rooms', { method: 'POST', headers: { Origin: 'https://exemple.invalid' } });
ok(bad.status === 403, 'création refusée depuis une origine inconnue', String(bad.status));

// création d'un salon 4v4
const created = await api('/api/rooms', { method: 'POST', body: JSON.stringify({ mode: 'tdm', map: 'chantier' }) });
ok(created.status === 201 && /^[A-Z0-9]{6}$/.test(created.body?.code), 'salon créé avec un code à 6 caractères', JSON.stringify(created.body));
const code = created.body.code;
const info = await api(`/api/rooms/${code}`);
ok(info.status === 200 && info.body.max === 8, 'informations publiques du salon', JSON.stringify(info.body));
ok((await api('/api/rooms/ZZZZZZ')).status === 404, 'salon inconnu : 404');

// 4 joueurs
const P = [client(code, 'Alpha'), client(code, 'Bravo'), client(code, 'Charlie'), client(code, 'Delta')];
for (const p of P) { await p.open; await p.wait((m) => m.t === 'welcome'); }
await sleep(300);
const room = P[0].room;
ok(room.players.length === 4 && room.players[0].host, '4 joueurs, le premier est hôte', room.players.map((p) => `${p.name}:${p.team}`).join(' '));
ok(room.players.filter((p) => p.team === 'red').length === 2, 'équipes équilibrées automatiquement (2 contre 2)');

// lancement refusé tant que tout le monde n'est pas prêt
P[0].send({ t: 'start' });
const err = await P[0].wait((m) => m.t === 'error');
ok(!!err && /prêts/.test(err.msg), 'lancement refusé : joueurs pas prêts', err?.msg);

// un non-hôte ne peut pas changer les équipes
P[1].send({ t: 'team', id: P[2].you, team: 'red' });
await sleep(300);
ok(P[0].room.players.find((p) => p.id === P[2].you).team !== 'red' || P[0].room.players.find((p) => p.id === P[2].you).team === room.players.find((p) => p.id === P[2].you).team, 'un joueur qui n’est pas l’hôte ne modifie pas les équipes');

// signalisation : relais d'un message de P1 vers P0
P[1].send({ t: 'signal', to: P[0].you, data: { kind: 'offer', sdp: 'v=0 test' } });
const sig = await P[0].wait((m) => m.t === 'signal');
ok(sig && sig.from === P[1].you && sig.data.sdp === 'v=0 test', 'signalisation WebRTC relayée entre deux joueurs');

// déconnexion puis reconnexion avec le jeton
const tokenC = P[2].token, idC = P[2].you;
P[2].ws.close();
await sleep(400);
ok(P[0].room.players.find((p) => p.id === idC)?.connected === false, 'joueur déconnecté : place conservée');
const C2 = client(code, 'Charlie', tokenC); await C2.open;
const w = await C2.wait((m) => m.t === 'welcome');
ok(w && w.you === idC, 'reconnexion avec le jeton : même joueur', w?.you);
P[2] = C2;

// tout le monde prêt, lancement
for (const p of P.slice(1)) p.send({ t: 'ready', v: true });
await sleep(400);
P[0].send({ t: 'start' });
const starts = await Promise.all(P.map((p) => p.wait((m) => m.t === 'start')));
ok(starts.every((s) => s && s.host === P[0].you), 'lancement par l’hôte reçu par les 4 joueurs');

// pendant la partie, un nouveau venu est refusé
const late = client(code, 'Echo'); await late.open;
const lateErr = await late.wait((m) => m.t === 'error');
ok(!!lateErr && /en cours/.test(lateErr.msg), 'nouveau joueur refusé pendant la partie', lateErr?.msg);

// fin de partie : retour au salon, statut prêt réinitialisé
P[0].send({ t: 'end' });
const ends = await Promise.all(P.map((p) => p.wait((m) => m.t === 'end')));
ok(ends.every(Boolean) && ends[0].room.phase === 'lobby' && ends[0].room.players.every((p) => !p.ready), 'retour au salon, statuts prêts remis à zéro');

// l'hôte quitte le salon : un autre joueur devient hôte
P[0].ws.close();
await sleep(500);
ok(P[1].room.players.find((p) => p.host)?.id !== P[0].you, 'départ de l’hôte : un autre joueur devient hôte', P[1].room.players.find((p) => p.host)?.name);

// salon complet (duel : 2 places)
const duel = await api('/api/rooms', { method: 'POST', body: JSON.stringify({ mode: 'duel' }) });
const D = [client(duel.body.code, 'A'), client(duel.body.code, 'B')];
for (const d of D) { await d.open; await d.wait((m) => m.t === 'welcome'); }
const third = client(duel.body.code, 'C'); await third.open;
const full = await third.wait((m) => m.t === 'error');
ok(!!full && /complet/.test(full.msg), 'duel : troisième joueur refusé (salon complet)', full?.msg);

const health = await api('/api/health');
ok(health.body.rooms >= 2 && health.body.joins >= 7, 'compteurs du garde-fou à jour', JSON.stringify(health.body));

for (const c of [...P, ...D, third, late]) try { c.ws.close(); } catch { /* */ }
console.log(`\n${pass} réussis, ${fail} échoués`);
process.exit(fail ? 1 : 0);
