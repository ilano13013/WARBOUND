// OPÉRATION 5 — LIGNE DE CRÊTE : barrage hydroélectrique de Valmorre, de nuit sous la pluie.
// Trois zones au niveau du sol (la navigation des ennemis est plane) : la vallée, la salle des turbines au pied du barrage,
// puis la crête du barrage, atteinte par l'ascenseur. Le vide et le réservoir de part et d'autre de la crête sont du décor.
// Nouvel ennemi : le tireur d'élite HELIX, qui change de perchoir (src/ai/Marksman.ts).
import * as THREE from 'three';
import type { Game } from '../core/Game';
import type { Mission } from '../mission/Mission';
import { Level, type Interactable } from '../world/Level';
import { backdrop } from '../world/Detail';
import { mat } from '../render/Materials';
import { cliff, fire, floodlight, hesco, pipeRack, razorWire, smokeColumn, supplies, tankTrap, watchtower, silo } from '../world/SetPieces';
import { ammo, barrel, lore, REYES, ORACLE, MAREK } from './common';

const V = (x: number, z: number) => new THREE.Vector3(x, 0, z);
const P = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const R = (a: number) => (a * Math.PI) / 180;
const HALVARD = 'COL. HALVARD';

export function buildOp5(g: Game, m: Mission): Level {
  const L = new Level('op5', 'Barrage de Valmorre', {
    skyTop: 0x04060c, skyHorizon: 0x26303e, fog: 0x161c26, fogDensity: 0.012, sun: 0xa8bcd8, sunIntensity: 1.6, sunDir: [-0.35, 0.55, -0.6],
    hemiSky: 0x5a6a86, hemiGround: 0x1c1e22, hemiIntensity: 0.95, wet: 1, storm: 0.85, mist: 0.5, rays: 0.15, exposure: 1.35,
    saturation: 0.82, gradeShadow: 0x7088b0, gradeLight: 0xe6ecff, weather: 'rain',
  });
  m.level = L;
  L.theme = 'helix';
  L.bounds = { minX: -60, minZ: -250, maxX: 60, maxZ: 52 };
  L.spawn.set(0, 0.1, 44); L.spawnYaw = 0;
  L.maxLights = 8;

  // ================= A. VALLÉE (z 50..-20) =================
  L.floor('dirt', 0, 15, 120, 75);
  L.box('asphalt', 0, -0.98, 15, 9, 1, 75, { nav: false });
  // parois rocheuses : collision en blocs, habillage par les falaises Rock Face 01
  for (const s of [-1, 1]) {
    L.box('rock', s * 52, 0, 8, 8, 26, 92);
    for (let z = 44; z > -24; z -= 13) cliff(L, s * 47.5, z, 15 + ((z * 7) % 5), s < 0 ? R(90) : R(-90), 0.04);
  }
  L.box('rock', 0, 0, 52.5, 112, 20, 3); for (const x of [-34, -10, 14, 38]) cliff(L, x, 50, 14, R(180), 0.04);
  // éperons rocheux servant de perchoirs aux tireurs (inaccessibles au joueur)
  const spur = (x: number, z: number, h: number) => { L.box('rock', x, 0, z, 6, h, 6); cliff(L, x, z, h + 1.5, x < 0 ? R(90) : R(-90), 0.02); };
  spur(-34, -12, 6); spur(32, -2, 6); spur(28, 30, 8);
  watchtower(L, -26, 14, 10, R(140));
  // poste de contrôle de la vallée
  L.floor('darkconcrete', 0, 2, 18, 12, 0.03, 0.03);
  L.enclosure('concrete_damaged', -9, -4, -3, 8, 3.6, [{ side: 'e', at: 2, gap: 2.4, h: 2.6 }], 0.5);
  L.roof('darkmetal', -9, -4, -3, 8, 3.6); L.zones.push({ minX: -9, minZ: -4, maxX: -3, maxZ: 8, light: 0.4 });
  L.box('hazard', 3.5, 0, 2, 0.3, 1.1, 0.3); L.box('glow_red', 3.5, 1.1, 2, 0.4, 0.15, 0.4, { collide: false });
  L.box('hazard', 6.2, 1.0, 2, 5.4, 0.12, 0.12, { collide: false }); // barrière levante
  L.lamp(-6, 3.5, 2, 'white', true, 18, 14);
  lore(g, L, 'op5_log1', -7.5, 6.2);
  hesco(L, -14, 22, true, 3); hesco(L, 13, 18, true, 3); hesco(L, -12, -8, false, 2); hesco(L, 14, -10, false, 2);
  for (const [x, z] of [[-6, 30], [6, 34], [-4, 12], [5, 10]]) tankTrap(L, x, z);
  L.vehicle(-16, 34, false, 'truck', 0x2e3436); L.vehicle(18, 6, true, 'apc', 0x2a3038); L.vehicle(-20, -4, true, 'car', 0x3a3d44);
  L.sandbags(-10, 16, true, 4); L.sandbags(10, 26, true, 4); L.barrier(0, 18, true, 3.4); L.barrier(-2, -14, true, 3.4);
  supplies(L, 22, 20, 0.3, true); supplies(L, -24, 26, 1.2);
  barrel(g, L, 9, 14); barrel(g, L, -11, -2);
  floodlight(L, -40, 40, 10, R(150)); floodlight(L, 40, 12, 10, R(-120)); floodlight(L, -40, -16, 10, R(40));
  razorWire(L, -44, 46, -10, 46); razorWire(L, 10, 46, 44, 46);
  fire(L, -16, 1.8, 34, 1.1);
  ammo(g, L, 4, 20);

  // ================= B. PIED DU BARRAGE ET SALLE DES TURBINES (z -20..-76) =================
  L.floor('darkconcrete', 0, -48, 120, 56);
  // parement du barrage : mur de 48 m, contreforts, deux évacuateurs de crue
  L.box('concrete_damaged', 0, 0, -74, 124, 48, 4);
  for (let x = -54; x <= 54; x += 18) L.box('concrete', x, 0, -71.2, 3, 44, 1.6, { collide: false });
  const water = new THREE.ShaderMaterial({
    uniforms: { t: { value: 0 } }, transparent: true, depthWrite: false,
    vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
    fragmentShader: 'uniform float t; varying vec2 vUv; float h(vec2 p){ return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453); } void main(){ vec2 q=vec2(vUv.x*14.0, vUv.y*3.0+t*2.6); float n=h(floor(q)); float s=0.55+0.45*sin(q.y*6.2832+n*6.2832); float a=(0.12+0.3*s*s)*smoothstep(0.0,0.12,vUv.x)*smoothstep(1.0,0.88,vUv.x)*(0.55+0.45*vUv.y); gl_FragColor=vec4(vec3(0.42,0.5,0.58)*(0.5+0.6*s),a); }',
  });
  for (const x of [-42, 42]) {
    L.box('darkconcrete', x - 4.5, 0, -69, 1, 3, 8); L.box('darkconcrete', x + 4.5, 0, -69, 1, 3, 8);
    const sheet = new THREE.Mesh(new THREE.PlaneGeometry(8, 44), water); sheet.position.set(x, 22, -71.9); L.root.add(sheet);
    smokeColumn(L, x, 0, -66, 14, 7, 0xb8c4d0, 0.28);
  }
  L.updaters.push((_dt, t) => { water.uniforms.t.value = t; });
  // salle des turbines
  L.enclosure('concrete', -28, -66, 28, -24, 14, [{ side: 's', at: 0, gap: 6, h: 6 }, { side: 'w', at: -36, gap: 3, h: 3.2 }, { side: 'e', at: -50, gap: 3, h: 3.2 }], 0.8);
  L.roof('darkmetal', -28, -66, 28, -24, 14);
  L.zones.push({ minX: -28, minZ: -66, maxX: 28, maxZ: -24, light: 0.45 });
  L.sign('HELIX — CENTRALE DE VALMORRE', 0, 7.6, -23.5, 'z+', '#ff8a5a', 9);
  // passerelles le long des murs (perchoirs) ; escalier d'accès côté est
  L.platform('grate', -25, -45, 4, 36, 6); L.platform('grate', 25, -45, 4, 36, 6);
  L.stairs('metal', 13.5, -61, 'x+', 2.2, 20, 0.3, 0.4);
  // turbines : socle, alternateur, conduite forcée venant du barrage
  const valvePos: THREE.Vector3[] = [];
  for (const x of [-14, 0, 14]) {
    L.deco(mat('darkmetal'), new THREE.CylinderGeometry(4.2, 4.4, 1.2, 20), x, 0.6, -48);
    L.deco(mat('metal'), new THREE.CylinderGeometry(3.2, 3.2, 3.6, 24), x, 3, -48);
    L.deco(mat('paint_yellow'), new THREE.CylinderGeometry(3.25, 3.25, 0.3, 24, 1, true), x, 4.3, -48);
    L.deco(mat('trim'), new THREE.CylinderGeometry(1.4, 2.2, 1.4, 16), x, 5.5, -48);
    L.collider(x, 0, -48, 8, 6.2, 8, 'metal');
    L.pipe(x, 9, -71, x, 5.5, -52, 1.1, 'rust');
    L.lamp(x, 13.4, -48, 'white', true, 26, 20);
    valvePos.push(L.terminal(x, -42.6, 'z+'));
  }
  pipeRack(L, -27, -30, 27, -30, 9, 3);
  L.machine(-24, -28, 3, 2, 3, 'glow_orange'); L.machine(24, -62, 3, 2, 3, 'glow_blue');
  L.lamp(-20, 13.4, -32, 'red', false); L.lamp(20, 13.4, -32, 'red', false);
  supplies(L, -18, -60, 0.5, true); supplies(L, 18, -28, 1.1);
  barrel(g, L, -8, -34); barrel(g, L, 8, -60);
  lore(g, L, 'op5_term1', -21, -58.6);
  ammo(g, L, -12, -30); ammo(g, L, 12, -64.4);
  // ascenseur vers la crête
  L.box('trim', 0, 0, -64.6, 4.4, 4.2, 1.2); L.box('glow_white', 0, 3.4, -63.95, 3.2, 0.12, 0.05, { collide: false });
  L.sign('ASCENSEUR — CRÊTE', 0, 4.8, -63.9, 'z+', '#e8d85a', 3.4);
  const liftPos = L.terminal(2.8, -62.4, 'z+');
  L.links.push({ from: liftPos, to: P(0, 0.1, -152) });
  // extérieur du pied du barrage
  silo(L, -44, -40, 2.4, 9, 'metal'); silo(L, 46, -34, 2, 8, 'rust');
  floodlight(L, -40, -26, 9, R(30)); floodlight(L, 40, -58, 9, R(-60));
  L.container(-44, -56, false, 'container_blue'); L.container(44, -48, false, 'container_red');
  hesco(L, -36, -22, true, 3); hesco(L, 36, -22, true, 3);

  // ================= C. CRÊTE DU BARRAGE (z -148..-246), au niveau 0 =================
  L.floor('asphalt', 0, -197, 18, 100);
  for (const s of [-1, 1]) { L.box('concrete_damaged', s * 8.7, 0, -197, 0.6, 1.15, 100); L.box('trim', s * 8.7, 1.15, -197, 0.7, 0.08, 100, { collide: false }); } // parapets
  L.box('rock', 0, 0, -147, 24, 8, 2); L.box('concrete', 0, 0, -247.5, 24, 10, 1);
  // vide côté vallée (ouest) et réservoir (est) : décor
  L.box('concrete_damaged', -12.5, -50, -197, 7, 50, 102, { collide: false, nav: false });
  L.box('dirt', -60, -52, -197, 90, 1, 140, { collide: false, nav: false });
  const res = new THREE.Mesh(new THREE.PlaneGeometry(300, 200), new THREE.MeshStandardMaterial({ color: 0x0a1018, roughness: 0.06, metalness: 0.85 }));
  res.rotation.x = -Math.PI / 2; res.position.set(160, -2.6, -197); L.root.add(res);
  L.box('concrete', 9.6, -3, -197, 1.4, 3, 100, { collide: false, nav: false });
  // guérites des vannes (couverts), portiques, tour de contrôle
  const gatehouses: [number, number][] = [[-5, -168], [5, -186], [-5, -204], [5, -220]];
  for (const [x, z] of gatehouses) {
    // guérite des vannes : béton sombre, porte métallique, fenêtre éclairée, appareillage sur le toit
    const fx = x < 0 ? 1 : -1;
    L.box('darkconcrete', x, 0, z, 3.6, 3.6, 4.4); L.box('darkmetal', x, 3.6, z, 4, 0.3, 4.8, { collide: false });
    L.box('trim', x + fx * 1.81, 0, z - 0.9, 0.04, 2.3, 1.1, { collide: false });
    L.box('glow_orange', x + fx * 1.81, 1.6, z + 0.9, 0.04, 0.7, 1.1, { collide: false });
    L.box('metal', x, 3.9, z - 0.8, 1.2, 0.7, 1.4, { collide: false }); L.box('trim', x - fx * 0.6, 3.9, z + 1.2, 0.12, 1.6, 0.12, { collide: false });
  }
  for (const z of [-176, -212]) {
    for (const s of [-1, 1]) L.box('paint_yellow', s * 7.6, 0, z, 0.8, 10, 0.8);
    L.box('paint_yellow', 0, 9.4, z, 16, 1, 1.2, { collide: false });
    L.box('trim', 2, 7.6, z, 2.4, 1.8, 2.4, { collide: false });
  }
  L.enclosure('concrete', -7, -244, 7, -232, 8, [{ side: 's', at: 0, gap: 3, h: 3 }], 0.6);
  L.roof('darkmetal', -7, -244, 7, -232, 8);
  L.zones.push({ minX: -7, minZ: -244, maxX: 7, maxZ: -232, light: 0.45 });
  L.sign('CONTRÔLE DU BARRAGE', 0, 6.2, -231.6, 'z+', '#4ad8ff', 5);
  L.box('glow_red', 0, 8.2, -238, 1, 0.6, 1, { collide: false });
  const relayPos = L.terminal(0, -241, 'z+');
  L.deco(mat('glow_violet'), new THREE.OctahedronGeometry(0.6, 0), 0, 2.4, -242.4, 0, 0, 0, 1, 1.8, 1);
  L.machine(-4.6, -240, 2, 3, 3, 'glow_violet'); L.machine(4.6, -240, 2, 3, 3, 'glow_violet');
  for (const z of [-160, -196, -228]) for (const s of [-1, 1]) L.lamp(s * 8.4, 4.6, z, 'white', true, 22, 18);
  for (const z of [-160, -196, -228]) for (const s of [-1, 1]) L.box('trim', s * 8.4, 1.15, z, 0.2, 3.45, 0.2, { collide: false });
  L.sandbags(-2, -192, true, 3); L.sandbags(2, -214, true, 3); L.barrier(0, -228, true, 3);
  lore(g, L, 'op5_doc1', 6.4, -236);
  ammo(g, L, -6.6, -154); ammo(g, L, 6, -238.5);
  // hélisurface d'extraction
  L.box('glow_green', 0, 0.02, -154, 5, 0.02, 0.2, { collide: false }); L.box('glow_green', 0, 0.02, -154, 0.2, 0.02, 5, { collide: false });

  backdrop(L, 'alpine');
  L.finish();

  // ================= TIREURS D'ÉLITE (perchoirs) =================
  const valleyPerches = [P(-26, 10.15, 14), P(-34, 6.05, -12), P(32, 6.05, -2), P(28, 8.05, 30)];
  const hallPerches = [P(-25, 6.05, -34), P(-25, 6.05, -56), P(25, 6.05, -40), P(25, 6.05, -54)];
  const crestPerches = [P(-5, 3.65, -204), P(5, 3.65, -220), P(0, 10.45, -212), P(0, 8.45, -238)];

  // ================= ENNEMIS =================
  m.spawn('post', [['grunt', -4, 22, { patrol: [V(-4, 22), V(4, 12)] }], ['grunt', 6, 28], ['grunt', 2, 6], ['drone', 0, 16]]);
  // ================= OBJECTIFS =================
  m.say(REYES, 'Warbound, ici Reyes. Valmorre. Le colonel Halvard a regroupé ce qui reste d’HELIX autour du barrage.');
  m.say(ORACLE, 'Le barrage alimente un relais qui émet la même signature que Point Zéro. Quelqu’un essaie de rouvrir la Fracture.');
  m.reach('Atteindre le poste de contrôle de la vallée', 0, 4, 5, {
    onDone: () => {
      m.say(ORACLE, 'Reflets de lunettes sur les hauteurs. Des tireurs d’élite HELIX : ils changent de position après chaque tir.');
      m.say(REYES, 'Ne restez pas à découvert. Repérez le reflet, tirez, puis bougez.');
      m.spawn('valley', [['marksman', 0, 0, { perches: valleyPerches }], ['marksman', 0, 0, { perches: [valleyPerches[2], valleyPerches[3], valleyPerches[0], valleyPerches[1]] }],
        ['grunt', -8, -10], ['grunt', 8, -14], ['commander', 0, -16], ['grunt', -16, -16, { patrol: [V(-16, -16), V(-4, -18)] }]]);
    },
  });
  m.kill('Neutraliser les tireurs d’élite de la vallée', 'valley', null, {
    checkpoint: new THREE.Vector3(0, 0.1, 4), checkpointYaw: 0,
    onDone: () => {
      m.say(REYES, 'Vallée dégagée. La salle des turbines est au pied du barrage. Entrez.');
      m.spawn('hall', [['grunt', -10, -34], ['grunt', 10, -36], ['breaker', 0, -38], ['grunt', -18, -54], ['grunt', 20, -58], ['marksman', 0, 0, { perches: hallPerches }]]);
    },
  });
  m.reach('Entrer dans la salle des turbines', 0, -28, 5);
  // trois vannes
  const valveOn = [true, true, true];
  const valveIt: Interactable[] = [];
  valvePos.forEach((p, i) => {
    const it = L.interact(p, `Fermer la vanne ${i + 1}`, () => {
      valveOn[i] = false; it.enabled = false;
      g.audio.door(p); g.player.shakeAmt = 0.4;
      const left = valveOn.filter(Boolean).length;
      g.ui.hud.toast(`VANNE FERMÉE — ${3 - left} / 3`, '#4ad8ff');
      if (left === 1) m.say(HALVARD, 'Fermez les vannes si ça vous amuse. Le relais tient sur la réserve du réservoir, soldat.');
    }, 2.6);
    it.hold = 1.5; it.enabled = false;
    valveIt.push(it);
  });
  m.custom({
    text: 'Fermer les trois vannes',
    marker: () => { let best: THREE.Vector3 | null = null, bd = Infinity; valvePos.forEach((p, i) => { if (!valveOn[i]) return; const d = p.distanceTo(g.player.pos); if (d < bd) { bd = d; best = p; } }); return best; },
    start: () => valveIt.forEach((it) => (it.enabled = true)),
    done: () => valveOn.every((v) => !v),
    progress: () => `${valveOn.filter((v) => !v).length} / 3`,
    checkpoint: new THREE.Vector3(0, 0.1, -30), checkpointYaw: 0,
    onDone: () => { m.say(ORACLE, 'Purge des conduites en cours : quarante secondes. HELIX arrive par les portes latérales !'); },
  });
  m.defend('Tenir la salle pendant la purge', 'PURGE', 40, [
    { at: 2, specs: [['grunt', -34, -36], ['grunt', 34, -50], ['grunt', -30, -38]] },
    { at: 14, specs: [['grunt', -34, -36], ['breaker', 34, -50], ['drone', 0, -40], ['marksman', 0, 0, { perches: [hallPerches[2], hallPerches[0], hallPerches[3], hallPerches[1]] }]] },
    { at: 27, specs: [['commander', -34, -36], ['grunt', 34, -50], ['grunt', -30, -38], ['drone', 6, -40]] },
  ], 'purge', {
    marker: V(0, -40), checkpoint: new THREE.Vector3(0, 0.1, -32), checkpointYaw: 0,
    onDone: () => { m.say(REYES, 'Purge terminée. L’ascenseur de service mène à la crête. Montez.'); },
  });
  m.interact('Prendre l’ascenseur vers la crête', liftPos, 'Monter sur la crête du barrage', {
    onDone: () => {
      g.ui.fade(() => { const p = g.player; p.pos.set(0, 0.1, -152); p.vel.set(0, 0, 0); p.yaw = 0; p.pitch = 0; });
      g.audio.door(liftPos);
      m.say(MAREK, 'Le relais est dans la tour de contrôle, au bout de la crête. Halvard y a branché un fragment de la Clé.');
      m.spawn('crest', [['grunt', -4, -172], ['grunt', 4, -190], ['grunt', -1.5, -208], ['breaker', 0, -224], ['commander', 0, -230],
        ['marksman', 0, 0, { perches: crestPerches }], ['marksman', 0, 0, { perches: [crestPerches[3], crestPerches[1], crestPerches[2], crestPerches[0]] }], ['drone', 0, -196]]);
    },
  }, 1.0);
  m.kill('Prendre la crête du barrage', 'crest', null, { checkpoint: new THREE.Vector3(0, 0.1, -152), checkpointYaw: 0 });
  m.interact('Couper le relais Souverain', relayPos, 'Arracher le fragment de la Clé', {
    checkpoint: new THREE.Vector3(0, 0.1, -226), checkpointYaw: 0,
    onDone: () => {
      g.audio.explosion(null, 0.9); g.player.shakeAmt = 0.8;
      m.say(HALVARD, 'Vous croyez avoir gagné ? Il y a dix-sept Fractures, soldat. Dix-sept.');
      m.say(REYES, 'Relais coupé. Hélicoptère en approche sur la plate-forme sud. Repliez-vous, il reste du monde sur la crête !');
      m.portalSpawn('last', [['grunt', -4, -180], ['grunt', 4, -170], ['drone', 0, -176]]);
      L.beacon(0, -154, 0x3aff8a, 30);
    },
  }, 2.5);
  m.reach('Rejoindre l’hélicoptère d’extraction', 0, -154, 4, { onDone: () => { m.say(REYES, 'Embarquez. Bon travail, Warbound.'); } });
  return L;
}
