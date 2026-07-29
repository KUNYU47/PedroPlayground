/**
 * The code editor pane — Monaco wired up as a mini IDE:
 * live diagnostics (syntax + beginner heuristics), execution-line highlight
 * (debugger style), error gutter markers, run keybindings.
 */
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { monaco, PEDRO_EDITOR_OPTIONS } from './monacoSetup';
import { registerPedroLanguage } from './pedroLanguage';

export interface Diagnostic {
  line: number;
  col: number;
  endLine?: number;
  endCol?: number;
  message: string;
  severity: 'error' | 'warning' | 'hint';
}

export interface EditorPaneHandle {
  getValue(): string;
  setValue(v: string): void;
  setDiagnostics(diags: Diagnostic[]): void;
  setActiveLine(line: number | null): void;
  setNextLine(line: number | null): void;
  setErrorLine(line: number | null): void;
  revealLine(line: number): void;
  focus(): void;
}

interface EditorPaneProps {
  initialValue: string;
  onChange?: (value: string) => void;
  onRun?: () => void;
  onSave?: () => void;
}

let languageRegistered = false;

export const EditorPane = forwardRef<EditorPaneHandle, EditorPaneProps>(function EditorPane(props, ref) {
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const decorationsRef = useRef<monaco.editor.IEditorDecorationsCollection | null>(null);
  const linesRef = useRef<{ active: number | null; next: number | null; error: number | null }>({
    active: null,
    next: null,
    error: null,
  });
  const propsRef = useRef(props);
  propsRef.current = props;

  const applyLineDecorations = () => {
    const deco = decorationsRef.current;
    if (!deco) return;
    const { active, next: nextLine, error } = linesRef.current;
    const next: monaco.editor.IModelDeltaDecoration[] = [];
    if (error != null) {
      next.push({
        range: new monaco.Range(error, 1, error, 1),
        options: {
          isWholeLine: true,
          className: 'pedro-error-line',
          glyphMarginClassName: 'pedro-error-glyph',
          glyphMarginHoverMessage: { value: '💥 The program crashed here' },
        },
      });
    }
    if (active != null) {
      next.push({
        range: new monaco.Range(active, 1, active, 1),
        options: {
          isWholeLine: true,
          className: 'pedro-exec-line',
          glyphMarginClassName: 'pedro-exec-glyph',
          glyphMarginHoverMessage: { value: '▶ Pedro is here' },
        },
      });
    }
    if (nextLine != null && nextLine !== active) {
      next.push({
        range: new monaco.Range(nextLine, 1, nextLine, 1),
        options: {
          isWholeLine: true,
          className: 'pedro-next-line',
          glyphMarginClassName: 'pedro-next-glyph',
          glyphMarginHoverMessage: { value: '➜ This line runs next' },
        },
      });
    }
    deco.set(next);
  };

  useEffect(() => {
    if (!languageRegistered) {
      registerPedroLanguage();
      languageRegistered = true;
    }
    const container = containerRef.current;
    if (!container) return;

    const editor = monaco.editor.create(container, {
      ...PEDRO_EDITOR_OPTIONS,
      value: propsRef.current.initialValue,
    });
    editorRef.current = editor;
    decorationsRef.current = editor.createDecorationsCollection();
    // Exposed for e2e tests and power-user debugging.
    (window as unknown as { __pedroEditor?: unknown }).__pedroEditor = editor;

    editor.onDidChangeModelContent(() => {
      propsRef.current.onChange?.(editor.getValue());
    });

    editor.addAction({
      id: 'pedro.run',
      label: 'Run Program',
      keybindings: [
        monaco.KeyCode.F5,
        monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter,
      ],
      run: () => propsRef.current.onRun?.(),
    });
    editor.addAction({
      id: 'pedro.save',
      label: 'Save Program',
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS],
      run: () => propsRef.current.onSave?.(),
    });

    return () => {
      editor.dispose();
      editorRef.current = null;
      delete (window as unknown as { __pedroEditor?: unknown }).__pedroEditor;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useImperativeHandle(ref, () => ({
    getValue: () => editorRef.current?.getValue() ?? '',
    setValue: (v: string) => {
      const editor = editorRef.current;
      if (editor && editor.getValue() !== v) {
        editor.setValue(v);
      }
    },
    setDiagnostics: (diags: Diagnostic[]) => {
      const model = editorRef.current?.getModel();
      if (!model) return;
      monaco.editor.setModelMarkers(
        model,
        'pedro',
        diags.map((d) => ({
          startLineNumber: Math.max(1, d.line),
          startColumn: Math.max(1, d.col),
          endLineNumber: Math.max(1, d.endLine ?? d.line),
          endColumn: Math.max(1, d.endCol ?? d.col + 1),
          message: d.message,
          severity:
            d.severity === 'error'
              ? monaco.MarkerSeverity.Error
              : d.severity === 'warning'
                ? monaco.MarkerSeverity.Warning
                : monaco.MarkerSeverity.Hint,
        })),
      );
    },
    setActiveLine: (line: number | null) => {
      linesRef.current.active = line;
      applyLineDecorations();
    },
    setNextLine: (line: number | null) => {
      linesRef.current.next = line;
      applyLineDecorations();
    },
    setErrorLine: (line: number | null) => {
      linesRef.current.error = line;
      applyLineDecorations();
      if (line != null) editorRef.current?.revealLineInCenterIfOutsideViewport(line, monaco.editor.ScrollType.Smooth);
    },
    revealLine: (line: number) => {
      editorRef.current?.revealLineInCenterIfOutsideViewport(line, monaco.editor.ScrollType.Smooth);
    },
    focus: () => editorRef.current?.focus(),
  }));

  return <div ref={containerRef} className="editor-container" />;
});
