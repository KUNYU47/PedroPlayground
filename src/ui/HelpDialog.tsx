/**
 * Commands cheatsheet — the legacy app's Help menu, rebuilt as a dialog
 * with kid-friendly cards for every Pedro command.
 */
import { PEDRO_API } from '../editor/pedroLanguage';

interface Props {
  open: boolean;
  onClose: () => void;
}

/** Strip the small markdown dialect used in PEDRO_API docs. */
function plain(md: string): string {
  return md.replace(/\*\*/g, '').replace(/⚠️|💡/g, (m) => m);
}

export function HelpDialog({ open, onClose }: Props) {
  if (!open) return null;
  return (
    <div className="dialog-backdrop" onClick={onClose}>
      <div className="dialog help-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-title">
          <span>❓ Pedro's Commands</span>
          <button className="icon-btn" onClick={onClose} title="Close">✕</button>
        </div>
        <p className="help-intro">
          Every program starts with <code>from pedro import *</code> — then you can use these commands:
        </p>
        <div className="help-grid">
          {PEDRO_API.map((api) => (
            <div className="help-card" key={api.name}>
              <code className="help-sig">{api.signature}</code>
              <p>{plain(api.doc)}</p>
              <pre>{api.example}</pre>
            </div>
          ))}
        </div>
        <p className="help-tip">💡 Tip: there is no <code>turn_right()</code> — three <code>turn_left()</code> calls make a right turn!</p>
      </div>
    </div>
  );
}
