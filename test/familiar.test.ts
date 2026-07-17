import { describe, expect, it } from 'vitest';
import { Combat } from '../src/engine/combat.js';
import { buildCampaignParty, longRest, newCampaign, useStoreSpell } from '../src/campaign/campaign.js';
import { collectAttackSources, consumeFamiliarHelp } from '../src/engine/rules/attack.js';
import { WEAPONS } from '../src/data/weapons.js';
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