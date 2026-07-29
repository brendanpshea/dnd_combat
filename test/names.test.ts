/**
 * Every class needs a name on both sides.
 *
 * `defaultNameFor` falls back to the CLASS name, which is the correct runtime
 * behaviour and a silent failure in development. `names.ts` says exactly what
 * that costs, in its own header:
 *
 *   "A name is what makes a combat log read like a story instead of a
 *    spreadsheet... Two sets, because both sides of a skirmish are generated
 *    parties: one list would put Sir Arthur against Sir Arthur."
 *
 * The warlock and the sorcerer shipped with no entry in either list, so a
 * skirmish put "Sorcerer" against "Sorcerer" — the two failures that file
 * exists to prevent, both at once, in the narration bar that speaks plain
 * English and has no team tags to tell them apart. Found by reading an
 * initiative order in the browser, not by any test.
 *
 * The same shape as the missing forge blurbs, and it will be the same shape for
 * the thirteenth class: a lookup table beside a list of ids, with a fallback
 * that hides the gap.
 */
import { describe, it, expect } from 'vitest';
import { HERO_NAMES, RIVAL_NAMES, defaultNameFor } from '../src/builder/names.js';
import { CLASSES } from '../src/data/classes.js';

describe('default party names', () => {
  it('names every class on both sides', () => {
    const ids = Object.keys(CLASSES);
    const missingHero = ids.filter((id) => !HERO_NAMES[id]);
    const missingRival = ids.filter((id) => !RIVAL_NAMES[id]);
    expect(missingHero, `no hero name: ${missingHero.join(', ')}`).toEqual([]);
    expect(missingRival, `no rival name: ${missingRival.join(', ')}`).toEqual([]);
  });

  it('never gives a hero the bare class name', () => {
    // The fallback. A combatant called "Sorcerer" is the spreadsheet the whole
    // file is written to avoid.
    for (const [id, cls] of Object.entries(CLASSES)) {
      for (const team of ['team1', 'team2'] as const) {
        expect(defaultNameFor(id, team), `${id}/${team}`).not.toBe(cls.name);
      }
    }
  });

  it('never puts a name against itself in a mirror match', () => {
    for (const id of Object.keys(CLASSES)) {
      expect(defaultNameFor(id, 'team1'), id).not.toBe(defaultNameFor(id, 'team2'));
    }
  });

  it('keeps every name distinct within a side', () => {
    // Two heroes sharing a name is the same unreadable narration as a mirror
    // match, and a copy-paste is the obvious way to get there.
    for (const [label, table] of [['hero', HERO_NAMES], ['rival', RIVAL_NAMES]] as const) {
      const used = Object.values(table);
      expect(new Set(used).size, `duplicate ${label} names in ${used.join(', ')}`).toBe(used.length);
    }
  });
});
