// OPÉRATION 4 — POINT ZÉRO : défenses HELIX, stabilisateurs, zone altérée, contre-attaque et Souverain Fracturé.
import * as THREE from 'three';
import type { Game } from '../core/Game';
import type { Mission } from '../mission/Mission';
import { Level, type Interactable } from '../world/Level';
import { mat } from '../render/Materials';
import { Sovereign } from '../ai/Boss';
import { ammo, barrel, lore, REYES, ORACLE, MAREK, VOSS } from './common';

const V = (x: number, z: number) => new THREE.Vector3(x, 0, z);

export function buildOp4(g: Game, m: Mission): Level {
  const L = new Level('op4', 'Point Zéro', { skyTop: 0x0a0412, skyHorizon: 0x7a2a4c, fog: 0x261022, fogDensity: 0.012, sun: 0xff9a8c, sunIntensity: 1.9, sunDir: [0.3, 0.5, -0.6], hemiSky: 0x9a6a90, hemiGround: 0x221820, hemiIntensity: 0.9, rift: true });
  m.level = L;
  L.bounds = { minX: -52, minZ: -248, maxX: 52, maxZ: 46 };
  L.spawn.set(0, 0.1, 38); L.spawnYaw = 0;
  L.maxLights = 9;

  L.floor('dirt', 0, 2, 104, 88);
  L.floor('darkconcrete', 0, -76, 104, 70);
  L.floor('ash', 0, -179, 104, 138);
  L.enclosure('concrete', -51, -247, 51, 45, 9, [], 1.5);

  // ================= A. DÉFENSES HELIX (z 44..-40) =================
  L.box('asphalt', 0, -0.98, 2, 9, 1, 86, { nav: false });
  const bunker = (x: number, z: number, door: 'e' | 'w') => {
    L.enclosure('concrete', x - 5, z - 4, x + 5, z + 4, 3.4, [{ side: door, at: z, gap: 2.4, h: 2.6 }], 0.6);
    L.roof('darkconcrete', x - 5, z - 4, x + 5, z + 4, 3.4, 0.5);
    L.box('glow_red', x, 3.0, z + 4.35, 6, 0.1, 0.05, { collide: false });
    L.zones.push({ minX: x - 5, minZ: z - 4, maxX: x + 5, maxZ: z + 4, light: 0.4 });
  };
  bunker(-22, 6, 'e'); bunker(22, -10, 'w');
  L.stairs('concrete', -14.6, 6, 'x-', 2, 0, 0.3, 0.4);
  L.stairs('concrete', -11.6, 9, 'x-', 2, 13, 0.3, 0.4); L.box('concrete', -16.9, 0, 9, 0.2, 3.9, 2, { collide: false });
  L.stairs('concrete', 11.6, -13, 'x+', 2, 13, 0.3, 0.4);
  for (const [x, z, ax, len] of [[-8, 24, 1, 6], [8, 20, 1, 6], [-14, 12, 1, 5], [12, 4, 1, 6], [-6, -4, 1, 5], [6, -14, 1, 6], [-16, -22, 1, 6], [14, -28, 1, 5], [0, 12, 1, 4]] as [number, number, number, number][]) L.sandbags(x, z, !!ax, len);
  for (const [x, z] of [[-4, 28], [4, 16], [-10, 2], [10, -6], [-4, -18], [4, -30], [-20, 26], [20, 22], [-28, -8], [28, 10]]) L.barrier(x, z, false, 2.6);
  L.vehicle(-16, 32, true, 'apc', 0x2e3428); L.vehicle(18, 30, false, 'truck', 0x3a3f36); L.vehicle(-30, -20, false, 'apc', 0x2e3428); L.vehicle(30, -26, true, 'truck', 0x3a3f36);
  L.container(-36, 14, false, 'container_green'); L.container(36, 2, false, 'container_red'); L.container(-34, -32, true, 'container_blue');
  L.fence(-50, 34, -24, 34); L.fence(24, 34, 50, 34);
  for (const [x, z] of [[-26, 36], [26, 36], [-34, -2], [34, -18]]) { L.box('darkmetal', x, 0, z, 0.3, 8, 0.3); L.lamp(x, 8.1, z, 'red', false); }
  L.lamp(0, 7.5, 10, 'red', true, 40, 30);
  barrel(g, L, -9, 18); barrel(g, L, 9, -2); barrel(g, L, -3, -24); barrel(g, L, 24, 14); barrel(g, L, -24, -14);
  L.crystalDeco(-42, 0, 30, 1); L.crystalDeco(-44, 0, 28, 1.8, 'crystal_red'); L.crystalDeco(44, 0, -34, 2, 'crystal_red'); L.crystalDeco(42, 0, 36, 1.4);
  lore(g, L, 'op4_log1', -24.5, 8);
  ammo(g, L, 24, -8); ammo(g, L, -4, 36);
  // mur et porte de l'installation
  L.wallDoor('darkmetal', -51, -40, 51, -40, 9, 0, 6, 5, 1.2);
  const gate = L.door(0, -40, true, 6, 5, 'metal');
  L.sign('HELIX PRIME — POINT ZÉRO', 0, 6.4, -39.2, 'z+', '#ff5a6a', 8);

  // ================= B. COMPLEXE DES STABILISATEURS (z -40..-112) =================
  L.enclosure('darkmetal', -51, -112, 51, -40.6, 9, [{ side: 'n', at: 0, gap: 8, h: 6 }], 1.2);
  for (const z of [-50, -64, -78, -92, -104]) { L.box('glow_red', -50.2, 4, z, 0.1, 0.15, 8, { collide: false }); L.box('glow_red', 50.2, 4, z, 0.1, 0.15, 8, { collide: false }); }
  // ailes séparées par des murs
  L.wall('darkconcrete', -18, -56, -18, -84, 6, 0.8); L.wall('darkconcrete', 18, -56, 18, -84, 6, 0.8);
  L.wall('darkconcrete', -50, -90, -24, -90, 6, 0.8); L.wall('darkconcrete', 24, -90, 50, -90, 6, 0.8);
  L.container(-8, -52, true, 'container_blue'); L.container(8, -60, false, 'container_red'); L.container(-6, -74, false, 'container_green'); L.container(9, -82, true, 'container_blue');
  for (const [x, z, ax] of [[0, -48, 1], [-12, -66, 0], [12, -72, 0], [0, -88, 1], [-30, -58, 1], [30, -58, 1], [-34, -80, 0], [34, -80, 0], [-8, -100, 1], [8, -104, 1]] as [number, number, number][]) L.barrier(x, z, !!ax, 3.4);
  L.machine(-46, -50, 4, 6, 4, 'glow_red'); L.machine(46, -50, 4, 6, 4, 'glow_red'); L.machine(-46, -100, 4, 5, 4, 'glow_violet'); L.machine(46, -100, 4, 5, 4, 'glow_violet');
  L.pipe(-50, 6, -45, 50, 6, -45, 0.35); L.pipe(-50, 7, -108, 50, 7, -108, 0.35); L.pipe(-24, 5, -41, -24, 5, -90, 0.25, 'metal'); L.pipe(24, 5, -41, 24, 5, -90, 0.25, 'metal');
  L.crate(-26, -48, 1.3); L.crate(26, -86, 1.3, 0, 'olive'); L.crate(-40, -66, 1.4, 0, 'olive'); L.crate(40, -74, 1.2); L.crate(3, -66, 1.3); L.crate(-3, -94, 1.2, 0, 'olive');
  barrel(g, L, -22, -62); barrel(g, L, 22, -76); barrel(g, L, 4, -96); barrel(g, L, -38, -84);
  L.lamp(0, 8.5, -60, 'white', true, 36, 30); L.lamp(0, 8.5, -96, 'white', true, 36, 30);
  // les trois stabilisateurs
  const stabPos = [V(-36, -72), V(36, -66), V(0, -78)];
  const stabOn = [true, true, true];
  const stabIt: Interactable[] = [];
  stabPos.forEach((p, i) => {
    L.deco(mat('darkmetal'), new THREE.CylinderGeometry(1.6, 2.0, 1.2, 10), p.x, 0.6, p.z);
    L.deco(mat('metal'), new THREE.CylinderGeometry(0.7, 0.9, 6, 10), p.x, 4.2, p.z);
    L.collider(p.x, 0, p.z, 3.2, 7.2, 3.2, 'metal');
    const ring1 = new THREE.Mesh(new THREE.TorusGeometry(1.8, 0.1, 6, 30), mat('glow_red')); ring1.position.set(p.x, 4.5, p.z); L.root.add(ring1);
    const ring2 = new THREE.Mesh(new THREE.TorusGeometry(1.3, 0.08, 6, 26), mat('glow_red')); ring2.position.set(p.x, 6.2, p.z); L.root.add(ring2);
    const beam = L.beacon(p.x, p.z, 0xff3a5a, 80); beam.position.y = 47;
    L.updaters.push((dt, t) => { const k = stabOn[i] ? 1 : 0.08; ring1.rotation.x += dt * 2 * k; ring1.rotation.y += dt * 1.3 * k; ring2.rotation.x -= dt * 2.6 * k; ring2.rotation.z += dt * k; void t; });
    const tp = L.terminal(p.x, p.z + 3, 'z+');
    const it = L.interact(tp, `Désactiver le stabilisateur ${i + 1}`, () => {
      stabOn[i] = false; it.enabled = false; beam.visible = false; ring1.material = mat('darkmetal'); ring2.material = mat('darkmetal');
      g.audio.explosion(p, 0.7); g.fx.shock(new THREE.Vector3(p.x, 4, p.z), 8, 0xff3a5a, 0.5); g.player.shakeAmt = 0.6;
      const left = stabOn.filter(Boolean).length;
      g.ui.hud.toast(`STABILISATEUR DÉSACTIVÉ — ${3 - left} / 3`, '#ff5a6a');
      if (left === 2) m.say(VOSS, 'Vous coupez des câbles pendant que le monde se déchire. Je suis le seul à tenir cette porte !');
      if (left === 1) m.say(ORACLE, 'La Fracture fluctue. Plus qu’un stabilisateur. Renforts ennemis en approche.');
      if (left > 0) m.portalSpawn('reinf', [['grunt', p.x - 6, p.z + 8], ['grunt', p.x + 6, p.z + 8], [left === 1 ? 'breaker' : 'caster', p.x, p.z + 12], ['drone', p.x, p.z + 6]]);
    }, 2.6);
    it.hold = 2; it.enabled = false;
    stabIt.push(it);
  });
  lore(g, L, 'op4_term1', 44, -86.6);
  ammo(g, L, -44, -58); ammo(g, L, 14, -108);

  // ================= C. ZONE ALTÉRÉE (z -112..-164) =================
  for (let i = 0; i < 26; i++) { const x = ((i * 37) % 90) - 45, z = -116 - ((i * 53) % 46); if (Math.abs(x) < 5) continue; L.crystalDeco(x, 0, z, 1 + (i % 4) * 0.7, i % 3 === 0 ? 'crystal_red' : 'crystal'); }
  for (const [x, z] of [[-10, -122], [12, -130], [-14, -142], [8, -152], [-4, -136], [18, -146], [-22, -128], [24, -120]]) L.rubble(x, z, 2.4, 'stone');
  for (const [x, z, b] of [[-8, -128, 0], [9, -140, 1], [-9, -150, 0], [6, -120, 1]] as [number, number, number][]) L.column(x, z, 9, 0.9, 'rune', !!b);
  const rocks: THREE.Mesh[] = [];
  for (let i = 0; i < 9; i++) { const r = new THREE.Mesh(new THREE.DodecahedronGeometry(1.2 + (i % 3) * 0.9, 0), mat(i % 2 ? 'stone' : 'darkconcrete')); r.position.set(((i * 29) % 70) - 35, 7 + (i % 4) * 3, -118 - i * 5); r.castShadow = true; L.root.add(r); rocks.push(r); }
  L.updaters.push((dt, t) => rocks.forEach((r, i) => { r.position.y += Math.sin(t * 0.6 + i) * dt * 0.5; r.rotation.x += dt * 0.1; r.rotation.y += dt * 0.07; }));
  L.portal(-30, 4, -138, 3, 0xff3a5a, true); L.portal(30, 4, -150, 3, 0x9a4aff, true);
  L.lamp(-28, 4, -138, 'red', true, 30, 26); L.lamp(28, 4, -150, 'violet', true, 30, 26);
  L.zones.push({ minX: -51, minZ: -164, maxX: 51, maxZ: -112, light: 0.75, fogDensity: 0.022 });

  // ================= D. PARVIS DU NOYAU (z -164..-190) =================
  L.box('rune', 0, -0.96, -177, 60, 1, 26, { nav: false });
  for (const [x, z, ax] of [[-10, -170, 1], [10, -170, 1], [-18, -180, 0], [18, -180, 0], [0, -176, 1]] as [number, number, number][]) L.sandbags(x, z, !!ax, 4);
  L.column(-24, -168, 10, 1, 'rune'); L.column(24, -168, 10, 1, 'rune'); L.column(-24, -186, 10, 1, 'rune', true); L.column(24, -186, 10, 1, 'rune');
  L.wallDoor('rune', -51, -190, 51, -190, 14, 0, 8, 7, 1.5);
  const coreDoor = L.door(0, -190, true, 8, 7, 'rune');
  lore(g, L, 'op4_doc1', -14, -187);
  ammo(g, L, 14, -187); ammo(g, L, -30, -166);

  // ================= E. NOYAU DE LA FRACTURE (boss) =================
  L.box('rune', 0, -0.95, -218, 62, 1, 56, { nav: false });
  L.zones.push({ minX: -51, minZ: -247, maxX: 51, maxZ: -190, light: 0.8 });
  for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2 + 0.3; L.column(Math.cos(a) * 27, -218 + Math.sin(a) * 25, 14, 1.2, 'rune', i % 4 === 1); }
  for (const [x, z] of [[-12, -206], [12, -206], [-12, -230], [12, -230]]) L.box('stone', x, 0, z, 2.4, 1.5, 2.4);
  const core = L.portal(0, 9, -218, 6, 0xff3a5a); core.rotation.x = Math.PI / 2;
  L.lamp(0, 8, -218, 'red', true, 90, 50); L.lamp(-18, 12, -218, 'violet', true, 40, 36); L.lamp(18, 12, -218, 'violet', true, 40, 36);
  for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; L.crystalDeco(Math.cos(a) * 31, 0, -218 + Math.sin(a) * 27, 1.6 + (i % 2), 'crystal_red'); }
  ammo(g, L, -26, -194.5); ammo(g, L, 26, -242);
  L.finish();

  // ================= ENNEMIS =================
  m.spawn('def', [
    ['grunt', -8, 22], ['grunt', 8, 18], ['grunt', -14, 10, { patrol: [V(-14, 10), V(0, 8)] }], ['sniper', -22, 6, { static: true, y: 4 }], ['grunt', 12, 2], ['drone', 0, 14],
    ['grunt', -6, -6], ['grunt', 6, -16], ['sniper', 22, -10, { static: true, y: 4 }], ['drone', -10, -14], ['grunt', -16, -24], ['grunt', 14, -30], ['drone', 6, -26],
  ]);
  m.spawn('cmd', [['commander', 0, -32], ['breaker', -5, -28], ['breaker', 5, -28]]);

  // ================= OBJECTIFS =================
  m.say(REYES, 'Point Zéro. Tout a commencé ici, et tout finit ici. La garnison HELIX tient la porte : brisez leur commandement.');
  m.say(MAREK, 'La Clé réagit déjà. Aldric… Voss est là-dedans. Ce qu’il en reste.');
  m.kill('Franchir les défenses HELIX — éliminer le commandement de la garnison', 'cmd', null, {
    onDone: () => {
      L.openDoor(gate); g.audio.door(V(0, -40));
      m.say(ORACLE, 'Porte ouverte. Trois stabilisateurs maintiennent la Fracture béante : aile ouest, aile est, et la cour centrale.');
      m.spawn('complex', [['grunt', -30, -62], ['grunt', -40, -76], ['caster', -32, -80], ['breaker', -28, -70], ['grunt', 30, -60], ['grunt', 40, -72], ['sniper', 44, -58, { static: true }], ['commander', 30, -74],
        ['grunt', -6, -84], ['grunt', 6, -70], ['drone', 0, -90], ['drone', -10, -60], ['caster', 4, -96]]);
    },
  });
  m.custom({
    text: 'Désactiver les trois stabilisateurs',
    marker: () => { let best: THREE.Vector3 | null = null, bd = Infinity; stabPos.forEach((p, i) => { if (!stabOn[i]) return; const d = p.distanceTo(g.player.pos); if (d < bd) { bd = d; best = new THREE.Vector3(p.x, 0, p.z + 3.9); } }); return best; },
    start: () => stabIt.forEach((it) => (it.enabled = true)),
    done: () => stabOn.every((s) => !s),
    progress: () => `${stabOn.filter((s) => !s).length} / 3`,
    onDone: () => {
      g.audio.bossRoar(null); g.player.shakeAmt = 1;
      m.say(ORACLE, 'Les trois stabilisateurs sont coupés. La zone au nord est… altérée. La réalité s’y fracture par à-coups. Ne restez pas immobile.');
      m.spawn('altered', [['devourer', -8, -124], ['devourer', 10, -128], ['devourer', -12, -138], ['devourer', 6, -144], ['sentinel', 0, -134], ['caster', -18, -146], ['caster', 16, -122], ['devourer', 14, -154], ['sentinel', -4, -156], ['devourer', -20, -130]]);
    },
  });
  let riftT = 2;
  m.reach('Traverser la zone altérée', 0, -166, 6, {
    update: (dt) => {
      // éruptions de la Fracture, annoncées au sol
      const p = g.player;
      if (p.pos.z > -112 || p.pos.z < -164) return;
      riftT -= dt;
      if (riftT <= 0) {
        riftT = 2.4;
        const fwd = p.forward(new THREE.Vector3());
        for (let i = 0; i < 2; i++) g.combat.hazardCircle(new THREE.Vector3(p.pos.x + fwd.x * 4 * i + (Math.random() - 0.5) * 8 + p.vel.x * 0.5, 0, p.pos.z + fwd.z * 4 * i + (Math.random() - 0.5) * 8 + p.vel.z * 0.5), 3.4, 1.5, 24 * g.diff.damage, 0xb04aff);
      }
    },
    onDone: () => { m.say(VOSS, 'Assez. Vous voulez la porte ? Venez la prendre. Garnison, Essaim — à moi !'); m.say(REYES, 'Contre-attaque massive sur votre position ! Tenez le parvis, Warbound !'); },
  });
  m.defend('Survivre à la contre-attaque', 'CONTRE-ATTAQUE', 70, [
    { at: 2, specs: [['grunt', -20, -168], ['grunt', 20, -168], ['devourer', -6, -160], ['devourer', 6, -160]] },
    { at: 14, specs: [['devourer', -26, -176], ['devourer', 26, -176], ['caster', -14, -162], ['drone', 0, -164], ['drone', 10, -166]] },
    { at: 27, specs: [['breaker', 0, -161], ['grunt', -18, -164], ['grunt', 18, -164], ['devourer', -28, -184], ['devourer', 28, -184]] },
    { at: 41, specs: [['sentinel', -10, -162], ['caster', 14, -162], ['devourer', 0, -160], ['devourer', -24, -170], ['grunt', 24, -172], ['drone', -8, -166]] },
    { at: 55, specs: [['commander', 0, -162], ['grunt', -8, -164], ['grunt', 8, -164], ['devourer', -22, -180], ['devourer', 22, -180], ['sentinel', 14, -166]] },
  ], 'counter', {
    marker: V(0, -178), checkpoint: new THREE.Vector3(0, 0.1, -180), checkpointYaw: Math.PI,
    onDone: () => { L.openDoor(coreDoor); g.audio.door(V(0, -190)); m.say(MAREK, 'La porte du noyau s’ouvre. Opérateur… quand vous le verrez, souvenez-vous qu’il a été un homme.'); },
  });
  m.reach('Entrer dans le noyau de la Fracture', 0, -197, 6, { checkpoint: new THREE.Vector3(0, 0.1, -184), checkpointYaw: 0 });
  m.bossFight('Affronter le Souverain Fracturé', () => {
    const b = new Sovereign(g, 0, -222);
    b.arena.set(0, 0, -218); b.arenaR = 24;
    b.anchors = [V(0, -218), V(-16, -206), V(16, -206), V(-16, -230), V(16, -230), V(0, -200), V(0, -236)];
    b.onPhase = (n) => {
      if (n === 2) { m.say(VOSS, 'Vous ne comprenez pas. Je ne suis plus Aldric Voss. JE SUIS LA PORTE.'); m.say(ORACLE, 'Il fusionne avec la Fracture ! Attaques dimensionnelles — surveillez le sol !'); }
      if (n === 3) { m.say(VOSS, 'Alors nous tomberons ensemble, et le monde avec nous !'); m.say(REYES, 'L’arène se disloque ! Suivez les annonces : centre ou extérieur. Achevez-le !'); }
    };
    return b;
  }, {
    start: () => { m.say(VOSS, 'Un soldat. Ils m’envoient un soldat. J’ai tenu cette plaie fermée à mains nues pendant que vos généraux votaient des budgets.'); },
    checkpoint: new THREE.Vector3(0, 0.1, -195),
    onDone: () => { m.say(VOSS, 'Lena… avait… raison…'); m.say(MAREK, 'Maintenant ! La Clé — au cœur de la Fracture, avant qu’elle ne se rouvre !'); },
  });
  m.interact('Stabiliser la Fracture', new THREE.Vector3(0, 1.4, -218), 'Utiliser la Clé du Voile', {
    start: () => { L.beacon(0, -218, 0xffffff, 20); },
    onDone: () => { g.audio.explosion(null, 1.5); g.fx.ring(new THREE.Vector3(0, 0.2, -218), 1, 40, 0xffffff, 1.5); core.visible = false; },
  }, 2.5);
  return L;
}
