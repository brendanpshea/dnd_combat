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
import { blocksMovement } from '../engine/grid.js';

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
  return !!cell && !blocksMovement(cell.terrain) && cell.occupantId === undefined;
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
  /*
   * The same file spread buildEncounter uses, so a wide group fans out from
   * the centre rather than filling in from one edge.
   *
   * SCALED TO THE BOARD, not to eight columns. The order is written as eighths
   * and stretched across whatever width it is handed: `% grid.width` used to be
   * the only thing keeping it in bounds, which on a twenty-four-wide board
   * crowded every monster into the left third while the party spread across
   * the whole of it. That is not a harder fight or an easier one — it is a
   * different fight, happening in a strip of the board with the rest unused.
   */
  const files = [3, 1, 5, 2, 6, 0, 7, 4].map((f) =>
    Math.min(grid.width - 1, Math.round((f * grid.width) / 8)));
  const taken = new Set<string>();
  const out: Position[] = [];
  let rng = state;

  const want = (i: number): Position => {
    switch (pattern) {
      // The classic: everyone on the back rank.
      case 'far-rank':
        return { x: files[i % files.length]!, y: far };
      // A few paces up the board. Cuts the free approach phase without
      // changing who is fighting whom.
      case 'advanced':
        return { x: files[i % files.length]!, y: Math.max(minY, far - 3) };
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
        return { x: files[i % files.length]!, y: depth };
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

/**
 * How well a cell shelters whoever stands in it from a party on rank 0.
 *
 * Two things, in order: whether something solid stands between this cell and
 * the party — half cover, +2 AC, and somewhere a creature may hide — and then
 * how far back it is. Purely a question about the ground, so it reads the grid
 * and nothing else.
 */
function shelter(grid: GridState, p: Position): number {
  const front = cellAt(grid, { x: p.x, y: p.y - 1 });
  const covered = !!front && blocksMovement(front.terrain);
  // Diagonals count too: a barricade off one shoulder breaks the line from
  // half the party's rank, which is most of what cover is worth here.
  const flanks = [-1, 1].filter((dx) => {
    const c = cellAt(grid, { x: p.x + dx, y: p.y - 1 });
    return !!c && blocksMovement(c.terrain);
  }).length;
  return (covered ? 100 : 0) + flanks * 25 + p.y;
}

/**
 * Put the shooters where the shooting is good.
 *
 * WHY THIS IS SEPARATE FROM THE PATTERN. A pattern says where a warband
 * stands as a shape — a line, a pincer, a scatter. It cannot say who stands
 * WHERE in that shape, because it does not know what the monsters are, and
 * that is the half that decides whether a board's cover means anything. A
 * barricade line with the archers in front of it and the ogres behind is the
 * same fight as an open field, drawn differently.
 *
 * So the cells are chosen first and dealt afterwards: the most sheltered go to
 * whatever can shoot, the most exposed to whatever has to walk. The shape, the
 * headcount and the cells themselves are exactly what the pattern produced —
 * this only decides who gets which.
 */
export function assignByRole(
  grid: GridState, positions: readonly Position[], ranged: readonly boolean[],
): Position[] {
  const order = positions.map((_, i) => i).sort((a, b) =>
    shelter(grid, positions[b]!) - shelter(grid, positions[a]!));
  const shooters = ranged.map((r, i) => (r ? i : -1)).filter((i) => i >= 0);
  const walkers = ranged.map((r, i) => (r ? -1 : i)).filter((i) => i >= 0);
  const out: Position[] = new Array(positions.length);
  // Shooters take the best cells from the back; everyone else fills forward.
  for (const [k, member] of shooters.entries()) out[member] = positions[order[k]!]!;
  for (const [k, member] of walkers.entries()) out[member] = positions[order[shooters.length + k]!]!;
  return out.map((p, i) => p ?? positions[i]!);
}

/** Pattern and positions in one call — what a fight builder actually wants.
 *  Pass `ranged` (one flag per member, in member order) to have the shooters
 *  dealt the sheltered cells — see `assignByRole`. */
export function deployFoes(
  grid: GridState, count: number, state: RngState, ranged?: readonly boolean[],
): { value: { pattern: DeployPattern; positions: Position[] }; state: RngState } {
  const p = pickPattern(state);
  const spots = deployPositions(grid, count, p.value, p.state);
  const positions = ranged ? assignByRole(grid, spots.value, ranged) : spots.value;
  return { value: { pattern: p.value, positions }, state: spots.state };
}
