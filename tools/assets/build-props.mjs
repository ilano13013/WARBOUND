// Décors Poly Haven (CC0) de la version 2.11 : téléchargement (API officielle, sans compte) et conversion en GLB optimisés.
//   node tools/assets/build-props.mjs      -> public/assets/models/props/ph_*.glb + manifeste mis à jour
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import sharp from 'sharp';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, prune, weld, simplify, meshopt, textureCompress, join, flatten } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptDecoder, MeshoptSimplifier } from 'meshoptimizer';

const SRC = process.env.ASSET_SRC || '/tmp/phsrc';
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../public/assets');
// [id Poly Haven, nom dans le jeu, triangles visés, taille de texture]
const MODELS = [
  ['wooden_crate_02', 'ph_crate', 1800, 1024], ['Barrel_01', 'ph_barrel', 1400, 1024], ['metal_jerrycan_green', 'ph_jerrycan', 1500, 512],
  ['propane_tank', 'ph_propane', 1500, 512], ['old_military_crate', 'ph_milcrate', 2500, 1024], ['wooden_military_crate', 'ph_milcrate_long', 3000, 1024],
  ['ammo_box', 'ph_ammobox', 1500, 512], ['vintage_radio_transceiver', 'ph_radio', 4000, 1024],
];
const get = (url, out) => { fs.mkdirSync(path.dirname(out), { recursive: true }); if (fs.existsSync(out) && fs.statSync(out).size > 0) return; execFileSync('curl', ['-sS', '-L', '--fail', '--retry', '3', '-A', 'asset-fetch/1.0', '-o', out, url]); };
await MeshoptEncoder.ready; await MeshoptDecoder.ready; await MeshoptSimplifier.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });
const man = JSON.parse(fs.readFileSync(`${ROOT}/manifest.json`, 'utf8'));
for (const [id, name, tris, tex] of MODELS) {
  const dir = `${SRC}/${id}`;
  get(`https://api.polyhaven.com/files/${id}`, `${dir}/files.json`);
  const g = JSON.parse(fs.readFileSync(`${dir}/files.json`, 'utf8')).gltf['1k'].gltf;
  get(g.url, `${dir}/${id}.gltf`);
  for (const [rel, f] of Object.entries(g.include)) get(f.url, `${dir}/${rel}`);
  const doc = await io.read(`${dir}/${id}.gltf`);
  const count = () => doc.getRoot().listMeshes().reduce((a, m) => a + m.listPrimitives().reduce((b, p) => b + (p.getIndices()?.getCount() || 0) / 3, 0), 0);
  const before = count();
  await doc.transform(flatten(), join(), weld(), simplify({ simplifier: MeshoptSimplifier, ratio: Math.min(1, tris / before), error: 0.01 }), dedup(), prune(),
    textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [tex, tex], quality: 82 }), meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
  const out = `${ROOT}/models/props/${name}.glb`;
  await io.write(out, doc);
  if (!man.models.includes('props/' + name)) man.models.push('props/' + name);
  console.log(`${name} (${id}) : ${Math.round(before)} -> ${Math.round(count())} triangles, ${(fs.statSync(out).size / 1024).toFixed(0)} Ko`);
}
fs.writeFileSync(`${ROOT}/manifest.json`, JSON.stringify(man));
