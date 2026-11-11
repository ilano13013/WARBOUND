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
  /** capture d'une touche pour le menu de configuration */
  captureCb: ((token: string) => void) | null = null;
  onEscape: (() => void) | null = null;
  onLockChange: ((locked: boolean) => void) | null = null;
  private lastSprintTap = 0;
  doubleSprint = false;

  constructor(private canvas: HTMLElement, public settings: Settings, private testMode: boolean) {
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
    if (this.testMode) { this.locked = true; return; }
    if (document.pointerLockElement !== this.canvas) {
      try {
        const p: any = this.canvas.requestPointerLock();
        if (p && p.catch) p.catch(() => { /* l'utilisateur devra cliquer */ });
      } catch { /* ignore */ }
    }
  }

  unlock(): void {
    if (this.testMode) { this.locked = false; return; }
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

  reset(): void { this.down.clear(); this.actionsDown.clear(); this.actionsPressed.clear(); this.fire = false; this.ads = false; }

  held(a: string): boolean { return this.enabled && (this.actionsDown.has(a) || this.simulated.has(a)); }
  pressed(a: string): boolean { return this.enabled && this.actionsPressed.has(a); }
  /** Appui brut, même quand le gameplay est désactivé (menus). */
  rawPressed(a: string): boolean { return this.actionsPressed.has(a); }

  /** Simulation pour le mode de test automatique. */
  sim(a: string, on: boolean): void {
    if (on) { if (!this.simulated.has(a)) this.actionsPressed.add(a); this.simulated.add(a); } else this.simulated.delete(a);
  }

  endFrame(): void {
    this.actionsPressed.clear();
    this.mouseDX = 0; this.mouseDY = 0; this.wheel = 0; this.firePressed = false; this.doubleSprint = false;
  }
}
