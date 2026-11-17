// Contrôle du tir de chaque arme : capture pendant une rafale (flash de bouche, recul), munitions consommées, rechargement complet.
import { open, sleep } from './lib.mjs';
const out = process.argv[2] || 'tests/shots';
const ids = (process.argv[3] || 'ar17,vektor,aegis762,vesper,spectre,ember45,titan,bastion,frostbite,requiem,p9,ash').split(',');
const { browser, page, errors } = await open({ w: 960, h: 540 });
await page.evaluate(() => { window.WB.quality('high'); window.WB.newGame('vanguard'); });
await page.waitForFunction(() => window.WB.state().level === 'hub' && window.WB.state().state === 'play', null, { timeout: 120000 });
await page.evaluate(() => { window.WB.god(true); window.WB.tp(0, 0.1, 19, 0); window.WB.look(0.5, 0.02); });
let pass = 0, fail = 0;
const ok = (c, l, x = '') => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'} ${l} ${x}`); };
for (const id of ids) {
  await page.evaluate((id) => window.WB.equip(id), id);
  await page.waitForFunction(() => !!window.WB.game.weapons.w?.vm, null, { timeout: 30000 }).catch(() => {});
  await sleep(1200);
  const a0 = await page.evaluate(() => window.WB.game.weapons.w.ammo);
  // capture au moment exact d'un tir : on attend que le flash soit visible
  await page.evaluate(() => window.WB.fire(true));
  await page.waitForFunction(() => window.WB.game.weapons.flash.visible, null, { timeout: 5000, polling: 'raf' }).catch(() => {});
  await page.screenshot({ path: `${out}/${id}-fire.png`, timeout: 180000 });
  await sleep(500);
  await page.evaluate(() => window.WB.fire(false));
  const s = await page.evaluate(() => { const w = window.WB.game.weapons; return { ammo: w.w.ammo, vm: !!w.w.vm, mag: w.w.st.mag }; });
  ok(s.vm && s.ammo < a0, `${id} : ensemble chargé, tir, munitions ${a0} -> ${s.ammo}`);
  await sleep(1300);
  // chargeur vide puis rechargement complet
  const r = await page.evaluate(() => { const w = window.WB.game.weapons; w.w.ammo = 0; w.startReload(); return { dur: w.reloadDur, busy: w.w.vm?.busy }; });
  await sleep(r.dur * 1000 + 600);
  const e = await page.evaluate(() => { const w = window.WB.game.weapons; return { ammo: w.w.ammo, rel: w.reloading, busy: w.w.vm?.busy }; });
  ok(r.busy && e.ammo === s.mag && e.rel === 0 && !e.busy, `${id} : rechargement à vide animé (${r.dur.toFixed(2)} s), chargeur plein, animation terminée`, JSON.stringify(e));
}
ok(errors.length === 0, 'aucune erreur console', JSON.stringify(errors.slice(0, 3)));
console.log(`\n${pass} réussis, ${fail} échoués`);
await browser.close();
process.exit(fail ? 1 : 0);
