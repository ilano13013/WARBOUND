// Tests de gameplay avec entrées réelles (clavier/souris) dans la zone d'entraînement.
import { open, st, shot, sleep, waitFor } from './lib.mjs';
const { browser, page, errors } = await open({ w: 640, h: 360 });
await page.evaluate(() => window.WB.quality('low'));
const R = []; const ok = (name, cond, extra = '') => { R.push({ name, ok: !!cond }); console.log((cond ? 'PASS' : 'FAIL') + ' ' + name + ' ' + extra); };
await page.evaluate(() => window.WB.newGame('vanguard'));
await waitFor(page, () => window.WB.state().level === 'hub' && window.WB.state().state === 'play');
await page.evaluate(() => window.WB.speed(1));
await sleep(800);
let a = await st(page);
// --- déplacement ---
await page.keyboard.down('z'); await sleep(1500); await page.keyboard.up('z');
let b = await st(page);
ok('avancer (Z)', b.pos[2] < a.pos[2] - 1, `dz=${(b.pos[2] - a.pos[2]).toFixed(2)}`);
await page.keyboard.down('q'); await sleep(2000); await page.keyboard.up('q');
let c = await st(page); ok('pas de côté (Q)', c.pos[0] < b.pos[0] - 0.5, `dx=${(c.pos[0] - b.pos[0]).toFixed(2)}`);
// collisions : marcher vers le mur ouest
await page.evaluate(() => window.WB.tp(-15, 0.1, 20, Math.PI / 2));
await page.keyboard.down('z'); await sleep(2500); await page.keyboard.up('z');
c = await st(page); ok('collision mur (ou décor solide)', c.pos[0] > -20.9 && c.pos[0] < -16, `x=${c.pos[0]}`);
// sprint
await page.evaluate(() => window.WB.tp(0, 0.1, 20, 0));
await page.keyboard.down('Shift'); await page.keyboard.down('z'); await sleep(1200);
let s1 = await st(page); ok('sprint', s1.sprinting && s1.speed > 7, `v=${s1.speed.toFixed(2)}`);
// glissade
await page.keyboard.down('Control'); await sleep(350);
let s2 = await st(page); ok('glissade', s2.sliding, `v=${s2.speed.toFixed(2)}`);
await page.keyboard.up('Control'); await page.keyboard.up('z'); await page.keyboard.up('Shift'); await sleep(900);
// saut
const y0 = (await st(page)).pos[1];
// en rendu logiciel une image peut dépasser 0,3 s : on suit la hauteur atteinte pendant le saut plutôt qu'un instant fixe
await page.evaluate(() => { window.__yMax = -1e9; const t0 = performance.now(); const f = () => { window.__yMax = Math.max(window.__yMax, window.WB.game.player.pos.y); if (performance.now() - t0 < 3000) requestAnimationFrame(f); }; f(); });
await page.keyboard.down('Space'); await sleep(900); await page.keyboard.up('Space'); await sleep(1200);
const yMax = await page.evaluate(() => window.__yMax);
ok('saut', yMax > y0 + 0.4, `h=${(yMax - y0).toFixed(2)}`); await sleep(900);
// accroupi
await page.keyboard.down('Control'); await sleep(900); ok('accroupissement', (await st(page)).crouching); await page.keyboard.up('Control'); await sleep(300);
// --- tir sur cible (zone d'entraînement) ---
await page.evaluate(() => { window.WB.tp(0, 0.1, -30, 0); });
await sleep(400);
await shot(page, '04-range');
a = await st(page);
await page.mouse.down(); await sleep(700); await page.mouse.up();
b = await st(page); ok('tir automatique + consommation', b.ammo < a.ammo - 4, `ammo ${a.ammo}->${b.ammo}`);
const g1 = await page.evaluate(() => { const g = window.WB.game; return { shots: g.profile.stats.shots, minHp: Math.min(...g.level.destructibles.map((d) => d.hp)), pitch: g.player.pitch }; });
ok('impacts sur cible (hitscan)', g1.minHp < 250, JSON.stringify(g1));
ok('recul réel sur la visée', g1.pitch > 0.002, `pitch=${g1.pitch.toFixed(4)}`);
// ADS
await page.mouse.down({ button: 'right' }); await sleep(500); ok('visée ADS', (await st(page)).adsK > 0.9); await shot(page, '05-ads'); await page.mouse.up({ button: 'right' }); await sleep(300);
// rechargement
await page.keyboard.press('r'); await sleep(400); ok('rechargement lancé', (await st(page)).reloading); await sleep(2300);
c = await st(page); ok('rechargement terminé', c.ammo === 30 && !c.reloading, `ammo=${c.ammo}`);
// changement d'arme
await page.keyboard.press('Digit2'); await sleep(700); ok('arme secondaire', (await st(page)).weapon === 'p9');
await page.mouse.down(); await sleep(150); await page.mouse.up(); await sleep(300);
ok('tir coup par coup', (await st(page)).ammo === 14);
await page.keyboard.press('Digit1'); await sleep(700); ok('arme principale', (await st(page)).weapon === 'ar17');
// --- compétences ---
// départ dégagé : la ruée et la marche qui suit ne doivent rencontrer aucun obstacle
await page.evaluate(() => window.WB.tp(0, 0.1, 21, 0)); await sleep(400);
a = await st(page);
await page.keyboard.press('a'); await sleep(400); b = await st(page);
ok('compétence 1 : buff + coût + cooldown', b.buffs.includes('ember') && b.energy < a.energy && b.cds[0] > 0, `energy ${a.energy.toFixed(0)}->${b.energy.toFixed(0)} cd=${b.cds[0].toFixed(1)}`);
await page.keyboard.down('z'); await page.keyboard.down('e'); await sleep(150); await page.keyboard.up('e'); await sleep(900); await page.keyboard.up('z'); c = await st(page);
ok('compétence 2 : ruée', c.pos[2] < b.pos[2] - 4, `dz=${(c.pos[2] - b.pos[2]).toFixed(1)}`);
await page.keyboard.down('c'); await sleep(300); await page.keyboard.up('c'); await sleep(900); ok('compétence 3 : égide', (await st(page)).buffs.includes('aegis'));
await page.evaluate(() => window.WB.setUlt(100)); await page.keyboard.press('x'); await sleep(400);
c = await st(page); ok('ultime', c.buffs.includes('inferno') && c.ult === 0);
await sleep(1500); ok('régénération énergie', (await st(page)).energy > c.energy);
// grenade
await page.keyboard.press('g'); await sleep(2600); await shot(page, '06-skills');
// --- interfaces ---
await page.keyboard.press('Tab'); await sleep(400); ok('panneau personnage (Tab)', (await st(page)).screen === 'character'); await shot(page, '07-character');
await page.click('[data-a="tab"][data-v="talents"]'); await sleep(300); await shot(page, '08-talents');
await page.keyboard.press('Escape'); await sleep(300); ok('fermeture (Échap)', (await st(page)).screen === '');
await page.keyboard.press('m'); await sleep(500); ok('carte (M)', (await st(page)).screen === 'map'); await shot(page, '09-map'); await page.keyboard.press('m'); await sleep(300);
await page.keyboard.press('Escape'); await sleep(300); ok('pause (Échap)', (await st(page)).screen === 'pause' && (await st(page)).paused); await shot(page, '10-pause');
await page.click('[data-a="resume"]'); await sleep(300);
// --- IA : simulation ---
await page.evaluate(() => { window.WB.tp(4, 0.1, -28, 0); window.WB.spawn('grunt', 4, -45, {}); });
await sleep(600);
let idle = (await st(page)).enemyStates[0];
await page.evaluate(() => window.WB.look(0, 0.6)); await page.mouse.down(); await sleep(300); await page.mouse.up(); // tir en l'air : le bruit alerte l'ennemi
await sleep(2500);
c = await st(page); ok('IA : réagit aux tirs et engage le combat', c.enemyStates.includes('combat'), idle + ' -> ' + JSON.stringify(c.enemyStates));
await sleep(5000); const d = await st(page); ok('IA inflige des dégâts', d.hp < 100, `hp=${d.hp.toFixed(0)}`);
await shot(page, '11-combat');
console.log('ERRORS', errors, (await st(page)).errors);
console.log(`${R.filter((r) => r.ok).length}/${R.length} réussis`);
await browser.close();
process.exit(R.every((r) => r.ok) && !errors.length ? 0 : 1);
