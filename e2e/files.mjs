import { chromium } from 'playwright-core';
import fs from 'node:fs';
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1500, height: 900 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto('http://127.0.0.1:8471/', { waitUntil: 'domcontentloaded' });
await page.waitForSelector('.engine-pill.ready', { timeout: 90000 });
const setCode = (code) => page.evaluate((c) => window.__pedroEditor.setValue(c), code);
const getCode = () => page.evaluate(() => window.__pedroEditor.getValue());
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? '✓' : '✗ FAIL'} ${name}${detail ? ' — ' + detail : ''}`); if (!ok) failed++; };

// 1. Export code → download event with suggested filename
await setCode('from pedro import *\nmove()\n');
await page.waitForTimeout(1200); // let autosave/lint settle
const dl = page.waitForEvent('download', { timeout: 5000 });
await page.click('text=Export');
const download = await dl;
check('code export downloads .py', download.suggestedFilename() === 'moon_hill.py', download.suggestedFilename());

// 2. Import code via file picker
fs.writeFileSync('/tmp/upload_test.py', 'from pedro import *\n\n# uploaded!\nturn_left()\n');
const fc = page.waitForEvent('filechooser', { timeout: 5000 });
await page.click('text=Open');
const chooser = await fc;
await chooser.setFiles('/tmp/upload_test.py');
await page.waitForTimeout(500);
check('code import loads file', (await getCode()).includes('# uploaded!'));

// 3. Reset mission restores the scaffold
await page.evaluate(() => { window.confirm = () => true; });
await page.click('text=Reset Mission');
await page.waitForTimeout(1000);
const restored = await getCode();
check('reset mission restores scaffold', restored.includes('def turn_right') && restored.includes('TODO'));

// 4. World editor export/import round trip
await page.click('text=World Editor');
await page.waitForSelector('.world-editor-grid');
const wdl = page.waitForEvent('download', { timeout: 5000 });
await page.click('.world-editor-footer >> text=Export');
const wdownload = await wdl;
check('world export downloads .txt', wdownload.suggestedFilename() === 'my_world.txt', wdownload.suggestedFilename());
const wc = page.waitForEvent('filechooser', { timeout: 5000 });
await page.click('.world-editor-footer >> text=Import');
const wchooser = await wc;
fs.writeFileSync('/tmp/world_upload.txt', '#####\n#>F.#\n#.B.#\n#####\n');
await wchooser.setFiles('/tmp/world_upload.txt');
await page.waitForTimeout(400);
const nameVal = await page.inputValue('.world-editor-footer .text-input');
check('world import loads file', nameVal === 'world_upload', nameVal);
// save it → shows in stage
await page.click('text=Save World');
await page.waitForTimeout(600);
const status = await page.textContent('.status-text');
check('imported world saves to stage', status?.includes('world_upload'), status);

check('no JS errors', errors.length === 0, errors.join(' | '));
await browser.close();
console.log(failed === 0 ? 'FILES: ALL PASS' : `FILES: ${failed} FAILURES`);
process.exit(failed ? 1 : 0);
