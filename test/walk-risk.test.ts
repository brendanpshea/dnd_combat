/**
 * What the board tells a player a move will cost.
 *
 * `worstCaseWalkDamage` has existed since pathing was written and, until now,
 * only the AI ever read it: it walks the route the mover would actually take,
 * adds every opportunity attack that route provokes at maximum, and every
 * hazard cell it crosses. The player, who is asked the same question every
 * turn, was told nothing — the board showed XCOM's cover shield and not XCOM's
 * exposure warning.
 *
 * Now that a number is painted on the tile, it has to be true for THIS hero.
 * That is the part these tests hold, because a badge that overstates the risk
 * is worse than no badge: it stops a player making a move that was safe.
 */
import { describe, it, expect } from 'vitest';
import { buildCharacter } from '../src/builder/character.js';
import { buildMonster } from '../src/data/monsters.js';
import { Combat } from '../src/engine/combat.js';
import { worstCaseWalkDamage, hazardMaxFor, HAZARD_DAMAGE, HAZARD_DAMAGE_TYPE } from '../src/engine/rules/movement.js';
import { parseDice } from '../src/engine/dice.js';
import type { Combatant, Position } from '../src/engine/types.js';

const RAW = (() => { const d = parseDice(HAZARD_DAMAGE); return d.count * d.sides + d.bonus; })();

/**
 * A hero at the mouth of a one-cell corridor, with hazard tiles in it.
 *
 * The corridor is the point. `reachable` is weighted by `stepDanger`, so on
 * open ground the pathfinder simply walks AROUND a lava tile — which is correct,
 * and meant the first version of these tests measured a route that crossed
 * nothing and asserted it cost something. Walling the lane leaves one way
 * through, which is the situation the badge exists for.
 */
function board(opts: { speciesId?: string; hazards: Position[]; corridor?: boolean; theme?: string }) {
  const me: Combatant = buildCharacter({
    classId: 'fighter', team: 'team1', position: { x: 0, y: 0 }, level: 3,
    ...(opts.speciesId ? { speciesId: opts.speciesId } : {}),
  });
  const foe = { ...buildMonster('orc', 'team2', { x: 7, y: 7 }), id: 'far' };
  const c = new Combat({ combatants: [me, foe], seed: 3, mapId: 'open' });
  // The theme decides what a hazard IS — lava, or a bramble thicket — so a test
  // about fire resistance has to say which ground it is standing on. The
  // `open` map is themed forest, where the hazard is 1d4 piercing and a
  // dragonborn's scales are worth nothing at all.
  c.state.grid.theme = opts.theme ?? 'ember';
  const at = (p: Position) => c.state.grid.cells[p.y * c.state.grid.width + p.x]!;
  if (opts.corridor) {
    for (let x = 0; x < c.state.grid.width; x++) at({ x, y: 1 }).terrain = 'wall';
  }
  for (const p of opts.hazards) at(p).terrain = 'hazard';
  let guard = 0;
  while (c.activeId !== me.id && guard++ < 20) c.apply({ kind: 'endTurn' });
  return { c, me: c.state.combatants[me.id]! };
}

describe('the hazard number is the one this hero would take', () => {
  it('is the raw maximum for somebody with no defence against fire', () => {
    const { c, me } = board({ hazards: [] });
    expect(me.resistances).not.toContain(HAZARD_DAMAGE_TYPE);
    expect(hazardMaxFor(me, c.state.grid)).toBe(RAW);
  });

  it('is a different number on different ground', () => {
    // The whole point of making a hazard a property of the map: lava takes
    // half a hero and a bramble thicket is a scratch, and the badge on the tile
    // has to say which one you are about to walk into.
    const lava = board({ hazards: [], theme: 'ember' });
    const thorns = board({ hazards: [], theme: 'forest' });
    expect(hazardMaxFor(lava.me, lava.c.state.grid))
      .toBeGreaterThan(hazardMaxFor(thorns.me, thorns.c.state.grid) * 2);
  });

  it('is halved for a dragonborn, which resists fire', () => {
    // THE bug this guards. `worstCaseWalkDamage` added the raw maximum, which
    // was harmless while only the AI read it and is a lie the moment it is
    // painted on a tile: the one hero who can walk through fire would be shown
    // the number they never take.
    const { c, me } = board({ speciesId: 'dragonborn', hazards: [] });
    expect(me.resistances, 'this test needs a fire-resistant species').toContain(HAZARD_DAMAGE_TYPE);
    expect(hazardMaxFor(me, c.state.grid)).toBe(Math.floor(RAW / 2));
  });

  it('reaches the walk itself, not just the helper', () => {
    // One hazard cell directly between the hero and the destination, so the
    // route has to cross it and the difference must show up in the number the
    // board would paint.
    const plain = board({ hazards: [{ x: 1, y: 0 }], corridor: true });
    const scaly = board({ speciesId: 'dragonborn', hazards: [{ x: 1, y: 0 }], corridor: true });
    const to = { x: 2, y: 0 };
    const a = worstCaseWalkDamage(plain.c.state, plain.me, to);
    const b = worstCaseWalkDamage(scaly.c.state, scaly.me, to);
    expect(a, 'crossing one hazard should cost something').toBeGreaterThan(0);
    expect(b, 'a dragonborn takes half of it').toBeLessThan(a);
  });
});

describe('and it counts the whole route, not the destination', () => {
  it('adds up every hazard the path crosses', () => {
    // The reason the badge is worth painting at all. Standing beside one lava
    // tile, it is obvious that stepping on it hurts; that the only route to a
    // cell three squares away crosses THREE of them is not obvious at all, and
    // is exactly what a player wants to know before spending the move.
    const { c, me } = board({ hazards: [{ x: 1, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 0 }], corridor: true });
    const one = worstCaseWalkDamage(c.state, me, { x: 1, y: 0 });
    const three = worstCaseWalkDamage(c.state, me, { x: 3, y: 0 });
    expect(three).toBeGreaterThan(one);
    expect(three).toBe(one * 3);
  });

  it('says nothing about a walk that costs nothing', () => {
    // An absent entry is what keeps the board quiet: the badge is only drawn
    // where the number is above zero, so open ground stays bare.
    const { c, me } = board({ hazards: [] });
    expect(worstCaseWalkDamage(c.state, me, { x: 1, y: 0 })).toBe(0);
  });
});

describe('the board only offers the number where the move is offered', () => {
  it('is zero for a cell that cannot be reached', () => {
    // The rule the cover badge already follows: a warning about a move you
    // cannot make is information about a decision you are not making.
    const { c, me } = board({ hazards: [] });
    expect(worstCaseWalkDamage(c.state, me, { x: 7, y: 7 })).toBe(0);
  });
});
