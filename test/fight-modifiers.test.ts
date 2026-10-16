import { describe, it, expect } from 'vitest';
import { Combat, type CombatSetup } from '../src/engine/combat.js';
import { buildMonster } from '../src/data/monsters.js';
import { resolveAttack, applyDamage } from '../src/engine/rules/attack.js';
import { savingThrow } from '../src/engine/rules/saves.js';
import { rollSkill } from '../src/engine/rules/skills.js';
import { summonCombatant } from '../src/engine/rules/summon.js';
import { rollD20 } from '../src/engine/dice.js';
import { chooseAction } from '../src/ai/greedy.js';
import type { Combatant, FightModifier, GameState } from '../src/engine/types.js';
import type { GameEvent } from '../src/engine/events.js';
import { makeCombatant } from './helpers.js';

/**
 * Story boons and banes: modifiers a fight's setup carries for the whole fight
 * (CombatSetup.modifiers, rules/modifiers.ts).
 */

const LAMP: FightModifier = {
  target: { team: 'team2', creatureType: 'undead' },
  effect: { kind: 'disadvantage', on: 'attack' },
  source: 'the vigil lamp',
};

function monster(id: string, at: { x: number; y: number }, name = id): Combatant {
  return { ...buildMonster(id, 'team2', at), id: name, name };
}

/** A hero (and anyone else) against monsters, on the open field. */
function fight(foes: Combatant[], modifiers: FightModifier[] = [], seed = 1, extra: Partial<CombatSetup> = {}) {
  const hero = makeCombatant({ id: 'hero', team: 'team1', position: { x: 3, y: 3 }, hp: 200, maxHp: 200 });
  return new Combat({ seed, mapId: 'open', combatants: [hero, ...foes], modifiers, ...extra });
}

const attackOf = (events: GameEvent[]) => events.find((e) => e.type === 'attackRolled');

/** A seed whose next d20 differs between flat and `mode`, so the mode shows in the natural. */
function tellingState(c: Combat, mode: 'advantage' | 'disadvantage'): GameState {
  for (let seed = 1; seed < 500; seed++) {
    c.state.rng = seed;
    if (rollD20(seed, 'flat').natural !== rollD20(seed, mode).natural) return c.state;
  }
  throw new Error('no telling seed');
}

describe('logged once, as the fight starts', () => {
  it('opens the log with a line made from the source and the effect, naming whom it reaches', () => {
    const c = fight([monster('skeleton', { x: 3, y: 4 }, 'bones'), monster('orc', { x: 4, y: 4 }, 'orc')], [LAMP]);
    const first = c.log[0]!;
    expect(first).toEqual({
      type: 'fightModifier', source: 'the vigil lamp',
      text: 'The vigil lamp: the undead have disadvantage on attack rolls.', combatantIds: ['bones'],
    });
    expect(c.log.filter((e) => e.type === 'fightModifier')).toHaveLength(1);
    expect(c.log.findIndex((e) => e.type === 'combatStarted')).toBeGreaterThan(0);
  });

  it('uses the story\'s own words when it gives them', () => {
    const c = fight([monster('skeleton', { x: 3, y: 4 })], [{ ...LAMP, text: 'The vigil lamp burns: the undead have disadvantage on attack rolls.' }]);
    expect(c.log[0]).toMatchObject({ text: 'The vigil lamp burns: the undead have disadvantage on attack rolls.' });
  });

  it('describes every kind of effect in a sentence', () => {
    const lines = (mods: FightModifier[]) => fight([monster('troll', { x: 3, y: 5 }, 'troll')], mods).log
      .flatMap((e) => (e.type === 'fightModifier' ? [e.text] : []));
    expect(lines([
      { target: { team: 'team1' }, effect: { kind: 'tempHp', amount: 5 }, source: 'the shrine\'s blessing' },
      { target: { monster: 'troll' }, effect: { kind: 'suppress', what: 'regeneration' }, source: 'the burning oil' },
      { target: { id: 'troll' }, effect: { kind: 'advantage', on: 'attacked' }, source: 'the pit' },
      { target: { team: 'team2' }, effect: { kind: 'condition', condition: 'frightened', save: { ability: 'wis', dc: 13 } }, source: 'the horn' },
      { target: { creatureType: 'giant' }, effect: { kind: 'extraDamage', dice: '1d6', type: 'fire' }, source: 'the oil' },
      { target: {}, effect: { kind: 'disadvantage', on: 'save', ability: 'dex' }, source: 'the ice' },
    ])).toEqual([
      'The shrine\'s blessing: the party gains 5 temporary hit points.',
      'The burning oil: the trolls cannot regenerate.',
      'The pit: attack rolls against troll have advantage.',
      'The horn: the foes must make a DC 13 Wisdom saving throw or start the fight frightened.',
      'The oil: weapon hits on the giants deal an extra 1d6 fire damage.',
      'The ice: everyone has disadvantage on Dexterity saving throws.',
    ]);
  });
});

describe('advantage and disadvantage', () => {
  it('the undead attack at disadvantage, named by the lamp; the living do not', () => {
    const c = fight([monster('skeleton', { x: 3, y: 4 }, 'bones'), monster('orc', { x: 4, y: 4 }, 'orc')], [LAMP]);
    const bones = attackOf(resolveAttack(c.state, 'bones', 'hero', 'shortsword'));
    expect(bones).toMatchObject({ mode: 'disadvantage' });
    expect(bones?.type === 'attackRolled' && bones.disSources).toContain('the vigil lamp');
    const orc = attackOf(resolveAttack(c.state, 'orc', 'hero', c.state.combatants['orc']!.equipped.mainHand!));
    expect(orc?.type === 'attackRolled' && orc.disSources).not.toContain('the vigil lamp');
  });

  it('attack rolls against a creature can be given advantage, and cancel against disadvantage', () => {
    const pit: FightModifier = { target: { id: 'orc' }, effect: { kind: 'advantage', on: 'attacked' }, source: 'the pit' };
    const c = fight([monster('orc', { x: 3, y: 4 }, 'orc')], [pit]);
    expect(attackOf(resolveAttack(c.state, 'hero', 'orc', 'longsword'))).toMatchObject({ mode: 'advantage' });
    const both = fight([monster('orc', { x: 3, y: 4 }, 'orc')],
      [pit, { target: { team: 'team1' }, effect: { kind: 'disadvantage', on: 'attack' }, source: 'the fog' }]);
    expect(attackOf(resolveAttack(both.state, 'hero', 'orc', 'longsword'))).toMatchObject({ mode: 'flat' });
  });

  it('saving throws: disadvantage of one ability only', () => {
    const ice: FightModifier = { target: { team: 'team1' }, effect: { kind: 'disadvantage', on: 'save', ability: 'dex' }, source: 'the ice' };
    const c = fight([monster('orc', { x: 6, y: 6 })], [ice]);
    let state = tellingState(c, 'disadvantage');
    const want = rollD20(state.rng, 'disadvantage').natural;
    expect(savingThrow(state, 'hero', 'dex', 10, { magical: false }).event).toMatchObject({ natural: want });
    state = tellingState(c, 'disadvantage');
    const flat = rollD20(state.rng, 'flat').natural;
    expect(savingThrow(state, 'hero', 'wis', 10, { magical: false }).event).toMatchObject({ natural: flat });
  });

  it('ability checks', () => {
    const c = fight([monster('orc', { x: 6, y: 6 })],
      [{ target: { id: 'hero' }, effect: { kind: 'advantage', on: 'check' }, source: 'the rope' }]);
    const state = tellingState(c, 'advantage');
    const want = rollD20(state.rng, 'advantage').natural;
    expect(rollSkill(state, 'hero', 'athletics').natural).toBe(want);
  });
});

describe('a condition at the start', () => {
  it('lands through the usual wards: poison-immune skeletons are not poisoned', () => {
    const c = fight([monster('skeleton', { x: 3, y: 5 }, 'bones'), monster('orc', { x: 4, y: 5 }, 'orc')],
      [{ target: { team: 'team2' }, effect: { kind: 'condition', condition: 'poisoned' }, source: 'the bad well' }]);
    expect(c.state.combatants['orc']!.conditions.map((k) => k.id)).toContain('poisoned');
    expect(c.state.combatants['bones']!.conditions.map((k) => k.id)).not.toContain('poisoned');
    expect(c.log.findIndex((e) => e.type === 'conditionApplied'))
      .toBeLessThan(c.log.findIndex((e) => e.type === 'combatStarted'));
  });

  it('a save first, if the story gives one; and a repeat save, if asked', () => {
    const horn: FightModifier = {
      target: { team: 'team2' }, source: 'the horn',
      effect: { kind: 'condition', condition: 'frightened', save: { ability: 'wis', dc: 30 }, repeatSave: true },
    };
    const c = fight([monster('orc', { x: 6, y: 6 }, 'orc')], [horn]);
    expect(c.log.some((e) => e.type === 'savingThrow' && e.combatantId === 'orc')).toBe(true);
    expect(c.state.combatants['orc']!.conditions.find((k) => k.id === 'frightened')).toMatchObject({
      lasting: true, repeatSave: { ability: 'wis', dc: 30 },
    });
  });

  it('lasts the whole fight, or `rounds` rounds; a fight-long blindness is not Color Spray\'s', () => {
    const c = fight([monster('orc', { x: 6, y: 6 }, 'orc')], [
      { target: { id: 'orc' }, effect: { kind: 'condition', condition: 'blinded' }, source: 'the dark' },
      { target: { id: 'orc' }, effect: { kind: 'condition', condition: 'prone', rounds: 1 }, source: 'the slope' },
    ]);
    const orc = () => c.state.combatants['orc']!;
    for (let i = 0; i < 6 && c.state.round < 3; i++) c.apply({ kind: 'endTurn' });
    expect(c.state.round).toBeGreaterThanOrEqual(2);
    expect(orc().conditions.map((k) => k.id)).toContain('blinded');
    expect(orc().conditions.map((k) => k.id)).not.toContain('prone');
  });

  it('a net can be escaped with an action', () => {
    const c = fight([monster('orc', { x: 6, y: 6 }, 'orc')],
      [{ target: { id: 'hero' }, effect: { kind: 'condition', condition: 'restrained', escapeDc: 10 }, source: 'the net' }]);
    c.state.turnIndex = c.state.initiativeOrder.indexOf('hero');
    expect(c.legalActions('hero')).toContainEqual({ kind: 'escape', condition: 'restrained' });
  });
});

describe('suppressed defences', () => {
  it('a wight under the lamp takes necrotic in full', () => {
    const c = fight([monster('wight', { x: 3, y: 5 }, 'wight')],
      [{ target: { creatureType: 'undead' }, effect: { kind: 'suppress', what: 'resistance', types: ['necrotic'] }, source: 'the lamp' }]);
    const w = c.state.combatants['wight']!;
    expect(w.resistances).not.toContain('necrotic');
    applyDamage(c.state, 'wight', 'hero', 10, 'necrotic', [], { magical: true });
    expect(w.maxHp - w.hp).toBe(10);
  });

  it('every resistance, nonmagical ones included, when no types are named', () => {
    const c = fight([monster('wraith', { x: 3, y: 5 }, 'wraith')],
      [{ target: { id: 'wraith' }, effect: { kind: 'suppress', what: 'resistance' }, source: 'the lamp' }]);
    expect(c.state.combatants['wraith']!.resistances).toEqual([]);
    expect(c.state.combatants['wraith']!.resistNonmagical).toEqual([]);
  });

  it('immunities', () => {
    const c = fight([monster('young-red', { x: 3, y: 5 }, 'red')],
      [{ target: { id: 'red' }, effect: { kind: 'suppress', what: 'immunity', types: ['fire'] }, source: 'the frost brand' }]);
    applyDamage(c.state, 'red', 'hero', 10, 'fire', [], { magical: true });
    expect(c.state.combatants['red']!.maxHp - c.state.combatants['red']!.hp).toBe(10);
  });

  it('a troll that cannot regenerate dies at 0', () => {
    const c = fight([monster('troll', { x: 3, y: 5 }, 'troll')],
      [{ target: { monster: 'troll' }, effect: { kind: 'suppress', what: 'regeneration' }, source: 'the oil' }]);
    const t = c.state.combatants['troll']!;
    expect(t.regeneration).toBeUndefined();
    applyDamage(c.state, 'troll', 'hero', 500, 'slashing', [], { magical: false });
    expect(t.alive).toBe(false);
  });

  it('reaches creatures conjured mid-fight too', () => {
    const c = fight([monster('wight', { x: 3, y: 5 }, 'wight')],
      [{ target: { creatureType: 'undead' }, effect: { kind: 'suppress', what: 'resistance' }, source: 'the lamp' }]);
    summonCombatant(c.state, { monsterId: 'wight', summonerId: 'wight', near: { x: 5, y: 5 } });
    const called = Object.values(c.state.combatants).find((x) => x.summonedBy === 'wight')!;
    expect(called.resistances).toEqual([]);
  });
});

describe('extra damage and temporary hit points', () => {
  const OIL: FightModifier = { target: { creatureType: 'undead' }, effect: { kind: 'extraDamage', dice: '1d6', type: 'radiant' }, source: 'the blessed oil' };

  function firstHit(c: Combat, attacker: string, target: string, weapon: string): GameEvent[] {
    for (let seed = 1; seed < 200; seed++) {
      const state = structuredClone(c.state);
      state.rng = seed;
      const events = resolveAttack(state, attacker, target, weapon);
      if (attackOf(events)?.type === 'attackRolled' && (attackOf(events) as { hit: boolean }).hit) return events;
    }
    throw new Error('never hit');
  }

  it('a weapon hit on the undead adds the story\'s dice, tagged with its name', () => {
    const c = fight([monster('skeleton', { x: 3, y: 4 }, 'bones')], [OIL]);
    const extra = firstHit(c, 'hero', 'bones', 'longsword')
      .filter((e) => e.type === 'damageDealt' && e.tags?.includes('the blessed oil'));
    expect(extra).toHaveLength(1);
    expect(extra[0]).toMatchObject({ damageType: 'radiant' });
  });

  it('not from their own side, and only from `by` when it is given', () => {
    const c = fight([monster('skeleton', { x: 3, y: 4 }, 'bones'), monster('zombie', { x: 4, y: 4 }, 'zed')], [OIL]);
    const own = firstHit(c, 'zed', 'bones', c.state.combatants['zed']!.equipped.mainHand!);
    expect(own.some((e) => e.type === 'damageDealt' && e.tags?.includes('the blessed oil'))).toBe(false);
    const someoneElse = fight([monster('skeleton', { x: 3, y: 4 }, 'bones')],
      [{ ...OIL, effect: { ...OIL.effect, by: { id: 'somebody-else' } } as FightModifier['effect'] }]);
    const hit = firstHit(someoneElse, 'hero', 'bones', 'longsword');
    expect(hit.some((e) => e.type === 'damageDealt' && e.tags?.includes('the blessed oil'))).toBe(false);
  });

  it('temporary hit points to the party at the start, the larger pool standing', () => {
    const c = fight([monster('orc', { x: 6, y: 6 })],
      [{ target: { team: 'team1' }, effect: { kind: 'tempHp', amount: 7 }, source: 'the blessing' }]);
    expect(c.state.combatants['hero']!.tempHp).toBe(7);
  });
});

describe('nothing changes without them, and they replay', () => {
  function play(modifiers: FightModifier[] | undefined, seed: number): GameEvent[] {
    const hero = makeCombatant({ id: 'hero', team: 'team1', position: { x: 3, y: 3 } });
    const foes = [monster('skeleton', { x: 3, y: 6 }, 'bones'), monster('zombie', { x: 4, y: 6 }, 'zed')];
    const c = new Combat({ seed, mapId: 'open', combatants: [hero, ...foes], ...(modifiers ? { modifiers } : {}) });
    for (let i = 0; i < 400 && !c.isOver(); i++) c.apply(chooseAction(c.state, c.activeId));
    return c.log;
  }

  it('an empty list is no list', () => {
    for (const seed of [1, 2, 3]) expect(play([], seed)).toEqual(play(undefined, seed));
  });

  it('the same seed plays the same fight', () => {
    const mods = [LAMP, { target: { creatureType: 'undead' }, effect: { kind: 'extraDamage', dice: '1d4', type: 'radiant' }, source: 'oil' } as FightModifier];
    expect(play(mods, 5)).toEqual(play(mods, 5));
    expect(play(mods, 5)).not.toEqual(play(undefined, 5));
  });

  it('the setup is copied, not kept', () => {
    const mods: FightModifier[] = [structuredClone(LAMP)];
    const c = fight([monster('skeleton', { x: 3, y: 4 })], mods);
    mods[0]!.source = 'changed';
    expect(c.state.modifiers![0]!.source).toBe('the vigil lamp');
  });
});
