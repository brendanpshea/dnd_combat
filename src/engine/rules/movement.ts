/**
 * Movement execution with opportunity attacks.
 */
import type { GameState, Combatant, Id, Position } from '../types.js';
import { cellAt, abilityMod, isDown, isIncapacitated, wardedAgainstMagicalBinding } from '../types.js';
import { blocksMovement, reachable, pathTo, adjacent, popIllusion, type StepDanger } from '../grid.js';
import { WEAPONS } from '../../data/weapons.js';
import { resolveAttack, applyDamage } from './attack.js';
import { savingThrow, saveForHalf } from './saves.js';
import { rollDice, parseDice } from '../dice.js';
import type { GameEvent } from '../events.js';

/** Damage for entering a hazard cell (fire pit, spikes...). */
export const HAZARD_DAMAGE = '1d4';

/**
 * Creatures that ignore the movement cost of difficult terrain: Boots of the
 * Winterlands and the Ring of Free Action, and burrowers/earth-gliders that
 * move through it.
 */
function ignoresDifficult(mover: Combatant): boolean {
  return (
    mover.featureIds.includes('boots-winterlands') ||
    mover.featureIds.includes('free-action') ||
    mover.featureIds.includes('burrow') ||
    mover.featureIds.includes('earth-glide')
  );
}

/**
 * Hostiles that actually stand in your way. A downed one doesn't: you step over
 * a body rather than being walled off by it — the mover still can't *end* on the
 * square (moveDestinations rejects any occupied cell), which is the real rule.
 *
 * Not a nicety. Bodies stay on the board now, and in a corridor a couple of
 * downed heroes sealed the map: the last enemy became physically unreachable and
 * the battle could never end.
 */
export function hostileIds(state: GameState, mover: Combatant): Set<Id> {
  return new Set(
    Object.values(state.combatants)
      .filter((c) => c.alive && !isDown(c) && c.team !== mover.team)
      .map((c) => c.id),
  );
}

/** Destinations the mover can legally end on with remaining movement. */
export function moveDestinations(state: GameState, mover: Combatant): Position[] {
  const budget = mover.turn.movementMax - mover.turn.movementUsed;
  if (budget <= 0) return [];
  const r = reachable(state.grid, mover.position, budget, hostileIds(state, mover), undefined, ignoresDifficult(mover));
  const out: Position[] = [];
  for (const k of r.costs.keys()) {
    const [x, y] = k.split(',').map(Number) as [number, number];
    const pos = { x, y };
    if (x === mover.position.x && y === mover.position.y) continue;
    const cell = cellAt(state.grid, pos)!;
    if (cell.occupantId !== undefined) continue; // can pass allies, not end on them
    out.push(pos);
  }
  return out;
}

/**
 * Rough expected damage of the two things a route can walk you into. Only
 * their *relative* size matters — they rank equal-length paths against each
 * other, nothing else — and a 1d4 hazard and a melee swing that lands about
 * half the time are genuinely close, so neither dominates.
 */
const HAZARD_DANGER = 2.5;   // 1d4, and certain
const PROVOKE_DANGER = 4;    // one opportunity attack, at roughly even odds

/**
 * The danger of each step, for picking between equal-length routes.
 *
 * A `move` action names a destination, not a route — the engine picks the walk
 * (see `Action`). So neither the AI nor the player can ask for the safe way
 * round: whatever this returns is the only say anyone gets. Blind, it would
 * stroll through a fire pit, or out of a fighter's reach, whenever the distance
 * tied — which is exactly what it did, to both players equally.
 */
function stepDanger(state: GameState, mover: Combatant): StepDanger {
  const threats = mover.turn.disengaged ? [] : [...hostileIds(state, mover)]
    .map((id) => state.combatants[id]!)
    .filter((h) => canTakeReaction(h) && meleeWeaponOf(h));
  return (from, to) => {
    let danger = 0;
    // Mirrors the provoke rule below exactly: you pay for *leaving* reach, so
    // sidestepping within it is free.
    for (const h of threats) {
      if (adjacent(h.position, from) && !adjacent(h.position, to)) danger += PROVOKE_DANGER;
    }
    if (cellAt(state.grid, to)!.terrain === 'hazard') danger += HAZARD_DANGER;
    return danger;
  };
}

/** A creature's first in-hand melee weapon, for opportunity attacks. */
function meleeWeaponOf(c: Combatant): Id | undefined {
  const hands = [c.equipped.mainHand, c.equipped.offHand];
  return hands.find((w): w is Id => !!w && w !== 'shield' && (WEAPONS[w]?.melee ?? false));
}

function canTakeReaction(c: Combatant): boolean {
  return (
    c.alive &&
    !isDown(c) &&
    !c.turn.reactionUsed &&
    !isIncapacitated(c) &&
    !c.conditions.some((k) => k.id === 'noReactions')
  );
}

/** Biggest damage roll `c` could land with `weaponId` on a normal hit. */
function maxHit(c: Combatant, weaponId: Id): number {
  const w = WEAPONS[weaponId];
  if (!w) return 0;
  const d = parseDice(w.damage);
  const ability = w.melee && !w.properties.includes('finesse') ? 'str' : 'dex';
  return d.count * d.sides + d.bonus + abilityMod(c.abilities[ability]) + (w.damageBonus ?? 0);
}

/**
 * The most damage `mover` could take walking to `to`: every opportunity attack
 * it provokes landing for maximum, plus every hazard it crosses. Measured along
 * the route the engine would actually walk (same tiebreak, same path).
 *
 * Crits are deliberately excluded — at ~5% they would make almost every step
 * look potentially fatal, and a rule that fires constantly is one that gets
 * tuned back out. This answers a narrow question: could a *normal* hit kill me?
 *
 * Lives here rather than in the AI because it is a fact about the rules, not a
 * policy: the same question the player asks before stepping away.
 */
export function worstCaseWalkDamage(state: GameState, mover: Combatant, to: Position): number {
  const budget = mover.turn.movementMax - mover.turn.movementUsed;
  const r = reachable(state.grid, mover.position, budget, hostileIds(state, mover), stepDanger(state, mover), ignoresDifficult(mover));
  const path = pathTo(r, mover.position, to);
  if (!path) return 0;

  const hazardMax = (() => { const d = parseDice(HAZARD_DAMAGE); return d.count * d.sides + d.bonus; })();
  const threats = mover.turn.disengaged ? [] : [...hostileIds(state, mover)]
    .map((id) => state.combatants[id]!)
    .filter((h) => canTakeReaction(h));

  let worst = 0;
  // One reaction each, so a hostile can only ever land a single opportunity
  // attack over the whole walk, however many times you cross its reach.
  const spent = new Set<Id>();
  for (let i = 1; i < path.length; i++) {
    const from = path[i - 1]!;
    const step = path[i]!;
    for (const h of threats) {
      if (spent.has(h.id)) continue;
      const weapon = meleeWeaponOf(h);
      if (!weapon) continue;
      if (adjacent(h.position, from) && !adjacent(h.position, step)) {
        worst += maxHit(h, weapon);
        spent.add(h.id);
      }
    }
    if (cellAt(state.grid, step)!.terrain === 'hazard') worst += hazardMax;
  }
  return worst;
}

/**
 * Execute a move to `to`, stepping cell by cell. Each step that leaves a
 * hostile's reach (without Disengage) provokes one opportunity attack from
 * that hostile. If the mover dies mid-path, movement stops.
 */
export function executeMove(state: GameState, moverId: Id, to: Position): GameEvent[] {
  const events: GameEvent[] = [];
  const mover = state.combatants[moverId]!;
  const budget = mover.turn.movementMax - mover.turn.movementUsed;
  const r = reachable(state.grid, mover.position, budget, hostileIds(state, mover), stepDanger(state, mover), ignoresDifficult(mover));
  const path = pathTo(r, mover.position, to);
  if (!path) throw new Error(`Illegal move for ${moverId} to ${to.x},${to.y}`);
  // Reachable is not the same as free to stand on: `reachable` deliberately
  // lets a route pass *through* an ally, and moveDestinations is what filters
  // the ones you may end on. A caller that skips that filter would land on top
  // of somebody and silently take their cell — two creatures on one square, and
  // the grid pointing at whichever arrived last. Forced movement (a harpy's
  // song) did exactly that, so the check belongs here rather than in every
  // caller that will ever pull someone about.
  const destination = cellAt(state.grid, to)!;
  if (destination.occupantId !== undefined && destination.occupantId !== moverId) {
    throw new Error(`Illegal move for ${moverId} to ${to.x},${to.y}: ${destination.occupantId} is standing there`);
  }
  const cost = r.costs.get(`${to.x},${to.y}`)!;

  // Leave the origin cell now; intermediate cells (which may belong to allies
  // we pass through) must not have their occupancy touched, or the grid
  // desyncs and other units can end up sharing a cell. Occupancy is claimed
  // once, on arrival.
  const originCell = cellAt(state.grid, mover.position)!;
  if (originCell.occupantId === moverId) delete originCell.occupantId;

  /**
   * Stop a mover part-way and put it somewhere it can actually stand.
   *
   * A route is allowed to pass *through* an ally — only the destination has to
   * be empty — so the cell a mover happens to be on when something interrupts
   * it may well be occupied. Claiming it regardless put two creatures on one
   * square and left the grid pointing at whichever arrived last. Back up along
   * the path already walked to the last free cell; the origin was vacated at
   * the top of this function, so there is always one.
   *
   * A corpse claims nothing (kill() has already cleared its cell), but it is
   * still moved somewhere sensible so it does not lie inside a living ally.
   */
  const stopShort = (): void => {
    for (let i = walked.length - 1; i >= 0; i--) {
      const here = walked[i]!;
      const occ = cellAt(state.grid, here)?.occupantId;
      if (occ === undefined || occ === moverId) {
        mover.position = here;
        if (mover.alive) cellAt(state.grid, here)!.occupantId = moverId;
        return;
      }
    }
  };

  const walked: Position[] = [path[0]!];
  for (let i = 1; i < path.length; i++) {
    const from = path[i - 1]!;
    const step = path[i]!;

    if (!mover.turn.disengaged) {
      for (const hid of hostileIds(state, mover)) {
        const h = state.combatants[hid]!;
        if (!canTakeReaction(h)) continue;
        const weapon = meleeWeaponOf(h);
        if (!weapon) continue;
        if (adjacent(h.position, from) && !adjacent(h.position, step)) {
          h.turn.reactionUsed = true;
          events.push(...resolveAttack(state, hid, moverId, weapon, { opportunity: true }));
          if (!mover.alive || isDown(mover)) {
            // Killed or dropped to 0 (unconscious): the mover stops where it
            // fell rather than walking on to claim the destination cell. A
            // kill clears occupancy; a downed body still occupies its cell.
            stopShort();
            events.unshift({ type: 'moved', combatantId: moverId, path: walked });
            return events;
          }
        }
      }
    }

    mover.position = step;
    walked.push(step);

    // Walking through an illusion reveals it — a physical creature passing
    // through proves there was nothing solid there. Either side's illusion,
    // either side's feet.
    if (popIllusion(state.grid, step)) {
      events.push({ type: 'illusionPopped', position: step });
    }

    if (cellAt(state.grid, step)!.terrain === 'hazard') {
      const dmg = rollDice(state.rng, HAZARD_DAMAGE);
      state.rng = dmg.state;
      // Tagged so the log can name it and an arena bounty can see it: driving
      // something into the fire is a play, and nothing could tell it apart
      // from any other fire damage.
      events.push(...applyDamage(state, moverId, moverId, dmg.total, 'fire', dmg.rolls, { tags: ['Hazard'] }));
      if (!mover.alive || isDown(mover)) {
        stopShort();
        events.unshift({ type: 'moved', combatantId: moverId, path: walked });
        return events;
      }
    }

    // Walking through the wall of fire. Unlike the web, it burns EVERYONE —
    // the caster's own party included. A wall that only hurts the enemy is not
    // a wall, it is a damage aura, and placing it badly has to cost something
    // or there is no decision in where it goes.
    const fire = cellAt(state.grid, step)!.fire;
    if (fire) {
      const roll = rollDice(state.rng, fire.dice);
      state.rng = roll.state;
      const save = savingThrow(state, moverId, 'dex', 15);
      events.push(save.event);
      const amount = saveForHalf(mover, 'dex', roll.total, save.success);
      events.push(...applyDamage(state, moverId, fire.sourceId, amount, 'fire', roll.rolls, { tags: ['Wall of Fire'] }));
      if (!mover.alive || isDown(mover)) { stopShort(); return events; }
    }

    // Walking into a lingering Web: a creature not on the caster's side must
    // save (Dex) or be restrained and stop dead in the strands. Already-caught
    // creatures don't re-roll. The web is friendly to whoever spun it.
    const web = cellAt(state.grid, step)!.web;
    if (web) {
      const source = state.combatants[web.sourceId];
      const alreadyStuck = mover.conditions.some((k) => k.id === 'restrained');
      if (source && source.team !== mover.team && !alreadyStuck) {
        const ability = web.ability ?? 'dex';
        const save = savingThrow(state, moverId, ability, web.dc);
        events.push(save.event);
        if (!save.success) {
          if (!wardedAgainstMagicalBinding(mover, 'restrained')) {
            mover.conditions.push({ id: 'restrained', sourceId: web.sourceId, concentration: true, repeatSave: { ability, dc: web.dc } });
          }
          events.push({ type: 'conditionApplied', combatantId: moverId, condition: 'restrained', sourceId: web.sourceId });
          // Caught: the mover stops here rather than walking on through the web
          // — on the last cell it can actually stand on, which may not be this
          // one if the strands caught it mid-stride over an ally.
          stopShort();
          mover.turn.movementUsed += r.costs.get(`${step.x},${step.y}`) ?? cost;
          events.unshift({ type: 'moved', combatantId: moverId, path: walked });
          return events;
        }
      }
    }
  }

  // Arrive: claim the destination cell (guaranteed empty by moveDestinations).
  cellAt(state.grid, mover.position)!.occupantId = moverId;
  mover.turn.movementUsed += cost;
  events.unshift({ type: 'moved', combatantId: moverId, path: walked });
  return events;
}

/**
 * Forced movement (Thunderwave push): shove `cells` cells along a unit
 * direction. Stops at board edge, walls, and occupied cells. Provokes no
 * opportunity attacks; hazard cells still burn.
 */
export function pushCreature(
  state: GameState,
  targetId: Id,
  dir: { x: number; y: number },
  cells: number,
): GameEvent[] {
  const events: GameEvent[] = [];
  const t = state.combatants[targetId]!;
  const walked: Position[] = [t.position];
  for (let i = 0; i < cells; i++) {
    const next = { x: t.position.x + dir.x, y: t.position.y + dir.y };
    const cell = cellAt(state.grid, next);
    if (!cell || blocksMovement(cell.terrain) || cell.occupantId !== undefined) break;
    const fromCell = cellAt(state.grid, t.position)!;
    if (fromCell.occupantId === targetId) delete fromCell.occupantId;
    t.position = next;
    cell.occupantId = targetId;
    walked.push(next);
    if (popIllusion(state.grid, next)) {
      events.push({ type: 'illusionPopped', position: next });
    }
    if (cell.terrain === 'hazard') {
      const dmg = rollDice(state.rng, HAZARD_DAMAGE);
      state.rng = dmg.state;
      // Tagged, like the walking path is. Forced movement into a hazard is the
      // *intended* way to claim the Into the Fire bounty — enemies path around
      // fire on their own, so a push or a Thunderwave is most of how anything
      // ever ends up standing in it — and an untagged burn here meant the one
      // route the bounty was written for did not count.
      events.push(...applyDamage(state, targetId, targetId, dmg.total, 'fire', dmg.rolls, { tags: ['Hazard'] }));
      if (!t.alive) break;
    }
  }
  if (walked.length > 1) {
    events.unshift({ type: 'moved', combatantId: targetId, path: walked });
  }
  return events;
}
