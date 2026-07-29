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

function run(code: string, world: string, debug = false) {
  snapshots = [];
  const fn = pyodide.globals.get('__run_student__');
  const result = JSON.parse(fn(code, world, 10000, debug));
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

  it('debug runs record line events with locals and event-mapped snapshots', () => {
    const code = [
      'def main():',          // line 1
      '    steps = 2',        // line 2
      '    for i in range(steps):', // line 3
      '        move()',       // line 4
      '',
      "if __name__ == '__main__':", // line 6
      '    main()',           // line 7
    ].join('\n');
    const world = '#####\n#>..#\n#####';
    const { result, snapshots } = run(code, world, true);
    expect(result.status).toBe('ok');
    const events = result.lineEvents as Array<{ line: number; locals: Record<string, string> }>;
    expect(events.length).toBeGreaterThan(0);
    // every event is a real source line of the program
    expect(events.every((e) => e.line >= 1 && e.line <= 7)).toBe(true);
    // locals captured: loop variable i shows up during the loop
    const withI = events.filter((e) => 'i' in e.locals);
    expect(withI.length).toBeGreaterThan(0);
    expect(withI[0].locals.i).toBe('0');
    // steps variable visible too
    expect(events.some((e) => e.locals.steps === '2')).toBe(true);
    // calling main() steps into the function FROM its def header, then body
    const callIdx = events.findIndex((e) => e.line === 7); // main() call site
    expect(events[callIdx + 1].line).toBe(1); // def main(): header
    expect(events[callIdx + 2].line).toBe(2); // first body line
    // callables and dunders are filtered out
    expect(events.every((e) => !('move' in e.locals) && !Object.keys(e.locals).some((k) => k.startsWith('_')))).toBe(true);
    // snapshots carry the index of the line event they happened in
    expect(snapshots.length).toBe(2);
    for (const s of snapshots) {
      expect(typeof s.event).toBe('number');
      expect(events[s.event!].line).toBe(4); // both moves came from line 4
    }
    // event indices are non-decreasing (execution order)
    for (let i = 1; i < snapshots.length; i++) {
      expect(snapshots[i].event!).toBeGreaterThanOrEqual(snapshots[i - 1].event!);
    }
    // non-debug runs do not include line events
    const plain = run(code, world);
    expect(plain.result.lineEvents).toBeUndefined();
  });

  it('debug trace survives a crash (step up to the error line)', () => {
    const code = 'x = 1\nmove()\nmove()\n'; // third line hits a wall
    const world = '####\n#>.#\n####';
    const { result } = run(code, world, true);
    expect(result.status).toBe('error');
    const events = result.lineEvents as Array<{ line: number }>;
    expect(events.length).toBeGreaterThan(0);
    expect(events[events.length - 1].line).toBe(3); // crashed while on line 3
  });

  it('lints without executing', () => {
    expect(lint('move()\n')).toEqual([]);
    const errs = lint('def f(:\n');
    expect(errs.length).toBe(1);
    expect(errs[0].line).toBe(1);
  });
});
