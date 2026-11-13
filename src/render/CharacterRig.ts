// Personnage animé à partir d'un modèle glTF : locomotion, visée et tir superposés au haut du corps,
// sorts, attaques, réactions aux dégâts et mort. Les humanoïdes utilisent les clips retargetés de la UAL.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Assets } from '../assets/Assets';
import { retargetClips, splitClip } from '../assets/Retarget';
import { buildEnemyGun } from '../player/GunAssets';

export interface MatTweak { color?: number; emissive?: number; ei?: number; rough?: number; metal?: number; opacity?: number }
export interface RigDef {
  model: string;
  height: number; // hauteur visée en mètres
  humanoid: boolean;
  clips?: Partial<Record<'idle' | 'walk' | 'run' | 'aim' | 'shoot' | 'reload' | 'hit' | 'hitHead' | 'death' | 'cast' | 'castIdle' | 'attack' | 'attack2', string>>;
  mats?: Record<string, MatTweak>; // par nom de matériau ; '*' = tous
  gun?: boolean;
  walkSpeed?: number; runSpeed?: number; // vitesses de référence des cycles (m/s)
  ghost?: boolean;
}

const UAL = { idle: 'Idle_Loop', walk: 'Walk_Loop', run: 'Jog_Fwd_Loop', aim: 'Pistol_Aim_Neutral', shoot: 'Pistol_Shoot', reload: 'Pistol_Reload', hit: 'Hit_Chest', hitHead: 'Hit_Head', death: 'Death01', cast: 'Spell_Simple_Shoot', castIdle: 'Spell_Simple_Idle_Loop', attack: 'Punch_Cross', attack2: 'Sword_Attack' };

const _v = new THREE.Vector3(), _q = new THREE.Quaternion(), _m = new THREE.Matrix4();

export class CharacterRig {
  root = new THREE.Group();
  model: THREE.Object3D;
  mixer: THREE.AnimationMixer;
  muzzle: THREE.Object3D;
  hand: THREE.Object3D | null = null;
  handL: THREE.Object3D | null = null;
  head: THREE.Object3D | null = null;
  materials: THREE.MeshStandardMaterial[] = [];
  private acts = new Map<string, THREE.AnimationAction>();
  private loco: string = 'idle';
  private combatW = 0; combat = false;
  private shootT = 0; private hitT = 0; private oneShot: THREE.AnimationAction | null = null; private oneShotT = 0;
  dead = false;
  scale = 1;

  /** Distance à la caméra, renseignée par l'entité : règle la fréquence de mise à jour de l'animation. */
  far = 0;
  private animAcc = 0; private animN = 0;

  constructor(public def: RigDef) {
    const m = Assets.clone(def.model)!;
    this.model = m;
    this.root.add(m);
    // mise à l'échelle sur la hauteur voulue ; les modèles glTF regardent +Z, le jeu utilise -Z
    m.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(m);
    this.scale = def.height / Math.max(0.01, box.max.y - box.min.y);
    m.scale.multiplyScalar(this.scale);
    m.position.y = -box.min.y * this.scale;
    m.rotation.y = Math.PI;
    // matériaux propres à l'instance (teintes, flash d'impact)
    const tw = def.mats || {};
    m.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = true; mesh.receiveShadow = false;
      if (!mesh.geometry.attributes.normal) mesh.geometry.computeVertexNormals();
      const conv = (src: THREE.Material) => {
        const ms = src as THREE.MeshStandardMaterial;
        // matériaux non éclairés (KHR_materials_unlit) convertis en PBR pour recevoir lumière et ombres
        const c = ms.isMeshStandardMaterial ? ms.clone() : new THREE.MeshStandardMaterial({ color: (src as THREE.MeshBasicMaterial).color?.clone() ?? new THREE.Color(0xffffff), map: (src as THREE.MeshBasicMaterial).map ?? null, roughness: 0.6, metalness: 0.3 });
        c.name = src.name;
        const t = tw[src.name] || tw['*'];
        if (t) {
          if (t.color !== undefined) c.color.setHex(t.color);
          if (t.emissive !== undefined) { c.emissive.setHex(t.emissive); c.emissiveIntensity = t.ei ?? 1.5; }
          if (t.rough !== undefined) c.roughness = t.rough;
          if (t.metal !== undefined) c.metalness = t.metal;
          if (t.opacity !== undefined) { c.transparent = true; c.opacity = t.opacity; c.depthWrite = false; }
        }
        if (def.ghost) { c.transparent = true; c.opacity = 0.62; c.emissive.setHex(0x3ad0a0); c.emissiveIntensity = 1.4; c.depthWrite = false; }
        c.userData.baseEmissive = c.emissive.clone(); c.userData.baseEI = c.emissiveIntensity;
        this.materials.push(c);
        return c;
      };
      mesh.material = Array.isArray(mesh.material) ? mesh.material.map(conv) : conv(mesh.material);
    });
    m.traverse((o) => {
      // conventions Quaternius (HandR, Head) et Unreal (hand_r, head)
      if (/^HandR$|^LowerArmR$|^hand_r$/.test(o.name) && (!this.hand || o.name === 'HandR' || o.name === 'hand_r')) this.hand = o;
      if (/^HandL$|^hand_l$/.test(o.name) && !this.handL) this.handL = o;
      if (/^Head$|^head$/.test(o.name) && !this.head) this.head = o;
    });
    this.mergeParts(m);
    // élimination hors champ : chaque pièce reçoit la sphère du personnage entier, élargie pour couvrir les animations.
    // Avant, toutes les pièces (une quinzaine par personnage) étaient dessinées et projetées en ombre en permanence.
    m.updateMatrixWorld(true);
    const ws = new THREE.Box3().setFromObject(m).getBoundingSphere(new THREE.Sphere());
    const _s = new THREE.Vector3();
    m.traverse((o) => {
      const mesh = o as THREE.SkinnedMesh;
      if (!mesh.isMesh) return;
      mesh.frustumCulled = true;
      if (mesh.isSkinnedMesh) mesh.boundingSphere = new THREE.Sphere(mesh.worldToLocal(ws.center.clone()), (ws.radius * 1.7 + 0.4) / Math.max(1e-4, mesh.getWorldScale(_s).x));
    });
    this.mixer = new THREE.AnimationMixer(m);
    // clips
    const gl = Assets.gltf(def.model)!;
    const find = (name: string): THREE.AnimationClip | null => gl.animations.find((a) => a.name === name || a.name.endsWith('|' + name) || a.name.endsWith('_' + name)) || null;
    if (def.humanoid) {
      const want = { ...UAL, ...def.clips };
      const names = [...new Set(Object.values(want))];
      const baked = retargetClips(def.model, Assets.gltf(def.model)!.scene, names);
      for (const [k, n] of Object.entries(want)) {
        const c = baked.get(n);
        if (!c) continue;
        if (k === 'aim' || k === 'shoot' || k === 'reload' || k === 'hit' || k === 'hitHead' || k === 'cast' || k === 'castIdle') this.add(k, splitClip(c, true));
        else this.add(k, c);
        if (k === 'idle' || k === 'walk' || k === 'run') this.add(k + '_low', splitClip(c, false));
      }
    } else {
      for (const [k, n] of Object.entries(def.clips || {})) { const c = n ? find(n) : null; if (c) this.add(k, c); }
    }
    // pose d'arme : le fusil est fixé dans la main droite, orienté vers l'avant du personnage
    this.muzzle = new THREE.Object3D();
    if (def.gun && this.hand) {
      const aim = this.acts.get('aim') || this.acts.get('idle');
      if (aim) { aim.play(); this.mixer.update(0); }
      this.root.updateMatrixWorld(true);
      const gun = buildEnemyGun();
      if (gun) {
        const hand = this.hand;
        const mid = hand.children.find((c) => /Middle|^middle_(metacarpal|01)/.test(c.name));
        const palm = hand.getWorldPosition(new THREE.Vector3());
        if (mid) palm.lerp(mid.getWorldPosition(_v), 0.45);
        const desired = new THREE.Matrix4().compose(palm, this.root.getWorldQuaternion(_q), new THREE.Vector3(1, 1, 1));
        const local = _m.copy(hand.matrixWorld).invert().multiply(desired);
        local.decompose(gun.root.position, gun.root.quaternion, gun.root.scale);
        hand.add(gun.root);
        gun.root.traverse((o) => { o.castShadow = true; });
        this.muzzle = gun.muzzle;
      }
      if (aim) aim.stop();
    } else if (this.hand) this.hand.add(this.muzzle);
    else { this.muzzle.position.set(0, def.height * 0.6, -0.4); this.root.add(this.muzzle); }
    this.play('idle', 0);
  }

  private add(k: string, clip: THREE.AnimationClip): void {
    const a = this.mixer.clipAction(clip);
    a.enabled = true;
    this.acts.set(k, a);
  }
  has(k: string): boolean { return this.acts.has(k); }

  private play(k: string, fade: number): void {
    const a = this.acts.get(k);
    if (!a) return;
    a.reset().setEffectiveWeight(1).fadeIn(fade).play();
  }

  /** Locomotion : vitesse horizontale en m/s ; `combat` superpose la visée au haut du corps. */
  setMotion(speed: number, combat: boolean, dt: number): void {
    if (this.dead) return;
    const d = this.def;
    const k = speed < 0.4 ? 'idle' : speed < (d.runSpeed ? d.runSpeed * 0.6 : 3.2) || !this.acts.has('run') ? 'walk' : 'run';
    const target = this.acts.has(k) ? k : 'idle';
    if (target !== this.loco) {
      const prev = this.loco; this.loco = target;
      for (const sfx of ['', '_low']) {
        const a = this.acts.get(prev + sfx), b = this.acts.get(target + sfx);
        if (b) { b.reset().play(); if (a) b.crossFadeFrom(a, 0.25, false); else b.fadeIn(0.25); }
      }
    }
    const cur = this.acts.get(target);
    if (cur && target !== 'idle') {
      const ref = target === 'run' ? d.runSpeed || 3.6 : d.walkSpeed || 1.5;
      cur.timeScale = THREE.MathUtils.clamp(speed / ref, 0.5, 1.8);
      const low = this.acts.get(target + '_low'); if (low) low.timeScale = cur.timeScale;
    }
    this.combat = combat;
    this.combatW += ((combat ? 1 : 0) - this.combatW) * Math.min(1, dt * 6);
  }

  fire(): void { const a = this.acts.get('shoot'); if (!a || this.dead) return; a.reset().setEffectiveWeight(1).play(); this.shootT = Math.min(0.45, a.getClip().duration); }
  cast(): void { this.oneShotPlay('cast', 0.1, 1.2); }
  attack(alt = false): void { this.oneShotPlay(alt && this.acts.has('attack2') ? 'attack2' : 'attack', 0.1, 1.15); }
  hit(head = false): void {
    if (this.dead) return;
    const a = this.acts.get(head && this.acts.has('hitHead') ? 'hitHead' : 'hit');
    if (!a) return;
    a.reset().setEffectiveWeight(1).play(); a.time = 0.05; this.hitT = 0.3;
  }
  private oneShotPlay(k: string, fade: number, speed: number): void {
    const a = this.acts.get(k);
    if (!a || this.dead) return;
    a.reset(); a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = false; a.timeScale = speed; a.setEffectiveWeight(1).fadeIn(fade).play();
    this.oneShot = a; this.oneShotT = a.getClip().duration / speed;
  }
  die(): void {
    if (this.dead) return;
    this.dead = true;
    const d = this.acts.get('death');
    for (const [k, a] of this.acts) if (k !== 'death') a.fadeOut(0.15);
    if (d) { d.reset(); d.setLoop(THREE.LoopOnce, 1); d.clampWhenFinished = true; d.setEffectiveWeight(1).fadeIn(0.1).play(); }
  }
  get deathDone(): boolean { const d = this.acts.get('death'); return !d || (!d.isRunning() && this.dead); }

  /** Éclat blanc lors d'un impact. */
  flash(k: number): void {
    for (const m of this.materials) {
      if (k > 0) { m.emissive.setRGB(1, 1, 1); m.emissiveIntensity = 0.9 * k; }
      else { m.emissive.copy(m.userData.baseEmissive); m.emissiveIntensity = m.userData.baseEI; }
    }
  }

  update(dt: number): void {
    if (!this.dead) {
      // poids des couches : visée (haut du corps) contre locomotion complète
      if (this.shootT > 0) this.shootT -= dt;
      if (this.hitT > 0) this.hitT -= dt;
      if (this.oneShotT > 0) this.oneShotT -= dt;
      const shootW = this.shootT > 0 ? 1 : 0, hitW = this.hitT > 0 ? Math.min(1, this.hitT / 0.15) : 0;
      const one = this.oneShotT > 0 ? 1 : 0;
      const cw = this.combatW;
      const castIdle = this.acts.get('castIdle'), aim = this.acts.get('aim');
      const upper = this.def.gun ? aim : castIdle;
      const full = this.acts.get(this.loco), low = this.acts.get(this.loco + '_low');
      if (upper) { if (!upper.isRunning()) upper.play(); upper.setEffectiveWeight(cw * (1 - shootW) * (1 - hitW) * (1 - one)); }
      if (low) { if (!low.isRunning()) low.play(); low.setEffectiveWeight(cw); }
      if (full) full.setEffectiveWeight(this.def.humanoid ? Math.max(0.0001, 1 - cw) * (1 - one) : Math.max(0.0001, 1 - one - shootW * 0.6));
      const sh = this.acts.get('shoot'); if (sh) sh.setEffectiveWeight(shootW * (1 - hitW));
      for (const k of ['hit', 'hitHead']) { const a = this.acts.get(k); if (a && a.isRunning()) a.setEffectiveWeight(hitW); }
    }
    // animation allégée au loin : au-delà de 25 m une image sur deux, au-delà de 50 m une sur quatre (temps cumulé, sans ralentir le mouvement)
    this.animAcc += dt;
    const every = this.far > 50 ? 4 : this.far > 25 ? 2 : 1;
    if (++this.animN >= every) { this.mixer.update(this.animAcc); this.animAcc = 0; this.animN = 0; }
  }

  /**
   * Fusionne les pièces animées qui partagent un matériau (tête, torse, bras… d'un même tissu) en une seule : un personnage
   * modulaire passe d'une quinzaine d'appels de dessin à quelques-uns. Chaque pièce est ramenée dans un repère commun
   * (matrice de liaison appliquée), ses indices d'os sont renumérotés sur un squelette unique. Si deux pièces ne donnent pas
   * la même pose de référence à un os commun, le groupe n'est pas fusionné (rendu inchangé).
   */
  private mergeParts(model: THREE.Object3D): void {
    model.updateMatrixWorld(true);
    const groups = new Map<string, THREE.SkinnedMesh[]>();
    model.traverse((o) => {
      const sm = o as THREE.SkinnedMesh;
      if (!sm.isSkinnedMesh || Array.isArray(sm.material) || !sm.visible || sm.morphTargetInfluences) return;
      const mt = sm.material as THREE.MeshStandardMaterial;
      const g = sm.geometry;
      const key = [mt.name, mt.color?.getHex(), mt.emissive?.getHex(), mt.emissiveIntensity, mt.transparent, mt.opacity, mt.map?.uuid, Object.keys(g.attributes).sort().join(','), !!g.index].join('|');
      let a = groups.get(key); if (!a) groups.set(key, (a = [])); a.push(sm);
    });
    for (const parts of groups.values()) {
      if (parts.length < 2) continue;
      // Les modèles sont quantifiés (glTF) : chaque pièce a son propre repère de déquantification D, intégré à ses matrices
      // inverses d'os (inv_p = B⁻¹·D_p). Pour une pièce p et la référence r : X_p = inv_r⁻¹·inv_p = D_r⁻¹·D_p, identique pour tous
      // les os communs. La géométrie de p est ramenée dans le repère de r par G_p = X_p·bindMatrix_p ; les os partagent inv_r.
      const bones: THREE.Bone[] = [], inv: THREE.Matrix4[] = [], at = new Map<THREE.Bone, number>();
      const remaps: number[][] = [], xs: THREE.Matrix4[] = [];
      let ok = true;
      const close = (a: THREE.Matrix4, b: THREE.Matrix4) => a.elements.every((e, k) => Math.abs(e - b.elements[k]) <= 1e-3 * Math.max(1, Math.abs(e), Math.abs(b.elements[k])));
      for (const sm of parts) {
        const sk = sm.skeleton, map: number[] = [];
        // X_p à partir du premier os déjà connu (référence : identité)
        let X = new THREE.Matrix4();
        const k0 = sk.bones.findIndex((b) => at.has(b));
        if (bones.length && k0 < 0) { ok = false; break; }
        if (k0 >= 0) X = inv[at.get(sk.bones[k0])!].clone().invert().multiply(sk.boneInverses[k0]);
        const Xi = X.clone().invert(), t = new THREE.Matrix4();
        sk.bones.forEach((b, i) => {
          const j = at.get(b);
          if (j === undefined) { at.set(b, bones.length); map.push(bones.length); bones.push(b); inv.push(sk.boneInverses[i].clone().multiply(Xi)); }
          else { map.push(j); if (!close(t.multiplyMatrices(inv[j], X), sk.boneInverses[i])) ok = false; }
        });
        remaps.push(map); xs.push(X);
      }
      if (!ok) continue;
      const v = new THREE.Vector3(), nm = new THREE.Matrix3();
      const geos = parts.map((sm, n) => {
        const src = sm.geometry, G = xs[n].clone().multiply(sm.bindMatrix);
        nm.setFromMatrix4(G);
        const g = new THREE.BufferGeometry();
        if (src.index) g.setIndex(Array.from(src.index.array as ArrayLike<number>));
        // attributs convertis en flottants (déquantifiés) avant toute transformation
        const P = src.attributes.position, N = src.attributes.normal, W = src.attributes.skinWeight, I = src.attributes.skinIndex;
        const pos = new Float32Array(P.count * 3), nor = new Float32Array(P.count * 3), wei = new Float32Array(P.count * 4), idx = new Uint16Array(P.count * 4);
        const map = remaps[n];
        for (let i = 0; i < P.count; i++) {
          v.set(P.getX(i), P.getY(i), P.getZ(i)).applyMatrix4(G); pos.set([v.x, v.y, v.z], i * 3);
          if (N) { v.set(N.getX(i), N.getY(i), N.getZ(i)).applyMatrix3(nm).normalize(); nor.set([v.x, v.y, v.z], i * 3); }
          wei.set([W.getX(i), W.getY(i), W.getZ(i), W.getW(i)], i * 4);
          idx.set([map[I.getX(i)] ?? 0, map[I.getY(i)] ?? 0, map[I.getZ(i)] ?? 0, map[I.getW(i)] ?? 0], i * 4);
        }
        g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        if (N) g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
        g.setAttribute('skinWeight', new THREE.BufferAttribute(wei, 4));
        g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(idx, 4));
        if (src.attributes.uv) { const U = src.attributes.uv, uv = new Float32Array(U.count * 2); for (let i = 0; i < U.count; i++) uv.set([U.getX(i), U.getY(i)], i * 2); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); }
        return g;
      });
      const merged = mergeGeometries(geos, false);
      for (const g of geos) g.dispose();
      if (!merged) continue;
      const first = parts[0];
      const mesh = new THREE.SkinnedMesh(merged, first.material);
      mesh.name = first.name + '_fusion';
      mesh.castShadow = first.castShadow; mesh.receiveShadow = first.receiveShadow;
      first.parent!.add(mesh);
      mesh.bind(new THREE.Skeleton(bones, inv), new THREE.Matrix4());
      for (const sm of parts) {
        sm.removeFromParent();
        if (sm !== first) { const i = this.materials.indexOf(sm.material as THREE.MeshStandardMaterial); if (i >= 0) this.materials.splice(i, 1); (sm.material as THREE.Material).dispose(); }
      }
    }
  }

  dispose(): void { this.mixer.stopAllAction(); for (const m of this.materials) m.dispose(); }
}
