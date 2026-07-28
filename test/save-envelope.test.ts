/**
 * The version stamp, and the difference it is there to draw.
 *
 * The campaign and arena saves carried no version. Both parsers are defensive —
 * an unreadable blob returns undefined — and the caller reads undefined as "no
 * save", so the screen quietly offers a fresh start.
 *
 * That is right for a corrupt save and a catastrophe for an old one: the day a
 * shipped update changes a field these parsers rely on, every party in progress
 * becomes a New Game button and nobody is told the save existed.
 *
 * So the tests that matter are about TELLING THE DIFFERENCE, not about
 * migrating: an old save must still load, a future one must be recognised
 * rather than eaten, and every case that is not simply "no save" must produce
 * something to say out loud.
 */
import { describe, it, expect } from 'vitest';
import { wrap, unwrap, loadProblem, SAVE_VERSION } from '../web/src/saveEnvelope.js';

describe('the save envelope', () => {
  it('round-trips what it wrapped', () => {
    const data = { party: ['a', 'b'], xp: 900 };
    const u = unwrap(wrap(data));
    expect(u.kind).toBe('ok');
    if (u.kind !== 'ok') return;
    expect(JSON.parse(u.raw)).toEqual(data);
    expect(u.version).toBe(SAVE_VERSION);
  });

  it('still reads a save written before versioning existed', () => {
    // THE compatibility case. Every save on every player's machine right now is
    // an unwrapped blob; if this returned unreadable, shipping the stamp would
    // itself be the data loss it exists to prevent.
    const legacy = JSON.stringify({ xp: 2700, characters: [{ name: 'Cedric' }] });
    const u = unwrap(legacy);
    expect(u.kind).toBe('ok');
    if (u.kind !== 'ok') return;
    expect(u.version, 'an unstamped save is version 0').toBe(0);
    expect(JSON.parse(u.raw).xp).toBe(2700);
  });

  it('recognises a save from a newer build instead of eating it', () => {
    const future = JSON.stringify({ v: SAVE_VERSION + 5, data: { xp: 1 } });
    const u = unwrap(future);
    expect(u.kind).toBe('future');
    // And says so, rather than silently offering a new game.
    expect(loadProblem(u, true)).toMatch(/newer version/i);
  });

  it('leaves a future save on disk rather than overwriting it', () => {
    // Implied by returning `future` rather than `ok`: the caller gets no state
    // to load, so nothing downstream can write over it by accident. Asserted
    // because "we did not touch it" is the promise the message makes.
    const future = JSON.stringify({ v: SAVE_VERSION + 1, data: { xp: 5 } });
    expect(unwrap(future)).not.toHaveProperty('raw');
    expect(loadProblem(unwrap(future), true)).toMatch(/left untouched/i);
  });

  it('calls a corrupt blob unreadable, and says so only if there was one', () => {
    expect(unwrap('{not json').kind).toBe('unreadable');
    expect(unwrap('null').kind).toBe('unreadable');
    // Nothing stored at all is not a problem and needs no words.
    expect(unwrap(null).kind).toBe('unreadable');
    expect(loadProblem(unwrap(null), false), 'no save is not an error').toBeUndefined();
    expect(loadProblem(unwrap('{not json'), true)).toMatch(/could not be read/i);
  });

  it('does not mistake a wrapped save for an unwrapped one, or vice versa', () => {
    // The ambiguity worth ruling out: a legacy campaign that happened to have a
    // numeric field called `v` would be misread as an envelope. It needs BOTH
    // `v` and `data` to count as one.
    const decoy = JSON.stringify({ v: 1, xp: 300 });
    const u = unwrap(decoy);
    expect(u.kind).toBe('ok');
    if (u.kind !== 'ok') return;
    expect(u.version, 'no `data` field, so not an envelope').toBe(0);
    expect(JSON.parse(u.raw).xp).toBe(300);
  });
});
