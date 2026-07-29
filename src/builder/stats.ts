/**
 * Ability scores: the point-buy budget underneath the array everyone starts with.
 *
 * WHAT WAS HERE BEFORE
 *
 * A single constant, `[16, 16, 13, 12, 10, 8]`, dealt out in the class's
 * `statPriority` order. It reads like a house rule — 5e's standard array is
 * 15, 14, 13, 12, 10, 8 and has no 16 in it — but it isn't one. It is that
 * array with the 2024 background bonuses already applied: +1 on the 15 and +2
 * on the 14, both landing on 16. Two 16s rather than a 17 and a 15 is simply
 * the other placement, and a common one.
 *
 * That matters because it means nothing has to be rebalanced to open this up.
 * The default build below reproduces the old array exactly, ability for
 * ability, so every existing party is untouched; point-buy is a door onto the
 * same room rather than a new room.
 *
 * THE BUDGET
 *
 * 27 points, scores from 8 to 15, costs rising past 13 — the standard 5e table.
 * 15+14+13+12+10+8 costs exactly 27, which is why that array is the array.
 * The +2/+1 sit on top and may go anywhere (2024 puts them on the background),
 * so the reachable ceiling at first level is 17, not 16.
 */
import type { Ability, AbilityScores } from '../engine/types.js';

/** Display and iteration order. Not the priority order — that is per class. */
export const ABILITIES: readonly Ability[] = ['str', 'dex', 'con', 'int', 'wis', 'cha'];

export const POINT_BUY_MIN = 8;
export const POINT_BUY_MAX = 15;
export const POINT_BUY_BUDGET = 27;

/** The 5e cost table. Note the jump at 14 — the last two points cost double. */
export const POINT_COST: Record<number, number> = {
  8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 7, 15: 9,
};

/** The standard array, before the +2/+1. Spends the budget to the penny. */
export const BASE_ARRAY = [15, 14, 13, 12, 10, 8] as const;

/**
 * A character's ability scores as the player chose them, rather than as a
 * finished set of six numbers.
 *
 * Kept in this form — base scores plus two separately-placed bonuses — because
 * that is what the editor edits and what the rules describe. Flattening it to
 * final scores would make "is this a legal build?" unanswerable, and the
 * campaign save has to be able to answer that about a file a player may have
 * been carrying since before any of this existed.
 */
export interface StatBuild {
  /** Bought with the 27 points; each 8..15. */
  base: AbilityScores;
  plus2: Ability;
  plus1: Ability;
}

export function pointsSpent(base: AbilityScores): number {
  return ABILITIES.reduce((n, ab) => n + (POINT_COST[base[ab]] ?? Infinity), 0);
}

export function pointsRemaining(base: AbilityScores): number {
  return POINT_BUY_BUDGET - pointsSpent(base);
}

/** Can this score be raised by one and still fit the budget? */
export function canRaise(base: AbilityScores, ab: Ability): boolean {
  const next = base[ab] + 1;
  if (next > POINT_BUY_MAX) return false;
  return pointsSpent(base) - (POINT_COST[base[ab]] ?? 0) + (POINT_COST[next] ?? Infinity) <= POINT_BUY_BUDGET;
}

export function canLower(base: AbilityScores, ab: Ability): boolean {
  return base[ab] - 1 >= POINT_BUY_MIN;
}

export function isLegalStatBuild(b: StatBuild | undefined): b is StatBuild {
  if (!b || !b.base || b.plus2 === b.plus1) return false;
  if (!ABILITIES.includes(b.plus2) || !ABILITIES.includes(b.plus1)) return false;
  for (const ab of ABILITIES) {
    const v = b.base[ab];
    if (!Number.isInteger(v) || v < POINT_BUY_MIN || v > POINT_BUY_MAX) return false;
  }
  return pointsSpent(b.base) <= POINT_BUY_BUDGET;
}

/** Base scores plus the two bonuses — the six numbers the engine reads. */
export function resolveStatBuild(b: StatBuild): AbilityScores {
  const out = {} as AbilityScores;
  for (const ab of ABILITIES) out[ab] = b.base[ab];
  out[b.plus2] += 2;
  out[b.plus1] += 1;
  return out;
}

/**
 * The recommended build for a stat priority: the standard array in priority
 * order, with the +1 on the first ability and the +2 on the second.
 *
 * That placement is deliberate and is what makes this backward-compatible —
 * 15+1 and 14+2 are both 16, so the result is the old `[16,16,13,12,10,8]`
 * to the number. Putting the +2 on the primary instead would give 17/15, a
 * different (and slightly worse, at these breakpoints) character.
 */
export function defaultStatBuild(priority: readonly Ability[]): StatBuild {
  const base = {} as AbilityScores;
  priority.forEach((ab, i) => { base[ab] = BASE_ARRAY[i] ?? POINT_BUY_MIN; });
  return { base, plus2: priority[1]!, plus1: priority[0]! };
}
