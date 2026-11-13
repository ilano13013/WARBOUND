// Lance la suite complète : build de production, serveur de prévisualisation, puis tous les scénarios Playwright.
import { spawn, spawnSync } from 'child_process';
const run = (cmd, args) => spawnSync(cmd, args, { stdio: 'inherit' }).status === 0;
if (!run('npx', ['vite', 'build'])) process.exit(1);
const srv = spawn('npx', ['vite', 'preview', '--port', '4173', '--strictPort'], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 2500));
const results = {};
for (const t of ['gameplay', 'systems', 'settings', 'boss', 'survival', 'layout', 'campaign']) { console.log(`\n===== ${t} =====`); results[t] = run('node', [`tests/${t}.mjs`]); }
srv.kill();
console.log('\n===== RÉSUMÉ ====='); for (const [k, v] of Object.entries(results)) console.log(`${v ? 'PASS' : 'FAIL'}  ${k}`);
process.exit(Object.values(results).every(Boolean) ? 0 : 1);
