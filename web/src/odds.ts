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

/**
 * The odds on a 5e GROUP check: every hero rolls, and the party passes when at
 * least half of them do.
 *
 * This exists because the arena had one group check — creeping past a gate —
 * and was pricing it with `checkOdds` on the single best hero's bonus. The
 * button read "Cedric +6 vs 14" for a check where all four roll, so the number
 * on screen described a different check from the one being made: it took no
 * account of the two paladins in plate who are the actual reason the party gets
 * heard, and it did not move when the party's armour changed.
 *
 * Independent d20s, so the exact answer is a small dynamic program over "how
 * many have passed so far" rather than anything needing simulation.
 */
export function groupPassChance(rollers: readonly GroupRoller[], dc: number): number {
  if (rollers.length === 0) return 0;
  // dist[k] = probability exactly k of the heroes seen so far have passed.
  let dist = [1];
  for (const r of rollers) {
    const p = passChance(r.bonus, dc, r.disadvantage);
    const next = new Array<number>(dist.length + 1).fill(0);
    for (const [k, prob] of dist.entries()) {
      next[k] = (next[k] ?? 0) + prob * (1 - p);
      next[k + 1] = (next[k + 1] ?? 0) + prob * p;
    }
    dist = next;
  }
  // `groupSkillCheck` succeeds when passed * 2 >= party size.
  return dist.reduce((sum, prob, k) => (k * 2 >= rollers.length ? sum + prob : sum), 0);
}

/** One hero in a group check: their bonus, and whether they clank. */
export interface GroupRoller {
  bonus: number;
  /** Heavy armour on a Stealth check — two dice, keep the worse. */
  disadvantage?: boolean;
}

/**
 * One hero's chance to clear a DC on a d20.
 *
 * A natural 1 is not an automatic failure on an ability check (that rule is for
 * attack rolls), so this is plain arithmetic: how many of the twenty faces get
 * there.
 */
export function passChance(bonus: number, dc: number, disadvantage = false): number {
  const faces = 21 + bonus - dc;   // the number of d20 results that clear it
  const p = Math.max(0, Math.min(20, faces)) / 20;
  // Disadvantage is "both dice clear it", which is p squared — the reason a
  // paladin in plate drags a group check down far harder than their -0 bonus
  // suggests, and the reason the button has to know about their armour.
  return disadvantage ? p * p : p;
}

/** How many of the party must pass, which is what the button should say. */
export function groupThreshold(partySize: number): number {
  return Math.ceil(partySize / 2);
}

/**
 * `certain` / `impossible` / `live` for a group check, from the real chance
 * rather than from one hero's bonus.
 */
export function groupOdds(rollers: readonly GroupRoller[], dc: number): CheckOdds {
  const p = groupPassChance(rollers, dc);
  // A hair of tolerance: the DP multiplies its way to 1 and 0 rather than
  // arriving there, so an exactly-certain check can come out 0.9999999999999998
  // and be dressed as a live one.
  if (p >= 1 - 1e-9) return 'certain';
  if (p <= 1e-9) return 'impossible';
  return 'live';
}
