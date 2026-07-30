/**
 * Reach, flight, and being able to see which is which.
 *
 * All three exist because a Huge creature was, mechanically and visually, an
 * ogre with a bigger picture. It hit at five feet, it waded through lava, and
 * the picture was not reliably bigger either — see the size-band test below.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { MONSTERS, buildMonster } from '../src/data/monsters.js';
import { buildCharacter } from '../src/builder/character.js';
import { Combat } from '../src/engine/combat.js';
import { legalActions } from '../src/engine/actions.js';
import { reachCells, reachFeet, withinReach, provokesFrom } from '../src/engine/rules/reach.js';
import { enterHazard, moveDestinations, executeMove } from '../src/engine/rules/movement.js';
import { canShove } from '../src/engine/rules/shove.js';
import { cellAt } from '../src/engine/types.js';
import { WEAPONS } from '../src/data/weapons.js';
import type { Position, CreatureSize } from '../src/engine/types.js';
import { sizeBand, bandedScale } from '../src/data/token-size.js';

const at = (x: number, y: number): Position => ({ x, y });

describe('reach', () => {
  it('is ten feet for Huge and Gargantuan, five for everyone else', () => {
    const huge = buildMonster('hill-giant', 'team2', at(0, 0), '1');
    const large = buildMonster('ogre', 'team2', at(0, 0), '2');
    expect(huge.size).toBe('huge');
    expect(reachFeet(huge)).toBe(10);
    // Large is deliberately NOT included: an ogre reaches five feet in the SRD.
    expect(large.size).toBe('large');
    expect(reachFeet(large)).toBe(5);
  });

  it('every Huge creature in the bestiary gets it, without twelve edits', () => {
    const huge = Object.values(MONSTERS).filter((m) => m.size === 'huge');
    expect(huge.length).toBeGreaterThan(5);
    for (const m of huge) {
      expect(reachCells(buildMonster(m.id, 'team2', at(0, 0), '1')), m.id).toBe(2);
    }
  });

  it('still honours Long-Limbed on a Medium creature', () => {
    const bugbear = buildMonster('bugbear', 'team2', at(0, 0), '1');
    expect(bugbear.size).toBe('medium');
    expect(reachCells(bugbear)).toBe(2);
  });

  it('lets a giant attack from two cells away, and an ogre not', () => {
    const hero = buildCharacter({ classId: 'fighter', team: 'team1', position: at(3, 3), level: 8 });
    for (const [id, expected] of [['hill-giant', true], ['ogre', false]] as const) {
      const foe = { ...buildMonster(id, 'team2', at(5, 3), '1'), id: 'foe' };
      const c = new Combat({ combatants: [hero, foe], seed: 4, mapId: 'open' });
      let g = 0;
      while (c.activeId !== 'foe' && g++ < 20) c.apply({ kind: 'endTurn' });
      /**
       * Weapons that can ONLY be swung. An ogre's javelin is flagged `melee`
       * AND carries a 30-foot throw, so it is legally usable at two cells for a
       * reason that has nothing to do with reach — filtering on `melee` alone
       * made this test pass for the wrong reason, which is how it was caught.
       */
      const swings = legalActions(c.state, 'foe').filter((a) => {
        if (a.kind !== 'attack' || a.targetId !== hero.id) return false;
        const w = WEAPONS[a.weaponId];
        return !!w?.melee && w.range === undefined;
      });
      expect(swings.length > 0, `${id} melee at two cells`).toBe(expected);
    }
  });

  it('and lets it shove from there too', () => {
    const hero = buildCharacter({ classId: 'fighter', team: 'team1', position: at(3, 3), level: 8 });
    const giant = { ...buildMonster('hill-giant', 'team2', at(5, 3), '1'), id: 'foe' };
    const ogre = { ...buildMonster('ogre', 'team2', at(5, 3), '1'), id: 'foe2' };
    expect(canShove(giant, hero)).toBe(true);
    expect(canShove(ogre, hero)).toBe(false);
  });

  it('THREATENS at reach, which is the half that was missing', () => {
    /**
     * The latent bug this uncovered: `canAttackWith` had honoured Long-Limbed
     * since the bugbear was added, but opportunity attacks compared plain
     * `adjacent` on both sides — so a bugbear could strike from ten feet and
     * threaten only at five, and walking out of its reach was free. Reach that
     * does not hold ground is half a rule.
     */
    const giant = buildMonster('hill-giant', 'team2', at(5, 3), '1');
    const hero = buildCharacter({ classId: 'rogue', team: 'team1', position: at(3, 3), level: 8 });
    const c = new Combat({ combatants: [hero, giant], seed: 4, mapId: 'open' });
    const mover = c.state.combatants[hero.id]!;
    // Standing two cells away is inside its reach; stepping to four is leaving.
    expect(provokesFrom(c.state, mover, at(3, 3), at(1, 3))).toContain(giant.id);
    // Sidestepping WITHIN reach is still free.
    expect(provokesFrom(c.state, mover, at(3, 3), at(3, 4))).toEqual([]);
  });

  it('actually swings when the hero walks out of a giant\'s reach', () => {
    /**
     * The behavioural half. `provokesFrom` being right is worth nothing if
     * `executeMove` still compares plain adjacency — and it did, which planting
     * the old code back proved: every assertion above stayed green because they
     * all called the helper directly rather than moving anybody.
     */
    const swings = (foeId: string) => {
      const hero = buildCharacter({ classId: 'rogue', team: 'team1', position: at(3, 3), level: 8 });
      const foe = { ...buildMonster(foeId, 'team2', at(5, 3), '1'), id: 'foe' };
      const c = new Combat({ combatants: [hero, foe], seed: 4, mapId: 'open' });
      let g = 0;
      while (c.activeId !== hero.id && g++ < 20) c.apply({ kind: 'endTurn' });
      const me = c.state.combatants[hero.id]!;
      me.turn.movementMax = 30;
      me.turn.movementUsed = 0;
      // From two cells away (inside a giant's reach) to four (outside anyone's).
      const events = executeMove(c.state, hero.id, at(1, 3));
      return events.filter((e) => e.type === 'attackRolled' && e.opportunity).length;
    };
    expect(swings('hill-giant'), 'a giant let the rogue stroll out of its reach').toBeGreaterThan(0);
    // The control: an ogre never had the rogue in reach, so nothing to provoke.
    expect(swings('ogre'), 'an ogre swung at something two cells away').toBe(0);
  });

  it('does not change who counts as crowding a target', () => {
    // Pack Tactics and Sneak Attack's enabler are "within 5 feet" in the SRD and
    // must stay on plain adjacency — otherwise every rogue in the game silently
    // gained a new way to flank.
    const giant = buildMonster('hill-giant', 'team2', at(0, 0), '1');
    const far = buildMonster('goblin-warrior', 'team2', at(2, 0), '2');
    expect(withinReach(giant, far)).toBe(true);       // it can hit
    expect(reachCells(far)).toBe(1);                   // but the goblin is not "beside" it
  });
});

describe('flight', () => {
  const flier = (pos: Position) => ({ ...buildMonster('wyvern', 'team2', pos, '1'), id: 'flier' });
  const walker = (pos: Position) => ({ ...buildMonster('ogre', 'team2', pos, '1'), id: 'walker' });

  it('is set from the monster data and reaches the combatant', () => {
    expect(flier(at(0, 0)).flying).toBe(true);
    expect(walker(at(0, 0)).flying ?? false).toBe(false);
  });

  it('a flier takes no hazard damage; a walker does', () => {
    const hero = buildCharacter({ classId: 'fighter', team: 'team1', position: at(0, 0), level: 8 });
    for (const [who, shouldBurn] of [[flier(at(4, 4)), false], [walker(at(4, 4)), true]] as const) {
      const c = new Combat({ combatants: [hero, who], seed: 4, mapId: 'open' });
      const before = c.state.combatants[who.id]!.hp;
      const events = enterHazard(c.state, who.id);
      const burned = c.state.combatants[who.id]!.hp < before;
      expect(burned, `${who.id} hazard`).toBe(shouldBurn);
      expect(events.length > 0, `${who.id} events`).toBe(shouldBurn);
    }
  });

  it('a flier crosses a barricade; a walker goes around', () => {
    const hero = buildCharacter({ classId: 'fighter', team: 'team1', position: at(0, 0), level: 8 });
    const reach = (who: ReturnType<typeof flier>) => {
      const c = new Combat({ combatants: [hero, who], seed: 4, mapId: 'open' });
      // A wall of barricades across the board, with the mover on one side.
      for (let x = 0; x < c.state.grid.width; x++) cellAt(c.state.grid, at(x, 3))!.terrain = 'cover';
      c.state.combatants[who.id]!.position = at(4, 2);
      cellAt(c.state.grid, at(4, 2))!.occupantId = who.id;
      c.state.combatants[who.id]!.turn.movementMax = 30;
      c.state.combatants[who.id]!.turn.movementUsed = 0;
      return moveDestinations(c.state, c.state.combatants[who.id]!);
    };
    const onBarricade = (ps: Position[]) => ps.some((p) => p.y === 3);
    const past = (ps: Position[]) => ps.some((p) => p.y > 3);
    expect(onBarricade(reach(flier(at(4, 2)))), 'flier cannot cross a barricade').toBe(true);
    expect(past(reach(flier(at(4, 2)))), 'flier cannot get past').toBe(true);
    expect(onBarricade(reach(walker(at(4, 2)))), 'walker walked onto a barricade').toBe(false);
    expect(past(reach(walker(at(4, 2)))), 'walker walked through a barricade').toBe(false);
  });

  it('a flier does NOT cross a wall', () => {
    // Deliberate: walls are what cover and line of sight are computed from, so
    // flying through one would mean being seen and shot through it.
    const hero = buildCharacter({ classId: 'fighter', team: 'team1', position: at(0, 0), level: 8 });
    const who = flier(at(4, 2));
    const c = new Combat({ combatants: [hero, who], seed: 4, mapId: 'open' });
    for (let x = 0; x < c.state.grid.width; x++) cellAt(c.state.grid, at(x, 3))!.terrain = 'wall';
    c.state.combatants[who.id]!.turn.movementMax = 30;
    c.state.combatants[who.id]!.turn.movementUsed = 0;
    const dests = moveDestinations(c.state, c.state.combatants[who.id]!);
    expect(dests.some((p) => p.y >= 3)).toBe(false);
  });

  it('ignores difficult ground', () => {
    const hero = buildCharacter({ classId: 'fighter', team: 'team1', position: at(0, 0), level: 8 });
    const count = (who: ReturnType<typeof flier>) => {
      const c = new Combat({ combatants: [hero, who], seed: 4, mapId: 'open' });
      for (const cell of c.state.grid.cells) if (cell.terrain === 'open') cell.terrain = 'difficult';
      c.state.combatants[who.id]!.turn.movementMax = 30;
      c.state.combatants[who.id]!.turn.movementUsed = 0;
      return moveDestinations(c.state, c.state.combatants[who.id]!).length;
    };
    expect(count(flier(at(4, 4)))).toBeGreaterThan(count(walker(at(4, 4))));
  });
});

describe('you can tell how big a thing is by looking at it', () => {
  it('the size bands never overlap', () => {
    /**
     * The bug: token scale was a hand-kept table of a hundred monster ids, and it
     * had drifted until Large ranged 0.85-1.50 and Huge 1.30-1.50 — so several
     * Large creatures drew BIGGER than several Huge ones. The table's own comment
     * said scale was "the only thing telling a player a fire giant isn't an
     * ogre", and it had quietly stopped doing that.
     */
    const order: CreatureSize[] = ['tiny', 'small', 'medium', 'large', 'huge', 'gargantuan'];
    for (let i = 1; i < order.length; i++) {
      const [, prevHi] = sizeBand(order[i - 1]!);
      const [lo] = sizeBand(order[i]!);
      expect(lo, `${order[i]} starts below ${order[i - 1]} ends`).toBeGreaterThan(prevHi);
    }
  });

  it('every Huge creature draws bigger than every Large one', () => {
    // The renderer's hand table, read as source so this test and the board can
    // never be looking at different numbers.
    const src = readFileSync(fileURLToPath(new URL('../web/src/art.ts', import.meta.url)), 'utf8');
    const tbl = src.slice(src.indexOf('const SCALE'), src.indexOf('export function tokenScale'));
    const RAW: Record<string, number> = {};
    for (const m of tbl.matchAll(/'?([a-z0-9-]+)'?:\s*([\d.]+)/g)) RAW[m[1]!] = Number(m[2]);
    expect(Object.keys(RAW).length, 'could not read the scale table').toBeGreaterThan(50);
    // Reads the same hand table the renderer does, through the same rule.
    const scaleOf = (m: { id: string; size?: CreatureSize }) => bandedScale(RAW[m.id] ?? 1, m.size);
    const huge = Object.values(MONSTERS).filter((m) => m.size === 'huge');
    const large = Object.values(MONSTERS).filter((m) => m.size === 'large');
    expect(huge.length).toBeGreaterThan(0);
    expect(large.length).toBeGreaterThan(0);
    const smallestHuge = Math.min(...huge.map(scaleOf));
    const biggestLarge = Math.max(...large.map(scaleOf));
    expect(smallestHuge).toBeGreaterThan(biggestLarge);
  });

  it('leaves art with no size given exactly as it was', () => {
    // Heroes, summons and props do not pass a size, and must not move.
    expect(bandedScale(1.3, undefined)).toBe(1.3);
    expect(bandedScale(1, undefined)).toBe(1);
  });
});
