import type { Game } from '../core/Game';
import type { Mission } from '../mission/Mission';
import { Level } from '../world/Level';
export function buildOp1(_g: Game, m: Mission): Level {
  const L = new Level('op1', 'stub', { skyTop: 0x1a2436, skyHorizon: 0x6a7686, fog: 0x2a323c, fogDensity: 0.008, sun: 0xffe6c0, sunIntensity: 2.2, sunDir: [0.4, 0.8, -0.3], hemiSky: 0x9ab0c8, hemiGround: 0x2a2a28, hemiIntensity: 0.9 });
  L.floor('dirt', 0, 0, 60, 60); L.finish();
  m.reach('stub', 0, -10);
  return L;
}
