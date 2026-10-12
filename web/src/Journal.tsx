/**
 * The journal: a slide-in case board of the mission, its open leads, clues, and
 * people met — written by `journal` effects. Doubles as the mobile "what was I
 * doing?" re-entry point. A lead with a `resolvedBy` flag that has fired shows
 * as followed up, so open threads read as progress.
 */
import type { JournalEntry, Requirement } from '../../src/adventure/types.js';

const SECTIONS: Array<{ kind: JournalEntry['kind']; label: string; icon: string }> = [
  { kind: 'quest', label: 'Quests', icon: '⚔️' },
  { kind: 'lead', label: 'Leads', icon: '🧭' },
  { kind: 'clue', label: 'Clues', icon: '🔍' },
  { kind: 'npc', label: 'People', icon: '👤' },
];

export function JournalDrawer(
  { entries, flags, met, onClose }: {
    entries: JournalEntry[];
    flags: Record<string, boolean | number>;
    /** Whether requirements hold now: a quest's stages tick off by these. */
    met?: (reqs: Requirement[]) => boolean;
    onClose(): void;
  },
) {
  const set = (f?: string) => { if (!f) return false; const v = flags[f]; return v === true || (typeof v === 'number' && v > 0); };
  const resolved = (e: JournalEntry) => set(e.resolvedBy);
  const failed = (e: JournalEntry) => set(e.failedBy);
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
          // Leads and quests sort open-first so the next thing to chase is on top.
          const sorted = kind === 'lead' || kind === 'quest'
            ? [...items].sort((a, b) => Number(resolved(a) || failed(a)) - Number(resolved(b) || failed(b)))
            : items;
          return (
            <section key={kind} className="journal-section">
              <h3>{icon} {label}</h3>
              {sorted.map((e) => {
                const done = resolved(e);
                return (
                  <div key={e.id} className={`journal-entry ${done ? 'resolved' : ''}`}>
                    <strong>
                      {(kind === 'lead' || kind === 'quest') && <span className="lead-mark">{done ? '✓' : failed(e) ? '✗' : '•'}</span>}
                      {e.title}
                      {done && <span className="lead-done"> — {kind === 'quest' ? 'done' : 'followed up'}</span>}
                      {failed(e) && !done && <span className="lead-done"> — failed</span>}
                    </strong>
                    <p>{e.body}</p>
                    {/* A quest in hand: its stages, ticked as they come true,
                        and what the party carries for it. */}
                    {e.stages && !done && !failed(e) && (
                      <ul className="quest-stages">
                        {e.stages.map((st, i) => {
                          const ok = met?.(st.done) ?? false;
                          return <li key={i} className={ok ? 'done' : ''}>{ok ? '☑' : '☐'} {st.text}</li>;
                        })}
                      </ul>
                    )}
                    {e.objects && !done && Object.entries(e.objects).some(([f]) => set(f)) && (
                      <p className="quest-carrying">Carrying: {Object.entries(e.objects).filter(([f]) => set(f)).map(([, name]) => name).join(', ')}</p>
                    )}
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
