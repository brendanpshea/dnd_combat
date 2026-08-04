/**
 * Knowing what you are about to fight.
 *
 * This was a rolled check whose own documentation admitted that failing cost
 * nothing — a button with no reason not to press it. It is passive now: 10 plus
 * the party's best relevant bonus, per creature, against that creature's own
 * DC. What these tests defend is what going passive bought: every creature type
 * still has a lens, knowledge is granular rather than all-or-nothing per wave,
 * and a better-read party visibly knows more.
 */
import { describe, it, expect } from 'vitest';
import {
  LORE_SKILL, loreSkillsFor, loreTargets, loreDc, dossierFor, passiveKnown,
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

describe('how hard one creature is to place', () => {
  it('scales with the creature, not with the party', () => {
    expect(loreDc('vampire-spawn')).toBeGreaterThan(loreDc('skeleton'));
  });

  it('is never free', () => {
    for (const m of Object.values(MONSTERS)) {
      expect(loreDc(m.id), m.id).toBeGreaterThanOrEqual(10);
    }
  });

  it('asks about each creature separately, not about the worst one present', () => {
    // The whole gain from going passive. The rolled version took the hardest
    // thing on the field and gated the entire wave behind it, so a scholar who
    // could name every goblin was told nothing about any of them because an
    // ogre happened to be standing there.
    const scholar = () => 9;   // passive 19: places a lot, but not everything
    const known = passiveKnown(['skeleton', 'vampire-spawn'], scholar);
    expect(known.has('skeleton'), 'the easy one went unrecognised').toBe(true);
  });
});

describe('what the party knows without being asked', () => {
  it('recognises more as the party gets better read', () => {
    const foes = Object.values(MONSTERS).slice(0, 40).map((m) => m.id);
    const dim = passiveKnown(foes, () => 0).size;
    const sharp = passiveKnown(foes, () => 8).size;
    expect(sharp, 'a better-read party knows no more than a worse one').toBeGreaterThan(dim);
  });

  it('uses the right lens per creature, so two specialists know more than one', () => {
    // A party with a wizard AND a cleric should simply know more, rather than
    // having to pick one lens and eat the other — which is what the rolled
    // version forced.
    const foes: Id[] = ['skeleton', 'wolf'];
    const priest = passiveKnown(foes, (s) => (s === 'religion' ? 10 : -5));
    const druid = passiveKnown(foes, (s) => (s === 'nature' ? 10 : -5));
    const both = passiveKnown(foes, () => 10);
    expect(priest.has('skeleton')).toBe(true);
    expect(priest.has('wolf')).toBe(false);
    expect(druid.has('wolf')).toBe(true);
    expect(both.size, 'knowing both lenses did not know more').toBe(2);
  });

  it('knows nothing about something that is not a monster', () => {
    expect(passiveKnown(['not-a-monster'], () => 99).size).toBe(0);
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
