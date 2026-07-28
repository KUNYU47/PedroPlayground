/**
 * Monaco bootstrap: lean editor.api build (no unused languages), Python
 * syntax support, a custom "Pedro Dark" theme matching the space UI, and
 * kid-friendly editor defaults with modern IDE affordances (sticky scroll,
 * bracket colorization, smooth caret, inline suggestions UI).
 */
import 'monaco-editor/esm/vs/editor/editor.all'; // side effects: all editor features (suggest, hover, sticky scroll…)
import * as monaco from 'monaco-editor/esm/vs/editor/editor.api';
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';
import 'monaco-editor/esm/vs/basic-languages/python/python.contribution';

self.MonacoEnvironment = {
  getWorker: () => new editorWorker(),
};

monaco.editor.defineTheme('pedro-dark', {
  base: 'vs-dark',
  inherit: true,
  rules: [
    { token: 'keyword.python', foreground: 'c792ea', fontStyle: 'bold' },
    { token: 'string.python', foreground: 'a5d6a7' },
    { token: 'number.python', foreground: 'f78c6c' },
    { token: 'comment.python', foreground: '697098', fontStyle: 'italic' },
    { token: 'identifier.python', foreground: 'd9e2ff' },
    { token: 'delimiter.parenthesis.python', foreground: '89ddff' },
  ],
  colors: {
    'editor.background': '#0f1428',
    'editor.foreground': '#d9e2ff',
    'editor.lineHighlightBackground': '#1a214040',
    'editorLineNumber.foreground': '#4c5680',
    'editorLineNumber.activeForeground': '#8fa3e8',
    'editorCursor.foreground': '#7dd3fc',
    'editor.selectionBackground': '#3b4a8a55',
    'editor.inactiveSelectionBackground': '#3b4a8a33',
    'editorIndentGuide.background1': '#232b4d',
    'editorIndentGuide.activeBackground1': '#3d4a80',
    'editorBracketMatch.background': '#7dd3fc22',
    'editorBracketMatch.border': '#7dd3fc66',
    'editorSuggestWidget.background': '#161c38',
    'editorSuggestWidget.border': '#2c3766',
    'editorSuggestWidget.selectedBackground': '#2c3766',
    'editorHoverWidget.background': '#161c38',
    'editorHoverWidget.border': '#2c3766',
    'editorWidget.background': '#161c38',
    'editorGutter.background': '#0f1428',
    'editorStickyScroll.background': '#131a36',
    'editorError.foreground': '#ff6b81',
    'editorWarning.foreground': '#facc15',
    'scrollbarSlider.background': '#2c376655',
    'scrollbarSlider.hoverBackground': '#3d4a8088',
  },
});

export const PEDRO_EDITOR_OPTIONS: monaco.editor.IStandaloneEditorConstructionOptions = {
  theme: 'pedro-dark',
  language: 'python',
  fontSize: 15,
  fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', Menlo, Consolas, monospace",
  fontLigatures: true,
  lineHeight: 24,
  padding: { top: 14, bottom: 14 },
  minimap: { enabled: false },
  lineNumbers: 'on',
  glyphMargin: true, // gutter arrows: current line ▶ + next line ➜
  folding: true,
  foldingHighlight: true,
  showFoldingControls: 'mouseover',
  bracketPairColorization: { enabled: true },
  guides: { bracketPairs: true, indentation: true, highlightActiveIndentation: true },
  stickyScroll: { enabled: true, maxLineCount: 4 },
  smoothScrolling: true,
  cursorSmoothCaretAnimation: 'on',
  cursorBlinking: 'phase',
  cursorWidth: 3,
  roundedSelection: true,
  automaticLayout: true,
  tabSize: 4,
  insertSpaces: true,
  detectIndentation: false,
  autoIndent: 'full',
  quickSuggestions: { other: true, comments: false, strings: false },
  suggestOnTriggerCharacters: true,
  wordBasedSuggestions: 'off',
  parameterHints: { enabled: true, cycle: true },
  hover: { enabled: true, delay: 200 },
  renderLineHighlight: 'all',
  renderWhitespace: 'none',
  scrollBeyondLastLine: false,
  overviewRulerBorder: false,
  hideCursorInOverviewRuler: true,
  fixedOverflowWidgets: true,
  suggest: {
    snippetsPreventQuickSuggestions: false,
    showIcons: true,
    preview: true,
  },
  acceptSuggestionOnEnter: 'on',
  tabCompletion: 'on',
  matchBrackets: 'always',
  colorDecorators: false,
  contextmenu: true,
  mouseWheelZoom: true,
  // No quick-fix lightbulb — diagnostics are explained in kid language instead.
  lightbulb: { enabled: monaco.editor.ShowLightbulbIconMode.Off },
};

export { monaco };
