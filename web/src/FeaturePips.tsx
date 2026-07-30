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
export function FeaturePips(
  { featureUses, labels = 'short' }:
  { featureUses: Combatant['featureUses']; labels?: 'short' | 'full' },
) {
  const pools = restPools(featureUses);
  if (pools.length === 0) return null;
  return (
    <span className="slot-pips feature-pips" title={poolTooltip(pools)}>
      {pools.map((p) => (
        <span key={p.id} className="slot-pip-group">
          {/*
            THE INITIALS ARE FOR THE CAMP, NOT FOR COMBAT.
            `short` exists because the camp screen lists every hero at once, so
            labels collide and space is tight — and `shortLabel` goes to real
            trouble to keep "SeW" and "SaW" apart. It was reused on the combat
            status box, where neither pressure exists: that card shows ONE
            creature, and nothing is next to it to collide with.
            What it bought there was "SeW ●●" on a phone, which is a crossword
            clue, not a label. There is no tooltip on a touch screen to decode
            it with either. So combat asks for the whole name.
          */}
          <span className="slot-pip-level">{labels === 'full' ? p.name : p.short}</span>
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
