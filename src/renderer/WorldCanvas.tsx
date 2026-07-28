/**
 * The world stage: a 60fps canvas renderer with a space theme.
 * Layers: starfield → grid → trail → flags → Pedro sprite → particles.
 * All motion is driven by the Animator (tween scheduler).
 */
import { useEffect, useRef, useCallback } from 'react';
import { Replay } from '../engine/replay';
import { BASE, EMPTY, WALL } from '../engine/types';
import { Animator, directionAngle, easeOutBack } from './animator';
import { Camera } from './camera';
import { Particles } from './particles';
import { Sprites, SpriteAction } from './sprites';
import { Tileset } from './tileset';

const CELL = 48; // world-pixel size of one cell

export interface WorldCanvasProps {
  replay: Replay | null;
  targetStep: number;
  playing: boolean;
  animated: boolean;
  speedMs: number;
  worldVersion: number; // bump to refit camera
  seek: { step: number; nonce: number }; // bump nonce to force an instant seek
  onStepChange?: (step: number) => void;
  onPlayEnd?: () => void;
  /** Current execution position (debugger style, persists while paused). */
  onActiveLine?: (line: number | null) => void;
  /** The line that will execute next (Python Tutor style arrow). */
  onNextLine?: (line: number | null) => void;
}

interface Star { x: number; y: number; r: number; phase: number; speed: number }

function hashCell(r: number, c: number): number {
  let h = (r * 374761393 + c * 668265263) | 0;
  h = (h ^ (h >> 13)) * 1274126177;
  return Math.abs(h ^ (h >> 16));
}

export function WorldCanvas(props: WorldCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const propsRef = useRef(props);
  propsRef.current = props;

  const engineRef = useRef<{
    animator: Animator;
    camera: Camera;
    particles: Particles;
    sprites: Sprites | null;
    tileset: Tileset | null;
    stars: Star[];
    lastTime: number;
    lastReportedStep: number;
    fxTween: object | null;
    lastDustAt: number;
    lastLine: number | null;
    lastNextLine: number | null;
    lastSeekNonce: number;
  }>({
    animator: new Animator(),
    camera: new Camera(),
    particles: new Particles(),
    sprites: null,
    tileset: null,
    stars: [],
    lastTime: 0,
    lastReportedStep: -2,
    fxTween: null,
    lastDustAt: 0,
    lastLine: null,
    lastNextLine: null,
    lastSeekNonce: -1,
});

  // Load sprites + tileset once.
  useEffect(() => {
    let cancelled = false;
    Sprites.load('/assets/Astronaut-Sheet.png')
      .then((s) => { if (!cancelled) engineRef.current.sprites = s; })
      .catch(() => { /* sprite optional: renderer falls back to a drawn astronaut */ });
    Tileset.load('/assets/Blocks.png')
      .then((t) => { if (!cancelled) engineRef.current.tileset = t; })
      .catch(() => { /* tileset optional: procedural fallback tiles */ });
    return () => { cancelled = true; };
  }, []);

  // Reset animator + refit camera when the world changes.
  useEffect(() => {
    const eng = engineRef.current;
    eng.animator.reset();
    eng.lastReportedStep = -2;
    const canvas = canvasRef.current;
    const world = props.replay?.world;
    if (canvas && world) {
      eng.camera.fit(
        world.grid[0].length * CELL,
        world.grid.length * CELL,
        canvas.clientWidth,
        canvas.clientHeight,
        false,
      );
    }
  }, [props.worldVersion, props.replay]);

  const drawFrame = useCallback((now: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const eng = engineRef.current;
    const { replay, targetStep, playing, animated, speedMs } = propsRef.current;

    const dpr = window.devicePixelRatio || 1;
    const vw = canvas.clientWidth;
    const vh = canvas.clientHeight;
    if (canvas.width !== vw * dpr || canvas.height !== vh * dpr) {
      canvas.width = vw * dpr;
      canvas.height = vh * dpr;
    }

    const dt = Math.min(0.05, (now - (eng.lastTime || now)) / 1000);
    eng.lastTime = now;
    const t = now / 1000;

    // --- advance animation state ---
    if (replay) {
      const { seek } = propsRef.current;
      if (seek.nonce !== eng.lastSeekNonce) {
        eng.lastSeekNonce = seek.nonce;
        eng.animator.seek(seek.step, replay);
      }
      const more = eng.animator.update(now, replay, targetStep, animated, speedMs);
      const step = eng.animator.currentStep;
      if (step !== eng.lastReportedStep) {
        eng.lastReportedStep = step;
        propsRef.current.onStepChange?.(step);
      }
      const line = eng.animator.currentLine(replay);
      if (line !== eng.lastLine) {
        eng.lastLine = line;
        propsRef.current.onActiveLine?.(line);
      }
      const nextLine = eng.animator.nextLine(replay);
      if (nextLine !== eng.lastNextLine) {
        eng.lastNextLine = nextLine;
        propsRef.current.onNextLine?.(nextLine);
      }
      // action effects at the "hit" moment
      const tween = eng.animator.tween;
      if (tween && eng.fxTween !== tween && tween.changesApplied) {
        eng.fxTween = tween;
        const snap = replay.snapshots[tween.endStep];
        const cx = (snap.col + 0.5) * CELL;
        const cy = (snap.row + 0.5) * CELL;
        if (tween.action === 'plant_flag') eng.particles.burst(cx, cy, '#ffd76a', 16, 100);
        if (tween.action === 'pick_flag') eng.particles.sparkle(cx, cy, '#7dd3fc', 10);
      }
      if (!more && playing) propsRef.current.onPlayEnd?.();
    }

    eng.camera.update(dt);
    eng.particles.update(dt);

    // --- render ---
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawSpace(ctx, vw, vh, t, eng.stars, eng.tileset);

    if (!replay) return;
    const world = replay.world;

    ctx.save();
    eng.camera.apply(ctx, vw, vh);

    const state = replay.stateAt(eng.animator.appliedStep);
    const pose = eng.animator.pose(now, replay);

    drawGrid(ctx, world.grid, t, eng.tileset);
    drawTrail(ctx, replay, eng.animator.appliedStep);
    drawFlags(ctx, state.grid, t, eng.animator, replay);
    drawPedro(ctx, eng.sprites, pose, t, eng.particles, now, eng);
    eng.particles.draw(ctx);

    ctx.restore();
  }, []);

  // Main rAF loop.
  useEffect(() => {
    let raf = 0;
    const loop = (now: number) => {
      drawFrame(now);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [drawFrame]);

  // Generate stars once per mount.
  useEffect(() => {
    const stars: Star[] = [];
    for (let i = 0; i < 160; i++) {
      stars.push({
        x: Math.random(), y: Math.random(),
        r: 0.5 + Math.random() * 1.6,
        phase: Math.random() * Math.PI * 2,
        speed: 0.4 + Math.random() * 1.4,
      });
    }
    engineRef.current.stars = stars;
  }, []);

  // --- pointer interactions: pan / zoom ---
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const eng = engineRef.current;
    let dragging = false;
    let lastX = 0;
    let lastY = 0;

    const onPointerDown = (e: PointerEvent) => {
      dragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
      canvas.setPointerCapture(e.pointerId);
      canvas.style.cursor = 'grabbing';
    };
    const onPointerMove = (e: PointerEvent) => {
      if (!dragging) return;
      eng.camera.panBy(e.clientX - lastX, e.clientY - lastY);
      lastX = e.clientX;
      lastY = e.clientY;
    };
    const onPointerUp = () => {
      dragging = false;
      canvas.style.cursor = 'grab';
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      eng.camera.zoomAt(e.clientX - rect.left, e.clientY - rect.top, rect.width, rect.height, e.deltaY < 0 ? 1.15 : 1 / 1.15);
    };
    const onDblClick = () => {
      const world = propsRef.current.replay?.world;
      if (world) {
        eng.camera.fit(
          world.grid[0].length * CELL,
          world.grid.length * CELL,
          canvas.clientWidth,
          canvas.clientHeight,
        );
      }
    };

    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('wheel', onWheel, { passive: false });
    canvas.addEventListener('dblclick', onDblClick);
    return () => {
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('wheel', onWheel);
      canvas.removeEventListener('dblclick', onDblClick);
    };
  }, []);

  return <canvas ref={canvasRef} className="world-canvas" style={{ cursor: 'grab' }} />;
}

/* ------------------------------ drawing ------------------------------ */

function drawSpace(
  ctx: CanvasRenderingContext2D,
  vw: number,
  vh: number,
  t: number,
  stars: Star[],
  tileset: Tileset | null,
): void {
  const bg = ctx.createLinearGradient(0, 0, 0, vh);
  bg.addColorStop(0, '#0b1026');
  bg.addColorStop(0.6, '#0d1330');
  bg.addColorStop(1, '#131a3a');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, vw, vh);

  // drifting nebulas
  for (let i = 0; i < 3; i++) {
    const nx = vw * (0.2 + 0.3 * i) + Math.sin(t * 0.05 + i * 2.1) * 40;
    const ny = vh * (0.3 + 0.2 * ((i * 7) % 3)) + Math.cos(t * 0.04 + i * 1.7) * 30;
    const neb = ctx.createRadialGradient(nx, ny, 0, nx, ny, vw * 0.28);
    const hue = ['99,102,241', '56,189,248', '168,85,247'][i];
    neb.addColorStop(0, `rgba(${hue},0.07)`);
    neb.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = neb;
    ctx.fillRect(0, 0, vw, vh);
  }

  // tileset background decorations (slow drift, subtle)
  if (tileset) {
    ctx.save();
    ctx.globalAlpha = 0.35;
    ctx.imageSmoothingEnabled = false;
    for (let i = 0; i < 7; i++) {
      const h = hashCell(i * 13 + 5, i * 29 + 7);
      const sprite = tileset.decor(h % tileset.decorCount());
      const scale = 2 + (h % 3);
      const w = sprite.width * scale;
      const hh = sprite.height * scale;
      const x = (h % 1000) / 1000 * (vw + w) - w + Math.sin(t * 0.03 + i) * 12;
      const y = ((h >> 8) % 1000) / 1000 * (vh + hh) - hh + Math.cos(t * 0.025 + i * 2) * 10;
      ctx.drawImage(sprite, x, y, w, hh);
    }
    ctx.restore();
  }

  for (const s of stars) {
    const tw = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t * s.speed + s.phase));
    ctx.globalAlpha = tw;
    ctx.fillStyle = '#e2e8f0';
    ctx.beginPath();
    ctx.arc(s.x * vw, s.y * vh, s.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawGrid(ctx: CanvasRenderingContext2D, grid: number[][], t: number, tileset: Tileset | null): void {
  const rows = grid.length;
  const cols = grid[0]?.length ?? 0;

  // soft glow underneath the board
  ctx.save();
  ctx.shadowColor = 'rgba(99,102,241,0.35)';
  ctx.shadowBlur = 40;
  ctx.fillStyle = 'rgba(20,26,54,0.92)';
  roundRect(ctx, -8, -8, cols * CELL + 16, rows * CELL + 16, 14);
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.imageSmoothingEnabled = false;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = c * CELL;
      const y = r * CELL;
      const v = grid[r][c];
      const h = hashCell(r, c);

      if (v === WALL) {
        if (tileset) {
          // bright moon bricks; ~1/7 of walls hide a gem for delight
          const tile = h % 7 === 3 ? tileset.gem(h >> 4) : tileset.wall(h);
          ctx.drawImage(tile, x, y, CELL, CELL);
        } else {
          // procedural fallback: beveled moon rock
          const g = ctx.createLinearGradient(x, y, x, y + CELL);
          g.addColorStop(0, '#8d9cc8');
          g.addColorStop(0.15, '#7281ad');
          g.addColorStop(1, '#525f88');
          ctx.fillStyle = g;
          roundRect(ctx, x + 1, y + 1, CELL - 2, CELL - 2, 7);
          ctx.fill();
          ctx.strokeStyle = 'rgba(226,232,240,0.35)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(x + 7, y + 2.5);
          ctx.lineTo(x + CELL - 7, y + 2.5);
          ctx.stroke();
        }
      } else {
        if (tileset) {
          // same brick material, heavily darkened → strong wall/floor contrast
          ctx.drawImage(tileset.floor(h), x, y, CELL, CELL);
        } else {
          ctx.fillStyle = '#171d36';
          roundRect(ctx, x + 1, y + 1, CELL - 2, CELL - 2, 6);
          ctx.fill();
        }
        if (v === BASE) drawBase(ctx, x, y, t);
      }
    }
  }
  ctx.restore();
}

function drawBase(ctx: CanvasRenderingContext2D, x: number, y: number, t: number): void {
  const cx = x + CELL / 2;
  const cy = y + CELL / 2;
  const pulse = 0.5 + 0.5 * Math.sin(t * 2.4);
  ctx.save();
  ctx.strokeStyle = `rgba(52,211,153,${0.25 + pulse * 0.35})`;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, 15 + pulse * 3, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = 'rgba(6,78,59,0.65)';
  ctx.beginPath();
  ctx.arc(cx, cy, 14, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#34d399';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, 14, 0, Math.PI * 2);
  ctx.stroke();
  // landing "H"
  ctx.strokeStyle = 'rgba(167,243,208,0.9)';
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.moveTo(cx - 5, cy - 5); ctx.lineTo(cx - 5, cy + 5);
  ctx.moveTo(cx + 5, cy - 5); ctx.lineTo(cx + 5, cy + 5);
  ctx.moveTo(cx - 5, cy); ctx.lineTo(cx + 5, cy);
  ctx.stroke();
  ctx.restore();
}

function drawTrail(ctx: CanvasRenderingContext2D, replay: Replay, uptoStep: number): void {
  ctx.save();
  ctx.fillStyle = 'rgba(125,211,252,0.22)';
  const seen = new Set<string>();
  const start = replay.world;
  seen.add(`${start.startRow},${start.startCol}`);
  for (let i = 0; i <= Math.min(uptoStep, replay.length - 1); i++) {
    const s = replay.snapshots[i];
    if (s.action !== 'move') continue;
    const key = `${s.row},${s.col}`;
    if (seen.has(key) && i !== 0) continue;
    seen.add(key);
    ctx.beginPath();
    ctx.arc((s.col + 0.5) * CELL, (s.row + 0.5) * CELL, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawFlags(
  ctx: CanvasRenderingContext2D,
  grid: number[][],
  t: number,
  animator: Animator,
  replay: Replay,
): void {
  const tween = animator.tween;
  const tweenSnap = tween ? replay.snapshots[tween.endStep] : null;

  for (let r = 0; r < grid.length; r++) {
    for (let c = 0; c < grid[r].length; c++) {
      const v = grid[r][c];
      if (v < 2) continue;
      const count = v - 1;
      // During a plant tween, pop the freshly planted flag.
      let scale = 1;
      if (tween && tweenSnap && tween.action === 'plant_flag' && tweenSnap.row === r && tweenSnap.col === c) {
        const p = Math.max(0, (tweenNow(tween) - 0.35) / 0.5);
        scale = p <= 0 ? 0 : easeOutBack(Math.min(1, p));
        if (scale <= 0) continue;
      }
      drawFlag(ctx, c * CELL, r * CELL, count, t, scale);
    }
  }

  // During a pick tween, the removed flag flies toward Pedro and fades.
  if (tween && tweenSnap && tween.action === 'pick_flag') {
    const p = tweenNow(tween);
    if (p > 0.3) {
      const q = Math.min(1, (p - 0.3) / 0.6);
      const pose = animator.pose(performance.now(), replay);
      const fromX = (tweenSnap.col + 0.5) * CELL;
      const fromY = (tweenSnap.row + 0.5) * CELL;
      const toX = (pose.x + 0.5) * CELL;
      const toY = (pose.y + 0.5) * CELL;
      const x = fromX + (toX - fromX) * q - CELL / 2;
      const y = fromY + (toY - fromY) * q - CELL / 2 - q * 10;
      ctx.save();
      ctx.globalAlpha = 1 - q * 0.8;
      drawFlag(ctx, x, y, 1, t, 1 - q * 0.4);
      ctx.restore();
    }
  }
}

function tweenNow(tween: { startedAt: number; duration: number }): number {
  return Math.min(1, (performance.now() - tween.startedAt) / tween.duration);
}

function drawFlag(ctx: CanvasRenderingContext2D, x: number, y: number, count: number, t: number, scale: number): void {
  const cx = x + CELL / 2;
  const baseY = y + CELL - 8;
  ctx.save();
  ctx.translate(cx, baseY);
  ctx.scale(scale, scale);

  const flags = Math.min(count, 3);
  for (let i = 0; i < flags; i++) {
    const off = (i - (flags - 1) / 2) * 5;
    const wave = Math.sin(t * 3 + i * 1.3) * 1.6;
    // pole
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(off, 0);
    ctx.lineTo(off, -18);
    ctx.stroke();
    // waving triangle
    ctx.fillStyle = ['#f87171', '#fb923c', '#facc15'][i % 3];
    ctx.beginPath();
    ctx.moveTo(off, -18);
    ctx.quadraticCurveTo(off + 6, -16 + wave, off + 11, -13 + wave);
    ctx.quadraticCurveTo(off + 6, -11 + wave * 0.5, off, -9);
    ctx.closePath();
    ctx.fill();
  }

  if (count > 1) {
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.arc(11, -2, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#facc15';
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.fillStyle = '#fde68a';
    ctx.font = 'bold 9px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(count), 11, -1.5);
  }
  ctx.restore();
}

function drawPedro(
  ctx: CanvasRenderingContext2D,
  sprites: Sprites | null,
  pose: { x: number; y: number; angle: number; action: string; t: number },
  t: number,
  particles: Particles,
  now: number,
  eng: { lastDustAt: number },
): void {
  const px = (pose.x + 0.5) * CELL;
  const py = (pose.y + 0.5) * CELL;

  // soft shadow
  ctx.fillStyle = 'rgba(2,6,23,0.45)';
  ctx.beginPath();
  ctx.ellipse(px, py + CELL * 0.32, CELL * 0.26, CELL * 0.1, 0, 0, Math.PI * 2);
  ctx.fill();

  // walking dust
  if (pose.action === 'move' && now - eng.lastDustAt > 90) {
    eng.lastDustAt = now;
    particles.dust(px, py + CELL * 0.3);
  }

  const angleRad = (pose.angle * Math.PI) / 180;
  const bob = pose.action === 'idle' ? Math.sin(t * 2) * 1.2 : 0;

  if (sprites) {
    const action = (pose.action === 'turn_right' ? 'turn_left' : pose.action) as SpriteAction;
    const frame =
      pose.action === 'idle'
        ? Math.floor(t * 1.5) % sprites.frameCount('idle')
        : Math.floor(pose.t * sprites.frameCount(action));
    sprites.draw(ctx, action, frame, px, py + bob, CELL * 0.95, angleRad);
  } else {
    // fallback: simple drawn astronaut
    ctx.save();
    ctx.translate(px, py + bob);
    ctx.rotate(angleRad);
    ctx.fillStyle = '#e2e8f0';
    ctx.beginPath();
    ctx.arc(0, 0, CELL * 0.28, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#38bdf8';
    ctx.beginPath();
    ctx.arc(CELL * 0.1, 0, CELL * 0.14, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

export { directionAngle };
