/**
 * Whether a d20 check is actually in doubt.
 *
 * A +12 against DC 13 cannot fail and a −1 against DC 20 cannot succeed. In
 * both cases a tumbling die is theatre, and theatre that pretends a foregone
 * conclusion was in question is worse than no animation: it teaches the player
 * that the numbers on the button do not mean anything.
 *
 * Plain TypeScript rather than part of the component, so it can be tested
 * without a DOM — the rule is arithmetic about a d20, not a rendering concern.
 */
export type CheckOdds = 'certain' | 'impossible' | 'live';

export function checkOdds(bonus: number, dc: number): CheckOdds {
  if (bonus + 1 >= dc) return 'certain';       // even a natural 1 clears it
  if (bonus + 20 < dc) return 'impossible';    // even a natural 20 does not
  return 'live';
}
