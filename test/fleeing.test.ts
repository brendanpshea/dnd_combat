import { describe, it, expect } from 'vitest';
import { Combat } from '../src/engine/combat.js';
import { buildCharacter } from '../src/builder/character.js';
import { buildMonster } from '../src/data/monsters.js';
import { breakConcentration } from '../src/engine/rules/attack.js';
import type { Combatant, Position } from '../src/engine/types.js';

/**
 * Being turned or talked into leaving used to delete the creature the instant
 * the save failed — a kill with better manners. The thing you spent your
 * Channel Divinity on simply vanished, and nothing about it was visible except
 * a line in the log.
 *
 * Now it runs: no actions, full movement toward the nearest edge every turn,
 * and out of the fight when it gets there. That turns a removal into something
 * that happens on the board over several rounds, which is what makes the
 * counter-play possible — chase it down, block the door, or (for Suggestion)
 * break the caster's concentration before it gets away.
 */

const cleric = (position: Position, id: string): Combatant =>
  ({ ...buildCharacter({ classId: 'cleric', team: 'team1', level: 3, position, speciesId: 'human' }), id });
const foe = (monsterId: string, position: Position, id: string): Combatant =>
  ({ ...buildMonster(monsterId, 'team2', position), id });

/** A wide, empty board, so a flight takes several turns and can be watched. */
function open20(combatants: Combatant[], seed = 3): Combat {
  return new Combat({ seed, width: 20, height: 20, combatants });
}

function until(c: Combat, id: string): void {
  for (let i = 0; i < 60 && c.activeId !== id; i++) c.apply({ kind: 'endTurn' });
}

const onEdge = (p: Position, w = 20, h = 20): boolean =>
  p.x === 0 || p.y === 0 || p.x === w - 1 || p.y === h - 1;

describe('fleeing', () => {
  it('runs for the nearest edge, a bit at a time, and leaves when it arrives', () => {
    const c = open20([cleric({ x: 10, y: 10 }, 'cl'), foe('skeleton', { x: 10, y: 11 }, 'sk')]);
    c.state.combatants['sk']!.conditions.push({ id: 'fleeing', sourceId: 'cl' });

    const seen: Position[] = [{ ...c.state.combatants['sk']!.position }];
    let fled = false;
    for (let i = 0; i < 40 && !fled; i++) {
      fled = c.apply({ kind: 'endTurn' }).some((e) => e.type === 'fled');
      // Only where it actually moved: the cleric's turns come round too, and
      // the skeleton stands still through those.
      const now = c.state.combatants['sk']!.position;
      const last = seen[seen.length - 1]!;
      if (c.state.combatants['sk']!.alive && (now.x !== last.x || now.y !== last.y)) seen.push({ ...now });
    }
    expect(fled, 'never reached an edge on an empty 20x20 board').toBe(true);
    // It took more than one step to get there — the point of the whole change.
    expect(seen.length, 'left in a single hop; nothing to watch').toBeGreaterThan(1);
    // Every step got it closer to an edge.
    const toEdge = (p: Position) => Math.min(p.x, p.y, 19 - p.x, 19 - p.y);
    for (let i = 1; i < seen.length; i++) {
      expect(toEdge(seen[i]!), `step ${i} moved away from the edge`).toBeLessThan(toEdge(seen[i - 1]!));
    }
    // Gone, but not killed.
    expect(c.state.combatants['sk']!.alive).toBe(false);
    expect(c.state.combatants['sk']!.hp).toBe(0);
  });

  it('takes no actions on the way out', () => {
    const c = open20([cleric({ x: 10, y: 10 }, 'cl'), foe('skeleton', { x: 10, y: 11 }, 'sk')]);
    c.state.combatants['sk']!.conditions.push({ id: 'fleeing', sourceId: 'cl' });
    until(c, 'sk');
    expect(c.state.combatants['sk']!.alive, 'should still be running').toBe(true);
    const kinds = new Set(c.legalActions('sk').map((a) => a.kind));
    expect(kinds.has('attack'), 'a fleeing creature must not attack').toBe(false);
    expect(kinds.has('castSpell'), 'nor cast').toBe(false);
  });

  it('is a departure, not a death — it counts as losing the fight', () => {
    // The last enemy running away ends the battle the same way killing it does.
    const c = open20([cleric({ x: 10, y: 10 }, 'cl'), foe('skeleton', { x: 1, y: 1 }, 'sk')]);
    c.state.combatants['sk']!.conditions.push({ id: 'fleeing', sourceId: 'cl' });
    for (let i = 0; i < 40 && !c.isOver(); i++) c.apply({ kind: 'endTurn' });
    expect(c.isOver()).toBe(true);
    expect(c.state.winner).toBe('team1');
  });

  /**
   * Turn Undead is not concentration — RAW it lasts a minute, which outlasts
   * any fight here — so nothing the cleric does or suffers calls the horde
   * back. Suggestion is, and that difference is the whole texture of the two.
   */
  it('a turned undead keeps running even if the cleric drops everything', () => {
    const c = open20([cleric({ x: 10, y: 10 }, 'cl'), foe('skeleton', { x: 10, y: 11 }, 'sk')]);
    until(c, 'cl');
    const events = c.apply({ kind: 'useFeature', featureId: 'turn-undead' });
    if (!events.some((e) => e.type === 'conditionApplied' && e.condition === 'fleeing')) return; // saved
    breakConcentration(c.state, 'cl');
    expect(c.state.combatants['sk']!.conditions.some((k) => k.id === 'fleeing'),
      'Turn Undead is not concentration and must not lapse').toBe(true);
  });

  /**
   * Cornered. A creature with no route to any edge used to stand still for the
   * rest of the battle — measured at all 100 rounds, until the round cap ended
   * it. Now the flight lapses and it turns and fights, which also makes
   * standing in the only doorway a real thing to do.
   */
  it('gives up and fights when there is nowhere to run', () => {
    // A sealed inner chamber: no path from inside it to any board edge.
    const rows = [
      '############',
      '#..........#',
      '#.########.#',
      '#.#......#.#',
      '#.#..##..#.#',
      '#.#..##..#.#',
      '#.#......#.#',
      '#.########.#',
      '#..........#',
      '############',
    ];
    const c = new Combat({
      seed: 1,
      map: { id: 'box', name: 'Sealed Chamber', theme: 'stone', rows },
      combatants: [cleric({ x: 3, y: 3 }, 'cl'), foe('skeleton', { x: 8, y: 6 }, 'sk')],
    });
    c.state.combatants['sk']!.conditions.push({ id: 'fleeing', sourceId: 'cl' });
    until(c, 'sk');
    const sk = c.state.combatants['sk']!;
    expect(sk.alive, 'it cannot leave, so it must still be here').toBe(true);
    expect(sk.conditions.some((k) => k.id === 'fleeing'), 'cornered: the flight must lapse').toBe(false);
    expect(onEdge(sk.position, 12, 10), 'it never reached an edge').toBe(false);
  });
});
