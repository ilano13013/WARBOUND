// Archétypes ennemis : statistiques et comportements configurables.

export type EnemyKind = 'grunt' | 'sniper' | 'breaker' | 'devourer' | 'caster' | 'drone' | 'commander' | 'sentinel' | 'guardian' | 'archon' | 'sovereign';

export interface EnemyDef {
  id: EnemyKind;
  name: string;
  faction: string;
  hp: number;
  speed: number;
  radius: number;
  height: number;
  xp: number;
  elite: boolean;
  sight: number; // portée de vision
  fov: number; // demi-angle en degrés
  // attaque
  attack: 'rifle' | 'sniper' | 'shotgun' | 'melee' | 'orb' | 'laser';
  damage: number;
  burst: number; // tirs par rafale
  burstGap: number; // délai entre tirs
  cooldown: number; // délai entre rafales
  range: number; // distance idéale
  maxRange: number;
  accuracy: number; // probabilité de base de toucher à distance idéale
  useCover: boolean;
  flying?: boolean;
  shield?: boolean;
  aura?: boolean;
  scale?: number;
}

export const ENEMIES: Record<EnemyKind, EnemyDef> = {
  grunt: {
    id: 'grunt', name: 'Fantassin corrompu', faction: 'Corrompus', hp: 100, speed: 3.6, radius: 0.4, height: 1.8, xp: 20, elite: false,
    sight: 45, fov: 65, attack: 'rifle', damage: 7, burst: 4, burstGap: 0.11, cooldown: 1.5, range: 16, maxRange: 48, accuracy: 0.48, useCover: true,
  },
  sniper: {
    id: 'sniper', name: 'Tireur d’élite corrompu', faction: 'Corrompus', hp: 80, speed: 2.8, radius: 0.4, height: 1.8, xp: 35, elite: false,
    sight: 90, fov: 50, attack: 'sniper', damage: 42, burst: 1, burstGap: 0, cooldown: 3.4, range: 45, maxRange: 110, accuracy: 0.9, useCover: false,
  },
  breaker: {
    id: 'breaker', name: 'Briseur de ligne', faction: 'Corrompus', hp: 260, speed: 2.5, radius: 0.55, height: 1.95, xp: 60, elite: true,
    sight: 40, fov: 70, attack: 'shotgun', damage: 6, burst: 1, burstGap: 0, cooldown: 1.6, range: 7, maxRange: 16, accuracy: 0.7, useCover: false, shield: true, scale: 1.12,
  },
  devourer: {
    id: 'devourer', name: 'Dévoreur de faille', faction: 'Essaim', hp: 70, speed: 6.6, radius: 0.5, height: 1.2, xp: 18, elite: false,
    sight: 40, fov: 180, attack: 'melee', damage: 13, burst: 1, burstGap: 0, cooldown: 1.0, range: 1.9, maxRange: 2.4, accuracy: 1, useCover: false,
  },
  caster: {
    id: 'caster', name: 'Arcaniste du Voile', faction: 'Ordre du Voile', hp: 120, speed: 3.0, radius: 0.4, height: 1.85, xp: 45, elite: false,
    sight: 50, fov: 70, attack: 'orb', damage: 22, burst: 3, burstGap: 0.35, cooldown: 2.8, range: 20, maxRange: 45, accuracy: 1, useCover: true,
  },
  drone: {
    id: 'drone', name: 'Drone HELIX', faction: 'HELIX', hp: 60, speed: 5.0, radius: 0.5, height: 0.6, xp: 22, elite: false,
    sight: 50, fov: 180, attack: 'laser', damage: 6, burst: 5, burstGap: 0.09, cooldown: 2.2, range: 14, maxRange: 40, accuracy: 0.5, useCover: false, flying: true,
  },
  commander: {
    id: 'commander', name: 'Commandant d’escouade', faction: 'HELIX', hp: 340, speed: 3.2, radius: 0.45, height: 1.9, xp: 90, elite: true,
    sight: 55, fov: 70, attack: 'rifle', damage: 10, burst: 6, burstGap: 0.1, cooldown: 1.6, range: 18, maxRange: 50, accuracy: 0.55, useCover: true, aura: true, scale: 1.08,
  },
  sentinel: {
    id: 'sentinel', name: 'Gardien du temple', faction: 'Ordre du Voile', hp: 300, speed: 3.4, radius: 0.55, height: 2.1, xp: 80, elite: true,
    sight: 45, fov: 90, attack: 'melee', damage: 24, burst: 1, burstGap: 0, cooldown: 1.5, range: 2.4, maxRange: 3.0, accuracy: 1, useCover: false, scale: 1.25,
  },
  // ---- boss ----
  guardian: {
    id: 'guardian', name: 'Le Gardien d’Helix', faction: 'HELIX', hp: 3400, speed: 2.3, radius: 1.3, height: 3.7, xp: 900, elite: true,
    sight: 200, fov: 180, attack: 'rifle', damage: 28, burst: 1, burstGap: 0, cooldown: 3, range: 20, maxRange: 80, accuracy: 1, useCover: false,
  },
  archon: {
    id: 'archon', name: 'L’Archonte du Voile', faction: 'Ordre du Voile', hp: 4000, speed: 0, radius: 0.9, height: 3.2, xp: 1200, elite: true,
    sight: 200, fov: 180, attack: 'orb', damage: 24, burst: 1, burstGap: 0, cooldown: 3, range: 25, maxRange: 80, accuracy: 1, useCover: false,
  },
  sovereign: {
    id: 'sovereign', name: 'Le Souverain Fracturé', faction: 'HELIX / Fracture', hp: 6200, speed: 3.6, radius: 0.8, height: 2.9, xp: 2000, elite: true,
    sight: 200, fov: 180, attack: 'rifle', damage: 9, burst: 6, burstGap: 0.1, cooldown: 2.2, range: 18, maxRange: 80, accuracy: 0.55, useCover: false,
  },
};

export type Difficulty = 'recrue' | 'soldat' | 'veteran';

export interface DifficultyDef {
  id: Difficulty;
  name: string;
  desc: string;
  accuracy: number; // multiplicateur de précision ennemie
  damage: number;
  cooldown: number; // multiplicateur de délai entre attaques (plus bas = plus agressif)
  reaction: number; // temps de réaction en secondes
  hp: number; // légère variation uniquement
  regenDelay: number; // délai avant régénération de santé du joueur
  xp: number;
  loot: number;
}

export const DIFFICULTIES: Record<Difficulty, DifficultyDef> = {
  recrue: { id: 'recrue', name: 'Recrue', desc: 'Ennemis moins précis et moins agressifs. Idéal pour découvrir.', accuracy: 0.7, damage: 0.75, cooldown: 1.3, reaction: 0.9, hp: 0.9, regenDelay: 3.5, xp: 0.9, loot: 0.9 },
  soldat: { id: 'soldat', name: 'Soldat', desc: 'L’expérience prévue. Les ennemis manœuvrent et punissent les erreurs.', accuracy: 1.0, damage: 1.0, cooldown: 1.0, reaction: 0.55, hp: 1.0, regenDelay: 5, xp: 1.0, loot: 1.0 },
  veteran: { id: 'veteran', name: 'Vétéran', desc: 'Ennemis précis, rapides et impitoyables. Meilleur butin.', accuracy: 1.3, damage: 1.3, cooldown: 0.75, reaction: 0.3, hp: 1.1, regenDelay: 7, xp: 1.25, loot: 1.3 },
};
