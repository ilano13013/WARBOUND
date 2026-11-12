// Passe « level art » : structures hautes, éléments techniques et militaires, vestiges, manifestations de la Fracture.
// Placés hors des axes de circulation ; les pièces sans collision sont en hauteur, contre les murs ou hors limites.
import type { Level } from '../world/Level';
import {
  banner, brazier, cliff, collapsedSlab, crystalCluster, generator, fire, floatingRocks, floodlight, floorCables, hesco, obelisk, pipeRack, powerLine,
  razorWire, riftCrack, serverRack, silo, smokeColumn, statue, supplies, tankTrap, tendrils, watchtower,
} from '../world/SetPieces';

const R = (a: number) => (a * Math.PI) / 180;

export function artOp1(L: Level): void {
  // --- approche : défenses de périmètre, épave en feu, colonnes de fumée sur l'horizon
  watchtower(L, -38, 13, 10, R(140)); watchtower(L, 38, 13, 10, R(-140));
  floodlight(L, -40, 42, 10, R(130)); floodlight(L, 40, 42, 10, R(-130));
  hesco(L, -21, 9.8, true, 4); hesco(L, 21, 9.8, true, 4); hesco(L, -15, 20, false, 2, 1.3);
  tankTrap(L, 5.4, 34); tankTrap(L, -5.6, 21); tankTrap(L, 6, 19); tankTrap(L, -6.4, 35);
  razorWire(L, -41.4, 14, -41.4, 40); razorWire(L, 41.4, 14, 41.4, 40); razorWire(L, -34, 43.6, -8, 43.6); razorWire(L, 8, 43.6, 34, 43.6);
  silo(L, 37, 39, 2.1, 8, 'metal'); silo(L, 32.4, 41, 1.5, 5.5, 'rust');
  fire(L, -30, 2.0, 26, 1.3);
  smokeColumn(L, -90, 0, -70, 70, 12, 0x15151a, 0.55); smokeColumn(L, 96, 0, 0, 60, 10, 0x15151a, 0.5); smokeColumn(L, 30, 0, 110, 55, 10, 0x18161a, 0.45);
  supplies(L, -23.4, 2.6, 0.2, true); supplies(L, -32.5, 3.2, 1.4);
  // --- cour : réseau de tuyauteries le long du laboratoire, cuves, éclairage de chantier
  pipeRack(L, -40, -38.2, 40, -38.2, 5.6, 4);
  silo(L, -38.6, -36, 1.5, 6.5, 'rust'); silo(L, 39.6, -4.4, 1.4, 6, 'metal');
  floodlight(L, -40.6, -3, 9, R(110)); floodlight(L, 40.6, -34, 9, R(-60));
  supplies(L, 17.5, -3.4, 0.5, true); supplies(L, -18.6, -6.2, 1.2);
  riftCrack(L, -14, -31, 7, R(60)); crystalCluster(L, -19.5, -33.5, 0.7);
  // groupe électrogène près du terminal de remise sous tension (le terminal et son interaction sont inchangés)
  generator(L, 27.2, -16.4, R(200)); floorCables(L, [[27.4, -16.9], [27.9, -18], [28.3, -18.8]], 2, 0.03);
  // --- laboratoire : baies de calcul, câbles d'alimentation, contamination
  serverRack(L, -13, -72.9, true, 3); serverRack(L, 13, -72.9, true, 3);
  floorCables(L, [[-17.6, -77.4], [-13, -84], [-5, -92], [-1.2, -96.6]]); floorCables(L, [[17.6, -77.4], [12, -86], [5, -93], [1.2, -96.6]]);
  floorCables(L, [[-17.6, -101], [-9, -100], [-1.4, -97.6]], 2, 0.05);
  crystalCluster(L, -39.6, -78.6, 0.9); crystalCluster(L, 39.6, -97.6, 0.9, 'crystal_red');
  tendrils(L, -40.7, 0.2, -86, 1, 0, 6, 4.2); tendrils(L, 40.7, 0.2, -90, -1, 0, 6, 4.2);
  riftCrack(L, -30, -82, 6, R(150)); riftCrack(L, 31, -94, 6, R(-20), 'red');
  // salle du réacteur : la Fracture perce le sol autour du noyau
  for (const [x, z, a] of [[-18, -124, 40], [19, -150, 200], [-20, -156, 120], [18, -120, -50]]) riftCrack(L, x, z, 8, R(a), 'red', 0.2);
  tendrils(L, -26.6, 0.2, -136, 1, 0, 7, 5); tendrils(L, 26.6, 0.2, -136, -1, 0, 7, 5);
}

export function artOp2(L: Level): void {
  // --- ville en guerre : lignes électriques, incendies, fumées, dalles effondrées
  powerLine(L, [[11.7, 6], [11.7, -14], [11.7, -46], [11.7, -68]], 9);
  powerLine(L, [[-28.6, 40], [-28.6, 18], [-12.4, 8]], 8.5);
  fire(L, -18, 1.2, 30, 1.1); fire(L, -4, 2.4, -14, 1.2); fire(L, 5, 2.2, -46, 1.3);
  smokeColumn(L, -70, 18, -40, 70, 14, 0x121218, 0.55); smokeColumn(L, 78, 20, -120, 70, 14, 0x121218, 0.55); smokeColumn(L, -20, 20, -230, 60, 12, 0x14121a, 0.5); smokeColumn(L, 60, 16, 70, 60, 12, 0x121218, 0.5);
  collapsedSlab(L, 25, 13.5, R(10), 5); collapsedSlab(L, -26, 39, R(-20), 4.5); collapsedSlab(L, -21, -67, R(80), 4);
  floodlight(L, 28.4, 39.6, 7, R(-140), 0xfff0d0); supplies(L, 26.4, 36.6, 0.3, true); hesco(L, -2, 39.5, true, 3, 1.3);
  // --- contamination : fissures dans la chaussée, excroissances sur les façades, débris en lévitation près du portail
  riftCrack(L, -3, -2, 9, R(20)); riftCrack(L, 3, -30, 8, R(-30)); riftCrack(L, -6, -62, 10, R(10)); riftCrack(L, -10, -84, 10, R(120));
  riftCrack(L, 6, -122, 12, R(160), 'violet', 0.22); riftCrack(L, -8, -150, 12, R(30), 'violet', 0.22); riftCrack(L, 14, -140, 8, R(-80), 'red');
  tendrils(L, -12.8, 0.2, -8, 1, 0, 6, 6); tendrils(L, 12.8, 0.2, -40, -1, 0, 6, 8); tendrils(L, -12.8, 0.2, -56, 1, 0, 7, 9); tendrils(L, 12.8, 0.2, 0, -1, 0, 5, 5);
  tendrils(L, -29.8, 0.2, -130, 1, 0, 8, 10); tendrils(L, 29.8, 0.2, -146, -1, 0, 8, 10);
  crystalCluster(L, -12.2, -30, 0.8); crystalCluster(L, 12.2, -66, 0.9, 'crystal_red'); crystalCluster(L, -27, -116, 1.3); crystalCluster(L, 27, -162, 1.3, 'crystal_red');
  floatingRocks(L, 0, 13, -140, 9, 11, 'rubble'); floatingRocks(L, -18, 9, -120, 4, 4, 'rubble'); floatingRocks(L, 0, 16, -40, 5, 5, 'rubble');
  // extraction
  floodlight(L, -9.6, -168.4, 7, R(150), 0xd8ffe8); floodlight(L, 9.6, -168.4, 7, R(-150), 0xd8ffe8);
}

export function artOp3(L: Level): void {
  // --- falaises périphériques (Rock Face 01) : dominent l'enceinte du site
  for (let i = 0; i < 11; i++) { const z = 34 - i * 23, h = 17 + ((i * 7) % 5) * 1.6; cliff(L, -58, z, h, R(90)); cliff(L, 58, z - 9, h + 1.5, R(-90)); }
  for (const x of [-34, -11, 12, 35]) { cliff(L, x, 55, 16, R(180)); cliff(L, x + 6, -213, 22, 0); }
  // affleurements au pied des murs (remplacent WallRocks)
  cliff(L, -43.4, 12, 5.5, R(90), 0.06, true); cliff(L, 43.4, -4, 5.5, R(-90), 0.06, true);
  // --- ruines : gardiens de pierre, obélisques, braseros, bannières du culte
  statue(L, -40, 34, 12, R(120)); statue(L, 40, 34, 12, R(-120)); statue(L, -41, -22, 10, R(90)); statue(L, 41, -24, 10, R(-90));
  obelisk(L, -20, 26, 7); obelisk(L, 21, 12, 6); obelisk(L, -30, -12, 8); obelisk(L, 34, 22, 7); obelisk(L, 36, -24, 6);
  brazier(L, -3.6, 37); brazier(L, 3.6, 37); brazier(L, -8.2, 0); brazier(L, 8.2, 12); brazier(L, -4.6, -27.6); brazier(L, 4.6, -27.6);
  banner(L, -2.2, 6.6, 23.2, 0, 4); banner(L, 2.2, 6.6, 23.2, 0, 4); banner(L, -2.6, 7.6, -11.2, 0, 4.6); banner(L, 2.6, 7.6, -11.2, 0, 4.6);
  for (const x of [-9, 9, -17, 17]) banner(L, x, 11.5, -28.9, 0, 6);
  riftCrack(L, -16, 12, 9, R(70)); riftCrack(L, 20, -10, 8, R(-40)); riftCrack(L, -24, -24, 7, R(10), 'red');
  floatingRocks(L, -34, 12, 8, 6, 6, 'stone'); floatingRocks(L, 36, 14, 14, 6, 6, 'stone'); floatingRocks(L, 0, 20, 8, 7, 12, 'stone');
  tendrils(L, -45.9, 0.2, 8, 1, 0, 7, 7); tendrils(L, 45.9, 0.2, -2, -1, 0, 7, 7);
  // --- salle des sceaux
  statue(L, -21.5, -34, 9, R(90)); statue(L, 21.5, -34, 9, R(-90));
  for (const z of [-42, -54, -66]) { banner(L, -23.9, 10.5, z, R(90), 6.5); banner(L, 23.9, 10.5, z, R(-90), 6.5); }
  brazier(L, -21, -46); brazier(L, 21, -46); brazier(L, -21, -62); brazier(L, 21, -62);
  // --- antichambre et galeries
  obelisk(L, -36, -84.5, 6); obelisk(L, 36, -84.5, 6);
  brazier(L, -6, -84); brazier(L, 6, -84); brazier(L, -36.5, -122); brazier(L, 36.5, -122);
  for (const x of [-30, -18, 18, 30]) banner(L, x, 9.5, -124.9, 0, 6);
  crystalCluster(L, -37.5, -104, 1.2); crystalCluster(L, 37.5, -100, 1.2, 'crystal_red');
  // --- sanctuaire : statues colossales, bannières monumentales, Fracture sous le trône
  statue(L, -26, -132, 13, R(60)); statue(L, 26, -132, 13, R(-60)); statue(L, -26, -188, 13, R(120)); statue(L, 26, -188, 13, R(-120));
  for (const z of [-146, -160, -174]) { banner(L, -28.9, 14, z, R(90), 9); banner(L, 28.9, 14, z, R(-90), 9); }
  for (const [x, z, a] of [[-14, -176, 30], [14, -176, -30], [-18, -150, 100], [18, -150, -100]]) riftCrack(L, x, z, 9, R(a), 'violet', 0.22);
  floatingRocks(L, 0, 13, -160, 10, 16, 'stone');
}

export function artOp4(L: Level): void {
  // --- ligne de défense : miradors, gabions, obstacles antichars, fumées et incendies
  watchtower(L, -44, 40, 11, R(140)); watchtower(L, 44, 40, 11, R(-140)); watchtower(L, -45, -34, 11, R(60)); watchtower(L, 45, -34, 11, R(-60));
  floodlight(L, -49, 12, 10, R(100), 0xffd8c8); floodlight(L, 49, -6, 10, R(-100), 0xffd8c8);
  hesco(L, -34, 26, true, 4); hesco(L, 34, 24, true, 4); hesco(L, -40, -6, false, 3); hesco(L, 40, -24, false, 3);
  for (const [x, z] of [[-6, 40], [6, 38], [-12, 36], [12, 41], [0, 42.5]]) tankTrap(L, x, z);
  razorWire(L, -24, 41, -8, 41); razorWire(L, 8, 41, 24, 41); razorWire(L, -49, 30, -38, 30); razorWire(L, 38, 14, 49, 14);
  supplies(L, -38, 20, 0.4, true); supplies(L, 39, 8.4, 1.2); supplies(L, -27, -30.6, 0.2, true); supplies(L, 40, -32, 0.9, true);
  silo(L, -46.4, -27, 1.7, 7, 'rust'); silo(L, 46.4, 28, 1.7, 7, 'metal');
  fire(L, 18, 2.6, 30, 1.3); fire(L, -30, 2.4, -20, 1.2);
  smokeColumn(L, -100, 0, -40, 80, 14, 0x161016, 0.55); smokeColumn(L, 104, 0, -120, 80, 14, 0x161016, 0.55); smokeColumn(L, -40, 0, 100, 60, 12, 0x161016, 0.5);
  pipeRack(L, -49, -37.6, -6, -37.6, 6.4, 4); pipeRack(L, 6, -37.6, 49, -37.6, 6.4, 4);
  // la Fracture progresse sous les défenses
  riftCrack(L, -20, 16, 10, R(100)); riftCrack(L, 22, 0, 9, R(-70), 'red'); riftCrack(L, -8, -30, 8, R(20)); riftCrack(L, 30, 34, 7, R(200), 'red');
  crystalCluster(L, -47, 2, 1.2, 'crystal_red'); crystalCluster(L, 47, 20, 1.1); crystalCluster(L, -46, -16, 0.9);
  // --- complexe : câbles et baies le long des murs, corruption
  serverRack(L, -47.6, -50, false, 4); serverRack(L, 47.6, -100, false, 4);
  tendrils(L, -49.2, 0.2, -70, 1, 0, 8, 7); tendrils(L, 49.2, 0.2, -80, -1, 0, 8, 7); tendrils(L, 0, 0.2, -110.6, 0, 1, 9, 7);
  crystalCluster(L, -48, -108, 1.2, 'crystal_red'); crystalCluster(L, 48, -44.6, 1.1);
  // falaises soulevées par la Fracture autour de la zone altérée et du noyau (Rock Face 01)
  for (const z of [-118, -140, -162]) { cliff(L, -62, z, 17, R(90)); cliff(L, 62, z - 8, 18, R(-90)); }
  for (const z of [-200, -226]) { cliff(L, -62, z, 21, R(90)); cliff(L, 62, z - 10, 20, R(-90)); }
  for (const x of [-30, 0, 30]) cliff(L, x, -258, 24, 0);
  cliff(L, -47.6, -148, 6, R(90), 0.06, true); cliff(L, 47.8, -130, 6, R(-90), 0.06, true);
  // --- zone altérée : sol éventré, roches en lévitation, cristaux géants
  for (const [x, z, a, c] of [[-30, -118, 80, 0], [10, -122, 150, 1], [-16, -140, 20, 0], [24, -134, -60, 1], [-36, -154, 110, 1], [6, -156, 200, 0], [38, -160, -20, 0], [-4, -128, 60, 1]] as [number, number, number, number][]) riftCrack(L, x, z, 11, R(a), c ? 'red' : 'violet', 0.26);
  crystalCluster(L, -44, -124, 2.2, 'crystal', true); crystalCluster(L, 45, -142, 2.4, 'crystal_red', true); crystalCluster(L, -45, -158, 1.8, 'crystal_red', true); crystalCluster(L, 44, -116, 1.6, 'crystal', true);
  floatingRocks(L, -20, 12, -130, 8, 10); floatingRocks(L, 22, 14, -150, 8, 10, 'rock', 'glow_red'); floatingRocks(L, 0, 22, -140, 8, 16);
  tendrils(L, -49.6, 0.2, -138, 1, 0, 9, 9); tendrils(L, 49.6, 0.2, -128, -1, 0, 9, 9);
  // --- parvis et noyau
  obelisk(L, -38, -172, 9); obelisk(L, 38, -172, 9); brazier(L, -6.4, -186.6, 1.2); brazier(L, 6.4, -186.6, 1.2);
  for (const x of [-30, -16, 16, 30]) banner(L, x, 12.5, -189.1, 0, 7, 0x5a1420, 'glow_red');
  for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2 + 0.2; riftCrack(L, Math.sin(a) * 9, -218 + Math.cos(a) * 9, 13, a, i % 2 ? 'red' : 'violet', 0.28); }
  floatingRocks(L, 0, 20, -218, 14, 20, 'rock', 'glow_red');
  tendrils(L, -49.4, 0.2, -218, 1, 0, 10, 11); tendrils(L, 49.4, 0.2, -218, -1, 0, 10, 11); tendrils(L, 0, 0.2, -245.4, 0, 1, 12, 11);
}

export function artHub(L: Level): void {
  // hangar : bannières d'unité, stocks, câbles d'alimentation de la table tactique, éclairage de piste
  for (const x of [-14, 14]) banner(L, x, 7, 24.3, R(180), 4.5, 0x1c2a3c, 'paint_white');
  for (const z of [-10, 10]) { banner(L, -20.6, 7, z, R(90), 4.5, 0x1c2a3c, 'paint_white'); banner(L, 20.6, 7, z, R(-90), 4.5, 0x1c2a3c, 'paint_white'); }
  supplies(L, -17.6, 22.6, 0.2, true); supplies(L, 18.4, 14, 1.3, true); supplies(L, 17.6, 22.8, 0.5);
  floorCables(L, [[-20.2, 3], [-12, 2], [-5, 1], [-2.3, 0.4]], 3, 0.035); floorCables(L, [[20.2, -3], [12, -2], [5, -1], [2.3, -0.4]], 3, 0.035);
  // zone d'entraînement : miradors, projecteurs, défenses
  watchtower(L, -12.6, -24.6, 7, R(160), false); floodlight(L, 13.6, -24, 8, R(-150)); floodlight(L, 13.8, -54.6, 8, R(-30)); floodlight(L, -13.8, -54.6, 8, R(30));
  hesco(L, 0, -54.4, true, 5, 1.6); razorWire(L, -14, -23.2, -4, -23.2); razorWire(L, 4, -23.2, 14, -23.2);
  smokeColumn(L, 70, 0, -90, 50, 9, 0x1a1c20, 0.4);
}

export function artSurvival(L: Level): void {
  for (const [x, z, a, c] of [[-20, -8, 30, 0], [18, 12, 200, 1], [-6, 22, 110, 0], [8, -22, -40, 1]] as [number, number, number, number][]) riftCrack(L, x, z, 9, R(a), c ? 'red' : 'violet');
  floatingRocks(L, 0, 16, 0, 12, 22, 'rock');
  for (const [x, z] of [[-30.4, -30.4], [30.4, -30.4], [-30.4, 30.4], [30.4, 30.4]]) crystalCluster(L, x, z, 1.6, x * z > 0 ? 'crystal' : 'crystal_red');
  tendrils(L, -31.4, 0.2, 0, 1, 0, 9, 8); tendrils(L, 31.4, 0.2, 0, -1, 0, 9, 8); tendrils(L, 0, 0.2, -31.4, 0, 1, 9, 8); tendrils(L, 0, 0.2, 31.4, 0, -1, 9, 8);
}
