/**
 * Blocks.png tileset (Tinypot "Blocks 2.0", see public/assets/License.txt).
 * 16×16 tiles on a 38×26 grid. Used for walls, floors, and background decor.
 *
 * Floor tiles are pre-rendered darkened copies of the wall bricks so the
 * board keeps one consistent material with strong wall/floor contrast.
 */

const TILE = 16;

/**
 * Plain moon bricks — sheet row 8. NOTE: column 0 of rows 8-9 is a fully
 * transparent placeholder, so all variants start at column 1 (using column 0
 * rendered random cells as holes).
 */
const WALL_ROW = 8;
const WALL_COL_START = 1;
const WALL_VARIANTS = 9; // cols 1-9
/** Gem-embedded bricks — sheet row 9, cols 1-7 (col 0 is transparent). */
const GEM_ROW = 9;
const GEM_COL_START = 1;
const GEM_VARIANTS = 7; // cols 1-7
/** Background decoration sprites (x, y, w, h in sheet pixels). */
const DECOR_SPRITES: ReadonlyArray<readonly [number, number, number, number]> = [
  [560, 0, 32, 56],   // blob cluster
  [560, 56, 32, 56],  // scratches
  [560, 128, 32, 64], // second blob cluster
];

export class Tileset {
  private wallCanvases: HTMLCanvasElement[] = [];
  private gemCanvases: HTMLCanvasElement[] = [];
  private floorCanvases: HTMLCanvasElement[] = [];
  private decorCanvases: HTMLCanvasElement[] = [];

  private constructor(private sheet: HTMLImageElement) {
    for (let i = 0; i < WALL_VARIANTS; i++) {
      this.wallCanvases.push(this.cutTile(WALL_COL_START + i, WALL_ROW));
      this.floorCanvases.push(this.darken(this.cutTile(WALL_COL_START + i, WALL_ROW)));
    }
    for (let i = 0; i < GEM_VARIANTS; i++) {
      this.gemCanvases.push(this.cutTile(GEM_COL_START + i, GEM_ROW));
    }
    for (const [x, y, w, h] of DECOR_SPRITES) {
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      c.getContext('2d')!.drawImage(this.sheet, x, y, w, h, 0, 0, w, h);
      this.decorCanvases.push(c);
    }
  }

  static load(url: string): Promise<Tileset> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(new Tileset(img));
      img.onerror = () => reject(new Error(`Failed to load tileset: ${url}`));
      img.src = url;
    });
  }

  private cutTile(col: number, row: number): HTMLCanvasElement {
    const c = document.createElement('canvas');
    c.width = TILE;
    c.height = TILE;
    const ctx = c.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.sheet, col * TILE, row * TILE, TILE, TILE, 0, 0, TILE, TILE);
    return c;
  }

  /** Darkened copy used for floor tiles (keeps texture, adds contrast). */
  private darken(tile: HTMLCanvasElement): HTMLCanvasElement {
    const c = document.createElement('canvas');
    c.width = TILE;
    c.height = TILE;
    const ctx = c.getContext('2d')!;
    ctx.drawImage(tile, 0, 0);
    ctx.globalCompositeOperation = 'source-atop';
    ctx.fillStyle = 'rgba(9, 12, 30, 0.80)';
    ctx.fillRect(0, 0, TILE, TILE);
    return c;
  }

  wall(variant: number): HTMLCanvasElement {
    return this.wallCanvases[variant % WALL_VARIANTS];
  }

  gem(variant: number): HTMLCanvasElement {
    return this.gemCanvases[variant % GEM_VARIANTS];
  }

  floor(variant: number): HTMLCanvasElement {
    return this.floorCanvases[variant % WALL_VARIANTS];
  }

  decor(index: number): HTMLCanvasElement {
    return this.decorCanvases[index % this.decorCanvases.length];
  }

  decorCount(): number {
    return this.decorCanvases.length;
  }
}

/** Render a tile to a data URL (used by the world editor's DOM cells). */
export function tileDataUrl(tileset: Tileset, kind: 'wall' | 'floor', variant = 0, size = 32): string {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  const src = kind === 'wall' ? tileset.wall(variant) : tileset.floor(variant);
  ctx.drawImage(src, 0, 0, size, size);
  return c.toDataURL();
}
