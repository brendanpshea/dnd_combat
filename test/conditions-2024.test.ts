import { describe, it, expect } from 'vitest';
import { Combat } from '../src/engine/combat.js';
import { savingThrow } from '../src/engine/rules/saves.js';
import { collectAttackSources } from '../src/engine/rules/attack.js';
import { applyCondition } from '../src/engine/rules/conditions.js';
import { legalActions } from '../src/engine/actions.js';
import { seedRng } from '../src/engine/rng.js';
import { WEAPONS } from '../src/data/weapons.js';
import { makeCombatant } from './helpers.js';
import type { ActiveCondition, GameState } from '../src/engine/types.js';

/**
 * SRD 5.2.1 condition and action text the engine had wrong or missing:
 * Stunned (line 14084), Dodge (13728), Incapacitated (13823), Frightened
 * (13763).
 */

function pair(): Combat {
  return new Combat({
    seed: 1, width: 8, height: 8,
    combatants: [
      makeCombatant({ id: 'a', team: 'team1', position: { x: 1, y: 1 } }),
      makeCombatant({ id: 'b', team: 'team2', position: { x: 5, y: 5 } }),
    ],
  });
}

const give = (state: GameState, id: string, cond: ActiveCondition) =>
  applyCondition(state, id, cond, { magical: true });

const saveRate = (setup: (s: GameState) => void, ability: 'dex' | 'wis' = 'dex', dc = 14): number => {
  let ok = 0;
  for (let seed = 1; seed <= 400; seed++) {
    const c = pair();
    setup(c.state);
    c.state.rng = seedRng(seed);
    if (savingThrow(c.state, 'a', ability, dc, { magical: false }).success) ok++;
  }
  return ok / 400;
};

const turnOf = (c: Combat, id: string) => {
  let guard = 0;
  while (c.activeId !== id && guard++ < 10) c.apply({ kind: 'endTurn' });
};

describe('Stunned', () => {
  it('fails Strength and Dexterity saves outright', () => {
    expect(saveRate((s) => give(s, 'a', { id: 'stunned', sourceId: 'b' }), 'dex', 2)).toBe(0);
    expect(saveRate((s) => give(s, 'a', { id: 'stunned', sourceId: 'b' }), 'wis', 2)).toBeGreaterThan(0.9);
  });

  it('takes the actions, not the legs', () => {
    const c = pair();
    turnOf(c, 'a');
    give(c.state, 'a', { id: 'stunned', sourceId: 'b' });
    c.apply({ kind: 'endTurn' });
    turnOf(c, 'a');
    const kinds = new Set(legalActions(c.state, 'a').map((x) => x.kind));
    expect(kinds.has('move')).toBe(true);
    expect(kinds.has('attack') || kinds.has('dash') || kinds.has('dodge')).toBe(false);
  });
});

describe('Incapacitated alone leaves Speed; Paralyzed and Hypnotic Pattern do not', () => {
  const movesWith = (cond: ActiveCondition) => {
    const c = pair();
    turnOf(c, 'b');
    give(c.state, 'a', cond);
    c.apply({ kind: 'endTurn' });
    turnOf(c, 'a');
    return legalActions(c.state, 'a').some((x) => x.kind === 'move');
  };
  it('Sleep\'s first stage can walk', () => {
    expect(movesWith({ id: 'incapacitated', sourceId: 'b', repeatSave: { ability: 'wis', dc: 30 } })).toBe(true);
  });
  it('a Hypnotic Pattern holds it still', () => {
    expect(movesWith({ id: 'incapacitated', sourceId: 'b', endsOnDamage: true })).toBe(false);
  });
  it('paralysis holds it still', () => {
    expect(movesWith({ id: 'paralyzed', sourceId: 'b', repeatSave: { ability: 'wis', dc: 30 } })).toBe(false);
  });
});

describe('Dodge', () => {
  it('gives advantage on Dexterity saves', () => {
    const plain = saveRate(() => {});
    const dodging = saveRate((s) => give(s, 'a', { id: 'dodging' }));
    expect(dodging).toBeGreaterThan(plain + 0.1);
  });

  it('is lost while incapacitated or held at Speed 0', () => {
    const plain = saveRate(() => {});
    const held = saveRate((s) => { give(s, 'a', { id: 'dodging' }); give(s, 'a', { id: 'grappled', sourceId: 'b' }); });
    expect(Math.abs(held - plain)).toBeLessThan(0.05);
    const c = pair();
    give(c.state, 'b', { id: 'dodging' });
    give(c.state, 'b', { id: 'incapacitated', sourceId: 'a' });
    const { dis } = collectAttackSources(c.state, c.state.combatants['a']!, c.state.combatants['b']!, WEAPONS['longsword']!, true);
    expect(dis).not.toContain('target dodging');
  });
});

describe('Frightened', () => {
  it('rattles attacks only while the source is in sight', () => {
    const c = new Combat({
      seed: 1, width: 8, height: 8,
      combatants: [
        makeCombatant({ id: 'a', team: 'team1', position: { x: 0, y: 0 } }),
        makeCombatant({ id: 'b', team: 'team2', position: { x: 1, y: 0 } }),
        makeCombatant({ id: 'src', team: 'team2', position: { x: 0, y: 4 } }),
      ],
    });
    give(c.state, 'a', { id: 'frightened', sourceId: 'src' });
    const a = c.state.combatants['a']!, b = c.state.combatants['b']!;
    const rattled = () => collectAttackSources(c.state, a, b, WEAPONS['longsword']!, true).dis.includes('attacker frightened');
    expect(rattled()).toBe(true);
    // A wall across the column between them: out of sight, out of mind.
    for (let x = 0; x < 8; x++) c.state.grid.cells[2 * 8 + x]!.terrain = 'wall';
    expect(rattled()).toBe(false);
  });

  it('cannot walk closer to the source', () => {
    const c = pair();
    turnOf(c, 'a');
    give(c.state, 'a', { id: 'frightened', sourceId: 'b' });
    const near = (p: { x: number; y: number }) => Math.max(Math.abs(p.x - 5), Math.abs(p.y - 5));
    const moves = legalActions(c.state, 'a').filter((x) => x.kind === 'move') as Array<{ to: { x: number; y: number } }>;
    expect(moves.length).toBeGreaterThan(0);
    expect(moves.every((m) => near(m.to) >= near({ x: 1, y: 1 }))).toBe(true);
  });
});
