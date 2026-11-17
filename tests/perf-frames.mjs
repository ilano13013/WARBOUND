// Mesure comparative : images rendues en 12 s dans le QG (qualité basse, 640x360) et en mission op1. Rendu logiciel dans les tests :
// les valeurs servent à comparer deux versions dans les mêmes conditions, pas à prédire le débit sur une carte graphique.
import { open, sleep, waitFor } from './lib.mjs';
const { browser, page } = await open({ w: 640, h: 360 });
await page.evaluate(() => { window.WB.quality('low'); window.WB.newGame('vanguard'); });
await waitFor(page, () => window.WB.state().level === 'hub' && window.WB.state().state === 'play');
const count = async (label) => {
  await sleep(3000);
  const n = await page.evaluate(() => new Promise((res) => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 < 12000) requestAnimationFrame(f); else res(n); }; requestAnimationFrame(f); }));
  const s = await page.evaluate(() => window.WB.state());
  console.log(label, (n / 12).toFixed(1), 'images/s', 'appels', s.calls, 'triangles', s.tris);
};
await count('QG');
await page.evaluate(() => window.WB.mission('op1'));
await waitFor(page, () => window.WB.state().level === 'op1' && window.WB.state().state === 'play', 120000);
await page.evaluate(() => { window.WB.god(true); for (const e of window.WB.game.enemies) e.def = { ...e.def, sight: 0 }; });
await count('op1');
await browser.close();
