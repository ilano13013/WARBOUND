// Planche de captures de toutes les armes en vue subjective (hanche, visée, rechargement) depuis un point de vue fixe.
// Usage : node tests/weapon-shots.mjs <dossier de sortie> [ids séparés par des virgules]
import { open, sleep } from './lib.mjs';
const out = process.argv[2] || 'tests/shots';
const { browser, page, errors } = await open({ w: 960, h: 540 });
await page.evaluate(() => { window.WB.quality('high'); window.WB.newGame('vanguard'); });
await page.waitForFunction(() => window.WB.state().level === 'hub' && window.WB.state().state === 'play', null, { timeout: 120000 });
const ids = (process.argv[3] || 'ar17,vektor,aegis762,vesper,spectre,ember45,titan,bastion,frostbite,requiem,p9,ash').split(',');
await page.evaluate(() => { window.WB.god(true); window.WB.tp(0, 0.1, 19, 0); window.WB.look(0.5, 0.02); });
for (const id of ids) {
  await page.evaluate((id) => window.WB.equip(id), id);
  await page.waitForFunction(() => !!window.WB.game.weapons.w?.vm, null, { timeout: 30000 }).catch(() => console.log(id, "ANCIEN MODÈLE"));
  await sleep(2500);
  await page.screenshot({ path: `${out}/${id}-1hip.png`, timeout: 180000 });
  await page.evaluate(() => window.WB.ads(true)); await sleep(1500);
  await page.screenshot({ path: `${out}/${id}-2ads.png`, timeout: 180000 });
  await page.evaluate(() => window.WB.ads(false)); await sleep(700);
  await page.evaluate(() => { const w = window.WB.game.weapons; w.w.ammo = 0; w.startReload(); });
  const dur = await page.evaluate(() => window.WB.game.weapons.reloadDur);
  await sleep(dur * 450);
  await page.screenshot({ path: `${out}/${id}-3reload.png`, timeout: 180000 });
  await sleep(dur * 700 + 500);
}
console.log('ERRORS', errors);
await browser.close();
