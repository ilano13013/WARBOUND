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
import { dedup, prune, resample, meshopt, join, textureCompress, metalRough, mergeDocuments, unpartition, simplify, weld } from '@gltf-transform/functions';
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

/** Retire une animation avec ses pistes et ses échantillonneurs (sinon leurs données restent dans le fichier). */
function dropAnim(a) { for (const c of a.listChannels()) c.dispose(); for (const sm of a.listSamplers()) sm.dispose(); a.dispose(); }

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
    if (k) a.setName(k); else dropAnim(a);
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
    for (const a of gdoc.getRoot().listAnimations()) dropAnim(a);
    if (cfg.gun.remove) for (const n of gdoc.getRoot().listNodes()) { const m = n.getMesh(); if (m && (cfg.gun.remove.test(n.getName()) || m.listPrimitives().some((p) => cfg.gun.remove.test(p.getMaterial()?.getName() || '')))) n.setMesh(null); }
    if (cfg.gun.simplify) await gdoc.transform(weld(), simplify({ simplifier: MeshoptSimplifier, ratio: cfg.gun.simplify, error: 0.002 }));
    if (cfg.gun.unskin) {
      // arme livrée skinnée dans un autre ensemble : gardée en pose de liaison, sans squelette
      for (const n of gdoc.getRoot().listNodes()) n.setSkin(null);
      for (const m of gdoc.getRoot().listMeshes()) for (const p of m.listPrimitives()) for (const sem of p.listSemantics()) if (/^(JOINTS|WEIGHTS)_/.test(sem)) p.setAttribute(sem, null);
      for (const sk of gdoc.getRoot().listSkins()) sk.dispose();
    }
    if (cfg.gun.material) for (const m of gdoc.getRoot().listMaterials()) m.setBaseColorFactor([...cfg.gun.material.color, 1]).setMetallicFactor(cfg.gun.material.metal).setRoughnessFactor(cfg.gun.material.rough);
    const map = mergeDocuments(doc, gdoc);
    await doc.transform(unpartition());
    const gscene = root.listScenes()[1];
    const bone = nodeByName(doc, cfg.gun.bone || /^Rif_\d+$/);
    if (!bone) throw new Error(cfg.id + ' : os d’arme introuvable');
    const holder = doc.createNode('gun_mount');
    bone.addChild(holder);
    // matrices mondiales de la scène d'origine conservées : chaque maillage est rattaché directement au support
    for (const n of root.listNodes()) {
      if (!n.getMesh() || n.getName().startsWith('mesh_')) continue;
      let top = n; while (top.getParentNode()) top = top.getParentNode();
      if (!gscene.listChildren().includes(top)) continue;
      const mag = cfg.gun.mag && cfg.gun.mag.node.test(n.getName());
      const leaf = doc.createNode(mag ? 'mag_part' : 'gun_part').setMatrix(n.getWorldMatrix()).setMesh(n.getMesh());
      n.setMesh(null);
      (mag ? (root.listNodes().find((x) => x.getName() === 'mag_mount') || nodeByName(doc, cfg.gun.magBone || /^Pmag_\d+$/).addChild(doc.createNode('mag_mount')).listChildren().find((x) => x.getName() === 'mag_mount')) : holder).addChild(leaf);
    }
    gscene.dispose();
    void map;
  }
  if (cfg.recolor) for (const m of root.listMaterials()) { const fn = cfg.recolor[m.getName()]; const t = m.getBaseColorTexture(); if (fn && t) await recolor(t, fn); }
  if (cfg.tint) for (const m of root.listMaterials()) { const c = cfg.tint[m.getName()]; if (c) m.setBaseColorFactor([...c, 1]); }

  // pistes d'animation : seuls les os qui déforment un maillage (et leurs ancêtres), les supports d'arme et la caméra sont gardés
  {
    const keep = new Set();
    for (const n of root.listNodes()) {
      const sk = n.getSkin(), m = n.getMesh();
      if (!sk || !m) continue;
      const joints = sk.listJoints();
      for (const p of m.listPrimitives()) for (let set = 0; set < 2; set++) {
        const J = p.getAttribute('JOINTS_' + set), W = p.getAttribute('WEIGHTS_' + set);
        if (!J || !W) continue;
        const j = [0, 0, 0, 0], w = [0, 0, 0, 0];
        for (let i = 0; i < J.getCount(); i++) { J.getElement(i, j); W.getElement(i, w); for (let k = 0; k < 4; k++) if (w[k] > 0) keep.add(joints[j[k]]); }
      }
    }
    for (const n of root.listNodes()) if (/mount|Head_Cam|^Camera$/.test(n.getName()) || n.getMesh()) keep.add(n);
    for (const n of [...keep]) { let p = n.getParentNode(); while (p) { keep.add(p); p = p.getParentNode(); } }
    let dropped = 0;
    for (const a of root.listAnimations()) for (const ch of a.listChannels()) if (!keep.has(ch.getTargetNode())) { const sm = ch.getSampler(); ch.dispose(); if (sm && !sm.listParents().some((x) => x.propertyType === 'AnimationChannel')) sm.dispose(); dropped++; }
    if (dropped) console.log(`  ${cfg.id} : ${dropped} pistes d'os de contrôle retirées`);
  }
  await doc.transform(
    ...(cfg.gun?.join ? [join({ keepNamed: false })] : []),
    resample(), dedup(), prune({ keepLeaves: true }),
    textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [cfg.texSize || 1024, cfg.texSize || 1024], quality: 84 }),
    meshopt({ encoder: MeshoptEncoder, level: 'medium' }),
  );
  // accesseurs devenus orphelins (animations et squelettes retirés)
  for (const acc of root.listAccessors()) if (acc.listParents().every((p) => p.propertyType === 'Root')) acc.dispose();
  const file = path.join(OUT, cfg.id + '.glb');
  await io.write(file, doc);
  const tris = root.listMeshes().reduce((a, m) => a + m.listPrimitives().reduce((b, p) => b + (p.getIndices()?.getCount() || 0) / 3, 0), 0);
  console.log(`${cfg.id}: ${(fs.statSync(file).size / 1e6).toFixed(2)} Mo, ${Math.round(tris)} triangles, animations ${got.join(', ')}, maillages ${root.listNodes().filter((n) => n.getMesh()).map((n) => n.getName()).join(', ')}`);
}

const only = process.argv[2] ? process.argv[2].split(',') : null;
for (const cfg of VIEWMODELS) if (!only || only.includes(cfg.id)) { try { await build(cfg); } catch (e) { console.error('ÉCHEC', cfg.id, e.message); process.exitCode = 1; } }
