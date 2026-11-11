// Tests des systèmes : classes et compétences, talents, inventaire, armurerie, atelier, sauvegarde, mort/reprise, paramètres.
import { open, st, shot, sleep, waitFor } from './lib.mjs';
const { browser, page, errors } = await open({ w: 640, h: 360 });
const R = []; const ok = (name, cond, extra = '') => { R.push({ name, ok: !!cond }); console.log((cond ? 'PASS' : 'FAIL') + ' ' + name + ' ' + extra); };
const hub = () => waitFor(page, () => window.WB.state().level === 'hub' && window.WB.state().state === 'play', 90000);
await page.evaluate(() => window.WB.quality('low'));

// ---------- les six classes : chaque compétence et l'ultime ----------
for (const cls of ['vanguard', 'bulwark', 'lifebinder', 'wraith', 'arcanist', 'ranger']) {
  await page.evaluate((c) => window.WB.newGame(c), cls); await hub(); await sleep(500);
  const res = await page.evaluate(async () => {
    const W = window.WB, g = W.game, p = g.player;
    W.tp(0, 0.1, -30, 0); W.look(0, 0);
    const e = W.spawn('breaker', 0, -42, { static: true }); e.def = { ...e.def, sight: 0 }; e.yaw = Math.PI;
    const e2 = W.spawn('grunt', 3, -43, { static: true }); e2.def = { ...e2.def, sight: 0 };
    await new Promise((r) => setTimeout(r, 700));
    p.hp = p.maxHp * 0.4;
    const out = { cls: p.cls.id, skills: [], hp0: e.hp };
    for (let i = 0; i < 3; i++) {
      p.energy = p.maxEnergy; const en = p.energy; W.look(0, 0.02);
      const used = W.skill(i);
      await new Promise((r) => setTimeout(r, 900));
      out.skills.push({ id: p.cls.skills[i].id, used, cost: Math.round(en - p.energy) > 0 || p.energy < p.maxEnergy, cd: p.cds[i] > 0, buffs: [...p.buffs.keys()], allies: g.allies.length, fields: g.combat.fields.length, ehp: Math.round(e.hp), mark: e.markT > 0, pos: p.pos.z.toFixed(1), hp: Math.round(p.hp) });
      W.tp(0, 0.1, -30, 0);
    }
    W.setUlt(100); W.look(0, 0.02);
    const u = W.skill(3);
    await new Promise((r) => setTimeout(r, 900));
    out.ult = { id: p.cls.ult.id, used: u, ult: p.ult, buffs: [...p.buffs.keys()], allies: g.allies.length, fields: g.combat.fields.length, ehp: Math.round(e.hp), alive: e.alive, hp: Math.round(p.hp), shield: Math.round(p.shield) };
    return out;
  });
  const all = res.skills.every((s) => s.used && s.cd) && res.ult.used && res.ult.ult === 0;
  ok(`classe ${cls} : 3 compétences + ultime fonctionnelles`, all, JSON.stringify(res.skills.map((s) => `${s.id}:${s.used ? 'ok' : 'KO'}`)) + ' ult:' + res.ult.id + ':' + res.ult.used);
  console.log('   détails', JSON.stringify(res));
}

// ---------- talents ----------
await page.evaluate(() => window.WB.newGame('bulwark')); await hub(); await sleep(400);
let a = await st(page);
await page.evaluate(() => window.WB.giveLevel(1)); await sleep(300);
let b = await st(page); ok('montée de niveau', b.level_ > a.level_, `${a.level_} -> ${b.level_}`);
await page.keyboard.press('Tab'); await sleep(400);
await page.click('[data-a="tab"][data-v="talents"]'); await sleep(200);
await page.click('[data-a="learn"][data-v="b_a1"]'); await sleep(300);
let c = await st(page); ok('talent appris : +15 PV max (Blindage composite)', c.maxHp === a.maxHp + 15, `${a.maxHp} -> ${c.maxHp}`);
const locked = await page.evaluate(() => { document.querySelector('[data-a="learn"][data-v="b_a3"]').click(); return window.WB.game.profile.talents.b_a3 || 0; });
ok('prérequis de talent respecté', locked === 0);
await page.keyboard.press('Escape'); await sleep(300);

// ---------- inventaire / équipement / recyclage ----------
await page.evaluate(() => window.WB.give('boss_guardian', 3)); await sleep(300);
const inv = await page.evaluate(() => { const g = window.WB.game, p = g.profile; const armor = p.inventory.find((i) => i.kind === 'armor'); const leg = p.inventory.find((i) => i.rarity === 'legendary'); return { n: p.inventory.length, armor: armor?.uid, armorStats: armor?.stats, leg: leg?.name, mats: p.materials }; });
ok('butin de boss : objet légendaire garanti', !!inv.leg, inv.leg);
if (inv.armor) {
  await page.keyboard.press('Tab'); await sleep(300); await page.click('[data-a="tab"][data-v="equip"]'); await sleep(200);
  await page.click(`[data-a="sel"][data-v="${inv.armor}"]`); await sleep(200); await shot(page, '20-inventory');
  const before = await page.evaluate(() => ({ hp: window.WB.game.player.maxHp, dr: window.WB.game.player.mods.dr || 0, regen: window.WB.game.player.mods.hpRegen || 0 }));
  await page.click('[data-a="equip"]'); await sleep(300);
  const after = await page.evaluate(() => ({ hp: window.WB.game.player.maxHp, dr: window.WB.game.player.mods.dr || 0, regen: window.WB.game.player.mods.hpRegen || 0, eq: window.WB.game.profile.equipped.armor }));
  ok('équiper une armure modifie les statistiques', after.eq === inv.armor && (after.hp > before.hp || after.dr > before.dr || after.regen > before.regen), JSON.stringify(before) + ' -> ' + JSON.stringify(after));
  await page.click('[data-a="unequip"]'); await sleep(300);
  ok('déséquiper', await page.evaluate(() => window.WB.game.profile.equipped.armor === null));
  await page.click(`[data-a="sel"][data-v="${inv.armor}"]`); await sleep(200);
  await page.click('[data-a="scrap"]'); await sleep(200);
  if (await page.$('[data-a="yes"]')) { await page.click('[data-a="yes"]'); await sleep(200); }
  const sc = await page.evaluate(() => ({ n: window.WB.game.profile.inventory.length, mats: window.WB.game.profile.materials }));
  ok('recycler un objet donne des matériaux', sc.n === inv.n - 1 && sc.mats > inv.mats, `mats ${inv.mats} -> ${sc.mats}`);
  await page.keyboard.press('Escape'); await sleep(300);
}
// ---------- armurerie ----------
await page.evaluate(() => { window.WB.game.profile.level = 10; window.WB.game.ui.panels.armory(); }); await sleep(600); await shot(page, '21-armory');
const r0 = await page.evaluate(() => window.WB.game.weapons.w.st.recoilV);
await page.selectOption('[data-c="attach"][data-v="muzzle"]', 'compensator'); await sleep(500);
const r1 = await page.evaluate(() => window.WB.game.weapons.w.st.recoilV);
ok('accessoire (compensateur) réduit le recul', r1 < r0 * 0.8, `${r0.toFixed(2)} -> ${r1.toFixed(2)}`);
await page.selectOption('[data-c="attach"][data-v="mag"]', 'extmag'); await sleep(500);
ok('accessoire (chargeur étendu) augmente la capacité', await page.evaluate(() => window.WB.game.weapons.w.st.mag) > 100);
const other = await page.evaluate(() => { const p = window.WB.game.profile; return p.inventory.find((i) => i.kind === 'weapon' && i.base === 'frostbite')?.uid; });
await page.click(`[data-a="pick"][data-v="${other}"]`); await sleep(400); await page.click('[data-a="equip"]'); await sleep(500);
ok('équiper une autre arme principale', (await st(page)).weapon === 'frostbite');
await page.keyboard.press('Escape'); await sleep(300);
// ---------- atelier ----------
await page.evaluate(() => { const g = window.WB.game; g.profile.materials = 50; g.ui.panels.workshop(); }); await sleep(400);
const wuid = await page.evaluate(() => window.WB.game.profile.equipped.primary);
await page.click(`[data-a="sel"][data-v="${wuid}"]`); await sleep(200);
const d0 = await page.evaluate(() => window.WB.game.weapons.w.st.damage);
await page.click('[data-a="up"]'); await sleep(400); await shot(page, '22-workshop');
const up = await page.evaluate(() => ({ d: window.WB.game.weapons.w.st.damage, mats: window.WB.game.profile.materials, up: window.WB.game.profile.inventory.find((i) => i.uid === window.WB.game.profile.equipped.primary).up }));
ok('atelier : amélioration +1 (coût et dégâts)', up.up === 1 && up.mats < 50 && up.d > d0, `dmg ${d0.toFixed(1)} -> ${up.d.toFixed(1)}, mats 50 -> ${up.mats}`);
await page.keyboard.press('Escape'); await sleep(300);
// ---------- table tactique ----------
await page.evaluate(() => window.WB.game.ui.panels.missions()); await sleep(400); await shot(page, '23-missions');
ok('opération 2 verrouillée avant la 1', await page.evaluate(() => document.querySelectorAll('.mission-card.locked').length === 3));
await page.click('[data-a="diff"][data-v="veteran"]'); await sleep(200);
ok('choix de difficulté', await page.evaluate(() => window.WB.game.profile.difficulty === 'veteran'));
await page.click('[data-a="diff"][data-v="soldat"]'); await sleep(200);
await page.keyboard.press('Escape'); await sleep(300);

// ---------- sauvegarde et reprise ----------
await page.evaluate(() => window.WB.save()); await sleep(500);
const saved = await page.evaluate(() => { const p = window.WB.game.profile; return { level: p.level, inv: p.inventory.length, talents: p.talents, cls: p.classId, mats: p.materials, prim: p.equipped.primary }; });
await page.reload(); await waitFor(page, () => window.WB && window.WB.game.state === 'menu', 60000); await sleep(500);
ok('menu : Continuer disponible après rechargement', await page.evaluate(() => !document.querySelector('[data-a="continue"]').disabled));
await page.click('[data-a="continue"]'); await hub();
const loaded = await page.evaluate(() => { const p = window.WB.game.profile; return { level: p.level, inv: p.inventory.length, talents: p.talents, cls: p.classId, mats: p.materials, prim: p.equipped.primary }; });
ok('sauvegarde persistante (niveau, classe, talents, inventaire, équipement)', JSON.stringify(saved) === JSON.stringify(loaded), JSON.stringify(loaded));
ok('arme équipée restaurée en jeu', (await st(page)).weapon === 'frostbite');

// ---------- mort et reprise au point de contrôle ----------
await page.evaluate(() => { window.WB.quality('low'); window.WB.mission('op1'); });
await waitFor(page, () => window.WB.state().level === 'op1' && window.WB.state().state === 'play', 90000); await sleep(800);
await page.evaluate(() => window.WB.game.player.takeDamage(9999, { pierce: true }));
await waitFor(page, () => window.WB.state().screen === 'death', 20000);
ok('mort : écran de défaite', true); await shot(page, '24-death');
await page.click('[data-a="retry"]'); await sleep(800);
c = await st(page); ok('reprise au point de contrôle (PV restaurés, mission conservée)', c.state === 'play' && c.hp === c.maxHp && c.mission === 'op1');
ok('la mort n’efface pas la progression', c.level_ === saved.level);
// abandon -> QG
await page.keyboard.press('Escape'); await sleep(400); await page.click('[data-a="abandon"]'); await sleep(300); await page.click('[data-a="yes"]'); await hub();
ok('abandon de mission -> retour au QG', true);

// ---------- paramètres ----------
await page.keyboard.press('Escape'); await sleep(400); await page.click('[data-a="settings"]'); await sleep(400); await shot(page, '25-settings');
await page.click('[data-a="layout"][data-v="qwerty"]'); await sleep(300); await page.click('[data-a="toggle"][data-v="showFps"]'); await sleep(200);
await page.click('[data-a="back"]'); await sleep(300); await page.click('[data-a="resume"]'); await sleep(300);
a = await st(page); await page.keyboard.down('w'); await sleep(700); await page.keyboard.up('w'); b = await st(page);
ok('disposition QWERTY : W avance', b.pos[2] < a.pos[2] - 0.5);
await page.reload(); await waitFor(page, () => window.WB && window.WB.game.state === 'menu', 60000);
const set = await page.evaluate(() => ({ layout: window.WB.game.settings.layout, fps: window.WB.game.settings.showFps, fwd: window.WB.game.settings.binds.forward }));
ok('paramètres persistants', set.layout === 'qwerty' && set.fps === true && set.fwd === 'k:w', JSON.stringify(set));

// ---------- sauvegarde corrompue ----------
await page.evaluate(() => new Promise((res) => { const r = indexedDB.open('warbound', 1); r.onsuccess = () => { const tx = r.result.transaction('kv', 'readwrite'); tx.objectStore('kv').put({ classId: 'nimportequoi', level: 'x' }, 'profile'); tx.objectStore('kv').put('garbage', 'profile.bak'); tx.oncomplete = res; }; }));
await page.evaluate(() => { localStorage.setItem('warbound:profile', '{"broken":'); localStorage.setItem('warbound:profile.bak', 'zzz'); });
await page.reload(); await waitFor(page, () => window.WB && window.WB.game.state === 'menu', 60000); await sleep(400);
const cor = await page.evaluate(() => ({ prof: window.WB.game.profile, corrupted: window.WB.game.store.corrupted, cont: document.querySelector('[data-a="continue"]').disabled, errs: window.WB.game.errors.length }));
ok('sauvegarde corrompue gérée sans plantage', cor.prof === null && cor.cont === true && cor.errs === 0, JSON.stringify({ corrupted: cor.corrupted }));

console.log('ERRORS', errors);
console.log(`${R.filter((r) => r.ok).length}/${R.length} réussis`);
await browser.close();
process.exit(R.every((r) => r.ok) && !errors.length ? 0 : 1);
