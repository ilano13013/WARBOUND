// DÉFI D'ARMES — arène 1 contre 1 : le dépôt de maintenance du barrage de Valmorre, de nuit sous la pluie.
// Disposition symétrique par rapport au centre (chaque couvert a son jumeau en (-x, -z)) pour que les deux camps soient égaux.
import * as THREE from 'three';
import type { Game } from '../core/Game';
import type { Mission } from '../mission/Mission';
import { Level } from '../world/Level';
import { backdrop } from '../world/Detail';
import { floodlight, hesco } from '../world/SetPieces';

const R = (a: number) => (a * Math.PI) / 180;

/** Points d'apparition (y = sol). Les deux premiers sont ceux du début de partie (hôte, invité). */
export const DUEL_SPAWNS: { pos: THREE.Vector3; yaw: number }[] = [
  [-26, -18], [26, 18], [-26, 13], [26, -13], [-4, -19.5], [4, 19.5], [-27, -2], [27, 2],
].map(([x, z]) => ({ pos: new THREE.Vector3(x, 0.1, z), yaw: Math.atan2(x, z) }));

export function buildDuel(_g: Game, m: Mission): Level {
  const L = new Level('duel', 'Dépôt de Valmorre', {
    skyTop: 0x04060c, skyHorizon: 0x26303e, fog: 0x161c26, fogDensity: 0.012, sun: 0xa8bcd8, sunIntensity: 1.7, sunDir: [-0.35, 0.55, -0.6],
    hemiSky: 0x5a6a86, hemiGround: 0x1c1e22, hemiIntensity: 1.0, wet: 1, storm: 0.6, mist: 0.35, rays: 0.12, exposure: 1.4,
    saturation: 0.85, gradeShadow: 0x7088b0, gradeLight: 0xe6ecff, weather: 'rain',
  });
  m.level = L;
  L.theme = 'helix';
  L.bounds = { minX: -32, minZ: -24, maxX: 32, maxZ: 24 };
  L.spawn.copy(DUEL_SPAWNS[0].pos); L.spawnYaw = DUEL_SPAWNS[0].yaw;
  L.maxLights = 6;

  L.floor('asphalt', 0, 0, 64, 48);
  L.enclosure('darkconcrete', -30, -22, 30, 22, 5);
  // bandes jaunes au sol (lisibilité des allées)
  for (const s of [-1, 1]) L.box('paint_yellow', s * 10, 0.005, 0, 0.18, 0.01, 30, { collide: false, nav: false });

  /** Pose un élément et son jumeau symétrique. */
  const twin = (fn: (x: number, z: number, s: number) => void, x: number, z: number) => { fn(x, z, 1); fn(-x, -z, -1); };

  // passerelle centrale à deux escaliers : position dominante mais exposée
  L.platform('grate', 0, 0, 8, 4, 2.6);
  L.stairs('metal', 7.6, 0, 'x-', 2.4, 9, 0.29, 0.4);
  L.stairs('metal', -7.6, 0, 'x+', 2.4, 9, 0.29, 0.4);
  L.box('darkmetal', 0, 0, 0, 2.4, 2.3, 1.4); // pilier sous la passerelle (couvert au sol)

  // conteneurs et couverts lourds
  twin((x, z) => L.container(x, z, true, x < 0 ? 'container_blue' : 'container_red'), -12, 9);
  twin((x, z) => L.container(x, z, false, 'container_green'), -21, -9);
  twin((x, z, s) => L.vehicle(x, z, true, 'truck', s > 0 ? 0x3a4048 : 0x40382e), -19, 17);
  twin((x, z) => hesco(L, x, z, true, 3), 6, -14);
  // couverts légers
  twin((x, z) => L.barrier(x, z, true, 3), -5, -8.5);
  twin((x, z) => L.barrier(x, z, false, 3), -25, 3);
  twin((x, z) => L.sandbags(x, z, false, 3), 14, 2);
  twin((x, z) => { L.crate(x, z, 1.3); L.crate(x + 1.2, z + 0.2, 1, 0, 'olive'); }, -14, -16);
  twin((x, z) => L.crate(x, z, 1.2), 22, -18);
  twin((x, z) => L.barrelDeco(x, z), -9, 18);
  twin((x, z) => L.barrelDeco(x, z, 'darkmetal'), -8.2, 18.6);
  twin((x, z) => L.machine(x, z, 2.2, 1.4, 2.4, 'glow_blue'), 27.4, -19);

  // éclairage
  twin((x, z, s) => floodlight(L, x, z, 8, s > 0 ? R(-135) : R(45)), 28.5, 20.5);
  twin((x, z, s) => floodlight(L, x, z, 8, s > 0 ? R(-45) : R(135)), 28.5, -20.5);
  L.lamp(0, 5.2, 0, 'white', true, 26, 20);
  L.lamp(-12, 4.2, 9, 'orange', false); L.lamp(12, 4.2, -9, 'orange', false);
  L.sign('DÉPÔT 3 — VALMORRE', 0, 3.6, -21.7, 'z+', '#e8d85a', 4);
  L.sign('ACCÈS BARRAGE', 0, 3.6, 21.7, 'z-', '#e8d85a', 3.4);

  backdrop(L, 'alpine');
  L.finish();
  return L;
}
