import { describe, it, expect } from 'vitest';
import { Combat } from '../src/engine/combat.js';
import { buildCharacter } from '../src/builder/character.js';
import { groupActions, buildMultiAction, posKey } from '../web/src/actionGroups.js';
import type { Combatant, Position } from '../src/engine/types.js';

function place(classId: string, team: 'team1' | 'team2', position: Position, over: Partial<Combatant> = {}): Combatant {
  const c = buildCharacter({ classId, team, position, level: 3 });
  return { ...c, ...over, id: over.id ?? c.id };
}

function until(c: Combat, id: string) {
  let guard = 0;
  while (c.activeId !== id && guard++ < 60) c.apply({ kind: 'endTurn' });
  expect(c.activeId).toBe(id);
}

describe('web action grouping', () => {
  it('splits moves, per-target taps, and bar entries; everything applies legally', () => {
    const c = new Combat({
      seed: 4,
      combatants: [
        place('wizard', 'team1', { x: 3, y: 3 }, { id: 'wiz' }),
        place('fighter', 'team1', { x: 4, y: 3 }, { id: 'ally' }),
        place('fighter', 'team2', { x: 3, y: 4 }, { id: 'foe', hp: 1000, maxHp: 1000 }),
      ],
    });
    until(c, 'wiz');
    const grouped = groupActions(c.state, 'wiz', c.legalActions());

    // Moves exist and are keyed by cell.
    expect(grouped.moves.size).toBeGreaterThan(0);
    for (const [k, a] of grouped.moves) {
      expect(a.kind).toBe('move');
      if (a.kind === 'move') expect(posKey(a.to)).toBe(k);
    }

    // The adjacent foe is tappable with several options (staff, cantrips...).
    const foeOptions = grouped.perTarget.get('foe')!;
    expect(foeOptions.length).toBeGreaterThanOrEqual(3);
    expect(foeOptions.every((o) => 'action' in o)).toBe(true);

    // Bar contains stances, area spells with cell targets, and multi-target spells.
    const ids = grouped.bar.map((b) => b.id);
    expect(ids).toContain('dash');
    expect(ids).toContain('spell:sleep');
    const sleep = grouped.bar.find((b) => b.id === 'spell:sleep')!;
    expect(sleep.cellTargets!.size).toBeGreaterThan(0);
    const mm = grouped.bar.find((b) => b.id === 'spell:magic-missile')!;
    expect(mm.multi).toBeDefined();
    expect(mm.multi!.maxTargets).toBe(3);
    expect(mm.multi!.allowRepeats).toBe(true);
    expect(mm.multi!.validIds.has('foe')).toBe(true);
    expect(mm.multi!.validIds.has('ally')).toBe(false);

    // A built multi-action is accepted by the engine.
    const events = c.apply(buildMultiAction(mm.multi!, ['foe', 'foe', 'foe']));
    expect(events.filter((e) => e.type === 'damageDealt')).toHaveLength(3);
  });

  it('area cell targets apply legally (sleep anchor)', () => {
    const c = new Combat({
      seed: 6,
      combatants: [
        place('wizard', 'team1', { x: 0, y: 0 }, { id: 'wiz' }),
        place('fighter', 'team2', { x: 5, y: 5 }, { id: 'foe' }),
      ],
    });
    until(c, 'wiz');
    const grouped = groupActions(c.state, 'wiz', c.legalActions());
    const sleep = grouped.bar.find((b) => b.id === 'spell:sleep')!;
    const [, action] = [...sleep.cellTargets!][0]!;
    const events = c.apply(action);
    expect(events.some((e) => e.type === 'savingThrow')).toBe(true);
  });

  it('ally taps offer heals (cleric adjacent to wounded fighter)', () => {
    const c = new Combat({
      seed: 8,
      combatants: [
        place('cleric', 'team1', { x: 0, y: 0 }, { id: 'clr' }),
        place('fighter', 'team1', { x: 1, y: 0 }, { id: 'ally', hp: 2 }),
        place('rogue', 'team2', { x: 7, y: 7 }, { id: 'foe' }),
      ],
    });
    until(c, 'clr');
    const grouped = groupActions(c.state, 'clr', c.legalActions());
    const allyOptions = grouped.perTarget.get('ally')!;
    const labels = allyOptions.map((o) => o.label);
    expect(labels).toContain('Cure Wounds');
    expect(labels).toContain('Potion of Healing');
  });
});
