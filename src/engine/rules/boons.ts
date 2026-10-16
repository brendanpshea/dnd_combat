/**
 * A fight's boons and banes, put on as it starts (see rules/modifiers.ts for
 * what they are and the half that is read on every roll), and the damage the
 * sun and running water do to the creatures with those weaknesses.
 *
 * Run once from startCombat, before initiative: each modifier is logged as one
 * line, then whatever it does at the start is done — a condition (after a save,
 * if it has one), temporary hit points, and the suppressed resistances,
 * immunities and regeneration taken off. Advantage, disadvantage and extra
 * damage need nothing here; they are read where the rolls are made.
 */
import type { ActiveCondition, GameState, Id } from '../types.js';
import { isDown } from '../types.js';
import type { GameEvent } from '../events.js';
import { applyCondition } from './conditions.js';
import { savingThrow } from './saves.js';
import { applyDamage } from './attack.js';
import { applySuppression, describeModifier, inRunningWater, inSunlight, reaches } from './modifiers.js';

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

/**
 * "The vampire takes 20 Radiant damage if it starts its turn in sunlight"
 * (SRD 5.2.1, Vampire Weakness). From startTurn; nothing unless the fight is
 * in sunlight and the creature has the weakness.
 */
export function sunlightBurn(state: GameState, id: Id): GameEvent[] {
  const c = state.combatants[id];
  const amount = c?.weaknesses?.sunlight?.damage;
  if (!c || !amount || !c.alive || isDown(c) || !inSunlight(state, c)) return [];
  return applyDamage(state, id, id, amount, 'radiant', [], { magical: false, tags: ['Sunlight'] });
}

/**
 * "The vampire takes 20 Acid damage if it ends its turn in running water"
 * (SRD 5.2.1). From endTurn; the board's water (`Cell.water`) runs only when
 * the fight says so.
 */
export function runningWaterBurn(state: GameState, id: Id): GameEvent[] {
  const c = state.combatants[id];
  const hurt = c?.weaknesses?.runningWater;
  if (!c || !hurt || !c.alive || isDown(c) || !inRunningWater(state, c)) return [];
  return applyDamage(state, id, id, hurt.damage, hurt.type, [], { magical: false, tags: ['Running Water'] });
}
