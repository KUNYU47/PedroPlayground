/**
 * Beginner-oriented static checks that catch the most common kid mistakes
 * instantly (no Python round-trip needed). Produces Monaco diagnostics.
 */
import type { Diagnostic } from './EditorPane';

const PEDRO_FUNCS = [
  'move', 'turn_left', 'plant_flag', 'pick_flag',
  'front_is_clear', 'flag_present', 'facing_north', 'facing_east',
];

export function heuristicDiagnostics(code: string): Diagnostic[] {
  const diags: Diagnostic[] = [];
  const lines = code.split('\n');
  const usesPedro = new RegExp(`\\b(${PEDRO_FUNCS.join('|')})\\b`).test(code);
  const hasImport = /from\s+pedro\s+import\s+\*/.test(code);
  // Many scaffolds teach kids to DEFINE turn_right themselves — only flag
  // calls when no such definition exists.
  const definesTurnRight = /def\s+turn_right\s*\(/.test(code);

  lines.forEach((line, i) => {
    const lineNo = i + 1;

    // Bare pedro call without parentheses: "move" on its own line.
    const bare = line.match(new RegExp(`^(\\s*)(${PEDRO_FUNCS.join('|')})\\s*(#.*)?$`));
    if (bare) {
      diags.push({
        line: lineNo,
        col: bare[1].length + 1,
        endCol: bare[1].length + 1 + bare[2].length,
        message: `Did you mean ${bare[2]}()? Function calls need parentheses.`,
        severity: 'warning',
      });
    }

    // turn_right doesn't exist — classic mistake (unless self-defined).
    const tr = !definesTurnRight && line.match(/\bturn_right\s*\(/);
    if (tr) {
      diags.push({
        line: lineNo,
        col: (tr.index ?? 0) + 1,
        endCol: (tr.index ?? 0) + 1 + 'turn_right'.length,
        message: 'There is no turn_right() — three turn_left() calls make a right turn!',
        severity: 'error',
      });
    }

    // Condition used without calling it: "if front_is_clear:"
    const condBare = line.match(new RegExp(`\\b(if|while)(\\s+not)?\\s+(${PEDRO_FUNCS.join('|')})\\s*:`));
    if (condBare) {
      diags.push({
        line: lineNo,
        col: (condBare.index ?? 0) + 1,
        endCol: line.length + 1,
        message: `Did you mean ${condBare[3]}()? Conditions need parentheses too.`,
        severity: 'warning',
      });
    }

    // Missing colon after if/while/for/def/else.
    const kw = line.match(/^\s*(if|elif|else|while|for|def|try|except|finally)\b[^:#]*$/);
    if (kw && !line.trim().endsWith(':') && !line.trim().endsWith('\\')) {
      diags.push({
        line: lineNo,
        col: line.length,
        endCol: line.length + 1,
        message: `This ${kw[1]} statement probably needs a colon (:) at the end.`,
        severity: 'warning',
      });
    }
  });

  if (usesPedro && !hasImport) {
    diags.push({
      line: 1,
      col: 1,
      endCol: 2,
      message: "Add 'from pedro import *' at the top to unlock Pedro's commands.",
      severity: 'hint',
    });
  }

  return diags;
}
