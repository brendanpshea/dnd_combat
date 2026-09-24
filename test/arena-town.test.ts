/**
 * The town between arena days.
 *
 * Between days the party is in town (market, inn, temple); once through the
 * gate it stays until the day is won or lost. The rule lives in the run state
 * (`inArena`, `inTown`), so a reload lands where the party actually is, and the
 * numbers — revival bill, rests, stall — are the ones the arena already had.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { newArenaRun, advanceDay, inTown } from '../src/arena/run.js';

const ARENA = readFileSync(fileURLToPath(new URL('../web/src/Arena.tsx', import.meta.url)), 'utf8');

describe('where the party is', () => {
  it('a new run starts in town', () => {
    expect(inTown(newArenaRun(1))).toBe(true);
  });

  it('going through the gate leaves town, and the afternoon is still inside', () => {
    const inside = { ...newArenaRun(1), inArena: true };
    expect(inTown(inside)).toBe(false);
    const afternoon = advanceDay(inside, true, 0);
    expect(afternoon.half).toBe('afternoon');
    expect(inTown(afternoon)).toBe(false);
  });

  it('a won day ends back in town', () => {
    const afternoon = advanceDay({ ...newArenaRun(1), inArena: true }, true, 0);
    const tomorrow = advanceDay(afternoon, true, 10);
    expect(tomorrow.half).toBe('morning');
    expect(tomorrow.inArena).toBeUndefined();
    expect(inTown(tomorrow)).toBe(true);
  });

  it('a lost day ends back in town too, from either half', () => {
    const inside = { ...newArenaRun(1), inArena: true };
    expect(inTown(advanceDay(inside, false, 0))).toBe(true);
    expect(inTown(advanceDay(advanceDay(inside, true, 0), false, 0))).toBe(true);
  });

  it('an afternoon saved before the town existed is still inside', () => {
    expect(inTown({ ...newArenaRun(1), half: 'afternoon' })).toBe(false);
  });
});

describe('the screen', () => {
  it('reads the place from the run, not from component state', () => {
    expect(ARENA).toContain('const town = inTown(run);');
  });

  it('going in is asked once, and saved', () => {
    expect(ARENA).toContain('commit((r) => ({ ...r, inArena: true }))');
    expect(ARENA).toContain('onClick={() => setConfirmEnter(true)}');
  });

  it('inside, the way out only puts the game down', () => {
    const gate = ARENA.slice(ARENA.indexOf('{!town && ('), ARENA.indexOf('{/* /gate content */}'));
    expect(gate).toContain('Save and quit');
    expect(gate).not.toContain('Leave the arena');
  });

  it('a lost day wakes in the temple and walks out into town', () => {
    const defeat = ARENA.slice(ARENA.indexOf("if (phase.p === 'defeat') {"));
    expect(defeat).toContain('You wake in the temple.');
    expect(defeat).toContain('Out into the town');
  });

  it('the temple quotes the bill a defeat would charge', () => {
    expect(ARENA).toContain('const revival = isFirstDefeat(run) ? 0 : revivalCost(dayLevel, run.wave);');
    expect(ARENA).toContain('payRevival(c, isFirstDefeat(run) ? 0 : revivalCost(dayLevel, run.wave))');
  });

  it('shows the rest ledger once on a lost day', () => {
    const defeat = ARENA.slice(ARENA.indexOf("if (phase.p === 'defeat') {"), ARENA.indexOf('// ---- the gate'));
    expect(defeat.split('<RestLedger').length - 1).toBe(1);
  });
});
