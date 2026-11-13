// Interfaces : menu principal, sélection de classe, pause, mort, résultats, paramètres, carte, cinématiques.
import './styles.css';
import * as THREE from 'three';
import type { Game, ResultsData } from '../core/Game';
import { HUD } from './HUD';
import { CLASSES, CLASS_ORDER, type ClassId } from '../data/classes';
import { WEAPONS, FAMILY_LABEL } from '../data/weapons';
import { DIFFICULTIES } from '../data/enemies';
import { ACTIONS, defaultBinds, newProfile } from '../save/Save';
import { bindLabel } from '../core/Input';
import { RARITY, formatStat, KIND_LABEL, LEGENDS, type Item } from '../rpg/items';
import { buildWeaponModel } from '../player/WeaponModels';
import { Panels } from './Panels';
import { icon } from './Icons';

export function esc(s: string): string { return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!)); }

export function fmtTime(t: number): string { const s = Math.floor(t); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; }

/** Icône vectorielle d'un objet selon son type. */
export function itemIcon(it: Item): string {
  const c = RARITY[it.rarity].color;
  const wrap = (p: string) => `<svg viewBox="0 0 64 64" fill="none" stroke="${c}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round">${p}</svg>`;
  if (it.kind === 'weapon') {
    const f = WEAPONS[it.base].family;
    if (f === 'pistol') return wrap(`<path d="M10 24h40v8H30l-2 6h-8l-3 16h-9l4-22z" fill="${c}22"/>`);
    if (f === 'smg') return wrap(`<path d="M6 26h42v7H36v14h-6V33H20l-3 10h-7l3-10H6z" fill="${c}22"/><path d="M48 29h10"/>`);
    if (f === 'lmg') return wrap(`<path d="M4 25h40v8H32v9H20v-9h-6l-4 10H4l3-10z" fill="${c}22"/><path d="M44 29h16M52 33l-4 12M56 33l4 12"/>`);
    if (f === 'sniper') return wrap(`<path d="M2 28h36v6H22l-3 8h-6l2-8H2z" fill="${c}22"/><path d="M38 31h24M12 22h20v-3H12z"/>`);
    return wrap(`<path d="M4 26h38v7H30l-2 12h-6l1-12h-7l-3 10H7l3-10H4z" fill="${c}22"/><path d="M42 29h18M20 22h10"/>`);
  }
  if (it.kind === 'armor') return wrap(`<path d="M32 6l20 7v16c0 14-9 23-20 29C21 52 12 43 12 29V13z" fill="${c}22"/><path d="M32 16v32M22 26h20"/>`);
  if (it.kind === 'module') return wrap(`<circle cx="32" cy="32" r="12" fill="${c}22"/><path d="M32 6v14M32 44v14M6 32h14M44 32h14M14 14l9 9M41 41l9 9M50 14l-9 9M23 41l-9 9"/>`);
  return wrap(`<path d="M32 4l14 22-14 34-14-34z" fill="${c}22"/><path d="M18 26h28M32 4v56"/>`);
}

export function itemCard(it: Item): string {
  const R = RARITY[it.rarity];
  const stats = Object.keys(it.stats).map((k) => `<div class="affix">${formatStat(k, it.stats[k] * (1 + it.up * 0.08))}</div>`).join('');
  return `<div class="loot-card" style="border-color:${R.color}"><b style="color:${R.color}">${esc(it.name)}${it.up ? ' +' + it.up : ''}</b><span class="label">${R.name} · ${KIND_LABEL[it.kind]} · Niv. ${it.ilvl}</span>${stats}${it.legend ? `<div class="legend"><b>${LEGENDS[it.legend].name}</b>${LEGENDS[it.legend].desc}</div>` : ''}</div>`;
}

type Handler = (v: string, el: HTMLElement, ev: Event) => void;

export class UI {
  hud: HUD;
  blocking = false;
  root: HTMLElement;
  screen: HTMLElement;
  panels: Panels;
  private fadeEl: HTMLElement;
  private cineEl: HTMLElement;
  private handlers: Record<string, Handler> = {};
  current = '';
  private cineSkip: (() => void) | null = null;
  private previewCache = new Map<string, string>();
  private mapT = 0;
  private selClass: ClassId = 'vanguard';
  private settingsBack: (() => void) | null = null;

  constructor(public g: Game) {
    this.root = document.getElementById('ui')!;
    this.hud = new HUD(g, this.root);
    this.screen = document.createElement('div'); this.screen.className = 'screen hidden'; this.root.appendChild(this.screen);
    this.cineEl = document.createElement('div'); this.cineEl.id = 'cine'; this.cineEl.className = 'hidden'; this.root.appendChild(this.cineEl);
    this.fadeEl = document.createElement('div'); this.fadeEl.id = 'fade'; this.root.appendChild(this.fadeEl);
    this.panels = new Panels(this);
    const dispatch = (ev: Event, type: string) => {
      let t = ev.target as HTMLElement | null;
      while (t && t !== this.screen) {
        const a = t.getAttribute?.(type);
        if (a && this.handlers[a]) { if (type === 'data-a') this.g.audio.uiClick(); this.handlers[a](t.getAttribute('data-v') || '', t, ev); return; }
        t = t.parentElement;
      }
    };
    this.screen.addEventListener('click', (ev) => { this.g.audio.init(); dispatch(ev, 'data-a'); });
    this.screen.addEventListener('input', (ev) => dispatch(ev, 'data-i'));
    this.screen.addEventListener('change', (ev) => dispatch(ev, 'data-c'));
    this.screen.addEventListener('mouseover', (ev) => { const t = ev.target as HTMLElement; if (t.classList?.contains('btn') || t.classList?.contains('item')) this.g.audio.uiHover(); });
    this.cineEl.addEventListener('click', () => { this.g.audio.init(); });
    window.addEventListener('keydown', (e) => { if ((e.code === 'Space' || e.code === 'Enter') && this.cineSkip && !this.cineEl.classList.contains('hidden')) { const s = this.cineSkip; this.cineSkip = null; s(); } });
    // un clic sur le jeu reprend le contrôle de la souris
    g.r.canvas.addEventListener('click', () => { this.g.audio.init(); if (this.g.state === 'play' && !this.blocking && !this.g.paused) this.g.input.lock(); });
  }

  /** Affiche un écran HTML et enregistre ses gestionnaires d'actions. */
  show(name: string, cls: string, html: string, handlers: Record<string, Handler>, block = true): void {
    this.current = name;
    this.screen.className = 'screen ' + cls;
    this.screen.id = name;
    this.screen.innerHTML = html;
    this.handlers = handlers;
    this.blocking = block;
    if (block) this.g.input.unlock();
  }

  closeAll(): void {
    this.current = '';
    this.screen.className = 'screen hidden';
    this.screen.innerHTML = '';
    this.handlers = {};
    this.blocking = false;
    this.g.paused = false;
  }

  /** Ferme le panneau courant et rend la main au joueur. */
  resume(): void {
    this.closeAll();
    if (this.g.state === 'play') this.g.input.lock();
  }

  fade(fn: () => void): void {
    this.fadeEl.classList.add('on');
    setTimeout(() => { try { fn(); } finally { setTimeout(() => this.fadeEl.classList.remove('on'), 120); } }, this.g.testMode ? 20 : 380);
  }

  settingsChanged(): void { if (this.g.player.cls) this.hud.rebuild(); }

  onEscape(): void {
    const g = this.g;
    if (g.state === 'cinematic' || !this.cineEl.classList.contains('hidden')) { if (this.cineSkip) { const s = this.cineSkip; this.cineSkip = null; s(); } return; }
    if (g.state === 'play') {
      if (this.current === 'settings' && this.settingsBack) { this.settingsBack(); return; }
      if (this.blocking) { if (this.current !== 'intermission') this.resume(); }
      else this.showPause();
    } else if (g.state === 'menu') { if (this.current !== 'menu') this.showMenu(); }
  }

  update(dt: number): void {
    const g = this.g;
    if (g.state === 'play' || g.state === 'dead') {
      if (!this.hud.root.classList.contains('hidden')) this.hud.update(dt);
      if (g.state === 'play') {
        if (g.input.rawPressed('inventory')) { if (this.current === 'character') this.resume(); else if (!this.blocking) this.panels.character(); }
        if (g.input.rawPressed('map')) { if (this.current === 'map') this.resume(); else if (!this.blocking) this.showMap(); }
      }
      if (this.current === 'map') { this.mapT -= dt; if (this.mapT <= 0) { this.mapT = 0.25; this.drawMap(); } }
    }
  }

  // ---------- chargement ----------

  showLoading(k: number, label: string): void {
    if (this.current !== 'loading') this.show('loading', 'overlay', `<div class="loading"><div class="logo" style="font-size:clamp(48px,7vw,104px)">WARBOUND</div><div class="logo-sub">The Fracture Chronicles</div><div class="load-bar"><i></i></div><div class="label load-txt">Chargement des assets</div></div>`, {}, true);
    const bar = this.screen.querySelector('.load-bar i') as HTMLElement | null, txt = this.screen.querySelector('.load-txt') as HTMLElement | null;
    if (bar) bar.style.width = `${Math.round(k * 100)}%`;
    if (txt) txt.textContent = k >= 1 ? 'Prêt' : `Chargement des assets — ${Math.round(k * 100)} %`;
    void label;
  }

  // ---------- menu principal ----------

  showMenu(): void {
    const g = this.g, p = g.profile;
    const info = p ? `<div class="save-info">Sauvegarde : <b>${esc(p.name)}</b> — ${CLASSES[p.classId].name} niveau ${p.level}<br>Opérations accomplies : <b>${Object.keys(p.missions).length} / 4</b>${p.campaignDone ? ' · Campagne terminée' : ''}</div>` : g.store.corrupted ? '<div class="save-info bad">La sauvegarde précédente était corrompue et n’a pas pu être récupérée.</div>' : '<div class="save-info">Aucune sauvegarde. Créez votre opérateur pour commencer.</div>';
    this.show('menu', '', `
      <div class="logo">WARBOUND</div><div class="logo-sub">The Fracture Chronicles</div>
      <div class="menu-list">
        <button class="btn ${p ? '' : 'primary'}" data-a="new">Nouvelle partie</button>
        <button class="btn ${p ? 'primary' : ''}" data-a="continue" ${p ? '' : 'disabled'}>Continuer</button>
        <button class="btn" data-a="classes">Sélection du personnage</button>
        <button class="btn" data-a="settings">Paramètres</button>
        <button class="btn" data-a="credits">Crédits</button>
        <button class="btn" data-a="quit">Quitter</button>
      </div>${info}
      <div class="menu-foot"><span>COALITION AEGIS — UNITÉ WARBOUND — 2037</span><span>v2.2.2</span></div>`, {
      new: () => { if (g.profile) this.confirm('Créer un nouvel opérateur ?', 'La sauvegarde actuelle sera <b>définitivement supprimée</b> lors de la création du nouveau personnage.', () => this.showClassSelect(true), () => this.showMenu()); else this.showClassSelect(true); },
      continue: () => { if (g.profile) g.startHub(); },
      classes: () => this.showClassSelect(false),
      settings: () => this.showSettings(() => this.showMenu()),
      credits: () => this.showCredits(() => this.showMenu()),
      quit: () => { window.close(); this.show('quit', 'overlay', `<div class="panel narrow"><div class="panel-head"><h2>À bientôt, Warbound</h2></div><div class="panel-body col"><p class="brief">Votre progression est sauvegardée. Vous pouvez fermer cet onglet du navigateur.</p></div><div class="panel-foot"><button class="btn" data-a="back">Retour au menu</button></div></div>`, { back: () => this.showMenu() }); },
    });
  }

  confirm(title: string, html: string, yes: () => void, no: () => void): void {
    this.show('confirm', 'overlay', `<div class="panel narrow"><div class="panel-head"><h2>${title}</h2></div><div class="panel-body col"><p class="brief">${html}</p></div><div class="panel-foot"><button class="btn danger" data-a="yes">Confirmer</button><button class="btn" data-a="no">Annuler</button></div></div>`, { yes, no });
  }

  // ---------- sélection de classe ----------

  showClassSelect(create: boolean): void {
    const g = this.g;
    g.cine.showOperator(this.selClass);
    const render = () => {
      const c = CLASSES[this.selClass];
      const pips = (n: number) => `<span class="pips" style="color:${c.css}">${[1, 2, 3, 4, 5].map((i) => `<i class="${i <= n ? 'on' : ''}"></i>`).join('')}</span>`;
      const sk = [...c.skills, c.ult].map((s, i) => `<div class="skill-row"><div class="skill-ico" style="color:${s.color};border-color:${s.color}">${icon(s.id, 22)}</div><div><b>${s.name}</b>${i === 3 ? ' <span class="label" style="color:#ffd24a">Ultime</span>' : ` <span class="label">${s.cost} énergie · ${s.cd}s</span>`}<br><span style="color:#9aa8b8">${s.desc}</span></div></div>`).join('');
      this.show('classsel', '', `
        <div class="class-top"><h2 style="font-size:30px">${create ? 'Création de l’opérateur' : 'Classes de l’unité Warbound'}</h2><div class="label" style="margin-top:6px">Choisissez votre spécialisation — six classes, six façons de combattre</div></div>
        <div class="class-info scroll">
          <h2 style="color:${c.css};font-size:30px">${c.name}</h2><div class="label">${c.role}</div>
          <p class="brief" style="margin-top:10px"><i>« ${c.tagline} »</i><br>${c.desc}</p>
          <div class="kv"><span>Dégâts</span>${pips(c.ratings.dps)}</div><div class="kv"><span>Survie</span>${pips(c.ratings.survie)}</div><div class="kv"><span>Mobilité</span>${pips(c.ratings.mobilite)}</div><div class="kv"><span>Contrôle</span>${pips(c.ratings.controle)}</div>
          <div class="kv"><span>Santé / Énergie</span><span>${c.hp} / ${c.energy}</span></div>
          <div class="kv"><span>Arme de départ</span><span>${WEAPONS[c.startPrimary].name}</span></div>
          <div class="kv"><span>Affinité</span><span>${c.preferred.map((f) => FAMILY_LABEL[f as keyof typeof FAMILY_LABEL]).join(', ')}</span></div>
          <div class="label" style="margin:6px 0;color:${c.css}">${c.preferredBonus}</div>
          ${sk}
        </div>
        <div class="row" style="margin-bottom:12px">
          ${create ? `<input type="text" id="opname" maxlength="18" placeholder="Nom de l’opérateur" value="${esc((document.getElementById('opname') as HTMLInputElement)?.value || 'Opérateur')}"><button class="btn primary" data-a="create">Déployer en tant que ${c.name}</button>` : (g.profile ? '' : '<button class="btn primary" data-a="tocreate">Créer mon opérateur</button>')}
          <button class="btn" data-a="back">Retour</button>
        </div>
        <div class="class-cards">${CLASS_ORDER.map((id) => { const k = CLASSES[id]; return `<div class="class-card ${id === this.selClass ? 'on' : ''}" data-a="pick" data-v="${id}" style="border-top-color:${k.css}"><h3 style="color:${k.css}">${k.name}</h3><div class="role">${k.role}</div></div>`; }).join('')}</div>`, {
        pick: (v) => { this.selClass = v as ClassId; g.cine.showOperator(this.selClass); render(); },
        back: () => { g.cine.showOperator(null); this.showMenu(); },
        tocreate: () => this.showClassSelect(true),
        create: () => {
          const name = ((document.getElementById('opname') as HTMLInputElement)?.value || 'Opérateur').trim().slice(0, 18) || 'Opérateur';
          const prof = newProfile(this.selClass, name);
          void g.store.deleteProfile().then(() => g.store.saveProfile(prof));
          g.profile = prof;
          g.cine.showOperator(null);
          this.closeAll();
          g.cine.playIntro(() => { prof.introSeen = true; g.startHub(); });
        },
      });
    };
    render();
  }

  // ---------- pause / mort / résultats ----------

  showPause(): void {
    const g = this.g;
    if (g.state !== 'play') return;
    g.paused = true;
    const hub = g.mission?.mode === 'hub';
    const b = g.settings.binds;
    const keys = [['forward', 'Avancer'], ['sprint', 'Sprint (double appui : tactique)'], ['crouch', 'Accroupi / glissade'], ['jump', 'Saut / franchir'], ['reload', 'Recharger'], ['interact', 'Interagir'], ['skill1', 'Compétence 1'], ['skill2', 'Compétence 2'], ['skill3', 'Compétence 3'], ['ult', 'Ultime'], ['grenade', 'Grenade'], ['inventory', 'Personnage'], ['map', 'Carte']]
      .map(([k, l]) => `<div class="kv"><span>${l}</span><span>${bindLabel(b[k])}</span></div>`).join('');
    this.show('pause', 'overlay', `<div class="panel narrow"><div class="panel-head"><h2>Pause</h2><span class="sub">${esc(g.mission?.name || '')}</span></div>
      <div class="panel-body"><div class="col" style="width:240px">
        <button class="btn primary" data-a="resume">Reprendre</button>
        <button class="btn" data-a="char">Personnage</button>
        <button class="btn" data-a="settings">Paramètres</button>
        ${hub ? '<button class="btn" data-a="menu">Menu principal</button>' : '<button class="btn danger" data-a="abandon">Abandonner — retour au QG</button>'}
      </div><div class="col grow"><div class="label">Commandes</div>${keys}<div class="kv"><span>Tir / Visée</span><span>Clic gauche / droit</span></div></div></div></div>`, {
      resume: () => this.resume(),
      char: () => this.panels.character(),
      settings: () => this.showSettings(() => this.showPause()),
      menu: () => { g.save(); this.closeAll(); g.toMenu(); },
      abandon: () => this.confirm('Abandonner la mission ?', 'L’expérience gagnée est conservée, mais le butin de mission sera perdu.', () => { this.closeAll(); g.abandon(); }, () => this.showPause()),
    });
  }

  showDeath(title: string, text: string): void {
    const g = this.g;
    this.show('death', 'overlay', `<div class="panel narrow"><div class="panel-head" style="background:linear-gradient(90deg,rgba(200,40,30,.3),transparent 60%)"><h2>${title}</h2></div>
      <div class="panel-body col"><p class="brief">${text}</p><div class="label">Objectif en cours : ${esc(g.mission?.current?.text || '')}</div></div>
      <div class="panel-foot"><button class="btn primary" data-a="retry">Reprendre au point de contrôle</button><button class="btn danger" data-a="quit">Retour au QG</button></div></div>`, {
      retry: () => g.respawn(),
      quit: () => { this.closeAll(); g.abandon(); },
    });
  }

  showResults(d: ResultsData): void {
    const g = this.g;
    const st = (v: string, l: string) => `<div class="stat-big"><b>${v}</b><span class="label">${l}</span></div>`;
    const lvl = d.levelAfter > d.levelBefore ? `<div class="toast" style="animation:none;color:#ffd24a;margin:6px 0">NIVEAU ${d.levelBefore} → ${d.levelAfter}</div>` : '';
    this.show('results', 'overlay', `<div class="panel"><div class="panel-head"><div><div class="label">${esc(d.subtitle)}</div><h1 class="title-xl" style="color:${d.victory ? '#fff' : '#ff6a5a'}">${d.title}</h1></div></div>
      <div class="panel-body col scroll">
        <div class="results-grid">${st(fmtTime(d.time), 'Temps')}${st(String(d.kills), 'Éliminations')}${st(Math.round(d.accuracy * 100) + ' %', 'Précision')}${st(String(d.headshots), 'Tirs à la tête')}${st(String(d.deaths), 'Morts')}</div>
        ${d.mode === 'survival' ? `<div class="results-grid" style="grid-template-columns:repeat(3,1fr)">${st(String(d.wave), 'Vague atteinte')}${st(String(d.score), 'Score')}${st(d.record ? 'NOUVEAU RECORD' : String(g.profile!.survival.bestScore), d.record ? 'Record personnel' : 'Meilleur score')}</div>` : ''}
        <div class="results-grid" style="grid-template-columns:repeat(3,1fr)">${st('+' + Math.round(d.xp) + ' XP', 'Expérience gagnée')}${st('Niveau ' + d.levelAfter, CLASSES[g.profile!.classId].name)}${st('+' + d.materials, 'Éclats de faille')}</div>
        ${lvl}
        <div class="label">Objets obtenus (${d.items.length})</div>
        <div class="loot-row">${d.items.length ? d.items.map(itemCard).join('') : '<span class="label">Aucun objet</span>'}</div>
      </div>
      <div class="panel-foot">${d.final ? '<button class="btn primary" data-a="credits">Continuer</button>' : `<button class="btn primary" data-a="hub">Retour au QG</button>${d.mode === 'survival' ? '<button class="btn" data-a="again">Relancer le protocole</button>' : ''}`}</div></div>`, {
      hub: () => { this.closeAll(); g.startHub(); },
      again: () => { this.closeAll(); g.startSurvival(); },
      credits: () => this.showCredits(() => { this.closeAll(); g.toMenu(); }, true),
    });
    for (const it of d.items) if (it.rarity === 'legendary') { g.audio.loot(3); break; }
  }

  showCredits(back: () => void, ending = false): void {
    this.show('credits', 'overlay', `<div class="panel narrow"><div class="panel-head"><h2>${ending ? 'WARBOUND — Fin de la campagne' : 'Crédits'}</h2></div><div class="panel-body col scroll credits">
      ${ending ? '<p class="brief">La Fracture de Point Zéro est scellée. Seize autres restent ouvertes.<br>L’unité Warbound reste en alerte : le Protocole Infini et les opérations en difficulté Vétéran vous attendent à Fort Aegis.</p>' : ''}
      <h3>WARBOUND — The Fracture Chronicles</h3>Un FPS / Action-RPG militaire dark fantasy original
      <h3>Conception, programmation, direction artistique, level design, audio</h3>Claude (Anthropic) — création autonome à partir du cahier des charges
      <h3>Modèles et textures libres (CC0)</h3>Quaternius · Poly Haven (Jorge Camacho, James Ray Cock, Amal Kumar, Dario Barresi) · ambientCG — détail dans ASSETS.md
      <h3>Technologies</h3>TypeScript · Three.js (licence MIT) · Vite (licence MIT) · Web Audio API · IndexedDB
      <h3>Ressources</h3>Tous les modèles 3D, textures, effets, sons et musiques sont générés procéduralement par le code du jeu.<br>Aucune ressource externe sous droits n’est utilisée.
      <h3>Remerciements</h3>À vous, opérateur.
      </div><div class="panel-foot"><button class="btn primary" data-a="back">${ending ? 'Retour au menu principal' : 'Retour'}</button></div></div>`, { back });
  }

  // ---------- paramètres ----------

  showSettings(back: () => void): void {
    const g = this.g, s = g.settings;
    this.settingsBack = back;
    const slider = (id: string, label: string, min: number, max: number, step: number, val: number, fmt: (v: number) => string) => `<div class="statline" style="grid-template-columns:190px 1fr 60px"><span>${label}</span><input type="range" data-i="rng" data-v="${id}" min="${min}" max="${max}" step="${step}" value="${val}"><span id="val-${id}">${fmt(val)}</span></div>`;
    const fmts: Record<string, (v: number) => string> = { renderScale: (v) => Math.round(v * 100) + ' %', sens: (v) => v.toFixed(2), fov: (v) => v + '°', volMaster: (v) => Math.round(v * 100) + ' %', volMusic: (v) => Math.round(v * 100) + ' %', volSfx: (v) => Math.round(v * 100) + ' %' };
    const render = () => {
      const q = (id: string, l: string) => `<button class="btn small ${s.quality === id ? 'primary' : ''}" data-a="quality" data-v="${id}">${l}</button>`;
      const binds = ACTIONS.map((a) => `<div class="keybind"><span>${a.label}</span><button class="btn small" data-a="bind" data-v="${a.id}">${bindLabel(s.binds[a.id])}</button></div>`).join('');
      this.show('settings', 'overlay', `<div class="panel"><div class="panel-head"><h2>Paramètres</h2></div><div class="panel-body">
        <div class="col grow scroll">
          <div class="label">Graphismes</div>
          <div class="row"><span style="width:190px;font-size:13px">Qualité graphique</span>${q('low', 'Faible')}${q('medium', 'Moyen')}${q('high', 'Élevé')}</div>
          ${slider('renderScale', 'Échelle de rendu', 0.5, 1.5, 0.05, s.renderScale, fmts.renderScale)}
          ${slider('fov', 'Champ de vision', 70, 120, 1, s.fov, fmts.fov)}
          <div class="row"><span style="width:190px;font-size:13px">Afficher les FPS</span><button class="btn small ${s.showFps ? 'primary' : ''}" data-a="toggle" data-v="showFps">${s.showFps ? 'Oui' : 'Non'}</button></div>
          <div class="row"><span style="width:190px;font-size:13px">Réduire les mouvements de caméra</span><button class="btn small ${s.reduceMotion ? 'primary' : ''}" data-a="toggle" data-v="reduceMotion">${s.reduceMotion ? 'Oui' : 'Non'}</button></div>
          <div class="row"><span style="width:190px;font-size:13px">Plein écran</span><button class="btn small" data-a="fullscreen">Basculer</button></div>
          <div class="label" style="margin-top:10px">Contrôles</div>
          ${slider('sens', 'Sensibilité souris', 0.2, 3, 0.05, s.sens, fmts.sens)}
          <div class="label" style="margin-top:10px">Audio</div>
          ${slider('volMaster', 'Volume principal', 0, 1, 0.05, s.volMaster, fmts.volMaster)}
          ${slider('volMusic', 'Volume musique', 0, 1, 0.05, s.volMusic, fmts.volMusic)}
          ${slider('volSfx', 'Volume effets', 0, 1, 0.05, s.volSfx, fmts.volSfx)}
        </div>
        <div class="col scroll" style="width:400px">
          <div class="label">Touches — cliquez pour réassigner</div>
          <div class="row"><button class="btn small ${s.layout === 'azerty' ? 'primary' : ''}" data-a="layout" data-v="azerty">AZERTY (ZQSD)</button><button class="btn small ${s.layout === 'qwerty' ? 'primary' : ''}" data-a="layout" data-v="qwerty">QWERTY (WASD)</button></div>
          ${binds}
        </div></div>
        <div class="panel-foot"><button class="btn primary" data-a="back">Valider</button><span class="label">Les paramètres sont enregistrés automatiquement</span></div></div>`, {
        quality: (v) => { s.quality = v as any; g.applySettings(); g.saveSettings(); render(); },
        toggle: (v) => { (s as any)[v] = !(s as any)[v]; g.applySettings(); g.saveSettings(); render(); },
        fullscreen: () => { if (document.fullscreenElement) void document.exitFullscreen(); else void document.documentElement.requestFullscreen().then(() => (navigator as any).keyboard?.lock?.().catch(() => undefined)).catch(() => undefined); },
        rng: (v, el) => { const val = parseFloat((el as HTMLInputElement).value); (s as any)[v] = val; const lab = document.getElementById('val-' + v); if (lab) lab.textContent = fmts[v](val); g.applySettings(); g.saveSettings(); },
        layout: (v) => { s.layout = v as any; s.binds = defaultBinds(s.layout); g.input.settings = s; g.applySettings(); g.saveSettings(); render(); },
        bind: (v, el) => {
          el.textContent = 'Appuyez…';
          g.input.captureCb = (tok) => {
            if (tok) {
              // évite les conflits : l'action qui utilisait cette touche récupère l'ancienne
              const prev = s.binds[v];
              for (const a of Object.keys(s.binds)) if (a !== v && s.binds[a] === tok) s.binds[a] = prev;
              s.binds[v] = tok;
              g.applySettings(); g.saveSettings();
            }
            render();
          };
        },
        back: () => { this.settingsBack = null; g.input.captureCb = null; back(); },
      });
    };
    render();
  }

  // ---------- carte et objectifs ----------

  showMap(): void {
    const g = this.g, m = g.mission;
    if (!m || !g.level) return;
    g.paused = true;
    const objs = m.objectives.map((o, i) => `<div class="kv"><span style="color:${i < m.index ? '#5af0a0' : i === m.index ? '#fff' : '#566'}">${i < m.index ? '✔' : i === m.index ? '▶' : '○'} ${esc(o.text)}</span><span>${i === m.index && o.progress ? o.progress() : ''}</span></div>`).join('') || '<p class="brief">Fort Aegis : utilisez les stations pour préparer votre prochaine opération.</p>';
    this.show('map', 'overlay', `<div class="panel"><div class="panel-head"><h2>Carte tactique</h2><span class="sub">${esc(m.name)}</span><span class="spacer"></span><button class="btn small" data-a="close">Fermer</button></div>
      <div class="panel-body"><div style="flex:none"><canvas id="mapcv" width="560" height="620"></canvas></div><div class="col grow scroll"><div class="label">Objectifs</div>${objs}
      <div class="label" style="margin-top:12px">Légende</div><div class="kv"><span style="color:#4ad8ff">◆ Objectif</span><span style="color:#fff">▲ Vous</span></div><div class="kv"><span style="color:#ff5a4a">● Ennemis repérés</span><span></span></div></div></div></div>`, { close: () => this.resume() });
    this.mapT = 0;
  }

  private drawMap(): void {
    const cv = document.getElementById('mapcv') as HTMLCanvasElement | null;
    const g = this.g;
    if (!cv || !g.level) return;
    const x = cv.getContext('2d')!, nav = g.level.world.nav;
    const sc = Math.min(cv.width / nav.w, cv.height / nav.h);
    const ox = (cv.width - nav.w * sc) / 2, oz = (cv.height - nav.h * sc) / 2;
    x.fillStyle = '#06080c'; x.fillRect(0, 0, cv.width, cv.height);
    x.fillStyle = '#1a2230'; x.fillRect(ox, oz, nav.w * sc, nav.h * sc);
    x.fillStyle = '#566278';
    for (let z = 0; z < nav.h; z++) for (let xx = 0; xx < nav.w; xx++) if (nav.blocked[z * nav.w + xx]) x.fillRect(ox + xx * sc, oz + z * sc, sc + 0.5, sc + 0.5);
    const P = (wx: number, wz: number): [number, number] => [ox + (wx - nav.minX) * sc, oz + (wz - nav.minZ) * sc];
    for (const e of g.enemies) if (e.alive && (e.state === 'combat' || e.revealT > 0 || e.markT > 0)) { const [ex, ez] = P(e.pos.x, e.pos.z); x.fillStyle = e.isBoss ? '#ff9a2a' : '#ff5a4a'; x.beginPath(); x.arc(ex, ez, e.isBoss ? 6 : 3, 0, 6.3); x.fill(); }
    const mp = g.mission?.markerPos();
    if (mp) { const [mx, mz] = P(mp.x, mp.z); x.strokeStyle = '#4ad8ff'; x.lineWidth = 2; x.save(); x.translate(mx, mz); x.rotate(Math.PI / 4); x.strokeRect(-6, -6, 12, 12); x.restore(); }
    const [px, pz] = P(g.player.pos.x, g.player.pos.z);
    x.save(); x.translate(px, pz); x.rotate(-g.player.yaw); x.fillStyle = '#fff'; x.beginPath(); x.moveTo(0, -8); x.lineTo(5, 6); x.lineTo(-5, 6); x.closePath(); x.fill(); x.restore();
  }

  // ---------- cinématiques ----------

  cineStart(onSkip: () => void): void {
    this.cineEl.className = '';
    this.cineEl.innerHTML = '<div class="bars"></div><div class="ctitle" style="opacity:0"></div><div class="ctext" style="opacity:0"></div><div class="skip">ESPACE / ÉCHAP — PASSER</div>';
    this.cineSkip = onSkip;
    this.g.input.unlock();
  }
  cineText(text: string): void { const e = this.cineEl.querySelector('.ctext') as HTMLElement | null; if (!e) return; e.style.opacity = '0'; setTimeout(() => { e.innerHTML = text; e.style.opacity = text ? '1' : '0'; }, text ? 350 : 0); }
  cineTitle(html: string): void { const e = this.cineEl.querySelector('.ctitle') as HTMLElement | null; if (!e) return; e.innerHTML = html; e.style.opacity = html ? '1' : '0'; }
  cineEnd(): void { this.cineEl.className = 'hidden'; this.cineEl.innerHTML = ''; this.cineSkip = null; }

  // ---------- aperçu 3D des armes ----------

  weaponPreview(it: Item): string {
    const key = it.base + '|' + JSON.stringify(it.attach || {});
    const cached = this.previewCache.get(key);
    if (cached) return cached;
    const W = 512, H = 224;
    const r = this.g.r.renderer;
    const rt = new THREE.WebGLRenderTarget(W, H);
    const scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight(0xffffff, 0x404858, 2.4));
    const dl = new THREE.DirectionalLight(0xffffff, 3); dl.position.set(1, 2, 3); scene.add(dl);
    const m = buildWeaponModel(WEAPONS[it.base], it.attach || {}, false);
    m.group.rotation.y = Math.PI / 2;
    scene.add(m.group);
    const box = new THREE.Box3().setFromObject(m.group);
    const c = box.getCenter(new THREE.Vector3()), size = box.getSize(new THREE.Vector3());
    const halfW = Math.max(size.x * 0.56, size.y * 0.56 * (W / H));
    const cam = new THREE.OrthographicCamera(-halfW, halfW, halfW * (H / W), -halfW * (H / W), 0.01, 10);
    cam.position.set(c.x + 0.3, c.y + 0.15, 2); cam.lookAt(c);
    const prevTM = r.toneMapping;
    r.toneMapping = THREE.NoToneMapping;
    r.setRenderTarget(rt); r.setClearColor(0x000000, 0); r.clear(); r.render(scene, cam); r.setRenderTarget(null);
    r.toneMapping = prevTM;
    const buf = new Uint8Array(W * H * 4);
    r.readRenderTargetPixels(rt, 0, 0, W, H, buf);
    rt.dispose();
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const ctx = cv.getContext('2d')!, img = ctx.createImageData(W, H);
    for (let y = 0; y < H; y++) for (let xx = 0; xx < W; xx++) {
      const s = ((H - 1 - y) * W + xx) * 4, d = (y * W + xx) * 4;
      for (let k = 0; k < 3; k++) img.data[d + k] = Math.pow(buf[s + k] / 255, 1 / 2.2) * 255;
      img.data[d + 3] = buf[s + 3];
    }
    ctx.putImageData(img, 0, 0);
    const url = cv.toDataURL();
    this.previewCache.set(key, url);
    return url;
  }
}
