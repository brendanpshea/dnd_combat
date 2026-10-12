/**
 * A town's ground: laid first, and the markers placed on it — off the
 * water, along the streets, a wall round anything bigger than a village.
 */
import { describe, it, expect } from 'vitest';
import { generateCity, CITY_SIZES } from '../src/adventure/city-gen.js';
import { toLine, nearestOn } from '../src/adventure/town-map.js';
import type { ExploreMap } from '../src/adventure/types.js';

const mapOf = (seed: number, size: (typeof CITY_SIZES)[number]) => {
  const s = generateCity(seed, { size }).module.scenes.city;
  if (s?.kind !== 'explore') throw new Error('no map');
  return s.map as ExploreMap & { ground: NonNullable<ExploreMap['ground']> };
};

describe('a town\'s ground', () => {
  it('has streets, and a wall only once it is more than a village', () => {
    for (let seed = 1; seed <= 20; seed++) for (const size of CITY_SIZES) {
      const g = mapOf(seed, size).ground;
      expect(g.streets.length).toBeGreaterThan(0);
      expect(!!g.wall).toBe(size !== 'village');
    }
  });

  it('keeps every marker out of the water', () => {
    const seen = new Set<string>();
    for (let seed = 1; seed <= 40; seed++) for (const size of CITY_SIZES) {
      const { ground: g, nodes } = mapOf(seed, size);
      seen.add(g.feature);
      for (const n of nodes) {
        if (g.water?.kind === 'river') expect(toLine([n.x, n.y], g.water.points), `${seed} ${n.id}`).toBeGreaterThanOrEqual(7);
        if (g.water?.kind === 'coast') {
          const shore = nearestOn([n.x, n.y], [g.water.points]).at[0];
          expect(g.water.side === 'left' ? n.x > shore : n.x < shore).toBe(true);
        }
      }
    }
    expect([...seen].sort()).toEqual(['coast', 'crossroads', 'river']);
  });

  it('puts every door on a street, or a lane to one', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const { ground: g, nodes } = mapOf(seed, 'city');
      for (const n of nodes) expect(nearestOn([n.x, n.y], g.streets).d, `${seed} ${n.id}`).toBeLessThanOrEqual(2.5);
    }
  });

  it('puts the gate on the road in', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const { ground: g, nodes } = mapOf(seed, 'town');
      const gate = nodes.find((n) => n.id === 'gate')!;
      expect(toLine([gate.x, gate.y], g.streets[0]!)).toBeLessThan(14);
    }
  });
});
