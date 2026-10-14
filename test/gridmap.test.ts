/**
 * Square maps (src/gridmap): what every dungeon and town promises, over many
 * seeds and sizes, not one picture.
 */
import { describe, it, expect } from 'vitest';
import { generateDungeon, generateLevels, generateTown, THEMES, DEFAULT_PLACES, type GridMap, DIRS, STEP, edge, at, inside, distances, solve, toAscii, placesLegend } from '../src/gridmap/index.js';

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
      // The stairs are in the deepest room: none is farther in (by its nearest square).
      const depth = (id: number) => Math.min(...m.areas[id]!.cells.map(([x, y]) => dist[at(m, x, y)]!));
      const entryRoom = m.area[at(m, e.x, e.y)];
      const deepest = Math.max(...m.areas.filter((a) => a.kind === 'room' && a.id !== entryRoom).map((a) => depth(a.id)));
      expect(depth(m.area[at(m, down.x, down.y)]!), `seed ${seed}`).toBe(deepest);
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

  it('takes its stairs up where it is told, and its numbers', () => {
    const m = generateDungeon(9, { upAt: { x: 5, y: 7 }, specials: 4, encounters: 3 });
    expect(m.features.filter((f) => f.feature === 'stairs-up')).toEqual([{ x: 5, y: 7, feature: 'stairs-up' }]);
    expect(m.features.filter((f) => f.feature === 'entrance')).toHaveLength(0);
    expect(m.features.filter((f) => f.feature === 'special')).toHaveLength(4);
    expect(m.features.filter((f) => f.feature === 'encounter')).toHaveLength(3);
    expect(() => generateDungeon(1, { size: 7 })).toThrow(/8 to 64/);
    expect(() => generateDungeon(1, { theme: 'swamp' })).toThrow(/no dungeon theme/);
  });
});

/** Every open square reached by a player picking up keys. */
function solvable(m: GridMap) {
  const { reached } = solve(m);
  expect(open(m).filter((i) => !reached.has(i)), `level ${m.level ?? 0} (${m.theme}): cut off`).toEqual([]);
}

describe('keys, bosses and markers', () => {
  it('locks rooms whose key is found elsewhere, and every level can be finished', () => {
    for (const theme of Object.keys(THEMES)) for (const seed of SEEDS.slice(0, 60)) {
      const m = generateDungeon(seed, { theme, keys: 2, boss: true });
      solvable(m);
      expect(new Set(m.features.map((f) => `${f.x},${f.y}`)).size, `${theme} ${seed}: two markers on one square`).toBe(m.features.length);
      for (const l of m.locks) expect(m.features.some((f) => f.feature === 'key' && f.key === l.key), `${theme} ${seed}: no key for ${l.key}`).toBe(true);
      // Without any key, the locked rooms stay shut.
      const shut = distances(m, ...([m.features[0]!.x, m.features[0]!.y] as const));
      for (const l of m.locks) {
        const behind = [at(m, l.x, l.y), at(m, l.x + (l.d === 'e' ? 1 : 0), l.y + (l.d === 's' ? 1 : 0))];
        expect(behind.some((i) => shut[i] === -1), `${theme} ${seed}: a lock with nothing behind it`).toBe(true);
      }
    }
  });

  it('puts the boss behind its lock, and the key with the sub-boss', () => {
    let checked = 0;
    for (const seed of SEEDS) {
      const m = generateDungeon(seed, { boss: true });
      const boss = m.features.find((f) => f.feature === 'boss');
      if (!boss) continue;
      checked++;
      const room = m.area[at(m, boss.x, boss.y)]!;
      expect(m.areas[room]!.kind).toBe('room');
      const key = m.features.find((f) => f.feature === 'key' && f.key === 'boss')!;
      const sub = m.features.find((f) => f.feature === 'sub-boss');
      if (sub) expect(m.area[at(m, key.x, key.y)], `seed ${seed}: the sub-boss holds the key`).toBe(m.area[at(m, sub.x, sub.y)]);
      // The boss is reached only with its key.
      const e = m.features[0]!;
      expect(distances(m, e.x, e.y)[at(m, boss.x, boss.y)]).toBe(-1);
      expect(distances(m, e.x, e.y, undefined, ['boss'])[at(m, boss.x, boss.y)]).toBeGreaterThan(0);
    }
    expect(checked).toBeGreaterThan(SEEDS.length * 0.9);
  });

  it('spreads its encounters out, never on the way in', () => {
    for (const seed of SEEDS.slice(0, 40)) {
      const m = generateDungeon(seed, { encounters: 6 });
      const e = m.features[0]!;
      const fights = m.features.filter((f) => f.feature === 'encounter');
      for (const f of fights) {
        expect(Math.abs(f.x - e.x) + Math.abs(f.y - e.y)).toBeGreaterThanOrEqual(3);
        for (const g of fights) if (g !== f) expect(Math.abs(f.x - g.x) + Math.abs(f.y - g.y)).toBeGreaterThanOrEqual(3);
      }
      // No two markers on one square.
      expect(new Set(m.features.map((f) => `${f.x},${f.y}`)).size).toBe(m.features.length);
    }
  });
});

describe('layout themes', () => {
  it('make different places from the same seed', () => {
    const stats = Object.keys(THEMES).map((theme) => {
      let rooms = 0, roomCells = 0, doors = 0, rock = 0;
      for (const seed of SEEDS.slice(0, 40)) {
        const m = generateDungeon(seed, { theme });
        const rs = m.areas.filter((a) => a.kind === 'room');
        rooms += rs.length; roomCells += rs.reduce((n, r) => n + r.cells.length, 0);
        doors += m.east.concat(m.south).filter((e) => e === 'door').length;
        rock += m.area.filter((a) => a === -1).length;
      }
      return { theme, size: roomCells / rooms, doors, rock };
    });
    const by = Object.fromEntries(stats.map((s) => [s.theme, s]));
    expect(by.halls!.size).toBeGreaterThan(by.classic!.size);
    expect(by.crypt!.size).toBeLessThan(by.classic!.size);
    expect(by.maze!.rock).toBeLessThan(by.classic!.rock);
    // Caves have no doors, only openings.
    expect(by.caves!.doors).toBe(0);
  });
});

describe('a stack of levels', () => {
  it.each([[3, 16], [5, 12], [2, 24]])('%i levels of %i: every stairs down lands on the next level\'s stairs up', (levels, size) => {
    for (const seed of SEEDS.slice(0, 30)) {
      const stack = generateLevels(seed, { levels, size, keys: 1 });
      expect(stack).toHaveLength(levels);
      stack.forEach((m, i) => {
        expect(m.level).toBe(i);
        solvable(m);
        const up = m.features.filter((f) => f.feature === 'stairs-up');
        const down = m.features.filter((f) => f.feature === 'stairs-down');
        expect(up).toHaveLength(i === 0 ? 0 : 1);
        expect(m.features.filter((f) => f.feature === 'entrance')).toHaveLength(i === 0 ? 1 : 0);
        expect(down).toHaveLength(i === levels - 1 ? 0 : 1);
        if (i > 0) {
          const above = stack[i - 1]!.features.find((f) => f.feature === 'stairs-down')!;
          expect([up[0]!.x, up[0]!.y], `seed ${seed}, level ${i}`).toEqual([above.x, above.y]);
        }
        // The stairs down are reached without a key; the boss waits on the last level.
        if (down[0]) expect(distances(m, m.features[0]!.x, m.features[0]!.y)[at(m, down[0].x, down[0].y)]).toBeGreaterThanOrEqual(0);
        expect(m.features.some((f) => f.feature === 'boss')).toBe(i === levels - 1);
      });
    }
  });

  it('takes a theme for each level', () => {
    const stack = generateLevels(3, { levels: 3, themes: ['classic', 'crypt', 'caves'] });
    expect(stack.map((m) => m.theme)).toEqual(['classic', 'crypt', 'caves']);
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
