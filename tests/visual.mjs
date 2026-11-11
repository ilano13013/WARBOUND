// Captures d'écran pour l'inspection visuelle des niveaux (qualité moyenne).
import { open, st, shot, sleep } from './lib.mjs';
const VIEWS = {
  op1: [[0, 0.1, 30, 0, 0], [0, 0.1, 2, 0, 0], [26, 0.1, -19, -1.57, 0], [0, 0.1, -43, 0, 0], [0, 0.1, -75, 0, 0], [0, 0.1, -112, 0, 0.1]],
  op2: [[0, 0.1, 36, 0, 0.1], [0, 0.1, 6, 0, 0.1], [0, 0.1, -40, 0, 0.15], [0, 0.1, -76, 0, 0.05], [0, 0.1, -116, 0, 0.15]],
  op3: [[0, 0.1, 36, 0, 0.1], [0, 0.1, -2, 0, 0.1], [0, 0.1, -33, 0, 0.15], [0, 0.1, -84, 0, 0.1], [0, 0.1, -132, 0, 0.12]],
  op4: [[0, 0.1, 38, 0, 0.05], [0, 0.1, -6, 0, 0.05], [0, 0.1, -44, 0, 0.1], [-24, 0.1, -72, 1.57, 0.1], [0, 0.1, -114, 0, 0.1], [0, 0.1, -168, 0, 0.1], [0, 0.1, -196, 0, 0.2]],
  survival: [[0, 0.1, 10, 0, 0.05]],
  hub: [[0, 0.1, 19, 0, 0], [-12, 0.1, 8, 1.57, 0], [0, 0.1, -24, 0, 0]],
};
const ids = (process.argv[2] || 'op1').split(',');
const { browser, page, errors } = await open({ w: 1280, h: 720 });
await page.evaluate(() => { window.WB.quality('medium'); window.WB.newGame('vanguard'); });
await page.waitForFunction(() => window.WB.state().level === 'hub' && window.WB.state().state === 'play', null, { timeout: 90000 });
for (const id of ids) {
  if (id !== 'hub') { await page.evaluate((id) => (id === 'survival' ? window.WB.survival() : window.WB.mission(id)), id); await page.waitForFunction((id) => window.WB.state().level === id && window.WB.state().state === 'play', id, { timeout: 90000 }); }
  await page.evaluate(() => { window.WB.god(true); for (const e of window.WB.game.enemies) e.def = { ...e.def, sight: 0 }; });
  let i = 0;
  for (const v of VIEWS[id]) {
    await page.evaluate((v) => { window.WB.tp(v[0], v[1], v[2], v[3]); window.WB.look(v[3], v[4]); }, v);
    await sleep(3500);
    await shot(page, `lvl-${id}-${++i}`);
  }
  const s = await st(page); console.log(id, 'calls', s.calls, 'tris', s.tris, 'errors', s.errors);
}
console.log('ERRORS', errors);
await browser.close();
