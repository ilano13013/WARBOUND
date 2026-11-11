// PROTOCOLE INFINI — mode survie par vagues dans l'arène de simulation.
import * as THREE from 'three';
import type { Game } from '../core/Game';
import type { Mission } from '../mission/Mission';
import { Level } from '../world/Level';
import { dressSurvival } from './dress';
import type { EnemyKind } from '../data/enemies';
import { ENEMIES } from '../data/enemies';
import type { Upgrade } from '../ui/Panels';

export const UPGRADES: Upgrade[] = [
  { id: 'dmg', name: 'Munitions perforantes', desc: '+12 % de dégâts des armes', mods: { dmg: 0.12 } },
  { id: 'hp', name: 'Plaques renforcées', desc: '+25 points de santé maximale', mods: { maxHp: 25 } },
  { id: 'regen', name: 'Condensateur', desc: '+25 % de régénération d’énergie', mods: { energyRegen: 0.25 } },
  { id: 'cdr', name: 'Flux accéléré', desc: 'Compétences rechargées 10 % plus vite', mods: { cdr: 0.1 } },
  { id: 'speed', name: 'Bottes tactiques', desc: '+6 % de vitesse de déplacement', mods: { moveSpeed: 0.06 } },
  { id: 'head', name: 'Œil de faucon', desc: '+20 % de dégâts à la tête', mods: { headDmg: 0.2 } },
  { id: 'reload', name: 'Mains rapides', desc: '+20 % de vitesse de rechargement', mods: { reloadSpeed: 0.2 } },
  { id: 'leech', name: 'Moisson de guerre', desc: '+5 PV par élimination', mods: { lifeOnKill: 5 } },
  { id: 'ult', name: 'Catalyseur', desc: '+20 % de charge d’ultime', mods: { ultCharge: 0.2 } },
  { id: 'power', name: 'Résonance', desc: '+12 % de puissance des compétences', mods: { skillPower: 0.12 } },
  { id: 'dr', name: 'Blindage réactif', desc: '+6 % de réduction des dégâts', mods: { dr: 0.06 } },
];

const COST: Partial<Record<EnemyKind, number>> = { grunt: 2, devourer: 1.5, drone: 2, sniper: 3, caster: 3, breaker: 5, commander: 7, sentinel: 6 };
const UNLOCK: [EnemyKind, number][] = [['grunt', 1], ['devourer', 1], ['drone', 2], ['sniper', 3], ['caster', 4], ['breaker', 5], ['sentinel', 7], ['commander', 8]];

/** Composition d'une vague : budget croissant, mélange progressif, mini-boss toutes les cinq vagues. */
export function composeWave(wave: number, rng: () => number = Math.random): { kind: EnemyKind; hpMult: number }[] {
  const out: { kind: EnemyKind; hpMult: number }[] = [];
  const hp = 1 + wave * 0.03;
  let budget = Math.min(60, 5 + wave * 2.6);
  if (wave % 5 === 0) {
    const elites: EnemyKind[] = wave % 10 === 0 ? ['commander', 'sentinel', 'breaker'] : ['commander', 'breaker'];
    for (const k of elites) out.push({ kind: k, hpMult: hp * 1.6 });
    budget *= 0.6;
  }
  const pool = UNLOCK.filter(([, w]) => wave >= w).map(([k]) => k);
  let guard = 0;
  while (budget >= 1.5 && guard++ < 80) {
    const k = pool[Math.floor(rng() * pool.length)];
    const c = COST[k]!;
    if (c > budget) { if (budget < 2) { out.push({ kind: 'devourer', hpMult: hp }); break; } continue; }
    if (ENEMIES[k].elite && out.filter((o) => ENEMIES[o.kind].elite).length >= 1 + Math.floor(wave / 6)) continue;
    out.push({ kind: k, hpMult: hp }); budget -= c;
  }
  return out;
}

export function buildSurvival(g: Game, m: Mission): Level {
  const L = new Level('survival', 'Arène de simulation', { skyTop: 0x05060c, skyHorizon: 0x2a1840, fog: 0x100a1c, fogDensity: 0.012, sun: 0xa090ff, sunIntensity: 1.5, sunDir: [0.3, 0.8, 0.4], hemiSky: 0x7a6ab0, hemiGround: 0x1a1420, hemiIntensity: 0.95, rift: true });
  m.level = L;
  L.bounds = { minX: -34, minZ: -34, maxX: 34, maxZ: 34 };
  L.spawn.set(0, 0.1, 0);
  L.floor('tiles', 0, 0, 64, 64);
  L.enclosure('darkmetal', -32, -32, 32, 32, 9);
  for (const s of [-1, 1]) { L.box('glow_violet', 0, 5, s * 31.6, 62, 0.12, 0.1, { collide: false }); L.box('glow_violet', s * 31.6, 5, 0, 0.1, 0.12, 62, { collide: false }); }
  // couverture
  for (const [x, z] of [[-14, -14], [14, -14], [-14, 14], [14, 14]]) { L.column(x, z, 7, 1.1, 'darkmetal'); L.lamp(x, 7.2, z, 'violet', true, 30, 24); }
  L.container(-22, 0, false, 'container_blue'); L.container(22, 0, false, 'container_red'); L.container(0, -22, true, 'container_green'); L.container(0, 22, true, 'container_blue');
  for (const [x, z, ax] of [[-7, -6, 1], [7, 6, 1], [-6, 8, 0], [6, -8, 0], [-20, -22, 1], [20, 22, 1], [-22, 18, 0], [22, -18, 0]] as [number, number, number][]) L.barrier(x, z, !!ax, 3);
  L.platform('grate', -24, -24, 8, 8, 2.6); L.stairs('metal', -16.4, -24, 'x-', 2.4, 9, 0.29, 0.4);
  L.platform('grate', 24, 24, 8, 8, 2.6); L.stairs('metal', 16.4, 24, 'x+', 2.4, 9, 0.29, 0.4);
  L.crate(-3, 0, 1.3); L.crate(3.2, 1, 1.1, 0, 'olive'); L.crate(10, -18, 1.4); L.crate(-10, 18, 1.4); L.crate(-10.2, 18, 1, 1.4, 'olive');
  L.lamp(0, 8.5, 0, 'white', true, 40, 34);
  const ammo = L.ammoCrate(0, 4);
  L.interact(ammo, 'Caisse de munitions', () => { g.weapons.refill(0.5); g.audio.reload(2); g.ui.hud.toast('MUNITIONS', '#ffb04a'); }, 2.6);
  dressSurvival(L);
  L.finish();

  const spawns: THREE.Vector3[] = [];
  for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; spawns.push(new THREE.Vector3(Math.cos(a) * 27, 0, Math.sin(a) * 27)); }
  const sv = { wave: 0, score: 0 };
  (m as any).survival = sv;
  let queue: { kind: EnemyKind; hpMult: number }[] = [];
  let spawnT = 0, phase: 'wait' | 'fight' | 'inter' = 'wait', waitT = 3, total = 0;

  const startWave = (n: number) => {
    sv.wave = n; queue = composeWave(n); total = queue.length; phase = 'fight'; spawnT = 1;
    g.ui.hud.banner(`VAGUE ${n}`, n % 5 === 0 ? 'Mini-boss en approche' : `${total} hostiles`);
    g.audio.alarm();
    if (n === 1) m.say('SYSTÈME', 'Protocole Infini engagé. Survivez aussi longtemps que possible.');
  };
  m.onEnemyKilled = (e) => { sv.score += e.def.xp * 5; };
  m.custom({
    text: 'Survivre aux vagues du Protocole Infini',
    done: () => false,
    progress: () => (phase === 'fight' ? `Vague ${sv.wave} — hostiles restants : ${queue.length + m.alive('wave')}` : 'Préparez-vous…'),
    update: (dt) => {
      if (phase === 'wait') { waitT -= dt; if (waitT <= 0) startWave(sv.wave + 1); return; }
      if (phase !== 'fight') return;
      spawnT -= dt;
      if (queue.length && spawnT <= 0 && m.alive('wave') < 12) {
        spawnT = 0.7;
        const q = queue.shift()!;
        // point d'apparition éloigné du joueur
        const far = spawns.filter((s) => s.distanceTo(g.player.pos) > 15);
        const s = far[Math.floor(Math.random() * far.length)] || spawns[0];
        m.portalSpawn('wave', [[q.kind, s.x + (Math.random() - 0.5) * 3, s.z + (Math.random() - 0.5) * 3, { hpMult: q.hpMult }]], 0.8);
        m.pending.set('wave', (m.pending.get('wave') || 0) + 1);
        g.after(0.85, () => m.pending.set('wave', (m.pending.get('wave') || 1) - 1));
      }
      if (!queue.length && m.alive('wave') === 0 && (m.pending.get('wave') || 0) <= 0) {
        phase = 'inter';
        sv.score += sv.wave * 150;
        g.gainXp(60 + sv.wave * 25, `Vague ${sv.wave} terminée`);
        g.weapons.refill(0.6); g.player.grenades = 2;
        if (sv.wave % 5 === 0) m.dropLoot('survival');
        g.autosaveSoon();
        const ups = sv.wave % 2 === 0 ? UPGRADES.slice().sort(() => Math.random() - 0.5).slice(0, 3) : null;
        g.after(1.2, () => g.ui.panels.intermission(sv.wave, sv.score, ups, (u) => {
          if (u) {
            for (const k of Object.keys(u.mods)) g.runMods[k] = (g.runMods[k] || 0) + u.mods[k];
            g.player.refreshStats(); g.applyRunMods(); g.weapons.rebuild(true);
            if (u.mods.maxHp) g.player.hp = Math.min(g.player.maxHp, g.player.hp + u.mods.maxHp);
          }
          phase = 'wait'; waitT = 2.5;
        }, () => g.finishSurvival()));
      }
    },
  });
  return L;
}
