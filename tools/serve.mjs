// Petit serveur HTTP statique local pour WARBOUND (aucune dependance).
// Sert le dossier dist/ sur 127.0.0.1 uniquement et ouvre le navigateur par defaut.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { exec } from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.map': 'application/json' };

if (!fs.existsSync(path.join(root, 'index.html'))) {
  console.error('[WARBOUND] dist/index.html introuvable : lancez BUILD-WARBOUND.bat d\'abord.');
  process.exit(1);
}

const server = http.createServer((req, res) => {
  let rel;
  try { rel = decodeURIComponent((req.url || '/').split('?')[0]); } catch { res.writeHead(400).end(); return; }
  if (rel.endsWith('/')) rel += 'index.html';
  const file = path.join(root, rel);
  // interdit de sortir du dossier dist
  if (file !== root && !file.startsWith(root + path.sep)) { res.writeHead(403).end('Interdit'); return; }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Introuvable'); return; }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(data);
  });
});

const first = Number(process.env.WARBOUND_PORT) || 4173;
let port = first;
server.on('error', (e) => {
  if (e.code === 'EADDRINUSE' && port < first + 20) { port++; server.listen(port, '127.0.0.1'); }
  else { console.error('[WARBOUND] Impossible de demarrer le serveur :', e.message); process.exit(1); }
});
server.on('listening', () => {
  const url = `http://localhost:${port}/`;
  console.log(`[WARBOUND] Jeu disponible sur ${url}`);
  console.log('[WARBOUND] Laissez cette fenetre ouverte pendant que vous jouez. Fermez-la (ou Ctrl+C) pour arreter.');
  if (!process.env.WARBOUND_NO_OPEN) {
    const cmd = process.platform === 'win32' ? `start "" "${url}"` : process.platform === 'darwin' ? `open "${url}"` : `xdg-open "${url}"`;
    exec(cmd, () => { /* si l'ouverture echoue, l'adresse est affichee ci-dessus */ });
  }
});
server.listen(port, '127.0.0.1');
