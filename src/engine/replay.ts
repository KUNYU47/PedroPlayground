/**
 * Replay model: reconstructs world state at any step from the initial world
 * plus the diff-based snapshot stream. Grids are cached so scrubbing the
 * timeline backwards is cheap.
 */
import { Snapshot, WorldData } from './types';

export interface ReplayState {
  grid: number[][];
  row: number;
  col: number;
  direction: number;
  flagsCarried: number;
  line: number | null;
}

export class Replay {
  readonly world: WorldData;
  readonly snapshots: Snapshot[];
  private gridCache = new Map<number, number[][]>();

  constructor(world: WorldData, snapshots: Snapshot[]) {
    this.world = world;
    this.snapshots = snapshots;
    this.gridCache.set(-1, world.grid.map((r) => r.slice()));
  }

  get length(): number {
    return this.snapshots.length;
  }

  /** State after applying `index` (0-based) snapshot; -1 = initial state. */
  stateAt(index: number): ReplayState {
    const clamped = Math.min(index, this.snapshots.length - 1);
    if (clamped < 0) {
      return {
        grid: this.gridAt(-1),
        row: this.world.startRow,
        col: this.world.startCol,
        direction: this.world.startDir,
        flagsCarried: 0,
        line: null,
      };
    }
    const snap = this.snapshots[clamped];
    return {
      grid: this.gridAt(clamped),
      row: snap.row,
      col: snap.col,
      direction: snap.direction,
      flagsCarried: snap.flagsCarried,
      line: snap.line,
    };
  }

  private gridAt(index: number): number[][] {
    const cached = this.gridCache.get(index);
    if (cached) return cached;
    // Walk back to the nearest cached grid, then apply diffs forward.
    let base = index - 1;
    while (base >= -1 && !this.gridCache.has(base)) base--;
    const grid = this.gridCache.get(base)!.map((r) => r.slice());
    for (let i = base + 1; i <= index; i++) {
      for (const [r, c, v] of this.snapshots[i].changes) {
        grid[r][c] = v;
      }
      this.gridCache.set(i, grid.map((r) => r.slice()));
    }
    return grid;
  }
}
