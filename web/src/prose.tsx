/**
 * Module prose rendering. Adventures author with one tiny markup convention —
 * `**Mira**` / `**the Wander-Inn**` — and the UI renders those as accent spans
 * so named NPCs and places stand out from the narration. Deliberately the only
 * markup: keeping it to a single convention keeps modules plain data.
 */
import type { ReactNode } from 'react';

/** Split a paragraph on `**…**` spans; the captured (odd) segments are emphasis. */
export function renderProse(text: string): ReactNode[] {
  return text.split(/\*\*(.+?)\*\*/g).map((seg, i) =>
    i % 2 === 1 ? <em key={i} className="adv-emph">{seg}</em> : <span key={i}>{seg}</span>,
  );
}
