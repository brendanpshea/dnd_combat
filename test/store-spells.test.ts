import { describe, expect, it } from 'vitest';
import { newCampaign, buildCampaignParty, storeSpellActions } from '../src/campaign/campaign.js';

describe('store spells', () => {
  it('derives curated store spells from a character known-spell list', () => {
    const party = buildCampaignParty(newCampaign());
    expect(storeSpellActions(party[2]!)).toEqual([
      { spellId: 'cure-wounds', name: 'Cure Wounds', icon: '💚', targeting: 'party' },
    ]);
    expect(storeSpellActions(party[1]!)).toContainEqual(
      { spellId: 'find-familiar', name: 'Find Familiar', icon: '🦉', targeting: 'self' },
    );
  });
});