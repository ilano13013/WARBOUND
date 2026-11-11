// OPÉRATION 2 — VILLE MORTE : rues de Varsen, défense du métro et destruction du portail.
import * as THREE from 'three';
import type { Game } from '../core/Game';
import type { Mission, SpawnSpec } from '../mission/Mission';
import { Level } from '../world/Level';
import { dressOp2 } from './dress';
import { cmat, mat } from '../render/Materials';
import { ammo, barrel, lore, REYES, ORACLE, MAREK } from './common';

const V = (x: number, z: number) => new THREE.Vector3(x, 0, z);

export function buildOp2(g: Game, m: Mission): Level {
  const L = new Level('op2', 'Varsen', { skyTop: 0x12121e, skyHorizon: 0x5a4a6e, fog: 0x2a2636, fogDensity: 0.013, sun: 0xc8b8e8, sunIntensity: 1.7, sunDir: [0.45, 0.5, 0.5], hemiSky: 0x8a80a8, hemiGround: 0x24222a, hemiIntensity: 0.85, rift: true });
  m.level = L;
  L.bounds = { minX: -48, minZ: -192, maxX: 48, maxZ: 44 };
  L.spawn.set(0, 0.1, 36); L.spawnYaw = 0;
  L.maxLights = 8;

  L.floor('asphalt', 0, -74, 96, 236);
  // immeubles de bordure
  const bld = (x0: number, x1: number, z0: number, z1: number, h: number) => L.building((x0 + x1) / 2, (z0 + z1) / 2, x1 - x0, z1 - z0, h);
  bld(-48, 48, 42, 46, 22); bld(-48, -44, -192, 42, 26); bld(44, 48, -192, 42, 26); bld(-48, 48, -196, -190, 24);
  const car = (x: number, z: number, ax: boolean, c = 0x4a4f58) => L.vehicle(x, z, ax, 'car', c);
  const streetLamp = (x: number, z: number, real = false) => { L.box('darkmetal', x, 0, z, 0.2, 6, 0.2); L.box('darkmetal', x + (x < 0 ? 0.6 : -0.6), 5.9, z, 1.4, 0.12, 0.2, { collide: false }); L.lamp(x + (x < 0 ? 1.1 : -1.1), 5.82, z, 'violet', real, 16, 18); };

  // ================= A. ZONE D'INSERTION (z 42..10) =================
  bld(-44, -30, 10, 42, 18); bld(30, 44, 10, 42, 20);
  car(-18, 30, false, 0x6a3030); car(-12, 22, true, 0x3a4a5a); car(16, 28, false); car(10, 16, true, 0x5a5a40); L.vehicle(-22, 14, true, 'truck', 0x3a3f36);
  L.rubble(4, 26, 2.2); L.rubble(-6, 14, 2); L.barrier(-3, 19, true, 3); L.barrier(20, 20, false, 3); L.sandbags(6, 32, true, 4);
  L.crate(24, 34, 1.3, 0, 'olive'); L.crate(25.3, 33.6, 1, 0, 'crate'); barrel(g, L, 14, 22); barrel(g, L, -9, 28);
  L.crystalDeco(-27, 0, 36, 1.4); L.crystalDeco(27, 0, 12, 1.1, 'crystal_red');
  streetLamp(-28, 24, true); streetLamp(28, 30);
  ammo(g, L, 23, 38);

  // ================= B. AVENUE (z 10..-70) =================
  bld(-44, -13, -14, 10, 24); bld(-44, -27, -20, -14, 24); bld(-44, -13, -44, -20, 30); bld(-44, -27, -50, -44, 30); bld(-44, -13, -70, -50, 20);
  bld(13, 44, -26, 10, 28); bld(27, 44, -32, -26, 28); bld(13, 44, -58, -32, 22); bld(27, 44, -64, -58, 22); bld(13, 44, -70, -64, 26);
  // trottoirs
  L.box('concrete', -11, 0, -30, 2, 0.16, 80, { nav: false }); L.box('concrete', 11, 0, -30, 2, 0.16, 80, { nav: false });
  for (let z = 4; z > -68; z -= 12) L.box('glow_white', 0, 0.01, z, 0.18, 0.012, 4, { collide: false });
  // épaves et barricades : parcours en chicane
  car(-5, 4, false, 0x7a6030); car(4, -4, true); L.vehicle(-4, -14, false, 'truck', 0x50545a); car(6, -22, false, 0x304a3a);
  L.barrier(-7, -8, true, 4); L.barrier(7, -12, true, 3); L.rubble(8, 2, 2.4); L.rubble(-8, -24, 2.6); L.sandbags(2, -28, true, 5);
  car(-6, -40, true, 0x5a2a2a); L.vehicle(5, -46, false, 'apc', 0x2e3428); car(-3, -54, false); L.barrier(0, -50, true, 4); L.barrier(-8, -60, true, 3); L.rubble(7, -58, 2.2); L.sandbags(-4, -64, true, 4); L.sandbags(6, -66, true, 4);
  barrel(g, L, -9, -18); barrel(g, L, 8, -38); barrel(g, L, 2, -60);
  streetLamp(-11.5, -6, true); streetLamp(11.5, -18); streetLamp(-11.5, -42); streetLamp(11.5, -54, true);
  // passerelle piétonne
  L.platform('grate', 0, -34, 24, 3, 4);
  L.stairs('metal', -10.6, -26.8, 'z-', 2, 14, 0.2857, 0.4); L.stairs('metal', 10.6, -41.2, 'z+', 2, 14, 0.2857, 0.4);
  // ruelles (impasses)
  L.crate(-20, -17, 1.3); L.crate(-24, -16.4, 1.1, 0, 'olive'); L.crystalDeco(-25.5, 0, -18.5, 1); lore(g, L, 'op2_log1', -22, -18.6);
  L.crate(20, -29, 1.3, 0, 'olive'); L.crystalDeco(25.5, 0, -27.5, 1.2, 'crystal_red'); lore(g, L, 'op2_doc1', 23, -30.6);
  L.portal(-25.6, 2, -47, 1.6, 0x8a4aff, true); L.crate(-18, -46, 1.2);
  L.portal(25.6, 2, -61, 1.6, 0x8a4aff, true); ammo(g, L, 20, -61);
  // cristaux de contamination sur les façades
  for (const [x, y, z] of [[-12.6, 6, -8], [12.6, 9, -40], [-12.6, 12, -56], [12.6, 5, 0]]) L.deco(mat('crystal'), new THREE.OctahedronGeometry(1, 0), x, y, z, 0.4, x, 0.9, 0.8, 2.4, 0.8);

  // ================= C. PLACE DU MÉTRO (z -70..-112) =================
  bld(-44, -30, -112, -70, 22); bld(30, 44, -112, -70, 24);
  L.box('concrete', 0, 0, -91, 60, 0.12, 42, { nav: false });
  car(-20, -78, true, 0x3a4a5a); car(18, -84, false, 0x6a3030); L.vehicle(-18, -92, false, 'truck', 0x3a3f36);
  L.barrier(-8, -80, true, 4); L.barrier(8, -80, true, 4); L.sandbags(-5, -88, true, 4); L.sandbags(5, -88, true, 4); L.sandbags(-13, -94, false, 4); L.sandbags(13, -94, false, 4);
  L.crate(-24, -100, 1.3); L.crate(24, -76, 1.3, 0, 'olive'); L.rubble(22, -98, 2.4); L.deadTree(-24, -84, 6); L.deadTree(24, -90, 5);
  barrel(g, L, -16, -84); barrel(g, L, 15, -100);
  streetLamp(-28, -90, true); streetLamp(28, -80);
  // station
  L.enclosure('concrete', -12, -112, 12, -99, 6, []);
  L.roof('darkconcrete', -12, -112, 12, -99, 6);
  L.box('darkmetal', 0, 0, -98.7, 6, 3.4, 0.2, { collide: false });
  L.box('hazard', 0, 3.4, -98.6, 6.4, 0.3, 0.3, { collide: false });
  L.sign('MÉTRO — STATION KELLNER', 0, 5, -98.6, 'z+', '#e8d85a', 7);
  const interPos = L.terminal(5, -97.9, 'z+');
  const barrGrp = new THREE.Group();
  for (const [x, y, w] of [[0, 0.5, 6], [-1.2, 1.4, 3], [1.4, 1.5, 2.6], [0, 2.2, 5]] as [number, number, number][]) { const b = new THREE.Mesh(new THREE.BoxGeometry(w, 0.8, 0.5), y > 1 ? mat('rust') : mat('crate')); b.position.set(x, y, 0); b.rotation.z = (x * 0.05); b.castShadow = true; barrGrp.add(b); }
  const barricade = L.destructible(barrGrp, 700, 0, 0, -97.6, 6.4, 2.8, 0.8, 'metal');
  barricade.invulnerable = true;
  lore(g, L, 'op2_term1', -9, -97.9);
  ammo(g, L, 9, -96.5);
  // grilles vers la place du portail
  const gateW = L.door(-21, -112, true, 18, 5, 'rust'); const gateE = L.door(21, -112, true, 18, 5, 'rust');

  // ================= D. PLACE DU PORTAIL (z -112..-166) =================
  bld(-44, -30, -166, -112, 26); bld(30, 44, -166, -112, 22);
  L.box('ash', 0, 0, -140, 60, 0.1, 54, { nav: false });
  const portal = L.portal(0, 5.6, -152, 5.2, 0x9a4aff);
  L.lamp(0, 5.6, -150.5, 'violet', true, 80, 46);
  for (let i = 0; i < 12; i++) { const a = i * 0.9, r = 7 + (i % 4) * 2.2; L.crystalDeco(Math.cos(a) * r * 1.4, 0, -154 + Math.sin(a) * 4 - 2, 0.8 + (i % 3) * 0.5, i % 3 === 0 ? 'crystal_red' : 'crystal'); }
  car(-16, -120, true); car(14, -124, false, 0x5a5a40); L.vehicle(-22, -134, false, 'apc', 0x2e3428); L.vehicle(20, -140, true, 'truck', 0x50545a);
  L.barrier(-6, -124, true, 4); L.barrier(6, -130, true, 4); L.sandbags(0, -118, true, 5); L.rubble(-10, -132, 2.6); L.rubble(11, -118, 2.2); L.barrier(-14, -144, false, 3); L.barrier(14, -146, false, 3);
  L.column(-8, -138, 5, 0.7, 'concrete', true); L.column(8, -138, 6, 0.7);
  barrel(g, L, -18, -126); barrel(g, L, 18, -132);
  const anchors = [L.crystal(-17, 0, -148, 260, 1.5, 'crystal_red'), L.crystal(17, 0, -148, 260, 1.5, 'crystal_red'), L.crystal(0, 0, -134, 260, 1.5, 'crystal_red')];
  for (const a of anchors) a.invulnerable = true;
  ammo(g, L, -26, -116); ammo(g, L, 26, -160);

  // ================= E. EXTRACTION (z -166..-190) =================
  bld(-44, -11, -190, -166, 24); bld(11, 44, -190, -166, 24);
  car(-4, -172, false, 0x6a3030); L.barrier(4, -176, true, 3); L.rubble(-5, -180, 2);
  L.box('hazard', 0, 0, -185, 8, 0.12, 6, { nav: false });
  dressOp2(L);
  L.finish();

  // ================= ENNEMIS =================
  m.spawn('street', [
    ['grunt', -6, 0, { patrol: [V(-6, 0), V(6, -8)] }], ['grunt', 8, -10], ['grunt', -8, -20], ['devourer', -20, -17.5], ['devourer', -17, -16],
    ['sniper', 0, -34, { static: true, y: 4.1 }], ['grunt', 4, -30], ['caster', -5, -44], ['grunt', 8, -50], ['breaker', 0, -56],
    ['devourer', 20, -30], ['grunt', -8, -66], ['commander', 3, -67], ['grunt', 9, -62],
  ]);
  m.trigger(0, -20, 9, () => { m.say(ORACLE, 'Faille active dans la ruelle ! L’Essaim traverse !'); m.portalSpawn('street', [['devourer', -19, -46], ['devourer', -17, -48], ['devourer', 19, -60]]); });
  m.trigger(0, -46, 9, () => { m.portalSpawn('street', [['drone', -6, -62], ['drone', 6, -58]]); });

  // ================= OBJECTIFS =================
  m.say(REYES, 'Bienvenue à Varsen. Quatre cent mille habitants avant la Fracture. Sécurisez la zone d’insertion.');
  m.kill('Sécuriser la zone d’insertion', 'lz', [['grunt', -10, 26], ['grunt', 8, 20], ['grunt', -4, 14, { patrol: [V(-4, 14), V(12, 14)] }], ['grunt', 20, 26], ['devourer', -24, 20], ['devourer', 24, 16], ['grunt', -16, 14]], {
    onDone: () => { m.say(ORACLE, 'Zone sécurisée. Le signal de détresse vient de la station Kellner, au bout de l’avenue. Attention aux toits.'); },
  });
  m.reach('Traverser les rues jusqu’à la place du métro', 0, -74, 7, { onDone: () => { m.say(REYES, 'Vous y êtes. La station est barricadée de l’intérieur. Utilisez l’interphone.'); } });
  m.interact('Localiser les survivants', interPos, 'Interphone — contacter la station', {
    onDone: () => {
      m.say(MAREK, 'Ici le Dr Lena Marek. Nous sommes onze. Il nous faut une minute pour ouvrir le tunnel d’évacuation… et ils savent que nous sommes là.');
      m.say(REYES, 'Vous l’avez entendue. Tenez cette barricade, Warbound. Ne laissez pas les Dévoreurs l’atteindre.');
    },
  }, 0.8);
  const siege = (specs: [string, number, number][]): SpawnSpec[] => specs.map(([k, x, z]) => [k as any, x, z, k === 'devourer' ? { siege: V(0, -95.5) } : {}]);
  m.defend('Défendre la position des survivants', 'ÉVACUATION', 60, [
    { at: 2, specs: siege([['devourer', -24, -76], ['devourer', 24, -76], ['grunt', 0, -73]]) },
    { at: 13, specs: siege([['devourer', -26, -104], ['devourer', 26, -104], ['devourer', -6, -73], ['grunt', 20, -74]]) },
    { at: 25, specs: siege([['devourer', -24, -80], ['devourer', 24, -86], ['caster', -18, -74], ['grunt', 8, -73], ['drone', 0, -76]]) },
    { at: 38, specs: siege([['devourer', -26, -100], ['devourer', 26, -78], ['devourer', 0, -72], ['breaker', -10, -74]]) },
    { at: 49, specs: siege([['devourer', -22, -76], ['devourer', 22, -104], ['devourer', 10, -73], ['grunt', -8, -73], ['drone', 16, -80]]) },
  ], 'siege', {
    marker: V(0, -95.5), checkpoint: new THREE.Vector3(0, 0.1, -90), checkpointYaw: Math.PI,
    onDone: () => {
      barricade.invulnerable = true;
      L.openDoor(gateW); L.openDoor(gateE); g.audio.door(V(0, -112));
      m.say(MAREK, 'Le tunnel est ouvert, nous partons ! Écoutez-moi : le portail derrière la station tient grâce à trois ancres cristallines. Brisez-les et il s’effondrera.');
      m.say(ORACLE, 'Les grilles latérales sont ouvertes. Signature d’élite près du portail : un Commandant d’escouade.');
      m.spawn('square', [['commander', 0, -126], ['grunt', -8, -122], ['grunt', 8, -128], ['breaker', -4, -136], ['caster', 12, -142], ['sniper', -22, -150, { static: true }], ['grunt', 20, -120]]);
    },
  }, barricade);
  let spawnT = 4;
  m.destroy('Détruire le portail — briser les trois ancres', anchors, {
    update: (dt) => {
      // le portail déverse l'Essaim tant qu'il tient
      spawnT -= dt;
      if (spawnT <= 0 && m.alive('swarm') < 6) { spawnT = 9; m.portalSpawn('swarm', [['devourer', -4 + Math.random() * 8, -146], ['devourer', -6 + Math.random() * 12, -144]], 0.8); }
    },
    onDone: () => {
      portal.visible = false;
      g.fx.explosion(new THREE.Vector3(0, 5.6, -152), 9, 0x9a4aff); g.audio.explosion(null, 1.4); g.player.shakeAmt = 1;
      for (const e of g.enemies) if (e.alive && e.group === 'swarm') e.takeDamage(99999, { source: 'world', type: 'explosion' });
      L.beacon(0, -185, 0x3aff8a);
      m.say(REYES, 'Portail effondré ! Marek et les civils sont en route vers nos lignes. Extraction au bout de la rue nord — et gardez la tête baissée.');
      m.portalSpawn('exit', [['drone', -4, -170], ['drone', 4, -174], ['grunt', 0, -178]]);
    },
  });
  m.reach('Atteindre le point d’extraction', 0, -185, 4, { onDone: () => { m.say(MAREK, 'Opérateur… merci. Je sais où Voss veut aller ensuite. Un temple. Je vous dirai tout.'); } });
  return L;
}
