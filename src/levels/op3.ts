// OPÉRATION 3 — TEMPLE DU VOILE : ruines surnaturelles, sceaux, gardiens et Archonte du Voile.
import * as THREE from 'three';
import type { Game } from '../core/Game';
import type { Mission } from '../mission/Mission';
import { Level } from '../world/Level';
import { mat } from '../render/Materials';
import { Archon } from '../ai/Boss';
import { ammo, lore, REYES, ORACLE, MAREK, ARCHON } from './common';

const V = (x: number, z: number) => new THREE.Vector3(x, 0, z);

export function buildOp3(g: Game, m: Mission): Level {
  const L = new Level('op3', 'Temple du Voile', { skyTop: 0x06041a, skyHorizon: 0x4a2a8a, fog: 0x1a1238, fogDensity: 0.012, sun: 0xa898ff, sunIntensity: 1.9, sunDir: [-0.4, 0.6, 0.5], hemiSky: 0x7a6ac0, hemiGround: 0x1c1626, hemiIntensity: 0.9, rift: true });
  m.level = L;
  L.bounds = { minX: -48, minZ: -202, maxX: 48, maxZ: 44 };
  L.spawn.set(0, 0.1, 36); L.spawnYaw = 0;
  L.maxLights = 9;

  L.floor('ash', 0, -79, 96, 246);
  L.enclosure('stone', -47, -201, 47, 43, 9, [], 1.5);
  const arch = (x: number, z: number, w = 6, h = 7, alongX = true) => {
    const dx = alongX ? w / 2 : 0, dz = alongX ? 0 : w / 2;
    L.box('stone', x - dx, 0, z - dz, 1.2, h, 1.2); L.box('stone', x + dx, 0, z + dz, 1.2, h, 1.2);
    L.box('rune', x, h, z, alongX ? w + 1.6 : 1.4, 1, alongX ? 1.4 : w + 1.6, { nav: false });
  };
  const floatRock = (x: number, y: number, z: number, s: number) => {
    const r = new THREE.Mesh(new THREE.DodecahedronGeometry(s, 0), mat('stone')); r.position.set(x, y, z); r.castShadow = true; L.root.add(r);
    const c = new THREE.Mesh(new THREE.OctahedronGeometry(s * 0.35, 0), mat('crystal')); c.position.set(0, -s * 0.9, 0); r.add(c);
    L.updaters.push((dt, t) => { r.position.y = y + Math.sin(t * 0.5 + x) * 0.6; r.rotation.y += dt * 0.1; });
  };

  // ================= A. RUINES (z 42..-30) =================
  L.box('stone', 0, -0.97, 6, 7, 1, 72, { nav: false }); // voie dallée
  for (const z of [30, 18, 6, -6, -18]) { L.column(-6, z, 7, 0.7, 'stone', z === 18 || z === -6); L.column(6, z, 7, 0.7, 'stone', z === 6); }
  arch(0, 24); arch(0, -12, 7, 8);
  L.rubble(-12, 28, 3, 'stone'); L.rubble(14, 16, 2.6, 'stone'); L.rubble(-16, 2, 3, 'stone'); L.rubble(12, -8, 2.4, 'stone'); L.rubble(-10, -22, 2.6, 'stone'); L.rubble(20, -22, 3, 'stone');
  for (const [x, z, s, r] of [[-20, 34, 1.4, 0], [22, 30, 1.2, 1], [-28, 12, 1.8, 0], [26, 6, 1.5, 0], [-22, -14, 1.3, 1], [30, -16, 1.7, 0], [-34, -26, 1.5, 0], [14, 36, 1, 0]] as [number, number, number, number][]) L.crystalDeco(x, 0, z, s, r ? 'crystal_red' : 'crystal');
  L.box('stone', -18, 0, 20, 8, 1.4, 0.9); L.box('stone', 18, 0, 0, 0.9, 1.6, 9); L.box('stone', -26, 0, -4, 0.9, 1.2, 8); L.box('stone', 24, 0, 22, 7, 1.3, 0.9); L.box('rune', -12, 0, 10, 2, 2.4, 2); L.box('rune', 13, 0, -18, 2, 2.8, 2);
  // corniches surélevées (variations de hauteur)
  L.platform('stone', -32, 20, 10, 8, 3, 0.5, false); L.stairs('stone', -22.5, 20, 'x-', 3, 10, 0.3, 0.45);
  L.platform('stone', 34, -6, 10, 10, 3, 0.5, false); L.stairs('stone', 24.5, -6, 'x+', 3, 10, 0.3, 0.45);
  floatRock(-14, 9, 14, 1.6); floatRock(16, 12, -4, 2.2); floatRock(-24, 14, -20, 2.6); floatRock(28, 10, 30, 1.4); floatRock(4, 16, -24, 1.8);
  L.lamp(0, 7.2, 24, 'violet', true, 22, 22); L.lamp(0, 8.2, -12, 'violet', false);
  lore(g, L, 'op3_log1', -30, 22, 3);
  ammo(g, L, 9, 34); ammo(g, L, -9, -26);

  // ================= B. SALLE DES SCEAUX (z -30..-80) =================
  L.box('stone', 0, -0.96, -55, 50, 1, 50, { nav: false });
  L.enclosure('stone', -25, -80, 25, -30, 13, [{ side: 's', at: 0, gap: 6, h: 7 }, { side: 'n', at: 0, gap: 5, h: 5 }], 1.5);
  for (const s of [-1, 1]) { L.box('rune', s * 24.1, 4, -55, 0.2, 1.5, 48, { collide: false }); for (const z of [-38, -47, -56, -65, -74]) L.column(s * 12, z, 12, 0.9, 'stone'); }
  L.box('rune', 0, 0, -55, 5, 0.3, 5, { nav: false });
  L.zones.push({ minX: -25, minZ: -80, maxX: 25, maxZ: -30, light: 0.6 });
  L.lamp(0, 9, -45, 'violet', true, 30, 26); L.lamp(0, 9, -68, 'blue', true, 30, 26);
  L.box('stone', -18, 0, -52, 5, 1.1, 0.9); L.box('stone', 18, 0, -66, 5, 1.1, 0.9); L.box('stone', -6, 0, -40, 0.9, 1.2, 4); L.box('stone', 6, 0, -72, 0.9, 1.2, 4);
  L.platform('stone', 0, -76, 14, 5, 2.7, 0.5, false);
  L.stairs('stone', -11.05, -76, 'x+', 3, 9, 0.3, 0.45); L.stairs('stone', 11.05, -76, 'x-', 3, 9, 0.3, 0.45);
  const innerDoor = L.door(0, -80, true, 5, 5, 'rune');
  // trois sceaux : à activer dans l'ordre croissant du nombre de cristaux
  const sealPos = [new THREE.Vector3(-20, 0, -42), new THREE.Vector3(20, 0, -62), new THREE.Vector3(0, 2.7, -77)];
  const sealMesh: THREE.Mesh[] = [];
  const order = [1, 2, 0]; // le sceau i porte order[i]+1 cristaux
  let step = 0;
  const seals = sealPos.map((p, i) => {
    L.box('rune', p.x, p.y, p.z, 1.4, 1.1, 1.4);
    const orb = new THREE.Mesh(new THREE.SphereGeometry(0.3, 14, 10), mat('glow_violet')); orb.position.set(p.x, p.y + 1.6, p.z); L.root.add(orb); sealMesh.push(orb);
    for (let k = 0; k <= order[i]; k++) L.deco(mat('crystal'), new THREE.OctahedronGeometry(0.16, 0), p.x + (k - order[i] / 2) * 0.42, p.y + 2.3, p.z, 0, 0, 0, 1, 1.8, 1);
    const it = L.interact(new THREE.Vector3(p.x, p.y + 1.2, p.z), `Activer le sceau (${order[i] + 1} cristal${order[i] ? 'x' : ''})`, () => {
      if (order[i] === step) {
        step++; it.enabled = false; orb.material = mat('glow_green');
        g.audio.objective(); g.fx.ring(p, 0.3, 4, 0x3aff8a, 0.6);
        if (step < 3) g.ui.hud.toast(`SCEAU ${step} / 3 ACTIVÉ`, '#3aff8a');
      } else {
        // mauvais ordre : les sceaux se réinitialisent
        step = 0; seals.forEach((s) => (s.enabled = true)); sealMesh.forEach((o) => (o.material = mat('glow_violet')));
        g.player.takeDamage(12, { pierce: true }); g.audio.skill('zap'); g.fx.ring(p, 0.3, 5, 0xff3a5a, 0.5);
        g.ui.hud.toast('ORDRE INCORRECT — LES SCEAUX SE RÉINITIALISENT', '#ff5a6a');
      }
    }, 2.6);
    it.enabled = false;
    return it;
  });
  lore(g, L, 'op3_term1', 21, -34);

  // ================= C. ANTICHAMBRE ET GALERIES (z -80..-126) =================
  L.box('stone', 0, -0.96, -103, 80, 1, 46, { nav: false });
  L.enclosure('stone', -40, -126, 40, -80.5, 11, [{ side: 's', at: 0, gap: 5, h: 5 }, { side: 'n', at: 0, gap: 7, h: 7 }], 1.5);
  L.zones.push({ minX: -40, minZ: -126, maxX: 40, maxZ: -80, light: 0.55 });
  for (const [x, z] of [[-10, -90], [10, -90], [-10, -116], [10, -116], [-26, -103], [26, -103]]) L.column(x, z, 10, 1, 'rune');
  L.box('stone', -18, 0, -96, 0.9, 1.3, 7); L.box('stone', 18, 0, -110, 0.9, 1.3, 7); L.box('stone', 0, 0, -103, 6, 1.1, 0.9); L.box('stone', -30, 0, -90, 6, 1.2, 0.9); L.box('stone', 30, 0, -116, 6, 1.2, 0.9);
  L.crystalDeco(-37, 0, -84, 1.6); L.crystalDeco(37, 0, -122, 1.6, 'crystal_red'); L.crystalDeco(-37, 0, -122, 1.2); L.crystalDeco(37, 0, -84, 1.3);
  L.lamp(-20, 9, -103, 'violet', true, 26, 24); L.lamp(20, 9, -103, 'violet', true, 26, 24);
  const wards = [L.crystal(-33, 0, -92, 240, 1.4), L.crystal(33, 0, -92, 240, 1.4), L.crystal(-33, 0, -114, 240, 1.4), L.crystal(33, 0, -114, 240, 1.4)];
  for (const w of wards) w.invulnerable = true;
  const barrier = L.door(0, -126, true, 7, 7, 'rune');
  lore(g, L, 'op3_doc1', -22, -122);
  ammo(g, L, 22, -84); ammo(g, L, -6, -123);

  // ================= D. SANCTUAIRE (boss) =================
  L.box('stone', 0, -0.95, -160, 60, 1, 66, { nav: false });
  L.box('rune', 0, -0.94, -160, 14, 1, 14, { nav: false });
  L.enclosure('stone', -30, -194, 30, -126.5, 16, [{ side: 's', at: 0, gap: 7, h: 7 }], 1.5);
  L.zones.push({ minX: -30, minZ: -194, maxX: 30, maxZ: -126, light: 0.7 });
  for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2 + 0.39; L.column(Math.cos(a) * 26, -160 + Math.sin(a) * 28, 15, 1.1, 'stone', i % 3 === 0); }
  for (const [x, z] of [[-10, -148], [10, -148], [-10, -172], [10, -172]]) L.box('stone', x, 0, z, 2.2, 1.5, 2.2);
  L.deco(mat('rune'), new THREE.CylinderGeometry(3.2, 3.6, 0.5, 10), 0, 0.25, -186); L.collider(0, 0, -186, 5.5, 0.5, 5.5, 'concrete', { nav: false });
  const key = new THREE.Group();
  const kc = new THREE.Mesh(new THREE.OctahedronGeometry(0.45, 0), mat('glow_white')); kc.scale.set(0.6, 1.8, 0.6);
  const kr = new THREE.Mesh(new THREE.TorusGeometry(0.7, 0.04, 6, 30), mat('glow_violet'));
  key.add(kc, kr); key.position.set(0, 2.2, -186); L.root.add(key);
  L.updaters.push((dt, t) => { key.rotation.y += dt; kr.rotation.x = t * 0.8; key.position.y = 2.2 + Math.sin(t * 1.5) * 0.15; });
  L.lamp(0, 4, -186, 'white', true, 20, 18); L.lamp(-16, 14, -160, 'violet', true, 50, 40); L.lamp(16, 14, -160, 'violet', true, 50, 40);
  const bossCrystals = [L.crystal(-24, 0, -146, 190, 1.5, 'crystal_red'), L.crystal(24, 0, -146, 190, 1.5, 'crystal_red'), L.crystal(-24, 0, -176, 190, 1.5, 'crystal_red'), L.crystal(24, 0, -176, 190, 1.5, 'crystal_red')];
  for (const c of bossCrystals) { c.invulnerable = true; c.destroy(); }
  ammo(g, L, -27, -130); ammo(g, L, 27, -190);
  L.finish();

  // ================= ENNEMIS =================
  m.spawn('ruins', [
    ['caster', -8, 20], ['devourer', 10, 24], ['devourer', 14, 20], ['grunt', -3, 10, { patrol: [V(-3, 10), V(3, -2)] }], ['caster', -32, 20, { static: true, y: 3.1 }],
    ['devourer', -14, -4], ['devourer', -18, -8], ['grunt', 8, -10], ['caster', 34, -6, { static: true, y: 3.1 }], ['sentinel', 0, -24], ['devourer', 22, -14],
  ]);
  m.trigger(0, 8, 8, () => m.say(ARCHON, 'Tu marches sur une terre qui ne t’appartient pas, soldat. Chaque pierre ici te regarde.'));

  // ================= OBJECTIFS =================
  m.say(REYES, 'Vous êtes de l’autre côté de la Fracture de Kessler. Nos instruments deviennent fous. Avancez jusqu’au temple.');
  m.say(MAREK, 'La Clé du Voile est au fond du sanctuaire. Si Voss l’obtient, aucune Fracture ne se refermera plus jamais.');
  m.reach('Traverser les ruines jusqu’au temple', 0, -33, 6, {
    onDone: () => {
      m.say(ORACLE, 'La porte intérieure est scellée. Trois sceaux dans la salle : les cristaux au-dessus de chacun indiquent l’ordre. Un, puis deux, puis trois.');
      m.spawn('hall', [['caster', -14, -60], ['caster', 14, -44], ['devourer', -4, -66], ['devourer', 6, -50], ['grunt', 0, -70]]);
    },
  });
  m.custom({
    text: 'Activer les trois sceaux dans le bon ordre',
    marker: () => { const i = order.indexOf(step); return i >= 0 ? sealPos[i] : null; },
    start: () => seals.forEach((s) => (s.enabled = true)),
    done: () => step >= 3,
    progress: () => `${step} / 3`,
    onDone: () => {
      L.openDoor(innerDoor); g.audio.door(V(0, -80)); g.audio.bossRoar(V(0, -100));
      m.say(ARCHON, 'Tu sais lire nos sceaux. Voyons si tu sais lire ta propre fin. Gardiens — éveillez-vous.');
    },
  });
  m.kill('Éliminer les gardiens du temple', 'guardians', [['sentinel', -8, -98], ['sentinel', 8, -98], ['sentinel', 0, -112], ['caster', -24, -108], ['caster', 24, -96]], {
    checkpoint: new THREE.Vector3(0, 0.1, -76), checkpointYaw: 0,
    onDone: () => { m.say(ORACLE, 'Gardiens détruits. Une barrière protège le sanctuaire : quatre cristaux l’alimentent, dans les galeries.'); },
  });
  let wardT = 3;
  m.destroy('Détruire les cristaux protecteurs', wards, {
    update: (dt) => { wardT -= dt; if (wardT <= 0 && m.alive('wardens') < 5) { wardT = 11; m.portalSpawn('wardens', [['devourer', -20 + Math.random() * 40, -103], [Math.random() < 0.5 ? 'caster' : 'devourer', -20 + Math.random() * 40, -112]]); } },
    onDone: () => {
      L.openDoor(barrier); g.audio.door(V(0, -126));
      for (const e of g.enemies) if (e.alive && e.group === 'wardens') e.takeDamage(99999, { source: 'world', type: 'explosion' });
      m.say(REYES, 'Barrière dissipée. L’Archonte vous attend. Ne le laissez pas vous enfermer dans ses zones.');
    },
  });
  m.reach('Entrer dans le sanctuaire', 0, -134, 6, { checkpoint: new THREE.Vector3(0, 0.1, -120), checkpointYaw: 0 });
  m.bossFight('Affronter l’Archonte du Voile', () => {
    const b = new Archon(g, 0, -168);
    b.arena.set(0, 0, -160); b.arenaR = 24; b.crystals = bossCrystals;
    b.anchors = [V(0, -168), V(-16, -150), V(16, -150), V(-18, -170), V(18, -170), V(0, -144), V(0, -180)];
    for (const c of bossCrystals) { c.invulnerable = true; c.destroy(); }
    b.onPhase = (n) => {
      if (n === 2) m.say(ARCHON, 'Le Voile me protège. Brise mes cristaux si tu l’oses — ils repousseront.');
      if (n === 3) m.say(ARCHON, 'Assez ! Tu ne refermeras pas ce que des millénaires ont ouvert !');
    };
    return b;
  }, {
    start: () => { m.say(ARCHON, 'Voss n’est qu’une serrure. Toi, tu n’es même pas une clé. Tu es du bruit.'); },
    checkpoint: new THREE.Vector3(0, 0.1, -132),
    onDone: () => { m.say(ARCHON, 'Trop tard… le Souverain… est déjà… à Point Zéro…'); m.say(REYES, 'Archonte neutralisé. Prenez la Clé sur l’autel, vite.'); },
  });
  m.interact('Récupérer la Clé du Voile', new THREE.Vector3(0, 1.6, -183.2), 'Prendre la Clé du Voile', {
    onDone: () => { key.visible = false; g.audio.loot(3); g.fx.ring(new THREE.Vector3(0, 0.6, -186), 0.5, 12, 0xffffff, 1); m.say(MAREK, 'Vous l’avez ! Il ne reste qu’un endroit où l’utiliser : l’épicentre. Point Zéro.'); },
  }, 1.2);
  return L;
}
