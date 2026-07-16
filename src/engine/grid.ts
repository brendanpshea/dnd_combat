/**
 * Grid geometry: Chebyshev distance, line of sight, BFS pathing over terrain
 * cost, and AoE templates.
 */
import { GridState, Position, Cell, TerrainId, Id, cellAt, posEq } from './types.js';

export const CELL_FEET = 5;

export function makeGrid(width: number, height: number, terrain: TerrainId = 'open'): GridState {
  return {
    width,
    height,
    cells: Array.from({ length: width * height }, (): Cell => ({ terrain })),
  };
}

/** Chebyshev distance in cells (diagonal = 1). */
export function distanceCells(a: Position, b: Position): number {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}

export function distanceFeet(a: Position, b: Position): number {
  return distanceCells(a, b) * CELL_FEET;
}

export function adjacent(a: Position, b: Position): boolean {
  return distanceCells(a, b) === 1;
}

export function inBounds(grid: GridState, p: Position): boolean {
  return p.x >= 0 && p.y >= 0 && p.x < grid.width && p.y < grid.height;
}

export function neighbors(grid: GridState, p: Position): Position[] {
  const out: Position[] = [];
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;
      const n = { x: p.x + dx, y: p.y + dy };
      if (inBounds(grid, n)) out.push(n);
    }
  }
  return out;
}

function terrainMoveCost(t: TerrainId): number {
  switch (t) {
    case 'open': return CELL_FEET;
    case 'difficult': return CELL_FEET * 2;
    case 'hazard': return CELL_FEET;
    case 'wall': return Infinity;
  }
}

/**
 * Line of sight via a supercover line trace: blocked only if a 'wall' cell
 * strictly between the endpoints intersects the segment between cell centers.
 */
export function hasLineOfSight(grid: GridState, from: Position, to: Position): boolean {
  for (const p of lineTrace(from, to)) {
    if (posEq(p, from) || posEq(p, to)) continue;
    const cell = cellAt(grid, p);
    if (!cell || cell.terrain === 'wall') return false;
  }
  return true;
}

/** Cells a segment between two cell centers passes through (supercover Bresenham). */
export function lineTrace(from: Position, to: Position): Position[] {
  const points: Position[] = [];
  let { x, y } = from;
  const dx = Math.abs(to.x - from.x);
  const dy = Math.abs(to.y - from.y);
  const sx = to.x > from.x ? 1 : -1;
  const sy = to.y > from.y ? 1 : -1;
  let err = dx - dy;
  points.push({ x, y });
  while (x !== to.x || y !== to.y) {
    const e2 = 2 * err;
    if (e2 > -dy) { err -= dy; x += sx; }
    if (e2 < dx) { err += dx; y += sy; }
    points.push({ x, y });
  }
  return points;
}

export interface ReachResult {
  /** Movement cost in feet to reach each destination, keyed 'x,y'. */
  costs: Map<string, number>;
  /** Predecessor cell for path reconstruction, keyed 'x,y'. */
  prev: Map<string, Position>;
}

const key = (p: Position) => `${p.x},${p.y}`;

/**
 * Dijkstra over terrain cost from `start` up to `budgetFeet`.
 * - Cannot pass through cells occupied by ids in `blockedBy` (hostiles).
 * - Can pass through (not end on) cells occupied by others (allies).
 * Ending on an occupied cell is disallowed by the caller via `costs` +
 * occupancy check; this function reports raw reachability.
 */
export function reachable(
  grid: GridState,
  start: Position,
  budgetFeet: number,
  blockedBy: Set<Id>,
): ReachResult {
  const costs = new Map<string, number>([[key(start), 0]]);
  const prev = new Map<string, Position>();
  // Costs are also kept in a flat array indexed y*width+x. The Maps are the
  // published result, but looking *up* through them means building an 'x,y'
  // string for every neighbour and every step of the min-scan, which made this
  // the hottest function in the AI's search. The array is a pure lookup
  // accelerator: same visit order, same strict-< tiebreak, same output.
  const cost = new Float64Array(grid.width * grid.height).fill(Infinity);
  const at = (p: Position) => p.y * grid.width + p.x;
  cost[at(start)] = 0;

  // Simple priority-queue-by-scan; grids are tiny (8x8).
  const open: Position[] = [start];
  while (open.length > 0) {
    let bestIdx = 0;
    for (let i = 1; i < open.length; i++) {
      if (cost[at(open[i]!)]! < cost[at(open[bestIdx]!)]!) bestIdx = i;
    }
    const cur = open.splice(bestIdx, 1)[0]!;
    const curCost = cost[at(cur)]!;
    for (const n of neighbors(grid, cur)) {
      const cell = cellAt(grid, n)!;
      if (cell.occupantId !== undefined && blockedBy.has(cell.occupantId)) continue;
      const stepCost = terrainMoveCost(cell.terrain);
      const total = curCost + stepCost;
      if (total > budgetFeet) continue;
      if (total < cost[at(n)]!) {
        cost[at(n)] = total;
        costs.set(key(n), total);
        prev.set(key(n), cur);
        open.push(n);
      }
    }
  }
  return { costs, prev };
}

/** Reconstruct the path start→dest from a ReachResult (inclusive of both ends). */
export function pathTo(result: ReachResult, start: Position, dest: Position): Position[] | undefined {
  if (!result.costs.has(key(dest))) return undefined;
  const path: Position[] = [dest];
  let cur = dest;
  while (!posEq(cur, start)) {
    const p = result.prev.get(key(cur));
    if (!p) return undefined;
    path.push(p);
    cur = p;
  }
  return path.reverse();
}

// ---------------------------------------------------------------------------
// AoE templates (see SPEC §6)
// ---------------------------------------------------------------------------

/** 2x2 sphere block anchored at its lower-left cell. */
export function sphere2x2(anchor: Position): Position[] {
  return [
    { x: anchor.x, y: anchor.y },
    { x: anchor.x + 1, y: anchor.y },
    { x: anchor.x, y: anchor.y + 1 },
    { x: anchor.x + 1, y: anchor.y + 1 },
  ];
}

export type Direction8 = 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'nw';

export const DIRECTIONS: Record<Direction8, Position> = {
  n: { x: 0, y: 1 }, ne: { x: 1, y: 1 }, e: { x: 1, y: 0 }, se: { x: 1, y: -1 },
  s: { x: 0, y: -1 }, sw: { x: -1, y: -1 }, w: { x: -1, y: 0 }, nw: { x: -1, y: 1 },
};

/**
 * Fixed 6-cell templates in a canonical frame, transformed per direction.
 * Orthogonal (pointing east): 1 cell at range 1, 2 at 2, 3 at 3.
 * Diagonal (pointing northeast): symmetric wedge along the diagonal.
 * Origin cell excluded from both.
 */
const CONE15_ORTHO: ReadonlyArray<Position> = [
  { x: 1, y: 0 },
  { x: 2, y: 0 }, { x: 2, y: 1 },
  { x: 3, y: -1 }, { x: 3, y: 0 }, { x: 3, y: 1 },
];
const CONE15_DIAG: ReadonlyArray<Position> = [
  { x: 1, y: 1 },
  { x: 2, y: 1 }, { x: 1, y: 2 }, { x: 2, y: 2 },
  { x: 3, y: 2 }, { x: 2, y: 3 },
];

export function cone15(origin: Position, dir: Direction8): Position[] {
  const d = DIRECTIONS[dir];
  const diagonal = d.x !== 0 && d.y !== 0;
  const template = diagonal ? CONE15_DIAG : CONE15_ORTHO;
  return template.map((c) => {
    // Rotate the canonical frame (east / northeast) into `dir`.
    let { x, y } = c;
    if (diagonal) {
      // Canonical NE frame: axes scale by direction signs.
      return { x: origin.x + x * d.x, y: origin.y + y * d.y };
    }
    // Canonical E frame: forward along d, lateral along the perpendicular.
    const fx = d.x, fy = d.y;          // forward unit vector
    const px = -fy, py = fx;           // perpendicular unit vector
    return { x: origin.x + x * fx + y * px, y: origin.y + x * fy + y * py };
  });
}
