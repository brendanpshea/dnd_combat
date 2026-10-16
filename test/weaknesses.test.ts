import { describe, it, expect } from 'vitest';
import { Combat } from '../src/engine/combat.js';
import { buildMonster, MONSTERS } from '../src/data/monsters.js';
import { resolveAttack } from '../src/engine/rules/attack.js';
import { savingThrow } from '../src/engine/rules/saves.js';
import { rollSkill } from '../src/engine/rules/skills.js';
import { rollD20 } from '../src/engine/dice.js';
import { chooseAction } from '../src/ai/greedy.js';
import { cellAt, type Combatant, type FightModifier, type GameState } from '../src/engine/types.js';
import type { GameEvent } from '../src/engine/events.js';
import { makeCombatant } from './helpers.js';

/**
 * SRD 5.2.1 weaknesses that wait on the battlefield: sunlight and running
 * water (`Combatant.weaknesses`), switched on by a fight's setup.
 */

const SUN: FightModifier = { target: {}, effect: { kind: 'sunlight' }, source: 'the noon sun' };
const RIVER: FightModifier = { target: {}, effect: { kind: 'runningWater' }, source: 'the river' };

function monster(id: string, at: { x: number; y: number }, name = id): Combatant {
  return { ...buildMonster(id, 'team2', at), id: name, name };
}
function fight(foes: Combatant[], modifiers: FightModifier[] = [], seed = 1) {
  const hero = makeCombatant({ id: 'hero', team: 'team1', position: { x: 3, y: 3 }, hp: 300, maxHp: 300 });
  return new Combat({ seed, mapId: 'open', combatants: [hero, ...foes], modifiers });
}
const attackOf = (events: GameEvent[]) => events.find((e) => e.type === 'attackRolled');

/** The state at a seed whose next d20 differs between flat and disadvantage. */
function telling(c: Combat): GameState {
  for (let seed = 1; seed < 500; seed++) {
    c.state.rng = seed;
    if (rollD20(seed, 'flat').natural !== rollD20(seed, 'disadvantage').natural) return c.state;
  }
  throw new Error('no telling seed');
}

describe('the stat blocks that carry them', () => {
  it('Sunlight Sensitivity, Sunlight Weakness and the vampires\' two', () => {
    const sensitive = Object.entries(MONSTERS).filter(([, m]) => m.weaknesses?.sunlight).map(([id]) => id).sort();
    expect(sensitive).toEqual(['drider', 'kobold', 'kobold-emberling', 'shadow', 'specter', 'vampire', 'vampire-spawn', 'wight', 'wraith']);
    expect(MONSTERS['shadow']!.weaknesses).toEqual({ sunlight: { disadvantage: 'd20Tests' } });
    for (const id of ['vampire', 'vampire-spawn']) {
      expect(MONSTERS[id]!.weaknesses).toEqual({
        sunlight: { disadvantage: 'attacksAndChecks', damage: 20 },
        runningWater: { damage: 20, type: 'acid' },
      });
    }
    expect(buildMonster('wight', 'team2', { x: 0, y: 0 }).weaknesses).toEqual(MONSTERS['wight']!.weaknesses);
  });
});

describe('in sunlight', () => {
  it('a wight attacks at disadvantage, named "sunlight"; out of it, it does not', () => {
    const sun = fight([monster('wight', { x: 3, y: 4 })], [SUN]);
    const hit = attackOf(resolveAttack(sun.state, 'wight', 'hero', 'wight-longsword'));
    expect(hit).toMatchObject({ mode: 'disadvantage' });
    expect(hit?.type === 'attackRolled' && hit.disSources).toContain('sunlight');
    const dark = fight([monster('wight', { x: 3, y: 4 })]);
    const there = attackOf(resolveAttack(dark.state, 'wight', 'hero', 'wight-longsword'));
    expect(there?.type === 'attackRolled' && there.disSources).not.toContain('sunlight');
  });

  it('nobody without the weakness minds it', () => {
    const c = fight([monster('orc', { x: 3, y: 4 })], [SUN]);
    const swing = attackOf(resolveAttack(c.state, 'orc', 'hero', c.state.combatants['orc']!.equipped.mainHand!));
    expect(swing?.type === 'attackRolled' && swing.disSources).not.toContain('sunlight');
  });

  it('ability checks too; saving throws only for the shadow\'s D20 Tests', () => {
    const c = fight([monster('wight', { x: 6, y: 6 }), monster('shadow', { x: 7, y: 7 })], [SUN]);
    let st = telling(c);
    let want = rollD20(st.rng, 'disadvantage').natural;
    expect(rollSkill(st, 'wight', 'athletics').natural).toBe(want);
    st = telling(c);
    want = rollD20(st.rng, 'disadvantage').natural;
    expect(savingThrow(st, 'shadow', 'dex', 10, { magical: false }).event).toMatchObject({ natural: want });
    st = telling(c);
    want = rollD20(st.rng, 'flat').natural;
    expect(savingThrow(st, 'wight', 'dex', 10, { magical: false }).event).toMatchObject({ natural: want });
  });

  it('only where the fight says the sun reaches', () => {
    const shade = fight([monster('wight', { x: 3, y: 4 })], [{ ...SUN, target: { team: 'team1' } }]);
    const swing = attackOf(resolveAttack(shade.state, 'wight', 'hero', 'wight-longsword'));
    expect(swing?.type === 'attackRolled' && swing.disSources).not.toContain('sunlight');
  });

  it('burns a vampire for 20 Radiant as each of its turns starts', () => {
    const c = fight([monster('vampire-spawn', { x: 6, y: 6 }, 'spawn')], [SUN]);
    const spawn = () => c.state.combatants['spawn']!;
    const before = spawn().hp;
    const start = c.log.length;
    for (let i = 0; i < 4 && c.state.round < 3; i++) c.apply({ kind: 'endTurn' });
    const burns = c.log.slice(start).filter((e) => e.type === 'damageDealt' && e.targetId === 'spawn');
    expect(burns.length).toBeGreaterThanOrEqual(1);
    expect(burns[0]).toMatchObject({ amount: 20, damageType: 'radiant', tags: ['Sunlight'] });
    expect(spawn().hp).toBe(before - 20 * burns.length);
    // A wight is only put off by it.
    const w = fight([monster('wight', { x: 6, y: 6 })], [SUN]);
    for (let i = 0; i < 4; i++) w.apply({ kind: 'endTurn' });
    expect(w.state.combatants['wight']!.hp).toBe(w.state.combatants['wight']!.maxHp);
  });
});

describe('running water', () => {
  /** A vampire spawn standing in a river's water, and whose turn it is. */
  function wading(modifiers: FightModifier[], wet = true) {
    const c = fight([monster('vampire-spawn', { x: 6, y: 6 }, 'spawn')], modifiers);
    if (wet) cellAt(c.state.grid, { x: 6, y: 6 })!.water = true;
    c.state.turnIndex = c.state.initiativeOrder.indexOf('spawn');
    return c;
  }
  const acid = (events: GameEvent[]) => events.filter((e) => e.type === 'damageDealt' && e.targetId === 'spawn' && e.damageType === 'acid');

  it('a vampire ending its turn in it takes 20 Acid', () => {
    const events = wading([RIVER]).apply({ kind: 'endTurn' });
    expect(acid(events)).toEqual([expect.objectContaining({ amount: 20, tags: ['Running Water'] })]);
  });

  it('not on dry ground, and not in still water', () => {
    expect(acid(wading([RIVER], false).apply({ kind: 'endTurn' }))).toEqual([]);
    expect(acid(wading([]).apply({ kind: 'endTurn' }))).toEqual([]);
  });
});

describe('logged as the fight starts, and nothing without them', () => {
  it('says what the story set', () => {
    const c = fight([monster('wight', { x: 6, y: 6 })], [SUN, RIVER]);
    expect(c.log.flatMap((e) => (e.type === 'fightModifier' ? [e.text] : []))).toEqual([
      'The noon sun: the fight is in sunlight.',
      'The river: the water here runs.',
    ]);
  });

  it('a fight in the dark plays as it always did', () => {
    const play = (modifiers?: FightModifier[]) => {
      const hero = makeCombatant({ id: 'hero', team: 'team1', position: { x: 3, y: 3 } });
      const c = new Combat({ seed: 4, mapId: 'open', combatants: [hero, monster('shadow', { x: 3, y: 6 }), monster('kobold', { x: 4, y: 6 })], ...(modifiers ? { modifiers } : {}) });
      for (let i = 0; i < 400 && !c.isOver(); i++) c.apply(chooseAction(c.state, c.activeId));
      return c.log;
    };
    expect(play([])).toEqual(play());
    expect(play([SUN])).not.toEqual(play());
  });
});
