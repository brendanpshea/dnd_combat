import { describe, it, expect } from 'vitest';
import { Combat } from '../src/engine/combat.js';
import { legalActions, step, type Action } from '../src/engine/actions.js';
import { collectAttackSources, canAttackWith } from '../src/engine/rules/attack.js';
import { grapple, applyCondition } from '../src/engine/rules/conditions.js';
import { cellAt } from '../src/engine/types.js';
import { executeMove } from '../src/engine/rules/movement.js';
import { WEAPONS } from '../src/data/weapons.js';
import { makeCombatant } from './helpers.js';

/**
 * Grappling, SRD 5.2.1: speed 0, disadvantage on attacks against anyone but
 * the grappler, an action and an Athletics/Acrobatics check to escape, and it
 * ends when the grappler is incapacitated or out of range.
 */
function fight(seed = 1) {
  const g = makeCombatant({
    id: 'g', team: 'team1', position: { x: 2, y: 2 },
    abilities: { str: 20, dex: 10, con: 14, int: 10, wis: 10, cha: 10 },
    equipped: { mainHand: 'longsword' },
  });
  const t = makeCombatant({ id: 't', team: 'team2', position: { x: 3, y: 2 } });
  const other = makeCombatant({ id: 'o', team: 'team1', position: { x: 5, y: 5 } });
  const c = new Combat({ seed, mapId: 'open', combatants: [g, t, other] });
  for (let i = 0; c.activeId !== 'g' && i < 6; i++) c.apply({ kind: 'endTurn' });
  return c;
}
const grappled = (c: Combat, id = 't') =>
  c.state.combatants[id]!.conditions.some((k) => k.id === 'grappled');

describe('grappling', () => {
  it('is offered as an Unarmed Strike option, and holds on a won contest', () => {
    let held = false;
    for (let seed = 1; seed <= 20 && !held; seed++) {
      const c = fight(seed);
      const a = legalActions(c.state, 'g').find((x) => x.kind === 'shove' && x.mode === 'grapple');
      expect(a, 'Grapple is not offered').toBeDefined();
      const after = step(c.state, a!).state;
      const k = after.combatants['t']!.conditions.find((x) => x.id === 'grappled');
      if (!k) continue;
      held = true;
      // 8 + Strength (+5) + proficiency (+2 at level 1).
      expect(k.escape?.dc).toBe(15);
      expect(k.sourceId).toBe('g');
    }
    expect(held, 'twenty grapples all failed').toBe(true);
  });

  it('needs a hand free', () => {
    const c = fight();
    c.state.combatants['g']!.equipped.offHand = 'shield';
    expect(legalActions(c.state, 'g').some((x) => x.kind === 'shove' && x.mode === 'grapple')).toBe(false);
  });

  it('sets speed to 0, and costs attacks against anyone but the grappler', () => {
    const c = fight();
    grapple(c.state, 'g', 't', { dc: 15, via: 'unarmed', range: 5 });
    const t = c.state.combatants['t']!;
    const w = WEAPONS['longsword']!;
    expect(collectAttackSources(c.state, t, c.state.combatants['o']!, w, true).dis).toContain('attacker grappled');
    expect(collectAttackSources(c.state, t, c.state.combatants['g']!, w, true).dis).not.toContain('attacker grappled');
    c.apply({ kind: 'endTurn' });                      // the held creature's turn
    expect(c.activeId).toBe('t');
    expect(c.state.combatants['t']!.turn.movementMax).toBe(0);
  });

  it('ends when the grappler walks out of range', () => {
    const c = fight();
    grapple(c.state, 'g', 't', { dc: 15, via: 'unarmed', range: 5 });
    const away: Action = { kind: 'move', to: { x: 0, y: 2 } };
    const after = step(c.state, away).state;
    expect(after.combatants['t']!.conditions.some((k) => k.id === 'grappled')).toBe(false);
  });

  it('ends when the grappler is incapacitated', () => {
    const c = fight();
    grapple(c.state, 'g', 't', { dc: 15, via: 'unarmed', range: 5 });
    applyCondition(c.state, 'g', { id: 'stunned' }, { magical: false });
    c.apply({ kind: 'endTurn' });
    expect(grappled(c)).toBe(false);
  });

  it('can be broken with an action, and a restraint riding on it goes too', () => {
    let freed = false;
    for (let seed = 1; seed <= 30 && !freed; seed++) {
      const c = fight(seed);
      grapple(c.state, 'g', 't', { dc: 5, via: 'longsword', range: 5, restrains: true });
      c.apply({ kind: 'endTurn' });
      expect(c.activeId).toBe('t');
      const esc = legalActions(c.state, 't').find((x) => x.kind === 'escape');
      expect(esc, 'no Escape offered').toBeDefined();
      c.apply(esc!);
      if (grappled(c)) continue;
      freed = true;
      expect(c.state.combatants['t']!.conditions.some((k) => k.id === 'restrained'),
        'the restraint outlived its grapple').toBe(false);
    }
    expect(freed).toBe(true);
  });

  it('holds one creature per limb, which cannot attack anyone else meanwhile', () => {
    const c = fight();
    const extra = makeCombatant({ id: 'x', team: 'team2', position: { x: 2, y: 3 } });
    c.state.combatants['x'] = extra;
    cellAt(c.state.grid, extra.position)!.occupantId = 'x';
    grapple(c.state, 'g', 't', { dc: 15, via: 'longsword', range: 5 });
    const g = c.state.combatants['g']!;
    expect(canAttackWith(c.state, g, 'longsword', 't')).toBe(true);
    expect(canAttackWith(c.state, g, 'longsword', 'x')).toBe(false);
  });
});

describe('restraints you break with an action', () => {
  it('a web holds until an Athletics check, not a save every turn', () => {
    const c = fight();
    cellAt(c.state.grid, { x: 1, y: 2 })!.web = { sourceId: 't', dc: 99 };
    executeMove(c.state, 'g', { x: 1, y: 2 });
    const k = c.state.combatants['g']!.conditions.find((x) => x.id === 'restrained');
    expect(k?.escape).toEqual({ dc: 99, skills: ['athletics'] });
    expect(k?.repeatSave).toBeUndefined();
  });
});
