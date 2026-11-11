// Pipeline de préparation des assets de WARBOUND 2.0.
// Sources (toutes CC0) récupérées par `node tools/assets/fetch-sources.mjs` dans $ASSET_SRC.
// Sorties optimisées dans public/assets/ (copiées telles quelles dans dist/ par Vite).
//   - modèles : glTF binaire, élagage, déduplication, compression EXT_meshopt_compression
//   - textures PBR : 1024 px, couleur + normale (OpenGL) + ORM (AO / rugosité)
//   - sons : extraits mono Ogg Vorbis 44,1 kHz, coupés au début du tir
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, prune, resample, reorder, quantize, meshopt } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptDecoder } from 'meshoptimizer';

const SRC = process.env.ASSET_SRC || '/tmp/claude-0/assets-dl';
const OUT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../public/assets');
const Q = `${SRC}/quaternius-showcase/public/glb`;
const FG = `${SRC}/fps-asset-kit/weapons`;
const only = process.argv[2] || 'all';
const filter = process.argv[3] ? new RegExp(process.argv[3]) : null;

// ---------------------------------------------------------------- modèles
const MODELS = [
  // armes (Flat Guns West/East, CC0)
  ['weapons/ar17', `${FG}/flat_guns_west/Flat Guns West/GLB/Rifle_Assault_West.glb`],
  ['weapons/vektor', `${FG}/flat_guns_east/Flat Guns East/GLB/Rifle_Assault_East.glb`],
  ['weapons/aegis762', `${FG}/flat_guns_west/Flat Guns West/GLB/Rifle_Battle_West.glb`],
  ['weapons/vesper', `${FG}/flat_guns_west/Flat Guns West/GLB/SMG_Full_West.glb`],
  ['weapons/spectre', `${FG}/flat_guns_west/Flat Guns West/GLB/SMG_Compact_West.glb`],
  ['weapons/ember45', `${FG}/flat_guns_east/Flat Guns East/GLB/SMG_Full_East.glb`],
  ['weapons/titan', `${FG}/flat_guns_west/Flat Guns West/GLB/Shotgun_Auto_West.glb`],
  ['weapons/bastion', `${FG}/flat_guns_east/Flat Guns East/GLB/Rifle_Battle_East.glb`],
  ['weapons/frostbite', `${FG}/flat_guns_west/Flat Guns West/GLB/Sniper_Material_West.glb`],
  ['weapons/requiem', `${FG}/flat_guns_east/Flat Guns East/GLB/Sniper_Rifle_East.glb`],
  ['weapons/p9', `${FG}/flat_guns_west/Flat Guns West/GLB/Pistol_Full_West.glb`],
  ['weapons/ash', `${Q}/survival_pack/Revolver_1.glb`],
  ['weapons/enemy_rifle', `${FG}/flat_guns_east/Flat Guns East/GLB/Rifle_Assault_East.glb`],
  // personnages (Quaternius, CC0)
  ['chars/swat', `${Q}/modular_men/Swat.glb`],
  ['chars/soldier', `${Q}/modular_women/Soldier.glb`],
  ['chars/witch', `${Q}/modular_women/Witch.glb`],
  ['chars/king', `${Q}/modular_men/King.glb`],
  ['chars/spacesuit', `${Q}/modular_men/Spacesuit.glb`],
  ['chars/spider', `${Q}/easy_enemies_pack/Spider.glb`],
  ['chars/knight', `${Q}/single_knight_pack/KnightCharacter.glb`],
  ['chars/wolf', `${Q}/animals_pack/Wolf.glb`],
  ['chars/drone', `${Q}/cyberpunk_pack/Enemy_Flying_Gun.glb`],
  ['chars/mech', `${Q}/mech_pack/George.glb`, { tex: 1024 }],
  ['chars/knight_sword', `${Q}/single_knight_pack/Sword.glb`],
  ['chars/knight_helmet', `${Q}/single_knight_pack/Helmet2.glb`],
  ['chars/knight_pads', `${Q}/single_knight_pack/ShoulderPads.glb`],
  // bibliothèque d'animations (Universal Animation Library, Quaternius, CC0)
  ['anims/ual', `${SRC}/gltf-universal-animation-library/glTF/AnimationLibrary_Godot_Standard.gltf`, { animOnly: [
    'A_TPose', 'Idle_Loop', 'Walk_Loop', 'Jog_Fwd_Loop', 'Sprint_Loop', 'Crouch_Idle_Loop', 'Crouch_Fwd_Loop', 'Death01', 'Hit_Chest', 'Hit_Head',
    'Pistol_Idle_Loop', 'Pistol_Aim_Neutral', 'Pistol_Aim_Up', 'Pistol_Aim_Down', 'Pistol_Shoot', 'Pistol_Reload',
    'Spell_Simple_Enter', 'Spell_Simple_Idle_Loop', 'Spell_Simple_Shoot', 'Spell_Simple_Exit', 'Sword_Attack', 'Sword_Idle', 'Punch_Cross', 'Roll', 'Jump_Loop'] }],
];
// décors (Quaternius, CC0)
const PROPS = {
  modular_sci_fi: ['Props_Base', 'Props_Capsule', 'Props_Chest', 'Props_Computer', 'Props_ComputerSmall', 'Props_ContainerFull', 'Props_Crate', 'Props_CrateLong', 'Props_Laser', 'Props_Pod', 'Props_Shelf', 'Props_Shelf_Tall', 'Props_Teleporter_1', 'Props_Vessel', 'Props_Vessel_Tall', 'Column_1', 'Column_2', 'Column_3', 'Column_Slim', 'Details_Vent_1', 'Details_Vent_2', 'Details_Pipes_Long', 'Details_Pipes_Medium', 'Details_Plate_Large', 'Pipes'],
  cyberpunk_pack: ['Light_Street_1', 'Light_Street_2', 'Computer_Large', 'Computer', 'TV_1', 'AC', 'AC_Stacked', 'Pipe_1', 'Pipe_Corner', 'Sign_Corner_Hazard', 'Lootbox', 'Fence', 'Cable_Long', 'Antenna_1', 'Turret_Gun'],
  survival_pack: ['GasCan', 'PropaneTank', 'FirstAidKit', 'Radio', 'Trashcan', 'Tent', 'Battery_Big'],
  modular_dungeon_pack: ['Column', 'Column_Broken', 'Column_Broken2', 'Rock1', 'Rock2', 'Rock3', 'Rock4', 'Rock5', 'Torch', 'Torch_wall', 'Candelabrum_tall', 'Bones', 'Bones2', 'Entrance', 'WallRocks', 'Stairs'],
  modular_dungeon_1: ['Arch', 'Banner', 'Banner_wall', 'Pedestal', 'Pedestal2', 'Skull', 'Spikes'],
  street_pack: ['Streetlight_Single', 'Streetlight_Double', 'TrafficLight', 'Sign_Stop', 'Sign_Triangle', 'Sign_NoParking'],
  buildings_pack_3: ['4Story_Mat', '6Story_Stack_Mat', '3Story_Balcony_Mat', '2Story_Wide_Mat', '4Story_Center_Mat', '3Story_Slim_Mat'],
  tank_pack: ['Tank', 'Tank2'],
};
for (const [pack, names] of Object.entries(PROPS)) for (const n of names) MODELS.push([`props/${n}`, `${Q}/${pack}/${n}.glb`]);
const NATURE = fs.existsSync(`${Q}/nature_pack`) ? fs.readdirSync(`${Q}/nature_pack`).filter((f) => /Dead_[1-3]|^Rock|Pebble|Grass_Short|Bush_1/.test(f)) : [];
for (const f of NATURE) MODELS.push([`props/${f.replace('.glb', '')}`, `${Q}/nature_pack/${f}`]);

async function buildModels() {
  await MeshoptEncoder.ready; await MeshoptDecoder.ready;
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });
  let total = 0;
  for (const [name, src, opt = {}] of MODELS) {
    if (filter && !filter.test(name)) continue;
    if (!fs.existsSync(src)) { console.warn('MANQUANT', src); continue; }
    const doc = await io.read(src);
    const root = doc.getRoot();
    if (opt.animOnly) {
      // squelette + animations seulement : le maillage du mannequin est retiré
      for (const n of root.listNodes()) { n.setMesh(null); n.setSkin(null); }
      for (const a of root.listAnimations()) if (!opt.animOnly.includes(a.getName())) a.dispose();
    }
    if (opt.tex) {
      for (const t of root.listTextures()) {
        const tmp = `/tmp/claude-0/tex-${Date.now()}.${t.getMimeType() === 'image/png' ? 'png' : 'jpg'}`;
        fs.writeFileSync(tmp, Buffer.from(t.getImage()));
        const out = tmp.replace(/\.(png|jpg)$/, '-r.jpg');
        execFileSync('convert', [tmp, '-resize', `${opt.tex}x${opt.tex}>`, '-quality', '86', out]);
        t.setImage(new Uint8Array(fs.readFileSync(out))).setMimeType('image/jpeg');
      }
    }
    await doc.transform(dedup(), prune({ keepLeaves: true, keepAttributes: false }), resample({ tolerance: 1e-4 }), reorder({ encoder: MeshoptEncoder }), quantize({ quantizeNormal: 10, quantizePosition: 14 }), meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
    const out = `${OUT}/models/${name}.glb`;
    fs.mkdirSync(path.dirname(out), { recursive: true });
    await io.write(out, doc);
    const sz = fs.statSync(out).size; total += sz;
    console.log(`${name.padEnd(28)} ${(fs.statSync(src).size / 1024).toFixed(0).padStart(6)} Ko -> ${(sz / 1024).toFixed(0).padStart(5)} Ko`);
  }
  console.log(`MODÈLES : ${(total / 1048576).toFixed(2)} Mo`);
}

// ---------------------------------------------------------------- textures PBR (ambientCG, CC0)
const TEX = { concrete: 'Concrete034', concrete2: 'Concrete047A', metal: 'Metal049A', metal2: 'Metal055A', plate: 'Metal063', asphalt: 'Asphalt031', bricks: 'Bricks097', rock: 'Rock058', rock2: 'Rock063', ground: 'Ground037', dirt: 'Ground054', plaster: 'Plaster002', wood: 'Wood092', tiles: 'Concrete048', mud: 'Ground103', rubble: 'Rock064' };
function buildTextures() {
  const dir = `${OUT}/textures`; fs.mkdirSync(dir, { recursive: true });
  let total = 0;
  for (const [name, id] of Object.entries(TEX)) {
    const b = `${SRC}/fps-asset-kit/textures/${id}/${id}_2K-JPG_`;
    if (!fs.existsSync(b + 'Color.jpg')) { console.warn('MANQUANT', id); continue; }
    const size = '1024x1024';
    execFileSync('convert', [b + 'Color.jpg', '-resize', size, '-quality', '84', `${dir}/${name}_color.jpg`]);
    execFileSync('convert', [b + 'NormalGL.jpg', '-resize', size, '-quality', '88', `${dir}/${name}_normal.jpg`]);
    // ORM : R = occlusion ambiante, G = rugosité, B = 0
    const ao = fs.existsSync(b + 'AmbientOcclusion.jpg') ? [b + 'AmbientOcclusion.jpg', '-resize', size + '!', '-colorspace', 'gray'] : ['-size', size, 'xc:white'];
    execFileSync('convert', ['(', ...ao, ')', '(', b + 'Roughness.jpg', '-resize', size + '!', '-colorspace', 'gray', ')', '(', '-size', size, 'xc:black', ')', '-combine', '-quality', '86', `${dir}/${name}_orm.jpg`]);
    for (const s of ['color', 'normal', 'orm']) total += fs.statSync(`${dir}/${name}_${s}.jpg`).size;
    console.log('texture', name, id);
  }
  console.log(`TEXTURES : ${(total / 1048576).toFixed(2)} Mo`);
}

// ---------------------------------------------------------------- sons (Free Firearm Sound Library, CC0)
const LIB = `${SRC}/fps-asset-kit/sfx/firearm_sfx/Prepared SFX Library`;
const SOUNDS = {
  ar15: ['AR-15/D_32P.wav', 1.1], ak: ['AK-47/C_28P.wav', 1.1], sks: ['SKS/U_14P.wav', 1.3], smg9: ['Carl Gustav M45/G_31P.wav', 0.9],
  ppsh: ['PPSh/P_30P.wav', 0.9], m1911: ['1911/A_42P.wav', 1.0], ppq: ['Walther PPQ/X_39P.wav', 0.9], revolver: ['Smith & Wesson 642/V_27P.wav', 1.4],
  tikka: ['Tikka/W_29P.wav', 2.2], savage: ['Savage 10 .300 Blackout/T_27P.wav', 1.8], shotgun: ['Mossberg/N_30P.wav', 1.6],
  ar15_far: ['AR-15/D_24P.wav', 1.4], ak_far: ['AK-47/C_31P.wav', 1.4], smg_far: ['Carl Gustav M45/G_20P.wav', 1.2], sniper_far: ['Tikka/W_24P.wav', 2.4], shotgun_far: ['Mossberg/N_26P.wav', 1.6],
};
function buildSounds() {
  const dir = `${OUT}/sounds`; fs.mkdirSync(dir, { recursive: true });
  let total = 0;
  for (const [name, [rel, dur]] of Object.entries(SOUNDS)) {
    const src = `${LIB}/${rel}`;
    if (!fs.existsSync(src)) { console.warn('MANQUANT', rel); continue; }
    // détection de l'attaque : premier passage au-dessus de -30 dB, puis 5 ms de marge
    const det = execFileSync('ffmpeg', ['-hide_banner', '-i', src, '-af', 'silencedetect=noise=-30dB:d=0.05', '-f', 'null', '-'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).toString();
    void det;
    let log = '';
    try { execFileSync('ffmpeg', ['-hide_banner', '-i', src, '-af', 'silencedetect=noise=-30dB:d=0.05', '-f', 'null', '-'], { stdio: ['ignore', 'ignore', 'pipe'] }); } catch (e) { log = String(e.stderr || ''); }
    const out = `${dir}/${name}.ogg`;
    const r = execFileSync('bash', ['-c', `ffmpeg -hide_banner -i "${src}" -af silencedetect=noise=-30dB:d=0.05 -f null - 2>&1 | grep -m1 silence_end | sed 's/.*silence_end: \\([0-9.]*\\).*/\\1/'`]).toString().trim();
    const start = Math.max(0, (parseFloat(r) || 0) - 0.005);
    execFileSync('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', '-ss', String(start), '-t', String(dur), '-i', src, '-ac', '1', '-ar', '44100',
      '-af', `afade=t=out:st=${(dur * 0.55).toFixed(2)}:d=${(dur * 0.45).toFixed(2)},alimiter=limit=0.95`, '-c:a', 'libvorbis', '-q:a', '5', out]);
    total += fs.statSync(out).size;
    console.log(`son ${name.padEnd(12)} début ${start.toFixed(3)} s  ${(fs.statSync(out).size / 1024).toFixed(0)} Ko`);
  }
  // pas (Fantozzi's Footsteps, CC0)
  const fs2 = `${SRC}/fps-asset-kit/sfx/footsteps_flac`;
  for (const f of fs.existsSync(fs2) ? fs.readdirSync(fs2) : []) {
    const out = `${dir}/step_${f.replace('Fantozzi-', '').replace('.flac', '').toLowerCase()}.ogg`;
    execFileSync('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', '-i', `${fs2}/${f}`, '-ac', '1', '-ar', '44100', '-t', '0.45', '-af', 'afade=t=out:st=0.3:d=0.15', '-c:a', 'libvorbis', '-q:a', '4', out]);
    total += fs.statSync(out).size;
  }
  console.log(`SONS : ${(total / 1048576).toFixed(2)} Mo`);
}

if (only === 'all' || only === 'models') await buildModels();
if (only === 'all' || only === 'textures') buildTextures();
if (only === 'all' || only === 'sounds') buildSounds();

// ---------------------------------------------------------------- manifeste (liste chargée au démarrage du jeu)
{
  const list = (d, ext) => {
    const out = [];
    const walk = (p) => { for (const f of fs.existsSync(p) ? fs.readdirSync(p) : []) { const q = path.join(p, f); if (fs.statSync(q).isDirectory()) walk(q); else if (f.endsWith(ext)) out.push(path.relative(`${OUT}/${d}`, q).replace(ext, '')); } };
    walk(`${OUT}/${d}`); return out.sort();
  };
  const man = { models: list('models', '.glb'), textures: list('textures', '.jpg'), sounds: list('sounds', '.ogg') };
  fs.writeFileSync(`${OUT}/manifest.json`, JSON.stringify(man));
  console.log(`MANIFESTE : ${man.models.length} modèles, ${man.textures.length} textures, ${man.sounds.length} sons`);
}
