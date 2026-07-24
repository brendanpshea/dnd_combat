import { describe, it, expect } from 'vitest';
import { Combat } from '../src/engine/combat.js';
import { buildCharacter } from '../src/builder/character.js';
import { buildMonster } from '../src/data/monsters.js';
import { resolveAttack, smiteDice } from '../src/engine/rules/attack.js';
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
  it('fires as a finisher — a low-HP hit spends the lowest slot and the bonus action', () => {
    // Dagger (1d4+3, ≤7) can't kill a 10-HP foe outright, but leaves ≤7 HP — well
    // inside a 2d8 smite's expected kill (avg 9), so the finisher reliably fires.
    const atk = buildCharacter({
      classId: 'paladin', team: 'team1', position: { x: 3, y: 3 }, level: 2,
      inventory: [{ itemId: 'dagger', qty: 1 }], equipped: { mainHand: 'dagger' },
    });
    const foe = target({ x: 4, y: 3 }, 'foe', 1, 10); // AC 1 → always hits; 10 HP
    const c = new Combat({ seed: 1, mapId: 'open', combatants: [atk, foe] });
    const slotsBefore = c.state.combatants[atk.id]!.spellSlots[0]!.current;

    const events = resolveAttack(c.state, atk.id, 'foe', 'dagger');
    const smite = events.find((e) => e.type === 'damageDealt' && (e as { tags?: string[] }).tags?.includes('Divine Smite'));
    expect(smite).toBeDefined();
    expect((smite as { damageType: string }).damageType).toBe('radiant');
    expect(c.state.combatants[atk.id]!.spellSlots[0]!.current).toBe(slotsBefore - 1);
    expect(c.state.combatants[atk.id]!.turn.bonusActionUsed).toBe(true);
  });

  it('holds the slot on an ordinary hit against a healthy target', () => {
    const atk = buildCharacter({ classId: 'paladin', team: 'team1', position: { x: 3, y: 3 }, level: 2 });
    const foe = target({ x: 4, y: 3 }, 'foe', 1); // AC 1 → always hits; 999 HP → no smite can finish it
    const c = new Combat({ seed: 1, mapId: 'open', combatants: [atk, foe] });
    const slotsBefore = c.state.combatants[atk.id]!.spellSlots[0]!.current;

    const events = resolveAttack(c.state, atk.id, 'foe', 'longsword');
    const rolled = events.find((e) => e.type === 'attackRolled') as { crit: boolean } | undefined;
    expect(rolled?.crit, 'seed 1 must be an ordinary hit for this test to mean anything').toBe(false);
    const smite = events.find((e) => e.type === 'damageDealt' && (e as { tags?: string[] }).tags?.includes('Divine Smite'));
    expect(smite).toBeUndefined();
    expect(c.state.combatants[atk.id]!.spellSlots[0]!.current).toBe(slotsBefore); // slot saved
    expect(c.state.combatants[atk.id]!.turn.bonusActionUsed).toBe(false);
  });

  // The old rule fired on predicted kills *only*, which meant it pointedly
  // never triggered on a natural 20 against a healthy boss — the exact swing
  // the class exists for. A crit doubles the smite dice, so it is the moment a
  // paladin would never choose to hold the slot.
  it('fires on a crit even against a full-health target', () => {
    for (let seed = 1; seed < 400; seed++) {
      const atk = buildCharacter({ classId: 'paladin', team: 'team1', position: { x: 3, y: 3 }, level: 2 });
      const foe = target({ x: 4, y: 3 }, 'foe', 1); // 999 HP: no smite could ever "finish" it
      const c = new Combat({ seed, mapId: 'open', combatants: [atk, foe] });
      const events = resolveAttack(c.state, atk.id, 'foe', 'longsword');
      const rolled = events.find((e) => e.type === 'attackRolled') as { crit: boolean } | undefined;
      if (!rolled?.crit) continue;
      const smited = events.find((e) => e.type === 'smited');
      expect(smited, 'a crit must smite').toBeDefined();
      expect((smited as { crit: boolean }).crit).toBe(true);
      // Crit doubles the dice: 2d8 → 4d8, so at least 4.
      expect((smited as { amount: number }).amount).toBeGreaterThanOrEqual(4);
      expect(c.state.combatants[atk.id]!.spellSlots[0]!.current).toBe(1);
      return;
    }
    throw new Error('no crit across 400 seeds');
  });

  it('does not fire when the bonus action is already spent this turn', () => {
    const atk = buildCharacter({ classId: 'paladin', team: 'team1', position: { x: 3, y: 3 }, level: 2 });
    const foe = target({ x: 4, y: 3 }, 'foe', 1, 5); // finisher-eligible HP
    const c = new Combat({ seed: 6, mapId: 'open', combatants: [atk, foe] });
    c.state.combatants[atk.id]!.turn.bonusActionUsed = true; // already smited/shoved this turn
    const slotsBefore = c.state.combatants[atk.id]!.spellSlots[0]!.current;
    const events = resolveAttack(c.state, atk.id, 'foe', 'longsword');
    const smite = events.find((e) => e.type === 'damageDealt' && (e as { tags?: string[] }).tags?.includes('Divine Smite'));
    expect(smite).toBeUndefined();
    expect(c.state.combatants[atk.id]!.spellSlots[0]!.current).toBe(slotsBefore);
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

/**
 * The smite spells: bonus-action self-buffs that arm the next melee hit. This
 * engine resolves an attack atomically, so there is nowhere to ask "smite?"
 * between the hit and the damage — arming up front is both what the engine can
 * express and the more interesting decision.
 */
describe('Paladin: smite spells', () => {
  const armed = (c: Combat, id: string) => c.state.combatants[id]!.armedSmite;

  it('a paladin knows the smites from level 2, and Divine Smite rides along free', () => {
    const l1 = buildCharacter({ classId: 'paladin', team: 'team1', position: { x: 1, y: 1 }, level: 1 });
    expect(l1.spellIds).not.toContain('divine-smite');

    const p = buildCharacter({ classId: 'paladin', team: 'team1', position: { x: 1, y: 1 }, level: 2 });
    expect(p.spellIds).toEqual(expect.arrayContaining(
      ['divine-smite', 'searing-smite', 'thunderous-smite', 'wrathful-smite']));
  });

  it('arming spends the slot and the bonus action; the next melee hit discharges it', () => {
    const pal = { ...buildCharacter({ classId: 'paladin', team: 'team1', position: { x: 3, y: 3 }, level: 3 }), id: 'pal' };
    const foe = target({ x: 4, y: 3 }, 'foe', 1);
    const c = new Combat({ seed: 5, mapId: 'open', combatants: [pal, foe] });
    until(c, 'pal');
    const slots = c.state.combatants['pal']!.spellSlots[0]!.current;

    c.apply({ kind: 'castSpell', spellId: 'divine-smite', slotLevel: 1, targets: [] });
    expect(armed(c, 'pal')).toMatchObject({ spellId: 'divine-smite', slotLevel: 1 });
    expect(c.state.combatants['pal']!.spellSlots[0]!.current).toBe(slots - 1);
    expect(c.state.combatants['pal']!.turn.bonusActionUsed).toBe(true);
    expect(c.state.combatants['pal']!.conditions.some((k) => k.id === 'smiting')).toBe(true);

    const events = c.apply({ kind: 'attack', weaponId: 'longsword', targetId: 'foe' });
    expect(events.some((e) => e.type === 'smited')).toBe(true);
    expect(armed(c, 'pal')).toBeUndefined();
    expect(c.state.combatants['pal']!.conditions.some((k) => k.id === 'smiting')).toBe(false);
  });

  it('a second smite is not offered while one is already held', () => {
    const pal = { ...buildCharacter({ classId: 'paladin', team: 'team1', position: { x: 3, y: 3 }, level: 5 }), id: 'pal' };
    const foe = target({ x: 4, y: 3 }, 'foe', 1);
    const c = new Combat({ seed: 5, mapId: 'open', combatants: [pal, foe] });
    until(c, 'pal');
    const smiteOffered = () => c.legalActions()
      .some((a) => a.kind === 'castSpell' && a.spellId.endsWith('-smite'));
    expect(smiteOffered()).toBe(true);
    c.apply({ kind: 'castSpell', spellId: 'searing-smite', slotLevel: 1, targets: [] });
    expect(smiteOffered()).toBe(false);
  });

  it('an armed smite suppresses the automatic one — never two on a single hit', () => {
    const pal = { ...buildCharacter({ classId: 'paladin', team: 'team1', position: { x: 3, y: 3 }, level: 3 }), id: 'pal' };
    const foe = target({ x: 4, y: 3 }, 'foe', 1); // durable, so the hit can't end it early
    const c = new Combat({ seed: 6, mapId: 'open', combatants: [pal, foe] });
    until(c, 'pal');
    c.apply({ kind: 'castSpell', spellId: 'wrathful-smite', slotLevel: 1, targets: [] });
    const events = c.apply({ kind: 'attack', weaponId: 'longsword', targetId: 'foe' });
    expect(events.filter((e) => e.type === 'smited')).toHaveLength(1);
    expect((events.find((e) => e.type === 'smited') as { spellId: string }).spellId).toBe('wrathful-smite');
  });

  // These smites last a minute in the rules, discharging on the next hit that
  // lands — so a weapon blow that kills outright leaves the smite still held
  // rather than wasting the slot on a corpse.
  it('stays armed when the weapon blow alone kills the target', () => {
    const pal = { ...buildCharacter({ classId: 'paladin', team: 'team1', position: { x: 3, y: 3 }, level: 3 }), id: 'pal' };
    const weak = target({ x: 4, y: 3 }, 'weak', 1, 1);   // dies to any hit
    const tough = target({ x: 2, y: 3 }, 'tough', 1);
    const c = new Combat({ seed: 6, mapId: 'open', combatants: [pal, weak, tough] });
    until(c, 'pal');
    c.apply({ kind: 'castSpell', spellId: 'divine-smite', slotLevel: 1, targets: [] });
    const events = c.apply({ kind: 'attack', weaponId: 'longsword', targetId: 'weak' });
    expect(c.state.combatants['weak']!.alive).toBe(false);
    expect(events.some((e) => e.type === 'smited')).toBe(false);
    expect(c.state.combatants['pal']!.armedSmite).toMatchObject({ spellId: 'divine-smite' });
  });

  it('upcasting adds a die per slot level', () => {
    expect(smiteDice('divine-smite', 1)).toBe('2d8');
    expect(smiteDice('divine-smite', 3)).toBe('4d8');
    expect(smiteDice('searing-smite', 1)).toBe('1d6');
    expect(smiteDice('searing-smite', 2)).toBe('2d6');
  });

  it('Thunderous Smite knocks the target back and prone on a failed save', () => {
    for (let seed = 1; seed < 120; seed++) {
      const pal = { ...buildCharacter({ classId: 'paladin', team: 'team1', position: { x: 3, y: 3 }, level: 3 }), id: 'pal' };
      const foe = target({ x: 3, y: 4 }, 'foe', 1);
      const c = new Combat({ seed, mapId: 'open', combatants: [pal, foe] });
      until(c, 'pal');
      c.apply({ kind: 'castSpell', spellId: 'thunderous-smite', slotLevel: 1, targets: [] });
      const events = c.apply({ kind: 'attack', weaponId: 'longsword', targetId: 'foe' });
      if (!events.some((e) => e.type === 'smited')) continue;
      const f = c.state.combatants['foe']!;
      if (!f.conditions.some((k) => k.id === 'prone')) continue; // made the save
      expect(f.position.y).toBeGreaterThan(4);  // shoved straight back
      return;
    }
    throw new Error('thunderous smite never landed its rider across 120 seeds');
  });

  it('Searing Smite burns on: damage at the end of the victim’s turn until it saves', () => {
    for (let seed = 1; seed < 120; seed++) {
      const pal = { ...buildCharacter({ classId: 'paladin', team: 'team1', position: { x: 3, y: 3 }, level: 3 }), id: 'pal' };
      const foe = target({ x: 4, y: 3 }, 'foe', 1);
      const c = new Combat({ seed, mapId: 'open', combatants: [pal, foe] });
      until(c, 'pal');
      c.apply({ kind: 'castSpell', spellId: 'searing-smite', slotLevel: 1, targets: [] });
      c.apply({ kind: 'attack', weaponId: 'longsword', targetId: 'foe' });
      if (!c.state.combatants['foe']!.conditions.some((k) => k.id === 'burning')) continue;

      // Walk to the end of the burning creature's own turn, where the save is
      // rolled: fail and it takes fire, succeed and the flames go out.
      until(c, 'foe');
      const hpBefore = c.state.combatants['foe']!.hp;
      const events = c.apply({ kind: 'endTurn' });
      const burned = events.some((e) => e.type === 'damageDealt' &&
        (e as { tags?: string[] }).tags?.includes('Searing Smite'));
      if (burned) {
        expect(c.state.combatants['foe']!.hp).toBeLessThan(hpBefore);
        expect(c.state.combatants['foe']!.conditions.some((k) => k.id === 'burning')).toBe(true);
      } else {
        expect(c.state.combatants['foe']!.conditions.some((k) => k.id === 'burning')).toBe(false);
      }
      return;
    }
    throw new Error('searing smite never caught across 120 seeds');
  });
});
