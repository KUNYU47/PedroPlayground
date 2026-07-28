/**
 * Smooth 2D camera: fit-to-view with animated transitions, wheel zoom,
 * drag pan. All state is in "world pixel" coordinates (pre-zoom).
 */
export class Camera {
  /** World-pixel point shown at the center of the viewport. */
  cx = 0;
  cy = 0;
  scale = 1;

  private tx = 0;
  private ty = 0;
  private tScale = 1;
  private animating = false;

  /** Instantly move the camera target (and snap if `snap`). */
  setTarget(cx: number, cy: number, scale: number, snap = false): void {
    this.tx = cx;
    this.ty = cy;
    this.tScale = scale;
    if (snap) {
      this.cx = cx;
      this.cy = cy;
      this.scale = scale;
      this.animating = false;
    } else {
      this.animating = true;
    }
  }

  /** Compute a fit-to-view target for a world of (w × h) pixels. */
  fit(worldW: number, worldH: number, viewW: number, viewH: number, snap = false, padding = 48): void {
    const scale = Math.max(
      0.2,
      Math.min((viewW - padding * 2) / worldW, (viewH - padding * 2) / worldH, 3),
    );
    this.setTarget(worldW / 2, worldH / 2, scale, snap);
  }

  zoomAt(screenX: number, screenY: number, viewW: number, viewH: number, factor: number): void {
    const before = this.screenToWorld(screenX, screenY, viewW, viewH);
    const next = Math.min(6, Math.max(0.2, this.tScale * factor));
    this.tScale = next;
    // Keep the pointed-at world pixel under the cursor.
    const after = this.screenToWorldWith(screenX, screenY, viewW, viewH, this.tx, this.ty, next);
    this.tx += before.x - after.x;
    this.ty += before.y - after.y;
    this.animating = true;
  }

  panBy(dxScreen: number, dyScreen: number): void {
    this.tx -= dxScreen / this.tScale;
    this.ty -= dyScreen / this.tScale;
    this.animating = true;
  }

  update(dt: number): void {
    if (!this.animating) return;
    const k = 1 - Math.exp(-dt * 10);
    this.cx += (this.tx - this.cx) * k;
    this.cy += (this.ty - this.cy) * k;
    this.scale += (this.tScale - this.scale) * k;
    if (
      Math.abs(this.tx - this.cx) < 0.1 &&
      Math.abs(this.ty - this.cy) < 0.1 &&
      Math.abs(this.tScale - this.scale) < 0.001
    ) {
      this.cx = this.tx;
      this.cy = this.ty;
      this.scale = this.tScale;
      this.animating = false;
    }
  }

  get isAnimating(): boolean {
    return this.animating;
  }

  screenToWorld(sx: number, sy: number, viewW: number, viewH: number): { x: number; y: number } {
    return this.screenToWorldWith(sx, sy, viewW, viewH, this.cx, this.cy, this.scale);
  }

  private screenToWorldWith(
    sx: number, sy: number, viewW: number, viewH: number,
    cx: number, cy: number, scale: number,
  ): { x: number; y: number } {
    return {
      x: (sx - viewW / 2) / scale + cx,
      y: (sy - viewH / 2) / scale + cy,
    };
  }

  /** Apply the camera transform to a context for a viewport of viewW×viewH. */
  apply(ctx: CanvasRenderingContext2D, viewW: number, viewH: number): void {
    ctx.translate(viewW / 2, viewH / 2);
    ctx.scale(this.scale, this.scale);
    ctx.translate(-this.cx, -this.cy);
  }
}
