/**
 * The quasit in the rafters.
 *
 * The commentary exists to teach the day model in character, so what these
 * tests defend is mostly restraint: every line fires at most once per run, a
 * cue with no line is a silent failure, and the speaker has to be someone the
 * SRD actually contains.
 */
import { describe, it, expect } from 'vitest';
import {
  CHORUS, CHORUS_SPEAKER, chorusLine, firstUnheard, type ChorusCue,
} from '../src/arena/chorus.js';
import { MONSTERS } from '../src/data/monsters.js';
import { newArenaRun } from '../src/arena/run.js';

const CUES = Object.keys(CHORUS) as ChorusCue[];

describe('the lines themselves', () => {
  it('has something to say for every cue', () => {
    // A cue with no line is the quietest possible bug: the moment arrives, the
    // bubble does not, and nothing anywhere complains.
    for (const cue of CUES) {
      expect(CHORUS[cue], cue).toBeTruthy();
      expect(CHORUS[cue].length, cue).toBeGreaterThan(20);
    }
  });

  it('says each thing only once across the whole pool', () => {
    // Two cues sharing a line means one of them is dead weight — the player
    // hears the same sentence twice and learns nothing the second time.
    const seen = new Set(Object.values(CHORUS));
    expect(seen.size).toBe(CUES.length);
  });

  it('keeps every line short enough to actually be read', () => {
    // A wall of text in a speech bubble gets skipped, and a skipped line
    // teaches nothing at all.
    for (const cue of CUES) expect(CHORUS[cue].length, cue).toBeLessThan(320);
  });
});

describe('the speaker', () => {
  it('is a creature the bestiary knows, so it has a face', () => {
    expect(MONSTERS[CHORUS_SPEAKER.portraitId], 'quasit missing from the bestiary').toBeDefined();
  });

  it('is named in the SRD rather than invented', () => {
    // The moon-touched lesson: check the licensed text before committing to a
    // name, not after somebody notices.
    expect(MONSTERS[CHORUS_SPEAKER.portraitId]!.name).toBe('Quasit');
  });
});

describe('hearing it once', () => {
  it('offers a line the first time and nothing after', () => {
    expect(chorusLine('firstDefeat', [])).toBe(CHORUS.firstDefeat);
    expect(chorusLine('firstDefeat', ['firstDefeat'])).toBeUndefined();
  });

  it('is not confused by other cues already heard', () => {
    expect(chorusLine('firstLunch', ['arrival', 'firstGate'])).toBe(CHORUS.firstLunch);
  });

  it('picks the first unheard cue in priority order', () => {
    // Several things can be true at one moment — a defeat that is also the
    // first bill that also nearly empties the purse — and he gets one of them.
    expect(firstUnheard(['soldToPay', 'firstBill', 'firstDefeat'], [])).toBe('soldToPay');
    expect(firstUnheard(['soldToPay', 'firstBill', 'firstDefeat'], ['soldToPay'])).toBe('firstBill');
    expect(firstUnheard(['soldToPay', 'firstBill'], ['soldToPay', 'firstBill'])).toBeUndefined();
  });

  it('falls silent once a run has heard everything', () => {
    for (const cue of CUES) expect(chorusLine(cue, CUES)).toBeUndefined();
  });

  it('treats a missing `heard` as having heard nothing', () => {
    // Saves written before the quasit existed, and every fresh run.
    expect(newArenaRun(1).heard).toBeUndefined();
    expect(chorusLine('arrival')).toBe(CHORUS.arrival);
    expect(firstUnheard(['arrival'])).toBe('arrival');
  });
});
