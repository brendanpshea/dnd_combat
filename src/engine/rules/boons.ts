/**
 * A fight's boons and banes, put on as it starts (see rules/modifiers.ts for
 * what they are and the half that is read on every roll).
 *
 * Run once from startCombat, before initiative: each modifier is logged as one
 * line, then whatever it does at the start is done — a condition (after a save,
 * if it has one), temporary hit points, and the suppressed resistances,
 * immunities and regeneration taken off. Advantage, disadvantage and extra
 * damage need nothing here; they are read where the rolls are made.
 */
import type { ActiveCondition, GameState } from '../types.js';
import type { GameEvent } from '../events.js';
import { applyCondition } from './conditions.js';
import { savingThrow } from './saves.js';
import { applySuppression, describeModifier, reaches } from './modifiers.js';

export function applyFightModifiers(state: GameState): GameEvent[] {
  const modifiers = state.modifiers ?? [];
  if (modifiers.length === 0) return [];
  const events: GameEvent[] = [];
  const everyone = Object.values(state.combatants).filter((c) => c.alive);
  for (const m of modifiers) {
    const reached = everyone.filter((c) => reaches(m.target, c));
    events.push({
      type: 'fightModifier', source: m.source, text: m.text ?? describeModifier(state, m),
      combatantIds: reached.map((c) => c.id),
    });
    const e = m.effect;
    if (e.kind === 'condition') {
      for (const c of reached) {
        if (e.save) {
          const save = savingThrow(state, c.id, e.save.ability, e.save.dc, { magical: false });
          events.push(save.event);
          if (save.success) continue;
        }
        const cond: ActiveCondition = {
          id: e.condition, lasting: true,
          // Holds through round N, and is gone as its holder's turn in N+1 starts.
          ...(e.rounds !== undefined ? { expiresAtRound: e.rounds } : {}),
          ...(e.repeatSave && e.save ? { repeatSave: { ability: e.save.ability, dc: e.save.dc, magical: false } } : {}),
          ...(e.escapeDc !== undefined ? { escape: { dc: e.escapeDc, skills: ['athletics', 'acrobatics'] } } : {}),
        };
        events.push(...applyCondition(state, c.id, cond, { magical: false }));
      }
    } else if (e.kind === 'tempHp') {
      // Temporary hit points don't stack: the larger pool stands.
      for (const c of reached) c.tempHp = Math.max(c.tempHp ?? 0, e.amount);
    }
  }
  for (const c of everyone) applySuppression(state, c);
  return events;
}
