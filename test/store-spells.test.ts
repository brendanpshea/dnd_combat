import { describe, expect, it } from 'vitest';
import { newCampaign, buildCampaignParty, storeSpellActions, setPrepared } from '../src/campaign/campaign.js';

describe('store spells', () => {
  it('derives curated store spells from a character known-spell list', () => {
    const c = newCampaign();
    // The wizard's store spells (Find Familiar, Mage Armor) are real prepared
    // spells, not always-known utility — prepare them so the shop offers them.
    setPrepared(c, 1, ['find-familiar', 'mage-armor']);
    const party = buildCampaignParty(c);
    // The cleric's Cure Wounds is in its auto-default (first leveled spell).
    expect(storeSpellActions(party[2]!)).toEqual([
      { spellId: 'cure-wounds', name: 'Cure Wounds', icon: '💚', targeting: 'party' },
    ]);
    expect(storeSpellActions(party[1]!)).toContainEqual(
      expect.objectContaining({ spellId: 'find-familiar', name: 'Find Familiar', icon: '🦉', targeting: 'self' }),
    );
    expect(storeSpellActions(party[1]!)).toContainEqual(
      expect.objectContaining({ spellId: 'mage-armor', name: 'Mage Armor', icon: '🛡️', targeting: 'self' }),
    );
  });
});