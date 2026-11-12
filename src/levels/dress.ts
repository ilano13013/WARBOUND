// Habillage des niveaux avec les décors glTF (Quaternius, CC0). Placés le long des murs et près des couvertures
// existantes pour ne jamais obstruer les passages ; seuls les grands objets reçoivent une collision.
import * as THREE from 'three';
import type { Level } from '../world/Level';
import { artHub, artOp1, artOp2, artOp3, artOp4, artSurvival } from './art';

const R = (a: number) => (a * Math.PI) / 180;
/** Arbre mort avec tronc solide (la ramure reste traversable). */
function tree(L: Level, name: string, x: number, z: number, h: number, ry = 0): void { if (L.prop(name, x, 0, z, ry, h)) L.collider(x, 0, z, 0.5, h * 0.6, 0.5, 'dirt'); }
function rocks(L: Level, pts: [number, number, number][], kind = 'Rock_Moss_'): void { pts.forEach(([x, z, h], i) => L.prop(`${kind}${(i % 7) + 1}`, x, 0, z, i * 1.7, h, h > 0.9, 'concrete')); }

export function dressOp1(L: Level): void {
  artOp1(L);
  // extérieur : forêt morte, rochers, épave de char, éclairage de la route
  ([[-30, 38, 7], [32, 24, 6], [-36, 14, 8], [36, 40, 7], [-22, 40, 6], [26, 36, 5], [-38, 30, 6]] as [number, number, number][]).forEach(([x, z, h], i) => tree(L, i % 2 ? 'CommonTree_Dead_' + ((i % 3) + 1) : 'Willow_Dead_' + ((i % 3) + 1), x, z, h, i));
  rocks(L, [[-12, 36, 0.8], [18, 32, 1.2], [-28, 22, 1.5], [30, 10, 0.9], [-40, 2, 1.6], [40, -4, 1.4], [-6, 40, 0.7], [12, 41, 1.1]]);
  L.prop('Tank2', -30, 0, 26, R(35), 2.6, true);
  for (const z of [34, 22]) { L.prop('Light_Street_1', -5.6, 0, z, R(90), 5); L.prop('Light_Street_1', 5.6, 0, z, R(-90), 5); }
  L.prop('Sign_Corner_Hazard', -4.6, 0, 9.4, 0, 1.6); L.prop('Sign_Corner_Hazard', 4.6, 0, 9.4, R(180), 1.6);
  // cour
  L.prop('Props_ContainerFull', -24, 0, -36, R(90), 2.3, true); L.prop('Props_CrateLong', 20, 0, -38.5, 0, 0.9, true); L.prop('Props_Crate', 22.4, 0, -38.4, 0, 0.9, true);
  L.prop('GasCan', 7, 0, -11.2, 0, 0.45); L.prop('PropaneTank', -15.6, 0, -12.6, 0, 1.2, true); L.prop('Trashcan', 2.8, 0, -6.6, 0, 1);
  // générateur et baraquements
  L.prop('Computer_Large', 37.6, 0, -14, R(-90), 2.1, true); L.prop('AC_Stacked', 38, 0, -26, R(-90), 2, true); L.prop('Props_Crate', 24.5, 0, -27.5, 0.3, 1, true);
  L.prop('Radio', -28.4, 0.93, -15.2, 0.4, 0.3); L.prop('FirstAidKit', -27.4, 0.93, -14.8, 0, 0.2); L.prop('Trashcan', -22.5, 0, -28.4, 0, 1);
  // hall du laboratoire
  for (const z of [-44, -50]) L.prop('Props_Shelf_Tall', 12.8, 0, z, R(-90), 2.6, true);
  L.prop('Props_Computer', -12.6, 0, -48, R(90), 1.5, true); L.prop('Props_Capsule', -12.4, 0, -44.2, R(90), 2.3, true); L.prop('Props_ComputerSmall', -5, 0.93, -47, 0, 0.5);
  // atrium : capsules à spécimens, cuves, colonnes sci-fi
  for (const [x, z] of [[-20.4, -82], [-20.4, -94], [20.4, -86], [20.4, -98]]) L.prop('Props_Pod', x, 0, z, R(x < 0 ? 90 : -90), 2.6, true);
  for (const [x, z] of [[-6, -104.6], [6, -104.6]]) L.prop('Props_Vessel_Tall', x, 0, z, 0, 2.8, true);
  for (const [x, z] of [[-21, -73], [21, -73], [-21, -105], [21, -105]]) L.prop('Column_1', x, 0, z, 0, 6, false);
  L.prop('Props_Laser', 8, 0.93, -100, 0, 0.6);
  // salle du réacteur
  for (const [x, z] of [[-25.5, -112], [25.5, -112], [-25.5, -160], [25.5, -160]]) L.prop('Props_Base', x, 0, z, 0, 1.2, true);
  for (const [x, z] of [[-24.5, -128], [24.5, -144]]) L.prop('Props_Vessel_Tall', x, 0, z, 0, 3.2, true);
  L.prop('Turret_Gun', -25, 1.2, -112, R(45), 1.2); L.prop('Turret_Gun', 25, 1.2, -112, R(-45), 1.2);
}

export function dressOp2(L: Level): void {
  artOp2(L);
  // rues : lampadaires, feux, panneaux, poubelles, épaves blindées
  for (const z of [-2, -26, -46, -62]) { L.prop('Streetlight_Double', -11.4, 0, z, R(90), 6.5); }
  for (const z of [-14, -36, -58]) L.prop('Streetlight_Single', 11.4, 0, z, R(-90), 6);
  L.prop('TrafficLight', -11.2, 0, -70, R(90), 5.5); L.prop('TrafficLight', 11.2, 0, -70, R(-90), 5.5);
  L.prop('Sign_Stop', 11.5, 0, 8, R(-90), 2.4); L.prop('Sign_Triangle', -11.5, 0, -32, R(90), 2.4); L.prop('Sign_NoParking', 11.5, 0, -44, R(-90), 2.4);
  for (const [x, z] of [[-12, 4], [12, -20], [-12, -52], [12, -66], [-26, 30], [27, 18]]) L.prop('Trashcan', x, 0, z, x, 1);
  L.prop('Tank2', -27, 0, 30, R(-20), 2.6, true);
  L.prop('Tank', -24, 0, -106, R(70), 2.6, true);
  L.prop('Tank', 26, 0, -128, R(200), 2.6, true);
  for (const [x, z] of [[9, 24], [-8, -42], [7, -63], [-15, -119]]) L.prop('GasCan', x, 0, z, x, 0.45);
  rocks(L, [[-6, 12, 0.8], [8, -2, 0.7], [-9, -26, 0.9], [7, -59, 0.8], [-12, -134, 1], [12, -118, 0.9], [-5, -181, 0.8]], 'Rock_');
  // place du portail : roches de la Fracture
  rocks(L, [[-26, -150, 1.8], [26, -152, 2], [-20, -160, 1.4], [20, -162, 1.6], [0, -165, 1.2]], 'Rock_');
}

export function dressOp3(L: Level): void {
  artOp3(L);
  // ruines : colonnes brisées, rochers, ossements, torches
  for (const [x, z, n] of [[-14, 32, 'Column_Broken'], [15, 22, 'Column_Broken2'], [-24, 4, 'Column_Broken'], [26, -12, 'Column_Broken2'], [-30, -16, 'Column_Broken'], [32, 30, 'Column_Broken']] as [number, number, string][]) L.prop(n, x, 0, z, x, 3.4, true, 'concrete');
  for (const [x, z] of [[-10, 26], [12, 6], [-18, -10], [20, -26], [4, 38], [-4, -28]]) { L.prop('Bones', x, 0, z, x, 0.3); }
  for (const [x, z] of [[-8, 14], [9, -4], [-27, 28], [28, 14]]) L.prop('Skull', x, 0, z, x, 0.25);
  rocks(L, [[-40, 36, 2.2], [40, 20, 2], [-42, -8, 2.6], [42, -24, 2.4], [-36, -28, 1.8], [36, 40, 2.1]], 'Rock_Moss_');
  // WallRocks : conservé en repli si la falaise Poly Haven (placée dans art.ts) n'est pas chargée
  if (!L.propSize('ph_rockface#rock_face_01')) { L.prop('WallRocks', -44, 0, 12, R(90), 3); L.prop('WallRocks', 44, 0, -4, R(-90), 3); }
  // salle des sceaux : bannières, candélabres, torches murales
  for (const z of [-40, -56, -72]) { L.prop('Banner_wall', -24, 4.5, z, R(90), 3.4); L.prop('Banner_wall', 24, 4.5, z, R(-90), 3.4); }
  for (const [x, z] of [[-8, -34], [8, -34], [-8, -66], [8, -50]]) L.prop('Candelabrum_tall', x, 0, z, 0, 2.2, true);
  for (const [x, z] of [[-38.8, -96], [38.8, -110], [-38.8, -110], [38.8, -96]]) L.prop('Torch_wall', x, 2.6, z, R(x < 0 ? 90 : -90), 1);
  // sanctuaire
  for (const [x, z] of [[-6, -182], [6, -182]]) L.prop('Pedestal2', x, 0, z, 0, 1.3, true);
  for (const [x, z] of [[-26, -134], [26, -134], [-26, -188], [26, -188]]) L.prop('Torch', x, 0, z, 0, 2.2, true);
  L.prop('Spikes', -14, 0, -194, 0, 0.6); L.prop('Spikes', 14, 0, -194, 0, 0.6);
}

export function dressOp4(L: Level): void {
  artOp4(L);
  // défenses : arbres morts, rochers, antennes, climatiseurs sur les bunkers
  ([[-44, 40, 7], [44, 14, 6], [-46, -22, 8], [46, 38, 6], [-30, 42, 5]] as [number, number, number][]).forEach(([x, z, h], i) => tree(L, 'CommonTree_Dead_' + ((i % 3) + 1), x, z, h, i));
  L.prop('Antenna_1', -22, 3.4, 4, 0, 2.6); L.prop('Antenna_1', 22, 3.4, -12, 0, 2.6);
  L.prop('AC', -26, 3.4, 8, 0, 0.8); L.prop('AC', 25, 3.4, -8, 0, 0.8);
  rocks(L, [[-40, 22, 1.6], [40, 30, 1.4], [-42, -4, 1.2], [44, -10, 1.8], [-10, 40, 0.9], [12, 38, 1.1]], 'Rock_');
  // complexe des stabilisateurs
  for (const [x, z] of [[-46, -64], [46, -70], [-46, -80], [46, -84]]) L.prop('Props_ContainerFull', x, 0, z, R(90), 2.4, true);
  for (const [x, z] of [[-30, -104], [30, -104]]) L.prop('Computer_Large', x, 0, z, 0, 2.2, true);
  for (const [x, z] of [[-14, -46], [14, -46], [-14, -106], [14, -106]]) L.prop('Turret_Gun', x, 0, z, x > 0 ? R(-30) : R(30), 1.4, true);
  for (const [x, z] of [[-40, -48], [40, -96], [-3, -58]]) L.prop('Props_Crate', x, 0, z, x, 1, true);
  // zone altérée et noyau
  rocks(L, [[-30, -120, 2.4], [32, -126, 2.2], [-20, -150, 1.8], [24, -158, 2.6], [-44, -140, 3], [44, -140, 2.8]], 'Rock_');
  for (const [x, z] of [[-16, -200], [16, -200], [-16, -236], [16, -236]]) L.prop('Props_Teleporter_1', x, 1.5, z, 0, 0.5);
}

export function dressHub(L: Level): void {
  artHub(L);
  L.prop('Props_Shelf_Tall', -20, 0, -1, R(90), 2.8, true); L.prop('Props_Shelf_Tall', -20, 0, 2, R(90), 2.8, true);
  L.prop('Props_Crate', -12, 0, 15, 0.2, 1, true); L.prop('Props_CrateLong', -10, 0, 13.8, 0, 0.9, true);
  L.prop('Radio', -15.2, 0.93, 9.4, 0.3, 0.3); L.prop('FirstAidKit', -15.6, 0.93, 6.6, 0, 0.2);
  L.prop('Computer_Large', 20, 0, -16, R(-90), 2.1, true); L.prop('Computer', 8, 0, -20.6, 0, 1.4, true);
  L.prop('Props_Teleporter_1', 18.6, 0, -8, 0, 0.45);
  L.prop('Tank', 13, 0, 4.5, R(-90), 2.4, true);
  for (const [x, z] of [[-20.2, 22], [20.2, -20]]) L.prop('Props_ContainerFull', x, 0, z, R(90), 2.3, true);
}

export function dressSurvival(L: Level): void {
  artSurvival(L);
  for (const [x, z] of [[-28, -28], [28, 28], [-28, 28], [28, -28]]) L.prop('Props_Vessel_Tall', x, 0, z, 0, 3.2, true);
  for (const [x, z] of [[-30, 0], [30, 0], [0, -30], [0, 30]]) L.prop('Props_Base', x, 0, z, 0, 1.1);
}

void THREE;
