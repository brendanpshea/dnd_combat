/**
 * Simulation AI: scores actions by actually running them through the pure
 * step() on sampled RNG streams and evaluating the resulting states with the
 * generic evaluator. Contains no knowledge of any specific spell, feature,
 * or item — new content is valued through its simulated consequences.
 *
 * Planning is a small beam search over this turn's action sequence; only the
 * first action is returned (we re-plan after every action anyway).
 */
import type { GameState, Id, TeamId } from '../engine/types.js';
import { legalActions, step, Action } from '../engine/actions.js';
import { currentCombatant } from '../engine/turn.js';
import { seedRng } from '../engine/rng.js';
import { evaluate } from './evaluate.js';

export interface SimOptions {
  /** RNG samples averaged per action candidate. */
  samples: number;
  /** Beam width for the in-turn sequence search. */
  beam: number;
  /** Max in-turn actions to look ahead (endTurn always terminates). */
  depth: number;
  /** Move destinations considered per node (pruned by evaluation). */
  moveCandidates: number;
}

/**
 * Skip verbs — Dodge, Disengage, Dash, Hide — spend the action without doing
 * anything *to* the enemy. Their payoff is a defensive state the evaluator
 * prices directly, while an attack's payoff is a sampled roll that might miss,
 * so in any close call the safe non-action wins and a unit dodges instead of
 * swinging, round after round. A flat toll encodes the standing preference for
 * acting against the enemy: they must clear a real bar, not merely tie.
 */
const ACTION_COST = 1.0;
/**
 * Movement must also justify itself, or a unit whose neighbouring cells all
 * evaluate the same (e.g. two cells both adjacent to its target) shuffles back
 * and forth until its movement runs out — a zero-value move would otherwise
 * tie with endTurn and win the sort. Kept well under the ~0.9/cell an actual
 * approach gains, so charging into range is unaffected.
 */
const MOVE_COST = 0.15;

export const SIM_PRESETS: Record<'easy' | 'normal' | 'hard', SimOptions> = {
  easy: { samples: 1, beam: 2, depth: 1, moveCandidates: 3 },
  normal: { samples: 3, beam: 3, depth: 2, moveCandidates: 5 },
  hard: { samples: 5, beam: 5, depth: 3, moveCandidates: 7 },
};

/**
 * Deterministic sample seeds derived from the state's RNG and the action
 * being tried. Deliberately NOT the game's actual stream: the AI estimates
 * expectations, it never peeks at the real next roll.
 *
 * (A common-random-numbers variant — sharing seeds across candidate actions —
 * was tried and measurably weakened play in the arena; per-action streams
 * stay.)
 */
function sampleSeed(base: number, actionKey: number, sample: number): number {
  let h = (base ^ 0x9e3779b9) >>> 0;
  h = (Math.imul(h, 2654435761) ^ (actionKey * 40503 + sample * 69427)) >>> 0;
  return seedRng(h);
}

function actionKey(a: Action): number {
  const s = JSON.stringify(a);
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0;
  return h;
}

/** Average post-action evaluation over RNG samples; returns one sampled state to continue from. */
function scoreAction(
  state: GameState,
  action: Action,
  team: TeamId,
  samples: number,
): { meanV: number; next: GameState } {
  let total = 0;
  let representative: GameState | undefined;
  const key = actionKey(action);
  for (let s = 0; s < samples; s++) {
    const seeded: GameState = { ...state, rng: sampleSeed(state.rng, key, s) };
    const { state: after } = step(seeded, action);
    total += evaluate(after, team);
    if (s === 0) representative = after;
  }
  return { meanV: total / samples, next: representative! };
}

interface Node {
  state: GameState;
  /** evaluate(state) — cached so children can compute deltas. */
  stateV: number;
  /** The planned action sequence from the root (plan[0] is what we'd play). */
  plan: Action[];
  /**
   * Sum of per-action expected deltas from the root. Scoring by accumulated
   * expectations (not the sampled end-state) keeps beam-max from selecting
   * lucky-sample fantasy lines.
   */
  pathScore: number;
  done: boolean; // turn has passed on (or combat ended)
}


function candidateActions(state: GameState, actorId: Id, opts: SimOptions, team: TeamId): Action[] {
  const all = legalActions(state, actorId);
  const moves = all.filter((a) => a.kind === 'move');
  const rest = all.filter((a) => a.kind !== 'move');
  if (moves.length <= opts.moveCandidates) return all;
  // Prune moves cheaply: evaluate with the actor's position swapped, no
  // simulation (ignores opportunity attacks — fine for candidate selection;
  // the surviving candidates are properly simulated by the search).
  const actor = state.combatants[actorId]!;
  const scored = moves.map((m) => {
    if (m.kind !== 'move') throw new Error();
    const shallow: GameState = {
      ...state,
      combatants: { ...state.combatants, [actorId]: { ...actor, position: m.to } },
    };
    return { m, v: evaluate(shallow, team) };
  });
  scored.sort((a, b) => b.v - a.v);
  return [...scored.slice(0, opts.moveCandidates).map((s) => s.m), ...rest];
}

/** Pick the current combatant's next action by simulated beam search. */
export function chooseActionSim(state: GameState, actorId: Id, opts: SimOptions = SIM_PRESETS.normal): Action {
  const me = state.combatants[actorId]!;
  const team = me.team;
  const rootV = evaluate(state, team);

  const expand = (node: { state: GameState; stateV: number; pathScore: number; plan: Action[] }): Node[] => {
    const out: Node[] = [];
    const actions = candidateActions(node.state, actorId, opts, team);
    for (const action of actions) {
      const { meanV, next } = scoreAction(node.state, action, team, opts.samples);
      const done =
        next.winner !== null ||
        action.kind === 'endTurn' ||
        currentCombatant(next).id !== actorId;
      // The "skip" verbs (Disengage/Dodge/Dash) don't change the board, so a
      // pointless one evaluates ~= ending the turn and beam-max would pick it
      // arbitrarily. A small cost makes it lose to ending unless a follow-up
      // move/attack in the same plan justifies it. Moves and attacks are NOT
      // charged — penalizing them makes melee refuse to approach (approaching
      // raises self-threat) and games stall.
      const wasteCost =
        action.kind === 'dash' || action.kind === 'disengage' ||
        action.kind === 'dodge' || action.kind === 'hide'
          ? ACTION_COST
          : action.kind === 'move' ? MOVE_COST : 0;
      out.push({
        state: next,
        stateV: evaluate(next, team),
        plan: [...node.plan, action],
        pathScore: node.pathScore + (meanV - node.stateV) - wasteCost,
        done,
      });
    }
    return out;
  };

  // Seed the beam with every candidate first action.
  let beam: Node[] = expand({ state, stateV: rootV, pathScore: 0, plan: [] });
  beam.sort((a, b) => b.pathScore - a.pathScore);
  beam = beam.slice(0, opts.beam);

  // Extend the beam through the rest of the turn.
  for (let d = 1; d < opts.depth; d++) {
    const grown: Node[] = [];
    for (const node of beam) {
      if (node.done) {
        grown.push(node);
        continue;
      }
      grown.push(...expand(node));
    }
    grown.sort((a, b) => b.pathScore - a.pathScore);
    beam = grown.slice(0, opts.beam);
    if (beam.every((n) => n.done)) break;
  }

  // (A refinement pass re-scoring finalists with more samples was tried in
  // two variants; both measurably weakened arena play. Trust the beam.)
  return beam[0]?.plan[0] ?? { kind: 'endTurn' };
}
