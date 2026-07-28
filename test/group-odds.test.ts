/**
 * The arithmetic behind a group check's odds.
 *
 * The arena priced its one group check — creeping past a gate — with
 * `checkOdds` on the single best hero's bonus, so the number on the button
 * described a different check from the one being made. These are the properties
 * the replacement has to have, and they are all things a wrong implementation
 * gets wrong in a visible way.
 */
import { describe, it, expect } from 'vitest';
import { groupPassChance, passChance, groupThreshold, groupOdds, checkOdds } from '../web/src/odds.js';
import { newCampaign, setPartyClass, characterSkillCheck, skillDisadvantage } from '../src/campaign/campaign.js';

/** Bonuses to rollers, for the cases where nobody is wearing plate. */
const rollers = (bonuses: number[]) => bonuses.map((bonus) => ({ bonus }));

describe('group check odds', () => {
  it('needs half the party, rounded up', () => {
    expect(groupThreshold(4)).toBe(2);
    expect(groupThreshold(3)).toBe(2);
    expect(groupThreshold(1)).toBe(1);
  });

  it('prices one d20 by counting faces', () => {
    expect(passChance(0, 11)).toBeCloseTo(0.5);   // 11..20
    expect(passChance(5, 11)).toBeCloseTo(0.75);  // 6..20
    expect(passChance(0, 1)).toBe(1);
    expect(passChance(0, 25)).toBe(0);
  });

  it('is certain only when enough heroes cannot fail', () => {
    // Two of four cannot fail -> the group cannot fail, whatever the other two
    // roll. This is the case a best-hero calculation gets wrong in BOTH
    // directions, and the direction that matters: one superb sneak does not
    // make a group check certain.
    expect(groupOdds(rollers([30, 30, -5, -5]), 10)).toBe('certain');
    expect(groupOdds(rollers([30, -5, -5, -5]), 10)).toBe('live');
    expect(checkOdds(30, 10), 'the old single-hero call says certain').toBe('certain');
  });

  it('is impossible only when too few can pass at all', () => {
    // One hero able to clear it is not enough when two must.
    expect(groupOdds(rollers([-5, -5, -5, 30]), 40)).toBe('impossible');
    // But two who *can* pass make it live, even at long odds — exactly the
    // distinction a best-hero calculation cannot draw.
    expect(groupOdds(rollers([-5, -5, 30, 30]), 40)).toBe('live');
    expect(groupOdds(rollers([-5, -5, -5, -5]), 40)).toBe('impossible');
  });

  it('gets worse when the party puts armour on, which the old number did not', () => {
    // THE bug, stated as a property. Drop two heroes' stealth and the odds must
    // move; the best-hero number is untouched, which is why the button never
    // reflected the party's actual gear.
    const light = groupPassChance(rollers([5, 3, 3, 1]), 14);
    const heavy = groupPassChance(rollers([5, 3, -4, -4]), 14);
    expect(heavy).toBeLessThan(light);
    expect(checkOdds(5, 14), 'unchanged, because it only ever saw the rogue').toBe('live');
  });

  it('agrees with a simulation', () => {
    // The DP is the kind of thing that is quietly off by one boundary. Check it
    // against the naive enumeration of all 2^4 outcomes.
    const bonuses = [5, 2, 0, -1];
    const dc = 13;
    const ps = bonuses.map((b) => passChance(b, dc));
    let expected = 0;
    for (let mask = 0; mask < 1 << bonuses.length; mask++) {
      let prob = 1, passed = 0;
      for (const [i, p] of ps.entries()) {
        const on = (mask >> i) & 1;
        prob *= on ? p : 1 - p;
        passed += on;
      }
      if (passed * 2 >= bonuses.length) expected += prob;
    }
    expect(groupPassChance(rollers(bonuses), dc)).toBeCloseTo(expected, 10);
  });

  it('handles an empty party without pretending it succeeds', () => {
    expect(groupPassChance([], 10)).toBe(0);
  });
});

/**
 * Armour, which the campaign-level check had never applied.
 *
 * The engine's Hide rule rolls Stealth at disadvantage in heavy armour, and the
 * arena's morning gear advisor warns about it — but `characterSkillCheck` did
 * not, so the paladin in plate crept up on gates rolling a flat d20. It mattered
 * most in the one place it was missing: creeping in is a group check, and the
 * armoured members are the reason a party gets heard.
 */
describe('armour on a stealth check', () => {
  it('squares the odds, because both dice have to clear it', () => {
    expect(passChance(0, 11)).toBeCloseTo(0.5);
    expect(passChance(0, 11, true)).toBeCloseTo(0.25);
    // A hero who cannot fail still cannot fail with two dice.
    expect(passChance(20, 5, true)).toBe(1);
    expect(passChance(-5, 30, true)).toBe(0);
  });

  it('drags a group check down harder than the bonus suggests', () => {
    // Two paladins at +0: flat they pass half the time, in plate a quarter. The
    // button showed neither, because it only ever looked at the rogue.
    const bare = groupPassChance([{ bonus: 6 }, { bonus: 4 }, { bonus: 0 }, { bonus: 0 }], 11);
    const plate = groupPassChance(
      [{ bonus: 6 }, { bonus: 4 }, { bonus: 0, disadvantage: true }, { bonus: 0, disadvantage: true }], 11);
    expect(plate).toBeLessThan(bare);
    expect(bare - plate).toBeGreaterThan(0.1);
  });
});

/**
 * And the roll itself, not just the odds shown for it.
 */
describe('the stealth check actually rolls at disadvantage', () => {
  it('rolls twice for a hero in heavy armour and keeps the worse', () => {
    const bare = newCampaign(5);
    const plated = newCampaign(5);
    setPartyClass(plated, 0, 'paladin');
    setPartyClass(bare, 0, 'rogue');
    // Confirm the fixture: one wears stealth-disadvantaged armour, one doesn't.
    expect(skillDisadvantage(bare, 0, 'stealth')).toBe(false);
    expect(skillDisadvantage(plated, 0, 'stealth'), 'the paladin must be in plate').toBe(true);
    // Disadvantage is not a bonus change, so it cannot be seen in the bonus —
    // it has to be seen in the naturals over many rolls.
    let bareSum = 0, plateSum = 0;
    for (let i = 0; i < 400; i++) {
      bareSum += characterSkillCheck(bare, 0, 'stealth', 10, { noGuidance: true }).natural;
      plateSum += characterSkillCheck(plated, 0, 'stealth', 10, { noGuidance: true }).natural;
    }
    expect(plateSum / 400, 'plate should average near 7, bare near 10.5').toBeLessThan(bareSum / 400 - 1.5);
  });

  it('leaves every other skill alone', () => {
    const c = newCampaign(5);
    setPartyClass(c, 0, 'paladin');
    expect(skillDisadvantage(c, 0, 'athletics')).toBe(false);
    expect(skillDisadvantage(c, 0, 'perception')).toBe(false);
  });
});
