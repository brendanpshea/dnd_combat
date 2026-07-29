/**
 * Initiative, turn start/end, round advance. Mutates draft state; step() owns
 * cloning.
 */
import type { GameState, Combatant, Id, TeamId, GridState } from './types.js';
import { cellAt } from './types.js';
import { abilityMod, isDown } from './types.js';
import { rollDie, coinFlip } from './rng.js';
import { rollD20 } from './dice.js';
import { rollDice } from './dice.js';
import { expireIllusions, expireChill, distanceFeet, distanceCells, reachable, sphere2x2 } from './grid.js';
import { executeMove, hostileIds } from './rules/movement.js';
import type { Position } from './types.js';
import { discoverHidden } from './rules/hide.js';
import { FEATURES } from '../data/features.js';
import { activateSummons, strikeLightning, burnInMoonbeam } from '../data/spells.js';
import { savingThrow } from './rules/saves.js';
import { applyDamage, charmAway, resolveAttack } from './rules/attack.js';
import { attackableWeapons } from './rules/equipment.js';
import { WEAPONS } from '../data/weapons.js';
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
    // Advantage on Initiative: Remarkable Athlete (Champion 3) and Feral
    // Instinct (Barbarian 7). Same effect, so one check rather than two.
    const quick = c.featureIds.includes('remarkable-athlete') ||
      c.featureIds.includes('feral-instinct');
    const d = quick ? rollD20(state.rng, 'advantage') : rollDie(state.rng, 20);
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

/** On the outermost ring of cells — one step from walking off the board. */
function atBoardEdge(grid: GridState, p: Position): boolean {
  return p.x === 0 || p.y === 0 || p.x === grid.width - 1 || p.y === grid.height - 1;
}

/**
 * The reachable cell that gets a fleeing creature closest to leaving.
 *
 * "Closest to the edge" rather than "furthest from the party": a creature
 * pinned in a corner by four heroes has nowhere to run *from* them, but it
 * always has an edge to run *to*, and the edge is what ends the effect. Ties
 * break toward whichever cell is further from the nearest enemy, so it does not
 * squeeze past the fighter when it could go round.
 */
function fleeDestination(state: GameState, c: Combatant, speed: number): Position | undefined {
  const grid = state.grid;
  const edgeDist = (p: Position): number =>
    Math.min(p.x, p.y, grid.width - 1 - p.x, grid.height - 1 - p.y);
  const foes = Object.values(state.combatants).filter((o) => o.alive && !isDown(o) && o.team !== c.team);
  const fromFoes = (p: Position): number =>
    foes.length === 0 ? 0 : Math.min(...foes.map((f) => distanceCells(p, f.position)));

  const reach = reachable(grid, c.position, speed, hostileIds(state, c), undefined);
  let best: Position | undefined;
  let bestEdge = edgeDist(c.position);
  let bestAway = fromFoes(c.position);
  for (const [k, cost] of reach.costs) {
    if (cost > speed) continue;
    const [x, y] = k.split(',').map(Number);
    const p = { x: x!, y: y! };
    if (cellAt(grid, p)?.occupantId !== undefined) continue;
    const e = edgeDist(p);
    const a = fromFoes(p);
    if (e < bestEdge || (e === bestEdge && a > bestAway)) {
      bestEdge = e; bestAway = a; best = p;
    }
  }
  return best;
}

/** Reset economy, expire own-turn conditions, run repeat saves at turn END (handled in endTurn). */
export function startTurn(state: GameState): GameEvent[] {
  const c = currentCombatant(state);
  // The Cloak of Displacement settles again at the start of its wearer's turn
  // (see Combatant.displacementBroken).
  c.displacementBroken = false;
  const events: GameEvent[] = [...discoverHidden(state, c.id)];

  // Dodging, noReactions and Shield last until the start of the owner's next
  // turn. A fixed-duration Blind (Color Spray: no save to end it early) is the
  // same shape, so it rides the same clock — but only when it has no
  // `repeatSave`: Blindness the spell applies the same condition id with a
  // repeat save instead, and that flavor must survive here and expire only
  // through the generic save-ends machinery (runEndOfTurnSaves).
  // Reckless Attack is the same clock, and that clock is the whole gamble: the
  // advantage is spent on this turn's swings, and every enemy in reach gets a
  // free round of hitting back at advantage before it lifts.
  const selfClearing = (k: { id: string; repeatSave?: unknown }) =>
    k.id === 'dodging' || k.id === 'noReactions' || k.id === 'shielded' ||
    k.id === 'reckless' ||
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
  const helpless = c.conditions.some(
    (k) => k.id === 'unconscious' || k.id === 'paralyzed' || k.id === 'stunned');
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
  // Spirit Guardians halves the Speed of anyone else standing in it — half
  // of what the spell does, and it was missing entirely. Applied here rather
  // than as a condition because the aura is a place, not a status: walking out
  // of it should not need anything to remember to take a condition off, and
  // walking into it mid-turn does not get you a refund on movement you already
  // spent. Measured from where the creature stands as its turn begins.
  if (!helpless && speed > 0) {
    for (const other of Object.values(state.combatants)) {
      if (!other.spiritualGuardians || !other.alive || other.team === c.team) continue;
      if (distanceFeet(c.position, other.position) > 15) continue;
      speed = Math.floor(speed / 2);
      break; // two overlapping auras do not quarter you
    }
  }
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
    leveledSpellCast: false,
    quickenedThisTurn: false,
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
  // Fleeing: Turn Undead and Suggestion used to delete the creature from the
  // board the instant the save failed, which reads as a kill with better
  // manners — the thing you spent your Channel Divinity on simply vanishes.
  // Now it runs. It spends its whole turn heading for the nearest edge, takes
  // no actions on the way (see cannotAct), and leaves the fight when it gets
  // there. That makes the effect legible: you watch it go, the party can chase
  // it down or let it run, and an ally standing in the doorway matters.
  //
  // Fleeing is written as movement rather than as a removal so that everything
  // movement already means still applies — walls route it, opportunity attacks
  // fire as it disengages from whoever it was fighting.
  const flee = c.conditions.find((k) => k.id === 'fleeing');
  if (flee) {
    if (atBoardEdge(state.grid, c.position)) {
      // Off the board. Not a death — the same not-a-kill exit Banishment uses,
      // told as a flight.
      events.push(...charmAway(state, c.id, 'fled', flee.sourceId));
    } else {
      const dest = fleeDestination(state, c, speed);
      if (dest) {
        events.push(...executeMove(state, c.id, dest));
      } else {
        // Nowhere to run: walled in, or somebody is standing in the only gap.
        // A cornered creature turns and fights rather than shuffling on the
        // spot for the rest of the battle — which is what it did while this
        // was being written: a skeleton sealed in an inner room stood still
        // through all 100 rounds until the round cap ended the fight.
        //
        // It also makes blocking the exit a real thing to do. Turn Undead buys
        // you the horde walking away; standing in the doorway is how the party
        // chooses to keep one and kill it instead.
        c.conditions = c.conditions.filter((k) => k !== flee);
        events.push({ type: 'conditionRemoved', combatantId: c.id, condition: 'fleeing' });
      }
      // Reaching the edge mid-move ends the flight now rather than costing it
      // another full round standing in the open.
      if (c.alive && atBoardEdge(state.grid, c.position)) {
        events.push(...charmAway(state, c.id, 'fled', flee.sourceId));
      }
    }
  }
  if (!c.alive || state.winner) {
    events.push({ type: 'turnStarted', combatantId: c.id, round: state.round });
    return events;
  }

  // Confusion: the spell's whole character, which was missing.
  //
  // What shipped applied `incapacitated` — a creature that stands there doing
  // nothing, i.e. a worse Hold Person on a 2x2. The reason anyone casts
  // Confusion is the chance the ogre turns round and hits the ogre next to it,
  // and none of that existed.
  //
  // The SRD rolls a d10 on a table each turn. This keeps the roll and the three
  // outcomes that matter on a grid, and drops the two that are about wandering
  // in a random direction — this board is eight squares wide and "moves
  // randomly" reads as a bug rather than as madness.
  //
  //   1-6   does nothing at all
  //   7-8   attacks whoever is in reach, WHICHEVER SIDE THEY ARE ON
  //   9-10  acts normally
  //
  // Resolved here rather than in the AI on purpose: friendly fire must happen
  // to monsters and heroes alike, and the AI is only one of the things that
  // drives a turn. A confused creature with nobody in reach simply loses the
  // turn, which is the honest reading of "attacks a creature within 5 feet".
  // Nothing to decide for a creature whose turn is already spoken for: Luring
  // Song walks it toward the singer and Fleeing runs it off the board, and both
  // take the whole turn.
  //
  // THIS BLOCK RUNS LAST FOR A REASON. It zeroes `turn.movementMax`, while the
  // planners above route against the local `speed` and `executeMove` validates
  // the result against `turn.movementMax`. Zeroing one before the other plans
  // its route throws "Illegal move" and kills the run — which it did, on a
  // fleeing skeleton that had been caught by Confusion. Sitting after every
  // planner means there is no ordering left to get wrong, rather than a guard
  // per planner that the next one to be added will not know to add itself to.
  const busyTurn = c.conditions.some((k) => k.id === 'fleeing' || k.id === 'lured');
  if (c.conditions.some((k) => k.id === 'confused') && !isDown(c) && !busyTurn) {
    const d10 = rollDice(state.rng, '1d10');
    state.rng = d10.state;
    if (d10.total <= 6) {
      c.turn.actionUsed = true;
      c.turn.bonusActionUsed = true;
      c.turn.movementMax = c.turn.movementUsed;
      events.push({ type: 'confusedTurn', combatantId: c.id, roll: d10.total, effect: 'nothing' });
    } else if (d10.total <= 8) {
      // Everyone in reach, allies included — that is the point of the spell.
      const inReach = Object.values(state.combatants).filter(
        (o) => o.id !== c.id && o.alive && !isDown(o) && distanceCells(c.position, o.position) <= 1,
      );
      const weaponId = attackableWeapons(c).find((w) => WEAPONS[w]?.melee);
      if (inReach.length > 0 && weaponId) {
        const pick = rollDie(state.rng, inReach.length);
        state.rng = pick.state;
        const victim = inReach[pick.value - 1]!;
        events.push({ type: 'confusedTurn', combatantId: c.id, roll: d10.total, effect: 'lashesOut', targetId: victim.id });
        events.push(...resolveAttack(state, c.id, victim.id, weaponId));
      } else {
        events.push({ type: 'confusedTurn', combatantId: c.id, roll: d10.total, effect: 'nothing' });
      }
      c.turn.actionUsed = true;
      c.turn.movementMax = c.turn.movementUsed;
    } else {
      events.push({ type: 'confusedTurn', combatantId: c.id, roll: d10.total, effect: 'normal' });
    }
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

  // Spirit Guardians: an enemy that starts its turn within 15 ft of an active
  // aura takes 3d8 radiant (+1d8 per slot level above 3), halved on a Wisdom
  // save. The SRD makes the save happen on entering the Emanation and on ending
  // a turn there as well, but only once per turn — start-of-turn is the one
  // moment this engine has a hook for, and taking it once is the same budget.
  for (const other of Object.values(state.combatants)) {
    if (!other.spiritualGuardians || !other.alive || other.team === c.team) continue;
    if (distanceFeet(c.position, other.position) > 15) continue;
    const save = savingThrow(state, c.id, 'wis', other.spiritualGuardians.dc);
    events.push(save.event);
    const dmg = rollDice(state.rng, other.spiritualGuardians.dice);
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
  // startTurn -- Spirit Guardians burns it down before it ever acts -- and
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
        expireChill(state.grid, state.round);
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
