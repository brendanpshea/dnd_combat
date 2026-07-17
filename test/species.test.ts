import { describe, expect, it } from 'vitest';
import { isDown } from '../src/engine/types.js';
import { buildCharacter } from '../src/builder/character.js';
import { Combat } from '../src/engine/combat.js';
import { applyDamage, collectAttackSources } from '../src/engine/rules/attack.js';
import { SPELLS } from '../src/data/spells.js';
import { WEAPONS } from '../src/data/weapons.js';

function character(classId: string, speciesId: string, team: 'team1' | 'team2', x: number, y: number) {
  return buildCharacter({ classId, speciesId, team, position: { x, y } });
}

function takeTurn(combat: Combat, actorId: string): void {
  let attempts = 0;
  while (combat.activeId !== actorId && attempts++ < 20) combat.apply({ kind: 'endTurn' });
  expect(combat.activeId).toBe(actorId);
}

describe('species traits', () => {
  it('dwarven resilience resists poison damage', () => {
    const dwarf = character('fighter', 'dwarf', 'team1', 0, 0);
    const enemy = character('fighter', 'human', 'team2', 7, 7);
    const combat = new Combat({ seed: 1, combatants: [dwarf, enemy] });

    applyDamage(combat.state, dwarf.id, enemy.id, 5, 'poison');
    expect(combat.state.combatants[dwarf.id]!.hp).toBe(dwarf.maxHp - 2);
  });

  it('human inspiration grants and consumes attack advantage', () => {
    const human = character('fighter', 'human', 'team1', 3, 3);
    const enemy = character('fighter', 'dwarf', 'team2', 3, 4);
    const combat = new Combat({ seed: 2, combatants: [human, enemy] });
    takeTurn(combat, human.id);

    combat.apply({ kind: 'useFeature', featureId: 'heroic-inspiration' });
    const source = collectAttackSources(combat.state, combat.state.combatants[human.id]!, combat.state.combatants[enemy.id]!, WEAPONS.longsword!, true);
    expect(source.adv).toContain('heroic inspiration');
    combat.apply({ kind: 'attack', weaponId: 'longsword', targetId: enemy.id });
    expect(combat.state.combatants[human.id]!.conditions.some((c) => c.id === 'inspired')).toBe(false);
    expect(combat.state.combatants[human.id]!.featureUses['heroic-inspiration']).toEqual({ current: 0, max: 1 });
  });

  it('an orc can bonus-action dash, gain temporary HP, and absorb damage', () => {
    const orc = character('fighter', 'orc', 'team1', 0, 0);
    const enemy = character('fighter', 'human', 'team2', 7, 7);
    const combat = new Combat({ seed: 3, combatants: [orc, enemy] });
    takeTurn(combat, orc.id);

    combat.apply({ kind: 'useFeature', featureId: 'adrenaline-rush' });
    expect(combat.state.combatants[orc.id]!.turn.bonusActionUsed).toBe(true);
    expect(combat.state.combatants[orc.id]!.turn.movementMax).toBe(60);
    expect(combat.state.combatants[orc.id]!.tempHp).toBe(2);
    applyDamage(combat.state, orc.id, enemy.id, 3, 'slashing');
    expect(combat.state.combatants[orc.id]!.tempHp).toBe(0);
    expect(combat.state.combatants[orc.id]!.hp).toBe(orc.maxHp - 1);
  });

  it('relentless endurance keeps an orc at 1 HP once per encounter', () => {
    const orc = character('fighter', 'orc', 'team1', 0, 0);
    const enemy = character('fighter', 'human', 'team2', 7, 7);
    const combat = new Combat({ seed: 4, combatants: [orc, enemy] });

    applyDamage(combat.state, orc.id, enemy.id, orc.maxHp, 'slashing');
    expect(combat.state.combatants[orc.id]!.hp).toBe(1);
    expect(combat.state.combatants[orc.id]!.alive).toBe(true);
    expect(combat.state.combatants[orc.id]!.featureUses['relentless-endurance']).toEqual({ current: 0, max: 1 });
    // Once it's spent, the next hit takes the orc to 0 — but this orc is a
    // player character, and characters drop unconscious there rather than dying.
    // Relentless Endurance buys one more moment on its feet, not immortality.
    applyDamage(combat.state, orc.id, enemy.id, 1, 'slashing');
    const downed = combat.state.combatants[orc.id]!;
    expect(downed.alive).toBe(true);
    expect(downed.hp).toBe(0);
    expect(isDown(downed)).toBe(true);
    expect(downed.conditions.some((c) => c.id === 'unconscious')).toBe(true);
  });

  it('Trance prevents Sleep from applying its magical incapacitation', () => {
    const caster = character('wizard', 'human', 'team1', 2, 2);
    const elf = character('fighter', 'elf', 'team2', 3, 3);
    const combat = new Combat({ seed: 5, combatants: [caster, elf] });

    SPELLS.sleep!.cast({ state: combat.state, casterId: caster.id, slotLevel: 1, targetIds: [], positions: [{ x: 3, y: 3 }] });
    expect(combat.state.combatants[elf.id]!.conditions.some((c) => c.id === 'incapacitated')).toBe(false);
  });
});