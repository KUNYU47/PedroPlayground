/**
 * E2E smoke test — main user flows. Requires:
 *   1. a built app served at PEDRO_URL (default http://127.0.0.1:8471/)
 *      e.g. `npm run preview -- --port 8471`
 *   2. a Chrome/Chromium binary (CHROME_PATH, default /usr/bin/google-chrome)
 *
 * Run: node e2e/smoke.mjs
 */
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const URL = process.env.PEDRO_URL ?? 'http://127.0.0.1:8471/';
const CHROME = process.env.CHROME_PATH ?? '/usr/bin/google-chrome';
const SHOTS = path.join(ROOT, 'e2e', 'shots');
fs.mkdirSync(SHOTS, { recursive: true });

const shot = (page, name) => page.screenshot({ path: path.join(SHOTS, `${name}.png`) });
const setCode = (page, code) => page.evaluate((c) => window.__pedroEditor.setValue(c), code);

let failed = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? '✓' : '✗ FAIL'} ${name}${detail ? ' — ' + detail : ''}`);
  if (!ok) failed++;
};

const browser = await chromium.launch({
  executablePath: CHROME,
  headless: true,
  args: ['--no-sandbox', '--disable-gpu-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 1500, height: 900 } });
const errors = [];
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });

await page.goto(URL, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('.editor-container .monaco-editor', { timeout: 30000 });
check('monaco editor mounts', true);
await page.waitForSelector('.engine-pill.ready', { timeout: 90000 });
check('python engine becomes ready', true);
await shot(page, '01-loaded');

// Run the mission-1 reference solution end to end.
const solution = fs.readFileSync(path.join(ROOT, 'solutions', 'p1_moon_hill.py'), 'utf8');
await setCode(page, solution);
await page.click('.run-btn');
await page.waitForFunction(
  () => document.querySelector('.status-text')?.textContent?.includes('Great job'),
  { timeout: 30000 },
);
await page.waitForTimeout(2000);
const status1 = await page.textContent('.status-text');
check('reference solution runs', /61 steps/.test(status1), status1);
await shot(page, '02-after-run');

// Transport: pause + step back.
await page.click('.icon-btn.play');
await page.waitForTimeout(300);
const badge = () => page.textContent('.status-meta .badge:last-child');
const before = await badge();
await page.click('.transport-group .icon-btn:nth-child(2)');
await page.waitForTimeout(300);
const after = await badge();
check('step-back transport', before !== after, `${before} → ${after}`);

// Runtime error: wall crash produces a friendly message + error line.
await setCode(page, 'from pedro import *\n\nfor i in range(20):\n    move()\n');
await page.click('.run-btn');
await page.waitForFunction(
  () => document.querySelector('.status-text')?.textContent?.includes('wall'),
  { timeout: 30000 },
);
check('wall crash → friendly error', true, await page.textContent('.status-text'));
await page.waitForTimeout(800);
await shot(page, '04-error');

// Live lint: syntax error produces squiggles.
await setCode(page, 'from pedro import *\n\ndef broken(:\n');
await page.waitForTimeout(2500);
const squiggles = await page.evaluate(() => document.querySelectorAll('.squiggly-error').length);
check('live syntax diagnostics', squiggles > 0, `${squiggles} markers`);

// World editor opens.
await page.click('text=World Editor');
await page.waitForSelector('.world-editor-grid', { timeout: 5000 });
check('world editor opens', true);
await shot(page, '06-world-editor');
await page.click('.dialog .icon-btn');

check('no JS errors', errors.length === 0, errors.join(' | '));
await browser.close();
console.log(failed === 0 ? 'SMOKE: ALL PASS' : `SMOKE: ${failed} FAILURES`);
process.exit(failed === 0 ? 0 : 1);
