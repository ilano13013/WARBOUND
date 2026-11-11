// Parcours automatisé d'une ou plusieurs opérations avec le pilote de test (mode ?autotest uniquement).
import { open, st, shot, sleep } from './lib.mjs';
const ids = (process.argv[2] || 'op1,op2,op3,op4').split(',');
const cls = process.argv[3] || 'vanguard';
const god = process.argv[4] !== 'nogod';
const { browser, page, errors } = await open({ w: 640, h: 360 });
await page.evaluate(() => window.WB.quality('low'));
await page.evaluate((c) => window.WB.newGame(c), cls);
await page.waitForFunction(() => window.WB.state().level === 'hub' && window.WB.state().state === 'play', null, { timeout: 60000 });
let allOk = true;
for (const id of ids) {
  await page.evaluate((id) => { window.WB.game.profile.missions = { ...window.WB.game.profile.missions }; window.WB.mission(id); }, id);
  await page.waitForFunction((id) => window.WB.state().level === id && window.WB.state().state === 'play', id, { timeout: 60000 });
  await page.evaluate((god) => { window.WB.bot(true, god); window.WB.speed(3); }, god);
  const t0 = Date.now(); let last = -1, lastChange = Date.now(), done = false, deaths = 0;
  while (Date.now() - t0 < 420000) {
    await sleep(1500);
    const s = await st(page);
    if (s.objective !== last) { console.log(`[${id}] objectif ${s.objective + 1}/${s.objectives} : ${s.text}  (t=${((Date.now() - t0) / 1000).toFixed(0)}s, ennemis=${s.enemies})`); last = s.objective; lastChange = Date.now(); }
    if (s.state === 'dead') { deaths++; await page.evaluate(() => window.WB.game.respawn()); }
    if (s.state === 'cinematic') { await page.keyboard.press('Space'); }
    if (s.state === 'results') { done = true; break; }
    if (s.errors.length) { console.log('ERREURS JEU', s.errors); break; }
    if (Date.now() - lastChange > 150000) { console.log(`[${id}] BLOQUÉ sur « ${s.text} » ${s.progress} boss=${JSON.stringify(s.boss)} ennemis=${s.enemies} pos=${s.pos}`); await shot(page, 'stuck-' + id); break; }
  }
  const s = await st(page);
  const r = await page.evaluate(() => { const g = window.WB.game; return { stats: g.mission?.stats, title: document.querySelector('.title-xl')?.textContent, items: document.querySelectorAll('.loot-card').length }; });
  console.log(`[${id}] ${done ? 'TERMINÉE' : 'ÉCHEC'} — niveau ${s.level_}, inventaire ${s.inventory}, missions ${s.missions}, morts ${deaths}, écran « ${r.title} », objets ${r.items}, temps de jeu ${r.stats ? r.stats.time.toFixed(0) : '?'}s, éliminations ${r.stats?.kills}`);
  allOk = allOk && done;
  if (done) {
    const final = await page.evaluate(() => !!document.querySelector('[data-a="credits"]'));
    if (final) { await page.click('[data-a="credits"]'); await sleep(500); await page.click('[data-a="back"]'); await page.waitForFunction(() => window.WB.state().state === 'menu', null, { timeout: 30000 }); console.log('[fin] crédits -> menu principal OK'); }
    else { await page.click('[data-a="hub"]'); await page.waitForFunction(() => window.WB.state().level === 'hub' && window.WB.state().state === 'play', null, { timeout: 60000 }); }
  } else break;
}
console.log('ERRORS', errors);
await browser.close();
process.exit(allOk && !errors.length ? 0 : 1);
