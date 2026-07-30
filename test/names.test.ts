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
import { HERO_NAMES, RIVAL_NAMES, defaultNameFor, randomNameFor, NAMED_SPECIES } from '../src/builder/names.js';
import { seedRng } from '../src/engine/rng.js';
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

/**
 * A name may not assert a gender, because there is no picture for it to be
 * right about.
 *
 * Portraits here are per-CLASS, not per-character: every cleric wears the same
 * face and so does every paladin. A name that commits to a gender is therefore
 * a coin flip against art that cannot change — and it kept losing. The cleric
 * portrait is a woman and the rival cleric was "Brother Mordred"; the paladin
 * portrait is a woman and the hero paladin was "Ser Roland". The tutorial had
 * already been caught doing the same thing with "Brother Alden".
 *
 * The mechanically checkable part is the honorifics. Whether a given name reads
 * as one gender is a judgement, and the curation note in `names.ts` is where
 * that judgement is recorded — but an honorific is unambiguous, and it is how
 * every instance of this bug so far has announced itself.
 */
describe('names do not claim a gender the art cannot back', () => {
  const HONORIFICS = ['Sir', 'Ser', 'Dame', 'Brother', 'Sister', 'Lady', 'Lord', 'Madam', 'Mister'];

  const everyName = () => [
    ...Object.values(HERO_NAMES),
    ...Object.values(RIVAL_NAMES),
    ...NAMED_SPECIES.flatMap((sp) => {
      // Draw a good sample from each pool rather than reaching into the table.
      let st = seedRng(7);
      const out: string[] = [];
      for (let i = 0; i < 300; i++) {
        const r = randomNameFor(sp, st);
        out.push(r.value);
        st = r.state;
      }
      return out;
    }),
  ];

  it('uses no gendered honorific anywhere', () => {
    for (const name of everyName()) {
      for (const h of HONORIFICS) {
        expect(name, `"${name}" carries the honorific "${h}"`)
          .not.toMatch(new RegExp(`\\b${h}\\b`));
      }
    }
  });

  it('still gives each class a distinct name on each side', () => {
    // The reason two tables exist: one list would put Arthur against Arthur,
    // and the narration bar has no team tags to tell them apart.
    for (const classId of Object.keys(HERO_NAMES)) {
      expect(RIVAL_NAMES[classId], `${classId} has no rival name`).toBeDefined();
      expect(HERO_NAMES[classId]).not.toBe(RIVAL_NAMES[classId]);
    }
  });

  it('keeps every species pool as wide as it was', () => {
    // Neutralising the pools must not quietly shrink them — a short pool means
    // a party of four with two of the same name.
    for (const sp of NAMED_SPECIES) {
      const seen = new Set<string>();
      let st = seedRng(3);
      for (let i = 0; i < 400; i++) {
        const r = randomNameFor(sp, st);
        seen.add(r.value.split(' ')[0]!);
        st = r.state;
      }
      expect(seen.size, `${sp} draws from only ${seen.size} first names`).toBeGreaterThanOrEqual(12);
    }
  });
});
