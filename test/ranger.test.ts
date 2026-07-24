import { describe, it, expect } from 'vitest';
import { Combat } from '../src/engine/combat.js';
import { buildCharacter } from '../src/builder/character.js';
import { buildMonster } from '../src/data/monsters.js';
import { resolveAttack } from '../src/engine/rules/attack.js';
import { acOf } from '../src/data/armor.js';
import type { Combatant, Position } from '../src/engine/types.js';

function place(classId: string, team: 'team1' | 'team2', position: Position, over: Partial<Combatant> = {}): Combatant {
  const c = buildCharacter({ classId, team, position });
  return { ...c, ...over, id: over.id ?? c.id };
}

/** Advance turns until it's `id`'s turn. */
function until(c: Combat, id: string) {
  let guard = 0;
  while (c.activeId !== id && guard++ < 50) c.apply({ kind: 'endTurn' });
  expect(c.activeId).toBe(id);
}

const target = (position: Position, id: string, ac: number, hp = 999): Combatant =>
  ({ ...buildMonster('skeleton', 'team2', position), id, hp, maxHp: 999, acOverride: ac });

describe('Ranger: character builder', () => {
  it('L1: AC 15, HP 11, dex/wis stats, 2 first-level slots, longbow kit', () => {
    const r = buildCharacter({ classId: 'ranger', team: 'team1', position: { x: 0, y: 0 } });
    expect(acOf(r)).toBe(15); // studded leather 12 + dex 16 → +3
    expect(r.maxHp).toBe(11);
    expect(r.abilities.dex).toBe(16);
    expect(r.abilities.wis).toBe(16);
    expect(r.spellcastingAbility).toBe('wis');
    expect(r.spellSlots).toEqual([{ current: 2, max: 2 }]);
    expect(r.spellIds).toEqual(expect.arrayContaining(['hunters-mark', 'cure-wounds', 'animal-friendship']));
    expect(r.weaponMasteries).toEqual(expect.arrayContaining(['longbow', 'shortsword']));
    expect(r.featureIds).not.toContain('colossus-slayer');
    expect(r.equipped.mainHand).toBe('longbow');
  });

  it('L2: defaults to the Archery fighting style', () => {
    const r = buildCharacter({ classId: 'ranger', team: 'team1', position: { x: 0, y: 0 }, level: 2 });
    expect(r.featureIds).toContain('archery');
  });

  it('L3: Colossus Slayer arrives', () => {
    const r = buildCharacter({ classId: 'ranger', team: 'team1', position: { x: 0, y: 0 }, level: 3 });
    expect(r.featureIds).toContain('colossus-slayer');
  });

  it('L5: Extra Attack, second-level slots, Misty Step known', () => {
    const r = buildCharacter({ classId: 'ranger', team: 'team1', position: { x: 0, y: 0 }, level: 5 });
    expect(r.attacksPerAction).toBe(2);
    expect(r.spellSlots).toEqual([{ current: 4, max: 4 }, { current: 2, max: 2 }]);
    expect(r.spellIds).toContain('misty-step');
  });
});

describe("Ranger: Hunter's Mark", () => {
  it('casting as a bonus action marks the target and holds concentration', () => {
    const c = new Combat({
      seed: 1,
      combatants: [
        place('ranger', 'team1', { x: 0, y: 0 }, { id: 'rgr' }),
        place('fighter', 'team2', { x: 7, y: 7 }, { id: 'foe' }),
      ],
    });
    until(c, 'rgr');
    const before = c.state.combatants['rgr']!.spellSlots[0]!.current;
    c.apply({ kind: 'castSpell', spellId: 'hunters-mark', slotLevel: 1, targets: [{ combatantId: 'foe' }] });
    const rgr = c.state.combatants['rgr']!;
    const foe = c.state.combatants['foe']!;
    expect(foe.conditions.some((k) => k.id === 'marked' && k.sourceId === 'rgr')).toBe(true);
    expect(rgr.concentratingOn).toEqual({ spellId: 'hunters-mark', targetIds: ['foe'] });
    expect(rgr.spellSlots[0]!.current).toBe(before - 1);
    expect(rgr.turn.bonusActionUsed).toBe(true);
    expect(rgr.turn.actionUsed).toBe(false); // bonus action, not the action
  });

  it('adds +1d6 force to every hit against the marked target, only for its caster', () => {
    const atk = buildCharacter({ classId: 'ranger', team: 'team1', position: { x: 3, y: 3 } });
    const marked = target({ x: 4, y: 3 }, 't', 1);
    marked.conditions.push({ id: 'marked', sourceId: atk.id });
    const unmarked = target({ x: 3, y: 4 }, 'u', 1);
    const c = new Combat({ seed: 5, mapId: 'open', combatants: [atk, marked, unmarked] });

    const onMarked = resolveAttack(c.state, atk.id, 't', 'longbow');
    const dmgMarked = onMarked.find((e) => e.type === 'damageDealt');
    expect(dmgMarked).toBeDefined();
    expect((dmgMarked as { tags?: string[] }).tags).toContain("Hunter's Mark");

    const onUnmarked = resolveAttack(c.state, atk.id, 'u', 'longbow');
    const dmgUnmarked = onUnmarked.find((e) => e.type === 'damageDealt');
    expect((dmgUnmarked as { tags?: string[] }).tags ?? []).not.toContain("Hunter's Mark");
  });

  it('a mark from a different source does not fire for this attacker', () => {
    const atk = buildCharacter({ classId: 'ranger', team: 'team1', position: { x: 3, y: 3 } });
    const t = target({ x: 4, y: 3 }, 't', 1);
    t.conditions.push({ id: 'marked', sourceId: 'someone-else' });
    const c = new Combat({ seed: 2, mapId: 'open', combatants: [atk, t] });
    const events = resolveAttack(c.state, atk.id, 't', 'longbow');
    const dmg = events.find((e) => e.type === 'damageDealt');
    expect((dmg as { tags?: string[] }).tags ?? []).not.toContain("Hunter's Mark");
  });

  it('when the marked target dies, the mark auto-transfers to the nearest enemy', () => {
    const atk = buildCharacter({ classId: 'ranger', team: 'team1', position: { x: 3, y: 3 } });
    const quarry = target({ x: 4, y: 3 }, 'quarry', 1, 1);       // adjacent, one hit kills
    const near = target({ x: 3, y: 5 }, 'near', 1, 999);         // 10 ft away
    const far = target({ x: 7, y: 7 }, 'far', 1, 999);           // further out
    quarry.conditions.push({ id: 'marked', sourceId: atk.id, concentration: true });
    atk.concentratingOn = { spellId: 'hunters-mark', targetIds: ['quarry'] };
    const c = new Combat({ seed: 9, mapId: 'open', combatants: [atk, quarry, near, far] });

    // Kill the quarry (AC 1, 1 HP — any hit lands and drops it).
    const events = resolveAttack(c.state, atk.id, 'quarry', 'longbow');
    expect(events.some((e) => e.type === 'died' && e.combatantId === 'quarry')).toBe(true);

    // The mark leapt to the NEAREST living enemy, concentration intact.
    expect(c.state.combatants['near']!.conditions.some((k) => k.id === 'marked' && k.sourceId === atk.id)).toBe(true);
    expect(c.state.combatants['far']!.conditions.some((k) => k.id === 'marked')).toBe(false);
    expect(c.state.combatants[atk.id]!.concentratingOn).toEqual({ spellId: 'hunters-mark', targetIds: ['near'] });
    expect(events.some((e) => e.type === 'conditionApplied' && e.condition === 'marked' && e.combatantId === 'near')).toBe(true);

    // No slot was spent for the transfer — it's free.
    // (resolveAttack never touches slots; this documents the intent.)
    const followUp = resolveAttack(c.state, atk.id, 'near', 'longbow');
    const dmg = followUp.find((e) => e.type === 'damageDealt');
    if (dmg) expect((dmg as { tags?: string[] }).tags).toContain("Hunter's Mark");
  });

  it('killing the last enemy ends cleanly — no transfer target, fight over', () => {
    const atk = buildCharacter({ classId: 'ranger', team: 'team1', position: { x: 3, y: 3 } });
    const quarry = target({ x: 4, y: 3 }, 'quarry', 1, 1);
    quarry.conditions.push({ id: 'marked', sourceId: atk.id, concentration: true });
    atk.concentratingOn = { spellId: 'hunters-mark', targetIds: ['quarry'] };
    const c = new Combat({ seed: 11, mapId: 'open', combatants: [atk, quarry] });

    const events = resolveAttack(c.state, atk.id, 'quarry', 'longbow');
    expect(events.some((e) => e.type === 'died')).toBe(true);
    expect(events.some((e) => e.type === 'combatEnded')).toBe(true);
    // Concentration still nominally points at the dead quarry; harmless — the
    // fight is over. What matters is no crash and no phantom mark anywhere.
    for (const cb of Object.values(c.state.combatants)) {
      if (cb.id !== 'quarry') expect(cb.conditions.some((k) => k.id === 'marked')).toBe(false);
    }
  });

  it('recasting on a new target breaks concentration and moves the mark', () => {
    const c = new Combat({
      seed: 3,
      combatants: [
        place('ranger', 'team1', { x: 0, y: 0 }, { id: 'rgr' }),
        place('fighter', 'team2', { x: 1, y: 0 }, { id: 'foe1' }),
        place('fighter', 'team2', { x: 7, y: 7 }, { id: 'foe2' }),
      ],
    });
    until(c, 'rgr');
    c.apply({ kind: 'castSpell', spellId: 'hunters-mark', slotLevel: 1, targets: [{ combatantId: 'foe1' }] });
    // Bonus action is spent; end the turn and come back around to cast again.
    c.apply({ kind: 'endTurn' });
    until(c, 'rgr');
    c.apply({ kind: 'castSpell', spellId: 'hunters-mark', slotLevel: 1, targets: [{ combatantId: 'foe2' }] });
    expect(c.state.combatants['foe1']!.conditions.some((k) => k.id === 'marked')).toBe(false);
    expect(c.state.combatants['foe2']!.conditions.some((k) => k.id === 'marked' && k.sourceId === 'rgr')).toBe(true);
    expect(c.state.combatants['rgr']!.concentratingOn).toEqual({ spellId: 'hunters-mark', targetIds: ['foe2'] });
  });
});

describe("Ranger: Colossus Slayer", () => {
  it('adds +1d8 once per turn against a target below its HP max, never against a full-health one', () => {
    const atk = buildCharacter({ classId: 'ranger', team: 'team1', position: { x: 3, y: 3 }, level: 3 });
    const wounded = target({ x: 4, y: 3 }, 'w', 1, 5);
    const full = target({ x: 3, y: 4 }, 'f', 1, 999);
    const c = new Combat({ seed: 7, mapId: 'open', combatants: [atk, wounded, full] });

    // First hit this turn against a wounded target: the bonus fires.
    const first = resolveAttack(c.state, atk.id, 'w', 'longbow');
    const dmg1 = first.find((e) => e.type === 'damageDealt');
    expect((dmg1 as { tags?: string[] }).tags).toContain('Colossus Slayer');
    expect(c.state.combatants[atk.id]!.turn.colossusUsed).toBe(true);

    // A second hit the same turn, even against another wounded target, does not.
    const second = resolveAttack(c.state, atk.id, 'w', 'longbow');
    const dmg2 = second.find((e) => e.type === 'damageDealt');
    expect((dmg2 as { tags?: string[] }).tags ?? []).not.toContain('Colossus Slayer');
  });

  it('does not fire against a target at full HP', () => {
    const atk = buildCharacter({ classId: 'ranger', team: 'team1', position: { x: 3, y: 3 }, level: 3 });
    const full = target({ x: 4, y: 3 }, 'f', 1, 999);
    const c = new Combat({ seed: 8, mapId: 'open', combatants: [atk, full] });
    const events = resolveAttack(c.state, atk.id, 'f', 'longbow');
    const dmg = events.find((e) => e.type === 'damageDealt');
    expect((dmg as { tags?: string[] }).tags ?? []).not.toContain('Colossus Slayer');
  });
});
