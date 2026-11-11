// Mode survie : vagues, améliorations, mini-boss, sortie volontaire, score et record.
import { open, st, sleep, waitFor, shot } from './lib.mjs';
const { browser, page, errors } = await open({ w: 640, h: 360 });
const R = []; const ok = (name, cond, extra = '') => { R.push({ name, ok: !!cond }); console.log((cond ? 'PASS' : 'FAIL') + ' ' + name + ' ' + extra); };
await page.evaluate(() => { window.WB.quality('low'); window.WB.newGame('arcanist'); });
await waitFor(page, () => window.WB.state().level === 'hub' && window.WB.state().state === 'play', 90000);
await page.evaluate(() => window.WB.survival());
await waitFor(page, () => window.WB.state().level === 'survival' && window.WB.state().state === 'play', 90000);
await page.evaluate(() => { window.WB.bot(true, true, 1); window.WB.speed(3); });
let maxEnemies = 0, kinds = new Set(), upgradeSeen = false, t0 = Date.now();
while (Date.now() - t0 < 400000) {
  await sleep(400);
  const s = await page.evaluate(() => { const g = window.WB.game; return { wave: g.mission.survival.wave, score: g.mission.survival.score, screen: g.ui.current, kinds: g.enemies.filter((e) => e.alive).map((e) => e.kind), up: !!document.querySelector('[data-a="up"]'), mods: Object.keys(g.runMods).length }; });
  maxEnemies = Math.max(maxEnemies, s.kinds.length); s.kinds.forEach((k) => kinds.add(k)); upgradeSeen ||= s.up;
  if (s.wave >= 5) await page.evaluate(() => window.WB.autoNext(false));
  if (s.wave >= 5 && s.screen === 'intermission') break;
}
let s = await page.evaluate(() => { const g = window.WB.game; return { wave: g.mission.survival.wave, score: g.mission.survival.score, mods: g.runMods, screen: g.ui.current }; });
ok('vagues successives jusqu’à la vague 5', s.wave >= 5, `vague ${s.wave}, score ${Math.round(s.score)}`);
ok('mélange progressif d’ennemis', kinds.size >= 4, [...kinds].join(','));
ok('mini-boss à la vague 5 (élites)', kinds.has('commander') || kinds.has('breaker'));
ok('améliorations temporaires proposées et appliquées', upgradeSeen && Object.keys(s.mods).length >= 1, JSON.stringify(s.mods));
await shot(page, '30-intermission');
await page.click('[data-a="quit"]');
await waitFor(page, () => window.WB.state().state === 'results', 20000); await sleep(300); await shot(page, '31-survival-results');
const p = await page.evaluate(() => ({ sv: window.WB.game.profile.survival, title: document.querySelector('.title-xl').textContent }));
ok('quitter après une vague : résultats, score et record', p.sv.bestWave >= 5 && p.sv.bestScore > 0, JSON.stringify(p));
await page.click('[data-a="hub"]'); await waitFor(page, () => window.WB.state().level === 'hub' && window.WB.state().state === 'play', 90000);
// mort en survie -> résultats
await page.evaluate(() => window.WB.survival()); await waitFor(page, () => window.WB.state().level === 'survival' && window.WB.state().state === 'play', 90000); await sleep(500);
await page.evaluate(() => window.WB.game.player.takeDamage(9999, { pierce: true }));
await waitFor(page, () => window.WB.state().state === 'results', 20000);
ok('mort en survie : fin de partie et progression conservée', (await st(page)).level_ >= 1);
console.log('ERRORS', errors); console.log(`${R.filter((r) => r.ok).length}/${R.length} réussis`);
await browser.close();
process.exit(R.every((r) => r.ok) && !errors.length ? 0 : 1);
