/**
 * One-time things can't be spent by walking away from them.
 */
import { describe, it, expect } from 'vitest';
import { validateModule } from '../src/adventure/validate.js';
import type { Module, Scene } from '../src/adventure/types.js';

const won: Scene = { id: 'won', kind: 'ending', outcome: 'victory', text: ['Done.'] };

describe('the validator guards one-time things', () => {
  it('a challenge reached by a one-try choice must be one-way', () => {
    const m = (noBack: boolean): Module => ({ id: 'o', title: 'O', blurb: '', start: 'map', scenes: {
      map: { id: 'map', kind: 'explore', map: { title: 'M', nodes: [{ id: 'n', x: 1, y: 1, label: 'Statues', icon: '🗿', scene: 'vale' }] } } as Scene,
      vale: { id: 'vale', kind: 'story', text: ['Statues.'], next: [
        { id: 'rob', label: 'Rob them', to: 'sneak', once: true },
        { id: 'go', label: 'Go on', to: 'won' },
      ] },
      sneak: { id: 'sneak', kind: 'challenge', intro: ['Quietly.'], ...(noBack ? { noBack: true } : {}),
        approaches: [{ id: 'creep', label: 'Creep in', skill: 'stealth', dc: 10 }],
        success: { to: 'won' }, failure: { to: 'won' } },
      won,
    } });
    expect(validateModule(m(false)).some((e) => String(e).startsWith('[sneak]') && String(e).includes('one-try choice'))).toBe(true);
    expect(validateModule(m(true)).some((e) => e.includes('one-try choice'))).toBe(false);
  });
});
