import { describe, it, expect } from 'vitest';
import { Combat, type CombatSetup } from '../src/engine/combat.js';
import { buildMonster } from '../src/data/monsters.js';
import { applyDamage } from '../src/engine/rules/attack.js';
import { applyCondition } from '../src/engine/rules/conditions.js';
import { runEffects, pickTargets } from '../src/engine/rules/setpiece.js';
import { chooseAction } from '../src/ai/greedy.js';
import { cellAt, type Combatant, type LairAction, type SetPiece } from '../src/engine/types.js';
import type { GameEvent } from '../src/engine/events.js';
import { makeCombatant } from './helpers.js';

/**
 * Set pieces: lair actions on initiative count 20, and a boss's phases
 * (CombatSetup.setPieces, rules/setpiece.ts).
 */

const SLOW = { str: 16, dex: 1, con: 16, int: 10, wis: 12, cha: 8 };

function monster(id: string, at: { x: number; y: number }, name = 'boss', over: Partial<Combatant> = {}): Combatant {
  return { ...buildMonster(id, 'team2', at), id: name, name, ...over };
}
function hero(id: string, at: { x: number; y: number }, over: Partial<Combatant> = {}): Combatant {
  return makeCombatant({ id, team: 'team1', position: at, hp: 300, maxHp: 300, ...over });
}
function fight(combatants: Combatant[], setPieces: SetPiece[] = [], seed = 1, extra: Partial<CombatSetup> = {}) {
  return new Combat({ seed, mapId: 'open', combatants, setPieces, ...extra });
}

/** Line only: a lair action that does nothing but be taken. */
const line = (name: string): LairAction => ({ name, effects: [] });

/** Set the order by hand, as a fresh round 1 about to begin with the first of them. */
function order(c: Combat, inits: Record<string, number>): void {
  const st = c.state;
  for (const [id, n] of Object.entries(inits)) st.combatants[id]!.initiative = n;
  st.initiativeOrder = Object.keys(inits);
  st.turnIndex = 0;
  st.round = 1;
  delete st.lairRound;
  for (const x of Object.values(st.combatants)) if (x.lair) { x.lair.taken = 0; delete x.lair.last; }
}

/** End turns until `k` more rounds have begun, returning what happened. */
function rounds(c: Combat, k: number): GameEvent[] {
  const from = c.log.length;
  const until = c.state.round + k;
  for (let i = 0; i < 300 && c.state.round < until && !c.isOver(); i++) c.apply({ kind: 'endTurn' });
  return c.log.slice(from);
}

const lairNames = (events: GameEvent[]) => events.flatMap((e) => (e.type === 'lairAction' ? [e.name] : []));

describe('lair actions: initiative count 20, losing ties', () => {
  it('after everyone on 20 or more, before everyone below', () => {
    const c = fight([hero('a', { x: 1, y: 1 }), hero('b', { x: 2, y: 1 }), hero('cc', { x: 3, y: 1 }), monster('orc', { x: 5, y: 5 })],
      [{ creature: 'boss', lair: { actions: [line('The cave groans')] } }]);
    order(c, { a: 22, b: 20, cc: 15, boss: 10 });
    const seen = rounds(c, 2).filter((e) => e.type === 'lairAction' || e.type === 'turnStarted' || e.type === 'roundStarted')
      .map((e) => (e.type === 'turnStarted' ? e.combatantId : e.type === 'roundStarted' ? `round ${e.round}` : 'LAIR'));
    expect(seen).toEqual(['b', 'LAIR', 'cc', 'boss', 'round 2', 'a', 'b', 'LAIR', 'cc', 'boss', 'round 3', 'a']);
  });

  it('closes the round when nobody is below 20', () => {
    const c = fight([hero('a', { x: 1, y: 1 }), monster('orc', { x: 5, y: 5 })],
      [{ creature: 'boss', lair: { actions: [line('The cave groans')] } }]);
    order(c, { a: 25, boss: 21 });
    const seen = rounds(c, 1).filter((e) => e.type === 'lairAction' || e.type === 'roundStarted').map((e) => e.type);
    expect(seen).toEqual(['lairAction', 'roundStarted']);
  });

  it('opens the fight, when the first in the order is below 20', () => {
    const c = fight([hero('a', { x: 1, y: 1 }, { abilities: SLOW }), monster('orc', { x: 5, y: 5 }, 'boss', { abilities: SLOW })],
      [{ creature: 'boss', lair: { actions: [line('The cave groans')] } }]);
    const lair = c.log.findIndex((e) => e.type === 'lairAction');
    expect(lair).toBeGreaterThan(c.log.findIndex((e) => e.type === 'combatStarted'));
    expect(lair).toBeLessThan(c.log.findIndex((e) => e.type === 'turnStarted'));
  });

  it('not while it is incapacitated, down or dead', () => {
    const c = fight([hero('a', { x: 1, y: 1 }), monster('orc', { x: 5, y: 5 })],
      [{ creature: 'boss', lair: { actions: [line('The cave groans')] } }]);
    order(c, { a: 22, boss: 10 });
    c.state.combatants['boss']!.conditions.push({ id: 'stunned' });
    expect(lairNames(rounds(c, 1))).toEqual([]);
    c.state.combatants['boss']!.conditions = [];
    expect(lairNames(rounds(c, 1))).toEqual(['The cave groans']);
  });

  it('in the listed order, or the best for the moment and never the same twice running', () => {
    const inOrder = fight([hero('a', { x: 1, y: 1 }), monster('orc', { x: 5, y: 5 })],
      [{ creature: 'boss', lair: { choose: 'inOrder', actions: [line('One'), line('Two'), line('Three')] } }]);
    order(inOrder, { a: 22, boss: 10 });
    expect(lairNames(rounds(inOrder, 4))).toEqual(['One', 'Two', 'Three', 'One']);

    const quake: LairAction = { name: 'Quake', effects: [{ kind: 'save', targets: { within: 30 }, ability: 'dex', dc: 1, damage: { dice: '1d1', type: 'bludgeoning' } }] };
    const bolt: LairAction = { name: 'Bolt', effects: [{ kind: 'save', targets: { count: 1 }, ability: 'dex', dc: 1, damage: { dice: '1d1', type: 'lightning' } }] };
    const best = fight([hero('a', { x: 1, y: 1 }), hero('b', { x: 2, y: 1 }), monster('orc', { x: 3, y: 3 })],
      [{ creature: 'boss', lair: { actions: [bolt, quake] } }]);
    order(best, { a: 22, b: 21, boss: 10 });
    expect(lairNames(rounds(best, 3))).toEqual(['Quake', 'Bolt', 'Quake']);
  });

  it('`requires`: an action with nothing to work on is not taken', () => {
    const c = fight([hero('a', { x: 1, y: 1 }), monster('aboleth', { x: 6, y: 6 })], [{ creature: 'boss', inLair: true }]);
    order(c, { a: 22, boss: 10 });
    // Out of the tentacles' reach and held by nothing: neither Lash nor Psychic Drain.
    expect(lairNames(rounds(c, 1))).toEqual([]);
    applyCondition(c.state, 'a', { id: 'charmed', sourceId: 'boss' }, { magical: true });
    const drained = rounds(c, 1);
    expect(lairNames(drained)).toEqual(['Psychic Drain']);
    expect(drained).toContainEqual(expect.objectContaining({ type: 'savingThrow', combatantId: 'a', ability: 'int', dc: 16 }));
    expect(drained.some((e) => e.type === 'damageDealt' && e.targetId === 'a' && e.damageType === 'psychic')).toBe(true);
  });
});

describe('the SRD lairs: a vampire and an aboleth at home', () => {
  it('only in its lair: one more Legendary Resistance, and lair actions; on the road, neither', () => {
    const home = fight([hero('a', { x: 1, y: 1 }), monster('vampire', { x: 6, y: 6 })], [{ creature: 'boss', inLair: true }]);
    const boss = home.state.combatants['boss']!;
    expect(boss.featureUses['legendary-resistance']).toEqual({ current: 4, max: 4 });
    expect(boss.lair?.actions.map((a) => a.name)).toEqual(['Beguile', 'Deathless Strike']);
    const road = fight([hero('a', { x: 1, y: 1 }), monster('vampire', { x: 6, y: 6 })]);
    expect(road.state.combatants['boss']!.lair).toBeUndefined();
    expect(road.state.combatants['boss']!.featureUses['legendary-resistance']).toEqual({ current: 3, max: 3 });
    const aboleth = fight([hero('a', { x: 1, y: 1 }), monster('aboleth', { x: 6, y: 6 })], [{ creature: 'boss', inLair: true }]);
    expect(aboleth.state.combatants['boss']!.featureUses['legendary-resistance']?.max).toBe(4);
  });

  it('Beguile casts Command at DC 17, on Charisma, for that cast only', () => {
    const c = fight([hero('a', { x: 1, y: 1 }), monster('vampire', { x: 1, y: 7 })], [{ creature: 'boss', inLair: true }]);
    order(c, { a: 22, boss: 10 });
    const events = rounds(c, 1);
    expect(lairNames(events)).toEqual(['Beguile']);
    expect(events).toContainEqual(expect.objectContaining({ type: 'spellCast', casterId: 'boss', spellId: 'command' }));
    expect(events).toContainEqual(expect.objectContaining({ type: 'savingThrow', combatantId: 'a', ability: 'wis', dc: 17 }));
    expect(c.state.combatants['boss']!.spellcastingAbility).toBeUndefined();
  });

  it('then Deathless Strike: a Grave Strike at whoever is in reach', () => {
    const c = fight([hero('a', { x: 3, y: 3 }), monster('vampire', { x: 3, y: 4 })], [{ creature: 'boss', inLair: true }]);
    order(c, { a: 22, boss: 10 });
    const events = rounds(c, 2);
    expect(lairNames(events)).toEqual(['Beguile', 'Deathless Strike']);
    expect(events).toContainEqual(expect.objectContaining({ type: 'attackRolled', attackerId: 'boss', weaponId: 'vampire-grave-strike' }));
  });
});

describe('the effects', () => {
  const board = () => new Combat({
    seed: 1, width: 16, height: 16, combatants: [
      hero('a', { x: 3, y: 3 }), hero('b', { x: 4, y: 3 }), hero('far', { x: 3, y: 12 }),
      monster('ogre', { x: 3, y: 5 }), monster('orc', { x: 4, y: 5 }, 'minion'),
    ],
  });

  it('a save: one roll of damage, a condition on a failure with its way out, only within range', () => {
    const c = board();
    const events = runEffects(c.state, 'boss', [{
      kind: 'save', targets: { within: 30 }, ability: 'dex', dc: 40, damage: { dice: '2d6', type: 'fire' }, condition: 'prone',
    }], 'Fire');
    expect(events.filter((e) => e.type === 'savingThrow').map((e) => e.type === 'savingThrow' && e.combatantId)).toEqual(['a', 'b']);
    const hits = events.flatMap((e) => (e.type === 'damageDealt' ? [e] : []));
    expect(hits.map((h) => h.targetId)).toEqual(['a', 'b']);
    expect(hits[0]!.amount).toBe(hits[1]!.amount);
    expect(hits[0]!.tags).toEqual(['Fire']);
    expect(c.state.combatants['a']!.conditions.find((k) => k.id === 'prone')).toMatchObject({ sourceId: 'boss', repeatSave: { ability: 'dex', dc: 40 } });
    expect(c.state.combatants['far']!.hp).toBe(300);
  });

  it('a condition outright, until the start of its next turn; on allies or itself if asked', () => {
    const c = board();
    runEffects(c.state, 'boss', [{ kind: 'condition', targets: { count: 1 }, condition: 'restrained', until: 'startOfTurn' }], 'Roots');
    expect(c.state.combatants['a']!.conditions.find((k) => k.id === 'restrained')).toMatchObject({ endsAtTurnStartOf: 'a' });
    expect(c.state.combatants['b']!.conditions).toEqual([]);
    expect(pickTargets(c.state, c.state.combatants['boss']!, { who: 'allies' }).ids).toEqual(['minion']);
    expect(pickTargets(c.state, c.state.combatants['boss']!, { who: 'self' }).ids).toEqual(['boss']);
  });

  it('an area lands where it catches the most', () => {
    const c = board();
    const plan = pickTargets(c.state, c.state.combatants['boss']!, { radius: 5 });
    expect(plan.ids.sort()).toEqual(['a', 'b']);
  });

  it('the ground: difficult for a round, or a hazard for the fight', () => {
    const c = board();
    const events = runEffects(c.state, 'boss', [{ kind: 'terrain', ground: 'difficult' }], 'Rubble');
    expect(events[0]).toMatchObject({ type: 'groundChanged', ground: 'difficult' });
    expect(cellAt(c.state.grid, { x: 3, y: 3 })!.chilled).toEqual({ expiresAtRound: c.state.round + 1 });
    runEffects(c.state, 'boss', [{ kind: 'terrain', targets: { count: 1 }, ground: 'hazard', damage: { dice: '1d6', type: 'fire' } }], 'Brimstone');
    expect(cellAt(c.state.grid, { x: 3, y: 3 })!.fire).toMatchObject({ sourceId: 'boss', dice: '1d6', damageType: 'fire', label: 'Brimstone', unsaved: true });
  });

  it('a spell, aimed where it catches enemies and not its own side', () => {
    const c = board();
    const events = runEffects(c.state, 'boss', [{ kind: 'spell', spellId: 'fireball', ability: 'cha' }], 'Hellfire');
    const cast = events.find((e) => e.type === 'spellCast');
    expect(cast).toMatchObject({ casterId: 'boss', spellId: 'fireball' });
    const saved = events.flatMap((e) => (e.type === 'savingThrow' ? [e.combatantId] : []));
    expect(saved).toContain('a');
    expect(saved).not.toContain('minion');
    expect(saved).not.toContain('boss');
  });

  it('allies called up beside it, after it in the order, not deciding the fight', () => {
    const c = board();
    const events = runEffects(c.state, 'boss', [{ kind: 'summon', monsterId: 'goblin-warrior', count: 2 }], 'Call');
    const called = events.flatMap((e) => (e.type === 'summoned' ? [e.combatantId] : []));
    expect(called).toHaveLength(2);
    const names = called.map((id) => c.state.combatants[id]!.name);
    expect(new Set(names).size).toBe(2);
    const at = c.state.initiativeOrder.indexOf('boss');
    expect(c.state.initiativeOrder.slice(at + 1, at + 3).sort()).toEqual([...called].sort());
    for (const id of called) expect(c.state.combatants[id]).toMatchObject({ team: 'team2', summonedBy: 'boss' });
  });

  it('heal, immunity (shaking the condition off), new attacks', () => {
    const c = board();
    const boss = c.state.combatants['boss']!;
    boss.hp = 10;
    boss.conditions.push({ id: 'frightened' });
    runEffects(c.state, 'boss', [
      { kind: 'heal', amount: 20 },
      { kind: 'immunity', conditions: ['frightened'], damage: ['fire'] },
      { kind: 'attacks', weaponIds: ['greataxe'], attacksPerAction: 3 },
    ], 'Rage');
    expect(boss.hp).toBe(30);
    expect(boss.conditions).toEqual([]);
    expect(boss.conditionImmunities).toContain('frightened');
    expect(boss.immunities).toContain('fire');
    expect(boss.equipped.mainHand).toBe('greataxe');
    expect(boss.attacksPerAction).toBe(3);
  });
});

describe('phases', () => {
  const rally: SetPiece = {
    creature: 'boss',
    phases: [
      { at: 0.25, text: 'The ogre bellows for its kin.', effects: [{ kind: 'summon', monsterId: 'goblin-warrior' }] },
      { at: 0.5, name: 'Enraged', effects: [{ kind: 'heal', amount: 5 }, { kind: 'attacks', attacksPerAction: 3 }] },
    ],
  };

  it('fire once, the first time its hit points fall to the mark, between actions', () => {
    const c = fight([hero('a', { x: 1, y: 1 }), monster('ogre', { x: 6, y: 6 })], [rally]);
    const boss = c.state.combatants['boss']!;
    applyDamage(c.state, 'boss', 'a', boss.maxHp - Math.floor(boss.maxHp / 2), 'slashing', [], { magical: false });
    expect(boss.attacksPerAction).toBe(1);
    const events = c.apply({ kind: 'endTurn' });
    expect(events.filter((e) => e.type === 'bossPhase')).toEqual([{ type: 'bossPhase', combatantId: 'boss', name: 'Enraged' }]);
    expect(c.state.combatants['boss']!.attacksPerAction).toBe(3);
    expect(events).toContainEqual(expect.objectContaining({ type: 'healed', targetId: 'boss', amount: 5 }));
    expect(c.apply({ kind: 'endTurn' }).some((e) => e.type === 'bossPhase')).toBe(false);
  });

  it('a blow past two marks fires both, the higher first', () => {
    const c = fight([hero('a', { x: 1, y: 1 }), monster('ogre', { x: 6, y: 6 })], [rally]);
    const boss = c.state.combatants['boss']!;
    applyDamage(c.state, 'boss', 'a', boss.maxHp - 5, 'slashing', [], { magical: false });
    const phases = c.apply({ kind: 'endTurn' }).filter((e) => e.type === 'bossPhase');
    expect(phases).toEqual([
      { type: 'bossPhase', combatantId: 'boss', name: 'Enraged' },
      { type: 'bossPhase', combatantId: 'boss', text: 'The ogre bellows for its kin.' },
    ]);
    expect(Object.values(c.state.combatants).some((x) => x.summonedBy === 'boss')).toBe(true);
  });

  it('not for a creature killed outright, and not for one already past the mark', () => {
    const c = fight([hero('a', { x: 1, y: 1 }), monster('ogre', { x: 6, y: 6 })], [rally]);
    applyDamage(c.state, 'boss', 'a', 999, 'slashing', [], { magical: false });
    expect(c.log.some((e) => e.type === 'bossPhase')).toBe(false);
    const hurt = fight([hero('a', { x: 1, y: 1 }), monster('ogre', { x: 6, y: 6 }, 'boss', { hp: 10 })], [rally]);
    expect(hurt.state.combatants['boss']!.phases!.every((p) => p.done)).toBe(true);
  });
});

describe('setting a fight up', () => {
  it('refuses a set piece for nobody, or one that cannot run', () => {
    const cast = [hero('a', { x: 1, y: 1 }), monster('ogre', { x: 6, y: 6 })];
    expect(() => fight(cast, [{ creature: 'nobody' }])).toThrow(/nobody/);
    expect(() => fight(cast, [{ creature: 'boss', phases: [{ at: 0.5, effects: [{ kind: 'summon', monsterId: 'tarrasque' }] }] }])).toThrow(/tarrasque/);
    expect(() => fight(cast, [{ creature: 'boss', lair: { actions: [{ name: 'X', effects: [{ kind: 'terrain', ground: 'hazard' }] }] } }])).toThrow(/hazard/);
    expect(() => fight(cast, [{ creature: 'boss', lair: { actions: [{ name: 'X', effects: [{ kind: 'spell', spellId: 'misty-step' }] }] } }])).toThrow(/aim/);
    expect(() => fight(cast, [{ creature: 'boss', lair: { actions: [{ name: 'X', effects: [{ kind: 'heal', amount: 'lots' }] }] } }])).toThrow(/lots/);
  });

  it('changes nothing for a fight without them', () => {
    const play = (setPieces?: SetPiece[]) => {
      const c = new Combat({
        seed: 9, mapId: 'open', combatants: [hero('a', { x: 3, y: 3 }, { hp: 30, maxHp: 30 }), monster('aboleth', { x: 3, y: 6 })],
        ...(setPieces ? { setPieces } : {}),
      });
      for (let i = 0; i < 600 && !c.isOver(); i++) c.apply(chooseAction(c.state, c.activeId));
      return c.log;
    };
    expect(play([])).toEqual(play());
    expect(play()).not.toEqual(play([{ creature: 'boss', inLair: true }]));
  });

  it('a whole fight with a lair and phases plays to its end, the same way twice', () => {
    const play = () => {
      const c = new Combat({
        seed: 3, mapId: 'open',
        combatants: [hero('a', { x: 2, y: 2 }, { hp: 60, maxHp: 60 }), hero('b', { x: 4, y: 2 }, { hp: 60, maxHp: 60 }),
          monster('vampire', { x: 3, y: 7 })],
        setPieces: [{
          creature: 'boss', inLair: true,
          lair: { actions: [{ name: 'Grasping Mist', effects: [{ kind: 'save', targets: { radius: 5 }, ability: 'con', dc: 15, damage: { dice: '2d6', type: 'necrotic' }, condition: 'restrained' }] }] },
          phases: [{ at: 0.5, name: 'The mist rises', effects: [{ kind: 'summon', monsterId: 'wolf', count: 2 }, { kind: 'terrain', ground: 'difficult', rounds: 2 }] }],
        }],
      });
      for (let i = 0; i < 3000 && !c.isOver(); i++) c.apply(chooseAction(c.state, c.activeId));
      return c;
    };
    const one = play();
    expect(one.isOver()).toBe(true);
    expect(one.log.some((e) => e.type === 'lairAction')).toBe(true);
    expect(play().log).toEqual(one.log);
  });
});
