// Matchmaking public de bout en bout (serveur local wrangler dev + version construite avec VITE_LOBBY_URL, port 4174) :
// partie rapide, lancement automatique, places complétées par des bots vétérans qui se déplacent, tirent et marquent.
import { chromium, sleep, SHOTS } from './lib.mjs';

const URL = process.env.WB_ONLINE_URL || 'http://localhost:4174/?autotest';
let pass = 0, fail = 0;
const ok = (c, label, extra = '') => { if (c) pass++; else fail++; console.log(`${c ? 'PASS' : 'FAIL'} ${label} ${extra}`); };
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-features=WebRtcHideLocalIpsWithMdns'] });
const errors = [];
async function page(name, w = 480, h = 270) {
  const p = await (await browser.newContext({ viewport: { width: w, height: h } })).newPage();
  p.on('pageerror', (e) => errors.push(`${name}: ${e.message}`));
  await p.goto(URL);
  await p.waitForFunction(() => window.WB && window.WB.game.state === 'menu', null, { timeout: 120000 });
  await p.evaluate(() => window.WB.quality('low'));
  await p.evaluate((n) => window.WB.newGame('vanguard', n), name);
  await p.waitForFunction(() => window.WB.state().level === 'hub' && window.WB.state().state === 'play', null, { timeout: 120000 });
  await p.evaluate(() => window.WB.game.toMenu());
  return p;
}
const ms = (p) => p.evaluate(() => window.WB.matchState());
const quick = (p, mode) => p.evaluate((m) => document.querySelector(`[data-a="quick"][data-v="${m}"]`) ? (document.querySelector(`[data-a="quick"][data-v="${m}"]`).click(), true) : false, mode);

// ---------- 4v4 seul : 7 bots ----------
const A = await page('Alpha', 640, 360);
await A.evaluate(() => { window.WB.matchRules({ score: 4, time: 300 }); window.WB.game.ui.showLobby(); });
ok(await quick(A, 'tdm'), 'bouton « partie rapide » présent');
await A.waitForFunction(() => !!window.WB.onlineRoom()?.players.some((p) => p.name === 'Alpha'), null, { timeout: 20000 });
ok(await A.evaluate(() => /Partie publique/.test(document.querySelector('.shop-note')?.textContent || '')), 'salle publique : compte à rebours affiché', await A.evaluate(() => document.getElementById('pub-count')?.textContent + ' s'));
await A.waitForFunction(() => window.WB.matchState().phase === 'playing' && window.WB.matchState().level === 'duel', null, { timeout: 60000 });
let a = await ms(A);
const bots = a.players.filter((p) => /\[BOT\]/.test(p.name));
ok(a.players.length === 8 && bots.length === 7, 'lancement automatique : 1 joueur + 7 bots', a.players.map((p) => `${p.name}:${p.team}`).join(', '));
ok(a.players.filter((p) => p.team === 'red').length === 4, 'équipes 4 contre 4');
const pos0 = bots.map((b) => [b.x, b.z]);
await A.evaluate(() => window.WB.god(true));
await sleep(6000);
a = await ms(A);
const movedBots = a.players.filter((p) => /\[BOT\]/.test(p.name)).filter((b, i) => Math.hypot(b.x - pos0[i][0], b.z - pos0[i][1]) > 2).length;
ok(movedBots >= 5, 'les bots se déplacent', `${movedBots}/7`);
await A.waitForFunction(() => window.WB.matchState().feed.length > 0, null, { timeout: 120000, polling: 500 }).then(() => ok(true, 'les bots combattent et s’éliminent'), () => ok(false, 'les bots combattent et s’éliminent'));
await A.screenshot({ path: SHOTS + 'partie-rapide-bots.png', timeout: 120000 });
await A.waitForFunction(() => window.WB.matchState().phase === 'over', null, { timeout: 240000, polling: 1000 }).then(() => ok(true, 'partie menée jusqu’à la limite de score par les bots'), () => ok(false, 'fin de partie'));
a = await ms(A);
ok(Math.max(a.score.red, a.score.blue) >= 4, 'score final', JSON.stringify(a.score));
await A.evaluate(() => { const lb = window.WB.game.match.lobby; lb?.leave(); window.WB.game.match.lobby = null; window.WB.game.toMenu(); });

// ---------- Domination à deux : même salle, 6 bots ----------
const B = await page('Bravo'), C = await page('Charlie');
for (const p of [B, C]) await p.evaluate(() => { window.WB.matchRules({ score: 6, time: 300 }); window.WB.game.ui.showLobby(); });
await quick(B, 'dom');
await B.waitForFunction(() => !!window.WB.onlineRoom(), null, { timeout: 20000 });
await quick(C, 'dom');
await C.waitForFunction(() => !!window.WB.onlineRoom(), null, { timeout: 20000 });
const codes = await Promise.all([B, C].map((p) => p.evaluate(() => window.WB.game.match.lobby.code)));
ok(codes[0] === codes[1], 'deux joueurs envoyés dans la même partie publique', codes.join(' / '));
for (const p of [B, C]) await p.waitForFunction(() => window.WB.matchState().phase === 'playing' && window.WB.matchState().level === 'duel', null, { timeout: 90000 });
const b = await ms(B);
ok(b.players.length === 8 && b.players.filter((p) => /\[BOT\]/.test(p.name)).length === 6, 'Domination : 2 joueurs + 6 bots');
const cpl = (await ms(C)).players.filter((p) => /\[BOT\]/.test(p.name) && p.rival).length;
ok(cpl === 6 || (await ms(C)).players.filter((p) => /\[BOT\]/.test(p.name)).length === 6, 'les bots apparaissent aussi chez l’autre joueur');
await B.waitForFunction(() => window.WB.matchState().zones.some((z) => z.owner), null, { timeout: 150000, polling: 1000 }).then(() => ok(true, 'des zones sont capturées'), () => ok(false, 'des zones sont capturées'));
ok((await ms(C)).zones.some((z) => z.owner), 'propriétaire des zones synchronisé chez l’autre joueur', JSON.stringify((await ms(C)).zones.map((z) => z.owner)));
for (const p of [B, C]) await p.evaluate(() => { const lb = window.WB.game.match.lobby; lb?.leave(); window.WB.game.match.lobby = null; });

// ---------- 1v1 seul : adversaire bot ----------
const D = await page('Delta');
await D.evaluate(() => window.WB.game.ui.showLobby());
await quick(D, 'duel');
await D.waitForFunction(() => window.WB.matchState().phase === 'playing' && window.WB.matchState().level === 'duel', null, { timeout: 60000 });
const d = await ms(D);
ok(d.players.length === 2 && /\[BOT\]/.test(d.players[1].name), '1v1 : un bot sert d’adversaire', d.players.map((p) => p.name).join(' / '));

ok(errors.length === 0, 'aucune erreur JavaScript', JSON.stringify(errors.slice(0, 3)));
console.log(`\n${pass} réussis, ${fail} échoués`);
await browser.close();
process.exit(fail ? 1 : 0);
