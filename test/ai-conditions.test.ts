import { describe, it, expect } from 'vitest';
import { Combat } from '../src/engine/combat.js';
import { buildCharacter } from '../src/builder/character.js';
import { buildMonster } from '../src/data/monsters.js';
import { generateArenaMap } from '../src/arena/map.js';
import { deployFoes } from '../src/arena/deploy.js';
import { parseMap } from '../src/data/maps.js';
import { chooseActionSim, SIM_PRESETS } from '../src/ai/simulated.js';
import { evaluate } from '../src/ai/evaluate.js';
import type { ConditionId } from '../src/engine/types.js';

/**
 * A condition the evaluator prices at zero is a mechanic the simulation AI
 * cannot see, and it fails silently: the spell is simply never chosen, the
 * stat block or class list looks fine, and nothing anywhere reports a problem.
 *
 * `restrained` was the worst case. Attacks against a restrained creature get
 * advantage, its own attacks get disadvantage, and turn.ts zeroes its speed —
 * and five separate things apply it. Priced at nothing, Web was cast 0 times in
 * 60 fights, Entangle 0, Ensnaring Strike 0. Weighted, they were cast 37, 63
 * and 104 times across the same sweeps.
 */
describe('the AI can see what conditions do', () => {
  it('prices a restrained creature below a blinded one', () => {
    // Restrained is blinded's advantage/disadvantage pair PLUS no movement at
    // all, so it must be strictly the heavier of the two.
    const foe = (conds: ConditionId[]) => {
      const m = { ...buildMonster('ogre', 'team2', { x: 5, y: 5 }), id: 'foe' };
      m.conditions = conds.map((id) => ({ id, sourceId: 'hero' }));
      return m;
    };
    const hero = { ...buildCharacter({ classId: 'wizard', team: 'team1', position: { x: 1, y: 1 }, level: 3 }), id: 'hero' };
    const v = (conds: ConditionId[]) =>
      evaluate(new Combat({ seed: 1, width: 8, height: 8, combatants: [hero, foe(conds)] }).state, 'team1');
    expect(v(['restrained'])).toBeGreaterThan(v(['blinded']));
    expect(v(['blinded'])).toBeGreaterThan(v([]));
    // And a turn taken outright is heavier again.
    expect(v(['commanded'])).toBeGreaterThan(v(['restrained']));
  });

  it('actually casts the spells that restrain', () => {
    // A druid and a ranger, whose signature control is Entangle and Ensnaring
    // Strike. Both were dead data before: the AI never once chose either.
    const cast = new Set<string>();
    for (let seed = 1; seed <= 10; seed++) {
      const m = generateArenaMap({}, (seed * 2654435761) >>> 0);
      const grid = parseMap(m.value.map);
      const party = ['druid', 'ranger', 'wizard', 'cleric'].map((classId, i) => ({
        ...buildCharacter({ classId, team: 'team1' as const, position: { x: i + 1, y: 0 }, level: 5 }),
        id: `h${i}`,
      }));
      const spots = deployFoes(grid, 3, seed);
      const foes = ['orc', 'orc', 'ogre'].map((id, i) => ({
        ...buildMonster(id, 'team2', spots.value.positions[i]!), id: `m${i}`,
      }));
      const c = new Combat({ seed, map: m.value.map, combatants: [...party, ...foes] });
      for (let i = 0; i < 1200 && !c.isOver(); i++) {
        const a = chooseActionSim(c.state, c.activeId, SIM_PRESETS.normal);
        if (a.kind === 'castSpell' && c.state.combatants[c.activeId]!.team === 'team1') cast.add(a.spellId);
        c.apply(a);
      }
    }
    const restrainers = ['entangle', 'ensnaring-strike'].filter((s) => cast.has(s));
    expect(restrainers.length, `no restraining spell was ever cast; saw ${[...cast].join(', ')}`)
      .toBeGreaterThan(0);
  }, 30000);
});
