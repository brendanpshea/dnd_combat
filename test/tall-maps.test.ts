import { describe, it, expect } from 'vitest';
import { MAPS, parseMap, farRank } from '../src/data/maps.js';
import { Combat } from '../src/engine/combat.js';
import { buildParty } from '../src/builder/character.js';
import { buildEncounter } from '../src/data/encounters.js';
import { chooseAction } from '../src/ai/greedy.js';
import { parseCell, cellName, renderBoard } from '../src/ui/cli/renderer.js';

/**
 * 8×12 maps: same width as every other map — cells stay finger-sized on a
 * phone — but half again as deep, so a fight has an approach phase. Everything
 * here guards the assumptions that used to be silently 8: deployment ranks,
 * the CLI cell grammar, and that the AI can actually cross the longer board.
 */
describe('tall maps (8×12)', () => {
  it('pass and cliff parse to 8×12 with clear deploy rows', () => {
    for (const id of ['pass', 'cliff']) {
      const g = parseMap(MAPS[id]!);
      expect([g.width, g.height], id).toEqual([8, 12]);
      // Both deploy ranks must be open on the default files, or spawns collide
      // with walls (the cliff's first draft failed exactly this).
      for (const y of [0, g.height - 1]) {
        for (const x of [1, 2, 4, 6]) {
          expect(g.cells[y * g.width + x]!.terrain, `${id} (${x},${y})`).toBe('open');
        }
      }
    }
  });

  it('farRank reads the map, not a constant', () => {
    expect(farRank('pass')).toBe(11);
    expect(farRank('cliff')).toBe(11);
    expect(farRank('open')).toBe(7);
    expect(farRank(undefined)).toBe(7); // no map = the default 8×8 grid
    expect(farRank('nonsense')).toBe(7);
  });

  it('parseCell handles two-digit rows, cellName round-trips them', () => {
    expect(parseCell('a12')).toEqual({ x: 0, y: 11 });
    expect(parseCell('h10')).toEqual({ x: 7, y: 9 });
    expect(parseCell('b9')).toEqual({ x: 1, y: 8 });
    expect(cellName({ x: 0, y: 11 })).toBe('a12');
    expect(parseCell(cellName({ x: 7, y: 11 }))).toEqual({ x: 7, y: 11 });
    expect(parseCell('z99')).toBeDefined(); // bounds are the caller's job
    expect(parseCell('a0')).toBeUndefined();
  });

  // The regression that motivated farRank: hardcoded rank 7 would deploy the
  // enemy mid-board on a 12-tall map, deleting the approach phase entirely.
  it('deploys the two sides at opposite ends of the long axis', () => {
    const c = new Combat({
      seed: 3, mapId: 'pass',
      combatants: [
        ...buildParty('team1', 0, 3),
        ...buildEncounter('boar-stampede', 'team2', farRank('pass')),
      ],
    });
    const ys1 = Object.values(c.state.combatants).filter((x) => x.team === 'team1').map((x) => x.position.y);
    const ys2 = Object.values(c.state.combatants).filter((x) => x.team === 'team2').map((x) => x.position.y);
    expect(Math.max(...ys1)).toBe(0);
    expect(Math.min(...ys2)).toBe(11);
  });

  // End to end: the AI must be able to cross 60 ft of board, fight, and
  // finish. This is the test that catches pathing or dash logic quietly
  // breaking on anything larger than the size everything was tuned on.
  for (const mapId of ['pass', 'cliff']) {
    it(`a full AI battle on ${mapId} completes`, () => {
      const c = new Combat({
        seed: 11, mapId,
        combatants: [
          ...buildParty('team1', 0, 4),
          ...buildEncounter(mapId === 'cliff' ? 'manticore-cliff' : 'boar-stampede', 'team2', farRank(mapId)),
        ],
      });
      let guard = 0;
      while (!c.isOver() && guard++ < 400) {
        c.apply(chooseAction(c.state, c.activeId));
      }
      expect(c.isOver(), `${mapId}: battle did not finish in 400 actions`).toBe(true);
    });
  }

  it('the CLI renders a 12-row board without mangling row labels', () => {
    const c = new Combat({
      seed: 1, mapId: 'cliff',
      combatants: [...buildParty('team1', 0, 3), ...buildEncounter('manticore-cliff', 'team2', 11)],
    });
    const out = renderBoard(c.state);
    expect(out).toContain(' 12 |');
    expect(out).toContain('  1 |');
  });
});
