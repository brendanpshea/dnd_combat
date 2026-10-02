/**
 * Declared assumptions: a line says what it takes for granted, and the
 * reachability search proves it on every route that can show it.
 */
import { describe, it, expect } from 'vitest';
import { checkModuleReach } from '../src/adventure/reach.js';
import { validateModule } from '../src/adventure/validate.js';
import type { Module, Scene, Para, Requirement } from '../src/adventure/types.js';

const won: Scene = { id: 'won', kind: 'ending', outcome: 'victory', text: ['Yes.'] };
// The scout comes along, or stays at the fire; either way the party ends in camp.
const camp = (line: Para, sceneAssumes?: Requirement[]): Module => ({
  id: 'as', title: 'T', blurb: '', start: 'a',
  companions: { wren: { id: 'wren', name: 'Wren', monsterId: 'scout', blurb: 'A scout.' } },
  scenes: {
    a: { id: 'a', kind: 'story', text: ['The rim.'], noBack: true, next: [
      { id: 'with', label: 'Take Wren', to: 'down', effects: [{ kind: 'joinParty', companion: 'wren' }] },
      { id: 'alone', label: 'Go alone', to: 'down', effects: [{ kind: 'setFlag', flag: 'alone' }] },
    ] },
    down: { id: 'down', kind: 'story', text: ['The camp.', line], noBack: true, next: [{ id: 'end', label: 'Rest', to: 'won' }],
      ...(sceneAssumes ? { assumes: sceneAssumes } : {}) },
    won,
  },
});

describe('declared assumptions', () => {
  it('a line that assumes Wren stayed behind is caught on the route where she came', () => {
    const m = camp({ assumes: [{ kind: 'noCompanion', companion: 'wren' }], text: 'Wren waves from the scouts\' fire.' });
    expect(validateModule(m).filter((e) => !e.includes('assumes'))).toEqual([]);
    const errors = checkModuleReach(m).errors;
    const hit = errors.find((e) => e.startsWith('[down]') && e.includes('assumes wren not in the party'));
    expect(hit).toBeDefined();
    expect(hit).toContain('"Take Wren"');
  });

  it('is proven when every route agrees', () => {
    const m = camp({ assumes: [{ kind: 'noCompanion', companion: 'wren' }], text: 'Wren waves from the fire.' });
    const a = m.scenes.a;
    if (a?.kind !== 'story') throw new Error();
    a.next = a.next.filter((c) => c.id === 'alone');
    expect(checkModuleReach(m).errors).toEqual([]);
  });

  it('is only checked where the line shows (its own `if`)', () => {
    const m = camp({ if: [{ kind: 'flag', flag: 'alone' }], assumes: [{ kind: 'noCompanion', companion: 'wren' }], text: 'Wren waves from the fire.' });
    expect(checkModuleReach(m).errors).toEqual([]);
  });

  it('works for a whole scene, and refuses what the search can\'t see', () => {
    const m = camp('Plain.', [{ kind: 'flag', flag: 'alone' }]);
    expect(checkModuleReach(m).errors.some((e) => e.startsWith('[down]') && e.includes('the scene assumes alone'))).toBe(true);
    const blind = camp({ assumes: [{ kind: 'gold', atLeast: 10 }], text: 'You count your coin.' });
    expect(checkModuleReach(blind).errors.some((e) => e.includes('can\'t see (gold)'))).toBe(true);
  });
});
