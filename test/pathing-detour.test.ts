/**
 * A walk may spend a little movement to avoid getting hurt — and only a little.
 *
 * The old rule was that danger could break ties and nothing more, on the
 * grounds that a longer way round can strand a unit short of its target. That
 * is a real failure and it is what these tests are mostly about: the detour is
 * bounded by the destination's own shortest distance plus the slack, so the
 * reachable set cannot shrink and no square can cost more than the slack extra.
 *
 * The tests that matter here are the invariants, not the one nice case. A
 * routing change that finds a prettier path and quietly drops three squares out
 * of a hero's reach is worse than the fire it avoided.
 */
import { describe, it, expect } from 'vitest';
import { makeGrid, reachable, pathTo } from '../src/engine/grid.js';
import { cellAt, type Position } from '../src/engine/types.js';
import { Combat } from '../src/engine/combat.js';
import { buildCharacter } from '../src/builder/character.js';
import { step } from '../src/engine/actions.js';

const p = (x: number, y: number): Position => ({ x, y });
const SLACK = 5;

/**
 * A stand-in for the rules layer's `stepDanger`: entering any hazard cell hurts.
 *
 * Deliberately not imported — `stepDanger` is not exported, and a test that
 * reached for it would be checking the grid against the rules rather than
 * checking the grid. What `reachable` promises is about any danger function.
 */
const hazardDanger = (g: ReturnType<typeof makeGrid>) => (_from: Position, to: Position) =>
  cellAt(g, to)!.terrain === 'hazard' ? 10 : 0;

/**
 * The cost of walking a path, summed step by step. Spelled out rather than
 * imported from the grid: the point of the check is that `costs` and `pathTo`
 * agree about the same route, and asking the module under test to price its own
 * answer would let a matching pair of mistakes through. The fixtures below use
 * only open and hazard ground, both of which are an ordinary five-foot step.
 */
function walkCost(g: ReturnType<typeof makeGrid>, path: Position[]): number {
  let total = 0;
  for (let i = 1; i < path.length; i++) {
    expect(cellAt(g, path[i]!)!.terrain, 'fixture gained terrain this helper cannot price')
      .not.toBe('difficult');
    total += 5;
  }
  return total;
}

describe('a route may buy safety with a little movement', () => {
  /**
   * A seam of fire across the middle with one gap in it, placed so that the gap
   * is exactly one step out of the way.
   *
   * The offset matters and it is easy to get wrong. Diagonals cost the same as
   * orthogonals here, so a walk with three squares of height to play with can
   * already swing two columns wide and come back for free — which the existing
   * equal-length tiebreak handles, and which would make this test pass with the
   * slack removed. From (2,1) to (2,4) the free routes cross y=3 at x=1, 2 or 3;
   * putting the gap at x=4 makes going round cost one square and nothing less.
   */
  function fireLine() {
    const g = makeGrid(8, 8);
    for (let x = 0; x < 8; x++) if (x !== 4) cellAt(g, p(x, 3))!.terrain = 'hazard';
    return g;
  }
  const START = p(2, 1);
  const OVER = p(2, 4);

  it('goes round a fire seam that the shortest route walks straight into', () => {
    const g = fireLine();
    const danger = hazardDanger(g);
    const plain = reachable(g, START, 40, new Set(), danger);
    const short = pathTo(plain, START, OVER)!;
    expect(short.some((c) => cellAt(g, c)!.terrain === 'hazard'),
      'the fixture is wrong: the plain route does not cross the fire').toBe(true);

    const r = reachable(g, START, 40, new Set(), danger, false, false, SLACK);
    const safe = pathTo(r, START, OVER)!;
    expect(safe.some((c) => cellAt(g, c)!.terrain === 'hazard'),
      'still walking through the fire').toBe(false);
    // And it cost exactly the one square, which is the deal.
    expect(r.costs.get('2,4')).toBe(plain.costs.get('2,4')! + SLACK);
  });

  it('charges for the detour it took, not for the route it declined', () => {
    // `executeMove` reads the cost from `costs` and walks the path from
    // `pathTo`. If those two describe different routes, a detour is either free
    // movement or a silent overcharge.
    const g = fireLine();
    const r = reachable(g, START, 40, new Set(), hazardDanger(g), false, false, SLACK);
    for (const [key, cost] of r.costs) {
      const [x, y] = key.split(',').map(Number) as [number, number];
      const path = pathTo(r, START, p(x, y));
      expect(path, `no path to ${key}`).toBeDefined();
      expect(walkCost(g, path!), `cost and route disagree at ${key}`).toBe(cost);
    }
  });

  it('never drops a square the plain route could reach', () => {
    // The stranding argument, as an assertion. A detour that costs somebody a
    // destination is the failure the old tiebreak-only rule was protecting
    // against, and it is the one thing the slack must not reintroduce.
    const g = fireLine();
    const danger = hazardDanger(g);
    for (const budget of [15, 20, 25, 30, 40]) {
      const plain = reachable(g, START, budget, new Set(), danger);
      const slack = reachable(g, START, budget, new Set(), danger, false, false, SLACK);
      for (const [key, min] of plain.costs) {
        expect(slack.costs.has(key), `lost ${key} at ${budget}ft`).toBe(true);
        const cost = slack.costs.get(key)!;
        expect(cost, `${key} costs more than the slack allows at ${budget}ft`)
          .toBeLessThanOrEqual(min + SLACK);
        expect(cost, `${key} got cheaper, which no detour can do`).toBeGreaterThanOrEqual(min);
      }
    }
  });

  it('does not detour when the short way is already clean', () => {
    // A detour taken for nothing is movement stolen from a player who cannot
    // see why. On open ground every route is equally safe, so nothing may move.
    const g = makeGrid(8, 8);
    const danger = hazardDanger(g);
    const plain = reachable(g, p(0, 0), 30, new Set(), danger);
    const slack = reachable(g, p(0, 0), 30, new Set(), danger, false, false, SLACK);
    expect(slack.costs).toEqual(plain.costs);
    expect(slack.routes?.size ?? 0).toBe(0);
  });

  it('is inert without a danger function, at any slack', () => {
    const g = fireLine();
    const plain = reachable(g, START, 40, new Set());
    const slack = reachable(g, START, 40, new Set(), undefined, false, false, SLACK);
    expect(slack.costs).toEqual(plain.costs);
  });

  it('takes the fire when going round costs more than the slack', () => {
    // The bound has to bite, or it is not a bound. A seam with its gap eight
    // squares away is a detour the slack cannot pay for, and the walk goes
    // through — which is why the tap still asks.
    const g = makeGrid(8, 8);
    for (let x = 0; x < 7; x++) cellAt(g, p(x, 3))!.terrain = 'hazard';
    const r = reachable(g, p(0, 1), 60, new Set(), hazardDanger(g), false, false, SLACK);
    const path = pathTo(r, p(0, 1), p(0, 5))!;
    expect(path.some((c) => cellAt(g, c)!.terrain === 'hazard')).toBe(true);
  });
});

describe('the detour is what actually gets walked', () => {
  it('spares a hero the fire pit that the plain route walked them through', () => {
    // End to end through the real engine, so the slack constant, `stepDanger`
    // and `executeMove` are all in the picture — a grid-level test cannot tell
    // whether the rules layer is passing the slack at all.
    const rog = { ...buildCharacter({ classId: 'rogue', team: 'team1', position: p(2, 1), level: 3 }), id: 'rog' };
    const foe = { ...buildCharacter({ classId: 'fighter', team: 'team2', position: p(7, 7), level: 3 }), id: 'ftr' };
    // Open ground, then the same seam painted on by hand. A shipped map would
    // make the test a hostage to its layout: the interesting case is a gap that
    // is exactly one square out of the way, and no map promises to have one.
    const c = new Combat({ seed: 5, mapId: 'open', combatants: [rog, foe] });
    const grid = c.state.grid;
    for (let x = 0; x < grid.width; x++) if (x !== 4) cellAt(grid, p(x, 3))!.terrain = 'hazard';
    let guard = 0;
    while (c.activeId !== 'rog' && guard++ < 20) c.apply({ kind: 'endTurn' });

    const { events } = step(c.state, { kind: 'move', to: p(2, 4) });
    const moved = events.find((e) => e.type === 'moved');
    expect(moved?.type, 'the rogue did not move at all').toBe('moved');
    expect(moved?.type === 'moved' && moved.path.every((q) => cellAt(grid, q)!.terrain !== 'hazard'),
      'the walk still crosses the fire seam').toBe(true);
    // Nothing burned, which is the fact a player actually experiences.
    expect(events.some((e) => e.type === 'damageDealt'), 'something still took hazard damage').toBe(false);
  });
});
