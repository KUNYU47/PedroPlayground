/**
 * Translates structured Python errors into kid-friendly messages.
 * (Port of the legacy _friendly_error, upgraded to work on structured error
 * objects instead of regex-scraping stderr.)
 */
import type { RunError } from '../engine/types';

export function friendlyError(err: RunError): string {
  const prefix = err.line != null ? `Line ${err.line}: ` : '';

  switch (err.kind) {
    case 'PedroError': {
      if (err.message.includes('cannot move'))
        return `${prefix}Pedro walked into a wall! Use front_is_clear() to check before move().`;
      if (err.message.includes('cannot pick flag'))
        return `${prefix}No flag here to pick up. Use flag_present() to check first.`;
      if (err.message.includes('too many steps'))
        return `${prefix}Pedro walked way too long — is there an infinite loop? Check your while conditions.`;
      return `${prefix}Pedro ran into a problem. Check your conditions.`;
    }
    case 'NameError': {
      const m = err.message.match(/name '([^']+)' is not defined/);
      if (m) {
        const suggestion = suggestName(m[1]);
        return `${prefix}'${m[1]}' is not defined. Check your spelling.${suggestion}`;
      }
      return `${prefix}Name not found. Check your spelling.`;
    }
    case 'SyntaxError':
      return `${prefix}Syntax error (${err.message}). Check colons, parentheses, and spelling.`;
    case 'IndentationError':
    case 'TabError':
      return `${prefix}Indentation error. Make sure your code lines up correctly — Python is picky about spaces!`;
    case 'IndexError':
      return `${prefix}Index out of range. Check your list or range values.`;
    case 'TypeError':
      return `${prefix}${shorten(err.message)}`;
    case 'ZeroDivisionError':
      return `${prefix}You divided by zero — even astronauts can't do that!`;
    case 'RecursionError':
      return `${prefix}Your function called itself too many times (infinite recursion?).`;
    default: {
      if (!err.message) return `${prefix}An error occurred. Check your code and try again.`;
      return `${prefix}${err.kind}: ${shorten(err.message)}`;
    }
  }
}

const KNOWN_NAMES = [
  'move', 'turn_left', 'plant_flag', 'pick_flag',
  'front_is_clear', 'flag_present', 'facing_north', 'facing_east',
  'main', 'while', 'for', 'if', 'def', 'range', 'print',
];

function suggestName(name: string): string {
  let best: string | null = null;
  let bestDist = 3; // only suggest when reasonably close
  for (const known of KNOWN_NAMES) {
    const d = levenshtein(name.toLowerCase(), known);
    if (d < bestDist) {
      bestDist = d;
      best = known;
    }
  }
  return best ? ` Did you mean ${best}()?` : '';
}

function levenshtein(a: string, b: string): number {
  const dp: number[] = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = dp[j];
      dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return dp[b.length];
}

function shorten(msg: string): string {
  return msg.length > 140 ? msg.slice(0, 137) + '...' : msg;
}
