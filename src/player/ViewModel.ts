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
  /** Os de l'arme (flash, douilles). */
  gunBone?: RegExp;
  /** Pièces montrées seulement avec l'accessoire correspondant : emplacement -> { accessoire ou '*' : nom de maillage }. */
  parts?: Partial<Record<AttachSlot, Record<string, string>>>;
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
  ar17: { ads: { pos: [0, 0, 0] }, muzzle: [0.1, -0.1, -0.7], parts: { muzzle: { silencer: 'mesh_Silencer' } } },
  vektor: { ads: { pos: [0, 0, 0] }, muzzle: [0.1, -0.1, -0.7] },
  aegis762: { ads: { pos: [0, 0, 0] }, muzzle: [0.1, -0.1, -0.7], parts: { muzzle: { silencer: 'mesh_Silencer' } } },
  vesper: { ads: { pos: [0, 0, 0] }, muzzle: [0.1, -0.1, -0.5] },
  p9: { ads: { pos: [0, 0, 0] }, muzzle: [0.1, -0.1, -0.4] },
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
    scene.traverse((o) => { if (/^Head_Cam(_\d+)?$/.test(o.name)) hc = o; if (!gun && gre.test(o.name)) gun = o; });
    if (hc) {
      (hc as THREE.Object3D).matrixWorld.decompose(_p, _q, _s);
      _m.compose(_p, _q.multiply(Y180), _s.set(1, 1, 1)).invert();
      scene.applyMatrix4(_m);
    }
    this.root.updateMatrixWorld(true);
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
