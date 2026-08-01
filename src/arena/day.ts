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

/**
 * What a rest gave back, per hero, as a before-and-after.
 *
 * `RestResult` reports the party TOTAL — "+12 HP, 2 hit dice" — which is the
 * right shape for a log line and the wrong one for a screen. A player watching
 * a rest wants to see whose bar moved, and a number that only ever goes up
 * cannot show that a lunch SPENDS something to do it.
 *
 * So this is a snapshot pair rather than a summary. Take one before the rest,
 * one after, and the difference is the whole cut scene: bars that fill, hit-dice
 * pips that grey out, slot pips that relight. It lives here rather than in the
 * web app because it is a fact about the day, and because a headless test can
 * then assert that a lunch debits and a night does not.
 */
export interface HeroRest {
  name: string;
  hp: { from: number; to: number; max: number };
  hitDice: { from: number; to: number; max: number };
  /** Remaining slots per level, index 0 = 1st. Empty for a non-caster. */
  slots: { from: number[]; to: number[] };
}

export interface RestSnapshot {
  name: string;
  hp: number;
  maxHp: number;
  hitDice: number;
  maxHitDice: number;
  slots: number[];
}

/** The party's resources right now, for one side of a `restLedger`. */
export function snapshotRest(c: CampaignState): RestSnapshot[] {
  return buildCampaignParty(c).map((combatant, index) => ({
    name: combatant.name,
    hp: combatant.hp,
    maxHp: combatant.maxHp,
    hitDice: hitDiceLeft(c, index),
    // A hit-dice pool is the character's level, which is what `longRest`
    // restores it to.
    maxHitDice: combatant.level,
    slots: combatant.spellSlots.map((s) => s.current),
  }));
}

/** Pair two snapshots into the per-hero rows a rest screen draws. */
export function restLedger(before: RestSnapshot[], after: RestSnapshot[]): HeroRest[] {
  return before.map((b, i) => {
    const a = after[i] ?? b;
    return {
      name: b.name,
      hp: { from: b.hp, to: a.hp, max: a.maxHp },
      hitDice: { from: b.hitDice, to: a.hitDice, max: a.maxHitDice },
      slots: { from: b.slots, to: a.slots },
    };
  });
}

/**
 * One line, chosen by what actually happened.
 *
 * A line the player reads ten times a run has to be worth reading the tenth
 * time, which rules out decoration: every branch here reports something true
 * about the rest that just resolved — who got up, what it cost, who has nothing
 * left to spend. The generic line is last and deliberately plain.
 *
 * Not the chorus. That is capped at one line per day and fires once per run per
 * subject, because it exists to explain the arena's premise; a beat this
 * frequent needs lines that may repeat, and would otherwise blow that budget or
 * sit silent most of the time.
 */
export function restLine(kind: DayHalf | 'night', rows: HeroRest[], rest: RestResult): string {
  const spent = rest.hitDiceSpent ?? 0;
  const recovered = rest.recovered ?? [];
  if (kind === 'night') {
    const hurt = rows.filter((r) => r.hp.from < r.hp.max).length;
    if (hurt >= 3) return 'A hard day. Sleep takes all of it back — the fights do not care.';
    if (hurt === 0) return 'Nobody needed the night. Tomorrow will ask again.';
    return 'Morning. Every slot, every die, every hit point — back where it started.';
  }
  if ((rest.revived ?? 0) > 0) {
    const name = rows.find((r) => r.hp.from === 0)?.name;
    return `${name ?? 'Somebody'} is back on their feet. The afternoon does not wait.`;
  }
  const dry = rows.filter((r) => r.hitDice.to === 0 && r.hitDice.from > 0);
  if (dry.length > 0) return `${dry[0]!.name} has no dice left. What is left is what you fight with.`;
  if (recovered.length > 0) {
    return `${recovered[0]!.name} closes the book and finds something still in it.`;
  }
  if (spent === 0) return 'Bread, water, and nothing worth spending a die on.';
  return `${spent} ${spent === 1 ? 'die' : 'dice'} spent. That is the day's healing, and there is no more.`;
}
