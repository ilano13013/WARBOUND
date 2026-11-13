// Télécharge les assets Poly Haven (CC0) et ambientCG (CC0) de la version 2.2 dans $ASSET_SRC/polyhaven et $ASSET_SRC/ambientcg.
// Usage : node tools/assets/fetch-polyhaven.mjs   (réseau : api.polyhaven.com, dl.polyhaven.org, ambientcg.com et son hôte de téléchargement)
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
const SRC = process.env.ASSET_SRC || '/tmp/claude-0/assets-dl';
const UA = 'asset-fetch/1.0';
const get = (url, out) => { fs.mkdirSync(path.dirname(out), { recursive: true }); if (fs.existsSync(out) && fs.statSync(out).size > 0) return; execFileSync('curl', ['-sS', '-L', '--fail', '--retry', '3', '-m', '300', '-H', `User-Agent: ${UA}`, '-o', out, url]); };
const MODELS = ['modular_industrial_pipes_01', 'modular_airduct_rectangular_01', 'portable_generator', 'concrete_road_barrier', 'rock_face_01', 'power_box_01', 'modular_electric_cables'];
const TEXTURES = ['rabdentse_ruins_wall'];
for (const id of MODELS) {
  const dir = `${SRC}/polyhaven/${id}`;
  get(`https://api.polyhaven.com/files/${id}`, `${dir}/files.json`);
  const g = JSON.parse(fs.readFileSync(`${dir}/files.json`, 'utf8')).gltf['2k'].gltf;
  get(g.url, `${dir}/${id}.gltf`);
  for (const [rel, f] of Object.entries(g.include)) get(f.url, `${dir}/${rel}`);
  console.log(id, fs.readdirSync(dir).join(' '));
}
for (const id of TEXTURES) {
  const dir = `${SRC}/polyhaven/${id}`;
  get(`https://api.polyhaven.com/files/${id}`, `${dir}/files.json`);
  const f = JSON.parse(fs.readFileSync(`${dir}/files.json`, 'utf8'));
  for (const map of ['Diffuse', 'nor_gl', 'arm']) get(f[map]['2k'].jpg.url, `${dir}/${map}.jpg`);
  console.log(id, fs.readdirSync(dir).join(' '));
}
const acg = `${SRC}/ambientcg/Concrete042D`;
get('https://ambientcg.com/get?file=Concrete042D_2K-JPG.zip', `${acg}/Concrete042D_2K-JPG.zip`);
execFileSync('unzip', ['-o', '-q', `${acg}/Concrete042D_2K-JPG.zip`, '-d', acg]);
console.log('Concrete042D', fs.readdirSync(acg).join(' '));
