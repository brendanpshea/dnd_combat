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
import { immuneToCondition, wardedAgainstMagicalBinding, isDown, isIncapacitated } from '../types.js';
import { distanceFeet } from '../grid.js';
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

/**
 * Grappling (SRD 5.2.1).
 *
 * A grapple is a `grappled` condition carrying who holds it, with what part and
 * at what range, and its escape DC. The rules that follow from it live in one
 * place each: speed 0 in startTurn, the disadvantage in collectAttackSources,
 * the Escape action in actions.ts, and the ways it ends below.
 *
 * Not modelled: dragging. The SRD lets a grappler haul its catch along at half
 * speed; here a grappler that walks out of range simply lets go. The AI gains
 * nothing by walking away from something it is holding, so this bites rarely,
 * and doing it properly means moving two creatures through one path.
 */
export interface GrappleSpec {
  /** Escape DC. */
  dc: number;
  /** The weapon id doing the holding, or 'unarmed'. One creature per part. */
  via: Id;
  /** Range in feet; the grapple ends beyond it. */
  range: number;
  /** "…and has the Restrained condition until the grapple ends." */
  restrains?: boolean;
}

/** Grapple `targetId`. Returns the events (none if it cannot be held). */
export function grapple(
  state: GameState, grapplerId: Id, targetId: Id, spec: GrappleSpec,
): GameEvent[] {
  const target = state.combatants[targetId];
  if (!target || target.conditions.some((k) => k.id === 'grappled' && k.sourceId === grapplerId)) return [];
  const events = applyCondition(state, targetId, {
    id: 'grappled', sourceId: grapplerId,
    escape: { dc: spec.dc, skills: ['athletics', 'acrobatics'] },
    grapple: { via: spec.via, range: spec.range },
  }, { magical: false });
  if (events.length > 0 && spec.restrains) {
    events.push(...applyCondition(state, targetId, {
      id: 'restrained', sourceId: grapplerId, whileGrappledBy: grapplerId,
    }, { magical: false }));
  }
  return events;
}

/** End the grapple `grapplerId` has on `target`, and anything that rode on it. */
export function endGrapple(target: Combatant, grapplerId: Id): GameEvent[] {
  return removeConditions(target, (k) =>
    (k.id === 'grappled' && k.sourceId === grapplerId) || k.whileGrappledBy === grapplerId);
}

/** Who `grapplerId` is holding with `via`, if anyone. */
export function heldWith(state: GameState, grapplerId: Id, via: Id): Combatant | undefined {
  return Object.values(state.combatants).find((c) => c.conditions.some(
    (k) => k.id === 'grappled' && k.sourceId === grapplerId && k.grapple?.via === via));
}

/**
 * Let go of every grapple the rules say has ended: the grappler is gone, down
 * or incapacitated, or the two are further apart than the hold reaches.
 * Called after every action and at the start of every turn, so no path that
 * moves or disables a creature has to remember to.
 */
export function releaseBrokenGrapples(state: GameState): GameEvent[] {
  const events: GameEvent[] = [];
  for (const held of Object.values(state.combatants)) {
    for (const k of held.conditions.filter((x) => x.id === 'grappled')) {
      const by = k.sourceId !== undefined ? state.combatants[k.sourceId] : undefined;
      const broken = !by || !by.alive || isDown(by) || isIncapacitated(by) || !held.alive ||
        distanceFeet(by.position, held.position) > (k.grapple?.range ?? 5);
      if (broken) events.push(...endGrapple(held, k.sourceId ?? ''));
    }
  }
  return events;
}
