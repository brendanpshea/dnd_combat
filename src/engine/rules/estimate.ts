/**
 * How much damage an action is likely to do — for putting choices in order.
 *
 * WHAT THIS IS FOR
 *
 * Tapping an enemy opens a list of everything you could do to it. Measured over
 * sixty battles with real campaign parties, that list has a median of four
 * entries and reaches nine; a fighter's is six essentially every turn. It
 * arrived in whatever order `legalActions` emitted, which put a wizard's dagger
 * and a fighter's Sacred Flame ahead of the thing they should obviously be
 * doing. Reported from a session with a young player as overwhelming, and as
 * encouraging bad plays.
 *
 * So this exists to SORT a list. It is not the AI's evaluator: `src/ai` scores
 * by team-relative value and carries policy — resource attitudes, variety,
 * target worth — none of which belongs in the order a player's buttons appear
 * in. It answers one narrow question, the same one the player asks: if I do
 * this to that, roughly how much damage lands?
 *
 * WHY IT RUNS THE ACTION INSTEAD OF PRICING IT
 *
 * The obvious implementation is a damage formula per action kind. That formula
 * already exists twice — once in the engine that resolves the action, and once
 * in `src/ai/greedy.ts`, which restates the dice of some sixty spells by hand
 * in a switch. A third copy in the UI layer would be a third thing to keep in
 * step, and the first to go stale, because nothing about a wrong menu ORDER
 * ever fails loudly.
 *
 * `step` is already pure — it clones the state, resolves the action properly
 * and hands back the events. So this asks the engine. Every rider comes along
 * for free and correctly: sneak attack, smites, resistance and immunity, bane
 * weapons, advantage from a prone target, multiattack, a spell's save-for-half.
 * A spell added tomorrow is priced the day it is added, by its own `cast`.
 *
 * The cost is that dice are rolled rather than averaged, so a single run is a
 * sample. `SAMPLES` runs are averaged, each from a fixed seed derived from the
 * action, which makes the result deterministic: the same board and the same
 * choice always produce the same number, so the buttons do not reshuffle
 * between renders.
 *
 * WHAT IT CANNOT SEE, said plainly because the ordering inherits it: control.
 * Hold Person and Sleep deal no damage and so score zero, sorting below a
 * dagger. That is the known cost of "expected damage" as a first sort key.
 * Nothing is hidden by it — the UI folds rather than drops, and says how many —
 * but a better key would price a failed save on a caster.
 */
import type { GameState, Id } from '../types.js';
import { seedRng } from '../rng.js';
import { step, type Action } from '../actions.js';

/**
 * Runs per estimate, and this number was measured rather than picked.
 *
 * Dice mean one run is a sample. Measured over 2605 real chooser builds
 * (`scripts/chooser-load.ts`), what a sample count buys is stability in the top
 * option when the same choices are on offer two turns running:
 *
 *     3 samples: 6.8% reshuffle, p90 2.3ms per call
 *     5 samples: 6.1%,           p90 ~3.5ms
 *     9 samples: 6.0%,           p90 5.7ms, worst case 30.7ms
 *
 * Five, because nine buys 0.1 points of stability for nearly double the cost,
 * and this runs on every state change, on a phone. The floor is not sampling
 * noise at all — an unranked list reshuffles 1.0% of the time under the same
 * test, and the remaining ~5 points are the tactical situation genuinely
 * changing, which the ordering SHOULD follow.
 */
const SAMPLES = 5;

/** A stable seed per action, so the same choice always scores the same. */
function seedFor(action: Action, run: number): number {
  let h = 2166136261;
  const key = `${JSON.stringify(action)}#${run}`;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Expected damage to hostiles from doing `action`, or 0 for anything that deals
 * none.
 *
 * Zero is an honest answer, not a failure: Disengage, a shove and Hold Person
 * all deal no damage, and this function's contract is damage. A caller ordering
 * a menu by it has to decide what to do with the ties — see `actionGroups.ts`,
 * which keeps them in their original order so the list does not reshuffle under
 * the player's thumb.
 *
 * Damage to the actor's OWN side is subtracted, so a fireball that would catch
 * two allies does not sort to the top on raw numbers.
 */
export function expectedDamage(state: GameState, actorId: Id, action: Action): number {
  const actor = state.combatants[actorId];
  if (!actor) return 0;
  let total = 0;
  for (let run = 0; run < SAMPLES; run++) {
    // A fresh seed per run, on a state `step` will clone anyway. Writing rng
    // here is safe for exactly that reason — the caller's state is untouched.
    const probe: GameState = { ...state, rng: seedRng(seedFor(action, run)) };
    let dealt = 0;
    try {
      for (const e of step(probe, action).events) {
        if (e.type !== 'damageDealt') continue;
        const victim = state.combatants[e.targetId];
        if (!victim) continue;
        dealt += victim.team === actor.team ? -e.amount : e.amount;
      }
    } catch {
      // An action that will not resolve scores nothing rather than taking the
      // menu down with it. `step` throws on an illegal action, and the caller
      // is passing a list the engine itself produced, so this is a guard
      // against future divergence rather than an expected path.
      return 0;
    }
    total += dealt;
  }
  return total / SAMPLES;
}
