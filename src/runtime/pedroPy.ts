/**
 * Python source injected into Pyodide. It implements the Pedro world runtime
 * (a port of the legacy engine/pedro_state.py) and streams one JSON snapshot
 * per student action back to JS, tagged with the source line that caused it
 * (via sys.settrace), enabling debugger-style current-line highlighting.
 */
export const PEDRO_PY = String.raw`
import sys, json, traceback

class PedroError(Exception):
    pass

_DELTAS = {0: (-1, 0), 1: (0, 1), 2: (1, 0), 3: (0, -1)}
_EMPTY, _WALL, _BASE = 0, 1, -1
_CELL_SYMBOLS = {'.': 0, '#': 1, 'F': 2, 'B': -1,
                 '2': 3, '3': 4, '4': 5, '5': 6, '6': 7, '7': 8, '8': 9, '9': 10}
_DIR_SYMBOLS = {'^': 0, '>': 1, 'v': 2, '<': 3}

# Debug recorder: when enabled, every executed student line is captured as
# {'line': n, 'locals': {...}} so the UI can offer step-by-step debugging.
_DEBUG = None
_DEBUG_EVENT_CAP = 5000


def _safe_locals(frame):
    """Small, printable snapshot of a frame's data variables."""
    out = {}
    try:
        items = list(frame.f_locals.items())
    except Exception:
        return out
    for k, v in items:
        if k.startswith('_') or callable(v):
            continue
        try:
            r = repr(v)
        except Exception:
            r = '?'
        out[k] = r[:40]
        if len(out) >= 20:
            break
    return out


class _World:
    def __init__(self, text):
        lines = [l.rstrip('\r') for l in text.split('\n') if l.strip()]
        if not lines:
            raise PedroError('World file is empty')
        max_cols = max(len(l) for l in lines)
        self.grid = []
        self.start = None
        for r, line in enumerate(lines):
            row = []
            c = 0
            while c < max_cols:
                ch = line[c] if c < len(line) else '#'
                if ch in _DIR_SYMBOLS:
                    if self.start is not None:
                        raise PedroError('Multiple Pedro start positions found in world')
                    self.start = (r, c, _DIR_SYMBOLS[ch])
                    digits = ''
                    cc = c + 1
                    while cc < len(line) and line[cc].isdigit():
                        digits += line[cc]
                        cc += 1
                    if digits:
                        count = int(digits)
                        row.append(count + 1 if count >= 1 else _EMPTY)
                        c = cc - 1
                    else:
                        row.append(_EMPTY)
                else:
                    row.append(_CELL_SYMBOLS.get(ch, _WALL))
                c += 1
            while len(row) < max_cols:
                row.append(_WALL)
            self.grid.append(row)
        if self.start is None:
            raise PedroError('No Pedro start position found in world')
        self.rows = len(self.grid)
        self.cols = len(self.grid[0])

    def get(self, r, c):
        if 0 <= r < self.rows and 0 <= c < self.cols:
            return self.grid[r][c]
        return _WALL

    def is_wall(self, r, c):
        return self.get(r, c) == _WALL

    def is_flag(self, r, c):
        return self.get(r, c) >= 2

    def place_flag(self, r, c):
        v = self.get(r, c)
        if v == _EMPTY:
            self.grid[r][c] = 2
        elif v >= 2:
            self.grid[r][c] = v + 1
        else:
            return None
        return (r, c, self.grid[r][c])

    def remove_flag(self, r, c):
        v = self.get(r, c)
        if v >= 2:
            self.grid[r][c] = _EMPTY if v == 2 else v - 1
            return (r, c, self.grid[r][c])
        return None


class _Pedro:
    def __init__(self, world, step_cap):
        self.world = world
        self.row, self.col, self.dir = world.start
        self.flags = 0
        self.total_picked_up = 0
        self.planted_at_base = 0
        self.steps = 0
        self.step_cap = step_cap
        self.current_line = None

    def _record(self, action, changes):
        self.steps += 1
        if self.steps > self.step_cap:
            raise PedroError(
                'Pedro took too many steps (limit %d). Is there an infinite loop?' % self.step_cap)
        __post_snapshot__(json.dumps({
            'action': action,
            'row': self.row,
            'col': self.col,
            'direction': self.dir,
            'flagsCarried': self.flags,
            'changes': changes,
            'line': self.current_line,
            # Index of the debug line-event during which this action happened
            # (-1 when not debugging) — lets the debugger map world states to
            # source lines.
            'event': len(_DEBUG['events']) - 1 if _DEBUG is not None else -1,
        }))

    def move(self):
        dr, dc = _DELTAS[self.dir]
        nr, nc = self.row + dr, self.col + dc
        if self.world.is_wall(nr, nc):
            raise PedroError('Pedro cannot move: wall at (%d, %d)' % (nr, nc))
        self.row, self.col = nr, nc
        self._record('move', [])

    def turn_left(self):
        self.dir = (self.dir - 1) % 4
        self._record('turn_left', [])

    def plant_flag(self):
        if self.world.get(self.row, self.col) == _BASE:
            self.planted_at_base += 1
        change = self.world.place_flag(self.row, self.col)
        self._record('plant_flag', [list(change)] if change else [])

    def pick_flag(self):
        if not self.world.is_flag(self.row, self.col):
            raise PedroError('Pedro cannot pick flag: no flag at (%d, %d)' % (self.row, self.col))
        change = self.world.remove_flag(self.row, self.col)
        self.flags += 1
        self.total_picked_up += 1
        self._record('pick_flag', [list(change)] if change else [])

    def front_is_clear(self):
        dr, dc = _DELTAS[self.dir]
        return not self.world.is_wall(self.row + dr, self.col + dc)

    def flag_present(self):
        return self.world.is_flag(self.row, self.col)

    def facing_north(self):
        return self.dir == 0

    def facing_east(self):
        return self.dir == 1

    def stats(self):
        return {
            'totalPickedUp': self.total_picked_up,
            'plantedAtBase': self.planted_at_base,
            'baseError': self.planted_at_base != self.total_picked_up and self.planted_at_base > 0,
            'expectedFlags': self.total_picked_up,
        }


_API_NAMES = ('move', 'turn_left', 'plant_flag', 'pick_flag',
              'front_is_clear', 'flag_present', 'facing_north', 'facing_east')


def _with_events(payload):
    if _DEBUG is not None:
        payload['lineEvents'] = _DEBUG['events']
    return json.dumps(payload)


def __run_student__(code, world_text, step_cap, debug=False):
    global _DEBUG
    _DEBUG = {'events': []} if debug else None
    try:
        return _run_student_impl(code, world_text, step_cap)
    finally:
        _DEBUG = None


def _run_student_impl(code, world_text, step_cap):
    import types
    world = _World(world_text)
    pedro = _Pedro(world, step_cap)

    # Provide a real 'pedro' module so 'from pedro import *' works exactly
    # like in the legacy desktop app.
    pedro_mod = types.ModuleType('pedro')
    pedro_mod.__all__ = list(_API_NAMES)
    pedro_mod.__doc__ = "Pedro's commands for exploring the moon."
    for _name in _API_NAMES:
        setattr(pedro_mod, _name, getattr(pedro, _name))
    pedro_mod.PedroError = PedroError
    sys.modules['pedro'] = pedro_mod

    # Also inject the commands directly, so bare move() works even if the
    # student forgot the import line (the legacy app allowed this too).
    student_globals = {
        '__name__': '__main__',
        'PedroError': PedroError,
    }
    for _name in _API_NAMES:
        student_globals[_name] = getattr(pedro, _name)

    def tracer(frame, event, arg):
        if frame.f_code.co_filename == '<student>':
            if event == 'call' and frame.f_code.co_name != '<module>':
                # Entering a student function: highlight from the def header
                # (f_lineno is the def line here, f_locals holds the bound
                # arguments — nice for the variables panel).
                pedro.current_line = frame.f_lineno
                if _DEBUG is not None and len(_DEBUG['events']) < _DEBUG_EVENT_CAP:
                    _DEBUG['events'].append({'line': frame.f_lineno, 'locals': _safe_locals(frame)})
            elif event == 'line':
                pedro.current_line = frame.f_lineno
                if _DEBUG is not None and len(_DEBUG['events']) < _DEBUG_EVENT_CAP:
                    _DEBUG['events'].append({'line': frame.f_lineno, 'locals': _safe_locals(frame)})
            return tracer
        return None

    try:
        compiled = compile(code, '<student>', 'exec')
        sys.settrace(tracer)
        try:
            exec(compiled, student_globals)
        finally:
            sys.settrace(None)
            sys.modules.pop('pedro', None)
        return _with_events({'status': 'ok', 'stats': pedro.stats()})
    except PedroError as e:
        line = None
        tb = traceback.extract_tb(sys.exc_info()[2])
        for f in reversed(tb):
            if f.filename == '<student>':
                line = f.lineno
                break
        return _with_events({'status': 'error', 'stats': pedro.stats(), 'error': {
            'kind': 'PedroError', 'message': str(e), 'line': line}})
    except SyntaxError as e:
        return _with_events({'status': 'error', 'stats': pedro.stats(), 'error': {
            'kind': 'SyntaxError', 'message': e.msg or 'invalid syntax',
            'line': e.lineno, 'offset': e.offset}})
    except Exception as e:
        line = None
        tb = traceback.extract_tb(sys.exc_info()[2])
        for f in reversed(tb):
            if f.filename == '<student>':
                line = f.lineno
                break
        return _with_events({'status': 'error', 'stats': pedro.stats(), 'error': {
            'kind': type(e).__name__, 'message': str(e), 'line': line}})


def __lint_student__(code):
    """Syntax-check only (used for live editor diagnostics)."""
    try:
        compile(code, '<student>', 'exec')
        return json.dumps({'errors': []})
    except SyntaxError as e:
        return json.dumps({'errors': [{
            'kind': type(e).__name__,
            'message': e.msg or 'invalid syntax',
            'line': e.lineno or 1,
            'offset': e.offset or 1,
            'end_offset': (e.end_offset or (e.offset or 1) + 1),
        }]})
`;
