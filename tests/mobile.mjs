// Téléphone (émulation tactile, 844×390 en paysage) : commandes à l'écran, déplacement au joystick, visée au doigt,
// tir, saut, pause, aide à la visée en solo (et désactivable), invitation à tourner l'écran en portrait.
import { chromium, GAME_URL, sleep, SHOTS } from './lib.mjs';

let pass = 0, fail = 0;
const ok = (c, label, extra = '') => { if (c) pass++; else fail++; console.log(`${c ? 'PASS' : 'FAIL'} ${label} ${extra}`); };
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto(GAME_URL + '&touch=1');
await page.waitForFunction(() => window.WB && window.WB.game.state === 'menu', null, { timeout: 120000 });
const cdp = await ctx.newCDPSession(page);
const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([x, y], id) => ({ x, y, id })) });
const tapAt = async (x, y) => { await touch('touchStart', [[x, y]]); await sleep(80); await touch('touchEnd', []); };
const center = (sel) => page.evaluate((s) => { const r = document.querySelector(s).getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; }, sel);

ok(await page.evaluate(() => window.WB.game.input.touch && document.body.classList.contains('touch')), 'mode tactile détecté');
ok(await page.evaluate(() => window.WB.game.settings.quality === 'low'), 'qualité basse au premier lancement sur téléphone');
await page.evaluate(() => window.WB.newGame('vanguard', 'Mobile'));
await page.waitForFunction(() => window.WB.state().level === 'hub' && window.WB.state().state === 'play', null, { timeout: 120000 });
await sleep(1500);
ok(await page.evaluate(() => !document.getElementById('touch').classList.contains('hidden')), 'commandes tactiles affichées en jeu');
await page.screenshot({ path: SHOTS + 'mobile-qg.png', timeout: 180000 });

// déplacement au joystick
const p0 = await page.evaluate(() => { const p = window.WB.game.player; return { x: p.pos.x, z: p.pos.z, yaw: p.yaw }; });
await touch('touchStart', [[160, 290]]); await sleep(60);
await touch('touchMove', [[160, 230]]); await sleep(1600);
const p1 = await page.evaluate(() => { const p = window.WB.game.player; return { x: p.pos.x, z: p.pos.z }; });
await touch('touchEnd', []);
const moved = Math.hypot(p1.x - p0.x, p1.z - p0.z);
ok(moved > 2, 'joystick : le joueur avance', `${moved.toFixed(1)} m`);

// visée au doigt
await touch('touchStart', [[560, 160]]); await sleep(50);
for (let i = 1; i <= 6; i++) { await touch('touchMove', [[560 + i * 15, 160]]); await sleep(30); }
await touch('touchEnd', []); await sleep(200);
const yaw1 = await page.evaluate(() => window.WB.game.player.yaw);
ok(Math.abs(yaw1 - p0.yaw) > 0.1, 'glisser à droite : la vue tourne', `${(yaw1 - p0.yaw).toFixed(2)} rad`);

// tir
const ammo0 = await page.evaluate(() => window.WB.game.weapons.w.ammo);
const [fx, fy] = await center('.tc-fire');
await touch('touchStart', [[fx, fy]]); await sleep(700); await touch('touchEnd', []);
const ammo1 = await page.evaluate(() => window.WB.game.weapons.w.ammo);
ok(ammo1 < ammo0, 'bouton TIR : l’arme tire', `${ammo0} -> ${ammo1}`);

// saut
const [jx, jy] = await center('.tc-jump');
const y0 = await page.evaluate(() => window.WB.game.player.pos.y);
await touch('touchStart', [[jx, jy]]); await sleep(250);
const y1 = await page.evaluate(() => window.WB.game.player.pos.y);
await touch('touchEnd', []);
ok(y1 > y0 + 0.2, 'bouton SAUT', `${y0.toFixed(2)} -> ${y1.toFixed(2)}`);

// pause puis reprise au doigt
await sleep(800);
const [px, py] = await center('.tc-pause');
await tapAt(px, py); await sleep(400);
ok(await page.evaluate(() => window.WB.game.ui.current === 'pause'), 'bouton pause');
const [rx, ry] = await center('[data-a="resume"]');
await page.touchscreen.tap(rx, ry); await sleep(400);
ok(await page.evaluate(() => window.WB.game.ui.current !== 'pause' && window.WB.game.input.locked), 'reprise au doigt');

// aide à la visée en solo : un ennemi légèrement décalé, visée active
const assist = async () => {
  await page.evaluate(() => {
    const W = window.WB, g = W.game;
    for (const e of g.enemies) e.remove();
    g.enemies.length = 0;
    const sp = g.level.spawn, yw = g.level.spawnYaw;
    W.tp(sp.x, sp.y, sp.z, yw); W.look(yw, 0);
    const fx = -Math.sin(yw), fz = -Math.cos(yw), rx = Math.cos(yw), rz = -Math.sin(yw);
    const e = W.spawn('grunt', sp.x + fx * 12 + rx * 1.3, sp.z + fz * 12 + rz * 1.3, { static: true });
    e.state = 'idle';
    window.__aa = { yaw0: g.player.yaw, e };
    g.input.ads = true;
  });
  // le rendu logiciel des tests est lent : on attend que la visée soit engagée, puis que du temps de jeu s'écoule
  await page.waitForFunction(() => window.WB.game.weapons.adsK > 0.9, null, { timeout: 60000, polling: 200 }).catch(() => {});
  await page.evaluate(() => { window.__aa.t = window.WB.game.time; });
  await page.waitForFunction(() => window.WB.game.time - window.__aa.t > 1, null, { timeout: 60000, polling: 200 }).catch(() => {});
  return page.evaluate(() => {
    const g = window.WB.game, p = g.player, { yaw0, e } = window.__aa;
    g.input.ads = false;
    let target = Math.atan2(-(e.pos.x - p.pos.x), -(e.pos.z - p.pos.z)) - yaw0;
    while (target > Math.PI) target -= 2 * Math.PI; while (target < -Math.PI) target += 2 * Math.PI;
    const moved = p.yaw - yaw0;
    e.remove();
    return { moved, target };
  });
};
await page.evaluate(() => window.WB.game.startMission('op1'));
await page.waitForFunction(() => window.WB.state().level === 'op1' && window.WB.state().state === 'play', null, { timeout: 120000 });
await page.evaluate(() => window.WB.god(true));
await sleep(1000);
const a1 = await assist();
ok(Math.sign(a1.moved) === Math.sign(a1.target) && Math.abs(a1.moved) > 0.02, 'aide à la visée : le réticule est attiré vers l’ennemi (solo)', `rotation ${a1.moved.toFixed(3)} rad vers ${a1.target.toFixed(3)}`);
await page.evaluate(() => { window.WB.game.settings.aimAssist = false; });
const a2 = await assist();
ok(Math.abs(a2.moved) < 0.005, 'aide à la visée désactivée dans les réglages : aucun effet', a2.moved.toFixed(4));
await page.screenshot({ path: SHOTS + 'mobile-mission.png', timeout: 180000 });

// portrait
await page.setViewportSize({ width: 390, height: 844 }); await sleep(400);
ok(await page.evaluate(() => getComputedStyle(document.getElementById('rotate')).display !== 'none'), 'portrait : invitation à tourner le téléphone');
await page.setViewportSize({ width: 844, height: 390 });

// menus utilisables au doigt
await page.evaluate(() => window.WB.game.toMenu()); await sleep(600);
await page.screenshot({ path: SHOTS + 'mobile-menu.png', timeout: 180000 });
const [sx, sy] = await center('[data-a="settings"]');
await page.touchscreen.tap(sx, sy); await sleep(400);
ok(await page.evaluate(() => window.WB.game.ui.current === 'settings' && !!document.querySelector('[data-v="touchSens"]')), 'menu au doigt : paramètres, avec la sensibilité tactile');

ok(errors.length === 0, 'aucune erreur JavaScript', JSON.stringify(errors.slice(0, 3)));
console.log(`\n${pass} réussis, ${fail} échoués`);
await browser.close();
process.exit(fail ? 1 : 0);
