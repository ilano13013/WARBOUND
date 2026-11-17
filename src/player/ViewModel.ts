// Armes en vue subjective à partir d'ensembles complets « bras + arme + animations » (voir ASSET_CREDITS.md).
// Les animations d'origine (doigts compris) sont jouées telles quelles : aucune pose calculée, aucun recul ou
// mouvement de chargeur procédural ne s'y ajoute. Le modèle est calé sur l'os de caméra fourni par l'auteur.
// Les fichiers sont chargés à la demande (armes équipées), pas au démarrage ; sans fichier, l'ancien modèle sert de repli.
import * as THREE from 'three';
import { Assets } from '../assets/Assets';
import type { AttachSlot } from '../data/weapons';

export interface VmTune {
  /** Décalage de la pose de hanche, en mètres dans le repère de la caméra. */
  hip?: [number, number, number];
  hipRot?: [number, number, number];
  /** Pose de visée : translation puis rotation (radians, ordre YXZ) appliquées à l'ensemble. */
  ads: { pos: [number, number, number]; rot?: [number, number, number] };
  /** Bouche du canon et fenêtre d'éjection, repère de la caméra, en pose de repos. */
  muzzle: [number, number, number];
  eject?: [number, number, number];
  /** Nœud de caméra de l'auteur (par défaut l'os « Head_Cam ») ; `camFlip: false` pour une vraie caméra (qui regarde vers -Z). */
  camBone?: RegExp; camFlip?: boolean; camRot?: [number, number, number];
  /** Sans caméra d'auteur : position et orientation (YXZ) de l'œil dans le repère du modèle. */
  view?: { pos: [number, number, number]; rot?: [number, number, number] };
  /** Arme d'un autre auteur montée sur l'os d'arme : placement dans le repère de la caméra au repos. */
  mount?: { pos: [number, number, number]; rot?: [number, number, number]; scale: number };
  /** Os de l'arme (flash, douilles). */
  gunBone?: RegExp;
  /** Pièces montrées seulement avec l'accessoire correspondant : emplacement -> { accessoire ou '*' : nom de maillage }. */
  parts?: Partial<Record<AttachSlot, Record<string, string>>>;
  /** Maillages masqués dans l'aperçu (chargeur de rechange tenu hors champ au repos). */
  previewHide?: RegExp;
  /** Maillages toujours masqués. */
  hide?: RegExp;
  /** Part du recul procédural conservée (l'animation de tir porte déjà le sien). */
  kick?: number;
  /** Instants des sons de rechargement (fraction de l'animation) : sortie du chargeur, insertion, armement. */
  cues?: [number, number, number];
  cuesEmpty?: [number, number, number];
  /** Vitesse de lecture de l'animation de tir. */
  fireSpeed?: number;
  /** Tronçons d'une piste unique (ensembles livrés avec une seule animation) : [début, fin] en secondes, vérifiés à l'image. */
  ranges?: Record<string, [number, number]>;
  /** Culasse manœuvrée après chaque tir (fusil à verrou) : l'animation « bolt » suit le tir. */
  bolt?: boolean;
  scale?: number;
}

/** Réglages par arme (cadrage, visée, bouche du canon), établis à l'écran sur chaque ensemble. */
export const VM: Record<string, VmTune> = {
  // --- ensembles Cransh (CC BY 4.0) : mêmes bras, même squelette ---
  ar17: { hip: [0.11, -0.05, -0.1], hipRot: [0.04, 0.1, 0], ads: { pos: [-0.052, -0.008, 0.05] }, muzzle: [0.056, -0.084, -0.872], eject: [0.09, -0.06, -0.3], parts: { muzzle: { silencer: 'mesh_Silencer' } } },
  vektor: { previewHide: /^mesh_ak74m_1$/, scale: 0.38, hip: [0.16, -0.065, -0.26], hipRot: [0.04, 0.1, 0], ads: { pos: [-0.0431, 0.0201, -0.0653], rot: [0, -0.0337, 0] }, muzzle: [0.02, -0.073, -0.752], eject: [0.06, -0.04, -0.2] },
  aegis762: { scale: 0.63, hip: [0.1, -0.07, -0.15], hipRot: [0.04, 0.1, 0], ads: { pos: [-0.1137, -0.0166, 0.0647], rot: [0.0074, -0.0639, -0.0002] }, muzzle: [0.055, -0.067, -0.929], eject: [0.12, -0.03, -0.35], parts: { muzzle: { silencer: 'mesh_Silencer' } } },
  vesper: { previewHide: /^mesh_Material_457_1$/, scale: 0.6, hip: [0.12, -0.07, -0.2], hipRot: [0.04, 0.1, 0], ads: { pos: [-0.0642, 0.0168, -0.1179], rot: [0, -0.0141, 0] }, muzzle: [0.042, -0.071, -0.736], eject: [0.08, -0.04, -0.3] },
  p9: { hip: [0.07, -0.01, 0], hipRot: [0.02, 0.06, 0], ads: { pos: [-0.049, 0.073, -0.24] }, muzzle: [0.028, -0.098, -0.514], eject: [0.06, -0.07, -0.4] },
  // --- armes d'autres auteurs montées sur un squelette Cransh ---
  titan: { hip: [0.12, -0.075, -0.12], hipRot: [0.04, 0.1, 0], ads: { pos: [-0.047, 0.0074, -0.12], rot: [0.0093, 0, 0] }, muzzle: [0.047, -0.1, -0.87], eject: [0.09, -0.06, -0.25], mount: { pos: [0.047, -0.134, -0.157], scale: 0.107 } },
  bastion: { scale: 0.38, hip: [0.16, -0.065, -0.26], hipRot: [0.04, 0.1, 0], ads: { pos: [-0.046, -0.027, -0.04] }, muzzle: [0.039, -0.07, -0.64], eject: [0.07, -0.04, -0.15], mount: { pos: [0.039, -0.26, -0.193], rot: [0, -1.5708, 0], scale: 1.06 } },
  requiem: { scale: 0.38, hip: [0.16, -0.065, -0.26], hipRot: [0.04, 0.1, 0], ads: { pos: [-0.0431, 0.0201, -0.0653], rot: [0, -0.0337, 0] }, muzzle: [0.04, -0.1, -0.89], mount: { pos: [0.044, -0.217, -0.34], scale: 0.256 } },
  spectre: { scale: 0.6, hip: [0.12, -0.07, -0.2], hipRot: [0.04, 0.1, 0], ads: { pos: [-0.0446, 0.015, -0.08], rot: [0.0089, -0.0148, -0.0001] }, muzzle: [0.047, -0.16, -0.742], eject: [0.08, -0.05, -0.25], mount: { pos: [0.043, -0.09, -0.22], scale: 0.34 } },
  // --- ensembles complets d'autres auteurs (manches repeintes en kaki à la conversion) ---
  ember45: { hip: [0.06, -0.06, -0.05], hipRot: [0.03, 0.08, 0], ads: { pos: [-0.0553, 0.014, -0.0752], rot: [0, -0.0235, 0] }, eject: [0.07, -0.03, -0.25], muzzle: [0.032, -0.059, -0.618], camBone: /^Camera$/, camFlip: false, camRot: [0, -1.5708, 0], gunBone: /^__none$/ },
  frostbite: { hip: [0.09, -0.07, 0.05], hipRot: [0.02, 0.08, 0], ads: { pos: [0, 0, 0] }, muzzle: [0.0, -0.021, -1.3], gunBone: /^__none$/, bolt: true, ranges: { fire: [0, 0.5], bolt: [0.5, 1.6], reload: [1.65, 3.1], draw: [3.2, 3.7], idle: [3.7, 4.6] }, view: { pos: [0, 8, -40], rot: [0, Math.PI, 0] }, scale: 0.01 },
  ash: { hip: [0.1, -0.1, 0], hipRot: [0.02, 0.07, 0], ads: { pos: [0, 0.0082, -0.0897], rot: [-0.065, 0, 0] }, muzzle: [0, 0.009, -0.536], gunBone: /^__none$/, ranges: { fire: [0, 0.6], reload: [0.65, 7.6], draw: [7.65, 8.4], idle: [9.8, 10.8] }, view: { pos: [0, 6, -42], rot: [0, Math.PI, 0] }, scale: 0.0067 },
};

const _m = new THREE.Matrix4(), _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _e = new THREE.Euler();
const Y180 = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI);

export class ViewModel {
  /** Groupe déplacé par le système d'armes (balancement, visée, abaissement). */
  root = new THREE.Group();
  muzzle = new THREE.Object3D();
  eject = new THREE.Object3D();
  readonly adsPos = new THREE.Vector3(); readonly adsQuat = new THREE.Quaternion();
  readonly hip = new THREE.Vector3(); readonly hipQuat = new THREE.Quaternion();
  readonly kick: number;
  /** Maillages de l'arme (hors bras) : camouflage, aperçu. */
  gunMeshes: THREE.Mesh[] = [];
  armMeshes: THREE.Mesh[] = [];
  private mixer: THREE.AnimationMixer;
  private acts = new Map<string, THREE.AnimationAction>();
  private idle: THREE.AnimationAction | null = null;
  private shot: THREE.AnimationAction | null = null; private shotEnd = 0; private shotT = 0;
  private queued: string | null = null;

  constructor(readonly id: string, readonly tune: VmTune, attach: Partial<Record<AttachSlot, string>>) {
    const g = Assets.gltf('vm/' + id)!;
    const scene = Assets.clone('vm/' + id)!;
    // mise à l'échelle autour de l'œil : l'image ne change pas, mais les décalages s'expriment en mètres réels
    const fit = new THREE.Group(); fit.scale.setScalar(tune.scale || 1);
    this.root.add(fit); fit.add(scene);
    this.kick = tune.kick ?? 0.35;
    if (tune.hip) this.hip.fromArray(tune.hip);
    if (tune.hipRot) this.hipQuat.setFromEuler(_e.set(tune.hipRot[0], tune.hipRot[1], tune.hipRot[2], 'YXZ'));
    this.adsPos.fromArray(tune.ads.pos);
    if (tune.ads.rot) this.adsQuat.setFromEuler(_e.set(tune.ads.rot[0], tune.ads.rot[1], tune.ads.rot[2], 'YXZ'));
    // pièces liées aux accessoires
    const shown = new Set<string>(), optional = new Set<string>();
    for (const [slot, map] of Object.entries(tune.parts || {})) for (const [att, mesh] of Object.entries(map)) { optional.add(mesh); if (att === '*' ? !!attach[slot as AttachSlot] : attach[slot as AttachSlot] === att) shown.add(mesh); }
    scene.traverse((o) => {
      const m = o as THREE.SkinnedMesh;
      if (!m.isMesh) return;
      m.frustumCulled = false; m.castShadow = false; m.receiveShadow = false;
      if ((optional.has(m.name) && !shown.has(m.name)) || (tune.hide && tune.hide.test(m.name))) { m.visible = false; return; }
      const mat = m.material as THREE.MeshStandardMaterial;
      if (mat.map) mat.map.anisotropy = 8;
      // verre d'optique livré opaque : rendu translucide pour voir à travers en visée
      if (/glass|lens/i.test(mat.name) && !mat.transparent) { const c = mat.clone(); c.transparent = true; c.opacity = 0.14; c.depthWrite = false; c.roughness = 0.05; m.material = c; }
      if (/arms/i.test(m.name)) this.armMeshes.push(m); else this.gunMeshes.push(m);
    });
    // animations
    this.mixer = new THREE.AnimationMixer(scene);
    for (const c of g.animations) this.acts.set(c.name, this.mixer.clipAction(c));
    if (tune.ranges) {
      const all = g.animations[0];
      for (const [name, [a, b]] of Object.entries(tune.ranges)) {
        const fps = 30, sub = THREE.AnimationUtils.subclip(all, name, Math.round(a * fps), Math.round(b * fps), fps);
        this.acts.set(name, this.mixer.clipAction(sub));
      }
    }
    this.idle = this.acts.get('idle') || null;
    if (this.idle) { this.idle.play(); this.mixer.update(0); }
    // calage sur l'os de caméra de l'auteur (pose de repos) : avant = +Z de l'os, haut = +Y
    scene.updateMatrixWorld(true);
    let hc: THREE.Object3D | null = null, gun: THREE.Object3D | null = null;
    const gre = tune.gunBone || /^Rif(_\d+)?$/;
    const cre = tune.camBone || /^Head_Cam(_\d+)?$/;
    scene.traverse((o) => { if (!hc && cre.test(o.name)) hc = o; if (!gun && gre.test(o.name)) gun = o; });
    if (hc) {
      (hc as THREE.Object3D).matrixWorld.decompose(_p, _q, _s);
      if (tune.camFlip !== false) _q.multiply(Y180);
      if (tune.camRot) _q.multiply(new THREE.Quaternion().setFromEuler(_e.set(tune.camRot[0], tune.camRot[1], tune.camRot[2], 'YXZ')));
      _m.compose(_p, _q, _s.set(1, 1, 1)).invert();
      scene.applyMatrix4(_m);
    } else if (tune.view) {
      _q.setFromEuler(_e.set(...(tune.view.rot || [0, 0, 0]), 'YXZ'));
      _m.compose(_p.fromArray(tune.view.pos), _q, _s.set(1, 1, 1)).invert();
      scene.applyMatrix4(_m);
    }
    this.root.updateMatrixWorld(true);
    if (tune.mount) {
      const M = new THREE.Matrix4().compose(_p.fromArray(tune.mount.pos), _q.setFromEuler(_e.set(...(tune.mount.rot || [0, 0, 0]), 'YXZ')), _s.setScalar(tune.mount.scale));
      scene.traverse((o) => {
        if (o.name !== 'gun_mount' && o.name !== 'mag_mount') return;
        _m.copy(o.parent!.matrixWorld).invert().multiply(M).decompose(o.position, o.quaternion, o.scale);
      });
      this.root.updateMatrixWorld(true);
    }
    // repères attachés à l'arme : ils suivent les animations
    const host = (gun as THREE.Object3D | null) || scene;
    for (const [o, at] of [[this.muzzle, tune.muzzle], [this.eject, tune.eject || tune.muzzle]] as [THREE.Object3D, [number, number, number]][]) {
      host.add(o);
      host.matrixWorld.decompose(_p, _q, _s);
      o.position.fromArray(at); host.worldToLocal(o.position);
      o.quaternion.copy(_q).invert();
      o.scale.set(1 / _s.x, 1 / _s.y, 1 / _s.z);
    }
  }

  has(name: string): boolean { return this.acts.has(name); }
  duration(name: string): number { return this.acts.get(name)?.getClip().duration || 0; }

  /** Joue une animation ponctuelle par-dessus l'attente ; `fit` impose sa durée (rechargement calé sur la règle du jeu). */
  play(name: string, fit = 0, speed = 1): boolean {
    const a = this.acts.get(name);
    if (!a) return false;
    if (this.shot && this.shot !== a) this.shot.stop();
    const d = a.getClip().duration;
    a.reset(); a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = true;
    a.timeScale = fit > 0 ? d / fit : speed;
    a.play();
    this.shot = a; this.shotEnd = fit > 0 ? fit : d / speed; this.shotT = 0;
    this.queued = null;
    return true;
  }
  fire(): void {
    if (this.play('fire', 0, this.tune.fireSpeed || 1) && this.tune.bolt && this.acts.has('bolt')) this.queued = 'bolt';
  }
  /** Interrompt l'animation en cours (changement d'arme, rechargement annulé). */
  stop(): void { if (this.shot) { this.shot.stop(); this.shot = null; } this.queued = null; if (this.idle) this.idle.setEffectiveWeight(1); }
  get busy(): boolean { return !!this.shot; }

  update(dt: number): void {
    if (this.shot) {
      this.shotT += dt;
      // fondu d'entrée et de sortie avec l'attente
      const w = Math.min(1, this.shotT / 0.05, Math.max(0, (this.shotEnd - this.shotT) / 0.12));
      this.shot.setEffectiveWeight(Math.max(0.001, w));
      if (this.idle) this.idle.setEffectiveWeight(1 - w);
      if (this.shotT >= this.shotEnd) {
        this.shot.stop(); this.shot = null;
        if (this.idle) this.idle.setEffectiveWeight(1);
        if (this.queued) { const q = this.queued; this.queued = null; this.play(q); }
      }
    }
    this.mixer.update(dt);
  }

  dispose(): void { this.mixer.stopAllAction(); this.root.removeFromParent(); }
}

/** Ensemble disponible pour cette arme (réglages présents et fichier chargé). */
export function vmReady(id: string): boolean { return !!VM[id] && Assets.has('vm/' + id); }
/** Charge l'ensemble d'une arme en arrière-plan ; résout à true s'il est utilisable. */
export function vmLoad(id: string): Promise<boolean> { return VM[id] ? Assets.lazy('vm/' + id) : Promise.resolve(false); }
