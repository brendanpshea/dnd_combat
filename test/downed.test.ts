import { describe, it, expect } from 'vitest';
import { Combat } from '../src/engine/combat.js';
import { buildCharacter, buildParty } from '../src/builder/character.js';
import { buildMonster } from '../src/data/monsters.js';
import { applyDamage } from '../src/engine/rules/attack.js';
import { applyHealing } from '../src/engine/rules/heal.js';
import { legalActions } from '../src/engine/actions.js';
import { isDown } from '../src/engine/types.js';
import { chooseAction } from '../src/ai/greedy.js';
import { FEATURES } from '../src/data/features.js';
import type { Combatant, Position } from '../src/engine/types.js';

const pc = (classId: string, team: 'team1' | 'team2', position: Position, id: string): Combatant =>
  ({ ...buildCharacter({ classId, team, position, level: 3 }), id });

const fight = (...units: Combatant[]) => new Combat({ seed: 4, mapId: 'open', combatants: units });

describe('heroes drop, monsters die', () => {
  it('a hero at 0 HP is unconscious, not dead, and still on the board', () => {
    const c = fight(pc('fighter', 'team1', { x: 0, y: 0 }, 'ftr'), pc('wizard', 'team2', { x: 7, y: 7 }, 'foe'));
    applyDamage(c.state, 'ftr', 'foe', 999, 'slashing');
    const ftr = c.state.combatants['ftr']!;
    expect(ftr.alive).toBe(true);
    expect(ftr.hp).toBe(0);
    expect(isDown(ftr)).toBe(true);
    expect(ftr.conditions.map((k) => k.id).sort()).toEqual(['prone', 'unconscious']);
    expect(c.state.grid.cells[0]!.occupantId).toBe('ftr');   // still holds its square
  });

  it('a monster at 0 HP dies and leaves, as before', () => {
    const goblin = { ...buildMonster('goblin-warrior', 'team2', { x: 7, y: 7 }), id: 'gob' };
    const c = fight(pc('fighter', 'team1', { x: 0, y: 0 }, 'ftr'), goblin);
    applyDamage(c.state, 'gob', 'ftr', 999, 'slashing');
    expect(c.state.combatants['gob']!.alive).toBe(false);
    expect(isDown(c.state.combatants['gob']!)).toBe(false);
  });

  it('cannot be finished off: more damage finds it already at 0', () => {
    const c = fight(pc('fighter', 'team1', { x: 0, y: 0 }, 'ftr'), pc('wizard', 'team2', { x: 7, y: 7 }, 'foe'));
    applyDamage(c.state, 'ftr', 'foe', 999, 'slashing');
    applyDamage(c.state, 'ftr', 'foe', 999, 'slashing');
    expect(c.state.combatants['ftr']!.alive).toBe(true);
    expect(c.state.combatants['ftr']!.hp).toBe(0);
  });
});

describe('a downed hero is out of the fight', () => {
  const downed = () => {
    const c = fight(
      pc('fighter', 'team1', { x: 3, y: 3 }, 'ftr'),
      pc('cleric', 'team1', { x: 4, y: 3 }, 'cle'),
      pc('rogue', 'team2', { x: 3, y: 4 }, 'foe'),
    );
    applyDamage(c.state, 'ftr', 'foe', 999, 'slashing');
    return c;
  };
  const turnOf = (c: Combat, id: string) => {
    let guard = 0;
    while (c.activeId !== id && !c.isOver() && guard++ < 20) c.apply({ kind: 'endTurn' });
  };

  it('cannot be attacked, so an AI scoring kills cannot beat the body forever', () => {
    const c = downed();
    turnOf(c, 'foe');
    const targets = legalActions(c.state, 'foe')
      .filter((a) => a.kind === 'attack')
      .map((a) => (a as { targetId: string }).targetId);
    expect(targets).not.toContain('ftr');
  });

  it('cannot be shaken awake: only healing gets you up', () => {
    const c = downed();
    turnOf(c, 'cle');
    expect(legalActions(c.state, 'cle').some((a) => a.kind === 'shakeAwake')).toBe(false);
  });

  it('takes no turn, having nothing it could do with one', () => {
    const c = downed();
    const seen = new Set<string>();
    for (let i = 0; i < 12; i++) {
      seen.add(c.activeId);
      c.apply({ kind: 'endTurn' });
    }
    expect([...seen]).not.toContain('ftr');
  });

  it('does not wall off the map: you step over a body, but cannot stop on it', () => {
    const c = downed();
    turnOf(c, 'foe');
    const dests = legalActions(c.state, 'foe')
      .filter((a) => a.kind === 'move')
      .map((a) => (a as { to: Position }).to);
    expect(dests.some((p) => p.y < 3)).toBe(true);                       // through
    expect(dests.some((p) => p.x === 3 && p.y === 3)).toBe(false);       // not onto
  });
});

describe('healing brings them back', () => {
  it('stands a downed hero up, whatever the source', () => {
    const c = fight(pc('fighter', 'team1', { x: 3, y: 3 }, 'ftr'), pc('cleric', 'team1', { x: 4, y: 3 }, 'cle'));
    applyDamage(c.state, 'ftr', 'cle', 999, 'slashing');
    applyHealing(c.state, 'ftr', 'cle', 6);
    const ftr = c.state.combatants['ftr']!;
    expect(ftr.hp).toBe(6);
    expect(isDown(ftr)).toBe(false);
    expect(ftr.conditions.map((k) => k.id)).not.toContain('unconscious');
  });

  it('does not wake a sleeping ally: only damage or a shake does that', () => {
    const c = fight(pc('fighter', 'team1', { x: 3, y: 3 }, 'ftr'), pc('cleric', 'team1', { x: 4, y: 3 }, 'cle'));
    const ftr = c.state.combatants['ftr']!;
    ftr.hp = 5;
    ftr.conditions.push({ id: 'unconscious', sourceId: 'cle' });
    applyHealing(c.state, 'ftr', 'cle', 4);
    expect(ftr.hp).toBe(9);
    expect(ftr.conditions.some((k) => k.id === 'unconscious')).toBe(true);
  });

  it('never resurrects the dead', () => {
    const goblin = { ...buildMonster('goblin-warrior', 'team2', { x: 4, y: 4 }), id: 'gob' };
    const c = fight(pc('cleric', 'team1', { x: 3, y: 3 }, 'cle'), goblin);
    applyDamage(c.state, 'gob', 'cle', 999, 'slashing');
    expect(applyHealing(c.state, 'gob', 'cle', 10)).toEqual([]);
    expect(c.state.combatants['gob']!.hp).toBe(0);
  });
});

describe('winning and losing', () => {
  const duel = () => fight(
    pc('fighter', 'team1', { x: 0, y: 0 }, 'ftr'),
    pc('wizard', 'team2', { x: 7, y: 7 }, 'foe'),
  );

  it('a party that is all down has lost', () => {
    const c = duel();
    applyDamage(c.state, 'ftr', 'foe', 999, 'slashing');
    expect(c.state.winner).toBe('team2');
  });

  it('ends the battle even when the last hero was asleep as it dropped', () => {
    // Sleep also sets `unconscious`, so "already unconscious at 0?" was not a
    // safe way to ask "already down?": it matched the instant a slept hero was
    // damaged to 0, skipped the winner check, and left the battle grinding on
    // with the whole party wiped out.
    const c = duel();
    c.state.combatants['ftr']!.conditions.push({ id: 'unconscious', sourceId: 'foe' });
    applyDamage(c.state, 'ftr', 'foe', 999, 'slashing');
    expect(c.state.winner).toBe('team2');
  });

  it('a slept party has not lost: it is above 0 and will wake', () => {
    const c = duel();
    c.state.combatants['ftr']!.conditions.push({ id: 'unconscious', sourceId: 'foe' });
    expect(c.state.winner).toBe(null);
  });

  it('full AI battles still reach a winner with heroes on both sides', () => {
    for (const mapId of ['open', 'corridor', 'ruins']) {
      const c = new Combat({ seed: 11, mapId, combatants: [...buildParty('team1', 0), ...buildParty('team2', 7)] });
      let steps = 0;
      while (!c.isOver() && steps++ < 5000) c.apply(chooseAction(c.state, c.activeId));
      expect(c.isOver(), `${mapId} never finished`).toBe(true);
    }
  }, 30000);
});

/**
 * What a caster leaves behind when it stops being able to hold it.
 *
 * All three are invisible to a harness that only asks whether a fight
 * finishes: a paralysis that outlives its wizard, an aura around a body, a
 * hovering weapon nothing will ever clear. They were found by fuzzing
 * invariants over the state after every action instead of watching outcomes.
 */
describe('what a downed caster leaves behind', () => {
  it('a hero wailed unconscious drops what they were concentrating on', () => {
    const wiz = pc('wizard', 'team1', { x: 0, y: 0 }, 'wiz');
    const banshee = { ...buildMonster('banshee', 'team2', { x: 1, y: 1 }), id: 'ban' };
    const ogre = { ...buildMonster('ogre', 'team2', { x: 3, y: 3 }), id: 'ogre' };
    const c = fight({ ...wiz, hp: 6 }, banshee, ogre);

    c.state.combatants['wiz']!.concentratingOn = { spellId: 'hold-person', targetIds: ['ogre'] };
    c.state.combatants['ogre']!.conditions.push({ id: 'paralyzed', sourceId: 'wiz', concentration: true });

    // The Wail took its own route to 0 HP — downCombatant plus a win check —
    // and skipped breaking concentration, so the ogre stayed paralysed by a
    // wizard asleep on the floor.
    FEATURES['wail']!.apply!({ state: c.state, actorId: 'ban' } as never);

    const w = c.state.combatants['wiz']!;
    expect(isDown(w), 'the wail should have dropped the wizard').toBe(true);
    expect(w.concentratingOn).toBeUndefined();
    expect(c.state.combatants['ogre']!.conditions.some((k) => k.id === 'paralyzed')).toBe(false);
  });

  it('a downed cleric loses the aura and the spell it was holding', () => {
    const cleric = pc('cleric', 'team1', { x: 0, y: 0 }, 'cle');
    const foe = { ...buildMonster('ogre', 'team2', { x: 7, y: 7 }), id: 'foe' };
    const c = fight({ ...cleric, hp: 5 }, foe);
    const cl = c.state.combatants['cle']!;
    cl.concentratingOn = { spellId: 'spiritual-guardians', targetIds: [] };
    cl.spiritualGuardians = { dc: 14, mod: 3, dice: '3d8' };

    applyDamage(c.state, 'cle', 'foe', 99, 'bludgeoning');

    expect(isDown(c.state.combatants['cle']!)).toBe(true);
    expect(c.state.combatants['cle']!.spiritualGuardians).toBeUndefined();
    expect(c.state.combatants['cle']!.concentratingOn).toBeUndefined();
  });

  it("a downed caster's Spiritual Weapon still winks out on its own clock", () => {
    // A Spiritual Weapon is held by duration, not concentration, so breaking
    // concentration does not touch it — and its only sweep ran at the start of
    // the caster's turn, which a downed caster never gets (initiative skips
    // them). It hovered for the rest of the fight.
    //
    // No ally: a fighter standing by would shake the cleric awake, and a cleric
    // back on their feet re-casts the weapon, which hides the thing under test.
    const cleric = pc('cleric', 'team1', { x: 0, y: 0 }, 'cle');
    const mate = pc('fighter', 'team1', { x: 1, y: 0 }, 'mate');
    const foe = { ...buildMonster('ogre', 'team2', { x: 7, y: 7 }), id: 'foe' };
    const c = fight({ ...cleric, hp: 4 }, mate, foe);
    c.state.combatants['cle']!.summons = [
      { kind: 'spiritual-weapon', position: { x: 2, y: 2 }, expiresAtRound: c.state.round },
    ];
    applyDamage(c.state, 'cle', 'foe', 99, 'bludgeoning');
    expect(isDown(c.state.combatants['cle']!)).toBe(true);

    // Everyone simply ends their turn, so the only thing that can clear the
    // weapon is the clock.
    const startRound = c.state.round;
    for (let i = 0; i < 400 && c.state.round <= startRound + 2 && !c.isOver(); i++) {
      c.apply({ kind: 'endTurn' });
    }
    expect(c.state.combatants['cle']!.summons ?? []).toEqual([]);
  });
});
