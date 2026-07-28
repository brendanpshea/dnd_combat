import type { Combatant } from '../../src/engine/types.js';
import { restPools, poolTooltip } from './featurePools.js';

/**
 * What a hero has left in the pools that outlive a fight.
 *
 * The sibling of `SlotPips`, and it exists for the same reason: feature pools
 * used to refill at the start of every fight, so there was nothing to show. Now
 * that Action Surge stays spent until lunch and Lay on Hands until the night, a
 * pool that is empty is a fact the player has to see BEFORE walking into the
 * next wave — otherwise the first they learn of it is a button that silently
 * isn't there any more.
 *
 * Which pools, and pips-versus-number, live in `featurePools.ts`.
 */
export function FeaturePips({ featureUses }: { featureUses: Combatant['featureUses'] }) {
  const pools = restPools(featureUses);
  if (pools.length === 0) return null;
  return (
    <span className="slot-pips feature-pips" title={poolTooltip(pools)}>
      {pools.map((p) => (
        <span key={p.id} className="slot-pip-group">
          {/* The feature's initials, so a row of pools is readable without the
              tooltip: "AS" next to one pip is Action Surge, spent. */}
          <span className="slot-pip-level">{p.short}</span>
          {p.style === 'pips' ? (
            Array.from({ length: p.max }, (_, j) => (
              <span key={j} className={`slot-pip${j < p.current ? ' filled' : ''}`} />
            ))
          ) : (
            <span className="pip-count">{p.current}/{p.max}</span>
          )}
        </span>
      ))}
    </span>
  );
}
