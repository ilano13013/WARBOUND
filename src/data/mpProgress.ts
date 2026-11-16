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
/** Niveau multijoueur requis pour chaque accessoire (les arcaniques sont exclus). */
export const ATTACH_UNLOCK: Record<string, number> = {
  reflex: 2, compensator: 4, extmag: 6, vgrip: 8, acog: 10, silencer: 12, fastmag: 14, agrip: 17, heavybarrel: 20, longscope: 24,
};
export const MP_SLOTS: AttachSlot[] = ATTACH_SLOTS.map((s) => s.slot).filter((s) => s !== 'arcane');

export interface ClassDef {
  name: string;
  primary: string;
  pAttach: Partial<Record<AttachSlot, string>>;
  secondary: string;
}

/** Classes prédéfinies (non modifiables). */
export const PRESET_CLASSES: ClassDef[] = [
  { name: 'Assaut', primary: 'ar17', pAttach: {}, secondary: 'p9' },
  { name: 'Rapproché', primary: 'vesper', pAttach: {}, secondary: 'p9' },
  { name: 'Précision', primary: 'requiem', pAttach: {}, secondary: 'p9' },
  { name: 'Soutien', primary: 'titan', pAttach: {}, secondary: 'p9' },
];
export const CUSTOM_SLOTS = 5;

/** Niveau requis par une classe (arme principale, secondaire et accessoires). */
export function classLevel(c: ClassDef): number {
  let lv = Math.max(WEAPON_UNLOCK[c.primary] ?? 99, WEAPON_UNLOCK[c.secondary] ?? 99);
  for (const a of Object.values(c.pAttach)) if (a) lv = Math.max(lv, ATTACH_UNLOCK[a] ?? 99);
  return lv;
}

export function attachAllowed(weapon: string, slot: AttachSlot, att: string): boolean {
  const a = ATTACHMENTS[att], w = WEAPONS[weapon];
  return !!a && !!w && a.slot === slot && slot !== 'arcane' && att in ATTACH_UNLOCK && (!a.families || a.families.includes(w.family)) && w.family !== 'pistol';
}

/** Nettoie une classe reçue (stockage, réseau) : armes et accessoires existants et compatibles uniquement. */
export function sanitizeClass(raw: unknown, fallback: ClassDef = PRESET_CLASSES[0]): ClassDef {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Partial<ClassDef>;
  const primary = typeof r.primary === 'string' && WEAPONS[r.primary]?.slot === 'primary' ? r.primary : fallback.primary;
  const secondary = typeof r.secondary === 'string' && WEAPONS[r.secondary]?.slot === 'secondary' ? r.secondary : fallback.secondary;
  const pAttach: Partial<Record<AttachSlot, string>> = {};
  for (const s of MP_SLOTS) { const a = r.pAttach?.[s]; if (typeof a === 'string' && attachAllowed(primary, s, a)) pAttach[s] = a; }
  const name = String(r.name || fallback.name).replace(/[<>]/g, '').slice(0, 18) || fallback.name;
  return { name, primary, pAttach, secondary };
}

/** Récompenses d'XP multijoueur. */
export const MP_XP = { kill: 100, head: 25, assist: 50, capture: 150, finish: 200, win: 300, draw: 100 };
