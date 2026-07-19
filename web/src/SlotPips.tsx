/**
 * Compact spell-slot display: a row of pip-groups, one per slot level, filled
 * left-to-right for slots remaining. Reads straight off a built Combatant's
 * `spellSlots` (campaign play already bakes the persisted remaining count into
 * it — see buildCampaignParty), so battle and shop UIs share one component and
 * never compute slot math themselves.
 */
import type { Combatant } from '../../src/engine/types.js';

const LEVEL_LABEL = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX'];

export function SlotPips({ spellSlots }: { spellSlots: Combatant['spellSlots'] }) {
  const levels = spellSlots
    .map((pool, i) => ({ pool, label: LEVEL_LABEL[i] ?? String(i + 1) }))
    .filter((l) => l.pool.max > 0);
  if (levels.length === 0) return null;
  const tooltip = levels.map((l) => `${l.label}: ${l.pool.current}/${l.pool.max} slots`).join(' · ');
  return (
    <span className="slot-pips" title={tooltip}>
      {levels.map((l) => (
        <span key={l.label} className="slot-pip-group">
          <span className="slot-pip-level">{l.label}</span>
          {Array.from({ length: l.pool.max }, (_, j) => (
            <span key={j} className={`slot-pip${j < l.pool.current ? ' filled' : ''}`} />
          ))}
        </span>
      ))}
    </span>
  );
}
