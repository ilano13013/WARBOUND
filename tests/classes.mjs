// Progression multijoueur et « Créer une classe » (serveur local wrangler dev + version VITE_LOBBY_URL sur le port 4174).
import { chromium, sleep, SHOTS } from './lib.mjs';

const URL = process.env.WB_ONLINE_URL || 'http://localhost:4174/?autotest';
let pass = 0, fail = 0;
const ok = (c, label, extra = '') => { if (c) pass++; else fail++; console.log(`${c ? 'PASS' : 'FAIL'} ${label} ${extra}`); };
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-features=WebRtcHideLocalIpsWithMdns'] });
const errors = [];
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await ctx.newPage();
page.on('pageerror', (e) => errors.push(e.message));
const boot = async (fresh) => {
  await page.goto(URL);
  await page.waitForFunction(() => window.WB && window.WB.game.state === 'menu', null, { timeout: 120000 });
  await page.evaluate(() => window.WB.quality('low'));
  if (fresh) {
    await page.evaluate(() => window.WB.newGame('vanguard', 'Recrue'));
    await page.waitForFunction(() => window.WB.state().level === 'hub' && window.WB.state().state === 'play', null, { timeout: 120000 });
    await page.evaluate(() => window.WB.game.toMenu());
  }
  await page.evaluate(() => window.WB.game.account.ensure('Recrue'));
};
await boot(true);

// ---------- niveau 1 : verrous ----------
await page.evaluate(() => window.WB.game.ui.classes.showEditor(() => window.WB.game.ui.showMenu()));
await sleep(500);
const lock1 = await page.evaluate(() => ({ lv: window.WB.game.ui.classes.level, vektor: document.querySelector('[data-a="primary"][data-v="vektor"]')?.disabled, ar17: document.querySelector('[data-a="primary"][data-v="ar17"]')?.disabled, reflex: document.querySelector('[data-a="att"][data-v="optic:reflex"]')?.disabled }));
ok(lock1.lv === 1 && lock1.vektor === true && lock1.ar17 === false && lock1.reflex === true, 'niveau 1 : Vektor-556 et viseur reflex verrouillés, AR-17 disponible', JSON.stringify(lock1));
await page.screenshot({ path: SHOTS + 'classes-niveau1.png' });

// ---------- montée de niveau (XP ajoutée au compte) ----------
for (let i = 0; i < 2; i++) await page.evaluate(() => window.WB.game.account.addMpXp(6000));
const lv = await page.evaluate(() => window.WB.game.ui.classes.level);
ok(lv >= 9, 'XP enregistrée sur le compte : niveau atteint', `niveau ${lv}`);

// ---------- création d'une classe ----------
await page.evaluate(() => window.WB.game.ui.classes.showEditor(() => window.WB.game.ui.showMenu(), 0));
await sleep(400);
const click = async (sel) => { await page.evaluate((s) => document.querySelector(s).click(), sel); await sleep(150); };
await page.evaluate(() => { const i = document.getElementById('cls-name'); i.value = 'Tireur test'; });
await click('[data-a="primary"][data-v="vektor"]');
await click('[data-a="att"][data-v="optic:reflex"]');
await click('[data-a="att"][data-v="muzzle:compensator"]');
await click('[data-a="att"][data-v="grip:vgrip"]');
await click('[data-a="secondary"][data-v="ash"]');
ok(await page.evaluate(() => document.querySelector('[data-a="att"][data-v="muzzle:heavybarrel"]')?.disabled === true && document.querySelector('[data-a="primary"][data-v="bastion"]')?.disabled === true), 'éléments de niveau supérieur (canon lourd niv. 20, Bastion niv. 22) toujours verrouillés');
await page.screenshot({ path: SHOTS + 'classes-editeur.png' });
await click('[data-a="use"]');
await sleep(800);
const saved = await page.evaluate(() => window.WB.game.account.me.mp.classes[0]);
ok(saved?.primary === 'vektor' && saved?.pAttach?.optic === 'reflex' && saved?.pAttach?.muzzle === 'compensator' && saved?.secondary === 'ash' && saved?.name === 'Tireur test', 'classe enregistrée sur le compte', JSON.stringify(saved));

// ---------- conservée après rechargement ----------
await boot(false);
const reloaded = await page.evaluate(() => { const c = window.WB.game.ui.classes; return { lv: c.level, first: c.custom()[0], sel: c.selected().name }; });
ok(reloaded.lv === lv && reloaded.first.primary === 'vektor' && reloaded.sel === 'Tireur test', 'après rechargement : niveau, classe et sélection retrouvés', JSON.stringify(reloaded));

// ---------- partie avec cette classe ----------
await page.evaluate(() => { window.WB.matchRules({ score: 2, time: 240 }); window.WB.game.ui.showLobby(); });
await sleep(500);
await page.evaluate(() => document.querySelector('[data-a="quick"][data-v="tdm"]').click());
await page.waitForFunction(() => window.WB.matchState().phase === 'playing' && window.WB.matchState().level === 'duel', null, { timeout: 90000 });
await page.waitForFunction(() => window.WB.matchState().state === 'play', null, { timeout: 30000 });
const kit = await page.evaluate(() => { const w = window.WB.game.weapons; return { slots: w.slots.map((s) => ({ id: s.st.def.id, att: s.st.item.attach })), cur: w.w.st.def.id }; });
ok(kit.slots.length === 2 && kit.slots[0].id === 'vektor' && kit.slots[0].att.optic === 'reflex' && kit.slots[1].id === 'ash', 'en partie : arme principale avec accessoires et arme secondaire de la classe', JSON.stringify(kit));
await page.evaluate(() => window.WB.sim('weapon2', true)); await sleep(1000); await page.evaluate(() => window.WB.sim('weapon2', false));
ok(await page.evaluate(() => window.WB.game.weapons.w.st.def.id === 'ash'), 'changement vers l’arme secondaire');

// ---------- changement de classe pour la prochaine apparition ----------
await page.evaluate(() => { const c = window.WB.game.ui.classes; c.select('p1'); window.WB.game.match.setClass(c.selected()); });
await page.evaluate(() => { const m = window.WB.game.match; m.kill(m.mine, null, false); });
await page.waitForFunction(() => window.WB.matchState().me && !window.WB.matchState().me.dead && window.WB.game.weapons.w?.st.def.id === 'vesper', null, { timeout: 30000 }).then(() => ok(true, 'nouvelle classe (Rapproché, Vesper-9) appliquée à la réapparition'), async () => ok(false, 'nouvelle classe à la réapparition', await page.evaluate(() => window.WB.game.weapons.w?.st.def.id)));

// ---------- fin de partie : XP gagnée ----------
const xp0 = await page.evaluate(() => window.WB.game.account.me.mp.xp);
await page.waitForFunction(() => window.WB.matchState().phase === 'over', null, { timeout: 300000, polling: 1000 });
await sleep(1500);
const res = await page.evaluate(() => ({ xp: window.WB.game.account.me.mp.xp, prog: /Progression multijoueur/.test(document.querySelector('.panel-body')?.textContent || ''), events: window.WB.game.match.xpEvents.length }));
ok(res.prog && res.xp > xp0, 'écran de fin : progression multijoueur et XP ajoutée', `${xp0} -> ${res.xp}, ${res.events} gain(s)`);
await page.screenshot({ path: SHOTS + 'classes-fin.png', timeout: 120000 });
await page.evaluate(() => window.WB.game.account.refresh());
const server = await page.evaluate(() => window.WB.game.account.me.mp.xp);
ok(server === res.xp, 'XP de fin de partie enregistrée sur le serveur', String(server));

ok(errors.length === 0, 'aucune erreur JavaScript', JSON.stringify(errors.slice(0, 3)));
console.log(`\n${pass} réussis, ${fail} échoués`);
await browser.close();
process.exit(fail ? 1 : 0);
