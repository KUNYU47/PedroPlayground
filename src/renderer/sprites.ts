/**
 * Astronaut sprite sheet handling. The sheet is 14 columns × 4 rows of 16×16
 * frames (row 0 idle, 1 walk, 2 turn, 3 plant/pick). The base frame faces
 * East; we rotate at draw time. Port of legacy engine/sprites.py.
 */

export type SpriteAction = 'idle' | 'move' | 'turn_left' | 'plant_flag' | 'pick_flag';

const FRAME_SIZE = 16;
const COLS = 14;

const ACTION_ROWS: Record<SpriteAction, number> = {
  idle: 0,
  move: 1,
  turn_left: 2,
  plant_flag: 3,
  pick_flag: 3,
};

/**
 * Only the first N frames of each row actually contain pixels — the rest of
 * the 14-frame row is transparent. Cycling past N made Pedro vanish for a
 * frame (the "periodic flicker" bug), so always map into the valid range.
 */
const VALID_FRAMES: Record<SpriteAction, number> = {
  idle: 4,
  move: 14,
  turn_left: 9,
  plant_flag: 7,
  pick_flag: 7,
};

export class Sprites {
  private constructor(private sheet: HTMLImageElement) {}

  static load(url: string): Promise<Sprites> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(new Sprites(img));
      img.onerror = () => reject(new Error(`Failed to load sprite sheet: ${url}`));
      img.src = url;
    });
  }

  frameCount(action: SpriteAction = 'move'): number {
    return VALID_FRAMES[action];
  }

  /**
   * Draw one frame centered at (x, y), scaled to `size` px, rotated by
   * `angleRad` (0 = facing East, positive = clockwise on screen).
   */
  draw(
    ctx: CanvasRenderingContext2D,
    action: SpriteAction,
    frame: number,
    x: number,
    y: number,
    size: number,
    angleRad: number,
  ): void {
    const row = ACTION_ROWS[action];
    const col = Math.max(0, Math.min(VALID_FRAMES[action] - 1, Math.floor(frame)));
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angleRad);
    ctx.imageSmoothingEnabled = false;
    const half = size / 2;
    ctx.drawImage(
      this.sheet,
      col * FRAME_SIZE,
      row * FRAME_SIZE,
      FRAME_SIZE,
      FRAME_SIZE,
      -half,
      -half,
      size,
      size,
    );
    ctx.restore();
  }
}
