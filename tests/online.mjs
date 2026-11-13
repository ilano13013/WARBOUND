// Multijoueur en ligne de bout en bout : serveur de salons local (wrangler dev) + 4 navigateurs.
// Prérequis : `cd server && npm run dev` (port 8787) et une version du jeu construite avec
// VITE_LOBBY_URL=http://localhost:8787 servie sur le port 4174 (voir TESTS.md).
// Vérifie : salon, équipes, lancement, connexions en étoile, tir allié désactivé, élimination validée par l'hôte,
// scores et fil des éliminations chez tous, réapparition, refus d'un tir trop rapide et d'une téléportation,
// fin de partie (victoire / défaite), retour au salon, puis Domination (capture et points).
import { chromium, sleep, SHOTS } from './lib.mjs';

const URL = process.env.WB_ONLINE_URL || 'http://localhost:4174/?autotest';
let pass = 0, fail = 0;
const ok = (c, label, extra = '') => { if (c) pass++; else fail++; console.log(`${c ? 'PASS' : 'FAIL'} ${label} ${extra}`); };

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-features=WebRtcHideLocalIpsWithMdns'] });
const errors = [];
async function page(name, cls) {
  const ctx = await browser.newContext({ viewport: { width: 480, height: 270 } });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errors.push(`${name} pageerror: ${e.message}`));
  p.on('console', (m) => { if (m.type() === 'error' && !/WebSocket|ERR_|404/.test(m.text())) errors.push(`${name} console: ${m.text()}`); });
  await p.goto(URL);
  await p.waitForFunction(() => window.WB && window.WB.game.state === 'menu', null, { timeout: 120000 });
  await p.evaluate(() => window.WB.quality('low'));
  await p.evaluate(([c, n]) => window.WB.newGame(c, n), [cls, name]);
  await p.waitForFunction(() => window.WB.state().level === 'hub' && window.WB.state().state === 'play', null, { timeout: 120000 });
  await p.evaluate(() => window.WB.game.toMenu());
  return p;
}
const names = ['Alpha', 'Bravo', 'Charlie', 'Delta'];
const P = [];
for (const [i, n] of names.entries()) P.push(await page(n, ['vanguard', 'wraith', 'bulwark', 'ranger'][i]));
const [A, B, C, D] = P;
const ms = (p) => p.evaluate(() => window.WB.matchState());
const waitAll = (fn, ms = 60000) => Promise.all(P.map((p) => p.waitForFunction(fn, null, { timeout: ms, polling: 250 })));

// ---------- salon ----------
await A.evaluate(() => window.WB.matchRules({ score: 3, time: 240 }));
const code = await A.evaluate(() => window.WB.online('tdm'));
ok(/^[A-Z0-9]{6}$/.test(code), 'salon 4v4 créé', code);
await A.waitForFunction(() => window.WB.onlineRoom()?.players.length === 1, null, { timeout: 20000 });
for (const p of [B, C, D]) { await p.evaluate((c) => window.WB.onlineJoin(c), code); await p.waitForFunction(() => !!window.WB.onlineRoom(), null, { timeout: 20000 }); }
await A.waitForFunction(() => window.WB.onlineRoom()?.players.length === 4, null, { timeout: 20000 });
const room = await A.evaluate(() => window.WB.onlineRoom());
ok(room.host && room.players.filter((p) => p.team === 'red').length === 2, '4 joueurs, équipes 2 contre 2, Alpha hôte', room.players.map((p) => `${p.name}:${p.team}`).join(' '));
await A.evaluate(() => document.querySelector('[data-a="start"]')?.click());
await sleep(800);
for (const p of [B, C, D]) await p.evaluate(() => window.WB.onlineReady());
await A.waitForFunction(() => window.WB.onlineRoom()?.players.every((p) => p.ready || p.host), null, { timeout: 20000 });
await A.evaluate(() => window.WB.onlineStart());
await waitAll(() => { const s = window.WB.matchState(); return s.phase === 'playing' && s.level === 'duel' && s.state !== 'menu'; }, 90000);
ok(true, 'partie lancée : les 4 joueurs sont dans l’arène (connexions WebRTC en étoile)');
let a = await ms(A);
const idx = Object.fromEntries(a.players.map((p) => [p.name, p.idx]));
const team = Object.fromEntries(a.players.map((p) => [p.name, p.team]));
ok(a.players.every((p) => p.conn), 'l’hôte est relié aux 3 autres joueurs');
const mate = names.find((n) => n !== 'Alpha' && team[n] === team.Alpha), foe = names.find((n) => team[n] !== team.Alpha);
ok(a.players.find((p) => p.name === mate).friendly && !a.players.find((p) => p.name === foe).friendly, 'allié et ennemi identifiés', `allié ${mate}, ennemi ${foe}`);
await sleep(2500); // fin de la protection d'apparition

// ---------- tir allié désactivé ----------
const fireAt = async (who, targetName, maxMs = 15000) => {
  await A.evaluate(([i, x, z]) => window.WB.matchPlace(i, x, 0.1, z), [idx[targetName], 3, 12.6]);
  await A.evaluate(() => { window.WB.tp(12, 0.1, 12.6, Math.PI / 2); window.WB.look(Math.PI / 2, -0.06); });
  await sleep(900);
  const t0 = Date.now();
  while (Date.now() - t0 < maxMs) {
    await A.evaluate(() => { window.WB.look(Math.PI / 2, -0.06); window.WB.fire(true); });
    await sleep(120);
    const s = await ms(A);
    const t = s.players.find((p) => p.name === targetName);
    if (!t.alive) break;
  }
  await A.evaluate(() => window.WB.fire(false));
};
await fireAt('Alpha', mate, 2500);
a = await ms(A);
ok(a.players.find((p) => p.name === mate).hp === 100, 'tir allié : aucun dégât sur le coéquipier', `santé ${a.players.find((p) => p.name === mate).hp}`);
await A.evaluate(([i]) => window.WB.matchPlace(i, -20, 0.1, -10), [idx[mate]]);

// ---------- élimination validée par l'hôte ----------
await fireAt('Alpha', foe);
await sleep(800);
const states = await Promise.all(P.map(ms));
ok(states.every((s) => s.score[team.Alpha] === 1), 'élimination comptée chez les 4 joueurs', states.map((s) => s.score[team.Alpha]).join(','));
ok(states.every((s) => s.feed.some((f) => f.includes('Alpha') && f.includes(foe))), 'fil des éliminations reçu par tous');
const foePage = P[names.indexOf(foe)];
ok((await ms(foePage)).me.dead, 'la victime est morte chez elle');
await foePage.waitForFunction(() => !window.WB.matchState().me.dead, null, { timeout: 10000 }).then(() => ok(true, 'réapparition de la victime après 3 s'), () => ok(false, 'réapparition de la victime après 3 s'));

// ---------- anti-triche : cadence et téléportation ----------
const cheater = P[names.indexOf(names.find((n) => team[n] !== team.Alpha && n !== foe) || foe)];
const cheaterName = names[P.indexOf(cheater)];
await sleep(1600);
await A.evaluate(([i]) => window.WB.matchPlace(i, 7, 0.1, 12.6), [idx[cheaterName]]);
await A.evaluate(() => { window.WB.tp(2, 0.1, 12.6, -Math.PI / 2); });
await sleep(1200);
const hp0 = (await ms(A)).me.hp;
await cheater.evaluate(() => { for (let i = 0; i < 40; i++) window.WB.matchPeerSend({ t: 'fire', w: 'ar17', ox: 7, oy: 1.72, oz: 12.6, dx: -1, dy: -0.02, dz: 0 }); });
await sleep(1200);
const hp1 = (await ms(A)).me.hp;
ok(hp0 - hp1 <= 60, '40 tirs envoyés d’un coup : l’hôte n’en accepte que selon la cadence de l’arme', `santé ${hp0} -> ${hp1}`);
await cheater.evaluate(() => window.WB.matchPeerBinary(-28, 0.1, -15));
await sleep(800);
const pc = (await ms(A)).players.find((p) => p.name === cheaterName);
ok(Math.hypot(pc.x - 7, pc.z - 12.6) < 3, 'téléportation refusée par l’hôte', `position retenue ${pc.x},${pc.z}`);

// ---------- victoire ----------
await A.evaluate(() => window.WB.matchPlace(0, 12, 0.1, 12.6)); // l'hôte reste à son poste
for (let i = 0; i < 4 && (await ms(A)).phase === 'playing'; i++) { await sleep(3500); await fireAt('Alpha', foe); }
await waitAll(() => window.WB.matchState().phase === 'over' && window.WB.state().state === 'results', 30000).catch(() => {});
const ends = await Promise.all(P.map(ms));
ok(ends.every((s) => s.phase === 'over'), 'fin de partie à 3 éliminations chez tous', ends.map((s) => s.phase).join(','));
const titles = await Promise.all(P.map((p) => p.evaluate(() => document.querySelector('.title-xl')?.textContent)));
ok(names.every((n, i) => titles[i] === (team[n] === team.Alpha ? 'VICTOIRE' : 'DÉFAITE')), 'victoire pour l’équipe d’Alpha, défaite pour l’autre', titles.join(','));
ok(await A.evaluate(() => !!document.querySelector('table.board')), 'tableau des scores sur l’écran de fin');
await A.screenshot({ path: SHOTS + 'online-fin.png' });

// ---------- retour au salon ----------
for (const p of P) await p.evaluate(() => document.querySelector('[data-a="lobby"]')?.click());
await waitAll(() => window.WB.onlineRoom()?.phase === 'lobby' && window.WB.game.ui.current === 'lobby', 20000).then(() => ok(true, 'retour au salon pour les 4 joueurs'), () => ok(false, 'retour au salon pour les 4 joueurs'));

// ---------- Domination ----------
await A.evaluate(() => { window.WB.matchRules({ score: 2, time: 240 }); window.WB.game.match.lobby.send({ t: 'config', mode: 'dom', map: 'chantier' }); });
await sleep(800);
for (const p of [B, C, D]) await p.evaluate(() => window.WB.onlineReady());
await A.waitForFunction(() => window.WB.onlineRoom()?.players.every((p) => p.ready || p.host), null, { timeout: 20000 });
await A.evaluate(() => window.WB.onlineStart());
await waitAll(() => { const s = window.WB.matchState(); return s.phase === 'playing' && s.mode === 'dom' && s.level === 'duel'; }, 90000);
ok(true, 'Domination lancée depuis le même salon');
a = await ms(A);
const redA = a.players.filter((p) => p.team === team.Alpha);
// l'équipe d'Alpha sur la zone A, les autres loin
for (const p of a.players) await A.evaluate(([i, x, z]) => window.WB.matchPlace(i, x, 0.1, z), [p.idx, p.team === team.Alpha ? -13 + p.idx * 0.6 : 26, p.team === team.Alpha ? 10.5 : -14]);
await sleep(2500);
let z = (await ms(A)).zones.find((q) => q.id === 'A');
ok(z.cap === team.Alpha && z.prog > 0.2, 'capture en cours, accélérée à deux joueurs', JSON.stringify(z));
await A.waitForFunction((t) => window.WB.matchState().zones.find((q) => q.id === 'A').owner === t, team.Alpha, { timeout: 20000 }).then(() => ok(true, `zone A capturée par l’équipe ${team.Alpha}`), () => ok(false, 'zone A capturée'));
const zb = await Promise.all(P.map(ms));
ok(zb.every((s) => s.zones.find((q) => q.id === 'A').owner === team.Alpha), 'propriétaire de la zone synchronisé chez tous');
await waitAll(() => window.WB.matchState().phase === 'over', 30000).then(() => ok(true, 'victoire aux points (Domination)'), () => ok(false, 'victoire aux points (Domination)'));
const dt = await Promise.all(P.map((p) => p.evaluate(() => document.querySelector('.title-xl')?.textContent)));
ok(names.every((n, i) => dt[i] === (team[n] === team.Alpha ? 'VICTOIRE' : 'DÉFAITE')), 'résultats de Domination cohérents', dt.join(','));
void redA;

ok(errors.length === 0, 'aucune erreur JavaScript', JSON.stringify(errors.slice(0, 5)));
console.log(`\n${pass} réussis, ${fail} échoués`);
await browser.close();
process.exit(fail ? 1 : 0);
