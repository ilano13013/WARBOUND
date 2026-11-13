// Contrôle de cohérence des niveaux après habillage : aucun point d'apparition dans un obstacle,
// chaque ennemi au sol et chaque interaction restent reliés au point de départ par la navigation.
import { open, sleep, waitFor } from './lib.mjs';

const { browser, page, errors } = await open({ w: 640, h: 360 });
let fail = 0;
const check = (ok, label, extra = '') => { console.log(`${ok ? '  ok ' : '  ÉCHEC '} ${label} ${extra}`); if (!ok) fail++; };
await page.evaluate(() => { WB.newGame('vanguard'); WB.quality('low'); });
await waitFor(page, () => WB.state().state === 'play');

for (const id of ['op1', 'op2', 'op3', 'op4']) {
  console.log(`— ${id}`);
  await page.evaluate((id) => {
    const g = WB.game; window.__sp = [];
    if (!g.__origSpawn) g.__origSpawn = g.spawnEnemy.bind(g);
    g.spawnEnemy = (kind, x, z, o) => { window.__sp.push({ kind, x, z, y: o?.y || 0, fixed: !!o?.static }); return g.__origSpawn(kind, x, z, o); };
    WB.mission(id);
  }, id);
  await waitFor(page, (id) => WB.state().level === id && WB.state().state === 'play', 90000, id);
  const n = await page.evaluate(() => WB.state().objectives);
  for (let i = 1; i < n; i++) { await page.evaluate((i) => { WB.god(true); WB.skipTo(i); }, i); await sleep(350); }
  const r = await page.evaluate(() => {
    const g = WB.game, L = g.level, w = L.world, nav = w.nav, out = { spawns: window.__sp.length, inside: [], unreachable: [], inter: [], player: null };
    const s = L.spawn;
    out.player = !!w.overlaps(s.x, s.y + 0.05, s.z, 0.35, 1.7);
    for (const e of window.__sp) {
      // au-dessus de la hauteur de marche : trottoirs, dalles et seuils ne comptent pas comme obstacles
      if (w.overlaps(e.x, e.y + 0.5, e.z, 0.3, 1.0)) out.inside.push(`${e.kind}@${e.x},${e.z}`);
      if (e.y > 0.5 || e.fixed || e.kind === 'drone') continue;
      if (nav.nearestOpen(e.x, e.z, 2) < 0) out.unreachable.push(`${e.kind}@${e.x},${e.z}`);
    }
    for (const it of L.interactables) if (it.pos.y < 2.2 && nav.nearestOpen(it.pos.x, it.pos.z, 4) < 0) out.inter.push(`${it.prompt}@${it.pos.x.toFixed(1)},${it.pos.z.toFixed(1)}`);
    return out;
  });
  // cheminement réel : toutes les portes ouvertes (fin de progression), un chemin à pied doit relier le départ
  // à chaque marqueur d'objectif fixe, chaque interaction et chaque ennemi au sol
  const reach = await page.evaluate(() => {
    const g = WB.game, L = g.level, s = L.spawn, bad = [];
    for (const d of L.doors) if (!d.open) L.openDoor(d);
    // remplissage au gabarit du joueur (rayon 0,36 m, hauteur debout), grille de 25 cm ; les obstacles de moins de 0,42 m
    // (marches, trottoirs, gravats) sont franchis comme en jeu
    const st = 0.25, b = L.bounds, W = Math.ceil((b.maxX - b.minX) / st), H = Math.ceil((b.maxZ - b.minZ) / st);
    const free = (i) => { const x = b.minX + (i % W + 0.5) * st, z = b.minZ + (((i / W) | 0) + 0.5) * st; return !L.world.overlaps(x, 0.42, z, 0.36, 1.3); };
    const seen = new Uint8Array(W * H), cell = (x, z) => Math.floor((z - b.minZ) / st) * W + Math.floor((x - b.minX) / st);
    const i0 = cell(s.x, s.z), q = [i0]; seen[i0] = 1;
    while (q.length) { const i = q.pop(), x = i % W, z = (i / W) | 0; for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, nz = z + dz; if (nx < 0 || nz < 0 || nx >= W || nz >= H) continue; const j = nz * W + nx; if (!seen[j]) { seen[j] = 2; if (free(j)) { seen[j] = 1; q.push(j); } } } }
    // une cible est atteinte si une case libre et visitée se trouve à moins de 2,5 m (interaction, marqueur posé sur un objet)
    const near = (x, z) => { for (let dz = -10; dz <= 10; dz++) for (let dx = -10; dx <= 10; dx++) { if (dx * dx + dz * dz > 100) continue; const xx = Math.floor((x - b.minX) / st) + dx, zz = Math.floor((z - b.minZ) / st) + dz; if (xx < 0 || zz < 0 || xx >= W || zz >= H) continue; if (seen[zz * W + xx] === 1) return true; } return false; };
    const test = (label, x, y, z) => { if (y > 1.5) return; if (!near(x, z)) bad.push(`${label}@${x.toFixed(1)},${z.toFixed(1)}`); };
    g.mission.objectives.forEach((o, i) => { const mk = o.marker && typeof o.marker !== 'function' ? o.marker : null; if (mk) test(`objectif ${i + 1}`, mk.x, mk.y, mk.z); });
    for (const it of L.interactables) test(it.prompt.slice(0, 40), it.pos.x, it.pos.y, it.pos.z);
    for (const e of window.__sp) if (!(e.y > 0.5) && e.kind !== 'drone') test(e.kind, e.x, 0, e.z);
    return bad;
  });
  check(reach.length === 0, 'tout est atteignable à pied depuis le départ (gabarit du joueur, portes ouvertes)', reach.slice(0, 8).join(' | '));
  check(!r.player, 'point de départ du joueur dégagé');
  check(r.spawns > 0, `apparitions relevées : ${r.spawns}`);
  check(r.inside.length === 0, 'aucune apparition dans un obstacle', r.inside.join(' '));
  check(r.unreachable.length === 0, 'apparitions reliées à la navigation', r.unreachable.join(' '));
  check(r.inter.length === 0, 'interactions accessibles', r.inter.join(' | '));
}
console.log('— hub');
await page.evaluate(() => WB.hub());
await waitFor(page, () => WB.state().level === 'hub' && WB.state().state === 'play', 90000);
const hubBad = await page.evaluate(() => { const L = WB.game.level, s = L.spawn, b = L.bounds, st = 0.25, W = Math.ceil((b.maxX - b.minX) / st), H = Math.ceil((b.maxZ - b.minZ) / st); const seen = new Uint8Array(W * H); const free = (i) => !L.world.overlaps(b.minX + (i % W + 0.5) * st, 0.42, b.minZ + (((i / W) | 0) + 0.5) * st, 0.36, 1.3); const c0 = Math.floor((s.z - b.minZ) / st) * W + Math.floor((s.x - b.minX) / st), q = [c0]; seen[c0] = 1; while (q.length) { const i = q.pop(), x = i % W, z = (i / W) | 0; for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, nz = z + dz; if (nx < 0 || nz < 0 || nx >= W || nz >= H) continue; const j = nz * W + nx; if (!seen[j]) { seen[j] = 2; if (free(j)) { seen[j] = 1; q.push(j); } } } } const bad = []; for (const it of L.interactables) { if (it.pos.y > 1.5) continue; let ok = false; for (let dz = -10; dz <= 10 && !ok; dz++) for (let dx = -10; dx <= 10 && !ok; dx++) { const xx = Math.floor((it.pos.x - b.minX) / st) + dx, zz = Math.floor((it.pos.z - b.minZ) / st) + dz; if (dx * dx + dz * dz <= 100 && xx >= 0 && zz >= 0 && xx < W && zz < H && seen[zz * W + xx] === 1) ok = true; } if (!ok) bad.push(it.prompt.slice(0, 40)); } return bad; });
check(hubBad.length === 0, 'QG : toutes les interactions atteignables à pied', hubBad.join(' | '));
check(errors.length === 0, 'aucune erreur JavaScript', errors.slice(0, 3).join(' | '));
await browser.close();
console.log(fail ? `\n${fail} échec(s)` : '\nNiveaux cohérents.');
process.exit(fail ? 1 : 0);
