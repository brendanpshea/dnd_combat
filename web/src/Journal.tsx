/**
 * The journal: a slide-in drawer of quests, clues, and NPCs met, written by
 * `journal` effects. Doubles as the mobile "what was I doing?" re-entry point.
 */
import type { JournalEntry } from '../../src/adventure/types.js';

const SECTIONS: Array<{ kind: JournalEntry['kind']; label: string; icon: string }> = [
  { kind: 'quest', label: 'Quests', icon: '⚔️' },
  { kind: 'clue', label: 'Clues', icon: '🔍' },
  { kind: 'npc', label: 'People', icon: '👤' },
];

export function JournalDrawer({ entries, onClose }: { entries: JournalEntry[]; onClose(): void }) {
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
          return (
            <section key={kind} className="journal-section">
              <h3>{icon} {label}</h3>
              {items.map((e) => (
                <div key={e.id} className="journal-entry">
                  <strong>{e.title}</strong>
                  <p>{e.body}</p>
                </div>
              ))}
            </section>
          );
        })}
      </div>
    </div>
  );
}
