// Définition des six classes jouables, de leurs compétences et de leurs arbres de talents.

export type ClassId = 'vanguard' | 'bulwark' | 'lifebinder' | 'wraith' | 'arcanist' | 'ranger';

export interface SkillDef {
  id: string;
  name: string;
  desc: string;
  cost: number; // énergie
  cd: number; // secondes
  dur?: number;
  icon: string; // glyphe affiché dans le HUD
  color: string;
}

export interface TalentDef {
  id: string;
  name: string;
  desc: string; // {v} est remplacé par la valeur au rang courant
  max: number;
  mods: Record<string, number>; // valeur par rang
}

export interface ClassDef {
  id: ClassId;
  name: string;
  role: string;
  tagline: string;
  desc: string;
  color: number;
  css: string;
  hp: number;
  energy: number;
  speed: number; // multiplicateur
  startPrimary: string;
  startSecondary: string;
  preferred: string[];
  preferredBonus: string;
  ratings: { dps: number; survie: number; mobilite: number; controle: number };
  skills: [SkillDef, SkillDef, SkillDef];
  ult: SkillDef;
  trees: [{ name: string; desc: string; talents: TalentDef[] }, { name: string; desc: string; talents: TalentDef[] }];
}

const T = (id: string, name: string, desc: string, max: number, mods: Record<string, number>): TalentDef => ({ id, name, desc, max, mods });

export const CLASSES: Record<ClassId, ClassDef> = {
  vanguard: {
    id: 'vanguard', name: 'Vanguard', role: 'Assaut / DPS', tagline: 'Le feu ouvre la voie.',
    desc: 'Soldat offensif maîtrisant la magie de feu. Agressif, mobile, taillé pour enfoncer les lignes ennemies.',
    color: 0xff6a2a, css: '#ff6a2a', hp: 100, energy: 100, speed: 1.03,
    startPrimary: 'ar17', startSecondary: 'p9', preferred: ['ar'], preferredBonus: '+8 % de dégâts avec les fusils d’assaut',
    ratings: { dps: 5, survie: 3, mobilite: 4, controle: 2 },
    skills: [
      { id: 'ember', name: 'Balles de braise', desc: 'Pendant 6 s, vos tirs enflamment les cibles et infligent des dégâts de feu bonus.', cost: 30, cd: 16, dur: 6, icon: '🔥', color: '#ff7a2a' },
      { id: 'dash', name: 'Ruée arcanique', desc: 'Propulsion rapide dans la direction de déplacement. Vous êtes insaisissable pendant la ruée.', cost: 20, cd: 7, icon: '➤', color: '#ffb04a' },
      { id: 'aegis', name: 'Égide', desc: 'Bouclier frontal qui absorbe 150 dégâts pendant 5 s.', cost: 30, cd: 18, dur: 5, icon: '⛨', color: '#ffd27a' },
    ],
    ult: { id: 'inferno', name: 'Surcharge infernale', desc: '10 s : cadence +35 %, munitions gratuites, et chaque élimination provoque une explosion.', cost: 0, cd: 0, dur: 10, icon: '✹', color: '#ff4a1a' },
    trees: [
      { name: 'Incendiaire', desc: 'Feu, explosions et dégâts bruts.', talents: [
        T('v_a1', 'Poudre ardente', '+{v} % de dégâts avec les armes.', 3, { dmg: 0.04 }),
        T('v_a2', 'Braise persistante', 'Balles de braise dure {v} s de plus.', 2, { dur1: 1.5 }),
        T('v_a3', 'Combustion', 'Les brûlures infligent {v} % de dégâts en plus.', 3, { burnDmg: 0.2 }),
        T('v_a4', 'Réaction en chaîne', 'Les ennemis en feu explosent à leur mort ({v} dégâts de zone).', 1, { burnExplode: 60 }),
        T('v_a5', 'Brasier éternel', 'Surcharge infernale dure {v} s de plus et se charge plus vite.', 2, { durUlt: 2, ultCharge: 0.1 }),
      ] },
      { name: 'Fer de lance', desc: 'Mobilité et agressivité.', talents: [
        T('v_b1', 'Pas de charge', '+{v} % de vitesse de déplacement.', 3, { moveSpeed: 0.03 }),
        T('v_b2', 'Ruée fulgurante', 'Temps de recharge de Ruée arcanique réduit de {v} %.', 2, { cd2: 0.15 }),
        T('v_b3', 'Sillage brûlant', 'La Ruée inflige {v} dégâts aux ennemis traversés.', 2, { dashDmg: 40 }),
        T('v_b4', 'Élan meurtrier', 'Chaque élimination rend {v} points d’énergie.', 2, { energyOnKill: 6 }),
        T('v_b5', 'Égide réactive', 'Égide absorbe {v} % de plus et recharge votre arme à l’activation.', 1, { aegisPower: 0.5, aegisReload: 1 }),
      ] },
    ],
  },
  bulwark: {
    id: 'bulwark', name: 'Bulwark', role: 'Tank', tagline: 'La ligne tient. Toujours.',
    desc: 'Colosse en armure lourde. Encaisse, repousse et écrase sous un déluge de plomb.',
    color: 0x4a9aff, css: '#4a9aff', hp: 150, energy: 100, speed: 0.96,
    startPrimary: 'titan', startSecondary: 'p9', preferred: ['lmg'], preferredBonus: '+25 % de vitesse de rechargement avec les mitrailleuses',
    ratings: { dps: 3, survie: 5, mobilite: 2, controle: 3 },
    skills: [
      { id: 'armor', name: 'Armure renforcée', desc: 'Réduit les dégâts subis de 50 % pendant 6 s.', cost: 25, cd: 18, dur: 6, icon: '⬢', color: '#6ab0ff' },
      { id: 'shockwave', name: 'Onde de choc', desc: 'Repousse et étourdit les ennemis proches, en leur infligeant des dégâts.', cost: 30, cd: 14, icon: '◎', color: '#9ad0ff' },
      { id: 'fortress', name: 'Forteresse', desc: 'Déploie un dôme protecteur de 8 s qui bloque les tirs venant de l’extérieur.', cost: 35, cd: 24, dur: 8, icon: '⌂', color: '#4a9aff' },
    ],
    ult: { id: 'colossus', name: 'Colosse', desc: '12 s : résistance massive, soin immédiat, tir soutenu sans rechargement ni recul.', cost: 0, cd: 0, dur: 12, icon: '♜', color: '#2a7aff' },
    trees: [
      { name: 'Rempart', desc: 'Survie et résistance.', talents: [
        T('b_a1', 'Blindage composite', '+{v} points de santé maximale.', 3, { maxHp: 15 }),
        T('b_a2', 'Plaques enchantées', 'Réduit tous les dégâts subis de {v} %.', 3, { dr: 0.04 }),
        T('b_a3', 'Armure durable', 'Armure renforcée dure {v} s de plus.', 2, { dur1: 1.5 }),
        T('b_a4', 'Régénération tactique', 'Régénère {v} PV par seconde hors combat et en combat.', 2, { hpRegen: 1.5 }),
        T('b_a5', 'Dernier bastion', 'Sous 30 % de PV, vous subissez {v} % de dégâts en moins.', 1, { lowHpDr: 0.3 }),
      ] },
      { name: 'Briseur', desc: 'Contrôle et tir soutenu.', talents: [
        T('b_b1', 'Bande continue', '+{v} % de capacité de chargeur.', 3, { magSize: 0.1 }),
        T('b_b2', 'Onde amplifiée', 'Onde de choc inflige {v} % de dégâts en plus et étourdit plus longtemps.', 2, { shockPower: 0.35 }),
        T('b_b3', 'Feu roulant', '+{v} % de dégâts avec les armes.', 3, { dmg: 0.035 }),
        T('b_b4', 'Forteresse offensive', 'Dans la Forteresse, vos dégâts augmentent de {v} %.', 2, { fortressDmg: 0.12 }),
        T('b_b5', 'Titan', 'Colosse dure {v} s de plus et se charge plus vite.', 2, { durUlt: 2, ultCharge: 0.1 }),
      ] },
    ],
  },
  lifebinder: {
    id: 'lifebinder', name: 'Lifebinder', role: 'Soigneur / Soutien', tagline: 'Tant qu’il reste un souffle.',
    desc: 'Médecin de combat lié à l’énergie vitale de la Fracture. Endurance inégalée, soins qui blessent l’ennemi.',
    color: 0x3ae08a, css: '#3ae08a', hp: 110, energy: 120, speed: 1.0,
    startPrimary: 'vektor', startSecondary: 'p9', preferred: ['ar'], preferredBonus: '+15 % de régénération d’énergie avec les fusils d’assaut',
    ratings: { dps: 3, survie: 5, mobilite: 3, controle: 3 },
    skills: [
      { id: 'pulse', name: 'Impulsion réparatrice', desc: 'Vous soigne instantanément de 45 PV.', cost: 30, cd: 10, icon: '✚', color: '#5af0a0' },
      { id: 'meddrone', name: 'Drone médical', desc: 'Déploie pendant 15 s un drone qui vous soigne en continu.', cost: 30, cd: 22, dur: 15, icon: '⚕', color: '#3ae08a' },
      { id: 'regenfield', name: 'Champ régénérant', desc: 'Zone de 10 s : vous soigne et draine la vie des ennemis à l’intérieur.', cost: 35, cd: 20, dur: 10, icon: '❂', color: '#8affc0' },
    ],
    ult: { id: 'rebirth', name: 'Renaissance', desc: 'Soin total, purge des effets négatifs, bouclier de 120 points et onde vitale blessant les ennemis.', cost: 0, cd: 0, dur: 8, icon: '❋', color: '#2aff9a' },
    trees: [
      { name: 'Sève', desc: 'Soins et endurance.', talents: [
        T('l_a1', 'Flux vital', 'Les soins sont {v} % plus puissants.', 3, { healPower: 0.1 }),
        T('l_a2', 'Impulsion rapide', 'Temps de recharge d’Impulsion réparatrice réduit de {v} %.', 2, { cd1: 0.15 }),
        T('l_a3', 'Drone endurant', 'Le Drone médical dure {v} s de plus.', 2, { dur2: 4 }),
        T('l_a4', 'Surplus vital', 'Les soins excédentaires deviennent un bouclier (jusqu’à {v} points).', 1, { overheal: 40 }),
        T('l_a5', 'Cycle éternel', 'Renaissance se charge {v} % plus vite.', 2, { ultCharge: 0.15 }),
      ] },
      { name: 'Épine', desc: 'La vie comme arme.', talents: [
        T('l_b1', 'Drain', 'Le Champ régénérant inflige {v} % de dégâts en plus.', 3, { fieldDmg: 0.25 }),
        T('l_b2', 'Drone armé', 'Le Drone médical tire sur les ennemis ({v} dégâts par salve).', 2, { droneDmg: 12 }),
        T('l_b3', 'Adrénaline', 'Après une Impulsion, +{v} % de dégâts pendant 5 s.', 2, { pulseDmg: 0.1 }),
        T('l_b4', 'Moisson', 'Chaque élimination vous soigne de {v} PV.', 2, { lifeOnKill: 4 }),
        T('l_b5', 'Réserves profondes', '+{v} % de régénération d’énergie.', 3, { energyRegen: 0.1 }),
      ] },
    ],
  },
  wraith: {
    id: 'wraith', name: 'Wraith', role: 'Sniper / Assassin', tagline: 'Vu trop tard.',
    desc: 'Spectre du champ de bataille. Invisible, insaisissable, et mortel à la première balle.',
    color: 0xb06aff, css: '#b06aff', hp: 90, energy: 100, speed: 1.06,
    startPrimary: 'frostbite', startSecondary: 'p9', preferred: ['sniper', 'smg'], preferredBonus: '+12 % de dégâts à la tête avec les fusils de précision et SMG',
    ratings: { dps: 5, survie: 2, mobilite: 5, controle: 2 },
    skills: [
      { id: 'cloak', name: 'Camouflage spectral', desc: 'Invisible pendant 7 s. Tirer rompt le camouflage, mais le premier tir inflige +100 % de dégâts.', cost: 30, cd: 18, dur: 7, icon: '☾', color: '#c08aff' },
      { id: 'blink', name: 'Téléportation courte', desc: 'Déplacement instantané vers le point visé (12 m max).', cost: 20, cd: 8, icon: '⤞', color: '#9a6aff' },
      { id: 'mark', name: 'Marque mortelle', desc: 'Marque la cible visée : elle subit +35 % de dégâts pendant 10 s et reste visible.', cost: 20, cd: 14, dur: 10, icon: '⌖', color: '#ff5a8a' },
    ],
    ult: { id: 'execute', name: 'Exécution fantôme', desc: 'Tir spectral dévastateur sur la cible prioritaire dans votre viseur. Élimine les ennemis ordinaires.', cost: 0, cd: 0, icon: '☠', color: '#d08aff' },
    trees: [
      { name: 'Ombre', desc: 'Furtivité et mobilité.', talents: [
        T('w_a1', 'Voile prolongé', 'Camouflage spectral dure {v} s de plus.', 2, { dur1: 1.5 }),
        T('w_a2', 'Pas feutrés', '+{v} % de vitesse de déplacement.', 3, { moveSpeed: 0.03 }),
        T('w_a3', 'Saut d’ombre', 'Temps de recharge de Téléportation réduit de {v} %.', 2, { cd2: 0.15 }),
        T('w_a4', 'Embuscade', 'Le tir sortant du camouflage inflige {v} % de dégâts supplémentaires.', 2, { cloakDmg: 0.5 }),
        T('w_a5', 'Évanescence', 'Une élimination à la tête réduit tous les temps de recharge de {v} s.', 1, { headKillCdr: 2 }),
      ] },
      { name: 'Faucheuse', desc: 'Précision et exécution.', talents: [
        T('w_b1', 'Œil mort', '+{v} % de dégâts à la tête.', 3, { headDmg: 0.08 }),
        T('w_b2', 'Marque profonde', 'Marque mortelle augmente les dégâts de {v} % supplémentaires.', 2, { markPower: 0.1 }),
        T('w_b3', 'Main sûre', 'Visée {v} % plus rapide.', 2, { adsSpeed: 0.12 }),
        T('w_b4', 'Récolte', 'Tuer une cible marquée rend {v} points d’énergie.', 2, { markEnergy: 15 }),
        T('w_b5', 'Sentence', 'Exécution fantôme inflige {v} % de dégâts en plus et se charge plus vite.', 2, { execPower: 0.2, ultCharge: 0.1 }),
      ] },
    ],
  },
  arcanist: {
    id: 'arcanist', name: 'Arcanist', role: 'Dégâts magiques / Contrôle', tagline: 'La Fracture obéit.',
    desc: 'Manipulateur d’énergie brute. Foudre, gravité et tempêtes dimensionnelles au bout des doigts.',
    color: 0x4ad8ff, css: '#4ad8ff', hp: 95, energy: 140, speed: 1.0,
    startPrimary: 'vesper', startSecondary: 'p9', preferred: ['smg'], preferredBonus: '+10 % de puissance des compétences avec les SMG',
    ratings: { dps: 4, survie: 2, mobilite: 3, controle: 5 },
    skills: [
      { id: 'chain', name: 'Chaîne électrique', desc: 'Foudre frappant la cible visée puis rebondissant sur 4 ennemis proches.', cost: 25, cd: 7, icon: 'ϟ', color: '#6ae0ff' },
      { id: 'gravity', name: 'Champ gravitationnel', desc: 'Zone de 6 s qui ralentit fortement et attire les ennemis.', cost: 30, cd: 16, dur: 6, icon: '◉', color: '#8a7aff' },
      { id: 'overcharge', name: 'Surcharge arcanique', desc: '8 s : vos tirs infligent +30 % de dégâts et libèrent des arcs électriques.', cost: 30, cd: 18, dur: 8, icon: '✦', color: '#4ad8ff' },
    ],
    ult: { id: 'storm', name: 'Tempête dimensionnelle', desc: 'Invoque 8 s une tempête au point visé : foudre incessante et ralentissement de zone.', cost: 0, cd: 0, dur: 8, icon: '🌀', color: '#7a5aff' },
    trees: [
      { name: 'Foudre', desc: 'Dégâts magiques.', talents: [
        T('a_a1', 'Conduction', '+{v} % de puissance des compétences.', 3, { skillPower: 0.08 }),
        T('a_a2', 'Arc étendu', 'Chaîne électrique rebondit sur {v} cible(s) de plus.', 2, { chainTargets: 1 }),
        T('a_a3', 'Décharge rapide', 'Temps de recharge de Chaîne électrique réduit de {v} %.', 2, { cd1: 0.15 }),
        T('a_a4', 'Survoltage', 'Surcharge arcanique dure {v} s de plus.', 2, { dur3: 2 }),
        T('a_a5', 'Œil du cyclone', 'La Tempête dure {v} s de plus et se charge plus vite.', 2, { durUlt: 1.5, ultCharge: 0.1 }),
      ] },
      { name: 'Gravité', desc: 'Contrôle et ressources.', talents: [
        T('a_b1', 'Puits profond', '+{v} points d’énergie maximale.', 3, { maxEnergy: 12 }),
        T('a_b2', 'Singularité', 'Le Champ gravitationnel dure {v} s de plus et inflige plus de dégâts.', 2, { dur2: 1.5, gravityDmg: 0.3 }),
        T('a_b3', 'Flux constant', '+{v} % de régénération d’énergie.', 3, { energyRegen: 0.1 }),
        T('a_b4', 'Écrasement', 'Les ennemis ralentis subissent {v} % de dégâts en plus.', 2, { slowedDmg: 0.08 }),
        T('a_b5', 'Bouclier de mana', '{v} % des dégâts subis sont absorbés par votre énergie.', 1, { manaShield: 0.25 }),
      ] },
    ],
  },
  ranger: {
    id: 'ranger', name: 'Ranger', role: 'Reconnaissance / Hybride', tagline: 'Rien n’échappe à la meute.',
    desc: 'Éclaireur accompagné d’esprits de chasse. Repère, piège et abat avec méthode.',
    color: 0xd8c84a, css: '#d8c84a', hp: 105, energy: 100, speed: 1.04,
    startPrimary: 'requiem', startSecondary: 'p9', preferred: ['sniper', 'ar'], preferredBonus: '+10 % de dégâts contre les cibles marquées',
    ratings: { dps: 4, survie: 3, mobilite: 4, controle: 4 },
    skills: [
      { id: 'scout', name: 'Drone éclaireur', desc: 'Révèle et marque 12 s tous les ennemis proches : ils subissent +15 % de dégâts.', cost: 20, cd: 18, dur: 12, icon: '◈', color: '#e8d85a' },
      { id: 'trap', name: 'Piège arcanique', desc: 'Lance un piège qui immobilise 4 s le premier ennemi qui l’approche.', cost: 25, cd: 12, icon: '✜', color: '#ffb04a' },
      { id: 'companion', name: 'Compagnon spectral', desc: 'Invoque 20 s un loup spectral qui attaque vos ennemis et attire leur attention.', cost: 35, cd: 24, dur: 20, icon: '♞', color: '#9af0d0' },
    ],
    ult: { id: 'hunt', name: 'Chasse sauvage', desc: '12 s : +50 % de dégâts de précision, ennemis révélés et deux loups spectraux à vos côtés.', cost: 0, cd: 0, dur: 12, icon: '❖', color: '#f0e06a' },
    trees: [
      { name: 'Pisteur', desc: 'Repérage et précision.', talents: [
        T('r_a1', 'Tir ajusté', '+{v} % de dégâts à la tête.', 3, { headDmg: 0.07 }),
        T('r_a2', 'Balayage large', 'Le Drone éclaireur dure {v} s de plus.', 2, { dur1: 3 }),
        T('r_a3', 'Proie désignée', 'Les cibles marquées subissent {v} % de dégâts en plus.', 2, { markPower: 0.06 }),
        T('r_a4', 'Souffle retenu', 'Recul réduit de {v} %.', 2, { recoil: 0.1 }),
        T('r_a5', 'Grand veneur', 'Chasse sauvage dure {v} s de plus et se charge plus vite.', 2, { durUlt: 2, ultCharge: 0.1 }),
      ] },
      { name: 'Meute', desc: 'Compagnons et pièges.', talents: [
        T('r_b1', 'Crocs spectraux', 'Les compagnons infligent {v} % de dégâts en plus.', 3, { petDmg: 0.2 }),
        T('r_b2', 'Lien de meute', 'Le Compagnon spectral dure {v} s de plus.', 2, { dur3: 5 }),
        T('r_b3', 'Mâchoires d’acier', 'Le Piège immobilise {v} s de plus et inflige plus de dégâts.', 2, { trapPower: 1 }),
        T('r_b4', 'Pose rapide', 'Temps de recharge du Piège réduit de {v} %.', 2, { cd2: 0.15 }),
        T('r_b5', 'Alpha', 'Invoque un second compagnon ({v}).', 1, { extraPet: 1 }),
      ] },
    ],
  },
};

export const CLASS_ORDER: ClassId[] = ['vanguard', 'bulwark', 'lifebinder', 'wraith', 'arcanist', 'ranger'];

export function talentDesc(t: TalentDef, rank: number): string {
  const r = Math.max(1, rank);
  const first = Object.values(t.mods)[0];
  let v = first * r;
  // affichage en pourcentage si la valeur est une fraction
  const txt = Math.abs(first) < 1 ? String(Math.round(v * 100)) : String(Math.round(v * 10) / 10);
  return t.desc.replace('{v}', txt);
}
