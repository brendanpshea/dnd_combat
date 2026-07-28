/**
 * One lens, chosen for you.
 *
 * The gate used to offer every knowledge skill that saw anything — up to four
 * buttons, which at 430px wide was most of a phone screen of chips before you
 * reached the doors they were about. It was also four decisions with no basis:
 * you cannot swap a wizard for a cleric between fights, so "which of my party's
 * knowledge skills" is answered the same way every time.
 *
 * What survives is the decision that was always the real one — study, or walk
 * in blind — and it fits on one button.
 */
import { describe, it, expect } from 'vitest';
import { bestLens, loreDc, loreTargets, LORE_SKILL } from '../src/arena/lore.js';
import type { SkillId } from '../src/data/classes.js';

/** A party good at one skill and hopeless at everything else. */
const goodAt = (skill: SkillId, bonus = 9) => (s: SkillId) => (s === skill ? bonus : -3);
const flat = (bonus: number) => () => bonus;

describe('picking the lens', () => {
  it('says nothing when nothing out there is recognisable', () => {
    expect(bestLens([], flat(5))).toBeUndefined();
    expect(bestLens(['not-a-monster'], flat(5))).toBeUndefined();
  });

  it('takes the lens that sees more, all else equal', () => {
    // Three humanoids (History) against one beast (Nature).
    const wave = ['bandit', 'guard', 'scout', 'wolf'];
    expect(bestLens(wave, flat(4))?.skill).toBe('history');
  });

  it('prefers a check it can pass over one it cannot', () => {
    // The whole reason this is expected coverage rather than "sees the most".
    // A lens onto five creatures at a DC you will miss reveals nothing; one
    // onto two at a DC you will make reveals two.
    const wave = ['bandit', 'guard', 'scout', 'wolf', 'brown-bear'];
    expect(bestLens(wave, flat(0))?.skill, 'blind either way, so take coverage').toBe('history');
    expect(bestLens(wave, goodAt('nature'))?.skill, 'nature is the one that lands').toBe('nature');
  });

  it('reports the DC and the creatures the answer covers', () => {
    const wave = ['bandit', 'guard', 'wolf'];
    const lens = bestLens(wave, flat(4))!;
    expect(lens.dc).toBe(loreDc(wave, lens.skill));
    expect(lens.targets.sort()).toEqual(loreTargets(wave, lens.skill).sort());
    for (const id of lens.targets) {
      expect(LORE_SKILL[
        // every target must genuinely be seen by the lens offered
        (['bandit', 'guard'].includes(id) ? 'humanoid' : 'beast')
      ]).toBe(lens.skill);
    }
  });

  it('is stable — the same wave offers the same lens every time', () => {
    // A suggestion that flickers between renders is worse than a wrong one.
    const wave = ['bandit', 'wolf', 'skeleton', 'goblin-warrior'];
    const first = bestLens(wave, flat(3))!;
    for (let i = 0; i < 20; i++) expect(bestLens(wave, flat(3))!.skill).toBe(first.skill);
    // Order of the wave must not matter either.
    expect(bestLens([...wave].reverse(), flat(3))!.skill).toBe(first.skill);
  });

  it('never offers a lens that sees none of them', () => {
    const wave = ['wolf', 'brown-bear'];             // beasts: Nature only
    // Even with the party hopeless at Nature and brilliant at Arcana, Arcana
    // sees nothing here and cannot be the answer.
    expect(bestLens(wave, goodAt('arcana', 12))?.skill).toBe('nature');
  });

  it('still answers when every check is a long shot', () => {
    // Floors and caps: a hopeless party must still be offered the study rather
    // than left with an empty row and no explanation.
    const lens = bestLens(['aboleth'], flat(-5));
    expect(lens).toBeDefined();
    expect(lens!.targets).toEqual(['aboleth']);
  });
});
