import { describe, it, expect } from 'vitest';
import { Combat } from '../src/engine/combat.js';
import { buildCharacter } from '../src/builder/character.js';
import { buildMonster } from '../src/data/monsters.js';
import { FEATURES, bardicDie } from '../src/data/features.js';
import { newCampaign, buildCampaignParty, readBackSurvivors, shortRest, setPartyClass } from '../src/campaign/campaign.js';
import { legalActions } from '../src/engine/actions.js';
import { seedRng } from '../src/engine/rng.js';
import type { Combatant, GameState } from '../src/engine/types.js';

/** Class features held to their SRD 5.2.1 text. */

const pc = (classId: string, level: number, id = classId, x = 3, y = 3): Combatant =>
  ({ ...buildCharacter({ classId, team: 'team1', position: { x, y }, level }), id });

function partyOf(classId: string, level: number) {
  const c = newCampaign(1);
  setPartyClass(c, 0, classId);
  c.xp = 0;
  while (buildCampaignParty(c)[0]!.level < level) c.xp += 500;
  return c;
}

describe('Channel Divinity is one pool per class (lines 2640, 4812)', () => {
  it('a cleric has it twice from 2nd and three times from 6th; a paladin twice from 3rd', () => {
    expect(pc('cleric', 2).featureUses['channel-divinity']!.max).toBe(2);
    expect(pc('cleric', 6).featureUses['channel-divinity']!.max).toBe(3);
    expect(pc('paladin', 3).featureUses['channel-divinity']!.max).toBe(2);
    expect(pc('paladin', 2).featureUses['channel-divinity']).toBeUndefined();
  });

  it('Turn Undead and Preserve Life spend the same pool', () => {
    const cl = pc('cleric', 3, 'cl');
    const c = new Combat({ seed: 1, width: 8, height: 8, combatants: [cl, { ...pc('fighter', 3, 'f', 4, 3), hp: 1 }, { ...buildMonster('zombie', 'team2', { x: 3, y: 5 }), id: 'z' }] });
    let guard = 0;
    while (c.activeId !== 'cl' && guard++ < 10) c.apply({ kind: 'endTurn' });
    c.state.combatants['cl']!.featureUses['channel-divinity']!.current = 1;
    c.apply({ kind: 'useFeature', featureId: 'preserve-life' });
    expect(legalActions(c.state, 'cl').some((a) => a.kind === 'useFeature' && a.featureId === 'turn-undead')).toBe(false);
  });
});

describe('Sear Undead (Cleric 5, line 2652)', () => {
  it('burns each undead that fails against Turn Undead', () => {
    let burnt = false;
    for (let seed = 1; seed < 30 && !burnt; seed++) {
      const c = new Combat({ seed: 1, width: 8, height: 8, combatants: [pc('cleric', 5, 'cl'), { ...buildMonster('zombie', 'team2', { x: 3, y: 5 }), id: 'z', hp: 200, maxHp: 200 }] });
      let guard = 0;
      while (c.activeId !== 'cl' && guard++ < 10) c.apply({ kind: 'endTurn' });
      const s: GameState = structuredClone(c.state);
      s.rng = seedRng(seed);
      const r = FEATURES['turn-undead']!.apply!({ state: s, actorId: 'cl' });
      const failed = r.some((e) => e.type === 'savingThrow' && e.combatantId === 'z' && !e.success);
      const seared = r.some((e) => e.type === 'damageDealt' && e.targetId === 'z' && e.damageType === 'radiant');
      expect(seared).toBe(failed);
      burnt = seared;
    }
    expect(burnt).toBe(true);
  });
});

describe('Second Wind (line 4258)', () => {
  it('2, then 3 from 4th, then 4 from 10th', () => {
    expect(pc('fighter', 1).featureUses['second-wind']!.max).toBe(2);
    expect(pc('fighter', 4).featureUses['second-wind']!.max).toBe(3);
  });
});

describe('Bardic Inspiration (lines 1747, 1885)', () => {
  it('the die grows to a d8 at 5th', () => {
    expect(bardicDie(1)).toBe('1d6');
    expect(bardicDie(5)).toBe('1d8');
    expect(bardicDie(10)).toBe('1d10');
  });

  it('Font of Inspiration: from 5th the dice come back on a short rest', () => {
    for (const [level, back] of [[4, false], [5, true]] as const) {
      const c = partyOf('bard', level);
      const fought = buildCampaignParty(c)[0]!;
      const max = fought.featureUses['bardic-inspiration']!.max;
      fought.featureUses['bardic-inspiration'] = { current: 0, max };
      readBackSurvivors(c, [fought]);
      shortRest(c);
      expect(buildCampaignParty(c)[0]!.featureUses['bardic-inspiration']!.current, `level ${level}`).toBe(back ? max : 0);
    }
  });
});

describe('Wild Shape (line 3416)', () => {
  it('two uses, three from 6th, and a CR 1 form from 8th', () => {
    expect(pc('druid', 2).featureUses['wild-shape']!.max).toBe(2);
    expect(pc('druid', 6).featureUses['wild-shape']!.max).toBe(3);
    const c = new Combat({ seed: 1, width: 8, height: 8, combatants: [pc('druid', 8, 'd'), { ...buildMonster('ogre', 'team2', { x: 7, y: 7 }), id: 'o' }] });
    let guard = 0;
    while (c.activeId !== 'd' && guard++ < 10) c.apply({ kind: 'endTurn' });
    c.apply({ kind: 'useFeature', featureId: 'wild-shape' });
    expect(c.state.combatants['d']!.wildShape?.formId).toBe('brown-bear');
  });
});

describe('Lay on Hands (line 4792)', () => {
  it('is a Bonus Action', () => {
    expect(FEATURES['lay-on-hands']!.trigger).toBe('bonus');
  });
});
