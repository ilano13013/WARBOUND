// Chargement des assets externes (glTF compressés meshopt, textures PBR, sons).
// Tout échec de chargement est toléré : le jeu retombe sur les modèles procéduraux de la 1.0.
import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { clone as skeletonClone } from 'three/examples/jsm/utils/SkeletonUtils.js';

export interface Manifest { models: string[]; textures: string[]; sounds: string[] }

const BASE = (import.meta.env.BASE_URL || './') + 'assets/';

class AssetStore {
  models = new Map<string, GLTF>();
  textures = new Map<string, THREE.Texture>();
  soundData = new Map<string, ArrayBuffer>();
  sounds = new Map<string, AudioBuffer>();
  failed: string[] = [];
  ready = false;
  private loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  private texLoader = new THREE.TextureLoader();

  /** Charge tout le manifeste ; `onProgress` reçoit une fraction 0..1. */
  async loadAll(onProgress: (k: number, label: string) => void): Promise<void> {
    let man: Manifest;
    try { man = await (await fetch(BASE + 'manifest.json')).json(); } catch { this.failed.push('manifest.json'); this.ready = true; onProgress(1, ''); return; }
    const jobs: { label: string; run: () => Promise<void>; w: number }[] = [];
    for (const m of man.models) jobs.push({ label: m, w: 3, run: async () => { this.models.set(m, await this.loader.loadAsync(BASE + 'models/' + m + '.glb')); } });
    for (const t of man.textures) jobs.push({ label: t, w: 1, run: async () => {
      const tex = await this.texLoader.loadAsync(BASE + 'textures/' + t + '.jpg');
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.anisotropy = 8;
      if (t.endsWith('_color')) tex.colorSpace = THREE.SRGBColorSpace;
      this.textures.set(t, tex);
    } });
    for (const s of man.sounds) jobs.push({ label: s, w: 1, run: async () => { this.soundData.set(s, await (await fetch(BASE + 'sounds/' + s + '.ogg')).arrayBuffer()); } });
    const total = jobs.reduce((a, j) => a + j.w, 0);
    let done = 0;
    let i = 0;
    const worker = async () => {
      while (i < jobs.length) {
        const j = jobs[i++];
        try { await j.run(); } catch { this.failed.push(j.label); }
        done += j.w; onProgress(done / total, j.label);
      }
    };
    await Promise.all(Array.from({ length: 6 }, worker));
    this.ready = true;
    if (this.failed.length) console.warn('[WARBOUND] assets non chargés :', this.failed);
  }

  /** Décode les sons une fois le contexte audio créé (après un geste utilisateur). */
  async decodeSounds(ctx: AudioContext): Promise<void> {
    for (const [k, data] of this.soundData) {
      if (this.sounds.has(k)) continue;
      try { this.sounds.set(k, await ctx.decodeAudioData(data.slice(0))); } catch { this.failed.push('decode:' + k); }
    }
  }

  has(name: string): boolean { return this.models.has(name); }
  gltf(name: string): GLTF | null { return this.models.get(name) || null; }
  /** Copie indépendante d'un modèle (squelettes compris). */
  clone(name: string): THREE.Object3D | null {
    const g = this.models.get(name);
    return g ? skeletonClone(g.scene) : null;
  }
  tex(name: string): THREE.Texture | null { return this.textures.get(name) || null; }
}

export const Assets = new AssetStore();
