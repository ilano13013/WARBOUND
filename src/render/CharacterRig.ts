// Personnage animé à partir d'un modèle glTF : locomotion, visée et tir superposés au haut du corps,
// sorts, attaques, réactions aux dégâts et mort. Les humanoïdes utilisent les clips retargetés de la UAL.
import * as THREE from 'three';
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
      mesh.castShadow = true; mesh.receiveShadow = false; mesh.frustumCulled = false;
      const conv = (src: THREE.Material) => {
        const c = (src as THREE.MeshStandardMaterial).clone();
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
      if (/^HandR$|^LowerArmR$/.test(o.name) && (!this.hand || o.name === 'HandR')) this.hand = o;
      if (/^HandL$/.test(o.name) && !this.handL) this.handL = o;
      if (/^Head$/.test(o.name) && !this.head) this.head = o;
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
        const mid = hand.children.find((c) => /Middle/.test(c.name));
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
    this.mixer.update(dt);
  }

  dispose(): void { this.mixer.stopAllAction(); for (const m of this.materials) m.dispose(); }
}
