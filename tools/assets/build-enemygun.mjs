// Arme portée par les personnages (ennemis, autres joueurs) : AK-74M de « FPS AK-74m animations » (Cransh, CC BY 4.0),
// sans les bras ni le chargeur de rechange, figée en pose de repos, allégée et texturée en 512 px.
//   node tools/assets/build-enemygun.mjs   -> public/assets/models/weapons/enemy_ak.glb (+ manifeste)
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, prune, weld, simplify, meshopt, textureCompress, flatten, join } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptDecoder, MeshoptSimplifier } from 'meshoptimizer';
const SRC = process.env.VM_SRC || '/tmp/cand';
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../public/assets');
await MeshoptEncoder.ready; await MeshoptDecoder.ready; await MeshoptSimplifier.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });
const doc = await io.read(`${SRC}/fps_ak_74m_animations/scene.gltf`);
const r = doc.getRoot();
for (const a of r.listAnimations()) { for (const c of a.listChannels()) c.dispose(); for (const s of a.listSamplers()) s.dispose(); a.dispose(); }
// gardé : le maillage de l'arme (le chargeur de rechange est un second maillage du même matériau, retiré)
let kept = false;
for (const n of r.listNodes()) {
  const m = n.getMesh(); if (!m) continue;
  const mat = m.listPrimitives()[0].getMaterial()?.getName();
  if (mat !== 'ak74m' || kept) { n.setMesh(null); continue; }
  kept = true;
}
// figée en pose de liaison : sans squelette, positions du maillage telles quelles
for (const n of r.listNodes()) n.setSkin(null);
for (const m of r.listMeshes()) for (const p of m.listPrimitives()) for (const s of p.listSemantics()) if (/^(JOINTS|WEIGHTS)_/.test(s)) p.setAttribute(s, null);
for (const s of r.listSkins()) s.dispose();
for (const n of r.listNodes()) if (n.getMesh()) { n.setMatrix([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]); let p = n.getParentNode(); while (p) { p.setMatrix([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]); p = p.getParentNode(); } }
for (const m of r.listMaterials()) for (const e of ['KHR_materials_specular', 'KHR_materials_ior']) m.setExtension(e, null);
await doc.transform(prune(), flatten(), join(), weld(), simplify({ simplifier: MeshoptSimplifier, ratio: 0.2, error: 0.004 }), dedup(), prune(),
  textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [512, 512], quality: 80 }), meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
const out = `${ROOT}/models/weapons/enemy_ak.glb`;
await io.write(out, doc);
const man = JSON.parse(fs.readFileSync(`${ROOT}/manifest.json`, 'utf8'));
if (!man.models.includes('weapons/enemy_ak')) { man.models.push('weapons/enemy_ak'); fs.writeFileSync(`${ROOT}/manifest.json`, JSON.stringify(man)); }
const tris = r.listMeshes().reduce((a, m) => a + m.listPrimitives().reduce((b, p) => b + (p.getIndices()?.getCount() || 0) / 3, 0), 0);
const acc = r.listMeshes()[0].listPrimitives()[0].getAttribute('POSITION');
console.log('enemy_ak', Math.round(tris), 'triangles', (fs.statSync(out).size / 1024).toFixed(0), 'Ko', 'min', acc.getMin([]).map((x) => +x.toFixed(3)), 'max', acc.getMax([]).map((x) => +x.toFixed(3)));
