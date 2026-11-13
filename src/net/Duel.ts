// DÉFI D'ARMES — duel 1 contre 1 en « course aux armes » : chaque élimination fait passer à l'arme suivante,
// le premier qui élimine son adversaire avec la dernière arme de l'échelle gagne.
// Réseau : liaison directe (Peer), sans serveur. Chaque joueur fait foi pour sa propre santé et sa progression ;
// le tireur détecte ses touches sur ce qu'il voit et les envoie (src/ai/Rival.ts).
import * as THREE from 'three';
import type { Game } from '../core/Game';
import { Peer, type PeerRole } from './Peer';
import { Rival } from '../ai/Rival';
import { WEAPONS } from '../data/weapons';
import { CLASSES } from '../data/classes';
import { makeWeaponItem } from '../rpg/items';
import { BUILD } from '../render/Renderer';
import { DUEL_SPAWNS } from '../levels/duel';

/** Échelle d'armes : familles variées, du fusil d'assaut au revolver. */
export const LADDER = ['ar17', 'vesper', 'titan', 'requiem', 'spectre', 'aegis762', 'frostbite', 'ash'];
const RESPAWN = 3;
const SEND_HZ = 20;
const TIMEOUT = 10;
const MAX_HIT = 400;

export type DuelPhase = 'idle' | 'connecting' | 'lobby' | 'playing' | 'over';

const _a = new THREE.Vector3(), _b = new THREE.Vector3();

export class Duel {
  peer: Peer | null = null;
  role: PeerRole = 'host';
  phase: DuelPhase = 'idle';
  status = '';
  oppName = 'Adversaire';
  oppClass = '';
  myRung = 0; oppRung = 0;
  kills = 0; deaths = 0;
  rival: Rival | null = null;
  ladder = LADDER;
  private respawnT = -1;
  private sendT = 0;
  private oppHello = false;
  private result: { victory: boolean; reason: string } | null = null;
  onStatus: () => void = () => {};

  constructor(private g: Game) {}

  get active(): boolean { return this.phase === 'playing'; }

  // ---------- connexion ----------

  private makePeer(role: PeerRole): Peer {
    this.reset();
    this.role = role;
    const p = new Peer(role, !this.g.testMode);
    p.onOpen = () => { this.setStatus('Connecté. Synchronisation…'); this.phase = 'lobby'; this.sendHello(); };
    p.onMessage = (m) => this.onMessage(m);
    p.onClose = (why) => this.onPeerClosed(why);
    this.peer = p;
    this.phase = 'connecting';
    return p;
  }

  async host(): Promise<string> {
    const p = this.makePeer('host');
    this.setStatus('Préparation de l’invitation…');
    const code = await p.createInvite(this.g.testMode ? 1500 : 4000);
    this.setStatus('Envoyez ce code à votre adversaire, puis collez son code de réponse.');
    return code;
  }

  async join(invite: string): Promise<string> {
    const p = this.makePeer('guest');
    this.setStatus('Lecture de l’invitation…');
    try {
      const code = await p.acceptInvite(invite, this.g.testMode ? 1500 : 4000);
      this.setStatus('Renvoyez ce code de réponse à l’hôte. La partie démarre dès qu’il l’a collé.');
      return code;
    } catch (e) { this.cancel(); throw e; }
  }

  async accept(answer: string): Promise<void> {
    if (!this.peer || this.role !== 'host') throw new Error('Créez d’abord une invitation.');
    this.setStatus('Connexion en cours…');
    await this.peer.acceptAnswer(answer);
  }

  cancel(): void {
    const p = this.peer;
    this.peer = null;
    if (p) { p.onClose = () => {}; p.close(); }
    this.phase = 'idle';
  }

  private reset(): void {
    this.cancel();
    this.myRung = 0; this.oppRung = 0; this.kills = 0; this.deaths = 0;
    this.respawnT = -1; this.sendT = 0; this.oppHello = false; this.result = null;
    this.rival = null; this.oppName = 'Adversaire'; this.oppClass = '';
  }

  private setStatus(s: string): void { this.status = s; this.onStatus(); }

  private sendHello(): void {
    const p = this.g.profile!;
    this.peer?.send({ t: 'hello', v: BUILD, name: p.name, cls: p.classId });
  }

  private onPeerClosed(why: string): void {
    this.peer = null;
    if (this.phase === 'playing') this.finish(true, `${this.oppName} a quitté la partie. ${why}`, false);
    else if (this.phase !== 'over') { this.phase = 'idle'; this.setStatus(why); }
  }

  // ---------- messages ----------

  private onMessage(m: any): void {
    const g = this.g;
    if (!m || typeof m.t !== 'string') return;
    switch (m.t) {
      case 'hello':
        if (m.v !== BUILD) { this.setStatus(`Versions différentes (vous : ${BUILD}, adversaire : ${String(m.v)}). Mettez le jeu à jour des deux côtés.`); this.cancel(); return; }
        this.oppName = String(m.name || 'Adversaire').slice(0, 24);
        this.oppClass = String(m.cls || '');
        this.oppHello = true;
        if (this.role === 'host') { this.peer?.send({ t: 'start' }); this.launch(); }
        return;
      case 'start': if (this.role === 'guest' && this.oppHello) this.launch(); return;
    }
    if (this.phase !== 'playing') return;
    const r = this.rival;
    switch (m.t) {
      case 's':
        if (r && r.alive && Number.isFinite(m.x)) r.apply({ x: m.x, y: m.y, z: m.z, yaw: m.yaw, pitch: m.pt, sp: m.sp, h: Number.isFinite(m.h) ? m.h : 1.8, ads: !!m.ads, hp: m.hp, inv: !!m.inv });
        if (Number.isInteger(m.r)) this.oppRung = Math.max(0, Math.min(this.ladder.length - 1, m.r));
        return;
      case 'shot': {
        if (!r || !r.alive || !Number.isFinite(m.ex)) return;
        const def = WEAPONS[m.w] || WEAPONS.ar17;
        r.center(_a); _a.y += 0.35;
        _b.set(m.ex, m.ey, m.ez);
        g.fx.tracer(_a, _b, 0xffd0a0, def.family === 'sniper' ? 0.05 : 0.02, def.family === 'sniper' ? 0.16 : 0.06);
        g.fx.flash(_a, 0xffc890, 10, 0.05, 8);
        g.audio.gunshot(def.sound, false, r.pos, 1, def.rec);
        r.firedT = 3;
        return;
      }
      case 'hit': {
        const p = g.player;
        if (p.dead || !Number.isFinite(m.d)) return;
        const dmg = Math.max(0, Math.min(MAX_HIT, m.d));
        if (m.h) g.ui.hud.toast('TIR À LA TÊTE REÇU', '#ff6a5a');
        p.takeDamage(dmg, { from: r ? r.pos : undefined, pierce: true });
        return;
      }
      case 'died':
        r?.kill();
        if (m.by === 'opp') this.onKillConfirmed();
        else g.ui.hud.toast(`${this.oppName} s’est éliminé tout seul`, '#e8d85a');
        return;
      case 'spawn': this.spawnRival(new THREE.Vector3(m.x, m.y, m.z)); return;
      case 'end': this.finish(false, `${this.oppName} a terminé l’échelle d’armes.`); return;
      case 'bye': this.finish(true, `${this.oppName} a abandonné.`, false); return;
    }
  }

  // ---------- partie ----------

  private launch(): void {
    if (this.phase === 'playing') return;
    this.phase = 'playing';
    this.g.startDuel();
  }

  /** Objectif affiché (ajouté avant le chargement pour que la mission l'active). */
  prepare(m: import('../mission/Mission').Mission): void {
    m.custom({
      text: `Défi d’armes contre ${this.oppName}`,
      done: () => false,
      progress: () => `Vous : arme ${this.myRung + 1}/${this.ladder.length} (${WEAPONS[this.ladder[this.myRung]].name}) · ${this.oppName} : ${this.oppRung + 1}/${this.ladder.length}`,
    });
  }

  /** Appelé par Game.startDuel une fois l'arène chargée. */
  begin(): void {
    const g = this.g;
    const me = DUEL_SPAWNS[this.role === 'host' ? 0 : 1], them = DUEL_SPAWNS[this.role === 'host' ? 1 : 0];
    this.place(me);
    this.spawnRival(them.pos);
    this.setRung(0, false);
    g.ui.hud.banner('DÉFI D’ARMES', `${this.ladder.length} armes — une élimination pour passer à la suivante`);
  }

  /** Conditions égales : santé de base, aucun talent, équipement, compétence ni grenade. */
  private place(s: { pos: THREE.Vector3; yaw: number }): void {
    const p = this.g.player;
    p.mods = {}; p.legends = new Set(); p.maxHp = 100;
    p.spawn(s.pos, s.yaw, true);
    p.grenades = 0;
  }

  private spawnRival(at: THREE.Vector3): void {
    const g = this.g;
    if (this.rival) { this.rival.remove(); const i = g.enemies.indexOf(this.rival); if (i >= 0) g.enemies.splice(i, 1); }
    const label = this.oppClass && (CLASSES as any)[this.oppClass] ? `${this.oppName} (${(CLASSES as any)[this.oppClass].name})` : this.oppName;
    const r = new Rival(g, at.x, at.y, at.z, label);
    r.onHit = (dmg, head) => this.peer?.send({ t: 'hit', d: Math.round(dmg * 10) / 10, h: head });
    g.enemies.push(r);
    this.rival = r;
  }

  private setRung(i: number, announce = true): void {
    const g = this.g;
    this.myRung = i;
    const item = makeWeaponItem(this.ladder[i], 'common', 1);
    g.weapons.override = [item];
    g.weapons.rebuild();
    for (const s of g.weapons.slots) s.reserve = s.st.mag * 5;
    g.ui.hud.weaponChanged();
    if (announce) {
      const last = i === this.ladder.length - 1;
      g.ui.hud.banner(last ? 'DERNIÈRE ARME' : `ARME ${i + 1} / ${this.ladder.length}`, WEAPONS[this.ladder[i]].name);
      g.audio.swap();
    }
  }

  private onKillConfirmed(): void {
    const g = this.g;
    this.kills++;
    g.audio.hitmarker(false, true);
    g.ui.hud.toast(`${this.oppName} ÉLIMINÉ`, '#3aff8a');
    if (g.mission) g.mission.stats.kills++;
    if (this.myRung >= this.ladder.length - 1) {
      this.peer?.send({ t: 'end' });
      this.finish(true, 'Échelle d’armes terminée.');
      return;
    }
    this.setRung(this.myRung + 1);
  }

  /** Mort du joueur local (appelé par Game.onPlayerDeath). */
  onLocalDeath(): void {
    const g = this.g;
    this.deaths++;
    const byOpp = g.time - g.player.lastHurt < 0.5;
    this.peer?.send({ t: 'died', by: byOpp ? 'opp' : 'self' });
    g.ui.hud.banner('ÉLIMINÉ', `Réapparition dans ${RESPAWN} s`);
    this.respawnT = RESPAWN;
  }

  private respawn(): void {
    const g = this.g, p = g.player;
    // le point le plus éloigné de l'adversaire
    const from = this.rival?.pos ?? DUEL_SPAWNS[0].pos;
    let best = DUEL_SPAWNS[0], bd = -1;
    for (const s of DUEL_SPAWNS) { const d = s.pos.distanceTo(from); if (d > bd) { bd = d; best = s; } }
    this.place(best);
    this.setRung(this.myRung, false);
    g.state = 'play';
    g.timeScale = 1;
    g.ui.closeAll();
    g.input.lock();
    this.peer?.send({ t: 'spawn', x: best.pos.x, y: best.pos.y, z: best.pos.z });
  }

  /** Coup de feu local : l'adversaire affiche le traceur et entend le tir. */
  onShot(end: THREE.Vector3, weaponId: string): void {
    this.peer?.send({ t: 'shot', w: weaponId, ex: +end.x.toFixed(2), ey: +end.y.toFixed(2), ez: +end.z.toFixed(2) }, true);
  }

  /** Appelé à chaque image tant que la partie est en cours (même en pause : l'adversaire continue de jouer). */
  tick(realDt: number, simulated: boolean, dt: number): void {
    const g = this.g, p = g.player;
    if (!this.active) return;
    if (!simulated && this.rival) this.rival.update(dt);
    if (this.respawnT > 0) { this.respawnT -= realDt; if (this.respawnT <= 0) this.respawn(); }
    this.sendT -= realDt;
    if (this.sendT <= 0 && this.peer) {
      this.sendT = 1 / SEND_HZ;
      this.peer.send({
        t: 's', x: +p.pos.x.toFixed(3), y: +p.pos.y.toFixed(3), z: +p.pos.z.toFixed(3), yaw: +p.yaw.toFixed(3), pt: +p.pitch.toFixed(3),
        sp: +p.speedNow.toFixed(2), h: +p.height.toFixed(2), ads: g.weapons.adsK > 0.5, hp: Math.round(p.dead ? 0 : p.hp), inv: p.invuln > 0, r: this.myRung,
      }, true);
    }
    if (this.peer && this.peer.open && (performance.now() - this.peer.lastRecv) / 1000 > TIMEOUT) this.peer.close('Plus aucune nouvelle de l’adversaire depuis 10 s.');
  }

  /** Abandon volontaire. */
  leave(): void {
    if (this.phase !== 'playing') { this.cancel(); return; }
    this.peer?.send({ t: 'bye' });
    this.finish(false, 'Vous avez abandonné.');
  }

  private finish(victory: boolean, reason: string, closeSoon = true): void {
    if (this.phase === 'over') return;
    this.phase = 'over';
    this.result = { victory, reason };
    const peer = this.peer;
    this.peer = null;
    if (peer) { peer.onClose = () => {}; if (closeSoon) setTimeout(() => peer.close(), 800); else peer.close(); }
    this.g.finishDuel(victory, reason);
  }

  get lastResult(): { victory: boolean; reason: string } | null { return this.result; }
}
