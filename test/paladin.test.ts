import { describe, it, expect } from 'vitest';
import { Combat } from '../src/engine/combat.js';
import { buildCharacter } from '../src/builder/character.js';
import { buildMonster } from '../src/data/monsters.js';
import { resolveAttack } from '../src/engine/rules/attack.js';
import { acOf } from '../src/data/armor.js';
import { abilityMod } from '../src/engine/types.js';
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

describe('Paladin: character builder', () => {
  it('L1: AC 18, HP 11, str/cha stats, Lay on Hands pool of 5', () => {
    const p = buildCharacter({ classId: 'paladin', team: 'team1', position: { x: 0, y: 0 } });
    expect(acOf(p)).toBe(18); // chain mail 16 + shield 2 (heavy: no dex)
    expect(p.maxHp).toBe(11);
    expect(p.abilities.str).toBe(16);
    expect(p.abilities.cha).toBe(16);
    expect(p.spellcastingAbility).toBe('cha');
    expect(p.spellSlots).toEqual([{ current: 2, max: 2 }]);
    expect(p.spellIds).toEqual(expect.arrayContaining(['bless', 'cure-wounds', 'command']));
    expect(p.featureIds).toContain('lay-on-hands');
    expect(p.featureUses['lay-on-hands']).toEqual({ current: 5, max: 5 });
    expect(p.featureIds).not.toContain('divine-smite');
  });

  it('L2: Divine Smite arrives, defaults to the Defense fighting style', () => {
    const p = buildCharacter({ classId: 'paladin', team: 'team1', position: { x: 0, y: 0 }, level: 2 });
    expect(p.featureIds).toContain('divine-smite');
    expect(p.featureIds).toContain('defense');
    expect(p.featureUses['lay-on-hands']).toEqual({ current: 10, max: 10 });
  });

  it('L3: Sacred Weapon (Devotion Channel Divinity) arrives', () => {
    const p = buildCharacter({ classId: 'paladin', team: 'team1', position: { x: 0, y: 0 }, level: 3 });
    expect(p.featureIds).toContain('sacred-weapon');
    expect(p.featureUses['sacred-weapon']).toEqual({ current: 1, max: 1 });
  });

  it('L5: Extra Attack, second-level slots, Aid known', () => {
    const p = buildCharacter({ classId: 'paladin', team: 'team1', position: { x: 0, y: 0 }, level: 5 });
    expect(p.attacksPerAction).toBe(2);
    expect(p.spellSlots).toEqual([{ current: 4, max: 4 }, { current: 2, max: 2 }]);
    expect(p.spellIds).toContain('aid');
  });
});

describe('Paladin: Lay on Hands', () => {
  it('heals the most-wounded ally within touch range, spending only what it needs', () => {
    // Level 5 for a 25-point pool, comfortably above the 15 missing HP tested.
    const pal = { ...buildCharacter({ classId: 'paladin', team: 'team1', position: { x: 3, y: 3 }, level: 5 }), id: 'pal' };
    const ally = place('fighter', 'team1', { x: 4, y: 3 }, { id: 'ally', hp: 5, maxHp: 20 });
    const c = new Combat({ seed: 1, mapId: 'open', combatants: [pal, ally, target({ x: 7, y: 7 }, 'foe', 15)] });
    until(c, 'pal');
    const before = c.state.combatants['pal']!.featureUses['lay-on-hands']!.current;
    const events = c.apply({ kind: 'useFeature', featureId: 'lay-on-hands' });
    const healed = events.find((e) => e.type === 'healed');
    expect(healed).toBeDefined();
    expect((healed as { amount: number }).amount).toBe(15); // missing HP, not the whole pool
    expect(c.state.combatants['ally']!.hp).toBe(20);
    expect(c.state.combatants['pal']!.featureUses['lay-on-hands']!.current).toBe(before - 15);
    expect(c.state.combatants['pal']!.turn.actionUsed).toBe(true);
  });

  it('revives a downed ally', () => {
    const pal = place('paladin', 'team1', { x: 3, y: 3 }, { id: 'pal' });
    const downed = place('fighter', 'team1', { x: 3, y: 4 }, {
      id: 'ally', hp: 0, maxHp: 13,
      conditions: [{ id: 'unconscious', sourceId: 'ally' }, { id: 'prone', sourceId: 'ally' }],
    });
    const c = new Combat({ seed: 2, mapId: 'open', combatants: [pal, downed, target({ x: 7, y: 7 }, 'foe', 15)] });
    until(c, 'pal');
    const events = c.apply({ kind: 'useFeature', featureId: 'lay-on-hands' });
    expect(events.some((e) => e.type === 'revived')).toBe(true);
    expect(c.state.combatants['ally']!.hp).toBeGreaterThan(0);
    expect(c.state.combatants['ally']!.conditions.some((k) => k.id === 'unconscious')).toBe(false);
  });

  it('does nothing (and spends nothing) with no one in range to heal', () => {
    const pal = place('paladin', 'team1', { x: 0, y: 0 }, { id: 'pal' });
    const farAlly = place('fighter', 'team1', { x: 7, y: 6 }, { id: 'ally', hp: 1, maxHp: 13 });
    const c = new Combat({ seed: 3, mapId: 'open', combatants: [pal, farAlly, target({ x: 7, y: 7 }, 'foe', 15)] });
    until(c, 'pal');
    const before = c.state.combatants['pal']!.featureUses['lay-on-hands']!.current;
    const events = c.apply({ kind: 'useFeature', featureId: 'lay-on-hands' });
    expect(events.some((e) => e.type === 'healed')).toBe(false);
    expect(c.state.combatants['pal']!.featureUses['lay-on-hands']!.current).toBe(before);
  });

  it('a single activation never spends more than the pool holds, even against a huge deficit', () => {
    const pal = { ...buildCharacter({ classId: 'paladin', team: 'team1', position: { x: 3, y: 3 }, level: 2 }), id: 'pal' };
    const ally = place('fighter', 'team1', { x: 4, y: 3 }, { id: 'ally', hp: 0, maxHp: 100 });
    const c = new Combat({
      seed: 4, mapId: 'open',
      combatants: [pal, ally, target({ x: 7, y: 7 }, 'foe', 15)],
    });
    until(c, 'pal');
    const events = c.apply({ kind: 'useFeature', featureId: 'lay-on-hands' });
    const healed = events.find((e) => e.type === 'healed');
    expect((healed as { amount: number }).amount).toBe(10); // capped at 5 x level 2, not the 100 missing
    expect(c.state.combatants['pal']!.featureUses['lay-on-hands']!.current).toBe(0);
  });
});

describe('Paladin: Divine Smite', () => {
  it('auto-fires on a melee hit, consuming the lowest slot and the bonus action', () => {
    const atk = buildCharacter({ classId: 'paladin', team: 'team1', position: { x: 3, y: 3 }, level: 2 });
    const foe = target({ x: 4, y: 3 }, 'foe', 1); // AC 1 → always hits
    const c = new Combat({ seed: 1, mapId: 'open', combatants: [atk, foe] });
    const slotsBefore = c.state.combatants[atk.id]!.spellSlots[0]!.current;

    const events = resolveAttack(c.state, atk.id, 'foe', 'longsword');
    const smite = events.find((e) => e.type === 'damageDealt' && (e as { tags?: string[] }).tags?.includes('Divine Smite'));
    expect(smite).toBeDefined();
    expect((smite as { damageType: string }).damageType).toBe('radiant');
    expect(c.state.combatants[atk.id]!.spellSlots[0]!.current).toBe(slotsBefore - 1);
    expect(c.state.combatants[atk.id]!.turn.bonusActionUsed).toBe(true);
  });

  it('fires at most once per turn', () => {
    const atk = buildCharacter({ classId: 'paladin', team: 'team1', position: { x: 3, y: 3 }, level: 2 });
    const foe = target({ x: 4, y: 3 }, 'foe', 1);
    const c = new Combat({ seed: 6, mapId: 'open', combatants: [atk, foe] });
    resolveAttack(c.state, atk.id, 'foe', 'longsword');
    const slotsAfterFirst = c.state.combatants[atk.id]!.spellSlots[0]!.current;
    const second = resolveAttack(c.state, atk.id, 'foe', 'longsword');
    const smite2 = second.find((e) => e.type === 'damageDealt' && (e as { tags?: string[] }).tags?.includes('Divine Smite'));
    expect(smite2).toBeUndefined();
    expect(c.state.combatants[atk.id]!.spellSlots[0]!.current).toBe(slotsAfterFirst);
  });

  it('does not fire on a ranged attack', () => {
    const atk = buildCharacter({
      classId: 'paladin', team: 'team1', position: { x: 0, y: 0 }, level: 2,
      inventory: [{ itemId: 'shortbow', qty: 1 }],
      equipped: { mainHand: 'shortbow' },
    });
    const foe = target({ x: 7, y: 7 }, 'foe', 1);
    const c = new Combat({ seed: 9, mapId: 'open', combatants: [atk, foe] });
    const events = resolveAttack(c.state, atk.id, 'foe', 'shortbow');
    const smite = events.find((e) => e.type === 'damageDealt' && (e as { tags?: string[] }).tags?.includes('Divine Smite'));
    expect(smite).toBeUndefined();
    expect(c.state.combatants[atk.id]!.spellSlots[0]!.current).toBe(2);
  });

  it('does not fire once every slot is spent', () => {
    const atk = buildCharacter({ classId: 'paladin', team: 'team1', position: { x: 3, y: 3 }, level: 2 });
    atk.spellSlots = atk.spellSlots.map((s) => ({ ...s, current: 0 }));
    const foe = target({ x: 4, y: 3 }, 'foe', 1);
    const c = new Combat({ seed: 11, mapId: 'open', combatants: [atk, foe] });
    const events = resolveAttack(c.state, atk.id, 'foe', 'longsword');
    const smite = events.find((e) => e.type === 'damageDealt' && (e as { tags?: string[] }).tags?.includes('Divine Smite'));
    expect(smite).toBeUndefined();
  });
});

describe('Paladin: Sacred Weapon', () => {
  it('adds Charisma to the attack roll once activated, and can only be used once', () => {
    const pal = buildCharacter({ classId: 'paladin', team: 'team1', position: { x: 3, y: 3 }, level: 3 });
    const foe = target({ x: 4, y: 3 }, 'foe', 15);
    const c = new Combat({ seed: 1, mapId: 'open', combatants: [{ ...pal, id: 'pal' }, foe] });
    until(c, 'pal');

    const before = resolveAttack(c.state, 'pal', 'foe', 'longsword');
    const totalBefore = (before.find((e) => e.type === 'attackRolled') as { total: number }).total;

    c.apply({ kind: 'useFeature', featureId: 'sacred-weapon' });
    expect(c.state.combatants['pal']!.conditions.some((k) => k.id === 'sacredWeapon')).toBe(true);
    expect(c.legalActions().some((a) => a.kind === 'useFeature' && a.featureId === 'sacred-weapon')).toBe(false);

    // Same natural roll (deterministic rng continues from where it left off);
    // isolate the +Cha by re-rolling attack math on an identical fresh state.
    const pal2 = { ...buildCharacter({ classId: 'paladin', team: 'team1', position: { x: 3, y: 3 }, level: 3 }), id: 'pal2' };
    const withSacred = { ...pal2, conditions: [{ id: 'sacredWeapon' as const, sourceId: 'pal2' }] };
    const foe2 = target({ x: 4, y: 3 }, 'foe2', 15);
    const c2 = new Combat({ seed: 1, mapId: 'open', combatants: [withSacred, foe2] });
    const after = resolveAttack(c2.state, 'pal2', 'foe2', 'longsword');
    const totalAfter = (after.find((e) => e.type === 'attackRolled') as { total: number }).total;

    expect(totalAfter - totalBefore).toBe(abilityMod(pal.abilities.cha));
  });
});
