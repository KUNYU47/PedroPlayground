/**
 * Main-thread client for the Pyodide runner worker.
 *
 * Stability design:
 *  - The worker is lazily created and warmed up in the background.
 *  - Every run has a hard timeout; on timeout or worker crash the worker is
 *    terminated and a fresh one spawned (snapshots streamed so far survive).
 *  - All calls are serialized per worker — a new run cancels the previous one.
 */
import type { RunError, RunOutcome, RunStats, Snapshot } from '../engine/types';
import type { WorkerInMessage, WorkerOutMessage } from './runnerWorker';

export interface LintError {
  kind: string;
  message: string;
  line: number;
  offset: number;
  end_offset: number;
}

export interface RunCallbacks {
  onSnapshot?: (snapshot: Snapshot) => void;
  onStdout?: (text: string) => void;
}

const RUN_TIMEOUT_MS = 10_000;
const STEP_CAP = 50_000;

type RunResolve = (outcome: RunOutcome) => void;

export class RunnerClient {
  private worker: Worker | null = null;
  private ready = false;
  private readyPromise: Promise<boolean> | null = null;
  private runId = 0;
  private lintId = 0;
  private pendingRun: { resolve: RunResolve; callbacks: RunCallbacks; timer: number } | null = null;
  private pendingLints = new Map<number, (errors: LintError[]) => void>();
  private onReadyChange?: (ready: boolean) => void;

  constructor(onReadyChange?: (ready: boolean) => void) {
    this.onReadyChange = onReadyChange;
  }

  /** Start loading Pyodide in the background (idempotent). */
  warmup(): Promise<boolean> {
    if (this.readyPromise) return this.readyPromise;
    this.readyPromise = new Promise((resolve) => {
      this.spawnWorker(resolve);
    });
    return this.readyPromise;
  }

  get isReady(): boolean {
    return this.ready;
  }

  private spawnWorker(onReady?: (ok: boolean) => void): void {
    this.disposeWorker();
    this.worker = new Worker(new URL('./runnerWorker.ts', import.meta.url), { type: 'module' });
    this.worker.onerror = () => {
      // A hard crash: reject current run and respawn on next use.
      this.failRun({ status: 'error', error: { kind: 'WorkerError', message: 'The Python engine crashed and was restarted.', line: null }, stats: emptyStats() });
      this.ready = false;
      this.readyPromise = null;
      this.onReadyChange?.(false);
    };
    this.worker.onmessage = (event: MessageEvent<WorkerOutMessage>) => {
      const msg = event.data;
      switch (msg.type) {
        case 'ready':
          this.ready = true;
          this.onReadyChange?.(true);
          onReady?.(true);
          break;
        case 'init-error':
          this.ready = false;
          this.onReadyChange?.(false);
          onReady?.(false);
          break;
        case 'snapshot':
          this.pendingRun?.callbacks.onSnapshot?.(msg.snapshot as Snapshot);
          break;
        case 'stdout':
          this.pendingRun?.callbacks.onStdout?.(msg.text);
          break;
        case 'run-done': {
          const result = msg.result as
            | { status: 'ok'; stats: RunStats }
            | { status: 'error'; stats: RunStats; error: RunError };
          this.finishRun(
            result.status === 'ok'
              ? { status: 'ok', stats: result.stats }
              : { status: 'error', error: result.error, stats: result.stats },
          );
          break;
        }
        case 'lint-result': {
          const cb = this.pendingLints.get(msg.lintId);
          this.pendingLints.delete(msg.lintId);
          cb?.(msg.errors as LintError[]);
          break;
        }
      }
    };
    const initMsg: WorkerInMessage = { type: 'init' };
    this.worker.postMessage(initMsg);
  }

  private disposeWorker(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    this.ready = false;
  }

  private finishRun(outcome: RunOutcome): void {
    const pending = this.pendingRun;
    if (!pending) return;
    this.pendingRun = null;
    window.clearTimeout(pending.timer);
    pending.resolve(outcome);
  }

  private failRun(outcome: RunOutcome): void {
    this.finishRun(outcome);
  }

  /** Cancel any in-flight run (keeps the worker alive). */
  cancelRun(): void {
    if (!this.pendingRun) return;
    // The worker cannot be interrupted mid-Python without terminating it,
    // so we terminate + respawn for guaranteed cancellation.
    this.failRun({ status: 'cancelled' });
    this.respawn();
  }

  private respawn(): void {
    this.readyPromise = null;
    this.ready = false;
    this.onReadyChange?.(false);
    void this.warmup();
  }

  async run(code: string, worldText: string, callbacks: RunCallbacks = {}): Promise<RunOutcome> {
    const ok = await this.warmup();
    if (!ok || !this.worker) {
      return {
        status: 'error',
        error: { kind: 'EngineError', message: 'The Python engine failed to start. Check your connection and reload.', line: null },
        stats: emptyStats(),
      };
    }
    if (this.pendingRun) {
      this.failRun({ status: 'cancelled' });
    }
    const id = ++this.runId;
    return new Promise<RunOutcome>((resolve) => {
      const timer = window.setTimeout(() => {
        // Hard kill: worker is stuck (e.g. infinite loop in pure Python).
        this.finishRun({ status: 'timeout' });
        this.respawn();
      }, RUN_TIMEOUT_MS);
      this.pendingRun = { resolve, callbacks, timer };
      const msg: WorkerInMessage = { type: 'run', runId: id, code, worldText, stepCap: STEP_CAP };
      this.worker!.postMessage(msg);
    });
  }

  async lint(code: string): Promise<LintError[]> {
    const ok = await this.warmup();
    if (!ok || !this.worker) return [];
    const id = ++this.lintId;
    return new Promise((resolve) => {
      this.pendingLints.set(id, resolve);
      const msg: WorkerInMessage = { type: 'lint', lintId: id, code };
      this.worker!.postMessage(msg);
      // Lints are best-effort: never hang the editor.
      window.setTimeout(() => {
        if (this.pendingLints.delete(id)) resolve([]);
      }, 5000);
    });
  }
}

function emptyStats(): RunStats {
  return { totalPickedUp: 0, plantedAtBase: 0, baseError: false, expectedFlags: 0 };
}
