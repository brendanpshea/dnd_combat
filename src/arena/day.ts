/**
 * The arena's day: two fights, a lunch break between them, and a night after.
 *
 * The arena used to give a full long rest between every single fight, which
 * made each wave an independent tactical problem — deliberately, because it
 * makes the win rate a clean measurement. The cost was that nothing you spent
 * ever mattered past the round it was spent in: a party walked into every fight
 * at full hit points with every slot, so "should I burn this now?" had one
 * answer, always yes.
 *
 * A day is two fights at the SAME wave budget. The afternoon is not a harder
 * wave; it is the same wave against a party that has already spent a morning.
 * That is the whole mechanic, and it is why the wave number does not climb at
 * lunch — depletion is the ramp.
 *
 * WHAT CARRIES, AND WHAT DOES NOT
 *
 *   across lunch    hit points, spell slots, item charges, hit dice spent
 *   across the night  nothing except item cooldowns (see itemRecharge)
 *   across a defeat   XP, gold, purchases — everything but the day itself
 *
 * A defeat ends the day. You come back tomorrow to the same two fights, at the
 * same difficulty, with everything you learned and everything you bought. The
 * fights are frozen at the level you first met them (see `dayLevel` in run.ts),
 * so a party that grinds mornings for XP genuinely out-levels the problem —
 * which is the only reason grinding works at all, since a live-scaled wave
 * would grow with them.
 */
import type { Id } from '../engine/types.js';
import { ITEMS } from '../data/items.js';
import {
  type CampaignState, type RestResult, longRest, shortRest, buildCampaignParty, hitDiceLeft,
} from '../campaign/campaign.js';
import { CLASSES } from '../data/classes.js';
import { rollDie } from '../engine/rng.js';
import { abilityMod } from '../engine/types.js';
import type { ArenaRunState, DayHalf } from './run.js';

/** Which half of the day is next (an old save with no field is a morning). */
export function halfOf(run: ArenaRunState): DayHalf {
  return run.half ?? 'morning';
}

/** The narrative day, 1-based. Advances on a clear AND on a defeat. */
export function dayOf(run: ArenaRunState): number {
  return run.day ?? 1;
}

/**
 * The party level this day's fights are pinned to.
 *
 * Falls back to the live level, which is what a fresh day does before it has
 * been entered — and what every save written before days existed does.
 */
export function dayLevelOf(run: ArenaRunState, liveLevel: number): number {
  return run.dayLevel ?? liveLevel;
}

/**
 * How many cleared days must pass before a spent item comes back.
 *
 * COUNTED IN DAYS *CLEARED*, NOT DAYS ELAPSED, and that distinction is the
 * whole design. A defeat advances the calendar, so an elapsed-day cooldown
 * would mean a player could recharge a conjuration by deliberately throwing the
 * afternoon fight — and at the numbers below, losing on purpose would often be
 * worth more than winning. Clearing a day cannot be farmed.
 *
 * The ladder is set from measured effect, not from flavour. Party win rate at
 * level 5, N=100, one conjuration item added and nothing else changed:
 *
 *   Golden Lion +2    Bronze Griffon +7    Marble Elephant +12    Elemental +20
 *
 * so the cooldowns run 1 / 2 / 3 / 4 days, which over a median five-day run is
 * roughly five lions, two or three griffons, one or two elephants and a single
 * elemental. The SRD's own figurines carry multi-day cooldowns for the same
 * reason (Bronze Griffon five days, Marble Elephant seven) — those literal
 * numbers do not translate, because an SRD adventuring day is six to eight
 * encounters against our two, and a seven-day cooldown would outlast the run.
 */
export function cooldownDays(itemId: Id): number {
  const refills = ITEMS[itemId]?.refills;
  if (refills === 'never') return Infinity;
  if (typeof refills === 'object') return refills.days;
  return 0;   // every night
}

/**
 * Give back what a night restores.
 *
 * Everything on a `refills: 'rest'` clock comes back (that is what a long rest
 * is), and anything with a day cooldown comes back only once enough cleared
 * days have gone by. `itemCooldowns` records the cleared-count at which each
 * spent item is due; absent means nothing is pending.
 */
export function itemRecharge(c: CampaignState, cleared: number): void {
  for (const ch of c.characters) {
    const due = ch.resources?.itemCooldowns;
    if (!due) continue;
    const still: Record<Id, number> = {};
    const charges = { ...(ch.resources?.itemCharges ?? {}) };
    for (const [itemId, readyAt] of Object.entries(due)) {
      if (cleared >= readyAt) delete charges[itemId];   // absent = full
      else still[itemId] = readyAt;
    }
    // Rebuilt rather than spread-over: "absent means full" is the convention
    // every resource here uses, so an emptied map has to actually go away.
    const { itemCharges: _c, itemCooldowns: _d, ...rest } = ch.resources!;
    ch.resources = {
      ...rest,
      ...(Object.keys(charges).length > 0 ? { itemCharges: charges } : {}),
      ...(Object.keys(still).length > 0 ? { itemCooldowns: still } : {}),
    };
  }
}

/**
 * Note that a charged item was spent, so `itemRecharge` knows when it is due.
 *
 * Called at the end of every fight. An item on a zero-day cooldown is not
 * recorded at all — the night gives it back regardless, and a record would just
 * be noise in the save.
 */
export function noteSpentItems(c: CampaignState, cleared: number): void {
  for (const ch of c.characters) {
    const charges = ch.resources?.itemCharges;
    if (!charges) continue;
    const due: Record<Id, number> = { ...(ch.resources?.itemCooldowns ?? {}) };
    let changed = false;
    for (const [itemId, left] of Object.entries(charges)) {
      const days = cooldownDays(itemId);
      if (days <= 0 || left >= (ITEMS[itemId]?.charges ?? 0)) continue;
      // Only start the clock once — a wand fired again tomorrow must not push
      // its own due date further out every time it is used.
      if (due[itemId] === undefined) { due[itemId] = cleared + days; changed = true; }
    }
    if (changed) ch.resources = { ...ch.resources!, itemCooldowns: due };
  }
}

/**
 * Lunch: a short rest between the day's two fights.
 *
 * Anyone who was dropped in the morning is raised FIRST, and it costs a hit
 * die to do it. That ordering is the point: hit dice are the day's only healing
 * and a hero who went down eats the pool the rest of the party wanted, so
 * keeping people upright in the morning is worth something in the afternoon.
 *
 * `shortRest` then tops everyone else up with what is left, spending a die only
 * while the missing hit points are worth more than the die's average — so it
 * never burns a d8 to heal three.
 */
export function lunch(c: CampaignState): RestResult {
  let revived = 0;
  let spent = 0;
  const party = buildCampaignParty(c);
  for (const [index, combatant] of party.entries()) {
    if (combatant.hp > 0) continue;
    const ch = c.characters[index]!;
    const left = hitDiceLeft(c, index);
    if (left <= 0) {
      // Nothing left to spend. They come to the afternoon on their feet but on
      // a single hit point: the arena will not start a fight with an
      // unconscious hero, and a party that cannot raise its casualties is
      // punished quite enough by having to fight around them.
      ch.resources = { ...ch.resources, hp: 1 };
      continue;
    }
    const die = CLASSES[ch.classId]?.hitDie ?? 8;
    const roll = rollDie(c.rng, die);
    c.rng = roll.state;
    const conMod = abilityMod(combatant.abilities.con);
    ch.resources = {
      ...ch.resources,
      hp: Math.min(combatant.maxHp, Math.max(1, roll.value + conMod)),
      hitDice: left - 1,
    };
    revived += 1;
    spent += 1;
  }
  // Then the ordinary top-up, with whatever dice the casualties left behind.
  const rest = shortRest(c);
  return {
    totalHealed: rest.totalHealed,
    hitDiceSpent: (rest.hitDiceSpent ?? 0) + spent,
    revived,
  };
}

/**
 * Night: a long rest, then whatever the calendar gives back.
 *
 * 2024 rules restore ALL spent hit dice on a long rest, not half — see the
 * note on `longRest`. That is what keeps hit dice a *within-day* currency
 * rather than a slow bleed a player cannot see coming.
 */
export function night(c: CampaignState, cleared: number): RestResult {
  const rest = longRest(c);
  itemRecharge(c, cleared);
  return rest;
}
