/**
 * Initiative, turn start/end, round advance. Mutates draft state; step() owns
 * cloning.
 */
import type { GameState, Combatant, Id, TeamId } from './types.js';
import { cellAt } from './types.js';
import { abilityMod, isDown } from './types.js';
import { rollDie, coinFlip } from './rng.js';
import { rollD20 } from './dice.js';
import { rollDice } from './dice.js';
import { expireIllusions, distanceFeet, distanceCells, reachable, sphere2x2 } from './grid.js';
import { executeMove, hostileIds } from './rules/movement.js';
import type { Position } from './types.js';
import { discoverHidden } from './rules/hide.js';
import { FEATURES } from '../data/features.js';
import { activateSummons, strikeLightning, burnInMoonbeam } from '../data/spells.js';
import { savingThrow } from './rules/saves.js';
import { applyDamage } from './rules/attack.js';
import { applyHealing } from './rules/heal.js';
import type { GameEvent } from './events.js';

/**
 * Sweep every summon whose duration has run out, whoever owns it. Concentration
 * -held summons are not touched — breakConcentration owns those.
 */
function expireSummonsOnClock(state: GameState): GameEvent[] {
  const events: GameEvent[] = [];
  for (const c of Object.values(state.combatants)) {
    if (!c.summons?.length) continue;
    const live = [];
    for (const s of c.summons) {
      if (s.expiresAtRound !== undefined && state.round > s.expiresAtRound) {
        events.push({ type: 'summonExpired', casterId: c.id, kind: s.kind, position: { ...s.position } });
      } else {
        live.push(s);
      }
    }
    c.summons = live;
  }
  return events;
}

/** A hard ceiling on battle length. Real fights end well inside ~15 rounds;
 *  this only ever fires on a pathological stall, to guarantee termination. */
export const MAX_ROUNDS = 100;

export function rollInitiative(state: GameState): GameEvent[] {
  const entries: Array<{ id: Id; initiative: number; dex: number; tiebreak: number }> = [];
  for (const c of Object.values(state.combatants)) {
    // Remarkable Athlete (Champion 3): advantage on Initiative.
    const athlete = c.featureIds.includes('remarkable-athlete');
    const d = athlete ? rollD20(state.rng, 'advantage') : rollDie(state.rng, 20);
    state.rng = d.state;
    // Seeded tiebreak so equal-init, equal-dex ordering stays deterministic.
    const t = coinFlip(state.rng);
    state.rng = t.state;
    const initiative = ('natural' in d ? d.natural : d.value) + abilityMod(c.abilities.dex);
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

/**
 * Where the next bolt from a held storm cloud should land: the 2x2 patch
 * catching the most enemy hit points, and none of the caster's own side.
 * Undefined when no patch catches anyone — the storm rumbles and holds.
 */
function bestLightningSpot(state: GameState, caster: Combatant): Position | undefined {
  let best: Position | undefined;
  let bestHp = 0;
  for (const other of Object.values(state.combatants)) {
    if (!other.alive || isDown(other) || other.team === caster.team) continue;
    if (distanceFeet(caster.position, other.position) > 120) continue;
    // Anchor the patch on each candidate enemy and see what else it sweeps up.
    let hp = 0;
    let friendly = false;
    for (const pos of sphere2x2(other.position)) {
      const tid = cellAt(state.grid, pos)?.occupantId;
      if (!tid) continue;
      const t = state.combatants[tid]!;
      if (!t.alive || isDown(t)) continue;
      if (t.team === caster.team) { friendly = true; break; }
      hp += t.hp;
    }
    if (!friendly && hp > bestHp) { bestHp = hp; best = other.position; }
  }
  return best;
}

export function currentCombatant(state: GameState): Combatant {
  return state.combatants[state.initiativeOrder[state.turnIndex]!]!;
}

/** Reset economy, expire own-turn conditions, run repeat saves at turn END (handled in endTurn). */
export function startTurn(state: GameState): GameEvent[] {
  const c = currentCombatant(state);
  const events: GameEvent[] = [...discoverHidden(state, c.id)];

  // Dodging, noReactions and Shield last until the start of the owner's next
  // turn. A fixed-duration Blind (Color Spray: no save to end it early) is the
  // same shape, so it rides the same clock — but only when it has no
  // `repeatSave`: Blindness the spell applies the same condition id with a
  // repeat save instead, and that flavor must survive here and expire only
  // through the generic save-ends machinery (runEndOfTurnSaves).
  const selfClearing = (k: { id: string; repeatSave?: unknown }) =>
    k.id === 'dodging' || k.id === 'noReactions' || k.id === 'shielded' ||
    (k.id === 'blinded' && !k.repeatSave);
  for (const cond of c.conditions) {
    if (selfClearing(cond)) events.push({ type: 'conditionRemoved', combatantId: c.id, condition: cond.id });
  }
  c.conditions = c.conditions.filter((k) => !selfClearing(k));

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
  // Haste: double speed (before prone/restrained/slowed apply their own
  // reductions on top, same as any other speed-affecting condition would).
  if (!helpless && c.conditions.some((k) => k.id === 'hasted')) speed *= 2;
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
  // Incapacitated (e.g. the first stage of Sleep): takes no actions and no
  // movement — it just stands there until its end-of-turn save. Without this it
  // kept full speed and the AI would walk it around before rolling to wake.
  if (c.conditions.some((k) => k.id === 'incapacitated')) speed = 0;
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
    colossusUsed: false,
  };
  // The caster's summons act on their own: the Spiritual Weapon hammer and the
  // Flaming Sphere chase the nearest enemy and strike, and anything out of
  // duration winks out — all before the caster lifts a finger.
  events.push(...activateSummons(state, c.id));
  if (!c.alive || state.winner) {
    // A summon can't kill its own caster, but its damage events run the full
    // rule set (win check included) — bail out cleanly if the fight just ended.
    events.push({ type: 'turnStarted', combatantId: c.id, round: state.round });
    return events;
  }

  // Luring Song: the victim spends its turn walking toward the singer. That is
  // the whole effect — not "wanders off", which is what removing it from the
  // fight modelled. It stays on the board, it is drawn into the middle of the
  // harpies, and its friends can reach it.
  const lure = c.conditions.find((k) => k.id === 'lured');
  if (lure?.sourceId) {
    const singer = state.combatants[lure.sourceId];
    if (singer?.alive && distanceFeet(c.position, singer.position) > 5) {
      const reach = reachable(state.grid, c.position, speed, hostileIds(state, c), undefined);
      // The closest cell to the singer this turn's movement can actually pay
      // for. Pathing, not a straight line, so walls route it around.
      let best: Position | undefined;
      let bestDist = distanceCells(c.position, singer.position);
      for (const [k, cost] of reach.costs) {
        if (cost > speed) continue;
        const [x, y] = k.split(',').map(Number);
        const p = { x: x!, y: y! };
        // Reachable, but somebody may be standing there — a route may pass
        // through an ally and this is a destination, not a waypoint.
        if (cellAt(state.grid, p)?.occupantId !== undefined) continue;
        const d = distanceCells(p, singer.position);
        if (d < bestDist) { bestDist = d; best = p; }
      }
      if (best) events.push(...executeMove(state, c.id, best));
    }
  }
  if (!c.alive || state.winner) {
    events.push({ type: 'turnStarted', combatantId: c.id, round: state.round });
    return events;
  }

  // Regeneration (troll): heal at the start of the turn, unless acid or fire
  // has landed since the last one. A suppressed trait costs exactly one turn of
  // healing and then re-arms, so burning a troll is something the party has to
  // keep doing rather than do once.
  if (c.regeneration && c.hp > 0) {
    if (c.regeneration.suppressed) {
      c.regeneration.suppressed = false;
    } else if (c.hp < c.maxHp) {
      events.push(...applyHealing(state, c.id, c.id, c.regeneration.amount));
    }
  }

  // Whatever this creature is holding, it is also digesting: everyone it has
  // restrained takes its hold damage now. Read off the condition's source
  // rather than a list on the holder, so a victim who wriggles free by making
  // the repeat save stops taking it with no extra bookkeeping.
  if (c.holdDamage && c.hp > 0) {
    for (const other of Object.values(state.combatants)) {
      if (!other.alive || other.hp <= 0 || other.team === c.team) continue;
      if (!other.conditions.some((k) => k.id === 'restrained' && k.sourceId === c.id)) continue;
      const dmg = rollDice(state.rng, c.holdDamage.dice);
      state.rng = dmg.state;
      events.push(...applyDamage(state, other.id, c.id, dmg.total, c.holdDamage.type, dmg.rolls));
    }
  }

  // Moonbeam: anyone starting a turn in someone's beam burns.
  for (const other of Object.values(state.combatants)) {
    if (!other.moonbeam || !other.alive || other.team === c.team) continue;
    events.push(...burnInMoonbeam(state, other.id, c.id));
    if (!c.alive || isDown(c)) break;
  }

  // Call Lightning: the cloud the druid is holding drops another bolt, on
  // whichever patch of ground catches the most enemies. Aimed automatically for
  // the same reason a dragon's breath is — the storm has to pick a spot and no
  // action is being taken to choose one.
  if (c.stormCloud && c.hp > 0 && !isDown(c)) {
    const spot = bestLightningSpot(state, c);
    if (spot) events.push(...strikeLightning(state, c.id, spot));
  }

  // Recharge abilities (dragon breath): a spent one rolls a d6 and comes back
  // on a result at or above its threshold. Only spent features roll, so a
  // creature that never uses its breath consumes no RNG.
  for (const fid of c.featureIds) {
    const threshold = FEATURES[fid]?.recharge;
    const pool = c.featureUses[fid];
    if (threshold === undefined || !pool || pool.current > 0) continue;
    const roll = rollDie(state.rng, 6);
    state.rng = roll.state;
    if (roll.value >= threshold) {
      pool.current = pool.max;
      events.push({ type: 'recharged', combatantId: c.id, featureId: fid });
    }
  }

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
  // Advancing can need more than one hop. A creature can die *inside* its own
  // startTurn -- Spiritual Guardians burns it down before it ever acts -- and
  // it would then sit there as the active combatant, dead, with no legal
  // action able to move the fight on: not even endTurn, which requires a live
  // actor. That is a softlock, and it only shows up when a slow monster ends
  // its approach inside the aura. So the scan below runs until it lands on
  // someone actually able to take a turn.
  for (let hop = 0; hop <= n; hop++) {
    let moved = false;
    for (let i = 1; i <= n; i++) {
      const idx = (state.turnIndex + i) % n;
      const next = state.combatants[state.initiativeOrder[idx]!]!;
      if (!next.alive || isDown(next)) continue;
      if (idx <= state.turnIndex) {
        state.round += 1;
        for (const p of expireIllusions(state.grid, state.round)) {
          events.push({ type: 'illusionPopped', position: p });
        }
        // Duration-held summons expire on the clock, for everyone, here.
        //
        // The sweep used to live only in activateSummons, which runs at the
        // start of the *caster's* turn — and a caster who is down is skipped in
        // initiative entirely (see the guard above). So a cleric who went down
        // holding a Spiritual Weapon left it hovering on the board for the rest
        // of the fight: its clock had run out, nothing was coming to read it,
        // and breakConcentration doesn't touch it because a Spiritual Weapon is
        // held by duration rather than concentration. Even for a caster still
        // standing, the lazy sweep left an expired weapon on screen for up to a
        // full round after it should have winked out.
        events.push(...expireSummonsOnClock(state));
        events.push({ type: 'roundStarted', round: state.round });
        // Termination guard: a real fight ends inside ~15 rounds; anything past
        // MAX_ROUNDS is a pathological stall (two sides that can't finish each
        // other, e.g. a zombie surviving on Undead Fortitude while nothing lands
        // radiant). Force a result so the game never hangs — the side with more
        // standing HP wins, ties to team2 so a campaign party retries rather than
        // gets an unearned pass.
        if (state.round > MAX_ROUNDS && !state.winner) {
          const standingHp = (team: TeamId) => Object.values(state.combatants)
            .filter((cc) => cc.alive && cc.hp > 0 && cc.team === team)
            .reduce((sum, cc) => sum + cc.hp, 0);
          const winner: TeamId = standingHp('team1') > standingHp('team2') ? 'team1' : 'team2';
          state.winner = winner;
          events.push({ type: 'combatEnded', winner });
          return events;
        }
      }
      state.turnIndex = idx;
      events.push(...startTurn(state));
      moved = true;
      break;
    }
    if (!moved) return events;   // no living combatants — combat already ended
    if (state.winner) return events;
    const active = currentCombatant(state);
    if (active.alive && !isDown(active)) return events;
  }
  return events;
}
