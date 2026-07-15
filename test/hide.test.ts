import { describe, expect, it } from 'vitest';
import { Combat } from '../src/engine/combat.js';
import { buildCharacter } from '../src/builder/character.js';
import { buildMonster } from '../src/data/monsters.js';
import { cellAt } from '../src/engine/types.js';
import { isLegalAction } from '../src/engine/actions.js';
import { validTarget, SPELLS } from '../src/data/spells.js';
import { canHide } from '../src/engine/rules/hide.js';

function character(classId: string, team: 'team1' | 'team2', id: string, x: number, y: number, level = 1) {
  return { ...buildCharacter({ classId, team, position: { x, y }, level }), id };
}

function until(combat: Combat, actorId: string): void {
  let guard = 0;
  while (combat.activeId !== actorId && guard++ < 20) combat.apply({ kind: 'endTurn' });
  expect(combat.activeId).toBe(actorId);
}

function wallBetween(combat: Combat, x: number, y: number): void {
  cellAt(combat.state.grid, { x, y })!.terrain = 'wall';
}

describe('Hide', () => {
  it('requires breaking every enemy line of sight and spends an action to roll Stealth', () => {
    const rogue = character('rogue', 'team1', 'rogue', 2, 3);
    const enemy = character('fighter', 'team2', 'enemy', 4, 3);
    const visible = new Combat({ seed: 1, combatants: [rogue, enemy] });
    until(visible, rogue.id);
    expect(canHide(visible.state, visible.state.combatants[rogue.id]!)).toBe(false);
    expect(isLegalAction(visible.state, rogue.id, { kind: 'hide' })).toBe(false);

    const hidden = new Combat({ seed: 4, combatants: [rogue, enemy] });
    wallBetween(hidden, 3, 3);
    until(hidden, rogue.id);
    expect(isLegalAction(hidden.state, rogue.id, { kind: 'hide' })).toBe(true);
    const events = hidden.apply({ kind: 'hide' });
    expect(events.some((event) => event.type === 'hideCheck')).toBe(true);
    expect(hidden.state.combatants[rogue.id]!.turn.actionUsed).toBe(true);
    hidden.state.combatants[rogue.id]!.conditions.push({ id: 'hidden', hideCheck: 20 });
    expect(canHide(hidden.state, hidden.state.combatants[rogue.id]!)).toBe(false);
  });

  it('blocks direct attacks, targeted spells, and thrown items but not area spells', () => {
    const wizard = character('wizard', 'team1', 'wizard', 0, 0);
    const rogue = character('rogue', 'team2', 'rogue', 3, 3);
    const combat = new Combat({ seed: 2, combatants: [wizard, rogue] });
    combat.state.combatants[rogue.id]!.conditions.push({ id: 'hidden', hideCheck: 20 });
    until(combat, wizard.id);

    expect(isLegalAction(combat.state, wizard.id, { kind: 'attack', weaponId: 'quarterstaff', targetId: rogue.id })).toBe(false);
    expect(validTarget(combat.state, wizard.id, SPELLS['fire-bolt']!, rogue.id)).toBe(false);
    expect(isLegalAction(combat.state, wizard.id, {
      kind: 'castSpell', spellId: 'sleep', slotLevel: 1, targets: [{ position: { x: 3, y: 3 } }],
    })).toBe(true);
  });

  it('attacks from hiding have advantage and remove Hidden after the roll', () => {
    const rogue = character('rogue', 'team1', 'rogue', 3, 3);
    const enemy = character('fighter', 'team2', 'enemy', 3, 4);
    const combat = new Combat({ seed: 3, combatants: [rogue, enemy] });
    combat.state.combatants[rogue.id]!.conditions.push({ id: 'hidden', hideCheck: 20 });
    until(combat, rogue.id);

    const events = combat.apply({ kind: 'attack', weaponId: 'shortsword', targetId: enemy.id });
    const attack = events.find((event) => event.type === 'attackRolled');
    expect(attack?.type === 'attackRolled' && attack.advSources).toContain('hidden');
    expect(combat.state.combatants[rogue.id]!.conditions.some((condition) => condition.id === 'hidden')).toBe(false);
  });

  it('casting a spell breaks Hide and a seeing enemy can reveal it at turn start', () => {
    const wizard = character('wizard', 'team1', 'wizard', 0, 0);
    const enemy = character('fighter', 'team2', 'enemy', 4, 4);
    const combat = new Combat({ seed: 5, combatants: [wizard, enemy] });
    combat.state.combatants[wizard.id]!.conditions.push({ id: 'hidden', hideCheck: 20 });
    until(combat, wizard.id);
    combat.apply({ kind: 'castSpell', spellId: 'fire-bolt', slotLevel: 0, targets: [{ combatantId: enemy.id }] });
    expect(combat.state.combatants[wizard.id]!.conditions.some((condition) => condition.id === 'hidden')).toBe(false);

    combat.state.combatants[wizard.id]!.conditions.push({ id: 'hidden', hideCheck: 10 });
    until(combat, enemy.id);
    expect(combat.state.combatants[wizard.id]!.conditions.some((condition) => condition.id === 'hidden')).toBe(false);
  });

  it('gives Rogues and Goblins a bonus-action Hide when out of sight', () => {
    const rogue = character('rogue', 'team1', 'rogue', 2, 3, 2);
    const goblin = { ...buildMonster('goblin-warrior', 'team2', { x: 4, y: 3 }), id: 'goblin' };
    const combat = new Combat({ seed: 6, combatants: [rogue, goblin] });
    wallBetween(combat, 3, 3);

    until(combat, rogue.id);
    expect(isLegalAction(combat.state, rogue.id, { kind: 'useFeature', featureId: 'cunning-hide' })).toBe(true);
    combat.apply({ kind: 'useFeature', featureId: 'cunning-hide' });
    expect(combat.state.combatants[rogue.id]!.turn.bonusActionUsed).toBe(true);

    until(combat, goblin.id);
    expect(isLegalAction(combat.state, goblin.id, { kind: 'useFeature', featureId: 'nimble-hide' })).toBe(true);
  });
});