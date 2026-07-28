/**
 * Arcane Recovery, and the druid's Natural Recovery, which is the same rule.
 *
 * Slots back on a short rest, once between long rests. It exists because every
 * other class's short-rest resource came back at the arena's lunch break and
 * the caster's did not: a wizard who spent their slots in the morning fight was
 * a crossbow with a book for the rest of the day.
 *
 * The once-per-long-rest clause is not new mechanism — it is the feature's own
 * `longRest` pool of one, which only became possible when feature pools got
 * clocks. These tests pin both halves: that the slots come back, and that they
 * come back exactly once.
 */
import { describe, it, expect } from 'vitest';
import {
  newCampaign, setPartyClass, buildCampaignParty, shortRest, longRest,
} from '../src/campaign/campaign.js';
import { FEATURES } from '../src/data/features.js';

function casterAt(classId: string, level: number) {
  const c = newCampaign(4);
  setPartyClass(c, 0, classId);
  c.xp = 0;
  while (buildCampaignParty(c)[0]!.level < level) c.xp += 900;
  return c;
}

/** Spend every slot the first hero has, as a fight would. */
function drain(c: ReturnType<typeof newCampaign>) {
  const caster = buildCampaignParty(c)[0]!;
  c.characters[0]!.resources = {
    ...c.characters[0]!.resources,
    hp: caster.maxHp,
    slots: caster.spellSlots.map(() => 0),
  };
}
const slotsOf = (c: ReturnType<typeof newCampaign>) =>
  buildCampaignParty(c)[0]!.spellSlots.map((p) => p.current);

describe('Arcane and Natural Recovery', () => {
  it('is a once-per-day pool, not a new kind of bookkeeping', () => {
    for (const id of ['arcane-recovery', 'natural-recovery']) {
      expect(FEATURES[id]!.uses).toEqual({ count: 1, per: 'longRest' });
      expect(FEATURES[id]!.trigger, 'this happens in camp, not on a turn').toBe('passive');
    }
  });

  it('hands a drained wizard slots back at the lunch break', () => {
    const c = casterAt('wizard', 5);
    drain(c);
    expect(slotsOf(c).reduce((a, b) => a + b, 0)).toBe(0);
    const rest = shortRest(c);
    const back = slotsOf(c).reduce((a, b) => a + b, 0);
    expect(back, 'nothing came back').toBeGreaterThan(0);
    expect(rest.recovered?.[0]?.slots.length, 'and the rest says so').toBe(back);
  });

  it('spends a budget of half the level, rounded up, highest slots first', () => {
    // A level-5 wizard recovers 3 levels of slots: one 3rd, not three 1sts.
    const c = casterAt('wizard', 5);
    drain(c);
    const rest = shortRest(c);
    const got = rest.recovered?.[0]?.slots ?? [];
    expect(got.reduce((a, b) => a + b, 0)).toBeLessThanOrEqual(3);
    expect(Math.max(...got), 'highest first, or the budget is wasted').toBe(3);
  });

  it('only fires once between long rests', () => {
    // THE clause. A second lunch in the same day gives nothing.
    const c = casterAt('wizard', 5);
    drain(c);
    expect(shortRest(c).recovered).toBeDefined();
    drain(c);
    expect(shortRest(c).recovered, 'twice in one day').toBeUndefined();
    // The night resets it.
    longRest(c);
    drain(c);
    expect(shortRest(c).recovered, 'and comes back tomorrow').toBeDefined();
  });

  it('gives nothing to a caster who has not spent anything', () => {
    // And crucially does not burn the use doing so.
    const c = casterAt('wizard', 5);
    expect(shortRest(c).recovered).toBeUndefined();
    drain(c);
    expect(shortRest(c).recovered, 'the use must still be there').toBeDefined();
  });

  it('never recovers more than the caster had', () => {
    const c = casterAt('wizard', 5);
    const full = slotsOf(c);
    drain(c);
    shortRest(c);
    for (const [i, n] of slotsOf(c).entries()) expect(n).toBeLessThanOrEqual(full[i]!);
  });

  it('works for the druid too, but only from 6th', () => {
    // The SRD puts Natural Recovery at druid 6, not 2 — which is where this
    // first landed, and which the SRD comparison test caught.
    const c = casterAt('druid', 6);
    drain(c);
    expect(shortRest(c).recovered?.[0]?.slots.length).toBeGreaterThan(0);
    const low = casterAt('druid', 5);
    expect(buildCampaignParty(low)[0]!.featureIds).not.toContain('natural-recovery');
  });

  it('leaves a non-caster alone', () => {
    const c = casterAt('fighter', 5);
    expect(shortRest(c).recovered).toBeUndefined();
  });
});
