// Harmonisation des bras entre auteurs : peau nue et manches noires retroussées repeintes en toile kaki (comme les ensembles Cransh).
const khaki = (l) => [Math.min(255, l * 168), Math.min(255, l * 150), Math.min(255, l * 104)];
const lum = (r, g, b) => (0.3 * r + 0.59 * g + 0.11 * b) / 255;
/** Peau -> toile kaki ; tissu sombre -> kaki éclairci ; gants (ocre) inchangés. */
const sleeves = (r, g, b) => {
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = lum(r, g, b);
  if (r > 110 && r > g + 12 && g > b + 8 && r - b > 45 && !(r - b > 95 && g < 150 && r < 215)) return khaki(0.32 + l * 0.42);   // peau claire
  if (mx < 78 && mx - mn < 26) return khaki(0.3 + l * 2.2);                                                                 // tissu noir
  return [r, g, b];
};
const allKhaki = (r, g, b) => khaki(0.3 + lum(r, g, b) * 1.6);
const skinKhaki = (r, g, b) => khaki(0.25 + lum(r, g, b) * 0.55);
// Table de conversion des armes en vue subjective. `src` : dossier de l'ensemble source dans $VM_SRC.
// `clips` : nom canonique -> nom de la piste réellement présente dans la source (vérifiée à la conversion).
export const VIEWMODELS = [
  { id: 'ar17', src: 'animated_fps_hands_rifle_animation_pack',
    clips: { idle: 'Armature|Arms_FPS_Anim_Idle', fire: 'Armature|Arms_FPS_Anim_OneShot', reload: 'Armature|Arms_FPS_Anim_Reload_Fast', draw: 'Armature|Arms_FPS_Anim_Draw' } },
  { id: 'vektor', src: 'fps_ak_74m_animations',
    clips: { idle: 'Rig|AK_Idle', fire: 'Rig|AK_Shot', reload: 'Rig|AK_Reload', reloadEmpty: 'Rig|AK_Reload_full', draw: 'Rig|AK_Draw' } },
  { id: 'aegis762', src: 'fps_arms_saiga_animations_remake',
    clips: { idle: 'Rig|Saiga_Idle', fire: 'Rig|Saiga_Fire', reload: 'Rig|Saiga_Reload_Fast', reloadEmpty: 'Rig|Saiga_Reload_Full' } },
  { id: 'vesper', src: 'smg_fps_animations',
    clips: { idle: 'IDLE', fire: 'Rig|KDW_Shot', reload: 'Rig|KDW_Reload_fast', reloadEmpty: 'Rig|KDW_Reload_full', draw: 'Rig|KDW_Draw' } },
  { id: 'p9', src: 'fps_pistol_animations', missing: { 'textures/Material_specularGlossiness.png': [120, 120, 124, 150] },
    clips: { idle: 'Armature|FPS_Pistol_Idle', fire: 'Armature|FPS_Pistol_Fire', reload: 'Armature|FPS_Pistol_Reload_easy', reloadEmpty: 'Armature|FPS_Pistol_Reload_full' } },
  // armes d'autres auteurs montées sur un squelette Cransh (mêmes bras, mêmes animations)
  { id: 'titan', src: 'animated_fps_hands_rifle_animation_pack', remove: /^(Rifle|Silencer|Scope|Pmag)$/,
    clips: { idle: 'Armature|Arms_FPS_Anim_Idle', fire: 'Armature|Arms_FPS_Anim_OneShot', reload: 'Armature|Arms_FPS_Anim_Reload_Fast', draw: 'Armature|Arms_FPS_Anim_Draw' },
    gun: { src: 'm249_machine_gun' } },
  { id: 'bastion', src: 'fps_ak_74m_animations', remove: /^ak74m$/,
    clips: { idle: 'Rig|AK_Idle', fire: 'Rig|AK_Shot', reload: 'Rig|AK_Reload', reloadEmpty: 'Rig|AK_Reload_full', draw: 'Rig|AK_Draw' },
    gun: { src: 'fps_guns_4k_rifle_1', remove: /^(Bullet|Shell|Scope)/, join: true, mag: { node: /^(Mag|Magazine)/ }, magBone: /^Pmag_\d+$/ } },
  { id: 'requiem', src: 'fps_ak_74m_animations', remove: /^ak74m$/,
    clips: { idle: 'Rig|AK_Idle', fire: 'Rig|AK_Shot', reload: 'Rig|AK_Reload', reloadEmpty: 'Rig|AK_Reload_full', draw: 'Rig|AK_Draw' },
    gun: { src: 'dragunov_svd' } },
  { id: 'spectre', src: 'smg_fps_animations', remove: /^Material_45/,
    clips: { idle: 'IDLE', fire: 'Rig|KDW_Shot', reload: 'Rig|KDW_Reload_fast', reloadEmpty: 'Rig|KDW_Reload_full', draw: 'Rig|KDW_Draw' },
    gun: { src: 'fps_animations_lowpoly_mp5', remove: /^lambert1$/, unskin: true, material: { color: [0.05, 0.05, 0.055], metal: 0.6, rough: 0.45 } } },
  // ensembles complets d'autres auteurs
  { id: 'ember45', src: 'cz_scorpion_evo3_a1_first_person_animations', recolor: { Body: skinKhaki, Cloths: allKhaki }, remove: /^(Skybox|material|Watch_Emission)$/,
    clips: { idle: 'rig|Idle', fire: 'rig|Fire', reload: 'rig|Reload', reloadEmpty: 'rig|Reload_Empty', draw: 'rig|Equip' } },
  { id: 'frostbite', src: 'sniper_animated', recolor: { arms: sleeves }, clips: { all: 'allanims' } },
  { id: 'ash', src: 'revolver_animated', recolor: { arms: sleeves }, clips: { all: 'allanims' } },
];
