/**
 * The cast: no route shows a character's name before one of its
 * introductions.
 */
import { describe, it, expect } from 'vitest';
import { checkModuleReach } from '../src/adventure/reach.js';
import { validateModule } from '../src/adventure/validate.js';
import type { Module, Scene } from '../src/adventure/types.js';

const won: Scene = { id: 'won', kind: 'ending', outcome: 'victory', text: ['Done.'] };
// Two ways to the hall: past the bandit who names the chief, or straight in.
const den = (hallText: string): Module => ({
  id: 'cast', title: 'T', blurb: '', start: 'road',
  cast: [{ name: 'Vargan', aka: ['the chief'], introducedAt: ['bandit'] }],
  scenes: {
    road: { id: 'road', kind: 'story', text: ['A road.'], noBack: true, next: [
      { id: 'talk', label: 'Question the bandit', to: 'bandit' },
      { id: 'rush', label: 'Rush the hall', to: 'hall' },
    ] },
    bandit: { id: 'bandit', kind: 'story', text: ['"**Vargan** runs the den," he says.'], noBack: true, next: [{ id: 'on', label: 'On', to: 'hall' }] },
    hall: { id: 'hall', kind: 'story', text: [hallText], noBack: true, next: [{ id: 'end', label: 'End it', to: 'won' }] },
    won,
  },
});

describe('the cast', () => {
  it('a name shown before any introduction is caught, with the route', () => {
    const m = den('Vargan rises from his throne.');
    expect(validateModule(m).filter((e) => !e.includes('names Vargan'))).toEqual([]);
    const hit = checkModuleReach(m).errors.find((e) => e.includes('names Vargan before any introduction'));
    expect(hit).toBeDefined();
    expect(hit).toContain('road → hall');
  });

  it('an alias counts as the name', () => {
    expect(checkModuleReach(den('The chief rises.')).errors.some((e) => e.includes('names Vargan'))).toBe(true);
  });

  it('passes when every route meets the introduction first', () => {
    const m = den('Vargan rises from his throne.');
    const road = m.scenes.road;
    if (road?.kind !== 'story') throw new Error();
    road.next = road.next.filter((c) => c.id === 'talk');
    expect(checkModuleReach(m).errors).toEqual([]);
    // Or the hall introduces him itself.
    const m2 = den('A man rises: "I am **Vargan**."');
    m2.cast![0]!.introducedAt.push('hall');
    expect(checkModuleReach(m2).errors).toEqual([]);
  });

  it('a whole word only, and introductions must exist', () => {
    expect(checkModuleReach(den('Vargans were never here.')).errors).toEqual([]);
    const bad = den('A hall.');
    bad.cast![0]!.introducedAt.push('nowhere');
    expect(validateModule(bad).some((e) => e.includes('unknown scene \'nowhere\''))).toBe(true);
  });
});
