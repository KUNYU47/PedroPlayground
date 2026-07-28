import re
import difflib
from dataclasses import dataclass, field
from typing import Optional
from tkinter import font as tkfont

import customtkinter as ctk

_jedi_available = False
try:
    import jedi
    _jedi_available = True
except ImportError:
    pass


@dataclass
class Completion:
    name: str
    kind: str
    description: str = ""
    insert_text: str = ""


@dataclass
class Signature:
    name: str
    params: list = field(default_factory=list)
    active_param: int = 0
    description: str = ""


PEDRO_FUNCTIONS = {
    'move', 'turn_left', 'plant_flag', 'pick_flag',
    'front_is_clear', 'flag_present',
    'facing_north', 'facing_east',
}

PEDRO_DOCS = {
    'move': 'Move Pedro forward one step.',
    'turn_left': 'Turn Pedro 90 degrees counter-clockwise.',
    'plant_flag': 'Plant a flag at the current position.',
    'pick_flag': 'Pick up a flag from the current position.',
    'front_is_clear': 'Return True if no wall is ahead.',
    'flag_present': 'Return True if a flag is at this position.',
    'facing_north': 'Return True if Pedro is facing north.',
    'facing_east': 'Return True if Pedro is facing east.',
}

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

SNIPPETS = [
    Completion('for', 'snippet', 'for loop', 'for x in range(n):\n    '),
    Completion('while', 'snippet', 'while loop', 'while condition:\n    '),
    Completion('def', 'snippet', 'function definition', 'def function_name():\n    '),
    Completion('if', 'snippet', 'if statement', 'if condition:\n    '),
    Completion('ifmain', 'snippet', 'if __name__ == "__main__":',
               'if __name__ == "__main__":\n    '),
    Completion('else', 'snippet', 'else block', 'else:\n    '),
    Completion('elif', 'snippet', 'elif block', 'elif condition:\n    '),
]

KIND_COLORS = {
    'keyword': '#569CD6',
    'builtin': '#DCDCAA',
    'pedro': '#4EC9B0',
    'snippet': '#C586C0',
    'function': '#DCDCAA',
    'statement': '#569CD6',
    'module': '#569CD6',
    'class': '#4EC9B0',
    'instance': '#9CDCFE',
    'param': '#9CDCFE',
    'path': '#CE9178',
    'property': '#9CDCFE',
}


def _jedi_kind_to_ours(jedi_kind: str) -> str:
    return jedi_kind if jedi_kind in KIND_COLORS else 'keyword'


class AutocompleteEngine:
    def __init__(self):
        self._pedro_signatures = {
            'move': Signature('move', [], 0, PEDRO_DOCS['move']),
            'turn_left': Signature('turn_left', [], 0, PEDRO_DOCS['turn_left']),
            'plant_flag': Signature('plant_flag', [], 0, PEDRO_DOCS['plant_flag']),
            'pick_flag': Signature('pick_flag', [], 0, PEDRO_DOCS['pick_flag']),
            'front_is_clear': Signature('front_is_clear', [], 0, PEDRO_DOCS['front_is_clear']),
            'flag_present': Signature('flag_present', [], 0, PEDRO_DOCS['flag_present']),
            'facing_north': Signature('facing_north', [], 0, PEDRO_DOCS['facing_north']),
            'facing_east': Signature('facing_east', [], 0, PEDRO_DOCS['facing_east']),
        }

        self._completions_lower = [
            Completion(kw, 'keyword', '', kw)
            for kw in PYTHON_KEYWORDS if kw[0].islower() or kw[0] == '_'
        ]
        self._completions_upper = [
            Completion(kw, 'keyword', '', kw)
            for kw in PYTHON_KEYWORDS if kw[0].isupper()
        ]
        self._completions_builtin = [
            Completion(b, 'builtin', '', b + '()')
            for b in PYTHON_BUILTINS
        ]
        self._completions_pedro = [
            Completion(f, 'pedro', PEDRO_DOCS.get(f, ''), f + '()')
            for f in PEDRO_FUNCTIONS
        ]

    def complete(self, code: str, lineno: int, col: int) -> list:
        partial = self._extract_partial(code, lineno, col)
        if not partial:
            return []

        if partial[0].isupper():
            completions = list(self._completions_upper)
        else:
            completions = list(self._completions_lower)
            completions.extend(self._completions_builtin)
            completions.extend(self._completions_pedro)
            completions.extend(SNIPPETS)

            custom_funcs = self._scan_user_functions(code)
            for func_name in sorted(custom_funcs):
                completions.append(Completion(func_name, 'function', '', func_name + '()'))

            if _jedi_available:
                completions = self._merge_jedi(completions, code, lineno, col, partial)

        return self._fuzzy_filter(completions, partial)

    def get_signature(self, code: str, lineno: int, col: int) -> Optional[Signature]:
        func_name, paren_depth = self._find_call_signature(code, lineno, col)
        if not func_name:
            return None

        if func_name in self._pedro_signatures:
            sig = self._pedro_signatures[func_name]
            if paren_depth > 0:
                sig = Signature(sig.name, list(sig.params), min(paren_depth - 1, max(0, len(sig.params) - 1)),
                                sig.description)
            return sig

        if _jedi_available:
            try:
                cleaned = self._clean_for_jedi(code)
                script = jedi.Script(code=cleaned, path='<editor>.py')
                jedi_sigs = script.get_signatures(line=lineno, column=col)
                if jedi_sigs:
                    js = jedi_sigs[0]
                    params = [(p.name, p.description) for p in js.params]
                    active = js.index
                    desc = js.docstring() or ''
                    return Signature(js.name, params, active, desc)
            except Exception:
                pass

        return None

    def _extract_partial(self, code: str, lineno: int, col: int) -> str:
        lines = code.split('\n')
        if lineno < 1 or lineno > len(lines):
            return ''
        line = lines[lineno - 1]
        if col > len(line):
            return ''
        before = line[:col]
        m = re.search(r'([a-zA-Z_]\w*)$', before)
        return m.group(1) if m else ''

    def _scan_user_functions(self, code: str) -> set:
        return set(re.findall(r'def\s+([a-zA-Z_]\w*)\s*\(', code))

    def _clean_for_jedi(self, code: str) -> str:
        lines = code.split('\n')
        cleaned = []
        for line in lines:
            stripped = line.strip()
            if (stripped.startswith('from pedro import') or
                    stripped == 'import pedro' or
                    stripped.startswith('import pedro as')):
                cleaned.append('')
            else:
                cleaned.append(line)
        return '\n'.join(cleaned)

    def _merge_jedi(self, existing: list, code: str, lineno: int, col: int,
                    partial: str) -> list:
        try:
            cleaned = self._clean_for_jedi(code)
            script = jedi.Script(code=cleaned, path='<editor>.py')
            jedi_completions = script.complete(line=lineno, column=col)
        except Exception:
            return existing

        existing_names = {c.name for c in existing}
        for jc in jedi_completions:
            name = jc.name
            if name in existing_names:
                continue
            if name.startswith('_') or len(name) > 30:
                continue
            if jc.type == 'class' and len(name) > 14:
                continue
            if jc.type == 'instance':
                continue
            kind = _jedi_kind_to_ours(jc.type)
            desc = jc.description or ''
            name = jc.name
            if jc.type == 'function' and not name.endswith(')'):
                insert = name + '()'
            else:
                insert = name
            existing.append(Completion(name, kind, desc, insert))
            existing_names.add(name)

        return existing

    def _fuzzy_filter(self, completions: list, partial: str) -> list:
        partial_lower = partial.lower()
        scored = []
        for c in completions:
            name_lower = c.name.lower()
            if name_lower == partial_lower:
                scored.append((0, c))
            elif name_lower.startswith(partial_lower):
                scored.append((1, c))
            elif partial_lower in name_lower:
                scored.append((2, c))
            elif len(partial) >= 3:
                ratio = difflib.SequenceMatcher(None, partial_lower, name_lower).ratio()
                if ratio >= 0.5:
                    scored.append((3 - ratio, c))
        kind_order = {'pedro': 0, 'keyword': 1, 'builtin': 2, 'snippet': 3,
                      'function': 4, 'statement': 5}
        scored.sort(key=lambda x: (kind_order.get(x[1].kind, 6), x[0]))
        seen = set()
        result = []
        for _, c in scored:
            if c.name not in seen:
                seen.add(c.name)
                result.append(c)
        return result[:10]

    def _find_call_signature(self, code: str, lineno: int, col: int) -> tuple:
        lines = code.split('\n')
        if lineno < 1 or lineno > len(lines):
            return None, 0
        line = lines[lineno - 1]
        before = line[:col]
        if col > len(before):
            return None, 0

        brace_pos = before.rfind('(', 0, col)
        if brace_pos < 0:
            return None, 0

        before_paren = before[:brace_pos]
        m = re.search(r'([a-zA-Z_]\w*)$', before_paren)
        if not m:
            return None, 0
        func_name = m.group(1)

        stack = 0
        for ch in before[brace_pos:col]:
            if ch == '(':
                stack += 1
            elif ch == ')':
                stack -= 1

        return func_name, max(0, stack)


def _clamp_screen(popup, x, y, width, height):
    screen_w = popup.winfo_screenwidth()
    screen_h = popup.winfo_screenheight()
    if x + width > screen_w - 10:
        x = screen_w - width - 10
    if x < 0:
        x = 0
    if y + height > screen_h - 10:
        y = y - height - 20
    if y < 0:
        y = 0
    return x, y


class SuggestionPopup(ctk.CTkToplevel):
    def __init__(self, parent_widget, font_family: str = "Consolas", font_size: int = 13):
        super().__init__()
        self.overrideredirect(True)
        self.attributes("-topmost", True)
        self.withdraw()
        self.configure(fg_color="#2D2D2D")

        self._font_family = font_family
        self._font_size = font_size
        self._items = []
        self._selection = 0
        self._completions = []
        self._visible = False

        self._scroll = ctk.CTkScrollableFrame(self, fg_color="transparent",
                                              scrollbar_button_color="#4A4A4A",
                                              scrollbar_button_hover_color="#6A6A6A")
        self._scroll.pack(fill="both", expand=True, padx=1, pady=1)

    def show(self, x: int, y: int, completions: list):
        prev_name = None
        if self._visible and 0 <= self._selection < len(self._completions):
            prev_name = self._completions[self._selection].name

        self._completions = completions
        self._rebuild_items()

        if prev_name is not None:
            for i, comp in enumerate(completions):
                if comp.name == prev_name:
                    self._selection = i
                    break
            else:
                self._selection = 0
        else:
            self._selection = 0
        self._highlight_item(self._selection, True)

        self.update_idletasks()
        width = self._measure_width()
        height = min(len(completions), 10) * 28 + 6

        x, y = _clamp_screen(self, x, y, width, height)

        self.geometry(f"{width}x{height}+{x}+{y}")
        self.deiconify()
        self._visible = True

    def hide(self):
        self.withdraw()
        self._visible = False
        self._completions = []
        self._items = []
        self._selection = 0

    def is_visible(self) -> bool:
        return self._visible

    def navigate(self, delta: int):
        if not self._completions:
            return
        new_idx = self._selection + delta
        if new_idx < 0:
            new_idx = len(self._completions) - 1
        elif new_idx >= len(self._completions):
            new_idx = 0
        self._highlight_item(self._selection, False)
        self._selection = new_idx
        self._highlight_item(self._selection, True)
        self._ensure_visible(self._selection)
        self.update_idletasks()

    def accept_selected(self) -> Optional[str]:
        if not self._completions or self._selection >= len(self._completions):
            return None
        return self._completions[self._selection].insert_text

    def selected_index(self) -> int:
        return self._selection

    def _rebuild_items(self):
        for child in self._scroll.winfo_children():
            child.destroy()
        self._items = []

        for i, comp in enumerate(self._completions):
            frame = ctk.CTkFrame(self._scroll, fg_color="transparent",
                                 corner_radius=0, height=26)
            frame.pack(fill="x", padx=2, pady=1)
            frame.pack_propagate(False)

            kind_color = KIND_COLORS.get(comp.kind, '#D4D4D4')
            badge = ctk.CTkLabel(frame, text=comp.kind, font=("", self._font_size - 3),
                                 text_color=kind_color, width=55, anchor="w")
            badge.pack(side="left", padx=(4, 0))

            name_text = comp.name
            if comp.kind in ('builtin', 'pedro', 'function') and not name_text.endswith('()'):
                name_text = name_text + '()'
            elif comp.kind == 'keyword':
                name_text = comp.name
            elif comp.kind == 'snippet':
                name_text = comp.name + ' …'

            name_label = ctk.CTkLabel(frame, text=name_text,
                                      font=("", self._font_size, "bold"),
                                      text_color="#D4D4D4", anchor="w")
            name_label.pack(side="left", padx=(4, 0))

            if comp.description:
                desc = comp.description[:50]
                if len(comp.description) > 50:
                    desc += '…'
                desc_label = ctk.CTkLabel(frame, text=desc,
                                          font=("", self._font_size - 3),
                                          text_color="#858585", anchor="e")
                desc_label.pack(side="right", padx=(6, 4))

            idx = i
            for child in (frame, badge, name_label):
                child.bind("<Button-1>", lambda e, n=idx: self._on_click(n))
                child.bind("<ButtonRelease-1>", lambda e, n=idx: self._on_click(n))
            self._items.append(frame)

    def _highlight_item(self, idx: int, on: bool):
        if 0 <= idx < len(self._items):
            self._items[idx].configure(fg_color="#264F78" if on else "transparent")

    def _ensure_visible(self, idx: int):
        pass

    def _on_click(self, idx: int):
        self._highlight_item(self._selection, False)
        self._selection = idx
        self._highlight_item(self._selection, True)

    def _measure_width(self) -> int:
        try:
            test_font = tkfont.Font(family=self._font_family, size=self._font_size)
        except Exception:
            test_font = tkfont.Font(size=self._font_size)
        max_w = 200
        for comp in self._completions:
            name = comp.name
            if comp.kind in ('builtin', 'pedro', 'function'):
                name = name + '()'
            w = test_font.measure(" " * 7 + comp.kind + "  " + name)
            if comp.description:
                w += test_font.measure("  " + comp.description[:50])
            max_w = max(max_w, int(w + 20))
        return min(max_w, 500)


class SignaturePopup(ctk.CTkToplevel):
    def __init__(self, parent_widget, font_family: str = "Consolas", font_size: int = 13):
        super().__init__()
        self.overrideredirect(True)
        self.attributes("-topmost", True)
        self.withdraw()
        self.configure(fg_color="#2D2D2D")

        self._font_family = font_family
        self._font_size = font_size
        self._visible = False
        self._signature = None
        self._active_param = 0

        self._sig_label = None
        self._desc_label = None

    def show(self, x: int, y: int, signature: Signature):
        for child in self.winfo_children():
            child.destroy()

        self._signature = signature
        self._active_param = signature.active_param

        if signature.params:
            param_parts = []
            for i, (pname, pdesc) in enumerate(signature.params):
                if i == self._active_param:
                    param_parts.append(f"**{pname}**")
                else:
                    param_parts.append(pname)
            sig_text = f"{signature.name}({', '.join(param_parts)})"
        else:
            sig_text = f"{signature.name}()"

        self._sig_label = ctk.CTkLabel(self, text=sig_text,
                                       font=("", self._font_size, "bold"),
                                       text_color="#D4D4D4", anchor="w",
                                       padx=10, pady=(8, 2))
        self._sig_label.pack(fill="x")

        if signature.params and self._active_param < len(signature.params):
            pname, pdesc = signature.params[self._active_param]
            param_text = f"{pname}: {pdesc}" if pdesc else pname
            self._desc_label = ctk.CTkLabel(self, text=param_text,
                                            font=("", self._font_size - 2),
                                            text_color="#858585", anchor="w",
                                            padx=14, pady=(0, 6))
            self._desc_label.pack(fill="x")
        elif signature.description:
            self._desc_label = ctk.CTkLabel(self, text=signature.description,
                                            font=("", self._font_size - 2),
                                            text_color="#858585", anchor="w",
                                            padx=14, pady=(0, 6))
            self._desc_label.pack(fill="x")

        self.update_idletasks()
        width = self.winfo_reqwidth() + 4
        height = self.winfo_reqheight()

        x, y = _clamp_screen(self, x, y, width, height)

        self.geometry(f"{width}x{height}+{x}+{y}")
        self.deiconify()
        self._visible = True

    def hide(self):
        self.withdraw()
        self._visible = False
        self._signature = None

    def is_visible(self) -> bool:
        return self._visible

    def set_active_param(self, idx: int):
        if self._signature and self._visible and 0 <= idx < len(self._signature.params):
            self._active_param = idx
            sig = self._signature
            sig = Signature(sig.name, list(sig.params), idx, sig.description)
            x = self.winfo_x()
            y = self.winfo_y()
            self.show(x, y, sig)

    def next_param(self):
        if self._signature:
            n = len(self._signature.params)
            if n > 0:
                new_idx = (self._active_param + 1) % n
                self.set_active_param(new_idx)

    def prev_param(self):
        if self._signature:
            n = len(self._signature.params)
            if n > 0:
                new_idx = (self._active_param - 1) % n
                self.set_active_param(new_idx)
