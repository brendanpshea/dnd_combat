/**
 * The journal: a slide-in case board of the mission, its open leads, clues, and
 * people met — written by `journal` effects. Doubles as the mobile "what was I
 * doing?" re-entry point. A lead with a `resolvedBy` flag that has fired shows
 * as followed up, so open threads read as progress.
 */
import type { JournalEntry } from '../../src/adventure/types.js';

const SECTIONS: Array<{ kind: JournalEntry['kind']; label: string; icon: string }> = [
  { kind: 'quest', label: 'Quest', icon: '⚔️' },
  { kind: 'lead', label: 'Leads', icon: '🧭' },
  { kind: 'clue', label: 'Clues', icon: '🔍' },
  { kind: 'npc', label: 'People', icon: '👤' },
];

export function JournalDrawer(
  { entries, flags, onClose }: {
    entries: JournalEntry[];
    flags: Record<string, boolean | number>;
    onClose(): void;
  },
) {
  const resolved = (e: JournalEntry) => {
    if (!e.resolvedBy) return false;
    const v = flags[e.resolvedBy];
    return v === true || (typeof v === 'number' && v > 0);
  };
  return (
    <div className="journal-scrim" onClick={onClose}>
      <div className="journal" onClick={(e) => e.stopPropagation()}>
        <div className="journal-head">
          <h2>📖 Journal</h2>
          <button className="ghost" onClick={onClose}>✕</button>
        </div>
        {entries.length === 0 && <p className="adv-text">Nothing noted yet. Your deeds will fill these pages.</p>}
        {SECTIONS.map(({ kind, label, icon }) => {
          const items = entries.filter((e) => e.kind === kind);
          if (items.length === 0) return null;
          // Leads sort open-first so the next thing to chase is on top.
          const sorted = kind === 'lead'
            ? [...items].sort((a, b) => Number(resolved(a)) - Number(resolved(b)))
            : items;
          return (
            <section key={kind} className="journal-section">
              <h3>{icon} {label}</h3>
              {sorted.map((e) => {
                const done = resolved(e);
                return (
                  <div key={e.id} className={`journal-entry ${done ? 'resolved' : ''}`}>
                    <strong>
                      {kind === 'lead' && <span className="lead-mark">{done ? '✓' : '•'}</span>}
                      {e.title}
                      {done && <span className="lead-done"> — followed up</span>}
                    </strong>
                    <p>{e.body}</p>
                  </div>
                );
              })}
            </section>
          );
        })}
      </div>
    </div>
  );
}
