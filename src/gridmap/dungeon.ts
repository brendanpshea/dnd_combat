/**
 * A random square dungeon, Gold Box style: rooms, and every square between
 * them carved into winding corridors, then joined by doors.
 *
 * 1. Rooms: rectangles of open floor, never touching one another.
 * 2. Corridors: every other square is carved as a maze (a random depth-first
 *    walk), one maze per stretch of rock the rooms leave apart.
 * 3. Doors: a random spanning tree of doors joins every room and maze, so the
 *    whole map can be walked through plain doors. A few second doors make
 *    loops, and those may be locked (no key: picked or broken) or secret.
 * 4. Dead ends: some corridor tips are filled back in as rock.
 * 5. The way in, the boss and sub-boss, the stairs down, rooms locked with a
 *    key found elsewhere on the level, treasure, encounters and special
 *    squares. Every level can be finished: `solve` walks it as a player
 *    would, picking up keys.
 *
 * A theme (`THEMES`) sets the knobs for a kind of place: a maze, great halls,
 * caves, a crypt. `generateLevels` stacks levels so each one's stairs up
 * stand on the square of the stairs down above it.
 */
import { type GridMap, type Area, type Dir, type Edge, type Feature, DIRS, STEP, blank, inside, at, edge, setEdge, distances, Rand } from './grid.js';

/** A layout theme: the generator's knobs for a kind of place. */
export interface Theme {
  roomSize: [number, number];
  /** Squares of map per room. */
  roomsPer: number;
  loops: number;
  pruneDeadEnds: number;
  locked: number;
  secret: number;
  /** What joins rooms to corridors: doors, or open arches (caves). */
  doors: 'door' | 'open';
}

export const THEMES: Record<string, Theme> = {
  /** Rooms and winding corridors. */
  classic: { roomSize: [2, 4], roomsPer: 40, loops: 0.1, pruneDeadEnds: 0.6, locked: 0.2, secret: 0.2, doors: 'door' },
  /** Mostly passages, a few cells of room, dead ends left in. */
  maze: { roomSize: [1, 2], roomsPer: 64, loops: 0.05, pruneDeadEnds: 0.1, locked: 0.2, secret: 0.2, doors: 'door' },
  /** Great halls, short corridors between them, more ways round. */
  halls: { roomSize: [3, 5], roomsPer: 22, loops: 0.3, pruneDeadEnds: 0.95, locked: 0.2, secret: 0.1, doors: 'door' },
  /** Open caverns and tunnels: no doors, many ways round. */
  caves: { roomSize: [2, 5], roomsPer: 28, loops: 0.35, pruneDeadEnds: 0.4, locked: 0, secret: 0, doors: 'open' },
  /** Many small vaults, tight passages, secret doors. */
  crypt: { roomSize: [1, 2], roomsPer: 16, loops: 0.15, pruneDeadEnds: 0.85, locked: 0.2, secret: 0.5, doors: 'door' },
};

export interface DungeonSpec {
  /** Cells a side (default 16; 8 to 64). */
  size?: number;
  /** A layout theme from THEMES (default 'classic'); the knobs below override it. */
  theme?: string;
  /** How many rooms to try for (default: the theme's, by area). */
  rooms?: number;
  /** A room's sides, in cells. */
  roomSize?: [number, number];
  /** Chance each possible second door is made, for loops. */
  loops?: number;
  /** Share of corridor dead ends filled back in with rock. */
  pruneDeadEnds?: number;
  /** Of the loop doors: the share locked (no key), and the share secret. */
  locked?: number;
  secret?: number;
  /** Stairs up on this square instead of an entrance at the edge: a deeper level. */
  upAt?: { x: number; y: number };
  /** Put stairs down in the farthest open room (default true). */
  stairsDown?: boolean;
  /** A boss in the farthest room, behind a door whose key the sub-boss carries. */
  boss?: boolean;
  /** A sub-boss: with a boss, it holds the boss's key; without one, it
   *  guards the stairs down. */
  subBoss?: boolean;
  /** Rooms locked with a key found elsewhere on the level, each with treasure. */
  keys?: number;
  /** Encounter squares (default: one per 32 squares). */
  encounters?: number;
  /** Special squares (default: one per 64 squares). */
  specials?: number;
  /** Which level of a stack this is (0 at the top), for the map's record. */
  level?: number;
}

export function generateDungeon(seed: number, spec: DungeonSpec = {}): GridMap {
  const size = spec.size ?? 16;
  if (!Number.isInteger(size) || size < 8 || size > 64) throw new Error(`a dungeon is 8 to 64 cells a side, not ${size}`);
  const themeName = spec.theme ?? 'classic';
  const theme = THEMES[themeName];
  if (!theme) throw new Error(`no dungeon theme '${themeName}': ${Object.keys(THEMES).join(', ')}`);
  // A theme's rooms shrink to fit a small map; rooms the spec asks for must fit.
  let [rmin, rmax] = spec.roomSize ?? theme.roomSize;
  if (!spec.roomSize) { rmax = Math.min(rmax, Math.max(1, Math.floor(size / 3))); rmin = Math.min(rmin, rmax); }
  if (rmin < 1 || rmax < rmin || rmax > size / 2) throw new Error(`room sides ${rmin}–${rmax} do not fit a map of ${size}`);
  if (spec.upAt && !inside({ size }, spec.upAt.x, spec.upAt.y)) throw new Error(`stairs up at ${spec.upAt.x},${spec.upAt.y} are off a map of ${size}`);
  const rand = new Rand(seed);
  const m = blank('dungeon', size, seed);
  m.theme = themeName;
  if (spec.level !== undefined) m.level = spec.level;
  const area = (kind: Area['kind']): Area => { const a: Area = { id: m.areas.length, kind, cells: [] }; m.areas.push(a); return a; };
  const claim = (a: Area, x: number, y: number) => { m.area[at(m, x, y)] = a.id; a.cells.push([x, y]); };

  // 1. Rooms, a cell of rock or corridor between any two.
  const want = spec.rooms ?? Math.max(2, Math.round((size * size) / theme.roomsPer));
  for (let tries = 0; tries < want * 30 && m.areas.length < want; tries++) {
    const w = rand.int(rmin, rmax), h = rand.int(rmin, rmax);
    const x0 = rand.int(0, size - w), y0 = rand.int(0, size - h);
    let clear = true;
    for (let y = y0 - 1; y <= y0 + h && clear; y++) {
      for (let x = x0 - 1; x <= x0 + w && clear; x++) if (inside(m, x, y) && m.area[at(m, x, y)] !== -1) clear = false;
    }
    if (!clear) continue;
    const room = area('room');
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) {
      claim(room, x, y);
      if (x < x0 + w - 1) setEdge(m, x, y, 'e', 'open');
      if (y < y0 + h - 1) setEdge(m, x, y, 's', 'open');
    }
  }

  // 2. Corridors: a maze through each stretch of rock left between rooms.
  for (let y0 = 0; y0 < size; y0++) for (let x0 = 0; x0 < size; x0++) {
    if (m.area[at(m, x0, y0)] !== -1) continue;
    const run = area('corridor');
    claim(run, x0, y0);
    const stack: Array<[number, number]> = [[x0, y0]];
    while (stack.length) {
      const [x, y] = stack[stack.length - 1]!;
      const open = DIRS.filter((d) => { const nx = x + STEP[d][0], ny = y + STEP[d][1]; return inside(m, nx, ny) && m.area[at(m, nx, ny)] === -1; });
      if (!open.length) { stack.pop(); continue; }
      const d = rand.pick(open);
      const nx = x + STEP[d][0], ny = y + STEP[d][1];
      setEdge(m, x, y, d, 'open');
      claim(run, nx, ny);
      stack.push([nx, ny]);
    }
  }

  // 3. Doors: every wall between two areas is a candidate. A spanning tree of
  // plain doors joins them all (rooms never touch, so every room borders a
  // corridor and the candidates join everything); some of the rest make loops.
  type Gap = { x: number; y: number; d: Dir; a: number; b: number };
  const between: Gap[] = [];
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    for (const d of ['e', 's'] as const) {
      const nx = x + STEP[d][0], ny = y + STEP[d][1];
      if (!inside(m, nx, ny)) continue;
      const a = m.area[at(m, x, y)]!, b = m.area[at(m, nx, ny)]!;
      if (a !== b && !(m.areas[a]!.kind === 'room' && m.areas[b]!.kind === 'room')) between.push({ x, y, d, a, b });
    }
  }
  const root = m.areas.map((_, i) => i);
  const find = (i: number): number => (root[i] === i ? i : (root[i] = find(root[i]!)));
  const pairs = new Map<string, number>();
  const walls = new Set<string>();
  const pairOf = (c: Gap) => `${Math.min(c.a, c.b)}-${Math.max(c.a, c.b)}`;
  // Which wall of a room a door is in (the side of the room it faces).
  const wallOf = (c: Gap) => (m.areas[c.a]!.kind === 'room' ? `${c.a}${c.d}` : `${c.b}${({ e: 'w', s: 'n' } as const)[c.d as 'e' | 's']}`);
  const door = (c: Gap, e: Edge) => {
    setEdge(m, c.x, c.y, c.d, e);
    pairs.set(pairOf(c), (pairs.get(pairOf(c)) ?? 0) + 1);
    walls.add(wallOf(c));
  };
  const plain: Edge = theme.doors === 'open' ? 'open' : 'door';
  const rest: Gap[] = [];
  for (const c of rand.shuffle(between)) {
    const ra = find(c.a), rb = find(c.b);
    if (ra !== rb) { root[ra] = rb; door(c, plain); }
    else rest.push(c);
  }
  // Loops: a second door between two areas, in another wall of the room, so
  // it is a second way round and not a second door side by side.
  const loops = spec.loops ?? theme.loops, pLocked = spec.locked ?? theme.locked, pSecret = spec.secret ?? theme.secret;
  for (const c of rest) {
    if ((pairs.get(pairOf(c)) ?? 0) >= 2 || walls.has(wallOf(c)) || !rand.chance(loops)) continue;
    const r = rand.float();
    door(c, r < pSecret ? 'secret' : r < pSecret + pLocked ? 'locked' : plain);
  }

  // 4. Dead ends: a corridor cell with one way out and nothing on it may go
  // back to rock, which can make its neighbour a dead end in turn. The square
  // the stairs up must stand on is kept.
  const prune = spec.pruneDeadEnds ?? theme.pruneDeadEnds;
  const keep = spec.upAt ? at(m, spec.upAt.x, spec.upAt.y) : -1;
  const ways = (x: number, y: number) => DIRS.filter((d) => edge(m, x, y, d) !== 'wall');
  for (let pass = 0; pass < size; pass++) {
    let pruned = false;
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const id = m.area[at(m, x, y)]!;
      if (id === -1 || m.areas[id]!.kind !== 'corridor' || at(m, x, y) === keep) continue;
      const w = ways(x, y);
      if (w.length !== 1 || !rand.chance(prune / 2)) continue;
      // Not the corridor's last cell, nor one whose only way out is a door
      // (the door may be all that joins a room to the rest).
      if (m.areas[id]!.cells.length <= 1 || edge(m, x, y, w[0]!) !== 'open') continue;
      setEdge(m, x, y, w[0]!, 'wall');
      m.area[at(m, x, y)] = -1;
      m.areas[id]!.cells = m.areas[id]!.cells.filter(([cx, cy]) => cx !== x || cy !== y);
      pruned = true;
    }
    if (!pruned) break;
  }

  // 5. The way in: stairs up where the level above put its stairs down, or
  // an entrance in a corridor at the map's edge.
  const mark = (x: number, y: number, feature: Feature, key?: string) => m.features.push({ x, y, feature, ...(key ? { key } : {}) });
  const taken = (x: number, y: number) => m.features.some((f) => f.x === x && f.y === y);
  const corridorCells = m.areas.filter((a) => a.kind === 'corridor').flatMap((a) => a.cells);
  let ex: number, ey: number;
  if (spec.upAt) {
    [ex, ey] = [spec.upAt.x, spec.upAt.y];
    mark(ex, ey, 'stairs-up');
  } else {
    const edgeDist = ([x, y]: [number, number]) => Math.min(x, y, size - 1 - x, size - 1 - y);
    const near = corridorCells.length ? corridorCells : m.areas.flatMap((a) => a.cells);
    const best = Math.min(...near.map(edgeDist));
    [ex, ey] = rand.pick(near.filter((c) => edgeDist(c) === best));
    mark(ex, ey, 'entrance');
  }
  const dist = distances(m, ex, ey);
  const d = (x: number, y: number) => dist[at(m, x, y)]!;
  const farthest = (cells: Array<[number, number]>) => [...cells].sort((p, q) => d(q[0], q[1]) - d(p[0], p[1]))[0]!;
  const entryRoom = m.area[at(m, ex, ey)]!;
  // Rooms, farthest from the way in first (by their nearest square).
  const rooms = m.areas.filter((a) => a.kind === 'room' && a.id !== entryRoom)
    .sort((p, q) => Math.min(...q.cells.map(([x, y]) => d(x, y))) - Math.min(...p.cells.map(([x, y]) => d(x, y))));

  // Locked rooms: each must leave the rest of the level reachable without
  // it, so a key is never shut behind the door it opens.
  const shut = new Set<number>();
  const openWithout = (more: number) => {
    const blocked = new Set([...shut, more]);
    const reach = new Array(size * size).fill(false);
    reach[at(m, ex, ey)] = true;
    const queue: Array<[number, number]> = [[ex, ey]];
    for (let i = 0; i < queue.length; i++) {
      const [x, y] = queue[i]!;
      for (const dd of DIRS) {
        const e = edge(m, x, y, dd);
        if (e !== 'open' && e !== 'door') continue;
        const nx = x + STEP[dd][0], ny = y + STEP[dd][1];
        const id = m.area[at(m, nx, ny)]!;
        if (id === -1 || blocked.has(id) || reach[at(m, nx, ny)]) continue;
        reach[at(m, nx, ny)] = true;
        queue.push([nx, ny]);
      }
    }
    return m.area.every((id, i) => id === -1 || blocked.has(id) || reach[i]);
  };
  const lockRoom = (room: Area, key: string) => {
    shut.add(room.id);
    for (const [x, y] of room.cells) for (const dd of DIRS) {
      const nx = x + STEP[dd][0], ny = y + STEP[dd][1];
      if (!inside(m, nx, ny) || m.area[at(m, nx, ny)] === room.id || edge(m, x, y, dd) === 'wall') continue;
      setEdge(m, x, y, dd, 'locked');
      const [lx, ly, ld] = dd === 'w' ? [x - 1, y, 'e' as const] : dd === 'n' ? [x, y - 1, 's' as const] : [x, y, dd as 'e' | 's'];
      m.locks.push({ x: lx, y: ly, d: ld, key });
    }
  };
  const free = () => rooms.filter((r) => !shut.has(r.id) && !r.cells.some(([x, y]) => taken(x, y)));

  // The boss, in the farthest room it can be locked into; the sub-boss, with
  // its key, in the farthest room left open. Each room has a square for its
  // fight and one more (the treasure, the key).
  let subRoom: Area | undefined;
  if (spec.boss) {
    const bossRoom = free().find((r) => r.cells.length >= 2 && openWithout(r.id));
    if (bossRoom) {
      lockRoom(bossRoom, 'boss');
      const [bx, by] = farthest(bossRoom.cells);
      mark(bx, by, 'boss');
      mark(...bossRoom.cells.find(([x, y]) => !taken(x, y))!, 'treasure');
      subRoom = free().find((r) => r.cells.length >= 2);
      if (subRoom) {
        const [sx, sy] = farthest(subRoom.cells);
        mark(sx, sy, 'sub-boss');
        mark(...subRoom.cells.find(([x, y]) => !taken(x, y))!, 'key', 'boss');
      } else {
        // No room left for it: the key lies in the farthest corridor.
        const spare = corridorCells.filter(([x, y]) => !taken(x, y) && m.area[at(m, x, y)] !== -1);
        if (spare.length) { const [kx, ky] = farthest(spare); mark(kx, ky, 'key', 'boss'); }
      }
    }
  }

  // The stairs down, in the farthest room still open, guarded by the sub-boss
  // on a level with no boss.
  if (spec.stairsDown !== false) {
    const room = free()[0];
    const cells = room ? room.cells : corridorCells.filter(([x, y]) => !taken(x, y) && m.area[at(m, x, y)] !== -1);
    if (!cells.length) throw new Error(`no square left for the stairs down on a map of ${size}`);
    const [sx, sy] = farthest(cells);
    mark(sx, sy, 'stairs-down');
    if (spec.subBoss && !spec.boss && room) {
      const guard = room.cells.find(([x, y]) => !taken(x, y));
      if (guard) mark(guard[0], guard[1], 'sub-boss');
    }
  }

  // Locked rooms with treasure, each key on a square reachable without it.
  for (let k = 1; k <= (spec.keys ?? 0); k++) {
    const room = rand.shuffle(free()).find((r) => openWithout(r.id));
    if (!room) break;
    const key = `key-${k}`;
    lockRoom(room, key);
    mark(...rand.pick(room.cells), 'treasure');
    // The key: somewhere open, a room if there is one, not on another marker.
    const open = m.area.flatMap((id, i) => (id === -1 || shut.has(id) || taken(i % size, Math.floor(i / size)) ? [] : [[i % size, Math.floor(i / size)] as [number, number]]));
    const inRooms = open.filter(([x, y]) => m.areas[m.area[at(m, x, y)]!]!.kind === 'room');
    const [kx, ky] = rand.pick(inRooms.length ? inRooms : open);
    mark(kx, ky, 'key', key);
  }

  // Encounters, spread out and not on the way in; special squares in rooms.
  const spots = rand.shuffle(m.area.flatMap((id, i) => (id === -1 ? [] : [[i % size, Math.floor(i / size)] as [number, number]])))
    .filter(([x, y]) => !taken(x, y) && d(x, y) !== 0 && Math.abs(x - ex) + Math.abs(y - ey) >= 3);
  const fights: Array<[number, number]> = [];
  for (const [x, y] of spots) {
    if (fights.length >= (spec.encounters ?? Math.max(1, Math.round((size * size) / 32)))) break;
    if (fights.some(([fx, fy]) => Math.abs(fx - x) + Math.abs(fy - y) < 3)) continue;
    fights.push([x, y]);
    mark(x, y, 'encounter');
  }
  const roomSpots = rand.shuffle(m.areas.filter((a) => a.kind === 'room').flatMap((a) => a.cells).filter(([x, y]) => !taken(x, y)));
  for (const [x, y] of roomSpots.slice(0, spec.specials ?? Math.max(1, Math.round((size * size) / 64)))) mark(x, y, 'special');
  return m;
}

export interface LevelsSpec extends Omit<DungeonSpec, 'upAt' | 'stairsDown' | 'level' | 'boss'> {
  /** How many levels (default 3). */
  levels?: number;
  /** A theme for each level, top first (default: `theme` for all). */
  themes?: string[];
  /** A boss on the last level (default true). */
  boss?: boolean;
}

/**
 * A stack of dungeon levels. Each level's stairs up stand on the square of
 * the stairs down above it, so a party going down arrives where it left. A
 * sub-boss guards each level's stairs down, and the boss waits on the last,
 * behind a door whose key its sub-boss carries.
 */
export function generateLevels(seed: number, spec: LevelsSpec = {}): GridMap[] {
  const n = spec.levels ?? 3;
  if (!Number.isInteger(n) || n < 1 || n > 20) throw new Error(`1 to 20 levels, not ${n}`);
  const out: GridMap[] = [];
  for (let i = 0; i < n; i++) {
    const last = i === n - 1;
    const down = out[i - 1]?.features.find((f) => f.feature === 'stairs-down');
    const { levels: _levels, themes, theme: _theme, ...rest } = spec;
    const theme = themes?.[i] ?? spec.theme;
    out.push(generateDungeon(seed + i * 7919, {
      ...rest,
      ...(theme ? { theme } : {}),
      level: i,
      ...(down ? { upAt: { x: down.x, y: down.y } } : {}),
      stairsDown: !last,
      boss: last && spec.boss !== false,
      subBoss: spec.subBoss ?? true,
    }));
  }
  return out;
}
