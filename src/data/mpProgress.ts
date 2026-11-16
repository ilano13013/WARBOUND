// Progression multijoueur : niveaux, déblocages d'armes et d'accessoires, classes (« Créer une classe »).
// Indépendante de la progression solo. L'XP est conservée sur le compte en ligne (serveur).
// Les modifications arcaniques ne sont pas proposées en multijoueur (effets spéciaux hors équilibrage).
import { WEAPONS, ATTACHMENTS, ATTACH_SLOTS, type AttachSlot } from './weapons';

export const MP_MAX_LEVEL = 30;
/** XP pour passer du niveau `level` au suivant. */
export function mpXpFor(level: number): number { return 600 + 150 * (level - 1); }
/** Niveau atteint et progression dans le niveau à partir de l'XP totale. */
export function mpLevelOf(xp: number): { level: number; into: number; need: number } {
  let level = 1, rest = Math.max(0, Math.floor(xp));
  while (level < MP_MAX_LEVEL && rest >= mpXpFor(level)) { rest -= mpXpFor(level); level++; }
  return { level, into: rest, need: level >= MP_MAX_LEVEL ? 0 : mpXpFor(level) };
}

/** Niveau multijoueur requis pour chaque arme. */
export const WEAPON_UNLOCK: Record<string, number> = {
  ar17: 1, vesper: 1, p9: 1,
  requiem: 3, spectre: 5, ash: 7, vektor: 9, titan: 11, ember45: 13, frostbite: 16, aegis762: 19, bastion: 22,
};
/** Accessoires proposés en multijoueur, dans l'ordre où ils se débloquent sur une arme (les arcaniques sont exclus). */
export const ATTACH_ORDER = ['reflex', 'compensator', 'extmag', 'vgrip', 'acog', 'silencer', 'fastmag', 'agrip', 'heavybarrel', 'longscope'];

// ---------- niveaux d'armes ----------
/** XP d'arme pour passer du niveau `level` au suivant (gagnée en éliminant avec cette arme). */
export function wXpFor(level: number): number { return 300 + 100 * (level - 1); }
/** Accessoires compatibles avec une arme, dans leur ordre de déblocage (un par niveau d'arme, à partir du niveau 2). */
export function weaponAttachList(weapon: string): string[] {
  return ATTACH_ORDER.filter((a) => { const d = ATTACHMENTS[a]; return !!d && attachAllowed(weapon, d.slot, a); });
}
/** Niveau maximal d'une arme : un niveau par accessoire à débloquer. */
export function weaponMaxLevel(weapon: string): number { return 1 + weaponAttachList(weapon).length; }
/** Niveau d'arme requis pour un accessoire (99 s'il n'est pas compatible). */
export function attachLevel(weapon: string, att: string): number {
  const i = weaponAttachList(weapon).indexOf(att);
  return i < 0 ? 99 : i + 2;
}
/** Niveau d'une arme et progression à partir de son XP totale. */
export function weaponLevelOf(weapon: string, xp: number): { level: number; into: number; need: number; max: number } {
  const max = weaponMaxLevel(weapon);
  let level = 1, rest = Math.max(0, Math.floor(xp || 0));
  while (level < max && rest >= wXpFor(level)) { rest -= wXpFor(level); level++; }
  return { level, into: rest, need: level >= max ? 0 : wXpFor(level), max };
}

// ---------- équipement létal et atouts ----------
export interface LethalDef { id: string; name: string; unlock: number; desc: string; fuse: number; sticky: boolean; radius: number; damage: number }
export const LETHALS: Record<string, LethalDef> = {
  frag: { id: 'frag', name: 'Grenade Frag', unlock: 3, desc: 'Rebondit, explose 2,2 s après le lancer. Grand rayon.', fuse: 2.2, sticky: false, radius: 6, damage: 150 },
  semtex: { id: 'semtex', name: 'Semtex', unlock: 8, desc: 'Colle à la première surface ou au premier joueur touché, explose 1,6 s après.', fuse: 1.6, sticky: true, radius: 4.5, damage: 150 },
};
export interface PerkDef { id: string; name: string; slot: 0 | 1 | 2; unlock: number; desc: string }
export const PERKS: Record<string, PerkDef> = {
  vigueur: { id: 'vigueur', name: 'Vigueur', slot: 0, unlock: 1, desc: 'La santé commence à se régénérer 2,5 s après une blessure au lieu de 5 s.' },
  gilet: { id: 'gilet', name: 'Gilet renforcé', slot: 0, unlock: 5, desc: 'Dégâts des explosifs réduits de moitié.' },
  rapide: { id: 'rapide', name: 'Rechargement rapide', slot: 1, unlock: 2, desc: 'Rechargement 30 % plus rapide.' },
  munitions: { id: 'munitions', name: 'Munitions supplémentaires', slot: 1, unlock: 7, desc: 'Deux chargeurs de réserve en plus et un équipement létal de plus.' },
  pillard: { id: 'pillard', name: 'Pillard', slot: 2, unlock: 4, desc: 'Récupère un chargeur pour chaque arme à chaque élimination.' },
  fantome: { id: 'fantome', name: 'Fantôme', slot: 2, unlock: 10, desc: 'Vos tirs n’apparaissent pas sur la mini-carte adverse.' },
};
export const PERK_SLOT_LABEL = ['Atout 1', 'Atout 2', 'Atout 3'];
export const RELOAD_FAST = 0.7;
export const REGEN_DELAY = 5, REGEN_DELAY_FAST = 2.5, REGEN_RATE = 25;
export const MP_SLOTS: AttachSlot[] = ATTACH_SLOTS.map((s) => s.slot).filter((s) => s !== 'arcane');

export interface ClassDef {
  name: string;
  primary: string;
  pAttach: Partial<Record<AttachSlot, string>>;
  secondary: string;
  /** Équipement létal (grenade) ou null. */
  lethal: string | null;
  /** Un atout par emplacement (ou null). */
  perks: (string | null)[];
}

/** Classes prédéfinies (non modifiables). */
export const PRESET_CLASSES: ClassDef[] = [
  { name: 'Assaut', primary: 'ar17', pAttach: {}, secondary: 'p9', lethal: null, perks: ['vigueur', null, null] },
  { name: 'Rapproché', primary: 'vesper', pAttach: {}, secondary: 'p9', lethal: null, perks: ['vigueur', null, null] },
  { name: 'Précision', primary: 'requiem', pAttach: {}, secondary: 'p9', lethal: null, perks: ['vigueur', null, null] },
  { name: 'Soutien', primary: 'titan', pAttach: {}, secondary: 'p9', lethal: null, perks: ['vigueur', null, null] },
];
export const CUSTOM_SLOTS = 5;

/** Niveau joueur requis par une classe (armes, équipement létal, atouts). */
export function classLevel(c: ClassDef): number {
  let lv = Math.max(WEAPON_UNLOCK[c.primary] ?? 99, WEAPON_UNLOCK[c.secondary] ?? 99);
  if (c.lethal) lv = Math.max(lv, LETHALS[c.lethal]?.unlock ?? 99);
  for (const k of c.perks) if (k) lv = Math.max(lv, PERKS[k]?.unlock ?? 99);
  return lv;
}
/** Accessoires de la classe pas encore débloqués par le niveau de l'arme principale. */
export function classAttachLocked(c: ClassDef, weaponLevel: number): string[] {
  return Object.values(c.pAttach).filter((a): a is string => !!a && attachLevel(c.primary, a) > weaponLevel);
}
/** Ce qui manque pour jouer une classe (vide si elle est jouable). */
export function classLockReason(c: ClassDef, level: number, weaponLevel: (id: string) => number): string {
  const need = classLevel(c);
  if (need > level) return `niv. ${need}`;
  const locked = classAttachLocked(c, weaponLevel(c.primary));
  return locked.length ? `${WEAPONS[c.primary]?.name} niv. ${Math.max(...locked.map((a) => attachLevel(c.primary, a)))}` : '';
}

export function attachAllowed(weapon: string, slot: AttachSlot, att: string): boolean {
  const a = ATTACHMENTS[att], w = WEAPONS[weapon];
  return !!a && !!w && a.slot === slot && slot !== 'arcane' && ATTACH_ORDER.includes(att) && (!a.families || a.families.includes(w.family)) && w.family !== 'pistol';
}

/** Nettoie une classe reçue (stockage, réseau) : armes et accessoires existants et compatibles uniquement. */
export function sanitizeClass(raw: unknown, fallback: ClassDef = PRESET_CLASSES[0]): ClassDef {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Partial<ClassDef>;
  const primary = typeof r.primary === 'string' && WEAPONS[r.primary]?.slot === 'primary' ? r.primary : fallback.primary;
  const secondary = typeof r.secondary === 'string' && WEAPONS[r.secondary]?.slot === 'secondary' ? r.secondary : fallback.secondary;
  const pAttach: Partial<Record<AttachSlot, string>> = {};
  for (const s of MP_SLOTS) { const a = r.pAttach?.[s]; if (typeof a === 'string' && attachAllowed(primary, s, a)) pAttach[s] = a; }
  const name = String(r.name || fallback.name).replace(/[<>]/g, '').slice(0, 18) || fallback.name;
  const lethal = r.lethal === null ? null : typeof r.lethal === 'string' && LETHALS[r.lethal] ? r.lethal : r.lethal === undefined ? (fallback.lethal ?? null) : null;
  const src = Array.isArray(r.perks) ? r.perks : (fallback.perks || []);
  const perks: (string | null)[] = [0, 1, 2].map((i) => { const k = src[i]; return typeof k === 'string' && PERKS[k]?.slot === i ? k : null; });
  return { name, primary, pAttach, secondary, lethal, perks };
}

/** Récompenses d'XP multijoueur (joueur) ; l'XP d'arme vaut celle de l'élimination faite avec l'arme. */
export const MP_XP = { kill: 100, head: 25, assist: 50, capture: 150, finish: 200, win: 300, draw: 100 };
/** Bonus d'XP d'arme pour l'arme principale à la fin d'une partie terminée. */
export const WEAPON_FINISH_XP = 100;

/** Déblocages obtenus en passant du niveau joueur a au niveau b. */
export function unlocksBetween(a: number, b: number): string[] {
  const out: string[] = [];
  for (const [id, lv] of Object.entries(WEAPON_UNLOCK)) if (lv > a && lv <= b) out.push(WEAPONS[id]?.name || id);
  for (const l of Object.values(LETHALS)) if (l.unlock > a && l.unlock <= b) out.push(l.name);
  for (const k of Object.values(PERKS)) if (k.unlock > a && k.unlock <= b) out.push(`Atout : ${k.name}`);
  return out;
}
