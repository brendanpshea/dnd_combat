import { describe, it, expect } from 'vitest';
import { Combat } from '../src/engine/combat.js';
import { buildCharacter } from '../src/builder/character.js';
import { buildMonster } from '../src/data/monsters.js';
import { applyDamage, resolveAttack, collectAttackSources } from '../src/engine/rules/attack.js';
import { applyCondition } from '../src/engine/rules/conditions.js';
import { moveDestinations } from '../src/engine/rules/movement.js';
import { WEAPONS } from '../src/data/weapons.js';
import { seedRng } from '../src/engine/rng.js';
import { makeCombatant } from './helpers.js';
import type { Combatant, GameState, Position } from '../src/engine/types.js';

/** The smaller SRD 5.2.1 rules, each against its text. */

const hero = (position: Position, id: string, over: Partial<Combatant> = {}): Combatant =>
  ({ ...buildCharacter({ classId: 'fighter', team: 'team1', position, level: 5 }), id, ...over });
const dummy = (position: Position, id: string, over: Partial<Combatant> = {}): Combatant =>
  ({ ...buildMonster('skeleton', 'team2', position), id, hp: 999, maxHp: 999, acOverride: 1, vulnerabilities: [], ...over });

describe('Damage Rolls (line 794): a penalty can bring damage to 0', () => {
  it('a feeble punch deals nothing rather than 1', () => {
    const weak = hero({ x: 3, y: 3 }, 'h', { abilities: { str: 1, dex: 10, con: 10, int: 10, wis: 10, cha: 10 } });
    const c = new Combat({ seed: 1, width: 8, height: 8, combatants: [weak, dummy({ x: 4, y: 3 }, 'd')] });
    const hit = resolveAttack(c.state, 'h', 'd', 'unarmed-strike').find((e) => e.type === 'damageDealt');
    expect(hit?.type === 'damageDealt' && hit.amount).toBe(0);
  });
});

describe('Order of Application (line 817): resistance, then vulnerability', () => {
  it('a creature resistant and vulnerable to a type takes it halved and doubled', () => {
    const c = new Combat({ seed: 1, width: 8, height: 8, combatants: [
      hero({ x: 0, y: 0 }, 'h'), dummy({ x: 5, y: 5 }, 'd', { resistances: ['fire'], vulnerabilities: ['fire'] }),
    ] });
    applyDamage(c.state, 'd', 'h', 11, 'fire', [], { magical: true });
    expect(999 - c.state.combatants['d']!.hp).toBe(10);
  });
});

describe('within 5 feet', () => {
  const reachy = (over: Partial<Combatant> = {}) => hero({ x: 3, y: 3 }, 'h', { featureIds: ['long-limbed'], ...over });

  it('a paralyzed target is crit only by an attacker within 5 feet', () => {
    for (const [x, crits] of [[4, true], [5, false]] as const) {
      const c = new Combat({ seed: 1, width: 8, height: 8, combatants: [reachy(), dummy({ x, y: 3 }, 'd')] });
      applyCondition(c.state, 'd', { id: 'paralyzed', sourceId: 'h' }, { magical: true });
      let seen = false;
      for (let seed = 1; seed < 40 && !seen; seed++) {
        const s: GameState = structuredClone(c.state);
        s.rng = seedRng(seed);
        const roll = resolveAttack(s, 'h', 'd', s.combatants['h']!.equipped.mainHand!).find((e) => e.type === 'attackRolled');
        if (roll?.type !== 'attackRolled' || !roll.hit || roll.natural === 20) continue;
        seen = true;
        expect(roll.crit, `at ${x - 3} squares`).toBe(crits);
      }
      expect(seen).toBe(true);
    }
  });

  it('a prone target is easier only within 5 feet — at reach it is harder', () => {
    const c = new Combat({ seed: 1, width: 8, height: 8, combatants: [reachy(), dummy({ x: 5, y: 3 }, 'd')] });
    applyCondition(c.state, 'd', { id: 'prone', sourceId: 'h' }, { magical: false });
    const w = WEAPONS[c.state.combatants['h']!.equipped.mainHand!]!;
    const { adv, dis } = collectAttackSources(c.state, c.state.combatants['h']!, c.state.combatants['d']!, w, true);
    expect(adv).not.toContain('target prone');
    expect(dis.some((s) => s.startsWith('target prone'))).toBe(true);
  });

  it('only an enemy within 5 feet who can act hampers a shot', () => {
    const shooter = hero({ x: 0, y: 3 }, 'h', { equipped: { mainHand: 'longbow', armor: 'leather' } });
    const far = new Combat({ seed: 1, width: 8, height: 8, combatants: [shooter, dummy({ x: 7, y: 3 }, 'd'), { ...dummy({ x: 2, y: 3 }, 'g'), featureIds: ['long-limbed'] }] });
    const bow = WEAPONS['longbow']!;
    const src = (c: Combat) => collectAttackSources(c.state, c.state.combatants['h']!, c.state.combatants['d']!, bow, false).dis;
    expect(src(far), 'a reach of ten feet is not within five').not.toContain('enemy adjacent');
    const near = new Combat({ seed: 1, width: 8, height: 8, combatants: [shooter, dummy({ x: 7, y: 3 }, 'd'), dummy({ x: 1, y: 3 }, 'g')] });
    expect(src(near)).toContain('enemy adjacent');
    applyCondition(near.state, 'g', { id: 'stunned', sourceId: 'h' }, { magical: true });
    expect(src(near), 'a stunned neighbour does not').not.toContain('enemy adjacent');
  });
});

describe('Corners (line 636): no diagonal step across a wall\'s corner', () => {
  it('goes round the corner instead of through it', () => {
    const c = new Combat({ seed: 1, width: 5, height: 5, combatants: [
      makeCombatant({ id: 'a', team: 'team1', position: { x: 1, y: 1 }, speed: 5 }),
      makeCombatant({ id: 'b', team: 'team2', position: { x: 4, y: 4 } }),
    ] });
    c.state.grid.cells[1 * 5 + 2]!.terrain = 'wall';   // (2,1), beside the mover
    const a = c.state.combatants['a']!;
    a.turn.movementMax = 5;
    a.turn.movementUsed = 0;
    const dests = moveDestinations(c.state, a);
    expect(dests.some((p) => p.x === 2 && p.y === 2), 'cut the corner of the wall at (2,1)').toBe(false);
    expect(dests.some((p) => p.x === 1 && p.y === 2)).toBe(true);
  });
});
