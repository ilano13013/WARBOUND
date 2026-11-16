// Multijoueur : rang (niveau et XP), choix de la classe et éditeur « Créer une classe ».
// Les classes personnalisées sont enregistrées sur le compte en ligne (repli local sans compte).
import type { UI } from './UI';
import { esc } from './UI';
import { WEAPONS, ATTACHMENTS, type AttachSlot } from '../data/weapons';
import { PRESET_CLASSES, CUSTOM_SLOTS, WEAPON_UNLOCK, ATTACH_UNLOCK, MP_SLOTS, classLevel, attachAllowed, sanitizeClass, mpLevelOf, MP_MAX_LEVEL, type ClassDef } from '../data/mpProgress';
import { makeWeaponItem } from '../rpg/items';
import { weaponStats } from '../rpg/Stats';

const LOCAL_KEY = 'wb-mp-classes', SEL_KEY = 'wb-mp-class';
const SLOT_LABEL: Record<string, string> = { optic: 'Optique', muzzle: 'Bouche', mag: 'Chargeur', grip: 'Poignée' };

export class Classes {
  constructor(private ui: UI) {}
  private get g() { return this.ui.g; }

  /** XP et niveau multijoueur du compte (0 sans compte). */
  get xp(): number { return this.g.account.me?.mp?.xp || 0; }
  get level(): number { return mpLevelOf(this.xp).level; }

  /** Les 5 classes personnalisées (compte, sinon stockage local), complétées par défaut. */
  custom(): ClassDef[] {
    let raw: unknown[] = this.g.account.me?.mp?.classes || [];
    if (!this.g.account.me) { try { raw = JSON.parse(localStorage.getItem(LOCAL_KEY) || '[]'); } catch { raw = []; } }
    const out: ClassDef[] = [];
    for (let i = 0; i < CUSTOM_SLOTS; i++) out.push(sanitizeClass(raw[i], { ...PRESET_CLASSES[0], name: `Classe ${i + 1}` }));
    return out;
  }
  async saveCustom(list: ClassDef[]): Promise<void> {
    if (this.g.account.me) await this.g.account.saveClasses(list);
    else { try { localStorage.setItem(LOCAL_KEY, JSON.stringify(list)); } catch { /* */ } }
  }

  /** Toutes les classes jouables : prédéfinies puis personnalisées. */
  all(): { c: ClassDef; key: string; preset: boolean; locked: boolean; need: number }[] {
    const lv = this.level;
    return [
      ...PRESET_CLASSES.map((c, i) => ({ c, key: `p${i}`, preset: true, need: classLevel(c), locked: classLevel(c) > lv })),
      ...this.custom().map((c, i) => ({ c, key: `c${i}`, preset: false, need: classLevel(c), locked: classLevel(c) > lv })),
    ];
  }

  /** Classe sélectionnée (mémorisée), ou la première disponible. */
  selected(): ClassDef {
    let key = 'p0';
    try { key = localStorage.getItem(SEL_KEY) || 'p0'; } catch { /* */ }
    const all = this.all();
    return (all.find((x) => x.key === key && !x.locked) || all[0]).c;
  }
  selectedKey(): string { try { return localStorage.getItem(SEL_KEY) || 'p0'; } catch { return 'p0'; } }
  select(key: string): ClassDef | null {
    const x = this.all().find((e) => e.key === key);
    if (!x || x.locked) return null;
    try { localStorage.setItem(SEL_KEY, key); } catch { /* */ }
    this.g.match.cls = x.c;
    return x.c;
  }

  /** Bandeau de rang (niveau et barre d'XP). */
  rankHtml(): string {
    const r = mpLevelOf(this.xp);
    const pct = r.need ? Math.round((r.into / r.need) * 100) : 100;
    return `<div class="mp-rank"><b>Niveau ${r.level}</b><div class="mp-bar"><i style="width:${pct}%"></i></div><span class="label">${r.level >= MP_MAX_LEVEL ? 'Niveau maximal' : `${r.into} / ${r.need} XP`}</span></div>`;
  }

  /** Boutons de choix de classe (salon, pause). */
  pickerHtml(): string {
    const sel = this.selectedKey();
    return `<div class="class-pick">${this.all().map((x) => `<button class="btn small ${x.key === sel && !x.locked ? 'primary' : ''}" data-a="pickclass" data-v="${x.key}" ${x.locked ? 'disabled' : ''} title="${esc(WEAPONS[x.c.primary]?.name || '')} + ${esc(WEAPONS[x.c.secondary]?.name || '')}">${esc(x.c.name)}${x.locked ? ` — niv. ${x.need}` : ''}</button>`).join('')}</div>`;
  }

  /** Choix de classe pendant une partie (prochaine apparition). */
  showPicker(back: () => void): void {
    this.ui.show('classpick', 'overlay', `<div class="panel narrow"><div class="panel-head"><h2>Changer de classe</h2><span class="sub">Appliquée à votre prochaine apparition</span></div>
      <div class="panel-body col">${this.pickerHtml()}</div>
      <div class="panel-foot"><button class="btn" data-a="back">Retour</button></div></div>`, {
      back,
      pickclass: (v) => { const c = this.select(v); if (c) { this.g.match.setClass(c); back(); } },
    });
  }

  // ---------- éditeur ----------

  showEditor(back: () => void, slot = 0): void {
    const list = this.custom();
    let i = Math.max(0, Math.min(CUSTOM_SLOTS - 1, slot));
    let status = '';
    const lv = this.level;
    const render = () => {
      const c = list[i];
      const prim = Object.values(WEAPONS).filter((w) => w.slot === 'primary').sort((a, b) => (WEAPON_UNLOCK[a.id] ?? 99) - (WEAPON_UNLOCK[b.id] ?? 99));
      const sec = Object.values(WEAPONS).filter((w) => w.slot === 'secondary');
      const wbtn = (id: string, kind: 'primary' | 'secondary') => {
        const need = WEAPON_UNLOCK[id] ?? 99, locked = need > lv, on = (kind === 'primary' ? c.primary : c.secondary) === id;
        return `<button class="btn small ${on ? 'primary' : ''}" data-a="${kind}" data-v="${id}" ${locked ? 'disabled' : ''}>${esc(WEAPONS[id].name)}${locked ? ` — niv. ${need}` : ''}</button>`;
      };
      const slots = MP_SLOTS.map((s) => {
        const opts = Object.values(ATTACHMENTS).filter((a) => attachAllowed(c.primary, s, a.id));
        if (!opts.length) return '';
        return `<div class="kv"><span>${SLOT_LABEL[s]}</span><span class="row" style="gap:4px;flex-wrap:wrap;justify-content:flex-end">
          <button class="btn small ${!c.pAttach[s] ? 'primary' : ''}" data-a="att" data-v="${s}:">Aucun</button>
          ${opts.map((a) => { const need = ATTACH_UNLOCK[a.id] ?? 99, locked = need > lv; return `<button class="btn small ${c.pAttach[s] === a.id ? 'primary' : ''}" data-a="att" data-v="${s}:${a.id}" ${locked ? 'disabled' : ''} title="${esc(a.desc)}">${esc(a.name)}${locked ? ` — niv. ${need}` : ''}</button>`; }).join('')}
        </span></div>`;
      }).join('');
      const item = makeWeaponItem(c.primary, 'common', 1); item.attach = { ...c.pAttach };
      const st = weaponStats(item, {}, 'arcanist');
      const bar = (label: string, v: number, max: number, txt: string) => `<div class="statline" style="grid-template-columns:110px 1fr 70px"><span>${label}</span><div class="mp-bar"><i style="width:${Math.min(100, (v / max) * 100).toFixed(0)}%"></i></div><span>${txt}</span></div>`;
      const stats = bar('Dégâts', st.damage, 160, st.damage.toFixed(0)) + bar('Cadence', st.rpm, 950, `${Math.round(st.rpm)} c/min`) + bar('Portée', st.rangeEnd, 200, `${Math.round(st.rangeEnd)} m`) + bar('Mobilité', st.mobility, 1.05, `${Math.round(st.mobility * 100)} %`) + bar('Chargeur', st.mag, 120, String(st.mag)) + bar('Recul', 6 - st.recoilV, 6, st.recoilV.toFixed(1));
      this.ui.show('classes', 'overlay', `<div class="panel"><div class="panel-head"><h2>Créer une classe</h2><span class="sub">Multijoueur</span><span class="spacer"></span>${this.rankHtml()}<button class="btn small" data-a="back">Retour</button></div>
        <div class="panel-body"><div class="col" style="width:200px">${list.map((x, k) => `<button class="btn small ${k === i ? 'primary' : ''}" data-a="slot" data-v="${k}">${esc(x.name)}</button>`).join('')}
          <p class="label" style="text-transform:none;letter-spacing:.03em">Les armes et accessoires se débloquent en gagnant des niveaux en multijoueur. Tout le monde dispose des mêmes statistiques : aucun talent ni bonus de classe solo.</p></div>
        <div class="col grow scroll">
          <div class="kv"><span>Nom</span><span><input id="cls-name" class="code-input" style="width:220px;font-size:15px;letter-spacing:.05em;text-transform:none" maxlength="18" value="${esc(c.name)}"></span></div>
          <div class="label">Arme principale</div><div class="row" style="gap:5px;flex-wrap:wrap">${prim.map((w) => wbtn(w.id, 'primary')).join('')}</div>
          <div class="label">Accessoires</div>${slots}
          <div class="label">Arme secondaire</div><div class="row" style="gap:5px;flex-wrap:wrap">${sec.map((w) => wbtn(w.id, 'secondary')).join('')}</div>
          <div class="label">Statistiques — ${esc(WEAPONS[c.primary].name)}</div>${stats}
        </div></div>
        <div class="panel-foot"><button class="btn primary" data-a="save">Enregistrer</button><button class="btn" data-a="use">Enregistrer et jouer cette classe</button><span class="label" style="text-transform:none;letter-spacing:.03em">${esc(status)}</span></div></div>`, handlers);
    };
    const readName = () => { const v = (document.getElementById('cls-name') as HTMLInputElement | null)?.value; if (v !== undefined) list[i].name = v.replace(/[<>]/g, '').slice(0, 18) || `Classe ${i + 1}`; };
    const save = async (use: boolean) => {
      readName();
      for (let k = 0; k < list.length; k++) list[k] = sanitizeClass(list[k], list[k]);
      try { await this.saveCustom(list); status = 'Classes enregistrées.'; if (use) this.select(`c${i}`); }
      catch (e) { status = (e as Error).message; }
      render();
    };
    const handlers: Record<string, (v: string) => void> = {
      back,
      slot: (v) => { readName(); i = Number(v) || 0; render(); },
      primary: (v) => { readName(); if ((WEAPON_UNLOCK[v] ?? 99) > lv) return; list[i] = sanitizeClass({ ...list[i], primary: v, pAttach: list[i].pAttach }, list[i]); render(); },
      secondary: (v) => { readName(); if ((WEAPON_UNLOCK[v] ?? 99) > lv) return; list[i].secondary = v; render(); },
      att: (v) => { readName(); const [s, a] = v.split(':') as [AttachSlot, string]; if (a && (ATTACH_UNLOCK[a] ?? 99) > lv) return; if (a) list[i].pAttach[s] = a; else delete list[i].pAttach[s]; render(); },
      save: () => void save(false),
      use: () => void save(true),
    };
    render();
  }
}
