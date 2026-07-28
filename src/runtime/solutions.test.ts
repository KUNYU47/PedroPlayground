/**
 * Runs every shipped reference solution against its mission world through
 * the real Pyodide runtime — guarantees the teaching content keeps working.
 */
import { describe, expect, it, beforeAll } from 'vitest';
import { loadPyodide, type PyodideInterface } from 'pyodide';
import { createRequire } from 'node:module';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { PEDRO_PY } from './pedroPy';
import type { Snapshot } from '../engine/types';

const require = createRequire(import.meta.url);
const PYODIDE_DIR = path.dirname(require.resolve('pyodide'));
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

const CASES: Array<{ solution: string; world: string }> = [
  { solution: 'p1_moon_hill.py', world: 'moon_hill_3step.txt' },
  { solution: 'p2_roomba.py', world: 'roomba_3x3.txt' },
  { solution: 'p3_crater.py', world: 'crater_mixed.txt' },
  { solution: 'p4_flag_piles.py', world: 'flag_piles.txt' },
  { solution: 'p5_flag_planting.py', world: 'flag_planting.txt' },
  { solution: 'p6_lunar_core.py', world: 'lunar_core_a.txt' },
  { solution: 'p7_maze.py', world: 'maze_small.txt' },
];

let pyodide: PyodideInterface;

beforeAll(async () => {
  pyodide = await loadPyodide({ indexURL: PYODIDE_DIR + path.sep });
  pyodide.globals.set('__post_snapshot__', (_: string) => {});
  pyodide.runPython(PEDRO_PY);
}, 120_000);

describe('reference solutions', () => {
  for (const { solution, world } of CASES) {
    it(`${solution} completes on ${world}`, () => {
      const code = fs.readFileSync(path.join(ROOT, 'solutions', solution), 'utf8');
      const worldText = fs.readFileSync(path.join(ROOT, 'public/worlds', world), 'utf8');
      const snapshots: Snapshot[] = [];
      pyodide.globals.set('__post_snapshot__', (p: string) => snapshots.push(JSON.parse(p)));
      const fn = pyodide.globals.get('__run_student__');
      const result = JSON.parse(fn(code, worldText, 50000));
      fn.destroy?.();
      expect(result.status, `${solution} failed: ${JSON.stringify(result.error)}`).toBe('ok');
      expect(snapshots.length).toBeGreaterThan(0);
    });
  }
});
