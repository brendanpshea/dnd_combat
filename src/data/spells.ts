/**
 * Spell data. Per the spec, `cast` is the one place code lives inside data:
 * each spell is a small hook over engine helpers, never a branch in the engine.
 *
 * Targeting declarations drive legalActions and CLI prompts:
 * - enemy/ally/any: pick combatant(s) within range (feet; 0 = touch/adjacent)
 * - sphere2x2: pick an anchor cell for the 2x2 template
 * - cone: pick one of 8 directions (encoded as an adjacent cell position)
 */
import type { GameState, Id, Ability, Position } from '../engine/types.js';
import { abilityMod, proficiencyBonus, cellAt } from '../engine/types.js';
import { rollD20, rollDice, resolveRollMode } from '../engine/dice.js';
import { adjacent, distanceFeet, sphere2x2, cone15, DIRECTIONS, Direction8, hasLineOfSight } from '../engine/grid.js';
import { applyDamage, collectAttackSources } from '../engine/rules/attack.js';
import { pushCreature } from '../engine/rules/movement.js';
import { savingThrow } from '../engine/rules/saves.js';
import type { GameEvent } from '../engine/events.js';
import { acOf, wearsMetal } from './armor.js';

export type SpellTargeting =
  | { kind: 'creature'; range: number; who: 'enemy' | 'ally' | 'any'; count: number }
  | { kind: 'sphere2x2'; range: number }
  | { kind: 'cone15' }
  | { kind: 'emptyCell'; range: number }   // Misty Step
  | { kind: 'self' };                       // Thunderwave (adjacent burst)

export interface CastContext {
  state: GameState;
  casterId: Id;
  slotLevel: number; // 0 for cantrips
  /** Combatant targets (creature targeting) or positions (area targeting). */
  targetIds: Id[];
  positions: Position[];
}

export interface SpellData {
  id: Id;
  name: string;
  level: number; // 0 = cantrip
  castingTime: 'action' | 'bonus';
  targeting: SpellTargeting;
  concentration: boolean;
  cast(ctx: CastContext): GameEvent[];
}

// --- shared helpers --------------------------------------------------------

function spellMod(state: GameState, casterId: Id): number {
  const c = state.combatants[casterId]!;
  return abilityMod(c.abilities[c.spellcastingAbility ?? 'int']);
}

export function spellDc(state: GameState, casterId: Id): number {
  const c = state.combatants[casterId]!;
  return 8 + proficiencyBonus(c.level) + spellMod(state, casterId);
}

/** Spell attack roll: shares the adv/dis machinery with weapon attacks. */
function spellAttack(
  state: GameState,
  casterId: Id,
  targetId: Id,
  opts: { melee: boolean; extraAdv?: string[] },
): { hit: boolean; crit: boolean; event: GameEvent } {
  const caster = state.combatants[casterId]!;
  const target = state.combatants[targetId]!;
  // Reuse the weapon source collector with a synthetic profile.
  const fake = { melee: opts.melee, range: opts.melee ? undefined : { normal: 9999, long: 9999 }, properties: [] };
  const { adv, dis } = collectAttackSources(state, caster, target, fake as never, opts.melee);
  adv.push(...(opts.extraAdv ?? []));
  const mode = resolveRollMode(adv, dis);
  const d20 = rollD20(state.rng, mode);
  state.rng = d20.state;
  let total = d20.natural + spellMod(state, casterId) + proficiencyBonus(caster.level);
  if (caster.conditions.some((c) => c.id === 'blessed')) {
    const d4 = rollDice(state.rng, '1d4');
    state.rng = d4.state;
    total += d4.total;
  }
  const unconsciousAdjacent =
    target.conditions.some((c) => c.id === 'unconscious') && opts.melee;
  const crit = d20.natural === 20 || unconsciousAdjacent;
  const targetAc = acOf(target);
  const hit = d20.natural !== 1 && (d20.natural === 20 || total >= targetAc);
  return {
    hit,
    crit: hit && crit,
    event: {
      type: 'attackRolled',
      attackerId: casterId, targetId, weaponId: 'spell',
      natural: d20.natural, total, targetAc,
      mode, advSources: adv, disSources: dis,
      hit, crit: hit && crit, opportunity: false,
    },
  };
}

function heal(state: GameState, targetId: Id, sourceId: Id, amount: number): GameEvent {
  const t = state.combatants[targetId]!;
  t.hp = Math.min(t.maxHp, t.hp + amount);
  return { type: 'healed', targetId, sourceId, amount };
}

/** Life Domain: level-1+ healing spells restore +2 + spell level. */
function discipleOfLifeBonus(state: GameState, casterId: Id, slotLevel: number): number {
  const c = state.combatants[casterId]!;
  return c.featureIds.includes('disciple-of-life') && slotLevel >= 1 ? 2 + slotLevel : 0;
}

// --- the spells -------------------------------------------------------------

export const SPELLS: Record<Id, SpellData> = {
  'fire-bolt': {
    id: 'fire-bolt', name: 'Fire Bolt', level: 0, castingTime: 'action',
    targeting: { kind: 'creature', range: 120, who: 'enemy', count: 1 },
    concentration: false,
    cast({ state, casterId, targetIds }) {
      const targetId = targetIds[0]!;
      const atk = spellAttack(state, casterId, targetId, { melee: false });
      const events: GameEvent[] = [atk.event];
      if (atk.hit) {
        const dmg = rollDice(state.rng, '1d10', atk.crit);
        state.rng = dmg.state;
        events.push(...applyDamage(state, targetId, casterId, dmg.total, 'fire', dmg.rolls));
      }
      return events;
    },
  },

  'shocking-grasp': {
    id: 'shocking-grasp', name: 'Shocking Grasp', level: 0, castingTime: 'action',
    targeting: { kind: 'creature', range: 0, who: 'enemy', count: 1 },
    concentration: false,
    cast({ state, casterId, targetIds }) {
      const targetId = targetIds[0]!;
      const target = state.combatants[targetId]!;
      const atk = spellAttack(state, casterId, targetId, {
        melee: true, extraAdv: wearsMetal(target) ? ['metal armor'] : [],
      });
      const events: GameEvent[] = [atk.event];
      if (atk.hit) {
        const dmg = rollDice(state.rng, '1d8', atk.crit);
        state.rng = dmg.state;
        events.push(...applyDamage(state, targetId, casterId, dmg.total, 'lightning', dmg.rolls));
        if (target.alive) {
          target.conditions.push({ id: 'noReactions', sourceId: casterId });
          events.push({ type: 'conditionApplied', combatantId: targetId, condition: 'noReactions', sourceId: casterId });
        }
      }
      return events;
    },
  },

  'sacred-flame': {
    id: 'sacred-flame', name: 'Sacred Flame', level: 0, castingTime: 'action',
    targeting: { kind: 'creature', range: 60, who: 'enemy', count: 1 },
    concentration: false,
    cast({ state, casterId, targetIds }) {
      const targetId = targetIds[0]!;
      const dc = spellDc(state, casterId);
      const save = savingThrow(state, targetId, 'dex', dc);
      const events: GameEvent[] = [save.event];
      if (!save.success) {
        const dmg = rollDice(state.rng, '1d8');
        state.rng = dmg.state;
        events.push(...applyDamage(state, targetId, casterId, dmg.total, 'radiant', dmg.rolls));
      }
      return events;
    },
  },

  'cure-wounds': {
    id: 'cure-wounds', name: 'Cure Wounds', level: 1, castingTime: 'action',
    targeting: { kind: 'creature', range: 0, who: 'ally', count: 1 },
    concentration: false,
    cast({ state, casterId, slotLevel, targetIds }) {
      const targetId = targetIds[0]!;
      const roll = rollDice(state.rng, `${2 * slotLevel}d8`);
      state.rng = roll.state;
      const amount = roll.total + spellMod(state, casterId) + discipleOfLifeBonus(state, casterId, slotLevel);
      return [heal(state, targetId, casterId, amount)];
    },
  },

  bless: {
    id: 'bless', name: 'Bless', level: 1, castingTime: 'action',
    targeting: { kind: 'creature', range: 30, who: 'ally', count: 3 },
    concentration: true,
    cast({ state, casterId, targetIds }) {
      const events: GameEvent[] = [];
      for (const tid of targetIds) {
        const t = state.combatants[tid]!;
        if (!t.conditions.some((c) => c.id === 'blessed')) {
          t.conditions.push({ id: 'blessed', sourceId: casterId, concentration: true });
          events.push({ type: 'conditionApplied', combatantId: tid, condition: 'blessed', sourceId: casterId });
        }
      }
      state.combatants[casterId]!.concentratingOn = { spellId: 'bless', targetIds: [...targetIds] };
      return events;
    },
  },

  'magic-missile': {
    id: 'magic-missile', name: 'Magic Missile', level: 1, castingTime: 'action',
    // 3 darts (+1 per slot level above 1), freely distributed: targetIds lists
    // one entry per dart, repeats allowed.
    targeting: { kind: 'creature', range: 120, who: 'enemy', count: 3 },
    concentration: false,
    cast({ state, casterId, targetIds }) {
      const events: GameEvent[] = [];
      for (const tid of targetIds) {
        const t = state.combatants[tid]!;
        if (!t.alive) continue; // later darts may hit an already-dead target choice
        const dmg = rollDice(state.rng, '1d4+1');
        state.rng = dmg.state;
        events.push(...applyDamage(state, tid, casterId, dmg.total, 'force', dmg.rolls));
      }
      return events;
    },
  },

  sleep: {
    id: 'sleep', name: 'Sleep', level: 1, castingTime: 'action',
    targeting: { kind: 'sphere2x2', range: 60 },
    concentration: false,
    cast({ state, casterId, positions }) {
      const events: GameEvent[] = [];
      const dc = spellDc(state, casterId);
      const cells = sphere2x2(positions[0]!);
      for (const pos of cells) {
        const cell = cellAt(state.grid, pos);
        const tid = cell?.occupantId;
        if (!tid) continue;
        const t = state.combatants[tid]!;
        if (!t.alive) continue;
        const save = savingThrow(state, tid, 'wis', dc);
        events.push(save.event);
        if (!save.success) {
          t.conditions.push({
            id: 'incapacitated', sourceId: casterId,
            repeatSave: { ability: 'wis', dc },
          });
          events.push({ type: 'conditionApplied', combatantId: tid, condition: 'incapacitated', sourceId: casterId });
        }
      }
      return events;
    },
  },

  'burning-hands': {
    id: 'burning-hands', name: 'Burning Hands', level: 1, castingTime: 'action',
    targeting: { kind: 'cone15' },
    concentration: false,
    cast({ state, casterId, slotLevel, positions }) {
      const caster = state.combatants[casterId]!;
      const sculpt = caster.featureIds.includes('sculpt-spells');
      const dir = directionFromDelta(caster.position, positions[0]!);
      const events: GameEvent[] = [];
      const dc = spellDc(state, casterId);
      const dice = `${2 + slotLevel}d6`; // 3d6 at slot 1, +1d6 per level above
      for (const pos of cone15(caster.position, dir)) {
        const cell = cellAt(state.grid, pos);
        const tid = cell?.occupantId;
        if (!tid) continue;
        const t = state.combatants[tid]!;
        if (!t.alive || !hasLineOfSight(state.grid, caster.position, pos)) continue;
        if (sculpt && t.team === caster.team) continue; // Sculpt Spells: allies unharmed
        const save = savingThrow(state, tid, 'dex', dc);
        events.push(save.event);
        const dmg = rollDice(state.rng, dice);
        state.rng = dmg.state;
        const amount = save.success ? Math.floor(dmg.total / 2) : dmg.total;
        if (amount > 0) {
          events.push(...applyDamage(state, tid, casterId, amount, 'fire', dmg.rolls));
        }
      }
      return events;
    },
  },
  'guiding-bolt': {
    id: 'guiding-bolt', name: 'Guiding Bolt', level: 1, castingTime: 'action',
    targeting: { kind: 'creature', range: 120, who: 'enemy', count: 1 },
    concentration: false,
    cast({ state, casterId, slotLevel, targetIds }) {
      const targetId = targetIds[0]!;
      const atk = spellAttack(state, casterId, targetId, { melee: false });
      const events: GameEvent[] = [atk.event];
      if (atk.hit) {
        const dmg = rollDice(state.rng, `${3 + slotLevel}d6`, atk.crit); // 4d6 at slot 1
        state.rng = dmg.state;
        events.push(...applyDamage(state, targetId, casterId, dmg.total, 'radiant', dmg.rolls));
        const t = state.combatants[targetId]!;
        if (t.alive && !t.conditions.some((c) => c.id === 'guided')) {
          t.conditions.push({ id: 'guided', sourceId: casterId });
          events.push({ type: 'conditionApplied', combatantId: targetId, condition: 'guided', sourceId: casterId });
        }
      }
      return events;
    },
  },

  thunderwave: {
    id: 'thunderwave', name: 'Thunderwave', level: 1, castingTime: 'action',
    targeting: { kind: 'self' },
    concentration: false,
    cast({ state, casterId, slotLevel }) {
      const caster = state.combatants[casterId]!;
      const sculpt = caster.featureIds.includes('sculpt-spells');
      const dc = spellDc(state, casterId);
      const events: GameEvent[] = [];
      const victims = Object.values(state.combatants).filter(
        (c) => c.alive && c.id !== casterId && adjacent(c.position, caster.position) &&
          !(sculpt && c.team === caster.team),
      );
      for (const t of victims) {
        const save = savingThrow(state, t.id, 'con', dc);
        events.push(save.event);
        const dmg = rollDice(state.rng, `${1 + slotLevel}d8`); // 2d8 at slot 1
        state.rng = dmg.state;
        const amount = save.success ? Math.floor(dmg.total / 2) : dmg.total;
        if (amount > 0) events.push(...applyDamage(state, t.id, casterId, amount, 'thunder', dmg.rolls));
        if (!save.success && t.alive) {
          const dir = {
            x: Math.sign(t.position.x - caster.position.x),
            y: Math.sign(t.position.y - caster.position.y),
          };
          events.push(...pushCreature(state, t.id, dir, 2));
        }
      }
      return events;
    },
  },

  'scorching-ray': {
    id: 'scorching-ray', name: 'Scorching Ray', level: 2, castingTime: 'action',
    // One entry per ray, repeats allowed (like Magic Missile darts).
    targeting: { kind: 'creature', range: 120, who: 'enemy', count: 3 },
    concentration: false,
    cast({ state, casterId, targetIds }) {
      const events: GameEvent[] = [];
      for (const tid of targetIds) {
        const t = state.combatants[tid]!;
        if (!t.alive) continue;
        const atk = spellAttack(state, casterId, tid, { melee: false });
        events.push(atk.event);
        if (atk.hit) {
          const dmg = rollDice(state.rng, '2d6', atk.crit);
          state.rng = dmg.state;
          events.push(...applyDamage(state, tid, casterId, dmg.total, 'fire', dmg.rolls));
        }
      }
      return events;
    },
  },

  'misty-step': {
    id: 'misty-step', name: 'Misty Step', level: 2, castingTime: 'bonus',
    targeting: { kind: 'emptyCell', range: 30 },
    concentration: false,
    cast({ state, casterId, positions }) {
      const caster = state.combatants[casterId]!;
      const to = positions[0]!;
      const fromCell = cellAt(state.grid, caster.position)!;
      if (fromCell.occupantId === casterId) delete fromCell.occupantId;
      const path = [caster.position, to];
      caster.position = to;
      cellAt(state.grid, to)!.occupantId = casterId;
      return [{ type: 'moved', combatantId: casterId, path }];
    },
  },

  'hold-person': {
    id: 'hold-person', name: 'Hold Person', level: 2, castingTime: 'action',
    targeting: { kind: 'creature', range: 60, who: 'enemy', count: 1 },
    concentration: true,
    cast({ state, casterId, targetIds }) {
      const targetId = targetIds[0]!;
      const dc = spellDc(state, casterId);
      const save = savingThrow(state, targetId, 'wis', dc);
      const events: GameEvent[] = [save.event];
      if (!save.success) {
        const t = state.combatants[targetId]!;
        t.conditions.push({
          id: 'paralyzed', sourceId: casterId, concentration: true,
          repeatSave: { ability: 'wis', dc },
        });
        events.push({ type: 'conditionApplied', combatantId: targetId, condition: 'paralyzed', sourceId: casterId });
        state.combatants[casterId]!.concentratingOn = { spellId: 'hold-person', targetIds: [targetId] };
      }
      return events;
    },
  },

  aid: {
    id: 'aid', name: 'Aid', level: 2, castingTime: 'action',
    targeting: { kind: 'creature', range: 30, who: 'ally', count: 3 },
    concentration: false,
    cast({ state, casterId, slotLevel, targetIds }) {
      const amount = 5 * (slotLevel - 1); // +5 at slot 2, +10 at slot 3...
      const events: GameEvent[] = [];
      for (const tid of new Set(targetIds)) {
        const t = state.combatants[tid]!;
        t.maxHp += amount;
        t.hp += amount;
        events.push({ type: 'healed', targetId: tid, sourceId: casterId, amount });
      }
      return events;
    },
  },
};

export function directionFromDelta(from: Position, to: Position): Direction8 {
  const dx = Math.sign(to.x - from.x);
  const dy = Math.sign(to.y - from.y);
  for (const [name, d] of Object.entries(DIRECTIONS) as Array<[Direction8, Position]>) {
    if (d.x === dx && d.y === dy) return name;
  }
  throw new Error('cone direction must be an adjacent cell');
}

/** Is this target selection valid for the spell's declaration? */
export function validTarget(
  state: GameState,
  casterId: Id,
  spell: SpellData,
  targetId: Id,
): boolean {
  const caster = state.combatants[casterId]!;
  const t = state.combatants[targetId];
  if (!t || !t.alive) return false;
  if (spell.targeting.kind !== 'creature') return false;
  const { range, who } = spell.targeting;
  if (who === 'enemy' && t.team === caster.team) return false;
  if (who === 'ally' && t.team !== caster.team) return false;
  if (range === 0) {
    return targetId === casterId || adjacent(caster.position, t.position);
  }
  return (
    distanceFeet(caster.position, t.position) <= range &&
    hasLineOfSight(state.grid, caster.position, t.position)
  );
}
