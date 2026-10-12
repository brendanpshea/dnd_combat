/**
 * The overland: a county laid out the way counties grow, every town a whole
 * generated town, and the whole of it proven.
 */
import { describe, it, expect } from 'vitest';
import { generateLand, landFromId, proveLand, miles, LAND_KINDS, TERRAIN_OF } from '../src/adventure/overland.js';
import { apart } from '../src/adventure/city-gen.js';
import { expandModule } from '../src/adventure/embed.js';
import { nearestOn } from '../src/adventure/town-map.js';
import type { ExploreMap, Module } from '../src/adventure/types.js';

const mapOf = (m: Module) => (m.scenes.land as { map: ExploreMap }).map;
const at = (map: ExploreMap, id: string): [number, number] => { const n = map.nodes.find((x) => x.id === id)!; return [n.x, n.y]; };
const terrain = (map: ExploreMap, [x, y]: [number, number]) =>
  TERRAIN_OF[map.land!.cells[Math.min(19, Math.floor(y / 5)) * 10 + Math.min(9, Math.floor(x / 10))]!];

const counties = LAND_KINDS.flatMap((kind) => [1, 2, 3].map((seed) => ({ kind, seed, ...generateLand(seed, { kind }) })));

describe('a county', () => {
  it('is the same county from the same seed', () => {
    const a = generateLand(9).module, b = generateLand(9).module;
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(landFromId(a.id)?.title).toBe(a.title);
  });

  it('passes its proofs, without leaning on rerolls', () => {
    let rerolls = 0;
    for (const c of counties) { expect(proveLand(c.module), `${c.kind} ${c.seed}`).toEqual([]); rerolls += c.rerolls; }
    expect(rerolls / counties.length).toBeLessThan(1);
  });

  it('puts its city near the middle, on the water', () => {
    for (const { module: m, kind, seed } of counties) {
      const map = mapOf(m);
      const city = map.nodes.find((n) => n.id.startsWith('city-'))!;
      const p: [number, number] = [city.x, city.y];
      expect(miles(p, [50, 50]), `${kind} ${seed}`).toBeLessThan(9);
      const water = Math.min(miles(p, nearestOn(p, [map.land!.river!]).at), map.land!.sea ? miles(p, nearestOn(p, [map.land!.sea.points]).at) : 99);
      expect(water, `${kind} ${seed}`).toBeLessThan(3);
    }
  });

  it('has towns half a day out and villages a morning apart, on dry ground', () => {
    for (const { module: m } of counties) {
      const map = mapOf(m);
      const city = at(map, map.nodes.find((n) => n.id.startsWith('city-'))!.id);
      const settled = map.nodes.filter((n) => /^(city|town|village)-/.test(n.id));
      expect(settled.length).toBeGreaterThanOrEqual(7);
      for (const t of settled.filter((n) => n.id.startsWith('town-'))) {
        const d = miles([t.x, t.y], city);
        expect(d).toBeGreaterThanOrEqual(7); expect(d).toBeLessThanOrEqual(14);
      }
      for (const a of settled) {
        expect(['water', 'mountain']).not.toContain(terrain(map, [a.x, a.y]));
        for (const b of settled) if (a !== b) expect(miles([a.x, a.y], [b.x, b.y])).toBeGreaterThanOrEqual(3.5);
      }
    }
  });

  it('joins everything by road, from the road in, no leg past a long day', () => {
    for (const { module: m } of counties) {
      const map = mapOf(m);
      const seen = new Set(map.entry);
      for (let grew = true; grew;) {
        grew = false;
        for (const [a, b] of map.paths!) if (seen.has(a) !== seen.has(b)) { seen.add(a); seen.add(b); grew = true; }
      }
      expect(seen.size).toBe(map.nodes.length);
      for (const [a, b] of map.paths!) expect(miles(at(map, a), at(map, b))).toBeLessThan(14);
    }
  });

  it('lays its markers out to be read on a phone', () => {
    for (const { module: m } of counties) {
      const map = mapOf(m);
      for (const a of map.nodes) for (const b of map.nodes) if (a !== b) expect(apart(a, b), `${a.id} on ${b.id}`).toBe(true);
      for (const n of map.nodes) expect(n.label.length).toBeLessThanOrEqual(20);
      expect(new Set(map.nodes.map((n) => n.label)).size).toBe(map.nodes.length);
    }
  });

  it('builds each town under the name the map gives it, and leads back out to the map', () => {
    const m = counties[0]!.module;
    const live = expandModule(m, { seed: 4, flags: [] });
    for (const n of mapOf(m).nodes.filter((x) => /^(city|town|village)-/.test(x.id))) {
      const door = live.scenes[n.id];
      expect(door?.kind).toBe('story');
      expect(JSON.stringify(door)).toContain(n.label);
      expect(JSON.stringify(live.scenes)).toContain(`"to":"land"`);
    }
  });
});
