// Retargeting d'animations : transfère les clips de la Universal Animation Library (squelette « DEF-* »)
// vers les personnages modulaires Quaternius (squelette « Hips / Abdomen / … »).
// Méthode : rotation monde relative à la pose de repos (T-pose), recalculée en espace local de la cible.
import * as THREE from 'three';
import { Assets } from './Assets';

const san = (s: string) => s.replace(/\s/g, '_').replace(/[\[\].:\/]/g, '');

const CORE: [string, string][] = [
  ['DEF-hips', 'Hips'], ['DEF-spine.001', 'Abdomen'], ['DEF-spine.002', 'Torso'], ['DEF-spine.003', 'Chest'], ['DEF-neck', 'Neck'], ['DEF-head', 'Head'],
];
for (const s of ['L', 'R']) CORE.push(
  [`DEF-shoulder.${s}`, `Shoulder.${s}`], [`DEF-upper_arm.${s}`, `UpperArm.${s}`], [`DEF-forearm.${s}`, `LowerArm.${s}`], [`DEF-hand.${s}`, `Hand.${s}`],
  [`DEF-thigh.${s}`, `UpperLeg.${s}`], [`DEF-shin.${s}`, `LowerLeg.${s}`], [`DEF-foot.${s}`, `Foot.${s}`],
);

/** Correspondance os source -> os cible (noms assainis), doigts compris. */
function boneMap(target: THREE.Object3D): Map<string, THREE.Object3D> {
  const byName = new Map<string, THREE.Object3D>();
  target.traverse((o) => { if ((o as THREE.Bone).isBone || o.name) byName.set(o.name, o); });
  const map = new Map<string, THREE.Object3D>();
  for (const [s, t] of CORE) { const b = byName.get(san(t)); if (b) map.set(san(s), b); }
  for (const side of ['L', 'R']) {
    for (const f of ['index', 'middle', 'ring', 'pinky', 'thumb']) {
      const cap = f[0].toUpperCase() + f.slice(1);
      const tgt = [1, 2, 3, 4].map((n) => byName.get(`${cap}${n}${side}`)).filter((x): x is THREE.Object3D => !!x);
      const src = [1, 2, 3].map((n) => san(f === 'thumb' ? `DEF-thumb.0${n}.${side}` : `DEF-f_${f}.0${n}.${side}`));
      const pairs = tgt.length >= 3 ? src.map((s, i) => [s, tgt[i]] as const) : tgt.length === 2 ? [[src[1], tgt[0]], [src[2], tgt[1]]] as const : [];
      for (const [s, t] of pairs) map.set(s, t);
    }
  }
  return map;
}

let srcScene: THREE.Object3D | null = null;
let srcMixer: THREE.AnimationMixer | null = null;
const srcRest = new Map<string, THREE.Quaternion>();
const srcHipsRest = new THREE.Vector3();

function prepareSource(): boolean {
  if (srcScene) return true;
  const g = Assets.gltf('anims/ual');
  if (!g) return false;
  srcScene = g.scene.clone(true);
  srcMixer = new THREE.AnimationMixer(srcScene);
  const tpose = g.animations.find((a) => a.name === 'A_TPose');
  if (tpose) { const a = srcMixer.clipAction(tpose); a.play(); srcMixer.update(0); }
  srcScene.updateMatrixWorld(true);
  srcScene.traverse((o) => { srcRest.set(o.name, o.getWorldQuaternion(new THREE.Quaternion())); });
  srcScene.getObjectByName('DEF-hips')?.getWorldPosition(srcHipsRest);
  srcMixer.stopAllAction();
  return true;
}

const cache = new Map<string, Map<string, THREE.AnimationClip>>();
const _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _v = new THREE.Vector3();

/**
 * Convertit les clips demandés pour un modèle donné. Le résultat est mis en cache par modèle.
 * `target` doit être dans sa pose de repos (modèle tel que chargé).
 */
export function retargetClips(modelKey: string, target: THREE.Object3D, names: string[], fps = 30): Map<string, THREE.AnimationClip> {
  let out = cache.get(modelKey);
  if (!out) { out = new Map(); cache.set(modelKey, out); }
  const missing = names.filter((n) => !out!.has(n));
  if (!missing.length || !prepareSource()) return out;
  const g = Assets.gltf('anims/ual')!;
  const map = boneMap(target);
  target.updateMatrixWorld(true);
  // pose de repos de la cible
  const tRestWorld = new Map<THREE.Object3D, THREE.Quaternion>();
  const order: THREE.Object3D[] = [];
  target.traverse((o) => { order.push(o); tRestWorld.set(o, o.getWorldQuaternion(new THREE.Quaternion())); });
  const mapped = new Map<THREE.Object3D, string>();
  for (const [s, t] of map) mapped.set(t, s);
  const hips = map.get(san('DEF-hips'));
  const hipsRestW = hips ? hips.getWorldPosition(new THREE.Vector3()) : new THREE.Vector3();
  const hipsParentInv = hips && hips.parent ? hips.parent.matrixWorld.clone().invert() : new THREE.Matrix4();
  const ratio = srcHipsRest.y > 0.01 ? hipsRestW.y / srcHipsRest.y : 1;
  const topQ = new Map<THREE.Object3D, THREE.Quaternion>();
  for (const name of missing) {
    const clip = g.animations.find((a) => a.name === name);
    if (!clip) continue;
    srcMixer!.stopAllAction();
    const action = srcMixer!.clipAction(clip); action.play();
    const n = Math.max(2, Math.round(clip.duration * fps) + 1);
    const times = new Float32Array(n);
    const qVals = new Map<THREE.Object3D, Float32Array>();
    for (const t of map.values()) qVals.set(t, new Float32Array(n * 4));
    const pVals = new Float32Array(n * 3);
    const srcNodes = new Map<string, THREE.Object3D>();
    srcScene!.traverse((o) => srcNodes.set(o.name, o));
    for (let i = 0; i < n; i++) {
      const t = Math.min(clip.duration, (i / (n - 1)) * clip.duration);
      times[i] = t; action.time = t; srcMixer!.update(0); srcScene!.updateMatrixWorld(true);
      topQ.clear();
      for (const o of order) {
        const parentW = o.parent && topQ.has(o.parent) ? topQ.get(o.parent)! : o.parent ? tRestWorld.get(o.parent) || o.parent.getWorldQuaternion(new THREE.Quaternion()) : new THREE.Quaternion();
        const sName = mapped.get(o);
        let w: THREE.Quaternion;
        if (sName && srcNodes.has(sName)) {
          const sn = srcNodes.get(sName)!;
          sn.getWorldQuaternion(_q);
          w = _q.multiply(_q2.copy(srcRest.get(sName)!).invert()).multiply(tRestWorld.get(o)!).clone();
          const local = _q2.copy(parentW).invert().multiply(w);
          local.toArray(qVals.get(o)!, i * 4);
        } else w = parentW.clone().multiply(o.quaternion);
        topQ.set(o, w);
      }
      if (hips) {
        srcNodes.get(san('DEF-hips'))!.getWorldPosition(_v);
        _v.sub(srcHipsRest).multiplyScalar(ratio).add(hipsRestW).applyMatrix4(hipsParentInv);
        _v.toArray(pVals, i * 3);
      }
    }
    const tracks: THREE.KeyframeTrack[] = [];
    for (const [o, vals] of qVals) tracks.push(new THREE.QuaternionKeyframeTrack(`${o.name}.quaternion`, times, vals));
    if (hips) tracks.push(new THREE.VectorKeyframeTrack(`${hips.name}.position`, times, pVals));
    out.set(name, new THREE.AnimationClip(name, clip.duration, tracks));
    srcMixer!.stopAllAction();
  }
  return out;
}

/** Noms des os du haut du corps (pour superposer visée et tir sur la locomotion). */
export function isUpperBone(name: string): boolean {
  return /Abdomen|Torso|Chest|Neck|Head|Shoulder|Arm|Hand|Index|Middle|Ring|Pinky|Thumb/.test(name);
}

/** Copie d'un clip restreinte au haut ou au bas du corps. */
export function splitClip(clip: THREE.AnimationClip, upper: boolean): THREE.AnimationClip {
  const tracks = clip.tracks.filter((t) => isUpperBone(t.name.split('.')[0]) === upper);
  return new THREE.AnimationClip(clip.name + (upper ? '_up' : '_low'), clip.duration, tracks);
}
