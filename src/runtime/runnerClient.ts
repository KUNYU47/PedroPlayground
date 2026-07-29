/**
 * Main-thread client for the Pyodide runner worker.
 *
 * Stability design:
 *  - The worker is lazily created and warmed up in the background.
 *  - Every run has a hard timeout; on timeout, cancellation or worker crash
 *    the worker is terminated and a fresh one spawned (snapshots streamed so
 *    far survive).
 *  - All calls are serialized per worker — a new run cancels the previous one.
 *  - Every run message carries a runId; stale messages from a previous run
 *    are ignored so snapshots/stdout/results never cross-contaminate.
 */
import type { LineEvent, RunError, RunOutcome, RunStats, Snapshot } from '../engine/types';
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
  private pendingRunId: number | null = null;
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
      // A hard crash (or the worker script itself failed to load): reject the
      // current run, settle the warmup promise, and respawn on next use.
      this.finishRun({ status: 'error', error: { kind: 'WorkerError', message: 'The Python engine crashed and was restarted.', line: null }, stats: emptyStats() });
      this.ready = false;
      this.readyPromise = null;
      this.onReadyChange?.(false);
      onReady?.(false);
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
          // Allow the next warmup() to retry with a fresh worker instead of
          // caching the failure forever.
          this.readyPromise = null;
          this.onReadyChange?.(false);
          onReady?.(false);
          break;
        case 'snapshot':
          if (this.pendingRun && msg.runId === this.pendingRunId) {
            this.pendingRun.callbacks.onSnapshot?.(msg.snapshot as Snapshot);
          }
          break;
        case 'stdout':
          if (this.pendingRun && msg.runId === this.pendingRunId) {
            this.pendingRun.callbacks.onStdout?.(msg.text);
          }
          break;
        case 'run-done': {
          if (!this.pendingRun || msg.runId !== this.pendingRunId) break;
          const result = msg.result as
            | { status: 'ok'; stats: RunStats; lineEvents?: LineEvent[] }
            | { status: 'error'; stats: RunStats; error: RunError; lineEvents?: LineEvent[] };
          this.finishRun(
            result.status === 'ok'
              ? { status: 'ok', stats: result.stats, lineEvents: result.lineEvents }
              : { status: 'error', error: result.error, stats: result.stats, lineEvents: result.lineEvents },
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
    const initMsg: WorkerInMessage = {
      type: 'init',
      // Resolved against the page (not the worker script) so the app works
      // when deployed under a sub-path (e.g. GitHub Pages project sites).
      pyodideUrl: new URL('pyodide/', document.baseURI).href,
    };
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
    this.pendingRunId = null;
    window.clearTimeout(pending.timer);
    pending.resolve(outcome);
  }

  /** Cancel any in-flight run (terminates + respawns the worker). */
  cancelRun(): void {
    if (!this.pendingRun) return;
    // The worker cannot be interrupted mid-Python without terminating it,
    // so we terminate + respawn for guaranteed cancellation.
    this.finishRun({ status: 'cancelled' });
    this.respawn();
  }

  private respawn(): void {
    this.readyPromise = null;
    this.ready = false;
    this.onReadyChange?.(false);
    void this.warmup();
  }

  async run(code: string, worldText: string, callbacks: RunCallbacks = {}, debug = false): Promise<RunOutcome> {
    if (this.pendingRun) {
      // A new run supersedes the old one — and since the old Python code is
      // still executing inside the worker, we must terminate + respawn (not
      // just abandon the promise) to guarantee the new run starts clean.
      this.cancelRun();
    }
    const id = ++this.runId;
    return new Promise<RunOutcome>((resolve) => {
      // Register the run BEFORE waiting for the engine, so Stop/cancel works
      // even while Pyodide is still waking up.
      this.pendingRun = { resolve, callbacks, timer: 0 };
      this.pendingRunId = id;
      void (async () => {
        const ok = await this.warmup();
        // Cancelled while the engine was warming up — drop silently.
        if (!this.pendingRun || this.pendingRunId !== id) return;
        if (!ok || !this.worker) {
          this.finishRun({
            status: 'error',
            error: { kind: 'EngineError', message: 'The Python engine failed to start. Check your connection and reload.', line: null },
            stats: emptyStats(),
          });
          return;
        }
        this.pendingRun.timer = window.setTimeout(() => {
          // Hard kill: worker is stuck (e.g. infinite loop in pure Python).
          this.finishRun({ status: 'timeout' });
          this.respawn();
        }, RUN_TIMEOUT_MS);
        const msg: WorkerInMessage = { type: 'run', runId: id, code, worldText, stepCap: STEP_CAP, debug };
        this.worker!.postMessage(msg);
      })();
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

  /** Terminate the worker and settle all pending calls (component teardown). */
  dispose(): void {
    this.finishRun({ status: 'cancelled' });
    for (const cb of this.pendingLints.values()) cb([]);
    this.pendingLints.clear();
    this.readyPromise = null;
    this.disposeWorker();
  }
}

function emptyStats(): RunStats {
  return { totalPickedUp: 0, plantedAtBase: 0, baseError: false, expectedFlags: 0 };
}
