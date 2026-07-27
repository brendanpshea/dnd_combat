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
 * data/encounters.ts about early fights landing ~2x deadlier than intended.
 */
import type { Id } from '../engine/types.js';
import type { CreatureType } from '../engine/types.js';
import { MONSTERS, MONSTER_XP, canThreatenAtRange } from '../data/monsters.js';
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
  /**
   * No member may cost more than this, whatever the budget allows.
   *
   * The budget guards the fight; this guards the *hit*. A share-of-budget cap
   * says nothing about whether one attack deletes a character, and at level 1
   * the squishiest hero has 7 HP while 85 of the 132 monsters average that or
   * more on a single hit. A CR 3 giant scorpion averages 24 across three
   * attacks — it can end a hero a round, and paired with something cheap it
   * fits a wave-6 budget honestly. Winnable in simulation and miserable to
   * play, because nothing the player does changes it.
   */
  maxMemberXp?: number;
  /**
   * The party's level, for monsters that declare a `minPartyLevel`. Separate
   * from the XP cap because the thing being guarded against is an ability, not
   * a damage number: a 200 XP harpy is cheap and still deletes a level-1
   * party. Omitted means no floor applies.
   */
  partyLevel?: number;
  /**
   * Field only these creature types, ignoring any that cannot afford a member
   * at this budget.
   *
   * Not used by the shipping generator — a wave picks its own types. It exists
   * because creature type is the widest difficulty variable in the game and the
   * only way to measure that is to hold it fixed: the 4%-to-79% table in
   * arena/gates.ts and the bane-weapon measurements in data/weapons.ts were
   * both taken through this option, and neither is reproducible without it.
   */
  forceTypes?: CreatureType[];
}

const DEFAULTS = { maxCount: 6, soloShare: 0.75 } as const;

/** One monster the arena may field. */
interface RosterEntry { id: Id; xp: number; type: CreatureType }

/** Every monster the arena may field, with its XP and type. */
export function arenaRoster(partyLevel?: number): RosterEntry[] {
  return Object.values(MONSTERS)
    .filter((m) => !ARENA_EXCLUDED.has(m.id))
    .filter((m) => partyLevel === undefined || (m.minPartyLevel ?? 1) <= partyLevel)
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
 * the generator thrash.
 *
 * The bar is the *solo cap*, not the whole budget. A type whose cheapest
 * member costs more than one monster is allowed to cost can't legally field
 * anything here: rollCount finds no headcount it can pay for, falls back to
 * one body, and the "always leave something affordable" floor then waves that
 * single over-cap monster through. Aberrations (cheapest 1,800) hit this the
 * moment they were added. Excluding the type up front is the fix — the reroll
 * wrapper just picks another one.
 */
function affordableTypes(
  roster: ReturnType<typeof arenaRoster>, budget: number, soloShare: number,
): CreatureType[] {
  const cheapest = new Map<CreatureType, number>();
  const population = new Map<CreatureType, number>();
  for (const m of roster) {
    cheapest.set(m.type, Math.min(cheapest.get(m.type) ?? Infinity, m.xp));
    population.set(m.type, (population.get(m.type) ?? 0) + 1);
  }
  return [...cheapest.entries()]
    .filter(([t, min]) => min <= budget * soloShare && (population.get(t) ?? 0) >= 2)
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
 * Make sure at least one member of the wave can hurt the party where it stands.
 *
 * Type choice is what makes this necessary: pick 'beast' and 'ooze' and every
 * slot draws from creatures that have to walk the length of the board to do
 * anything. Two thirds of the bestiary is melee-only, so a wave with no ranged
 * presence is common rather than rare — and against one, holding the back rank
 * is not a tactic, it is the whole fight. Measured at level 1 over 40 seeds: a
 * party that never took a step beat melee-only encounters as often as a party
 * played properly, and lost 20 points of win rate against bandits with
 * crossbows.
 *
 * Swaps rather than adds, and only for a monster of the same XP or less, so
 * the wave's budget and headcount are untouched — this changes what the fight
 * asks of you, not how hard it is. If nothing in the pool can shoot (an all-
 * ooze wave), it leaves the encounter alone rather than dragging in a creature
 * from a type that was never chosen.
 */
function ensureRangedPresence(
  members: Id[], pool: RosterEntry[], roster: RosterEntry[], state: RngState,
): { members: Id[]; state: RngState } {
  if (members.some(canThreatenAtRange)) return { members, state };
  // Replace the cheapest member: the leader slot is the wave's character, and
  // swapping it out would flatten the variety the generator works to create.
  let worstIdx = 0;
  for (let i = 1; i < members.length; i++) {
    if ((MONSTER_XP[members[i]!] ?? 0) < (MONSTER_XP[members[worstIdx]!] ?? 0)) worstIdx = i;
  }
  const ceiling = MONSTER_XP[members[worstIdx]!] ?? 0;
  const affordable = (list: RosterEntry[]) =>
    list.filter((m) => m.xp <= ceiling && canThreatenAtRange(m.id));
  // Prefer a shooter of a type already in the warband, so the wave still reads
  // as one or two flavours. But whole types — constructs, oozes, most beasts —
  // have no ranged member at any price, and those were a third of all waves.
  // Rather than leave them alone (which is what the first cut did, and it left
  // 33% of waves unable to punish standing still), widen to the roster: one
  // creature from a third type is a smaller cost than a fight with no reach in
  // it at all.
  const shooters = affordable(pool).length > 0 ? affordable(pool) : affordable(roster);
  if (shooters.length === 0) return { members, state };
  const p = pick(shooters, state);
  const next = [...members];
  next[worstIdx] = p.value.id;
  return { members: next, state: p.state };
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
  const cap = opts.maxMemberXp ?? Infinity;
  // Filter first, so type choice, headcount and every slot all see the same
  // pool — a type whose cheapest member is over the cap must not be offered.
  const roster = arenaRoster(opts.partyLevel).filter((m) => m.xp <= cap);
  let rng = state;

  const all = affordableTypes(roster, opts.budget, soloShare);
  const forced = opts.forceTypes?.filter((t) => all.includes(t)) ?? [];
  const types = forced.length > 0 ? forced : all;
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

  const withReach = ensureRangedPresence(members, pool, roster, rng);
  members.splice(0, members.length, ...withReach.members);
  rng = withReach.state;

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
