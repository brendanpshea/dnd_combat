import { describe, it, expect } from 'vitest';
import { Combat, startCombat } from '../src/engine/combat.js';
import { step, legalActions, isLegalAction, Action } from '../src/engine/actions.js';
import { endTurn, currentCombatant } from '../src/engine/turn.js';
import { makeCombatant } from './helpers.js';
import { cellAt } from '../src/engine/types.js';
import type { Combatant } from '../src/engine/types.js';
import { checkWinner } from '../src/engine/rules/attack.js';
import { buildCharacter } from '../src/builder/character.js';
import { buildMonster } from '../src/data/monsters.js';
import { chooseAction } from '../src/ai/greedy.js';

function duel(seed = 1) {
  return new Combat({
    seed,
    combatants: [
      makeCombatant({ id: 'a', team: 'team1', position: { x: 1, y: 1 } }),
      makeCombatant({ id: 'b', team: 'team2', position: { x: 6, y: 6 } }),
    ],
  });
}

describe('surprise (ambush)', () => {
  it('costs the surprised team its initiative roll, not its first round', () => {
    // 2024: "If a combatant is surprised by combat starting, that combatant has
    // Disadvantage on their Initiative roll." Nobody is incapacitated — the old
    // implementation was the 2014 rule, which took the whole first round away.
    const build = (surprised: boolean) => new Combat({
      seed: 5,
      combatants: [
        makeCombatant({ id: 'a', team: 'team1', position: { x: 1, y: 1 } }),
        makeCombatant({ id: 'b', team: 'team2', position: { x: 6, y: 6 } }),
      ],
      ...(surprised ? { surprisedTeam: 'team2' as const } : {}),
    });
    const c = build(true);
    for (const id of ['a', 'b']) {
      expect(c.state.combatants[id]!.conditions.some((k) => k.id === 'incapacitated'), id).toBe(false);
    }
    // Same seed, so the only thing that can move the number is the extra die.
    expect(c.state.combatants['b']!.initiative)
      .toBeLessThanOrEqual(build(false).state.combatants['b']!.initiative!);
  });

  it('does nothing when no team is surprised', () => {
    const c = duel(5);
    expect(Object.values(c.state.combatants).every((x) => !x.conditions.some((k) => k.id === 'incapacitated'))).toBe(true);
  });
});

describe('combat setup', () => {
  it('rolls initiative for everyone and starts round 1', () => {
    const c = duel();
    expect(c.state.round).toBe(1);
    expect(c.state.initiativeOrder).toHaveLength(2);
    expect(c.log.some((e) => e.type === 'combatStarted')).toBe(true);
    expect(c.log.some((e) => e.type === 'turnStarted')).toBe(true);
  });

  it('is deterministic: same seed, same initiative and rolls', () => {
    const c1 = duel(42);
    const c2 = duel(42);
    expect(c1.state.initiativeOrder).toEqual(c2.state.initiativeOrder);
    expect(c1.state.rng).toBe(c2.state.rng);
  });

  it('rejects overlapping placement', () => {
    expect(() =>
      startCombat({
        seed: 1,
        combatants: [
          makeCombatant({ id: 'a', team: 'team1', position: { x: 1, y: 1 } }),
          makeCombatant({ id: 'b', team: 'team2', position: { x: 1, y: 1 } }),
        ],
      }),
    ).toThrow();
  });
});

describe('step purity', () => {
  it('does not mutate the input state', () => {
    const c = duel();
    const before = JSON.stringify(c.state);
    const move = c.legalActions().find((a) => a.kind === 'move')!;
    step(c.state, move);
    expect(JSON.stringify(c.state)).toBe(before);
  });

  it('rejects illegal actions', () => {
    const c = duel();
    expect(() =>
      step(c.state, { kind: 'attack', weaponId: 'longsword', targetId: 'b' }),
    ).toThrow(/Illegal/); // 'b' is far away, melee attack illegal
  });
});

describe('movement', () => {
  it('offers destinations within speed and tracks occupancy', () => {
    const c = duel();
    const actor = c.state.combatants[c.activeId]!;
    const from = { ...actor.position };
    const moves = c.legalActions().filter((a) => a.kind === 'move');
    expect(moves.length).toBeGreaterThan(0);
    const dest = moves[0]!;
    if (dest.kind !== 'move') throw new Error();
    c.apply(dest);
    expect(cellAt(c.state.grid, from)!.occupantId).toBeUndefined();
    expect(cellAt(c.state.grid, dest.to)!.occupantId).toBe(c.state.combatants[actor.id]!.id);
  });

  it('movement budget depletes and dash doubles it', () => {
    const c = duel();
    const id = c.activeId;
    c.apply({ kind: 'dash' });
    expect(c.state.combatants[id]!.turn.movementMax).toBe(60);
  });
});

describe('attacks', () => {
  function adjacentDuel(seed = 1) {
    return new Combat({
      seed,
      combatants: [
        makeCombatant({ id: 'a', team: 'team1', position: { x: 3, y: 3 } }),
        makeCombatant({ id: 'b', team: 'team2', position: { x: 3, y: 4 } }),
      ],
    });
  }

  it('melee attack is offered when adjacent, consumes the action', () => {
    const c = adjacentDuel();
    const attacker = c.activeId;
    const atk = c.legalActions().find((a) => a.kind === 'attack' && a.weaponId === 'longsword')!;
    const events = c.apply(atk);
    expect(events.some((e) => e.type === 'attackRolled')).toBe(true);
    expect(c.state.combatants[attacker]!.turn.actionUsed).toBe(true);
    expect(c.legalActions().some((a) => a.kind === 'attack')).toBe(false);
  });

  it('a full duel eventually produces a winner (playable end-to-end)', () => {
    for (const seed of [1, 2, 3, 7, 99]) {
      const c = adjacentDuel(seed);
      let guard = 0;
      while (!c.isOver() && guard++ < 500) {
        const atk = c.legalActions().find((a) => a.kind === 'attack' && a.weaponId === 'longsword');
        c.apply(atk ?? { kind: 'endTurn' });
      }
      expect(c.isOver()).toBe(true);
      const dead = Object.values(c.state.combatants).find((x) => !x.alive)!;
      expect(dead.hp).toBe(0);
      expect(c.winner()).not.toBeNull();
    }
  });

  it('replays exactly: same seed + same actions = same log', () => {
    const run = () => {
      const c = adjacentDuel(5);
      while (!c.isOver()) {
        const atk = c.legalActions().find((a) => a.kind === 'attack');
        c.apply(atk ?? { kind: 'endTurn' });
      }
      return JSON.stringify(c.log);
    };
    expect(run()).toBe(run());
  });

  it('ranged attack at long range gets disadvantage; adjacent enemy too', () => {
    const c = new Combat({
      seed: 3,
      combatants: [
        makeCombatant({ id: 'a', team: 'team1', position: { x: 0, y: 0 } }),
        makeCombatant({ id: 'b', team: 'team2', position: { x: 7, y: 0 } }),
      ],
    });
    // 35ft: beyond javelin normal 30, within long 120.
    while (c.activeId !== 'a') c.apply({ kind: 'endTurn' });
    const events = c.apply({ kind: 'attack', weaponId: 'javelin', targetId: 'b' });
    const roll = events.find((e) => e.type === 'attackRolled')!;
    if (roll.type !== 'attackRolled') throw new Error();
    expect(roll.disSources).toContain('long range');
    expect(roll.mode).toBe('disadvantage');
  });
});

describe('dodge', () => {
  it('imposes disadvantage on attackers until the dodger’s next turn', () => {
    const c = new Combat({
      seed: 8,
      combatants: [
        makeCombatant({ id: 'a', team: 'team1', position: { x: 3, y: 3 } }),
        makeCombatant({ id: 'b', team: 'team2', position: { x: 3, y: 4 } }),
      ],
    });
    const first = c.activeId;
    const second = first === 'a' ? 'b' : 'a';
    c.apply({ kind: 'dodge' });
    c.apply({ kind: 'endTurn' });
    expect(c.activeId).toBe(second);
    const events = c.apply({ kind: 'attack', weaponId: 'longsword', targetId: first });
    const roll = events.find((e) => e.type === 'attackRolled')!;
    if (roll.type !== 'attackRolled') throw new Error();
    expect(roll.disSources).toContain('target dodging');
    // Dodging clears at the start of the dodger's next turn.
    c.apply({ kind: 'endTurn' });
    expect(c.state.combatants[first]!.conditions.some((k) => k.id === 'dodging')).toBe(false);
  });
});

describe('opportunity attacks', () => {
  function setupOA(seed: number, disengage: boolean) {
    const c = new Combat({
      seed,
      combatants: [
        makeCombatant({ id: 'a', team: 'team1', position: { x: 3, y: 3 } }),
        makeCombatant({ id: 'b', team: 'team2', position: { x: 3, y: 4 } }),
      ],
    });
    // Whoever acts first walks away from the other.
    const mover = c.activeId;
    if (disengage) c.apply({ kind: 'disengage' });
    const dest = mover === 'a' ? { x: 0, y: 0 } : { x: 6, y: 7 };
    const events = c.apply({ kind: 'move', to: dest });
    return { c, mover, events };
  }

  it('leaving reach provokes an OA that consumes the reaction', () => {
    const { c, mover, events } = setupOA(11, false);
    const oa = events.find((e) => e.type === 'attackRolled');
    expect(oa).toBeDefined();
    if (oa?.type !== 'attackRolled') throw new Error();
    expect(oa.opportunity).toBe(true);
    expect(oa.targetId).toBe(mover);
    const other = mover === 'a' ? 'b' : 'a';
    expect(c.state.combatants[other]!.turn.reactionUsed).toBe(true);
  });

  it('disengage prevents the OA', () => {
    const { events } = setupOA(11, true);
    expect(events.some((e) => e.type === 'attackRolled')).toBe(false);
  });

  // Paralyzed/unconscious imply Incapacitated in the rules, but this engine
  // applies them standalone — so the reaction gate has to name all three, and
  // once didn't: held creatures were still swinging as you walked away.
  for (const cond of ['paralyzed', 'unconscious', 'incapacitated'] as const) {
    it(`a ${cond} creature takes no opportunity attack`, () => {
      const c = new Combat({
        seed: 11,
        combatants: [
          makeCombatant({ id: 'a', team: 'team1', position: { x: 3, y: 3 } }),
          makeCombatant({ id: 'b', team: 'team2', position: { x: 3, y: 4 } }),
        ],
      });
      const mover = c.activeId;
      const threat = c.state.combatants[mover === 'a' ? 'b' : 'a']!;
      threat.conditions.push({ id: cond, sourceId: threat.id });
      const dest = mover === 'a' ? { x: 0, y: 0 } : { x: 6, y: 7 };
      const events = c.apply({ kind: 'move', to: dest });
      expect(events.some((e) => e.type === 'attackRolled')).toBe(false);
      expect(threat.turn.reactionUsed).toBe(false);
    });
  }

  it('moving within reach (adjacent to adjacent) does not provoke', () => {
    const c = new Combat({
      seed: 13,
      combatants: [
        makeCombatant({ id: 'a', team: 'team1', position: { x: 3, y: 3 } }),
        makeCombatant({ id: 'b', team: 'team2', position: { x: 3, y: 4 } }),
      ],
    });
    const mover = c.activeId;
    const around = mover === 'a' ? { x: 4, y: 4 } : { x: 2, y: 3 };
    const events = c.apply({ kind: 'move', to: around });
    expect(events.some((e) => e.type === 'attackRolled')).toBe(false);
  });
});

describe('death and turn order', () => {
  it('dead combatants are skipped and removed from the grid', () => {
    const c = new Combat({
      seed: 1,
      combatants: [
        makeCombatant({ id: 'a', team: 'team1', position: { x: 3, y: 3 } }),
        makeCombatant({ id: 'b', team: 'team2', position: { x: 3, y: 4 }, hp: 1 }),
        makeCombatant({ id: 'c', team: 'team2', position: { x: 6, y: 6 } }),
      ],
    });
    // Let 'a' kill 'b' (1 hp) — loop until it lands.
    let guard = 0;
    while (c.state.combatants['b']!.alive && guard++ < 200) {
      if (c.activeId === 'a') {
        c.apply({ kind: 'attack', weaponId: 'longsword', targetId: 'b' });
        if (!c.state.combatants['b']!.alive) break;
        c.apply({ kind: 'endTurn' });
      } else {
        c.apply({ kind: 'endTurn' });
      }
    }
    expect(c.state.combatants['b']!.alive).toBe(false);
    expect(cellAt(c.state.grid, { x: 3, y: 4 })!.occupantId).toBeUndefined();
    expect(c.isOver()).toBe(false); // 'c' still lives
    // 'b' never gets a turn again.
    for (let i = 0; i < 10; i++) {
      expect(c.activeId).not.toBe('b');
      c.apply({ kind: 'endTurn' });
    }
  });

  it('killing the last enemy ends combat and blocks further actions', () => {
    const c = new Combat({
      seed: 2,
      combatants: [
        makeCombatant({ id: 'a', team: 'team1', position: { x: 3, y: 3 } }),
        makeCombatant({ id: 'b', team: 'team2', position: { x: 3, y: 4 }, hp: 1 }),
      ],
    });
    let guard = 0;
    while (!c.isOver() && guard++ < 200) {
      const atk = c.legalActions().find((a) => a.kind === 'attack' && a.weaponId === 'longsword');
      c.apply(atk ?? { kind: 'endTurn' });
    }
    expect(c.isOver()).toBe(true);
    expect(c.log.some((e) => e.type === 'combatEnded')).toBe(true);
    expect(c.legalActions()).toHaveLength(0);
  });

  it('a pathological stall terminates at the round cap, favouring the side ahead on HP', () => {
    // Two combatants that never damage each other (they only ever pass) — the
    // fight can't resolve on its own, so the MAX_ROUNDS guard must end it. The
    // team1 unit is healthier, so it takes the timeout.
    const c = new Combat({
      seed: 3,
      combatants: [
        makeCombatant({ id: 'a', team: 'team1', position: { x: 0, y: 0 }, hp: 20, maxHp: 20 }),
        makeCombatant({ id: 'b', team: 'team2', position: { x: 7, y: 7 }, hp: 5, maxHp: 20 }),
      ],
    });
    let guard = 0;
    while (!c.isOver() && guard++ < 100000) c.apply({ kind: 'endTurn' }); // never attack
    expect(c.isOver()).toBe(true);
    expect(c.winner()).toBe('team1');
    expect(c.state.round).toBeGreaterThan(100);
  });
});

/**
 * A creature can die inside its *own* startTurn: Spirit Guardians burns it
 * down before it ever acts. It was then left as the active combatant, dead,
 * and every action for it was illegal -- including endTurn, which requires a
 * live actor -- so the fight could not be advanced at all. Nothing threw until
 * something tried to act, which in the web app is the AI on its next tick.
 *
 * Found by a slow monster (a basilisk, speed 20) ending its approach inside
 * the aura during an arena wave.
 *
 * Driven through endTurn directly rather than through the AI: the bug is in
 * how the turn advances, and a fight built to provoke it via chooseAction
 * depends on the AI choosing to stand in the aura, which it mostly avoids.
 */
describe('a creature that dies during its own turn start', () => {
  function auraState() {
    const cleric = buildCharacter({ classId: 'cleric', team: 'team1', position: { x: 3, y: 3 }, level: 5 });
    const victim = buildMonster('kobold', 'team2', { x: 3, y: 4 });   // adjacent to the aura
    const bystander = buildMonster('ogre', 'team2', { x: 7, y: 7 });  // well outside it
    const c = new Combat({ seed: 3, width: 8, height: 8, combatants: [cleric, victim, bystander] });
    const state = c.state;
    state.combatants[cleric.id]!.spiritualGuardians = { dc: 30, mod: 5, dice: '3d8' };  // never saves
    state.combatants[victim.id]!.hp = 1;                                   // 3d8 radiant kills it
    // Fix the order so the victim is exactly who endTurn advances to.
    state.initiativeOrder = [cleric.id, victim.id, bystander.id];
    state.turnIndex = 0;
    return { state, victimId: victim.id, bystanderId: bystander.id };
  }

  it('does not leave the dead creature holding the turn', () => {
    const { state, victimId, bystanderId } = auraState();
    endTurn(state, () => []);
    expect(state.combatants[victimId]!.alive, 'the aura should have killed it').toBe(false);
    const active = currentCombatant(state);
    expect(active.alive, `${active.id} holds the turn while dead`).toBe(true);
    expect(active.id).toBe(bystanderId);
  });

  it('leaves the fight advanceable', () => {
    const { state } = auraState();
    endTurn(state, () => []);
    const active = currentCombatant(state);
    expect(isLegalAction(state, active.id, { kind: 'endTurn' })).toBe(true);
  });
});

/**
 * A fight in which NOBODY is left standing.
 *
 * checkWinner only ever compared standing creatures, so when the last hero
 * dropped in the same exchange that killed the last monster it returned null —
 * and null means "fight on". Nobody could take a turn (the turn scan skips
 * anyone who is down), so the round counter froze, and because the MAX_ROUNDS
 * backstop only fires when a round *advances*, it could never fire either. The
 * fight hung forever. The fuzzer found it twice in 3,000 fights, and neither
 * ended after twenty thousand decisions.
 */
describe('when neither side is left standing', () => {
  const build = (t1: Array<Partial<Combatant>>, t2: Array<Partial<Combatant>>) => {
    const c = new Combat({
      seed: 1, width: 8, height: 8,
      combatants: [
        ...t1.map((o, i) => ({ ...buildCharacter({ classId: 'fighter', team: 'team1' as const, position: { x: i, y: 0 } }), id: `h${i}`, ...o })),
        ...t2.map((o, i) => ({ ...buildMonster('orc', 'team2', { x: i, y: 5 }), id: `m${i}`, ...o })),
      ],
    });
    return c;
  };

  it('a party unconscious among corpses has won', () => {
    // Heroes drop rather than die here, and every enemy is gone: there is
    // nothing left to stop them coming round.
    const c = build([{ hp: 0, alive: true, conditions: [{ id: 'unconscious' }, { id: 'prone' }] }], [{ hp: 0, alive: false }]);
    expect(checkWinner(c.state)).toBe('team1');
  });

  it('a board with nothing living on it still resolves', () => {
    // No draw exists in the return type, and a hung fight is far worse than an
    // arbitrary answer. Ties go the way the round-limit backstop sends them.
    const c = build([{ hp: 0, alive: false }], [{ hp: 0, alive: false }]);
    expect(checkWinner(c.state)).not.toBeNull();
  });

  it('still says nobody has won while both sides have someone up', () => {
    const c = build([{ hp: 10 }], [{ hp: 10 }]);
    expect(checkWinner(c.state)).toBeNull();
  });

  it('a standing enemy still beats a downed party', () => {
    const c = build([{ hp: 0, alive: true, conditions: [{ id: 'unconscious' }] }], [{ hp: 10 }]);
    expect(checkWinner(c.state)).toBe('team2');
  });
});
