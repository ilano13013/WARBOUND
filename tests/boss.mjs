// Validation des trois boss : phases, boucliers, attaques annoncées, invocations, victoire.
import { open, st, sleep, waitFor, shot } from './lib.mjs';
const BOSS = { op1: { idx: 8, name: 'Gardien d’Helix', shield: true, adds: true }, op3: { idx: 5, name: 'Archonte du Voile', shield: true, adds: false }, op4: { idx: 5, name: 'Souverain Fracturé', shield: true, adds: true } };
const { browser, page, errors } = await open({ w: 640, h: 360 });
await page.evaluate(() => { window.WB.quality('low'); window.WB.newGame('vanguard'); });
await waitFor(page, () => window.WB.state().level === 'hub' && window.WB.state().state === 'play', 90000);
let allOk = true;
for (const id of (process.argv[2] || 'op1,op3,op4').split(',')) {
  const B = BOSS[id];
  await page.evaluate((id) => window.WB.mission(id), id);
  await waitFor(page, (id) => window.WB.state().level === id && window.WB.state().state === 'play', 90000, id);
  await sleep(500);
  await page.evaluate((i) => { window.WB.skipTo(i); }, B.idx);
  await waitFor(page, () => !!window.WB.state().boss, 20000);
  // 1) le boss peut blesser un joueur passif (sans invulnérabilité)
  await page.evaluate(() => { const g = window.WB.game, b = g.mission.boss; window.WB.tp(b.arena.x, 0.1, b.arena.z + 12, 0); window.WB.god(false); });
  let hurt = false; const hp0 = (await st(page)).maxHp;
  for (let i = 0; i < 40 && !hurt; i++) { await sleep(500); const s = await st(page); if (s.hp < hp0 || s.state === 'dead') hurt = true; }
  if ((await st(page)).state === 'dead') { await page.evaluate(() => window.WB.game.respawn()); await sleep(800); }
  // 2) combat complet avec le pilote (dégâts modérés) : suivi des phases
  await page.evaluate(() => { window.WB.bot(true, true, 0.12); window.WB.speed(3); });
  const seen = { phases: new Set(), shield: false, exposed: false, hazMax: 0, addsMax: 0 }; const t0 = Date.now(); let dead = false;
  while (Date.now() - t0 < 240000) {
    await sleep(250);
    const s = await page.evaluate(() => { const g = window.WB.game, b = g.mission.boss; return { boss: b ? { hp: b.hp, phase: b.phase, shielded: b.shielded, alive: b.alive, exposed: b.exposedT > 0 } : null, haz: window.WB.hazards(), enemies: g.enemies.filter((e) => e.alive).length, idx: g.mission.index, state: g.state }; });
    if (!s.boss) break;
    seen.phases.add(s.boss.phase); seen.shield ||= s.boss.shielded; seen.exposed ||= s.boss.exposed; seen.hazMax = Math.max(seen.hazMax, s.haz); seen.addsMax = Math.max(seen.addsMax, s.enemies - 1);
    if (!s.boss.alive) { dead = true; break; }
  }
  const el = ((Date.now() - t0) / 1000 * 3).toFixed(0);
  await sleep(1500);
  const after = await st(page);
  const pass = hurt && dead && seen.phases.size === 3 && (!B.shield || seen.shield) && seen.hazMax > 0 && (!B.adds || seen.addsMax > 0) && after.objective > B.idx;
  console.log(`${pass ? 'PASS' : 'FAIL'} ${B.name} : blesse le joueur=${hurt}, phases=${[...seen.phases]}, bouclier=${seen.shield}, fenêtre vulnérable=${seen.exposed}, attaques annoncées simultanées max=${seen.hazMax}, renforts max=${seen.addsMax}, vaincu=${dead} (~${el}s de jeu), objectif suivant=${after.objective > B.idx}`);
  allOk &&= pass;
  await page.evaluate(() => { window.WB.bot(false); window.WB.speed(1); window.WB.hub(); });
  await waitFor(page, () => window.WB.state().level === 'hub' && window.WB.state().state === 'play', 90000);
}
console.log('ERRORS', errors);
await browser.close();
process.exit(allOk && !errors.length ? 0 : 1);
