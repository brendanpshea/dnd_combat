import { describe, it, expect } from 'vitest';
import { Combat } from '../src/engine/combat.js';
import { buildCharacter } from '../src/builder/character.js';
import { buildMonster } from '../src/data/monsters.js';
import { FEATURES, bardicDie } from '../src/data/features.js';
import { CLASSES } from '../src/data/classes.js';
import { newCampaign, buildCampaignParty, readBackSurvivors, shortRest, setPartyClass, characterSkillProficient } from '../src/campaign/campaign.js';
import { speciesSkills } from '../src/data/species.js';
import { legalActions, step } from '../src/engine/actions.js';
import { savingThrow } from '../src/engine/rules/saves.js';
import { rollSkill, skillMod } from '../src/engine/rules/skills.js';
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

describe('Weapon Mastery counts by class level (SRD class tables)', () => {
  const kinds = (classId: string, level: number) =>
    new Set(pc(classId, level).weaponMasteries.map((w) => w.replace(/-plus1$/, ''))).size;
  it('fighter 3, 4 at 4th; barbarian 2, 3 at 4th; paladin, ranger and rogue 2; monk none', () => {
    expect(kinds('fighter', 1)).toBe(3);
    expect(kinds('fighter', 4)).toBe(4);
    expect(kinds('barbarian', 1)).toBe(2);
    expect(kinds('barbarian', 4)).toBe(3);
    expect(kinds('paladin', 5)).toBe(2);
    expect(kinds('ranger', 5)).toBe(2);
    expect(kinds('rogue', 5)).toBe(2);
    expect(kinds('monk', 5)).toBe(0);
  });
});

describe('Unarmored Movement (Monk 2, line 4526)', () => {
  it('+10 ft from 2nd and +15 from 6th, unarmoured', () => {
    const one = pc('monk', 1).speed;
    expect(pc('monk', 2).speed).toBe(one + 10);
    expect(pc('monk', 6).speed).toBe(one + 15);
  });
});

describe('Metamagic (Sorcerer 2, line 6109)', () => {
  it('two options, not three — Quickened and Empowered unless chosen otherwise', () => {
    const s = pc('sorcerer', 2);
    expect(s.featureIds.filter((f) => f.startsWith('metamagic-')).sort()).toEqual(['metamagic-empowered', 'metamagic-quickened']);
    const h = { ...buildCharacter({ classId: 'sorcerer', team: 'team1', position: { x: 0, y: 0 }, level: 2, choices: { metamagic: 'quickened-heightened' } }) };
    expect(h.featureIds.filter((f) => f.startsWith('metamagic-')).sort()).toEqual(['metamagic-heightened', 'metamagic-quickened']);
  });
});

describe('Potent Cantrip (Evoker 3, line 8726)', () => {
  it('a missed Fire Bolt still deals half', () => {
    let missed = false;
    for (let seed = 1; seed < 80 && !missed; seed++) {
      const c = new Combat({ seed: 1, width: 8, height: 8, combatants: [pc('wizard', 3, 'w', 0, 0), { ...buildMonster('ogre', 'team2', { x: 5, y: 5 }), id: 'o', acOverride: 25 }] });
      let guard = 0;
      while (c.activeId !== 'w' && guard++ < 10) c.apply({ kind: 'endTurn' });
      const s: GameState = structuredClone(c.state);
      s.rng = seedRng(seed);
      const r = step(s, { kind: 'castSpell', spellId: 'fire-bolt', slotLevel: 0, targets: [{ combatantId: 'o' }] });
      const roll = r.events.find((e) => e.type === 'attackRolled');
      if (roll?.type !== 'attackRolled' || roll.hit) continue;
      missed = true;
      expect(r.events.some((e) => e.type === 'damageDealt' && e.tags?.includes('Potent Cantrip'))).toBe(true);
    }
    expect(missed).toBe(true);
  });
});

describe('Dragonborn Breath Weapon (line 8803)', () => {
  it('as many uses as the Proficiency Bonus, in place of one attack', () => {
    const d = { ...buildCharacter({ classId: 'fighter', speciesId: 'dragonborn', team: 'team1', position: { x: 3, y: 3 }, level: 5 }), id: 'd' };
    expect(d.innateSpells['breath-weapon']).toEqual({ current: 3, max: 3 });
    const c = new Combat({ seed: 1, width: 8, height: 8, combatants: [d, { ...buildMonster('ogre', 'team2', { x: 3, y: 4 }), id: 'o', hp: 500, maxHp: 500 }] });
    let guard = 0;
    while (c.activeId !== 'd' && guard++ < 10) c.apply({ kind: 'endTurn' });
    const breath = () => legalActions(c.state, 'd').find((a) => a.kind === 'castSpell' && a.spellId === 'breath-weapon');
    const swing = () => legalActions(c.state, 'd').find((a) => a.kind === 'attack' && !a.offhand && !a.frenzy);
    c.apply(swing()!);
    expect(breath(), 'the second of two attacks can be the breath').toBeDefined();
    c.apply(breath()!);
    expect(c.state.combatants['d']!.turn.attacksLeft).toBe(0);
    expect(swing()).toBeUndefined();
    expect(breath()).toBeUndefined();
  });
});

describe('Indomitable (Fighter 9) and Reliable Talent (Rogue 7)', () => {
  it('Indomitable rerolls a failed save with the fighter level', () => {
    const rate = (level: number) => {
      let ok = 0;
      for (let seed = 1; seed <= 200; seed++) {
        const c = new Combat({ seed: 1, width: 8, height: 8, combatants: [pc('fighter', level, 'f'), { ...buildMonster('ogre', 'team2', { x: 7, y: 7 }), id: 'o' }] });
        c.state.rng = seedRng(seed);
        if (savingThrow(c.state, 'f', 'wis', 20, { magical: false }).success) ok++;
      }
      return ok / 200;
    };
    expect(pc('fighter', 9).featureUses['indomitable']).toEqual({ current: 1, max: 1 });
    expect(rate(9)).toBeGreaterThan(rate(8) + 0.2);
  });

  it('Reliable Talent: a proficient check never rolls below 10', () => {
    const r = pc('rogue', 7, 'r');
    expect(r.featureIds).toContain('reliable-talent');
    const skill = (r.skillProfs ?? [])[0]!;
    const c = new Combat({ seed: 1, width: 8, height: 8, combatants: [r, { ...buildMonster('ogre', 'team2', { x: 7, y: 7 }), id: 'o' }] });
    for (let seed = 1; seed <= 60; seed++) {
      c.state.rng = seedRng(seed);
      const roll = rollSkill(c.state, 'r', skill);
      expect(roll.total).toBeGreaterThanOrEqual(10 + skillMod(r, skill));
    }
  });
});

describe('spellcasting tables (SRD 5.2.1 class tables)', () => {
  // Cantrips and Prepared Spells columns, levels 1-9 (cleric line 2618, bard
  // 1841, warlock 6999; the druid, sorcerer and wizard tables print by row).
  const SRD: Record<string, { cantrips?: number[]; prepared: number[] }> = {
    bard: { cantrips: [2, 2, 2, 3, 3, 3, 3, 3, 3], prepared: [4, 5, 6, 7, 9, 10, 11, 12, 14] },
    cleric: { cantrips: [3, 3, 3, 4, 4, 4, 4, 4, 4], prepared: [4, 5, 6, 7, 9, 10, 11, 12, 14] },
    druid: { cantrips: [2, 2, 2, 3, 3, 3, 3, 3, 3], prepared: [4, 5, 6, 7, 9, 10, 11, 12, 14] },
    paladin: { prepared: [2, 3, 4, 5, 6, 6, 7, 7, 9] },
    ranger: { prepared: [2, 3, 4, 5, 6, 6, 7, 7, 9] },
    sorcerer: { cantrips: [4, 4, 4, 5, 5, 5, 5, 5, 5], prepared: [2, 4, 6, 7, 9, 10, 11, 12, 14] },
    warlock: { cantrips: [2, 2, 2, 3, 3, 3, 3, 3, 3], prepared: [2, 3, 4, 5, 6, 7, 8, 9, 10] },
    wizard: { cantrips: [3, 3, 3, 4, 4, 4, 4, 4, 4], prepared: [4, 5, 6, 7, 9, 10, 11, 12, 14] },
  };
  for (const [id, want] of Object.entries(SRD)) {
    it(`${id} prepares and knows as many as its table says`, () => {
      const sc = CLASSES[id]!.spellcasting!;
      expect(sc.preparedByLevel?.slice(0, 9)).toEqual(want.prepared);
      if (want.cantrips) expect(sc.cantripsKnownByLevel?.slice(0, 9)).toEqual(want.cantrips);
    });
  }
});

describe('Skillful (Human, SRD 5.2.1): one skill of your choice, any class', () => {
  const human = (classId: string, choices?: Record<string, string>) =>
    buildCharacter({ classId, team: 'team1', position: { x: 0, y: 0 }, speciesId: 'human', level: 1, ...(choices ? { choices } : {}) });

  it('every class gets a skill its own table lacks when nobody chooses', () => {
    for (const id of Object.keys(CLASSES)) {
      const extra = speciesSkills('human', id);
      expect(extra, id).toHaveLength(1);
      expect(CLASSES[id]!.skillProfs, `${id}'s default Skillful pick is a class skill already`).not.toContain(extra[0]);
      expect(human(id).skillProfs, id).toContain(extra[0]);
    }
  });

  it('takes the player\'s pick, whatever the class', () => {
    expect(human('barbarian', { skillful: 'arcana' }).skillProfs).toContain('arcana');
    expect(human('wizard', { skillful: 'athletics' }).skillProfs).toContain('athletics');
    expect(human('wizard', { skillful: 'athletics' }).skillProfs).not.toContain('deception');
  });

  it('is the human\'s alone', () => {
    expect(speciesSkills('dwarf', 'barbarian', { skillful: 'arcana' })).toEqual([]);
  });

  it('the campaign\'s skill checks read the same pick', () => {
    const c = newCampaign(7);
    const i = c.characters.findIndex((ch) => ch.speciesId === 'human');
    const ch = c.characters[i >= 0 ? i : 0]!;
    ch.speciesId = 'human';
    ch.choices = { ...ch.choices, skillful: 'medicine' };
    expect(characterSkillProficient(c, c.characters.indexOf(ch), 'medicine')).toBe(true);
  });
});
