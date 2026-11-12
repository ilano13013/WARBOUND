// Mode de test automatique (activé uniquement avec ?autotest dans l'URL).
// Expose le jeu aux scripts Playwright et fournit un pilote capable de terminer les missions sans joueur humain.
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
    newGame: (cls: ClassId, name = 'Testeur') => { g.profile = newProfile(cls, name); g.profile.introSeen = true; g.startHub(); },
    hub: () => g.startHub(),
    mission: (id: string) => g.startMission(id),
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
