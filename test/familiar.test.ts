import { describe, expect, it } from 'vitest';
import { Combat } from '../src/engine/combat.js';
import { applyVictory, buildCampaignParty, longRest, newCampaign, useStoreSpell, setPrepared } from '../src/campaign/campaign.js';
import { collectAttackSources, consumeFamiliarHelp } from '../src/engine/rules/attack.js';
import { WEAPONS } from '../src/data/weapons.js';
import { SPELLS } from '../src/data/spells.js';
import { acOf } from '../src/data/armor.js';
import { makeCombatant } from './helpers.js';

describe('owl familiar', () => {
  it('persists through long rests and projects into each new battle', () => {
    const campaign = newCampaign();
    expect(useStoreSpell(campaign, 1, 'find-familiar')).toBe(true);
    longRest(campaign);
    expect(buildCampaignParty(campaign)[1]!.familiar).toEqual({ kind: 'owl' });
  });

  it('grants advantage on the first attack roll of every round', () => {
    const combat = new Combat({
      seed: 1,
      combatants: [
        makeCombatant({ id: 'wizard', team: 'team1', position: { x: 3, y: 3 }, familiar: { kind: 'owl' } }),
        makeCombatant({ id: 'foe', team: 'team2', position: { x: 3, y: 4 } }),
      ],
    });
    const wizard = combat.state.combatants.wizard!;
    const foe = combat.state.combatants.foe!;
    expect(collectAttackSources(combat.state, wizard, foe, WEAPONS.longsword!, true).adv).toContain('owl familiar');
    consumeFamiliarHelp(combat.state, wizard);
    expect(collectAttackSources(combat.state, wizard, foe, WEAPONS.longsword!, true).adv).not.toContain('owl familiar');
    combat.state.round += 1;
    expect(collectAttackSources(combat.state, wizard, foe, WEAPONS.longsword!, true).adv).toContain('owl familiar');
  });
});

describe('mage armor', () => {
  it('persists from the store through combat, then ends at the next long rest', () => {
    const campaign = newCampaign();
    const wizard = campaign.characters[1]!;
    setPrepared(campaign, 1, ['mage-armor']); // must be prepared to cast from the store
    expect(useStoreSpell(campaign, 1, 'mage-armor')).toBe(true);
    expect(acOf(buildCampaignParty(campaign)[1]!)).toBe(16); // 13 + Dex +3

    longRest(campaign);
    expect(buildCampaignParty(campaign)[1]!.mageArmor).toBeUndefined();
    expect(acOf(buildCampaignParty(campaign)[1]!)).toBe(13);
    expect(wizard.resources?.effects?.mageArmor).toBeUndefined();
  });

  it('sets Mage Armor during a combat cast and ignores it while armored', () => {
    const combat = new Combat({
      seed: 1,
      combatants: [
        makeCombatant({ id: 'wizard', team: 'team1', position: { x: 3, y: 3 }, abilities: { str: 8, dex: 16, con: 13, int: 16, wis: 12, cha: 10 }, equipped: {} }),
        makeCombatant({ id: 'foe', team: 'team2', position: { x: 3, y: 4 } }),
      ],
    });
    const wizard = combat.state.combatants.wizard!;
    SPELLS['mage-armor']!.cast({ state: combat.state, casterId: wizard.id, slotLevel: 1, targetIds: [], positions: [] });
    expect(acOf(wizard)).toBe(16);
    wizard.equipped.armor = 'leather';
    expect(acOf(wizard)).toBe(14);
  });

  it('persists Mage Armor cast during a victorious battle', () => {
    const campaign = newCampaign();
    const party = buildCampaignParty(campaign);
    const wizard = party[1]!;
    const combat = new Combat({
      seed: 1,
      combatants: [...party, makeCombatant({ id: 'foe', team: 'team2', position: { x: 3, y: 4 } })],
    });
    SPELLS['mage-armor']!.cast({ state: combat.state, casterId: wizard.id, slotLevel: 1, targetIds: [], positions: [] });
    applyVictory(campaign, Object.values(combat.state.combatants).filter((combatant) => combatant.team === 'team1'));
    expect(buildCampaignParty(campaign)[1]!.mageArmor).toBe(true);
  });
});