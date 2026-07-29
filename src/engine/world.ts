/**
 * World model — a faithful TypeScript port of the legacy engine/world.py,
 * plus serialization (for the world editor) and the maze generator.
 */
import { BASE, EMPTY, WALL, Direction, WorldData } from './types';

const CELL_SYMBOLS: Record<string, number> = {
  '.': EMPTY,
  '#': WALL,
  F: 2,
  B: BASE,
  '2': 3,
  '3': 4,
  '4': 5,
  '5': 6,
  '6': 7,
  '7': 8,
  '8': 9,
  '9': 10,
};

const DIRECTION_SYMBOLS: Record<string, Direction> = {
  '^': 0,
  '>': 1,
  v: 2,
  '<': 3,
};

const DIRECTION_CHARS: Direction[] = [0, 1, 2, 3];
const DIR_TO_CHAR = ['^', '>', 'v', '<'];

export class World {
  readonly grid: number[][];
  readonly rows: number;
  readonly cols: number;

  constructor(grid: number[][]) {
    const cols = grid.length > 0 ? grid[0].length : 0;
    for (const row of grid) {
      if (row.length !== cols) {
        throw new Error('World grid must be rectangular — every row needs the same number of columns');
      }
    }
    this.grid = grid;
    this.rows = grid.length;
    this.cols = cols;
  }

  cloneGrid(): number[][] {
    return this.grid.map((row) => row.slice());
  }

  getCell(row: number, col: number): number {
    if (row >= 0 && row < this.rows && col >= 0 && col < this.cols) {
      return this.grid[row][col];
    }
    return WALL;
  }

  setCell(row: number, col: number, value: number): void {
    if (row >= 0 && row < this.rows && col >= 0 && col < this.cols) {
      this.grid[row][col] = value;
    }
  }

  isWall(row: number, col: number): boolean {
    return this.getCell(row, col) === WALL;
  }

  isFlag(row: number, col: number): boolean {
    return this.getCell(row, col) >= 2;
  }

  flagCount(row: number, col: number): number {
    const v = this.getCell(row, col);
    return v >= 2 ? Math.max(0, v - 1) : 0;
  }
}

/**
 * Parse the legacy text world format:
 *   '#' wall · '.' empty · 'F' one flag · 'B' base · '2'-'9' flag piles
 *   '^' '>' 'v' '<' Pedro start (a digit run right after sets starting flags)
 */
export function parseWorldText(text: string): WorldData {
  const lines = text
    .split('\n')
    .map((l) => l.replace(/\r$/, ''))
    .filter((l) => l.trim().length > 0);

  if (lines.length === 0) {
    throw new Error('World file is empty');
  }

  const maxCols = Math.max(...lines.map((l) => l.length));
  const grid: number[][] = [];
  let startRow: number | null = null;
  let startCol = 0;
  let startDir: Direction = 1;

  lines.forEach((line, r) => {
    const row: number[] = [];
    let c = 0;
    while (c < maxCols) {
      const ch = c < line.length ? line[c] : '#';
      if (Object.prototype.hasOwnProperty.call(DIRECTION_SYMBOLS, ch)) {
        if (startRow !== null) {
          throw new Error(`Multiple Pedro start positions (^ > v <) found — keep exactly one (rows ${startRow + 1} and ${r + 1})`);
        }
        startRow = r;
        startCol = c;
        startDir = DIRECTION_SYMBOLS[ch];
        let digits = '';
        let cc = c + 1;
        while (cc < line.length && /[0-9]/.test(line[cc])) {
          digits += line[cc];
          cc += 1;
        }
        if (digits) {
          const count = parseInt(digits, 10);
          row.push(count >= 1 ? count + 1 : EMPTY);
          c = cc - 1;
        } else {
          row.push(EMPTY);
        }
      } else {
        row.push(CELL_SYMBOLS[ch] ?? WALL);
      }
      c += 1;
    }
    while (row.length < maxCols) row.push(WALL);
    grid.push(row);
  });

  if (startRow === null) {
    throw new Error('No Pedro start position (^ > v <) found in world');
  }
  return { grid, startRow, startCol, startDir };
}

/** Serialize back to the legacy text format (used by the world editor). */
export function serializeWorld(data: WorldData): string {
  const out: string[] = [];
  for (let r = 0; r < data.grid.length; r++) {
    let line = '';
    for (let c = 0; c < data.grid[r].length; c++) {
      const v = data.grid[r][c];
      if (r === data.startRow && c === data.startCol) {
        // Direction char; a flag pile on the start cell round-trips as
        // trailing digits (mirrors the parse-side digit-run syntax).
        line += DIR_TO_CHAR[data.startDir] + (v >= 2 ? String(v - 1) : '');
        continue;
      }
      if (v === WALL) line += '#';
      else if (v === BASE) line += 'B';
      else if (v === EMPTY) line += '.';
      else if (v >= 2 && v <= 10) line += v === 2 ? 'F' : String(v - 1);
      else line += '.';
    }
    out.push(line);
  }
  return out.join('\n');
}

/** Rotate Pedro's start direction cyclically (world editor helper). */
export function nextDirection(d: Direction): Direction {
  return DIRECTION_CHARS[(d + 1) % 4];
}

export interface GeneratedMaze extends WorldData {
  goalRow: number;
  goalCol: number;
}

/** DFS-backtracker maze generator — direct port of engine/world.py:generate_maze. */
export function generateMaze(rows: number, cols: number, rng: () => number = Math.random): GeneratedMaze {
  rows = Math.max(5, rows);
  cols = Math.max(5, cols);
  if (rows % 2 === 0) rows += 1;
  if (cols % 2 === 0) cols += 1;

  const chars: string[][] = Array.from({ length: rows }, () => Array(cols).fill('#'));
  const start: [number, number] = [1, 1];
  chars[1][1] = '.';
  const stack: Array<[number, number]> = [start];
  const visited = new Set<string>(['1,1']);

  while (stack.length > 0) {
    const [cr, cc] = stack[stack.length - 1];
    const dirs: Array<[number, number]> = [
      [-2, 0],
      [2, 0],
      [0, -2],
      [0, 2],
    ];
    // shuffle
    for (let i = dirs.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [dirs[i], dirs[j]] = [dirs[j], dirs[i]];
    }
    let carved = false;
    for (const [dr, dc] of dirs) {
      const nr = cr + dr;
      const nc = cc + dc;
      const key = `${nr},${nc}`;
      if (nr >= 1 && nr < rows - 1 && nc >= 1 && nc < cols - 1 && !visited.has(key)) {
        chars[cr + dr / 2][cc + dc / 2] = '.';
        chars[nr][nc] = '.';
        visited.add(key);
        stack.push([nr, nc]);
        carved = true;
        break;
      }
    }
    if (!carved) stack.pop();
  }

  const candidates: Array<[number, number]> = [];
  for (let r = 1; r < rows - 1; r++) {
    for (let c = 1; c < cols - 1; c++) {
      if (chars[r][c] === '.') candidates.push([r, c]);
    }
  }
  const pedroPos = candidates[Math.floor(rng() * candidates.length)];

  // BFS for farthest cell → goal
  const dist = new Map<string, number>();
  const queue: Array<[number, number]> = [pedroPos];
  dist.set(`${pedroPos[0]},${pedroPos[1]}`, 0);
  while (queue.length > 0) {
    const [cr, cc] = queue.shift()!;
    for (const [dr, dc] of [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
    ] as const) {
      const nr = cr + dr;
      const nc = cc + dc;
      const key = `${nr},${nc}`;
      if (nr >= 0 && nr < rows && nc >= 0 && nc < cols && chars[nr][nc] === '.' && !dist.has(key)) {
        dist.set(key, dist.get(`${cr},${cc}`)! + 1);
        queue.push([nr, nc]);
      }
    }
  }
  let goalPos = pedroPos;
  let best = -1;
  for (const [key, d] of dist) {
    if (d > best) {
      best = d;
      const [r, c] = key.split(',').map(Number);
      goalPos = [r, c];
    }
  }

  chars[pedroPos[0]][pedroPos[1]] = '>';
  chars[goalPos[0]][goalPos[1]] = 'F';
  const text = chars.map((row) => row.join('')).join('\n');
  const data = parseWorldText(text);
  return { ...data, goalRow: goalPos[0], goalCol: goalPos[1] };
}
