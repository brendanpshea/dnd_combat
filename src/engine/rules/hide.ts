/** Hide, direct-target visibility, and turn-start passive discovery. */
import type { Combatant, GameState, Id } from '../types.js';
import { abilityMod, proficiencyBonus } from '../types.js';
import { rollD20 } from '../dice.js';
import { hasLineOfSight } from '../grid.js';
import { CLASSES } from '../../data/classes.js';
import type { GameEvent } from '../events.js';

export function hiddenCondition(c: Combatant) {
  return c.conditions.find((condition) => condition.id === 'hidden');
}

export function isHidden(c: Combatant): boolean {
  return hiddenCondition(c) !== undefined;
}

/** A creature can Hide only if every living enemy currently lacks line of sight. */
export function canHide(state: GameState, actor: Combatant): boolean {
  if (isHidden(actor)) return false;
  return !Object.values(state.combatants).some(
    (other) => other.alive && other.team !== actor.team && hasLineOfSight(state.grid, other.position, actor.position),
  );
}

function stealthBonus(c: Combatant): number {
  const cls = CLASSES[c.classId];
  const proficient = cls?.skillProfs.includes('stealth') ?? false;
  return abilityMod(c.abilities.dex) + (proficient ? proficiencyBonus(c.level) : 0);
}

/** Spend Hide's action or bonus action and make its flat DC 15 Stealth check. */
export function attemptHide(state: GameState, actorId: Id): GameEvent[] {
  const actor = state.combatants[actorId]!;
  const d20 = rollD20(state.rng, 'flat');
  state.rng = d20.state;
  const total = d20.natural + stealthBonus(actor);
  const success = total >= 15;
  const events: GameEvent[] = [{ type: 'hideCheck', combatantId: actorId, natural: d20.natural, total, success }];
  if (success) {
    actor.conditions.push({ id: 'hidden', sourceId: actorId, hideCheck: total });
    events.push({ type: 'conditionApplied', combatantId: actorId, condition: 'hidden', sourceId: actorId });
  }
  return events;
}

/** End Hide and emit the matching observable event if it was active. */
export function endHide(c: Combatant): GameEvent[] {
  if (!isHidden(c)) return [];
  c.conditions = c.conditions.filter((condition) => condition.id !== 'hidden');
  return [{ type: 'conditionRemoved', combatantId: c.id, condition: 'hidden' }];
}

/** Passive Perception with advantage: 10 + Wisdom modifier + 5. */
function passivePerceptionWithAdvantage(observer: Combatant): number {
  return 15 + abilityMod(observer.abilities.wis);
}

/** A successful observer reveals that hidden target to every enemy at once. */
export function discoverHidden(state: GameState, observerId: Id): GameEvent[] {
  const observer = state.combatants[observerId]!;
  const events: GameEvent[] = [];
  for (const target of Object.values(state.combatants)) {
    if (!target.alive || target.team === observer.team) continue;
    const hidden = hiddenCondition(target);
    if (!hidden || hidden.hideCheck === undefined) continue;
    if (!hasLineOfSight(state.grid, observer.position, target.position)) continue;
    const passivePerception = passivePerceptionWithAdvantage(observer);
    if (passivePerception > hidden.hideCheck) {
      events.push({ type: 'hiddenRevealed', combatantId: target.id, observerId, passivePerception, hideCheck: hidden.hideCheck });
      events.push(...endHide(target));
    }
  }
  return events;
}