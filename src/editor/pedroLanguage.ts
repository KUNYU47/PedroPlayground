/**
 * Pedro language smarts for Monaco: autocompletion with kid-friendly docs,
 * hover help, and signature hints — a mini-IDE experience tuned for the
 * pedro API plus beginner Python.
 */
import { monaco } from './monacoSetup';

interface ApiDoc {
  name: string;
  signature: string;
  doc: string;
  example: string;
  returns?: string;
}

export const PEDRO_API: ApiDoc[] = [
  {
    name: 'move',
    signature: 'move()',
    doc: 'Pedro takes **one step forward** in the direction he is facing.\n\n⚠️ If there is a wall in front of him, your program crashes — check with `front_is_clear()` first!',
    example: 'if front_is_clear():\n    move()',
  },
  {
    name: 'turn_left',
    signature: 'turn_left()',
    doc: 'Pedro **turns 90° to his left**, staying on the same square.\n\n💡 There is no `turn_right()` — three left turns make a right!',
    example: 'turn_left()\nturn_left()\nturn_left()  # now facing right',
  },
  {
    name: 'plant_flag',
    signature: 'plant_flag()',
    doc: 'Pedro **plants a flag** on the square he is standing on. Planting again on the same square makes a bigger pile.',
    example: 'plant_flag()',
  },
  {
    name: 'pick_flag',
    signature: 'pick_flag()',
    doc: 'Pedro **picks up one flag** from the square he is standing on and carries it.\n\n⚠️ Crashes if there is no flag here — check with `flag_present()` first!',
    example: 'if flag_present():\n    pick_flag()',
  },
  {
    name: 'front_is_clear',
    signature: 'front_is_clear()',
    doc: 'Returns `True` if the square **in front of Pedro** has no wall.',
    returns: 'bool',
    example: 'while front_is_clear():\n    move()',
  },
  {
    name: 'flag_present',
    signature: 'flag_present()',
    doc: 'Returns `True` if there is **at least one flag** on Pedro\'s square.',
    returns: 'bool',
    example: 'if flag_present():\n    pick_flag()',
  },
  {
    name: 'facing_north',
    signature: 'facing_north()',
    doc: 'Returns `True` if Pedro is **facing north** (up on the map).',
    returns: 'bool',
    example: 'while not facing_north():\n    turn_left()',
  },
  {
    name: 'facing_east',
    signature: 'facing_east()',
    doc: 'Returns `True` if Pedro is **facing east** (right on the map).',
    returns: 'bool',
    example: 'if facing_east():\n    move()',
  },
];

const KEYWORDS = [
  'and', 'as', 'assert', 'break', 'continue', 'elif', 'else', 'False',
  'for', 'if', 'in', 'is', 'None', 'not', 'or', 'pass', 'return', 'True', 'while',
];

interface Snippet {
  label: string;
  insert: string;
  doc: string;
}

const SNIPPETS: Snippet[] = [
  {
    label: 'from pedro import *',
    insert: 'from pedro import *',
    doc: 'Load Pedro\'s commands. Every program needs this first line!',
  },
  {
    label: 'def main()',
    insert: 'def main():\n\t${1:pass}\n\nif __name__ == \'__main__\':\n\tmain()',
    doc: 'The main function — where your program starts.',
  },
  {
    label: 'for i in range',
    insert: 'for ${1:i} in range(${2:n}):\n\t${3:pass}',
    doc: 'Repeat something a fixed number of times.',
  },
  {
    label: 'while front_is_clear',
    insert: 'while front_is_clear():\n\t${1:move()}',
    doc: 'Keep going until Pedro reaches a wall.',
  },
  {
    label: 'while flag_present',
    insert: 'while flag_present():\n\t${1:pick_flag()}',
    doc: 'Pick up every flag on this square.',
  },
  {
    label: 'if / else',
    insert: 'if ${1:front_is_clear()}:\n\t${2:move()}\nelse:\n\t${3:turn_left()}',
    doc: 'Choose between two actions.',
  },
  {
    label: 'if',
    insert: 'if ${1:condition}:\n\t${2:pass}',
    doc: 'Do something only when a condition is true.',
  },
];

const BUILTIN_FUNCS: ApiDoc[] = [
  {
    name: 'range',
    signature: 'range(stop)  ·  range(start, stop)',
    doc: 'Makes a sequence of numbers, great with `for` loops. `range(4)` → 0, 1, 2, 3.',
    example: 'for i in range(4):\n    move()',
  },
  {
    name: 'print',
    signature: 'print(value, ...)',
    doc: 'Shows a message in the output panel — handy for debugging!',
    example: 'print("Pedro is at the base!")',
  },
];

/** Extract student-defined functions and variables from the document. */
function extractUserSymbols(code: string): Array<{ name: string; kind: 'function' | 'variable'; detail: string }> {
  const symbols: Array<{ name: string; kind: 'function' | 'variable'; detail: string }> = [];
  const seen = new Set<string>();
  const lines = code.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const def = lines[i].match(/^\s*def\s+([A-Za-z_]\w*)\s*\(([^)]*)\)/);
    if (def && !seen.has(def[1])) {
      seen.add(def[1]);
      // Grab the first line of the docstring if there is one.
      const docLine = lines[i + 1]?.match(/^\s*"{3}\s*(.{3,90}?)\s*(?:"{3})?\s*$/);
      const detail = docLine ? docLine[1] : `def ${def[1]}(${def[2]})`;
      symbols.push({ name: def[1], kind: 'function', detail });
      continue;
    }
    const assign = lines[i].match(/^([A-Za-z_]\w*)\s*=[^=]/);
    if (assign && !seen.has(assign[1]) && !['if', 'for', 'while'].includes(assign[1])) {
      seen.add(assign[1]);
      symbols.push({ name: assign[1], kind: 'variable', detail: 'Your variable' });
    }
  }
  return symbols;
}

function pedroMarkdown(api: ApiDoc): monaco.IMarkdownString {
  return {
    value: `\`\`\`python\n${api.signature}\n\`\`\`\n${api.doc}\n\n**Example:**\n\`\`\`python\n${api.example}\n\`\`\``,
    isTrusted: true,
    supportThemeIcons: true,
  };
}

export function registerPedroLanguage(): void {
  monaco.languages.registerCompletionItemProvider('python', {
    triggerCharacters: ['_', '('],
    provideCompletionItems(model, position) {
      const word = model.getWordUntilPosition(position);
      const range = new monaco.Range(
        position.lineNumber, word.startColumn,
        position.lineNumber, word.endColumn,
      );
      const suggestions: monaco.languages.CompletionItem[] = [];
      // Dedupe: each function/variable name may appear at most once.
      const seenLabels = new Set<string>();
      const push = (item: monaco.languages.CompletionItem) => {
        const key = typeof item.label === 'string' ? item.label : item.label.label;
        if (seenLabels.has(key)) return;
        seenLabels.add(key);
        suggestions.push(item);
      };

      // Student's own functions & variables first — they matter most.
      for (const sym of extractUserSymbols(model.getValue())) {
        push({
          label: { label: sym.name, description: 'yours ✨' },
          kind: sym.kind === 'function'
            ? monaco.languages.CompletionItemKind.Method
            : monaco.languages.CompletionItemKind.Variable,
          insertText: sym.kind === 'function' ? `${sym.name}()` : sym.name,
          range,
          detail: sym.detail,
          sortText: '0' + sym.name,
        });
      }

      for (const api of [...PEDRO_API, ...BUILTIN_FUNCS]) {
        push({
          label: { label: api.name, description: 'pedro' },
          kind: monaco.languages.CompletionItemKind.Function,
          insertText: `${api.name}()`,
          range,
          detail: api.signature,
          documentation: pedroMarkdown(api),
          sortText: '1' + api.name,
        });
      }
      for (const snip of SNIPPETS) {
        push({
          label: snip.label,
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: snip.insert,
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          range,
          documentation: { value: snip.doc },
          sortText: '2' + snip.label,
        });
      }
      for (const kw of KEYWORDS) {
        push({
          label: kw,
          kind: monaco.languages.CompletionItemKind.Keyword,
          insertText: kw,
          range,
          sortText: '3' + kw,
        });
      }
      return { suggestions };
    },
  });

  monaco.languages.registerHoverProvider('python', {
    provideHover(model: monaco.editor.ITextModel, position: monaco.Position) {
      const word = model.getWordAtPosition(position);
      if (!word) return null;
      const api = [...PEDRO_API, ...BUILTIN_FUNCS].find((a) => a.name === word.word);
      if (!api) return null;
      return {
        range: new monaco.Range(position.lineNumber, word.startColumn, position.lineNumber, word.endColumn),
        contents: [pedroMarkdown(api)],
      };
    },
  });

  monaco.languages.registerSignatureHelpProvider('python', {
    signatureHelpTriggerCharacters: ['(', ','],
    provideSignatureHelp(model: monaco.editor.ITextModel, position: monaco.Position) {
      // Find the function name before the open paren.
      const text = model.getLineContent(position.lineNumber).slice(0, position.column - 1);
      const m = text.match(/([A-Za-z_][A-Za-z0-9_]*)\s*\([^()]*$/);
      if (!m) return null;
      const api = [...PEDRO_API, ...BUILTIN_FUNCS].find((a) => a.name === m[1]);
      if (!api) return null;
      return {
        value: {
          signatures: [{
            label: api.signature,
            documentation: { value: api.doc },
            parameters: [],
          }],
          activeSignature: 0,
          activeParameter: 0,
        },
        dispose: () => {},
      };
    },
  });
}
