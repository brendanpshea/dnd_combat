import { describe, it, expect } from 'vitest';
import {
  newCampaign, buildCampaignParty, readBackSurvivors, useStoreSpell, healParty,
  shortRest, hitDiceLeft, longRest,
} from '../src/campaign/campaign.js';

/**
 * What a fight's read-back must leave alone, and what a camp buff must not
 * hand out twice. Each of these was a quiet refill: nothing crashed, the party
 * simply had more than it should.
 */
describe('after a fight', () => {
  it('keeps spent hit dice spent', () => {
    const c = newCampaign(1);
    c.partyReady = true;
    c.xp = 2700;
    c.characters[0]!.resources = { hp: 1 };
    shortRest(c);
    const left = hitDiceLeft(c, 0);
    readBackSurvivors(c, buildCampaignParty(c));
    expect(hitDiceLeft(c, 0), 'a won fight refilled the hit dice').toBe(left);
  });

  it('keeps a multi-day item cooldown running', () => {
    const c = newCampaign(1);
    c.partyReady = true;
    c.characters[0]!.resources = { hp: 10, itemCooldowns: { 'figurine-marble-elephant': 4 } };
    readBackSurvivors(c, buildCampaignParty(c));
    expect(c.characters[0]!.resources?.itemCooldowns).toEqual({ 'figurine-marble-elephant': 4 });
  });
});

describe('Aid cast in camp', () => {
  function aided() {
    const c = newCampaign(1);
    c.partyReady = true;
    c.xp = 900; // 3rd level: the cleric has a 2nd-level slot
    const cleric = c.characters.findIndex((x) => x.classId === 'cleric');
    const other = cleric === 0 ? 1 : 0;
    c.characters[other]!.resources = { ...c.characters[other]!.resources, hp: 5 };
    expect(useStoreSpell(c, cleric, 'aid')).toBe(true);
    return { c, cleric, other };
  }

  it('heals its 5 once, not on every build', () => {
    const { c, other } = aided();
    const first = buildCampaignParty(c)[other]!.hp;
    expect(first).toBe(10);
    healParty(c, 0);
    healParty(c, 0);
    expect(buildCampaignParty(c)[other]!.hp).toBe(first);
  });

  it('does not stack with itself', () => {
    const { c, cleric, other } = aided();
    const max = buildCampaignParty(c)[other]!.maxHp;
    useStoreSpell(c, cleric, 'aid');
    expect(buildCampaignParty(c)[other]!.maxHp).toBe(max);
  });

  it('is not topped up again by the fight after', () => {
    const { c, other } = aided();
    const team = buildCampaignParty(c);
    const start = team[other]!.hp;
    readBackSurvivors(c, team);
    expect(buildCampaignParty(c)[other]!.hp).toBe(start);
  });
});

/**
 * No event may drop a resource field it does not own.
 *
 * Each of these once rebuilt `resources` from a list of fields to keep, and
 * every field added after the list was written was silently lost — hit dice,
 * item cooldowns, a wizard's spent slots on casting Find Familiar. A made-up
 * field stands in for the next one: anything that rebuilds instead of patching
 * drops it, and fails here, whatever it is called.
 */
describe('resources are patched, never rebuilt', () => {
  const FUTURE = '__nextField';
  function party() {
    const c = newCampaign(1);
    c.partyReady = true;
    c.xp = 2700; // 4th level
    for (const ch of c.characters) {
      ch.resources = { hp: 3, hitDice: 1, itemCooldowns: { 'figurine-marble-elephant': 9 } };
      (ch.resources as Record<string, unknown>)[FUTURE] = 1;
    }
    return c;
  }
  const kept = (c: ReturnType<typeof party>, i = 0) =>
    (c.characters[i]!.resources as Record<string, unknown> | undefined)?.[FUTURE];

  it('survives a fight', () => {
    const c = party();
    readBackSurvivors(c, buildCampaignParty(c));
    expect(kept(c)).toBe(1);
  });

  it('survives a short rest', () => {
    const c = party();
    shortRest(c);
    expect(kept(c)).toBe(1);
  });

  it('survives every camp spell', () => {
    for (const spell of ['find-familiar', 'mage-armor', 'false-life', 'aid', 'haste', 'pass-without-trace']) {
      const c = party();
      const casters = c.characters.map((_, i) => i);
      // Whoever can cast it; the point is what it writes, not who writes it.
      const cast = casters.some((i) => useStoreSpell(c, i, spell));
      if (!cast) continue;
      for (const i of casters) expect(kept(c, i), `${spell} dropped a field on hero ${i}`).toBe(1);
    }
  });

  it('keeps a long rest from touching what it does not reset', () => {
    const c = party();
    longRest(c);
    expect(kept(c)).toBe(1);
    expect(c.characters[0]!.resources?.itemCooldowns, 'a multi-day cooldown is not a night')
      .toEqual({ 'figurine-marble-elephant': 9 });
  });
});
