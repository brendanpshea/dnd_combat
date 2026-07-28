/**
 * Every cover image has a small derivative, and nothing is left over.
 *
 * The launch screen paints scene and board backdrops into a band 150px tall.
 * Serving the full-size files there cost 364 KB on the very first screen —
 * more than the tokens and portraits of a whole fight, and ahead of them in the
 * queue on a slow connection. `art/make_thumbs.py` writes the derivatives and
 * `thumbUrl` points the cards at them.
 *
 * Which makes a missing thumb a broken cover on the first screen a new player
 * ever sees, arriving the moment somebody adds a backdrop and forgets the
 * generator. Same standing rule as the art registry and the SVG terrain: the
 * derived thing is a function of the source, and a test is what stops the two
 * drifting.
 *
 * A filesystem check rather than a run of the generator, deliberately — Python
 * and Pillow are not a dependency of the test suite, and the cheap half of
 * `--check` is the half that catches the mistake anyone actually makes.
 */
import { describe, it, expect } from 'vitest';
import { readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ART = fileURLToPath(new URL('../web/public/art/', import.meta.url));
const THUMB = `${ART}thumb/`;

const covers = readdirSync(ART).filter((f) => /^(scene|bg)-.+\.webp$/.test(f));
const thumbs = new Set(readdirSync(THUMB));

describe('cover thumbnails', () => {
  it('finds the covers it is meant to be checking', () => {
    // Guards the guard: a glob that matched nothing would pass every assertion
    // below while checking absolutely nothing.
    expect(covers.length).toBeGreaterThan(20);
  });

  it('has one for every scene and board backdrop', () => {
    const missing = covers.filter((f) => !thumbs.has(`thumb-${f}`));
    expect(missing, 'run: python3 art/make_thumbs.py').toEqual([]);
  });

  it('has no thumb whose source has gone', () => {
    const sources = new Set(covers.map((f) => `thumb-${f}`));
    expect([...thumbs].filter((f) => !sources.has(f))).toEqual([]);
  });

  it('is actually smaller than what it stands in for', () => {
    // The whole point. A thumb that is not much smaller than its source is a
    // regenerate at the wrong settings, which would pass every check above.
    for (const f of covers) {
      const full = statSync(ART + f).size;
      const small = statSync(THUMB + `thumb-${f}`).size;
      expect(small, f).toBeLessThan(full * 0.6);
    }
  });
});
