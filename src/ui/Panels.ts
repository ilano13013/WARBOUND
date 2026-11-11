// Panneaux RPG : personnage (équipement, inventaire, talents, statistiques, archives), armurerie, atelier, table tactique, survie.
import type { UI } from './UI';
import { esc, fmtTime, itemIcon } from './UI';
import { CLASSES, talentDesc } from '../data/classes';
import { ATTACHMENTS, ATTACH_SLOTS, FAMILY_LABEL, WEAPONS, type AttachSlot } from '../data/weapons';
import { DIFFICULTIES, type Difficulty } from '../data/enemies';
import { LORE, MISSIONS } from '../data/missions';
import { KIND_LABEL, LEGENDS, MAX_UPGRADE, RARITY, STAT_INFO, formatStat, scrapValue, slotOf, upMult, upgradeCost, type EquipSlot, type Item } from '../rpg/items';
import { canLearn, equippedItem, gatherMods, learnTalent, resetTalents, talentPointsFree, weaponStats, xpForLevel, MAX_LEVEL, type WStats } from '../rpg/Stats';
import { INVENTORY_CAP } from '../core/Game';

const SLOT_LABEL: Record<EquipSlot, string> = { primary: 'Arme principale', secondary: 'Arme secondaire', armor: 'Armure', module: 'Module arcanique', artifact: 'Artefact' };
const SLOTS: EquipSlot[] = ['primary', 'secondary', 'armor', 'module', 'artifact'];

export interface Upgrade { id: string; name: string; desc: string; mods: Record<string, number> }

export class Panels {
  private tab = 'equip';
  private selUid: string | null = null;
  private filter: EquipSlot | 'all' = 'all';
  private selMission = 'op1';
  private armUid: string | null = null;

  constructor(private ui: UI) {}

  private get g() { return this.ui.g; }
  private get inHub(): boolean { return this.g.mission?.mode === 'hub'; }

  /** Applique un changement d'équipement ou de talents au joueur en jeu. */
  private refresh(): void {
    const g = this.g;
    g.player.refreshStats();
    g.applyRunMods();
    g.weapons.rebuild(true);
    g.ui.hud.rebuild();
    g.autosaveSoon();
  }

  private isEquipped(it: Item): boolean { return Object.values(this.g.profile!.equipped).includes(it.uid); }

  private itemDetails(it: Item, compare: Item | null): string {
    const R = RARITY[it.rarity];
    const m = upMult(it);
    let rows = '';
    const keys = new Set([...Object.keys(it.stats), ...(compare ? Object.keys(compare.stats) : [])]);
    for (const k of keys) {
      const v = (it.stats[k] || 0) * m;
      const cv = compare ? (compare.stats[k] || 0) * upMult(compare) : null;
      let delta = '';
      if (cv !== null && compare !== it) { const d = v - cv; if (Math.abs(d) > 0.0005) delta = ` <span class="${d > 0 ? 'good' : 'bad'}">(${d > 0 ? '▲' : '▼'} ${STAT_INFO[k]?.pct ? Math.abs(Math.round(d * 1000) / 10) + ' %' : Math.abs(Math.round(d * 10) / 10)})</span>`; }
      if (v !== 0) rows += `<div class="affix">${formatStat(k, v)}${delta}</div>`;
      else if (cv) rows += `<div class="affix bad">Perd : ${formatStat(k, cv)}</div>`;
    }
    let weapon = '';
    if (it.kind === 'weapon') {
      const d = WEAPONS[it.base];
      weapon = `<div class="label">${FAMILY_LABEL[d.family]}</div><p class="brief" style="font-size:13px">${d.desc}</p>`;
    }
    return `<div class="item-name" style="color:${R.color}">${esc(it.name)}${it.up ? ' +' + it.up : ''}</div>
      <div class="label">${R.name} · ${KIND_LABEL[it.kind]} · Niveau d’objet ${it.ilvl}</div>${weapon}
      <div style="margin:8px 0">${rows || '<span class="label">Équipement standard, sans bonus</span>'}</div>
      ${it.legend ? `<div class="legend"><b>${LEGENDS[it.legend].name}</b> — ${LEGENDS[it.legend].desc}</div>` : ''}
      ${compare && compare !== it ? `<div class="label" style="margin-top:8px">Comparé à : ${esc(compare.name)}</div>` : ''}`;
  }

  // ---------- personnage ----------

  character(tab?: string): void {
    const g = this.g, p = g.profile!;
    if (tab) this.tab = tab;
    g.paused = true;
    const c = CLASSES[p.classId];
    const free = talentPointsFree(p);
    const tabs = [['equip', 'Équipement'], ['talents', `Talents${free ? ` (${free})` : ''}`], ['stats', 'Statistiques'], ['lore', 'Archives']].map(([id, l]) => `<button class="tab ${this.tab === id ? 'on' : ''}" data-a="tab" data-v="${id}">${l}</button>`).join('');
    let body = '';
    if (this.tab === 'equip') body = this.equipBody();
    else if (this.tab === 'talents') body = this.talentsBody();
    else if (this.tab === 'stats') body = this.statsBody();
    else body = this.loreBody();
    this.ui.show('character', 'overlay', `<div class="panel"><div class="panel-head"><h2 style="color:${c.css}">${esc(p.name)}</h2><span class="sub">${c.name} · Niveau ${p.level}${p.level < MAX_LEVEL ? ` · ${p.xp} / ${xpForLevel(p.level)} XP` : ' · Niveau maximum'} · ◈ ${p.materials} éclats</span><span class="spacer"></span><div class="tabs">${tabs}</div><button class="btn small" data-a="close">Fermer</button></div>
      <div class="panel-body">${body}</div></div>`, {
      close: () => this.ui.resume(),
      tab: (v) => this.character(v),
      sel: (v) => { this.selUid = v; this.character(); },
      filter: (v) => { this.filter = v as any; const eq = v !== 'all' ? p.equipped[v as EquipSlot] : null; if (eq) this.selUid = eq; this.character(); },
      equip: (v) => { const it = p.inventory.find((i) => i.uid === v); if (it && this.inHub) { p.equipped[slotOf(it)] = it.uid; this.refresh(); this.character(); } },
      unequip: (v) => { const it = p.inventory.find((i) => i.uid === v); if (it && this.inHub && it.kind !== 'weapon') { p.equipped[slotOf(it)] = null; this.refresh(); this.character(); } },
      scrap: (v) => {
        const it = p.inventory.find((i) => i.uid === v);
        if (!it || this.isEquipped(it)) return;
        const doIt = () => { p.inventory = p.inventory.filter((i) => i.uid !== v); p.materials += scrapValue(it); this.selUid = null; g.audio.pickup(); g.autosaveSoon(); this.character(); };
        if (RARITY[it.rarity].order >= 2) this.ui.confirm('Recycler cet objet ?', `<b style="color:${RARITY[it.rarity].color}">${esc(it.name)}</b> sera détruit contre ${scrapValue(it)} éclats de faille.`, doIt, () => this.character()); else doIt();
      },
      learn: (v) => { if (learnTalent(p, v)) { g.audio.pickup(); this.refresh(); } else g.audio.denied(); this.character(); },
      reset: () => { if (this.inHub) this.ui.confirm('Réinitialiser les talents ?', 'Tous vos points seront remboursés. Gratuit à Fort Aegis.', () => { resetTalents(p); this.refresh(); this.character(); }, () => this.character()); },
      lore: (v) => this.lore(v, () => this.character()),
    });
  }

  private equipBody(): string {
    const p = this.g.profile!;
    const slots = SLOTS.map((s) => { const it = equippedItem(p, s); return `<div class="slot" data-a="filter" data-v="${s}" style="${this.filter === s ? 'border-color:#9a6aff' : ''}"><div class="ico">${it ? itemIcon(it) : ''}</div><div><div class="label">${SLOT_LABEL[s]}</div><div style="color:${it ? RARITY[it.rarity].color : '#566'};font-size:14px">${it ? esc(it.name) + (it.up ? ' +' + it.up : '') : 'Emplacement vide'}</div></div></div>`; }).join('');
    const list = p.inventory.filter((i) => this.filter === 'all' || slotOf(i) === this.filter).sort((a, b) => RARITY[b.rarity].order - RARITY[a.rarity].order || b.ilvl - a.ilvl);
    const items = list.map((it) => `<div class="item ${it.uid === this.selUid ? 'sel' : ''}" data-a="sel" data-v="${it.uid}" title="${esc(it.name)}">${itemIcon(it)}<span class="lv">${it.ilvl}</span>${this.isEquipped(it) ? '<span class="eq">ÉQUIPÉ</span>' : ''}<div class="rar" style="background:${RARITY[it.rarity].color}"></div></div>`).join('');
    const sel = p.inventory.find((i) => i.uid === this.selUid) || null;
    let det = '<p class="brief">Sélectionnez un objet pour afficher ses statistiques et le comparer à votre équipement.</p>';
    if (sel) {
      const eq = equippedItem(p, slotOf(sel));
      const isEq = this.isEquipped(sel);
      det = this.itemDetails(sel, eq) + `<div class="row" style="margin-top:12px;flex-wrap:wrap">
        ${!isEq ? `<button class="btn small primary" data-a="equip" data-v="${sel.uid}" ${this.inHub ? '' : 'disabled'}>Équiper</button>` : sel.kind !== 'weapon' ? `<button class="btn small" data-a="unequip" data-v="${sel.uid}" ${this.inHub ? '' : 'disabled'}>Déséquiper</button>` : '<span class="label">Arme équipée</span>'}
        ${!isEq ? `<button class="btn small danger" data-a="scrap" data-v="${sel.uid}">Recycler (+${scrapValue(sel)} ◈)</button>` : ''}</div>
        ${this.inHub ? '' : '<div class="label" style="margin-top:8px">L’équipement se modifie à Fort Aegis</div>'}`;
    }
    return `<div class="col" style="width:270px"><div class="label">Équipement</div>${slots}<button class="btn small" data-a="filter" data-v="all">Tout l’inventaire</button></div>
      <div class="col grow"><div class="label">Inventaire — ${p.inventory.length} / ${INVENTORY_CAP}${this.filter !== 'all' ? ' · ' + SLOT_LABEL[this.filter] : ''}</div><div class="items scroll" style="flex:1">${items}</div></div>
      <div class="col box scroll" style="width:330px">${det}</div>`;
  }

  private talentsBody(): string {
    const p = this.g.profile!, c = CLASSES[p.classId];
    const free = talentPointsFree(p);
    const tree = (i: number) => {
      const t = c.trees[i];
      return `<div class="tree"><h3 style="color:${c.css}">${t.name}</h3><div class="label">${t.desc}</div>${t.talents.map((tl, k) => {
        const rank = p.talents[tl.id] || 0, can = canLearn(p, tl.id);
        const locked = k > 0 && !(p.talents[t.talents[k - 1].id] > 0);
        return `${k ? '<div class="tree-link"></div>' : ''}<div class="talent ${rank ? 'has' : ''} ${can ? 'can' : ''} ${locked ? 'locked' : ''}" data-a="learn" data-v="${tl.id}"><div class="rank">${rank}/${tl.max}</div><div><div class="tname">${tl.name}</div><div class="tdesc">${talentDesc(tl, Math.min(tl.max, rank + (rank < tl.max ? 1 : 0)))}${rank > 0 && rank < tl.max ? ' <i>(rang suivant)</i>' : ''}${locked ? ' — <i>requiert le talent précédent</i>' : ''}</div></div></div>`;
      }).join('')}</div>`;
    };
    return `<div class="col grow scroll"><div class="row"><div class="grow"><b style="font-size:20px;color:#ffd24a">${free}</b> <span class="label">point(s) de talent disponible(s) — un point par niveau</span></div><button class="btn small" data-a="reset" ${this.inHub ? '' : 'disabled'}>Réinitialiser${this.inHub ? '' : ' (au QG)'}</button></div><div class="row" style="align-items:flex-start;gap:22px">${tree(0)}${tree(1)}</div></div>`;
  }

  private statsBody(): string {
    const g = this.g, p = g.profile!, pl = g.player, c = CLASSES[p.classId];
    const { mods } = gatherMods(p);
    const kv = (a: string, b: string) => `<div class="kv"><span>${a}</span><span>${b}</span></div>`;
    const pct = (k: string) => `${Math.round((mods[k] || 0) * 100)} %`;
    const s = p.stats;
    return `<div class="col grow box scroll"><div class="label">Caractéristiques</div>
      ${kv('Santé maximale', String(pl.maxHp))}${kv('Énergie maximale', String(pl.maxEnergy))}${kv('Réduction des dégâts', pct('dr'))}${kv('Dégâts des armes', '+' + pct('dmg'))}${kv('Dégâts à la tête', '+' + pct('headDmg'))}
      ${kv('Puissance des compétences', '+' + pct('skillPower'))}${kv('Recharge des compétences', '-' + pct('cdr'))}${kv('Régénération d’énergie', '+' + pct('energyRegen'))}${kv('Vitesse de déplacement', '+' + pct('moveSpeed'))}${kv('Charge d’ultime', '+' + pct('ultCharge'))}
      <div class="label" style="margin-top:10px;color:${c.css}">${c.preferredBonus}</div></div>
      <div class="col grow box scroll"><div class="label">Carrière</div>
      ${kv('Éliminations', String(s.kills))}${kv('Tirs à la tête', String(s.headshots))}${kv('Précision', s.shots ? Math.round((s.hits / s.shots) * 100) + ' %' : '—')}${kv('Morts', String(s.deaths))}${kv('Boss vaincus', String(s.bossKills))}
      ${kv('Missions accomplies', String(s.missions))}${kv('Objets trouvés', String(s.lootFound))}${kv('Temps en opération', fmtTime(s.playtime))}${kv('Protocole Infini — meilleure vague', String(p.survival.bestWave))}${kv('Protocole Infini — meilleur score', String(p.survival.bestScore))}
      ${kv('Difficulté', DIFFICULTIES[p.difficulty].name)}${kv('Campagne', p.campaignDone ? 'Terminée' : `${Object.keys(p.missions).length} / 4`)}</div>`;
  }

  private loreBody(): string {
    const p = this.g.profile!;
    const all = Object.values(LORE);
    return `<div class="col grow scroll"><div class="label">Documents découverts — ${p.lore.length} / ${all.length}</div>${all.map((l) => p.lore.includes(l.id) ? `<div class="slot" data-a="lore" data-v="${l.id}"><div><div class="label">${l.kind}</div><div>${esc(l.title)}</div></div></div>` : '<div class="slot" style="opacity:.35;cursor:default"><div><div class="label">Non découvert</div><div>???</div></div></div>').join('')}</div>`;
  }

  lore(id: string, back: () => void): void {
    const l = LORE[id];
    if (!l) return;
    this.g.paused = true;
    this.ui.show('lore', 'overlay', `<div class="panel narrow"><div class="panel-head"><div><div class="label">${l.kind}</div><h2>${esc(l.title)}</h2></div></div><div class="panel-body col scroll"><div class="lore-text">${esc(l.text)}</div></div><div class="panel-foot"><button class="btn primary" data-a="back">Fermer</button></div></div>`, { back });
  }

  /** Découverte d'un document dans un niveau. */
  discover(id: string): void {
    const g = this.g, p = g.profile!;
    if (!p.lore.includes(id)) { p.lore.push(id); g.gainXp(60, 'Document découvert'); g.autosaveSoon(); }
    this.lore(id, () => this.ui.resume());
  }

  // ---------- armurerie ----------

  private statBars(st: WStats, cur: WStats | null): string {
    const rows: [string, number, number | null, string][] = [
      ['Dégâts', st.damage / 160, cur ? cur.damage / 160 : null, st.damage.toFixed(0)],
      ['Cadence', st.rpm / 1200, cur ? cur.rpm / 1200 : null, st.rpm.toFixed(0)],
      ['Portée', st.rangeStart / 100, cur ? cur.rangeStart / 100 : null, st.rangeStart.toFixed(0) + ' m'],
      ['Précision', 1 - st.hipSpread / 7, cur ? 1 - cur.hipSpread / 7 : null, (100 - st.hipSpread * 14).toFixed(0)],
      ['Contrôle', 1 - st.recoilV / 4.5, cur ? 1 - cur.recoilV / 4.5 : null, (100 - st.recoilV * 22).toFixed(0)],
      ['Mobilité', (st.mobility - 0.8) / 0.4, cur ? (cur.mobility - 0.8) / 0.4 : null, Math.round(st.mobility * 100) + ' %'],
      ['Chargeur', st.mag / 110, cur ? cur.mag / 110 : null, String(st.mag)],
      ['Rechargement', 1 - st.reload / 5, cur ? 1 - cur.reload / 5 : null, st.reload.toFixed(1) + ' s'],
    ];
    return rows.map(([l, v, c, t]) => `<div class="statline"><span>${l}</span><div class="bar"><i style="width:${Math.max(3, Math.min(100, v * 100))}%" class="${c !== null && v > c + 0.005 ? 'up' : ''}"></i></div><span class="${c !== null ? (v > c + 0.005 ? 'good' : v < c - 0.005 ? 'bad' : '') : ''}">${t}</span></div>`).join('') + `<div class="kv"><span>Multiplicateur tête</span><span>×${st.headMult.toFixed(2)}</span></div><div class="kv"><span>Mode de tir</span><span>${st.def.auto ? 'Automatique' : 'Coup par coup'}</span></div>`;
  }

  armory(): void {
    const g = this.g, p = g.profile!;
    g.paused = true;
    const weapons = p.inventory.filter((i) => i.kind === 'weapon').sort((a, b) => (WEAPONS[a.base].slot === WEAPONS[b.base].slot ? RARITY[b.rarity].order - RARITY[a.rarity].order : WEAPONS[a.base].slot === 'primary' ? -1 : 1));
    if (!this.armUid || !weapons.some((w) => w.uid === this.armUid)) this.armUid = p.equipped.primary;
    const sel = weapons.find((w) => w.uid === this.armUid)!;
    const def = WEAPONS[sel.base];
    const { mods } = gatherMods(p);
    const st = weaponStats(sel, mods, p.classId);
    const eq = equippedItem(p, def.slot);
    const cur = eq && eq !== sel ? weaponStats(eq, mods, p.classId) : null;
    const list = weapons.map((w) => `<div class="slot" data-a="pick" data-v="${w.uid}" style="${w.uid === sel.uid ? 'border-color:#9a6aff' : ''}"><div class="ico">${itemIcon(w)}</div><div><div style="color:${RARITY[w.rarity].color};font-size:14px">${esc(w.name)}${w.up ? ' +' + w.up : ''}</div><div class="label">${FAMILY_LABEL[WEAPONS[w.base].family]}${Object.values(p.equipped).includes(w.uid) ? ' · <span style="color:#ffd24a">ÉQUIPÉE</span>' : ''}</div></div></div>`).join('');
    const locked = Object.values(WEAPONS).filter((w) => !weapons.some((i) => i.base === w.id)).map((w) => `<div class="slot" style="opacity:.4;cursor:default"><div><div style="font-size:14px">${w.name}</div><div class="label">Débloquée au niveau ${w.unlockLevel}</div></div></div>`).join('');
    const att = def.family === 'pistol' ? ATTACH_SLOTS.filter((s) => s.slot === 'muzzle' || s.slot === 'mag' || s.slot === 'arcane') : ATTACH_SLOTS;
    const attach = att.map(({ slot, label }) => {
      const opts = Object.values(ATTACHMENTS).filter((a) => a.slot === slot && (!a.families || a.families.includes(def.family)));
      const curId = sel.attach?.[slot] || '';
      return `<div class="statline" style="grid-template-columns:90px 1fr"><span>${label}</span><select class="sel" data-c="attach" data-v="${slot}"><option value="">— Aucun —</option>${opts.map((a) => `<option value="${a.id}" ${a.id === curId ? 'selected' : ''} ${a.unlockLevel > p.level ? 'disabled' : ''}>${a.name}${a.unlockLevel > p.level ? ` (niveau ${a.unlockLevel})` : ''}</option>`).join('')}</select></div>${curId ? `<div class="label" style="margin:-2px 0 4px 100px;text-transform:none;letter-spacing:0">${ATTACHMENTS[curId].desc}</div>` : ''}`;
    }).join('');
    this.ui.show('armory', 'overlay', `<div class="panel"><div class="panel-head"><h2>Armurerie</h2><span class="sub">Armes et accessoires</span><span class="spacer"></span><button class="btn small" data-a="close">Fermer</button></div>
      <div class="panel-body"><div class="col scroll" style="width:290px"><div class="label">Vos armes</div>${list}${locked ? '<div class="label" style="margin-top:8px">À débloquer</div>' + locked : ''}</div>
      <div class="col grow scroll"><div class="box" style="text-align:center;background:radial-gradient(ellipse at center,rgba(60,50,110,.35),rgba(10,12,18,.9))"><img src="${this.ui.weaponPreview(sel)}" style="width:100%;max-width:520px;image-rendering:auto" alt=""></div>
        <div class="item-name" style="color:${RARITY[sel.rarity].color}">${esc(sel.name)}${sel.up ? ' +' + sel.up : ''}</div><div class="label">${RARITY[sel.rarity].name} · ${FAMILY_LABEL[def.family]} · ${def.slot === 'primary' ? 'Principale' : 'Secondaire'}</div>
        <p class="brief" style="font-size:13px">${def.desc}</p>
        ${Object.keys(sel.stats).filter((k) => sel.stats[k]).map((k) => `<span class="affix" style="margin-right:14px">${formatStat(k, sel.stats[k] * upMult(sel))}</span>`).join('')}
        ${sel.legend ? `<div class="legend"><b>${LEGENDS[sel.legend].name}</b> — ${LEGENDS[sel.legend].desc}</div>` : ''}
        <div class="row" style="margin-top:8px">${eq === sel ? '<span class="label" style="color:#ffd24a">Arme actuellement équipée</span>' : `<button class="btn primary" data-a="equip">Équiper comme arme ${def.slot === 'primary' ? 'principale' : 'secondaire'}</button>`}</div></div>
      <div class="col scroll" style="width:340px"><div class="label">Statistiques${cur ? ' — comparées à ' + esc(cur.item.name) : ''}</div>${this.statBars(st, cur)}<div class="label" style="margin-top:10px">Accessoires</div>${attach}</div></div></div>`, {
      close: () => this.ui.resume(),
      pick: (v) => { this.armUid = v; this.armory(); },
      equip: () => { p.equipped[def.slot] = sel.uid; this.refresh(); g.audio.swap(); this.armory(); },
      attach: (slot, el) => { const v = (el as HTMLSelectElement).value; sel.attach = sel.attach || {}; if (v) sel.attach[slot as AttachSlot] = v; else delete sel.attach[slot as AttachSlot]; this.refresh(); g.audio.reload(1); this.armory(); },
    });
  }

  // ---------- atelier arcanique ----------

  workshop(): void {
    const g = this.g, p = g.profile!;
    g.paused = true;
    const list = p.inventory.slice().sort((a, b) => Number(this.isEquipped(b)) - Number(this.isEquipped(a)) || RARITY[b.rarity].order - RARITY[a.rarity].order);
    const sel = p.inventory.find((i) => i.uid === this.selUid) || null;
    const items = list.map((it) => `<div class="item ${it.uid === this.selUid ? 'sel' : ''}" data-a="sel" data-v="${it.uid}" title="${esc(it.name)}">${itemIcon(it)}<span class="lv">+${it.up}</span>${this.isEquipped(it) ? '<span class="eq">ÉQUIPÉ</span>' : ''}<div class="rar" style="background:${RARITY[it.rarity].color}"></div></div>`).join('');
    let det = '<p class="brief">Sélectionnez un objet à améliorer. Chaque amélioration renforce ses statistiques de 8 % (et les dégâts des armes de 3 %).<br><br>Les éclats de faille s’obtiennent en recyclant les objets inutiles et en accomplissant des missions.</p>';
    if (sel) {
      const cost = upgradeCost(sel), max = sel.up >= MAX_UPGRADE;
      det = this.itemDetails(sel, null) + `<div class="kv" style="margin-top:10px"><span>Amélioration</span><span>+${sel.up} / +${MAX_UPGRADE}</span></div>
        ${max ? '<div class="label" style="color:#ffd24a">Amélioration maximale atteinte</div>' : `<div class="kv"><span>Coût</span><span class="${p.materials >= cost ? 'good' : 'bad'}">${cost} ◈ (vous : ${p.materials})</span></div><button class="btn primary" data-a="up" ${p.materials >= cost ? '' : 'disabled'} style="margin-top:8px">Améliorer à +${sel.up + 1}</button>`}
        ${!this.isEquipped(sel) ? `<button class="btn small danger" data-a="scrap" style="margin-top:8px">Recycler (+${scrapValue(sel)} ◈)</button>` : ''}`;
    }
    this.ui.show('workshop', 'overlay', `<div class="panel"><div class="panel-head"><h2>Atelier arcanique</h2><span class="sub">◈ ${p.materials} éclats de faille</span><span class="spacer"></span><button class="btn small" data-a="close">Fermer</button></div>
      <div class="panel-body"><div class="col grow"><div class="label">Vos objets</div><div class="items scroll" style="flex:1">${items}</div></div><div class="col box scroll" style="width:380px">${det}</div></div></div>`, {
      close: () => this.ui.resume(),
      sel: (v) => { this.selUid = v; this.workshop(); },
      up: () => { if (sel && sel.up < MAX_UPGRADE && p.materials >= upgradeCost(sel)) { p.materials -= upgradeCost(sel); sel.up++; g.audio.levelUp(); this.refresh(); this.workshop(); } },
      scrap: () => { if (sel && !this.isEquipped(sel)) { p.inventory = p.inventory.filter((i) => i !== sel); p.materials += scrapValue(sel); this.selUid = null; g.audio.pickup(); g.autosaveSoon(); this.workshop(); } },
    });
  }

  // ---------- table tactique ----------

  private diffButtons(): string {
    const p = this.g.profile!;
    return `<div class="diff">${(Object.keys(DIFFICULTIES) as Difficulty[]).map((d) => `<button class="btn small ${p.difficulty === d ? 'on' : ''}" data-a="diff" data-v="${d}">${DIFFICULTIES[d].name}</button>`).join('')}</div><div class="label" style="text-transform:none;letter-spacing:0;margin-top:4px">${DIFFICULTIES[p.difficulty].desc}</div>`;
  }

  missions(): void {
    const g = this.g, p = g.profile!;
    g.paused = true;
    const unlocked = (id: string) => { const m = MISSIONS.find((x) => x.id === id)!; return !m.requires || !!p.missions[m.requires]?.done; };
    if (!unlocked(this.selMission)) this.selMission = g.nextMissionId() || 'op1';
    const sel = MISSIONS.find((m) => m.id === this.selMission)!;
    const cards = MISSIONS.map((m) => { const ok = unlocked(m.id), done = p.missions[m.id]; return `<div class="mission-card ${m.id === sel.id ? 'on' : ''} ${ok ? '' : 'locked'}" data-a="pick" data-v="${m.id}"><div class="label">Opération ${m.num}${done ? ` · <span class="good">Accomplie (${fmtTime(done.bestTime)})</span>` : ok ? '' : ' · Verrouillée'}</div><h3>${m.name}</h3><div class="label" style="text-transform:none;letter-spacing:.03em">${m.location}</div></div>`; }).join('');
    this.ui.show('missions', 'overlay', `<div class="panel"><div class="panel-head"><h2>Table tactique</h2><span class="sub">Sélection de l’opération</span><span class="spacer"></span><button class="btn small" data-a="close">Fermer</button></div>
      <div class="panel-body"><div class="col scroll" style="width:330px">${cards}</div>
      <div class="col grow scroll"><div class="label">Briefing — Commandante Reyes</div><h2 style="font-size:28px">Opération ${sel.num} — ${sel.name}</h2><div class="label">${sel.location} · Durée estimée ${sel.duration} · Niveau conseillé ${sel.level}</div>
        ${sel.briefing.map((b) => `<p class="brief">${b}</p>`).join('')}
        <div class="label">Objectifs</div>${sel.objectives.map((o, i) => `<div class="kv"><span>${i + 1}. ${o}</span><span></span></div>`).join('')}
        ${sel.boss ? `<div class="kv"><span>Menace majeure</span><span style="color:#ff6a5a">${sel.boss}</span></div>` : ''}
        <div class="kv"><span>Récompense</span><span style="color:#ffd24a">${sel.xp} XP + équipement</span></div>
        <div class="label" style="margin-top:10px">Difficulté</div>${this.diffButtons()}</div></div>
      <div class="panel-foot"><button class="btn primary" data-a="launch">Lancer l’opération</button><span class="label">${p.level < sel.level ? `Niveau conseillé : ${sel.level} (vous : ${p.level}) — le Protocole Infini permet de s’entraîner` : ''}</span></div></div>`, {
      close: () => this.ui.resume(),
      pick: (v) => { if (unlocked(v)) { this.selMission = v; this.missions(); } else g.audio.denied(); },
      diff: (v) => { p.difficulty = v as Difficulty; g.autosaveSoon(); this.missions(); },
      launch: () => { this.ui.closeAll(); g.startMission(sel.id); },
    });
  }

  survival(): void {
    const g = this.g, p = g.profile!;
    g.paused = true;
    this.ui.show('survival', 'overlay', `<div class="panel narrow"><div class="panel-head"><h2>Protocole Infini</h2><span class="sub">Simulation de survie</span></div>
      <div class="panel-body col"><p class="brief">Affrontez des vagues d’ennemis de plus en plus dangereuses dans l’arène de simulation. Toutes les deux vagues, choisissez une amélioration temporaire. Un mini-boss apparaît toutes les cinq vagues.</p>
      <p class="brief">Vous pouvez quitter après chaque vague pour encaisser vos récompenses. L’expérience gagnée est conservée dans tous les cas.</p>
      <div class="kv"><span>Meilleure vague</span><span style="color:#ffd24a">${p.survival.bestWave}</span></div><div class="kv"><span>Meilleur score</span><span style="color:#ffd24a">${p.survival.bestScore}</span></div>
      <div class="label" style="margin-top:8px">Difficulté</div>${this.diffButtons()}</div>
      <div class="panel-foot"><button class="btn primary" data-a="launch">Lancer la simulation</button><button class="btn" data-a="close">Fermer</button></div></div>`, {
      close: () => this.ui.resume(),
      diff: (v) => { p.difficulty = v as Difficulty; g.autosaveSoon(); this.survival(); },
      launch: () => { this.ui.closeAll(); g.startSurvival(); },
    });
  }

  /** Entre deux vagues du mode survie : améliorations et choix de continuer ou quitter. */
  intermission(wave: number, score: number, upgrades: Upgrade[] | null, onNext: (u: Upgrade | null) => void, onQuit: () => void): void {
    const g = this.g;
    g.paused = true;
    let chosen: Upgrade | null = null;
    const render = () => {
      this.ui.show('intermission', 'overlay', `<div class="panel narrow" style="width:min(820px,94vw)"><div class="panel-head"><div><div class="label">Protocole Infini</div><h2>Vague ${wave} terminée</h2></div><span class="spacer"></span><span class="sub">Score : ${Math.round(score)}</span></div>
        <div class="panel-body col">${upgrades && !chosen ? `<div class="label">Choisissez une amélioration temporaire</div><div class="row" style="align-items:stretch">${upgrades.map((u, i) => `<div class="upcard" data-a="up" data-v="${i}"><b>${u.name}</b>${u.desc}</div>`).join('')}</div>` : `<p class="brief">${chosen ? `Amélioration acquise : <b style="color:#ffd24a">${chosen.name}</b>. ` : ''}Munitions et grenades réapprovisionnées. La prochaine vague sera plus dangereuse.</p>`}</div>
        <div class="panel-foot"><button class="btn primary" data-a="next" ${upgrades && !chosen ? 'disabled' : ''}>Vague suivante</button><button class="btn" data-a="quit">Quitter et encaisser</button></div></div>`, {
        up: (v) => { chosen = upgrades![Number(v)]; g.audio.levelUp(); render(); },
        next: () => { this.ui.resume(); onNext(chosen); },
        quit: () => { this.ui.closeAll(); onQuit(); },
      });
    };
    render();
  }
}
