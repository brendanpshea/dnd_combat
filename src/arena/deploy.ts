/**
 * Where the enemy starts.
 *
 * Both sides used to deploy on opposite back ranks, every fight, forever. That
 * single layout is most of why positioning was close to free: it hands the
 * defender a free approach phase — several rounds of shooting at something
 * walking toward you in a straight line, with no decision to make and nothing
 * to lose by standing still. Measured at level 1 over 40 seeds, a party that
 * never took a step won as often as one played properly.
 *
 * So the far rank becomes one option among several rather than the only one.
 * Nothing here is a new rule — no cover, no flanking, no elevation. It is
 * purely *where the fight begins*, which is the cheapest lever on the board.
 *
 * DIFFICULTY IS HELD, NOT GUESSED. Every pattern deploys the same monsters at
 * the same headcount; only their starting cells change. Advanced and pincer
 * shapes do buy the enemy a round or two of approach, so the mix is weighted
 * toward the classic layout and `test/deploy.test.ts` pins the shares. See
 * arena/run.ts — EVEN_BUDGET is measured, and a change here is exactly the kind
 * of thing that moves it.
 */
import type { GridState, Position } from '../engine/types.js';
import { cellAt } from '../engine/types.js';
import type { RngState } from '../engine/rng.js';
import { next } from '../engine/rng.js';

export type DeployPattern = 'far-rank' | 'advanced' | 'pincer' | 'scattered';

/**
 * The mix. Weighted, not uniform: the far rank is still what most fights look
 * like, so the others read as a variation on a familiar shape rather than as
 * noise. Ordered by how far they move the enemy from the classic layout.
 */
const WEIGHTS: Array<[DeployPattern, number]> = [
  ['far-rank', 45],
  ['advanced', 25],
  ['pincer', 18],
  ['scattered', 12],
];

export function pickPattern(state: RngState): { value: DeployPattern; state: RngState } {
  const total = WEIGHTS.reduce((n, [, w]) => n + w, 0);
  const r = next(state);
  let roll = r.value * total;
  for (const [pattern, w] of WEIGHTS) {
    roll -= w;
    if (roll < 0) return { value: pattern, state: r.state };
  }
  return { value: 'far-rank', state: r.state };
}

/** Can something stand here? Walls and occupied cells are out. */
function open(grid: GridState, p: Position): boolean {
  if (p.x < 0 || p.y < 0 || p.x >= grid.width || p.y >= grid.height) return false;
  const cell = cellAt(grid, p);
  return !!cell && cell.terrain !== 'wall' && cell.occupantId === undefined;
}

/**
 * The nearest open cell to `want`, searched in rings so a blocked preference
 * degrades to something adjacent rather than to the far corner. `taken` covers
 * the cells this same deployment has already claimed, which the grid does not
 * know about yet.
 */
function nearestOpen(
  grid: GridState, want: Position, taken: Set<string>, minY: number,
): Position | undefined {
  for (let radius = 0; radius < Math.max(grid.width, grid.height); radius++) {
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== radius) continue;
        const p = { x: want.x + dx, y: want.y + dy };
        // Never deploy into the party's own deployment zone, whatever the
        // pattern asked for — starting the fight already adjacent is an ambush,
        // not a variation, and it is not what any of these are meant to be.
        if (p.y < minY) continue;
        const key = `${p.x},${p.y}`;
        if (taken.has(key) || !open(grid, p)) continue;
        return p;
      }
    }
  }
  return undefined;
}

/**
 * Starting cells for `count` foes on `grid`, for a party deployed on rank 0.
 *
 * Always returns exactly `count` positions when the map has room: a pattern
 * that cannot be honoured falls back cell by cell, never by dropping a monster.
 */
export function deployPositions(
  grid: GridState, count: number, pattern: DeployPattern, state: RngState,
): { value: Position[]; state: RngState } {
  const far = grid.height - 1;
  // The party holds rank 0 and its immediate front; keep the enemy out of it.
  const minY = Math.min(3, far);
  // The same file spread buildEncounter uses, so a wide group fans out from
  // the centre rather than filling in from one edge.
  const files = [3, 1, 5, 2, 6, 0, 7, 4];
  const taken = new Set<string>();
  const out: Position[] = [];
  let rng = state;

  const want = (i: number): Position => {
    switch (pattern) {
      // The classic: everyone on the back rank.
      case 'far-rank':
        return { x: files[i % files.length]! % grid.width, y: far };
      // A few paces up the board. Cuts the free approach phase without
      // changing who is fighting whom.
      case 'advanced':
        return { x: files[i % files.length]! % grid.width, y: Math.max(minY, far - 3) };
      // Split down both flanks, so the party cannot face one direction and
      // hold. Alternates sides as the group is laid out.
      case 'pincer': {
        const side = i % 2 === 0 ? 0 : grid.width - 1;
        const depth = far - Math.floor(i / 2) * 2;
        return { x: side, y: Math.max(minY, depth) };
      }
      // Spread through the far half at mixed depths: no line to hold, and the
      // party has to pick which threat to answer first.
      case 'scattered':
      default: {
        const r = next(rng); rng = r.state;
        const depth = Math.floor(minY + r.value * (far - minY + 1));
        return { x: files[i % files.length]! % grid.width, y: depth };
      }
    }
  };

  for (let i = 0; i < count; i++) {
    const spot = nearestOpen(grid, want(i), taken, minY);
    if (!spot) continue;
    taken.add(`${spot.x},${spot.y}`);
    out.push(spot);
  }
  return { value: out, state: rng };
}

/** Pattern and positions in one call — what a fight builder actually wants. */
export function deployFoes(
  grid: GridState, count: number, state: RngState,
): { value: { pattern: DeployPattern; positions: Position[] }; state: RngState } {
  const p = pickPattern(state);
  const spots = deployPositions(grid, count, p.value, p.state);
  return { value: { pattern: p.value, positions: spots.value }, state: spots.state };
}
