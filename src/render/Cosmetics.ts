// Rendu des cosmétiques : textures de camouflage générées par le code (aucun fichier externe), teintes de tenue,
// emblème et carte de visite. Ce module ne touche à aucune statistique de jeu.
import * as THREE from 'three';
import type { MatTweak } from './CharacterRig';

const cache = new Map<string, THREE.CanvasTexture>();

function rng(seed: number): () => number { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

/** Texture de camouflage (512 px, répétée). */
export function camoTexture(id: string): THREE.CanvasTexture | null {
  if (cache.has(id)) return cache.get(id)!;
  const c = document.createElement('canvas'); c.width = c.height = 512;
  const x = c.getContext('2d')!;
  const r = rng(id.length * 7919 + id.charCodeAt(5));
  const blot = (col: string, n: number, s0: number, s1: number) => { x.fillStyle = col; for (let i = 0; i < n; i++) { const px = r() * 512, py = r() * 512, s = s0 + r() * (s1 - s0); x.beginPath(); for (let k = 0; k < 9; k++) { const a = (k / 9) * Math.PI * 2, rr = s * (0.6 + r() * 0.5); const fx = px + Math.cos(a) * rr, fy = py + Math.sin(a) * rr * 0.7; if (k) x.lineTo(fx, fy); else x.moveTo(fx, fy); } x.closePath(); x.fill(); } };
  switch (id) {
    case 'camo_cendre':
      x.fillStyle = '#3a3a3c'; x.fillRect(0, 0, 512, 512);
      blot('#5a5856', 40, 25, 70); blot('#232325', 40, 20, 60); blot('#7a7672', 25, 10, 30);
      for (let i = 0; i < 160; i++) { x.fillStyle = r() < 0.5 ? '#ff7a2a' : '#ffb04a'; x.globalAlpha = 0.5 + r() * 0.5; x.fillRect(r() * 512, r() * 512, 2 + r() * 3, 2 + r() * 3); }
      x.globalAlpha = 1; break;
    case 'camo_glacier':
      x.fillStyle = '#d8e4ee'; x.fillRect(0, 0, 512, 512);
      for (const [col, n, s] of [['#9ab8d4', 260, 24], ['#5a7e9e', 160, 16], ['#f4f8fc', 200, 20]] as [string, number, number][]) { x.fillStyle = col; for (let i = 0; i < n; i++) { const w = s * (1 + Math.floor(r() * 3)); x.fillRect(Math.floor(r() * 32) * 16, Math.floor(r() * 32) * 16, w, s); } }
      break;
    case 'camo_fracture':
      x.fillStyle = '#1a0e2a'; x.fillRect(0, 0, 512, 512);
      blot('#2a1446', 30, 30, 80);
      x.strokeStyle = '#c08aff'; x.lineCap = 'round';
      for (let i = 0; i < 26; i++) { let px = r() * 512, py = r() * 512; x.lineWidth = 1 + r() * 3; x.beginPath(); x.moveTo(px, py); for (let k = 0; k < 6; k++) { px += (r() - 0.5) * 90; py += (r() - 0.5) * 90; x.lineTo(px, py); } x.stroke(); }
      break;
    case 'camo_fondateur':
      x.fillStyle = '#121214'; x.fillRect(0, 0, 512, 512);
      x.strokeStyle = '#c9a96a'; x.lineWidth = 3;
      for (let i = -512; i < 1024; i += 64) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i + 512, 512); x.stroke(); }
      x.lineWidth = 1; x.strokeStyle = '#8a6a3a';
      for (let i = -512; i < 1024; i += 64) { x.beginPath(); x.moveTo(i + 32, 512); x.lineTo(i + 544, 0); x.stroke(); }
      break;
    default: return null;
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(2, 2); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  cache.set(id, t);
  return t;
}

const SKIP = /glass|lens|reticle|scope_glass|sight_glass|holo|flash|emit/i;

const _p = new THREE.Vector3(), _n = new THREE.Vector3(), _nm = new THREE.Matrix3();

/** Coordonnées de texture projetées sur la géométrie (projection selon l'axe dominant de la normale) :
 *  le motif garde la même taille sur toute l'arme, quelles que soient les coordonnées d'origine du modèle. */
function projectUV(m: THREE.Mesh, k: number): void {
  const g0 = m.geometry as THREE.BufferGeometry;
  const pos = g0.attributes.position;
  if (!pos) return;
  const g = g0.clone();
  if (!g.attributes.normal) g.computeVertexNormals();
  const nor = g.attributes.normal;
  m.updateWorldMatrix(true, false);
  _nm.getNormalMatrix(m.matrixWorld);
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    _p.fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld);
    _n.fromBufferAttribute(nor, i).applyMatrix3(_nm);
    const ax = Math.abs(_n.x), ay = Math.abs(_n.y), az = Math.abs(_n.z);
    const [u, v] = ax >= ay && ax >= az ? [_p.z, _p.y] : ay >= az ? [_p.x, _p.z] : [_p.x, _p.y];
    uv[i * 2] = u * k; uv[i * 2 + 1] = v * k;
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  m.geometry = g;
}

/** Applique un camouflage aux maillages d'une arme (vue subjective ou aperçu). Les optiques et lumières sont épargnées. */
export function applyCamo(root: THREE.Object3D, id: string | null | undefined): void {
  if (!id) return;
  const tex = camoTexture(id);
  if (!tex) return;
  root.updateWorldMatrix(true, true);
  const size = new THREE.Box3().setFromObject(root).getSize(new THREE.Vector3());
  const k = 1.6 / Math.max(1e-3, size.x, size.y, size.z); // environ 3 motifs sur la longueur de l'arme (texture répétée ×2)
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || !m.material) return;
    const mats = Array.isArray(m.material) ? m.material : [m.material];
    if (mats.some((mm) => !(mm.transparent || SKIP.test(mm.name || '') || SKIP.test(m.name || '')))) projectUV(m, k);
    const conv = (src: THREE.Material): THREE.Material => {
      const s = src as THREE.MeshStandardMaterial;
      if (s.transparent || SKIP.test(s.name || '') || SKIP.test(m.name || '') || (s.emissive && s.emissive.getHex() !== 0 && s.emissiveIntensity > 0.5)) return src;
      const c = (s.isMeshStandardMaterial ? s.clone() : new THREE.MeshStandardMaterial({ roughness: 0.6, metalness: 0.4 })) as THREE.MeshStandardMaterial;
      c.map = tex; c.color.setHex(0xffffff); c.vertexColors = false;
      if (id === 'camo_fracture') { c.emissiveMap = tex; c.emissive.setHex(0x6a3aaa); c.emissiveIntensity = 0.6; }
      c.needsUpdate = true;
      return c;
    };
    m.material = Array.isArray(m.material) ? m.material.map(conv) : conv(m.material);
  });
}

/** Teintes de tenue par matériau du personnage. En équipe, la couleur d'équipe reste imposée (tenue principale et visière). */
export function outfitMats(id: string | null | undefined, teamLocked: boolean): Record<string, MatTweak> {
  if (id !== 'outfit_fondateur') return {};
  const accents: Record<string, MatTweak> = { Swat_Black: { color: 0xb08a3a, metal: 0.8, rough: 0.35 } };
  return teamLocked ? accents : { ...accents, Swat: { color: 0x1c2a44, rough: 0.7 } };
}

/** Image d'emblème ou de carte de visite (URL de données). */
export function cosmeticImage(id: string): string {
  const card = id.startsWith('card_');
  const c = document.createElement('canvas'); c.width = card ? 480 : 160; c.height = card ? 120 : 160;
  const x = c.getContext('2d')!;
  if (card) {
    const g = x.createLinearGradient(0, 0, 480, 0); g.addColorStop(0, '#2a2010'); g.addColorStop(0.5, '#6a5222'); g.addColorStop(1, '#1a1408');
    x.fillStyle = g; x.fillRect(0, 0, 480, 120);
    x.strokeStyle = '#e0c27a'; x.lineWidth = 3; x.strokeRect(6, 6, 468, 108);
    x.fillStyle = '#f4e2b0'; x.font = 'bold 34px serif'; x.textAlign = 'center'; x.fillText('FONDATEUR', 240, 62);
    x.font = '16px sans-serif'; x.fillStyle = '#e0c27a'; x.fillText('WARBOUND — THE FRACTURE CHRONICLES', 240, 92);
  } else {
    x.fillStyle = '#c9a96a'; x.beginPath(); x.moveTo(80, 8); x.lineTo(148, 34); x.lineTo(140, 104); x.lineTo(80, 152); x.lineTo(20, 104); x.lineTo(12, 34); x.closePath(); x.fill();
    x.fillStyle = '#16120a'; x.beginPath(); x.moveTo(80, 18); x.lineTo(138, 40); x.lineTo(131, 100); x.lineTo(80, 141); x.lineTo(29, 100); x.lineTo(22, 40); x.closePath(); x.fill();
    x.fillStyle = '#e0c27a'; x.font = 'bold 76px serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('W', 80, 84);
  }
  return c.toDataURL();
}
