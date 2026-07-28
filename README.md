# 🧑‍🚀 Pedro Playground

A visual Python learning environment for elementary-school students — now a
**fully browser-based app**. Kids write real Python to guide Pedro the
astronaut across the moon: climbing hills, cleaning craters, planting flags
and solving mazes.

Version 2 is a ground-up rewrite of the original Tkinter desktop app
(see [`legacy/`](legacy/)) with a modern web stack, a real IDE, and a
60 fps animated world.

## ✨ Highlights

- **Real Python in the browser** — CPython compiled to WebAssembly
  ([Pyodide](https://pyodide.org)), running in a Web Worker. No server, no
  install, works offline once loaded.
- **A modern mini IDE** (Monaco — the editor that powers VS Code):
  - Python syntax highlighting with a custom space theme
  - Autocompletion, hover docs and signature help for Pedro's commands **and
    the student's own functions/variables** (deduplicated)
  - Live diagnostics: real syntax checking via Pyodide `compile()` plus
    beginner heuristics (missing parentheses, missing colons, `turn_right()`…)
  - **Debugger-style execution highlighting** during replay: a blue ▶ marks
    the current line (persists when paused) and a green ➜ previews the next
    line to run — Python-Tutor style (`sys.settrace`)
  - Sticky scroll, bracket colorization, smooth caret, `F5` / `Ctrl+Enter`
    to run, `Ctrl+S` to save, **export/import `.py` files** (buttons or
    drag-and-drop)
- **Animated world stage** (Canvas 2D):
  - Sprite animation (walk / turn / plant / pick), eased motion, merged
    triple-turns, dust, sparkles and celebration particles
  - Pixel-art tile rendering from the bundled *Blocks 2.0* tileset
    (`public/assets/`, license included): bright moon-brick walls with hidden
    gems over dark brick floors, tileset decorations drifting in the backdrop,
    twinkling stars and nebulas, pulsing base pads
  - Smooth camera: wheel zoom, drag pan, double-click to refit
- **Record → replay architecture**: student code runs once; every action
  streams back as a compact diff snapshot. Step ▶/◀, scrub the timeline,
  play at any speed, or jump around — all free, even after a crash or an
  infinite loop (snapshots stream *before* the timeout hits).
- **Kid-proof stability**:
  - Runaway programs are hard-killed (worker terminate + automatic respawn);
    partial progress is still replayed
  - Step cap with a friendly "infinite loop?" message
  - Errors translated into encouraging, actionable messages with line numbers
    (`Line 4: Pedro walked into a wall! Use front_is_clear()…`)
  - Code autosaves per mission to localStorage
- **Teaching content preserved**: 7 missions, 21 worlds, starter scaffolds
  and reference solutions from the original app, plus:
  - a built-in world editor (paint with the same tileset, generate mazes,
    **export/import worlds as files**, save custom worlds)
  - one-click **mission reset** back to the starting scaffold
  - a **Commands cheatsheet** (the legacy Help menu) always one click away

## 🚀 Quick start

```bash
npm install
npm run dev        # develop at http://localhost:5173
```

### Run the production build (opens your system browser)

```bash
npm run build
python3 launch.py          # serves dist/ and opens http://127.0.0.1:8471
# or: npm start
```

## 🧪 Tests

```bash
npm test
```

- **Engine unit tests** — world parser/serializer, maze generator, replay model
- **Runtime integration tests** — the actual Pyodide interpreter executing
  student code in Node: snapshots, line tracing, error kinds, step cap
- **Solution regression tests** — all 7 shipped reference solutions must
  complete on their mission worlds

Browser end-to-end tests (Playwright + system Chrome, app must be served):

```bash
npm run preview -- --port 8471 &   # serve the production build
npm run test:e2e                   # smoke + stability suites, screenshots in e2e/shots/
```

## 🧱 Architecture

```
┌─────────────────────────── Browser tab ───────────────────────────┐
│  React + TypeScript (Vite)                                        │
│                                                                   │
│  ┌───────────────┐   postMessage   ┌───────────────────────────┐  │
│  │  Monaco IDE   │ ◄─────────────► │  Web Worker: Pyodide      │  │
│  │  (left pane)  │  code / lints   │  (CPython / WebAssembly)  │  │
│  └───────────────┘                 │  + pedro module injected  │  │
│  ┌───────────────┐  snapshots      │  + sys.settrace line tags │  │
│  │ Canvas stage  │ ◄────────────── │  + diff snapshot stream   │  │
│  │ (right pane)  │                 └───────────────────────────┘  │
│  └───────────────┘                                                │
│   replay = initial world + diff snapshots                         │
└───────────────────────────────────────────────────────────────────┘
```

| Path | What lives there |
| --- | --- |
| `src/engine/` | World model, parser, maze generator, replay (pure TS, tested) |
| `src/runtime/` | Pyodide worker, run client (timeouts/respawn), friendly errors |
| `src/editor/`  | Monaco setup, Pedro completions/hover/signature, heuristics |
| `src/renderer/`| Canvas stage: animator, camera, particles, sprites |
| `src/ui/`      | Missions, persistence, world editor dialog |
| `public/worlds/` `public/scaffolds/` | Teaching content (legacy format) |
| `solutions/`   | Reference solutions (used by regression tests) |
| `legacy/`      | The original Tkinter app, kept for reference |

## 🎓 Pedro's commands

```python
from pedro import *

move()            # one step forward (crashes into walls!)
turn_left()       # 90° left — three of these make a right turn
plant_flag()      # plant a flag here
pick_flag()       # pick up a flag here
front_is_clear()  # True if no wall ahead
flag_present()    # True if a flag is on this square
facing_north()    # True if facing up
facing_east()     # True if facing right
```
