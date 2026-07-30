/**
 * Grouping for the spell tray's leveled lists.
 *
 * Split out of `SpellTray.tsx` rather than left beside its only caller, for the
 * same reason `token-scale.ts` is split out of `art.ts`: the repo-wide
 * typecheck project has no `--jsx`, so a test cannot import a `.tsx` at all.
 * Logic worth a behavioural test lives in a plain module.
 */
import type { Id } from '../../src/engine/types.js';
import { SPELLS } from '../../src/data/spells.js';

/**
 * The leveled lists run twenty to forty entries long and arrive in whatever
 * order the pool was built in. A caster picks by tier — "what are my 3rd-level
 * options?" — so group them, cheapest first, keeping pool order within a tier.
 * Cantrips need none of this: they are all one tier by definition.
 */
export function byTier(ids: Id[]): [number, Id[]][] {
  const tiers = new Map<number, Id[]>();
  for (const id of ids) {
    const lv = SPELLS[id]?.level ?? 1;
    const bucket = tiers.get(lv);
    if (bucket) bucket.push(id);
    else tiers.set(lv, [id]);
  }
  return [...tiers].sort((a, b) => a[0] - b[0]);
}

/** Tier headings. Index is the spell level, so `0` is the cantrip row. */
export const TIER_NAME = [
  'Cantrips', '1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th',
];
