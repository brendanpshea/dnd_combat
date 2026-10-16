/**
 * Set pieces: lair actions, and a boss's phases.
 *
 * A final boss used to be a large monster with friends. Two things make an
 * ending feel like one, and both are data here:
 *
 *   LAIR ACTIONS. While it fights in its lair, a creature takes one lair action
 *   a round on initiative count 20, losing ties — after everyone who rolled 20
 *   or more, before everyone below. Chosen by the engine ('best': the one that
 *   reaches the most, never the same twice running if another will do) or in
 *   the listed order ('inOrder'). Not while it is down or incapacitated.
 *
 *   PHASES. The first time its hit points fall to or below a share of its
 *   maximum, a phase fires once: a line for the log and whatever effects it
 *   carries — heal, call allies, shake off a condition, change its attacks. A
 *   blow that kills it outright skips what it never lived to see.
 *
 * Both run the same effects (`SetPieceEffect`), and every effect goes through
 * the machinery a spell or a stat block would use: savingThrow and
 * applyDamage, applyCondition, resolveAttack, a spell's own `cast`,
 * summonCombatant, the grid's overlays, applyHealing. Nothing here is a new
 * rule about what damage or a condition does.
 *
 * Where the data comes from. SRD 5.2.1 has no lair actions in its stat blocks:
 * a lair gives a creature one more use of Legendary Resistance and of
 * Legendary Actions ("3 (4 in Lair)"). This engine does not model Legendary
 * Actions, so a stat block's `lair` holds the extra Legendary Resistance and,
 * as its lair actions, the Legendary Actions it prints — taken once a round on
 * count 20 rather than after other creatures' turns (data/monsters.ts: the
 * vampire, the aboleth). A story adds its own with `CombatSetup.setPieces`.
 */
import type {
  Ability, ActiveCondition, Combatant, ConditionId, EffectUntil, GameState, Id, LairAction, Position,
  SetPiece, SetPieceEffect, SetPieceTargets,
} from '../types.js';
import { cellAt, immuneToCondition, isDown, isIncapacitated, isTurnOf, risesAgain } from '../types.js';
import type { GameEvent } from '../events.js';
import {
  blocksMovement, cone15, cube15, distanceFeet, DIRECTIONS, hasLineOfSight, hazardCell, inBounds, line15,
  sphere2x2, sphere5x5, type Direction8,
} from '../grid.js';
import { parseDice, rollDice } from '../dice.js';
import { savingThrow, saveForHalf } from './saves.js';
import { applyDamage, breakConcentration, canAttackWith, resolveAttack } from './attack.js';
import { applyCondition, removeConditions } from './conditions.js';
import { applyHealing } from './heal.js';
import { summonCombatant } from './summon.js';
import { attackableWeapons } from './equipment.js';
import { isHidden } from './hide.js';
import { SPELLS, spellShots, validTarget, type SpellData } from '../../data/spells.js';
import { MONSTERS } from '../../data/monsters.js';
import { WEAPONS } from '../../data/weapons.js';

/** Lair actions come on this initiative count, losing ties. */
export const LAIR_COUNT = 20;

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

// --- Setting a fight up --------------------------------------------------------

/** The spell targetings a lair can aim by itself. */
const AIMABLE = new Set(['creature', 'sphere2x2', 'sphere5x5', 'cone15', 'cube15', 'line15', 'self']);

/** Refuse what cannot run, as the fight is set up rather than when the moment comes. */
function checkEffect(e: SetPieceEffect, where: string): void {
  const fail = (why: string) => { throw new Error(`${where}: ${why}`); };
  if (e.kind === 'summon' && !MONSTERS[e.monsterId]) fail(`no monster '${e.monsterId}'`);
  if (e.kind === 'spell') {
    const spell = SPELLS[e.spellId];
    if (!spell) fail(`no spell '${e.spellId}'`);
    else if (!AIMABLE.has(spell.targeting.kind)) fail(`a lair cannot aim ${spell.name} (${spell.targeting.kind})`);
  }
  if (e.kind === 'attack' && e.weaponId !== undefined && !WEAPONS[e.weaponId]) fail(`no weapon '${e.weaponId}'`);
  if (e.kind === 'attacks') for (const w of e.weaponIds ?? []) if (!WEAPONS[w]) fail(`no weapon '${w}'`);
  if (e.kind === 'terrain' && e.ground === 'hazard' && !e.damage) fail('a hazard needs its damage');
  const dice = e.kind === 'heal' ? (typeof e.amount === 'string' ? e.amount : undefined)
    : e.kind === 'save' || e.kind === 'terrain' ? e.damage?.dice : undefined;
  if (dice !== undefined) {
    try { parseDice(dice); } catch { fail(`'${dice}' is not dice (write '2d6', '1d4+2')`); }
  }
}

/**
 * Give the named creatures their lairs and phases, as the fight starts. A
 * creature `inLair` gets its stat block's lair (data/monsters.ts) — the lair
 * actions and the extra Legendary Resistance — and the set piece's own lair
 * actions and phases come on top.
 */
export function installSetPieces(state: GameState, pieces: readonly SetPiece[]): void {
  for (const p of pieces) {
    const c = state.combatants[p.creature];
    if (!c) throw new Error(`A set piece for '${p.creature}', who is not in the fight`);
    const block = p.inLair ? MONSTERS[c.classId]?.lair : undefined;
    const actions: LairAction[] = clone([...(block?.actions ?? []), ...(p.lair?.actions ?? [])]);
    for (const a of actions) for (const e of a.effects) checkEffect(e, `${c.name}'s lair action ${a.name}`);
    if (actions.length > 0) {
      c.lair = { actions, choose: p.lair?.choose ?? block?.choose ?? 'best', taken: 0 };
    }
    const more = (block?.legendaryResistance ?? 0) + (p.lair?.legendaryResistance ?? 0);
    const pool = c.featureUses['legendary-resistance'];
    if (more > 0 && pool) {
      pool.current += more;
      pool.max += more;
    }
    if (p.phases?.length) {
      for (const ph of p.phases) for (const e of ph.effects) checkEffect(e, `${c.name}'s phase at ${ph.at}`);
      c.phases = [...(c.phases ?? []), ...clone(p.phases)].sort((a, b) => b.at - a.at);
    }
  }
}

/**
 * A phase is for hit points FALLING past a mark. One a creature already sits
 * at or below when the fight begins has nothing left to announce.
 */
export function armPhases(state: GameState): void {
  for (const c of Object.values(state.combatants)) {
    for (const ph of c.phases ?? []) if (c.hp <= ph.at * c.maxHp) ph.done = true;
  }
}

// --- Lair actions: when ----------------------------------------------------------

/** Where a creature acts in the order: a conjured one acts on its summoner's count. */
function countOf(state: GameState, c: Combatant): number {
  let at = c;
  for (let hops = 0; at.summonedBy !== undefined && hops < 8; hops++) {
    const up = state.combatants[at.summonedBy];
    if (!up) break;
    at = up;
  }
  return at.initiative;
}

function lairPending(state: GameState): boolean {
  if (state.lairRound === state.round) return false;
  return Object.values(state.combatants).some((c) => c.lair !== undefined && c.alive);
}

/**
 * Before `next` takes its turn (or rolls its death save): the round's lair
 * actions, if the order has just come down past count 20. Nothing at all in a
 * fight without a lair.
 */
export function lairBefore(state: GameState, next: Combatant): GameEvent[] {
  if (!lairPending(state) || countOf(state, next) >= LAIR_COUNT) return [];
  return takeLairActions(state);
}

/** The round is over and count 20 never came (everyone rolled 20 or more). */
export function lairAtRoundEnd(state: GameState): GameEvent[] {
  return lairPending(state) ? takeLairActions(state) : [];
}

function takeLairActions(state: GameState): GameEvent[] {
  state.lairRound = state.round;
  const events: GameEvent[] = [];
  const holders = state.initiativeOrder
    .map((id) => state.combatants[id]!)
    .filter((c) => c.lair && c.alive && !isDown(c) && !isIncapacitated(c));
  for (const c of holders) {
    if (state.winner) break;
    if (!c.alive || isDown(c) || isIncapacitated(c)) continue;
    const pick = chooseLairAction(state, c);
    if (pick === undefined) continue;
    const action = c.lair!.actions[pick]!;
    c.lair!.taken += 1;
    c.lair!.last = pick;
    events.push({ type: 'lairAction', combatantId: c.id, name: action.name, ...(action.text ? { text: action.text } : {}) });
    events.push(...runEffects(state, c.id, action.effects, action.name));
  }
  return events;
}

// --- Lair actions: which -----------------------------------------------------------

function usable(state: GameState, c: Combatant, a: LairAction): boolean {
  return !a.requires || pickTargets(state, c, a.requires).ids.length > 0;
}

/**
 * Which lair action to take: in the listed order, skipping one that has
 * nothing to work on; or the one that reaches the most, never the same twice
 * running if another will do — the 2014 lair rule, and what keeps a lair from
 * being the same blast every round. Undefined when nothing is worth taking.
 */
function chooseLairAction(state: GameState, c: Combatant): number | undefined {
  const lair = c.lair!;
  const n = lair.actions.length;
  if (lair.choose === 'inOrder') {
    const from = lair.last === undefined ? 0 : lair.last + 1;
    for (let k = 0; k < n; k++) {
      const i = (from + k) % n;
      if (usable(state, c, lair.actions[i]!)) return i;
    }
    return undefined;
  }
  const scored = lair.actions
    .map((a, i) => ({ i, score: usable(state, c, a) ? scoreAction(state, c, a) : 0 }))
    .filter((s) => s.score > 0);
  const fresh = scored.filter((s) => s.i !== lair.last);
  const pool = fresh.length > 0 ? fresh : scored;
  let best: { i: number; score: number } | undefined;
  for (const s of pool) if (!best || s.score > best.score) best = s;
  return best?.i;
}

function scoreAction(state: GameState, c: Combatant, a: LairAction): number {
  // A line and nothing else is still a lair action, taken when nothing better is.
  if (a.effects.length === 0) return 0.01;
  return a.effects.reduce((sum, e) => sum + scoreEffect(state, c, e), 0);
}

/** Roughly, how many enemies an effect reaches (or what it is worth to its user). */
function scoreEffect(state: GameState, c: Combatant, e: SetPieceEffect): number {
  switch (e.kind) {
    case 'save':
    case 'condition': {
      const ids = pickTargets(state, c, e.targets).ids;
      const cond = e.condition;
      if (e.kind === 'condition' || !e.damage) {
        // A condition only counts where it would land.
        return ids.filter((id) => {
          const t = state.combatants[id]!;
          return cond !== undefined && !immuneToCondition(t, cond) &&
            !t.conditions.some((k) => k.id === cond && k.sourceId === c.id);
        }).length;
      }
      return ids.length;
    }
    case 'terrain': return pickTargets(state, c, e.targets ?? { radius: 5 }).ids.length * 0.5;
    case 'attack': return attackPlan(state, c, e.weaponId) ? 1 : 0;
    case 'spell': return spellPlan(state, c, SPELLS[e.spellId]!, e.slotLevel)?.score ?? 0;
    case 'summon': return e.count ?? 1;
    case 'heal': return c.hp < c.maxHp ? 2 * (1 - c.hp / c.maxHp) : 0;
    case 'tempHp': return (c.tempHp ?? 0) < e.amount ? 0.5 : 0;
    case 'immunity':
    case 'attacks': return 0.1;
  }
}

// --- Whom it reaches --------------------------------------------------------------

/** Up and in the fight, on the right side: what an effect can reach. */
function eligible(state: GameState, c: Combatant, t: SetPieceTargets): Combatant[] {
  const who = t.who ?? 'enemies';
  return Object.values(state.combatants).filter((o) =>
    o.id !== c.id && o.alive &&
    (who === 'enemies' ? o.team !== c.team && (!isDown(o) || risesAgain(o)) : o.team === c.team && !isDown(o)) &&
    (t.heldBy === undefined || o.conditions.some((k) => t.heldBy!.includes(k.id) && k.sourceId === c.id)));
}

/**
 * The creatures an effect reaches: itself; or everyone of `who` in a sphere of
 * `radius` feet, set down on whichever of them puts the most inside it; or
 * single creatures nearest first, up to `count`. Ties go by id, so the same
 * board always gives the same answer.
 */
export function pickTargets(
  state: GameState, c: Combatant, t: SetPieceTargets = {},
): { ids: Id[]; center?: Position } {
  if (t.who === 'self') return { ids: c.alive ? [c.id] : [] };
  const pool = eligible(state, c, t);
  const inRange = (o: Combatant) => t.within === undefined || distanceFeet(c.position, o.position) <= t.within;
  if (t.radius !== undefined) {
    const radius = t.radius;
    let best: { ids: Id[]; center: Position } | undefined;
    for (const centre of pool.filter((o) => inRange(o) && !isHidden(o)).sort((a, b) => a.id.localeCompare(b.id))) {
      const caught = pool.filter((o) => distanceFeet(centre.position, o.position) <= radius);
      if (!best || caught.length > best.ids.length) best = { ids: caught.map((o) => o.id), center: centre.position };
    }
    return best ?? { ids: [] };
  }
  const near = pool
    .filter((o) => inRange(o) && !isHidden(o))
    .sort((a, b) => distanceFeet(c.position, a.position) - distanceFeet(c.position, b.position) || a.id.localeCompare(b.id));
  return { ids: near.slice(0, t.count ?? near.length).map((o) => o.id) };
}

// --- What it does ------------------------------------------------------------------

/** Run `effects` for `creatureId`, in order, stopping if it falls or the fight ends. */
export function runEffects(state: GameState, creatureId: Id, effects: readonly SetPieceEffect[], label: string): GameEvent[] {
  const events: GameEvent[] = [];
  for (const e of effects) {
    const c = state.combatants[creatureId];
    if (!c || !c.alive || state.winner) break;
    events.push(...runEffect(state, c, e, label));
  }
  return events;
}

function putCondition(
  state: GameState, c: Combatant, t: Combatant, id: ConditionId, until: EffectUntil,
  save?: { ability: Ability; dc: number },
): GameEvent[] {
  if (!t.alive || isDown(t) || t.conditions.some((k) => k.id === id && k.sourceId === c.id)) return [];
  const cond: ActiveCondition = {
    id, sourceId: c.id,
    ...(until === 'save' && save ? { repeatSave: { ability: save.ability, dc: save.dc, magical: true } } : {}),
    ...(until === 'startOfTurn' ? { endsAtTurnStartOf: t.id } : {}),
    ...(until === 'endOfTurn' ? { endsAtTurnEndOf: { id: t.id, skip: isTurnOf(state, t.id) } } : {}),
  };
  return applyCondition(state, t.id, cond, { magical: true });
}

function runEffect(state: GameState, c: Combatant, e: SetPieceEffect, label: string): GameEvent[] {
  const events: GameEvent[] = [];
  switch (e.kind) {
    case 'save': {
      const { ids } = pickTargets(state, c, e.targets);
      if (ids.length === 0) return events;
      // One roll for everyone, as a Fireball's.
      const dmg = e.damage ? rollDice(state.rng, e.damage.dice) : undefined;
      if (dmg) state.rng = dmg.state;
      for (const id of ids) {
        const t = state.combatants[id];
        if (!t?.alive) continue;
        const save = savingThrow(state, id, e.ability, e.dc, { magical: true });
        events.push(save.event);
        if (dmg && e.damage) {
          const amount = e.halfOnSave === false
            ? (save.success ? 0 : dmg.total)
            : saveForHalf(t, e.ability, dmg.total, save.success);
          if (amount > 0) {
            events.push(...applyDamage(state, id, c.id, amount, e.damage.type, dmg.rolls, { magical: true, tags: [label] }));
          }
        }
        if (e.condition && !save.success) {
          events.push(...putCondition(state, c, t, e.condition, e.until ?? 'save', { ability: e.ability, dc: e.dc }));
        }
        if (state.winner) break;
      }
      return events;
    }
    case 'condition': {
      for (const id of pickTargets(state, c, e.targets).ids) {
        events.push(...putCondition(state, c, state.combatants[id]!, e.condition, e.until ?? 'endOfTurn'));
      }
      return events;
    }
    case 'attack': {
      const plan = attackPlan(state, c, e.weaponId);
      if (plan) events.push(...resolveAttack(state, c.id, plan.targetId, plan.weaponId));
      return events;
    }
    case 'spell': {
      const spell = SPELLS[e.spellId]!;
      const plan = spellPlan(state, c, spell, e.slotLevel);
      if (!plan) return events;
      if (spell.concentration) events.push(...breakConcentration(state, c.id));
      events.push({ type: 'spellCast', casterId: c.id, spellId: spell.id, origin: c.position, cells: plan.cells });
      // "using Charisma as the spellcasting ability": for this cast only.
      const had = c.spellcastingAbility;
      if (e.ability) c.spellcastingAbility = e.ability;
      try {
        events.push(...spell.cast({
          state, casterId: c.id, slotLevel: e.slotLevel ?? spell.level, targetIds: plan.targetIds, positions: plan.positions,
        }));
      } finally {
        if (e.ability) {
          if (had === undefined) delete c.spellcastingAbility;
          else c.spellcastingAbility = had;
        }
      }
      return events;
    }
    case 'summon': {
      const base = MONSTERS[e.monsterId]!.name;
      for (let k = 0; k < (e.count ?? 1); k++) {
        // Grows with every arrival, so two calls in one round never share an id.
        const index = Object.keys(state.combatants).length;
        const kin = Object.values(state.combatants).filter((o) => o.name === base || o.name.startsWith(`${base} `)).length;
        events.push(...summonCombatant(state, {
          monsterId: e.monsterId, summonerId: c.id, near: c.position, index,
          ...(kin > 0 ? { patch: { name: `${base} ${kin + 1}` } } : {}),
        }));
      }
      return events;
    }
    case 'terrain': {
      const plan = pickTargets(state, c, e.targets ?? { radius: 5 });
      const radius = e.targets?.radius ?? (e.targets ? undefined : 5);
      const cells: Position[] = [];
      if (plan.center && radius !== undefined) {
        const r = Math.floor(radius / 5);
        for (let dy = -r; dy <= r; dy++) {
          for (let dx = -r; dx <= r; dx++) {
            cells.push({ x: plan.center.x + dx, y: plan.center.y + dy });
          }
        }
      } else {
        for (const id of plan.ids) cells.push({ ...state.combatants[id]!.position });
      }
      const changed: Position[] = [];
      for (const p of cells) {
        const cell = cellAt(state.grid, p);
        if (!cell || blocksMovement(cell.terrain)) continue;
        if (e.ground === 'difficult') {
          // Ice Storm's overlay: difficult until the round runs out, then gone.
          cell.chilled = { expiresAtRound: state.round + (e.rounds ?? 1) };
          changed.push(p);
        } else if (e.damage && hazardCell(state.grid, p, c.id, e.damage.dice, e.damage.type, e.save, label,
          e.save ? {} : { unsaved: true })) {
          changed.push(p);
        }
      }
      if (changed.length > 0) events.push({ type: 'groundChanged', sourceId: c.id, ground: e.ground, cells: changed });
      return events;
    }
    case 'heal': {
      let amount: number;
      if (typeof e.amount === 'number') amount = e.amount;
      else {
        const roll = rollDice(state.rng, e.amount);
        state.rng = roll.state;
        amount = roll.total;
      }
      events.push(...applyHealing(state, c.id, c.id, amount));
      return events;
    }
    case 'tempHp':
      c.tempHp = Math.max(c.tempHp ?? 0, e.amount);
      return events;
    case 'immunity': {
      if (e.conditions?.length) {
        c.conditionImmunities = [...new Set([...(c.conditionImmunities ?? []), ...e.conditions])];
        // Immune now, so whatever of these it has falls away.
        events.push(...removeConditions(c, (k) => immuneToCondition(c, k.id)));
      }
      if (e.damage?.length) c.immunities = [...new Set([...c.immunities, ...e.damage])];
      return events;
    }
    case 'attacks': {
      if (e.weaponIds?.length) {
        const [first, ...rest] = e.weaponIds;
        c.equipped = { ...c.equipped, mainHand: first! };
        const carried = new Set(c.inventory.map((s) => s.itemId));
        for (const w of rest) if (!carried.has(w)) c.inventory = [...c.inventory, { itemId: w, qty: 1 }];
        // A named Multiattack would name the old weapons; the new ones are any
        // of these, `attacksPerAction` times.
        delete c.routines;
      }
      if (e.attacksPerAction !== undefined) c.attacksPerAction = e.attacksPerAction;
      return events;
    }
  }
}

/**
 * One swing: the weapon given, or the first it has that reaches, at the
 * weakest enemy in reach still on its feet — a hero already dying comes last.
 */
function attackPlan(state: GameState, c: Combatant, weaponId?: Id): { weaponId: Id; targetId: Id } | undefined {
  const weapons = weaponId ? [weaponId] : attackableWeapons(c);
  const foes = Object.values(state.combatants)
    .filter((o) => o.alive && o.team !== c.team)
    .sort((a, b) => Number(isDown(a)) - Number(isDown(b)) || a.hp - b.hp || a.id.localeCompare(b.id));
  for (const t of foes) {
    for (const w of weapons) if (canAttackWith(state, c, w, t.id)) return { weaponId: w, targetId: t.id };
  }
  return undefined;
}

/**
 * Where a lair's spell goes: the creatures it can target, nearest first (the
 * most hurt, for an ally's spell); an area where it catches the most enemies
 * and the fewest of its own side; a self-centred spell when enemies are close.
 * `score` is about how many enemies it reaches.
 */
function spellPlan(
  state: GameState, c: Combatant, spell: SpellData, slotLevel?: number,
): { targetIds: Id[]; positions: Position[]; cells: Position[]; score: number } | undefined {
  const t = spell.targeting;
  const foes = Object.values(state.combatants).filter((o) => o.alive && !isDown(o) && o.team !== c.team);
  const friends = Object.values(state.combatants).filter((o) => o.alive && !isDown(o) && o.team === c.team);
  const worth = (cells: Position[]) =>
    foes.filter((o) => cells.some((p) => p.x === o.position.x && p.y === o.position.y)).length -
    friends.filter((o) => cells.some((p) => p.x === o.position.x && p.y === o.position.y)).length;
  if (t.kind === 'creature') {
    const valid = Object.values(state.combatants).filter((o) => validTarget(state, c.id, spell, o.id));
    const mine = t.who === 'ally';
    valid.sort((a, b) => (mine ? a.hp / a.maxHp - b.hp / b.maxHp : 0) ||
      distanceFeet(c.position, a.position) - distanceFeet(c.position, b.position) || a.id.localeCompare(b.id));
    const picked = valid.slice(0, spellShots(spell, c, slotLevel ?? spell.level));
    if (picked.length === 0) return undefined;
    return {
      targetIds: picked.map((o) => o.id), positions: [], cells: picked.map((o) => o.position),
      score: mine ? 0.5 * picked.length : picked.filter((o) => o.team !== c.team).length,
    };
  }
  if (t.kind === 'self') {
    const near = foes.filter((o) => distanceFeet(c.position, o.position) <= 15).length;
    const score = near > 0 ? near : t.anyTime ? 0.5 : 0;
    return score > 0 ? { targetIds: [], positions: [], cells: [c.position], score } : undefined;
  }
  let best: { targetIds: Id[]; positions: Position[]; cells: Position[]; score: number } | undefined;
  const consider = (aim: Position, cells: Position[]) => {
    const score = worth(cells);
    if (score > 0 && (!best || score > best.score)) {
      best = { targetIds: [], positions: [aim], cells: cells.filter((p) => inBounds(state.grid, p)), score };
    }
  };
  if (t.kind === 'sphere2x2' || t.kind === 'sphere5x5') {
    const spread = t.kind === 'sphere2x2' ? [-1, 0] : [-2, -1, 0, 1, 2];
    for (const f of foes) {
      for (const dx of spread) {
        for (const dy of spread) {
          const aim = { x: f.position.x + dx, y: f.position.y + dy };
          if (distanceFeet(c.position, aim) > t.range) continue;
          if (t.kind === 'sphere5x5' && !hasLineOfSight(state.grid, c.position, aim)) continue;
          consider(aim, t.kind === 'sphere2x2' ? sphere2x2(aim) : sphere5x5(aim));
        }
      }
    }
  } else if (t.kind === 'cone15' || t.kind === 'cube15' || t.kind === 'line15') {
    const area = t.kind === 'cube15' ? cube15 : t.kind === 'line15' ? line15 : cone15;
    for (const dir of Object.keys(DIRECTIONS) as Direction8[]) {
      const d = DIRECTIONS[dir];
      consider({ x: c.position.x + d.x, y: c.position.y + d.y }, area(c.position, dir));
    }
  }
  return best;
}

// --- Phases --------------------------------------------------------------------------

/**
 * Fire every phase whose mark a creature's hit points have fallen to, once
 * each, highest first. Run after every action (step), so a phase lands
 * between one thing happening and the next, never inside an attack.
 */
export function checkPhases(state: GameState): GameEvent[] {
  if (state.winner) return [];
  const events: GameEvent[] = [];
  for (const c of Object.values(state.combatants)) {
    if (!c.phases || !c.alive || isDown(c)) continue;
    for (const ph of c.phases) {
      if (ph.done || c.hp > ph.at * c.maxHp) continue;
      ph.done = true;
      events.push({
        type: 'bossPhase', combatantId: c.id,
        ...(ph.name ? { name: ph.name } : {}), ...(ph.text ? { text: ph.text } : {}),
      });
      events.push(...runEffects(state, c.id, ph.effects, ph.name ?? c.name));
      if (state.winner || !c.alive || isDown(c)) break;
    }
    if (state.winner) break;
  }
  return events;
}
