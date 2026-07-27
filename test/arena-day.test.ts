import { describe, it, expect } from 'vitest';
import {
  newArenaRun, advanceDay, buildWave, type ArenaRunState,
} from '../src/arena/run.js';
import { gatesFor } from '../src/arena/gates.js';
import {
  halfOf, dayOf, dayLevelOf, lunch, night, noteSpentItems, itemRecharge, cooldownDays,
} from '../src/arena/day.js';
import {
  newCampaign, buildCampaignParty, hitDiceLeft, hitDiceMax, longRest, readBackSurvivors,
} from '../src/campaign/campaign.js';
import { ITEMS } from '../src/data/items.js';
import type { Id } from '../src/engine/types.js';

/**
 * The arena's day: two fights, a lunch break, a night.
 *
 * The arena used to long-rest between every fight, so nothing you spent ever
 * mattered past the round you spent it in. What these tests defend is the
 * shape of the new clock — what crosses lunch, what crosses the night, and what
 * a defeat does and does not take away from you.
 */

const cleared = (run: ArenaRunState) => run.cleared;

describe('the shape of a day', () => {
  it('runs morning then afternoon at the same wave', () => {
    let run = newArenaRun(1);
    expect(halfOf(run)).toBe('morning');
    expect(run.wave).toBe(1);

    run = advanceDay(run, true, 100);
    expect(halfOf(run), 'a won morning leads to the afternoon').toBe('afternoon');
    expect(run.wave, 'and the afternoon is the SAME wave').toBe(1);
    expect(cleared(run), 'nothing is cleared until the day is done').toBe(0);
    expect(dayOf(run), 'and it is still today').toBe(1);

    run = advanceDay(run, true, 100);
    expect(halfOf(run)).toBe('morning');
    expect(run.wave, 'a won afternoon moves the wave').toBe(2);
    expect(cleared(run)).toBe(1);
    expect(dayOf(run)).toBe(2);
  });

  it('pays the purse once a day, not once a fight', () => {
    let run = newArenaRun(1);
    run = advanceDay(run, true, 100);
    expect(run.gold, 'the morning buys you the afternoon, not a wage').toBe(0);
    run = advanceDay(run, true, 100);
    expect(run.gold).toBe(100);
  });

  it('sends you back to the morning on a defeat, whichever half it was', () => {
    for (const lostIn of ['morning', 'afternoon'] as const) {
      let run = newArenaRun(1);
      if (lostIn === 'afternoon') run = advanceDay(run, true, 100);
      const waveBefore = run.wave;
      run = advanceDay(run, false, 0);
      expect(halfOf(run), `lost in the ${lostIn}`).toBe('morning');
      expect(run.wave, 'the wave is unchanged — the day is what was lost').toBe(waveBefore);
      expect(dayOf(run), 'and tomorrow comes').toBe(2);
    }
  });

  it('keeps everything but the day when you lose', () => {
    let run = { ...newArenaRun(1), gold: 500 };
    run = advanceDay(run, true, 100);       // won the morning
    run = advanceDay(run, false, 0, { spellsUsed: ['web'] });
    expect(run.gold, 'gold is kept').toBe(500);
    expect(run.spellsUsed, 'and what was tried is remembered').toContain('web');
    expect(run.fights, 'both fights counted').toBe(2);
  });
});

/**
 * The frozen level is what makes a hard day a puzzle rather than a wall — and
 * the only reason grinding mornings for XP is a way through one. `EVEN_BUDGET`
 * is calibrated so each level wins about half its fights at its own budget, so
 * against a wave that scaled with the party, levelling up would be exactly
 * neutral and grinding could never help.
 */
describe('the day is frozen at the level you met it', () => {
  it('generates the same fight for a party that has since levelled', () => {
    const atThree = buildWave(7, 3, 8);
    const atFive = buildWave(7, 5, 8);
    expect(atFive.budget, 'a live-scaled wave grows with the party')
      .toBeGreaterThan(atThree.budget);

    // Pinned: the level the day was entered at is what buildWave is handed.
    const run: ArenaRunState = { ...newArenaRun(7), wave: 8, dayLevel: 3 };
    const frozen = buildWave(run.seed, dayLevelOf(run, 5), run.wave);
    expect(frozen.budget, 'a frozen day does not').toBe(atThree.budget);
    expect(frozen.encounter.members).toEqual(atThree.encounter.members);
  });

  it('offers the same doors tomorrow as today', () => {
    const run: ArenaRunState = { ...newArenaRun(7), wave: 8, dayLevel: 3 };
    const today = gatesFor(run.seed, dayLevelOf(run, 3), run.wave, 'morning');
    // A level gained overnight must not change what is waiting.
    const tomorrow = gatesFor(run.seed, dayLevelOf(run, 6), run.wave, 'morning');
    expect(tomorrow.map((g) => g.layout)).toEqual(today.map((g) => g.layout));
    expect(tomorrow.map((g) => g.wave.encounter.members.join(',')))
      .toEqual(today.map((g) => g.wave.encounter.members.join(',')));
  });

  it('thaws when the day is cleared, so the valve closes behind you', () => {
    let run: ArenaRunState = { ...newArenaRun(1), dayLevel: 3 };
    run = advanceDay(run, true, 0);
    expect(run.dayLevel, 'still today — still pinned').toBe(3);
    run = advanceDay(run, true, 100);
    expect(run.dayLevel, 'a cleared day releases the level').toBeUndefined();
  });

  it('keeps the pin through a defeat', () => {
    let run: ArenaRunState = { ...newArenaRun(1), dayLevel: 3 };
    run = advanceDay(run, false, 0);
    expect(run.dayLevel, 'the fight you failed must still be the fight you meet').toBe(3);
  });

  it('gives the afternoon different fights from the morning', () => {
    const morning = gatesFor(5, 3, 8, 'morning');
    const afternoon = gatesFor(5, 3, 8, 'afternoon');
    expect(afternoon.map((g) => g.wave.encounter.members.join(',')))
      .not.toEqual(morning.map((g) => g.wave.encounter.members.join(',')));
    expect(afternoon[0]!.wave.budget, 'at the same budget, though')
      .toBe(morning[0]!.wave.budget);
  });
});

describe('lunch and the night', () => {
  it('a long rest gives back every hit die (2024 rules)', () => {
    // SRD 5.2.1: "You regain all lost Hit Points and all spent Hit Point Dice."
    // The old code restored half, minimum one — which at level 3 was one die a
    // day against a pool of three, a bleed nothing could recover from.
    const camp = newCampaign(3);
    camp.xp = 900;   // level 3
    const max = hitDiceMax(camp);
    expect(max).toBeGreaterThan(1);
    camp.characters[0]!.resources = { hp: 1, hitDice: 0 };
    longRest(camp);
    expect(hitDiceLeft(camp, 0)).toBe(max);
  });

  it('lunch spends hit dice and does not restore slots', () => {
    const camp = newCampaign(3);
    camp.xp = 900;
    const party = buildCampaignParty(camp);
    for (const [i, ch] of camp.characters.entries()) {
      ch.resources = { hp: 1, slots: [0, 0], hitDice: hitDiceMax(camp) };
      expect(party[i]).toBeDefined();
    }
    const rest = lunch(camp);
    expect(rest.totalHealed, 'nobody was healed').toBeGreaterThan(0);
    expect(rest.hitDiceSpent ?? 0).toBeGreaterThan(0);
    expect(camp.characters[0]!.resources?.slots, 'lunch is not a night').toEqual([0, 0]);
  });

  it('picks a downed hero up, and charges a hit die for it', () => {
    const camp = newCampaign(3);
    camp.xp = 900;
    camp.characters[0]!.resources = { hp: 0, hitDice: hitDiceMax(camp) };
    const before = hitDiceLeft(camp, 0);
    const rest = lunch(camp);
    expect(rest.revived, 'nobody was picked up').toBe(1);
    expect(camp.characters[0]!.resources!.hp, 'and they are on their feet').toBeGreaterThan(0);
    expect(hitDiceLeft(camp, 0), 'it cost dice').toBeLessThan(before);
  });

  it('still gets a hero upright when there are no dice left to spend', () => {
    // Harsh is fine; starting a fight with an unconscious hero is not, and a
    // party that cannot raise its casualties is punished enough by fighting
    // around them.
    const camp = newCampaign(3);
    camp.xp = 900;
    camp.characters[0]!.resources = { hp: 0, hitDice: 0 };
    lunch(camp);
    expect(camp.characters[0]!.resources!.hp).toBe(1);
  });

  it('a defeat leaves nobody down — the night picks everyone up', () => {
    const camp = newCampaign(3);
    camp.characters[0]!.resources = { hp: 0 };
    night(camp, 0);
    expect(camp.characters[0]!.resources!.hp).toBeGreaterThan(0);
  });

  it('keeps a downed hero at zero only when the arena asks for it', () => {
    // Adventure and campaign read survivors back at a minimum of one hit point,
    // because their next fight is a fresh start. The arena's day passes the
    // flag because lunch is what picks people up, and charges for it.
    const camp = newCampaign(3);
    const party = buildCampaignParty(camp);
    party[0]!.hp = 0;
    readBackSurvivors(camp, party);
    expect(camp.characters[0]!.resources!.hp).toBe(1);
    readBackSurvivors(camp, party, { downedAtZero: true });
    expect(camp.characters[0]!.resources!.hp).toBe(0);
  });
});

/**
 * Item cooldowns count days CLEARED, not days elapsed. A defeat advances the
 * calendar, so an elapsed-day clock would let a player recharge a conjuration
 * by deliberately throwing the afternoon fight — and at +20 points of win rate
 * for a fire elemental, losing on purpose would often beat winning.
 */
describe('item recharge', () => {
  const camp = () => {
    const c = newCampaign(9);
    c.characters[0]!.inventory.push({ itemId: 'brazier-fire-elemental', qty: 1 });
    c.characters[0]!.inventory.push({ itemId: 'wand-fireballs', qty: 1 });
    return c;
  };

  it('reads a cooldown ladder that matches the measured power ladder', () => {
    expect(cooldownDays('figurine-golden-lion')).toBe(1);
    expect(cooldownDays('figurine-bronze-griffon')).toBe(2);
    expect(cooldownDays('figurine-marble-elephant')).toBe(3);
    expect(cooldownDays('brazier-fire-elemental')).toBe(4);
    expect(cooldownDays('wand-fireballs'), 'an ordinary wand is nightly').toBe(0);
  });

  it('gives a wand back every night and a brazier back on its own clock', () => {
    const c = camp();
    c.characters[0]!.resources = { hp: 10, itemCharges: { 'wand-fireballs': 2, 'brazier-fire-elemental': 0 } };
    noteSpentItems(c, 0);
    expect(c.characters[0]!.resources!.itemCooldowns?.['brazier-fire-elemental'],
      'due four cleared days from now').toBe(4);
    expect(c.characters[0]!.resources!.itemCooldowns?.['wand-fireballs'],
      'a nightly item needs no record').toBeUndefined();

    night(c, 1);
    const held = buildCampaignParty(c)[0]!;
    expect(held.itemUses!['wand-fireballs']!.current, 'the wand came back').toBe(7);
    expect(held.itemUses!['brazier-fire-elemental']!.current, 'the brazier did not').toBe(0);

    // The day before it is due is still a day it is not due: the boundary is
    // the whole point of a four-day cooldown, so it gets its own assertion.
    night(c, 3);
    expect(buildCampaignParty(c)[0]!.itemUses!['brazier-fire-elemental']!.current,
      'three cleared days is one short').toBe(0);

    night(c, 4);
    expect(buildCampaignParty(c)[0]!.itemUses!['brazier-fire-elemental']!.current,
      'four cleared days later it is back').toBe(1);
  });

  it('cannot be farmed by losing, because losing clears nothing', () => {
    const c = camp();
    let run = newArenaRun(9);
    c.characters[0]!.resources = { hp: 10, itemCharges: { 'brazier-fire-elemental': 0 } };
    noteSpentItems(c, run.cleared);

    // Throw four days in a row. The calendar rolls; the cleared count does not.
    for (let i = 0; i < 4; i++) {
      run = advanceDay(run, false, 0);
      night(c, run.cleared);
    }
    expect(dayOf(run), 'four days have passed').toBe(5);
    expect(run.cleared).toBe(0);
    expect(buildCampaignParty(c)[0]!.itemUses!['brazier-fire-elemental']!.current,
      'and the brazier is still empty').toBe(0);
  });

  it('does not push its own due date back every time it is used', () => {
    const c = camp();
    c.characters[0]!.resources = { hp: 10, itemCharges: { 'brazier-fire-elemental': 0 } };
    noteSpentItems(c, 0);
    noteSpentItems(c, 3);
    expect(c.characters[0]!.resources!.itemCooldowns?.['brazier-fire-elemental']).toBe(4);
  });

  it('leaves nothing pending once everything is back', () => {
    const c = camp();
    c.characters[0]!.resources = { hp: 10, itemCharges: { 'brazier-fire-elemental': 0 } };
    noteSpentItems(c, 0);
    itemRecharge(c, 10);
    expect(c.characters[0]!.resources!.itemCooldowns).toBeUndefined();
    expect(c.characters[0]!.resources!.itemCharges).toBeUndefined();
  });

  it('every charged item declares a clock the day model understands', () => {
    for (const item of Object.values(ITEMS)) {
      if (item.charges === undefined) continue;
      const days = cooldownDays(item.id as Id);
      expect(Number.isFinite(days) || item.refills === 'never', item.id).toBe(true);
      expect(days, item.id).toBeGreaterThanOrEqual(0);
    }
  });
});
