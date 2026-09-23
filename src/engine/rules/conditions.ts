/**
 * The one way a condition goes on, and the one way it comes off.
 *
 * Conditions used to be pushed straight onto `combatant.conditions` from some
 * eighty places, each doing its own subset of the immunity checks and each
 * remembering (or not) to report it. That is how skeletons were poisoned by
 * Ray of Sickness, how a mummy's glare frightened a barbarian in a Mindless
 * Rage, and how a Ring of Free Action wearer was told they were restrained by a
 * web that never held them. Every immunity now lives here, so a new source of a
 * condition gets all of them by calling this — and a new immunity reaches every
 * source by being added here once.
 *
 * Two places still push directly, because they run before a fight state
 * exists: the camp buffs (Haste, Protection on the party) and the arena's
 * pre-fight check (blessed, frightened, sapped on either side). None of the
 * immunities above can apply there today — Mindless Rage is a player
 * barbarian's, and the check only frightens the wave — but a new pre-fight
 * effect that could be refused would need to call `conditionBlocked`.
 */
import type { ActiveCondition, Combatant, ConditionId, GameState, Id } from '../types.js';
import { immuneToCondition, wardedAgainstMagicalBinding } from '../types.js';
import { immuneToCharmAndFear, charmWarded } from './saves.js';
import type { GameEvent } from '../events.js';

/** The conditions Mindless Rage shrugs off: charm, and fear with its flight. */
const CHARM_OR_FEAR: ReadonlySet<ConditionId> = new Set(['charmed', 'lured', 'frightened', 'fleeing']);
/** The conditions Aura of Devotion keeps off its allies. */
const CHARM: ReadonlySet<ConditionId> = new Set(['charmed', 'lured']);

/**
 * Whether `id` cannot land on `c` at all.
 *
 * `magical` matters for one rule: Freedom of Movement and the Ring of Free
 * Action stop MAGICAL paralysis and restraint, not a spider's web-shot or a
 * roper's tendril — reading them as flat immunities would make the ring an
 * answer to half the bestiary's melee.
 */
export function conditionBlocked(
  state: GameState, c: Combatant, id: ConditionId, magical: boolean,
): boolean {
  if (immuneToCondition(c, id)) return true;
  if (CHARM_OR_FEAR.has(id) && immuneToCharmAndFear(c)) return true;
  if (CHARM.has(id) && charmWarded(state, c)) return true;
  if (magical && wardedAgainstMagicalBinding(c, id)) return true;
  return false;
}

/**
 * Put `cond` on `targetId`, unless something makes the target immune, and
 * report it. Returns the event (or nothing), for the caller to push.
 *
 * `magical` is required for the same reason it is on savingThrow: an optional
 * flag is one every caller forgets. `silent` is for the self-bookkeeping
 * conditions (a Dodge, a Shield) that have never been announced.
 */
export function applyCondition(
  state: GameState, targetId: Id, cond: ActiveCondition,
  opts: { magical: boolean; silent?: boolean },
): GameEvent[] {
  const target = state.combatants[targetId];
  if (!target || conditionBlocked(state, target, cond.id, opts.magical)) return [];
  target.conditions.push(cond);
  if (opts.silent) return [];
  return [{
    type: 'conditionApplied', combatantId: targetId, condition: cond.id,
    ...(cond.sourceId !== undefined ? { sourceId: cond.sourceId } : {}),
  }];
}

/**
 * Take every condition matching `which` off `target`, reporting each one
 * unless `silent`. `which` is an id, or a predicate for the finer cuts (only
 * this source's, only those held by concentration, one particular condition).
 *
 * The one way a condition comes off, as `applyCondition` is the one way on:
 * removals were thirty-odd hand-written filters, each deciding for itself
 * whether to tell anyone, and the badges and the log could not agree.
 * `silent` is kept for the per-roll markers (a Sap or an Inspiration spent by
 * the roll it modified), which the roll itself already reports. It takes the
 * combatant rather than the state because nothing about removal can be
 * refused, and some callers (a saving throw) only have the creature.
 */
export function removeConditions(
  target: Combatant,
  which: ConditionId | ((k: ActiveCondition) => boolean),
  opts: { silent?: boolean } = {},
): GameEvent[] {
  const match = typeof which === 'string' ? (k: ActiveCondition) => k.id === which : which;
  const gone = target.conditions.filter(match);
  if (gone.length === 0) return [];
  target.conditions = target.conditions.filter((k) => !match(k));
  if (opts.silent) return [];
  return gone.map((k) => ({ type: 'conditionRemoved' as const, combatantId: target.id, condition: k.id }));
}
