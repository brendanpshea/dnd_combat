/**
 * The monk.
 *
 * The class that could not be built until feature pools had clocks. Focus
 * Points are a per-level pool that refills on a SHORT rest, and all three
 * techniques spend from it — a pool that came back every fight would make
 * Flurry of Blows a free bonus action forever, which is the whole class.
 *
 * The shared pool is what most of these tests are about. Three buttons and one
 * budget is the decision the monk is made of, and the failure that would be
 * silent is any one of them forgetting to pay.
 */
import { describe, it, expect } from 'vitest';
import { buildCharacter } from '../src/builder/character.js';
import { buildMonster } from '../src/data/monsters.js';
import { Combat } from '../src/engine/combat.js';
import { acOf } from '../src/data/armor.js';
import { CLASSES } from '../src/data/classes.js';
import { FEATURES } from '../src/data/features.js';
import { WEAPONS } from '../src/data/weapons.js';
import { isLegalAction } from '../src/engine/actions.js';
import { resolveAttack, martialArtsDie, applyDamage } from '../src/engine/rules/attack.js';
import { attackableWeapons } from '../src/engine/rules/equipment.js';
import type { Combatant, Position } from '../src/engine/types.js';

const monk = (level = 2, position: Position = { x: 1, y: 1 }): Combatant =>
  buildCharacter({ classId: 'monk', team: 'team1', position, level });
const dummy = (position: Position, id = 'd1', ac = 10): Combatant =>
  ({ ...buildMonster('skeleton', 'team2', position), id, hp: 999, maxHp: 999, acOverride: ac });

function fight(level = 2, seed = 5) {
  const me = monk(level);
  const c = new Combat({ combatants: [me, dummy({ x: 2, y: 1 })], seed });
  for (let i = 0; i < 8 && c.activeId !== me.id; i++) c.apply({ kind: 'endTurn' });
  return { c, me, live: () => c.state.combatants[me.id]! };
}

describe('Monk: the build', () => {
  it('wears nothing, and its AC says so', () => {
    const m = monk(1);
    expect(CLASSES['monk']!.equipment.armor, 'armour makes Unarmored Defense dead data').toBeUndefined();
    expect(CLASSES['monk']!.armorProfs, 'a monk is proficient in no armour at all').toEqual([]);
    // 10 + Dex + Wis. Dex and Wis are the class's two highest priorities, so
    // both start at 16 — an AC of 16 unarmoured, which is the point of the
    // feature and the reason the class can afford to wear nothing.
    expect(m.abilities.dex).toBe(16);
    expect(m.abilities.wis).toBe(16);
    expect(acOf(m)).toBe(10 + 3 + 3);
  });

  it('loses Unarmored Defense to a shield, where the barbarian does not', () => {
    // The two features share a name and differ in two ways; this is the one a
    // reader would not guess.
    const withShield = { ...monk(1), equipped: { ...monk(1).equipped, offHand: 'shield' } };
    expect(acOf(withShield)).not.toBe(10 + 3 + 3 + 2);
  });

  it('always has its fists, without drawing them', () => {
    expect(attackableWeapons(monk(1))).toContain('unarmed-strike');
    // And nobody else does — an unarmed option on every bar is noise.
    expect(attackableWeapons(buildCharacter({ classId: 'fighter', team: 'team1', position: { x: 0, y: 0 } })))
      .not.toContain('unarmed-strike');
  });

  it('cannot be handed a silvered fist', () => {
    // The unarmed strike is melee and free, which is exactly the shape the
    // silvering generator was picking up.
    expect(WEAPONS['silvered-unarmed-strike']).toBeUndefined();
  });

  it('punches harder from 5th', () => {
    expect(martialArtsDie(monk(4), WEAPONS['unarmed-strike']!)).toBe('1d6');
    expect(martialArtsDie(monk(5), WEAPONS['unarmed-strike']!)).toBe('1d8');
    // Not for anyone else, and not with anything else.
    const f = buildCharacter({ classId: 'fighter', team: 'team1', position: { x: 0, y: 0 }, level: 5 });
    expect(martialArtsDie(f, WEAPONS['unarmed-strike']!)).toBeUndefined();
    expect(martialArtsDie(monk(5), WEAPONS['quarterstaff']!)).toBeUndefined();
  });
});

describe('Monk: Focus, and the three things that spend it', () => {
  it('carries one point per level, back on a short rest', () => {
    expect(FEATURES['monks-focus']!.uses).toEqual({ count: 'level', per: 'shortRest' });
    expect(monk(2).featureUses['monks-focus']!.max).toBe(2);
    expect(monk(6).featureUses['monks-focus']!.max).toBe(6);
  });

  it('spends one point per technique, from the same pool', () => {
    // THE test. Three buttons, one budget — and a technique that forgot to pay
    // would look exactly like a technique that works.
    for (const featureId of ['flurry-of-blows', 'patient-defense', 'step-of-the-wind']) {
      const { c, me, live } = fight(4);
      const before = live().featureUses['monks-focus']!.current;
      c.apply({ kind: 'useFeature', featureId });
      expect(live().featureUses['monks-focus']!.current, `${featureId} did not pay`).toBe(before - 1);
    }
  });

  it('does nothing at all once the pool is empty', () => {
    const { c, me, live } = fight(2);
    live().featureUses['monks-focus']!.current = 0;
    const hpBefore = c.state.combatants['d1']!.hp;
    c.apply({ kind: 'useFeature', featureId: 'flurry-of-blows' });
    expect(c.state.combatants['d1']!.hp, 'flurried for free').toBe(hpBefore);
    expect(live().conditions.some((k) => k.id === 'dodging')).toBe(false);
  });

  it('flurries twice, at the thing in reach', () => {
    const { c, live } = fight(4);
    const before = c.state.combatants['d1']!.hp;
    c.apply({ kind: 'useFeature', featureId: 'flurry-of-blows' });
    expect(c.state.combatants['d1']!.hp, 'nothing landed').toBeLessThan(before);
    void live;
  });

  it('dodges with Patient Defense and dashes-and-disengages with Step of the Wind', () => {
    const a = fight(4);
    a.c.apply({ kind: 'useFeature', featureId: 'patient-defense' });
    expect(a.live().conditions.some((k) => k.id === 'dodging')).toBe(true);

    const b = fight(4);
    const speed = b.live().turn.movementMax;
    b.c.apply({ kind: 'useFeature', featureId: 'step-of-the-wind' });
    expect(b.live().turn.disengaged).toBe(true);
    expect(b.live().turn.movementMax, 'Step of the Wind is a Dash too').toBeGreaterThan(speed);
  });
});

describe('Monk: the rest of the kit', () => {
  it('gets a free unarmed strike as a bonus action, after it has swung', () => {
    const { c, me, live } = fight(2);
    const strike = { kind: 'attack' as const, weaponId: 'unarmed-strike', targetId: 'd1', frenzy: true };
    expect(isLegalAction(c.state, me.id, strike), 'before the Attack action').toBe(false);
    c.apply({ kind: 'attack', weaponId: 'quarterstaff', targetId: 'd1' });
    expect(isLegalAction(c.state, me.id, strike), 'after it').toBe(true);
    c.apply(strike);
    expect(live().turn.bonusActionUsed).toBe(true);
    // And it costs no focus — Martial Arts is free, which is what separates it
    // from Flurry of Blows.
    expect(live().featureUses['monks-focus']!.current).toBe(live().featureUses['monks-focus']!.max);
  });

  it('stuns on a failed save, and the stun takes the turn away', () => {
    // A fresh fight per attempt: the bonus action is spent after the first, so
    // a retry loop inside one turn is illegal rather than unlucky.
    let landed: ReturnType<typeof fight> | undefined;
    for (let seed = 1; seed <= 20 && !landed; seed++) {
      const f = fight(5, seed);
      f.c.apply({ kind: 'useFeature', featureId: 'stunning-strike' });
      if (f.c.state.combatants['d1']!.conditions.some((k) => k.id === 'stunned')) landed = f;
    }
    expect(landed, 'never landed a stun in 20 fights').toBeDefined();
    const { c, me } = landed!;
    // Stunned is incapacitating, and everyone hits it more easily.
    const roll = resolveAttack(c.state, me.id, 'd1', 'unarmed-strike', {})
      .find((e) => e.type === 'attackRolled');
    if (roll && roll.type === 'attackRolled') expect(roll.advSources).toContain('target stunned');
  });

  it('deflects a melee blow once a round, and not a spell', () => {
    const { c, me, live } = fight(3);
    expect(live().featureIds).toContain('deflect-attacks');
    const hp0 = live().hp;
    applyDamage(c.state, me.id, 'd1', 10, 'bludgeoning', [10], { melee: true });
    expect(hp0 - live().hp, 'a caught blow is halved').toBe(5);
    // The reaction is spent, so the next one lands whole.
    applyDamage(c.state, me.id, 'd1', 10, 'bludgeoning', [10], { melee: true });
    expect(live().hp).toBe(hp0 - 5 - 10);
  });

  it('does not deflect what it cannot reach', () => {
    const { c, me, live } = fight(3);
    const hp0 = live().hp;
    applyDamage(c.state, me.id, 'd1', 10, 'fire', [10]);
    expect(hp0 - live().hp, 'a fireball is not caught in the hand').toBe(10);
  });

  it('has magical fists from 6th, and mortal ones before', () => {
    expect(monk(5).featureIds).not.toContain('empowered-strikes');
    expect(monk(6).featureIds).toContain('empowered-strikes');
  });

  it('puts them on the floor with Open Hand Technique', () => {
    let proned = false;
    for (let seed = 1; seed <= 12 && !proned; seed++) {
      const me = monk(3);
      const c = new Combat({ combatants: [me, dummy({ x: 2, y: 1 }, 'd1', 1)], seed });
      for (let i = 0; i < 8 && c.activeId !== me.id; i++) c.apply({ kind: 'endTurn' });
      c.apply({ kind: 'useFeature', featureId: 'flurry-of-blows' });
      proned = c.state.combatants['d1']!.conditions.some((k) => k.id === 'prone');
    }
    expect(proned, 'a landed flurry should have floored it').toBe(true);
  });
});
