// Bras en vue subjective : squelette du personnage Swat (Quaternius, CC0), mains posées par IK sur l'arme.
// Les doigts reprennent la pose de prise « Pistol_Idle » de la Universal Animation Library (retargetée).
import * as THREE from 'three';
import { Assets } from '../assets/Assets';
import { retargetClips } from '../assets/Retarget';

interface Chain { upper: THREE.Bone; lower: THREE.Bone; hand: THREE.Bone; lenA: number; lenB: number; restU: THREE.Quaternion; restL: THREE.Quaternion; restH: THREE.Quaternion; dirU: THREE.Vector3; dirL: THREE.Vector3; F0: THREE.Vector3; S0: THREE.Vector3; palm: THREE.Vector3 }

const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _d = new THREE.Vector3(), _e = new THREE.Vector3();
const _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _m = new THREE.Matrix4(), _m2 = new THREE.Matrix4();

function basis(f: THREE.Vector3, s: THREE.Vector3, out: THREE.Matrix4): THREE.Matrix4 {
  const x = _a.copy(f).normalize();
  const y = _b.copy(s).addScaledVector(x, -s.dot(x)).normalize();
  const z = _c.crossVectors(x, y);
  return out.makeBasis(x, y, z);
}
/** Rotation qui envoie le repère (f0, s0) sur le repère (f1, s1). */
function mapBasis(f0: THREE.Vector3, s0: THREE.Vector3, f1: THREE.Vector3, s1: THREE.Vector3, out: THREE.Quaternion): THREE.Quaternion {
  basis(f0, s0, _m); basis(f1, s1, _m2);
  _m.transpose(); _m2.multiply(_m);
  return out.setFromRotationMatrix(_m2);
}

/** Grain de tissu et de cuir sur les manches et les gants : trame fine, variation de teinte, relief. */
function clothSurface(m: THREE.MeshStandardMaterial, scale: { value: number }, amount: number): void {
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uCS = scale; sh.uniforms.uCA = { value: amount };
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vOP;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvOP=position;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
varying vec3 vOP; uniform float uCS; uniform float uCA;
float cH(vec3 p){ return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453); }
float cN(vec3 p){ vec3 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
  return mix(mix(mix(cH(i),cH(i+vec3(1,0,0)),f.x),mix(cH(i+vec3(0,1,0)),cH(i+vec3(1,1,0)),f.x),f.y),mix(mix(cH(i+vec3(0,0,1)),cH(i+vec3(1,0,1)),f.x),mix(cH(i+vec3(0,1,1)),cH(i+vec3(1,1,1)),f.x),f.y),f.z); }`)
      .replace('#include <map_fragment>', `#include <map_fragment>
{ vec3 q=vOP*uCS; float weave=0.5+0.25*sin(q.x*6.0)*sin(q.y*6.0)+0.25*sin(q.z*6.0)*sin(q.y*6.0+1.6);
  float big=cN(q*0.06)*0.6+cN(q*0.2+3.0)*0.4;
  diffuseColor.rgb*=(0.78+0.44*big)*(1.0-uCA*0.35*(1.0-weave)); }`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
{ vec3 q=vOP*uCS*1.5; normal=normalize(normal+(vec3(cN(q),cN(q+17.0),cN(q+31.0))-0.5)*0.22*uCA); }`);
  };
  m.customProgramCacheKey = () => 'cloth-surface';
}

export class Arms {
  root = new THREE.Group();
  ok = false;
  private chains: { R: Chain; L: Chain } | null = null;
  private model: THREE.Object3D | null = null;
  /** points de prise courants dans l'espace de la scène de l'arme */
  readonly targetR = new THREE.Vector3(); readonly targetL = new THREE.Vector3();
  readonly fR = new THREE.Vector3(); readonly sR = new THREE.Vector3(); readonly fL = new THREE.Vector3(); readonly sL = new THREE.Vector3();
  poleR = new THREE.Vector3(0.6, -1, 0.35); poleL = new THREE.Vector3(-0.7, -1, 0.25);

  constructor() {
    const m = Assets.clone('chars/swat');
    if (!m) return;
    this.model = m;
    this.root.add(m);
    m.rotation.y = Math.PI; // face à -Z, comme la caméra de l'arme
    const bones = new Map<string, THREE.Bone>();
    const cloth = { value: 0 };
    m.traverse((o) => {
      if ((o as THREE.Bone).isBone) bones.set(o.name, o as THREE.Bone);
      const sk = o as THREE.SkinnedMesh;
      if (sk.isMesh) {
        sk.frustumCulled = false; sk.castShadow = false;
        const conv = (mt: THREE.Material) => {
          const c = (mt as THREE.MeshStandardMaterial).clone();
          if (mt.name === 'Skin') { c.color.setHex(0x1b1c1e); c.roughness = 0.75; c.metalness = 0.05; } // gants tactiques
          else if (mt.name === 'Swat') { c.color.setHex(0x3c4332); c.roughness = 0.85; } // manches olive
          else if (mt.name === 'Swat_Black') { c.color.setHex(0x16181b); c.roughness = 0.6; c.metalness = 0.3; }
          clothSurface(c, cloth, mt.name === 'Swat' ? 1 : 0.45);
          return c;
        };
        if (!sk.geometry.boundingBox) sk.geometry.computeBoundingBox();
        cloth.value = Math.max(cloth.value, 260 / Math.max(sk.geometry.boundingBox!.getSize(new THREE.Vector3()).y, 1e-4));
        sk.material = Array.isArray(sk.material) ? sk.material.map(conv) : conv(sk.material);
      }
    });
    const need = ['UpperArmR', 'LowerArmR', 'HandR', 'UpperArmL', 'LowerArmL', 'HandL', 'Head'];
    if (!need.every((n) => bones.has(n))) return;
    // seuls les triangles des bras sont conservés (os dominant de chaque sommet)
    const keep = /UpperArm|LowerArm|Hand|Index|Middle|Ring|Pinky|Thumb/;
    m.traverse((o) => {
      const sk = o as THREE.SkinnedMesh;
      if (!sk.isSkinnedMesh || !sk.geometry.index) return;
      const g = sk.geometry.clone();
      const si = g.attributes.skinIndex, sw = g.attributes.skinWeight;
      const ok = new Uint8Array(si.count);
      for (let v = 0; v < si.count; v++) {
        let best = 0, bw = -1;
        for (let k = 0; k < 4; k++) { const w = sw.getComponent(v, k); if (w > bw) { bw = w; best = si.getComponent(v, k); } }
        ok[v] = keep.test(sk.skeleton.bones[best]?.name || '') ? 1 : 0;
      }
      const idx = g.index!.array, out: number[] = [];
      for (let t = 0; t < idx.length; t += 3) if (ok[idx[t]] && ok[idx[t + 1]] && ok[idx[t + 2]]) out.push(idx[t], idx[t + 1], idx[t + 2]);
      g.setIndex(out);
      sk.geometry = g;
    });
    // bras allongés (proportions stylisées du modèle), mains ramenées à leur taille
    for (const sd of ['L', 'R']) { bones.get('UpperArm' + sd)!.scale.set(1.15, 1.28, 1.15); bones.get('LowerArm' + sd)!.scale.set(0.72, 1, 0.72); bones.get('Hand' + sd)!.scale.set(1 / (1.15 * 0.72), 1 / 1.28, 1 / (1.15 * 0.72)); }
    this.root.updateMatrixWorld(true);
    const first = (side: string, f: string) => bones.get(`${f}1${side}`) || bones.get(`${f}2${side}`)!;
    const chain = (side: 'R' | 'L'): Chain => {
      const upper = bones.get('UpperArm' + side)!, lower = bones.get('LowerArm' + side)!, hand = bones.get('Hand' + side)!;
      const pu = upper.getWorldPosition(new THREE.Vector3()), pl = lower.getWorldPosition(new THREE.Vector3()), ph = hand.getWorldPosition(new THREE.Vector3());
      const mid = first(side, 'Middle').getWorldPosition(new THREE.Vector3()), idx = first(side, 'Index').getWorldPosition(new THREE.Vector3()), pk = first(side, 'Pinky').getWorldPosition(new THREE.Vector3());
      return {
        upper, lower, hand, lenA: pu.distanceTo(pl), lenB: pl.distanceTo(ph),
        restU: upper.getWorldQuaternion(new THREE.Quaternion()), restL: lower.getWorldQuaternion(new THREE.Quaternion()), restH: hand.getWorldQuaternion(new THREE.Quaternion()),
        dirU: pl.clone().sub(pu).normalize(), dirL: ph.clone().sub(pl).normalize(),
        F0: mid.clone().sub(ph).normalize(), S0: idx.clone().sub(pk).normalize(),
        palm: mid.clone().sub(ph).multiplyScalar(0.6),
      };
    };
    const R = chain('R'), L = chain('L');
    // pose de base : prise d'arme de la bibliothèque d'animations (doigts fermés)
    const clips = retargetClips('chars/swat', m, ['Pistol_Idle_Loop']);
    const c = clips.get('Pistol_Idle_Loop');
    if (c) { const mx = new THREE.AnimationMixer(m); mx.clipAction(c).play(); mx.update(0); }
    // tête et jambes repliées : seuls les bras sont visibles
    for (const n of ['Head', 'Neck', 'UpperLegL', 'UpperLegR']) bones.get(n)?.scale.setScalar(0.0001);
    this.root.updateMatrixWorld(true);
    // la tête sur la caméra, un peu en arrière
    const head = bones.get('Neck')!.getWorldPosition(new THREE.Vector3());
    m.position.sub(head).add(new THREE.Vector3(0, -0.07, 0.12));
    this.chains = { R, L };
    this.ok = true;
  }

  setVisible(v: boolean): void { this.root.visible = v && this.ok; }

  /** Résout les deux bras. Les cibles sont exprimées dans l'espace de la scène de l'arme. */
  solve(): void {
    if (!this.chains) return;
    this.root.updateMatrixWorld(true);
    this.solveArm(this.chains.R, this.targetR, this.fR, this.sR, this.poleR);
    this.solveArm(this.chains.L, this.targetL, this.fL, this.sL, this.poleL);
  }

  private setWorldQuat(b: THREE.Object3D, q: THREE.Quaternion): void {
    b.parent!.getWorldQuaternion(_q2);
    b.quaternion.copy(_q2.invert().multiply(q));
    b.updateMatrixWorld(true);
  }

  private solveArm(ch: Chain, grip: THREE.Vector3, F1: THREE.Vector3, S1: THREE.Vector3, pole: THREE.Vector3): void {
    // orientation voulue de la main, puis position du poignet pour que la paume tombe sur la prise
    const qh = mapBasis(ch.F0, ch.S0, F1, S1, new THREE.Quaternion()).multiply(ch.restH);
    const dq = _q.copy(qh).multiply(_q2.copy(ch.restH).invert());
    const wrist = _d.copy(ch.palm).applyQuaternion(dq).negate().add(grip);
    const S = ch.upper.getWorldPosition(new THREE.Vector3());
    const toT = _e.subVectors(wrist, S);
    let d = toT.length();
    const a = ch.lenA, b = ch.lenB;
    d = Math.min(Math.max(d, Math.abs(a - b) + 1e-3), (a + b) * 0.999);
    const dir = toT.normalize();
    const cosA = (a * a + d * d - b * b) / (2 * a * d);
    const sinA = Math.sqrt(Math.max(0, 1 - cosA * cosA));
    const pp = new THREE.Vector3().copy(pole).addScaledVector(dir, -pole.dot(dir)).normalize();
    const E = new THREE.Vector3().copy(S).addScaledVector(dir, a * cosA).addScaledVector(pp, a * sinA);
    const W = new THREE.Vector3().copy(S).addScaledVector(dir, d);
    // bras : repère (direction de l'os, côté du coude) ; au repos, le coude pointe vers l'arrière (+Z)
    const back = new THREE.Vector3(0, 0, 1);
    const u1 = new THREE.Vector3().subVectors(E, S).normalize();
    const qu = mapBasis(ch.dirU, back, u1, pp, new THREE.Quaternion()).multiply(ch.restU);
    this.setWorldQuat(ch.upper, qu);
    const l1 = new THREE.Vector3().subVectors(W, E).normalize();
    // l'avant-bras partage la torsion de la main (évite l'effet « papillote » au poignet)
    const side = new THREE.Vector3(0, 0, 1).applyQuaternion(dq).addScaledVector(pp, 1.0);
    const ql = mapBasis(ch.dirL, back, l1, side, new THREE.Quaternion()).multiply(ch.restL);
    this.setWorldQuat(ch.lower, ql);
    this.setWorldQuat(ch.hand, qh);
  }
}
