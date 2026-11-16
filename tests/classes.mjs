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
const openSlot = async (v) => { await page.evaluate((x) => { const e = document.querySelector('.gs-picker'); if (!e || !document.querySelector(`.gs-card.on[data-v="${x}"], .gs-weapon [data-v="${x}"]`)) document.querySelector(`[data-a="open"][data-v="${x}"]`).click(); }, v); await sleep(200); };
await openSlot('primary');
const lockA = await page.evaluate(() => ({ vektor: document.querySelector('[data-a="primary"][data-v="vektor"]')?.disabled, ar17: document.querySelector('[data-a="primary"][data-v="ar17"]')?.disabled }));
await page.evaluate(() => document.querySelector('[data-a="close"]').click()); await sleep(150);
await openSlot('optic');
const lock1 = await page.evaluate((a) => ({ lv: window.WB.game.ui.classes.level, ...a, reflex: document.querySelector('[data-a="att"][data-v="optic:reflex"]')?.disabled }), lockA);
ok(lock1.lv === 1 && lock1.vektor === true && lock1.ar17 === false && lock1.reflex === true, 'niveau 1 : Vektor-556 verrouillé, viseur reflex verrouillé (AR-17 niveau d’arme 1), AR-17 disponible', JSON.stringify(lock1));
await page.evaluate(() => document.querySelector('[data-a="close"]').click()); await sleep(150);
await openSlot('lethal');
const lockL = await page.evaluate(() => ({ frag: document.querySelector('[data-a="lethal"][data-v="frag"]')?.disabled, txt: document.querySelector('[data-a="lethal"][data-v="frag"]')?.textContent }));
ok(lockL.frag === true && /Niveau 3/.test(lockL.txt), 'niveau 1 : Grenade Frag verrouillée (niveau joueur 3)', JSON.stringify(lockL));
await page.screenshot({ path: SHOTS + 'classes-niveau1.png' });

// ---------- montée de niveau (XP ajoutée au compte) ----------
for (let i = 0; i < 2; i++) await page.evaluate(() => window.WB.game.account.addMpXp(6000));
const lv = await page.evaluate(() => window.WB.game.ui.classes.level);
ok(lv >= 9, 'XP enregistrée sur le compte : niveau atteint', `niveau ${lv}`);
// XP d'arme : Vektor-556 niveau 4 (viseur reflex, compensateur, chargeur étendu)
await page.evaluate(() => window.WB.game.account.addMpXp(0, { vektor: 1300 }));
const wl = await page.evaluate(() => ({ lv: window.WB.game.ui.classes.weaponLevel('vektor'), ar: window.WB.game.ui.classes.weaponLevel('ar17') }));
ok(wl.lv === 4 && wl.ar === 1, 'XP d’arme enregistrée : Vektor-556 niveau 4, AR-17 niveau 1', JSON.stringify(wl));

// ---------- création d'une classe ----------
await page.evaluate(() => window.WB.game.ui.classes.showEditor(() => window.WB.game.ui.showMenu(), 0));
await sleep(400);
const click = async (sel) => { await page.evaluate((s) => document.querySelector(s).click(), sel); await sleep(150); };
await page.evaluate(() => { const i = document.getElementById('cls-name'); i.value = 'Tireur test'; i.dispatchEvent(new Event('input')); });
const op = async (v) => { await click(`[data-a="open"][data-v="${v}"]`); };
await op('primary'); 
const bastionLocked = await page.evaluate(() => document.querySelector('[data-a="primary"][data-v="bastion"]')?.disabled === true);
await click('[data-a="primary"][data-v="vektor"]');
await op('optic'); await click('[data-a="att"][data-v="optic:reflex"]');
await op('muzzle');
const heavyLocked = await page.evaluate(() => document.querySelector('[data-a="att"][data-v="muzzle:heavybarrel"]')?.disabled === true);
await click('[data-a="att"][data-v="muzzle:compensator"]');
await op('grip');
const vgripLocked = await page.evaluate(() => { const b = document.querySelector('[data-a="att"][data-v="grip:vgrip"]'); return b?.disabled === true && /niv\. 5/.test(b.textContent); });
await click('[data-a="close"]');
await op('mag'); await click('[data-a="att"][data-v="mag:extmag"]');
await op('secondary'); await click('[data-a="secondary"][data-v="ash"]');
await op('lethal'); await click('[data-a="lethal"][data-v="frag"]');
await op('perk1'); await click('[data-a="perk"][data-v="1:rapide"]');
ok(heavyLocked && bastionLocked && vgripLocked, 'verrous : canon lourd et poignée verticale (niveau d’arme 5+), Bastion (niveau joueur 22)');
ok(await page.evaluate(() => !!document.querySelector('.gs-stat u.up') || !!document.querySelector('.gs-stat u.down')), 'statistiques : effet des accessoires affiché (gain ou perte)');
await page.screenshot({ path: SHOTS + 'classes-editeur.png' });
await click('[data-a="use"]');
await sleep(800);
const saved = await page.evaluate(() => window.WB.game.account.me.mp.classes[0]);
ok(saved?.primary === 'vektor' && saved?.pAttach?.optic === 'reflex' && saved?.pAttach?.mag === 'extmag' && saved?.secondary === 'ash' && saved?.name === 'Tireur test' && saved?.lethal === 'frag' && saved?.perks?.[0] === 'vigueur' && saved?.perks?.[1] === 'rapide', 'classe enregistrée sur le compte (accessoires, létal, atouts)', JSON.stringify(saved));

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
const load = await page.evaluate(() => ({ ...window.WB.game.match.myLoad, gren: window.WB.game.player.grenades, mul: window.WB.game.weapons.reloadMul, hud: document.getElementById('hud').classList.contains('mp-lethal') }));
ok(load.lt === 'frag' && load.n === 1 && load.gren === 1 && load.pk.includes('rapide') && load.pk.includes('vigueur') && load.mul === 0.7 && load.hud, 'en partie : Grenade Frag (1), atouts Vigueur et Rechargement rapide appliqués, grenade affichée', JSON.stringify(load));
await page.evaluate(() => window.WB.sim('weapon2', true)); await sleep(1000); await page.evaluate(() => window.WB.sim('weapon2', false));
ok(await page.evaluate(() => window.WB.game.weapons.w.st.def.id === 'ash'), 'changement vers l’arme secondaire');

// ---------- grenades (l'hôte fait autorité) ----------
await page.evaluate(() => { for (const p of window.WB.game.match.players) if (p.bot) { p.sleep = p.brain; p.brain = undefined; } window.WB.game.match.placeFor(window.WB.game.match.me, -25.5, 0.1, 0); });
await sleep(400);
const thrown = await page.evaluate(() => { const m = window.WB.game.match; const r = m.throwNade(); return { r, n: m.myLoad.n, mine: m.mine.nades, live: m.nades.list.length }; });
ok(thrown.r && thrown.n === 0 && thrown.mine === 0 && thrown.live === 1, 'lancer de grenade : décompte de l’hôte et grenade en vol', JSON.stringify(thrown));
const again = await page.evaluate(() => { const m = window.WB.game.match; m.throwNade(); return m.nades.list.length; });
ok(again === 1, 'pas de seconde grenade sans réserve');
await sleep(3500);
ok(await page.evaluate(() => window.WB.game.match.nades.list.length === 0), 'grenade explosée après la mèche (2,2 s)');
// explosion d'une Frag ennemie aux pieds du joueur : éliminé, attribuée au lanceur avec le nom de la grenade
const before = await page.evaluate(() => { const m = window.WB.game.match; return { d: m.mine.d, hp: m.mine.hp }; });
await page.evaluate(() => { const m = window.WB.game.match, g = window.WB.game; const foe = m.players.find((p) => p.bot && p.team !== m.mine.team && p.alive); m.placeFor(foe.idx, -14, 0, 8); const v = g.player.pos.clone(); v.y += 0.3; m.nades.add(9999, 'frag', foe.idx, v, v.clone().set(0, 0, 0)); });
await sleep(3500);
const after = await page.evaluate(() => { const m = window.WB.game.match; return { d: m.mine.d, feed: m.feed.map((f) => f.text).join(' | ') }; });
ok(after.d === before.d + 1 && /Grenade Frag/.test(after.feed), 'Frag ennemie : joueur éliminé, élimination attribuée au lanceur', JSON.stringify(after));
// régénération (Vigueur : 2,5 s)
await page.waitForFunction(() => window.WB.matchState().me && !window.WB.matchState().me.dead, null, { timeout: 30000 });
await sleep(2000);
await page.evaluate(() => { const m = window.WB.game.match; m.mine.hp = 40; m.mine.hurtT = performance.now(); });
await sleep(1500);
const hp1 = await page.evaluate(() => window.WB.game.match.mine.hp);
await sleep(2500);
const hp2 = await page.evaluate(() => ({ host: window.WB.game.match.mine.hp, local: window.WB.game.player.hp }));
ok(hp1 <= 41 && hp2.host > 55 && hp2.local > 55, 'santé régénérée par l’hôte après 2,5 s (Vigueur)', `${hp1} -> ${JSON.stringify(hp2)}`);
await page.evaluate(() => { for (const p of window.WB.game.match.players) if (p.sleep) { p.brain = p.sleep; p.sleep = undefined; } });

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
const wsrv = await page.evaluate(() => window.WB.game.account.me.mp.weapons);
ok((wsrv.vesper || 0) >= 100 && wsrv.vektor >= 1300, 'XP d’arme de fin de partie enregistrée (arme principale jouée)', JSON.stringify(wsrv));

ok(errors.length === 0, 'aucune erreur JavaScript', JSON.stringify(errors.slice(0, 3)));
console.log(`\n${pass} réussis, ${fail} échoués`);
await browser.close();
process.exit(fail ? 1 : 0);
