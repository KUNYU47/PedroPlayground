/**
 * E2E feature test — World Editor resize/reset + single-line autocomplete.
 * Same requirements as smoke.mjs (served app + Chrome).
 *
 * Run: node e2e/features.mjs
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

/* ---------- World Editor: reset + resize ---------- */
await page.click('text=World Editor');
await page.waitForSelector('.world-editor-grid', { timeout: 5000 });

// Paint a wall inside the grid, then Reset must restore floor/edge-walls/Pedro(1,1).
const cell = (r, c, cols) => `.we-cell:nth-child(${r * cols + c + 1})`;
await page.click(cell(3, 3, 11)); // tool defaults to wall
const painted = await page.getAttribute(cell(3, 3, 11), 'class');
check('paint wall works', painted.includes('we-wall'), painted);

await page.click('text=🧹 Reset');
const cls = (sel) => page.getAttribute(sel, 'class');
const mid = await cls(cell(3, 3, 11));
const corner = await cls(cell(0, 0, 11));
const pedro = await cls(cell(1, 1, 11));
check('reset: interior back to floor', mid.includes('we-floor'), mid);
check('reset: edge back to wall', corner.includes('we-wall'), corner);
check('reset: Pedro back to (1,1)', pedro.includes('we-pedro'), pedro);

// Drag the resize handle: dialog must shrink and grow, grid following along.
const dlgRect = () => page.$eval('.dialog.world-editor', (el) => el.getBoundingClientRect());
const gridRect = () => page.$eval('.world-editor-grid', (el) => el.getBoundingClientRect());
const handle = await page.$('.we-resize-handle');
check('resize handle exists', !!handle);
const dragHandle = async (dx, dy) => {
  const hb = await handle.boundingBox();
  await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2);
  await page.mouse.down();
  await page.mouse.move(hb.x + hb.width / 2 + dx, hb.y + hb.height / 2 + dy, { steps: 10 });
  await page.mouse.up();
};
const dlg0 = await dlgRect();
await dragHandle(-250, -200);
const dlgSmall = await dlgRect();
const gridSmall = await gridRect();
check(
  'dialog shrinks via drag',
  dlgSmall.width < dlg0.width - 150 && dlgSmall.height < dlg0.height - 100,
  `${Math.round(dlg0.width)}x${Math.round(dlg0.height)} → ${Math.round(dlgSmall.width)}x${Math.round(dlgSmall.height)}`,
);
await dragHandle(400, 300);
const dlgBig = await dlgRect();
const gridBig = await gridRect();
check(
  'dialog grows via drag',
  dlgBig.width > dlgSmall.width + 250 && dlgBig.height > dlgSmall.height + 150,
  `${Math.round(dlgSmall.width)}x${Math.round(dlgSmall.height)} → ${Math.round(dlgBig.width)}x${Math.round(dlgBig.height)}`,
);
check(
  'grid grows with dialog',
  gridBig.height > gridSmall.height + 50,
  `${Math.round(gridSmall.height)} → ${Math.round(gridBig.height)}`,
);
await page.screenshot({ path: path.join(SHOTS, '10-world-editor-resized.png') });
await page.click('.dialog .icon-btn');

/* ---------- Autocomplete: single-line skeletons ---------- */
await page.evaluate(() => window.__pedroEditor.setValue('from pedro import *\n\nwhi'));
await page.click('.editor-container .monaco-editor .view-lines');
await page.evaluate(() => {
  const ed = window.__pedroEditor;
  ed.focus();
  ed.setPosition({ lineNumber: 3, column: 4 });
  ed.trigger('e2e', 'editor.action.triggerSuggest', {});
});
await page.waitForSelector('.suggest-widget.visible', { timeout: 5000 });
const items = await page.$$eval('.suggest-widget.visible .monaco-list-row .label-name', (els) =>
  els.map((e) => e.textContent),
);
check('while suggestions offered', items.some((t) => t.startsWith('while')), items.join(', '));
await page.keyboard.press('Enter'); // accept the highlighted suggestion
await page.waitForTimeout(300);
const value = await page.evaluate(() => window.__pedroEditor.getValue());
const inserted = value.split('\n').slice(2).join('\n');
check(
  'accepted suggestion is one line, one call',
  /^while \w+\(\):$/.test(inserted.trim()),
  JSON.stringify(value),
);

// Typing '(' must not pop the suggestion widget anymore.
await page.evaluate(() => window.__pedroEditor.setValue('from pedro import *\n\nprint('));
await page.waitForTimeout(800);
const suggestVisible = await page.evaluate(
  () => !!document.querySelector('.suggest-widget.visible'),
);
check('no suggestion popup on "("', !suggestVisible);

check('no JS errors', errors.length === 0, errors.join(' | '));
await browser.close();
console.log(failed === 0 ? 'FEATURES: ALL PASS' : `FEATURES: ${failed} FAILURES`);
process.exit(failed === 0 ? 0 : 1);
