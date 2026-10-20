/**
 * The AI goes round a wall to its foe.
 *
 * Both AIs judged a step by the straight-line distance to the nearest enemy,
 * so with a wall between, the way round (which first leads away) scored worse
 * than standing still, and a monster waited at the wall all fight with its foe
 * two cells off on the other side. They count cells to walk now (walk.ts).
 */
import { describe, it, expect } from 'vitest';
import { Combat } from '../src/engine/combat.js';
import { chooseAction } from '../src/ai/greedy.js';
import { chooseActionSim } from '../src/ai/simulated.js';
import { walkToFoes } from '../src/ai/walk.js';
import { buildCharacter } from '../src/builder/character.js';
import { buildMonster } from '../src/data/monsters.js';
import type { MapData } from '../src/data/maps.js';
import type { Position } from '../src/engine/types.js';

/** Rows top first (y = height-1-i). A wall between the two, open only at its right-hand end. */
const ROWS = [
  '............',
  '............',
  '##########..',
  '............',
  '............',
];
const map: MapData = { id: 'probe', name: 'Probe', theme: 'stone', rows: ROWS };

/** An orc above the wall, a fighter (with nothing to throw) straight below it, and the orc to act. */
function fight(): Combat {
  const hero = { ...buildCharacter({ classId: 'fighter', team: 'team1', level: 1, position: { x: 2, y: 0 } }), id: 'hero' };
  hero.inventory = [];
  hero.equipped = { mainHand: 'longsword' };
  const orc = buildMonster('orc', 'team2', { x: 2, y: 4 }, '1');
  orc.inventory = [];
  const c = new Combat({ map, combatants: [hero, orc], seed: 3 });
  let guard = 0;
  while (c.state.combatants[c.activeId]!.team !== 'team2' && guard++ < 20) c.apply({ kind: 'endTurn' });
  return c;
}

describe('the AI goes round a wall', () => {
  it('counts the way round, not the way through', () => {
    const c = fight();
    const walk = walkToFoes(c.state, 'team2');
    // Four cells as the crow flies; round by the gap at the wall's end, far more.
    expect(walk({ x: 2, y: 4 })).toBeGreaterThan(10);
    // Along the wall towards the gap is closer, to walk.
    expect(walk({ x: 8, y: 4 })).toBeLessThan(walk({ x: 2, y: 4 }));
    // Beside the foe: one.
    expect(walk({ x: 3, y: 1 })).toBe(1);
  });

  for (const [name, choose] of [
    ['the quick player', (c: Combat) => chooseAction(c.state, c.activeId)],
    ['the look-ahead player', (c: Combat) => chooseActionSim(c.state, c.activeId)],
  ] as const) {
    it(`sets off round it: ${name}`, () => {
      const c = fight();
      const orc = Object.values(c.state.combatants).find((x) => x.team === 'team2')!;
      const walk = walkToFoes(c.state, 'team2');
      const before = walk(orc.position);
      let guard = 0;
      // Its turn, as the AI plays it: wherever it ends up is nearer to walk.
      while (c.activeId === orc.id && guard++ < 10) {
        const a = choose(c);
        c.apply(a);
        if (a.kind === 'endTurn') break;
      }
      const at: Position = c.state.combatants[orc.id]!.position;
      expect(walk(at)).toBeLessThan(before);
    });
  }
});
