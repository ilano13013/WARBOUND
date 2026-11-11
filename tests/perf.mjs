import { open, st, sleep, waitFor } from './lib.mjs';
for (const [w, h, q] of [[640, 360, 'low'], [640, 360, 'medium'], [1280, 720, 'medium']]) {
  const { browser, page } = await open({ w, h });
  await page.evaluate((q) => { window.WB.quality(q); window.WB.newGame('vanguard'); }, q);
  await waitFor(page, () => window.WB.state().level === 'hub' && window.WB.state().state === 'play');
  await sleep(4000);
  const s = await st(page);
  console.log(w, h, q, 'fps', s.fps, 'calls', s.calls, 'tris', s.tris);
  await browser.close();
}
