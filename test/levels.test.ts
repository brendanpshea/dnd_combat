import { describe, it, expect } from 'vitest';
import { Combat } from '../src/engine/combat.js';
import { buildCharacter, buildParty } from '../src/builder/character.js';
import { buildEncounter } from '../src/data/monsters.js';
import { chooseAction } from '../src/ai/greedy.js';
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
    expect(w.featureIds).toContain('sculpt-spells');
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
    const c = new Combat({
      seed: 4,
      combatants: [
        place('wizard', 'team1', { x: 0, y: 0 }, 3, { id: 'wiz' }),
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
      const events = c.apply({ kind: 'castSpell', spellId: 'thunderwave', slotLevel: 1, targets: [] });
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
      const events = c.apply({ kind: 'castSpell', spellId: 'thunderwave', slotLevel: 1, targets: [] });
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
