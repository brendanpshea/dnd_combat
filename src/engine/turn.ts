/**
 * Initiative, turn start/end, round advance. Mutates draft state; step() owns
 * cloning.
 */
import type { GameState, Combatant, Id } from './types.js';
import { abilityMod } from './types.js';
import { rollDie, coinFlip } from './rng.js';
import type { GameEvent } from './events.js';

export function rollInitiative(state: GameState): GameEvent[] {
  const entries: Array<{ id: Id; initiative: number; dex: number; tiebreak: number }> = [];
  for (const c of Object.values(state.combatants)) {
    const d = rollDie(state.rng, 20);
    state.rng = d.state;
    // Seeded tiebreak so equal-init, equal-dex ordering stays deterministic.
    const t = coinFlip(state.rng);
    state.rng = t.state;
    const initiative = d.value + abilityMod(c.abilities.dex);
    c.initiative = initiative;
    entries.push({ id: c.id, initiative, dex: c.abilities.dex, tiebreak: t.value ? 1 : 0 });
  }
  entries.sort((a, b) =>
    b.initiative - a.initiative || b.dex - a.dex || b.tiebreak - a.tiebreak || a.id.localeCompare(b.id),
  );
  state.initiativeOrder = entries.map((e) => e.id);
  state.turnIndex = 0;
  state.round = 1;
  return [
    { type: 'combatStarted', order: entries.map((e) => ({ id: e.id, initiative: e.initiative })) },
    { type: 'roundStarted', round: 1 },
    ...startTurn(state),
  ];
}

export function currentCombatant(state: GameState): Combatant {
  return state.combatants[state.initiativeOrder[state.turnIndex]!]!;
}

/** Reset economy, expire own-turn conditions, run repeat saves at turn END (handled in endTurn). */
export function startTurn(state: GameState): GameEvent[] {
  const c = currentCombatant(state);
  const events: GameEvent[] = [];

  // Dodging and noReactions last until the start of the owner's next turn.
  for (const cond of c.conditions) {
    if (cond.id === 'dodging' || cond.id === 'noReactions') {
      events.push({ type: 'conditionRemoved', combatantId: c.id, condition: cond.id });
    }
  }
  c.conditions = c.conditions.filter((k) => k.id !== 'dodging' && k.id !== 'noReactions');

  c.turn = {
    actionUsed: false,
    bonusActionUsed: false,
    reactionUsed: false,
    movementUsed: 0,
    movementMax: c.conditions.some((k) => k.id === 'unconscious') ? 0 : c.speed,
    disengaged: false,
    sneakAttackUsed: false,
  };
  events.push({ type: 'turnStarted', combatantId: c.id, round: state.round });
  return events;
}

/**
 * End the current turn (running end-of-turn repeat saves) and advance to the
 * next living combatant, bumping the round when the order wraps.
 */
export function endTurn(state: GameState, runRepeatSaves: (state: GameState, id: Id) => GameEvent[]): GameEvent[] {
  const events: GameEvent[] = [];
  const ending = currentCombatant(state);
  events.push(...runRepeatSaves(state, ending.id));
  events.push({ type: 'turnEnded', combatantId: ending.id });

  if (state.winner) return events;

  const n = state.initiativeOrder.length;
  for (let i = 1; i <= n; i++) {
    const idx = (state.turnIndex + i) % n;
    const next = state.combatants[state.initiativeOrder[idx]!]!;
    if (!next.alive) continue;
    if (idx <= state.turnIndex) {
      state.round += 1;
      events.push({ type: 'roundStarted', round: state.round });
    }
    state.turnIndex = idx;
    events.push(...startTurn(state));
    return events;
  }
  return events; // no living combatants — combat already ended
}
