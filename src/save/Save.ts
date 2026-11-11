// Sauvegarde persistante : IndexedDB (repli localStorage), versionnée et validée.
import { CLASSES, type ClassId } from '../data/classes';
import { WEAPONS } from '../data/weapons';
import type { Difficulty } from '../data/enemies';
import { makeWeaponItem, validateItem, type EquipSlot, type Item } from '../rpg/items';

export const SAVE_VERSION = 3;

export interface Profile {
  version: number;
  id: string;
  name: string;
  classId: ClassId;
  level: number;
  xp: number;
  talents: Record<string, number>;
  inventory: Item[];
  equipped: Record<EquipSlot, string | null>;
  materials: number;
  missions: Record<string, { done: boolean; bestTime: number; difficulty: Difficulty }>;
  difficulty: Difficulty;
  stats: { kills: number; deaths: number; shots: number; hits: number; headshots: number; playtime: number; bossKills: number; missions: number; lootFound: number };
  survival: { bestWave: number; bestScore: number };
  lore: string[];
  campaignDone: boolean;
  introSeen: boolean;
  savedAt: number;
}

export interface Settings {
  version: number;
  quality: 'low' | 'medium' | 'high';
  renderScale: number;
  sens: number;
  fov: number;
  volMaster: number;
  volMusic: number;
  volSfx: number;
  showFps: boolean;
  reduceMotion: boolean;
  layout: 'azerty' | 'qwerty';
  binds: Record<string, string>;
}

export const ACTIONS: { id: string; label: string }[] = [
  { id: 'forward', label: 'Avancer' }, { id: 'back', label: 'Reculer' }, { id: 'left', label: 'Gauche' }, { id: 'right', label: 'Droite' },
  { id: 'sprint', label: 'Sprint (double appui : tactique)' }, { id: 'jump', label: 'Sauter / Franchir' }, { id: 'crouch', label: 'S’accroupir / Glisser' },
  { id: 'reload', label: 'Recharger' }, { id: 'interact', label: 'Interagir' },
  { id: 'weapon1', label: 'Arme principale' }, { id: 'weapon2', label: 'Arme secondaire' },
  { id: 'skill1', label: 'Compétence 1' }, { id: 'skill2', label: 'Compétence 2' }, { id: 'skill3', label: 'Compétence 3' }, { id: 'ult', label: 'Capacité ultime' },
  { id: 'grenade', label: 'Grenade' }, { id: 'inventory', label: 'Inventaire / Personnage' }, { id: 'map', label: 'Carte / Objectifs' },
];

export function defaultBinds(layout: 'azerty' | 'qwerty'): Record<string, string> {
  const az = layout === 'azerty';
  return {
    forward: az ? 'k:z' : 'k:w', back: 'k:s', left: az ? 'k:q' : 'k:a', right: 'k:d',
    sprint: 'c:ShiftLeft', jump: 'c:Space', crouch: 'c:ControlLeft', reload: 'k:r', interact: 'k:f',
    weapon1: 'c:Digit1', weapon2: 'c:Digit2',
    skill1: az ? 'k:a' : 'k:q', skill2: 'k:e', skill3: 'k:c', ult: 'k:x', grenade: 'k:g',
    inventory: 'c:Tab', map: 'k:m',
  };
}

export function defaultSettings(): Settings {
  return {
    version: SAVE_VERSION, quality: 'medium', renderScale: 1, sens: 1, fov: 100, volMaster: 0.8, volMusic: 0.5, volSfx: 0.9,
    showFps: false, reduceMotion: false, layout: 'azerty', binds: defaultBinds('azerty'),
  };
}

export function newProfile(classId: ClassId, name: string): Profile {
  const c = CLASSES[classId];
  const inv: Item[] = [];
  for (const id of Object.keys(WEAPONS)) if (WEAPONS[id].unlockLevel <= 1) inv.push(makeWeaponItem(id, 'common', 1));
  const prim = inv.find((i) => i.base === c.startPrimary)!;
  const sec = inv.find((i) => i.base === c.startSecondary)!;
  prim.attach = { optic: WEAPONS[prim.base].family === 'sniper' ? undefined : 'reflex' };
  return {
    version: SAVE_VERSION, id: 'wb-' + Date.now().toString(36), name: name || 'Opérateur', classId, level: 1, xp: 0, talents: {},
    inventory: inv, equipped: { primary: prim.uid, secondary: sec.uid, armor: null, module: null, artifact: null },
    materials: 0, missions: {}, difficulty: 'soldat',
    stats: { kills: 0, deaths: 0, shots: 0, hits: 0, headshots: 0, playtime: 0, bossKills: 0, missions: 0, lootFound: 0 },
    survival: { bestWave: 0, bestScore: 0 }, lore: [], campaignDone: false, introSeen: false, savedAt: Date.now(),
  };
}

const num = (v: any, d: number, min = -Infinity, max = Infinity): number => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : d;
};

/** Valide et répare un profil chargé. Retourne null si les données sont irrécupérables. */
export function validateProfile(raw: any): Profile | null {
  try {
    if (!raw || typeof raw !== 'object') return null;
    if (!CLASSES[raw.classId as ClassId]) return null;
    const base = newProfile(raw.classId, String(raw.name || 'Opérateur').slice(0, 24));
    const p: Profile = { ...base };
    p.id = typeof raw.id === 'string' ? raw.id : base.id;
    p.level = Math.round(num(raw.level, 1, 1, 20));
    p.xp = Math.round(num(raw.xp, 0, 0));
    p.materials = Math.round(num(raw.materials, 0, 0));
    p.talents = {};
    const valid = new Set(CLASSES[p.classId].trees.flatMap((t) => t.talents.map((x) => x.id)));
    if (raw.talents && typeof raw.talents === 'object') for (const k of Object.keys(raw.talents)) if (valid.has(k)) p.talents[k] = Math.round(num(raw.talents[k], 0, 0, 3));
    // les points dépensés ne peuvent pas dépasser les points acquis
    const spent = Object.values(p.talents).reduce((a, b) => a + b, 0);
    if (spent > p.level - 1) p.talents = {};
    if (Array.isArray(raw.inventory)) {
      const inv = raw.inventory.map(validateItem).filter((x: Item | null): x is Item => !!x);
      if (inv.length) p.inventory = inv.slice(0, 60);
    }
    const has = (uid: any) => typeof uid === 'string' && p.inventory.some((i) => i.uid === uid);
    const eq = raw.equipped || {};
    p.equipped = {
      primary: has(eq.primary) ? eq.primary : null, secondary: has(eq.secondary) ? eq.secondary : null,
      armor: has(eq.armor) ? eq.armor : null, module: has(eq.module) ? eq.module : null, artifact: has(eq.artifact) ? eq.artifact : null,
    };
    // le joueur doit toujours disposer de ses deux armes
    if (!p.equipped.primary) {
      let it = p.inventory.find((i) => i.kind === 'weapon' && WEAPONS[i.base].slot === 'primary');
      if (!it) { it = makeWeaponItem(CLASSES[p.classId].startPrimary, 'common', 1); p.inventory.push(it); }
      p.equipped.primary = it.uid;
    }
    if (!p.equipped.secondary) {
      let it = p.inventory.find((i) => i.kind === 'weapon' && WEAPONS[i.base].slot === 'secondary');
      if (!it) { it = makeWeaponItem('p9', 'common', 1); p.inventory.push(it); }
      p.equipped.secondary = it.uid;
    }
    p.missions = {};
    if (raw.missions && typeof raw.missions === 'object') for (const k of ['op1', 'op2', 'op3', 'op4']) {
      const m = raw.missions[k];
      if (m && m.done) p.missions[k] = { done: true, bestTime: num(m.bestTime, 0, 0), difficulty: ['recrue', 'soldat', 'veteran'].includes(m.difficulty) ? m.difficulty : 'soldat' };
    }
    p.difficulty = ['recrue', 'soldat', 'veteran'].includes(raw.difficulty) ? raw.difficulty : 'soldat';
    const s = raw.stats || {};
    for (const k of Object.keys(p.stats) as (keyof Profile['stats'])[]) p.stats[k] = num(s[k], 0, 0);
    p.survival = { bestWave: Math.round(num(raw.survival?.bestWave, 0, 0)), bestScore: Math.round(num(raw.survival?.bestScore, 0, 0)) };
    p.lore = Array.isArray(raw.lore) ? raw.lore.filter((x: any) => typeof x === 'string').slice(0, 100) : [];
    p.campaignDone = !!raw.campaignDone;
    p.introSeen = !!raw.introSeen;
    p.savedAt = num(raw.savedAt, Date.now());
    p.version = SAVE_VERSION;
    return p;
  } catch {
    return null;
  }
}

export function validateSettings(raw: any): Settings {
  const d = defaultSettings();
  if (!raw || typeof raw !== 'object') return d;
  const s: Settings = { ...d };
  if (['low', 'medium', 'high'].includes(raw.quality)) s.quality = raw.quality;
  s.renderScale = num(raw.renderScale, 1, 0.5, 1.5);
  s.sens = num(raw.sens, 1, 0.1, 4);
  s.fov = num(raw.fov, 100, 70, 120);
  s.volMaster = num(raw.volMaster, 0.8, 0, 1);
  s.volMusic = num(raw.volMusic, 0.5, 0, 1);
  s.volSfx = num(raw.volSfx, 0.9, 0, 1);
  s.showFps = !!raw.showFps;
  s.reduceMotion = !!raw.reduceMotion;
  s.layout = raw.layout === 'qwerty' ? 'qwerty' : 'azerty';
  s.binds = defaultBinds(s.layout);
  if (raw.binds && typeof raw.binds === 'object') for (const a of ACTIONS) if (typeof raw.binds[a.id] === 'string' && /^[kc]:.+/.test(raw.binds[a.id])) s.binds[a.id] = raw.binds[a.id];
  return s;
}

const DB_NAME = 'warbound';
const STORE = 'kv';

/** Petit magasin clé/valeur asynchrone au-dessus d'IndexedDB avec repli localStorage. */
export class SaveStore {
  private db: IDBDatabase | null = null;
  private ready: Promise<void>;
  corrupted = false;

  constructor() {
    this.ready = new Promise((resolve) => {
      try {
        const req = indexedDB.open(DB_NAME, 1);
        req.onupgradeneeded = () => { req.result.createObjectStore(STORE); };
        req.onsuccess = () => { this.db = req.result; resolve(); };
        req.onerror = () => resolve();
        req.onblocked = () => resolve();
      } catch { resolve(); }
    });
  }

  private async get(key: string): Promise<any> {
    await this.ready;
    if (this.db) {
      const v = await new Promise<any>((resolve) => {
        try {
          const r = this.db!.transaction(STORE, 'readonly').objectStore(STORE).get(key);
          r.onsuccess = () => resolve(r.result);
          r.onerror = () => resolve(undefined);
        } catch { resolve(undefined); }
      });
      if (v !== undefined) return v;
    }
    try { const s = localStorage.getItem('warbound:' + key); return s ? JSON.parse(s) : undefined; } catch { return undefined; }
  }

  private async set(key: string, value: any): Promise<void> {
    await this.ready;
    try { localStorage.setItem('warbound:' + key, JSON.stringify(value)); } catch { /* quota */ }
    if (!this.db) return;
    await new Promise<void>((resolve) => {
      try {
        const tx = this.db!.transaction(STORE, 'readwrite');
        tx.objectStore(STORE).put(value, key);
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
        tx.onabort = () => resolve();
      } catch { resolve(); }
    });
  }

  private async del(key: string): Promise<void> {
    await this.ready;
    try { localStorage.removeItem('warbound:' + key); } catch { /* ignore */ }
    if (!this.db) return;
    await new Promise<void>((resolve) => {
      try {
        const tx = this.db!.transaction(STORE, 'readwrite');
        tx.objectStore(STORE).delete(key);
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      } catch { resolve(); }
    });
  }

  async loadProfile(): Promise<Profile | null> {
    const raw = await this.get('profile');
    if (raw === undefined || raw === null) return null;
    const p = validateProfile(raw);
    if (!p) {
      // données corrompues : on tente la copie de secours avant d'abandonner
      const bak = validateProfile(await this.get('profile.bak'));
      this.corrupted = !bak;
      return bak;
    }
    return p;
  }

  async saveProfile(p: Profile): Promise<void> {
    p.savedAt = Date.now();
    const snapshot = JSON.parse(JSON.stringify(p));
    const prev = await this.get('profile');
    if (prev && validateProfile(prev)) await this.set('profile.bak', prev);
    await this.set('profile', snapshot);
  }

  async deleteProfile(): Promise<void> { await this.del('profile'); await this.del('profile.bak'); }
  async loadSettings(): Promise<Settings> { return validateSettings(await this.get('settings')); }
  async saveSettings(s: Settings): Promise<void> { await this.set('settings', JSON.parse(JSON.stringify(s))); }
}
