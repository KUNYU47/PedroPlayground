/**
 * Kid-friendly world editor: paint walls, floors, flags, bases and Pedro's
 * start on a grid; generate mazes; save custom worlds to localStorage.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { parseWorldText, generateMaze } from '../engine/world';
import { Tileset, tileDataUrl } from '../renderer/tileset';

type Tool = 'wall' | 'floor' | 'flag' | 'base' | 'pedro';

const TOOLS: Array<{ id: Tool; label: string; hint: string }> = [
  { id: 'wall', label: '🧱 Wall', hint: 'Blocks Pedro' },
  { id: 'floor', label: '⬜ Floor', hint: 'Open ground' },
  { id: 'flag', label: '🚩 Flag', hint: 'Click again for a bigger pile' },
  { id: 'base', label: '🛰️ Base', hint: 'Landing pad' },
  { id: 'pedro', label: '🧑‍🚀 Pedro', hint: 'Click Pedro to rotate him' },
];

interface Props {
  open: boolean;
  onClose: () => void;
  onSave: (name: string, text: string) => void;
}

const DIR_CHARS = ['^', '>', 'v', '<'];
const MIN_ROWS = 3;
const MAX_ROWS = 25;
const MIN_COLS = 3;
const MAX_COLS = 30;
const clampRows = (n: number) => Math.max(MIN_ROWS, Math.min(MAX_ROWS, n));
const clampCols = (n: number) => Math.max(MIN_COLS, Math.min(MAX_COLS, n));

function emptyGrid(rows: number, cols: number): string[][] {
  const g = Array.from({ length: rows }, () => Array(cols).fill('.'));
  for (let r = 0; r < rows; r++) {
    g[r][0] = '#';
    g[r][cols - 1] = '#';
  }
  for (let c = 0; c < cols; c++) {
    g[0][c] = '#';
    g[rows - 1][c] = '#';
  }
  g[1][1] = '>';
  return g;
}

export function WorldEditorDialog({ open, onClose, onSave }: Props) {
  const [rows, setRows] = useState(9);
  const [cols, setCols] = useState(11);
  // Raw text of the size inputs — committed (parsed + clamped) on blur/Enter
  // so multi-digit numbers can actually be typed.
  const [rowsInput, setRowsInput] = useState('9');
  const [colsInput, setColsInput] = useState('11');
  const [grid, setGrid] = useState<string[][]>(() => emptyGrid(9, 11));
  const [tool, setTool] = useState<Tool>('wall');
  const [name, setName] = useState('my_world');
  const [error, setError] = useState<string | null>(null);
  const [tiles, setTiles] = useState<{ wall: string; floor: string } | null>(null);
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  const paintingRef = useRef(false);
  const dialogRef = useRef<HTMLDivElement>(null);

  // Load the Blocks tileset so the editor shows the same art as the stage.
  useEffect(() => {
    let cancelled = false;
    Tileset.load(`${import.meta.env.BASE_URL}assets/Blocks.png`)
      .then((ts) => {
        if (!cancelled) {
          setTiles({ wall: tileDataUrl(ts, 'wall', 1), floor: tileDataUrl(ts, 'floor', 0) });
        }
      })
      .catch(() => { /* keep CSS color fallbacks */ });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const up = () => { paintingRef.current = false; };
    window.addEventListener('pointerup', up);
    return () => window.removeEventListener('pointerup', up);
  }, []);

  /** Drag the bottom-right handle to resize the dialog (clamped to viewport). */
  const onResizeHandleDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const el = dialogRef.current;
    if (!el) return;
    const startX = e.clientX;
    const startY = e.clientY;
    const rect = el.getBoundingClientRect();
    const startW = rect.width;
    const startH = rect.height;
    const onMove = (ev: PointerEvent) => {
      setSize({
        width: Math.round(Math.max(520, Math.min(window.innerWidth * 0.95, startW + ev.clientX - startX))),
        height: Math.round(Math.max(420, Math.min(window.innerHeight * 0.9, startH + ev.clientY - startY))),
      });
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  };

  const resize = (nr: number, nc: number) => {
    nr = clampRows(nr);
    nc = clampCols(nc);
    setRows(nr);
    setCols(nc);
    setRowsInput(String(nr));
    setColsInput(String(nc));
    setGrid((old) => {
      const g = Array.from({ length: nr }, (_, r) =>
        Array.from({ length: nc }, (_, c) => old[r]?.[c] ?? '.'),
      );
      return g;
    });
  };

  const commitRows = () => {
    const n = clampRows(parseInt(rowsInput, 10) || MIN_ROWS);
    if (n !== rows) resize(n, cols);
    else setRowsInput(String(n));
  };

  const commitCols = () => {
    const n = clampCols(parseInt(colsInput, 10) || MIN_COLS);
    if (n !== cols) resize(rows, n);
    else setColsInput(String(n));
  };

  const paint = useCallback((r: number, c: number) => {
    setGrid((old) => {
      const g = old.map((row) => row.slice());
      const cur = g[r][c];
      switch (tool) {
        case 'wall': g[r][c] = '#'; break;
        case 'floor': g[r][c] = '.'; break;
        case 'base': g[r][c] = 'B'; break;
        case 'flag': {
          if (/^[F2-9]$/.test(cur)) {
            const n = cur === 'F' ? 2 : parseInt(cur, 10) + 1;
            g[r][c] = n > 9 ? '.' : String(n);
          } else {
            g[r][c] = 'F';
          }
          break;
        }
        case 'pedro': {
          if (DIR_CHARS.includes(cur)) {
            g[r][c] = DIR_CHARS[(DIR_CHARS.indexOf(cur) + 1) % 4];
          } else {
            // remove old start, place new
            for (let rr = 0; rr < g.length; rr++) {
              for (let cc = 0; cc < g[rr].length; cc++) {
                if (DIR_CHARS.includes(g[rr][cc])) g[rr][cc] = '.';
              }
            }
            g[r][c] = '>';
          }
          break;
        }
      }
      return g;
    });
  }, [tool]);

  const toText = (): string => grid.map((row) => row.join('')).join('\n');

  /** Reset: every cell becomes floor, edges become walls, Pedro back to (1,1). */
  const handleReset = () => {
    setGrid(emptyGrid(rows, cols));
    setError(null);
  };

  const handleMaze = () => {
    const maze = generateMaze(rows, cols);
    const text = maze.grid.map((row, r) =>
      row.map((v, c) => {
        if (r === maze.startRow && c === maze.startCol) return '>';
        if (v === 1) return '#';
        if (v === 2) return 'F';
        return '.';
      }).join(''),
    ).join('\n');
    setGrid(text.split('\n').map((l) => l.split('')));
  };

  const validate = (): string | null => {
    const text = toText();
    try {
      parseWorldText(text);
      return text;
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      return null;
    }
  };

  const handleSave = () => {
    const text = validate();
    if (!text) return;
    if (!/^[A-Za-z0-9_-]+$/.test(name)) {
      setError('Name can only contain letters, numbers, - and _');
      return;
    }
    onSave(name, text);
    setError(null);
    onClose();
  };

  /** Download the world as a .txt file. */
  const handleExport = () => {
    const text = validate();
    if (!text) return;
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${name || 'my_world'}.txt`;
    a.click();
    // Async revoke: Firefox can cancel the download if revoked synchronously.
    setTimeout(() => URL.revokeObjectURL(url), 0);
    setError(null);
  };

  /** Load a world from a .txt file into the editor. */
  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.txt';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      const text = await file.text();
      try {
        parseWorldText(text); // validate first
      } catch (e) {
        setError(`Not a valid world file: ${e instanceof Error ? e.message : e}`);
        return;
      }
      const lines = text.split('\n').map((l) => l.replace(/\r$/, '')).filter((l) => l.trim().length > 0);
      const width = Math.max(...lines.map((l) => l.length));
      const nr = clampRows(lines.length);
      const nc = clampCols(width);
      if (nr !== lines.length || nc !== width) {
        setError(`World is ${width}×${lines.length} — too big for the editor, cropped to ${nc}×${nr}.`);
      } else {
        setError(null);
      }
      setRows(nr);
      setCols(nc);
      setRowsInput(String(nr));
      setColsInput(String(nc));
      setGrid(lines.slice(0, nr).map((l) => l.padEnd(width, '#').slice(0, nc).split('')));
      setName(file.name.replace(/\.txt$/i, '').replace(/[^A-Za-z0-9_-]/g, '_') || 'my_world');
    };
    input.click();
  };

  if (!open) return null;

  return (
    <div className="dialog-backdrop" onClick={onClose}>
      <div
        ref={dialogRef}
        className="dialog world-editor"
        style={size ? { width: size.width, height: size.height } : undefined}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="dialog-title">
          <span>🗺️ World Editor</span>
          <button className="icon-btn" onClick={onClose} title="Close">✕</button>
        </div>

        <div className="world-editor-toolbar">
          {TOOLS.map((t) => (
            <button
              key={t.id}
              className={`tool-btn ${tool === t.id ? 'active' : ''}`}
              title={t.hint}
              onClick={() => setTool(t.id)}
            >
              {t.label}
            </button>
          ))}
          <span className="spacer" />
          <label>Rows <input type="number" value={rowsInput} min={MIN_ROWS} max={MAX_ROWS} onChange={(e) => setRowsInput(e.target.value)} onBlur={commitRows} onKeyDown={(e) => e.key === 'Enter' && commitRows()} /></label>
          <label>Cols <input type="number" value={colsInput} min={MIN_COLS} max={MAX_COLS} onChange={(e) => setColsInput(e.target.value)} onBlur={commitCols} onKeyDown={(e) => e.key === 'Enter' && commitCols()} /></label>
          <button className="tool-btn" onClick={handleMaze}>🌀 Maze</button>
          <button className="tool-btn" onClick={handleReset} title="Clear the grid: all floor, wall edges, Pedro back to the top-left">🧹 Reset</button>
        </div>

        <div
          className="world-editor-grid"
          style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}
          onPointerLeave={() => { paintingRef.current = false; }}
        >
          {grid.map((row, r) =>
            row.map((cell, c) => {
              const cls = cellClass(cell);
              const tileBg =
                tiles && cls === 'wall' ? `url(${tiles.wall})`
                : tiles && cls === 'floor' ? `url(${tiles.floor})`
                : undefined;
              return (
                <button
                  key={`${r}-${c}`}
                  className={`we-cell we-${cls}`}
                  style={tileBg ? { backgroundImage: tileBg, backgroundSize: 'cover', backgroundColor: 'transparent' } : undefined}
                  onPointerDown={(e) => {
                    e.preventDefault();
                    paintingRef.current = true;
                    paint(r, c);
                  }}
                  onPointerEnter={() => {
                    if (paintingRef.current && tool !== 'pedro' && tool !== 'flag') paint(r, c);
                  }}
                >
                  {cellLabel(cell)}
                </button>
              );
            }),
          )}
        </div>

        <div className="world-editor-footer">
          <input
            className="text-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="world_name"
          />
          <button className="btn primary" onClick={handleSave}>💾 Save World</button>
          <button className="btn ghost" onClick={handleExport} title="Download this world as a file">📤 Export</button>
          <button className="btn ghost" onClick={handleImport} title="Load a world from a file">📥 Import</button>
          {error && <span className="dialog-error">{error}</span>}
        </div>
        <div
          className="we-resize-handle"
          title="Drag to resize"
          onPointerDown={onResizeHandleDown}
        />
      </div>
    </div>
  );
}

function cellClass(ch: string): string {
  if (ch === '#') return 'wall';
  if (ch === 'B') return 'base';
  if (ch === '.' || ch === '') return 'floor';
  if (DIR_CHARS.includes(ch)) return 'pedro';
  return 'flag';
}

function cellLabel(ch: string): string {
  if (ch === 'B') return '🛰️';
  if (ch === 'F') return '🚩';
  if (/^[2-9]$/.test(ch)) return ch;
  if (ch === '^') return '⬆️';
  if (ch === '>') return '➡️';
  if (ch === 'v') return '⬇️';
  if (ch === '<') return '⬅️';
  return '';
}
