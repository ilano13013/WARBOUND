// Mise au point des ensembles d'armes : capture hanche / visée / rechargement et mesures (axe, bouche du canon).
// Usage : node tests/vm-probe.mjs <dossier> <ids> [json de réglages par id]
import { open, sleep } from './lib.mjs';
const out = process.argv[2], ids = process.argv[3].split(','), tunes = process.argv[4] ? JSON.parse(process.argv[4]) : {};
const { browser, page, errors } = await open({ w: 960, h: 540 });
await page.evaluate(() => { window.WB.quality('high'); window.WB.newGame('vanguard'); });
await page.waitForFunction(() => window.WB.state().level === 'hub' && window.WB.state().state === 'play', null, { timeout: 120000 });
await page.evaluate(() => { window.WB.god(true); window.WB.tp(0, 0.1, 19, 0); window.WB.look(0.5, 0.02); });
for (const key of ids) {
  const id = key.split('@')[0];
  await page.evaluate((id) => window.WB.equip(id), id);
  await page.waitForFunction(() => !!window.WB.game.weapons.w?.vm, null, { timeout: 60000 }).catch(() => console.log(key, 'PAS D’ENSEMBLE'));
  if (tunes[key]) { const { sight, ...t } = tunes[key]; await page.evaluate(([id, t]) => window.WB.vmTune(id, t), [id, t]); if (sight) console.log(id, 'ADS', JSON.stringify(await page.evaluate(([id, s]) => window.WB.vmAds(id, s[0], s[1], s[2] ?? 0.3, s[3] ?? 0), [id, sight]))); }
  await sleep(1500);
  if (process.env.PROBE) console.log(id, JSON.stringify(await page.evaluate(() => window.WB.vmProbe())));
  await page.screenshot({ path: `${out}/${key}-1hip.png`, timeout: 180000 });
  await page.evaluate(() => window.WB.ads(true)); await sleep(1200);
  await page.screenshot({ path: `${out}/${key}-2ads.png`, timeout: 180000 });
  await page.evaluate(() => window.WB.ads(false)); await sleep(600);
  if (!process.env.NORELOAD) {
    await page.evaluate(() => { const w = window.WB.game.weapons; w.w.ammo = 0; w.startReload(); });
    const dur = await page.evaluate(() => window.WB.game.weapons.reloadDur);
    await sleep(dur * 450);
    await page.screenshot({ path: `${out}/${key}-3reload.png`, timeout: 180000 });
    await sleep(dur * 700 + 400);
  }
}
console.log('ERRORS', errors);
await browser.close();
