// HUD des parties en ligne : score des équipes et chronomètre, zones de Domination, fil des éliminations,
// tableau des scores (touche Personnage maintenue, Tab par défaut), noms des alliés au-dessus de leur tête,
// marqueurs 3D des zones dans l'arène.
import * as THREE from 'three';
import type { Game } from '../core/Game';
import { esc } from './UI';
import type { Zone } from '../net/Match';

const _v = new THREE.Vector3();
const TEAM_CSS = { red: '#ff5a4a', blue: '#4a8aff' } as const;

function el(tag: string, cls: string, parent: HTMLElement, id = ''): HTMLElement { const e = document.createElement(tag); if (cls) e.className = cls; if (id) e.id = id; parent.appendChild(e); return e; }
const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

export class MatchHUD {
  private root: HTMLElement;
  private bar: HTMLElement; private zonesEl: HTMLElement; private feedEl: HTMLElement; private board: HTMLElement; private tags: HTMLElement;
  private cache = '';
  private zoneMeshes: { z: Zone; ring: THREE.Mesh; fill: THREE.Mesh; group: THREE.Group }[] = [];
  private zoneLevel: unknown = null;

  constructor(private g: Game, parent: HTMLElement) {
    this.root = el('div', 'hidden', parent, 'matchhud');
    this.bar = el('div', '', this.root, 'mbar');
    this.zonesEl = el('div', '', this.root, 'mzones');
    this.feedEl = el('div', '', this.root, 'kfeed');
    this.tags = el('div', '', this.root, 'mtags');
    this.board = el('div', 'hidden', this.root, 'sboard');
  }

  update(): void {
    const g = this.g, mt = g.match;
    const on = mt.active && mt.loaded && !!g.level;
    this.root.classList.toggle('hidden', !on);
    if (!on) { this.clearZones(); return; }
    // barre de score
    const me = mt.mine;
    let bar: string;
    if (mt.mode === 'duel') {
      const opp = mt.players.find((p) => p.idx !== mt.me);
      bar = `<span class="ms me">${esc(me?.name || '')} <b>${(me?.rung ?? 0) + 1}/${mt.rules.score}</b></span><span class="mt">1V1</span><span class="ms">${esc(opp?.name || '')} <b>${(opp?.rung ?? 0) + 1}/${mt.rules.score}</b></span>`;
    } else {
      const mine = me?.team;
      bar = `<span class="ms red${mine === 'red' ? ' me' : ''}"><b>${mt.teamScore.red}</b> ROUGE</span><span class="mt">${mt.rules.time ? fmt(mt.timeLeft) : ''}<i>${mt.rules.score}</i></span><span class="ms blue${mine === 'blue' ? ' me' : ''}">BLEU <b>${mt.teamScore.blue}</b></span>`;
    }
    // zones
    const zones = mt.zones.map((z) => {
      const col = z.owner ? TEAM_CSS[z.owner] : '#8a8a8a';
      const capCol = z.cap ? TEAM_CSS[z.cap] : col;
      const pct = Math.round((z.owner && !z.cap ? 1 : z.prog) * 100);
      return `<span class="mz${z.contested ? ' cont' : ''}" style="border-color:${col};background:linear-gradient(0deg,${capCol}66 ${pct}%,transparent ${pct}%)">${z.id}</span>`;
    }).join('');
    const feed = mt.feed.map((f) => `<div class="${f.mine ? 'mine' : ''}">${esc(f.text)}</div>`).join('');
    const key = bar + zones + feed;
    if (key !== this.cache) { this.cache = key; this.bar.innerHTML = bar; this.zonesEl.innerHTML = zones; this.feedEl.innerHTML = feed; }
    // tableau des scores
    const showBoard = g.input.held('inventory');
    this.board.classList.toggle('hidden', !showBoard);
    if (showBoard) {
      const rows = mt.scoreboard().map((p) => `<tr class="${p.me ? 'me' : ''}${p.connected ? '' : ' off'}"><td>${p.team ? `<i class="dot ${p.team}"></i>` : ''}${esc(p.name)}</td><td>${mt.mode === 'duel' ? `${p.rung + 1}/${mt.rules.score}` : p.k}</td><td>${p.d}</td><td>${p.a}</td><td>${p.connected ? (p.me && mt.isHost ? 'hôte' : p.ping + ' ms') : 'parti'}</td></tr>`).join('');
      this.board.innerHTML = `<table class="board"><tr><th>Joueur</th><th>${mt.mode === 'duel' ? 'Arme' : 'Élim.'}</th><th>Morts</th><th>Assist.</th><th>Ping</th></tr>${rows}</table>`;
    }
    // noms des alliés
    let tags = '';
    const cam = g.r.camera;
    for (const p of mt.players) {
      const r = p.rival;
      if (!r || !r.alive || !r.friendly) continue;
      _v.set(r.pos.x, r.pos.y + r.height + 0.35, r.pos.z);
      if (_v.distanceTo(cam.position) > 80) continue;
      _v.project(cam);
      if (_v.z > 1) continue;
      tags += `<span style="left:${((_v.x * 0.5 + 0.5) * window.innerWidth).toFixed(0)}px;top:${((-_v.y * 0.5 + 0.5) * window.innerHeight).toFixed(0)}px;color:${p.team ? TEAM_CSS[p.team] : '#fff'}">${esc(p.name)}</span>`;
    }
    if (this.tags.innerHTML !== tags) this.tags.innerHTML = tags;
    this.updateZones();
  }

  /** Anneaux de zone au sol, colorés selon l'équipe qui la tient. */
  private updateZones(): void {
    const g = this.g, mt = g.match;
    if (this.zoneLevel !== g.level) { this.clearZones(); this.zoneLevel = g.level; }
    if (!this.zoneMeshes.length && mt.zones.length && g.level) {
      for (const z of mt.zones) {
        const group = new THREE.Group();
        const ring = new THREE.Mesh(new THREE.RingGeometry(z.r - 0.18, z.r, 64).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, depthWrite: false, side: THREE.DoubleSide }));
        const fill = new THREE.Mesh(new THREE.CircleGeometry(z.r - 0.18, 48).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.12, depthWrite: false, side: THREE.DoubleSide }));
        ring.position.y = fill.position.y = 0.04;
        const cv = document.createElement('canvas'); cv.width = cv.height = 128;
        const c = cv.getContext('2d')!; c.font = 'bold 96px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = '#fff'; c.fillText(z.id, 64, 70);
        const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), depthTest: false, transparent: true }));
        label.scale.set(1.4, 1.4, 1); label.position.y = 3.2;
        group.add(ring, fill, label);
        group.position.copy(z.pos);
        g.level.root.add(group);
        this.zoneMeshes.push({ z, ring, fill, group });
      }
    }
    for (const m of this.zoneMeshes) {
      const z = mt.zones.find((x) => x.id === m.z.id) || m.z;
      const col = z.contested ? 0xffd24a : z.owner === 'red' ? 0xff4a3a : z.owner === 'blue' ? 0x3a7aff : 0xd8d8d8;
      (m.ring.material as THREE.MeshBasicMaterial).color.setHex(col);
      (m.fill.material as THREE.MeshBasicMaterial).color.setHex(z.cap === 'red' ? 0xff4a3a : z.cap === 'blue' ? 0x3a7aff : col);
      (m.fill.material as THREE.MeshBasicMaterial).opacity = 0.08 + 0.18 * (z.cap ? z.prog : z.owner ? 1 : 0);
    }
  }

  private clearZones(): void {
    for (const m of this.zoneMeshes) { m.group.removeFromParent(); m.ring.geometry.dispose(); m.fill.geometry.dispose(); }
    this.zoneMeshes = [];
    this.zoneLevel = null;
  }
}
