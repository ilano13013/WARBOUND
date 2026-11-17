// Aperçu 3D (arme ou opérateur) dans un canevas de page : boutique et atelier d'arme. Contexte WebGL propre, libéré à la fermeture.
import * as THREE from 'three';
import { applyCamo, outfitMats } from '../render/Cosmetics';
import { buildGunAsset } from '../player/GunAssets';
import { buildWeaponModel } from '../player/WeaponModels';
import { WEAPONS, type AttachSlot } from '../data/weapons';
import { CharacterRig } from '../render/CharacterRig';
import { RIGS } from '../ai/EnemyRigs';
import { Assets } from '../assets/Assets';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { ViewModel, VM, vmReady, vmLoad } from '../player/ViewModel';
import { applyCamoMeshes } from '../render/Cosmetics';

/** Aperçu 3D dans un canevas de la page (contexte WebGL propre, libéré à la fermeture). */
export class Preview {
  private r: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private cam = new THREE.PerspectiveCamera(32, 1, 0.05, 50);
  private obj: THREE.Object3D | null = null;
  private rig: CharacterRig | null = null;
  private raf = 0; private last = performance.now();
  private spin = true;

  constructor(private canvas: HTMLCanvasElement) {
    this.r = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.r.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    this.r.outputColorSpace = THREE.SRGBColorSpace;
    this.r.toneMapping = THREE.ACESFilmicToneMapping;
    this.scene.add(new THREE.HemisphereLight(0xdfe8ff, 0x3a3020, 1.6));
    const d = new THREE.DirectionalLight(0xfff0dc, 2.6); d.position.set(2, 3, 2.5); this.scene.add(d);
    const b = new THREE.DirectionalLight(0x9ab8ff, 1.2); b.position.set(-2.5, 1.5, -2); this.scene.add(b);
    // reflets : nécessaires aux matériaux métalliques des armes texturées
    const pm = new THREE.PMREMGenerator(this.r); this.scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture; this.scene.environmentIntensity = 0.55; pm.dispose();
    this.resize();
    const loop = () => { this.raf = requestAnimationFrame(loop); this.frame(); };
    loop();
  }

  private resize(): void { const w = this.canvas.clientWidth || 360, h = this.canvas.clientHeight || 260; this.r.setSize(w, h, false); this.cam.aspect = w / h; this.cam.updateProjectionMatrix(); }

  private vm: ViewModel | null = null; private req = 0;
  private clear(): void { if (this.obj) this.scene.remove(this.obj); this.obj = null; this.vm?.dispose(); this.vm = null; this.rig?.dispose(); this.rig = null; }

  showWeapon(camo: string | null, id = 'ar17', attach: Partial<Record<AttachSlot, string>> = {}, spin = true): void {
    this.clear();
    this.spin = spin;
    const def = WEAPONS[id] || WEAPONS.ar17;
    const req = ++this.req;
    let g: THREE.Object3D;
    const box = new THREE.Box3();
    if (vmReady(def.id)) {
      // arme de l'ensemble importé, sans les bras, en pose de repos
      const vm = new ViewModel(def.id, VM[def.id], attach); this.vm = vm; g = vm.root;
      for (const a of vm.armMeshes) a.visible = false;
      if (vm.tune.previewHideBone) { const re = vm.tune.previewHideBone; vm.root.traverse((o) => { if (re.test(o.name)) o.scale.setScalar(1e-4); }); vm.freeze = true; }
      applyCamoMeshes(vm.gunMeshes, camo);
      g.updateMatrixWorld(true);
      // boîte mesurée sur les sommets déformés par le squelette (la boîte d'un maillage skinné n'est pas fiable ici)
      const v = new THREE.Vector3(), xs: number[] = [], ys: number[] = [], zs: number[] = [];
      for (const m of vm.gunMeshes) {
        if (vm.tune.previewHide?.test(m.name)) { m.visible = false; continue; }
        const sk = m as THREE.SkinnedMesh, pos = m.geometry.attributes.position;
        if (sk.isSkinnedMesh) sk.skeleton.update();
        for (let i = 0; i < pos.count; i += 3) { v.fromBufferAttribute(pos, i); if (sk.isSkinnedMesh) sk.applyBoneTransform(i, v); v.applyMatrix4(m.matrixWorld); xs.push(v.x); ys.push(v.y); zs.push(v.z); }
      }
      // bornes à 1 % et 99 % : une pièce rangée hors champ par l'animation de repos (chargeur de rechange) n'agrandit pas l'aperçu
      const q = (a: number[], k: number) => a.sort((x, y) => x - y)[Math.min(a.length - 1, Math.max(0, Math.round(k * (a.length - 1))))];
      if (xs.length) box.set(new THREE.Vector3(q(xs, 0.01), q(ys, 0.01), q(zs, 0.01)), new THREE.Vector3(q(xs, 0.99), q(ys, 0.99), q(zs, 0.99)));
    } else {
      if (VM[def.id]) void vmLoad(def.id).then((ok) => { if (ok && req === this.req && this.obj) this.showWeapon(camo, id, attach, spin); });
      const gun = buildGunAsset(def, attach);
      g = gun ? gun.root : buildWeaponModel(def, attach, false).group;
      applyCamo(g, camo);
      box.setFromObject(g);
    }
    const c = box.getCenter(new THREE.Vector3()), s = box.getSize(new THREE.Vector3()).length();
    g.position.sub(c);
    const pivot = new THREE.Group(); pivot.add(g); pivot.scale.setScalar(1.1 / s);
    this.obj = pivot; this.scene.add(pivot);
    // atelier (arme de profil, scène large) : caméra plus éloignée pour voir l'arme entière
    if (spin) { this.cam.position.set(0, 0.12, 1.15); this.cam.lookAt(0, 0, 0); }
    else { const asp = this.cam.aspect; this.cam.position.set(0, 0.02, asp > 1.4 ? 1.75 : 2.3); this.cam.lookAt(0, 0.02, 0); }
  }

  showOperator(outfit: string | null): void {
    this.clear();
    const d = RIGS.rival;
    if (!d || !Assets.has(d.model) || !Assets.has('anims/ual')) return;
    try { this.rig = new CharacterRig({ ...d, mats: { ...(d.mats || {}), Visor: { color: 0x050505, emissive: 0x6ab0ff, ei: 2.2 }, Swat: { color: 0x3c4432, rough: 0.85 }, Swat_Black: { color: 0x15171a }, ...outfitMats(outfit, false) } }); } catch { return; }
    this.rig.setMotion(0, true, 1);
    this.obj = this.rig.root; this.scene.add(this.obj);
    this.cam.position.set(0, 1.15, 3.3); this.cam.lookAt(0, 0.95, 0);
  }

  private frame(): void {
    const now = performance.now(), dt = Math.min(0.05, (now - this.last) / 1000); this.last = now;
    if (this.obj) { if (this.spin) this.obj.rotation.y += dt * 0.6; else this.obj.rotation.y = Math.PI / 2 + Math.sin(now / 2200) * 0.35; }
    this.rig?.update(dt);
    this.r.render(this.scene, this.cam);
  }

  dispose(): void { cancelAnimationFrame(this.raf); this.clear(); this.r.dispose(); this.r.forceContextLoss(); }
}

