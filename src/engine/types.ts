/**
 * Shared types for the Pedro engine, runtime protocol and replay system.
 */

export const EMPTY = 0;
export const WALL = 1;
export const BASE = -1;

/** 0 = North, 1 = East, 2 = South, 3 = West */
export type Direction = 0 | 1 | 2 | 3;

export const DIRECTION_DELTAS: ReadonlyArray<readonly [number, number]> = [
  [-1, 0],
  [0, 1],
  [1, 0],
  [0, -1],
];

export type ActionType = 'move' | 'turn_left' | 'plant_flag' | 'pick_flag';

/**
 * One replay step. Unlike the legacy Python version (which deep-copied the
 * whole grid per step), we only record the cells that changed — O(changed)
 * instead of O(rows*cols) per step.
 */
export interface Snapshot {
  action: ActionType;
  row: number;
  col: number;
  direction: Direction;
  flagsCarried: number;
  /** [row, col, newValue] tuples for cells mutated by this action */
  changes: Array<[number, number, number]>;
  /** 1-based line in the student program that triggered this action */
  line: number | null;
}

export interface WorldData {
  grid: number[][];
  startRow: number;
  startCol: number;
  startDir: Direction;
}

export interface RunStats {
  totalPickedUp: number;
  plantedAtBase: number;
  baseError: boolean;
  expectedFlags: number;
}

export interface RunError {
  /** Python exception class name, e.g. "SyntaxError", "PedroError" */
  kind: string;
  message: string;
  line: number | null;
}

export type RunOutcome =
  | { status: 'ok'; stats: RunStats }
  | { status: 'error'; error: RunError; stats: RunStats }
  | { status: 'timeout' }
  | { status: 'cancelled' };
