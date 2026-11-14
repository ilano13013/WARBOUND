// Matchmaking public contre `wrangler dev` local : partie rapide, salle partagée, lancement automatique.
const BASE = process.argv[2] || 'http://localhost:8787';
const ORIGIN = 'http://localhost:4174';
let pass = 0, fail = 0;
const ok = (c, label, extra = '') => { if (c) pass++; else fail++; console.log(`${c ? 'PASS' : 'FAIL'} ${label} ${extra}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const quick = async (mode) => { const r = await fetch(BASE + '/api/quickplay', { method: 'POST', headers: { Origin: ORIGIN, 'Content-Type': 'application/json' }, body: JSON.stringify({ mode }) }); return { status: r.status, body: await r.json() }; };
function client(code, name) {
  const ws = new WebSocket(BASE.replace('http', 'ws') + `/api/rooms/${code}/ws`, { headers: { Origin: ORIGIN } });
  const c = { ws, msgs: [], room: null };
  ws.onmessage = (e) => { const m = JSON.parse(e.data); c.msgs.push(m); if (m.room) c.room = m.room; };
  c.wait = async (pred, ms = 5000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { const m = c.msgs.find(pred); if (m) return m; await sleep(50); } return null; };
  c.open = new Promise((res) => { ws.onopen = () => { ws.send(JSON.stringify({ t: 'join', name, version: 1, build: 'test' })); res(); }; });
  return c;
}

// duel : deux joueurs envoyés dans la même salle, lancement 3 s après qu'elle est pleine
const a = await quick('duel');
ok(a.status === 201 && a.body.created, 'partie rapide 1v1 : nouvelle salle publique', JSON.stringify(a.body));
const A = client(a.body.code, 'Alpha'); await A.open; await A.wait((m) => m.t === 'welcome');
ok(A.room.pub && A.room.startIn > 10000, 'salle publique avec compte à rebours', `${Math.round(A.room.startIn / 1000)} s`);
const b = await quick('duel');
ok(b.body.code === a.body.code && !b.body.created, 'le deuxième joueur rejoint la même salle', JSON.stringify(b.body));
const B = client(b.body.code, 'Bravo'); await B.open; await B.wait((m) => m.t === 'welcome');
await sleep(300);
ok(B.room.startIn !== null && B.room.startIn <= 3100, 'salle pleine : lancement dans 3 s', `${B.room.startIn} ms`);
const t0 = Date.now();
const [sa, sb] = await Promise.all([A.wait((m) => m.t === 'start', 8000), B.wait((m) => m.t === 'start', 8000)]);
ok(!!sa && !!sb, 'lancement automatique reçu par les deux joueurs, sans statut « prêt »', `${((Date.now() - t0) / 1000).toFixed(1)} s`);
const c = await quick('duel');
ok(c.body.code !== a.body.code, 'partie en cours : un nouveau joueur va dans une autre salle');

// 4v4 : un joueur seul, lancement à la fin du compte à rebours (les bots compléteront côté jeu)
const d = await quick('tdm');
const D = client(d.body.code, 'Delta'); await D.open; await D.wait((m) => m.t === 'welcome');
const left = D.room.startIn;
const sd = await D.wait((m) => m.t === 'start', left + 6000);
ok(!!sd && sd.room.players.length === 1, 'joueur seul en 4v4 : lancement automatique à la fin du compte à rebours', `${Math.round(left / 1000)} s d'attente`);
// fin de partie : la salle repasse en attente et se réarme
D.ws.send(JSON.stringify({ t: 'end' }));
const ed = await D.wait((m) => m.t === 'end', 4000);
ok(!!ed && ed.room.phase === 'lobby' && ed.room.startIn > 0, 'après la partie : retour en attente avec un nouveau compte à rebours');

for (const x of [A, B, D]) x.ws.close();
console.log(`\n${pass} réussis, ${fail} échoués`);
process.exit(fail ? 1 : 0);
