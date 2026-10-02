/**
 * An option locked to a class or species is that character's to roll, not
 * whoever is best at the skill.
 */
import { describe, it, expect } from 'vitest';
import { startAdventure, enterScene, choose, eligibleRollers } from '../src/adventure/runtime.js';
import { newCampaign } from '../src/campaign/campaign.js';
import type { Module } from '../src/adventure/types.js';

const mod: Module = { id: 'lk', title: 'L', blurb: '', start: 'a', scenes: {
  a: { id: 'a', kind: 'story', text: ['Dead in the cut.'], noBack: true, next: [
    { id: 'turn', label: '[Cleric] Turn them aside', to: 'won', requires: [{ kind: 'classInParty', classId: 'cleric' }],
      check: { skill: 'religion', dc: 1, failTo: 'won' } },
    { id: 'any', label: 'Pray', to: 'won', check: { skill: 'religion', dc: 1, failTo: 'won' } },
  ] },
  won: { id: 'won', kind: 'ending', outcome: 'victory', text: ['Done.'] },
} };

describe('locked rolls', () => {
  it('only the cleric rolls the cleric\'s option, even when the wizard knows more religion', () => {
    const s = startAdventure(newCampaign(1), mod);
    const cleric = s.campaign.characters.findIndex((c) => c.classId === 'cleric');
    expect(eligibleRollers(s, [{ kind: 'classInParty', classId: 'cleric' }])).toEqual([cleric]);
    expect(eligibleRollers(s, undefined)).toHaveLength(s.campaign.characters.length);
    enterScene(s, mod, 'a');
    const wizard = s.campaign.characters.findIndex((c) => c.classId === 'wizard');
    // Even a tapped wizard hands it to the cleric.
    const ev = choose(s, mod, 'turn', wizard);
    const check = ev.find((e) => e.type === 'check');
    expect(check && 'roll' in check ? check.roll.by : undefined).toBe(cleric);
  });
});

describe('a gold loss', () => {
  it('reports what was actually taken, not what was asked', async () => {
    const m: Module = { id: 'g', title: 'G', blurb: '', start: 'a', scenes: {
      a: { id: 'a', kind: 'story', text: ['A cutpurse.'], noBack: true, next: [{ id: 'lose', label: 'Lose it', to: 'won', effects: [{ kind: 'gold', amount: -50 }] }] },
      won: { id: 'won', kind: 'ending', outcome: 'victory', text: ['Done.'] },
    } };
    const s = startAdventure(newCampaign(1), m);
    s.campaign.gold = 20;
    enterScene(s, m, 'a');
    expect(choose(s, m, 'lose').find((e) => e.type === 'gold')).toMatchObject({ amount: -20, total: 0 });
  });
});
