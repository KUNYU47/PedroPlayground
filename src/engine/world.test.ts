import { describe, expect, it } from 'vitest';
import { generateMaze, parseWorldText, serializeWorld } from './world';
import { Replay } from './replay';
import { BASE, EMPTY, Snapshot, WALL } from './types';

describe('parseWorldText', () => {
  it('parses walls, floors, flags and start position', () => {
    const w = parseWorldText('#####\n#>F.#\n#####');
    expect(w.startRow).toBe(1);
    expect(w.startCol).toBe(1);
    expect(w.startDir).toBe(1);
    expect(w.grid[1][1]).toBe(EMPTY);
    expect(w.grid[1][2]).toBe(2); // one flag
    expect(w.grid[1][3]).toBe(EMPTY);
    expect(w.grid[0][0]).toBe(WALL);
  });

  it('parses multi-digit flag piles and base cells', () => {
    const w = parseWorldText('>.\n3B');
    expect(w.grid[1][0]).toBe(4); // pile of 3 flags -> count+1
    expect(w.grid[1][1]).toBe(BASE);
  });

  it('parses start-with-flags (direction char followed by digits)', () => {
    const w = parseWorldText('^5.');
    expect(w.startRow).toBe(0);
    expect(w.startCol).toBe(0);
    expect(w.startDir).toBe(0);
    expect(w.grid[0][0]).toBe(6); // 5 flags on start cell
    expect(w.grid[0][1]).toBe(EMPTY);
  });

  it('pads ragged rows with walls', () => {
    const w = parseWorldText('####\n>.');
    expect(w.grid[1].length).toBe(4);
    expect(w.grid[1][3]).toBe(WALL);
  });

  it('rejects empty worlds and missing start', () => {
    expect(() => parseWorldText('')).toThrow();
    expect(() => parseWorldText('###\n#.#')).toThrow(/start/);
  });

  it('round-trips through serializeWorld', () => {
    const text = '#####\n#>F.#\n#.3B#\n#####';
    expect(serializeWorld(parseWorldText(text))).toBe(text);
  });
});

describe('generateMaze', () => {
  it('produces an odd-sized solvable maze with start and goal', () => {
    const m = generateMaze(10, 10);
    expect(m.grid.length % 2).toBe(1);
    expect(m.grid[0].length % 2).toBe(1);
    expect(m.grid[m.goalRow][m.goalCol]).toBe(2); // flag at goal
    // BFS from start must reach the goal
    const seen = new Set<string>();
    const q: Array<[number, number]> = [[m.startRow, m.startCol]];
    seen.add(`${m.startRow},${m.startCol}`);
    while (q.length) {
      const [r, c] = q.shift()!;
      for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]] as const) {
        const nr = r + dr;
        const nc = c + dc;
        const k = `${nr},${nc}`;
        if (m.grid[nr]?.[nc] !== undefined && m.grid[nr][nc] !== WALL && !seen.has(k)) {
          seen.add(k);
          q.push([nr, nc]);
        }
      }
    }
    expect(seen.has(`${m.goalRow},${m.goalCol}`)).toBe(true);
  });
});

describe('Replay', () => {
  it('reconstructs grids from diffs at any step', () => {
    const world = parseWorldText('###\n>F.\n###');
    const snaps: Snapshot[] = [
      { action: 'pick_flag', row: 1, col: 1, direction: 1, flagsCarried: 1, changes: [[1, 1, 0]], line: 2 },
      { action: 'move', row: 1, col: 2, direction: 1, flagsCarried: 1, changes: [], line: 3 },
      { action: 'plant_flag', row: 1, col: 2, direction: 1, flagsCarried: 1, changes: [[1, 2, 3]], line: 4 },
    ];
    const replay = new Replay(world, snaps);
    expect(replay.stateAt(-1).grid[1][1]).toBe(2);
    expect(replay.stateAt(0).grid[1][1]).toBe(EMPTY);
    expect(replay.stateAt(1).row).toBe(1);
    expect(replay.stateAt(1).col).toBe(2);
    expect(replay.stateAt(2).grid[1][2]).toBe(3);
    // scrubbing backwards restores earlier state
    expect(replay.stateAt(0).grid[1][2]).toBe(EMPTY);
    expect(replay.stateAt(2).line).toBe(4);
  });
});
