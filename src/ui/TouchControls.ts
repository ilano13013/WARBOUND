// Commandes tactiles (téléphone, tablette) : joystick dynamique à gauche, visée en glissant à droite,
// boutons d'action. Les boutons passent par les mêmes actions que le clavier (Input.sim), la logique de jeu
// est donc identique quel que soit l'appareil.
import type { Game } from '../core/Game';

interface Btn { act: string; label: string; cls: string; solo?: boolean; mode: 'hold' | 'tap' | 'toggle' | 'fire' | 'ads' | 'swap' | 'pause' }
const BTNS: Btn[] = [
  { act: 'fire', label: 'TIR', cls: 'tc-fire', mode: 'fire' },
  { act: 'ads', label: 'VISÉE', cls: 'tc-ads', mode: 'ads' },
  { act: 'jump', label: 'SAUT', cls: 'tc-jump', mode: 'hold' },
  { act: 'crouch', label: 'ACCR.', cls: 'tc-crouch', mode: 'toggle' },
  { act: 'reload', label: 'RECH.', cls: 'tc-reload', mode: 'tap' },
  { act: 'interact', label: 'ACTION', cls: 'tc-interact', mode: 'hold' },
  { act: 'swap', label: 'ARME', cls: 'tc-swap', mode: 'swap' },
  { act: 'grenade', label: 'GREN.', cls: 'tc-gren', mode: 'tap', solo: true },
  { act: 'skill1', label: '1', cls: 'tc-s1', mode: 'tap', solo: true },
  { act: 'skill2', label: '2', cls: 'tc-s2', mode: 'tap', solo: true },
  { act: 'skill3', label: '3', cls: 'tc-s3', mode: 'tap', solo: true },
  { act: 'ult', label: 'ULT', cls: 'tc-ult', mode: 'tap', solo: true },
  { act: 'pause', label: 'II', cls: 'tc-pause', mode: 'pause' },
  { act: 'map', label: 'CARTE', cls: 'tc-map', mode: 'tap' },
  { act: 'inventory', label: 'SCORES', cls: 'tc-score', mode: 'hold' },
];
const STICK_R = 62;

type Track = { kind: 'stick'; ox: number; oy: number } | { kind: 'look'; x: number; y: number } | { kind: 'btn'; b: Btn; x: number; y: number };

export class TouchControls {
  root: HTMLElement;
  private stick: HTMLElement; private knob: HTMLElement;
  private els = new Map<string, HTMLElement>();
  private tracks = new Map<number, Track>();
  private crouchOn = false;
  private shown = false;
  /** Dernier texte affiché par bouton (évite de réécrire le DOM à chaque image). */
  private txt = new Map<string, string>();

  constructor(private g: Game, parent: HTMLElement) {
    this.root = document.createElement('div');
    this.root.id = 'touch';
    this.root.className = 'hidden';
    parent.appendChild(this.root);
    this.stick = document.createElement('div'); this.stick.className = 'tc-stick hidden';
    this.knob = document.createElement('div'); this.knob.className = 'tc-knob';
    this.stick.appendChild(this.knob); this.root.appendChild(this.stick);
    for (const b of BTNS) {
      const e = document.createElement('div');
      e.className = `tc-btn ${b.cls}`; e.textContent = b.label; e.dataset.act = b.act;
      this.root.appendChild(e); this.els.set(b.act, e);
    }
    this.root.addEventListener('pointerdown', (e) => this.down(e));
    window.addEventListener('pointermove', (e) => this.move(e), { passive: false });
    window.addEventListener('pointerup', (e) => this.up(e));
    window.addEventListener('pointercancel', (e) => this.up(e));
  }

  private down(e: PointerEvent): void {
    e.preventDefault();
    const inp = this.g.input;
    const t = (e.target as HTMLElement).closest('.tc-btn') as HTMLElement | null;
    const b = t ? BTNS.find((x) => x.act === t.dataset.act) : undefined;
    if (b) {
      this.tracks.set(e.pointerId, { kind: 'btn', b, x: e.clientX, y: e.clientY });
      t!.classList.add('on');
      switch (b.mode) {
        case 'fire': inp.fire = true; inp.firePressed = true; break;
        case 'ads': inp.ads = !inp.ads; break;
        case 'toggle': this.crouchOn = !this.crouchOn; inp.sim(b.act, this.crouchOn); break;
        case 'swap': inp.wheel += 1; break;
        case 'pause': this.g.ui.onEscape(); break;
        default: inp.sim(b.act, true);
      }
      return;
    }
    if (e.clientX < window.innerWidth * 0.45) {
      this.tracks.set(e.pointerId, { kind: 'stick', ox: e.clientX, oy: e.clientY });
      this.stick.classList.remove('hidden');
      this.stick.style.left = `${e.clientX}px`; this.stick.style.top = `${e.clientY}px`;
      this.knob.style.transform = 'translate(-50%, -50%)';
    } else this.tracks.set(e.pointerId, { kind: 'look', x: e.clientX, y: e.clientY });
  }

  private move(e: PointerEvent): void {
    const tr = this.tracks.get(e.pointerId);
    if (!tr) return;
    e.preventDefault();
    const inp = this.g.input;
    if (tr.kind === 'stick') {
      let dx = e.clientX - tr.ox, dy = e.clientY - tr.oy;
      const d = Math.hypot(dx, dy);
      if (d > STICK_R) { dx *= STICK_R / d; dy *= STICK_R / d; }
      inp.moveX = dx / STICK_R; inp.moveY = -dy / STICK_R;
      this.knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
    } else {
      // visée : zone droite, et aussi en gardant le doigt sur TIR ou VISÉE (viser en tirant)
      if (tr.kind === 'btn' && tr.b.mode !== 'fire' && tr.b.mode !== 'ads') return;
      inp.look(e.clientX - tr.x, e.clientY - tr.y);
      tr.x = e.clientX; tr.y = e.clientY;
    }
  }

  private up(e: PointerEvent): void {
    const tr = this.tracks.get(e.pointerId);
    if (!tr) return;
    this.tracks.delete(e.pointerId);
    const inp = this.g.input;
    if (tr.kind === 'stick') { inp.moveX = 0; inp.moveY = 0; this.stick.classList.add('hidden'); return; }
    if (tr.kind !== 'btn') return;
    this.els.get(tr.b.act)?.classList.remove('on');
    if (tr.b.mode === 'fire') inp.fire = false;
    else if (tr.b.mode === 'hold' || tr.b.mode === 'tap') inp.sim(tr.b.act, false);
  }

  /** Relâche tout (menu ouvert, mort, changement d'écran). */
  private releaseAll(): void {
    const inp = this.g.input;
    for (const [, tr] of this.tracks) if (tr.kind === 'btn' && (tr.b.mode === 'hold' || tr.b.mode === 'tap')) inp.sim(tr.b.act, false);
    this.tracks.clear();
    inp.fire = false; inp.moveX = 0; inp.moveY = 0;
    if (this.crouchOn) { this.crouchOn = false; inp.sim('crouch', false); }
    this.stick.classList.add('hidden');
    for (const e of this.els.values()) e.classList.remove('on');
  }

  update(): void {
    const g = this.g;
    const show = g.input.touch && (g.state === 'play' || g.state === 'dead') && !g.ui.blocking && !!g.level;
    if (show !== this.shown) { this.shown = show; this.root.classList.toggle('hidden', !show); if (!show) this.releaseAll(); }
    if (!show) return;
    const online = g.match.active || g.duel.active;
    for (const b of BTNS) { const e = this.els.get(b.act)!; e.style.display = b.solo && online ? 'none' : ''; }
    this.els.get('ads')!.classList.toggle('active', g.input.ads);
    this.els.get('crouch')!.classList.toggle('active', this.crouchOn);
    this.els.get('swap')!.style.display = g.weapons.slots.length > 1 ? '' : 'none';
    if (!online) this.cooldowns();
  }

  /** Recharge des compétences, énergie, charge de l'ultime et grenades, affichées sur les boutons. */
  private cooldowns(): void {
    const p = this.g.player;
    if (!p.cls) return;
    for (let i = 0; i < 3; i++) {
      const e = this.els.get('skill' + (i + 1))!;
      const cd = p.cds[i], k = cd > 0 ? Math.min(1, cd / (p.cdMax[i] || 1)) : 0;
      this.label(e, 'skill' + (i + 1), cd > 0 ? (cd >= 10 ? String(Math.ceil(cd)) : cd.toFixed(1)) : String(i + 1));
      e.style.setProperty('--cd', k.toFixed(3));
      e.classList.toggle('cd', cd > 0);
      e.classList.toggle('noen', cd <= 0 && p.energy < p.cls.skills[i].cost);
    }
    const u = this.els.get('ult')!;
    this.label(u, 'ult', p.ult >= 100 ? 'ULT' : `${Math.floor(p.ult)}%`);
    u.style.setProperty('--cd', (1 - Math.min(100, p.ult) / 100).toFixed(3));
    u.classList.toggle('cd', p.ult < 100);
    u.classList.toggle('ready', p.ult >= 100);
    const gr = this.els.get('grenade')!;
    this.label(gr, 'grenade', `GREN. ${p.grenades}`);
    gr.classList.toggle('noen', p.grenades <= 0);
  }

  private label(e: HTMLElement, key: string, t: string): void { if (this.txt.get(key) !== t) { this.txt.set(key, t); e.textContent = t; } }
}
