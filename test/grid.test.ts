import { describe, it, expect } from 'vitest';
import {
  makeGrid, distanceCells, distanceFeet, adjacent, hasLineOfSight,
  reachable, pathTo, sphere2x2, cone15,
} from '../src/engine/grid.js';
import { cellAt, Position } from '../src/engine/types.js';

const p = (x: number, y: number): Position => ({ x, y });

describe('distance (Chebyshev)', () => {
  it('diagonals cost the same as orthogonals', () => {
    expect(distanceCells(p(0, 0), p(3, 3))).toBe(3);
    expect(distanceCells(p(0, 0), p(3, 0))).toBe(3);
    expect(distanceCells(p(2, 1), p(5, 7))).toBe(6);
    expect(distanceFeet(p(0, 0), p(4, 2))).toBe(20);
  });

  it('adjacency includes diagonals, excludes self and range 2', () => {
    expect(adjacent(p(4, 4), p(5, 5))).toBe(true);
    expect(adjacent(p(4, 4), p(4, 5))).toBe(true);
    expect(adjacent(p(4, 4), p(4, 4))).toBe(false);
    expect(adjacent(p(4, 4), p(6, 4))).toBe(false);
  });
});

describe('line of sight', () => {
  it('is clear on an open grid and symmetric', () => {
    const g = makeGrid(8, 8);
    expect(hasLineOfSight(g, p(0, 0), p(7, 7))).toBe(true);
    expect(hasLineOfSight(g, p(7, 7), p(0, 0))).toBe(true);
  });

  it('is blocked by a wall between the endpoints', () => {
    const g = makeGrid(8, 8);
    cellAt(g, p(3, 3))!.terrain = 'wall';
    expect(hasLineOfSight(g, p(0, 3), p(7, 3))).toBe(false);
    // Endpoints themselves being walls is not this function's concern:
    expect(hasLineOfSight(g, p(0, 0), p(7, 0))).toBe(true);
  });
});

describe('reachable / pathTo', () => {
  it('reaches exactly speed/5 cells on open ground', () => {
    const g = makeGrid(8, 8);
    const r = reachable(g, p(0, 0), 30, new Set());
    expect(r.costs.get('6,6')).toBe(30); // 6 diagonal steps
    expect(r.costs.has('7,7')).toBe(false); // 7 steps > 30ft
    expect(r.costs.get('0,0')).toBe(0);
  });

  it('difficult terrain doubles cost', () => {
    const g = makeGrid(8, 1);
    for (let x = 1; x < 8; x++) cellAt(g, p(x, 0))!.terrain = 'difficult';
    const r = reachable(g, p(0, 0), 30, new Set());
    expect(r.costs.get('3,0')).toBe(30);
    expect(r.costs.has('4,0')).toBe(false);
  });

  it('cannot pass through hostiles but can pass through others', () => {
    const g = makeGrid(3, 1); // corridor
    cellAt(g, p(1, 0))!.occupantId = 'enemy';
    const blocked = reachable(g, p(0, 0), 30, new Set(['enemy']));
    expect(blocked.costs.has('2,0')).toBe(false);
    const open = reachable(g, p(0, 0), 30, new Set());
    expect(open.costs.get('2,0')).toBe(10);
  });

  it('walls block movement', () => {
    const g = makeGrid(3, 1);
    cellAt(g, p(1, 0))!.terrain = 'wall';
    const r = reachable(g, p(0, 0), 100, new Set());
    expect(r.costs.has('2,0')).toBe(false);
  });

  it('pathTo reconstructs a valid contiguous path', () => {
    const g = makeGrid(8, 8);
    const r = reachable(g, p(0, 0), 30, new Set());
    const path = pathTo(r, p(0, 0), p(4, 2))!;
    expect(path[0]).toEqual(p(0, 0));
    expect(path[path.length - 1]).toEqual(p(4, 2));
    for (let i = 1; i < path.length; i++) {
      expect(distanceCells(path[i - 1]!, path[i]!)).toBe(1);
    }
    expect(path.length - 1).toBe(4); // shortest: 4 steps
  });
});

describe('AoE templates', () => {
  it('sphere2x2 covers a 2x2 block', () => {
    const cells = sphere2x2(p(3, 3));
    expect(cells).toHaveLength(4);
    expect(cells).toContainEqual(p(3, 3));
    expect(cells).toContainEqual(p(4, 4));
  });

  it('cone15 orthogonal has 6 cells widening 1/2/3', () => {
    const east = cone15(p(0, 0), 'e');
    expect(east).toHaveLength(6);
    expect(east.filter((c) => c.x === 1)).toHaveLength(1);
    expect(east.filter((c) => c.x === 2)).toHaveLength(2);
    expect(east.filter((c) => c.x === 3)).toHaveLength(3);
    expect(east).not.toContainEqual(p(0, 0));
  });

  it('cone15 rotates correctly to all orthogonal directions', () => {
    for (const dir of ['n', 's', 'e', 'w'] as const) {
      const cells = cone15(p(4, 4), dir);
      expect(cells).toHaveLength(6);
      // All cells within Chebyshev 3 of origin, none the origin.
      for (const c of cells) {
        expect(distanceCells(p(4, 4), c)).toBeGreaterThanOrEqual(1);
        expect(distanceCells(p(4, 4), c)).toBeLessThanOrEqual(3);
      }
    }
  });

  it('cone15 diagonal is a symmetric 6-cell wedge', () => {
    const ne = cone15(p(0, 0), 'ne');
    expect(ne).toHaveLength(6);
    expect(ne).toContainEqual(p(1, 1));
    expect(ne).toContainEqual(p(2, 2));
    // Symmetric across the diagonal: (2,1) mirrors (1,2), (3,2) mirrors (2,3).
    expect(ne).toContainEqual(p(2, 1));
    expect(ne).toContainEqual(p(1, 2));
    const sw = cone15(p(5, 5), 'sw');
    expect(sw).toContainEqual(p(4, 4));
    expect(sw).toContainEqual(p(3, 3));
  });
});
