// Utilitaires communs aux scripts de test Playwright.
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
let pw;
try { pw = require('playwright'); } catch { pw = require('/opt/node22/lib/node_modules/playwright'); }
export const { chromium } = pw;
export const GAME_URL = process.env.WB_URL || 'http://localhost:5173/?autotest';
export const SHOTS = new globalThis.URL('./shots/', import.meta.url).pathname;

export async function open(opts = {}) {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: opts.w || 1280, height: opts.h || 720 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  await page.goto(GAME_URL);
  await page.waitForFunction(() => window.WB && window.WB.game.state === 'menu', null, { timeout: 60000 });
  return { browser, page, errors };
}
export const st = (page) => page.evaluate(() => window.WB.state());
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export async function waitFor(page, fn, timeout = 60000, arg) {
  await page.waitForFunction(fn, arg, { timeout, polling: 200 });
}
export async function shot(page, name) { await page.screenshot({ path: SHOTS + name + '.png' }); }
