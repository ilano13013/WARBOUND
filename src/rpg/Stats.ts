// Calcul des statistiques dérivées : talents, équipement, armes, expérience et niveaux.
import { CLASSES, type ClassId, type TalentDef } from '../data/classes';
import { ATTACHMENTS, WEAPONS, type WeaponDef } from '../data/weapons';
import type { Profile } from '../save/Save';
import { makeWeaponItem, upMult, type Item } from './items';

export const MAX_LEVEL = 20;

export function xpForLevel(level: number): number { return 300 + 130 * level; }

export function talentPointsTotal(p: Profile): number { return p.level - 1; }
export function talentPointsSpent(p: Profile): number { return Object.values(p.talents).reduce((a, b) => a + b, 0); }
export function talentPointsFree(p: Profile): number { return talentPointsTotal(p) - talentPointsSpent(p); }

export function findTalent(classId: ClassId, id: string): { t: TalentDef; tree: number; index: number } | null {
  const c = CLASSES[classId];
  for (let tr = 0; tr < 2; tr++) {
    const i = c.trees[tr].talents.findIndex((x) => x.id === id);
    if (i >= 0) return { t: c.trees[tr].talents[i], tree: tr, index: i };
  }
  return null;
}

export function canLearn(p: Profile, id: string): boolean {
  const f = findTalent(p.classId, id);
  if (!f || talentPointsFree(p) <= 0) return false;
  if ((p.talents[id] || 0) >= f.t.max) return false;
  if (f.index > 0) {
    const prev = CLASSES[p.classId].trees[f.tree].talents[f.index - 1];
    if (!(p.talents[prev.id] > 0)) return false;
  }
  return true;
}

export function learnTalent(p: Profile, id: string): boolean {
  if (!canLearn(p, id)) return false;
  p.talents[id] = (p.talents[id] || 0) + 1;
  return true;
}

export function resetTalents(p: Profile): void { p.talents = {}; }

export function equippedItem(p: Profile, slot: keyof Profile['equipped']): Item | null {
  const uid = p.equipped[slot];
  return uid ? p.inventory.find((i) => i.uid === uid) || null : null;
}

/** Agrège les modificateurs issus des talents et de l'équipement (hors armes). */
export function gatherMods(p: Profile): { mods: Record<string, number>; legends: Set<string> } {
  const mods: Record<string, number> = {};
  const legends = new Set<string>();
  const c = CLASSES[p.classId];
  for (const tree of c.trees) for (const t of tree.talents) {
    const rank = p.talents[t.id] || 0;
    if (!rank) continue;
    for (const k of Object.keys(t.mods)) mods[k] = (mods[k] || 0) + t.mods[k] * rank;
  }
  for (const slot of ['armor', 'module', 'artifact'] as const) {
    const it = equippedItem(p, slot);
    if (!it) continue;
    const m = upMult(it);
    for (const k of Object.keys(it.stats)) mods[k] = (mods[k] || 0) + it.stats[k] * m;
    if (it.legend) legends.add(it.legend);
  }
  // bonus de classe liés à l'arme principale
  const prim = equippedItem(p, 'primary');
  const fam = prim ? WEAPONS[prim.base].family : null;
  if (p.classId === 'lifebinder' && fam === 'ar') mods.energyRegen = (mods.energyRegen || 0) + 0.15;
  if (p.classId === 'arcanist' && fam === 'smg') mods.skillPower = (mods.skillPower || 0) + 0.1;
  if (p.classId === 'ranger') mods.markPower = (mods.markPower || 0) + 0.1;
  return { mods, legends };
}

export interface WStats {
  def: WeaponDef; item: Item;
  damage: number; rpm: number; mag: number; reload: number; recoilV: number; recoilH: number; hipSpread: number; adsSpread: number;
  mobility: number; rangeStart: number; rangeEnd: number; minDmg: number; headMult: number; adsTime: number; adsZoom: number;
  silent: boolean; burn: number; chain: number; energyOnHit: number; legend?: string; scoped: boolean;
}

/** Statistiques effectives d'une arme : base + accessoires + affixes + améliorations + talents + bonus de classe. */
export function weaponStats(item: Item, mods: Record<string, number>, classId: ClassId): WStats {
  const def = WEAPONS[item.base];
  const s: WStats = {
    def, item, damage: def.damage, rpm: def.rpm, mag: def.mag, reload: def.reload, recoilV: def.recoilV, recoilH: def.recoilH, hipSpread: def.hipSpread,
    adsSpread: def.adsSpread, mobility: def.mobility, rangeStart: def.rangeStart, rangeEnd: def.rangeEnd, minDmg: def.minDmg, headMult: def.headMult,
    adsTime: def.adsTime, adsZoom: def.adsZoom, silent: false, burn: 0, chain: 0, energyOnHit: 0, legend: item.legend, scoped: def.family === 'sniper',
  };
  let recoil = 1, range = 1;
  for (const id of Object.values(item.attach || {})) {
    const a = id ? ATTACHMENTS[id] : null;
    if (!a) continue;
    const m = a.mods;
    if (m.damage) s.damage *= m.damage;
    if (m.rpm) s.rpm *= m.rpm;
    if (m.mag) s.mag *= m.mag;
    if (m.reload) s.reload *= m.reload;
    if (m.recoil) recoil *= m.recoil;
    if (m.hipSpread) s.hipSpread *= m.hipSpread;
    if (m.adsSpread) s.adsSpread *= m.adsSpread;
    if (m.mobility) s.mobility *= m.mobility;
    if (m.range) range *= m.range;
    if (m.adsTime) s.adsTime *= m.adsTime;
    if (m.adsZoom) { s.adsZoom = Math.min(s.adsZoom, m.adsZoom); if (m.adsZoom < 0.65) s.scoped = true; }
    if (m.headMult) s.headMult *= m.headMult;
    if (m.silent) s.silent = true;
    if (m.burn) s.burn = m.burn;
    if (m.chain) s.chain = m.chain;
    if (m.energyOnHit) s.energyOnHit = m.energyOnHit;
  }
  const st = item.stats, up = upMult(item);
  s.damage *= 1 + (st.w_dmg || 0) * up + item.up * 0.03;
  s.mag *= 1 + (st.w_mag || 0) * up + (mods.magSize || 0);
  s.reload /= 1 + (st.w_reload || 0) * up + (mods.reloadSpeed || 0) + (classId === 'bulwark' && def.family === 'lmg' ? 0.25 : 0);
  recoil *= Math.max(0.3, 1 - (st.w_recoil || 0) * up - (mods.recoil || 0));
  s.headMult *= 1 + (st.w_head || 0) * up + (classId === 'wraith' && (def.family === 'sniper' || def.family === 'smg') ? 0.12 : 0);
  range *= 1 + (st.w_range || 0) * up;
  s.rpm *= 1 + (st.w_rpm || 0) * up;
  if (classId === 'vanguard' && def.family === 'ar') s.damage *= 1.08;
  s.adsTime /= 1 + (mods.adsSpeed || 0);
  s.recoilV *= recoil; s.recoilH *= recoil;
  s.rangeStart *= range; s.rangeEnd *= range;
  s.mag = Math.max(1, Math.round(s.mag));
  return s;
}

export interface XpResult { levels: number; unlocked: Item[] }

/** Ajoute de l'expérience ; gère les montées de niveau et les déblocages d'armes. */
export function addXp(p: Profile, amount: number): XpResult {
  const res: XpResult = { levels: 0, unlocked: [] };
  if (p.level >= MAX_LEVEL) return res;
  p.xp += Math.round(amount);
  while (p.level < MAX_LEVEL && p.xp >= xpForLevel(p.level)) {
    p.xp -= xpForLevel(p.level);
    p.level++;
    res.levels++;
    for (const id of Object.keys(WEAPONS)) {
      if (WEAPONS[id].unlockLevel === p.level && !p.inventory.some((i) => i.base === id)) {
        const it = makeWeaponItem(id, 'common', p.level);
        p.inventory.push(it);
        res.unlocked.push(it);
      }
    }
  }
  if (p.level >= MAX_LEVEL) p.xp = 0;
  return res;
}
