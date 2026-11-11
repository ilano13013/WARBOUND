// FORT AEGIS — quartier général : stations interactives et zone d'entraînement.
import * as THREE from 'three';
import type { Game } from '../core/Game';
import type { Mission } from '../mission/Mission';
import { Level } from '../world/Level';
import { dressHub } from './dress';
import { cmat, mat } from '../render/Materials';
import { buildOperatorModel } from '../ai/EnemyModels';
import { buildOperatorRig } from '../ai/EnemyRigs';
import { MISSION_BY_ID } from '../data/missions';

export function buildHub(g: Game, m: Mission): Level {
  const L = new Level('hub', 'Fort Aegis', { skyTop: 0x1a2436, skyHorizon: 0x6a7686, fog: 0x2a323c, fogDensity: 0.008, sun: 0xffe6c0, sunIntensity: 2.2, sunDir: [0.4, 0.8, -0.3], hemiSky: 0x9ab0c8, hemiGround: 0x2a2a28, hemiIntensity: 0.9 });
  m.level = L;
  L.maxLights = 9;
  L.bounds = { minX: -24, minZ: -58, maxX: 24, maxZ: 28 };
  L.spawn.set(0, 0.1, 19); L.spawnYaw = 0;

  // ---- hangar principal ----
  L.floor('darkconcrete', 0, 1, 44, 50);
  L.enclosure('concrete', -21, -22, 21, 25, 8, [{ side: 'n', at: 0, gap: 5, h: 3.6 }]);
  L.roof('darkmetal', -21, -22, 21, 25, 8);
  L.zones.push({ minX: -21, minZ: -22, maxX: 21, maxZ: 25, light: 0.55, name: 'Hangar' });
  for (const x of [-12, 0, 12]) for (const z of [-12, 2, 16]) L.lamp(x, 7.9, z, 'white', (x === 0 || z === 2), 26, 22);
  for (const x of [-20.6, 20.6]) for (const z of [-16, -4, 8, 20]) L.box('hazard', x, 0, z, 0.3, 0.5, 3, { collide: false });
  for (const z of [-21.6, 24.6]) L.box('glow_blue', 0, 6.2, z, 30, 0.08, 0.1, { collide: false });
  // poutres
  for (const z of [-14, -4, 6, 16]) L.box('darkmetal', 0, 7.2, z, 42, 0.5, 0.4, { collide: false });
  // porte du hangar (décor) et véhicule
  L.box('metal', 0, 0, 24.7, 14, 6, 0.3, { collide: false });
  L.box('hazard', 0, 0, 24.5, 14.4, 0.4, 0.2, { collide: false });
  L.vehicle(-10, 19, true, 'apc', 0x39422e);
  L.vehicle(11, 20, true, 'truck', 0x39422e);
  L.crate(5, 21.5, 1.3, 0, 'olive'); L.crate(6.4, 21.3, 1.1, 0, 'crate'); L.crate(5.6, 21.4, 1, 1.3, 'crate');
  L.barrelDeco(-4, 22.5, 'rust'); L.barrelDeco(-4.9, 22.2, 'rust');

  // ---- table tactique (centre) ----
  L.deco(mat('darkmetal'), new THREE.CylinderGeometry(2.2, 2.5, 0.9, 8), 0, 0.45, 0);
  L.collider(0, 0, 0, 3.8, 0.95, 3.8, 'metal');
  const holo = new THREE.Mesh(new THREE.CylinderGeometry(1.9, 1.9, 0.04, 8), new THREE.MeshBasicMaterial({ color: 0x3ad0ff, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false }));
  holo.position.set(0, 0.95, 0); L.root.add(holo);
  const globe = new THREE.Mesh(new THREE.IcosahedronGeometry(0.75, 1), new THREE.MeshBasicMaterial({ color: 0x5ad8ff, wireframe: true, transparent: true, opacity: 0.7 }));
  globe.position.set(0, 2.0, 0); L.root.add(globe);
  const rift = new THREE.Mesh(new THREE.OctahedronGeometry(0.16, 0), new THREE.MeshBasicMaterial({ color: 0xb06aff }));
  rift.position.set(0.5, 2.5, 0.4); L.root.add(rift);
  L.updaters.push((dt, t) => { globe.rotation.y += dt * 0.4; rift.position.set(Math.cos(t * 0.4) * 0.8, 2.0 + Math.sin(t) * 0.3, Math.sin(t * 0.4) * 0.8); });
  L.lamp(0, 3.4, 0, 'blue', true, 12, 12);
  L.sign('TABLE TACTIQUE', 0, 3.6, 0, 'z+', '#4ad8ff', 3.4);
  L.interact(new THREE.Vector3(0, 1.2, 0), 'Table tactique — choisir une opération', () => g.ui.panels.missions(), 4.2);

  // ---- armurerie (ouest) ----
  L.box('darkmetal', -19.5, 0, 8, 2, 3.2, 9);
  for (let i = 0; i < 5; i++) { L.box('black', -18.4, 1.0 + (i % 2) * 0.9, 4.6 + i * 1.7, 0.12, 0.14, 1.2, { collide: false }); L.box('olive', -18.42, 0.95 + (i % 2) * 0.9, 4.6 + i * 1.7, 0.1, 0.3, 0.3, { collide: false }); }
  L.box('glow_orange', -18.45, 2.9, 8, 0.06, 0.08, 8.6, { collide: false });
  L.table(-15.5, 8, 1.2, 4);
  L.crate(-15.5, 7, 0.5, 0.94, 'olive'); L.crate(-15.4, 9, 0.4, 0.94, 'crate');
  L.locker(-19.9, 14.5, false, 4);
  const armP = L.terminal(-16.5, 3.4, 'z-');
  L.sign('ARMURERIE', -18.3, 3.8, 8, 'x+', '#ffb04a', 3.4);
  L.interact(armP, 'Armurerie — armes et accessoires', () => g.ui.panels.armory(), 3.2);
  const ammoP = L.ammoCrate(-14, 13);
  L.interact(ammoP, 'Caisse de munitions — réapprovisionner', () => { g.weapons.refill(1); g.player.grenades = 2; g.audio.reload(2); g.ui.hud.toast('MUNITIONS RÉAPPROVISIONNÉES', '#ffb04a'); }, 2.6);

  // ---- terminal de personnage (ouest, nord) ----
  const charP = L.terminal(-19.6, -8, 'x+');
  L.machine(-19.6, -11, 1.2, 2, 2.8, 'glow_green'); L.machine(-19.6, -5, 1.2, 2, 2.8, 'glow_green');
  L.sign('DOSSIER OPÉRATEUR', -20.6, 3.6, -8, 'x+', '#5af0a0', 3.4);
  L.interact(charP, 'Terminal de personnage — statistiques et talents', () => g.ui.panels.character('talents'), 3.2);

  // ---- atelier arcanique (est) ----
  L.machine(19.4, 8, 1.6, 5, 3, 'glow_violet');
  L.table(16.2, 8, 1.4, 3.4);
  L.crystalDeco(19.2, 3, 4.6, 0.45); L.crystalDeco(19.3, 3, 11.4, 0.4, 'crystal_red');
  const forge = new THREE.Mesh(new THREE.OctahedronGeometry(0.28, 0), mat('crystal'));
  forge.position.set(16.2, 1.5, 8); L.root.add(forge);
  const fr = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.025, 6, 28), mat('glow_violet')); fr.position.copy(forge.position); L.root.add(fr);
  L.updaters.push((dt, t) => { forge.rotation.y += dt * 1.5; forge.position.y = 1.5 + Math.sin(t * 2) * 0.06; fr.rotation.x = t; fr.rotation.y = t * 0.7; });
  L.lamp(16.2, 3.2, 8, 'violet', true, 10, 10);
  L.sign('ATELIER ARCANIQUE', 20.6, 3.8, 8, 'x-', '#b06aff', 3.4);
  L.interact(new THREE.Vector3(15.2, 1.2, 8), 'Atelier arcanique — améliorer l’équipement', () => g.ui.panels.workshop(), 3.2);

  // ---- terminal de survie (est, nord) ----
  L.box('darkmetal', 19.6, 0, -8, 1.4, 0.3, 5);
  L.portal(19.9, 2.3, -8, 1.7, 0xff5a3a, true);
  const survP = L.terminal(17.2, -8, 'x-');
  L.sign('PROTOCOLE INFINI', 20.6, 4.6, -8, 'x-', '#ff6a4a', 3.4);
  L.interact(survP, 'Terminal de survie — Protocole Infini', () => g.ui.panels.survival(), 3.2);

  // ---- personnel ----
  const npc = (x: number, z: number, ry: number, color: number, female = false) => {
    const rig = buildOperatorRig(color, female);
    const o = rig ? rig.root : buildOperatorModel(color);
    if (rig) L.updaters.push((dt) => rig.update(dt));
    o.position.set(x, 0, z); o.rotation.y = ry; L.root.add(o); L.collider(x, 0, z, 0.7, 1.8, 0.7, 'flesh'); return o;
  };
  npc(2.9, -1.2, -Math.PI / 2 - 0.4, 0x6ab0ff, true);
  npc(-13.5, 5.2, Math.PI / 2, 0xffb04a);
  npc(14.6, 10.4, -Math.PI * 0.8, 0xb06aff);
  L.interact(new THREE.Vector3(2.9, 1.4, -1.2), 'Parler à la Commandante Reyes', () => {
    const next = g.nextMissionId();
    m.clearRadio();
    if (!next) m.say('CDT. REYES', 'Point Zéro est scellé, opérateur. Reposez-vous… ou retournez dans le Protocole Infini. Seize Fractures nous attendent encore.');
    else m.say('CDT. REYES', `Votre prochaine cible : opération ${MISSION_BY_ID[next].name}. Passez par l’armurerie, puis rejoignez-moi à la table tactique.`);
  }, 2.6);

  // ---- zone d'entraînement (nord) ----
  L.floor('dirt', 0, -39, 30, 34);
  L.enclosure('concrete', -15, -56, 15, -22, 5, [{ side: 's', at: 0, gap: 5, h: 5 }]);
  L.sign('ZONE D’ENTRAÎNEMENT', 0, 4.3, -21.6, 'z+', '#e8d85a', 4.4);
  L.sandbags(-6, -27, true, 4); L.sandbags(6, -27, true, 4);
  L.barrier(-9, -36, true); L.barrier(8, -41, true); L.crate(3, -34, 1.3); L.crate(-3, -44, 1.3, 0, 'olive'); L.container(11.5, -48, false, 'container_green');
  L.platform('grate', -11.5, -47, 5, 6, 2.4);
  L.stairs('metal', -11.5, -40.8, 'z-', 2, 8, 0.3, 0.4);
  const target = (x: number, z: number, y = 0) => {
    const grp = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.95, 0.12), cmat(0xd8742a, 0.7, 0.1)); body.position.y = 0.95;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.17, 10, 8), cmat(0xe8c040, 0.7, 0.1)); head.position.y = 1.62;
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.5, 0.08), mat('black')); post.position.y = 0.25;
    grp.add(body, head, post);
    const d = L.destructible(grp, 250, x, y, z, 0.6, 1.8, 0.25, 'metal');
    d.onDestroyed = () => { g.fx.burst(d.center, { count: 14, color: 0xffb04a, speed: 4, life: 0.5, size: 0.14 }); g.after(2.5, () => d.revive(250)); };
  };
  target(-8, -33); target(0, -38); target(7, -36); target(-4, -48); target(5, -52); target(-11.5, -48.5, 2.4); target(11.5, -50, 2.62);
  const simP = L.terminal(12.5, -25.5, 'x-');
  L.interact(simP, 'Simulation de combat — faire apparaître des cibles hostiles', () => {
    if (m.alive('sim') > 0) { g.ui.hud.toast('SIMULATION DÉJÀ EN COURS', '#e8d85a'); return; }
    m.portalSpawn('sim', [['grunt', -6, -46, { noLoot: true }], ['grunt', 6, -50, { noLoot: true }], ['devourer', 0, -52, { noLoot: true }], ['drone', 8, -44, { noLoot: true }]]);
    g.ui.hud.toast('SIMULATION LANCÉE', '#e8d85a');
  }, 3);
  const ammo2 = L.ammoCrate(-12.5, -25);
  L.interact(ammo2, 'Caisse de munitions — réapprovisionner', () => { g.weapons.refill(1); g.player.grenades = 2; g.audio.reload(2); g.ui.hud.toast('MUNITIONS RÉAPPROVISIONNÉES', '#ffb04a'); }, 2.6);
  dressHub(L);
  L.finish();

  // ---- accueil ----
  const p = g.profile!;
  g.after(1.2, () => {
    const next = g.nextMissionId();
    if (!p.missions.op1) {
      m.say('CDT. REYES', `Bienvenue à Fort Aegis, ${p.name}. Je suis la commandante Reyes. Ici, on prépare la guerre contre la Fracture.`);
      m.say('CDT. REYES', 'Équipez-vous à l’armurerie, testez vos pouvoirs sur le pas de tir au nord, puis venez à la table tactique.');
      m.say('SYSTÈME', 'TAB : personnage et talents · M : carte · F : interagir · Échap : pause et commandes');
    } else if (next) m.say('CDT. REYES', `Bon retour, ${p.name}. L’opération ${MISSION_BY_ID[next].name} est prête. Dépensez vos points de talent avant de repartir.`);
    else m.say('CDT. REYES', 'La campagne est terminée, mais la guerre continue. Rejouez les opérations en Vétéran ou défiez le Protocole Infini.');
  });
  return L;
}
