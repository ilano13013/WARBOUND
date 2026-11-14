// Gestion des entrées clavier/souris avec touches personnalisables et verrouillage du pointeur.
import type { Settings } from '../save/Save';

export function tokensOf(e: KeyboardEvent): string[] {
  const out = ['c:' + e.code];
  if (e.key && e.key.length === 1) out.push('k:' + e.key.toLowerCase());
  return out;
}

export function bindLabel(token: string): string {
  if (!token) return '—';
  const [t, v] = [token.slice(0, 1), token.slice(2)];
  if (t === 'k') return v.toUpperCase();
  const map: Record<string, string> = {
    ShiftLeft: 'Maj G', ShiftRight: 'Maj D', ControlLeft: 'Ctrl G', ControlRight: 'Ctrl D', Space: 'Espace', Tab: 'Tab', Escape: 'Échap',
    AltLeft: 'Alt G', Enter: 'Entrée', ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→', CapsLock: 'Verr Maj',
  };
  if (map[v]) return map[v];
  if (v.startsWith('Digit')) return v.slice(5);
  if (v.startsWith('Key')) return v.slice(3);
  if (v.startsWith('Numpad')) return 'Pav ' + v.slice(6);
  return v;
}

export class Input {
  private down = new Set<string>();
  private actionsDown = new Set<string>();
  private actionsPressed = new Set<string>();
  private simulated = new Set<string>();
  mouseDX = 0;
  mouseDY = 0;
  wheel = 0;
  fire = false;
  firePressed = false;
  ads = false;
  locked = false;
  enabled = true;
  /** Écran tactile (téléphone, tablette) : pas de verrouillage du pointeur, commandes à l'écran. */
  touch = false;
  /** Déplacement analogique du joystick tactile (-1..1 ; moveY > 0 = avancer). */
  moveX = 0; moveY = 0;
  /** capture d'une touche pour le menu de configuration */
  captureCb: ((token: string) => void) | null = null;
  onEscape: (() => void) | null = null;
  onLockChange: ((locked: boolean) => void) | null = null;
  private lastSprintTap = 0;
  doubleSprint = false;

  constructor(private canvas: HTMLElement, public settings: Settings, private testMode: boolean) {
    const q = new URLSearchParams(location.search);
    this.touch = q.get('touch') === '1' || (q.get('touch') !== '0' && !testMode && matchMedia('(pointer: coarse)').matches && !matchMedia('(pointer: fine)').matches);
    window.addEventListener('keydown', (e) => this.key(e, true));
    window.addEventListener('keyup', (e) => this.key(e, false));
    window.addEventListener('blur', () => this.reset());
    document.addEventListener('mousemove', (e) => {
      if (this.locked && !this.testMode) { this.mouseDX += e.movementX || 0; this.mouseDY += e.movementY || 0; }
    });
    document.addEventListener('mousedown', (e) => {
      if (!this.locked && !this.testMode) return;
      if (e.button === 0) { this.fire = true; this.firePressed = true; }
      if (e.button === 2) this.ads = true;
    });
    document.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.fire = false;
      if (e.button === 2) this.ads = false;
    });
    document.addEventListener('contextmenu', (e) => e.preventDefault());
    document.addEventListener('wheel', (e) => { if (this.locked) this.wheel += Math.sign(e.deltaY); }, { passive: true });
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === this.canvas;
      if (!this.locked) { this.fire = false; this.ads = false; }
      this.onLockChange?.(this.locked);
    });
  }

  lock(): void {
    if (this.touch && !this.testMode) {
      // Android : plein écran et paysage (iPhone : sans effet, l'ajout à l'écran d'accueil s'en charge)
      try { if (!document.fullscreenElement) { const p: any = document.documentElement.requestFullscreen?.({ navigationUI: 'hide' } as FullscreenOptions); p?.then?.(() => (screen.orientation as any)?.lock?.('landscape')?.catch?.(() => undefined), () => undefined); } } catch { /* refusé hors d'un geste */ }
    }
    if (this.testMode || this.touch) { this.locked = true; return; }
    if (document.pointerLockElement !== this.canvas) {
      try {
        // entrée brute (sans accélération du pointeur Windows) si demandée et prise en charge, sinon verrouillage simple
        const plain = () => { try { const q: any = this.canvas.requestPointerLock(); if (q && q.catch) q.catch(() => undefined); } catch { /* l'utilisateur devra cliquer */ } };
        if (this.settings.rawInput) {
          const p: any = (this.canvas.requestPointerLock as any)({ unadjustedMovement: true });
          if (p && p.catch) p.catch(() => plain());
        } else plain();
      } catch { /* ignore */ }
    }
  }

  unlock(): void {
    if (this.testMode || this.touch) { this.locked = false; this.fire = false; this.ads = false; this.moveX = 0; this.moveY = 0; return; }
    if (document.pointerLockElement === this.canvas) document.exitPointerLock();
  }

  private key(e: KeyboardEvent, isDown: boolean): void {
    const toks = tokensOf(e);
    if (isDown && this.captureCb) {
      e.preventDefault();
      const cb = this.captureCb;
      this.captureCb = null;
      if (e.code !== 'Escape') cb(e.code.startsWith('Key') && e.key.length === 1 ? 'k:' + e.key.toLowerCase() : 'c:' + e.code);
      else cb('');
      return;
    }
    if (e.code === 'Tab' || e.code === 'Space' || (e.ctrlKey && this.locked) || e.code === 'F1') {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag !== 'INPUT') e.preventDefault();
    }
    if (isDown && e.code === 'Escape') { this.onEscape?.(); return; }
    if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
    for (const t of toks) { if (isDown) this.down.add(t); else this.down.delete(t); }
    const binds = this.settings.binds;
    for (const a of Object.keys(binds)) {
      if (toks.includes(binds[a])) {
        if (isDown) {
          if (!this.actionsDown.has(a) && !e.repeat) {
            this.actionsPressed.add(a);
            if (a === 'sprint') {
              const now = performance.now();
              if (now - this.lastSprintTap < 320) this.doubleSprint = true;
              this.lastSprintTap = now;
            }
          }
          this.actionsDown.add(a);
        } else this.actionsDown.delete(a);
      }
    }
  }

  reset(): void { this.down.clear(); this.actionsDown.clear(); this.actionsPressed.clear(); this.simulated.clear(); this.fire = false; this.ads = false; this.moveX = 0; this.moveY = 0; }

  held(a: string): boolean { return this.enabled && (this.actionsDown.has(a) || this.simulated.has(a)); }
  pressed(a: string): boolean { return this.enabled && this.actionsPressed.has(a); }
  /** Appui brut, même quand le gameplay est désactivé (menus). */
  rawPressed(a: string): boolean { return this.actionsPressed.has(a); }

  /** Visée au doigt : déplacement en pixels converti comme un mouvement de souris. */
  look(dx: number, dy: number): void { const k = 2.2 * this.settings.touchSens; this.mouseDX += dx * k; this.mouseDY += dy * k; }

  /** Simulation d'une action (tests automatiques et boutons tactiles). */
  sim(a: string, on: boolean): void {
    if (on) { if (!this.simulated.has(a)) this.actionsPressed.add(a); this.simulated.add(a); } else this.simulated.delete(a);
  }

  endFrame(): void {
    this.actionsPressed.clear();
    this.mouseDX = 0; this.mouseDY = 0; this.wheel = 0; this.firePressed = false; this.doubleSprint = false;
  }
}
