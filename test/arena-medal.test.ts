/**
 * The finish line, and the grade.
 *
 * A run had no terminus, which meant there was nothing to be good at — only a
 * number to push. What these tests defend is that the line sits beyond the
 * implemented content, that a run's own win rate is counted honestly, and that
 * the medal separates a run solved from a run ground out.
 */
import { describe, it, expect } from 'vitest';
import {
  RUN_TARGET_XP, runComplete, medalFor, summarise,
} from '../src/arena/medal.js';
import { newArenaRun, advanceDay, winRate } from '../src/arena/run.js';
import { LEVEL_XP, MAX_LEVEL } from '../src/campaign/campaign.js';

describe('the finish line', () => {
  it('sits past the top of the implemented levels', () => {
    // The whole trick: the run ends exactly where the content does, so no
    // eighth tier of class features has to exist for it to work.
    expect(MAX_LEVEL).toBe(7);
    expect(RUN_TARGET_XP).toBeGreaterThan(LEVEL_XP[MAX_LEVEL - 1]!);
  });

  it('is crossed by experience alone', () => {
    expect(runComplete(RUN_TARGET_XP - 1)).toBe(false);
    expect(runComplete(RUN_TARGET_XP)).toBe(true);
    expect(runComplete(RUN_TARGET_XP + 5000)).toBe(true);
  });
});

describe('a won morning counts as a win', () => {
  /**
   * This is the regression that motivated the whole file. `advanceDay` used to
   * route a won morning through `recordResult`'s LOSS path, because that is the
   * branch which leaves the wave alone — so every won morning was tallied as a
   * defeat. Roughly half of all fights are mornings, and the run reported a win
   * rate near a fifth of its true value. Nothing depended on the number until a
   * medal was graded on it.
   */
  it('records the morning as a fight won, without clearing the wave', () => {
    let run = newArenaRun(1);
    run = advanceDay(run, true, 0);
    expect(run.fights).toBe(1);
    expect(run.wins, 'the morning was WON').toBe(1);
    expect(run.wave, 'but nothing has cleared yet').toBe(1);
    expect(run.cleared).toBe(0);
    expect(run.attempts, 'and it is not a fresh attempt at anything').toBe(0);
  });

  it('reports a perfect run as a perfect run', () => {
    let run = newArenaRun(1);
    for (let day = 0; day < 5; day++) {
      run = advanceDay(run, true, 0);     // morning
      run = advanceDay(run, true, 50);    // afternoon
    }
    expect(run.fights).toBe(10);
    expect(run.wins).toBe(10);
    expect(run.cleared).toBe(5);
    expect(winRate(run)).toBe(1);
    expect(summarise(run, 0).winRate).toBe(100);
  });

  it('counts a lost afternoon as one loss, not as a lost day of fights', () => {
    let run = newArenaRun(1);
    run = advanceDay(run, true, 0);       // morning won
    run = advanceDay(run, false, 0);      // afternoon lost
    expect(run.fights).toBe(2);
    expect(run.wins).toBe(1);
    expect(summarise(run, 0).winRate).toBe(50);
  });

  it('still keeps what a fight taught, whichever half it was', () => {
    let run = newArenaRun(1);
    run = advanceDay(run, true, 0, { spellsUsed: ['fireball'], bounties: 1 });
    expect(run.spellsUsed, 'a morning spell is a spell you have cast').toContain('fireball');
    expect(run.bounties).toBe(1);
    run = advanceDay(run, false, 0, { spellsUsed: ['shield'] });
    expect(run.spellsUsed, 'so is one from a fight you lost').toContain('shield');
  });
});

describe('the medal', () => {
  it('grades on win rate, with gold above anything grinding produces', () => {
    // Measured: runs that finished by grinding land between 42% and 70%. Gold
    // starts at 75, so it cannot be reached by out-levelling the problem.
    expect(medalFor(100)).toBe('gold');
    expect(medalFor(75)).toBe('gold');
    expect(medalFor(74)).toBe('silver');
    expect(medalFor(65)).toBe('silver');
    expect(medalFor(64)).toBe('bronze');
    expect(medalFor(55)).toBe('bronze');
    expect(medalFor(54)).toBe('iron');
    expect(medalFor(0)).toBe('iron');
  });

  it('is awarded only for finishing', () => {
    const run = { fights: 10, wins: 10, cleared: 5, clearedFirstTry: 5, day: 6 };
    expect(summarise(run, RUN_TARGET_XP - 1).medal, 'a perfect unfinished run').toBeUndefined();
    expect(summarise(run, RUN_TARGET_XP).medal).toBe('gold');
  });

  it('summarises an unfinished run rather than refusing to', () => {
    // Every run ends on this screen, including the ones that ended broke.
    const run = { fights: 7, wins: 3, cleared: 1, clearedFirstTry: 0, day: 4 };
    const s = summarise(run, 900);
    expect(s.completed).toBe(false);
    expect(s.winRate).toBe(43);
    expect(s.days, 'days elapsed, not the day you are on').toBe(3);
    expect(s.xp).toBe(900);
  });

  it('does not divide by zero before the first fight', () => {
    const s = summarise(newArenaRun(1), 0);
    expect(s.winRate).toBe(0);
    expect(s.days).toBe(0);
  });
});
