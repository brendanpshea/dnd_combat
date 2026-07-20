import { describe, it, expect } from 'vitest';
import { Combat } from '../src/engine/combat.js';
import { buildCharacter, buildParty } from '../src/builder/character.js';
import { buildEncounter, buildMonster } from '../src/data/monsters.js';
import { chooseAction } from '../src/ai/greedy.js';
import { cantripDice } from '../src/data/spells.js';
import { sphere5x5 } from '../src/engine/grid.js';
import { makeCombatant } from './helpers.js';
import type { Combatant, Position } from '../src/engine/types.js';

function place(classId: string, team: 'team1' | 'team2', position: Position, level: number, over: Partial<Combatant> = {}): Combatant {
  const c = buildCharacter({ classId, team, position, level });
  return { ...c, ...over, id: over.id ?? c.id };
}

function until(c: Combat, id: string) {
  let guard = 0;
  while (c.activeId !== id && guard++ < 60) c.apply({ kind: 'endTurn' });
  expect(c.activeId).toBe(id);
}

describe('level progression', () => {
  it('level 3 caster: 4 first-level + 2 second-level slots, new spells known', () => {
    const w = buildCharacter({ classId: 'wizard', team: 'team1', position: { x: 0, y: 0 }, level: 3 });
    expect(w.spellSlots).toEqual([{ current: 4, max: 4 }, { current: 2, max: 2 }]);
    expect(w.spellIds).toEqual(expect.arrayContaining(['thunderwave', 'scorching-ray', 'misty-step']));
    expect(w.featureIds).toContain('enhanced-cantrip'); // Evoker level 3 (Sculpt Spells now at 6)
    expect(w.maxHp).toBe(7 + 2 * 5); // 4+1 per level after 1st
  });

  it('level 2 grants the new 1st-level spell and 3 slots', () => {
    const c = buildCharacter({ classId: 'cleric', team: 'team1', position: { x: 0, y: 0 }, level: 2 });
    expect(c.spellSlots).toEqual([{ current: 3, max: 3 }]);
    expect(c.spellIds).toContain('guiding-bolt');
    expect(c.spellIds).not.toContain('hold-person');
    const r = buildCharacter({ classId: 'rogue', team: 'team1', position: { x: 0, y: 0 }, level: 2 });
    expect(r.featureIds).toEqual(expect.arrayContaining(['cunning-dash', 'cunning-disengage']));
    expect(r.featureIds).not.toContain('assassinate');
  });
});

describe('subclass features', () => {
  it('champion fighter crits on 19', () => {
    // Run attacks until a natural 19 shows up; it must be a crit.
    let saw19 = false;
    for (let seed = 1; seed <= 120 && !saw19; seed++) {
      const c = new Combat({
        seed,
        combatants: [
          place('fighter', 'team1', { x: 3, y: 3 }, 3, { id: 'ftr' }),
          makeCombatant({ id: 'pc', team: 'team2', position: { x: 3, y: 4 }, hp: 1000, maxHp: 1000 }),
        ],
      });
      until(c, 'ftr');
      const events = c.apply({ kind: 'attack', weaponId: 'longsword', targetId: 'pc' });
      const roll = events.find((e) => e.type === 'attackRolled')!;
      if (roll.type !== 'attackRolled') throw new Error();
      if (roll.natural === 19) {
        expect(roll.crit).toBe(true);
        saw19 = true;
      }
    }
    expect(saw19).toBe(true);
  });

  it('assassin has advantage against targets that have not acted', () => {
    let checked = false;
    for (let seed = 1; seed <= 60 && !checked; seed++) {
      const c = new Combat({
        seed,
        combatants: [
          place('rogue', 'team1', { x: 3, y: 3 }, 3, { id: 'rog' }),
          makeCombatant({ id: 'pc', team: 'team2', position: { x: 3, y: 4 }, hp: 1000, maxHp: 1000 }),
        ],
      });
      if (c.activeId !== 'rog') continue; // need the rogue to win initiative
      const events = c.apply({ kind: 'attack', weaponId: 'shortsword', targetId: 'pc' });
      const roll = events.find((e) => e.type === 'attackRolled')!;
      if (roll.type !== 'attackRolled') throw new Error();
      expect(roll.advSources).toContain('assassinate');
      // After the target's first turn, no more assassinate.
      c.apply({ kind: 'endTurn' });
      until(c, 'rog');
      const later = c.apply({ kind: 'attack', weaponId: 'shortsword', targetId: 'pc' });
      const roll2 = later.find((e) => e.type === 'attackRolled')!;
      if (roll2.type !== 'attackRolled') throw new Error();
      expect(roll2.advSources).not.toContain('assassinate');
      checked = true;
    }
    expect(checked).toBe(true);
  });

  it('sculpt spells: burning hands spares allies in the cone', () => {
    // Sculpt Spells is a level-6 feature (2024) and the campaign caps at 5, so
    // it's not buildable in-range; grant it directly to still exercise the rule.
    const wiz = place('wizard', 'team1', { x: 0, y: 0 }, 3, { id: 'wiz' });
    wiz.featureIds = [...wiz.featureIds, 'sculpt-spells'];
    const c = new Combat({
      seed: 4,
      combatants: [
        wiz,
        place('fighter', 'team1', { x: 1, y: 1 }, 3, { id: 'ally' }),
        makeCombatant({ id: 'foe', team: 'team2', position: { x: 2, y: 2 }, hp: 1000, maxHp: 1000 }),
      ],
    });
    until(c, 'wiz');
    const events = c.apply({
      kind: 'castSpell', spellId: 'burning-hands', slotLevel: 1,
      targets: [{ position: { x: 1, y: 1 } }],
    });
    const saves = events.filter((e) => e.type === 'savingThrow');
    expect(saves).toHaveLength(1); // only the enemy saves; the ally is sculpted out
    if (saves[0]!.type === 'savingThrow') expect(saves[0]!.combatantId).toBe('foe');
  });

  it('preserve life heals the most wounded allies up to half max', () => {
    const c = new Combat({
      seed: 6,
      combatants: [
        place('cleric', 'team1', { x: 0, y: 0 }, 3, { id: 'clr' }),
        place('fighter', 'team1', { x: 1, y: 0 }, 3, { id: 'ftr', hp: 1 }),
        makeCombatant({ id: 'foe', team: 'team2', position: { x: 7, y: 7 } }),
      ],
    });
    until(c, 'clr');
    const events = c.apply({ kind: 'useFeature', featureId: 'preserve-life' });
    const healed = events.filter((e) => e.type === 'healed');
    expect(healed.length).toBeGreaterThan(0);
    const ftr = c.state.combatants['ftr']!;
    expect(ftr.hp).toBe(Math.floor(ftr.maxHp / 2)); // capped at half max
    expect(c.state.combatants['clr']!.featureUses['preserve-life']!.current).toBe(0);
  });
});

describe('new spells', () => {
  it('thunderwave damages adjacent enemies and pushes them away on a failed save', () => {
    let pushed = false;
    for (let seed = 1; seed <= 80 && !pushed; seed++) {
      const c = new Combat({
        seed,
        combatants: [
          place('wizard', 'team1', { x: 3, y: 3 }, 2, { id: 'wiz' }),
          makeCombatant({ id: 'foe', team: 'team2', position: { x: 3, y: 4 }, hp: 1000, maxHp: 1000 }),
        ],
      });
      until(c, 'wiz');
      // Aim the 3x3 cube north (toward the adjacent foe).
      const events = c.apply({ kind: 'castSpell', spellId: 'thunderwave', slotLevel: 1, targets: [{ position: { x: 3, y: 4 } }] });
      const save = events.find((e) => e.type === 'savingThrow')!;
      if (save.type !== 'savingThrow') throw new Error();
      expect(events.some((e) => e.type === 'damageDealt')).toBe(true);
      if (!save.success) {
        expect(c.state.combatants['foe']!.position).toEqual({ x: 3, y: 6 }); // pushed 2 cells
        pushed = true;
      }
    }
    expect(pushed).toBe(true);
  });

  it('thunderwave push stops at walls', () => {
    let tested = false;
    for (let seed = 1; seed <= 80 && !tested; seed++) {
      const c = new Combat({
        seed,
        mapId: 'ruins', // wall at (2,6)
        combatants: [
          place('wizard', 'team1', { x: 4, y: 6 }, 2, { id: 'wiz' }),
          makeCombatant({ id: 'foe', team: 'team2', position: { x: 3, y: 6 }, hp: 1000, maxHp: 1000 }),
        ],
      });
      until(c, 'wiz');
      // Aim the cube west (toward the adjacent foe).
      const events = c.apply({ kind: 'castSpell', spellId: 'thunderwave', slotLevel: 1, targets: [{ position: { x: 3, y: 6 } }] });
      const save = events.find((e) => e.type === 'savingThrow')!;
      if (save.type !== 'savingThrow') throw new Error();
      if (!save.success) {
        // Push direction is west; (2,6) is a wall, so the foe doesn't move.
        expect(c.state.combatants['foe']!.position).toEqual({ x: 3, y: 6 });
        tested = true;
      }
    }
    expect(tested).toBe(true);
  });

  it('scorching ray fires three independent rays', () => {
    const c = new Combat({
      seed: 12,
      combatants: [
        place('wizard', 'team1', { x: 0, y: 0 }, 3, { id: 'wiz' }),
        makeCombatant({ id: 'foe', team: 'team2', position: { x: 4, y: 4 }, hp: 1000, maxHp: 1000 }),
      ],
    });
    until(c, 'wiz');
    const events = c.apply({
      kind: 'castSpell', spellId: 'scorching-ray', slotLevel: 2,
      targets: [{ combatantId: 'foe' }, { combatantId: 'foe' }, { combatantId: 'foe' }],
    });
    expect(events.filter((e) => e.type === 'attackRolled')).toHaveLength(3);
    expect(c.state.combatants['wiz']!.spellSlots[1]!.current).toBe(1);
  });

  it('misty step teleports as a bonus action, leaving the action free', () => {
    const c = new Combat({
      seed: 3,
      combatants: [
        place('wizard', 'team1', { x: 3, y: 3 }, 3, { id: 'wiz' }),
        makeCombatant({ id: 'foe', team: 'team2', position: { x: 3, y: 4 } }),
      ],
    });
    until(c, 'wiz');
    const events = c.apply({ kind: 'castSpell', spellId: 'misty-step', slotLevel: 2, targets: [{ position: { x: 0, y: 0 } }] });
    expect(events.some((e) => e.type === 'moved')).toBe(true);
    expect(events.some((e) => e.type === 'attackRolled')).toBe(false); // no OA
    const wiz = c.state.combatants['wiz']!;
    expect(wiz.position).toEqual({ x: 0, y: 0 });
    expect(wiz.turn.bonusActionUsed).toBe(true);
    expect(wiz.turn.actionUsed).toBe(false);
  });

  it('hold person paralyzes (no actions, melee auto-crit) until the save is made', () => {
    let verified = false;
    for (let seed = 1; seed <= 100 && !verified; seed++) {
      const c = new Combat({
        seed,
        combatants: [
          place('cleric', 'team1', { x: 3, y: 3 }, 3, { id: 'clr' }),
          makeCombatant({ id: 'foe', team: 'team2', position: { x: 3, y: 4 }, hp: 1000, maxHp: 1000 }),
        ],
      });
      until(c, 'clr');
      c.apply({ kind: 'castSpell', spellId: 'hold-person', slotLevel: 2, targets: [{ combatantId: 'foe' }] });
      const foe = () => c.state.combatants['foe']!;
      if (!foe().conditions.some((k) => k.id === 'paralyzed')) continue;
      expect(c.state.combatants['clr']!.concentratingOn?.spellId).toBe('hold-person');
      // Foe's turn: no actions at all beyond endTurn.
      c.apply({ kind: 'endTurn' });
      expect(c.activeId).toBe('foe');
      const kinds = new Set(c.legalActions().map((a) => a.kind));
      expect(kinds.has('attack')).toBe(false);
      expect(kinds.has('move')).toBe(false);
      // Cleric melee attack while paralyzed: any hit is a crit.
      const stillHeld = () => foe().conditions.some((k) => k.id === 'paralyzed');
      c.apply({ kind: 'endTurn' }); // foe end-of-turn repeat save happens here
      if (!stillHeld()) continue;
      until(c, 'clr');
      const events = c.apply({ kind: 'attack', weaponId: 'mace', targetId: 'foe' });
      const roll = events.find((e) => e.type === 'attackRolled')!;
      if (roll.type !== 'attackRolled') throw new Error();
      expect(roll.advSources).toContain('target paralyzed');
      if (roll.hit) {
        expect(roll.crit).toBe(true);
        verified = true;
      }
    }
    expect(verified).toBe(true);
  });

  it('guiding bolt rider gives the next attacker advantage, once', () => {
    let verified = false;
    for (let seed = 1; seed <= 100 && !verified; seed++) {
      const c = new Combat({
        seed,
        combatants: [
          place('cleric', 'team1', { x: 0, y: 0 }, 2, { id: 'clr' }),
          place('fighter', 'team1', { x: 3, y: 3 }, 2, { id: 'ftr' }),
          makeCombatant({ id: 'foe', team: 'team2', position: { x: 3, y: 4 }, hp: 1000, maxHp: 1000 }),
        ],
      });
      until(c, 'clr');
      const events = c.apply({ kind: 'castSpell', spellId: 'guiding-bolt', slotLevel: 1, targets: [{ combatantId: 'foe' }] });
      const bolt = events.find((e) => e.type === 'attackRolled')!;
      if (bolt.type !== 'attackRolled' || !bolt.hit) continue;
      expect(c.state.combatants['foe']!.conditions.some((k) => k.id === 'guided')).toBe(true);
      c.apply({ kind: 'endTurn' });
      until(c, 'ftr');
      const swing = c.apply({ kind: 'attack', weaponId: 'longsword', targetId: 'foe' });
      const roll = swing.find((e) => e.type === 'attackRolled')!;
      if (roll.type !== 'attackRolled') throw new Error();
      expect(roll.advSources).toContain('guiding bolt');
      // Consumed by that one roll.
      expect(c.state.combatants['foe']!.conditions.some((k) => k.id === 'guided')).toBe(false);
      verified = true;
    }
    expect(verified).toBe(true);
  });

  it('aid raises current and max hp', () => {
    const c = new Combat({
      seed: 2,
      combatants: [
        place('cleric', 'team1', { x: 0, y: 0 }, 3, { id: 'clr' }),
        place('fighter', 'team1', { x: 1, y: 0 }, 3, { id: 'ftr' }),
        makeCombatant({ id: 'foe', team: 'team2', position: { x: 7, y: 7 } }),
      ],
    });
    until(c, 'clr');
    const before = c.state.combatants['ftr']!.maxHp;
    c.apply({ kind: 'castSpell', spellId: 'aid', slotLevel: 2, targets: [{ combatantId: 'ftr' }, { combatantId: 'clr' }] });
    expect(c.state.combatants['ftr']!.maxHp).toBe(before + 5);
    expect(c.state.combatants['ftr']!.hp).toBe(before + 5);
  });
});

describe('levels 4-5', () => {
  it('level 4 adds +2 to the primary stat (capped at 20), and not before', () => {
    expect(buildCharacter({ classId: 'fighter', team: 'team1', position: { x: 0, y: 0 }, level: 3 }).abilities.str).toBe(16);
    expect(buildCharacter({ classId: 'fighter', team: 'team1', position: { x: 0, y: 0 }, level: 4 }).abilities.str).toBe(18);
    expect(buildCharacter({ classId: 'wizard', team: 'team1', position: { x: 0, y: 0 }, level: 4 }).abilities.int).toBe(18);
  });

  it('level 5 fighter gains Extra Attack (two attacks per action)', () => {
    expect(buildCharacter({ classId: 'fighter', team: 'team1', position: { x: 0, y: 0 }, level: 4 }).attacksPerAction).toBe(1);
    const f5 = buildCharacter({ classId: 'fighter', team: 'team1', position: { x: 0, y: 0 }, level: 5 });
    expect(f5.featureIds).toContain('extra-attack');
    expect(f5.attacksPerAction).toBe(2);
  });

  it('level 5 casters gain a 3rd-level slot and their signature spell', () => {
    const w = buildCharacter({ classId: 'wizard', team: 'team1', position: { x: 0, y: 0 }, level: 5 });
    expect(w.spellSlots.map((s) => s.max)).toEqual([4, 3, 2]);
    expect(w.spellIds).toContain('fireball');
    const c = buildCharacter({ classId: 'cleric', team: 'team1', position: { x: 0, y: 0 }, level: 5 });
    expect(c.spellSlots.map((s) => s.max)).toEqual([4, 3, 2]);
    expect(c.spellIds).toContain('mass-healing-word');
  });

  it('cantripDice doubles the die count at level 5', () => {
    expect(cantripDice('1d10', 4)).toBe('1d10');
    expect(cantripDice('1d10', 5)).toBe('2d10');
    expect(cantripDice('1d8', 5)).toBe('2d8');
  });

  it('a level-5 Fire Bolt rolls two dice on a hit', () => {
    for (let seed = 1; seed <= 60; seed++) {
      const c = new Combat({
        seed,
        combatants: [
          place('wizard', 'team1', { x: 3, y: 3 }, 5, { id: 'wiz' }),
          makeCombatant({ id: 'foe', team: 'team2', position: { x: 4, y: 3 }, hp: 1000, maxHp: 1000 }),
        ],
      });
      until(c, 'wiz');
      const events = c.apply({ kind: 'castSpell', spellId: 'fire-bolt', slotLevel: 0, targets: [{ combatantId: 'foe' }] });
      const dmg = events.find((e) => e.type === 'damageDealt');
      if (!dmg || dmg.type !== 'damageDealt') continue;
      expect(dmg.rolls).toHaveLength(2);
      return;
    }
    throw new Error('never hit across 60 seeds');
  });

  it('Enhanced Cantrip: an evoker adds its Int modifier to cantrip damage', () => {
    for (let seed = 1; seed <= 60; seed++) {
      const wiz = place('wizard', 'team1', { x: 3, y: 3 }, 3, { id: 'wiz' }); // Int 16 (+3)
      expect(wiz.featureIds).toContain('enhanced-cantrip');
      const c = new Combat({
        seed,
        combatants: [
          wiz,
          makeCombatant({ id: 'foe', team: 'team2', position: { x: 4, y: 3 }, hp: 1000, maxHp: 1000 }),
        ],
      });
      until(c, 'wiz');
      const events = c.apply({ kind: 'castSpell', spellId: 'fire-bolt', slotLevel: 0, targets: [{ combatantId: 'foe' }] });
      const dmg = events.find((e) => e.type === 'damageDealt');
      if (!dmg || dmg.type !== 'damageDealt') continue;
      const diceSum = dmg.rolls.reduce((a, b) => a + b, 0);
      expect(dmg.amount).toBe(diceSum + 3); // + Int modifier
      return;
    }
    throw new Error('never hit across 60 seeds');
  });

  it('Fireball hits every enemy in the 5x5 blast and spares allies (Sculpt Spells)', () => {
    // Sculpt Spells is a level-6 feature (2024); grant it directly since the
    // campaign caps at level 5, keeping the blast-shaping behavior under test.
    const wiz = place('wizard', 'team1', { x: 1, y: 1 }, 5, { id: 'wiz' });
    wiz.featureIds = [...wiz.featureIds, 'sculpt-spells'];
    const c = new Combat({
      seed: 4,
      combatants: [
        wiz,
        makeCombatant({ id: 'e1', team: 'team2', position: { x: 5, y: 5 }, hp: 1000, maxHp: 1000 }),
        makeCombatant({ id: 'e2', team: 'team2', position: { x: 6, y: 5 }, hp: 1000, maxHp: 1000 }),
        place('fighter', 'team1', { x: 5, y: 6 }, 5, { id: 'ally' }), // inside the blast
      ],
    });
    until(c, 'wiz');
    const center = { x: 5, y: 5 };
    expect(sphere5x5(center).some((p) => p.x === 5 && p.y === 6)).toBe(true); // ally is in range
    const events = c.apply({ kind: 'castSpell', spellId: 'fireball', slotLevel: 3, targets: [{ position: center }] });
    const hurt = new Set(events.filter((e) => e.type === 'damageDealt').map((e) => e.type === 'damageDealt' && e.targetId));
    expect(hurt.has('e1')).toBe(true);
    expect(hurt.has('e2')).toBe(true);
    expect(hurt.has('ally')).toBe(false); // Sculpt Spells spares the ally
  });

  it('Mass Healing Word heals several wounded allies at once', () => {
    const c = new Combat({
      seed: 2,
      combatants: [
        place('cleric', 'team1', { x: 1, y: 1 }, 5, { id: 'clr' }),
        place('fighter', 'team1', { x: 2, y: 1 }, 5, { id: 'a1', hp: 5 }),
        place('rogue', 'team1', { x: 3, y: 1 }, 5, { id: 'a2', hp: 5 }),
        makeCombatant({ id: 'foe', team: 'team2', position: { x: 7, y: 7 } }),
      ],
    });
    until(c, 'clr');
    const events = c.apply({
      kind: 'castSpell', spellId: 'mass-healing-word', slotLevel: 3,
      targets: [{ combatantId: 'a1' }, { combatantId: 'a2' }],
    });
    const healed = new Set(events.filter((e) => e.type === 'healed').map((e) => e.type === 'healed' && e.targetId));
    expect(healed.has('a1')).toBe(true);
    expect(healed.has('a2')).toBe(true);
    expect(c.state.combatants['a1']!.hp).toBeGreaterThan(5);
  });

  it('Uncanny Dodge halves the first hit against the rogue each round', () => {
    for (let seed = 1; seed <= 60; seed++) {
      const c = new Combat({
        seed,
        combatants: [
          place('rogue', 'team1', { x: 4, y: 4 }, 5, { id: 'rog', hp: 300, maxHp: 300 }),
          { ...buildMonster('ettin', 'team2', { x: 5, y: 4 }), id: 'et' },
        ],
      });
      until(c, 'et');
      const before = c.state.combatants['rog']!.hp;
      const events = c.apply({ kind: 'attack', weaponId: 'ettin-battleaxe', targetId: 'rog' });
      const dmg = events.find((e) => e.type === 'damageDealt');
      if (!dmg || dmg.type !== 'damageDealt' || !dmg.tags?.includes('Uncanny Dodge')) continue;
      // The HP lost equals the (already-halved) reported amount.
      expect(before - c.state.combatants['rog']!.hp).toBe(dmg.amount);
      return;
    }
    throw new Error('ettin never landed a hit to dodge across 60 seeds');
  });

  it('Fireball engulfs creatures in the blast even behind a wall (no LoS filter)', () => {
    // Ruins map has a wall at (5,5); the far enemy sits behind it from the blast
    // centre (4,5) yet is still within the 5x5 radius.
    const c = new Combat({
      seed: 4,
      mapId: 'ruins',
      combatants: [
        place('wizard', 'team1', { x: 4, y: 7 }, 5, { id: 'wiz' }), // clear line to the centre
        makeCombatant({ id: 'near', team: 'team2', position: { x: 3, y: 5 }, hp: 1000, maxHp: 1000 }),
        makeCombatant({ id: 'behind', team: 'team2', position: { x: 6, y: 5 }, hp: 1000, maxHp: 1000 }),
      ],
    });
    until(c, 'wiz');
    const events = c.apply({ kind: 'castSpell', spellId: 'fireball', slotLevel: 3, targets: [{ position: { x: 4, y: 5 } }] });
    const hurt = new Set(events.filter((e) => e.type === 'damageDealt').map((e) => e.type === 'damageDealt' && e.targetId));
    expect(hurt.has('near')).toBe(true);
    expect(hurt.has('behind')).toBe(true); // hit despite the wall between it and the centre
  });

  it('a Scroll of Magic Missile offers the same multi-dart targeting as the spell', () => {
    const c = new Combat({
      seed: 5,
      combatants: [
        place('wizard', 'team1', { x: 3, y: 3 }, 3, { id: 'wiz' }),
        makeCombatant({ id: 'foe', team: 'team2', position: { x: 5, y: 3 }, hp: 1000, maxHp: 1000 }),
      ],
    });
    until(c, 'wiz');
    const scrollAct = c.legalActions().find((a) => a.kind === 'useItem' && a.itemId === 'scroll-magic-missile');
    expect(scrollAct).toBeDefined();
    if (scrollAct?.kind !== 'useItem') throw new Error();
    expect(scrollAct.targets).toHaveLength(3); // three darts, like the spell
    const events = c.apply(scrollAct);
    expect(events.some((e) => e.type === 'damageDealt')).toBe(true);
    expect(c.state.combatants['wiz']!.inventory.some((s) => s.itemId === 'scroll-magic-missile' && s.qty > 0)).toBe(false);
  });

  it('level-5 party vs the giants finale completes under AI', () => {
    const c = new Combat({
      seed: 21,
      mapId: 'firepit',
      combatants: [...buildParty('team1', 0, 5), ...buildEncounter('giants', 'team2', 7)],
    });
    let steps = 0;
    while (!c.isOver() && steps++ < 8000) c.apply(chooseAction(c.state, c.activeId));
    expect(c.isOver()).toBe(true);
  }, 40000);
});

describe('level-3 battles', () => {
  it('level-3 party vs ogre encounter completes under AI', () => {
    const c = new Combat({
      seed: 21,
      mapId: 'ruins',
      combatants: [...buildParty('team1', 0, 3), ...buildEncounter('ogre', 'team2', 7)],
    });
    let steps = 0;
    while (!c.isOver() && steps++ < 6000) {
      c.apply(chooseAction(c.state, c.activeId));
    }
    expect(c.isOver()).toBe(true);
  }, 30000);

  it('level-3 mirror match is deterministic and completes', () => {
    const run = () => {
      const c = new Combat({
        seed: 33,
        combatants: [...buildParty('team1', 0, 3), ...buildParty('team2', 7, 3)],
      });
      let steps = 0;
      while (!c.isOver() && steps++ < 6000) c.apply(chooseAction(c.state, c.activeId));
      return { over: c.isOver(), winner: c.winner(), logLen: JSON.stringify(c.log).length };
    };
    const a = run();
    expect(a.over).toBe(true);
    expect(run()).toEqual(a);
  }, 30000);
});
