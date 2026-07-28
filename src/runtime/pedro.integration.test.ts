/**
 * End-to-end test of the in-browser Python runtime (runs Pyodide in Node).
 * Verifies snapshot streaming, line tracing, error reporting and stats —
 * the exact contract the replay system depends on.
 */
import { describe, expect, it, beforeAll } from 'vitest';
import { loadPyodide, type PyodideInterface } from 'pyodide';
import { createRequire } from 'node:module';
import path from 'node:path';
import { PEDRO_PY } from './pedroPy';
import type { Snapshot } from '../engine/types';

const require = createRequire(import.meta.url);
const PYODIDE_DIR = path.dirname(require.resolve('pyodide'));

const FLAG_ROW = '##########\n#>.......#\n#........#\n#........#\n##########';

let pyodide: PyodideInterface;
let snapshots: Snapshot[];

beforeAll(async () => {
  pyodide = await loadPyodide({ indexURL: PYODIDE_DIR + path.sep });
  pyodide.globals.set('__post_snapshot__', (payload: string) => {
    snapshots.push(JSON.parse(payload));
  });
  pyodide.runPython(PEDRO_PY);
}, 120_000);

function run(code: string, world: string) {
  snapshots = [];
  const fn = pyodide.globals.get('__run_student__');
  const result = JSON.parse(fn(code, world, 10000));
  fn.destroy?.();
  return { result, snapshots };
}

function lint(code: string) {
  const fn = pyodide.globals.get('__lint_student__');
  const result = JSON.parse(fn(code));
  fn.destroy?.();
  return result.errors as Array<{ kind: string; line: number }>;
}

describe('pedro pyodide runtime', () => {
  it('streams snapshots with source line numbers', () => {
    const code = [
      'def main():',          // line 1
      '    move()',           // line 2
      '    turn_left()',      // line 3
      '    move()',           // line 4
      '',
      "if __name__ == '__main__':",
      '    main()',
    ].join('\n');
    // pedro at (2,1) facing east; turn_left faces him north into open space
    const world = '#####\n#...#\n#>..#\n#####';
    const { result, snapshots } = run(code, world);
    expect(result.status).toBe('ok');
    expect(snapshots.map((s) => s.action)).toEqual(['move', 'turn_left', 'move']);
    expect(snapshots[0]).toMatchObject({ row: 2, col: 2, direction: 1, line: 2 });
    expect(snapshots[1]).toMatchObject({ direction: 0, line: 3 });
    expect(snapshots[2]).toMatchObject({ row: 1, col: 2, direction: 0, line: 4 });
  });

  it('records grid diffs for plant/pick', () => {
    const code = 'move()\npick_flag()\n';
    const w = '###\n#F#\n#^#\n###'; // pedro at (2,1) facing north, flag at (1,1)
    const { result, snapshots } = run(code, w);
    expect(result.status).toBe('ok');
    const pick = snapshots.find((s) => s.action === 'pick_flag');
    expect(pick).toBeDefined();
    expect(pick!.changes).toEqual([[1, 1, 0]]);
    expect(pick!.flagsCarried).toBe(1);
    expect(result.stats.totalPickedUp).toBe(1);
  });

  it('reports PedroError with line number on wall crash', () => {
    const code = 'move()\nmove()'; // second move hits the wall
    const world = '####\n#>.#\n####'; // one free cell, then a wall
    const { result, snapshots } = run(code, world);
    expect(result.status).toBe('error');
    expect(result.error.kind).toBe('PedroError');
    expect(result.error.message).toContain('wall');
    expect(result.error.line).toBe(2);
    expect(snapshots.length).toBe(1); // crash point preserved
  });

  it('reports SyntaxError with line number', () => {
    const { result } = run('move(\n', FLAG_ROW);
    expect(result.status).toBe('error');
    expect(result.error.kind).toBe('SyntaxError');
    expect(result.error.line).toBe(1);
  });

  it('reports NameError for typos', () => {
    const { result } = run('mov()\n', FLAG_ROW);
    expect(result.error.kind).toBe('NameError');
    expect(result.error.message).toContain('mov');
  });

  it('enforces the step cap against infinite loops', () => {
    const { result } = run('while True:\n    turn_left()', FLAG_ROW);
    expect(result.status).toBe('error');
    expect(result.error.message).toContain('too many steps');
  });

  it('tracks base-planting stats (lunar core verification)', () => {
    // pedro picks a flag, walks to base, plants it
    const world = '#####\n#F.B#\n#^..#\n#####'; // pedro at (2,1) facing north
    const code = [
      'move()',                 // onto the flag cell
      'pick_flag()',
      'turn_left()', 'turn_left()', 'turn_left()', // face east
      'move()', 'move()',       // walk east onto the base
      'plant_flag()',
    ].join('\n');
    const { result } = run(code, world);
    expect(result.status).toBe('ok');
    expect(result.stats.totalPickedUp).toBe(1);
    expect(result.stats.plantedAtBase).toBe(1);
    expect(result.stats.baseError).toBe(false);
  });

  it('supports `from pedro import *` like the scaffolds use', () => {
    const world = '####\n#>.#\n####';
    const { result, snapshots } = run('from pedro import *\nmove()\n', world);
    expect(result.status).toBe('ok');
    expect(snapshots.map((s) => s.action)).toEqual(['move']);
  });

  it('lints without executing', () => {
    expect(lint('move()\n')).toEqual([]);
    const errs = lint('def f(:\n');
    expect(errs.length).toBe(1);
    expect(errs[0].line).toBe(1);
  });
});
