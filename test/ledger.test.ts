/**
 * The ledger (docs/state-ledger.md): each chapter hands on only its ledger
 * entries, an NPC has at most three fates, tallies are read only at their band
 * edges, and each chapter stays inside its budget.
 */
import { describe, it, expect } from 'vitest';
import { MODULES } from '../src/data/modules/index.js';
import { TRILOGY_NPCS } from '../src/data/modules/npcs.js';
import { LEDGER_CARRIES, MAX_FATES, LEDGER_BANDS, LEDGER_BUDGET, spend } from '../src/data/modules/ledger.js';

const trilogy = MODULES.filter((m) => m.id in LEDGER_CARRIES);

/** Every `count` requirement in a module: where a tally is read. */
function counts(v: unknown, out: Array<{ flag: string; atLeast?: number; below?: number }> = []) {
  if (Array.isArray(v)) v.forEach((x) => counts(x, out));
  else if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>;
    if (o.kind === 'count' && typeof o.flag === 'string') out.push(o as never);
    Object.values(o).forEach((x) => counts(x, out));
  }
  return out;
}

describe('the ledger', () => {
  it('covers every chapter of the trilogy', () => {
    expect(trilogy.map((m) => m.id).sort()).toEqual(Object.keys(LEDGER_CARRIES).sort());
  });

  it.each(trilogy.map((m) => [m.id, m] as const))('%s carries only its ledger entries', (id, m) => {
    expect([...(m.carries ?? [])].sort()).toEqual([...LEDGER_CARRIES[id]!].sort());
  });

  it('gives no NPC more than three fates', () => {
    const over = Object.values(TRILOGY_NPCS).filter((n) => (n.fates?.length ?? 0) > MAX_FATES).map((n) => n.id);
    expect(over).toEqual([]);
  });

  it.each(trilogy.map((m) => [m.id, m] as const))('%s reads tallies only at their band edges', (_id, m) => {
    const off = counts(m).filter((c) => c.flag in LEDGER_BANDS)
      .flatMap((c) => [c.atLeast, c.below].filter((x): x is number => x !== undefined && !LEDGER_BANDS[c.flag]!.includes(x))
        .map((x) => `${c.flag} at ${x}`));
    expect(off).toEqual([]);
  });

  it.each(trilogy.map((m) => [m.id, m] as const))('%s stays inside its budget of flags and conditional text', (id, m) => {
    const s = spend(m);
    const b = LEDGER_BUDGET[id]!;
    expect(s.flags, 'story flags').toBeLessThanOrEqual(b.flags);
    expect(s.conditional, 'conditional paragraphs').toBeLessThanOrEqual(b.conditional);
  });
});
