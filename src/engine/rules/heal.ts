/**
 * The one place hit points go up.
 *
 * Healing used to be five separate `t.hp += amount` lines — a spell helper, a
 * potion, Second Wind, Preserve Life, Aid — which was harmless while healing
 * only meant a number. It stopped being harmless the moment healing had to
 * *revive* a downed hero: "a potion doesn't wake him but Cure Wounds does"
 * is precisely the bug nobody finds for a month. So every path routes here.
 */
import type { GameState, Id } from '../types.js';
import type { GameEvent } from '../events.js';

/**
 * Restore up to `amount` HP, and stand a downed creature back up.
 *
 * A downed creature is `alive` with 0 HP, so *any* healing revives it — the
 * rule is simply "it has hit points again". Sleep is untouched by this: a
 * sleeping creature is above 0, so it never hits the revive path and healing
 * doesn't wake it (only damage or a shake does).
 *
 * The dead stay dead; nothing here resurrects.
 */
export function applyHealing(state: GameState, targetId: Id, sourceId: Id, amount: number): GameEvent[] {
  const t = state.combatants[targetId];
  if (!t || !t.alive) return [];

  const wasDowned = t.hp === 0;
  const healed = Math.max(0, Math.min(amount, t.maxHp - t.hp));
  t.hp += healed;

  const events: GameEvent[] = [{ type: 'healed', targetId, sourceId, amount: healed }];
  if (wasDowned && t.hp > 0) {
    for (const c of t.conditions) {
      if (c.id === 'unconscious' || c.id === 'prone') {
        events.push({ type: 'conditionRemoved', combatantId: targetId, condition: c.id });
      }
    }
    t.conditions = t.conditions.filter((c) => c.id !== 'unconscious' && c.id !== 'prone');
    events.push({ type: 'revived', combatantId: targetId, hp: t.hp });
  }
  return events;
}

/**
 * Drop a creature to 0 without killing it: unconscious, prone, out of the fight
 * until someone heals it. Only for `unconsciousAtZero` creatures — a monster at
 * 0 dies as before.
 *
 * It keeps its square. A body is in the way, allies can already move through
 * their own, and leaving it on the board is the entire point: you can see who
 * is down and go and get them.
 */
export function downCombatant(state: GameState, combatantId: Id): GameEvent[] {
  const c = state.combatants[combatantId]!;
  c.hp = 0;
  // Whatever it was suffering stops mattering; being down outranks all of it,
  // and stale timers must not tick away underneath a downed hero.
  c.conditions = [
    { id: 'unconscious', sourceId: combatantId },
    { id: 'prone', sourceId: combatantId },
  ];
  c.turn.attacksLeft = 0;
  return [{ type: 'downed', combatantId }];
}
