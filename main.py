import os
import sys

if len(sys.argv) >= 3 and sys.argv[1] == '--exec':
    if getattr(sys, 'frozen', False):
        sys.path.insert(0, sys._MEIPASS)
    else:
        sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    import atexit
    import json as _json
    _output_path = os.environ.get('PEDRO_OUTPUT', '')
    _world_path = os.environ.get('PEDRO_WORLD', '')
    if not _world_path:
        sys.stderr.write('Error: PEDRO_WORLD not set.\n')
        sys.exit(1)
    from engine.world import parse_world
    from engine.pedro_state import PedroState
    _world, _sr, _sc, _sd = parse_world(_world_path)
    _pedro = PedroState(_world, _sr, _sc, _sd)
    def move(): _pedro.move()
    def turn_left(): _pedro.turn_left()
    def plant_flag(): _pedro.plant_flag()
    def pick_flag(): _pedro.pick_flag()
    def front_is_clear(): return _pedro.front_is_clear()
    def flag_present(): return _pedro.flag_present()
    def facing_north(): return _pedro.facing_north()
    def facing_east(): return _pedro.facing_east()
    def _save():
        if _output_path:
            try:
                with open(_output_path, 'w') as f:
                    _json.dump(_pedro.get_snapshots(), f)
            except Exception:
                pass
    atexit.register(_save)
    script_path = sys.argv[2]
    import types
    _pm = types.ModuleType('pedro')
    _pm.move = move; _pm.turn_left = turn_left
    _pm.plant_flag = plant_flag; _pm.pick_flag = pick_flag
    _pm.front_is_clear = front_is_clear; _pm.flag_present = flag_present
    _pm.facing_north = facing_north; _pm.facing_east = facing_east
    sys.modules['pedro'] = _pm
    exit_code = 0
    try:
        with open(script_path, 'r', encoding='utf-8') as f:
            code = f.read()
        exec(compile(code, script_path, 'exec'), {
            '__name__': '__main__',
            'move': move, 'turn_left': turn_left,
            'plant_flag': plant_flag, 'pick_flag': pick_flag,
            'front_is_clear': front_is_clear, 'flag_present': flag_present,
            'facing_north': facing_north, 'facing_east': facing_east,
        })
    except SystemExit as e:
        exit_code = e.code if isinstance(e.code, int) else 0
    except Exception:
        import traceback
        traceback.print_exc()
        exit_code = 1
    sys.exit(exit_code)

import json
import re
import subprocess
import tempfile
from pathlib import Path

import customtkinter as ctk
from tkinter import Canvas, Menu, Text, font as tkfont, PanedWindow as TkPanedWindow, HORIZONTAL, filedialog

from engine.renderer import GridRenderer
from engine.sprites import SpriteManager


def _resolve_paths():
    if getattr(sys, 'frozen', False):
        base = Path(sys._MEIPASS)
        exe_dir = Path(sys.executable).parent
        worlds_dir = exe_dir / "worlds"
        if not worlds_dir.is_dir():
            _copy_bundled_dir(base / "worlds", worlds_dir)
        scaffolds_dir = exe_dir / "scaffolds"
        if not scaffolds_dir.is_dir():
            _copy_bundled_dir(base / "scaffolds", scaffolds_dir)
        return base, base / "assets", worlds_dir, scaffolds_dir, base / "scaffolds"
    else:
        base = Path(__file__).parent.absolute()
        return base, base / "assets", base / "worlds", base / "scaffolds", base / "scaffolds"


def _copy_bundled_dir(src, dst):
    try:
        import shutil
        dst.mkdir(parents=True, exist_ok=True)
        for f in src.iterdir():
            if f.is_file():
                shutil.copy2(f, dst / f.name)
    except Exception:
        pass


PROJECT_DIR, ASSETS_DIR, WORLDS_DIR, SCAFFOLDS_DIR, ORIGINAL_SCAFFOLDS_DIR = _resolve_paths()
del PROJECT_DIR

ctk.set_appearance_mode("system")
ctk.set_default_color_theme("blue")

def _detect_monospace_font():
    import tkinter as _tk
    root = _tk.Tk()
    root.withdraw()
    available = set(tkfont.families(root=root))
    root.destroy()
    for candidate in ["Consolas", "Menlo", "Liberation Mono",
                       "DejaVu Sans Mono", "Courier New", "Courier",
                       "monospace", "Monaco", "Source Code Pro"]:
        if candidate in available:
            return candidate
    return "Courier"


EDITOR_FONT_FAMILY = _detect_monospace_font()
DEFAULT_FONT_SIZE = 20
EDITOR_BG = "#1E1E1E"
EDITOR_FG = "#D4D4D4"
LINE_NUM_BG = "#1E1E1E"
LINE_NUM_FG = "#858585"

KEYWORD_COLOR = "#569CD6"
BUILTIN_COLOR = "#DCDCAA"
PEDRO_COLOR = "#4EC9B0"
STRING_COLOR = "#CE9178"
COMMENT_COLOR = "#6A9955"
NUMBER_COLOR = "#B5CEA8"
DECORATOR_COLOR = "#C586C0"

PYTHON_KEYWORDS = {
    'def', 'class', 'if', 'elif', 'else', 'for', 'while', 'return',
    'import', 'from', 'as', 'True', 'False', 'None', 'and', 'or', 'not',
    'in', 'is', 'break', 'continue', 'pass', 'try', 'except', 'finally',
    'raise', 'with', 'yield', 'lambda', 'global', 'nonlocal', 'assert', 'del',
}
PYTHON_BUILTINS = {
    'print', 'range', 'len', 'int', 'str', 'float', 'bool', 'list', 'dict',
    'set', 'tuple', 'type', 'input', 'open', 'enumerate', 'zip', 'map',
    'filter', 'sorted', 'reversed', 'min', 'max', 'sum', 'abs', 'round',
    'super', 'isinstance', 'issubclass', 'hasattr', 'getattr', 'setattr',
}
PEDRO_FUNCTIONS = {
    'move', 'turn_left', 'plant_flag', 'pick_flag',
    'front_is_clear', 'flag_present',
    'facing_north', 'facing_east',
}


class SyntaxHighlighter:
    def __init__(self, text_widget):
        self._widget = text_widget
        self._setup_tags()

    def _setup_tags(self):
        w = self._widget
        w.tag_configure('keyword', foreground=KEYWORD_COLOR)
        w.tag_configure('builtin', foreground=BUILTIN_COLOR)
        w.tag_configure('pedro', foreground=PEDRO_COLOR)
        w.tag_configure('string', foreground=STRING_COLOR)
        w.tag_configure('comment', foreground=COMMENT_COLOR)
        w.tag_configure('number', foreground=NUMBER_COLOR)
        w.tag_configure('decorator', foreground=DECORATOR_COLOR)

    def highlight_all(self):
        w = self._widget
        text = w.get("1.0", "end-1c")
        for tag in ('keyword', 'builtin', 'pedro', 'string', 'comment', 'number', 'decorator'):
            w.tag_remove(tag, "1.0", "end")

        skip_at = set()
        for match in re.finditer(r'#[^\n]*', text):
            s, e = match.start(), match.end()
            self._apply('comment', s, e, text)
            skip_at.update(range(s, e))
        for match in re.finditer(r'(@\w+)', text):
            s, e = match.start(), match.end()
            if not any(x in skip_at for x in range(s, e)):
                self._apply('decorator', s, e, text)
                skip_at.update(range(s, e))
        for match in re.finditer(r'(f?"(?:[^"\\]|\\.)*"|f?\'(?:[^\'\\]|\\.)*\')', text):
            s, e = match.start(), match.end()
            if not any(x in skip_at for x in range(s, e)):
                self._apply('string', s, e, text)
                skip_at.update(range(s, e))
        for match in re.finditer(r'\b(\d+\.?\d*)\b', text):
            s, e = match.start(), match.end()
            if not any(x in skip_at for x in range(s, e)):
                self._apply('number', s, e, text)
                skip_at.update(range(s, e))
        for match in re.finditer(r'\b([a-zA-Z_]\w*)\b', text):
            s, e = match.start(), match.end()
            if any(x in skip_at for x in range(s, e)):
                continue
            word = match.group(1)
            if word in PYTHON_KEYWORDS:
                self._apply('keyword', s, e, text)
            elif word in PEDRO_FUNCTIONS:
                self._apply('pedro', s, e, text)
            elif word in PYTHON_BUILTINS:
                self._apply('builtin', s, e, text)

    def _apply(self, tag, start, end, text):
        lineno = text[:start].count('\n') + 1
        line_start = text.rfind('\n', 0, start) + 1
        col_start = start - line_start
        col_end = end - line_start
        try:
            self._widget.tag_add(tag, f"{lineno}.{col_start}", f"{lineno}.{col_end}")
        except Exception:
            pass


class PedroApp(ctk.CTk):
    def __init__(self):
        super().__init__()
        self.title("Pedro Playground")
        self.geometry("1200x750")
        self.minsize(900, 550)

        self._snapshots = []
        self._current_step = -1
        self._world_file = None
        self._is_animating = False
        self._replay_speed = 400
        self._font_size = DEFAULT_FONT_SIZE
        self._highlight_job = None
        self._lint_job = None
        self._current_file = None
        self._original_code = ""
        self._instant_mode = False

        self._sprite_manager = SpriteManager(str(ASSETS_DIR / "Astronaut-Sheet.png"), scale=3)

        self._build_menu()
        self._build_layout()
        self._apply_initial_sash()
        self.protocol("WM_DELETE_WINDOW", self._on_close)

        self._highlighter = SyntaxHighlighter(self._editor)
        self._highlight_debounce()
        try:
            self._editor.tag_configure('error_bg', background="#5A1D1D")
            self._editor.tag_configure('error_fg', foreground="#FF6B6B")
            self._editor.tag_configure('current_line', background="#4A4A4A")
            self._editor.tag_configure('bracket_match', background="#3A5A3A")
            self._editor.configure(selectbackground="#264F78", selectforeground="#FFFFFF")
            for t in ('keyword', 'builtin', 'pedro', 'string', 'comment', 'number', 'decorator'):
                self._editor.tag_raise(t)
        except Exception:
            pass

    def _build_menu(self):
        menubar = Menu(self)
        menu_font = (EDITOR_FONT_FAMILY, 16)
        self.config(menu=menubar)

        activities_menu = Menu(menubar, tearoff=0, font=menu_font)
        activities_menu.add_command(label="Moon Hill Climb",
                                    command=lambda: self._load_activity("moon_hill"))
        activities_menu.add_command(label="Navigate the Crater",
                                    command=lambda: self._load_activity("crater"))
        activities_menu.add_command(label="Roomba Pedro",
                                    command=lambda: self._load_activity("roomba"))
        activities_menu.add_command(label="Pedro Plants Flags",
                                    command=lambda: self._load_activity("flag_piles"))
        activities_menu.add_command(label="2026 Flags",
                                    command=lambda: self._load_activity("flag_planting"))
        activities_menu.add_command(label="Lunar Core Sample",
                                    command=lambda: self._load_activity("lunar_core"))
        activities_menu.add_command(label="Maze Solver",
                                    command=lambda: self._load_activity("maze"))
        activities_menu.add_separator()
        activities_menu.add_command(label="Save Code (Ctrl+S)", command=self._on_save)
        activities_menu.add_command(label="Save As...", command=self._save_as)
        activities_menu.add_command(label="Restore to Original", command=self._restore_original)
        activities_menu.add_separator()
        activities_menu.add_command(label="Clear Editor", command=self._clear_editor)
        activities_menu.add_command(label="Open File...", command=self._open_file)
        menubar.add_cascade(label="Activities", menu=activities_menu)

        worlds_menu = Menu(menubar, tearoff=0, font=menu_font)
        self._rebuild_worlds_menu(worlds_menu)
        menubar.add_cascade(label="Worlds", menu=worlds_menu)
        self._worlds_menu = worlds_menu

        help_menu = Menu(menubar, tearoff=0, font=menu_font)
        help_menu.add_command(label="Pedro Commands", command=self._show_help)
        menubar.add_cascade(label="Help", menu=help_menu)

    def _rebuild_worlds_menu(self, menu=None):
        if menu is None:
            menu = self._worlds_menu
        menu.delete(0, "end")
        if WORLDS_DIR.exists():
            for f in sorted(WORLDS_DIR.glob("*.txt")):
                menu.add_command(
                    label=f.stem.replace("_", " ").title(),
                    command=lambda p=str(f): self._load_world(p)
                )
        menu.add_separator()
        menu.add_command(label="World Editor...", command=self._open_world_editor)

    def _build_layout(self):
        self.grid_columnconfigure(0, weight=1)
        self.grid_rowconfigure(0, weight=1)
        self.grid_rowconfigure(1, weight=0)
        self.grid_rowconfigure(2, weight=0)

        pane = TkPanedWindow(self, orient=HORIZONTAL, sashrelief="raised",
                              sashwidth=6, sashpad=2, bg="#3B3B3B")
        pane.grid(row=0, column=0, sticky="nsew", padx=10, pady=(10, 5))
        self._pane = pane

        editor_frame = ctk.CTkFrame(pane, corner_radius=6)
        editor_frame.grid_rowconfigure(0, weight=0)
        editor_frame.grid_rowconfigure(1, weight=1)
        editor_frame.grid_columnconfigure(0, weight=1)

        editor_toolbar = ctk.CTkFrame(editor_frame, height=22, fg_color="transparent")
        editor_toolbar.grid(row=0, column=0, sticky="ew", padx=(6, 4), pady=(2, 0))
        ctk.CTkLabel(editor_toolbar, text="Code Editor", font=("", 12, "bold")).pack(side="left", padx=(2, 0))
        self._font_label = ctk.CTkLabel(editor_toolbar, text=str(self._font_size), font=("", 10), width=18)
        self._font_label.pack(side="left", padx=(3, 0))
        ctk.CTkButton(editor_toolbar, text="-", width=22, height=18,
                       command=lambda: self._change_font(-2)).pack(side="right", padx=(0, 1))
        ctk.CTkButton(editor_toolbar, text="+", width=22, height=18,
                       command=lambda: self._change_font(2)).pack(side="right", padx=(0, 0))

        editor_inner = ctk.CTkFrame(editor_frame, fg_color="transparent")
        editor_inner.grid(row=1, column=0, sticky="nsew", padx=2, pady=(0, 2))
        editor_inner.grid_rowconfigure(0, weight=1)
        editor_inner.grid_columnconfigure(0, weight=0)
        editor_inner.grid_columnconfigure(1, weight=0)
        editor_inner.grid_columnconfigure(2, weight=1)

        font_spec = (EDITOR_FONT_FAMILY, self._font_size)

        self._line_numbers = Text(editor_inner, width=4, font=font_spec,
                                   bg=LINE_NUM_BG, fg=LINE_NUM_FG,
                                   relief="flat", borderwidth=0, highlightthickness=0,
                                   state="disabled", padx=6, pady=1,
                                   wrap="none", cursor="arrow")
        self._line_numbers.grid(row=0, column=0, sticky="nsew")

        sep = Canvas(editor_inner, width=1, bg="#333333", highlightthickness=0)
        sep.grid(row=0, column=1, sticky="ns")

        editor_bg = ctk.CTkFrame(editor_inner, fg_color=EDITOR_BG, corner_radius=0)
        editor_bg.grid(row=0, column=2, sticky="nsew")
        editor_bg.grid_rowconfigure(0, weight=1)
        editor_bg.grid_columnconfigure(0, weight=1)

        self._editor = Text(editor_bg, font=font_spec,
                             bg=EDITOR_BG, fg=EDITOR_FG, insertbackground="#FFFFFF",
                             relief="flat", borderwidth=0, highlightthickness=0,
                             padx=6, pady=1, undo=True, wrap="none",
                             tabs=(tkfont.Font(family=EDITOR_FONT_FAMILY, size=self._font_size).measure("    "),))
        self._editor.grid(row=0, column=0, sticky="nsew")

        self._indent_guide = Canvas(editor_bg, bg=EDITOR_BG, highlightthickness=0, bd=0)
        self._indent_guide.place(relwidth=1, relheight=1, x=6, y=0)
        self._editor.lift()

        editor_scroll = ctk.CTkScrollbar(editor_bg, orientation="vertical",
                                          command=self._on_scrollbar)
        editor_scroll.grid(row=0, column=1, sticky="ns")
        self._editor.configure(yscrollcommand=self._on_editor_scroll)
        self._editor_scrollbar = editor_scroll

        self._editor.bind("<KeyRelease>", self._on_editor_change)
        self._editor.bind("<MouseWheel>", lambda e: self._editor.yview_scroll(int(-1 * (e.delta / 120)), "units"))
        self._editor.bind("<Button-4>", lambda e: self._editor.yview_scroll(-1, "units"))
        self._editor.bind("<Button-5>", lambda e: self._editor.yview_scroll(1, "units"))

        self._editor.bind("<Tab>", self._on_editor_tab)
        self._editor.bind("<KeyPress-Return>", self._on_return_press, add="+")
        self._editor.bind("<KeyPress-Up>", lambda e: self._ac_key('up', e))
        self._editor.bind("<KeyPress-Down>", lambda e: self._ac_key('down', e))
        self._editor.bind("<KeyPress-Escape>", lambda e: self._ac_key('escape', e))
        self._editor.bind("<KeyRelease-Return>", self._on_return_release)
        self._editor.bind("<BackSpace>", self._on_editor_backspace)
        self._editor.bind("<Control-bracketleft>", self._on_editor_unindent)
        self._editor.bind("<Control-s>", self._on_save)
        self._editor.bind("<Control-S>", self._on_save)
        self._editor.bind("<Control-z>", lambda e: self._editor.edit_undo())
        self._editor.bind("<Control-Z>", lambda e: self._editor.edit_undo())
        self._editor.bind("<Control-y>", lambda e: self._editor.edit_redo())
        self._editor.bind("<Control-Y>", lambda e: self._editor.edit_redo())
        self._editor.bind("<KeyRelease>", self._on_key_up, add="+")
        self._editor.bind("<Motion>", self._on_mouse_move, add="+")

        self.bind_all("<F5>", lambda e: self._run_code())

        self._tooltip = None
        self._tooltip_job = None
        self._ac_tip = None

        self._line_numbers.bind("<MouseWheel>", lambda e: self._editor.yview_scroll(int(-1 * (e.delta / 120)), "units"))
        self._line_numbers.bind("<Button-4>", lambda e: self._editor.yview_scroll(-1, "units"))
        self._line_numbers.bind("<Button-5>", lambda e: self._editor.yview_scroll(1, "units"))

        self._rebuild_line_numbers()

        editor_required = int(self.winfo_screenwidth() * 0.38)
        pane.add(editor_frame, minsize=320, width=editor_required)

        canvas_frame = ctk.CTkFrame(pane, corner_radius=6)
        canvas_frame.grid_rowconfigure(1, weight=1)
        canvas_frame.grid_columnconfigure(0, weight=1)

        canvas_toolbar = ctk.CTkFrame(canvas_frame, height=28, fg_color="transparent")
        canvas_toolbar.grid(row=0, column=0, sticky="ew", padx=(6, 4), pady=(2, 1))
        ctk.CTkLabel(canvas_toolbar, text="World View", font=("", 13, "bold")).pack(side="left", padx=(2, 0))
        ctk.CTkButton(canvas_toolbar, text="-", width=24, height=20,
                       command=lambda: self._renderer.zoom_out()).pack(side="right", padx=(0, 2))
        ctk.CTkButton(canvas_toolbar, text="+", width=24, height=20,
                       command=lambda: self._renderer.zoom_in()).pack(side="right", padx=(0, 0))

        canvas_inner = ctk.CTkFrame(canvas_frame, fg_color="transparent")
        canvas_inner.grid(row=1, column=0, sticky="nsew", padx=4, pady=(0, 4))
        canvas_inner.grid_rowconfigure(0, weight=1)
        canvas_inner.grid_columnconfigure(0, weight=1)

        self._canvas = Canvas(canvas_inner, bg="#D0C8B8", highlightthickness=0)
        self._canvas.grid(row=0, column=0, sticky="nsew")
        self._renderer = GridRenderer(self._canvas, self._sprite_manager)

        pane.add(canvas_frame, minsize=300)

        status_frame = ctk.CTkFrame(self)
        status_frame.grid(row=1, column=0, sticky="ew", padx=10, pady=(0, 5))
        status_frame.grid_columnconfigure(1, weight=1)

        self._world_label = ctk.CTkLabel(status_frame, text="No world", font=("", 12), anchor="w")
        self._world_label.grid(row=0, column=0, padx=(10, 15), pady=5, sticky="w")

        self._status_label = ctk.CTkLabel(status_frame, text="Ready", font=("", 12), anchor="w")
        self._status_label.grid(row=0, column=1, sticky="w", padx=5, pady=5)

        self._step_label = ctk.CTkLabel(status_frame, text="", font=("", 12))
        self._step_label.grid(row=0, column=2, padx=(5, 10), pady=5)

        ctrl_frame = ctk.CTkFrame(self)
        ctrl_frame.grid(row=2, column=0, sticky="ew", padx=10, pady=(0, 10))

        self._run_btn = ctk.CTkButton(ctrl_frame, text="Run", width=90,
                                       command=self._run_code, fg_color="#2E7D32",
                                       hover_color="#1B5E20")
        self._run_btn.grid(row=0, column=0, padx=(10, 5), pady=8)

        self._step_btn = ctk.CTkButton(ctrl_frame, text="Step", width=65,
                                        command=self._step_forward, state="disabled")
        self._step_btn.grid(row=0, column=1, padx=5, pady=8)

        self._prev_btn = ctk.CTkButton(ctrl_frame, text="Prev", width=55,
                                        command=self._step_back, state="disabled")
        self._prev_btn.grid(row=0, column=2, padx=5, pady=8)

        self._reset_btn = ctk.CTkButton(ctrl_frame, text="Reset", width=65,
                                         command=self._reset, state="disabled")
        self._reset_btn.grid(row=0, column=3, padx=5, pady=8)

        self._auto_btn = ctk.CTkButton(ctrl_frame, text="Play All", width=75,
                                         command=self._play_all, state="disabled")
        self._auto_btn.grid(row=0, column=4, padx=5, pady=8)

        self._instant_btn = ctk.CTkButton(ctrl_frame, text="Animated", width=85,
                                            command=self._toggle_instant,
                                            fg_color="#444444", border_width=1)
        self._instant_btn.grid(row=0, column=5, padx=5, pady=8)

        ctk.CTkLabel(ctrl_frame, text="Slow", font=("", 12)).grid(
            row=0, column=6, padx=(15, 2), pady=8)

        self._speed_slider = ctk.CTkSlider(ctrl_frame, from_=0, to=100,
                                            number_of_steps=20,
                                            command=self._on_speed_change)
        self._speed_slider.set(40)
        self._speed_slider.grid(row=0, column=7, padx=2, pady=8, sticky="ew")
        ctrl_frame.grid_columnconfigure(7, weight=1)

        self._speed_label = ctk.CTkLabel(ctrl_frame, text="Fast", width=40, font=("", 12))
        self._speed_label.grid(row=0, column=8, padx=(2, 10), pady=8)

    def _apply_initial_sash(self):
        self.update_idletasks()
        w = self.winfo_width()
        pos = max(420, int(w * 0.45))
        try:
            self._pane.sash_place(0, pos, 0)
        except Exception:
            pass

    def _on_editor_scroll(self, *args):
        if args and len(args) >= 2:
            try:
                self._line_numbers.yview_moveto(args[0])
                self._editor_scrollbar.set(*args)
            except Exception:
                pass

    def _on_scrollbar(self, *args):
        self._editor.yview(*args)

    def _rebuild_line_numbers(self):
        text = self._editor.get("1.0", "end-1c")
        total = max(text.count("\n") + 1, 1)
        width = max(3, len(str(total)) + 1)
        padded = "\n".join(str(i).rjust(width) for i in range(1, total + 1))
        self._line_numbers.configure(width=max(4, width + 1))
        self._line_numbers.configure(state="normal")
        self._line_numbers.delete("1.0", "end")
        self._line_numbers.insert("1.0", padded)
        self._line_numbers.configure(state="disabled")

    def _highlight_debounce(self):
        if self._highlight_job is not None:
            self.after_cancel(self._highlight_job)
        self._highlight_job = self.after(200, self._do_highlight)

    def _do_highlight(self):
        try:
            self._highlighter.highlight_all()
        except Exception:
            pass
        self._highlight_job = None

    def _lint_debounce(self):
        if self._lint_job is not None:
            self.after_cancel(self._lint_job)
        self._lint_job = self.after(500, self._do_lint)

    def _do_lint(self):
        try:
            self._editor.tag_remove('error_bg', "1.0", "end")
            self._editor.tag_remove('error_fg', "1.0", "end")
        except Exception:
            pass
        code = self._editor.get("1.0", "end-1c")
        if not code.strip():
            self._lint_job = None
            return
        try:
            compile(code, '<editor>', 'exec')
        except SyntaxError as e:
            lineno = e.lineno
            if lineno:
                try:
                    self._editor.tag_add('error_bg', f"{lineno}.0", f"{lineno}.end")
                    self._editor.tag_add('error_fg', f"{lineno}.0", f"{lineno}.end")
                except Exception:
                    pass
        except Exception:
            pass

        string_lines = set()
        in_triple = False
        for i, line in enumerate(code.split('\n'), 1):
            stripped = line.strip()
            if stripped.count('"""') % 2 == 1 or stripped.count("'''") % 2 == 1:
                in_triple = not in_triple
                string_lines.add(i)
                continue
            if in_triple:
                string_lines.add(i)

        pedro_funcs = r'\b(move|turn_left|plant_flag|pick_flag|front_is_clear|flag_present|facing_north|facing_east)\b'
        bad_call = re.compile(pedro_funcs + r'(?!\s*\()')
        lines = code.split('\n')
        for i, line in enumerate(lines, 1):
            if i in string_lines:
                continue
            stripped = line.strip()
            if stripped.startswith('#') or stripped.startswith('def ') or stripped.startswith('from ') or stripped.startswith('import '):
                continue
            if bad_call.search(line):
                try:
                    self._editor.tag_add('error_bg', f"{i}.0", f"{i}.end")
                except Exception:
                    pass

        in_main_block = False
        for i, line in enumerate(lines, 1):
            if i in string_lines:
                continue
            stripped = line.strip()
            if not stripped or stripped.startswith('#'):
                continue
            if stripped.startswith('def ') or stripped.startswith('class ') or stripped.startswith('from ') or stripped.startswith('import '):
                continue
            if stripped == 'if __name__ == \'__main__\':' or stripped == 'if __name__ == "__main__":':
                in_main_block = True
                continue
            indent = len(line) - len(line.lstrip())
            if indent == 0 and not in_main_block and stripped:
                try:
                    self._editor.tag_add('error_bg', f"{i}.0", f"{i}.end")
                except Exception:
                    pass
            if in_main_block and indent == 0 and stripped:
                in_main_block = False
        self._lint_job = None

    def _set_status(self, text, color=None):
        self._status_label.configure(text=text)
        if color:
            self._status_label.configure(text_color=color)
        else:
            self._status_label.configure(text_color=("black", "white"))

    def _update_step_info(self, action_name=None):
        if self._snapshots:
            base = f"Step {self._current_step + 1}/{len(self._snapshots)}"
            if action_name:
                base += f"  —  {action_name}"
            self._step_label.configure(text=base)

    def _on_editor_change(self, event=None):
        self._rebuild_line_numbers()
        self._highlight_debounce()
        self._lint_debounce()
        self._highlight_current_line()
        self._draw_indent_guides()

    def _on_return_release(self, event=None):
        cursor = self._editor.index("insert")
        line_num = int(cursor.split('.')[0])
        if line_num <= 1:
            return
        prev = self._editor.get(f"{line_num - 1}.0", f"{line_num - 1}.end")
        indent = ""
        for ch in prev:
            if ch == ' ':
                indent += ' '
            elif ch == '\t':
                indent += '    '
            else:
                break
        if indent:
            self._editor.insert(cursor, indent)
        self._on_editor_change()

    def _on_return_press(self, event=None):
        if self._ac_tip is not None:
            if self._ac_matches and self._ac_index >= 0 and self._ac_index < len(self._ac_matches):
                self._insert_autocomplete(self._ac_matches[self._ac_index], self._ac_tip)
                return "break"
            self._close_ac()

    def _on_editor_tab(self, event=None):
        if self._ac_tip is not None:
            if self._ac_matches and self._ac_index >= 0 and self._ac_index < len(self._ac_matches):
                self._insert_autocomplete(self._ac_matches[self._ac_index], self._ac_tip)
                return "break"
            self._close_ac()
        self._editor.insert("insert", "    ")
        self._on_editor_change()
        return "break"

    def _ac_key(self, direction, event=None):
        if not self._ac_tip:
            return
        if direction == 'escape':
            self._close_ac()
            return "break"
        if direction == 'up':
            self._ac_index = max(0, self._ac_index - 1)
            self._highlight_ac_item()
            return "break"
        if direction == 'down':
            self._ac_index = min(len(self._ac_matches) - 1, self._ac_index + 1)
            self._highlight_ac_item()
            return "break"
        return "break"

    def _on_key_up(self, event=None):
        self._update_cursor_pos()
        self._match_bracket()
        keysym = event.keysym if hasattr(event, 'keysym') else ''

        if keysym and keysym in ('Up', 'Down', 'Left', 'Right', 'Return', 'BackSpace',
                                   'Escape', 'Tab', 'Control_L', 'Control_R',
                                   'Shift_L', 'Shift_R', 'colon', 'bracketleft',
                                   'bracketright', 'parenleft', 'parenright'):
            return
        if keysym and len(keysym) == 1 and not (keysym.isalnum() or keysym == '_'):
            return
        self._show_autocomplete()

    def _update_cursor_pos(self, event=None):
        try:
            cursor = self._editor.index("insert")
            line, col = cursor.split('.')
            self._status_label.configure(text=f"Ln {line}, Col {int(col)+1}")
        except Exception:
            pass

    def _match_bracket(self):
        try:
            self._editor.tag_remove('bracket_match', "1.0", "end")
        except Exception:
            pass
        pairs = {'(': ')', ')': '(', '[': ']', ']': '[', '{': '}', '}': '{'}
        try:
            cursor = self._editor.index("insert")
            ch_before = self._editor.get(f"{cursor} - 1 char", cursor)
            ch_after = self._editor.get(cursor, f"{cursor} + 1 char")
        except Exception:
            return
        ch = None
        pos = cursor
        if ch_before in pairs:
            ch = ch_before
            pos = f"{cursor} - 1 char"
        elif ch_after in pairs:
            ch = ch_after
        if not ch:
            return
        target = pairs[ch]
        direction = 1 if ch in '({[' else -1
        depth, cur, steps = 0, pos, 0
        while steps < 200:
            steps += 1
            try:
                cur = self._editor.index(f"{cur} + {direction} char")
                c = self._editor.get(cur, f"{cur} + 1 char")
            except Exception:
                return
            if c == ch:
                depth += 1
            elif c == target:
                if depth == 0:
                    self._editor.tag_add('bracket_match', cur, f"{cur} + 1 char")
                    self._editor.tag_add('bracket_match', pos, f"{pos} + 1 char")
                    return
                depth -= 1

    def _show_autocomplete(self):
        try:
            cursor = self._editor.index("insert")
            lineno = int(cursor.split('.')[0])
            col = int(cursor.split('.')[1])
            line_start = self._editor.get(f"{lineno}.0", cursor)
        except Exception:
            return
        if not line_start or col < 2:
            self._close_ac()
            return
        partial = line_start.split()[-1] if line_start.split() else ""
        if not partial or len(partial) < 2:
            self._close_ac()
            return

        custom_funcs = set()
        full_code = self._editor.get("1.0", "end-1c")
        for match in re.finditer(r'def\s+([a-zA-Z_]\w*)\s*\(', full_code):
            custom_funcs.add(match.group(1))

        all_funcs = PEDRO_FUNCTIONS | custom_funcs
        if partial in all_funcs:
            self._close_ac()
            return
        matches = [f for f in sorted(all_funcs) if f.startswith(partial) and f != partial]
        if not matches:
            self._close_ac()
            return

        self._ac_matches = matches
        if not hasattr(self, '_ac_index') or self._ac_index >= len(matches):
            self._ac_index = 0

        same_matches = (hasattr(self, '_ac_prev_matches') and 
                         self._ac_prev_matches == matches and 
                         self._ac_tip is not None)
        self._ac_prev_matches = matches

        if same_matches:
            self._highlight_ac_item()
            if self._ac_timeout:
                self.after_cancel(self._ac_timeout)
            self._ac_timeout = self.after(3000, self._close_ac)
            return

        old_tip = self._ac_tip
        self._ac_tip = None
        if old_tip:
            try:
                old_tip.destroy()
            except Exception:
                try:
                    old_tip.withdraw()
                except Exception:
                    pass

        try:
            bbox = self._editor.bbox(cursor)
            if not bbox:
                return
            x, y, _, h = bbox
            x_root = self._editor.winfo_rootx() + x + 10
            y_root = self._editor.winfo_rooty() + y + h + 2

            tip = ctk.CTkToplevel(self)
            tip.overrideredirect(True)
            tip.geometry(f"+{x_root}+{y_root}")
            tip.configure(fg_color="#2D2D2D")

            self._ac_labels = []
            for i, m in enumerate(matches):
                lbl = ctk.CTkLabel(tip, text=f"{m}()", font=(EDITOR_FONT_FAMILY, self._font_size - 2),
                                    text_color="#D4D4D4", anchor="w", padx=8, pady=2,
                                    corner_radius=0)
                lbl.pack(fill="x")
                lbl.bind("<Button-1>", lambda e, fn=m: self._insert_autocomplete(fn, tip))
                lbl.configure(cursor="hand2")
                self._ac_labels.append(lbl)

            self._ac_tip = tip
            self._highlight_ac_item()
            if self._ac_timeout:
                self.after_cancel(self._ac_timeout)
            self._ac_timeout = self.after(3000, self._close_ac)
        except Exception:
            pass

    def _highlight_ac_item(self):
        if not self._ac_tip or not hasattr(self, '_ac_labels') or not self._ac_labels:
            return
        for i, lbl in enumerate(self._ac_labels):
            try:
                if i == self._ac_index:
                    lbl.configure(fg_color="#3A3A3A", text_color="#FFFFFF")
                else:
                    lbl.configure(fg_color="transparent", text_color="#D4D4D4")
            except Exception:
                self._close_ac()
                return

    def _close_ac(self):
        if self._ac_timeout:
            self.after_cancel(self._ac_timeout)
            self._ac_timeout = None
        if self._ac_tip:
            try:
                self._ac_tip.destroy()
            except Exception:
                try:
                    self._ac_tip.withdraw()
                except Exception:
                    pass
            self._ac_tip = None
        self._ac_matches = []
        self._ac_labels = []
        self._ac_index = 0
        self._ac_prev_matches = []

    def _insert_autocomplete(self, func_name, tip):
        try:
            cursor = self._editor.index("insert")
            lineno = int(cursor.split('.')[0])
            col = int(cursor.split('.')[1])
            line_start = self._editor.get(f"{lineno}.0", cursor)
            m = re.search(r'([a-zA-Z_]\w*)$', line_start)
            if m:
                word = m.group(1)
                start_col = col - len(word)
                self._editor.delete(f"{lineno}.{start_col}", cursor)
            self._editor.insert(cursor, f"{func_name}()")
        except Exception:
            pass
        self._close_ac()
        self._on_editor_change()

    def _on_mouse_move(self, event=None):
        if self._tooltip_job:
            self.after_cancel(self._tooltip_job)
        self._tooltip_job = self.after(600, lambda: self._show_hover_tooltip(event.x_root, event.y_root))

    def _show_hover_tooltip(self, root_x, root_y):
        try:
            index = self._editor.index(f"@{root_x - self._editor.winfo_rootx()},{root_y - self._editor.winfo_rooty()}")
            tags = self._editor.tag_names(index)
        except Exception:
            self._hide_tooltip()
            return

        msg = None
        fg, bg = "#FFAAAA", "#3D1A1A"

        if 'error_bg' in tags or 'error_fg' in tags:
            try:
                lineno = int(str(index).split('.')[0])
                line_text = self._editor.get(f"{lineno}.0", f"{lineno}.end").strip()
                if any(fn in line_text for fn in PEDRO_FUNCTIONS) and '(' not in line_text:
                    for fn in PEDRO_FUNCTIONS:
                        if fn in line_text and f"{fn}(" not in line_text:
                            msg = f"Missing parentheses: use {fn}() to call the function"
                            break
                if not msg:
                    try:
                        compile(self._editor.get("1.0", "end-1c"), '<editor>', 'exec')
                    except SyntaxError as e:
                        if e.lineno == lineno:
                            msg = f"Syntax error: {e.msg}"
                    except Exception:
                        pass
                if not msg:
                    msg = "Code outside a function — wrap it in def"
            except Exception:
                self._hide_tooltip()
                return
        elif 'pedro' in tags:
            try:
                col = int(str(index).split('.')[1])
                lineno_val = int(str(index).split('.')[0])
                line_text = self._editor.get(f"{lineno_val}.0", f"{lineno_val}.end")
                words = []
                for m in re.finditer(r'\b([a-zA-Z_]\w*)\b', line_text):
                    if m.start() <= col <= m.end():
                        words.append(m.group(1))
                word = words[0] if words else ""
                pedro_docs = {
                    'move': 'Move Pedro forward one step.',
                    'turn_left': 'Turn Pedro 90 degrees counter-clockwise.',
                    'plant_flag': 'Plant a flag at the current position.',
                    'pick_flag': 'Pick up a flag from the current position.',
                    'front_is_clear': 'Return True if no wall is ahead.',
                    'flag_present': 'Return True if a flag is at this position.',
                    'facing_north': 'Return True if Pedro is facing north.',
                    'facing_east': 'Return True if Pedro is facing east.',
                }
                if word in pedro_docs:
                    msg = f"{word}() — {pedro_docs[word]}"
                    fg, bg = "#B8D4B8", "#1A2A1A"
            except Exception:
                pass

        if not msg:
            self._hide_tooltip()
            return

        try:
            if hasattr(self, '_err_tip') and self._err_tip:
                try:
                    self._err_tip.destroy()
                except Exception:
                    pass
            tip = ctk.CTkToplevel(self)
            tip.overrideredirect(True)
            tip.geometry(f"+{root_x + 12}+{root_y + 16}")
            tip.attributes("-topmost", True)
            tip.configure(fg_color=bg)
            ctk.CTkLabel(tip, text=msg, font=("", 12), text_color=fg,
                          wraplength=350, padx=10, pady=5).pack()
            self._err_tip = tip
            self._tooltip_job = self.after(3000, self._hide_tooltip)
        except Exception:
            pass

    def _hide_tooltip(self):
        if self._tooltip_job:
            self.after_cancel(self._tooltip_job)
            self._tooltip_job = None
        if self._tooltip:
            try:
                self._tooltip.destroy()
            except Exception:
                pass
            self._tooltip = None
        if hasattr(self, '_err_tip') and self._err_tip:
            try:
                self._err_tip.destroy()
            except Exception:
                pass
            self._err_tip = None

    def _highlight_current_line(self):
        try:
            self._editor.tag_remove('current_line', "1.0", "end")
            lineno = int(self._editor.index("insert").split('.')[0])
            self._editor.tag_add('current_line', f"{lineno}.0", f"{lineno}.end")
        except Exception:
            pass

    def _draw_indent_guides(self):
        c = self._indent_guide
        c.delete("all")
        w = c.winfo_width()
        h = c.winfo_height()
        if w < 1 or h < 1:
            return
        char_w = tkfont.Font(family=EDITOR_FONT_FAMILY, size=self._font_size).measure(" ")
        for level in range(1, 10):
            x = int(level * 4 * char_w) + 4
            if x > w:
                break
            for y in range(0, h, 8):
                c.create_line(x, y, x, y + 4, fill="#3A3A3A", width=1)

    def _on_editor_unindent(self, event=None):
        editor = self._editor
        try:
            sel_start = editor.index("sel.first")
            sel_end = editor.index("sel.last")
            start_line = int(sel_start.split('.')[0])
            end_line = int(sel_end.split('.')[0])
            if int(sel_end.split('.')[1]) == 0 and end_line > start_line:
                end_line -= 1
            for ln in range(start_line, end_line + 1):
                line_text = editor.get(f"{ln}.0", f"{ln}.end")
                if line_text.startswith("    "):
                    editor.delete(f"{ln}.0", f"{ln}.4")
                elif line_text.startswith("\t"):
                    editor.delete(f"{ln}.0", f"{ln}.1")
                elif line_text.startswith(" "):
                    to_del = min(4, len(line_text) - len(line_text.lstrip(' ')))
                    editor.delete(f"{ln}.0", f"{ln}.{to_del}")
            editor.tag_remove("sel", "1.0", "end")
            editor.tag_add("sel", f"{start_line}.0", f"{end_line}.end")
            self._on_editor_change()
            return "break"
        except Exception:
            pass
        return "break"

    def _on_editor_backspace(self, event=None):
        editor = self._editor
        cursor = editor.index("insert")
        if cursor == "1.0":
            return
        try:
            sel_start = editor.index("sel.first")
            sel_end = editor.index("sel.last")
            if sel_start != sel_end:
                return
        except Exception:
            pass
        col = int(cursor.split('.')[1])
        if col == 0:
            return
        line_start = f"{cursor.split('.')[0]}.0"
        text_before = editor.get(line_start, cursor)
        if text_before and all(ch == ' ' for ch in text_before) and col <= 4:
            to_del = ((col - 1) % 4) + 1
            editor.delete(f"{cursor.split('.')[0]}.{col - to_del}", cursor)
            self._on_editor_change()
            return "break"

    def _on_speed_change(self, value):
        pct = int(float(value))
        self._replay_speed = 1500 - pct * 14

    def _toggle_instant(self):
        self._instant_mode = not self._instant_mode
        if self._instant_mode:
            self._instant_btn.configure(text="Instant", fg_color="#B85C00", hover_color="#8A4500")
        else:
            self._instant_btn.configure(text="Animated", fg_color="#444444", border_width=1)

    def _merge_turns(self, snapshots):
        merged = []
        i = 0
        while i < len(snapshots):
            s = snapshots[i]
            if s['action'] == 'turn_left' and i + 2 < len(snapshots):
                s2 = snapshots[i + 1]
                s3 = snapshots[i + 2]
                if s2['action'] == 'turn_left' and s3['action'] == 'turn_left':
                    merged.append({
                        'action': 'turn_right',
                        'row': s3['row'],
                        'col': s3['col'],
                        'direction': s3['direction'],
                        'flags_carried': s3.get('flags_carried', 0),
                        'grid': s3['grid'],
                    })
                    i += 3
                    continue
            merged.append(s)
            i += 1
        return merged

    def _friendly_error(self, raw_stderr):
        text = raw_stderr.strip()
        linenum = None
        for line in text.split('\n'):
            if 'File ' in line and ', line ' in line:
                parts = line.split(', line ')
                if len(parts) >= 2:
                    try:
                        linenum = int(parts[1].split(',')[0].strip())
                    except ValueError:
                        pass

        prefix = f"Line {linenum}: " if linenum else ""

        if 'PedroError' in text:
            if 'cannot move' in text:
                return f"{prefix}Pedro walked into a wall! Check your move() calls."
            if 'cannot pick flag' in text:
                return f"{prefix}No flag here to pick up. Use flag_present() to check first."
            return f"{prefix}Pedro ran into a problem. Check your conditions."
        if 'NameError' in text:
            for line in text.split('\n'):
                if 'NameError' in line:
                    name = line.split("'")[1] if line.count("'") >= 2 else "something"
                    return f"{prefix}'{name}' is not defined. Check your spelling."
            return f"{prefix}Name not found. Check your spelling."
        if 'SyntaxError' in text:
            return f"{prefix}Syntax error. Check colons, parentheses, and spelling."
        if 'IndentationError' in text or 'TabError' in text:
            return f"{prefix}Indentation error. Make sure your code is lined up correctly."
        if 'IndexError' in text:
            return f"{prefix}Index out of range. Check your list or range values."
        if 'TypeError' in text:
            for line in text.split('\n'):
                if 'TypeError' in line:
                    return f"{prefix}{line.strip()}"
            return f"{prefix}Type error. Check your function arguments."
        lines = text.split('\n')
        last = [l for l in lines if l.strip() and 'Traceback' not in l and 'File ' not in l]
        if last:
            msg = last[-1].strip()
            if len(msg) > 120:
                msg = msg[:117] + '...'
            return f"{prefix}{msg}"
        return f"{prefix}An error occurred. Check your code and try again."

    def _load_world(self, filepath):
        self._world_file = filepath
        try:
            self._renderer.load_world(filepath)
            self._reset_replay()
            name = Path(filepath).stem.replace("_", " ").title()
            self._world_label.configure(text=name)
            self._set_status("Ready")
        except Exception as e:
            self._set_status(f"Failed: {e}", "red")

    def _load_activity(self, name):
        scaffold_path = SCAFFOLDS_DIR / f"{name}_starter.py"
        original_path = ORIGINAL_SCAFFOLDS_DIR / f"{name}_starter.py"
        world_name_map = {
            "moon_hill": "moon_hill_3step.txt",
            "crater": "crater_mixed.txt",
            "roomba": "roomba_3x3.txt",
            "flag_piles": "flag_piles.txt",
            "flag_planting": "flag_planting.txt",
            "lunar_core": "lunar_core_a.txt",
            "maze": "maze_small.txt",
        }
        world_name = world_name_map.get(name, "")
        world_path = WORLDS_DIR / world_name if world_name else None

        if not scaffold_path.exists():
            self._set_status(f"Activity file not found: {name}", "red")
            return

        code = scaffold_path.read_text(encoding="utf-8")
        self._current_file = str(scaffold_path)
        if original_path.exists():
            self._original_code = original_path.read_text(encoding="utf-8")
        else:
            self._original_code = code
        self._editor.delete("1.0", "end")
        self._editor.insert("1.0", code)
        self._rebuild_line_numbers()
        self._highlight_debounce()

        if world_path and world_path.exists():
            self._load_world(str(world_path))

        self._set_status(f"Activity: {name.replace('_', ' ').title()} — editing {scaffold_path.name}")

    def _clear_editor(self):
        self._editor.delete("1.0", "end")
        self._rebuild_line_numbers()
        self._current_file = None
        self._original_code = ""
        self._set_status("Editor cleared")

    def _open_file(self):
        filepath = filedialog.askopenfilename(
            parent=self,
            filetypes=[("Python files", "*.py"), ("All files", "*.*")],
            title="Open Python File"
        )
        if not filepath:
            return
        try:
            code = Path(filepath).read_text(encoding="utf-8")
            self._current_file = str(filepath)
            self._original_code = ""
            self._editor.delete("1.0", "end")
            self._editor.insert("1.0", code)
            self._rebuild_line_numbers()
            self._highlight_debounce()
            self._set_status(f"Opened: {Path(filepath).name}")
        except Exception as e:
            self._set_status(f"Failed to open: {e}", "red")

    def _restore_original(self):
        if not self._current_file or not self._original_code:
            self._set_status("No activity loaded to restore.", "orange")
            return
        self._editor.delete("1.0", "end")
        self._editor.insert("1.0", self._original_code)
        self._rebuild_line_numbers()
        self._highlight_debounce()
        try:
            with open(self._current_file, 'w', encoding='utf-8') as f:
                f.write(self._original_code)
        except Exception:
            pass
        self._set_status("Restored to original scaffold")

    def _on_save(self, event=None):
        if self._current_file:
            try:
                code = self._editor.get("1.0", "end-1c")
                with open(self._current_file, 'w', encoding='utf-8') as f:
                    f.write(code)
                self._set_status(f"Saved: {Path(self._current_file).name}", "green")
            except Exception as e:
                self._set_status(f"Save failed: {e}", "red")
        else:
            self._save_as()
        return "break"

    def _on_close(self):
        if self._current_file:
            try:
                code = self._editor.get("1.0", "end-1c")
                with open(self._current_file, 'w', encoding='utf-8') as f:
                    f.write(code)
            except Exception:
                pass
        self.destroy()

    def _save_as(self):
        filepath = filedialog.asksaveasfilename(
            parent=self,
            defaultextension=".py",
            filetypes=[("Python files", "*.py"), ("All files", "*.*")],
            title="Save Pedro Code As",
        )
        if not filepath:
            return
        try:
            code = self._editor.get("1.0", "end-1c")
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(code)
            self._current_file = filepath
            self._set_status(f"Saved: {Path(filepath).name}", "green")
        except Exception as e:
            self._set_status(f"Save failed: {e}", "red")

    def _show_help(self):
        help_text = (
            "Pedro Commands:\n"
            "  move()          — Move forward one step\n"
            "  turn_left()     — Turn 90 degrees left\n"
            "  plant_flag()    — Plant a flag at current position\n"
            "  pick_flag()     — Pick up a flag at current position\n\n"
            "Pedro Conditions (return True or False):\n"
            "  front_is_clear()    — True if no wall ahead\n"
            "  flag_present()      — True if flag at current spot\n"
            "  facing_north()      — True if facing north\n"
            "  facing_east()       — True if facing east\n\n"
            "Tip: Use 'not' to check the opposite:\n"
            "  not front_is_clear()  — same as front is blocked\n"
            "  not flag_present()    — same as no flag present\n\n"
            "Write a main() function and call main() at the bottom."
        )
        dialog = ctk.CTkToplevel(self)
        dialog.title("Pedro Help")
        dialog.geometry("420x420")
        dialog.transient(self)
        dialog.grab_set()
        label = ctk.CTkLabel(dialog, text=help_text, font=("Consolas", 13),
                             justify="left", anchor="w")
        label.pack(padx=20, pady=20, fill="both", expand=True)
        ctk.CTkButton(dialog, text="Close", command=dialog.destroy).pack(pady=(0, 15))

    def _open_world_editor(self):
        dialog = ctk.CTkToplevel(self)
        dialog.title("World Editor")
        dialog.geometry("750x620")
        dialog.transient(self)
        dialog.grab_set()

        editor_cs = 24
        grid = None
        pedro_pos = [1, 1]
        pedro_dir = 1

        def new_grid(nr, nc):
            g = [['.' for _ in range(nc)] for _ in range(nr)]
            g[0] = ['#'] * nc
            g[-1] = ['#'] * nc
            for r in range(nr):
                g[r][0] = '#'
                g[r][-1] = '#'
            return g

        def cell_size():
            cw = canvas.winfo_width() // len(grid[0]) if canvas.winfo_width() > 0 else editor_cs
            ch = canvas.winfo_height() // len(grid) if canvas.winfo_height() > 0 else editor_cs
            return min(cw, ch, editor_cs)

        def draw_grid():
            canvas.delete("all")
            nr, nc = len(grid), len(grid[0])
            cs = cell_size()
            canvas.config(width=nc * cs, height=nr * cs)
            for r in range(nr):
                for c in range(nc):
                    x1, y1 = c * cs, r * cs
                    x2, y2 = x1 + cs, y1 + cs
                    val = grid[r][c]
                    fill = "#505050" if val == '#' else "#E8E0D0"
                    canvas.create_rectangle(x1, y1, x2, y2, fill=fill, outline="#C0B8A8")
                    if val == 'F':
                        cx, cy = c * cs + cs//2, r * cs + cs//2
                        s = cs // 3
                        canvas.create_polygon(cx-s, cy+s//2, cx, cy-s//2, cx+s, cy+s//2,
                                              fill="#E04040", outline="#B03030")
                    elif val in ('>', '^', 'v', '<'):
                        cx, cy = c * cs + cs//2, r * cs + cs//2
                        canvas.create_text(cx, cy, text=val, font=("", max(8, cs//2)), fill="#222222")

        top_frame = ctk.CTkFrame(dialog)
        top_frame.pack(fill="x", padx=10, pady=(10, 5))

        ctk.CTkLabel(top_frame, text="Rows:", font=("", 13)).pack(side="left", padx=(5, 2))
        rows_entry = ctk.CTkEntry(top_frame, width=50, font=("", 13))
        rows_entry.insert(0, "8")
        rows_entry.pack(side="left", padx=(0, 15))

        ctk.CTkLabel(top_frame, text="Cols:", font=("", 13)).pack(side="left", padx=(5, 2))
        cols_entry = ctk.CTkEntry(top_frame, width=50, font=("", 13))
        cols_entry.insert(0, "12")
        cols_entry.pack(side="left", padx=(0, 15))

        def set_pedro_dir_cb(v):
            nonlocal pedro_dir
            d = {"East": 1, "North": 0, "South": 2, "West": 3}[v]
            pedro_dir = d
            dir_chars = {1: '>', 0: '^', 2: 'v', 3: '<'}
            r, c = pedro_pos
            for rr in range(len(grid)):
                for cc in range(len(grid[0])):
                    if grid[rr][cc] in dir_chars.values():
                        grid[rr][cc] = '.'
            grid[r][c] = dir_chars[d]
            draw_grid()

        ctk.CTkLabel(top_frame, text="Faces:", font=("", 13)).pack(side="left", padx=(15, 2))
        ctk.CTkOptionMenu(top_frame, values=["East", "North", "South", "West"],
                           command=set_pedro_dir_cb).pack(side="left", padx=(0, 15))

        def resize_grid():
            try:
                nr = max(4, min(30, int(rows_entry.get())))
                nc = max(4, min(40, int(cols_entry.get())))
            except ValueError:
                return
            rows_entry.delete(0, "end"); rows_entry.insert(0, str(nr))
            cols_entry.delete(0, "end"); cols_entry.insert(0, str(nc))
            nonlocal grid, pedro_pos
            old = grid if grid else []
            grid = new_grid(nr, nc)
            for r in range(min(nr, len(old))):
                for c in range(min(nc, len(old[0]) if old else 0)):
                    if old[r][c] in ('#', 'F'):
                        grid[r][c] = old[r][c]
            if pedro_pos[0] >= nr or pedro_pos[1] >= nc:
                pedro_pos = [1, 1]
            grid[pedro_pos[0]][pedro_pos[1]] = '>'
            draw_grid()

        ctk.CTkButton(top_frame, text="Update Grid", width=90, command=resize_grid).pack(side="left", padx=10)

        ctk.CTkLabel(top_frame, text="Zoom:", font=("", 11)).pack(side="left", padx=(15, 2))
        def zoom(delta):
            nonlocal editor_cs
            editor_cs = max(12, min(48, editor_cs + delta))
            draw_grid()
        ctk.CTkButton(top_frame, text="-", width=28, height=22, command=lambda: zoom(-4)).pack(side="left")
        ctk.CTkButton(top_frame, text="+", width=28, height=22, command=lambda: zoom(4)).pack(side="left")

        canvas_frame = ctk.CTkFrame(dialog)
        canvas_frame.pack(fill="both", expand=True, padx=10, pady=5)
        canvas = Canvas(canvas_frame, bg="#D0C8B8", highlightthickness=0)
        canvas.pack(fill="both", expand=True)

        def on_canvas_click(event):
            if not grid:
                return
            cs = cell_size()
            c, r = event.x // cs, event.y // cs
            nr, nc = len(grid), len(grid[0])
            if r <= 0 or r >= nr - 1 or c <= 0 or c >= nc - 1:
                return
            if event.num == 1:
                cycle = {'.': '#', '#': 'F', 'F': '.', '>': '.', '^': '.', 'v': '.', '<': '.'}
                grid[r][c] = cycle.get(grid[r][c], '.')
            elif event.num == 3:
                dirs = {'>', '^', 'v', '<'}
                for rr in range(nr):
                    for cc in range(nc):
                        if grid[rr][cc] in dirs:
                            grid[rr][cc] = '.'
                grid[r][c] = '>'
                pedro_pos[0], pedro_pos[1] = r, c
            draw_grid()

        canvas.bind("<Button-1>", on_canvas_click)
        canvas.bind("<Button-3>", on_canvas_click)

        def save_world():
            lines = [''.join(row) for row in grid]
            filename = filedialog.asksaveasfilename(
                parent=dialog, defaultextension=".txt",
                filetypes=[("World files", "*.txt")],
                initialdir=str(WORLDS_DIR), title="Save World As"
            )
            if filename:
                with open(filename, 'w', encoding='utf-8') as f:
                    f.write('\n'.join(lines))
                self._rebuild_worlds_menu()
                dialog.destroy()
                self._load_world(filename)

        def load_world():
            filename = filedialog.askopenfilename(
                parent=dialog, filetypes=[("World files", "*.txt")],
                initialdir=str(WORLDS_DIR), title="Open World"
            )
            if not filename:
                return
            try:
                with open(filename, 'r', encoding='utf-8') as f:
                    raw = [l.rstrip('\n\r') for l in f if l.strip()]
            except Exception:
                self._set_status("Failed to load world file", "red")
                return
            nonlocal grid, pedro_pos
            nr, nc = len(raw), max(len(l) for l in raw)
            grid = [['.' for _ in range(nc)] for _ in range(nr)]
            for r, line in enumerate(raw):
                for c, ch in enumerate(line):
                    if ch in ('#', '.', 'F', '>', '^', 'v', '<'):
                        grid[r][c] = ch
                for c in range(len(line), nc):
                    grid[r][c] = '#'
            for r in range(nr):
                for c in range(nc):
                    if grid[r][c] in ('>', '^', 'v', '<'):
                        pedro_pos = [r, c]
            rows_entry.delete(0, "end"); rows_entry.insert(0, str(nr))
            cols_entry.delete(0, "end"); cols_entry.insert(0, str(nc))
            draw_grid()

        def clear_grid():
            nonlocal grid, pedro_pos, pedro_dir
            try:
                nr = max(4, min(30, int(rows_entry.get())))
                nc = max(4, min(40, int(cols_entry.get())))
            except ValueError:
                nr, nc = 8, 12
            grid = new_grid(nr, nc)
            pedro_pos = [1, 1]
            pedro_dir = 1
            grid[1][1] = '>'
            draw_grid()

        btn_frame = ctk.CTkFrame(dialog)
        btn_frame.pack(fill="x", padx=10, pady=(5, 10))
        ctk.CTkButton(btn_frame, text="Clear Grid", width=80,
                       command=clear_grid,
                       fg_color="#555555", border_width=1).pack(side="left", padx=5)
        ctk.CTkLabel(btn_frame, text="L-click: cycle cell   |   R-click: place Pedro",
                      font=("", 11)).pack(side="left", padx=15, pady=5)
        ctk.CTkButton(btn_frame, text="Load", width=70,
                       command=load_world, fg_color="#444444", border_width=1).pack(side="right", padx=5, pady=5)
        ctk.CTkButton(btn_frame, text="Save & Load", width=90,
                       command=save_world, fg_color="#2E7D32").pack(side="right", padx=5, pady=5)

        grid = new_grid(8, 12)
        grid[1][1] = '>'
        draw_grid()

    def _change_font(self, delta):
        new = max(6, self._font_size + delta)
        self._font_size = new
        font_spec = (EDITOR_FONT_FAMILY, new)
        self._editor.configure(font=font_spec,
                                tabs=(tkfont.Font(family=EDITOR_FONT_FAMILY, size=new).measure("    "),))
        self._line_numbers.configure(font=font_spec)
        self._font_label.configure(text=str(new))
        self._rebuild_line_numbers()
        self._highlight_debounce()
        self._set_status(f"Font size: {new}")

    def _run_code(self):
        if not self._world_file:
            self._set_status("Load a world first (Worlds menu)", "red")
            return

        code = self._editor.get("1.0", "end-1c").strip()
        if not code:
            self._set_status("Write some code first", "red")
            return

        self._run_btn.configure(state="disabled", text="Running...")
        try:
            self._do_run(code)
        finally:
            self._run_btn.configure(state="normal", text="Run")

    def _do_run(self, code):

        if self._current_file:
            try:
                with open(self._current_file, 'w', encoding='utf-8') as f:
                    f.write(code)
            except Exception:
                pass

        with tempfile.TemporaryDirectory() as tmpdir:
            code_file = os.path.join(tmpdir, "student_code.py")
            with open(code_file, 'w', encoding='utf-8') as f:
                f.write(code)

            output_file = os.path.join(tmpdir, "history.json")

            env = os.environ.copy()
            env['PEDRO_WORLD'] = self._world_file
            env['PEDRO_OUTPUT'] = output_file

            try:
                cmd = [sys.executable]
                if not getattr(sys, 'frozen', False):
                    cmd.append(__file__)
                cmd.extend(['--exec', code_file])
                result = subprocess.run(
                    cmd,
                    capture_output=True, text=True, timeout=10,
                    env=env, cwd=tmpdir
                )
            except subprocess.TimeoutExpired:
                self._set_status("Infinite loop detected! Your code ran too long.", "red")
                return
            except Exception as e:
                self._set_status(f"Error running code: {e}", "red")
                return

            if result.returncode != 0:
                err = result.stderr.strip()
                loaded = False
                if os.path.exists(output_file):
                    try:
                        with open(output_file, 'r') as f:
                            self._snapshots = json.load(f)
                        loaded = True
                    except Exception:
                        pass
                if loaded and self._snapshots:
                    self._reset_replay(keep_snapshots=True)
                    friendly = self._friendly_error(err) if err else "Code stopped with an error."
                    self._set_status(f"{friendly} — showing {len(self._snapshots)} steps before crash", "orange")
                else:
                    friendly = self._friendly_error(err) if err else "Code stopped with an error."
                    self._set_status(f"{friendly}", "red")
                return

            if not os.path.exists(output_file):
                self._set_status("Code ran but produced no actions. Did you call main()?", "orange")
                return

            try:
                with open(output_file, 'r') as f:
                    self._snapshots = json.load(f)
                    self._snapshots = self._merge_turns(self._snapshots)
            except json.JSONDecodeError:
                self._set_status("Failed to read execution history", "red")
                return

            if not self._snapshots:
                self._set_status("Code ran but produced no actions. Did you call main()?", "orange")
                return

            self._reset_replay(keep_snapshots=True)
            self._set_status(
                f"Ran successfully — {len(self._snapshots)} steps recorded",
                "green"
            )

    def _reset_replay(self, keep_snapshots=False):
        if not keep_snapshots:
            self._snapshots = []
        self._current_step = -1
        self._is_animating = False

        if self._world_file:
            self._renderer.load_world(self._world_file)

        has_data = bool(self._snapshots)
        state = "normal" if has_data else "disabled"
        self._step_btn.configure(state=state)
        self._prev_btn.configure(state=state)
        self._reset_btn.configure(state=state)
        self._auto_btn.configure(state=state)
        self._update_step_info()

    def _reset(self):
        self._reset_replay(keep_snapshots=False)
        self._set_status("Reset — Ready")
        self._update_step_info()

    def _step_forward(self):
        if self._is_animating:
            return
        if self._current_step + 1 >= len(self._snapshots):
            return

        self._is_animating = True
        self._current_step += 1
        snap = self._snapshots[self._current_step]

        if self._instant_mode:
            self._renderer.apply_snapshot(snap)
            self._is_animating = False
            self._update_step_info(snap['action'])
        else:
            self._update_step_info(snap['action'])
            def on_done():
                self._is_animating = False
            self._renderer.animate_action(snap, callback=on_done)

    def _step_back(self):
        if self._is_animating:
            return
        if self._current_step < 0:
            return

        self._current_step -= 1
        if self._current_step < 0:
            self._renderer.load_world(self._world_file)
        else:
            self._renderer.apply_snapshot(self._snapshots[self._current_step])
        self._update_step_info()

    def _play_all(self):
        if self._is_animating:
            return

        if self._instant_mode:
            while self._current_step + 1 < len(self._snapshots):
                self._current_step += 1
                self._renderer.apply_snapshot(self._snapshots[self._current_step])
            self._update_step_info(self._snapshots[-1]['action'] if self._snapshots else None)
            self._set_status("Playback complete", "green")
            return

        if self._current_step + 1 >= len(self._snapshots):
            self._current_step = -1
            self._renderer.load_world(self._world_file)
            self._update_step_info()

        self._is_animating = True

        def play_next():
            if self._current_step + 1 >= len(self._snapshots):
                self._is_animating = False
                self._set_status("Playback complete", "green")
                return

            self._current_step += 1
            snap = self._snapshots[self._current_step]
            self._update_step_info(snap['action'])

            def on_done():
                delay = max(50, self._replay_speed)
                self.after(delay, play_next)

            self._renderer.animate_action(snap, callback=on_done)

        play_next()


def main():
    app = PedroApp()
    app.mainloop()


if __name__ == "__main__":
    main()
