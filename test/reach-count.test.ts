/**
 * A map marker may route on a tally (a `count`): the search takes such a
 * redirect both ways, so neither scene behind it is reported unreachable.
 */
import { describe, it, expect } from 'vitest';
import { checkModuleReach } from '../src/adventure/reach.js';
import type { Module, Scene } from '../src/adventure/types.js';

const won: Scene = { id: 'won', kind: 'ending', outcome: 'victory', text: ['Done.'] };
const m: Module = { id: 'rc', title: 'R', blurb: '', start: 'map', scenes: {
  map: { id: 'map', kind: 'explore', map: { title: 'M', nodes: [
    { id: 'deed', x: 1, y: 1, label: 'Do a good deed', icon: '🤝', scene: 'deed' },
    { id: 'gate', x: 2, y: 1, label: 'The gate', icon: '🚪', scene: 'plain',
      sceneWhen: [{ if: [{ kind: 'count', flag: 'regard', atLeast: 1 }], to: 'thanked' }] },
  ] } } as Scene,
  deed: { id: 'deed', kind: 'story', text: ['You help.'], noBack: true, next: [{ id: 'ok', label: 'Go back', to: 'map', effects: [{ kind: 'addFlag', flag: 'regard', amount: 1 }] }] },
  plain: { id: 'plain', kind: 'story', text: ['The gate.'], noBack: true, next: [{ id: 'on', label: 'Go through', to: 'won' }] },
  thanked: { id: 'thanked', kind: 'story', text: ['They thank you at the gate.'], noBack: true, next: [{ id: 'on', label: 'Go through', to: 'won' }] },
  won,
} };

describe('a marker that routes on a tally', () => {
  it('is searched both ways', () => {
    const errors = checkModuleReach(m, [m]).errors;
    expect(errors.filter((e) => e.includes('never be reached'))).toEqual([]);
  });
});
