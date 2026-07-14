import { describe, it, expect } from 'vitest';
import { MAPS, MAP_IDS, parseMap } from '../src/data/maps.js';
import { Combat } from '../src/engine/combat.js';
import { buildParty, buildCharacter } from '../src/builder/character.js';
import { chooseAction } from '../src/ai/greedy.js';
import { cellAt } from '../src/engine/types.js';
import { hasLineOfSight, reachable } from '../src/engine/grid.js';
import { makeCombatant } from './helpers.js';

describe('map parsing', () => {
  it('all maps parse to 8x8 with valid terrain', () => {
    for (const id of MAP_IDS) {
      const g = parseMap(MAPS[id]!);
      expect(g.width).toBe(8);
      expect(g.height).toBe(8);
    }
  });

  it('row order: first row is the top rank', () => {
    const g = parseMap({ id: 't', name: 't', rows: ['#.', '..'] });
    expect(cellAt(g, { x: 0, y: 1 })!.terrain).toBe('wall'); // top-left
    expect(cellAt(g, { x: 0, y: 0 })!.terrain).toBe('open');
  });

  it('spawn ranks (y=0 and y=7, files 1,2,4,6) are walkable on every map', () => {
    for (const id of MAP_IDS) {
      const g = parseMap(MAPS[id]!);
      for (const y of [0, 7]) {
        for (const x of [1, 2, 4, 6]) {
          expect(cellAt(g, { x, y })!.terrain).not.toBe('wall');
        }
      }
    }
  });

  it('rejects bad maps', () => {
    expect(() => parseMap({ id: 'bad', name: 'bad', rows: ['..', '.'] })).toThrow(/ragged/);
    expect(() => parseMap({ id: 'bad', name: 'bad', rows: ['.X'] })).toThrow(/unknown terrain/);
  });
});

describe('terrain in combat', () => {
  it('walls block line of sight between the ruins walls', () => {
    const g = parseMap(MAPS['corridor']!);
    // b3 (1,2) to b6 (1,5): the corridor's side walls at (1,1)... check a wall pair
    expect(cellAt(g, { x: 1, y: 2 })!.terrain).toBe('wall');
    expect(hasLineOfSight(g, { x: 0, y: 2 }, { x: 2, y: 2 })).toBe(false);
  });

  it('spawning inside a wall is rejected', () => {
    expect(() => new Combat({
      seed: 1,
      mapId: 'corridor',
      combatants: [makeCombatant({ id: 'a', team: 'team1', position: { x: 1, y: 2 } })],
    })).toThrow(/wall/);
  });

  it('entering a hazard cell deals fire damage', () => {
    const c = new Combat({
      seed: 5,
      mapId: 'firepit',
      combatants: [
        makeCombatant({ id: 'a', team: 'team1', position: { x: 3, y: 1 } }),
        makeCombatant({ id: 'b', team: 'team2', position: { x: 7, y: 7 } }),
      ],
    });
    let guard = 0;
    while (c.activeId !== 'a' && guard++ < 10) c.apply({ kind: 'endTurn' });
    const hp = c.state.combatants['a']!.hp;
    // Step into the pit: (3,2) is '^' on firepit.
    const events = c.apply({ kind: 'move', to: { x: 3, y: 2 } });
    const dmg = events.find((e) => e.type === 'damageDealt');
    expect(dmg).toBeDefined();
    if (dmg?.type !== 'damageDealt') throw new Error();
    expect(dmg.damageType).toBe('fire');
    expect(c.state.combatants['a']!.hp).toBe(hp - dmg.amount);
  });

  it('pathing avoids hazards when a same-cost safe route exists', () => {
    const c = new Combat({
      seed: 5,
      mapId: 'firepit',
      combatants: [
        makeCombatant({ id: 'a', team: 'team1', position: { x: 3, y: 1 }, hp: 1000, maxHp: 1000 }),
        makeCombatant({ id: 'b', team: 'team2', position: { x: 7, y: 7 } }),
      ],
    });
    let guard = 0;
    while (c.activeId !== 'a' && guard++ < 10) c.apply({ kind: 'endTurn' });
    // Crossing to the far side can skirt the pit at equal cost — no burns.
    const events = c.apply({ kind: 'move', to: { x: 3, y: 6 } });
    expect(events.filter((e) => e.type === 'damageDealt')).toHaveLength(0);
  });

  it('moving into the pit interior burns once per hazard cell entered', () => {
    const c = new Combat({
      seed: 5,
      mapId: 'firepit',
      combatants: [
        makeCombatant({ id: 'a', team: 'team1', position: { x: 3, y: 1 }, hp: 1000, maxHp: 1000 }),
        makeCombatant({ id: 'b', team: 'team2', position: { x: 7, y: 7 } }),
      ],
    });
    let guard = 0;
    while (c.activeId !== 'a' && guard++ < 10) c.apply({ kind: 'endTurn' });
    // (4,4) is deep in the pit: every route in must cross ≥1 hazard cell
    // before ending on the hazard destination itself.
    const events = c.apply({ kind: 'move', to: { x: 4, y: 4 } });
    const burns = events.filter((e) => e.type === 'damageDealt');
    expect(burns.length).toBeGreaterThanOrEqual(2);
  });

  it('AI games complete on every map', () => {
    for (const mapId of MAP_IDS) {
      const c = new Combat({
        seed: 11,
        mapId,
        combatants: [...buildParty('team1', 0), ...buildParty('team2', 7)],
      });
      let steps = 0;
      while (!c.isOver() && steps++ < 5000) {
        c.apply(chooseAction(c.state, c.activeId));
      }
      expect(c.isOver()).toBe(true);
    }
  }, 30000);

  it('difficult terrain shrinks the reachable set (marsh vs open field)', () => {
    const marsh = parseMap(MAPS['marsh']!);
    const open = parseMap(MAPS['open']!);
    const from = { x: 4, y: 3 }; // deep in the bog
    const inMarsh = reachable(marsh, from, 30, new Set()).costs.size;
    const inOpen = reachable(open, from, 30, new Set()).costs.size;
    expect(inMarsh).toBeLessThan(inOpen);
  });
});
