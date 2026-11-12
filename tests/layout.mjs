// Contrôle de cohérence des niveaux après habillage : aucun point d'apparition dans un obstacle,
// chaque ennemi au sol et chaque interaction restent reliés au point de départ par la navigation.
import { open, sleep, waitFor } from './lib.mjs';

const { browser, page, errors } = await open({ w: 640, h: 360 });
let fail = 0;
const check = (ok, label, extra = '') => { console.log(`${ok ? '  ok ' : '  ÉCHEC '} ${label} ${extra}`); if (!ok) fail++; };
await page.evaluate(() => { WB.newGame('vanguard'); WB.quality('low'); });
await waitFor(page, () => WB.state().state === 'play');

for (const id of ['op1', 'op2', 'op3', 'op4']) {
  console.log(`— ${id}`);
  await page.evaluate((id) => {
    const g = WB.game; window.__sp = [];
    if (!g.__origSpawn) g.__origSpawn = g.spawnEnemy.bind(g);
    g.spawnEnemy = (kind, x, z, o) => { window.__sp.push({ kind, x, z, y: o?.y || 0, fixed: !!o?.static }); return g.__origSpawn(kind, x, z, o); };
    WB.mission(id);
  }, id);
  await waitFor(page, (id) => WB.state().level === id && WB.state().state === 'play', 90000, id);
  const n = await page.evaluate(() => WB.state().objectives);
  for (let i = 1; i < n; i++) { await page.evaluate((i) => { WB.god(true); WB.skipTo(i); }, i); await sleep(350); }
  const r = await page.evaluate(() => {
    const g = WB.game, L = g.level, w = L.world, nav = w.nav, out = { spawns: window.__sp.length, inside: [], unreachable: [], inter: [], player: null };
    const s = L.spawn;
    out.player = !!w.overlaps(s.x, s.y + 0.05, s.z, 0.35, 1.7);
    for (const e of window.__sp) {
      // au-dessus de la hauteur de marche : trottoirs, dalles et seuils ne comptent pas comme obstacles
      if (w.overlaps(e.x, e.y + 0.5, e.z, 0.3, 1.0)) out.inside.push(`${e.kind}@${e.x},${e.z}`);
      if (e.y > 0.5 || e.fixed || e.kind === 'drone') continue;
      if (nav.nearestOpen(e.x, e.z, 2) < 0) out.unreachable.push(`${e.kind}@${e.x},${e.z}`);
    }
    for (const it of L.interactables) if (it.pos.y < 2.2 && nav.nearestOpen(it.pos.x, it.pos.z, 4) < 0) out.inter.push(`${it.prompt}@${it.pos.x.toFixed(1)},${it.pos.z.toFixed(1)}`);
    return out;
  });
  check(!r.player, 'point de départ du joueur dégagé');
  check(r.spawns > 0, `apparitions relevées : ${r.spawns}`);
  check(r.inside.length === 0, 'aucune apparition dans un obstacle', r.inside.join(' '));
  check(r.unreachable.length === 0, 'apparitions reliées à la navigation', r.unreachable.join(' '));
  check(r.inter.length === 0, 'interactions accessibles', r.inter.join(' | '));
}
check(errors.length === 0, 'aucune erreur JavaScript', errors.slice(0, 3).join(' | '));
await browser.close();
console.log(fail ? `\n${fail} échec(s)` : '\nNiveaux cohérents.');
process.exit(fail ? 1 : 0);
