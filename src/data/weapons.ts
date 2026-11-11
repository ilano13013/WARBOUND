// Données configurables des armes et accessoires de WARBOUND.

export type WeaponFamily = 'ar' | 'smg' | 'lmg' | 'sniper' | 'pistol';

export interface WeaponDef {
  id: string;
  name: string;
  family: WeaponFamily;
  slot: 'primary' | 'secondary';
  desc: string;
  damage: number;
  rpm: number;
  mag: number;
  reserve: number;
  reload: number; // secondes
  auto: boolean;
  recoilV: number; // degrés par tir
  recoilH: number;
  hipSpread: number; // degrés
  adsSpread: number;
  mobility: number; // multiplicateur de vitesse
  rangeStart: number; // début de l'atténuation
  rangeEnd: number;
  minDmg: number; // multiplicateur à longue distance
  headMult: number;
  adsTime: number;
  adsZoom: number; // facteur de FOV en visée
  unlockLevel: number;
  // paramètres du modèle 3D et du son
  look: { len: number; barrel: number; body: number; stock: number; magLen: number; tint: number; accent: number };
  sound: { pitch: number; body: number; crack: number; tail: number };
}

const W = (d: WeaponDef) => d;

export const WEAPONS: Record<string, WeaponDef> = {
  ar17: W({
    id: 'ar17', name: 'AR-17 Phantom', family: 'ar', slot: 'primary',
    desc: 'Fusil d’assaut équilibré. La référence de la Coalition.',
    damage: 25, rpm: 720, mag: 30, reserve: 210, reload: 2.0, auto: true,
    recoilV: 0.62, recoilH: 0.28, hipSpread: 2.4, adsSpread: 0.18, mobility: 1.0,
    rangeStart: 28, rangeEnd: 60, minDmg: 0.68, headMult: 1.6, adsTime: 0.22, adsZoom: 0.72, unlockLevel: 1,
    look: { len: 0.62, barrel: 0.3, body: 0.07, stock: 0.22, magLen: 0.16, tint: 0x2a2d30, accent: 0x4a5a3a },
    sound: { pitch: 1.0, body: 0.8, crack: 0.9, tail: 0.25 },
  }),
  vektor: W({
    id: 'vektor', name: 'Vektor-556', family: 'ar', slot: 'primary',
    desc: 'Cadence très élevée, recul nerveux. Dévore les chargeurs.',
    damage: 20, rpm: 900, mag: 32, reserve: 256, reload: 1.9, auto: true,
    recoilV: 0.55, recoilH: 0.42, hipSpread: 2.7, adsSpread: 0.24, mobility: 1.02,
    rangeStart: 24, rangeEnd: 52, minDmg: 0.65, headMult: 1.5, adsTime: 0.2, adsZoom: 0.74, unlockLevel: 3,
    look: { len: 0.56, barrel: 0.24, body: 0.065, stock: 0.2, magLen: 0.18, tint: 0x33363a, accent: 0x7a6a4a },
    sound: { pitch: 1.18, body: 0.6, crack: 1.0, tail: 0.2 },
  }),
  aegis762: W({
    id: 'aegis762', name: 'Aegis-762', family: 'ar', slot: 'primary',
    desc: 'Calibre lourd. Trois balles suffisent, si vous maîtrisez le recul.',
    damage: 36, rpm: 520, mag: 25, reserve: 175, reload: 2.4, auto: true,
    recoilV: 1.05, recoilH: 0.4, hipSpread: 3.0, adsSpread: 0.14, mobility: 0.96,
    rangeStart: 36, rangeEnd: 75, minDmg: 0.75, headMult: 1.7, adsTime: 0.26, adsZoom: 0.7, unlockLevel: 6,
    look: { len: 0.7, barrel: 0.36, body: 0.078, stock: 0.24, magLen: 0.15, tint: 0x3a352d, accent: 0x5b4a32 },
    sound: { pitch: 0.82, body: 1.1, crack: 0.8, tail: 0.35 },
  }),
  vesper: W({
    id: 'vesper', name: 'Vesper-9', family: 'smg', slot: 'primary',
    desc: 'SMG ultra-mobile. Faite pour courir, glisser et tirer.',
    damage: 19, rpm: 820, mag: 34, reserve: 272, reload: 1.6, auto: true,
    recoilV: 0.42, recoilH: 0.3, hipSpread: 1.9, adsSpread: 0.4, mobility: 1.1,
    rangeStart: 14, rangeEnd: 34, minDmg: 0.55, headMult: 1.4, adsTime: 0.15, adsZoom: 0.8, unlockLevel: 1,
    look: { len: 0.42, barrel: 0.14, body: 0.062, stock: 0.14, magLen: 0.2, tint: 0x2c2f33, accent: 0x3d4f5a },
    sound: { pitch: 1.35, body: 0.45, crack: 0.8, tail: 0.15 },
  }),
  spectre: W({
    id: 'spectre', name: 'Spectre-PDW', family: 'smg', slot: 'primary',
    desc: 'Cadence démentielle. Un mur de plomb à courte portée.',
    damage: 15, rpm: 1100, mag: 40, reserve: 320, reload: 1.8, auto: true,
    recoilV: 0.36, recoilH: 0.4, hipSpread: 2.2, adsSpread: 0.5, mobility: 1.08,
    rangeStart: 12, rangeEnd: 30, minDmg: 0.5, headMult: 1.4, adsTime: 0.16, adsZoom: 0.8, unlockLevel: 4,
    look: { len: 0.38, barrel: 0.1, body: 0.07, stock: 0.12, magLen: 0.24, tint: 0x25282b, accent: 0x5a3d6a },
    sound: { pitch: 1.55, body: 0.35, crack: 0.9, tail: 0.12 },
  }),
  ember45: W({
    id: 'ember45', name: 'Ember-45', family: 'smg', slot: 'primary',
    desc: 'Calibre .45, précision chirurgicale au contact.',
    damage: 26, rpm: 600, mag: 26, reserve: 208, reload: 1.7, auto: true,
    recoilV: 0.5, recoilH: 0.16, hipSpread: 1.3, adsSpread: 0.25, mobility: 1.07,
    rangeStart: 16, rangeEnd: 36, minDmg: 0.6, headMult: 1.5, adsTime: 0.17, adsZoom: 0.78, unlockLevel: 7,
    look: { len: 0.44, barrel: 0.16, body: 0.068, stock: 0.15, magLen: 0.17, tint: 0x3b3029, accent: 0x8a4a2a },
    sound: { pitch: 1.05, body: 0.75, crack: 0.6, tail: 0.18 },
  }),
  titan: W({
    id: 'titan', name: 'Titan-46', family: 'lmg', slot: 'primary',
    desc: 'Cent cartouches. Aucune excuse.',
    damage: 24, rpm: 680, mag: 100, reserve: 300, reload: 4.2, auto: true,
    recoilV: 0.5, recoilH: 0.34, hipSpread: 3.4, adsSpread: 0.3, mobility: 0.9,
    rangeStart: 32, rangeEnd: 70, minDmg: 0.7, headMult: 1.4, adsTime: 0.34, adsZoom: 0.74, unlockLevel: 1,
    look: { len: 0.78, barrel: 0.36, body: 0.09, stock: 0.22, magLen: 0.14, tint: 0x2e3230, accent: 0x4c5a3c },
    sound: { pitch: 0.9, body: 1.0, crack: 0.85, tail: 0.3 },
  }),
  bastion: W({
    id: 'bastion', name: 'Bastion-LMG', family: 'lmg', slot: 'primary',
    desc: 'Tir soutenu : plus vous tirez, plus elle se stabilise.',
    damage: 30, rpm: 560, mag: 75, reserve: 225, reload: 3.8, auto: true,
    recoilV: 0.58, recoilH: 0.22, hipSpread: 3.6, adsSpread: 0.22, mobility: 0.88,
    rangeStart: 38, rangeEnd: 80, minDmg: 0.75, headMult: 1.5, adsTime: 0.36, adsZoom: 0.72, unlockLevel: 8,
    look: { len: 0.84, barrel: 0.4, body: 0.095, stock: 0.24, magLen: 0.13, tint: 0x35312b, accent: 0x6a5a3a },
    sound: { pitch: 0.75, body: 1.2, crack: 0.75, tail: 0.38 },
  }),
  frostbite: W({
    id: 'frostbite', name: 'Frostbite .50', family: 'sniper', slot: 'primary',
    desc: 'Fusil anti-matériel à verrou. Une balle, un problème réglé.',
    damage: 150, rpm: 46, mag: 5, reserve: 40, reload: 3.0, auto: false,
    recoilV: 4.2, recoilH: 0.8, hipSpread: 6.5, adsSpread: 0.0, mobility: 0.92,
    rangeStart: 90, rangeEnd: 160, minDmg: 0.9, headMult: 2.5, adsTime: 0.4, adsZoom: 0.24, unlockLevel: 1,
    look: { len: 0.98, barrel: 0.56, body: 0.075, stock: 0.26, magLen: 0.1, tint: 0x2b3238, accent: 0x5a7a8a },
    sound: { pitch: 0.55, body: 1.6, crack: 1.1, tail: 0.6 },
  }),
  requiem: W({
    id: 'requiem', name: 'Requiem DMR', family: 'sniper', slot: 'primary',
    desc: 'Semi-automatique de précision. Rythme et sang-froid.',
    damage: 62, rpm: 260, mag: 12, reserve: 96, reload: 2.5, auto: false,
    recoilV: 1.9, recoilH: 0.4, hipSpread: 4.0, adsSpread: 0.03, mobility: 0.97,
    rangeStart: 60, rangeEnd: 120, minDmg: 0.85, headMult: 2.0, adsTime: 0.28, adsZoom: 0.42, unlockLevel: 1,
    look: { len: 0.82, barrel: 0.44, body: 0.07, stock: 0.24, magLen: 0.13, tint: 0x30332c, accent: 0x55603a },
    sound: { pitch: 0.72, body: 1.2, crack: 1.0, tail: 0.42 },
  }),
  p9: W({
    id: 'p9', name: 'Sidearm P9', family: 'pistol', slot: 'secondary',
    desc: 'Pistolet de service polyvalent. Toujours là quand il faut.',
    damage: 24, rpm: 420, mag: 15, reserve: 120, reload: 1.3, auto: false,
    recoilV: 0.9, recoilH: 0.3, hipSpread: 1.5, adsSpread: 0.2, mobility: 1.12,
    rangeStart: 16, rangeEnd: 40, minDmg: 0.6, headMult: 1.6, adsTime: 0.12, adsZoom: 0.82, unlockLevel: 1,
    look: { len: 0.2, barrel: 0.05, body: 0.045, stock: 0, magLen: 0.11, tint: 0x2a2c2f, accent: 0x44494e },
    sound: { pitch: 1.25, body: 0.5, crack: 0.9, tail: 0.14 },
  }),
  ash: W({
    id: 'ash', name: 'Revolver Ash', family: 'pistol', slot: 'secondary',
    desc: 'Six coups de .500 enchantés. Le dernier mot.',
    damage: 78, rpm: 150, mag: 6, reserve: 54, reload: 2.2, auto: false,
    recoilV: 3.4, recoilH: 0.7, hipSpread: 1.8, adsSpread: 0.08, mobility: 1.08,
    rangeStart: 28, rangeEnd: 60, minDmg: 0.7, headMult: 2.0, adsTime: 0.16, adsZoom: 0.78, unlockLevel: 5,
    look: { len: 0.27, barrel: 0.12, body: 0.05, stock: 0, magLen: 0, tint: 0x3a3632, accent: 0x9a5a2a },
    sound: { pitch: 0.7, body: 1.3, crack: 1.0, tail: 0.4 },
  }),
};

export type AttachSlot = 'optic' | 'muzzle' | 'mag' | 'grip' | 'arcane';

export interface AttachmentDef {
  id: string;
  name: string;
  slot: AttachSlot;
  desc: string;
  unlockLevel: number;
  families?: WeaponFamily[];
  // modificateurs multiplicatifs (1 = neutre) ou additifs selon la clé
  mods: Partial<{
    damage: number; rpm: number; mag: number; reload: number; recoil: number; hipSpread: number;
    adsSpread: number; mobility: number; range: number; adsTime: number; adsZoom: number; headMult: number;
    silent: number; burn: number; chain: number; energyOnHit: number;
  }>;
}

export const ATTACHMENTS: Record<string, AttachmentDef> = {
  reflex: { id: 'reflex', name: 'Viseur reflex', slot: 'optic', unlockLevel: 1, desc: 'Visée plus rapide et plus nette.', mods: { adsTime: 0.85, adsSpread: 0.8 } },
  acog: { id: 'acog', name: 'Lunette ACOG x4', slot: 'optic', unlockLevel: 4, desc: 'Zoom accru, portée étendue, visée plus lente.', mods: { adsZoom: 0.6, range: 1.2, adsTime: 1.15 } },
  longscope: { id: 'longscope', name: 'Lunette longue portée x8', slot: 'optic', unlockLevel: 8, families: ['sniper', 'ar', 'lmg'], desc: 'Zoom extrême et tirs à la tête dévastateurs.', mods: { adsZoom: 0.42, range: 1.35, adsTime: 1.25, headMult: 1.1 } },
  silencer: { id: 'silencer', name: 'Silencieux', slot: 'muzzle', unlockLevel: 2, desc: 'Tirs discrets : les ennemis éloignés n’entendent rien. Dégâts légèrement réduits.', mods: { silent: 1, damage: 0.94, recoil: 0.92 } },
  compensator: { id: 'compensator', name: 'Compensateur', slot: 'muzzle', unlockLevel: 3, desc: 'Réduit fortement le recul.', mods: { recoil: 0.74 } },
  heavybarrel: { id: 'heavybarrel', name: 'Canon lourd', slot: 'muzzle', unlockLevel: 9, desc: 'Dégâts et portée accrus, mobilité réduite.', mods: { damage: 1.08, range: 1.25, mobility: 0.96 } },
  extmag: { id: 'extmag', name: 'Chargeur étendu', slot: 'mag', unlockLevel: 2, desc: '+40 % de capacité, rechargement plus lent.', mods: { mag: 1.4, reload: 1.1 } },
  fastmag: { id: 'fastmag', name: 'Chargeur rapide', slot: 'mag', unlockLevel: 5, desc: 'Rechargement 30 % plus rapide.', mods: { reload: 0.7 } },
  vgrip: { id: 'vgrip', name: 'Poignée verticale', slot: 'grip', unlockLevel: 3, desc: 'Meilleur contrôle du recul et du tir à la hanche.', mods: { recoil: 0.85, hipSpread: 0.8 } },
  agrip: { id: 'agrip', name: 'Poignée d’assaut', slot: 'grip', unlockLevel: 6, desc: 'Visée et déplacements plus vifs.', mods: { adsTime: 0.8, mobility: 1.04 } },
  emberCore: { id: 'emberCore', name: 'Noyau de braise', slot: 'arcane', unlockLevel: 7, desc: 'Modification arcanique : les tirs ont 20 % de chances d’enflammer la cible.', mods: { burn: 0.2 } },
  stormCoil: { id: 'stormCoil', name: 'Bobine d’orage', slot: 'arcane', unlockLevel: 10, desc: 'Modification arcanique : chaque 8e impact libère un arc électrique.', mods: { chain: 8 } },
  siphon: { id: 'siphon', name: 'Siphon du Voile', slot: 'arcane', unlockLevel: 12, desc: 'Modification arcanique : chaque impact rend 1 point d’énergie.', mods: { energyOnHit: 1 } },
};

export const ATTACH_SLOTS: { slot: AttachSlot; label: string }[] = [
  { slot: 'optic', label: 'Optique' },
  { slot: 'muzzle', label: 'Bouche' },
  { slot: 'mag', label: 'Chargeur' },
  { slot: 'grip', label: 'Poignée' },
  { slot: 'arcane', label: 'Arcanique' },
];

export const FAMILY_LABEL: Record<WeaponFamily, string> = {
  ar: 'Fusil d’assaut', smg: 'SMG', lmg: 'Mitrailleuse', sniper: 'Précision', pistol: 'Arme de poing',
};
