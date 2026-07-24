/**
 * The Action vocabulary, legality checking, legal-action enumeration, and the
 * pure step() function. This is the entire surface a driver (CLI, AI) uses.
 *
 * Validation is semantic (isLegalAction), so multi-target spells don't require
 * enumerating every target combination. legalActions() enumerates playable
 * actions for menus/AI, using sensible default targets for multi-target
 * spells; drivers may customize targets and step() re-validates.
 */
import type { GameState, Id, Position, Combatant } from './types.js';
import { posEq, cellAt, isDown, isIncapacitated } from './types.js';
import { WEAPONS } from '../data/weapons.js';
import { SPELLS, SpellData, validTarget, directionFromDelta } from '../data/spells.js';
import { FEATURES } from '../data/features.js';
import { ITEMS } from '../data/items.js';
import { classScrollPool } from '../data/classes.js';
import { attackableWeapons, equippedWeapons, autoSwap } from './rules/equipment.js';
import { distanceFeet, adjacent, hasLineOfSight, sphere2x2, sphere5x5, DIRECTIONS, cone15, cube15, line15, Direction8, inBounds } from './grid.js';
import { currentCombatant, endTurn } from './turn.js';
import { resolveAttack, breakConcentration, canAttackWith, applyDamage, SMITE_SPECS } from './rules/attack.js';
import { rollDice } from './dice.js';
import { savingThrow } from './rules/saves.js';
import { moveDestinations, executeMove } from './rules/movement.js';
import { canHide, attemptHide, endHide, isHidden } from './rules/hide.js';
import type { GameEvent } from './events.js';

export type Target = { combatantId: Id } | { position: Position };

export type Action =
  | { kind: 'move'; to: Position }
  | { kind: 'attack'; weaponId: Id; targetId: Id; offhand?: boolean }
  | { kind: 'castSpell'; spellId: Id; slotLevel: number; targets: Target[]; weaponId?: Id }
  | { kind: 'useFeature'; featureId: Id }
  | { kind: 'useItem'; itemId: Id; targets?: Target[] }
  | { kind: 'dash' }
  | { kind: 'disengage' }
  | { kind: 'dodge' }
  | { kind: 'hide' }
  | { kind: 'shakeAwake'; targetId: Id }
  | { kind: 'endTurn' };

/** Weapons True Strike can guide: anything currently attackable (in hand or a
 *  stowed one the free interaction could draw). */
function trueStrikeWeapons(c: Combatant): Id[] {
  return attackableWeapons(c);
}

/** Can't take an *action* — the shared incapacitated set, plus Command (which
 *  costs the turn's actions but, unlike the rest, leaves the reaction). */
function cannotAct(c: Combatant): boolean {
  return isIncapacitated(c) || c.conditions.some((k) => k.id === 'commanded');
}

function canUseOffhand(actor: Combatant, weaponId: Id): boolean {
  // Two-weapon fighting: a light weapon in each actual hand, off-hand attack
  // made with the off-hand weapon.
  const main = actor.equipped.mainHand;
  const off = actor.equipped.offHand;
  if (off !== weaponId || off === 'shield' || main === undefined) return false;
  const mainW = WEAPONS[main];
  const offW = WEAPONS[weaponId];
  return (
    !!mainW && !!offW &&
    mainW.properties.includes('light') && offW.properties.includes('light') &&
    actor.turn.attackedThisTurn && !actor.turn.bonusActionUsed
  );
}

function itemTargetsValid(state: GameState, actor: Combatant, itemId: Id, targets: Target[]): boolean {
  const item = ITEMS[itemId];
  if (!item) return false;
  const t = item.targeting;
  if (t.kind === 'self') return targets.length === 0;
  if (t.kind === 'ally') {
    if (targets.length === 0) return true; // drink it yourself
    const tg = targets[0];
    if (targets.length !== 1 || !tg || !('combatantId' in tg)) return false;
    const ally = state.combatants[tg.combatantId];
    return !!ally && ally.alive && ally.team === actor.team &&
      (ally.id === actor.id || !isHidden(ally)) &&
      (ally.id === actor.id || adjacent(actor.position, ally.position));
  }
  if (t.kind === 'thrown') {
    const tg = targets[0];
    if (targets.length !== 1 || !tg || !('combatantId' in tg)) return false;
    const foe = state.combatants[tg.combatantId];
    return !!foe && foe.alive && foe.team !== actor.team && !isHidden(foe) &&
      distanceFeet(actor.position, foe.position) <= t.range.long &&
      hasLineOfSight(state.grid, actor.position, foe.position);
  }
  // spell scroll: delegate to the spell's targeting rules
  const spell = SPELLS[t.spellId]!;
  return validSpellTargets(state, actor.id, spell, targets);
}

function spellAvailable(actor: Combatant, spell: SpellData, slotLevel: number): boolean {
  if (!actor.spellIds.includes(spell.id)) return false;
  // Already concentrating on this exact spell? Recasting it would only drop and
  // re-establish the same effect — a wasted action and slot. Don't offer it
  // (Hunter's Mark, Faerie Fire, Bless…); a *different* concentration spell is
  // still fine and correctly replaces this one.
  if (spell.concentration && actor.concentratingOn?.spellId === spell.id) return false;
  // A one-per-caster summon (Spiritual Weapon, Flaming Sphere) that's already on
  // the board — recasting just re-places the same conjuration. Its kind is the
  // spell id, so match on that.
  if (actor.summons?.some((s) => s.kind === spell.id)) return false;
  // A smite is already held ready: arming a second would silently overwrite the
  // first and burn the slot for nothing. Discharge it, then load another.
  if (actor.armedSmite && SMITE_SPECS[spell.id]) return false;
  if (spell.level === 0) return slotLevel === 0;
  // Innate: cast at slotLevel 0 (spending no slot), limited by its own pool.
  // Checked before the slot path so a fighter — which has no slots at all — can
  // still cast it, and so a caster elf spends the free innate use before a slot.
  const innate = actor.innateSpells[spell.id];
  if (innate && slotLevel === 0) return innate.current > 0;
  if (slotLevel < spell.level) return false;
  const pool = actor.spellSlots[slotLevel - 1];
  return !!pool && pool.current > 0;
}

function validSpellTargets(state: GameState, actorId: Id, spell: SpellData, targets: Target[], weaponId?: Id): boolean {
  const actor = state.combatants[actorId]!;
  const t = spell.targeting;
  if (t.kind === 'weaponAttack') {
    const tg = targets[0];
    if (targets.length !== 1 || !tg || !('combatantId' in tg)) return false;
    // A named weapon must be one you can attack with; unnamed means "let the
    // spell pick", so any attackable weapon that reaches will do.
    const weapons = weaponId ? [weaponId] : trueStrikeWeapons(actor);
    return weapons.some((w) => canAttackWith(state, actor, w, tg.combatantId));
  }
  if (t.kind === 'creature') {
    if (targets.length < 1 || targets.length > t.count) return false;
    // Multi-target creature spells: Bless requires distinct targets; Magic
    // Missile darts may repeat. Distinctness only matters when concentration
    // buffs stack conditions — enforced by the spell itself being idempotent.
    return targets.every((tg) => 'combatantId' in tg && validTarget(state, actorId, spell, tg.combatantId));
  }
  if (t.kind === 'sphere2x2') {
    const tg = targets[0];
    if (targets.length !== 1 || !tg || !('position' in tg)) return false;
    return distanceFeet(actor.position, tg.position) <= t.range;
  }
  if (t.kind === 'sphere5x5') {
    const tg = targets[0];
    if (targets.length !== 1 || !tg || !('position' in tg)) return false;
    return distanceFeet(actor.position, tg.position) <= t.range &&
      hasLineOfSight(state.grid, actor.position, tg.position);
  }
  if (t.kind === 'self') return targets.length === 0;
  if (t.kind === 'emptyCell') {
    const tg = targets[0];
    if (targets.length !== 1 || !tg || !('position' in tg)) return false;
    const cell = cellAt(state.grid, tg.position);
    return !!cell && cell.terrain !== 'wall' && cell.occupantId === undefined &&
      distanceFeet(actor.position, tg.position) <= t.range &&
      hasLineOfSight(state.grid, actor.position, tg.position);
  }
  // cone15: target is an adjacent cell defining the direction.
  const tg = targets[0];
  if (targets.length !== 1 || !tg || !('position' in tg)) return false;
  try {
    directionFromDelta(actor.position, tg.position);
    return true;
  } catch {
    return false;
  }
}

/**
 * The cells a spell's effect visibly covers, for the presentational `spellCast`
 * event: an area's full footprint, or each creature target's square. Best-effort
 * and clipped to the board — a wrong cell only mis-paints a transient effect,
 * never touches resolution (the cast itself owns who is actually hit).
 */
function spellFootprint(state: GameState, actor: Combatant, spell: SpellData, targets: Target[]): Position[] {
  const t = spell.targeting;
  const firstPos = targets.find((tg): tg is { position: Position } => 'position' in tg)?.position;
  let cells: Position[] = [];
  switch (t.kind) {
    case 'creature':
    case 'weaponAttack':
      cells = targets.flatMap((tg) =>
        'combatantId' in tg && state.combatants[tg.combatantId]
          ? [state.combatants[tg.combatantId]!.position]
          : []);
      break;
    case 'sphere2x2': if (firstPos) cells = sphere2x2(firstPos); break;
    case 'sphere5x5': if (firstPos) cells = sphere5x5(firstPos); break;
    case 'emptyCell': if (firstPos) cells = [firstPos]; break;
    case 'self': {
      // A burst centred on the caster (Thunderwave) / an aura around it.
      cells = [actor.position];
      for (const d of Object.values(DIRECTIONS)) cells.push({ x: actor.position.x + d.x, y: actor.position.y + d.y });
      break;
    }
    case 'cone15':
    case 'cube15':
    case 'line15': {
      if (!firstPos) break;
      try {
        const dir = directionFromDelta(actor.position, firstPos);
        const area = t.kind === 'cube15' ? cube15 : t.kind === 'line15' ? line15 : cone15;
        cells = area(actor.position, dir);
      } catch { cells = [firstPos]; }
      break;
    }
  }
  return cells.filter((p) => inBounds(state.grid, p));
}

export function isLegalAction(state: GameState, actorId: Id, action: Action): boolean {
  const actor = state.combatants[actorId];
  if (!actor || !actor.alive || state.winner) return false;
  if (currentCombatant(state).id !== actorId) return false;
  const incap = cannotAct(actor);

  switch (action.kind) {
    case 'endTurn':
      return true;
    case 'move':
      // Incapacitated/paralyzed/etc. take no movement either (their turn grants
      // zero speed, but gate here too so no stale budget slips a step through).
      if (incap) return false;
      return moveDestinations(state, actor).some((p) => posEq(p, action.to));
    case 'attack':
      if (incap) return false;
      if (action.offhand) {
        return canUseOffhand(actor, action.weaponId) && canAttackWith(state, actor, action.weaponId, action.targetId);
      }
      return (!actor.turn.actionUsed || actor.turn.attacksLeft > 0) &&
        canAttackWith(state, actor, action.weaponId, action.targetId);
    case 'castSpell': {
      if (incap) return false;
      const spell = SPELLS[action.spellId];
      if (!spell || spell.outOfCombat) return false; // Guidance and the like never resolve in a fight
      const costsAction = spell.castingTime === 'action';
      if (costsAction && actor.turn.actionUsed) return false;
      if (!costsAction && actor.turn.bonusActionUsed) return false;
      return spellAvailable(actor, spell, action.slotLevel) &&
        validSpellTargets(state, actorId, spell, action.targets, action.weaponId);
    }
    case 'useItem': {
      if (incap) return false;
      const item = ITEMS[action.itemId];
      if (!item) return false;
      const stack = actor.inventory.find((s) => s.itemId === action.itemId && s.qty > 0);
      if (!stack) return false;
      if (item.useTime === 'action' && actor.turn.actionUsed) return false;
      if (item.useTime === 'bonus' && actor.turn.bonusActionUsed) return false;
      // A spell scroll only works for a class that has the spell on its list.
      if (item.targeting.kind === 'spell' && !classScrollPool(actor.classId).has(item.targeting.spellId)) return false;
      return itemTargetsValid(state, actor, action.itemId, action.targets ?? []);
    }
    case 'useFeature': {
      if (incap) return false;
      const f = FEATURES[action.featureId];
      if (!f || !f.apply || !actor.featureIds.includes(action.featureId)) return false;
      const uses = actor.featureUses[action.featureId];
      if ((f.uses || f.recharge) && (!uses || uses.current <= 0)) return false;
      if (f.trigger === 'bonus' && actor.turn.bonusActionUsed) return false;
      if (f.trigger === 'action' && actor.turn.actionUsed) return false;
      if ((action.featureId === 'cunning-hide' || action.featureId === 'nimble-hide') && !canHide(state, actor)) return false;
      // 'free' features with an action-restoring effect only make sense after
      // the action is spent; harmless either way.
      if (action.featureId === 'action-surge' && !actor.turn.actionUsed) return false;
      return true;
    }
    case 'dash':
    case 'disengage':
    case 'dodge':
      return !incap && !actor.turn.actionUsed;
    case 'hide':
      return !incap && !actor.turn.actionUsed && canHide(state, actor);
    case 'shakeAwake': {
      if (incap || actor.turn.actionUsed) return false;
      const t = state.combatants[action.targetId];
      // Shaking rouses a *sleeper*. It does nothing for a hero at 0 HP —
      // only healing gets them up — and allowing it stripped the unconscious
      // while leaving them at 0, an awake body that still couldn't act.
      return !!t && t.alive && !isDown(t) && t.team === actor.team && t.id !== actorId &&
        adjacent(actor.position, t.position) &&
        t.conditions.some((c) => c.id === 'unconscious');
    }
  }
}

/**
 * Every candidate target set a spell offers from the actor's position — the
 * single source of truth for spell targeting, so a spell *scroll* offers exactly
 * the same choices as casting the spell (that's what makes a Scroll of X behave
 * like X). Returns default selections for multi-target spells (all Magic Missile
 * darts on the first enemy, etc.); the caller filters by legality.
 */
export function spellTargetSets(
  state: GameState, actor: Combatant, spell: SpellData,
): Array<{ targets: Target[]; weaponId?: Id }> {
  const enemies = Object.values(state.combatants).filter((c) => c.alive && !isDown(c) && c.team !== actor.team);
  const allies = Object.values(state.combatants).filter((c) => c.alive && c.team === actor.team);
  const out: Array<{ targets: Target[]; weaponId?: Id }> = [];
  const t = spell.targeting;
  if (t.kind === 'weaponAttack') {
    for (const e of enemies) {
      for (const w of trueStrikeWeapons(actor)) out.push({ targets: [{ combatantId: e.id }], weaponId: w });
    }
  } else if (t.kind === 'creature') {
    const pool = t.who === 'enemy' ? enemies : t.who === 'ally' ? allies : [...enemies, ...allies];
    const valid = pool.filter((c) => validTarget(state, actor.id, spell, c.id));
    if (t.count === 1) {
      for (const v of valid) out.push({ targets: [{ combatantId: v.id }] });
    } else if (valid.length > 0) {
      // Default selection depends on whether the spell's "shots" can double up
      // on one creature:
      //   Magic Missile  → every dart at the first target (its classic use);
      //   Scorching Ray  → one ray per enemy, but *all* rays still fire — with a
      //                    lone target every ray lands on it (previously it fired
      //                    just one), and with too few enemies the extras pile on
      //                    the last rather than vanishing;
      //   Bless / Mass Healing Word → distinct allies, so no doubling up.
      const stackable = spell.id === 'magic-missile' || spell.id === 'scorching-ray';
      const targets: Target[] =
        spell.id === 'magic-missile'
          ? Array.from({ length: t.count }, () => ({ combatantId: valid[0]!.id }))
          : stackable
            ? Array.from({ length: t.count }, (_, i) => ({ combatantId: valid[Math.min(i, valid.length - 1)]!.id }))
            : valid.slice(0, t.count).map((c) => ({ combatantId: c.id }));
      out.push({ targets });
    }
  } else if (t.kind === 'self') {
    // Offer when it would do something: a burst that touches an adjacent enemy,
    // or Spiritual Guardians' aura reaching an enemy within 15 ft.
    const reach = spell.id === 'spiritual-guardians' ? 15 : 5;
    if (enemies.some((e) => distanceFeet(e.position, actor.position) <= reach)) out.push({ targets: [] });
  } else if (t.kind === 'emptyCell') {
    for (let y = 0; y < state.grid.height; y++) {
      for (let x = 0; x < state.grid.width; x++) out.push({ targets: [{ position: { x, y } }] });
    }
  } else if (t.kind === 'sphere2x2') {
    const seen = new Set<string>();
    for (const e of enemies) {
      for (const dx of [-1, 0]) {
        for (const dy of [-1, 0]) {
          const anchor = { x: e.position.x + dx, y: e.position.y + dy };
          const k = `${anchor.x},${anchor.y}`;
          if (seen.has(k)) continue;
          seen.add(k);
          out.push({ targets: [{ position: anchor }] });
        }
      }
    }
  } else if (t.kind === 'sphere5x5') {
    const seen = new Set<string>();
    for (const e of enemies) {
      for (let dx = -2; dx <= 2; dx++) {
        for (let dy = -2; dy <= 2; dy++) {
          const center = { x: e.position.x + dx, y: e.position.y + dy };
          const k = `${center.x},${center.y}`;
          if (seen.has(k)) continue;
          seen.add(k);
          out.push({ targets: [{ position: center }] });
        }
      }
    }
  } else {
    // cone15 / cube15 / line15: directions whose area catches at least one enemy.
    const area = t.kind === 'cube15' ? cube15 : t.kind === 'line15' ? line15 : cone15;
    for (const dir of Object.keys(DIRECTIONS) as Direction8[]) {
      if (!area(actor.position, dir).some((p) => enemies.some((e) => posEq(e.position, p)))) continue;
      const d = DIRECTIONS[dir];
      out.push({ targets: [{ position: { x: actor.position.x + d.x, y: actor.position.y + d.y } }] });
    }
  }
  return out;
}

/** Enumerate playable actions (with default targets for multi-target spells). */
export function legalActions(state: GameState, actorId: Id): Action[] {
  const actor = state.combatants[actorId];
  if (!actor || !actor.alive || state.winner) return [];
  if (currentCombatant(state).id !== actorId) return [];

  const actions: Action[] = [];
  const enemies = Object.values(state.combatants).filter((c) => c.alive && !isDown(c) && c.team !== actor.team);
  const allies = Object.values(state.combatants).filter((c) => c.alive && c.team === actor.team);

  // No movement while incapacitated — mirrors the `move` gate in isLegalAction.
  // This matters mid-turn too: a creature dropped to 0 HP by an opportunity
  // attack while moving is now unconscious but still the active turn, and its
  // stale movement budget must not offer (illegal) further steps.
  if (!cannotAct(actor)) {
    for (const to of moveDestinations(state, actor)) {
      actions.push({ kind: 'move', to });
    }
  }

  for (const wid of attackableWeapons(actor)) {
    for (const t of enemies) {
      const main: Action = { kind: 'attack', weaponId: wid, targetId: t.id };
      if (isLegalAction(state, actorId, main)) actions.push(main);
    }
  }
  const offWeapon = actor.equipped.offHand;
  if (offWeapon && offWeapon !== 'shield') {
    for (const t of enemies) {
      const off: Action = { kind: 'attack', weaponId: offWeapon, targetId: t.id, offhand: true };
      if (isLegalAction(state, actorId, off)) actions.push(off);
    }
  }

  // Consumables.
  for (const stack of actor.inventory) {
    const item = ITEMS[stack.itemId];
    if (!item || stack.qty <= 0) continue;
    const candidates: Target[][] = [];
    if (item.targeting.kind === 'self') candidates.push([]);
    else if (item.targeting.kind === 'ally') {
      candidates.push([]); // use on self
      for (const a of allies) {
        if (a.id !== actorId) candidates.push([{ combatantId: a.id }]);
      }
    } else if (item.targeting.kind === 'thrown') {
      for (const e of enemies) candidates.push([{ combatantId: e.id }]);
    } else {
      // Scroll: usable only if the spell is on the actor's class list (2024) —
      // a fighter can't read a wizard's scroll. Then it plays exactly like
      // casting X (multi-dart, area cells, and all).
      if (!classScrollPool(actor.classId).has(item.targeting.spellId)) continue;
      const spell = SPELLS[item.targeting.spellId]!;
      for (const { targets } of spellTargetSets(state, actor, spell)) candidates.push(targets);
    }
    for (const targets of candidates) {
      const a: Action = { kind: 'useItem', itemId: stack.itemId, targets };
      if (isLegalAction(state, actorId, a)) actions.push(a);
    }
  }

  for (const sid of actor.spellIds) {
    const spell = SPELLS[sid]!;
    if (spell.castingTime === 'reaction' || spell.outOfCombat) continue; // Shield autocasts; Guidance is shop-only
    // Innate spells cast at slotLevel 0 (no slot); everything else at its base
    // level. spellAvailable enforces the right resource for whichever this is.
    const baseLevel = actor.innateSpells[sid] ? 0 : spell.level;
    // Smites are the one place upcasting is a real decision rather than a menu
    // full of near-duplicates: the whole point of a paladin's turn is choosing
    // how much of the tank to spend on this swing. Every other spell is offered
    // at its base level only, as before.
    const levels = SMITE_SPECS[sid]
      ? actor.spellSlots.map((_, i) => i + 1).filter((lvl) => spellAvailable(actor, spell, lvl))
      : spellAvailable(actor, spell, baseLevel) ? [baseLevel] : [];
    for (const slotLevel of levels) {
      for (const { targets, weaponId } of spellTargetSets(state, actor, spell)) {
        const a: Action = { kind: 'castSpell', spellId: sid, slotLevel, targets, ...(weaponId ? { weaponId } : {}) };
        if (isLegalAction(state, actorId, a)) actions.push(a);
      }
    }
  }

  for (const fid of actor.featureIds) {
    const a: Action = { kind: 'useFeature', featureId: fid };
    if (isLegalAction(state, actorId, a)) actions.push(a);
  }

  for (const kind of ['dash', 'disengage', 'dodge'] as const) {
    if (isLegalAction(state, actorId, { kind })) actions.push({ kind });
  }
  if (isLegalAction(state, actorId, { kind: 'hide' })) actions.push({ kind: 'hide' });
  for (const t of allies) {
    const a: Action = { kind: 'shakeAwake', targetId: t.id };
    if (isLegalAction(state, actorId, a)) actions.push(a);
  }

  actions.push({ kind: 'endTurn' });
  return actions;
}

/**
 * The pure core: validate semantically, clone, execute, return the new state
 * plus everything that happened. Never mutates its input.
 */
/**
 * Deep copy of a GameState, so `step` can work on a draft without ever
 * mutating its input.
 *
 * Hand-rolled rather than `structuredClone` purely for speed. This is the
 * hottest function in the codebase: the AI's beam search steps thousands of
 * sampled actions per decision, and cloning was ~12% of total runtime — the
 * general-purpose algorithm pays for cycle detection, Maps, Dates and
 * transferables that a GameState is guaranteed never to contain. The spec
 * requires it to be plain serializable data (`RngState` is a number), which is
 * exactly the case this handles, and the assertion below keeps that honest.
 */
function cloneState(state: GameState): GameState {
  const combatants: Record<string, Combatant> = {};
  for (const id in state.combatants) combatants[id] = clonePlain(state.combatants[id]!);
  return {
    ...state,
    grid: { ...state.grid, cells: state.grid.cells.map((c) => ({ ...c })) },
    combatants,
    initiativeOrder: [...state.initiativeOrder],
  };
}

/** Recursive copy of plain JSON-shaped data (objects, arrays, primitives). */
function clonePlain<T>(v: T): T {
  if (v === null || typeof v !== 'object') return v;
  if (Array.isArray(v)) {
    const out = new Array(v.length);
    for (let i = 0; i < v.length; i++) out[i] = clonePlain(v[i]);
    return out as T;
  }
  const out: Record<string, unknown> = {};
  for (const k in v) out[k] = clonePlain((v as Record<string, unknown>)[k]);
  return out as T;
}

export function step(state: GameState, action: Action): { state: GameState; events: GameEvent[] } {
  const actorId = currentCombatant(state).id;
  if (!isLegalAction(state, actorId, action)) {
    throw new Error(`Illegal action for ${actorId}: ${JSON.stringify(action)}`);
  }

  const draft: GameState = cloneState(state);
  const actor = draft.combatants[actorId]!;
  const events: GameEvent[] = [];

  switch (action.kind) {
    case 'move':
      events.push(...executeMove(draft, actorId, action.to));
      break;
    case 'attack':
      // Attacking with a stowed weapon draws it via the free interaction.
      if (!equippedWeapons(actor).includes(action.weaponId)) {
        events.push(...autoSwap(draft, actorId, action.weaponId));
      }
      if (action.offhand) {
        actor.turn.bonusActionUsed = true;
      } else if (!actor.turn.actionUsed) {
        // First attack of the Attack action: bank any multiattack follow-ups
        // (plus Haste's one extra attack, banked the same way).
        actor.turn.actionUsed = true;
        actor.turn.attackedThisTurn = true;
        const hasteBonus = actor.conditions.some((c) => c.id === 'hasted') ? 1 : 0;
        actor.turn.attacksLeft = actor.attacksPerAction - 1 + hasteBonus;
      } else {
        actor.turn.attacksLeft -= 1;
      }
      events.push(...resolveAttack(draft, actorId, action.targetId, action.weaponId, {
        offhand: action.offhand ?? false,
      }));
      break;
    case 'castSpell': {
      const spell = SPELLS[action.spellId]!;
      if (spell.castingTime === 'action') actor.turn.actionUsed = true;
      else actor.turn.bonusActionUsed = true;
      if (action.slotLevel >= 1) actor.spellSlots[action.slotLevel - 1]!.current -= 1;
      else if (actor.innateSpells[action.spellId]) actor.innateSpells[action.spellId]!.current -= 1;
      if (spell.concentration) events.push(...breakConcentration(draft, actorId));
      events.push(...endHide(actor));
      const targetIds = action.targets.flatMap((t) => ('combatantId' in t ? [t.combatantId] : []));
      const positions = action.targets.flatMap((t) => ('position' in t ? [t.position] : []));
      // Telegraph the cast (and its area) before any result lands, so a frontend
      // can detonate the footprint ahead of the damage/save numbers.
      events.push({
        type: 'spellCast', casterId: actorId, spellId: action.spellId,
        origin: actor.position, cells: spellFootprint(draft, actor, spell, action.targets),
      });
      events.push(...spell.cast({ state: draft, casterId: actorId, slotLevel: action.slotLevel, targetIds, positions, ...(action.weaponId ? { weaponId: action.weaponId } : {}) }));
      break;
    }
    case 'useItem': {
      const item = ITEMS[action.itemId]!;
      if (item.useTime === 'action') actor.turn.actionUsed = true;
      else actor.turn.bonusActionUsed = true;
      const stack = actor.inventory.find((s) => s.itemId === action.itemId)!;
      stack.qty -= 1;
      if (stack.qty === 0) actor.inventory = actor.inventory.filter((s) => s !== stack);
      const targets = action.targets ?? [];
      const targetIds = targets.flatMap((t) => ('combatantId' in t ? [t.combatantId] : []));
      const positions = targets.flatMap((t) => ('position' in t ? [t.position] : []));
      events.push({ type: 'itemUsed', combatantId: actorId, itemId: action.itemId, ...(targetIds[0] !== undefined ? { targetId: targetIds[0] } : {}) });
      if (item.targeting.kind === 'thrown') events.push(...endHide(actor));
      // A spell scroll casts its spell for real — so telegraph the cast and its
      // footprint the same way castSpell does, or the frontend has nothing to
      // animate (a Fireball scroll would detonate invisibly).
      if (item.targeting.kind === 'spell') {
        const scrollSpell = SPELLS[item.targeting.spellId];
        if (scrollSpell) {
          events.push({
            type: 'spellCast', casterId: actorId, spellId: scrollSpell.id,
            origin: actor.position, cells: spellFootprint(draft, actor, scrollSpell, targets),
          });
        }
      }
      events.push(...item.apply({ state: draft, userId: actorId, targetIds, positions }));
      break;
    }
    case 'useFeature': {
      const f = FEATURES[action.featureId]!;
      if (f.trigger === 'bonus') actor.turn.bonusActionUsed = true;
      if (f.trigger === 'action') actor.turn.actionUsed = true;
      const uses = actor.featureUses[action.featureId];
      if (uses && !f.manualUses) uses.current -= 1;
      events.push(...(f.apply?.({ state: draft, actorId }) ?? []));
      break;
    }
    case 'dash':
      actor.turn.actionUsed = true;
      actor.turn.movementMax += actor.speed;
      events.push({ type: 'dashed', combatantId: actorId });
      break;
    case 'disengage':
      actor.turn.actionUsed = true;
      actor.turn.disengaged = true;
      events.push({ type: 'disengaged', combatantId: actorId });
      break;
    case 'dodge':
      actor.turn.actionUsed = true;
      actor.conditions.push({ id: 'dodging' });
      events.push({ type: 'dodging', combatantId: actorId });
      break;
    case 'hide':
      actor.turn.actionUsed = true;
      events.push(...attemptHide(draft, actorId));
      break;
    case 'shakeAwake': {
      actor.turn.actionUsed = true;
      const t = draft.combatants[action.targetId]!;
      t.conditions = t.conditions.filter((c) => c.id !== 'unconscious');
      events.push({ type: 'conditionRemoved', combatantId: t.id, condition: 'unconscious' });
      break;
    }
    case 'endTurn':
      events.push(...endTurn(draft, runEndOfTurnSaves));
      break;
  }

  // If the current actor died to an opportunity attack, hand the turn on.
  if (!draft.winner && !draft.combatants[currentCombatant(draft).id]!.alive) {
    events.push(...endTurn(draft, runEndOfTurnSaves));
  }

  return { state: draft, events };
}

/**
 * End-of-turn repeat saves (Sleep). Success ends the condition; failing the
 * repeat while Incapacitated escalates to Unconscious for 1 minute.
 */
function runEndOfTurnSaves(state: GameState, id: Id): GameEvent[] {
  const c = state.combatants[id]!;
  if (!c.alive) return [];
  const events: GameEvent[] = [];
  const keep: typeof c.conditions = [];
  for (const cond of c.conditions) {
    if (!cond.repeatSave) {
      keep.push(cond);
      continue;
    }
    const save = savingThrow(state, id, cond.repeatSave.ability, cond.repeatSave.dc);
    events.push(save.event);
    if (save.success) {
      events.push({ type: 'conditionRemoved', combatantId: id, condition: cond.id });
    } else if (cond.id === 'burning') {
      // Searing Smite: still alight, so it bites again. The only save-ends
      // condition that *does* something on a failure rather than merely
      // persisting — which is what makes it worth a slot on a target that will
      // live a few more rounds.
      const burn = rollDice(state.rng, '1d6');
      state.rng = burn.state;
      events.push(...applyDamage(state, id, cond.sourceId ?? id, burn.total, 'fire', burn.rolls,
        { tags: ['Searing Smite'] }));
      if (state.combatants[id]!.alive) keep.push(cond);
    } else if (cond.id === 'incapacitated') {
      const esc = {
        id: 'unconscious' as const,
        expiresAtRound: state.round + 10, // 1 minute
        ...(cond.sourceId !== undefined ? { sourceId: cond.sourceId } : {}),
      };
      keep.push(esc);
      events.push({ type: 'conditionRemoved', combatantId: id, condition: 'incapacitated' });
      events.push({ type: 'conditionApplied', combatantId: id, condition: 'unconscious', ...(cond.sourceId !== undefined ? { sourceId: cond.sourceId } : {}) });
    } else {
      keep.push(cond); // failed but no escalation: condition persists
    }
  }
  c.conditions = keep;
  return events;
}
