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
 * Runs per estimate, chosen against ACCURACY — which is not what it was chosen
 * against the first time, and that was the bug.
 *
 * The original count was picked by measuring STABILITY: how often the top
 * option changes between turns. Five samples looked fine on that measure, and
 * a badly-sampled estimate is perfectly stable, because the seeds are fixed. It
 * shipped ordering Fire Bolt above Shocking Grasp in melee, and a level-1
 * wizard's Fire Bolt scoring exactly 0.00 — five fixed seeds, five misses,
 * permanently, for that action on that board.
 *
 * `scripts/estimate-accuracy.ts` measures the right thing: how often the best
 * option is not the one shown first, against the same estimator run 400 times.
 * Only the materially-wrong cases count — putting one of two interchangeable
 * attacks first is not a defect — so the bar is "the best option is more than
 * 10% better than the one chosen". Two disjoint sets of battles:
 *
 *      5 samples: 2.7% / 3.9% wrong
 *     15 samples: 0.3% / 1.0%
 *     30 samples: 0.9% / 0.0%
 *
 * Fifteen. The same table before the attack roll was computed rather than
 * sampled read 12.0% / 5.8% at five and 7.4% / 8.7% at forty — WORSE with more
 * samples, reproducibly, because the seed set is fixed and global, so its own
 * skew is a systematic bias rather than noise that averages out. That is worth
 * knowing about this whole approach: more samples is not automatically better.
 *
 * Cost, measured over 2605 real chooser builds: p90 6.1ms, worst case 25.6ms
 * per call, once per state change. The five-sample version's worst case was
 * 30.7ms, so the accuracy is not being bought with latency.
 */
const SAMPLES = 15;

/**
 * The seed for one run.
 *
 * COMMON RANDOM NUMBERS: the seed depends on the run index and NOT on the
 * action, so every option in a chooser is scored against the same dice. This is
 * the difference between comparing two attacks and comparing two strings of
 * luck. Seeding per action — which is what shipped — gave each option its own
 * fixed, private run of bad or good rolls, and because the seed was fixed the
 * bad run never averaged out: a level-1 wizard's Fire Bolt missed on all five
 * of its seeds, scored exactly 0.00, and sorted below a dagger for good.
 *
 * `salt` exists so a caller that wants a genuinely independent estimate (the
 * accuracy harness computing ground truth) can get one.
 */
function seedFor(run: number, salt: number): number {
  let h = 2166136261 ^ salt;
  const key = `#${run}`;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Chance a d20 + `bonus` beats `ac`, with the nat-1/nat-20 bounds. */
function hitChance(bonus: number, ac: number, mode: string): number {
  const p = Math.min(0.95, Math.max(0.05, (21 + bonus - ac) / 20));
  if (mode === 'advantage') return 1 - (1 - p) * (1 - p);
  if (mode === 'disadvantage') return p * p;
  return p;
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
export function expectedDamage(
  state: GameState, actorId: Id, action: Action,
  opts: { samples?: number; salt?: number } = {},
): number {
  const actor = state.combatants[actorId];
  if (!actor) return 0;
  const samples = opts.samples ?? SAMPLES;
  const salt = opts.salt ?? 0;
  let total = 0;
  // Rao-Blackwellisation of the attack roll — see the note below.
  let hits = 0, hitDamage = 0, pHit = 0, rolls = 0;
  for (let run = 0; run < samples; run++) {
    // A fresh seed per run, on a state `step` will clone anyway. Writing rng
    // here is safe for exactly that reason — the caller's state is untouched.
    const probe: GameState = { ...state, rng: seedRng(seedFor(run, salt)) };
    let dealt = 0;
    let runRolls = 0, runHits = 0, runP = 0;
    try {
      for (const e of step(probe, action).events) {
        if (e.type === 'attackRolled') {
          // `total - natural` recovers the attack bonus exactly, whatever built
          // it, so the hit chance can be computed instead of observed.
          runP += hitChance(e.total - e.natural, e.targetAc, e.mode);
          runRolls++;
          if (e.hit) runHits++;
          continue;
        }
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
    rolls += runRolls;
    hits += runHits;
    pHit += runP;
    if (runHits > 0) hitDamage += dealt;
    // An early-out for actions that deal no damage was tried here — a shove or
    // Hunter's Mark otherwise costs fifteen full resolutions to confirm zero,
    // and it was worth about 1.5ms of p90. It is not here because I could not
    // demonstrate it was safe: the obvious form (no attack roll, no damage on
    // run 0) measured WORSE on the accuracy harness, 0.3%/1.0% -> 1.0%/5.1%,
    // and I could not reproduce which actions it was zeroing. A guard I cannot
    // characterise is not worth 1.5ms.
  }

  /**
   * THE ATTACK ROLL IS COMPUTED, NOT OBSERVED.
   *
   * Sampling whole resolutions is what makes this correct for every rider, and
   * also what made it unusable: the d20 is a Bernoulli with a range of the full
   * damage die, so the variance of a five-run mean dwarfed the differences it
   * had to rank. Measured on a level-1 wizard beside an orc, the truth is
   * Shocking Grasp 4.48 against Fire Bolt 3.85 — a 16% gap — and a five-run
   * estimate of Fire Bolt alone ranged 2.80 to 6.20 across seeds. It ordered
   * them backwards, which is exactly what was reported.
   *
   * `attackRolled` carries `total`, `natural`, `targetAc` and `mode`, so
   * `total - natural` recovers the attack bonus exactly, whatever built it, and
   * the hit chance follows analytically. Averaging the hit/miss coin out of the
   * estimate and keeping the sampled part only for damage-given-a-hit is
   * textbook Rao-Blackwellisation: same expectation, strictly less variance.
   *
   * Only for actions that roll to hit. A save-for-half spell has no attack roll
   * and keeps the plain sampled mean, which is fine — its damage varies far
   * less, having no all-or-nothing term.
   */
  if (rolls > 0 && hits > 0) {
    const meanP = pHit / rolls;
    const meanDamageGivenHit = hitDamage / hits;
    return meanP * meanDamageGivenHit * (rolls / samples);
  }
  return total / samples;
}
