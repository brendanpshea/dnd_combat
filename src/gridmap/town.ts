/**
 * A random square town, Gold Box style: a wall round the edge, streets that
 * cross from side to side, and the blocks between them split into buildings.
 * Every building has one door onto a street. The town's named places (the
 * inn, the temple…) go into buildings; the rest are houses, locked.
 *
 * Streets run the full width or height of the map, at least one each way, so
 * they all cross and every street square reaches every other. The gate is
 * where a street meets the town wall.
 */
import { type GridMap, type Area, type Dir, DIRS, STEP, blank, inside, at, edge, setEdge, Rand } from './grid.js';

/** A place a town has: its kind (for the game) and its name (for the map). */
export interface TownPlace { kind: string; name: string }

export const DEFAULT_PLACES: TownPlace[] = [
  { kind: 'inn', name: 'The Inn' },
  { kind: 'temple', name: 'The Temple' },
  { kind: 'shop', name: 'The Shop' },
  { kind: 'training', name: 'The Training Hall' },
  { kind: 'hall', name: 'The City Hall' },
  { kind: 'tavern', name: 'The Tavern' },
];

export interface TownSpec {
  /** Cells a side (default 16; 8 to 64). */
  size?: number;
  /** Its places, each in a building of its own (default DEFAULT_PLACES). */
  places?: TownPlace[];
  /** The cells between two streets (default 2 to 4). */
  blockSize?: [number, number];
  /** A building's largest number of cells (default 6). */
  maxBuilding?: number;
}

export function generateTown(seed: number, spec: TownSpec = {}): GridMap {
  const size = spec.size ?? 16;
  if (!Number.isInteger(size) || size < 8 || size > 64) throw new Error(`a town is 8 to 64 cells a side, not ${size}`);
  const [bmin, bmax] = spec.blockSize ?? [2, 4];
  if (bmin < 1 || bmax < bmin) throw new Error(`block sides ${bmin}–${bmax}`);
  const places = spec.places ?? DEFAULT_PLACES;
  const maxBuilding = spec.maxBuilding ?? 6;
  const rand = new Rand(seed);

  // Streets, rows and columns, a block apart. Retried until there are
  // buildings enough for the places.
  for (let attempt = 0; attempt < 50; attempt++) {
    const m = blank('town', size, seed);
    const lines = () => {
      const out: number[] = [];
      for (let p = rand.int(0, bmin); p < size; p += rand.int(bmin, bmax) + 1) out.push(p);
      return out;
    };
    const rows = new Set(lines()), cols = new Set(lines());
    if (!rows.size || !cols.size) continue;
    const street: Area = { id: 0, kind: 'street', cells: [] };
    m.areas.push(street);
    const isStreet = (x: number, y: number) => rows.has(y) || cols.has(x);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      if (!isStreet(x, y)) continue;
      m.area[at(m, x, y)] = 0;
      street.cells.push([x, y]);
      if (x + 1 < size && isStreet(x + 1, y)) setEdge(m, x, y, 'e', 'open');
      if (y + 1 < size && isStreet(x, y + 1)) setEdge(m, x, y, 's', 'open');
    }

    // Blocks: each run of non-street cells between the lines, split into
    // buildings that each still touch a street.
    const buildings: Area[] = [];
    const seen = new Set<number>();
    for (let y0 = 0; y0 < size; y0++) for (let x0 = 0; x0 < size; x0++) {
      if (isStreet(x0, y0) || seen.has(at(m, x0, y0))) continue;
      let w = 0, h = 0;
      while (x0 + w < size && !isStreet(x0 + w, y0)) w++;
      while (y0 + h < size && !isStreet(x0, y0 + h)) h++;
      for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) seen.add(at(m, x, y));
      for (const [bx, by, bw, bh] of split(x0, y0, w, h)) {
        const b: Area = { id: m.areas.length, kind: 'building', cells: [] };
        m.areas.push(b);
        for (let y = by; y < by + bh; y++) for (let x = bx; x < bx + bw; x++) {
          m.area[at(m, x, y)] = b.id;
          b.cells.push([x, y]);
          if (x < bx + bw - 1) setEdge(m, x, y, 'e', 'open');
          if (y < by + bh - 1) setEdge(m, x, y, 's', 'open');
        }
        buildings.push(b);
      }
    }
    // Split a block until its pieces are small enough, always across a side
    // that faces a street, so both halves keep a street to open onto.
    function split(x: number, y: number, w: number, h: number): Array<[number, number, number, number]> {
      if (w * h <= maxBuilding) return [[x, y, w, h]];
      const faces = (d: Dir) => {
        const cells = d === 'n' || d === 's' ? Array.from({ length: w }, (_, i) => [x + i, d === 'n' ? y - 1 : y + h] as const)
          : Array.from({ length: h }, (_, i) => [d === 'w' ? x - 1 : x + w, y + i] as const);
        return cells.some(([cx, cy]) => inside(m, cx, cy) && isStreet(cx, cy));
      };
      // Cut across: a vertical cut keeps both halves on a north or south street.
      const vertical = w >= 2 && (faces('n') || faces('s')) && (w >= h || !(h >= 2 && (faces('w') || faces('e'))));
      if (vertical) { const k = rand.int(1, w - 1); return [...split(x, y, k, h), ...split(x + k, y, w - k, h)]; }
      if (h >= 2 && (faces('w') || faces('e'))) { const k = rand.int(1, h - 1); return [...split(x, y, w, k), ...split(x, y + k, w, h - k)]; }
      return [[x, y, w, h]];
    }
    if (buildings.length < places.length) continue;

    // A door from each building onto a street.
    for (const b of buildings) {
      const doors = b.cells.flatMap(([x, y]) => DIRS.filter((d) => {
        const nx = x + STEP[d][0], ny = y + STEP[d][1];
        return inside(m, nx, ny) && m.area[at(m, nx, ny)] === 0;
      }).map((d) => [x, y, d] as const));
      if (!doors.length) continue;
      const [x, y, d] = rand.pick(doors);
      setEdge(m, x, y, d, 'locked');
    }
    // The places, in the larger buildings first; the rest stay locked houses.
    const open = rand.shuffle(buildings).sort((a, b) => b.cells.length - a.cells.length);
    places.forEach((p, i) => {
      const b = open[i]!;
      b.place = { ...p };
      for (const [x, y] of b.cells) for (const d of DIRS) {
        const nx = x + STEP[d][0], ny = y + STEP[d][1];
        if (inside(m, nx, ny) && m.area[at(m, nx, ny)] === 0 && edge(m, x, y, d) === 'locked') setEdge(m, x, y, d, 'door');
      }
    });

    // The gate: a street square on the town wall.
    const gates = street.cells.filter(([x, y]) => x === 0 || y === 0 || x === size - 1 || y === size - 1);
    if (!gates.length) continue;
    const [gx, gy] = rand.pick(gates);
    m.features.push({ x: gx, y: gy, feature: 'entrance' });
    return m;
  }
  throw new Error(`no town of size ${size} holds ${places.length} places with blocks of ${bmin}–${bmax}`);
}

