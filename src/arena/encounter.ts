/**
 * Arena encounter generation: build a fight to an XP budget out of whatever
 * monsters the game currently has.
 *
 * The roster is read from `MONSTERS` rather than a curated list, so a monster
 * added to the game shows up in the arena the same day — the opt-out is
 * `ARENA_EXCLUDED`, not an opt-in. `test/arena.test.ts` holds every monster to
 * having an XP value and a creature type, because a monster missing its XP
 * entry would read as free and the generator would stack six of them into a
 * "budget-appropriate" fight.
 *
 * THE TRAP THIS AVOIDS. Raw XP badly understates how dangerous a group is:
 * five creatures get five turns to the party's four, so the same XP split
 * across more bodies hits far harder. 5e prices that with an encounter
 * multiplier, and this file keeps the two numbers apart — `adjustedXp` is what
 * we budget against, `rawXp` is what we pay out. The hand-authored ladder
 * already learned this the hard way; see the note atop ENCOUNTERS in
 * data/monsters.ts about early fights landing ~2x deadlier than intended.
 */
import type { Id } from '../engine/types.js';
import type { CreatureType } from '../engine/types.js';
import { MONSTERS, MONSTER_XP } from '../data/monsters.js';
import { next, type RngState } from '../engine/rng.js';

/**
 * Monsters that exist in the game but shouldn't turn up as arena opposition.
 *
 * The unicorn is a benign celestial guardian. It was reading as the face of
 * the late game — a third of high-budget fights had one — which is the same
 * category of wrongness as a wolf pack carrying a purse.
 */
export const ARENA_EXCLUDED = new Set<Id>(['unicorn']);

/**
 * 5e's encounter multiplier by headcount. Applied to get the *difficulty* of a
 * group; the party is paid the raw sum.
 */
export function groupMultiplier(count: number): number {
  if (count <= 1) return 1;
  if (count === 2) return 1.5;
  if (count <= 6) return 2;
  if (count <= 10) return 2.5;
  return 3;
}

export function rawXp(members: readonly Id[]): number {
  return members.reduce((sum, id) => sum + (MONSTER_XP[id] ?? 0), 0);
}

/** What the fight actually plays like — raw XP scaled by the group multiplier. */
export function adjustedXp(members: readonly Id[]): number {
  return Math.round(rawXp(members) * groupMultiplier(members.length));
}

export interface GeneratedEncounter {
  members: Id[];
  /** Paid to the party on a win. */
  rawXp: number;
  /** What it was budgeted against (raw x group multiplier). */
  adjustedXp: number;
  /** The one or two creature types fielded. */
  types: CreatureType[];
}

export interface GenerateOptions {
  /** Difficulty budget in *adjusted* XP. */
  budget: number;
  /**
   * Never field more than this many bodies. Six enemies against a party of
   * four is already a long turn cycle to sit through on a phone, and the
   * multiplier means the budget is spent on action economy rather than on
   * anything interesting.
   */
  maxCount?: number;
  /**
   * No single monster may exceed this share of the budget. Action economy does
   * not care about XP: one 1,800-XP monster technically "fits" a budget a
   * party cannot survive, because it concentrates every hit point and attack
   * into a target they cannot chip down in time.
   */
  soloShare?: number;
}

const DEFAULTS = { maxCount: 6, soloShare: 0.75 } as const;

/** Every monster the arena may field, with its XP and type. */
export function arenaRoster(): Array<{ id: Id; xp: number; type: CreatureType }> {
  return Object.values(MONSTERS)
    .filter((m) => !ARENA_EXCLUDED.has(m.id))
    .map((m) => ({ id: m.id, xp: MONSTER_XP[m.id] ?? 0, type: m.creatureType ?? 'humanoid' }))
    .filter((m) => m.xp > 0)
    .sort((a, b) => a.id.localeCompare(b.id));   // deterministic order for seeding
}

function pick<T>(list: T[], state: RngState): { value: T; state: RngState } {
  const r = next(state);
  return { value: list[Math.floor(r.value * list.length)]!, state: r.state };
}

/**
 * Creature types that can actually headline this budget.
 *
 * Elementals, dragons and giants have no member under 450 XP, so at a low
 * budget they can only ever fail to fit — picking types uniformly would have
 * the generator thrash. Construct is a lone animated armor, so it can fill a
 * slot but never carry a fight; it's allowed as the second type only.
 */
function affordableTypes(roster: ReturnType<typeof arenaRoster>, budget: number): CreatureType[] {
  const cheapest = new Map<CreatureType, number>();
  const population = new Map<CreatureType, number>();
  for (const m of roster) {
    cheapest.set(m.type, Math.min(cheapest.get(m.type) ?? Infinity, m.xp));
    population.set(m.type, (population.get(m.type) ?? 0) + 1);
  }
  return [...cheapest.entries()]
    .filter(([t, min]) => min <= budget && (population.get(t) ?? 0) >= 2)
    .map(([t]) => t)
    .sort();
}

/**
 * How many bodies to field. Chosen *before* any monster is picked, because
 * picking greedily by "biggest that still fits" collapses every fight to one
 * or two heavyweights: the first draw eats the budget and the multiplier
 * shrinks what's left. Deciding the shape first is what produces a warband one
 * wave and a lone ogre the next.
 *
 * Weighted toward 2-4: a solo fight has no tactics to it, and past four the
 * turn cycle gets long to sit through on a phone.
 */
function rollCount(
  maxCount: number, budget: number, cheapest: number, dearest: number, state: RngState,
): { value: number; state: RngState } {
  const weights = [0, 12, 28, 28, 18, 9, 5];   // index = headcount
  const options: number[] = [];
  for (let n = 1; n <= maxCount; n++) {
    // Only offer a headcount the budget can actually pay for at that size.
    if (budget / groupMultiplier(n) < cheapest * n) break;
    // A solo only when one monster can genuinely carry the budget. The roster
    // jumps 450 -> 700 -> 1,100 -> 1,800, so at a big budget the best single
    // creature fills less than half of it and the "fight" is a walkover.
    if (n === 1 && dearest < budget * 0.7) continue;
    for (let w = 0; w < (weights[n] ?? 3); w++) options.push(n);
  }
  if (options.length === 0) return { value: 1, state };
  const r = pick(options, state);
  return { value: r.value, state: r.state };
}

/**
 * Build a fight worth roughly `budget` adjusted XP.
 *
 * Shape first (how many), then fill: each slot draws a monster near the
 * per-head share, with one slot allowed to run big so a group can have a
 * leader. The remaining budget is re-divided after every pick, so an expensive
 * draw is paid for by cheaper company rather than by overshooting.
 */
export function generateEncounter(
  opts: GenerateOptions,
  state: RngState,
): { value: GeneratedEncounter; state: RngState } {
  // Some type pools are sparse — every elemental costs at least 450 — so a
  // draw can land well under budget with nothing cheap enough to top up with.
  // Rerolling the type choice fixes that far more simply than special-casing
  // the pools. Best-effort: keep the fullest attempt if none clears the bar.
  let rng = state;
  let best: GeneratedEncounter | undefined;
  for (let attempt = 0; attempt < 6; attempt++) {
    const r = generateOnce(opts, rng);
    rng = r.state;
    if (!best || r.value.adjustedXp > best.adjustedXp) best = r.value;
    if (r.value.adjustedXp >= opts.budget * 0.7) return { value: r.value, state: rng };
  }
  return { value: best!, state: rng };
}

function generateOnce(
  opts: GenerateOptions,
  state: RngState,
): { value: GeneratedEncounter; state: RngState } {
  const maxCount = opts.maxCount ?? DEFAULTS.maxCount;
  const soloShare = opts.soloShare ?? DEFAULTS.soloShare;
  const roster = arenaRoster();
  let rng = state;

  const types = affordableTypes(roster, opts.budget);
  const primaryPick = pick(types, rng); rng = primaryPick.state;
  const chosen: CreatureType[] = [primaryPick.value];

  // A second type most of the time — two flavours reads as a warband rather
  // than a species, and widens the tactical mix (a caster beside a bruiser).
  // Capped at two so a fight never becomes a zoo.
  const wantSecond = next(rng); rng = wantSecond.state;
  if (wantSecond.value < 0.65 && types.length > 1) {
    const others = types.filter((t) => t !== primaryPick.value);
    const secondPick = pick(others, rng); rng = secondPick.state;
    chosen.push(secondPick.value);
  }

  const pool = roster.filter((m) => chosen.includes(m.type));
  const cheapest = Math.min(...pool.map((m) => m.xp));
  const dearest = Math.max(...pool.filter((m) => m.xp <= opts.budget * soloShare).map((m) => m.xp), 0);
  const countRoll = rollCount(maxCount, opts.budget, cheapest, dearest, rng);
  rng = countRoll.state;
  const target = countRoll.value;

  // One slot may run to the full remaining share — that's the leader. The rest
  // are held near the average so the budget stretches to the intended count.
  const leaderRoll = next(rng); rng = leaderRoll.state;
  const leaderSlot = Math.floor(leaderRoll.value * target);

  const members: Id[] = [];
  const rawBudget = opts.budget / groupMultiplier(target);
  for (let slot = 0; slot < target; slot++) {
    const spent = rawXp(members);
    const slotsLeft = target - slot;
    const share = (rawBudget - spent) / slotsLeft;
    const ceiling = slot === leaderSlot
      ? Math.min(rawBudget - spent - cheapest * (slotsLeft - 1), opts.budget * soloShare)
      : share * 1.35;
    const affordable = pool.filter((m) => m.xp <= Math.max(ceiling, cheapest));
    if (affordable.length === 0) break;
    // Draw from what actually spends the slot's share, so a slot doesn't
    // default to the cheapest thing on the shelf every time.
    //
    // The floor is a share of THIS SLOT'S BUDGET, deliberately not a share of
    // the dearest thing that happens to fit. A relative-to-top floor makes a
    // pool's cheap members disappear as soon as an expensive one is added to
    // it: when the dragons gained a 5,900 XP young red, the cut moved from
    // ~550 to ~2,950 and quietly retired every wyrmling from high-budget
    // waves. Adding a monster should never remove a different one.
    const floor = share * 0.5;
    const meaty = affordable.filter((m) => m.xp >= floor);
    const p = pick(meaty.length > 0 ? meaty : affordable, rng);
    rng = p.state;
    members.push(p.value.id);
  }

  // Top up: the roster is coarse (XP jumps 450 -> 700 -> 1,100), so slot-wise
  // division routinely lands well under budget. Add cheap company while there
  // is room at the resulting multiplier, which spends the remainder on bodies
  // instead of leaving the wave a walkover.
  for (let guard = 0; guard < maxCount && members.length < maxCount; guard++) {
    const room = opts.budget / groupMultiplier(members.length + 1) - rawXp(members);
    const fits = pool.filter((m) => m.xp <= room);
    if (fits.length === 0) break;
    // Same rule as the fill loop: measured against the room left, not against
    // the dearest thing that fits in it.
    const best = fits.filter((m) => m.xp >= room * 0.6);
    const p = pick(best.length > 0 ? best : fits, rng); rng = p.state;
    members.push(p.value.id);
  }

  // A budget below the cheapest monster still has to produce a fight.
  if (members.length === 0) {
    const cheap = pool.reduce((a, b) => (b.xp < a.xp ? b : a), pool[0]!);
    members.push(cheap.id);
  }

  const usedTypes = [...new Set(members.map((id) => MONSTERS[id]!.creatureType ?? 'humanoid'))];
  return {
    value: {
      members,
      rawXp: rawXp(members),
      adjustedXp: adjustedXp(members),
      types: usedTypes,
    },
    state: rng,
  };
}
