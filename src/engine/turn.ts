/**
 * Initiative, turn start/end, round advance. Mutates draft state; step() owns
 * cloning.
 */
import type { GameState, Combatant, Id } from './types.js';
import { abilityMod, isDown } from './types.js';
import { rollDie, coinFlip } from './rng.js';
import { rollDice } from './dice.js';
import { expireIllusions, distanceFeet } from './grid.js';
import { discoverHidden } from './rules/hide.js';
import { savingThrow } from './rules/saves.js';
import { applyDamage } from './rules/attack.js';
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
  const events: GameEvent[] = [...discoverHidden(state, c.id)];

  // Dodging and noReactions last until the start of the owner's next turn.
  for (const cond of c.conditions) {
    if (cond.id === 'dodging' || cond.id === 'noReactions') {
      events.push({ type: 'conditionRemoved', combatantId: c.id, condition: cond.id });
    }
  }
  c.conditions = c.conditions.filter((k) => k.id !== 'dodging' && k.id !== 'noReactions');

  // Expire round-limited conditions (e.g. Unconscious's 1-minute cap).
  for (const cond of c.conditions) {
    if (cond.expiresAtRound !== undefined && state.round > cond.expiresAtRound) {
      events.push({ type: 'conditionRemoved', combatantId: c.id, condition: cond.id });
    }
  }
  c.conditions = c.conditions.filter(
    (k) => k.expiresAtRound === undefined || state.round <= k.expiresAtRound,
  );

  c.hasActed = true;

  // Stand up from prone automatically for half speed — unless you're in no
  // condition to: a downed hero standing itself up every turn is nonsense, and
  // it would strip the prone that marks it as a body on the floor.
  const helpless = c.conditions.some((k) => k.id === 'unconscious' || k.id === 'paralyzed');
  let speed = helpless ? 0 : c.speed;
  // Command: the target grovels — drops prone and loses this whole turn (the
  // `commanded` condition blocks its actions, then clears at end of turn). It
  // stays on the ground; standing up waits for its following turn.
  if (c.conditions.some((k) => k.id === 'commanded')) {
    speed = 0;
    if (!c.conditions.some((k) => k.id === 'prone')) {
      c.conditions.push({ id: 'prone', sourceId: c.id });
      events.push({ type: 'conditionApplied', combatantId: c.id, condition: 'prone', sourceId: c.id });
    }
  } else if (!helpless && c.conditions.some((k) => k.id === 'prone')) {
    c.conditions = c.conditions.filter((k) => k.id !== 'prone');
    speed = Math.floor(speed / 2);
    events.push({ type: 'conditionRemoved', combatantId: c.id, condition: 'prone' });
  }
  // Web: a restrained creature can't move at all this turn.
  if (c.conditions.some((k) => k.id === 'restrained')) speed = 0;
  // Slow mastery: -10 ft this turn, then it clears (lasts to the start of the
  // slowed creature's next turn).
  if (c.conditions.some((k) => k.id === 'slowed')) {
    c.conditions = c.conditions.filter((k) => k.id !== 'slowed');
    speed = Math.max(0, speed - 10);
    events.push({ type: 'conditionRemoved', combatantId: c.id, condition: 'slowed' });
  }

  c.turn = {
    actionUsed: false,
    bonusActionUsed: false,
    reactionUsed: false,
    movementUsed: 0,
    movementMax: speed,
    disengaged: false,
    attackedThisTurn: false,
    attacksLeft: 0,
    interacted: false,
    sneakAttackUsed: false,
  };
  // Spiritual Weapon fades once its duration runs out.
  if (c.spiritualWeapon && state.round > c.spiritualWeapon.expiresAtRound) delete c.spiritualWeapon;

  // Spiritual Guardians: an enemy that starts its turn within 15 ft of an active
  // aura takes 3d8 radiant, halved on a Wisdom save.
  for (const other of Object.values(state.combatants)) {
    if (!other.spiritualGuardians || !other.alive || other.team === c.team) continue;
    if (distanceFeet(c.position, other.position) > 15) continue;
    const save = savingThrow(state, c.id, 'wis', other.spiritualGuardians.dc);
    events.push(save.event);
    const dmg = rollDice(state.rng, '3d8');
    state.rng = dmg.state;
    const amount = save.success ? Math.floor(dmg.total / 2) : dmg.total;
    if (amount > 0) events.push(...applyDamage(state, c.id, other.id, amount, 'radiant', dmg.rolls));
    if (!c.alive) break;
  }

  events.push({ type: 'turnStarted', combatantId: c.id, round: state.round });
  return events;
}

/**
 * End the current turn (running end-of-turn repeat saves) and advance to the
 * next combatant who can actually take one, bumping the round when the order
 * wraps.
 *
 * Downed heroes are skipped. They're alive, so they'd otherwise be handed a
 * turn in which the only legal action is to end it — dead air on the board, and
 * for a human player a "Sir Arthur's turn!" banner over a body that cannot do
 * anything. (There are no death saves here, so unlike 5e a downed hero's turn
 * has no content at all.) Sleep is deliberately not skipped: a slept creature
 * is above 0 HP, and its turn is where its repeat save is rolled.
 */
export function endTurn(state: GameState, runRepeatSaves: (state: GameState, id: Id) => GameEvent[]): GameEvent[] {
  const events: GameEvent[] = [];
  const ending = currentCombatant(state);
  events.push(...runRepeatSaves(state, ending.id));
  // Command lasts exactly the one turn it stole; clear it now (the target keeps
  // its prone until it stands on a later turn).
  if (ending.conditions.some((k) => k.id === 'commanded')) {
    ending.conditions = ending.conditions.filter((k) => k.id !== 'commanded');
    events.push({ type: 'conditionRemoved', combatantId: ending.id, condition: 'commanded' });
  }
  events.push({ type: 'turnEnded', combatantId: ending.id });

  if (state.winner) return events;

  const n = state.initiativeOrder.length;
  for (let i = 1; i <= n; i++) {
    const idx = (state.turnIndex + i) % n;
    const next = state.combatants[state.initiativeOrder[idx]!]!;
    if (!next.alive || isDown(next)) continue;
    if (idx <= state.turnIndex) {
      state.round += 1;
      for (const p of expireIllusions(state.grid, state.round)) {
        events.push({ type: 'illusionPopped', position: p });
      }
      events.push({ type: 'roundStarted', round: state.round });
    }
    state.turnIndex = idx;
    events.push(...startTurn(state));
    return events;
  }
  return events; // no living combatants — combat already ended
}
