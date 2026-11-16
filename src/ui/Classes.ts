// Multijoueur : rang (niveau et XP), choix de la classe et éditeur « Créer une classe ».
// Les classes personnalisées sont enregistrées sur le compte en ligne (repli local sans compte).
import type { UI } from './UI';
import { esc } from './UI';
import { WEAPONS, ATTACHMENTS, FAMILY_LABEL, type AttachSlot } from '../data/weapons';
import { Preview } from './Preview3D';
import { PRESET_CLASSES, CUSTOM_SLOTS, WEAPON_UNLOCK, MP_SLOTS, LETHALS, PERKS, PERK_SLOT_LABEL, classLockReason, attachAllowed, attachLevel, weaponLevelOf, sanitizeClass, mpLevelOf, MP_MAX_LEVEL, type ClassDef } from '../data/mpProgress';
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
  /** XP et niveau d'une arme (compte). */
  weaponXp(id: string): number { return this.g.account.me?.mp?.weapons?.[id] || 0; }
  weaponLevel(id: string): number { return weaponLevelOf(id, this.weaponXp(id)).level; }

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
  all(): { c: ClassDef; key: string; preset: boolean; locked: boolean; why: string }[] {
    const lv = this.level, wl = (id: string) => this.weaponLevel(id);
    const mk = (c: ClassDef, key: string, preset: boolean) => { const why = classLockReason(c, lv, wl); return { c, key, preset, locked: !!why, why }; };
    return [...PRESET_CLASSES.map((c, i) => mk(c, `p${i}`, true)), ...this.custom().map((c, i) => mk(c, `c${i}`, false))];
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
    return `<div class="class-pick">${this.all().map((x) => `<button class="btn small ${x.key === sel && !x.locked ? 'primary' : ''}" data-a="pickclass" data-v="${x.key}" ${x.locked ? 'disabled' : ''} title="${esc(WEAPONS[x.c.primary]?.name || '')} + ${esc(WEAPONS[x.c.secondary]?.name || '')}">${esc(x.c.name)}${x.locked ? ` — ${esc(x.why)}` : ''}</button>`).join('')}</div>`;
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

  // ---------- atelier d'arme (éditeur de classe) ----------

  private preview: Preview | null = null;

  /** Statistiques normalisées (0 à 100) d'une arme équipée de ses accessoires. */
  private stats(id: string, attach: Partial<Record<AttachSlot, string>>): Record<string, number> {
    const item = makeWeaponItem(id, 'common', 1); item.attach = { ...attach };
    const st = weaponStats(item, {}, 'arcanist');
    const c = (v: number) => Math.max(2, Math.min(100, v));
    return {
      'Dégâts': c((st.damage / 160) * 100),
      'Cadence': c((st.rpm / 950) * 100),
      'Précision': c(100 - st.hipSpread * 9 - st.adsSpread * 60),
      'Portée': c((st.rangeEnd / 220) * 100),
      'Mobilité': c(((st.mobility - 0.85) / 0.2) * 100),
      'Contrôle': c(100 - st.recoilV * 14),
    };
  }

  showEditor(back: () => void, slot = 0): void {
    const list = this.custom();
    let i = Math.max(0, Math.min(CUSTOM_SLOTS - 1, slot));
    let status = '';
    let open: 'primary' | 'secondary' | 'lethal' | 'perk0' | 'perk1' | 'perk2' | AttachSlot | null = null;
    const lv = this.level;
    const camo = this.g.account.equipped('camo');
    const prims = Object.values(WEAPONS).filter((w) => w.slot === 'primary').sort((a, b) => (WEAPON_UNLOCK[a.id] ?? 99) - (WEAPON_UNLOCK[b.id] ?? 99));
    // emplacements autour de l'arme : position de la carte et point visé sur l'arme (en % de la scène)
    const POS: Record<string, { card: string; at: [number, number]; from: [number, number] }> = {
      optic: { card: 'left:3%;top:20%', at: [50, 40], from: [22, 25] },
      muzzle: { card: 'left:3%;top:52%', at: [27, 50], from: [22, 57] },
      mag: { card: 'left:36%;bottom:4%', at: [52, 62], from: [48, 88] },
      grip: { card: 'right:3%;bottom:20%', at: [60, 58], from: [78, 74] },
    };
    const disposePreview = () => { this.preview?.dispose(); this.preview = null; };
    const leave = () => { disposePreview(); back(); };

    const render = () => {
      const c = list[i];
      const w = WEAPONS[c.primary];
      const wlv = this.weaponLevel(c.primary);
      const base = this.stats(c.primary, {}), cur = this.stats(c.primary, c.pAttach);
      const statRows = Object.keys(cur).map((k) => {
        const b = base[k], v = cur[k], lo = Math.min(b, v), d = v - b;
        return `<div class="gs-stat"><span>${k}</span><b>${Math.round(v)}</b><div class="gs-bar"><i style="width:${lo}%"></i>${d ? `<u class="${d > 0 ? 'up' : 'down'}" style="left:${lo}%;width:${Math.abs(d)}%"></u>` : ''}</div></div>`;
      }).join('');
      const card = (s: AttachSlot) => {
        const opts = Object.values(ATTACHMENTS).filter((a) => attachAllowed(c.primary, s, a.id));
        if (!opts.length) return '';
        const cur = c.pAttach[s] ? ATTACHMENTS[c.pAttach[s]!].name : 'Aucun';
        return `<div class="gs-card ${open === s ? 'on' : ''} ${c.pAttach[s] ? 'set' : ''}" style="${POS[s].card}" data-a="open" data-v="${s}"><b>${SLOT_LABEL[s].toUpperCase()}</b><span>${esc(cur)}</span></div>`;
      };
      const lines = MP_SLOTS.filter((s) => POS[s] && Object.values(ATTACHMENTS).some((a) => attachAllowed(c.primary, s, a.id)))
        .map((s) => `<line x1="${POS[s].from[0]}" y1="${POS[s].from[1]}" x2="${POS[s].at[0]}" y2="${POS[s].at[1]}"/><circle cx="${POS[s].at[0]}" cy="${POS[s].at[1]}" r="0.7"/>`).join('');
      // liste de choix de l'emplacement ouvert
      let picker = '';
      if (open === 'primary' || open === 'secondary') {
        const pool = Object.values(WEAPONS).filter((x) => x.slot === open).sort((a, b) => (WEAPON_UNLOCK[a.id] ?? 99) - (WEAPON_UNLOCK[b.id] ?? 99));
        picker = pool.map((x) => { const need = WEAPON_UNLOCK[x.id] ?? 99, locked = need > lv, on = (open === 'primary' ? c.primary : c.secondary) === x.id; return `<button class="gs-opt ${on ? 'on' : ''}" data-a="${open}" data-v="${x.id}" ${locked ? 'disabled' : ''}><b>${esc(x.name)}</b><span>${locked ? `🔒 Niveau ${need}` : FAMILY_LABEL[x.family]}</span></button>`; }).join('');
      } else if (open && open !== 'lethal' && !open.startsWith('perk')) {
        const s = open as AttachSlot;
        const opts = Object.values(ATTACHMENTS).filter((a) => attachAllowed(c.primary, s, a.id));
        picker = `<button class="gs-opt ${!c.pAttach[s] ? 'on' : ''}" data-a="att" data-v="${s}:"><b>Aucun</b><span>Retirer</span></button>` + opts.map((a) => {
          const need = attachLevel(c.primary, a.id), locked = need > wlv;
          const delta = this.stats(c.primary, { ...c.pAttach, [s]: a.id });
          const ch = Object.keys(delta).map((k) => [k, Math.round(delta[k] - cur[k])] as [string, number]).filter(([, d]) => d).slice(0, 2).map(([k, d]) => `<em class="${d > 0 ? 'up' : 'down'}">${d > 0 ? '+' : ''}${d} ${k}</em>`).join(' ');
          return `<button class="gs-opt ${c.pAttach[s] === a.id ? 'on' : ''}" data-a="att" data-v="${s}:${a.id}" ${locked ? 'disabled' : ''} title="${esc(a.desc)}"><b>${esc(a.name)}</b><span>${locked ? `🔒 ${esc(w.name)} niv. ${need}` : ch || esc(a.desc)}</span></button>`;
        }).join('');
      } else if (open === 'lethal') {
        picker = `<button class="gs-opt ${!c.lethal ? 'on' : ''}" data-a="lethal" data-v=""><b>Aucun</b><span>Pas d’équipement létal</span></button>` + Object.values(LETHALS).map((l) => {
          const locked = l.unlock > lv;
          return `<button class="gs-opt ${c.lethal === l.id ? 'on' : ''}" data-a="lethal" data-v="${l.id}" ${locked ? 'disabled' : ''}><b>${esc(l.name)}</b><span>${locked ? `🔒 Niveau ${l.unlock}` : esc(l.desc)}</span></button>`;
        }).join('');
      } else if (open) {
        const k = Number(open.slice(4));
        picker = `<button class="gs-opt ${!c.perks[k] ? 'on' : ''}" data-a="perk" data-v="${k}:"><b>Aucun</b><span>Emplacement vide</span></button>` + Object.values(PERKS).filter((x) => x.slot === k).map((x) => {
          const locked = x.unlock > lv;
          return `<button class="gs-opt ${c.perks[k] === x.id ? 'on' : ''}" data-a="perk" data-v="${k}:${x.id}" ${locked ? 'disabled' : ''}><b>${esc(x.name)}</b><span>${locked ? `🔒 Niveau ${x.unlock}` : esc(x.desc)}</span></button>`;
        }).join('');
      }
      const pIdx = prims.findIndex((x) => x.id === c.primary);
      const wr = weaponLevelOf(c.primary, this.weaponXp(c.primary)), wlvPct = wr.need ? Math.round((wr.into / wr.need) * 100) : 100;
      const kitTile = (v: string, label: string, val: string | null) => `<button class="gs-kit-t ${open === v ? 'on' : ''} ${val ? 'set' : ''}" data-a="open" data-v="${v}"><b>${label}</b><span>${esc(val || 'Aucun')}</span></button>`;
      const kit = `<div class="gs-kit">${kitTile('lethal', 'Létal', c.lethal ? LETHALS[c.lethal].name : null)}${[0, 1, 2].map((k) => kitTile(`perk${k}`, PERK_SLOT_LABEL[k], c.perks[k] ? PERKS[c.perks[k]!].name : null)).join('')}</div>`;
      this.ui.show('classes', 'overlay', `<div class="panel gunsmith"><div class="panel-head"><h2>Atelier</h2><span class="sub">${esc(c.name)}</span><span class="spacer"></span>${this.rankHtml()}<button class="btn small" data-a="back">Retour</button></div>
        <div class="gs-body">
          <div class="gs-classes">${list.map((x, k) => `<button class="btn small ${k === i ? 'primary' : ''}" data-a="slot" data-v="${k}">${esc(x.name)}</button>`).join('')}</div>
          <div class="gs-stage">
            <canvas id="gs-canvas"></canvas>
            <svg class="gs-lines" viewBox="0 0 100 100" preserveAspectRatio="none">${lines}</svg>
            <div class="gs-weapon"><button class="gs-arrow" data-a="cycle" data-v="-1">‹</button><div data-a="open" data-v="primary"><b>${esc(w.name)}</b><span>${FAMILY_LABEL[w.family]} — arme niv. ${wr.level}/${wr.max}</span><div class="mp-bar gs-wbar"><i style="width:${wlvPct}%"></i></div></div><button class="gs-arrow" data-a="cycle" data-v="1">›</button></div>
            ${MP_SLOTS.map(card).join('')}
            <div class="gs-card gs-sec ${open === 'secondary' ? 'on' : ''}" data-a="open" data-v="secondary"><b>SECONDAIRE</b><span>${esc(WEAPONS[c.secondary].name)}</span></div>
            <div class="gs-card gs-camo"><b>CAMOUFLAGE</b><span>${camo ? 'Équipé (boutique)' : 'Aucun — voir la Boutique'}</span></div>
            ${open ? `<div class="gs-picker"><div class="gs-picker-head">${open === 'primary' ? 'Arme principale' : open === 'secondary' ? 'Arme secondaire' : open === 'lethal' ? 'Équipement létal' : open.startsWith('perk') ? PERK_SLOT_LABEL[Number(open.slice(4))] : SLOT_LABEL[open]}<button class="btn small" data-a="close">Fermer</button></div><div class="gs-opts">${picker}</div></div>` : ''}
          </div>
          <div class="gs-side">
            <div class="gs-name"><input id="cls-name" maxlength="18" value="${esc(c.name)}" aria-label="Nom de la classe"></div>
            ${kit}
            <div class="label">${esc(w.name)} — ${wr.level >= wr.max ? 'niveau d’arme maximal' : `${wr.into} / ${wr.need} XP d’arme`}</div>
            ${statRows}
            <p class="label" style="text-transform:none;letter-spacing:.03em">Vert : gain des accessoires ; rouge : perte. Statistiques identiques pour tous les joueurs.</p>
            <button class="btn primary gs-equip" data-a="use">Équiper</button>
            <button class="btn" data-a="save">Enregistrer</button>
            <span class="label" style="text-transform:none;letter-spacing:.03em">${esc(status)}</span>
          </div>
        </div></div>`, handlers);
      void pIdx;
      const cv = document.getElementById('gs-canvas') as HTMLCanvasElement | null;
      if (cv) { disposePreview(); this.preview = new Preview(cv); this.preview.showWeapon(camo, c.primary, c.pAttach, false); this.ui.leaveHook = disposePreview; }
    };
    const readName = () => { const v = (document.getElementById('cls-name') as HTMLInputElement | null)?.value; if (v !== undefined) list[i].name = v.replace(/[<>]/g, '').slice(0, 18) || `Classe ${i + 1}`; };
    const save = async (use: boolean) => {
      readName();
      for (let k = 0; k < list.length; k++) list[k] = sanitizeClass(list[k], list[k]);
      try { await this.saveCustom(list); status = use ? 'Classe équipée.' : 'Classes enregistrées.'; if (use) this.select(`c${i}`); }
      catch (e) { status = (e as Error).message; }
      render();
    };
    const setPrimary = (v: string) => {
      if ((WEAPON_UNLOCK[v] ?? 99) > lv) return;
      list[i] = sanitizeClass({ ...list[i], primary: v }, list[i]);
      // accessoires gardés seulement s'ils sont débloqués sur la nouvelle arme
      const wl = this.weaponLevel(v);
      for (const [s, a] of Object.entries(list[i].pAttach)) if (a && attachLevel(v, a) > wl) delete list[i].pAttach[s as AttachSlot];
    };
    const handlers: Record<string, (v: string) => void> = {
      back: leave,
      slot: (v) => { readName(); i = Number(v) || 0; open = null; render(); },
      open: (v) => { readName(); open = open === v ? null : (v as typeof open); render(); },
      close: () => { readName(); open = null; render(); },
      cycle: (v) => {
        readName();
        const unlocked = prims.filter((x) => (WEAPON_UNLOCK[x.id] ?? 99) <= lv);
        const k = unlocked.findIndex((x) => x.id === list[i].primary);
        setPrimary(unlocked[(k + Number(v) + unlocked.length) % unlocked.length].id); render();
      },
      primary: (v) => { readName(); setPrimary(v); open = null; render(); },
      secondary: (v) => { readName(); if ((WEAPON_UNLOCK[v] ?? 99) > lv) return; list[i].secondary = v; open = null; render(); },
      att: (v) => { readName(); const [s, a] = v.split(':') as [AttachSlot, string]; if (a && attachLevel(list[i].primary, a) > this.weaponLevel(list[i].primary)) return; if (a) list[i].pAttach[s] = a; else delete list[i].pAttach[s]; render(); },
      lethal: (v) => { readName(); if (v && (LETHALS[v]?.unlock ?? 99) > lv) return; list[i].lethal = v || null; open = null; render(); },
      perk: (v) => { readName(); const [k, id] = v.split(':'); if (id && (PERKS[id]?.unlock ?? 99) > lv) return; list[i].perks[Number(k)] = id || null; open = null; render(); },
      save: () => void save(false),
      use: () => void save(true),
    };
    render();
  }
}
