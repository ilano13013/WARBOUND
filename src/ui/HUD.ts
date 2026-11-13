// HUD en jeu : santé, énergie, ultime, munitions, compétences, réticule dynamique, objectifs, boss, indicateurs de dégâts.
import { Minimap } from './Minimap';
import { MatchHUD } from './MatchHUD';
import * as THREE from 'three';
import type { Game } from '../core/Game';
import { bindLabel } from '../core/Input';
import { RARITY, type Item } from '../rpg/items';
import { xpForLevel, MAX_LEVEL } from '../rpg/Stats';
import type { Boss } from '../ai/Boss';
import { icon } from './Icons';

const BUFF_LABEL: Record<string, [string, string]> = {
  ember: ['Balles de braise', '#ff7a2a'], aegis: ['Égide', '#ffd27a'], inferno: ['Surcharge infernale', '#ff4a1a'], armor: ['Armure renforcée', '#6ab0ff'],
  colossus: ['Colosse', '#2a7aff'], fortressIn: ['Forteresse', '#4a9aff'], rebirth: ['Renaissance', '#2aff9a'], cloak: ['Camouflage', '#c08aff'],
  overcharge: ['Surcharge arcanique', '#4ad8ff'], hunt: ['Chasse sauvage', '#f0e06a'], adrenaline: ['Adrénaline', '#5af0a0'], slidecharge: ['Élan fantôme', '#ff9a2a'],
};

const _v = new THREE.Vector3();

function el(tag: string, cls = '', parent?: HTMLElement, html = ''): HTMLElement {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html) e.innerHTML = html;
  parent?.appendChild(e);
  return e;
}

export class HUD {
  minimap: Minimap;
  matchHud: MatchHUD;
  root: HTMLElement;
  private cross: HTMLElement; private crossLines: HTMLElement[] = []; private hit: HTMLElement; private hitT = 0;
  private scope: HTMLElement; private hp: HTMLElement; private hpLag: HTMLElement; private sh: HTMLElement; private en: HTMLElement; private xp: HTMLElement;
  private hpTxt: HTMLElement; private lvlTxt: HTMLElement; private ammo: HTMLElement; private wname: HTMLElement; private wother: HTMLElement;
  private skills: { root: HTMLElement; cd: HTMLElement; cdt: HTMLElement }[] = []; private ult!: { root: HTMLElement; cd: HTMLElement; cdt: HTMLElement }; private gren!: HTMLElement;
  private bc: HTMLElement; private objH: HTMLElement; private objT: HTMLElement; private objP: HTMLElement; private feedBox: HTMLElement; private toasts: HTMLElement;
  private radioEl: HTMLElement; private radioT = 0; private promptEl: HTMLElement; private bossEl: HTMLElement; private timerEl: HTMLElement;
  private vignette: HTMLElement; private aura: HTMLElement; private flashEl: HTMLElement; private flashT = 0; private vigT = 0;
  private marker: HTMLElement; private markerTxt: HTMLElement; private buffs: HTMLElement; private bannerEl: HTMLElement; private levelEl: HTMLElement; private fpsEl: HTMLElement; private lowAmmo: HTMLElement;
  private dirs: { el: HTMLElement; t: number; ang: number }[] = [];
  private nums: { el: HTMLElement; t: number; pos: THREE.Vector3; vy: number }[] = [];
  private ebars: { el: HTMLElement; fill: HTMLElement; name: HTMLElement }[] = [];
  private cache: Record<string, string> = {};
  private fireKick = 0;
  private compass!: HTMLElement;
  private clickHint!: HTMLElement;
  private lastPrompt = '';

  constructor(private g: Game, parent: HTMLElement) {
    const r = (this.root = el('div', 'hidden', parent)); r.id = 'hud';
    this.vignette = el('div', '', r); this.vignette.id = 'vignette';
    this.aura = el('div', '', r); this.aura.id = 'aura';
    this.scope = el('div', 'hidden', r); this.scope.id = 'scope';
    this.cross = el('div', '', r); this.cross.id = 'crosshair';
    for (let i = 0; i < 4; i++) this.crossLines.push(el('i', '', this.cross));
    el('i', 'd', this.cross);
    this.hit = el('div', '', r); this.hit.id = 'hitmarker';
    for (let i = 0; i < 4; i++) { const l = el('i', '', this.hit); l.style.transform = `rotate(${45 + i * 90}deg) translateY(-11px)`; l.style.top = '9px'; }
    this.marker = el('div', 'hidden', r, '<i></i><span></span>'); this.marker.id = 'marker'; this.markerTxt = this.marker.querySelector('span')!;
    const bl = el('div', 'hud-bl', r);
    const id = el('div', 'hud-id', bl); this.hpTxt = el('b', '', id); this.lvlTxt = el('span', '', id);
    const hb = el('div', 'hbar', bl); this.hpLag = el('i', 'lag', hb); this.hp = el('i', 'hp', hb); this.sh = el('i', 'sh', hb);
    const eb = el('div', 'hbar en', bl); this.en = el('i', 'en', eb);
    const xb = el('div', 'hbar xp', bl); this.xp = el('i', 'xp', xb);
    this.buffs = el('div', '', r); this.buffs.id = 'buffs';
    const br = el('div', 'hud-br', r); this.ammo = el('div', 'ammo', br); this.wname = el('div', 'wname', br); this.wother = el('div', 'wother', br);
    this.bc = el('div', 'hud-bc', r);
    const tl = el('div', 'hud-tl', r); this.objH = el('div', 'obj-h', tl); this.objT = el('div', 'obj-t', tl); this.objP = el('div', 'obj-p', tl);
    this.minimap = new Minimap(g, r);
    this.matchHud = new MatchHUD(g, r);
    this.feedBox = el('div', 'hud-tr', r);
    this.toasts = el('div', '', r); this.toasts.id = 'toasts';
    this.radioEl = el('div', 'hidden', r); this.radioEl.id = 'radio';
    this.promptEl = el('div', 'hidden', r); this.promptEl.id = 'prompt';
    this.bossEl = el('div', 'hidden', r, '<div class="bn"></div><div class="bs"></div><div class="bb"><i></i><u style="left:33%"></u><u style="left:66%"></u></div><div class="bst"></div>'); this.bossEl.id = 'bossbar';
    this.timerEl = el('div', 'hidden', r); this.timerEl.id = 'timer';
    this.bannerEl = el('div', '', r); this.bannerEl.id = 'banner';
    this.levelEl = el('div', '', r); this.levelEl.id = 'levelup';
    this.fpsEl = el('div', '', r); this.fpsEl.id = 'fps';
    this.lowAmmo = el('div', 'hidden', r); this.lowAmmo.id = 'lowammo';
    this.flashEl = el('div', '', r); this.flashEl.id = 'flash';
    this.compass = el('div', '', r, '<div class="cstrip"></div><div class="cobj"></div><i></i>'); this.compass.id = 'compass';
    const strip = this.compass.firstChild as HTMLElement; const pts = ['N', '·', 'NE', '·', 'E', '·', 'SE', '·', 'S', '·', 'SO', '·', 'O', '·', 'NO', '·'];
    for (let k = -1; k <= 1; k++) pts.forEach((t, j) => { const d = el('span', t.length > 1 || t === 'N' || t === 'E' || t === 'S' || t === 'O' ? 'big' : '', strip, t); d.style.left = `${(k * 16 + j) * 40}px`; });
    this.clickHint = el('div', 'hidden', r, 'CLIQUEZ POUR PRENDRE LE CONTRÔLE'); this.clickHint.id = 'clickhint';
  }

  setVisible(v: boolean): void { this.root.classList.toggle('hidden', !v); }

  reset(): void {
    this.toasts.innerHTML = ''; this.feedBox.innerHTML = '';
    this.radioEl.classList.add('hidden'); this.radioT = 0;
    this.bossEl.classList.add('hidden'); this.timerEl.classList.add('hidden'); this.promptEl.classList.add('hidden'); this.marker.classList.add('hidden');
    for (const d of this.dirs) d.el.remove(); this.dirs.length = 0;
    for (const n of this.nums) n.el.remove(); this.nums.length = 0;
    for (const e of this.ebars) e.el.remove(); this.ebars.length = 0;
    this.objT.textContent = ''; this.objH.textContent = ''; this.objP.textContent = '';
    this.cache = {}; this.vignette.style.opacity = '0'; this.aura.style.opacity = '0'; this.flashEl.style.opacity = '0';
    this.bannerEl.classList.remove('show'); this.levelEl.classList.remove('show');
  }

  /** Reconstruit la barre de compétences (classe, touches). */
  rebuild(): void {
    const p = this.g.player, b = this.g.settings.binds;
    if (!p.cls) return;
    this.bc.innerHTML = ''; this.skills = [];
    const mk = (ic: string, color: string, key: string, cls = '') => {
      const root = el('div', 'skill ' + cls, this.bc, `<span class="ico">${icon(ic, cls.includes('ult') ? 34 : cls.includes('gren') ? 20 : 28)}</span>`); root.style.color = color;
      const cd = el('div', 'cd', root), cdt = el('div', 'cdt', root);
      el('div', 'key', root, bindLabel(key));
      return { root, cd, cdt };
    };
    this.gren = mk('grenade', '#b8c890', b.grenade, 'gren').root;
    p.cls.skills.forEach((s, i) => this.skills.push(mk(s.id, s.color, b['skill' + (i + 1)])));
    this.ult = mk(p.cls.ult.id, p.cls.ult.color, b.ult, 'ult');
    this.cache = {};
  }

  private set(key: string, e: HTMLElement, v: string): void { if (this.cache[key] !== v) { this.cache[key] = v; e.textContent = v; } }
  /** Variable CSS mise à jour seulement si sa valeur change (évite un recalcul de style à chaque image). */
  private prop(key: string, e: HTMLElement, name: string, v: string): void { if (this.cache[key] !== v) { this.cache[key] = v; e.style.setProperty(name, v); } }
  private style(key: string, e: HTMLElement, prop: string, v: string): void { if (this.cache[key] !== v) { this.cache[key] = v; (e.style as any)[prop] = v; } }

  // ---------- événements ----------

  toast(text: string, color = '#fff'): void {
    if (this.toasts.children.length > 3) this.toasts.firstChild?.remove();
    const t = el('div', 'toast', this.toasts, text); t.style.color = color;
    setTimeout(() => t.remove(), 2400);
  }
  pickup(text: string, color: string): void { this.feed(`<span style="color:${color}">${text}</span>`); }
  private feed(html: string): void {
    if (this.feedBox.children.length > 6) this.feedBox.firstChild?.remove();
    const f = el('div', 'feed', this.feedBox, html);
    setTimeout(() => f.remove(), 3200);
  }
  xpFeed(amount: number, label: string): void { this.feed(`${label} <b>+${Math.round(amount)} XP</b>`); }
  lootToast(it: Item): void { this.feed(`<span style="color:${RARITY[it.rarity].color}">◆ ${it.name}</span>`); if (it.rarity === 'legendary') this.toast('BUTIN LÉGENDAIRE', '#ff9a2a'); }
  levelUp(level: number): void {
    this.levelEl.innerHTML = `<b>NIVEAU ${level}</b><span>${level <= MAX_LEVEL ? 'NOUVEAU POINT DE TALENT DISPONIBLE' : ''}</span>`;
    this.levelEl.classList.remove('show'); void this.levelEl.offsetWidth; this.levelEl.classList.add('show');
  }
  banner(title: string, sub: string): void {
    this.bannerEl.innerHTML = `<b>${title}</b><span>${sub}</span>`;
    this.bannerEl.classList.remove('show'); void this.bannerEl.offsetWidth; this.bannerEl.classList.add('show');
  }
  bossIntro(name: string, sub: string): void { this.banner(name.toUpperCase(), sub); }
  objective(text: string, idx: number, total: number): void {
    this.objH.textContent = `OBJECTIF ${idx + 1} / ${total}`; this.objT.textContent = text; this.cache.objP = '';
    this.toast('NOUVEL OBJECTIF', '#4ad8ff');
  }
  radio(who: string, text: string, dur: number): void {
    this.radioEl.innerHTML = `<b>${who}</b>${text}`; this.radioEl.classList.remove('hidden'); this.radioT = dur;
  }
  prompt(text: string | null, k: number, hold = false): void {
    if (!text) { if (this.lastPrompt) { this.promptEl.classList.add('hidden'); this.lastPrompt = ''; } return; }
    const key = text + hold;
    if (this.lastPrompt !== key) {
      this.lastPrompt = key;
      this.promptEl.innerHTML = `<kbd>${bindLabel(this.g.settings.binds.interact)}</kbd>${hold ? 'Maintenir — ' : ''}${text}<div class="hold"></div>`;
      this.promptEl.classList.remove('hidden');
    }
    (this.promptEl.lastChild as HTMLElement).style.width = `${Math.round(k * 100)}%`;
  }
  hitmarker(head: boolean, kill: boolean, blocked = false): void {
    this.hitT = kill ? 0.32 : 0.16;
    const c = kill ? '#ff3a2a' : blocked ? '#8aa0b8' : head ? '#ffd24a' : '#fff';
    this.hit.style.opacity = '1'; this.hit.style.transform = `scale(${kill ? 1.5 : head ? 1.2 : 1})`;
    this.hit.querySelectorAll('i').forEach((i) => ((i as HTMLElement).style.background = c));
  }
  immune(): void { if (!this.cache.imm) { this.cache.imm = '1'; this.toast('INVULNÉRABLE', '#6ad8ff'); setTimeout(() => (this.cache.imm = ''), 1500); } }
  fired(): void { this.fireKick = 1; }
  weaponChanged(): void { this.cache.wname = ''; }
  skillUsed(i: number): void { const s = this.skills[i]; if (s) { s.root.animate([{ transform: 'skewX(-6deg) scale(1.25)' }, { transform: 'skewX(-6deg) scale(1)' }], { duration: 220 }); } }
  ultUsed(name: string, color: string): void { this.toast(name.toUpperCase(), color); this.flash(color + '55'); }
  flash(css: string): void { this.flashEl.style.background = css; this.flashEl.style.opacity = '1'; this.flashT = 0.3; }
  flashHeal(): void { this.flash('rgba(60,255,150,0.18)'); }
  flashShield(): void { this.flash('rgba(255,200,100,0.14)'); }

  damageIndicator(angle: number | null, amount: number): void {
    this.vigT = Math.min(1, this.vigT + 0.35 + amount / 60);
    if (angle === null) return;
    if (this.dirs.length > 5) { this.dirs[0].el.remove(); this.dirs.shift(); }
    const d = el('div', 'dmgdir', this.root, '<i></i>');
    d.style.transform = `rotate(${-angle}rad)`;
    this.dirs.push({ el: d, t: 1.2, ang: angle });
  }

  damageNumber(point: THREE.Vector3, dmg: number, head: boolean, type: string): void {
    if (dmg < 1) return;
    if (this.nums.length > 24) { this.nums[0].el.remove(); this.nums.shift(); }
    const color = head ? '#ffd24a' : type === 'fire' ? '#ff8a3a' : type === 'shock' ? '#7ad8ff' : type === 'arcane' ? '#c08aff' : type === 'explosion' ? '#ffb04a' : '#fff';
    const e = el('div', 'dnum', this.root, String(Math.round(dmg)));
    e.style.color = color; if (head) e.style.fontSize = '21px';
    this.nums.push({ el: e, t: 0.8, pos: point.clone().add(_v.set((Math.random() - 0.5) * 0.4, 0.3, (Math.random() - 0.5) * 0.4)), vy: 1.4 });
  }

  private project(p: THREE.Vector3): { x: number; y: number; front: boolean } {
    _v.copy(p).project(this.g.r.camera);
    return { x: (_v.x * 0.5 + 0.5) * window.innerWidth, y: (-_v.y * 0.5 + 0.5) * window.innerHeight, front: _v.z < 1 };
  }

  // ---------- mise à jour ----------

  update(dt: number): void {
    const g = this.g, p = g.player, w = g.weapons.w;
    if (!p.cls || !w) return;
    this.minimap.update(dt);
    this.matchHud.update();
    this.clickHint.classList.toggle('hidden', g.input.locked || g.state !== 'play' || g.ui.blocking || g.testMode);
    // réticule
    this.fireKick = Math.max(0, this.fireKick - dt * 8);
    const gap = 4 + g.weapons.spreadNow * 7 + this.fireKick * 3;
    const hide = g.weapons.adsK > 0.6 || p.sprinting || p.dead;
    this.style('crossO', this.cross, 'opacity', hide ? '0' : '1');
    const gk = Math.round(gap * 4) / 4;
    if (!hide && this.cache.gap !== String(gk)) {
      this.cache.gap = String(gk);
      const L = 8;
      const c = this.crossLines;
      c[0].style.cssText = `left:${-gk - L}px;top:-1px;width:${L}px;height:2px`;
      c[1].style.cssText = `left:${gk}px;top:-1px;width:${L}px;height:2px`;
      c[2].style.cssText = `left:-1px;top:${-gk - L}px;width:2px;height:${L}px`;
      c[3].style.cssText = `left:-1px;top:${gk}px;width:2px;height:${L}px`;
    }
    if (this.hitT > 0) { this.hitT -= dt; if (this.hitT <= 0) this.hit.style.opacity = '0'; }
    this.scope.classList.toggle('hidden', !g.weapons.scopeOverlay || p.dead);
    // santé / énergie / xp
    const hpK = Math.max(0, p.hp / p.maxHp);
    this.style('hp', this.hp, 'width', `${(hpK * 100).toFixed(1)}%`); this.style('hpl', this.hpLag, 'width', `${(hpK * 100).toFixed(1)}%`);
    this.hp.classList.toggle('low', hpK < 0.3);
    this.style('sh', this.sh, 'width', `${Math.min(100, (p.shield / p.maxHp) * 100).toFixed(1)}%`);
    this.style('en', this.en, 'width', `${((p.energy / p.maxEnergy) * 100).toFixed(1)}%`);
    this.set('hpT', this.hpTxt, `${Math.ceil(p.hp)}${p.shield > 0 ? ' +' + Math.ceil(p.shield) : ''}`);
    const prof = g.profile!;
    this.set('lvl', this.lvlTxt, `${p.cls.name} · NIV ${prof.level}`);
    this.style('xp', this.xp, 'width', prof.level >= MAX_LEVEL ? '100%' : `${((prof.xp / xpForLevel(prof.level)) * 100).toFixed(1)}%`);
    // munitions
    const inf = p.has('colossus') || p.has('inferno');
    const ammoHtml = `${inf ? '∞' : w.ammo}<small> / ${w.reserve}</small>`;
    if (this.cache.ammo !== ammoHtml) { this.cache.ammo = ammoHtml; this.ammo.innerHTML = ammoHtml; }
    this.ammo.classList.toggle('low', w.ammo <= w.st.mag * 0.25 && !inf);
    this.set('wname', this.wname, w.st.item.name);
    const other = g.weapons.slots[1 - g.weapons.cur];
    this.set('woth', this.wother, other ? `${bindLabel(g.settings.binds[g.weapons.cur === 0 ? 'weapon2' : 'weapon1'])} · ${other.st.def.name}  ${other.ammo}/${other.reserve}` : '');
    const la = g.weapons.reloading > 0 ? 'RECHARGEMENT' : w.ammo === 0 && w.reserve === 0 ? 'PLUS DE MUNITIONS' : w.ammo <= w.st.mag * 0.2 && !inf ? `RECHARGER [${bindLabel(g.settings.binds.reload)}]` : '';
    this.set('la', this.lowAmmo, la); this.lowAmmo.classList.toggle('hidden', !la || p.dead);
    // compétences
    for (let i = 0; i < 3; i++) {
      const s = this.skills[i]; if (!s) continue;
      const cd = p.cds[i], k = cd / p.cdMax[i];
      this.prop('cd' + i, s.cd, '--cd', Math.min(1, k).toFixed(2));
      this.set('cdt' + i, s.cdt, cd > 0 ? (cd < 10 ? cd.toFixed(1) : String(Math.ceil(cd))) : '');
      s.root.classList.toggle('noen', cd <= 0 && p.energy < p.cls.skills[i].cost);
      s.root.classList.toggle('act', p.has(p.cls.skills[i].id));
    }
    this.prop('ultcd', this.ult.cd, '--cd', (1 - p.ult / 100).toFixed(2));
    this.set('ultt', this.ult.cdt, p.ult < 100 ? `${Math.floor(p.ult)}%` : '');
    this.ult.root.classList.toggle('ready', p.ult >= 100);
    this.set('gren', this.gren.querySelector('.cdt') as HTMLElement, String(p.grenades));
    this.gren.classList.toggle('noen', p.grenades <= 0);
    // buffs
    let bh = '';
    for (const [k, t] of p.buffs) { const b = BUFF_LABEL[k]; if (b && t > 0) bh += `<div class="buff" style="color:${b[1]};border-color:${b[1]}">${b[0]} ${k === 'fortressIn' ? '' : t.toFixed(0) + 's'}</div>`; }
    if (p.slow > 0) bh += '<div class="buff" style="color:#ff7a6a;border-color:#ff7a6a">Ralenti</div>';
    if (this.cache.buffs !== bh) { this.cache.buffs = bh; this.buffs.innerHTML = bh; }
    // aura d'écran selon les buffs
    const auraC = p.has('cloak') ? 'radial-gradient(ellipse at center, transparent 40%, rgba(120,60,220,0.45) 100%)' : p.has('inferno') ? 'radial-gradient(ellipse at center, transparent 55%, rgba(255,80,20,0.4) 100%)' : p.has('colossus') || p.has('armor') ? 'radial-gradient(ellipse at center, transparent 55%, rgba(40,120,255,0.38) 100%)' : p.has('rebirth') ? 'radial-gradient(ellipse at center, transparent 55%, rgba(40,255,150,0.3) 100%)' : p.has('hunt') ? 'radial-gradient(ellipse at center, transparent 60%, rgba(240,220,90,0.28) 100%)' : p.has('overcharge') || p.has('ember') ? 'radial-gradient(ellipse at center, transparent 65%, rgba(120,200,255,0.2) 100%)' : '';
    if (this.cache.aura !== auraC) { this.cache.aura = auraC; this.aura.style.background = auraC || 'none'; this.aura.style.opacity = auraC ? '1' : '0'; }
    // vignette de dégâts
    this.vigT = Math.max(0, this.vigT - dt * 1.3);
    const low = hpK < 0.3 ? 0.35 + Math.sin(performance.now() / 180) * 0.12 : 0;
    this.style('vig', this.vignette, 'opacity', Math.min(1, Math.max(this.vigT, low, p.dead ? 0.9 : 0)).toFixed(2));
    if (this.flashT > 0) { this.flashT -= dt; this.flashEl.style.opacity = String(Math.max(0, this.flashT / 0.3)); }
    for (let i = this.dirs.length - 1; i >= 0; i--) { const d = this.dirs[i]; d.t -= dt; d.el.style.opacity = String(Math.max(0, d.t)); if (d.t <= 0) { d.el.remove(); this.dirs.splice(i, 1); } }
    // nombres de dégâts
    for (let i = this.nums.length - 1; i >= 0; i--) {
      const n = this.nums[i]; n.t -= dt; n.pos.y += n.vy * dt;
      const s = this.project(n.pos);
      if (n.t <= 0 || !s.front) { n.el.remove(); this.nums.splice(i, 1); continue; }
      n.el.style.transform = `translate(${s.x.toFixed(0)}px,${s.y.toFixed(0)}px)`; n.el.style.opacity = String(Math.min(1, n.t * 2.5));
    }
    // radio
    if (this.radioT > 0) { this.radioT -= dt; if (this.radioT <= 0) this.radioEl.classList.add('hidden'); }
    // objectif, minuteur, marqueur
    const m = g.mission;
    if (m) {
      const o = m.current;
      const prog = o?.progress ? o.progress() : '';
      this.set('objP', this.objP, prog);
      if (m.timer) { this.timerEl.classList.remove('hidden'); const t = Math.ceil(m.timer.t); const h = `${m.timer.label}<b>${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}</b>`; if (this.cache.timer !== h) { this.cache.timer = h; this.timerEl.innerHTML = h; } }
      else this.timerEl.classList.add('hidden');
      const mp = m.markerPos();
      if (mp && !p.dead) {
        _v.set(mp.x, mp.y + 1.6, mp.z);
        const dist = Math.hypot(mp.x - p.pos.x, mp.z - p.pos.z);
        const s = this.project(_v);
        let x = s.x, y = s.y;
        const W = window.innerWidth, H = window.innerHeight, pad = 60;
        if (!s.front) { x = W - x; y = H - pad; }
        x = Math.max(pad, Math.min(W - pad, x)); y = Math.max(pad + 40, Math.min(H - pad - 90, y));
        this.marker.classList.remove('hidden');
        this.marker.style.transform = `translate(${x.toFixed(0)}px,${y.toFixed(0)}px)`;
        this.set('mk', this.markerTxt, `${Math.round(dist)} m`);
      } else this.marker.classList.add('hidden');
      this.updateBoss(m.boss);
    }
    this.updateEliteBars();
    // boussole : 40 px par 22,5°
    const yawDeg = ((-p.yaw * 180) / Math.PI + 360) % 360;
    (this.compass.firstChild as HTMLElement).style.transform = `translateX(${(-yawDeg / 22.5) * 40 - 640 * 0}px)`;
    const mp2 = g.mission?.markerPos();
    const cobj = this.compass.children[1] as HTMLElement;
    if (mp2) {
      const ang = (Math.atan2(mp2.x - p.pos.x, -(mp2.z - p.pos.z)) * 180) / Math.PI;
      let rel = ((ang - yawDeg + 540) % 360) - 180;
      rel = Math.max(-90, Math.min(90, rel));
      cobj.style.display = 'block'; cobj.style.transform = `translateX(${(rel / 22.5) * 40}px)`;
    } else cobj.style.display = 'none';
    if (g.settings.showFps) this.set('fps', this.fpsEl, `${g.fps} FPS · résolution ${g.r.resPct} % · ${g.r.info.calls} appels · ${(g.r.info.tris / 1000).toFixed(0)}k tri`); else this.set('fps', this.fpsEl, '');
  }

  private updateBoss(b: Boss | null): void {
    if (!b || !b.alive) { this.bossEl.classList.add('hidden'); return; }
    this.bossEl.classList.remove('hidden');
    const ch = this.bossEl.children;
    this.set('bn', ch[0] as HTMLElement, b.name); this.set('bs', ch[1] as HTMLElement, `${b.subtitle} — Phase ${b.phase} / ${b.phases}`);
    const fill = ch[2].firstChild as HTMLElement;
    this.style('bhp', fill, 'width', `${((b.hp / b.maxHp) * 100).toFixed(1)}%`);
    fill.classList.toggle('shield', b.shielded);
    this.set('bst', ch[3] as HTMLElement, b.shielded ? 'BOUCLIER ACTIF — INVULNÉRABLE' : b.exposedT > 0 ? 'VULNÉRABLE — DÉGÂTS AMPLIFIÉS' : '');
  }

  private updateEliteBars(): void {
    const g = this.g;
    let n = 0;
    for (const e of g.enemies) {
      if (!e.alive || e.isBoss) continue;
      if (!(e.def.elite && (e.state === 'combat' || e.eliteBarT > 0)) && !(e.markT > 0) && !(e.eliteBarT > 3.5)) continue;
      _v.set(e.pos.x, e.pos.y + e.height + 0.35, e.pos.z);
      if (_v.distanceTo(g.r.camera.position) > 60) continue;
      const s = this.project(_v);
      if (!s.front) continue;
      let b = this.ebars[n];
      if (!b) { const root = el('div', 'ebar', this.root); const fill = el('i', '', root); const name = el('span', '', root); b = { el: root, fill, name }; this.ebars.push(b); }
      b.el.style.display = 'block';
      b.el.style.left = `${s.x.toFixed(0)}px`; b.el.style.top = `${s.y.toFixed(0)}px`;
      b.fill.style.width = `${Math.max(0, (e.hp / e.maxHp) * 100).toFixed(0)}%`;
      b.fill.style.background = e.def.elite ? '#ff8a2a' : '#e04a4a';
      const nm = e.def.elite ? e.name : '';
      if (b.name.textContent !== nm) b.name.textContent = nm;
      n++;
      if (n >= 10) break;
    }
    for (let i = n; i < this.ebars.length; i++) this.ebars[i].el.style.display = 'none';
  }
}
