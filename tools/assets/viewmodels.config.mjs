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
];
