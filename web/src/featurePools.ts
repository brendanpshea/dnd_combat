/**
 * Which feature pools are worth showing a player, and how.
 *
 * Split from `FeaturePips.tsx` so it can be tested without a DOM: every web
 * test in this repo is pure logic or source text, and adding jsdom to prove
 * that Lay on Hands renders as a number rather than twenty-five dots would be a
 * lot of machinery for one decision.
 */
import type { Combatant } from '../../src/engine/types.js';
import { FEATURES } from '../../src/data/features.js';

/**
 * Above this many uses, a pool reads as "17/25" instead of a row of pips.
 *
 * Lay on Hands is 5 x level — twenty-five pips at level 5, which is not a meter,
 * it is a wall. It is also spent in variable amounts rather than whole uses, so
 * a number is the truer shape for it anyway.
 */
export const PIP_LIMIT = 6;

export interface FeaturePool {
  id: string;
  name: string;
  /** Initials for the inline label: "Action Surge" -> "AS". */
  short: string;
  per: 'shortRest' | 'longRest';
  current: number;
  max: number;
  /** Pips, or a bare count. */
  style: 'pips' | 'count';
}

/**
 * The pools that outlive a fight, in a stable order.
 *
 * Encounter-scoped pools are deliberately excluded. A monster's Whelm and a
 * species' Heroic Inspiration refill every fight regardless, so showing them on
 * a camp screen would be pips that never move — and a meter that cannot go down
 * teaches a player to ignore the meters that can.
 */
export function restPools(featureUses: Combatant['featureUses']): FeaturePool[] {
  return Object.entries(featureUses)
    .flatMap(([id, pool]) => {
      const f = FEATURES[id];
      const per = f?.uses?.per;
      if (per !== 'shortRest' && per !== 'longRest') return [];
      const name = f?.name ?? id;
      return [{
        id, name, short: shortLabel(id), per,
        current: pool.current, max: pool.max,
        style: pool.max <= PIP_LIMIT ? ('pips' as const) : ('count' as const),
      }];
    })
    // Short-rest tricks first, then the day's budget: the order a player asks
    // the questions in, and stable regardless of how the pools were built.
    .sort((a, b) => (a.per === b.per ? a.name.localeCompare(b.name) : a.per === 'shortRest' ? -1 : 1));
}

/**
 * The short label for a feature: "Channel Divinity: Turn Undead" -> "TU".
 *
 * Two rules, both learned from a render rather than reasoned about.
 *
 * The colon-prefixed family name is dropped: a paladin and a cleric both carry
 * Channel Divinity options, and initialling the whole string would label all
 * three of them "CD".
 *
 * And plain initials COLLIDE. Second Wind and Sacred Weapon are both "SW", and
 * they are not exotic corners — they are the fighter's and the paladin's, and
 * the camp screen lists every hero at once, so both appear side by side. Where
 * two features would share a label, each takes two letters from its first word
 * instead: "SeW" and "SaW". Computed over the whole feature table rather than
 * per character, because which heroes are on screen together is not something
 * this can know.
 */
const SHORT: Record<string, string> = (() => {
  /** `firstLetters` chars of the first word, then one per word after it. */
  const abbreviate = (name: string, firstLetters: number): string => {
    const tail = name.includes(':') ? name.slice(name.indexOf(':') + 1) : name;
    const [head = '', ...rest] = tail.trim().split(/\s+/);
    const stem = head.slice(0, firstLetters);
    return (stem.charAt(0).toUpperCase() + stem.slice(1))
      + rest.map((w) => (w[0] ?? '').toUpperCase()).join('');
  };
  // Only rest-scoped features reach the meter, so only they can clash.
  const ids = Object.keys(FEATURES).filter((id) => {
    const per = FEATURES[id]?.uses?.per;
    return per === 'shortRest' || per === 'longRest';
  });
  const taken = new Map<string, number>();
  for (const id of ids) {
    const k = abbreviate(FEATURES[id]!.name, 1);
    taken.set(k, (taken.get(k) ?? 0) + 1);
  }
  return Object.fromEntries(ids.map((id) => {
    const name = FEATURES[id]!.name;
    const one = abbreviate(name, 1);
    return [id, (taken.get(one) ?? 0) > 1 ? abbreviate(name, 2) : one];
  }));
})();

/** The meter's label for a feature id. */
export function shortLabel(featureId: string): string {
  return SHORT[featureId] ?? featureId.slice(0, 3).toUpperCase();
}

/** One line per pool, for the hover title. */
export function poolTooltip(pools: FeaturePool[]): string {
  return pools
    .map((p) => `${p.name}: ${p.current}/${p.max} (${p.per === 'longRest' ? 'long' : 'short'} rest)`)
    .join(' · ');
}
