// OPÉRATION 1 — CENDRES : complexe de recherche HELIX, laboratoire souterrain et Gardien d'Helix.
import * as THREE from 'three';
import type { Game } from '../core/Game';
import type { Mission } from '../mission/Mission';
import { Level } from '../world/Level';
import { backdrop } from '../world/Detail';
import { dressOp1 } from './dress';
import { Guardian } from '../ai/Boss';
import { ammo, barrel, lore, tank, REYES, ORACLE } from './common';

const V = (x: number, z: number) => new THREE.Vector3(x, 0, z);

export function buildOp1(g: Game, m: Mission): Level {
  const L = new Level('op1', 'Site Cendres', { skyTop: 0x242e40, skyHorizon: 0xc89064, fog: 0x46423f, fogDensity: 0.010, sun: 0xffc494, sunIntensity: 3.6, sunDir: [-0.8, 0.34, 0.3], hemiSky: 0x8a9cb8, hemiGround: 0x44382c, hemiIntensity: 1.25, wet: 0.55, storm: 0.45, mist: 0.4, rays: 0.6, exposure: 1.2, gradeShadow: 0x7896b0, gradeLight: 0xffe4c0, weather: 'ash' });
  L.theme = 'helix';
  m.level = L;
  L.bounds = { minX: -44, minZ: -174, maxX: 44, maxZ: 46 };
  L.spawn.set(0, 0.1, 38); L.spawnYaw = 0;
  L.maxLights = 9;

  // ================= EXTÉRIEUR =================
  L.floor('dirt', 0, 2, 88, 88);
  L.box('asphalt', 0, -0.98, 12, 8, 1, 68, { nav: false });
  L.enclosure('concrete_damaged', -43, -41, 43, 45, 7, [], 1);
  // zone d'insertion
  L.vehicle(-9, 30, false, 'truck', 0x3a3f36); L.vehicle(8, 22, true, 'apc', 0x2e3428);
  L.deadTree(-18, 34, 6); L.deadTree(20, 30, 5); L.deadTree(-26, 20, 7); L.deadTree(28, 16, 6); L.deadTree(14, 38, 5);
  L.rubble(-14, 20, 2.4); L.rubble(16, 14, 2); L.rubble(-30, 34, 3);
  L.barrier(-5.5, 15, true, 3); L.barrier(5.5, 15, true, 3); L.sandbags(-9, 12, true, 4); L.sandbags(9, 12, true, 4);
  L.crate(-7, 26, 1.2); L.crate(-6, 27.2, 1, 0, 'olive'); L.barrelDeco(4, 27);
  // enceinte et portail
  L.wallDoor('concrete_damaged', -43, 8, 43, 8, 6, 0, 7, 5, 0.8);
  L.box('hazard', -3.9, 0, 8, 0.5, 5, 1, { collide: false }); L.box('hazard', 3.9, 0, 8, 0.5, 5, 1, { collide: false });
  L.box('glow_red', 0, 5.2, 8.45, 5, 0.25, 0.06, { collide: false });
  L.sign('HELIX — SITE CENDRES', 0, 5.6, 8.5, 'z+', '#ff8a5a', 6);
  // miradors
  L.platform('grate', -13, 3, 5, 5, 4); L.stairs('metal', -13, -4.7, 'z+', 2, 13, 0.3, 0.4);
  L.platform('grate', 13, 3, 5, 5, 4); L.stairs('metal', 13, -4.7, 'z+', 2, 13, 0.3, 0.4);
  // cour
  L.container(-8, -6, true, 'container_red'); L.container(-8, -9, true, 'container_blue'); L.container(-8, -7.5, true, 'container_green', 2.6);
  L.container(9, -20, false, 'container_blue'); L.container(4, -30, true, 'container_red');
  L.sandbags(0, -14, true, 5); L.sandbags(-12, -24, false, 4); L.barrier(12, -8, true, 3); L.barrier(-3, -26, true, 3); L.barrier(14, -33, true, 3);
  L.crate(-14, -14, 1.3); L.crate(-15.2, -13.6, 1, 0, 'olive'); L.crate(2, -5, 1.2); L.crate(16, -14, 1.4, 0, 'olive');
  L.vehicle(-2, -34.5, true, 'car', 0x4a4f58);
  barrel(g, L, 6, -12); barrel(g, L, -5, -22); barrel(g, L, 12, -27);
  L.tent(-28, -2, 6, 5); L.table(-28, -2, 2.4, 1);
  for (const [x, z] of [[-20, 2], [20, 2], [-18, -36], [18, -36]]) { L.box('darkmetal', x, 0, z, 0.25, 5.5, 0.25); L.lamp(x, 5.6, z, 'orange', false); }
  L.lamp(0, 4.9, 7.4, 'orange', true, 40, 30);
  // bâtiment du générateur (est)
  L.floor('darkconcrete', 30, -19, 18, 22, 0.03, 0.03);
  L.enclosure('concrete', 21, -30, 39, -8, 5, [{ side: 'w', at: -19, gap: 3 }]);
  L.roof('darkmetal', 21, -30, 39, -8, 5);
  L.zones.push({ minX: 21, minZ: -30, maxX: 39, maxZ: -8, light: 0.4 });
  L.machine(33, -19, 5, 7, 3.6, 'glow_orange'); L.pipe(33, 3.8, -19, 33, 4.9, -19, 0.5); L.pipe(36, 1, -27, 36, 1, -11, 0.25); L.pipe(30, 4.5, -29, 30, 4.5, -9, 0.2);
  L.locker(24, -29.2, true, 4); L.crate(25, -10, 1.2); barrel(g, L, 37, -10.5);
  const genPos = L.terminal(28.5, -19, 'x-');
  L.lamp(27, 4.9, -19, 'red', true, 30, 18);
  // baraquements (ouest)
  L.floor('darkconcrete', -30, -20, 18, 20, 0.03, 0.03);
  L.enclosure('concrete', -39, -30, -21, -10, 4.5, [{ side: 'e', at: -20, gap: 3 }]);
  L.roof('darkmetal', -39, -30, -21, -10, 4.5);
  L.zones.push({ minX: -39, minZ: -30, maxX: -21, maxZ: -10, light: 0.4 });
  for (const z of [-27, -23, -17, -13]) { L.box('fabric', -36.5, 0.4, z, 2, 0.25, 1, { collide: false }); L.collider(-36.5, 0, z, 2, 0.65, 1, 'dirt'); L.box('darkmetal', -36.5, 0, z, 2.1, 0.4, 1.1, { collide: false }); }
  L.locker(-26, -29.2, true, 5); L.table(-28, -15, 2, 1);
  L.lamp(-30, 4.4, -20, 'white', true, 28, 18);
  lore(g, L, 'op1_log1', -28, -15.2, 0.05);
  ammo(g, L, -24, -12);

  // ================= LABORATOIRE =================
  L.floor('tiles', 0, -107.5, 88, 133);
  L.enclosure('concrete', -43, -173, 43, -41, 6, [], 1);
  L.wallDoor('concrete', -43, -40, 43, -40, 6.5, 0, 4, 3.4, 1);
  const labDoor = L.door(0, -40, true, 4, 3.4);
  const labTerm = L.terminal(4.2, -38.6, 'z+');
  L.sign('ACCÈS LABORATOIRE', 0, 4.4, -39.4, 'z+', '#ff8a5a', 4.4);
  // hall d'entrée
  L.enclosure('darkconcrete', -14, -60, 14, -40.5, 5.5, [{ side: 'n', at: 0, gap: 3 }, { side: 's', at: 0, gap: 4, h: 3.4 }]);
  L.roof('darkmetal', -14, -60, 14, -40.5, 5.5);
  L.zones.push({ minX: -14, minZ: -60, maxX: 14, maxZ: -40.5, light: 0.32 });
  L.table(-6, -47, 4, 1.2); L.table(6, -52, 1.2, 4); L.locker(-13.2, -56, false, 5); L.locker(13.2, -46, false, 4);
  L.column(-7, -54, 5.5, 0.5, 'darkconcrete'); L.column(7, -46, 5.5, 0.5, 'darkconcrete');
  L.crate(10, -57, 1.2); L.crate(-10, -43, 1.2, 0, 'olive'); L.barrier(0, -53, true, 3);
  L.lamp(0, 5.4, -50, 'white', true, 40, 24); L.lamp(-9, 5.4, -44, 'white', false); L.lamp(9, 5.4, -56, 'white', false);
  lore(g, L, 'op1_term1', -11.5, -58.6);
  // couloir
  L.enclosure('darkconcrete', -3, -72, 3, -60, 4.5, [{ side: 'n', at: 0, gap: 3 }, { side: 's', at: 0, gap: 3 }]);
  L.roof('darkmetal', -3, -72, 3, -60, 4.5);
  L.zones.push({ minX: -3, minZ: -72, maxX: 3, maxZ: -60, light: 0.22 });
  L.pipe(-2.6, 3.8, -71.5, -2.6, 3.8, -60.5, 0.18); L.pipe(2.6, 3.4, -71.5, 2.6, 3.4, -60.5, 0.12, 'metal');
  L.lamp(0, 4.4, -66, 'red', false);
  // atrium
  L.enclosure('darkconcrete', -22, -106, 22, -72, 6, [{ side: 's', at: 0, gap: 3 }, { side: 'n', at: 0, gap: 5, h: 4 }, { side: 'w', at: -88, gap: 3 }, { side: 'e', at: -88, gap: 3 }]);
  L.roof('darkmetal', -22, -106, 22, -72, 6);
  L.zones.push({ minX: -22, minZ: -106, maxX: 22, maxZ: -72, light: 0.3 });
  tank(L, -10, -80); tank(L, 10, -80); tank(L, -14, -96, 'crystal_red'); tank(L, 14, -96);
  L.machine(-19, -76, 3, 2, 3, 'glow_violet'); L.machine(19, -76, 3, 2, 3, 'glow_violet'); L.machine(-19, -102, 3, 2, 3, 'glow_blue');
  L.barrier(-5, -84, true, 3); L.barrier(5, -90, true, 3); L.crate(0, -80, 1.3); L.crate(-17, -88, 1.2, 0, 'olive'); L.crate(17, -84, 1.2);
  L.table(8, -100, 3, 1.2);
  L.box('darkmetal', 0, 0, -97, 3, 0.3, 3, { nav: false });
  const dataPos = L.terminal(0, -97.6, 'z+');
  L.box('glow_blue', 0, 0.3, -97, 2.6, 0.05, 2.6, { collide: false });
  L.lamp(0, 5.9, -82, 'white', true, 45, 28); L.lamp(0, 5.9, -98, 'blue', true, 40, 26); L.lamp(-15, 5.9, -90, 'violet', false); L.lamp(15, 5.9, -90, 'violet', false);
  const bossDoor = L.door(0, -106, true, 5, 4, 'metal');
  // salles des conduits
  L.enclosure('darkconcrete', -41, -99, -22.5, -77, 5, [{ side: 'e', at: -88, gap: 3 }]);
  L.roof('darkmetal', -41, -99, -22.5, -77, 5);
  L.enclosure('darkconcrete', 22.5, -99, 41, -77, 5, [{ side: 'w', at: -88, gap: 3 }]);
  L.roof('darkmetal', 22.5, -99, 41, -77, 5);
  L.zones.push({ minX: -41, minZ: -99, maxX: -22, maxZ: -77, light: 0.25 }, { minX: 22, minZ: -99, maxX: 41, maxZ: -77, light: 0.25 });
  L.crate(-28, -80, 1.3); L.barrier(-30, -90, false, 3); L.machine(-39, -92, 2, 3, 2.6, 'glow_orange'); L.pipe(-34, 4.6, -98, -34, 4.6, -78, 0.3);
  L.crate(28, -96, 1.3, 0, 'olive'); L.barrier(30, -86, false, 3); L.machine(39, -84, 2, 3, 2.6, 'glow_orange'); L.pipe(34, 4.6, -98, 34, 4.6, -78, 0.3);
  L.lamp(-32, 4.9, -88, 'orange', true, 30, 20); L.lamp(32, 4.9, -88, 'orange', true, 30, 20);
  const conduits = [L.conduit(-35, -88, 200), L.conduit(35, -88, 200), L.conduit(16, -103, 200)];
  for (const c of conduits) c.invulnerable = true;
  lore(g, L, 'op1_doc1', 38.5, -95);
  ammo(g, L, -18, -74.5);

  // ================= SALLE DU RÉACTEUR (boss) =================
  L.enclosure('darkmetal', -27, -166, 27, -106.5, 12, [{ side: 's', at: 0, gap: 5, h: 4 }], 1);
  L.roof('darkmetal', -27, -166, 27, -106.5, 12);
  L.zones.push({ minX: -27, minZ: -166, maxX: 27, maxZ: -106.5, light: 0.38 });
  for (const [x, z] of [[-13, -122], [13, -122], [-13, -150], [13, -150]]) L.column(x, z, 12, 1.2, 'darkmetal');
  for (const s of [-1, 1]) { L.box('glow_orange', s * 26.4, 3, -136, 0.1, 0.2, 56, { collide: false }); L.box('hazard', s * 26.3, 0, -136, 0.3, 0.8, 56, { collide: false }); }
  L.deco(new THREE.MeshStandardMaterial({ color: 0x1a1c20, metalness: 0.8, roughness: 0.4 }), new THREE.CylinderGeometry(6, 6, 0.12, 24), 0, 0.06, -136);
  L.box('glow_orange', 0, 0.12, -136, 0.3, 0.02, 12, { collide: false }); L.box('glow_orange', 0, 0.12, -136, 12, 0.02, 0.3, { collide: false });
  L.lamp(-14, 11.8, -136, 'orange', true, 90, 44); L.lamp(14, 11.8, -136, 'orange', true, 90, 44);
  L.barrier(-20, -116, true, 3); L.barrier(20, -116, true, 3); L.barrier(-20, -158, true, 3); L.barrier(20, -158, true, 3);
  const bossConduits = [L.conduit(-22, -136, 260, 'glow_blue'), L.conduit(22, -136, 260, 'glow_blue')];
  for (const c of bossConduits) c.invulnerable = true;
  ammo(g, L, -24, -110); ammo(g, L, 24, -162);
  L.box('hazard', 0, 0, -163.5, 6, 0.15, 4, { nav: false });
  backdrop(L, 'industrial');
  dressOp1(L);
  L.finish();

  // ================= ENNEMIS INITIAUX =================
  m.spawn('gate', [['grunt', -4, 13, { patrol: [V(-4, 13), V(4, 13)] }], ['grunt', 3, 18]]);
  m.spawn('court', [
    ['grunt', -3, -4, { patrol: [V(-3, -4), V(8, -4), V(8, -16), V(-3, -16)] }], ['grunt', 5, -18], ['grunt', -14, -18, { patrol: [V(-14, -18), V(-14, -32), V(0, -32)] }],
    ['grunt', 14, -30], ['grunt', -2, -24], ['grunt', 16, -6],
    ['sniper', 13, 3, { static: true, y: 4.1 }],
    ['grunt', -30, -24], ['grunt', -32, -16],
  ]);

  // ================= OBJECTIFS =================
  m.say(REYES, 'Warbound, ici Reyes. Le Site Cendres est droit devant. Aucun contact radio depuis onze jours.');
  m.say(ORACLE, 'Signatures thermiques multiples dans la cour. Ce sont des soldats HELIX… ou ce qu’il en reste.');
  m.reach('Atteindre le complexe HELIX', 0, 7, 5, { onDone: () => { m.say(REYES, 'Vous êtes à l’intérieur. Nettoyez la cour. Attention au tireur sur le mirador est.'); } });
  m.kill('Neutraliser les soldats corrompus', 'court', null, { onDone: () => { m.say(ORACLE, 'Cour sécurisée. Le laboratoire est verrouillé : plus de courant. Le générateur est dans le bâtiment est.'); } });
  m.interact('Réactiver l’alimentation du générateur', genPos, 'Réactiver le générateur', {
    onDone: () => {
      g.audio.door(genPos); g.audio.alarm();
      m.say(ORACLE, 'Courant rétabli. Mauvaise nouvelle : ça a réveillé quelque chose. Contacts en approche, dont des drones !');
      m.portalSpawn('ambush', [['grunt', -4, -30], ['grunt', 6, -34], ['grunt', -13, -12], ['drone', 0, -20], ['drone', 10, -12]]);
    },
  }, 1.5);
  m.interact('Ouvrir l’accès au laboratoire', labTerm, 'Déverrouiller la porte du laboratoire', {
    onDone: () => {
      L.openDoor(labDoor); g.audio.door(V(0, -40));
      m.spawn('hall', [['grunt', -8, -50], ['grunt', 8, -56], ['grunt', 0, -57], ['breaker', 0, -47]]);
      m.spawn('atrium', [['caster', -8, -92], ['caster', 9, -86], ['grunt', -16, -82], ['grunt', 16, -92], ['grunt', 0, -86, { patrol: [V(0, -86), V(-10, -100), V(10, -100)] }], ['grunt', 4, -76], ['drone', -6, -80], ['drone', 6, -94]]);
      m.say(REYES, 'Porte ouverte. Le laboratoire est sous vos pieds depuis le début : descendez et trouvez le terminal central.');
      m.say(ORACLE, 'Un Briseur de ligne dans le hall. Son bouclier arrête les balles : contournez-le ou visez la tête.');
    },
  }, 1.0);
  m.interact('Récupérer les données scientifiques', dataPos, 'Lancer l’extraction des données', {
    onDone: () => { m.say(ORACLE, 'Téléchargement lancé. Les données parlent d’un « projet Souverain »… Tenez la position, ils arrivent par les ailes !'); },
  }, 1.0);
  m.defend('Défendre le terminal pendant le téléchargement', 'TÉLÉCHARGEMENT', 40, [
    { at: 2, specs: [['devourer', -18, -88], ['devourer', 18, -88], ['devourer', 0, -76]] },
    { at: 14, specs: [['devourer', -18, -90], ['devourer', 18, -86], ['grunt', -4, -75], ['grunt', 4, -75]] },
    { at: 26, specs: [['devourer', -16, -100], ['devourer', 16, -78], ['devourer', 0, -75], ['caster', 12, -76]] },
  ], 'download', { marker: dataPos, checkpoint: new THREE.Vector3(0, 0.1, -92), onDone: () => { m.say(ORACLE, 'Données récupérées. Trois conduits alimentent la contamination du site. Détruisez-les.'); } });
  m.destroy('Détruire les conduits d’énergie', conduits, {
    start: () => { m.spawn('conduits', [['grunt', -30, -84], ['grunt', -36, -94], ['caster', -28, -94], ['breaker', 30, -88], ['grunt', 36, -82], ['grunt', 28, -94]]); },
    onDone: () => {
      L.openDoor(bossDoor); g.audio.door(V(0, -106)); g.audio.bossRoar(V(0, -136));
      m.say(REYES, 'Conduits détruits. La salle du réacteur vient de se déverrouiller… et quelque chose d’énorme s’y active.');
    },
  });
  m.reach('Entrer dans la salle du réacteur', 0, -114, 6, { checkpoint: new THREE.Vector3(0, 0.1, -102), checkpointYaw: 0 });
  m.bossFight('Affronter le Gardien d’Helix', () => {
    const b = new Guardian(g, 0, -142);
    b.arena.set(0, 0, -136); b.arenaR = 22; b.conduits = bossConduits;
    for (const c of bossConduits) { c.revive(260); c.invulnerable = true; }
    b.onPhase = (n) => {
      if (n === 2) m.say(ORACLE, 'Il puise dans les deux conduits bleus pour alimenter son bouclier ! Détruisez-les pour le rendre vulnérable !');
      if (n === 3) m.say(ORACLE, 'Réacteur instable ! Il ouvre des brèches — des Dévoreurs arrivent. Finissez-le !');
    };
    return b;
  }, {
    start: () => { m.say(REYES, 'Prototype HX-9, le Gardien d’Helix. Sautez par-dessus ses ondes de choc et sortez des zones marquées au sol !'); },
    checkpoint: new THREE.Vector3(0, 0.1, -112),
    onDone: () => { L.beacon(0, -163.5, 0x3aff8a); m.say(REYES, 'Gardien neutralisé. Magnifique travail. Rejoignez la plateforme d’extraction au fond de la salle.'); },
  });
  m.reach('Extraire les données', 0, -163.5, 3, { onDone: () => { m.say(REYES, 'Extraction confirmée. On rentre à Fort Aegis.'); } });
  return L;
}
