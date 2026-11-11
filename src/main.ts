import '@fontsource/rajdhani/500.css';
import '@fontsource/rajdhani/600.css';
import '@fontsource/rajdhani/700.css';
import '@fontsource/cinzel/600.css';
import '@fontsource/cinzel/800.css';
// Point d'entrée de WARBOUND.
import { Game } from './core/Game';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const game = new Game(canvas);
void game.init();

// Le mode de test automatique (?autotest) expose le jeu aux scripts de validation ; inactif en partie normale.
if (game.testMode) {
  void import('./debug/AutoTest').then((m) => m.installAutoTest(game));
}
