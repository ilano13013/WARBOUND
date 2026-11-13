// Réglages de visée (sensibilité générale, verticale, en visée, inversion) et de performances : effet mesuré et persistance.
import { open, sleep, waitFor } from './lib.mjs';

const { browser, page, errors } = await open({ w: 640, h: 360 });
let fail = 0;
const ok = (label, c, extra = '') => { console.log(`${c ? 'PASS' : 'FAIL'} ${label} ${extra}`); if (!c) fail++; };
await page.evaluate(() => { WB.newGame('vanguard'); WB.quality('low'); });
await waitFor(page, () => WB.state().state === 'play');
await sleep(800);

// mesure : rotation produite par un déplacement de souris de 100 points, en lacet (dx) ou en tangage (dy)
const turn = (set, dx, dy, ads = false) => page.evaluate(async ([set, dx, dy, ads]) => {
  const g = WB.game; Object.assign(g.settings, set); g.player.godMode = true;
  const frame = () => new Promise((r) => requestAnimationFrame(() => r()));
  // attend que le mouvement soit consommé par la boucle de jeu, puis une image de plus
  const settle = async () => { for (let i = 0; i < 200 && (g.input.mouseDX || g.input.mouseDY); i++) await frame(); await frame(); await frame(); };
  WB.tp(0, 0.1, 19, 0); WB.look(0, 0); g.input.mouseDX = 0; g.input.mouseDY = 0; WB.ads(ads);
  await new Promise((r) => setTimeout(r, ads ? 1500 : 300));
  await settle();
  const y0 = g.player.yaw, p0 = g.player.pitch;
  WB.mouse(dx, dy);
  await settle();
  const out = { yaw: g.player.yaw - y0, pitch: g.player.pitch - p0 };
  WB.ads(false);
  return out;
}, [set, dx, dy, ads]);
const base = { sens: 1, sensY: 1, adsSens: 1, scopeSens: 1, invertY: false };
const a = await turn(base, 100, 0), b = await turn({ ...base, sens: 2 }, 100, 0);
ok('sensibilité générale ×2 double la rotation', Math.abs(b.yaw / a.yaw - 2) < 0.05, `${a.yaw.toFixed(3)} -> ${b.yaw.toFixed(3)} rad`);
const v1 = await turn(base, 0, 20), v2 = await turn({ ...base, sensY: 0.5 }, 0, 20);
ok('sensibilité verticale ×0,5 divise le tangage par deux', Math.abs(v2.pitch / v1.pitch - 0.5) < 0.05, `${v1.pitch.toFixed(3)} -> ${v2.pitch.toFixed(3)}`);
const inv = await turn({ ...base, invertY: true }, 0, 20);
ok('inversion de l’axe vertical', Math.abs(inv.pitch + v1.pitch) < 1e-3 && Math.abs(v1.pitch) > 1e-3, `${v1.pitch.toFixed(3)} / ${inv.pitch.toFixed(3)}`);
const h1 = await turn(base, 100, 0, true), h2 = await turn({ ...base, adsSens: 0.5 }, 100, 0, true);
ok('visée : rotation plus lente qu’à la hanche', Math.abs(h1.yaw) < Math.abs(a.yaw) && Math.abs(h1.yaw) > 0, `${a.yaw.toFixed(3)} hanche, ${h1.yaw.toFixed(3)} visée`);
ok('sensibilité en visée ×0,5 divise la rotation en visée', Math.abs(h2.yaw / h1.yaw - 0.5) < 0.05, `${h1.yaw.toFixed(3)} -> ${h2.yaw.toFixed(3)}`);

// résolution dynamique : en rendu logiciel les images dépassent 20 ms, la résolution interne doit donc baisser ;
// désactivée, elle reste à 100 %
const dyn = await page.evaluate(async () => {
  const g = WB.game; g.settings.renderScale = 1; g.settings.dynRes = true; g.settings.quality = 'medium'; g.applySettings();
  await new Promise((r) => setTimeout(r, 9000));
  const on = g.r.dyn;
  g.settings.dynRes = false; g.applySettings();
  await new Promise((r) => setTimeout(r, 3000));
  const off = g.r.dyn;
  g.settings.quality = 'low'; g.applySettings();
  return { on, off };
});
ok('résolution dynamique : baisse quand les images sont lentes', dyn.on < 1, `facteur ${dyn.on.toFixed(2)}`);
ok('résolution dynamique désactivée : résolution pleine', dyn.off === 1, `facteur ${dyn.off}`);

// persistance et validation
await page.evaluate(() => { const s = WB.game.settings; Object.assign(s, { sens: 1.37, sensY: 0.8, adsSens: 0.65, scopeSens: 1.4, invertY: true, rawInput: false, dynRes: false }); WB.game.saveSettings(); });
await sleep(500);
await page.reload();
await page.waitForFunction(() => window.WB && window.WB.game.state === 'menu', null, { timeout: 120000 });
const s = await page.evaluate(() => { const s = WB.game.settings; return { sens: s.sens, sensY: s.sensY, adsSens: s.adsSens, scopeSens: s.scopeSens, invertY: s.invertY, rawInput: s.rawInput, dynRes: s.dynRes }; });
ok('réglages de visée conservés après rechargement', s.sens === 1.37 && s.sensY === 0.8 && s.adsSens === 0.65 && s.scopeSens === 1.4 && s.invertY && !s.rawInput && !s.dynRes, JSON.stringify(s));
// panneau : les nouveaux réglages sont présents
await page.evaluate(() => WB.game.ui.showSettings(() => WB.game.ui.showMenu()));
await sleep(600);
const ids = await page.evaluate(() => [...document.querySelectorAll('[data-v]')].map((e) => e.dataset.v));
ok('panneau : réglages de sensibilité et de résolution dynamique présents', ['sens', 'sensY', 'adsSens', 'scopeSens', 'invertY', 'rawInput', 'dynRes'].every((k) => ids.includes(k)), ids.filter((k) => /sens|invert|raw|dyn/i.test(k)).join(','));
ok('aucune erreur JavaScript', errors.length === 0, errors.slice(0, 3).join(' | '));
await browser.close();
console.log(`${fail ? 'ÉCHEC' : 'OK'} — ${fail} échec(s)`);
process.exit(fail ? 1 : 0);
