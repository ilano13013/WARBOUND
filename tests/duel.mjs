// Défi d'armes : deux navigateurs (contextes séparés) se connectent par échange de codes, puis l'hôte
// élimine l'invité à chaque arme de l'échelle (raccourcie à 3 armes pour le test) jusqu'à la victoire.
import { chromium, GAME_URL, sleep, shot } from './lib.mjs';

let pass = 0, fail = 0;
const ok = (c, label, extra = '') => { if (c) pass++; else fail++; console.log(`${c ? 'PASS' : 'FAIL'} ${label} ${extra}`); };

// les adresses locales ne sont pas masquées (mDNS) pour que les deux contextes se joignent sans réseau
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-features=WebRtcHideLocalIpsWithMdns'] });
const errors = [];
async function page(name) {
  const ctx = await browser.newContext({ viewport: { width: 640, height: 360 } });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errors.push(`${name} pageerror: ${e.message}`));
  p.on('console', (m) => { if (m.type() === 'error') errors.push(`${name} console: ${m.text()}`); });
  await p.goto(GAME_URL);
  await p.waitForFunction(() => window.WB && window.WB.game.state === 'menu', null, { timeout: 90000 });
  await p.evaluate(() => window.WB.quality('low'));
  return p;
}
const A = await page('hôte'), B = await page('invité');
for (const [p, cls, name] of [[A, 'vanguard', 'Alpha'], [B, 'wraith', 'Bravo']]) {
  await p.evaluate(([c, n]) => window.WB.newGame(c, n), [cls, name]);
  await p.waitForFunction(() => window.WB.state().level === 'hub' && window.WB.state().state === 'play', null, { timeout: 90000 });
  await p.evaluate(() => { window.WB.duelLadder(['ar17', 'frostbite', 'ash']); window.WB.game.toMenu(); });
}
const ds = (p) => p.evaluate(() => window.WB.duelState());

// codes invalides : message clair, pas d'exception non gérée
const bad = await B.evaluate(() => window.WB.duelJoin('bonjour').then(() => 'accepté', (e) => e.message));
ok(/invalide/i.test(bad), 'code invalide refusé', `« ${bad} »`);

const invite = await A.evaluate(() => window.WB.duelHost());
ok(/^WB1\.o\.[zp]\./.test(invite), 'code d’invitation produit', `${invite.length} caractères`);
const answer = await B.evaluate((c) => window.WB.duelJoin(c), invite);
ok(/^WB1\.a\.[zp]\./.test(answer), 'code de réponse produit', `${answer.length} caractères`);
const wrong = await A.evaluate((c) => window.WB.duelAccept(c).then(() => 'accepté', (e) => e.message), invite);
ok(/réponse/i.test(wrong), 'invitation collée à la place de la réponse : refusée', `« ${wrong} »`);
await A.evaluate((c) => window.WB.duelAccept(c), answer);
for (const p of [A, B]) await p.waitForFunction(() => window.WB.state().level === 'duel' && window.WB.state().state === 'play' && window.WB.duelState().phase === 'playing', null, { timeout: 60000 });
ok(true, 'connexion établie, les deux joueurs sont dans l’arène');
let a = await ds(A), b = await ds(B);
ok(a.opp_name === 'Bravo' && b.opp_name === 'Alpha', 'noms échangés', `${a.opp_name} / ${b.opp_name}`);
ok(a.weapon === 'ar17' && b.weapon === 'ar17', 'première arme de l’échelle pour les deux', `${a.weapon} / ${b.weapon}`);

// synchronisation des positions
await B.evaluate(() => window.WB.tp(12, 0.1, -13.3, 0));
await sleep(1500);
a = await ds(A);
ok(a.rival && Math.hypot(a.rival.x - 12, a.rival.z + 13.3) < 0.6, 'position de l’adversaire synchronisée', JSON.stringify(a.rival));

// étage : depuis la base ouest, l'escalier mène sur le conteneur puis sur la plate-forme centrale
await A.evaluate(() => { window.WB.tp(-19, 0.1, 0, -Math.PI / 2); window.WB.sim('forward', true); });
await sleep(4500);
const up = await A.evaluate(() => { window.WB.sim('forward', false); const p = window.WB.game.player.pos; return { x: +p.x.toFixed(1), y: +p.y.toFixed(2) }; });
ok(up.y > 2.4 && up.x > -6, 'à pied : escalier, conteneur puis étage central', JSON.stringify(up));
// l'hôte vise l'invité et tire jusqu'à l'élimination, pour chaque arme
async function killOnce(round) {
  // invité immobile à 9 m devant (allée centrale dégagée) l'hôte, sans invulnérabilité d'apparition
  await B.evaluate(() => { window.WB.tp(3, 0.1, 13, 0); });
  await A.evaluate(() => { window.WB.tp(12, 0.1, 12.6, Math.PI / 2); window.WB.look(Math.PI / 2, -0.06); });
  const before = await ds(A);
  await A.waitForFunction(() => { const s = window.WB.duelState(); return s.rival && s.rival.alive && !s.rival.inv && Math.abs(s.rival.x - 3) < 0.4; }, null, { timeout: 15000 });
  const t0 = Date.now();
  let hpSeen = 100;
  while (Date.now() - t0 < 25000) {
    await A.evaluate(() => { window.WB.look(Math.PI / 2, -0.06); window.WB.fire(true); });
    await sleep(160);
    const s = await ds(B);
    hpSeen = Math.min(hpSeen, s.hp);
    if (s.dead) break;
  }
  await A.evaluate(() => window.WB.fire(false));
  const bs = await ds(B);
  if (!bs.dead && bs.deaths <= round) console.log('  diag', JSON.stringify(await A.evaluate(() => ({ st: window.WB.game.mission.stats, pos: window.WB.game.player.pos, yaw: window.WB.game.player.yaw, ammo: window.WB.game.weapons.w.ammo }))));
  ok(bs.dead || bs.deaths > round, `manche ${round + 1} : l’invité est éliminé (arme ${before.weapon})`, `santé minimale vue ${Math.round(hpSeen)}`);
  await sleep(800);
}
await killOnce(0);
a = await ds(A); b = await ds(B);
ok(a.my === 1 && a.weapon === 'frostbite', 'élimination confirmée : l’hôte passe à l’arme 2', `${a.my} ${a.weapon}`);
ok(b.opp === 1, 'l’invité voit la progression de l’hôte', String(b.opp));
await B.waitForFunction(() => !window.WB.duelState().dead && window.WB.state().state === 'play', null, { timeout: 10000 });
ok(true, 'réapparition de l’invité après le délai');
await shot(A, 'duel-hote');
await killOnce(1);
await B.waitForFunction(() => !window.WB.duelState().dead, null, { timeout: 10000 });
a = await ds(A);
ok(a.my === 2 && a.weapon === 'ash', 'dernière arme (revolver)', `${a.my} ${a.weapon}`);
await killOnce(2);
await A.waitForFunction(() => window.WB.duelState().phase === 'over', null, { timeout: 10000 });
await B.waitForFunction(() => window.WB.duelState().phase === 'over', null, { timeout: 10000 });
const titleA = await A.evaluate(() => document.querySelector('.title-xl')?.textContent);
const titleB = await B.evaluate(() => document.querySelector('.title-xl')?.textContent);
ok(titleA === 'VICTOIRE' && titleB === 'DÉFAITE', 'fin de partie : victoire de l’hôte, défaite de l’invité', `${titleA} / ${titleB}`);
a = await ds(A); b = await ds(B);
ok(a.kills === 3 && b.deaths === 3, 'bilan cohérent', `éliminations ${a.kills}, morts de l’invité ${b.deaths}`);
await shot(A, 'duel-victoire');
// retour au QG depuis l'écran de résultats
await A.click('[data-a="hub"]');
await A.waitForFunction(() => window.WB.state().level === 'hub' && window.WB.state().state === 'play', null, { timeout: 60000 });
ok(await A.evaluate(() => window.WB.game.weapons.override === null && window.WB.game.weapons.w.st.item.uid !== undefined), 'retour au QG : armes du profil rétablies');

ok(errors.length === 0, 'aucune erreur JavaScript', JSON.stringify(errors));
console.log(`\n${pass} réussis, ${fail} échoués`);
await browser.close();
process.exit(fail ? 1 : 0);
