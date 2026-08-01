/**
 * The background a class falls into decides a FEAT, so it has to be decided.
 *
 * THE PROBLEM THIS EXISTS FOR
 *
 * `DEFAULT_BY_CLASS` was written to spread skill coverage across a party, and
 * `BACKGROUND_FEAT` hangs an origin feat off each background — so a table
 * chosen for one reason quietly decided another. Six of the twelve classes
 * landed on Magic Initiate (Cleric), which is why it read as the default feat
 * for nearly every character. Reported that way.
 *
 * The worst case was the BARBARIAN. It defaulted to Guide, which grants Magic
 * Initiate, and a barbarian cannot cast at all while raging — so the one class
 * whose entire turn is raging carried a feat it could never use.
 *
 * And two classes were not in the table at all. Warlock and sorcerer fell
 * through to Wayfarer without anyone choosing it — the same hand-kept-table
 * drift that left warlocks with no glyph in `class-look.test.ts`.
 */
import { describe, it, expect } from 'vitest';
import { CLASSES } from '../src/data/classes.js';
import { BACKGROUNDS, defaultBackgroundFor } from '../src/data/backgrounds.js';
import { ORIGIN_FEATS, defaultFeatFor } from '../src/data/feats.js';
import { buildCharacter } from '../src/builder/character.js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const source = readFileSync(
  fileURLToPath(new URL('../src/data/backgrounds.ts', import.meta.url)), 'utf8');

const classIds = Object.keys(CLASSES);

/** The feat a class gets when the player never opens the picker. */
const featOf = (classId: string) => defaultFeatFor(defaultBackgroundFor(classId));

/** A feat that hands out spells, by what it grants rather than by its name. */
const isSpellFeat = (featId: string | undefined) => {
  const g = featId ? ORIGIN_FEATS[featId]?.grants : undefined;
  return !!g && ((g.spellIds?.length ?? 0) > 0 || (g.innateSpells?.length ?? 0) > 0);
};

describe('every class has a background chosen for it', () => {
  it.each(classIds)('%s maps to a real background', (id) => {
    const bg = defaultBackgroundFor(id);
    expect(BACKGROUNDS, `${id} defaults to a background that does not exist`).toHaveProperty(bg);
  });

  it('names every class explicitly rather than falling through', () => {
    // `defaultBackgroundFor` ends in `?? 'wayfarer'`, so a class missing from
    // the table still gets *a* background and nothing looks broken. That is how
    // warlock and sorcerer went unnoticed. Anything landing on the fallback has
    // to be there because somebody chose it.
    const onFallback = classIds.filter((id) => defaultBackgroundFor(id) === 'wayfarer');
    for (const id of onFallback) {
      expect(source, `${id} lands on the Wayfarer fallback without being named in DEFAULT_BY_CLASS`)
        .toMatch(new RegExp(`^\\s*${id}:\\s*'wayfarer'`, 'm'));
    }
  });

  it('gives every class a feat', () => {
    for (const id of classIds) {
      expect(featOf(id), `${id} gets no origin feat at all`).toBeDefined();
      expect(ORIGIN_FEATS, `${id}'s default feat does not exist`).toHaveProperty(featOf(id)!);
    }
  });
});

describe('nobody defaults into a feat they cannot use', () => {
  it('never gives a barbarian a spellcasting feat', () => {
    // Rage forbids casting outright, so this is not a matter of taste: it would
    // be a dead feat on the class that rages every fight.
    expect(isSpellFeat(featOf('barbarian')),
      `a barbarian defaults to ${featOf('barbarian')}, which grants spells it cannot cast while raging`)
      .toBe(false);
  });

  it('keeps spellcasting feats to classes that cast', () => {
    const casters = new Set(classIds.filter((id) => CLASSES[id]!.spellcasting));
    const wrong = classIds.filter((id) => isSpellFeat(featOf(id)) && !casters.has(id));
    expect(wrong, `these non-casters default to a spellcasting feat: ${wrong.join(', ')}`)
      .toEqual([]);
  });

  it('spreads the feats instead of handing one to everybody', () => {
    // Six of twelve on Magic Initiate is what made this visible. Half the roster
    // on a single feat means the choice is not a choice.
    const counts = new Map<string, number>();
    for (const id of classIds) {
      const f = featOf(id)!;
      counts.set(f, (counts.get(f) ?? 0) + 1);
    }
    const worst = [...counts].sort((a, b) => b[1] - a[1])[0]!;
    expect(worst[1], `${worst[0]} is the default for ${worst[1]} of ${classIds.length} classes`)
      .toBeLessThanOrEqual(Math.ceil(classIds.length / 3));
  });

  it('uses more than a couple of the feats that exist', () => {
    // A feat nothing defaults to is reachable only by a player who opens the
    // picker and happens to want it — the dead-data shape one step removed.
    const used = new Set(classIds.map((id) => featOf(id)));
    expect(used.size, `only ${used.size} of ${Object.keys(ORIGIN_FEATS).length} origin feats are ever a default`)
      .toBeGreaterThanOrEqual(Object.keys(ORIGIN_FEATS).length - 1);
  });
});

describe('the default actually reaches the character', () => {
  it('builds a barbarian with no spells from its background', () => {
    // The end-to-end version: whatever the tables say, what matters is what a
    // built barbarian is carrying.
    const bar = buildCharacter({
      classId: 'barbarian', team: 'team1', position: { x: 0, y: 0 }, level: 5,
      featIds: [featOf('barbarian')!],
    });
    expect(bar.spellIds, 'a barbarian was built holding spells from its origin feat').toEqual([]);
  });

  it('still builds a cleric that gets something from its feat', () => {
    // The guard must not have been implemented by giving nobody anything.
    const cle = buildCharacter({
      classId: 'cleric', team: 'team1', position: { x: 0, y: 0 }, level: 5,
      featIds: [featOf('cleric')!],
    });
    expect(cle.spellIds.length, 'a cleric got nothing from Magic Initiate').toBeGreaterThan(0);
  });
});
