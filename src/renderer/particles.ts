/**
 * Tiny pooled particle system for celebration bursts, flag sparkles and
 * dust puffs. Zero-allocation steady state (fixed pool).
 */

interface Particle {
  alive: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  life: number;
  size: number;
  color: string;
  gravity: number;
  shape: 'circle' | 'star' | 'ring';
}

const POOL_SIZE = 512;

export class Particles {
  private pool: Particle[] = [];
  private cursor = 0;

  constructor() {
    for (let i = 0; i < POOL_SIZE; i++) {
      this.pool.push({ alive: false, x: 0, y: 0, vx: 0, vy: 0, age: 0, life: 1, size: 2, color: '#fff', gravity: 0, shape: 'circle' });
    }
  }

  private emit(p: Partial<Particle> & { x: number; y: number }): void {
    const slot = this.pool[this.cursor];
    this.cursor = (this.cursor + 1) % POOL_SIZE;
    Object.assign(slot, {
      alive: true, vx: 0, vy: 0, age: 0, life: 0.8, size: 3,
      color: '#ffd76a', gravity: 0, shape: 'circle',
    }, p);
  }

  /** Radial burst (flag plant, goal reached). */
  burst(x: number, y: number, color = '#ffd76a', count = 14, speed = 90): void {
    for (let i = 0; i < count; i++) {
      const a = (Math.PI * 2 * i) / count + Math.random() * 0.4;
      const v = speed * (0.5 + Math.random() * 0.8);
      this.emit({
        x, y,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v,
        life: 0.5 + Math.random() * 0.5,
        size: 1.5 + Math.random() * 2.5,
        color,
        shape: Math.random() < 0.3 ? 'star' : 'circle',
      });
    }
    this.emit({ x, y, life: 0.45, size: 6, color, shape: 'ring' });
  }

  /** Soft sparkle drifting upward (flag pick-up). */
  sparkle(x: number, y: number, color = '#7dd3fc', count = 8): void {
    for (let i = 0; i < count; i++) {
      this.emit({
        x: x + (Math.random() - 0.5) * 14,
        y: y + (Math.random() - 0.5) * 14,
        vx: (Math.random() - 0.5) * 24,
        vy: -20 - Math.random() * 30,
        life: 0.5 + Math.random() * 0.4,
        size: 1 + Math.random() * 2,
        color,
        shape: 'star',
      });
    }
  }

  /** Dust kicked up while walking. */
  dust(x: number, y: number): void {
    this.emit({
      x: x + (Math.random() - 0.5) * 8,
      y: y + (Math.random() - 0.5) * 4,
      vx: (Math.random() - 0.5) * 16,
      vy: -6 - Math.random() * 10,
      life: 0.4 + Math.random() * 0.3,
      size: 1.5 + Math.random() * 2,
      color: 'rgba(148,163,184,0.5)',
    });
  }

  get activeCount(): number {
    let n = 0;
    for (const p of this.pool) if (p.alive) n++;
    return n;
  }

  update(dt: number): void {
    for (const p of this.pool) {
      if (!p.alive) continue;
      p.age += dt;
      if (p.age >= p.life) {
        p.alive = false;
        continue;
      }
      p.vy += p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
  }

  draw(ctx: CanvasRenderingContext2D): void {
    for (const p of this.pool) {
      if (!p.alive) continue;
      const t = p.age / p.life;
      const alpha = 1 - t;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      ctx.strokeStyle = p.color;
      if (p.shape === 'circle') {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (1 - t * 0.5), 0, Math.PI * 2);
        ctx.fill();
      } else if (p.shape === 'ring') {
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size + t * 26, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        drawStar(ctx, p.x, p.y, p.size * (1 - t * 0.4));
      }
      ctx.restore();
    }
  }
}

function drawStar(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = (Math.PI / 4) * i;
    const rad = i % 2 === 0 ? r : r * 0.4;
    const px = x + Math.cos(a) * rad;
    const py = y + Math.sin(a) * rad;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
}
