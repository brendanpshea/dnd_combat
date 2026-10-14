/**
 * Square maps of a fixed size, Gold Box style: every square is a cell, and
 * walls and doors stand on the edges between cells, not in them. A cell may
 * also be solid rock (no area), as a dungeon's pruned dead ends are.
 *
 * The map is plain data, so a game can save it, draw it, or walk it however
 * it likes. These helpers read and write its edges.
 */
import { seedRng, next, type RngState } from '../engine/rng.js';

export type Dir = 'n' | 'e' | 's' | 'w';
export const DIRS: readonly Dir[] = ['n', 'e', 's', 'w'];
export const STEP: Record<Dir, readonly [number, number]> = { n: [0, -1], e: [1, 0], s: [0, 1], w: [-1, 0] };
export const OPPOSITE: Record<Dir, Dir> = { n: 's', e: 'w', s: 'n', w: 'e' };

/**
 * What stands on an edge. A `door` opens; a `locked` door wants a key or a
 * pick; a `secret` door looks like a wall until it is found.
 */
export type Edge = 'open' | 'wall' | 'door' | 'locked' | 'secret';

/**
 * Something on a square: where the party comes in, the stairs, a key, a
 * fight (an `encounter`, a `sub-boss`, the `boss`), `treasure`, or a
 * `special` square the game should put something on (a trap, a message).
 */
export type Feature = 'entrance' | 'stairs-up' | 'stairs-down' | 'special' | 'key' | 'encounter' | 'sub-boss' | 'boss' | 'treasure';

/** A feature on a square. A `key` names the lock it opens. */
export interface Marker { x: number; y: number; feature: Feature; key?: string }

/** A locked door that a named key opens, on the east or south edge of (x, y). */
export interface Lock { x: number; y: number; d: 'e' | 's'; key: string }

export type AreaKind = 'room' | 'corridor' | 'street' | 'building';

/** A connected piece of the map: a room, a run of corridor, the streets, a building. */
export interface Area {
  id: number;
  kind: AreaKind;
  cells: Array<[number, number]>;
  /** A town building's place: its kind ('inn') and its name on the map. */
  place?: { kind: string; name: string };
}

export interface GridMap {
  kind: 'dungeon' | 'town';
  size: number;
  seed: number;
  /** A dungeon's layout theme, and which level it is (0 at the top). */
  theme?: string;
  level?: number;
  /** Area id of each cell, by `y * size + x`; -1 is solid rock. */
  area: number[];
  /** The edge east of each cell (`y * size + x`); the east border is always wall. */
  east: Edge[];
  /** The edge south of each cell; the south border is always wall. */
  south: Edge[];
  areas: Area[];
  features: Marker[];
  /** Locked doors with a key somewhere on the map. A `locked` edge with no
   *  lock here has no key: it is picked or broken. */
  locks: Lock[];
}

export const inside = (m: Pick<GridMap, 'size'>, x: number, y: number) => x >= 0 && y >= 0 && x < m.size && y < m.size;
export const at = (m: Pick<GridMap, 'size'>, x: number, y: number) => y * m.size + x;

/** A blank map: every cell rock, every edge wall. */
export function blank(kind: GridMap['kind'], size: number, seed: number): GridMap {
  const n = size * size;
  return { kind, size, seed, area: new Array(n).fill(-1), east: new Array(n).fill('wall'), south: new Array(n).fill('wall'), areas: [], features: [], locks: [] };
}

/** The edge on side `d` of cell (x, y); off the map is wall. */
export function edge(m: GridMap, x: number, y: number, d: Dir): Edge {
  const [dx, dy] = STEP[d];
  if (!inside(m, x + dx, y + dy)) return 'wall';
  if (d === 'e') return m.east[at(m, x, y)]!;
  if (d === 's') return m.south[at(m, x, y)]!;
  if (d === 'w') return m.east[at(m, x - 1, y)]!;
  return m.south[at(m, x, y - 1)]!;
}

/** Set the edge on side `d` of cell (x, y). The map's border cannot be opened. */
export function setEdge(m: GridMap, x: number, y: number, d: Dir, e: Edge): void {
  const [dx, dy] = STEP[d];
  if (!inside(m, x + dx, y + dy)) return;
  if (d === 'e') m.east[at(m, x, y)] = e;
  else if (d === 's') m.south[at(m, x, y)] = e;
  else if (d === 'w') m.east[at(m, x - 1, y)] = e;
  else m.south[at(m, x, y - 1)] = e;
}

/** Which edges a walk may cross. By default an open edge or a plain door. */
export type Passable = (e: Edge) => boolean;
export const WALKABLE: Passable = (e) => e === 'open' || e === 'door';

/** Steps from (x0, y0) to every cell a walk reaches; -1 where it does not. */
export function distances(m: GridMap, x0: number, y0: number, pass: Passable = WALKABLE, keys: readonly string[] = []): number[] {
  const dist = new Array(m.size * m.size).fill(-1);
  dist[at(m, x0, y0)] = 0;
  const queue: Array<[number, number]> = [[x0, y0]];
  for (let i = 0; i < queue.length; i++) {
    const [x, y] = queue[i]!;
    for (const d of DIRS) {
      const e = edge(m, x, y, d);
      if (!pass(e)) {
        // A locked door opens to the key that fits it.
        const k = e === 'locked' ? lockAt(m, x, y, d) : undefined;
        if (!k || !keys.includes(k)) continue;
      }
      const nx = x + STEP[d][0], ny = y + STEP[d][1];
      if (!inside(m, nx, ny) || dist[at(m, nx, ny)] !== -1 || m.area[at(m, nx, ny)] === -1) continue;
      dist[at(m, nx, ny)] = dist[at(m, x, y)]! + 1;
      queue.push([nx, ny]);
    }
  }
  return dist;
}

/** The key that opens the door on side `d` of (x, y), if it has one. */
export function lockAt(m: GridMap, x: number, y: number, d: Dir): string | undefined {
  const [ex, ey, ed] = d === 'w' ? [x - 1, y, 'e'] : d === 'n' ? [x, y - 1, 's'] : [x, y, d];
  return m.locks.find((l) => l.x === ex && l.y === ey && l.d === ed)?.key;
}

/**
 * Walk the map as a player would: from the way in, through open edges and
 * plain doors, picking up every key reached and opening the locks it fits.
 * Returns the keys in the order found and every square reached. A map is
 * solvable when that is every open square.
 */
export function solve(m: GridMap, from?: { x: number; y: number }): { keys: string[]; reached: Set<number> } {
  const start = from ?? m.features.find((f) => f.feature === 'entrance' || f.feature === 'stairs-up')!;
  const held: string[] = [];
  for (;;) {
    const dist = distances(m, start.x, start.y, WALKABLE, held);
    const reached = new Set(dist.flatMap((d, i) => (d >= 0 ? [i] : [])));
    const found = m.features.filter((f) => f.feature === 'key' && f.key && !held.includes(f.key) && reached.has(at(m, f.x, f.y)));
    if (!found.length) return { keys: held, reached };
    held.push(...found.map((f) => f.key!));
  }
}

/** The feature on a square, if any. */
export const featureAt = (m: GridMap, x: number, y: number) => m.features.find((f) => f.x === x && f.y === y)?.feature;

/** A small seeded random source over the engine's mulberry32. */
export class Rand {
  private s: RngState;
  constructor(seed: number) { this.s = seedRng(seed); }
  float(): number { const r = next(this.s); this.s = r.state; return r.value; }
  /** An integer in [lo, hi]. */
  int(lo: number, hi: number): number { return lo + Math.floor(this.float() * (hi - lo + 1)); }
  chance(p: number): boolean { return this.float() < p; }
  pick<T>(xs: readonly T[]): T { return xs[Math.floor(this.float() * xs.length)]!; }
  shuffle<T>(xs: readonly T[]): T[] {
    const a = [...xs];
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(this.float() * (i + 1)); [a[i], a[j]] = [a[j]!, a[i]!]; }
    return a;
  }
}

/**
 * The map as text, two characters a cell. Walls `|` and `--`, doors `D`,
 * locked doors `L` (`K` where a key fits), secret doors `S`, rock `##`. On a
 * cell: `E` the entrance, `>` stairs down, `<` stairs up, `*` a special
 * square, `k` a key, `!` an encounter, `b` the sub-boss, `B` the boss, `$`
 * treasure, and a town
 * building's door square shows its place's number (`placesLegend`).
 */
export function toAscii(m: GridMap): string {
  const mark: Record<Edge, string> = { open: ' ', wall: '|', door: 'D', locked: 'L', secret: 'S' };
  const flat: Record<Edge, string> = { open: '  ', wall: '--', door: 'DD', locked: 'LL', secret: 'SS' };
  const glyph: Record<Feature, string> = { entrance: 'E ', 'stairs-up': '< ', 'stairs-down': '> ', special: '* ',
    key: 'k ', encounter: '! ', 'sub-boss': 'b ', boss: 'B ', treasure: '$ ' };
  const doorOf = new Map<number, string>();
  m.areas.filter((a) => a.place).forEach((a, n) => {
    for (const [x, y] of a.cells) {
      if (DIRS.some((d) => edge(m, x, y, d) !== 'wall' && edge(m, x, y, d) !== 'open')) doorOf.set(at(m, x, y), `${n + 1}`.padEnd(2));
    }
  });
  const lines: string[] = [];
  lines.push('+' + Array.from({ length: m.size }, () => '--+').join(''));
  for (let y = 0; y < m.size; y++) {
    let row = '|', under = '+';
    for (let x = 0; x < m.size; x++) {
      const i = at(m, x, y);
      const f = featureAt(m, x, y);
      row += m.area[i] === -1 ? '##' : f ? glyph[f] : doorOf.get(i) ?? '  ';
      row += x === m.size - 1 ? '|' : lockAt(m, x, y, 'e') ? 'K' : mark[m.east[i]!];
      under += (y === m.size - 1 ? '--' : lockAt(m, x, y, 's') ? 'KK' : flat[m.south[i]!]) + '+';
    }
    lines.push(row, under);
  }
  return lines.join('\n');
}

/** The numbers `toAscii` puts on a town's places, with their names. */
export function placesLegend(m: GridMap): string {
  return m.areas.filter((a) => a.place).map((a, n) => `${String(n + 1).padStart(2)}  ${a.place!.name}`).join('\n');
}
