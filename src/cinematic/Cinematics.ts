// Cinématiques réalisées avec le moteur : décor du menu, introduction et conclusion de la campagne.
import * as THREE from 'three';
import type { Game } from '../core/Game';
import { Level } from '../world/Level';
import { CLASSES, type ClassId } from '../data/classes';
import { buildOperatorModel } from '../ai/EnemyModels';
import { buildOperatorRig } from '../ai/EnemyRigs';
import type { CharacterRig } from '../render/CharacterRig';

interface Shot { dur: number; text?: string; title?: string; from: [number, number, number]; to: [number, number, number]; look: [number, number, number]; fx?: () => void }

const _a = new THREE.Vector3(), _b = new THREE.Vector3();

export class Cinematics {
  private mode: 'none' | 'menu' | 'seq' = 'none';
  private t = 0;
  private shots: Shot[] = [];
  private shotI = -1; private shotT = 0;
  private done: (() => void) | null = null;
  private operator: THREE.Object3D | null = null;
  private opRig: CharacterRig | null = null;
  private opClass: ClassId | null = null;
  private camPos = new THREE.Vector3(0, 2, 10);
  private riftFade = false;
  private endCenter = new THREE.Vector3();

  constructor(private g: Game) {}

  stop(): void {
    this.mode = 'none'; this.shots = []; this.done = null; this.riftFade = false;
    if (this.operator) { this.operator.removeFromParent(); this.operator = null; }
    this.g.ui.cineEnd();
  }

  /** Décor 3D animé du menu principal : une Fracture ouverte au-dessus d'un champ de bataille. */
  private opLight: THREE.PointLight | null = null;

  menuBackdrop(): void {
    const g = this.g;
    const L = new Level('menu', 'Menu', { skyTop: 0x0a0a1e, skyHorizon: 0x3a2850, fog: 0x1a1428, fogDensity: 0.018, sun: 0xb090ff, sunIntensity: 1.6, sunDir: [-0.4, 0.5, -0.6], hemiSky: 0x6a5a9a, hemiGround: 0x18141c, hemiIntensity: 0.9, rift: true });
    L.floor('ash', 0, 0, 160, 160);
    L.portal(0, 4.2, -16, 4.2, 0x8a4aff);
    for (let i = 0; i < 16; i++) { const a = i * 2.4, r = 9 + (i % 5) * 3.5; L.crystalDeco(Math.cos(a) * r, 0, -16 + Math.sin(a) * r * 0.6, 0.8 + (i % 3) * 0.7, i % 4 === 0 ? 'crystal_red' : 'crystal'); }
    L.vehicle(-7, -3, false, 'apc', 0x2e3428); L.vehicle(8, -6, true, 'truck', 0x30363a);
    L.sandbags(-2.5, 1.5, true, 4); L.barrier(4, 2, true); L.crate(5.5, 0.5, 1.1); L.crate(6.4, 1.5, 0.9, 0, 'olive');
    L.column(-13, -20, 9, 0.9, 'rune'); L.column(13, -20, 9, 0.9, 'rune', true); L.column(-9, -27, 11, 0.9, 'rune'); L.column(9, -27, 11, 0.9, 'rune');
    L.rubble(-4, -8, 2.5, 'stone'); L.rubble(3, -11, 2, 'stone'); L.deadTree(-11, -1, 6); L.deadTree(12, 2, 5);
    L.lamp(0, 4.2, -15, 'violet', true, 60, 40);
    L.lamp(2, 2.6, 5, 'white', true, 10, 12);
    this.opLight = new THREE.PointLight(0xffffff, 0, 4, 1.6); L.root.add(this.opLight);
    L.bounds = { minX: -20, minZ: -30, maxX: 20, maxZ: 12 };
    L.finish();
    g.level = L;
    g.r.scene.add(L.root);
    g.r.setAmbience(L.ambience);
    g.r.drawVm = false;
    this.mode = 'menu'; this.t = 0;
    this.camPos.set(4, 1.9, 9);
  }

  /** Présentation 3D de la classe sélectionnée (null = retour au plan large). */
  showOperator(id: ClassId | null): void {
    const g = this.g;
    if (this.operator) { this.operator.removeFromParent(); this.operator = null; }
    this.opClass = id;
    if (this.opLight && !id) this.opLight.intensity = 0;
    if (!id || !g.level) return;
    const rig = buildOperatorRig(CLASSES[id].color, id === 'wraith' || id === 'lifebinder' || id === 'ranger');
    this.opRig = rig;
    this.operator = rig ? rig.root : buildOperatorModel(CLASSES[id].color);
    // halo de la couleur de la classe aux pieds de l'opérateur
    this.operator.position.set(-1.2, 0.02, 3.2);
    this.operator.rotation.y = Math.PI * 0.9;
    // halo de la classe : la lumière persistante est déplacée et recolorée (aucune lumière ajoutée)
    if (this.opLight) { this.opLight.color.setHex(CLASSES[id].color); this.opLight.intensity = rig ? 6 : 0; this.operator.updateMatrixWorld(); this.opLight.position.set(0, 1.2, 0.6).applyMatrix4(this.operator.matrix); }
    g.level.root.add(this.operator);
    g.fx.ring(this.operator.position, 0.3, 2.2, CLASSES[id].color, 0.6);
  }

  private play(shots: Shot[], done: () => void): void {
    const g = this.g;
    this.shots = shots; this.shotI = -1; this.shotT = 0; this.mode = 'seq';
    this.done = done;
    g.state = 'cinematic';
    g.r.drawVm = false;
    g.ui.hud.setVisible(false);
    g.ui.cineStart(() => this.finish());
    this.next();
  }

  private next(): void {
    this.shotI++; this.shotT = 0;
    const s = this.shots[this.shotI];
    if (!s) { this.finish(); return; }
    this.g.ui.cineText(s.text || '');
    this.g.ui.cineTitle(s.title || '');
    s.fx?.();
  }

  private finish(): void {
    const d = this.done;
    this.done = null; this.mode = 'none'; this.shots = []; this.riftFade = false;
    this.g.ui.cineEnd();
    this.g.r.setRift(this.g.level?.ambience.rift ? 1 : 0);
    d?.();
  }

  playIntro(done: () => void): void {
    const g = this.g;
    if (!g.level) this.menuBackdrop();
    g.audio.setMusic('menu');
    this.play([
      { dur: 6, title: '<div class="label" style="letter-spacing:.6em">2037</div>', text: 'Le ciel s’est fendu un matin de mars. Dix-sept plaies lumineuses au-dessus de dix-sept régions du monde.', from: [0, 30, 30], to: [0, 22, 22], look: [0, 12, -16] },
      { dur: 6.5, text: 'On les a appelées <b style="color:#b08aff">les Fractures</b>. De l’autre côté, quelque chose a regardé — puis traversé.', from: [-14, 3, -4], to: [-6, 3.5, -8], look: [0, 4.2, -16] },
      { dur: 7, text: 'La corporation <b style="color:#ff8a5a">HELIX</b> a promis de transformer cette énergie en arme. Ses soldats sont revenus changés. Ses laboratoires ne répondent plus.', from: [10, 1.5, 2], to: [6, 2.2, -3], look: [-6, 1.5, -5] },
      { dur: 7, text: 'La Coalition <b style="color:#6ab0ff">AEGIS</b> a formé une unité capable de se battre là où la guerre moderne rencontre la magie.', from: [2, 1.2, 8], to: [0.5, 1.7, 5.5], look: [-1.2, 1.3, 3.2], fx: () => { if (g.profile) this.showOperator(g.profile.classId); } },
      { dur: 6, title: '<div class="logo" style="font-size:9vw">WARBOUND</div><div class="logo-sub" style="margin:10px 0 0">The Fracture Chronicles</div>', text: 'Vous êtes l’un d’eux. Bienvenue à Fort Aegis, opérateur.', from: [0.5, 1.7, 5.5], to: [0, 4, 12], look: [0, 4.2, -16], fx: () => g.audio.bossRoar(null) },
    ], done);
  }

  /** Conclusion de la campagne, jouée dans l'arène du noyau après la stabilisation de la Fracture. */
  playEnding(done: () => void): void {
    const g = this.g;
    const c = this.endCenter.copy(g.mission?.boss?.arena ?? g.player.pos);
    g.audio.setMusic('ending');
    for (const e of g.enemies) e.remove();
    g.combat.clear();
    const burst = (col: number) => () => { for (let i = 0; i < 8; i++) { const a = (i / 8) * 6.28; g.fx.burst(_a.set(c.x + Math.cos(a) * 9, 2 + Math.random() * 5, c.z + Math.sin(a) * 9), { count: 26, color: col, color2: 0xffffff, speed: 7, life: 2, size: 0.35, gravity: -3 }); } g.fx.ring(c, 1, 34, col, 2.2); g.audio.explosion(null, 1.3); };
    this.riftFade = false;
    this.play([
      { dur: 6.5, text: 'La Clé du Voile tourne dans la plaie du monde. Le Souverain Fracturé s’effondre — et avec lui, le signal qui tenait la porte ouverte.', from: [c.x + 14, 3, c.z + 14], to: [c.x + 9, 5, c.z + 12], look: [c.x, 5, c.z], fx: burst(0xff3a5a) },
      { dur: 7, text: '« Ici Reyes. Les capteurs s’affolent… la Fracture de Point Zéro se referme. Vous l’avez fait, Warbound. Vous l’avez vraiment fait. »', from: [c.x - 12, 8, c.z + 8], to: [c.x - 6, 16, c.z + 16], look: [c.x, 14, c.z], fx: () => { this.riftFade = true; burst(0x9a6aff)(); } },
      { dur: 7.5, text: 'Dans les décombres, on a retrouvé une lettre jamais envoyée, signée Aldric Voss. Le Dr Marek l’a lue sans un mot, puis elle a repris le travail.', from: [c.x + 6, 2, c.z - 10], to: [c.x + 2, 2.5, c.z - 6], look: [c.x, 1.5, c.z] },
      { dur: 7.5, text: 'Seize Fractures restent ouvertes. L’Ordre du Voile n’a pas dit son dernier mot. Mais pour la première fois depuis 2037, l’une d’elles s’est tue.', from: [c.x, 20, c.z + 30], to: [c.x, 34, c.z + 44], look: [c.x, 10, c.z] },
      { dur: 7, title: '<div class="logo" style="font-size:8vw">WARBOUND</div><div class="logo-sub" style="margin:10px 0 0">Fin de la campagne</div>', text: 'Au fond du cratère, un éclat de cristal continue de battre, faiblement. <i>Quelque chose, de l’autre côté, a répondu.</i>', from: [c.x + 3, 1.2, c.z + 3], to: [c.x + 1.5, 0.9, c.z + 1.5], look: [c.x, 0.4, c.z], fx: () => { g.fx.flash(_a.set(c.x, 0.6, c.z), 0xff3a5a, 40, 6, 12); g.audio.tone(55, 5, { type: 'sine', vol: 0.3, attack: 2 }); } },
    ], done);
  }

  update(dt: number): void {
    this.opRig?.update(dt);
    const g = this.g, cam = g.r.camera;
    this.t += dt;
    if (this.mode === 'menu') {
      // lent travelling circulaire ; cadrage rapproché en sélection de classe
      if (this.opClass) { _a.set(1.6 + Math.sin(this.t * 0.3) * 0.25, 1.55, 6.6); _b.set(-0.2, 1.15, 3.2); }
      else { _a.set(Math.sin(this.t * 0.07) * 7 + 2, 2.1 + Math.sin(this.t * 0.11) * 0.4, 10 + Math.cos(this.t * 0.07) * 2); _b.set(0, 3.6, -16); }
      this.camPos.lerp(_a, Math.min(1, dt * 1.5));
      cam.position.copy(this.camPos);
      cam.rotation.order = 'YXZ';
      cam.lookAt(_b);
      if (Math.abs(cam.fov - 55) > 0.01) { cam.fov = 55; cam.updateProjectionMatrix(); }
      if (this.operator) this.operator.rotation.y = Math.PI * 0.9 + Math.sin(this.t * 0.5) * 0.25;
      if (Math.random() < 0.3) g.fx.spark((Math.random() - 0.5) * 8, 1 + Math.random() * 7, -15.5, 0x9a6aff, 0.25, 2.5, 0.8);
    } else if (this.mode === 'seq') {
      const s = this.shots[this.shotI];
      if (!s) return;
      this.shotT += dt;
      const k = Math.min(1, this.shotT / s.dur), e = k * k * (3 - 2 * k);
      cam.position.set(s.from[0] + (s.to[0] - s.from[0]) * e, s.from[1] + (s.to[1] - s.from[1]) * e, s.from[2] + (s.to[2] - s.from[2]) * e);
      cam.rotation.order = 'YXZ';
      cam.lookAt(s.look[0], s.look[1], s.look[2]);
      if (Math.abs(cam.fov - 50) > 0.01) { cam.fov = 50; cam.updateProjectionMatrix(); }
      if (this.riftFade) g.r.setRift(Math.max(0, 1 - this.shotT / 6) * (this.shotI === 1 ? 1 : 0));
      if (this.shotT >= s.dur) this.next();
    }
  }
}
