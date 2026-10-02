/**
 * What one player reads in one playthrough shouldn't say the same thing the
 * same way three times. Each route transcript (docs/transcripts) is scanned
 * for four-word phrases (at least two of them real words) that turn up in
 * three or more different paragraphs. A phrase that repeats on purpose is a
 * motif: list it. Anything else is a tic to rewrite (guide rule 12).
 *
 * KNOWN holds the tics found when this check was written; it may only shrink.
 * A KNOWN phrase that no longer repeats fails too, so it gets struck off.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const DIR = fileURLToPath(new URL('../docs/transcripts/', import.meta.url));
const N = 4, TIMES = 3;
const STOP = new Set(("a an the and or but of to in on at by for with from up out off over into onto as is are was were be been it its it's " +
  "he she they them him her his their you your we our i me my this that these those there here not no so than then just all one two " +
  "any some what who when where how which while if do does did has have had can could will would shall should may might must says said").split(' '));

/** Phrases that repeat on purpose: names, places, and the liturgy. */
const MOTIFS = new Set([
  'the bell will wake', 'bell will wake you',      // the liturgy, on every headstone
  'door under the fen',                             // the Warden's door, by its one name
  'of the wander inn',                              // a place's name
  'mark of reeds and', 'reeds and a reaching', 'and a reaching hand', // the brand, recognised each time
]);

/** Tics found when this check was written. Strike each off as it is fixed. */
const KNOWN = new Set([
  'for the first time', 'on the far side', 'the far side of', 'far side of the', 'for a long moment',
  'braided into her hair', 'into the deep fen', 'she kept it alone', 'night of the calling',
  'from top to bottom', 'out through the crack', 'and the orc runner',
]);

function repeats(transcript: string): Map<string, number> {
  const paras = [...new Set(transcript.split('\n').filter((l) => l && !/^(#|<sub>|\*\*|_|`|\||- |\[|> )/.test(l.trim())))];
  const seen = new Map<string, number>();
  for (const p of paras) {
    const words = p.toLowerCase().replace(/\*+/g, '').replace(/[^a-z' ]+/g, ' ').split(/\s+/).filter(Boolean);
    const here = new Set<string>();
    for (let i = 0; i + N <= words.length; i++) {
      const gram = words.slice(i, i + N);
      if (gram.filter((w) => !STOP.has(w)).length >= 2) here.add(gram.join(' '));
    }
    for (const g of here) seen.set(g, (seen.get(g) ?? 0) + 1);
  }
  return new Map([...seen].filter(([, n]) => n >= TIMES));
}

describe('no route says the same thing the same way three times', () => {
  const found = new Map<string, string[]>();
  for (const f of readdirSync(DIR).filter((x) => x.endsWith('.md'))) {
    for (const [g, n] of repeats(readFileSync(DIR + f, 'utf8'))) {
      if (!MOTIFS.has(g)) found.set(g, [...(found.get(g) ?? []), `${f.replace(/\.md$/, '')} ×${n}`]);
    }
  }

  it('no new repeated phrase', () => {
    const fresh = [...found].filter(([g]) => !KNOWN.has(g)).map(([g, w]) => `"${g}" (${w.join(', ')})`);
    expect(fresh).toEqual([]);
  });

  it('every known tic still repeats (strike off the fixed ones)', () => {
    expect([...KNOWN].filter((g) => !found.has(g))).toEqual([]);
  });
});
