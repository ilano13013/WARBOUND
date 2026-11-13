// Association archétype ennemi -> modèle animé (Quaternius, CC0) avec teintes « corrompues ».
import * as THREE from 'three';
import { Assets } from '../assets/Assets';
import { CharacterRig, type RigDef } from '../render/CharacterRig';
import { markerSprite, type EnemyModel } from './EnemyModels';
import { cmat, mat } from '../render/Materials';
import type { EnemyKind } from '../data/enemies';

export const RIGS: Partial<Record<EnemyKind | 'wolf', RigDef>> = {
  guardian: { model: 'chars/mech', height: 4.3, humanoid: false, walkSpeed: 1.4, runSpeed: 4, clips: { idle: 'Idle', walk: 'Walk', run: 'Run', shoot: 'Shoot', attack: 'Punch', attack2: 'Kick', hit: 'HitRecieve_1', death: 'Death' }, mats: { '*': { color: 0xa8a8a8, rough: 0.55, metal: 0.45 } } },
  archon: { model: 'chars/witch', height: 3.4, humanoid: true, walkSpeed: 1.4, mats: {
    Purple: { color: 0x150c24, emissive: 0x2a0e4a, ei: 0.6, rough: 0.85 }, Gold: { color: 0x3a2a5a, emissive: 0xb07aff, ei: 2.4 }, Skin: { color: 0xb8b0c8, emissive: 0x4a2a8a, ei: 0.6 }, Hair_Black: { color: 0x0a0610 }, Brown: { color: 0x120c18 }, Brown2: { color: 0x1c1428 } } },
  sovereign: { model: 'chars/king', height: 2.9, humanoid: true, gun: true, walkSpeed: 1.5, runSpeed: 3.6, mats: {
    Blue: { color: 0x1c0a12, rough: 0.7 }, Metal: { color: 0x2a2a30, metal: 0.9, rough: 0.3 }, Metal_Dark: { color: 0x121216, metal: 0.9, rough: 0.35 }, Gold: { color: 0x8a6a2a, metal: 1, rough: 0.3, emissive: 0x5a0a10, ei: 0.5 },
    Skin: { color: 0x9a8a8c, emissive: 0x3a0a10, ei: 0.4 }, Eye: { color: 0x300000, emissive: 0xff2a3a, ei: 3 }, Hair_White: { color: 0xd8d0d0 }, Beige: { color: 0x3a2a24 }, DarkBrown: { color: 0x1a120e } } },
  grunt: { model: 'chars/swat', height: 1.82, humanoid: true, gun: true, walkSpeed: 1.4, runSpeed: 3.4, mats: {
    Swat: { color: 0x2c3226, rough: 0.8 }, Swat_Black: { color: 0x141518, metal: 0.35, rough: 0.55 }, Visor: { color: 0x1a0a2a, emissive: 0x9a4aff, ei: 2.6 }, Skin: { color: 0x5e5262 } } },
  sniper: { model: 'chars/soldier', height: 1.78, humanoid: true, gun: true, walkSpeed: 1.4, runSpeed: 3.4, mats: {
    Swat: { color: 0x3b3a2a, rough: 0.85 }, Black: { color: 0x141416 }, Grey: { color: 0x2b2d25 }, Brown: { color: 0x2a2018 }, Skin: { color: 0x7a6a6a, emissive: 0x401010, ei: 0.4 }, Hair_Brown: { color: 0x1a1410 } } },
  // tireur d'élite HELIX : même silhouette, tenue anthracite et visière rouge
  marksman: { model: 'chars/soldier', height: 1.78, humanoid: true, gun: true, walkSpeed: 1.4, runSpeed: 3.4, mats: {
    Swat: { color: 0x26292e, rough: 0.8 }, Black: { color: 0x141416 }, Grey: { color: 0x3a3f46 }, Brown: { color: 0x2a2018 }, Skin: { color: 0x6a6a72 }, Visor: { color: 0x200404, emissive: 0xff2a1a, ei: 1.6 }, Hair_Brown: { color: 0x1a1410 } } },
  // opérateur adverse du Défi d'armes : tenue sable et pièces rouge sombre, visière rouge vive, lisible sur les fonds sombres
  rival: { model: 'chars/swat', height: 1.84, humanoid: true, gun: true, walkSpeed: 1.4, runSpeed: 3.4, mats: {
    Swat: { color: 0xb08a5a, rough: 0.8, emissive: 0x2a0a04, ei: 0.35 }, Swat_Black: { color: 0x5a1a14, metal: 0.3, rough: 0.5, emissive: 0x3a0804, ei: 0.5 }, Visor: { color: 0x200000, emissive: 0xff3a2a, ei: 3.2 }, Skin: {} } },
  // 4v4 : la couleur d'équipe est imposée sur la tenue et la visière (indépendante de tout cosmétique)
  rival_red: { model: 'chars/swat', height: 1.84, humanoid: true, gun: true, walkSpeed: 1.4, runSpeed: 3.4, mats: {
    Swat: { color: 0x9a3a2e, rough: 0.8, emissive: 0x2a0604, ei: 0.4 }, Swat_Black: { color: 0x2a1614, metal: 0.3, rough: 0.5 }, Visor: { color: 0x200000, emissive: 0xff3a2a, ei: 3.2 }, Skin: {} } },
  rival_blue: { model: 'chars/swat', height: 1.84, humanoid: true, gun: true, walkSpeed: 1.4, runSpeed: 3.4, mats: {
    Swat: { color: 0x2e5a9a, rough: 0.8, emissive: 0x04102a, ei: 0.4 }, Swat_Black: { color: 0x141a2a, metal: 0.3, rough: 0.5 }, Visor: { color: 0x000820, emissive: 0x3a8aff, ei: 3.2 }, Skin: {} } },
  breaker: { model: 'chars/swat', height: 2.05, humanoid: true, gun: true, walkSpeed: 1.3, runSpeed: 3.2, mats: {
    Swat: { color: 0x3a3f48, metal: 0.65, rough: 0.4 }, Swat_Black: { color: 0x1a1b20, metal: 0.6, rough: 0.4 }, Visor: { color: 0x2a1000, emissive: 0xff7a2a, ei: 2.8 }, Skin: { color: 0x4a4a4a } } },
  caster: { model: 'chars/witch', height: 1.95, humanoid: true, walkSpeed: 1.4, runSpeed: 3.2, clips: { aim: 'Spell_Simple_Idle_Loop' }, mats: {
    Purple: { color: 0x26163c, rough: 0.9 }, Gold: { color: 0x3a2a6a, emissive: 0x9a5aff, ei: 1.6 }, Skin: { color: 0x8a8098, emissive: 0x2a1040, ei: 0.5 }, Hair_Black: { color: 0x0e0a14 }, Brown: { color: 0x1c1420 }, Brown2: { color: 0x2a1e30 } } },
  commander: { model: 'chars/spacesuit', height: 1.98, humanoid: true, gun: true, walkSpeed: 1.4, runSpeed: 3.4, mats: {
    SciFi_Main: { color: 0x5a1416, metal: 0.5, rough: 0.4 }, SciFi_MainDark: { color: 0x15161a, metal: 0.6, rough: 0.4 }, SciFi_Light: { color: 0x2a2c30, metal: 0.7, rough: 0.35 },
    SciFi_Light_Accent: { color: 0x200000, emissive: 0xff2a2a, ei: 2.6 }, Grey: { color: 0x3a3c40 } } },
  devourer: { model: 'chars/spider', height: 0.8, humanoid: false, walkSpeed: 2.5, runSpeed: 5, clips: { idle: 'Spider_Idle', walk: 'Spider_Walk', run: 'Spider_Walk', attack: 'Spider_Attack', death: 'Spider_Death' }, mats: {
    Material: { color: 0x1a1222, metal: 0.45, rough: 0.32 }, 'Material.001': { color: 0x200030, emissive: 0xb04aff, ei: 3 } } },
  drone: { model: 'chars/drone', height: 0.85, humanoid: false, walkSpeed: 2, runSpeed: 4.5, clips: { idle: 'Idle', walk: 'Walk', run: 'Run', shoot: 'Shoot', death: 'Dead', attack: 'Attack' }, mats: {
    Main: { color: 0x2a2e34, metal: 0.7, rough: 0.3 }, Main2: { color: 0x15171a, metal: 0.7, rough: 0.3 }, Edge: { color: 0xc8a020, metal: 0.8, rough: 0.35 }, Grey: { color: 0x3a3e44, metal: 0.8 }, LightGrey: { color: 0x5a5e66, metal: 0.8 },
    '*': { color: 0x23262b, metal: 0.65, rough: 0.35 } } },
  sentinel: { model: 'chars/knight', height: 2.65, humanoid: false, walkSpeed: 1.6, runSpeed: 3.4, clips: { idle: 'Idle_swordRight', walk: 'Walking', run: 'Run', attack: 'Run_swordAttack', death: 'Death' }, mats: {
    Armor: { color: 0x34343e, metal: 0.4, rough: 0.5, emissive: 0x2a0a5a, ei: 0.5 }, Boots: { color: 0x2a2836, metal: 0.2, rough: 0.7 }, Skin: { color: 0x0e0816, emissive: 0x7a3aff, ei: 0.9 } } },
  wolf: { model: 'chars/wolf', height: 1.0, humanoid: false, walkSpeed: 1.8, runSpeed: 6, ghost: true, clips: { idle: 'Idle', walk: 'Walk', run: 'Gallop', attack: 'Attack', death: 'Death', hit: 'Idle_HitReact_Left' } },
};

export function rigAvailable(kind: EnemyKind | 'wolf'): boolean { const d = RIGS[kind]; return !!d && Assets.has(d.model) && (!d.humanoid || Assets.has('anims/ual')); }

/** Modèle d'ennemi compatible avec l'interface de la 1.0, animé par un CharacterRig. */
export function buildRiggedEnemy(kind: EnemyKind | 'wolf', extraMats?: Record<string, import('../render/CharacterRig').MatTweak>): { model: EnemyModel; rig: CharacterRig } | null {
  if (!rigAvailable(kind)) return null;
  let rig: CharacterRig;
  try { const d = RIGS[kind]!; rig = new CharacterRig(extraMats && Object.keys(extraMats).length ? { ...d, mats: { ...(d.mats || {}), ...extraMats } } : d); } catch (e) { console.warn('rig', kind, e); return null; }
  const root = rig.root;
  const marker = markerSprite(); marker.position.y = rig.def.height + 0.45; root.add(marker);
  let shield: THREE.Object3D | null = null;
  if (kind === 'breaker' && rig.handL) {
    // bouclier balistique tenu dans la main gauche
    const sh = new THREE.Group();
    const plate = new THREE.Mesh(new THREE.BoxGeometry(0.75, 1.3, 0.06), new THREE.MeshPhysicalMaterial({ color: 0x2a2e36, metalness: 0.85, roughness: 0.35, clearcoat: 0.4 }));
    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.1, 0.02), mat('glass')); visor.position.set(0, 0.38, -0.04);
    const strip = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.95, 0.02), mat('glow_orange')); strip.position.set(0, -0.08, -0.04);
    const haz = new THREE.Mesh(new THREE.BoxGeometry(0.77, 0.08, 0.07), mat('hazard')); haz.position.y = -0.6;
    for (const o of [plate, visor, strip, haz]) { o.castShadow = true; sh.add(o); }
    // fixé devant le personnage, indépendant de l'animation des bras
    sh.position.set(-0.18, 1.05, -0.5);
    root.add(sh);
    shield = sh;
  }
  if (kind === 'grunt') {
    // excroissances cristallines de la Fracture sur l'épaule
    const sh = root.getObjectByName('ShoulderL');
    if (sh) {
      root.updateMatrixWorld(true);
      const ws = sh.getWorldScale(new THREE.Vector3()).x;
      for (const [x, y, z, s] of [[0.05, 0.1, 0, 0.11], [0.12, 0.05, 0.06, 0.07]]) { const c = new THREE.Mesh(new THREE.OctahedronGeometry(1, 0), mat('crystal')); c.scale.set(s / ws, s * 1.8 / ws, s / ws); c.position.set(x / ws, y / ws, z / ws); sh.add(c); }
    }
  }
  if (kind === 'commander') {
    const ring = new THREE.Mesh((() => { const g = new THREE.RingGeometry(0.9, 1, 40); g.rotateX(-Math.PI / 2); return g; })(), new THREE.MeshBasicMaterial({ color: 0xff3a2a, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    ring.position.y = 0.06; ring.scale.setScalar(11); root.add(ring);
    rig.root.userData.aura = ring;
  }
  if (kind === 'caster' && rig.hand) {
    // bâton cristallin
    const staff = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.025, 1.6, 6), cmat(0x1a1420, 0.6, 0.4)); pole.position.y = 0.1;
    const cr = new THREE.Mesh(new THREE.OctahedronGeometry(0.13, 0), mat('crystal')); cr.position.y = 0.95;
    staff.add(pole, cr);
    root.updateMatrixWorld(true);
    staff.scale.setScalar(1 / rig.hand.getWorldScale(new THREE.Vector3()).x);
    rig.hand.add(staff);
    staff.rotation.set(Math.PI / 2, 0, 0);
    rig.muzzle = cr;
  }
  if (kind === 'drone') {
    const eye = root.getObjectByName('Eye');
    if (eye) { root.updateMatrixWorld(true); const ws = eye.getWorldScale(new THREE.Vector3()).x; const o = new THREE.Mesh(new THREE.SphereGeometry(0.075 / ws, 12, 8), mat('glow_red')); eye.add(o); }
    for (const n of ['UpperArmL', 'UpperArmR']) { const b = root.getObjectByName(n); if (b) { const ws = b.getWorldScale(new THREE.Vector3()).x; const s = new THREE.Mesh(new THREE.BoxGeometry(0.05 / ws, 0.012 / ws, 0.05 / ws), mat('hazard')); b.add(s); } }
  }
  if (kind === 'sentinel') {
    // équipement du chevalier (modélisé à l'origine) : épée, casque, épaulières
    root.updateMatrixWorld(true);
    const attach = (bone: string, asset: string, pos: THREE.Vector3, quat: THREE.Quaternion, size: number) => {
      const b = root.getObjectByName(bone), o = Assets.clone(asset);
      if (!b || !o) return;
      o.traverse((n) => { const me = n as THREE.Mesh; if (me.isMesh) { me.castShadow = true; me.material = (me.material as THREE.MeshStandardMaterial).clone(); const mm = me.material as THREE.MeshStandardMaterial; mm.color.multiplyScalar(0.55); mm.metalness = 0.6; mm.roughness = 0.4; rig.materials.push(mm); mm.userData.baseEmissive = mm.emissive.clone(); mm.userData.baseEI = mm.emissiveIntensity; } });
      const w = new THREE.Matrix4().compose(pos, quat, new THREE.Vector3(size, size, size));
      const local = b.matrixWorld.clone().invert().multiply(w);
      local.decompose(o.position, o.quaternion, o.scale);
      b.add(o);
      return o;
    };
    const wp = (n: string) => root.getObjectByName(n)?.getWorldPosition(new THREE.Vector3()) || new THREE.Vector3();
    const face = root.getWorldQuaternion(new THREE.Quaternion());
    attach('Head', 'chars/knight_helmet', wp('Head').add(new THREE.Vector3(0, rig.def.height * 0.075, 0)), face, rig.scale * 1.15);
    attach('Torso', 'chars/knight_pads', wp('ShoulderL').lerp(wp('ShoulderR'), 0.5), face, rig.scale);
    const palm = wp('PalmR'), fing = wp('FingersR');
    const dirF = fing.clone().sub(palm).normalize();
    void dirF;
    const blade = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0.6, -1).applyQuaternion(face).normalize());
    const sw = attach('PalmR', 'chars/knight_sword', palm, blade, rig.scale * 2.2);
    if (sw) sw.traverse((n) => { const me = n as THREE.Mesh; if (me.isMesh) { const mm = me.material as THREE.MeshStandardMaterial; mm.emissive.setHex(0x6a2aff); mm.emissiveIntensity = 0.6; mm.userData.baseEmissive = mm.emissive.clone(); mm.userData.baseEI = 0.6; } });
  }
  const model: EnemyModel = { root, body: root, head: rig.head, legL: null, legR: null, armL: null, armR: null, extra: [], muzzle: rig.muzzle, shield, marker };
  return { model, rig };
}

/** Opérateur allié animé (sélection de classe, personnel du QG), teinté à la couleur de la classe. */
export function buildOperatorRig(color: number, female = false, pose: 'idle' | 'aim' = 'idle'): CharacterRig | null {
  const model = female ? 'chars/soldier' : 'chars/swat';
  if (!Assets.has(model) || !Assets.has('anims/ual')) return null;
  const mats: Record<string, import('../render/CharacterRig').MatTweak> = female
    ? { Swat: { color: 0x3c4432, rough: 0.85 }, Black: { color: 0x15171a }, Grey: { color: 0x2c3028 }, Brown: { color: 0x2a2018 }, Skin: {}, Hair_Brown: {} }
    : { Swat: { color: 0x3c4432, rough: 0.85 }, Swat_Black: { color: 0x15171a, metal: 0.4, rough: 0.5 }, Visor: { color: 0x050505, emissive: color, ei: 2.2 }, Skin: {} };
  try {
    const rig = new CharacterRig({ model, height: 1.84, humanoid: true, gun: true, mats });
    rig.setMotion(0, pose === 'aim', 1);
    return rig;
  } catch { return null; }
}
