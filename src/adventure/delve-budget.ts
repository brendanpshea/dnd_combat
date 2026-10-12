/**
 * What a delve's fights cost: the share of the even budget each kind of fight
 * is given, and the most XP a delve's own fights can pay. Apart from the
 * generator (delve-spec.ts), with no imports that lead back into it, so the
 * proofs (outside.ts) can read it while the generator is still loading.
 */
import type { DelveSpec } from './delve-spec.js';
import type { FightRole } from './delve-pieces.js';
import { evenBudgetFor } from '../arena/run.js';
import { MAX_LEVEL } from '../campaign/campaign.js';
import { SIZE_ROOMS } from './dungeon-gen.js';

/**
 * Each fight role's share of the even budget, by party level (see the
 * measurements in delve-spec.ts). Levels past the table use its last entry.
 */
export const SHARES: Record<FightRole, number[]> = {
  room: [0.3],
  elite: [0.45],
  boss: [0.8, 0.65, 0.55, 0.55, 0.6],
};

/** The share of the even budget a fight of this role costs at this level. */
export function shareFor(role: FightRole, level: number): number {
  const t = SHARES[role];
  return t[Math.min(Math.max(1, level), t.length) - 1]!;
}

/**
 * The most XP (a head, for a party of `partySize`) a delve's own fights can
 * pay, whatever its layout: every room but the entrance and the story's own
 * fights to the room budget (and the goal to the boss's, unless the story
 * takes it over), with the generator's ten per cent of slack. What a chapter
 * proved against the delve's outside counts in place of the fights it cannot see.
 */
export function delveFightXpBound(spec: DelveSpec, partySize = 4): number {
  // The spec's own defaults (as checkSpec gives them), unchecked: the delve
  // is checked when it is built.
  const full = { level: spec.level ?? 2, floors: spec.floors ?? 1, rooms: spec.rooms ?? 0, size: spec.size,
    require: spec.require ?? [], shape: spec.shape ?? 'classic', lock: spec.lock, maxFights: spec.maxFights };
  let total = 0;
  for (let f = 1; f <= full.floors; f++) {
    // Each floor is budgeted at the level the floors above can bring (a level a floor, at most).
    const lvl = Math.min(MAX_LEVEL, full.level + f - 1);
    const n = full.rooms || SIZE_ROOMS[full.size ?? 'medium'][1];
    const story = full.require.filter((r) => (r.floor ?? (r.where === 'goal' ? full.floors : 1)) === f && r.event && !r.fight).length;
    const goalTaken = full.require.some((r) => r.where === 'goal' && r.event && (r.floor ?? full.floors) === f);
    // Capped: the filler, and each key's guard (the story holds the first floor's lock, if it has one).
    const keys = (full.shape === 'keys' ? 2 : 1) - (f === 1 && full.lock ? 1 : 0);
    const rooms = full.maxFights !== undefined ? Math.min(n - 1 - story, full.maxFights + keys) : n - 1 - story;
    total += rooms * evenBudgetFor(lvl) * shareFor('room', lvl) * 1.1;
    if (!goalTaken) total += evenBudgetFor(lvl) * shareFor('boss', lvl) * 1.1;
  }
  return Math.ceil(total / partySize);
}

