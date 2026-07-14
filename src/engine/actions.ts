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
import { posEq, cellAt } from './types.js';
import { WEAPONS } from '../data/weapons.js';
import { SPELLS, SpellData, validTarget, directionFromDelta } from '../data/spells.js';
import { FEATURES } from '../data/features.js';
import { distanceFeet, adjacent, hasLineOfSight, sphere2x2, DIRECTIONS, cone15, Direction8 } from './grid.js';
import { currentCombatant, endTurn } from './turn.js';
import { resolveAttack, breakConcentration } from './rules/attack.js';
import { savingThrow } from './rules/saves.js';
import { moveDestinations, executeMove } from './rules/movement.js';
import type { GameEvent } from './events.js';

export type Target = { combatantId: Id } | { position: Position };

export type Action =
  | { kind: 'move'; to: Position }
  | { kind: 'attack'; weaponId: Id; targetId: Id; offhand?: boolean }
  | { kind: 'castSpell'; spellId: Id; slotLevel: number; targets: Target[] }
  | { kind: 'useFeature'; featureId: Id }
  | { kind: 'dash' }
  | { kind: 'disengage' }
  | { kind: 'dodge' }
  | { kind: 'shakeAwake'; targetId: Id }
  | { kind: 'endTurn' };

function isIncapacitated(c: Combatant): boolean {
  return c.conditions.some((k) => k.id === 'incapacitated' || k.id === 'unconscious');
}

function canAttackWith(state: GameState, actor: Combatant, weaponId: Id, targetId: Id): boolean {
  const w = WEAPONS[weaponId];
  const t = state.combatants[targetId];
  if (!w || !t || !t.alive || t.team === actor.team) return false;
  if (!actor.weaponIds.includes(weaponId)) return false;
  const dist = distanceFeet(actor.position, t.position);
  const inMelee = w.melee && adjacent(actor.position, t.position);
  const inRange =
    w.range !== undefined && dist <= w.range.long &&
    hasLineOfSight(state.grid, actor.position, t.position);
  return inMelee || inRange;
}

function canUseOffhand(actor: Combatant, weaponId: Id): boolean {
  const w = WEAPONS[weaponId];
  return (
    !!w && w.properties.includes('light') &&
    actor.turn.attackedThisTurn && !actor.turn.bonusActionUsed
  );
}

function spellAvailable(actor: Combatant, spell: SpellData, slotLevel: number): boolean {
  if (!actor.spellIds.includes(spell.id)) return false;
  if (spell.level === 0) return slotLevel === 0;
  if (slotLevel < spell.level) return false;
  const pool = actor.spellSlots[slotLevel - 1];
  return !!pool && pool.current > 0;
}

function validSpellTargets(state: GameState, actorId: Id, spell: SpellData, targets: Target[]): boolean {
  const actor = state.combatants[actorId]!;
  const t = spell.targeting;
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

export function isLegalAction(state: GameState, actorId: Id, action: Action): boolean {
  const actor = state.combatants[actorId];
  if (!actor || !actor.alive || state.winner) return false;
  if (currentCombatant(state).id !== actorId) return false;
  const incap = isIncapacitated(actor);

  switch (action.kind) {
    case 'endTurn':
      return true;
    case 'move':
      return moveDestinations(state, actor).some((p) => posEq(p, action.to));
    case 'attack':
      if (incap) return false;
      if (action.offhand) {
        return canUseOffhand(actor, action.weaponId) && canAttackWith(state, actor, action.weaponId, action.targetId);
      }
      return !actor.turn.actionUsed && canAttackWith(state, actor, action.weaponId, action.targetId);
    case 'castSpell': {
      if (incap) return false;
      const spell = SPELLS[action.spellId];
      if (!spell) return false;
      const costsAction = spell.castingTime === 'action';
      if (costsAction && actor.turn.actionUsed) return false;
      if (!costsAction && actor.turn.bonusActionUsed) return false;
      return spellAvailable(actor, spell, action.slotLevel) &&
        validSpellTargets(state, actorId, spell, action.targets);
    }
    case 'useFeature': {
      if (incap) return false;
      const f = FEATURES[action.featureId];
      if (!f || !f.apply || !actor.featureIds.includes(action.featureId)) return false;
      const uses = actor.featureUses[action.featureId];
      if (f.uses && (!uses || uses.current <= 0)) return false;
      if (f.trigger === 'bonus' && actor.turn.bonusActionUsed) return false;
      if (f.trigger === 'action' && actor.turn.actionUsed) return false;
      // 'free' features with an action-restoring effect only make sense after
      // the action is spent; harmless either way.
      if (action.featureId === 'action-surge' && !actor.turn.actionUsed) return false;
      return true;
    }
    case 'dash':
    case 'disengage':
    case 'dodge':
      return !incap && !actor.turn.actionUsed;
    case 'shakeAwake': {
      if (incap || actor.turn.actionUsed) return false;
      const t = state.combatants[action.targetId];
      return !!t && t.alive && t.team === actor.team && t.id !== actorId &&
        adjacent(actor.position, t.position) &&
        t.conditions.some((c) => c.id === 'unconscious');
    }
  }
}

/** Enumerate playable actions (with default targets for multi-target spells). */
export function legalActions(state: GameState, actorId: Id): Action[] {
  const actor = state.combatants[actorId];
  if (!actor || !actor.alive || state.winner) return [];
  if (currentCombatant(state).id !== actorId) return [];

  const actions: Action[] = [];
  const enemies = Object.values(state.combatants).filter((c) => c.alive && c.team !== actor.team);
  const allies = Object.values(state.combatants).filter((c) => c.alive && c.team === actor.team);

  for (const to of moveDestinations(state, actor)) {
    actions.push({ kind: 'move', to });
  }

  for (const wid of actor.weaponIds) {
    for (const t of enemies) {
      const main: Action = { kind: 'attack', weaponId: wid, targetId: t.id };
      if (isLegalAction(state, actorId, main)) actions.push(main);
      const off: Action = { kind: 'attack', weaponId: wid, targetId: t.id, offhand: true };
      if (isLegalAction(state, actorId, off)) actions.push(off);
    }
  }

  for (const sid of actor.spellIds) {
    const spell = SPELLS[sid]!;
    const slotLevel = spell.level; // enumerate at base level; upcasting via custom actions
    if (!spellAvailable(actor, spell, slotLevel)) continue;
    const t = spell.targeting;
    if (t.kind === 'creature') {
      const pool = t.who === 'enemy' ? enemies : t.who === 'ally' ? allies : [...enemies, ...allies];
      const valid = pool.filter((c) => validTarget(state, actorId, spell, c.id));
      if (t.count === 1) {
        for (const v of valid) {
          const a: Action = { kind: 'castSpell', spellId: sid, slotLevel, targets: [{ combatantId: v.id }] };
          if (isLegalAction(state, actorId, a)) actions.push(a);
        }
      } else if (valid.length > 0) {
        // Default selection: Magic Missile → all darts at first enemy;
        // Bless → up to `count` allies (self first).
        const targets: Target[] =
          sid === 'magic-missile'
            ? Array.from({ length: t.count }, () => ({ combatantId: valid[0]!.id }))
            : valid.slice(0, t.count).map((c) => ({ combatantId: c.id }));
        const a: Action = { kind: 'castSpell', spellId: sid, slotLevel, targets };
        if (isLegalAction(state, actorId, a)) actions.push(a);
      }
    } else if (t.kind === 'sphere2x2') {
      // Anchors whose 2x2 covers at least one enemy.
      const seen = new Set<string>();
      for (const e of enemies) {
        for (const dx of [-1, 0]) {
          for (const dy of [-1, 0]) {
            const anchor = { x: e.position.x + dx, y: e.position.y + dy };
            const k = `${anchor.x},${anchor.y}`;
            if (seen.has(k)) continue;
            seen.add(k);
            const a: Action = { kind: 'castSpell', spellId: sid, slotLevel, targets: [{ position: anchor }] };
            if (isLegalAction(state, actorId, a)) actions.push(a);
          }
        }
      }
    } else {
      // cone15: directions that would catch at least one enemy.
      for (const dir of Object.keys(DIRECTIONS) as Direction8[]) {
        const covers = cone15(actor.position, dir).some((p) =>
          enemies.some((e) => posEq(e.position, p)),
        );
        if (!covers) continue;
        const d = DIRECTIONS[dir];
        const a: Action = {
          kind: 'castSpell', spellId: sid, slotLevel,
          targets: [{ position: { x: actor.position.x + d.x, y: actor.position.y + d.y } }],
        };
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
export function step(state: GameState, action: Action): { state: GameState; events: GameEvent[] } {
  const actorId = currentCombatant(state).id;
  if (!isLegalAction(state, actorId, action)) {
    throw new Error(`Illegal action for ${actorId}: ${JSON.stringify(action)}`);
  }

  const draft: GameState = structuredClone(state);
  const actor = draft.combatants[actorId]!;
  const events: GameEvent[] = [];

  switch (action.kind) {
    case 'move':
      events.push(...executeMove(draft, actorId, action.to));
      break;
    case 'attack':
      if (action.offhand) {
        actor.turn.bonusActionUsed = true;
      } else {
        actor.turn.actionUsed = true;
        actor.turn.attackedThisTurn = true;
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
      if (spell.concentration) events.push(...breakConcentration(draft, actorId));
      const targetIds = action.targets.flatMap((t) => ('combatantId' in t ? [t.combatantId] : []));
      const positions = action.targets.flatMap((t) => ('position' in t ? [t.position] : []));
      events.push(...spell.cast({ state: draft, casterId: actorId, slotLevel: action.slotLevel, targetIds, positions }));
      break;
    }
    case 'useFeature': {
      const f = FEATURES[action.featureId]!;
      if (f.trigger === 'bonus') actor.turn.bonusActionUsed = true;
      if (f.trigger === 'action') actor.turn.actionUsed = true;
      const uses = actor.featureUses[action.featureId];
      if (uses) uses.current -= 1;
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
