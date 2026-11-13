// DÉFI D'ARMES — arène 1 contre 1 « trois voies, un étage » : la cour de chantier du barrage de Valmorre, de jour.
// Forme ovale et compacte : deux bases aux extrémités ouest et est, et entre elles trois voies :
//   voie A (nord) et voie C (sud) : au sol, autour du bloc central, couvertes par des piles de pneus ;
//   voie B (centre) : l'étage. On monte par l'escalier de sa base sur un conteneur, qui mène à la
//   plate-forme centrale (2,6 m) puis au conteneur d'en face. Position dominante, mais exposée.
// Depuis les voies A et C, des caisses permettent de grimper sur la plate-forme ; on en redescend en sautant.
// Disposition symétrique par rapport au centre : chaque élément a son jumeau en (-x, -z).
import * as THREE from 'three';
import type { Game } from '../core/Game';
import type { Mission } from '../mission/Mission';
import { Level } from '../world/Level';
import { backdrop } from '../world/Detail';
import { floodlight, hesco, supplies } from '../world/SetPieces';
import { mat, type MatName } from '../render/Materials';

const R = (a: number) => (a * Math.PI) / 180;
const DECK = 2.6; // hauteur de l'étage (= toit des conteneurs)

/** Points d'apparition (y = sol), tournés vers le centre. Les deux premiers servent au début de partie (hôte, invité). */
export const DUEL_SPAWNS: { pos: THREE.Vector3; yaw: number }[] = [
  [-25.5, 0], [25.5, 0], [-25, 7.5], [25, -7.5], [-25, -7.5], [25, 7.5],
].map(([x, z]) => ({ pos: new THREE.Vector3(x, 0.1, z), yaw: Math.atan2(x, z * 0.25) }));

/** Apparitions par équipe en 4v4 : rouge à l'ouest, bleu à l'est (y = sol). */
export const TEAM_SPAWNS: Record<'red' | 'blue', { pos: THREE.Vector3; yaw: number }[]> = {
  red: [[-25.5, 0], [-25, 7.5], [-25, -7.5], [-28.4, 3.6], [-28.4, -3.6], [-21.5, 12.6], [-21.5, -12.6]].map(([x, z]) => ({ pos: new THREE.Vector3(x, 0.1, z), yaw: Math.atan2(x, z * 0.25) })),
  blue: [[25.5, 0], [25, -7.5], [25, 7.5], [28.4, -3.6], [28.4, 3.6], [21.5, -12.6], [21.5, 12.6]].map(([x, z]) => ({ pos: new THREE.Vector3(x, 0.1, z), yaw: Math.atan2(x, z * 0.25) })),
};

/** Zones de Domination : A et C dans les voies (côté de chaque camp), B sur l'étage central. */
export const DOM_ZONES: { id: 'A' | 'B' | 'C'; pos: THREE.Vector3; r: number }[] = [
  { id: 'A', pos: new THREE.Vector3(-13, 0, 10.5), r: 4 },
  { id: 'B', pos: new THREE.Vector3(0, 2.6, 0), r: 4.2 },
  { id: 'C', pos: new THREE.Vector3(13, 0, -10.5), r: 4 },
];

const tireGeo = new THREE.TorusGeometry(0.36, 0.15, 8, 16).rotateX(Math.PI / 2);

export function buildDuel(_g: Game, m: Mission): Level {
  const L = new Level('duel', 'Chantier de Valmorre', {
    // jour couvert : lisibilité maximale, ombres franches mais pas noires
    skyTop: 0x4a6080, skyHorizon: 0xc8ccd0, fog: 0xa8aeb4, fogDensity: 0.0045, sun: 0xfff0d8, sunIntensity: 3.2, sunDir: [-0.45, 0.75, -0.35],
    hemiSky: 0xc0ccdc, hemiGround: 0x6a6258, hemiIntensity: 1.5, wet: 0.1, storm: 0, mist: 0.08, rays: 0.15, exposure: 1.25,
    saturation: 1.0, gradeShadow: 0x707a8a, gradeLight: 0xfff4e4,
  });
  m.level = L;
  L.theme = 'helix';
  L.bounds = { minX: -31, minZ: -18, maxX: 31, maxZ: 18 };
  L.spawn.copy(DUEL_SPAWNS[0].pos); L.spawnYaw = DUEL_SPAWNS[0].yaw;
  L.maxLights = 4;

  // sols : terre autour, dalle de béton fissurée au centre
  L.floor('dirt', 0, 0, 90, 64);
  L.box('concrete_damaged', 0, -0.98, 0, 36, 1, 22, { nav: false });
  L.enclosure('concrete_damaged', -30, -17, 30, 17, 3.2);

  /** Pose un élément et son jumeau symétrique (s = 1 puis -1). */
  const twin = (fn: (x: number, z: number, s: number) => void, x: number, z: number) => { fn(x, z, 1); fn(-x, -z, -1); };
  /** Pile de pneus (couvert bas, 1 m). */
  const tires = (x: number, z: number, n = 4) => {
    const tm = mat('black');
    for (const [ox, oz] of [[-0.45, -0.45], [0.45, -0.45], [-0.45, 0.45], [0.45, 0.45]]) for (let i = 0; i < n; i++) L.deco(tm, tireGeo, x + ox, 0.15 + i * 0.26, z + oz, 0, i * 0.7, 0);
    L.collider(x, 0, z, 1.8, 0.15 + n * 0.26, 1.8, 'dirt');
  };
  /** Bloc de béton (pilier de chantier) avec bande jaune au sommet. */
  const block = (x: number, z: number, h = 1.7) => { L.box('concrete', x, 0, z, 1.2, h, 1.2); L.box('paint_yellow', x, h - 0.12, z, 1.22, 0.12, 1.22, { collide: false }); };
  /** Mur de sacs de sable (bord de l'ovale). */
  const bags = (x0: number, x1: number, z: number, h = 1.6) => { L.box('sandbag', (x0 + x1) / 2, 0, z, x1 - x0, h, 1.0); };

  // ---------- bord ovale : barricades qui se resserrent vers les bases ----------
  twin((x, z) => bags(x - 4, x + 4, z), -20, 12.5);        // x ∈ [-24,-16]
  twin((x, z) => bags(x - 4, x + 4, z), -12, 14.5);        // x ∈ [-16,-8]
  twin((x, z) => bags(x - 4, x + 4, z), 12, 14.5);         // x ∈ [8,16]
  twin((x, z) => bags(x - 4, x + 4, z), 20, 12.5);         // x ∈ [16,24]
  // retours vers l'enceinte (aucune cache derrière les barricades)
  for (const [x, z0, z1] of [[-24, 12, 17], [-16, 12, 15], [-8, 14, 17], [8, 14, 17], [16, 12, 15], [24, 12, 17]] as [number, number, number][]) for (const s of [-1, 1]) L.box('sandbag', x, 0, s * (z0 + z1) / 2, 1, 1.6, z1 - z0);
  // pneus au pied des barricades (décor)
  for (let x = -14; x <= 14; x += 2.2) for (const s of [-1, 1]) if (Math.abs(x) > 7.5) for (let i = 0; i < 2; i++) L.deco(mat('black'), tireGeo, x, 0.15 + i * 0.26, s * 13.75, 0, x, 0);

  // ---------- centre : plate-forme (étage) et ses deux conteneurs ----------
  L.box('wood', 0, 0, 0, 12, DECK - 0.2, 9);
  L.box('wood', 0, DECK - 0.2, 0, 12.2, 0.2, 9.2);
  for (const sz of [-1, 1]) L.box('trim', 0, DECK - 0.24, sz * 4.62, 12.3, 0.24, 0.08, { collide: false });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) L.box('darkmetal', sx * 6, 0, sz * 4.5, 0.35, DECK + 1.1, 0.35, { collide: false });
  // parapets partiels (couvert sur l'étage) : côté nord à l'ouest, côté sud à l'est
  twin((x, z) => { L.box('wood', x, DECK, z, 5, 1.0, 0.25); L.box('trim', x, DECK + 1.0, z, 5.1, 0.08, 0.3, { collide: false }); }, -3.2, 4.4);
  // conteneur sur l'étage : couvert central
  L.container(0, 0, false, 'container_green', DECK);
  // conteneurs ouest (bleu) et est (rouge), dans l'axe : on marche sur leur toit
  L.container(-9.2, 0, true, 'container_blue');
  L.container(9.2, 0, true, 'container_red');
  // escaliers des bases vers les conteneurs
  L.stairs('metal', -16.6, 0, 'x+', 2.2, 9, 0.29, 0.48);
  L.stairs('metal', 16.6, 0, 'x-', 2.2, 9, 0.29, 0.48);
  // accès depuis les voies A et C : deux caisses en marchepied
  twin((x, z, s) => { L.crate(x, z, 1.3); L.crate(x + 1.35 * s, z + 0.6 * s, 1.3); }, 3.0, 5.3);
  // piliers de béton aux angles du bloc central
  twin((x, z) => block(x, z), -7.2, 5.6);
  twin((x, z) => block(x, z), 7.2, 5.6);

  // ---------- voies A (nord) et C (sud) ----------
  twin((x, z) => tires(x, z), -2.6, 9.6);
  twin((x, z) => tires(x, z, 3), 3.2, 11.2);
  twin((x, z) => L.barrier(x, z, true, 3), -12.5, 9.2);
  twin((x, z) => L.barrier(x, z, false, 2.4), 12.4, 8.8);

  // ---------- bases (x > 17 et x < -17) : rangées de blocs qui ouvrent sur les trois voies ----------
  twin((x, z) => block(x, z, 1.9), -18.4, 3.4);
  twin((x, z) => block(x, z, 1.9), -18.4, -3.4);
  twin((x, z) => block(x, z, 1.9), -18.4, 9.2);
  twin((x, z) => block(x, z, 1.9), -21.2, 9.2);
  twin((x, z) => hesco(L, x, z, false, 2), -22.6, -3.8);
  twin((x, z, s) => supplies(L, x, z, s > 0 ? 0 : Math.PI), -27.6, 3.6);
  // poste de garde au fond de chaque base
  twin((x, z) => {
    L.box('plaster', x, 0, z, 3, 2.8, 4.2);
    L.box('darkmetal', x, 2.8, z, 3.4, 0.2, 4.6, { collide: false });
    L.box('glass', x + Math.sign(x) * -1.52, 1.3, z, 0.05, 0.9, 1.6, { collide: false });
  }, -28.2, -8.6);

  // ---------- autour : pylônes, projecteurs, véhicules ----------
  twin((x, z, s) => floodlight(L, x, z, 9, s > 0 ? R(-135) : R(45)), 31.5, 17.5);
  twin((x, z, s) => floodlight(L, x, z, 9, s > 0 ? R(-45) : R(135)), 31.5, -17.5);
  L.vehicle(12, -21, true, 'truck', 0x4a4038);
  L.vehicle(-12, 21, true, 'truck', 0x38424a);
  L.box('plaster', 0, 0, -20.4, 6, 3, 3.4); L.box('darkmetal', 0, 3, -20.4, 6.4, 0.2, 3.8, { collide: false });
  L.box('plaster', 0, 0, 20.4, 6, 3, 3.4); L.box('darkmetal', 0, 3, 20.4, 6.4, 0.2, 3.8, { collide: false });

  // ---------- signalisation et marquage ----------
  for (const s of [-1, 1]) {
    const f = s < 0 ? 'x-' : 'x+';
    L.sign('VOIE A', s * 7.82, 0.9, 5.6, f, '#ffb04a', 1.1);
    L.sign('VOIE C', s * 7.82, 0.9, -5.6, f, '#6ab0ff', 1.1);
    L.sign('ÉTAGE', s * 12.25, 2.0, 0, f, '#ffffff', 1.6);
  }
  L.box('glow_orange', 0, 0.006, 8.2, 26, 0.01, 0.12, { collide: false, nav: false });
  L.box('glow_blue', 0, 0.006, -8.2, 26, 0.01, 0.12, { collide: false, nav: false });
  L.sign('CHANTIER DU BARRAGE — VALMORRE', 0, 2.6, -16.7, 'z+', '#e8d85a', 5);

  // éclairage d'appoint (le soleil fait l'essentiel)
  L.lamp(-24, 4, 0, 'white', true, 18, 16);
  L.lamp(24, 4, 0, 'white', true, 18, 16);

  backdrop(L, 'alpine');
  L.finish();
  return L;
}
