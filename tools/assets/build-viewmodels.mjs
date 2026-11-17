// Armes en vue subjective (bras + arme + animations) : conversion des ensembles sources en GLB optimisés.
// Sources : voir ASSET_CREDITS.md (CC BY 4.0 et CC0), récupérées par tools/assets/fetch-viewmodels.sh dans $VM_SRC.
// Sortie : public/assets/models/vm/<arme>.glb — animations renommées (idle, fire, reload, reloadEmpty, draw…),
// textures WebP redimensionnées, géométrie compressée (meshopt). Chargées à la demande par le jeu, pas au démarrage.
//
//   node tools/assets/build-viewmodels.mjs [id,id…]
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, prune, resample, meshopt, textureCompress, metalRough, mergeDocuments, unpartition, simplify, weld } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptDecoder, MeshoptSimplifier } from 'meshoptimizer';
import { VIEWMODELS } from './viewmodels.config.mjs';

const SRC = process.env.VM_SRC || '/tmp/cand';
const OUT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../public/assets/models/vm');
fs.mkdirSync(OUT, { recursive: true });
await MeshoptEncoder.ready; await MeshoptDecoder.ready; await MeshoptSimplifier.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });

const find = (dir) => { const d = path.join(SRC, dir); const f = fs.readdirSync(d).find((x) => /\.(gltf|glb)$/.test(x)); if (!f) throw new Error('pas de glTF dans ' + d); return path.join(d, f); };
const nodeByName = (doc, re) => doc.getRoot().listNodes().find((n) => re.test(n.getName()));

/** Recolore une texture de couleur (harmonisation des manches entre ensembles d'auteurs différents). */
async function recolor(tex, fn) {
  const img = sharp(Buffer.from(tex.getImage()));
  const { data, info } = await img.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  for (let i = 0; i < data.length; i += 4) { const [r, g, b] = fn(data[i], data[i + 1], data[i + 2]); data[i] = r; data[i + 1] = g; data[i + 2] = b; }
  tex.setImage(new Uint8Array(await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toBuffer())).setMimeType('image/png');
}

async function build(cfg) {
  // texture absente du miroir source : remplacée par une valeur uniforme (documentée dans ASSET_CREDITS.md)
  if (cfg.missing) for (const [f, rgba] of Object.entries(cfg.missing)) {
    const fp = path.join(SRC, cfg.src, f);
    if (!fs.existsSync(fp)) await sharp({ create: { width: 8, height: 8, channels: 4, background: { r: rgba[0], g: rgba[1], b: rgba[2], alpha: rgba[3] / 255 } } }).png().toFile(fp);
  }
  const doc = await io.read(find(cfg.src));
  const root = doc.getRoot();
  // matériaux spéculaire/brillance (anciens exports Sketchfab) -> métal/rugosité
  if (root.listExtensionsUsed().some((e) => e.extensionName === 'KHR_materials_pbrSpecularGlossiness')) await doc.transform(metalRough());
  // animations : seules celles déclarées sont gardées, sous leur nom canonique
  const want = new Map(Object.entries(cfg.clips).map(([k, v]) => [v, k]));
  for (const a of root.listAnimations()) {
    const k = want.get(a.getName());
    if (k) a.setName(k); else a.dispose();
  }
  const got = root.listAnimations().map((a) => a.getName());
  for (const k of Object.keys(cfg.clips)) if (!got.includes(k)) throw new Error(`${cfg.id} : animation « ${cfg.clips[k]} » absente de la source`);
  // maillages retirés (arme d'origine remplacée, décor de présentation…)
  if (cfg.remove) for (const n of root.listNodes()) { const m = n.getMesh(); if (m && m.listPrimitives().some((p) => cfg.remove.test(p.getMaterial()?.getName() || ''))) n.setMesh(null); }
  // nom stable des maillages : celui de leur matériau (le jeu s'en sert pour masquer silencieux, lunette…)
  for (const n of root.listNodes()) { const m = n.getMesh(); if (m) n.setName('mesh_' + (m.listPrimitives()[0].getMaterial()?.getName() || 'x')); }
  // extensions de matériau inutiles au rendu du jeu (reflet spéculaire séparé)
  for (const m of root.listMaterials()) for (const e of ['KHR_materials_specular', 'KHR_materials_ior']) m.setExtension(e, null);

  // arme d'un autre auteur montée sur l'os d'arme de l'ensemble (mêmes bras et animations)
  if (cfg.gun) {
    const gdoc = await io.read(find(cfg.gun.src));
    if (gdoc.getRoot().listExtensionsUsed().some((e) => e.extensionName === 'KHR_materials_pbrSpecularGlossiness')) await gdoc.transform(metalRough());
    for (const a of gdoc.getRoot().listAnimations()) a.dispose();
    if (cfg.gun.remove) for (const n of gdoc.getRoot().listNodes()) { const m = n.getMesh(); if (m && (cfg.gun.remove.test(n.getName()) || m.listPrimitives().some((p) => cfg.gun.remove.test(p.getMaterial()?.getName() || '')))) n.setMesh(null); }
    if (cfg.gun.simplify) await gdoc.transform(weld(), simplify({ simplifier: MeshoptSimplifier, ratio: cfg.gun.simplify, error: 0.002 }));
    const map = mergeDocuments(doc, gdoc);
    await doc.transform(unpartition());
    const gscene = root.listScenes()[1];
    const bone = nodeByName(doc, cfg.gun.bone || /^Rif_\d+$/);
    if (!bone) throw new Error(cfg.id + ' : os d’arme introuvable');
    const holder = doc.createNode('gun_mount').setTranslation(cfg.gun.pos || [0, 0, 0]).setRotation(cfg.gun.rot || [0, 0, 0, 1]).setScale(Array(3).fill(cfg.gun.scale || 1));
    bone.addChild(holder);
    for (const c of gscene.listChildren()) holder.addChild(c);
    gscene.dispose();
    void map;
    // chargeur de l'arme montée : suit l'os de chargeur de l'ensemble
    if (cfg.gun.mag) {
      const magBone = nodeByName(doc, cfg.gun.magBone || /^Pmag_\d+$/);
      const magHolder = doc.createNode('mag_mount').setTranslation(cfg.gun.mag.pos || [0, 0, 0]).setRotation(cfg.gun.mag.rot || [0, 0, 0, 1]).setScale(Array(3).fill(cfg.gun.mag.scale || cfg.gun.scale || 1));
      magBone.addChild(magHolder);
      for (const n of root.listNodes()) if (cfg.gun.mag.node.test(n.getName()) && n.getMesh()) { const m = n.getMesh(); n.setMesh(null); magHolder.addChild(doc.createNode('mag_mesh').setMesh(m)); }
    }
    for (const n of root.listNodes()) { const m = n.getMesh(); if (m && !n.getName().startsWith('mesh_') && n.getName() !== 'mag_mesh') n.setName('gun_' + (m.listPrimitives()[0].getMaterial()?.getName() || 'x')); }
  }
  if (cfg.recolor) for (const m of root.listMaterials()) { const fn = cfg.recolor[m.getName()]; const t = m.getBaseColorTexture(); if (fn && t) await recolor(t, fn); }
  if (cfg.tint) for (const m of root.listMaterials()) { const c = cfg.tint[m.getName()]; if (c) m.setBaseColorFactor([...c, 1]); }

  await doc.transform(
    resample(), dedup(), prune({ keepLeaves: true }),
    textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [cfg.texSize || 1024, cfg.texSize || 1024], quality: 84 }),
    meshopt({ encoder: MeshoptEncoder, level: 'medium' }),
  );
  const file = path.join(OUT, cfg.id + '.glb');
  await io.write(file, doc);
  const tris = root.listMeshes().reduce((a, m) => a + m.listPrimitives().reduce((b, p) => b + (p.getIndices()?.getCount() || 0) / 3, 0), 0);
  console.log(`${cfg.id}: ${(fs.statSync(file).size / 1e6).toFixed(2)} Mo, ${Math.round(tris)} triangles, animations ${got.join(', ')}, maillages ${root.listNodes().filter((n) => n.getMesh()).map((n) => n.getName()).join(', ')}`);
}

const only = process.argv[2] ? process.argv[2].split(',') : null;
for (const cfg of VIEWMODELS) if (!only || only.includes(cfg.id)) { try { await build(cfg); } catch (e) { console.error('ÉCHEC', cfg.id, e.message); process.exitCode = 1; } }
