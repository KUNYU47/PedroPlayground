/**
 * Pedro Playground — main application shell.
 *
 * Left: Monaco-based mini IDE. Right: animated world stage with a full
 * replay transport (run / step / scrub / play). Python runs in a Pyodide
 * worker; snapshots stream back and drive the record-then-replay model.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { EditorPane, EditorPaneHandle, Diagnostic } from './editor/EditorPane';
import { heuristicDiagnostics } from './editor/heuristics';
import { parseWorldText } from './engine/world';
import { Replay } from './engine/replay';
import { Snapshot, WorldData, RunOutcome } from './engine/types';
import { RunnerClient } from './runtime/runnerClient';
import { friendlyError } from './runtime/friendlyError';
import { WorldCanvas } from './renderer/WorldCanvas';
import { WorldEditorDialog } from './ui/WorldEditorDialog';
import { HelpDialog } from './ui/HelpDialog';
import {
  BUILTIN_WORLDS, CustomWorld, MISSIONS, Mission,
  fetchScaffold, fetchUserWorldNames, fetchWorld, loadCustomWorlds, loadSavedCode,
  prettyWorldName, randomizeStart, saveCode, saveCustomWorlds,
} from './ui/missions';

type Tone = 'info' | 'ok' | 'warn' | 'error';
type Phase = 'booting' | 'ready' | 'running' | 'done';

const DEFAULT_CODE = 'from pedro import *\n\n\ndef main():\n    # Write your code here!\n    pass\n\n\nif __name__ == \'__main__\':\n    main()\n';

export default function App() {
  const editorRef = useRef<EditorPaneHandle>(null);
  const runnerRef = useRef<RunnerClient | null>(null);
  if (!runnerRef.current) {
    runnerRef.current = new RunnerClient((ready) => {
      setEngineReady(ready);
      setPhase((p) => (p === 'booting' && ready ? 'ready' : p));
    });
  }
  const runner = runnerRef.current;

  const [mission, setMission] = useState<Mission>(MISSIONS[0]);
  const [worldName, setWorldName] = useState<string>(MISSIONS[0].world);
  const [worldText, setWorldText] = useState('');
  const [worldData, setWorldData] = useState<WorldData | null>(null);
  const [replay, setReplay] = useState<Replay | null>(null);
  const [targetStep, setTargetStep] = useState(-1);
  const [displayStep, setDisplayStep] = useState(-1);
  const [seek, setSeek] = useState<{ step: number; nonce: number }>({ step: -1, nonce: 0 });
  const [playing, setPlaying] = useState(false);
  const [animated, setAnimated] = useState(true);
  const [speedPct, setSpeedPct] = useState(55);
  const [phase, setPhase] = useState<Phase>('booting');
  const [engineReady, setEngineReady] = useState(false);
  const [status, setStatus] = useState<{ text: string; tone: Tone }>({ text: 'Starting the Python engine…', tone: 'info' });
  const [stdout, setStdout] = useState<string[]>([]);
  const [customWorlds, setCustomWorlds] = useState<CustomWorld[]>(() => loadCustomWorlds());
  // Worlds from the user-editable worlds/ folder (launch.py); empty when
  // the app is served statically without the launcher.
  const [folderWorlds, setFolderWorlds] = useState<string[]>([]);
  const [editorOpen, setEditorOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [worldVersion, setWorldVersion] = useState(0);
  const [splitPct, setSplitPct] = useState(44);
  const [runProgress, setRunProgress] = useState(0);

  const snapshotsRef = useRef<Snapshot[]>([]);
  const lintTimerRef = useRef(0);
  const saveTimerRef = useRef(0);
  const codeRef = useRef(DEFAULT_CODE);
  const missionRef = useRef(mission);
  missionRef.current = mission;

  const speedMs = Math.round(1100 * Math.pow(60 / 1100, speedPct / 100));

  /* ---------------------------- world loading ---------------------------- */

  const applyWorld = useCallback((text: string) => {
    try {
      const data = parseWorldText(text);
      setWorldText(text);
      setWorldData(data);
      setReplay(new Replay(data, []));
      setTargetStep(-1);
      setDisplayStep(-1);
      setPlaying(false);
      setWorldVersion((v) => v + 1);
      return true;
    } catch (e) {
      setStatus({ text: `World error: ${e instanceof Error ? e.message : e}`, tone: 'error' });
      return false;
    }
  }, []);

  const loadWorldByName = useCallback(async (name: string, customs: CustomWorld[]) => {
    const custom = customs.find((w) => w.name === name);
    try {
      const text = custom ? custom.text : await fetchWorld(name);
      if (applyWorld(text)) {
        setStatus({ text: `World: ${prettyWorldName(name)}`, tone: 'info' });
      }
    } catch (e) {
      setStatus({ text: `Could not load world: ${e instanceof Error ? e.message : e}`, tone: 'error' });
    }
  }, [applyWorld]);

  const loadMission = useCallback(async (m: Mission) => {
    setPlaying(false);
    editorRef.current?.setErrorLine(null);
    editorRef.current?.setActiveLine(null);
    editorRef.current?.setNextLine(null);
    setStdout([]);
    try {
      const saved = loadSavedCode(m.id);
      const scaffold = saved ?? (await fetchScaffold(m.scaffold).catch(() => DEFAULT_CODE));
      codeRef.current = scaffold;
      editorRef.current?.setValue(scaffold);
      setWorldName(m.world);
      await loadWorldByName(m.world, customWorlds);
      setStatus({ text: `${m.emoji} ${m.title} — ${m.description}`, tone: 'info' });
    } catch (e) {
      setStatus({ text: `Could not load mission: ${e instanceof Error ? e.message : e}`, tone: 'error' });
    }
  }, [customWorlds, loadWorldByName]);

  // initial load + warm up the Python engine in the background
  useEffect(() => {
    void loadMission(MISSIONS[0]);
    void runner.warmup();
    void fetchUserWorldNames().then(setFolderWorlds);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------------------------- lint pipeline ---------------------------- */

  const runLint = useCallback((code: string) => {
    const heuristics = heuristicDiagnostics(code);
    editorRef.current?.setDiagnostics(heuristics);
    void runner.lint(code).then((errors) => {
      const pyDiags: Diagnostic[] = errors.map((e) => ({
        line: e.line,
        col: e.offset,
        endCol: e.end_offset,
        message: `${e.kind}: ${e.message}`,
        severity: 'error' as const,
      }));
      editorRef.current?.setDiagnostics([...pyDiags, ...heuristics]);
    });
  }, [runner]);

  const handleCodeChange = useCallback((code: string) => {
    codeRef.current = code;
    window.clearTimeout(lintTimerRef.current);
    lintTimerRef.current = window.setTimeout(() => runLint(code), 700);
    window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(() => saveCode(missionRef.current.id, code), 800);
  }, [runLint]);

  /* ------------------------------ run control ---------------------------- */

  const finishRun = useCallback((outcome: RunOutcome, data: WorldData) => {
    const snaps = snapshotsRef.current;
    const rp = new Replay(data, snaps);
    setReplay(rp);
    setTargetStep(snaps.length - 1);
    setPhase('done');

    switch (outcome.status) {
      case 'ok': {
        const s = outcome.stats;
        if (s.baseError) {
          setStatus({
            text: `Almost! Pedro planted ${s.plantedAtBase} flag(s) at the base, but picked up ${s.expectedFlags}. Bring them all home! 🏠`,
            tone: 'warn',
          });
        } else if (snaps.length === 0) {
          setStatus({ text: 'Pedro did nothing — did you call main()?', tone: 'warn' });
        } else {
          setStatus({ text: `Great job! Program finished in ${snaps.length} step${snaps.length === 1 ? '' : 's'}. 🎉`, tone: 'ok' });
        }
        setPlaying(true);
        break;
      }
      case 'error': {
        const friendly = friendlyError(outcome.error);
        setStatus({
          text: snaps.length > 0 ? `${friendly} — replaying the ${snaps.length} step${snaps.length === 1 ? '' : 's'} before the crash.` : friendly,
          tone: 'error',
        });
        editorRef.current?.setErrorLine(outcome.error.line);
        setPlaying(true);
        break;
      }
      case 'timeout':
        setStatus({
          text: `Pedro ran for too long and had to stop (infinite loop?). Showing what happened before the timeout.`,
          tone: 'warn',
        });
        setPlaying(true);
        break;
      case 'cancelled':
        setStatus({ text: 'Run stopped.', tone: 'info' });
        break;
    }
  }, []);

  const handleRun = useCallback(async () => {
    if (phase === 'running') {
      runner.cancelRun();
      return;
    }
    if (!worldText || !worldData) return;
    editorRef.current?.setErrorLine(null);
    editorRef.current?.setActiveLine(null);
    editorRef.current?.setNextLine(null);
    setStdout([]);
    snapshotsRef.current = [];
    setRunProgress(0);

    let text = worldText;
    let data = worldData;
    if (mission.randomizeStart) {
      text = randomizeStart(worldText);
      data = parseWorldText(text);
      setWorldData(data);
      setReplay(new Replay(data, []));
      setWorldVersion((v) => v + 1);
    }

    setPhase('running');
    setPlaying(false);
    setTargetStep(-1);
    setDisplayStep(-1);
    setStatus({ text: engineReady ? 'Running…' : 'Waking up the Python engine (first run takes a few seconds)…', tone: 'info' });

    const outcome = await runner.run(codeRef.current, text, {
      onSnapshot: (snap) => {
        snapshotsRef.current.push(snap);
        setRunProgress(snapshotsRef.current.length);
      },
      onStdout: (t) => setStdout((old) => [...old.slice(-199), t]),
    });
    finishRun(outcome, data);
  }, [phase, worldText, worldData, mission, engineReady, runner, finishRun]);

  /* --------------------------- playback control -------------------------- */

  const replayLen = replay?.length ?? 0;

  const handlePlayPause = useCallback(() => {
    if (!replay || replayLen === 0) return;
    if (playing) {
      setSeek((s) => ({ step: displayStep, nonce: s.nonce + 1 }));
      setTargetStep(displayStep);
      setPlaying(false);
    } else {
      const from = displayStep >= replayLen - 1 ? -1 : displayStep;
      if (from === -1) {
        setSeek((s) => ({ step: -1, nonce: s.nonce + 1 }));
        setDisplayStep(-1);
      }
      setTargetStep(replayLen - 1);
      setPlaying(true);
    }
  }, [replay, replayLen, playing, displayStep]);

  const handleStepForward = useCallback(() => {
    if (!replay || replayLen === 0) return;
    setPlaying(false);
    setTargetStep((t) => Math.min(Math.max(t, displayStep) + 1, replayLen - 1));
  }, [replay, replayLen, displayStep]);

  const handleStepBack = useCallback(() => {
    if (!replay || replayLen === 0) return;
    setPlaying(false);
    const next = Math.max(-1, displayStep - 1);
    setSeek((s) => ({ step: next, nonce: s.nonce + 1 }));
    setTargetStep(next);
    setDisplayStep(next);
  }, [replay, replayLen, displayStep]);

  const handleReset = useCallback(() => {
    setPlaying(false);
    setSeek((s) => ({ step: -1, nonce: s.nonce + 1 }));
    setTargetStep(-1);
    setDisplayStep(-1);
    editorRef.current?.setActiveLine(null);
    editorRef.current?.setNextLine(null);
  }, []);

  /** Restore the mission to its initial state: original scaffold + default world. */
  const handleResetMission = useCallback(() => {
    if (!window.confirm(`Reset "${mission.title}" to its starting code and world? Your code for this mission will be replaced.`)) {
      return;
    }
    try {
      localStorage.removeItem('pedro.v2.code.' + mission.id);
    } catch { /* ignore */ }
    void loadMission(mission);
  }, [mission, loadMission]);

  /* ------------------------- code import / export ------------------------ */

  const handleExportCode = useCallback(() => {
    const blob = new Blob([codeRef.current], { type: 'text/x-python' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${mission.id}.py`;
    a.click();
    URL.revokeObjectURL(url);
    setStatus({ text: `Saved ${mission.id}.py 💾`, tone: 'ok' });
  }, [mission]);

  const importCodeText = useCallback((text: string, name: string) => {
    if (!text.trim()) return;
    codeRef.current = text;
    editorRef.current?.setValue(text);
    handleCodeChange(text);
    setStatus({ text: `Loaded ${name} 📂`, tone: 'ok' });
  }, [handleCodeChange]);

  const handleImportCode = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.py,.txt';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (file) importCodeText(await file.text(), file.name);
    };
    input.click();
  }, [importCodeText]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    if (!/\.(py|txt)$/i.test(file.name)) {
      setStatus({ text: 'Please drop a .py file!', tone: 'warn' });
      return;
    }
    void file.text().then((text) => importCodeText(text, file.name));
  }, [importCodeText]);

  const handleScrub = useCallback((value: number) => {
    if (!replay) return;
    setPlaying(false);
    const step = Math.max(-1, Math.min(value, replayLen - 1));
    setSeek((s) => ({ step, nonce: s.nonce + 1 }));
    setTargetStep(step);
    setDisplayStep(step);
  }, [replay, replayLen]);

  // Global F5 shortcut.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'F5') {
        e.preventDefault();
        void handleRun();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleRun]);

  const flagsCarried = useMemo(() => {
    if (!replay) return 0;
    return replay.stateAt(displayStep).flagsCarried;
  }, [replay, displayStep]);

  /* ------------------------------- splitter ------------------------------ */

  const splitRef = useRef<HTMLDivElement>(null);
  const onSplitterDown = (e: React.PointerEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startPct = splitPct;
    const total = splitRef.current?.parentElement?.clientWidth ?? 1;
    const move = (ev: PointerEvent) => {
      const delta = ((ev.clientX - startX) / total) * 100;
      setSplitPct(Math.min(70, Math.max(25, startPct + delta)));
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  const running = phase === 'running';
  const runLabel = running ? `⏹ Stop (${runProgress})` : engineReady ? '▶ Run' : '⏳ Loading…';

  return (
    <div className="app">
      <header className="app-header">
        <div className="brand">
          <span className="brand-emoji">🧑‍🚀</span>
          <span className="brand-name">Pedro Playground</span>
        </div>
        <label className="header-field">
          <span>Mission</span>
          <select
            value={mission.id}
            onChange={(e) => {
              const m = MISSIONS.find((x) => x.id === e.target.value)!;
              setMission(m);
              void loadMission(m);
            }}
          >
            {MISSIONS.map((m) => (
              <option key={m.id} value={m.id}>{m.emoji} {m.title}</option>
            ))}
          </select>
        </label>
        <label className="header-field">
          <span>World</span>
          <select
            value={worldName}
            onChange={(e) => {
              setWorldName(e.target.value);
              void loadWorldByName(e.target.value, customWorlds);
            }}
          >
            <optgroup label="Built-in worlds">
              {BUILTIN_WORLDS.map((w) => (
                <option key={w} value={w}>{prettyWorldName(w)}</option>
              ))}
            </optgroup>
            {folderWorlds.filter((n) => !BUILTIN_WORLDS.includes(`${n}.txt`)).length > 0 && (
              <optgroup label="Worlds folder">
                {folderWorlds
                  .filter((n) => !BUILTIN_WORLDS.includes(`${n}.txt`))
                  .map((n) => (
                    <option key={n} value={`${n}.txt`}>📁 {prettyWorldName(n)}</option>
                  ))}
              </optgroup>
            )}
            {customWorlds.length > 0 && (
              <optgroup label="My worlds">
                {customWorlds.map((w) => (
                  <option key={w.name} value={w.name}>✏️ {w.name}</option>
                ))}
              </optgroup>
            )}
          </select>
        </label>
        <button className="btn ghost" onClick={() => setEditorOpen(true)} title="Create your own world">🗺️ World Editor</button>
        <button className="btn ghost" onClick={handleResetMission} title="Restore this mission's starting code and world">↺ Reset Mission</button>
        <button className="btn ghost" onClick={() => setHelpOpen(true)} title="See all of Pedro's commands">❓ Commands</button>
        <span className="spacer" />
        <span className={`engine-pill ${engineReady ? 'ready' : 'booting'}`} title="Python runs locally in your browser (Pyodide/WebAssembly)">
          {engineReady ? '● Python ready' : '◌ Python starting…'}
        </span>
      </header>

      <main className="app-main" ref={splitRef}>
        <section
          className={`pane editor-pane ${dragOver ? 'drag-over' : ''}`}
          style={{ width: `${splitPct}%` }}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
        >
          <div className="pane-title">
            <span>📝 Code</span>
            <span className="pane-actions">
              <button className="mini-btn" onClick={handleImportCode} title="Open a .py file (or drag one in)">📂 Open</button>
              <button className="mini-btn" onClick={handleExportCode} title="Download your code as a .py file">💾 Export</button>
              <span className="pane-hint">F5 / Ctrl+Enter to run</span>
            </span>
          </div>
          <EditorPane
            ref={editorRef}
            initialValue={codeRef.current}
            onChange={handleCodeChange}
            onRun={() => void handleRun()}
            onSave={() => {
              saveCode(mission.id, codeRef.current);
              setStatus({ text: 'Saved! 💾', tone: 'ok' });
            }}
          />
          {dragOver && <div className="drop-overlay">📥 Drop your .py file here!</div>}
          <div className="console">
            {stdout.length === 0
              ? <span className="console-empty">print() output shows up here…</span>
              : stdout.map((line, i) => <div key={i} className="console-line">{line}</div>)}
          </div>
        </section>

        <div className="splitter" onPointerDown={onSplitterDown} />

        <section className="pane stage-pane">
          <div className="transport">
            <button
              className={`btn run-btn ${running ? 'stopping' : 'primary'}`}
              onClick={() => void handleRun()}
              disabled={!worldData}
              title="Run (F5)"
            >
              {runLabel}
            </button>
            <div className="transport-group">
              <button className="icon-btn" onClick={handleReset} disabled={replayLen === 0} title="Back to start">⏮</button>
              <button className="icon-btn" onClick={handleStepBack} disabled={replayLen === 0 || displayStep <= -1} title="Previous step">◀</button>
              <button className="icon-btn play" onClick={handlePlayPause} disabled={replayLen === 0} title={playing ? 'Pause' : 'Play'}>
                {playing ? '⏸' : '▶'}
              </button>
              <button className="icon-btn" onClick={handleStepForward} disabled={replayLen === 0 || displayStep >= replayLen - 1} title="Next step">▶❯</button>
            </div>
            <input
              className="scrub"
              type="range"
              min={-1}
              max={Math.max(0, replayLen - 1)}
              value={Math.min(displayStep, replayLen - 1)}
              onChange={(e) => handleScrub(parseInt(e.target.value))}
              disabled={replayLen === 0}
              title="Scrub the timeline"
            />
            <label className="speed" title="Playback speed">
              🐢
              <input type="range" min={0} max={100} value={speedPct} onChange={(e) => setSpeedPct(parseInt(e.target.value))} />
              🐇
            </label>
            <button
              className={`btn ghost toggle ${animated ? 'on' : ''}`}
              onClick={() => setAnimated((a) => !a)}
              title="Toggle animations"
            >
              {animated ? '✨ Animated' : '⚡ Instant'}
            </button>
          </div>

          <div className="stage">
            <WorldCanvas
              replay={replay}
              targetStep={targetStep}
              playing={playing}
              animated={animated}
              speedMs={speedMs}
              worldVersion={worldVersion}
              seek={seek}
              onStepChange={setDisplayStep}
              onPlayEnd={() => setPlaying(false)}
              onActiveLine={(line) => editorRef.current?.setActiveLine(line)}
              onNextLine={(line) => editorRef.current?.setNextLine(line)}
            />
          </div>

          <footer className={`status-bar tone-${status.tone}`}>
            <span className="status-text">{status.text}</span>
            <span className="status-meta">
              <span className="badge">🚩 {flagsCarried} carried</span>
              <span className="badge">Step {displayStep + 1}/{replayLen}</span>
            </span>
          </footer>
        </section>
      </main>

      <HelpDialog open={helpOpen} onClose={() => setHelpOpen(false)} />

      <WorldEditorDialog
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        onSave={(name, text) => {
          const next = [...customWorlds.filter((w) => w.name !== name), { name, text }];
          setCustomWorlds(next);
          saveCustomWorlds(next);
          setWorldName(name);
          applyWorld(text);
          setStatus({ text: `World "${name}" saved! 🗺️`, tone: 'ok' });
        }}
      />
    </div>
  );
}
