// Mode de test automatique (activé uniquement avec ?autotest dans l'URL).
// Expose le jeu aux scripts Playwright et fournit un pilote capable de terminer les missions sans joueur humain.
import { LADDER } from '../net/Duel';
import * as THREE from 'three';
import type { Game } from '../core/Game';
import type { ClassId } from '../data/classes';
import { newProfile } from '../save/Save';

export function installAutoTest(g: Game): void {
  let bot = false, botT = 0, god = true, power = 1, autoNext = true;
  const log: string[] = [];
  const tick = () => {
    if (!bot || g.state !== 'play' || !g.mission || !g.level) return;
    const m = g.mission, p = g.player;
    p.godMode = god;
    // ferme les panneaux ouverts par des interactions (documents, etc.)
    if (g.ui.blocking && g.ui.current !== 'intermission') { g.ui.resume(); return; }
    if (g.ui.current === 'intermission') { if (!autoNext) return; const b = document.querySelector('[data-a="up"]') as HTMLElement | null; if (b) b.click(); else (document.querySelector('[data-a="next"]') as HTMLElement | null)?.click(); return; }
    botT++;
    // se rend au marqueur de l'objectif
    const mk = m.markerPos();
    if (mk && Math.hypot(mk.x - p.pos.x, mk.z - p.pos.z) > 2.5 && botT % 6 === 0) {
      const nav = g.level.world.nav;
      const i = nav.nearestOpen(mk.x, mk.z, 8);
      if (i >= 0) { const c = nav.center(i, new THREE.Vector3()); const gy = g.level.world.groundAt(c.x, c.z, mk.y + 3.2); p.pos.set(c.x, (gy > -100 ? gy : 0) + 0.05, c.z); p.vel.set(0, 0, 0); }
    }
    // combat : inflige des dégâts par la voie normale
    let n = 0;
    for (const e of g.enemies) {
      if (!e.alive || e.pos.distanceTo(p.pos) > 90) continue;
      e.takeDamage((e.isBoss ? 220 : 70) * power, { source: 'player', type: 'bullet', point: e.center(new THREE.Vector3()) });
      if (++n >= 4) break;
    }
    // cibles destructibles de l'objectif (conduits, cristaux)
    const b: any = m.boss;
    const targets = [...((m.current as any)?.targets || []), ...(b?.alive && b.shielded ? b.conduits || b.crystals || [] : [])];
    for (const d of targets) if (d.alive && !d.invulnerable) d.takeDamage(120, { source: 'player', type: 'bullet' });
    // interactions à portée
    // interaction de l'objectif (celle située sur le marqueur)
    if (mk) for (const it of g.level.interactables) if (it.enabled && Math.hypot(it.pos.x - mk.x, it.pos.z - mk.z) < 2 && it.pos.distanceTo(p.pos) < 7) { it.onUse(); break; }
  };
  setInterval(tick, 60);

  (window as any).WB = {
    game: g,
    state: () => ({
      state: g.state, level: g.level?.id || null, mission: g.mission?.id || null, objective: g.mission?.index ?? -1, objectives: g.mission?.objectives.length ?? 0,
      text: g.mission?.current?.text || '', progress: g.mission?.current?.progress?.() || '', completed: !!g.mission?.completed,
      hp: g.player.hp, maxHp: g.player.maxHp, energy: g.player.energy, ult: g.player.ult, pos: g.player.pos.toArray().map((v) => Math.round(v * 100) / 100), yaw: g.player.yaw,
      grounded: g.player.grounded, speed: g.player.speedNow, sliding: g.player.sliding, sprinting: g.player.sprinting, crouching: g.player.crouching,
      ammo: g.weapons.w?.ammo, reserve: g.weapons.w?.reserve, weapon: g.weapons.w?.st.def.id, reloading: g.weapons.reloading > 0, adsK: g.weapons.adsK,
      enemies: g.enemies.filter((e) => e.alive).length, enemyStates: g.enemies.filter((e) => e.alive).map((e) => e.state), boss: g.mission?.boss ? { hp: g.mission.boss.hp, phase: g.mission.boss.phase, shielded: g.mission.boss.shielded, alive: g.mission.boss.alive } : null,
      level_: g.profile?.level, xp: g.profile?.xp, inventory: g.profile?.inventory.length, materials: g.profile?.materials, missions: g.profile ? Object.keys(g.profile.missions) : [],
      screen: g.ui.current, blocking: g.ui.blocking, paused: g.paused, errors: g.errors.slice(-5), fps: g.fps, calls: g.r.info.calls, tris: g.r.info.tris,
      cds: g.player.cds.slice(), buffs: [...g.player.buffs.keys()], allies: g.allies.length, fields: g.combat.fields.length, survival: (g.mission as any)?.survival || null,
    }),
    /**
     * Sonde HDR : rend la scène (et l'arme) dans un tampon flottant 32 bits et compte les pixels invalides (NaN), infinis,
     * ou supérieurs à 65 504, limite du tampon demi-flottant du post-traitement, au-delà de laquelle une carte graphique écrit l'infini.
     */
    hdrScan: (samples = 0, w = 480, h = 270) => {
      const r = g.r;
      const rt = new THREE.WebGLRenderTarget(w, h, { type: THREE.FloatType, samples });
      const buf = new Float32Array(w * h * 4);
      const out: Record<string, unknown> = {};
      const scan = (label: string, scene: THREE.Scene, cam: THREE.Camera) => {
        r.renderer.setRenderTarget(rt); r.renderer.clear(); r.renderer.render(scene, cam);
        r.renderer.readRenderTargetPixels(rt, 0, 0, w, h, buf);
        let nan = 0, inf = 0, over = 0, max = 0, where: number[] | null = null;
        for (let i = 0; i < buf.length; i += 4) for (let k = 0; k < 3; k++) {
          const v = buf[i + k];
          if (Number.isNaN(v)) { nan++; where ||= [(i / 4) % w, Math.floor(i / 4 / w)]; } else if (!Number.isFinite(v)) { inf++; where ||= [(i / 4) % w, Math.floor(i / 4 / w)]; }
          else { if (v > 65504) { over++; where ||= [(i / 4) % w, Math.floor(i / 4 / w)]; } if (v > max) max = v; }
        }
        out[label] = { nan, inf, over, max: Math.round(max * 100) / 100, where };
      };
      const tm = r.renderer.toneMapping; r.renderer.toneMapping = THREE.NoToneMapping;
      scan('scene', r.scene, r.camera); scan('arme', r.vmScene, r.vmCamera);
      r.renderer.toneMapping = tm; r.renderer.setRenderTarget(null); rt.dispose();
      return out;
    },
    /** Personnage de test retargeté, posé devant la caméra (validation d'un profil de squelette). */
    rigTest: async (model: string, clip: 'idle' | 'walk' | 'run' | 'aim' | 'death' = 'idle', dist = 3, side = 0, face = false) => {
      const { CharacterRig } = await import('../render/CharacterRig');
      const rig = new CharacterRig({ model, height: 1.82, humanoid: true, gun: true, walkSpeed: 1.4, runSpeed: 3.4 });
      const p = g.player.pos, yaw = g.player.yaw;
      rig.root.position.set(p.x - Math.sin(yaw) * dist + Math.cos(yaw) * side, p.y, p.z - Math.cos(yaw) * dist - Math.sin(yaw) * side); rig.root.rotation.y = yaw + (face ? Math.PI : 0);
      g.r.scene.add(rig.root);
      if (clip === 'death') (rig as any).play('death', 0); else rig.setMotion(clip === 'walk' ? 1.4 : clip === 'run' ? 3.4 : 0, clip === 'aim', 0);
      const tick = () => { if (clip !== 'death') rig.setMotion(clip === 'walk' ? 1.4 : clip === 'run' ? 3.4 : 0, clip === 'aim', 0.016); rig.update(0.016); requestAnimationFrame(tick); };
      tick();
      return { clips: [...(rig as any).acts.keys()], hand: !!(rig as any).hand, head: !!(rig as any).head, scale: rig.scale };
    },
    newGame: (cls: ClassId, name = 'Testeur') => { g.profile = newProfile(cls, name); g.profile.introSeen = true; g.startHub(); },
    hub: () => g.startHub(),
    mission: (id: string) => g.startMission(id),
    duelHost: () => g.duel.host(),
    duelJoin: (code: string) => g.duel.join(code),
    duelAccept: (code: string) => g.duel.accept(code),
    duelLadder: (n: number) => { g.duel.ladder = LADDER.slice(0, n); },
    duelState: () => { const d = g.duel, r = d.rival; return { phase: d.phase, status: d.status, role: d.role, my: d.myRung, opp: d.oppRung, kills: d.kills, deaths: d.deaths, opp_name: d.oppName, weapon: g.weapons.w?.st.def.id, rival: r ? { alive: r.alive, hp: r.hp, x: +r.pos.x.toFixed(2), z: +r.pos.z.toFixed(2), inv: r.invulnerable } : null, hp: g.player.hp, dead: g.player.dead, state: g.state, result: d.lastResult }; },
    duelLeave: () => g.duel.leave(),
    online: async (mode: 'duel' | 'tdm' | 'dom') => { const { LobbyClient } = await import('../net/LobbyClient'); const code = await LobbyClient.create(mode); g.ui.showLobby(code); return code; },
    onlineJoin: (code: string) => g.ui.showLobby(code),
    onlineReady: () => g.match.lobby?.send({ t: 'ready', v: true }),
    onlineStart: () => g.match.lobby?.send({ t: 'start' }),
    onlineRoom: () => { const lb = g.match.lobby; return lb?.room ? { you: lb.you, host: lb.isHost, phase: lb.room.phase, players: lb.room.players.map((p) => ({ name: p.name, team: p.team, ready: p.ready, connected: p.connected, host: p.host })) } : null; },
    matchRules: (r: { score?: number; time?: number; respawn?: number }) => { g.match.testRules = r; },
    matchState: () => { const m = g.match; const me = m.mine; return { phase: m.phase, host: m.isHost, mode: m.mode, me: me ? { idx: me.idx, team: me.team, hp: g.player.hp, dead: g.player.dead, k: me.k, d: me.d, rung: me.rung, weapon: g.weapons.w?.st.def.id, x: +g.player.pos.x.toFixed(2), z: +g.player.pos.z.toFixed(2) } : null, score: m.teamScore, left: Math.round(m.timeLeft), zones: m.zones.map((z) => ({ id: z.id, owner: z.owner, prog: +z.prog.toFixed(2), cap: z.cap })), feed: m.feed.map((f) => f.text), players: m.players.map((p) => ({ idx: p.idx, name: p.name, team: p.team, alive: p.alive, hp: p.hp, k: p.k, d: p.d, a: p.a, x: +p.x.toFixed(2), z: +p.z.toFixed(2), conn: p.connected, rival: !!p.rival, friendly: !!p.rival?.friendly })), result: m.result, state: g.state, level: g.level?.id }; },
    matchPlace: (idx: number, x: number, y: number, z: number) => g.match.placeFor(idx, x, y, z),
    matchPeerSend: (msg: unknown) => { (g.match as any).hostPeer?.send(msg); },
    matchPeerBinary: (x: number, y: number, z: number) => import('../net/wire').then((w) => { (g.match as any).hostPeer?.sendBinary(w.encodeInput(60000, { x, y, z, yaw: 0, pitch: 0, speed: 0, height: 1.8, ads: false, crouch: false })); }),
    survival: () => g.startSurvival(),
    bot: (on: boolean, godMode = true, pw = 1) => { bot = on; god = godMode; power = pw; if (!on) g.player.godMode = false; },
    log,
    autoNext: (v: boolean) => { autoNext = v; },
    skipTo: (i: number) => { const m: any = g.mission; m.index = i - 1; m.advance(); },
    hazards: () => g.combat.hazards.length + g.combat.projectiles.length,
    give: (table: string, n = 1) => import('../rpg/items').then((m) => { for (let i = 0; i < n; i++) g.giveItems(m.rollLoot(table, g.profile!.level, 1.5, true)); return g.profile!.inventory.length; }),
    speed: (n: number) => { g.testSpeed = n; },
    god: (on: boolean) => { g.player.godMode = on; },
    tp: (x: number, y: number, z: number, yaw?: number) => { g.player.pos.set(x, y, z); g.player.vel.set(0, 0, 0); if (yaw !== undefined) g.player.yaw = yaw; g.player.pitch = 0; },
    look: (yaw: number, pitch: number) => { g.player.yaw = yaw; g.player.pitch = pitch; },
    mouse: (dx: number, dy: number) => { g.input.mouseDX += dx; g.input.mouseDY += dy; },
    // en qualité « Bas », le mode test rend à demi-résolution : le rendu logiciel des tests reste assez rapide pour les délais des scénarios
    quality: (q: 'low' | 'medium' | 'high') => { g.settings.quality = q; g.settings.renderScale = q === 'low' ? 0.5 : 1; g.applySettings(); },
    sim: (a: string, on: boolean) => g.input.sim(a, on),
    fire: (on: boolean) => { g.input.fire = on; if (on) g.input.firePressed = true; },
    ads: (on: boolean) => { g.input.ads = on; },
    skill: (i: number) => (i === 3 ? g.abilities.useUlt() : g.abilities.useSkill(i)),
    setUlt: (v: number) => { g.player.ult = v; },
    giveLevel: (n: number) => { for (let i = 0; i < n; i++) g.gainXp(5000, 'test'); },
    spawn: (kind: any, x: number, z: number, o?: any) => g.spawnEnemy(kind, x, z, o),
    save: () => g.store.saveProfile(g.profile!),
    load: () => g.store.loadProfile(),
  };
}
