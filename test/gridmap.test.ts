/**
 * Square maps (src/gridmap): what every dungeon and town promises, over many
 * seeds and sizes, not one picture.
 */
import { describe, it, expect } from 'vitest';
import { generateDungeon, generateTown, DEFAULT_PLACES, type GridMap, DIRS, STEP, edge, at, inside, distances, toAscii, placesLegend } from '../src/gridmap/index.js';

const SEEDS = Array.from({ length: 120 }, (_, i) => i + 1);
const seedsFor = (size: number) => SEEDS.slice(0, size > 16 ? 30 : 120);
const SIZES = [8, 12, 16, 24, 32];

const entrance = (m: GridMap) => m.features.find((f) => f.feature === 'entrance' || f.feature === 'stairs-up')!;
const open = (m: GridMap) => m.area.flatMap((a, i) => (a === -1 ? [] : [i]));

/** Edges are stored once, so each side reads the same from both cells. */
function edgesAgree(m: GridMap) {
  const bad: string[] = [];
  for (let y = 0; y < m.size; y++) for (let x = 0; x < m.size; x++) for (const d of DIRS) {
    const nx = x + STEP[d][0], ny = y + STEP[d][1];
    const back = ({ n: 's', e: 'w', s: 'n', w: 'e' } as const)[d];
    if (inside(m, nx, ny) ? edge(m, nx, ny, back) !== edge(m, x, y, d) : edge(m, x, y, d) !== 'wall') bad.push(`${x},${y} ${d}`);
  }
  expect(bad).toEqual([]);
}

/** Rock is rock: nothing but walls round a solid cell. */
function rockIsWalled(m: GridMap) {
  const bad: string[] = [];
  for (let y = 0; y < m.size; y++) for (let x = 0; x < m.size; x++) {
    if (m.area[at(m, x, y)] === -1 && DIRS.some((d) => edge(m, x, y, d) !== 'wall')) bad.push(`${x},${y}`);
  }
  expect(bad).toEqual([]);
}

describe('a random dungeon', () => {
  it('is the same map for the same seed, and a different one for another', () => {
    expect(generateDungeon(5)).toEqual(generateDungeon(5));
    expect(toAscii(generateDungeon(5))).not.toBe(toAscii(generateDungeon(6)));
  });

  it.each(SIZES)('at %i a side: walkable end to end through plain doors, with stairs at the far end', (size) => {
    for (const seed of seedsFor(size)) {
      const m = generateDungeon(seed, { size });
      expect(m.size).toBe(size);
      expect(m.area.length).toBe(size * size);
      edgesAgree(m);
      rockIsWalled(m);
      const e = entrance(m);
      const dist = distances(m, e.x, e.y);
      // Every open square is reached without a key or a found secret door.
      expect(open(m).filter((i) => dist[i]! < 0), `seed ${seed}: cells cut off`).toEqual([]);
      const down = m.features.find((f) => f.feature === 'stairs-down')!;
      expect(m.areas[m.area[at(m, down.x, down.y)]!]!.kind).toBe('room');
      // The stairs are the farthest room square from the way in.
      const rooms = m.areas.filter((a) => a.kind === 'room').flatMap((a) => a.cells);
      expect(dist[at(m, down.x, down.y)]).toBe(Math.max(...rooms.map(([x, y]) => dist[at(m, x, y)]!)));
    }
  });

  it('has rooms that never touch, each opening onto a corridor', () => {
    for (const seed of SEEDS) {
      const m = generateDungeon(seed);
      const rooms = m.areas.filter((a) => a.kind === 'room');
      expect(rooms.length, `seed ${seed}`).toBeGreaterThanOrEqual(3);
      for (const r of rooms) {
        for (const [x, y] of r.cells) for (const d of DIRS) {
          const nx = x + STEP[d][0], ny = y + STEP[d][1];
          if (!inside(m, nx, ny)) continue;
          const other = m.area[at(m, nx, ny)]!;
          if (other !== r.id && other !== -1) expect(m.areas[other]!.kind).toBe('corridor');
        }
      }
    }
  });

  it('keeps some loops, locked and secret doors, and fills dead ends with rock', () => {
    let locked = 0, secret = 0, rock = 0;
    for (const seed of SEEDS) {
      const m = generateDungeon(seed);
      locked += m.east.concat(m.south).filter((e) => e === 'locked').length;
      secret += m.east.concat(m.south).filter((e) => e === 'secret').length;
      rock += m.area.filter((a) => a === -1).length;
    }
    expect(locked).toBeGreaterThan(0);
    expect(secret).toBeGreaterThan(0);
    expect(rock).toBeGreaterThan(0);
  });

  it('takes its stairs up in place of an entrance, and its numbers', () => {
    const m = generateDungeon(9, { stairsUp: true, specials: 4 });
    expect(m.features.filter((f) => f.feature === 'stairs-up')).toHaveLength(1);
    expect(m.features.filter((f) => f.feature === 'entrance')).toHaveLength(0);
    expect(m.features.filter((f) => f.feature === 'special')).toHaveLength(4);
    expect(() => generateDungeon(1, { size: 7 })).toThrow(/8 to 64/);
  });
});

describe('a random town', () => {
  it('is the same map for the same seed', () => {
    expect(generateTown(5)).toEqual(generateTown(5));
  });

  it.each(SIZES.filter((s) => s >= 12))('at %i a side: every street joined, every building one door onto a street, every place housed', (size) => {
    for (const seed of seedsFor(size)) {
      const m = generateTown(seed, { size });
      edgesAgree(m);
      const gate = entrance(m);
      expect(m.area[at(m, gate.x, gate.y)], `seed ${seed}: the gate is on a street`).toBe(0);
      expect(gate.x === 0 || gate.y === 0 || gate.x === size - 1 || gate.y === size - 1).toBe(true);
      // Streets: all one walk from the gate.
      const dist = distances(m, gate.x, gate.y, (e) => e === 'open');
      expect(m.areas[0]!.cells.filter(([x, y]) => dist[at(m, x, y)]! < 0), `seed ${seed}: streets cut off`).toEqual([]);
      // Every square is street or building.
      expect(m.area.every((a) => a !== -1)).toBe(true);
      for (const b of m.areas.filter((a) => a.kind === 'building')) {
        const doors: string[] = [];
        for (const [x, y] of b.cells) for (const d of DIRS) {
          const e = edge(m, x, y, d);
          if (e === 'open' || e === 'wall') continue;
          const nx = x + STEP[d][0], ny = y + STEP[d][1];
          expect(m.area[at(m, nx, ny)], `seed ${seed}: a door from building ${b.id} goes nowhere but a street`).toBe(0);
          doors.push(e);
        }
        expect(doors, `seed ${seed}: building ${b.id}`).toHaveLength(1);
        // A place's door opens; a house's is locked.
        expect(doors[0]).toBe(b.place ? 'door' : 'locked');
        expect(b.cells.length).toBeLessThanOrEqual(6);
      }
      expect(m.areas.filter((a) => a.place).map((a) => a.place!.kind).sort()).toEqual(DEFAULT_PLACES.map((p) => p.kind).sort());
    }
  });

  it('houses the places a game asks for, and says when they cannot fit', () => {
    const places = [{ kind: 'inn', name: 'The Gilded Gull' }, { kind: 'temple', name: 'Tyr\'s House' }];
    const m = generateTown(3, { places });
    expect(placesLegend(m)).toContain('The Gilded Gull');
    expect(m.areas.filter((a) => a.place)).toHaveLength(2);
    const many = Array.from({ length: 80 }, (_, i) => ({ kind: 'shop', name: `Shop ${i}` }));
    expect(() => generateTown(3, { size: 8, places: many })).toThrow(/holds/);
  });
});
