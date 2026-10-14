/**
 * A random square dungeon, Gold Box style: rooms, and every square between
 * them carved into winding corridors, then joined by doors.
 *
 * 1. Rooms: rectangles of open floor, never touching one another.
 * 2. Corridors: every other square is carved as a maze (a random depth-first
 *    walk), one maze per stretch of rock the rooms leave apart.
 * 3. Doors: a random spanning tree of doors joins every room and maze, so the
 *    whole map can be walked through plain doors. A few more doors make loops,
 *    and those may be locked or secret.
 * 4. Dead ends: some corridor tips are filled back in as rock.
 * 5. Features: the entrance, stairs down as far from it as the map allows,
 *    and special squares in rooms.
 */
import { type GridMap, type Area, type Dir, type Edge, DIRS, STEP, blank, inside, at, edge, setEdge, distances, Rand } from './grid.js';

export interface DungeonSpec {
  /** Cells a side (default 16; 8 to 64). */
  size?: number;
  /** How many rooms to try for (default: one per 40 squares). */
  rooms?: number;
  /** A room's sides, in cells (default 2 to 4). */
  roomSize?: [number, number];
  /** Chance each possible second door is made, for loops (default 0.1). */
  loops?: number;
  /** Share of corridor dead ends filled back in with rock (default 0.6). */
  pruneDeadEnds?: number;
  /** Of the loop doors: the share locked, and the share secret (default 0.2 each). */
  locked?: number;
  secret?: number;
  /** How many special squares (default: one per 50 squares). */
  specials?: number;
  /** Put stairs up at the entrance instead of a plain entrance (a deeper level). */
  stairsUp?: boolean;
}

export function generateDungeon(seed: number, spec: DungeonSpec = {}): GridMap {
  const size = spec.size ?? 16;
  if (!Number.isInteger(size) || size < 8 || size > 64) throw new Error(`a dungeon is 8 to 64 cells a side, not ${size}`);
  const [rmin, rmax] = spec.roomSize ?? [2, 4];
  if (rmin < 1 || rmax < rmin || rmax > size / 2) throw new Error(`room sides ${rmin}–${rmax} do not fit a map of ${size}`);
  const rand = new Rand(seed);
  const m = blank('dungeon', size, seed);
  const area = (kind: Area['kind']): Area => { const a: Area = { id: m.areas.length, kind, cells: [] }; m.areas.push(a); return a; };
  const claim = (a: Area, x: number, y: number) => { m.area[at(m, x, y)] = a.id; a.cells.push([x, y]); };

  // 1. Rooms, a cell of rock or corridor between any two.
  const want = spec.rooms ?? Math.max(2, Math.round((size * size) / 40));
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
  const between: Array<{ x: number; y: number; d: Dir; a: number; b: number }> = [];
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    for (const d of ['e', 's'] as const) {
      const nx = x + STEP[d][0], ny = y + STEP[d][1];
      if (!inside(m, nx, ny)) continue;
      const a = m.area[at(m, x, y)]!, b = m.area[at(m, nx, ny)]!;
      // Room to room is never a door: rooms open onto corridors.
      if (a !== b && !(m.areas[a]!.kind === 'room' && m.areas[b]!.kind === 'room')) between.push({ x, y, d, a, b });
    }
  }
  const root = m.areas.map((_, i) => i);
  const find = (i: number): number => (root[i] === i ? i : (root[i] = find(root[i]!)));
  // Doors between two areas, and the walls of each room that already have one.
  const pairs = new Map<string, number>();
  const walls = new Set<string>();
  const pairOf = (c: typeof between[number]) => `${Math.min(c.a, c.b)}-${Math.max(c.a, c.b)}`;
  // Which wall of a room a door is in (the side of the room it faces).
  const wallOf = (c: typeof between[number]) => m.areas[c.a]!.kind === 'room' ? `${c.a}${c.d}` : `${c.b}${({ e: 'w', s: 'n' } as const)[c.d as 'e' | 's']}`;
  const door = (c: typeof between[number], e: Edge) => {
    setEdge(m, c.x, c.y, c.d, e);
    pairs.set(pairOf(c), (pairs.get(pairOf(c)) ?? 0) + 1);
    walls.add(wallOf(c));
  };
  const rest: typeof between = [];
  for (const c of rand.shuffle(between)) {
    const ra = find(c.a), rb = find(c.b);
    if (ra !== rb) { root[ra] = rb; door(c, 'door'); }
    else rest.push(c);
  }
  // Loops: a second door between two areas, in another wall of the room, so
  // it is a second way round and not a second door side by side.
  const loops = spec.loops ?? 0.1, pLocked = spec.locked ?? 0.2, pSecret = spec.secret ?? 0.2;
  for (const c of rest) {
    if ((pairs.get(pairOf(c)) ?? 0) >= 2 || walls.has(wallOf(c)) || !rand.chance(loops)) continue;
    const r = rand.float();
    door(c, r < pSecret ? 'secret' : r < pSecret + pLocked ? 'locked' : 'door');
  }

  // 4. Dead ends: a corridor cell with one way out and nothing on it may go
  // back to rock, which can make its neighbour a dead end in turn.
  const prune = spec.pruneDeadEnds ?? 0.6;
  const ways = (x: number, y: number) => DIRS.filter((d) => edge(m, x, y, d) !== 'wall');
  for (let pass = 0; pass < size; pass++) {
    let pruned = false;
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const id = m.area[at(m, x, y)]!;
      if (id === -1 || m.areas[id]!.kind !== 'corridor') continue;
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

  // 5. The entrance in a corridor near the map's edge; stairs down in the room
  // farthest from it; special squares in the other rooms.
  const corridorCells = m.areas.filter((a) => a.kind === 'corridor').flatMap((a) => a.cells);
  const edgeDist = ([x, y]: [number, number]) => Math.min(x, y, size - 1 - x, size - 1 - y);
  const near = corridorCells.length ? corridorCells : m.areas.flatMap((a) => a.cells);
  const best = Math.min(...near.map(edgeDist));
  const [ex, ey] = rand.pick(near.filter((c) => edgeDist(c) === best));
  m.features.push({ x: ex, y: ey, feature: spec.stairsUp ? 'stairs-up' : 'entrance' });
  const dist = distances(m, ex, ey);
  const roomCells = m.areas.filter((a) => a.kind === 'room').flatMap((a) => a.cells);
  const far = [...(roomCells.length ? roomCells : near)].sort((p, q) => dist[at(m, q[0], q[1])]! - dist[at(m, p[0], p[1])]!)[0]!;
  m.features.push({ x: far[0], y: far[1], feature: 'stairs-down' });
  const free = rand.shuffle(roomCells.filter(([x, y]) => !m.features.some((f) => f.x === x && f.y === y)));
  for (const [x, y] of free.slice(0, spec.specials ?? Math.max(1, Math.round((size * size) / 50)))) m.features.push({ x, y, feature: 'special' });
  return m;
}

