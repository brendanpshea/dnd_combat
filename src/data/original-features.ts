/**
 * The abilities of the original creatures in `original-creatures.ts`: this
 * game's own, released to the public domain (CC0 1.0). They are written from
 * the SRD 5.2.1's plain rules — a saving throw against a condition, an attack
 * that is hard to land — and merged into `FEATURES` by features.ts.
 *
 * (Their breath weapons live with the other breath weapons: features.ts reads
 * them from `ORIGINAL_BREATH` and gives each its apply hook.)
 */
import type { Ability, ConditionId, Id } from '../engine/types.js';
import { abilityMod, proficiencyBonus } from '../engine/types.js';
import { distanceFeet } from '../engine/grid.js';
import { savingThrow } from '../engine/rules/saves.js';
import { applyCondition } from '../engine/rules/conditions.js';
import type { GameEvent } from '../engine/events.js';
import type { FeatureContext, FeatureData } from './features.js';

/**
 * A gaze: every enemy within `range` feet makes a `saveAbility` save against
 * 8 + proficiency + the owner's `dcAbility` modifier, and a failure gains
 * `condition`, save ends (the same save, at the end of each of its turns).
 */
function gazeApply(range: number, dcAbility: Ability, saveAbility: Ability, condition: ConditionId) {
  return ({ state, actorId }: FeatureContext): GameEvent[] => {
    const me = state.combatants[actorId]!;
    const dc = 8 + proficiencyBonus(me.level) + abilityMod(me.abilities[dcAbility]);
    const events: GameEvent[] = [];
    for (const t of Object.values(state.combatants)) {
      if (!t.alive || t.hp <= 0 || t.team === me.team) continue;
      if (distanceFeet(me.position, t.position) > range) continue;
      if (t.conditions.some((c) => c.id === condition)) continue;
      const { success, event } = savingThrow(state, t.id, saveAbility, dc, { magical: false });
      events.push(event);
      if (!success) {
        events.push(...applyCondition(state, t.id, {
          id: condition, sourceId: actorId, repeatSave: { ability: saveAbility, dc },
        }, { magical: false }));
      }
    }
    return events;
  };
}

export const ORIGINAL_FEATURES: Record<Id, FeatureData> = {
  // Shimmer Hide (Shimmerpard): attack rolls against it have Disadvantage until
  // it is hit, and again from its next turn — read in attack.ts beside the
  // Cloak of Displacement, whose trick it is.
  'shimmer-hide': { id: 'shimmer-hide', name: 'Shimmer Hide', trigger: 'passive' },
  // Lulling Gaze (Viperveil): a Bonus Action, Recharge 5-6. Each enemy within
  // 30 feet makes a Constitution save (DC 8 + proficiency + Charisma) or is
  // Paralyzed, save ends.
  'lulling-gaze': {
    id: 'lulling-gaze', name: 'Lulling Gaze', trigger: 'bonus', recharge: 5,
    apply: gazeApply(30, 'cha', 'con', 'paralyzed'),
  },
};
