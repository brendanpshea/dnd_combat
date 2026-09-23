import { describe, it, expect } from 'vitest';
import {
  newCampaign, buildCampaignParty, readBackSurvivors, useStoreSpell, healParty,
  shortRest, hitDiceLeft,
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
