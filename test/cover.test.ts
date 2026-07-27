import { describe, it, expect } from 'vitest';
import { Combat } from '../src/engine/combat.js';
import { buildCharacter } from '../src/builder/character.js';
import { buildMonster, MONSTERS } from '../src/data/monsters.js';
import { SPECIES } from '../src/data/species.js';
import { coverBetween, blocksMovement, hasLineOfSight } from '../src/engine/grid.js';
import { canHide } from '../src/engine/rules/hide.js';
import { generateArenaMap } from '../src/arena/map.js';
import { parseMap } from '../src/data/maps.js';
import { seedRng } from '../src/engine/rng.js';
import type { MapData } from '../src/data/maps.js';

/**
 * Barricades: terrain that stops movement but not sight.
 *
 * Full walls shape a board by deleting squares, which mostly means everyone
 * walks around them — the fight is the same fight, one turn later. A barricade
 * shapes it by making the *angle* of a shot matter: +2 AC across it, and a
 * place to hide behind. That is a decision rather than a detour, and it is the
 * one SRD rule this engine was missing outright.
 */

const board = (rows: string[]): MapData => ({ id: 't', name: 'T', theme: 'stone', rows });

describe('barricades', () => {
  it('stop movement without stopping sight — that pair is the whole point', () => {
    const grid = parseMap(board([
      '........',
      '........',
      '...+....',
      '........',
    ]));
    expect(blocksMovement('cover'), 'you cannot walk through it').toBe(true);
    expect(blocksMovement('wall')).toBe(true);
    expect(blocksMovement('difficult'), 'mud is slow, not solid').toBe(false);

    const from = { x: 3, y: 0 }, to = { x: 3, y: 3 };
    expect(hasLineOfSight(grid, from, to), 'you can see over it').toBe(true);
    expect(coverBetween(grid, from, to), 'and shooting across it is shooting into cover').toBe(true);
  });

  it('only counts what is between — cover is something you flank, not something you own', () => {
    const grid = parseMap(board([
      '........',
      '...+....',
      '........',
    ]));
    // Straight down the file, across the barricade.
    expect(coverBetween(grid, { x: 3, y: 0 }, { x: 3, y: 2 })).toBe(true);
    // From the side, with a clear line: no cover, which is what makes moving
    // worth the turn it costs.
    expect(coverBetween(grid, { x: 0, y: 2 }, { x: 3, y: 2 })).toBe(false);
    // Standing *on* the line's ends never counts for itself.
    expect(coverBetween(grid, { x: 3, y: 1 }, { x: 3, y: 2 })).toBe(false);
  });

  it('gives +2 AC against a shot, and nothing against a sword', () => {
    // Melee reaches over a barricade, so only ranged attacks are affected.
    const rows = ['........', '........', '...+....', '........', '........'];
    const shooter = { ...buildMonster('scout', 'team2', { x: 3, y: 0 }), id: 'sh' };
    const hero = buildCharacter({ classId: 'fighter', team: 'team1', level: 3, name: 'F', position: { x: 3, y: 4 }, speciesId: 'human' });
    const c = new Combat({ seed: 2, map: board(rows), combatants: [hero, shooter] });
    for (let i = 0; i < 20 && c.activeId !== 'sh'; i++) c.apply({ kind: 'endTurn' });

    const bow = c.state.combatants['sh']!.equipped.mainHand!;
    const events = c.apply({ kind: 'attack', weaponId: bow, targetId: hero.id });
    const roll = events.find((e) => e.type === 'attackRolled');
    expect(roll, 'the scout never shot').toBeDefined();
    if (roll?.type !== 'attackRolled') throw new Error();
    expect(roll.cover, 'the shot crossed a barricade').toBe(true);

    // Same fight, no barricade: same AC, minus the two.
    const open = new Combat({ seed: 2, map: board(['........', '........', '........', '........', '........']), combatants: [hero, shooter] });
    for (let i = 0; i < 20 && open.activeId !== 'sh'; i++) open.apply({ kind: 'endTurn' });
    const bare = open.apply({ kind: 'attack', weaponId: bow, targetId: hero.id })
      .find((e) => e.type === 'attackRolled');
    if (bare?.type !== 'attackRolled') throw new Error();
    expect(roll.targetAc - bare.targetAc, 'half cover is +2 AC').toBe(2);
    expect(bare.cover).toBeUndefined();
  });

  /**
   * The rogue's whole loop is Hide -> advantage -> Sneak Attack, and it needs
   * somewhere to do it. Hiding used to demand that NO enemy had line of sight
   * at all, which on an eight-wide board with a few scattered walls is almost
   * never true: measured over thirty arena fights, Hide was offered on 11 of a
   * rogue's 276 turns. With barricades on the board it is offered on 30 of 245
   * and taken 15 times.
   */
  it('are somewhere a rogue can hide, which a bare board is not', () => {
    const rows = ['........', '........', '++++++++', '........', '........'];
    const rogue = buildCharacter({ classId: 'rogue', team: 'team1', level: 3, name: 'R', position: { x: 3, y: 1 }, speciesId: 'human' });
    const foes = [0, 1, 2].map((i) => ({ ...buildMonster('scout', 'team2', { x: 2 + i, y: 4 }), id: `f${i}` }));
    const c = new Combat({ seed: 1, map: board(rows), combatants: [rogue, ...foes] });

    expect(canHide(c.state, c.state.combatants[rogue.id]!), 'behind the barricade line').toBe(true);
    // Step out past it and there is nothing between: no hiding in the open.
    c.state.combatants[rogue.id]!.position = { x: 3, y: 3 };
    expect(canHide(c.state, c.state.combatants[rogue.id]!), 'out in front of it').toBe(false);
  });

  it('are never placed where a creature would have to stand', () => {
    // The validator treats them as solid, or a barricade could seal a pocket
    // and the flood fill would not notice.
    let rng = seedRng(11);
    for (let i = 0; i < 150; i++) {
      const m = generateArenaMap({}, rng); rng = m.state;
      const grid = parseMap(m.value.map);
      for (const x of [0, 1, 2, 3, 4, 5, 6, 7]) {
        for (const y of [0, grid.height - 1]) {
          const cell = grid.cells[y * grid.width + x]!;
          expect(blocksMovement(cell.terrain), `blocked spawn at ${x},${y}`).toBe(false);
        }
      }
    }
  });
});

describe('generated boards have shape', () => {
  /**
   * The generator used to sprinkle single cells: a 1–3 cell wall clump and a
   * per-cell roll for hazard and mud. A lone hazard tile is one step to walk
   * round and so is never a decision, and wall noise is porous enough that no
   * sightline stays broken. Layouts are stamped now — a band with gaps, a
   * flank line, a massif — and hazards come as pools.
   */
  it('puts barricades on most boards, so cover is a normal part of a fight', () => {
    let rng = seedRng(21);
    let withCover = 0;
    const N = 200;
    for (let i = 0; i < N; i++) {
      const m = generateArenaMap({}, rng); rng = m.state;
      if (m.value.map.rows.some((r) => r.includes('+'))) withCover++;
    }
    expect(withCover / N, `only ${withCover}/${N} boards had any cover`).toBeGreaterThan(0.8);
  });

  it('groups hazards instead of scattering them one cell at a time', () => {
    // A hazard cell with no hazard neighbour is a tile you simply walk around.
    let rng = seedRng(31);
    let lonely = 0, total = 0;
    for (let i = 0; i < 200; i++) {
      const m = generateArenaMap({ theme: 'ember' }, rng); rng = m.state;
      const rows = m.value.map.rows;
      for (let y = 0; y < rows.length; y++) {
        for (let x = 0; x < rows[y]!.length; x++) {
          if (rows[y]![x] !== '^') continue;
          total++;
          const touching = ([[1, 0], [-1, 0], [0, 1], [0, -1]] as const)
            .some(([dx, dy]) => rows[y + dy]?.[x + dx] === '^');
          if (!touching) lonely++;
        }
      }
    }
    expect(total, 'the ember theme produced no hazards at all').toBeGreaterThan(50);
    expect(lonely / total, `${lonely}/${total} hazard cells stand alone`).toBeLessThan(0.35);
  });
});

/**
 * A barricade is chest-high to a person. A kobold ducks behind it; an ogre
 * stands there being shot at. The same board therefore plays differently
 * against a goblin warband and against a pair of giants, which is most of the
 * point of having terrain — and it costs nothing but a size on the stat block.
 *
 * 58 of the 137 monsters are Large or bigger, so this is not a corner case; it
 * is nearly half the bestiary. Difficulty is unmoved (mean win rate 43.0%
 * before and after, every tier within a point, paired seeds), because a big
 * creature was only catching cover on a handful of shots a fight. This is
 * differentiation, not balance.
 */
describe('size gates cover', () => {
  const rows = ['........', '........', '...+....', '........', '........'];

  /** One ranged attack across the barricade, at whatever is standing behind it. */
  function shootAcross(monsterId: string): { targetAc: number; cover?: boolean } {
    const shooter = { ...buildMonster('scout', 'team1', { x: 3, y: 0 }), id: 'sh' };
    const target = { ...buildMonster(monsterId, 'team2', { x: 3, y: 4 }), id: 'tg' };
    const c = new Combat({ seed: 3, map: board(rows), combatants: [shooter, target] });
    for (let i = 0; i < 20 && c.activeId !== 'sh'; i++) c.apply({ kind: 'endTurn' });
    const bow = c.state.combatants['sh']!.equipped.mainHand!;
    const roll = c.apply({ kind: 'attack', weaponId: bow, targetId: 'tg' })
      .find((e) => e.type === 'attackRolled');
    if (roll?.type !== 'attackRolled') throw new Error(`${monsterId}: no shot`);
    return { targetAc: roll.targetAc, ...(roll.cover ? { cover: true } : {}) };
  }

  it('covers a Small or Medium creature and not a Large one', () => {
    expect(MONSTERS['kobold']!.size).toBe('small');
    expect(MONSTERS['ogre']!.size).toBe('large');
    expect(shootAcross('kobold').cover, 'a kobold is behind the barricade').toBe(true);
    expect(shootAcross('ogre').cover, 'an ogre is standing over it').toBeUndefined();
  });

  it('is the AC, not just the flag', () => {
    const withCover = shootAcross('kobold').targetAc;
    // Same creature, no barricade in the way.
    const shooter = { ...buildMonster('scout', 'team1', { x: 3, y: 0 }), id: 'sh' };
    const kobold = { ...buildMonster('kobold', 'team2', { x: 3, y: 4 }), id: 'tg' };
    const bare = new Combat({ seed: 3, map: board(['........', '........', '........', '........', '........']), combatants: [shooter, kobold] });
    for (let i = 0; i < 20 && bare.activeId !== 'sh'; i++) bare.apply({ kind: 'endTurn' });
    const bow = bare.state.combatants['sh']!.equipped.mainHand!;
    const roll = bare.apply({ kind: 'attack', weaponId: bow, targetId: 'tg' }).find((e) => e.type === 'attackRolled');
    if (roll?.type !== 'attackRolled') throw new Error();
    expect(withCover - roll.targetAc).toBe(2);
  });

  it('stops a big creature hiding behind one too', () => {
    const hider = (monsterId: string) => {
      const m = { ...buildMonster(monsterId, 'team1', { x: 3, y: 1 }), id: 'h' };
      const foes = [0, 1].map((i) => ({ ...buildMonster('scout', 'team2', { x: 2 + i, y: 4 }), id: `f${i}` }));
      const c = new Combat({ seed: 1, map: board(['........', '........', '++++++++', '........', '........']), combatants: [m, ...foes] });
      return canHide(c.state, c.state.combatants['h']!);
    };
    expect(hider('kobold'), 'small enough to duck').toBe(true);
    expect(hider('ogre'), 'an ogre behind a low wall is an ogre, in plain view').toBe(false);
  });

  it('gives every monster and species a size', () => {
    const missing = Object.values(MONSTERS).filter((m) => !m.size).map((m) => m.id);
    expect(missing, `no size: ${missing.join(', ')}`).toEqual([]);
    // Gnomes and halflings are Small; the rest of the roster is Medium.
    expect(SPECIES['gnome']!.size).toBe('small');
    expect(SPECIES['halfling']!.size).toBe('small');
    expect(SPECIES['human']!.size ?? 'medium').toBe('medium');
  });
});
