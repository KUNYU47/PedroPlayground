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
await page.waitForSelector('.engine-pill.ready', { timeout: 90000 });

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

/* ---------- Stability: autosave must never land on the wrong mission ---------- */
await page.evaluate(() => window.__pedroEditor.setValue('from pedro import *\n# UNIQUE_MARKER_A\n'));
// Switch missions within the 800ms autosave debounce window.
await page.selectOption('.header-field select', 'roomba');
await page.waitForTimeout(1200); // let the (flushed) save + load settle
const leaked = await page.evaluate(
  () => (localStorage.getItem('pedro.v2.code.roomba') ?? '').includes('UNIQUE_MARKER_A'),
);
const savedToA = await page.evaluate(
  () => (localStorage.getItem('pedro.v2.code.moon_hill') ?? '').includes('UNIQUE_MARKER_A'),
);
check('autosave never writes to the new mission\'s key', !leaked);
check('pending autosave is flushed to the original mission', savedToA);
const roombaCode = await page.evaluate(() => window.__pedroEditor.getValue());
check('mission switch loads the new mission\'s own code', !roombaCode.includes('UNIQUE_MARKER_A'));

/* ---------- Stability: rapid double-run does not corrupt state ---------- */
await page.selectOption('.header-field select', 'moon_hill');
await page.waitForTimeout(800);
await page.evaluate(() => window.__pedroEditor.setValue('from pedro import *\nmove()\nmove()\n'));
// Two clicks in the same tick: second must act as Stop, not start a second run.
await page.evaluate(() => {
  document.querySelector('.run-btn').click();
  document.querySelector('.run-btn').click();
});
await page.waitForFunction(
  () => document.querySelector('.status-text')?.textContent?.includes('Run stopped'),
  null,
  { timeout: 15000 },
);
check('double-click Run behaves as Stop', true);
// …and the engine recovers: a fresh run finishes normally.
await page.click('.run-btn');
await page.waitForFunction(
  () => {
    const t = document.querySelector('.status-text')?.textContent ?? '';
    return t.includes('Great job') || t.includes('wall');
  },
  null,
  { timeout: 30000 },
);
check('engine recovers and runs again after double-click', true, await page.textContent('.status-text'));

/* ---------- Debugger: step through code line by line ---------- */
await page.evaluate(() => window.__pedroEditor.setValue([
  'from pedro import *',
  '',
  'def main():',
  '    steps = 2',
  '    for i in range(steps):',
  '        move()',
  '',
  "if __name__ == '__main__':",
  '    main()',
].join('\n')));
await page.click('text=🐞 Debug');
await page.waitForSelector('.debug-bar', { timeout: 30000 });
check('debug bar appears after Debug run', true);
const pos0 = await page.textContent('.debug-pos');
check('debugger starts at first line', /Line \d+ · 1\//.test(pos0 ?? ''), pos0 ?? '');
// step forward: position advances and highlight follows the trace
await page.click('.debug-bar .mini-btn:nth-of-type(3)'); // ▶ next line
await page.waitForTimeout(200);
const pos1 = await page.textContent('.debug-pos');
check('step forward advances the line', pos1 !== pos0 && /· 2\//.test(pos1 ?? ''), `${pos0} → ${pos1}`);
// step until the loop variable becomes visible in the vars strip
let varsText = '';
for (let i = 0; i < 12; i++) {
  varsText = (await page.textContent('.debug-vars')) ?? '';
  if (varsText.includes('i =') || varsText.includes('steps =')) break;
  await page.click('.debug-bar .mini-btn:nth-of-type(3)');
  await page.waitForTimeout(150);
}
check('variables panel shows locals', /steps = 2|i = \d/.test(varsText), varsText);
// active-line decoration is present in the editor
const activeLines = await page.evaluate(() => document.querySelectorAll('.pedro-exec-line').length);
check('current line highlighted in editor', activeLines > 0, `${activeLines} highlighted`);
// next-line preview decoration + text indicator
const nextLines = await page.evaluate(() => document.querySelectorAll('.pedro-next-line').length);
check('next line preview highlighted', nextLines > 0, `${nextLines} highlighted`);
const nextText = await page.textContent('.debug-next');
check('debug bar shows next line', /next: line \d+/.test(nextText ?? ''), nextText ?? '');
// step back works
const posBefore = await page.textContent('.debug-pos');
await page.click('.debug-bar .mini-btn:nth-of-type(2)'); // ◀ previous line
await page.waitForTimeout(150);
const posBack = await page.textContent('.debug-pos');
check('step back goes to previous line', posBack !== posBefore, `${posBefore} → ${posBack}`);
// quit debug
await page.click('.debug-bar .mini-btn:last-of-type');
await page.waitForTimeout(200);
const debugBarGone = (await page.$('.debug-bar')) === null;
check('quit debug mode', debugBarGone);

check('no JS errors', errors.length === 0, errors.join(' | '));
await browser.close();
console.log(failed === 0 ? 'FEATURES: ALL PASS' : `FEATURES: ${failed} FAILURES`);
process.exit(failed === 0 ? 0 : 1);
