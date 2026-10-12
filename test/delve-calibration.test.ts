/**
 * Delve balance, played through. A sim (vitest.config.ts SIM_TESTS): slow,
 * nightly, never a deploy gate.
 *
 * The fight shares in delve-spec.ts (`SHARES`) were measured with
 * scripts/delve-sim.ts — whole delves, a careful player, the real engine on
 * both sides — and this is the tripwire that says when they no longer hold.
 * When it fires, re-measure with the script before touching a number: the
 * bands are wide on purpose (24 delves a level is ±9 points), so a failure
 * here is a real move, not noise.
 */
import { describe, it, expect } from 'vitest';
import { generateSpecDelve, type DelveSpec } from '../src/adventure/delve-spec.js';
import { simulateDelve, type DelveResult } from '../scripts/delve-sim.js';

const N = 24;
function measure(level: number, fights: NonNullable<DelveSpec['fights']>): { cleared: number; boss: number; rooms: number } {
  const res: DelveResult[] = [];
  for (let s = 5000; s < 5000 + N; s++) {
    const { module } = generateSpecDelve(s, { level, fights, theme: 'stone' });
    res.push(simulateDelve(module, s, level));
  }
  const firsts = res.flatMap((r) => r.fights.filter((f) => f.first));
  const rate = (k: string) => { const f = firsts.filter((x) => x.kind === k); return f.filter((x) => x.won).length / f.length; };
  return { cleared: res.filter((r) => r.won).length / N, boss: rate('goal'), rooms: rate('room') };
}

describe('a generated delve, played through', () => {
  it.each([1, 2, 3, 4, 5])('at level %i: rooms nearly always won, the boss usually at the first try, the delve usually cleared', (level) => {
    const m = measure(level, 'generated');
    const at = `L${level}: ${JSON.stringify(m)}`;
    expect(m.rooms, at).toBeGreaterThan(0.88);
    expect(m.boss, `${at} — the boss is too hard`).toBeGreaterThan(0.6);
    expect(m.boss, `${at} — the boss is a formality`).toBeLessThan(0.98);
    expect(m.cleared, at).toBeGreaterThan(0.7);
  }, 300_000);

  it('held by a faction, at level 3: the same', () => {
    const m = measure(3, 'inhabitants');
    expect(m.boss, JSON.stringify(m)).toBeGreaterThan(0.6);
    expect(m.cleared, JSON.stringify(m)).toBeGreaterThan(0.7);
  }, 300_000);
});
