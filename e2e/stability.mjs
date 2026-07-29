/**
 * E2E stability test — IDE features and crash/timeout recovery.
 * Same prerequisites as e2e/smoke.mjs. Run: node e2e/stability.mjs
 */
import { chromium } from 'playwright-core';

const URL = process.env.PEDRO_URL ?? 'http://127.0.0.1:8471/';
const CHROME = process.env.CHROME_PATH ?? '/usr/bin/google-chrome';

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
page.on('pageerror', (e) => errors.push(e.message));

await page.goto(URL, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('.engine-pill.ready', { timeout: 90000 });
const setCode = (code) => page.evaluate((c) => window.__pedroEditor.setValue(c), code);

// Autocomplete popup with pedro suggestions.
await setCode('from pedro import *\n\n');
await page.click('.editor-container .view-lines');
await page.keyboard.press('End');
await page.keyboard.type('mov', { delay: 60 });
await page.waitForSelector('.suggest-widget.visible', { timeout: 8000 });
check('autocomplete popup', true);
await page.keyboard.press('Escape');

// Infinite loop with NO actions → 10s hard timeout, engine respawns.
await setCode('from pedro import *\n\nwhile True:\n    pass\n');
await page.click('.run-btn');
await page.waitForFunction(
  () => document.querySelector('.status-text')?.textContent?.includes('too long'),
  null,
  { timeout: 30000 },
);
check('infinite loop → hard timeout', true, (await page.textContent('.status-text')).slice(0, 60));
await page.waitForSelector('.engine-pill.ready', { timeout: 90000 });
await setCode('from pedro import *\n\nturn_left()\n');
await page.click('.run-btn');
await page.waitForFunction(
  () => document.querySelector('.status-text')?.textContent?.includes('Great job'),
  null,
  { timeout: 30000 },
);
check('engine respawns and runs again', true);

// Infinite loop WITH actions → step cap, partial replay preserved.
await setCode('from pedro import *\n\nwhile True:\n    turn_left()\n');
await page.click('.run-btn');
await page.waitForFunction(
  () => document.querySelector('.status-text')?.textContent?.includes('infinite loop'),
  null,
  { timeout: 30000 },
);
check('step cap → friendly message + partial replay', true, (await page.textContent('.status-text')).slice(0, 60));

check('no JS errors', errors.length === 0, errors.join(' | '));
await browser.close();
console.log(failed === 0 ? 'STABILITY: ALL PASS' : `STABILITY: ${failed} FAILURES`);
process.exit(failed === 0 ? 0 : 1);
