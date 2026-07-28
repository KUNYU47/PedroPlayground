/**
 * Animation scheduler: turns the discrete snapshot stream into smooth
 * continuous motion (tweens). Pure logic — rendering reads poses from here.
 *
 * Features:
 *  - ease-in-out motion between cells, interpolated rotation for turns
 *  - merges 3 consecutive turn_left into one fluid turn_right during play
 *    (a trick carried over from the legacy app)
 *  - instant seek mode (scrubbing / instant replay)
 */
import { Replay } from '../engine/replay';
import { ActionType, Snapshot } from '../engine/types';

export type VisualAction = ActionType | 'turn_right' | 'idle';

export interface Pose {
  /** Continuous position in cell coordinates (col, row). */
  x: number;
  y: number;
  /** Continuous rotation in degrees; 0 = East, 90 = South (screen CW). */
  angle: number;
  action: VisualAction;
  /** 0..1 progress of the current action (drives sprite frame selection). */
  t: number;
}

interface Tween {
  action: VisualAction;
  fromX: number;
  fromY: number;
  fromAngle: number;
  toX: number;
  toY: number;
  toAngle: number;
  /** Snapshot index where the tween ends (inclusive). */
  endStep: number;
  /** How many snapshots this tween consumes (1, or 3 for merged turn_right). */
  consumes: number;
  startedAt: number;
  duration: number;
  changesApplied: boolean;
  firstLine: number | null;
}

/** Degrees for a direction (0=N,1=E,2=S,3=W) in screen space (CW positive). */
export function directionAngle(dir: number): number {
  return [-90, 0, 90, 180][dir & 3];
}

export const easeInOut = (t: number): number =>
  t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

export const easeOutBack = (t: number): number => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};

export class Animator {
  /** The snapshot index whose world-state changes are currently displayed. */
  appliedStep = -1;
  /** The step the user sees as "current" (drives line highlight / counter). */
  get currentStep(): number {
    if (this.tween) return this.tween.changesApplied ? this.tween.endStep : this.tween.endStep - this.tween.consumes;
    return this.appliedStep;
  }

  tween: Tween | null = null;

  reset(): void {
    this.tween = null;
    this.appliedStep = -1;
  }

  /** Snap instantly to a step (scrubbing, instant mode, stepping backward). */
  seek(step: number, replay: Replay): void {
    this.tween = null;
    this.appliedStep = Math.max(-1, Math.min(step, replay.length - 1));
  }

  /**
   * Advance animation toward `targetStep`. Returns true while more animation
   * work remains (i.e. we have not reached the target yet).
   */
  update(now: number, replay: Replay, targetStep: number, animated: boolean, speedMs: number): boolean {
    const target = Math.min(targetStep, replay.length - 1);

    // Backwards or instant: snap directly.
    if (!animated || target < this.appliedStep) {
      this.seek(target, replay);
      return false;
    }
    if (this.appliedStep >= target && !this.tween) return false;

    if (!this.tween) {
      this.tween = this.buildTween(now, replay, speedMs);
      if (!this.tween) return false;
    }

    const tw = this.tween;
    const t = Math.min(1, (now - tw.startedAt) / tw.duration);
    if (!tw.changesApplied && t >= 0.5) {
      tw.changesApplied = true;
      this.appliedStep = tw.endStep; // grid flips mid-action
    }
    if (t >= 1) {
      this.appliedStep = tw.endStep;
      this.tween = null;
      return this.appliedStep < target;
    }
    return true;
  }

  private buildTween(now: number, replay: Replay, speedMs: number): Tween | null {
    const next = this.appliedStep + 1;
    if (next >= replay.length) return null;
    const snap = replay.snapshots[next];
    const prev = replay.stateAt(next - 1);

    // Merge 3 consecutive turn_lefts into one smooth turn_right.
    if (
      snap.action === 'turn_left' &&
      next + 2 <= replay.length - 1 &&
      replay.snapshots[next + 1]?.action === 'turn_left' &&
      replay.snapshots[next + 2]?.action === 'turn_left'
    ) {
      const end = replay.snapshots[next + 2];
      return {
        action: 'turn_right',
        fromX: prev.col, fromY: prev.row, fromAngle: directionAngle(prev.direction),
        toX: end.col, toY: end.row, toAngle: directionAngle(prev.direction) + 90,
        endStep: next + 2,
        consumes: 3,
        startedAt: now,
        duration: speedMs * 1.6,
        changesApplied: false,
        firstLine: snap.line,
      };
    }

    const fromAngle = this.angleFrom(replay, next);
    const base: Tween = {
      action: snap.action,
      fromX: prev.col, fromY: prev.row, fromAngle,
      toX: snap.col, toY: snap.row, toAngle: fromAngle,
      endStep: next,
      consumes: 1,
      startedAt: now,
      duration: this.durationFor(snap.action, speedMs),
      changesApplied: false,
      firstLine: snap.line,
    };
    if (snap.action === 'turn_left') {
      base.toAngle = fromAngle - 90;
      base.toX = prev.col;
      base.toY = prev.row;
    }
    return base;
  }

  /** Best-effort continuous angle: reuse previous snapshot angle to avoid 180° snaps. */
  private angleFrom(replay: Replay, next: number): number {
    if (this.tween) return this.tween.toAngle;
    const prev = replay.stateAt(next - 1);
    return directionAngle(prev.direction);
  }

  private durationFor(action: ActionType, speedMs: number): number {
    switch (action) {
      case 'move': return speedMs;
      case 'turn_left': return speedMs * 0.7;
      case 'plant_flag':
      case 'pick_flag': return speedMs * 0.9;
    }
  }

  /** Current continuous pose for rendering. */
  pose(now: number, replay: Replay): Pose {
    if (!this.tween) {
      const s = replay.stateAt(this.appliedStep);
      return { x: s.col, y: s.row, angle: directionAngle(s.direction), action: 'idle', t: 0 };
    }
    const tw = this.tween;
    const raw = Math.min(1, (now - tw.startedAt) / tw.duration);
    const t = easeInOut(raw);
    return {
      x: tw.fromX + (tw.toX - tw.fromX) * t,
      y: tw.fromY + (tw.toY - tw.fromY) * t,
      angle: tw.fromAngle + (tw.toAngle - tw.fromAngle) * t,
      action: tw.action,
      t: raw,
    };
  }

  /**
   * Current execution position (debugger semantics): the line of the action
   * being animated, or of the last executed action while paused.
   */
  currentLine(replay: Replay): number | null {
    if (this.tween) return this.tween.firstLine;
    if (this.appliedStep >= 0 && this.appliedStep < replay.length) {
      return replay.snapshots[this.appliedStep].line;
    }
    return null;
  }

  /** Line that will execute next (Python Tutor style "next" arrow). */
  nextLine(replay: Replay): number | null {
    const n = this.tween ? this.tween.endStep + 1 : this.appliedStep + 1;
    if (n < replay.length) return replay.snapshots[n].line;
    return null;
  }
}
