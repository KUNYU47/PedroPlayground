/**
 * Mission (activity) definitions and world/scaffold loading.
 */
import { parseWorldText, serializeWorld, World } from '../engine/world';
import { Direction, WorldData } from '../engine/types';

export interface Mission {
  id: string;
  title: string;
  emoji: string;
  description: string;
  scaffold: string;
  world: string;
  randomizeStart?: boolean;
}

export const MISSIONS: Mission[] = [
  { id: 'moon_hill', title: 'Moon Hill', emoji: '🌕', description: 'Climb the hill and plant a flag on the peak.', scaffold: 'moon_hill_starter.py', world: 'moon_hill_3step.txt' },
  { id: 'roomba', title: 'Moon Roomba', emoji: '🤖', description: 'Clean every square of the room.', scaffold: 'roomba_starter.py', world: 'roomba_3x3.txt' },
  { id: 'crater', title: 'Crater Cleanup', emoji: '☄️', description: 'Pick up the flags scattered around the craters.', scaffold: 'crater_starter.py', world: 'crater_mixed.txt' },
  { id: 'flag_piles', title: 'Flag Piles', emoji: '🚩', description: 'Gather piles of flags.', scaffold: 'flag_piles_starter.py', world: 'flag_piles.txt' },
  { id: 'flag_planting', title: 'Flag Planting', emoji: '🌱', description: 'Plant flags in the right pattern.', scaffold: 'flag_planting_starter.py', world: 'flag_planting.txt' },
  { id: 'lunar_core', title: 'Lunar Core', emoji: '🛰️', description: 'Collect samples and bring them back to base — from a random start!', scaffold: 'lunar_core_starter.py', world: 'lunar_core_a.txt', randomizeStart: true },
  { id: 'maze', title: 'Maze Runner', emoji: '🌀', description: 'Find the flag hidden in the maze.', scaffold: 'maze_starter.py', world: 'maze_small.txt' },
];

export const BUILTIN_WORLDS: string[] = [
  'moon_hill_0step.txt', 'moon_hill_1step.txt', 'moon_hill_3step.txt',
  'moon_hill_5step.txt', 'moon_hill_10step.txt',
  'roomba_3x3.txt', 'roomba_10x3.txt', 'roomba_empty.txt',
  'crater_edges_only.txt', 'crater_flags_only.txt', 'crater_mixed.txt',
  'flag_row.txt', 'flag_piles.txt', 'flag_planting.txt',
  'lunar_core_a.txt', 'lunar_core_b.txt', 'lunar_core_c.txt',
  'maze_small.txt', 'maze_medium.txt', 'maze_large.txt',
  'empty_row.txt',
];

export async function fetchText(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to load ${url} (${res.status})`);
  return res.text();
}

export const fetchWorld = (name: string) => fetchText(`/worlds/${name}`);
export const fetchScaffold = (name: string) => fetchText(`/scaffolds/${name}`);

/**
 * Names (no extension) of .txt files in the user-editable `worlds/` folder
 * created by launch.py next to the launcher. Empty when the app is served
 * statically (no launcher) — the built-in list is the fallback.
 */
export async function fetchUserWorldNames(): Promise<string[]> {
  try {
    const res = await fetch('/api/user-files?type=worlds');
    if (!res.ok) return [];
    const data: unknown = await res.json();
    return Array.isArray(data) ? data.filter((n): n is string => typeof n === 'string') : [];
  } catch {
    return [];
  }
}

export function prettyWorldName(file: string): string {
  return file.replace(/\.txt$/, '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Move Pedro's start to a random free cell (Lunar Core mission). */
export function randomizeStart(worldText: string): string {
  const data = parseWorldText(worldText);
  const world = new World(data.grid.map((r) => r.slice()));
  const free: Array<[number, number]> = [];
  for (let r = 0; r < world.rows; r++) {
    for (let c = 0; c < world.cols; c++) {
      if (world.getCell(r, c) === 0) free.push([r, c]);
    }
  }
  if (free.length === 0) return worldText;
  const [nr, nc] = free[Math.floor(Math.random() * free.length)];
  const next: WorldData = {
    grid: data.grid,
    startRow: nr,
    startCol: nc,
    startDir: (Math.floor(Math.random() * 4) as Direction),
  };
  return serializeWorld(next);
}

/* ------------------------- persistence helpers ------------------------- */

const LS_PREFIX = 'pedro.v2.';

export function loadSavedCode(missionId: string): string | null {
  try {
    return localStorage.getItem(LS_PREFIX + 'code.' + missionId);
  } catch {
    return null;
  }
}

export function saveCode(missionId: string, code: string): void {
  try {
    localStorage.setItem(LS_PREFIX + 'code.' + missionId, code);
  } catch { /* storage full / private mode — ignore */ }
}

export interface CustomWorld {
  name: string;
  text: string;
}

export function loadCustomWorlds(): CustomWorld[] {
  try {
    const raw = localStorage.getItem(LS_PREFIX + 'customWorlds');
    return raw ? (JSON.parse(raw) as CustomWorld[]) : [];
  } catch {
    return [];
  }
}

export function saveCustomWorlds(worlds: CustomWorld[]): void {
  try {
    localStorage.setItem(LS_PREFIX + 'customWorlds', JSON.stringify(worlds));
  } catch { /* ignore */ }
}
