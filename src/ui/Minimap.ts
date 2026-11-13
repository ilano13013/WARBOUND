// Mini-carte (radar) : orientée selon le regard du joueur, elle montre les obstacles, l'objectif
// et, en rouge, les ennemis qui viennent de tirer (le point s'efface en quelques secondes).
import type { Game } from '../core/Game';
import type { Level } from '../world/Level';

const SIZE = 168;          // pixels du canevas
const RANGE = 40;          // mètres du centre au bord
const FADE = 1.2;          // durée du fondu final (s)

export class Minimap {
  el: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private bg: HTMLCanvasElement | null = null;
  private bgLevel: Level | null = null;
  private t = 0;

  constructor(private g: Game, parent: HTMLElement) {
    this.el = document.createElement('canvas');
    this.el.id = 'minimap';
    this.el.width = SIZE; this.el.height = SIZE;
    parent.appendChild(this.el);
    this.ctx = this.el.getContext('2d')!;
  }

  /** Fond : une case de navigation (1 m) par pixel, construit une fois par niveau. */
  private background(level: Level): HTMLCanvasElement {
    if (this.bg && this.bgLevel === level) return this.bg;
    const nav = level.world.nav;
    const c = document.createElement('canvas');
    c.width = nav.w; c.height = nav.h;
    const x = c.getContext('2d')!;
    const img = x.createImageData(nav.w, nav.h);
    for (let i = 0; i < nav.w * nav.h; i++) {
      const b = nav.blocked[i];
      img.data[i * 4] = b ? 92 : 26; img.data[i * 4 + 1] = b ? 104 : 34; img.data[i * 4 + 2] = b ? 124 : 46; img.data[i * 4 + 3] = b ? 235 : 150;
    }
    x.putImageData(img, 0, 0);
    this.bg = c; this.bgLevel = level;
    return c;
  }

  update(dt: number): void {
    const g = this.g, level = g.level, p = g.player;
    const show = !!level && (g.state === 'play' || g.state === 'dead');
    this.el.style.display = show ? 'block' : 'none';
    if (!show || !level) return;
    // 20 images par seconde suffisent
    this.t -= dt; if (this.t > 0) return; this.t = 0.05;
    const x = this.ctx, h = SIZE / 2, s = h / RANGE, nav = level.world.nav;
    x.clearRect(0, 0, SIZE, SIZE);
    x.save();
    x.beginPath(); x.arc(h, h, h - 2, 0, Math.PI * 2); x.clip();
    x.fillStyle = 'rgba(6, 8, 12, 0.72)'; x.fillRect(0, 0, SIZE, SIZE);
    // repère monde : le regard du joueur pointe vers le haut
    x.translate(h, h);
    x.rotate(p.yaw);
    x.scale(s, s);
    x.translate(-p.pos.x, -p.pos.z);
    x.imageSmoothingEnabled = false;
    x.drawImage(this.background(level), nav.minX, nav.minZ, nav.w, nav.h);
    // zones de Domination
    for (const z of g.match.active ? g.match.zones : []) {
      x.globalAlpha = 0.85;
      x.strokeStyle = z.owner === 'red' ? '#ff4a3a' : z.owner === 'blue' ? '#4a8aff' : '#d8d8d8';
      x.lineWidth = 2 / s;
      x.beginPath(); x.arc(z.pos.x, z.pos.z, z.r, 0, Math.PI * 2); x.stroke();
    }
    x.globalAlpha = 1;
    // alliés (toujours visibles)
    for (const e of g.enemies) {
      const f = e as { friendly?: boolean; team?: string | null };
      if (!e.alive || !f.friendly) continue;
      x.fillStyle = f.team === 'red' ? '#ff8a7a' : '#7ab8ff';
      x.beginPath(); x.arc(e.pos.x, e.pos.z, 3 / s, 0, Math.PI * 2); x.fill();
    }
    // ennemis qui viennent de tirer
    for (const e of g.enemies) {
      if (!e.alive || e.firedT <= 0 || (e as { friendly?: boolean }).friendly) continue;
      x.globalAlpha = Math.min(1, e.firedT / FADE);
      x.fillStyle = e.isBoss ? '#ff9a2a' : '#ff3a2a';
      x.beginPath(); x.arc(e.pos.x, e.pos.z, (e.isBoss ? 5 : 3.2) / s, 0, Math.PI * 2); x.fill();
    }
    x.globalAlpha = 1;
    x.restore();
    // objectif : losange, ramené sur le bord s'il est hors de portée
    const mp = g.mission?.markerPos();
    if (mp) {
      const dx = mp.x - p.pos.x, dz = mp.z - p.pos.z;
      const c = Math.cos(p.yaw), sn = Math.sin(p.yaw);
      let mx = (dx * c - dz * sn) * s, my = (dx * sn + dz * c) * s;
      const d = Math.hypot(mx, my), lim = h - 9;
      if (d > lim) { mx *= lim / d; my *= lim / d; }
      x.save(); x.translate(h + mx, h + my); x.rotate(Math.PI / 4);
      x.strokeStyle = '#4ad8ff'; x.lineWidth = 2; x.strokeRect(-4.5, -4.5, 9, 9); x.restore();
    }
    // joueur
    x.fillStyle = '#ffffff';
    x.beginPath(); x.moveTo(h, h - 7); x.lineTo(h + 5, h + 6); x.lineTo(h, h + 3); x.lineTo(h - 5, h + 6); x.closePath(); x.fill();
    // cadre
    x.strokeStyle = 'rgba(201, 169, 106, 0.55)'; x.lineWidth = 2;
    x.beginPath(); x.arc(h, h, h - 2, 0, Math.PI * 2); x.stroke();
  }
}
