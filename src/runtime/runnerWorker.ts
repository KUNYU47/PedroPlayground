/**
 * Web Worker hosting the Pyodide Python interpreter. Student code runs here
 * so the UI thread never blocks, snapshots stream back as they happen, and a
 * runaway program can be hard-killed by terminating this worker (the client
 * respawns a fresh one).
 */
import { loadPyodide, type PyodideInterface } from 'pyodide';
import { PEDRO_PY } from './pedroPy';

export type WorkerInMessage =
  | { type: 'init' }
  | { type: 'run'; runId: number; code: string; worldText: string; stepCap: number }
  | { type: 'lint'; lintId: number; code: string };

export type WorkerOutMessage =
  | { type: 'ready' }
  | { type: 'init-error'; message: string }
  | { type: 'snapshot'; runId: number; snapshot: unknown }
  | { type: 'stdout'; runId: number; text: string }
  | { type: 'run-done'; runId: number; result: unknown }
  | { type: 'lint-result'; lintId: number; errors: unknown[] };

let pyodide: PyodideInterface | null = null;
let activeRunId = -1;

async function init(): Promise<void> {
  try {
    pyodide = await loadPyodide({ indexURL: new URL('/pyodide/', self.location.origin).href });
    // Bridge: Python -> JS snapshot streaming.
    (self as unknown as Record<string, unknown>).__post_snapshot__ = (payload: string) => {
      const msg: WorkerOutMessage = {
        type: 'snapshot',
        runId: activeRunId,
        snapshot: JSON.parse(payload),
      };
      self.postMessage(msg);
    };
    pyodide.globals.set('__post_snapshot__', (self as unknown as Record<string, unknown>).__post_snapshot__);
    pyodide.runPython(PEDRO_PY);
    pyodide.setStdout({
      batched: (text: string) => {
        const msg: WorkerOutMessage = { type: 'stdout', runId: activeRunId, text: text + '\n' };
        self.postMessage(msg);
      },
    });
    const msg: WorkerOutMessage = { type: 'ready' };
    self.postMessage(msg);
  } catch (err) {
    const msg: WorkerOutMessage = { type: 'init-error', message: String(err) };
    self.postMessage(msg);
  }
}

self.onmessage = async (event: MessageEvent<WorkerInMessage>) => {
  const data = event.data;
  if (data.type === 'init') {
    await init();
    return;
  }
  if (!pyodide) return;

  if (data.type === 'run') {
    activeRunId = data.runId;
    let result: unknown;
    try {
      const fn = pyodide.globals.get('__run_student__');
      const json = fn(data.code, data.worldText, data.stepCap);
      fn.destroy?.();
      result = JSON.parse(json as string);
    } catch (err) {
      result = {
        status: 'error',
        stats: { totalPickedUp: 0, plantedAtBase: 0, baseError: false, expectedFlags: 0 },
        error: { kind: 'RuntimeError', message: String(err), line: null },
      };
    }
    const msg: WorkerOutMessage = { type: 'run-done', runId: data.runId, result };
    self.postMessage(msg);
    activeRunId = -1;
    return;
  }

  if (data.type === 'lint') {
    let errors: unknown[] = [];
    try {
      const fn = pyodide.globals.get('__lint_student__');
      const json = fn(data.code);
      fn.destroy?.();
      errors = (JSON.parse(json as string) as { errors: unknown[] }).errors;
    } catch {
      errors = [];
    }
    const msg: WorkerOutMessage = { type: 'lint-result', lintId: data.lintId, errors };
    self.postMessage(msg);
  }
};
