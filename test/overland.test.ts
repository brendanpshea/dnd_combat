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
      expect(settled.length).toBeGreaterThanOrEqual(5);
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

import { checkLandSpec, type LandSpec } from '../src/adventure/overland.js';
import { startAdventure, enterScene, choose, exploreNodes } from '../src/adventure/runtime.js';
import { newCampaign } from '../src/campaign/campaign.js';

const STORY: LandSpec = { kind: 'valley', level: 3, places: [
  { id: 'ashford', label: 'Ashford', kind: 'town', terrain: 'hills' },
  { id: 'barrow', label: 'The Old Barrow', kind: 'delve', via: 'ashford', delve: { theme: 'graveyard', fights: 'inhabitants', factions: ['restless-dead'] } },
  { id: 'tower', label: 'Witch Tower', kind: 'place', far: 12, after: 'barrow', note: 'Thorns close the path.', text: ['A tower of black stone.'] },
  { id: 'kingsport', label: 'Kingsport', kind: 'city' },
] };

/** Everything the road in can reach, with one place taken off the map. */
function reach(map: ExploreMap, without?: string): Set<string> {
  const seen = new Set(map.entry);
  for (let grew = true; grew;) {
    grew = false;
    for (const [a, b] of map.paths!) {
      if (a === without || b === without) continue;
      if (seen.has(a) !== seen.has(b)) { seen.add(a); seen.add(b); grew = true; }
    }
  }
  return seen;
}

describe('a county built round a story', () => {
  const built = [1, 2, 3, 4].map((seed) => generateLand(seed, STORY).module);

  it('has every place the author asked for, under its own name and id', () => {
    for (const m of built) {
      const map = mapOf(m);
      for (const pl of STORY.places!) expect(map.nodes.find((n) => n.id === pl.id)?.label).toBe(pl.label);
      expect(proveLand(m)).toEqual([]);
    }
  });

  it('reaches a place "via" another only through it', () => {
    for (const m of built) {
      const map = mapOf(m);
      expect(reach(map).has('barrow')).toBe(true);
      expect(reach(map, 'ashford').has('barrow')).toBe(false);
      // And it lies beyond: farther from the city than its gate.
      const city = at(map, 'kingsport');
      expect(miles(at(map, 'barrow'), city)).toBeGreaterThan(miles(at(map, 'ashford'), city));
    }
  });

  it('puts a place on the ground and at the distance asked', () => {
    for (const m of built) {
      const map = mapOf(m);
      expect(miles(at(map, 'tower'), at(map, 'kingsport'))).toBeGreaterThanOrEqual(12);
    }
  });

  it('keeps a place closed until the delve before it is won', () => {
    const m = built[0]!;
    const live = expandModule(m, { seed: 3, flags: [] });
    const s = startAdventure(newCampaign(3), live);
    enterScene(s, live, live.start);
    choose(s, live, 'on');
    const tower = () => exploreNodes(s, live).find((n) => n.node.id === 'tower');
    s.exploredNodes.push(...mapOf(live).nodes.map((n) => n.id));   // walked everywhere
    expect(tower()?.blocked).toBe('Thorns close the path.');
    // Winning the barrow, inside the delve, is what opens it.
    expect(JSON.stringify(Object.values(live.scenes).filter((x) => x.id.startsWith('barrow')))).toContain('"flag":"won-barrow"');
    s.flags['won-barrow'] = true;
    expect(tower()?.blocked).toBeFalsy();
  });

  it('turns away a spec it cannot honour, at once, saying why', () => {
    const bad: [LandSpec, RegExp][] = [
      [{ places: [{ id: 'x', label: 'X', kind: 'place', via: 'nowhere', text: ['t'] }] }, /'nowhere', which is not one of the county's places/],
      [{ places: [{ id: 'a', label: 'A', kind: 'place', via: 'b', text: ['t'] }, { id: 'b', label: 'B', kind: 'place', via: 'a', text: ['t'] }] }, /round a loop/],
      [{ places: [{ id: 'x', label: 'X', kind: 'place' }] }, /needs its text/],
      [{ places: [{ id: 'x', label: 'far too long a town name', kind: 'town' }] }, /2–13 letters/],
      [{ places: [{ id: 'x', label: 'X', kind: 'delve', delve: { factions: ['undead'] } }] }, /no faction 'undead'/],
      [{ places: [{ id: 'land', label: 'X', kind: 'place', text: ['t'] }] }, /uses itself/],
    ];
    for (const [spec, why] of bad) expect(() => checkLandSpec(spec), JSON.stringify(spec)).toThrow(why);
  });
});

describe('the roads', () => {
  it('never cross the river but at a ford, a bridge or a ferry', () => {
    let crossings = 0;
    for (const { module: m } of counties) {
      const map = mapOf(m);
      const river = map.land!.river!;
      for (const [a, b] of map.paths!) {
        const pa = at(map, a), pb = at(map, b);
        // A crossing stop stands on the river; its legs touch it, nothing else does.
        const isCrossing = (id: string) => / (Ford|Bridge|Ferry)$/.test(map.nodes.find((n) => n.id === id)!.label);
        if (isCrossing(a) || isCrossing(b)) { crossings++; continue; }
        for (let i = 1; i < river.length; i++) {
          const [p, q] = [river[i - 1]!, river[i]!];
          const d = (pb[0] - pa[0]) * (q[1] - p[1]) - (pb[1] - pa[1]) * (q[0] - p[0]);
          if (!d) continue;
          const t = ((p[0] - pa[0]) * (q[1] - p[1]) - (p[1] - pa[1]) * (q[0] - p[0])) / d;
          const u = ((p[0] - pa[0]) * (pb[1] - pa[1]) - (p[1] - pa[1]) * (pb[0] - pa[0])) / d;
          if (!(t > 0 && t < 1 && u >= 0 && u <= 1)) continue;
          // A town on the river is its own crossing.
          const x: [number, number] = [pa[0] + (pb[0] - pa[0]) * t, pa[1] + (pb[1] - pa[1]) * t];
          const bridged = (map.land!.bridges ?? []).some((br) => miles(br, x) < 0.2);
          expect(bridged || Math.min(miles(x, pa), miles(x, pb)) <= 1.5, `${a}–${b} crosses the river`).toBe(true);
        }
      }
    }
    for (const { module: m } of counties) crossings += mapOf(m).land!.bridges?.length ?? 0;
    expect(crossings).toBeGreaterThan(0);
  });
});

import { encounterFor } from '../src/data/encounters.js';

describe('camps in the wild', () => {
  it('stand on ground their people live on, one band of each, and not every one a fight', () => {
    let calm = 0, angry = 0;
    for (const { module: m } of counties) {
      const map = mapOf(m);
      const camps = map.nodes.filter((n) => n.id.startsWith('camp-'));
      expect(camps.length).toBeGreaterThan(0);
      expect(new Set(camps.map((c) => c.label)).size).toBe(camps.length);
      for (const c of camps) {
        const scene = m.scenes[c.id];
        if (scene?.kind !== 'story') throw new Error(c.id);
        const ids = scene.next.map((x) => x.id);
        expect(ids).toContain('fight');
        if (ids.includes('talk')) calm++; else angry++;
        const fight = m.scenes[`${c.id}-fight`];
        expect(fight?.kind === 'battle' && encounterFor(fight.encounterId)).toBeTruthy();
      }
    }
    expect(calm).toBeGreaterThan(0);
    expect(angry).toBeGreaterThan(0);
  });

  it('take an author\'s camp as written', () => {
    const m = generateLand(2, { places: [{ id: 'reavers', label: 'Reaver Camp', kind: 'camp', faction: 'bandits', hostile: true }] }).module;
    const s = m.scenes.reavers;
    expect(s?.kind === 'story' && s.next.map((x) => x.id)).toEqual(['fight', 'run']);
    expect(() => checkLandSpec({ places: [{ id: 'x', label: 'X', kind: 'camp', faction: 'dragons' }] })).toThrow(/no camp of 'dragons'/);
  });

  it('leaves cold ashes once beaten', () => {
    const m = counties[0]!.module;
    const camp = mapOf(m).nodes.find((n) => n.id.startsWith('camp-'))!;
    const fight = m.scenes[`${camp.id}-fight`];
    expect(fight?.kind === 'battle' && fight.onWin.to).toBe(`${camp.id}-quiet`);
    expect(camp.sceneWhen?.[0]?.to).toBe(`${camp.id}-quiet`);
  });
});
