// Aperçu 3D (arme ou opérateur) dans un canevas de page : boutique et atelier d'arme. Contexte WebGL propre, libéré à la fermeture.
import * as THREE from 'three';
import { applyCamo, outfitMats } from '../render/Cosmetics';
import { buildGunAsset } from '../player/GunAssets';
import { buildWeaponModel } from '../player/WeaponModels';
import { WEAPONS, type AttachSlot } from '../data/weapons';
import { CharacterRig } from '../render/CharacterRig';
import { RIGS } from '../ai/EnemyRigs';
import { Assets } from '../assets/Assets';

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
    this.resize();
    const loop = () => { this.raf = requestAnimationFrame(loop); this.frame(); };
    loop();
  }

  private resize(): void { const w = this.canvas.clientWidth || 360, h = this.canvas.clientHeight || 260; this.r.setSize(w, h, false); this.cam.aspect = w / h; this.cam.updateProjectionMatrix(); }

  private clear(): void { if (this.obj) this.scene.remove(this.obj); this.obj = null; this.rig?.dispose(); this.rig = null; }

  showWeapon(camo: string | null, id = 'ar17', attach: Partial<Record<AttachSlot, string>> = {}, spin = true): void {
    this.clear();
    this.spin = spin;
    const def = WEAPONS[id] || WEAPONS.ar17;
    const gun = buildGunAsset(def, attach);
    const g = gun ? gun.root : buildWeaponModel(def, attach, false).group;
    applyCamo(g, camo);
    const box = new THREE.Box3().setFromObject(g), c = box.getCenter(new THREE.Vector3()), s = box.getSize(new THREE.Vector3()).length();
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

