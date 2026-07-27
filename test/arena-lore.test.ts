/**
 * Knowing what you are about to fight.
 *
 * Four of the twelve skills the arena never used exist precisely to answer
 * "what IS that thing", and the gate screen was the obvious place to ask. What
 * these tests defend is the shape that keeps it a decision: every creature type
 * has a lens, one study covers all three doors, and it cannot be rerolled.
 */
import { describe, it, expect } from 'vitest';
import {
  LORE_SKILL, loreSkillsFor, loreTargets, loreDc, dossierFor, loreKey, studyFor,
  type LoreStudy,
} from '../src/arena/lore.js';
import { MONSTERS } from '../src/data/monsters.js';
import { SKILL_ABILITY, SKILL_LABEL, type SkillId } from '../src/data/classes.js';
import type { CreatureType, Id } from '../src/engine/types.js';
// Plain TypeScript, not the component: importing JSX into a node test breaks
// collection outright, and the rule is arithmetic about a d20 anyway.
import { checkOdds } from '../web/src/odds.js';

describe('every creature has a lens', () => {
  it('covers every creature type in the bestiary', () => {
    // A monster whose type has no lens is a monster nobody can ever identify —
    // silently, because the study would simply never offer a skill for it.
    const types = new Set<CreatureType>(Object.values(MONSTERS).map((m) => m.creatureType));
    for (const type of types) {
      expect(LORE_SKILL[type], `no lens sees a ${type}`).toBeDefined();
    }
  });

  it('uses only real, knowledge-shaped skills', () => {
    for (const [type, skill] of Object.entries(LORE_SKILL)) {
      expect(SKILL_LABEL[skill], `${type} → ${skill}`).toBeDefined();
      // All four are Intelligence skills in 5e. If one ever is not, the party
      // member who steps forward will not be the one the player expects.
      expect(SKILL_ABILITY[skill], `${type} → ${skill}`).toBe('int');
    }
  });

  it('spreads the load rather than routing everything through one skill', () => {
    const perSkill = new Map<SkillId, number>();
    for (const m of Object.values(MONSTERS)) {
      const skill = LORE_SKILL[m.creatureType];
      perSkill.set(skill, (perSkill.get(skill) ?? 0) + 1);
    }
    // Four lenses, and none of them a dump stat: every one sees a real share of
    // the bestiary, so no class's knowledge is decorative.
    expect(perSkill.size).toBe(4);
    for (const [skill, n] of perSkill) {
      expect(n, `${skill} sees only ${n} monsters`).toBeGreaterThan(10);
    }
  });
});

describe('what a lens shows', () => {
  const undead: Id[] = ['skeleton', 'zombie'];
  const beasts: Id[] = ['wolf'];

  it('offers a lens for each kind present, commonest first', () => {
    const skills = loreSkillsFor([...undead, ...beasts]);
    expect(skills).toContain('religion');
    expect(skills).toContain('nature');
    expect(skills[0], 'two undead outnumber one wolf').toBe('religion');
  });

  it('offers nothing for a line-up it cannot read', () => {
    expect(loreSkillsFor([])).toEqual([]);
    expect(loreSkillsFor(['not-a-monster'])).toEqual([]);
  });

  it('picks out only what that lens sees', () => {
    const all = [...undead, ...beasts];
    expect(loreTargets(all, 'religion').sort()).toEqual([...undead].sort());
    expect(loreTargets(all, 'nature')).toEqual(beasts);
    expect(loreTargets(all, 'arcana')).toEqual([]);
  });

  it('counts a repeated monster once', () => {
    // Three skeletons are one thing to know about, not three.
    expect(loreTargets(['skeleton', 'skeleton', 'skeleton'], 'religion')).toEqual(['skeleton']);
  });
});

describe('how hard it is to place them', () => {
  it('scales with the most dangerous thing, not with the party', () => {
    const easy = loreDc(['skeleton'], 'religion');
    const hard = loreDc(['skeleton', 'vampire-spawn'], 'religion');
    expect(hard).toBeGreaterThan(easy);
  });

  it('is never free and never hopeless', () => {
    for (const m of Object.values(MONSTERS)) {
      const dc = loreDc([m.id], LORE_SKILL[m.creatureType]);
      expect(dc, m.id).toBeGreaterThanOrEqual(10);
      expect(dc, m.id).toBeLessThanOrEqual(20);
    }
  });
});

describe('the dossier', () => {
  it('reports armour, hit points and what it shrugs off', () => {
    const d = dossierFor('skeleton')!;
    expect(d.name).toBe(MONSTERS['skeleton']!.name);
    expect(d.ac).toBe(MONSTERS['skeleton']!.ac);
    expect(d.hp).toBe(MONSTERS['skeleton']!.hp);
    expect(d.notes.length).toBeGreaterThan(0);
  });

  it('always says something, even about a plain creature', () => {
    // An empty notes list would render as a name and two numbers, which reads
    // like the study failed rather than like the thing is simply unremarkable.
    for (const m of Object.values(MONSTERS)) {
      expect(dossierFor(m.id)!.notes.length, m.id).toBeGreaterThan(0);
    }
  });

  it('shouts about a vulnerability, because that is the actionable one', () => {
    const vulnerable = Object.values(MONSTERS).find((m) => m.vulnerabilities?.length);
    if (!vulnerable) return;   // none in the bestiary today; the guard still holds
    expect(dossierFor(vulnerable.id)!.notes.some((n) => n.startsWith('VULNERABLE'))).toBe(true);
  });

  it('returns nothing for something that is not a monster', () => {
    expect(dossierFor('not-a-monster')).toBeUndefined();
  });
});

describe('one study per fight', () => {
  const study = (key: string): LoreStudy => ({
    key, skill: 'arcana', by: 0, natural: 12, total: 17, dc: 13, success: true,
  });

  it('holds for the fight it was made in', () => {
    const s = study(loreKey(3, 'morning'));
    expect(studyFor(s, 3, 'morning')).toBe(s);
  });

  it('does not carry into the afternoon, which is a different line-up', () => {
    expect(studyFor(study(loreKey(3, 'morning')), 3, 'afternoon')).toBeUndefined();
  });

  it('does not carry into tomorrow', () => {
    expect(studyFor(study(loreKey(3, 'morning')), 4, 'morning')).toBeUndefined();
  });

  it('CANNOT be rerolled by switching doors', () => {
    // The load-bearing one. The key has no door in it, so a study made while
    // looking at door 1 is the same study when you look at door 3 — otherwise
    // you could study three times a fight and take the best answer, which is
    // not a check at all.
    const s = study(loreKey(2, 'morning'));
    expect(studyFor(s, 2, 'morning')).toBe(s);
    expect(loreKey(2, 'morning')).not.toContain('door');
  });

  it('treats a run that has never studied as unstudied', () => {
    expect(studyFor(undefined, 1, 'morning')).toBeUndefined();
  });
});

describe('when the dice do not matter, say so', () => {
  /**
   * A +7 against DC 13 cannot fail; a −1 against DC 20 cannot succeed. Rolling
   * either is theatre, and theatre that pretends a foregone conclusion was in
   * doubt is worse than no animation at all.
   */
  it('knows a check that cannot fail', () => {
    expect(checkOdds(12, 13), 'a natural 1 still clears it').toBe('certain');
    expect(checkOdds(13, 13)).toBe('certain');
    expect(checkOdds(11, 13), 'a natural 1 falls one short').toBe('live');
  });

  it('knows a check that cannot succeed', () => {
    expect(checkOdds(-1, 20), 'a natural 20 falls one short').toBe('impossible');
    expect(checkOdds(0, 20), 'a natural 20 lands exactly on it').toBe('live');
  });

  it('calls everything in between live', () => {
    for (let bonus = 0; bonus <= 10; bonus++) {
      expect(checkOdds(bonus, bonus + 10), `+${bonus}`).toBe('live');
    }
  });
});
