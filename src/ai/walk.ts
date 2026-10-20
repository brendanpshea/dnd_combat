/**
 * HOW FAR TO WALK TO A FOE, NOT HOW FAR AS THE CROW FLIES.
 *
 * Both AIs judged a step by the Chebyshev distance to the nearest enemy. With
 * a wall between, the way round first leads *away* in a straight line, so
 * every step of it scored worse than standing still, and a monster stood at
 * the wall for the whole fight with its foes a few feet away on the other side
 * (reported from a host whose fights start further apart, and round corners).
 * Counted in cells to walk instead — a diagonal one cell but never past a
 * wall's corner (stepNeighbors), through anything that can be entered, other
 * creatures aside — the way round is downhill all the way.
 *
 * One breadth-first sweep from every standing enemy at once, kept for the
 * walls and the positions it was made from: the greedy AI asks it about every
 * cell it can reach, the look-ahead AI about every unit in every state it tries.
 */
import { blocksMovement, distanceCells } from '../engine/grid.js';
import { isDown, type GameState, type GridState, type Position, type TeamId } from '../engine/types.js';

/** What can't be entered, as a string, once per grid object: the key's part that never changes in a fight. */
const wallsOf = new WeakMap<GridState, string>();
function walls(grid: GridState): string {
  let key = wallsOf.get(grid);
  if (key === undefined) {
    key = `${grid.width}x${grid.height}:${grid.cells.map((c) => (blocksMovement(c.terrain) ? (c.terrain === 'wall' ? 'w' : 'c') : '.')).join('')}`;
    wallsOf.set(grid, key);
  }
  return key;
}

const CACHE_SIZE = 256;
const fields = new Map<string, Int32Array>();

/**
 * Cells to walk from `p` to stand next to the nearest standing foe of `team`
 * (1 beside one, 0 on its own cell). Where no way leads (a foe shut in,
 * a cell off the map), the crow's distance, so a score always has a number.
 */
export function walkToFoes(state: GameState, team: TeamId): (p: Position) => number {
  const foes = Object.values(state.combatants).filter((c) => c.alive && !isDown(c) && c.team !== team);
  const grid = state.grid;
  const key = `${walls(grid)}|${foes.map((f) => `${f.position.x},${f.position.y}`).sort().join(' ')}`;
  let field = fields.get(key);
  if (!field) {
    field = sweep(grid, foes.map((f) => f.position));
    if (fields.size >= CACHE_SIZE) fields.delete(fields.keys().next().value!);
    fields.set(key, field);
  }
  const f = field;
  return (p: Position) => {
    const d = p.x >= 0 && p.y >= 0 && p.x < grid.width && p.y < grid.height ? f[p.y * grid.width + p.x]! : -1;
    return d >= 0 ? d : Math.min(Infinity, ...foes.map((foe) => distanceCells(p, foe.position)));
  };
}

function sweep(grid: GridState, from: Position[]): Int32Array {
  const { width: w, height: h } = grid;
  const dist = new Int32Array(w * h).fill(-1);
  const open = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && !blocksMovement(grid.cells[y * w + x]!.terrain);
  const wall = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && grid.cells[y * w + x]!.terrain === 'wall';
  const queue: number[] = [];
  for (const p of from) {
    const i = p.y * w + p.x;
    if (p.x < 0 || p.y < 0 || p.x >= w || p.y >= h || dist[i] === 0) continue;
    dist[i] = 0;
    queue.push(i);
  }
  for (let head = 0; head < queue.length; head++) {
    const i = queue[head]!;
    const x = i % w;
    const y = (i - x) / w;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const nx = x + dx;
        const ny = y + dy;
        if (!open(nx, ny) || dist[ny * w + nx] !== -1) continue;
        // Not past a wall's corner (SRD 5.2.1, Playing on a Grid), as stepNeighbors.
        if (dx !== 0 && dy !== 0 && (wall(x + dx, y) || wall(x, y + dy))) continue;
        dist[ny * w + nx] = dist[i]! + 1;
        queue.push(ny * w + nx);
      }
    }
  }
  return dist;
}
