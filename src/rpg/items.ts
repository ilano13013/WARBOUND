// Objets, raretés, génération de butin pondérée, recyclage et amélioration.
import { WEAPONS, type AttachSlot } from '../data/weapons';

export type Rarity = 'common' | 'rare' | 'epic' | 'legendary';
export type ItemKind = 'weapon' | 'armor' | 'module' | 'artifact';
export type EquipSlot = 'primary' | 'secondary' | 'armor' | 'module' | 'artifact';

export interface Item {
  uid: string;
  kind: ItemKind;
  base: string; // id d'arme ou de modèle d'équipement
  name: string;
  rarity: Rarity;
  ilvl: number;
  up: number; // niveau d'amélioration (0-5)
  stats: Record<string, number>;
  legend?: string;
  attach?: Partial<Record<AttachSlot, string>>;
}

export const RARITY: Record<Rarity, { name: string; color: string; mult: number; affixes: number; scrap: number; order: number }> = {
  common: { name: 'Commun', color: '#b8c0c8', mult: 1.0, affixes: 1, scrap: 1, order: 0 },
  rare: { name: 'Rare', color: '#4a9aff', mult: 1.3, affixes: 2, scrap: 3, order: 1 },
  epic: { name: 'Épique', color: '#b06aff', mult: 1.65, affixes: 3, scrap: 8, order: 2 },
  legendary: { name: 'Légendaire', color: '#ff9a2a', mult: 2.0, affixes: 3, scrap: 20, order: 3 },
};

export const KIND_LABEL: Record<ItemKind, string> = { weapon: 'Arme', armor: 'Armure', module: 'Module arcanique', artifact: 'Artefact' };

// Libellés et format d'affichage des statistiques
export const STAT_INFO: Record<string, { label: string; pct: boolean }> = {
  maxHp: { label: 'Santé max', pct: false },
  dr: { label: 'Réduction des dégâts', pct: true },
  hpRegen: { label: 'Régén. de santé /s', pct: false },
  maxEnergy: { label: 'Énergie max', pct: false },
  energyRegen: { label: 'Régén. d’énergie', pct: true },
  cdr: { label: 'Recharge des compétences', pct: true },
  skillPower: { label: 'Puissance des compétences', pct: true },
  moveSpeed: { label: 'Vitesse de déplacement', pct: true },
  ultCharge: { label: 'Charge d’ultime', pct: true },
  headDmg: { label: 'Dégâts à la tête', pct: true },
  dmg: { label: 'Dégâts des armes', pct: true },
  reloadSpeed: { label: 'Vitesse de rechargement', pct: true },
  healPower: { label: 'Puissance des soins', pct: true },
  w_dmg: { label: 'Dégâts de l’arme', pct: true },
  w_mag: { label: 'Capacité du chargeur', pct: true },
  w_reload: { label: 'Vitesse de rechargement', pct: true },
  w_recoil: { label: 'Contrôle du recul', pct: true },
  w_head: { label: 'Dégâts à la tête', pct: true },
  w_range: { label: 'Portée', pct: true },
  w_rpm: { label: 'Cadence', pct: true },
};

export const LEGENDS: Record<string, { name: string; desc: string; kinds: ItemKind[] }> = {
  explosive: { name: 'Fragmentation', desc: 'Les éliminations avec cette arme provoquent une explosion (60 dégâts de zone).', kinds: ['weapon'] },
  bottomless: { name: 'Chargeur sans fond', desc: '25 % de chances de ne pas consommer de munition.', kinds: ['weapon'] },
  voltaic: { name: 'Voltaïque', desc: 'Chaque 6e impact déclenche un arc électrique entre les ennemis proches.', kinds: ['weapon'] },
  vampiric: { name: 'Vampirique', desc: 'Les éliminations à la tête rendent 12 PV.', kinds: ['weapon'] },
  secondwind: { name: 'Second souffle', desc: 'Une fois par mission, un coup fatal vous laisse à 50 % de PV avec 3 s d’invulnérabilité.', kinds: ['armor'] },
  thorns: { name: 'Carapace de faille', desc: 'Renvoie 30 dégâts à tout attaquant au corps à corps.', kinds: ['armor'] },
  echo: { name: 'Écho', desc: '20 % de chances qu’une compétence ne déclenche pas son temps de recharge.', kinds: ['module'] },
  overflow: { name: 'Trop-plein', desc: 'Quand votre énergie est au maximum, vos tirs infligent +12 % de dégâts.', kinds: ['module'] },
  slidecharge: { name: 'Élan fantôme', desc: 'Après une glissade, +30 % de dégâts pendant 3 s.', kinds: ['artifact'] },
  killsurge: { name: 'Frénésie', desc: 'Chaque élimination : +4 % de dégâts pendant 6 s (cumulable 5 fois).', kinds: ['artifact'] },
};

interface GearBase { id: string; kind: ItemKind; name: string; main: [string, number]; pool: [string, number][] }

// Valeurs indiquées pour un objet commun de niveau 1 ; mise à l'échelle par niveau et rareté.
const GEAR: GearBase[] = [
  { id: 'vest', kind: 'armor', name: 'Gilet tactique', main: ['maxHp', 12], pool: [['dr', 0.03], ['hpRegen', 0.6], ['moveSpeed', 0.02], ['maxHp', 8]] },
  { id: 'plate', kind: 'armor', name: 'Armure à plaques', main: ['dr', 0.05], pool: [['maxHp', 10], ['hpRegen', 0.6], ['reloadSpeed', 0.05], ['dr', 0.02]] },
  { id: 'weave', kind: 'armor', name: 'Tissage enchanté', main: ['hpRegen', 1.0], pool: [['maxHp', 8], ['moveSpeed', 0.03], ['energyRegen', 0.05], ['dr', 0.02]] },
  { id: 'coil', kind: 'module', name: 'Bobine arcanique', main: ['energyRegen', 0.1], pool: [['maxEnergy', 10], ['cdr', 0.04], ['skillPower', 0.05], ['ultCharge', 0.05]] },
  { id: 'focus', kind: 'module', name: 'Focalisateur', main: ['skillPower', 0.08], pool: [['cdr', 0.04], ['maxEnergy', 8], ['energyRegen', 0.06], ['healPower', 0.06]] },
  { id: 'chrono', kind: 'module', name: 'Régulateur de flux', main: ['cdr', 0.06], pool: [['maxEnergy', 10], ['ultCharge', 0.06], ['skillPower', 0.04], ['energyRegen', 0.05]] },
  { id: 'sigil', kind: 'artifact', name: 'Sceau de guerre', main: ['dmg', 0.04], pool: [['headDmg', 0.06], ['reloadSpeed', 0.06], ['ultCharge', 0.05], ['moveSpeed', 0.02]] },
  { id: 'eye', kind: 'artifact', name: 'Œil du Voile', main: ['headDmg', 0.08], pool: [['dmg', 0.03], ['ultCharge', 0.05], ['cdr', 0.03], ['energyRegen', 0.05]] },
  { id: 'shard', kind: 'artifact', name: 'Éclat de Fracture', main: ['ultCharge', 0.1], pool: [['dmg', 0.03], ['moveSpeed', 0.03], ['maxHp', 8], ['skillPower', 0.04]] },
];

const WEAPON_POOL: [string, number][] = [['w_dmg', 0.05], ['w_mag', 0.1], ['w_reload', 0.08], ['w_recoil', 0.1], ['w_head', 0.08], ['w_range', 0.12], ['w_rpm', 0.04]];

const PREFIX: Record<Rarity, string[]> = {
  common: ['', '', ''],
  rare: ['renforcé', 'calibré', 'de vétéran'],
  epic: ['du Voile', 'arcanique', 'de la Fracture'],
  legendary: ['', '', ''],
};

const LEGEND_NAMES: Record<string, string> = {
  explosive: '« Cataclysme »', bottomless: '« Sans Fond »', voltaic: '« Orage »', vampiric: '« Soif »',
  secondwind: '« Phénix »', thorns: '« Carapace »', echo: '« Écho »', overflow: '« Déluge »', slidecharge: '« Spectre »', killsurge: '« Frénésie »',
};

let uidCounter = 0;
export function newUid(): string {
  uidCounter++;
  return Date.now().toString(36) + '-' + uidCounter.toString(36) + '-' + Math.floor(Math.random() * 1e6).toString(36);
}

function pick<T>(arr: T[], rng: () => number): T { return arr[Math.floor(rng() * arr.length) % arr.length]; }

function levelScale(ilvl: number): number { return 1 + (ilvl - 1) * 0.05; }

export function rollRarity(luck: number, rng: () => number = Math.random, min: Rarity = 'common'): Rarity {
  // Table pondérée ; « luck » déplace le poids vers les raretés hautes.
  const w = { common: 58 / luck, rare: 28, epic: 10 * luck, legendary: 2.2 * luck * luck };
  const order: Rarity[] = ['common', 'rare', 'epic', 'legendary'];
  const minI = RARITY[min].order;
  let total = 0;
  for (const r of order) if (RARITY[r].order >= minI) total += w[r];
  let x = rng() * total;
  for (const r of order) {
    if (RARITY[r].order < minI) continue;
    x -= w[r];
    if (x <= 0) return r;
  }
  return min;
}

export function makeWeaponItem(base: string, rarity: Rarity, ilvl: number, rng: () => number = Math.random, legend?: string): Item {
  const def = WEAPONS[base];
  const R = RARITY[rarity];
  const stats: Record<string, number> = {};
  const n = rarity === 'common' ? 0 : R.affixes;
  const pool = WEAPON_POOL.slice();
  for (let i = 0; i < n && pool.length; i++) {
    const idx = Math.floor(rng() * pool.length);
    const [k, v] = pool.splice(idx, 1)[0];
    stats[k] = round(v * R.mult * (0.85 + rng() * 0.3) * (1 + (ilvl - 1) * 0.015));
  }
  // les armes gagnent des dégâts avec le niveau d'objet pour suivre la progression
  stats.w_dmg = round((stats.w_dmg || 0) + (ilvl - 1) * 0.012 + (R.mult - 1) * 0.08);
  let name = def.name;
  if (rarity === 'legendary') {
    const pool2 = Object.keys(LEGENDS).filter((k) => LEGENDS[k].kinds.includes('weapon'));
    legend = legend || pick(pool2, rng);
    name = `${def.name} ${LEGEND_NAMES[legend]}`;
  } else if (rarity !== 'common') name = `${def.name} ${pick(PREFIX[rarity], rng)}`;
  return { uid: newUid(), kind: 'weapon', base, name, rarity, ilvl, up: 0, stats, legend: rarity === 'legendary' ? legend : undefined, attach: {} };
}

export function makeGearItem(kind: ItemKind, rarity: Rarity, ilvl: number, rng: () => number = Math.random, legend?: string, baseId?: string): Item {
  const bases = GEAR.filter((g) => g.kind === kind && (!baseId || g.id === baseId));
  const base = pick(bases, rng);
  const R = RARITY[rarity];
  const sc = levelScale(ilvl) * R.mult;
  const stats: Record<string, number> = {};
  stats[base.main[0]] = round(base.main[1] * sc);
  const pool = base.pool.slice();
  for (let i = 0; i < R.affixes - 1 && pool.length; i++) {
    const idx = Math.floor(rng() * pool.length);
    const [k, v] = pool.splice(idx, 1)[0];
    stats[k] = round((stats[k] || 0) + v * sc * (0.8 + rng() * 0.3));
  }
  let name = base.name;
  if (rarity === 'legendary') {
    const pool2 = Object.keys(LEGENDS).filter((k) => LEGENDS[k].kinds.includes(kind));
    legend = legend || pick(pool2, rng);
    name = `${base.name} ${LEGEND_NAMES[legend]}`;
  } else if (rarity !== 'common') name = `${base.name} ${pick(PREFIX[rarity], rng)}`;
  return { uid: newUid(), kind, base: base.id, name, rarity, ilvl, up: 0, stats, legend: rarity === 'legendary' ? legend : undefined };
}

function round(v: number): number { return Math.abs(v) < 1 ? Math.round(v * 1000) / 1000 : Math.round(v * 10) / 10; }

export interface LootTable { rolls: number; luck: number; min?: Rarity; weaponChance: number; guaranteed?: { kind: ItemKind; base?: string; rarity: Rarity; legend?: string }[] }

export const LOOT_TABLES: Record<string, LootTable> = {
  mission: { rolls: 2, luck: 1.0, weaponChance: 0.45 },
  missionHard: { rolls: 3, luck: 1.3, min: 'rare', weaponChance: 0.45 },
  elite: { rolls: 1, luck: 1.2, weaponChance: 0.4 },
  survival: { rolls: 1, luck: 1.1, weaponChance: 0.4 },
  boss_guardian: { rolls: 2, luck: 1.6, min: 'rare', weaponChance: 0.5, guaranteed: [{ kind: 'weapon', base: 'aegis762', rarity: 'legendary', legend: 'explosive' }] },
  boss_archon: { rolls: 2, luck: 1.8, min: 'rare', weaponChance: 0.4, guaranteed: [{ kind: 'artifact', base: 'eye', rarity: 'legendary', legend: 'killsurge' }] },
  boss_sovereign: { rolls: 3, luck: 2.2, min: 'epic', weaponChance: 0.5, guaranteed: [{ kind: 'module', base: 'chrono', rarity: 'legendary', legend: 'echo' }, { kind: 'weapon', base: 'requiem', rarity: 'legendary', legend: 'voltaic' }] },
};

/** Génère le butin d'une table. `firstTime` active les récompenses garanties des boss. */
export function rollLoot(tableId: string, ilvl: number, luckMult: number, firstTime: boolean, rng: () => number = Math.random): Item[] {
  const t = LOOT_TABLES[tableId];
  const out: Item[] = [];
  if (!t) return out;
  if (t.guaranteed) {
    for (const g of t.guaranteed) {
      if (!firstTime && rng() > 0.2) continue;
      out.push(g.kind === 'weapon' ? makeWeaponItem(g.base!, g.rarity, ilvl, rng, g.legend) : makeGearItem(g.kind, g.rarity, ilvl, rng, g.legend, g.base));
    }
  }
  for (let i = 0; i < t.rolls; i++) {
    const rarity = rollRarity(t.luck * luckMult, rng, t.min || 'common');
    if (rng() < t.weaponChance) {
      const ids = Object.keys(WEAPONS).filter((id) => WEAPONS[id].unlockLevel <= ilvl + 2);
      out.push(makeWeaponItem(pick(ids, rng), rarity === 'common' ? 'rare' : rarity, ilvl, rng));
    } else {
      const kinds: ItemKind[] = ['armor', 'module', 'artifact'];
      out.push(makeGearItem(pick(kinds, rng), rarity, ilvl, rng));
    }
  }
  return out;
}

export const MAX_UPGRADE = 5;
export function upgradeCost(it: Item): number { return Math.round((it.up + 1) * 3 * (1 + RARITY[it.rarity].order * 0.6)); }
export function scrapValue(it: Item): number { return RARITY[it.rarity].scrap + it.up * 2; }
/** Multiplicateur appliqué aux statistiques par les améliorations de l'atelier. */
export function upMult(it: Item): number { return 1 + it.up * 0.08; }

export function slotOf(it: Item): EquipSlot {
  if (it.kind === 'weapon') return WEAPONS[it.base].slot;
  return it.kind as EquipSlot;
}

export function validateItem(raw: any): Item | null {
  if (!raw || typeof raw !== 'object') return null;
  if (typeof raw.uid !== 'string' || typeof raw.base !== 'string') return null;
  if (!['weapon', 'armor', 'module', 'artifact'].includes(raw.kind)) return null;
  if (!RARITY[raw.rarity as Rarity]) return null;
  if (raw.kind === 'weapon' && !WEAPONS[raw.base]) return null;
  if (raw.kind !== 'weapon' && !GEAR.find((g) => g.id === raw.base && g.kind === raw.kind)) return null;
  const stats: Record<string, number> = {};
  if (raw.stats && typeof raw.stats === 'object') for (const k of Object.keys(raw.stats)) if (STAT_INFO[k] && Number.isFinite(raw.stats[k])) stats[k] = raw.stats[k];
  return {
    uid: raw.uid, kind: raw.kind, base: raw.base, name: String(raw.name || raw.base), rarity: raw.rarity,
    ilvl: clampInt(raw.ilvl, 1, 20), up: clampInt(raw.up, 0, MAX_UPGRADE), stats,
    legend: raw.legend && LEGENDS[raw.legend] ? raw.legend : undefined,
    attach: raw.kind === 'weapon' ? (raw.attach && typeof raw.attach === 'object' ? { ...raw.attach } : {}) : undefined,
  };
}
function clampInt(v: any, a: number, b: number): number { v = Math.round(Number(v)); return Number.isFinite(v) ? Math.min(b, Math.max(a, v)) : a; }

export function formatStat(key: string, v: number): string {
  const info = STAT_INFO[key];
  if (!info) return `${key} ${v}`;
  const val = info.pct ? `${v >= 0 ? '+' : ''}${Math.round(v * 1000) / 10} %` : `${v >= 0 ? '+' : ''}${Math.round(v * 10) / 10}`;
  return `${val} ${info.label}`;
}
