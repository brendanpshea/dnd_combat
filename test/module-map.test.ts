/**
 * The module map's extraction: scenes grouped by location, and every way
 * between them that is not just "back to where you were".
 */
import { describe, it, expect } from 'vitest';
import { moduleMap, needsOf } from '../src/adventure/module-map.js';
import { MODULES } from '../src/data/modules/index.js';
import { HUB_REF } from '../src/adventure/types.js';

const hollow = MODULES.find((m) => m.id === 'hollow-road')!;

describe('module map', () => {
  it('groups each scene under the location the party walks in from', () => {
    const m = moduleMap(hollow);
    const at = (id: string) => m.nodes.find((n) => n.id === id)!.location;
    expect(at('road')).toBeNull();            // the prologue
    expect(at('square')).toBe('square');      // a location is its own group
    expect(at('mill-fight')).toBe('square');
    expect(at('barrow-fight')).toBe('trail');
    expect(at('vex-parley')).toBe('inner');
    expect(m.locations.map((l) => l.title)).toEqual(['Thornwick Square', 'The Marsh Road', 'The Ashfang Den']);
  });

  it('folds the way back to a scene\'s own location into a mark, not an arrow', () => {
    const m = moduleMap(hollow);
    expect(m.edges.some((e) => (e.to as string) === HUB_REF)).toBe(false);
    for (const e of m.edges) {
      const from = m.nodes.find((n) => n.id === e.from)!;
      if (from.id !== from.location) expect(e.to, `${e.from} → ${e.to}`).not.toBe(from.location);
    }
    expect(m.nodes.find((n) => n.id === 'barrow-done')!.returns).toBe(true);
  });

  it('keeps every other way, labelled with what it needs', () => {
    for (const mod of MODULES) {
      const m = moduleMap(mod);
      const ids = new Set(m.nodes.map((n) => n.id));
      for (const e of m.edges) {
        expect(ids.has(e.from) && ids.has(e.to), `${mod.id}: ${e.from} → ${e.to}`).toBe(true);
      }
      // No duplicate arrows.
      const keys = m.edges.map((e) => `${e.from}>${e.to}>${e.kind}>${e.needs ?? ''}`);
      expect(new Set(keys).size).toBe(keys.length);
    }
    const unguarded = moduleMap(hollow).edges.find((e) => e.to === 'boss-unguarded')!;
    expect(unguarded.needs).toBe('vex-turned');
    expect(needsOf([{ kind: 'notFlag', flag: 'x' }, { kind: 'companion', companion: 'wren' }])).toBe('!x, +wren');
  });
});
