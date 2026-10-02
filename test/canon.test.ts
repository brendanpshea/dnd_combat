/**
 * Canon facts: a place's name, a price, a count, written once and said by
 * token, so the text and the number rules use can't drift apart.
 */
import { describe, it, expect } from 'vitest';
import { withCanon } from '../src/adventure/npcs.js';
import { validateModule } from '../src/adventure/validate.js';
import type { CanonFact, Module, NpcDef } from '../src/adventure/types.js';

const FACTS: Record<string, CanonFact> = {
  thornwick: { text: 'Thornwick' },
  'drowned-gold': { text: 'fifty-five gold', value: 55 },
};
const NPCS: Record<string, NpcDef> = { wren: { id: 'wren', name: 'Wren' } };
const raw = (line: string): Module => ({
  id: 'c', title: 'C', blurb: '', start: 'a', scenes: {
    a: { id: 'a', kind: 'story', text: [line], next: [
      { id: 'take', label: 'Take the {drowned-gold}', to: 'won', effects: [{ kind: 'gold', amount: FACTS['drowned-gold']!.value! }] },
    ] },
    won: { id: 'won', kind: 'ending', outcome: 'victory', text: ['Done.'] },
  },
});

describe('canon facts', () => {
  it('resolve by token, beside NPC names, and capitalise to open a sentence', () => {
    const m = withCanon(raw('{^drowned-gold}, says {wren}, back in {thornwick}.'), { npcs: NPCS, facts: FACTS });
    const a = m.scenes.a;
    if (a?.kind !== 'story') throw new Error();
    expect(a.text).toEqual(['Fifty-five gold, says Wren, back in Thornwick.']);
    expect(a.next[0]!.label).toBe('Take the fifty-five gold');
    expect(a.next[0]!.effects).toEqual([{ kind: 'gold', amount: 55 }]);
    expect(m.facts).toBe(FACTS);
    expect(validateModule(m)).toEqual([]);
  });

  it('an unknown token, or an id that is both a person and a fact, is an error at load', () => {
    expect(() => withCanon(raw('{thornwik}.'), { facts: FACTS })).toThrow(/unknown token.*\{thornwik\}/);
    expect(() => withCanon(raw('A.'), { npcs: NPCS, facts: { ...FACTS, wren: { text: 'a bird' } } })).toThrow(/both a person and a fact/);
  });
});
