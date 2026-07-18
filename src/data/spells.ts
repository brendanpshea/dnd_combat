/**
 * Spell data. Per the spec, `cast` is the one place code lives inside data:
 * each spell is a small hook over engine helpers, never a branch in the engine.
 *
 * Targeting declarations drive legalActions and CLI prompts:
 * - enemy/ally/any: pick combatant(s) within range (feet; 0 = touch/adjacent)
 * - sphere2x2: pick an anchor cell for the 2x2 template
 * - cone: pick one of 8 directions (encoded as an adjacent cell position)
 */
import type { GameState, Combatant, Id, Ability, Position, CreatureType } from '../engine/types.js';
import { abilityMod, proficiencyBonus, cellAt, isDown } from '../engine/types.js';
import { rollD20, rollDice, resolveRollMode, parseDice } from '../engine/dice.js';
import { adjacent, distanceFeet, sphere2x2, sphere5x5, cone15, cube15, line15, DIRECTIONS, Direction8, hasLineOfSight } from '../engine/grid.js';
import { isHidden } from '../engine/rules/hide.js';
import { applyDamage, collectAttackSources, consumeFamiliarHelp, resolveAttack, canAttackWith, charmAway, tryAutoShield } from '../engine/rules/attack.js';
import { applyLucky } from '../engine/rules/luck.js';
import { attackableWeapons } from '../engine/rules/equipment.js';
import { pushCreature } from '../engine/rules/movement.js';
import { savingThrow } from '../engine/rules/saves.js';
import { applyHealing } from '../engine/rules/heal.js';
import type { GameEvent } from '../engine/events.js';
import { acOf, wearsMetal } from './armor.js';
import { WEAPONS } from './weapons.js';

export type SpellTargeting =
  | {
      kind: 'creature'; range: number; who: 'enemy' | 'ally' | 'any'; count: number;
      /** Restrict to one SRD creature type (Animal Friendship: beasts only). */
      creatureType?: CreatureType;
    }
  /**
   * Anything you could hit with the weapon in your hand — True Strike.
   *
   * Not a range: the reach belongs to the weapon, so a staff is melee and a
   * crossbow is 80 ft, and the same spell has to mean both. Declaring the
   * *rule* instead of a number lets the weapon answer, and keeps line of sight,
   * long range and every other attack rule in the one place that owns them.
   */
  | { kind: 'weaponAttack' }
  | { kind: 'sphere2x2'; range: number }
  | { kind: 'sphere5x5'; range: number }    // Fireball
  | { kind: 'cone15' }
  | { kind: 'cube15' }                       // Thunderwave (3x3 adjacent square)
  | { kind: 'line15' }                       // Lightning Bolt (line to the edge)
  | { kind: 'emptyCell'; range: number }   // Misty Step
  | { kind: 'self' };                       // Thunderwave (adjacent burst)

export interface CastContext {
  state: GameState;
  casterId: Id;
  slotLevel: number; // 0 for cantrips
  /** Combatant targets (creature targeting) or positions (area targeting). */
  targetIds: Id[];
  positions: Position[];
  /** For weaponAttack spells (True Strike): which weapon to swing. */
  weaponId?: Id;
}

export interface SpellData {
  id: Id;
  name: string;
  level: number; // 0 = cantrip
  castingTime: 'action' | 'bonus' | 'reaction';
  targeting: SpellTargeting;
  concentration: boolean;
  /**
   * A glyph for menus. Declared per spell because it says what the spell *is*,
   * which nothing else in the data knows. How you *aim* it is NOT baked in here
   * — that's derivable from `targeting`, and menus say it in words.
   */
  icon: string;
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

/**
 * Damage cantrips gain a die at levels 5/11/17. Scales the leading die count of
 * a dice expression ('1d10' → '2d10' at level 5), so a cantrip's damage roll is
 * `rollDice(rng, cantripDice(base, caster.level))`.
 */
export function cantripDice(base: string, level: number): string {
  const m = base.match(/^(\d+)d(\d+)$/);
  if (!m) return base;
  const tier = level >= 17 ? 4 : level >= 11 ? 3 : level >= 5 ? 2 : 1;
  return `${Number(m[1]) * tier}d${m[2]}`;
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
  const d20 = applyLucky(state, casterId, rollD20(state.rng, mode), mode);
  state.rng = d20.state;
  consumeFamiliarHelp(state, caster);
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

/** All healing goes through the one rule, so all healing revives. */
function heal(state: GameState, targetId: Id, sourceId: Id, amount: number): GameEvent[] {
  return applyHealing(state, targetId, sourceId, amount);
}

/** Life Domain: level-1+ healing spells restore +2 + spell level. */
function discipleOfLifeBonus(state: GameState, casterId: Id, slotLevel: number): number {
  const c = state.combatants[casterId]!;
  return c.featureIds.includes('disciple-of-life') && slotLevel >= 1 ? 2 + slotLevel : 0;
}

/**
 * Whichever mind is sharpest — True Strike is guided by insight, and the elf
 * doesn't care which kind. This is also what keeps the spell self-balancing
 * across classes without a special case: a fighter's mental stats are 12/10/8,
 * so True Strike is strictly worse than his +3 Strength and he'll never cast
 * it, while a wizard finally gets to swing a staff off Intelligence.
 */
function bestMentalAbility(c: Combatant): Ability {
  const minds: Ability[] = ['int', 'wis', 'cha'];
  return minds.reduce((best, a) => (c.abilities[a] > c.abilities[best] ? a : best), minds[0]!);
}

/**
 * When True Strike is cast without a chosen weapon (the tray's browse path),
 * pick the attackable one that can reach the target and hits hardest. The
 * enemy-tap path offers every weapon explicitly, because at melee range a mace
 * with no disadvantage can beat a crossbow that has it — a judgement the player
 * makes, not this default.
 */
function bestTrueStrikeWeapon(state: GameState, caster: Combatant, targetId: Id): Id | undefined {
  return attackableWeapons(caster)
    .filter((w) => canAttackWith(state, caster, w, targetId))
    .sort((a, b) => avgDamage(WEAPONS[b]!) - avgDamage(WEAPONS[a]!))[0];
}

function avgDamage(w: { damage: string; damageBonus?: number }): number {
  const d = parseDice(w.damage);
  return d.count * (d.sides + 1) / 2 + d.bonus + (w.damageBonus ?? 0);
}

// --- the spells -------------------------------------------------------------

export const SPELLS: Record<Id, SpellData> = {
  'fire-bolt': {
    id: 'fire-bolt', name: 'Fire Bolt', level: 0, castingTime: 'action',
    targeting: { kind: 'creature', range: 120, who: 'enemy', count: 1 },
    concentration: false,
    icon: '🔥',
    cast({ state, casterId, targetIds }) {
      const targetId = targetIds[0]!;
      const atk = spellAttack(state, casterId, targetId, { melee: false });
      const events: GameEvent[] = [atk.event];
      if (atk.hit) {
        const dmg = rollDice(state.rng, cantripDice('1d10', state.combatants[casterId]!.level), atk.crit);
        state.rng = dmg.state;
        events.push(...applyDamage(state, targetId, casterId, dmg.total, 'fire', dmg.rolls));
      }
      return events;
    },
  },

  /**
   * The elf's own magic: your weapon, guided. Deliberately *not* another damage
   * cantrip with a different colour — the weapon in your hand is the spell's
   * whole identity, and "1d8 + mod at range" would just be Fire Bolt wearing a
   * hat.
   *
   * Reaches wherever the weapon does: a staff jabs, a crossbow shoots across
   * the board. That's `weaponAttack` targeting rather than a range on the
   * spell, which could only ever have been one or the other.
   */
  'true-strike': {
    id: 'true-strike', name: 'True Strike', level: 0, castingTime: 'action',
    targeting: { kind: 'weaponAttack' },
    concentration: false,
    icon: '🗡️',
    cast({ state, casterId, targetIds, weaponId }) {
      const caster = state.combatants[casterId]!;
      const targetId = targetIds[0]!;
      // The named weapon, or — cast from the tray with no choice made — the best
      // one that can reach, so the browse path still does something sensible.
      const weapon = weaponId ?? bestTrueStrikeWeapon(state, caster, targetId);
      if (!weapon || !WEAPONS[weapon]) return [];   // nothing that can reach
      return resolveAttack(state, casterId, targetId, weapon, {
        abilityOverride: bestMentalAbility(caster),
      });
    },
  },

  'shocking-grasp': {
    id: 'shocking-grasp', name: 'Shocking Grasp', level: 0, castingTime: 'action',
    targeting: { kind: 'creature', range: 0, who: 'enemy', count: 1 },
    concentration: false,
    icon: '⚡',
    cast({ state, casterId, targetIds }) {
      const targetId = targetIds[0]!;
      const target = state.combatants[targetId]!;
      const atk = spellAttack(state, casterId, targetId, {
        melee: true, extraAdv: wearsMetal(target) ? ['metal armor'] : [],
      });
      const events: GameEvent[] = [atk.event];
      if (atk.hit) {
        const dmg = rollDice(state.rng, cantripDice('1d8', state.combatants[casterId]!.level), atk.crit);
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

  'poison-spray': {
    id: 'poison-spray', name: 'Poison Spray', level: 0, castingTime: 'action',
    targeting: { kind: 'creature', range: 30, who: 'enemy', count: 1 },   // 2024: 10 ft -> 30 ft
    concentration: false,
    icon: '☠️',
    cast({ state, casterId, targetIds }) {
      const targetId = targetIds[0]!;
      const dc = spellDc(state, casterId);
      const save = savingThrow(state, targetId, 'con', dc);
      const events: GameEvent[] = [save.event];
      if (!save.success) {
        const dmg = rollDice(state.rng, cantripDice('1d12', state.combatants[casterId]!.level));
        state.rng = dmg.state;
        events.push(...applyDamage(state, targetId, casterId, dmg.total, 'poison', dmg.rolls));
      }
      return events;
    },
  },

  /**
   * Ray of Sickness — two-stage, like the real spell: a spell *attack roll*
   * (not a save) does the damage, and only on a hit does the target get a
   * chance to shrug off the `poisoned` rider. `poisoned` already exists as a
   * condition (it imposes disadvantage on the bearer's own attacks — see
   * collectAttackSources) but nothing has ever applied it before this. It rides
   * on the generic `repeatSave` mechanism (a Con check at the end of the
   * target's turn removes it), the same one Sleep and Hold Person use, so no
   * new expiry logic was needed.
   */
  'ray-of-sickness': {
    id: 'ray-of-sickness', name: 'Ray of Sickness', level: 1, castingTime: 'action',
    targeting: { kind: 'creature', range: 60, who: 'enemy', count: 1 },
    concentration: false,
    icon: '🤢',
    cast({ state, casterId, slotLevel, targetIds }) {
      const targetId = targetIds[0]!;
      const atk = spellAttack(state, casterId, targetId, { melee: false });
      const events: GameEvent[] = [atk.event];
      if (!atk.hit) return events;
      const dmg = rollDice(state.rng, `${2 + slotLevel}d8`, atk.crit);
      state.rng = dmg.state;
      events.push(...applyDamage(state, targetId, casterId, dmg.total, 'poison', dmg.rolls));
      const target = state.combatants[targetId]!;
      if (target.alive) {
        const dc = spellDc(state, casterId);
        const save = savingThrow(state, targetId, 'con', dc);
        events.push(save.event);
        if (!save.success) {
          target.conditions.push({ id: 'poisoned', sourceId: casterId, repeatSave: { ability: 'con', dc } });
          events.push({ type: 'conditionApplied', combatantId: targetId, condition: 'poisoned', sourceId: casterId });
        }
      }
      return events;
    },
  },

  'sacred-flame': {
    id: 'sacred-flame', name: 'Sacred Flame', level: 0, castingTime: 'action',
    targeting: { kind: 'creature', range: 60, who: 'enemy', count: 1 },
    concentration: false,
    icon: '🔆',
    cast({ state, casterId, targetIds }) {
      const targetId = targetIds[0]!;
      const dc = spellDc(state, casterId);
      const save = savingThrow(state, targetId, 'dex', dc);
      const events: GameEvent[] = [save.event];
      if (!save.success) {
        const dmg = rollDice(state.rng, cantripDice('1d8', state.combatants[casterId]!.level));
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
    icon: '💚',
    cast({ state, casterId, slotLevel, targetIds }) {
      const targetId = targetIds[0]!;
      const roll = rollDice(state.rng, `${2 * slotLevel}d8`);
      state.rng = roll.state;
      const amount = roll.total + spellMod(state, casterId) + discipleOfLifeBonus(state, casterId, slotLevel);
      return heal(state, targetId, casterId, amount);
    },
  },

  'find-familiar': {
    id: 'find-familiar', name: 'Find Familiar', level: 1, castingTime: 'action',
    targeting: { kind: 'self' },
    concentration: false,
    icon: '🦉',
    cast({ state, casterId }) {
      state.combatants[casterId]!.familiar = { kind: 'owl' };
      return [];
    },
  },

  'mage-armor': {
    id: 'mage-armor', name: 'Mage Armor', level: 1, castingTime: 'action',
    targeting: { kind: 'self' },
    concentration: false,
    icon: '🛡️',
    cast({ state, casterId }) {
      state.combatants[casterId]!.mageArmor = true;
      return [];
    },
  },

  bless: {
    id: 'bless', name: 'Bless', level: 1, castingTime: 'action',
    targeting: { kind: 'creature', range: 30, who: 'ally', count: 3 },
    concentration: true,
    icon: '🙏',
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
    icon: '✨',
    cast({ state, casterId, targetIds }) {
      const events: GameEvent[] = [];
      const negated = new Set<Id>();
      for (const tid of targetIds) {
        const t = state.combatants[tid]!;
        if (!t.alive) continue; // later darts may hit an already-dead target choice
        // Brooch of Shielding: immune to Magic Missile outright.
        if (t.featureIds.includes('brooch-shielding')) continue;
        // Shield blocks Magic Missile outright — autocast it on the first dart.
        if (negated.has(tid)) continue;
        const already = t.conditions.some((c) => c.id === 'shielded');
        if (already || tryAutoShield(state, tid)) {
          if (!already) events.push({ type: 'conditionApplied', combatantId: tid, condition: 'shielded', sourceId: tid });
          negated.add(tid);
          continue;
        }
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
    icon: '😴',
    cast({ state, casterId, positions }) {
      const events: GameEvent[] = [];
      const dc = spellDc(state, casterId);
      const cells = sphere2x2(positions[0]!);
      for (const pos of cells) {
        const cell = cellAt(state.grid, pos);
        const tid = cell?.occupantId;
        if (!tid) continue;
        const t = state.combatants[tid]!;
        if (!t.alive || t.featureIds.includes('trance')) continue;
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
    icon: '🖐️',
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
        if (!t.alive) continue; // area engulfs the cone; no per-cell LoS filter
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
  /**
   * Fireball: the signature 3rd-level blast. A 5x5 burst centred on a chosen
   * cell, 8d6 fire, Dexterity save for half. Same area-damage shape as Burning
   * Hands (and it honours the Evoker's Sculpt Spells the same way — allies in
   * the blast are spared), just bigger and thrown across the board.
   */
  fireball: {
    id: 'fireball', name: 'Fireball', level: 3, castingTime: 'action',
    targeting: { kind: 'sphere5x5', range: 150 },
    concentration: false,
    icon: '💥',
    cast({ state, casterId, slotLevel, positions }) {
      const caster = state.combatants[casterId]!;
      const sculpt = caster.featureIds.includes('sculpt-spells');
      const dc = spellDc(state, casterId);
      const dice = `${8 + (slotLevel - 3)}d6`; // 8d6 at 3rd, +1d6 per higher slot
      const events: GameEvent[] = [];
      for (const pos of sphere5x5(positions[0]!)) {
        const tid = cellAt(state.grid, pos)?.occupantId;
        if (!tid) continue;
        const t = state.combatants[tid]!;
        // No line-of-sight filter inside the blast: a Fireball engulfs everything
        // in its radius, including creatures behind cover from the caster.
        if (!t.alive) continue;
        if (sculpt && t.team === caster.team) continue; // Sculpt Spells: allies unharmed
        const save = savingThrow(state, tid, 'dex', dc);
        events.push(save.event);
        const dmg = rollDice(state.rng, dice);
        state.rng = dmg.state;
        const amount = save.success ? Math.floor(dmg.total / 2) : dmg.total;
        if (amount > 0) events.push(...applyDamage(state, tid, casterId, amount, 'fire', dmg.rolls));
      }
      return events;
    },
  },

  /**
   * Mass Healing Word: the cleric's signature 3rd-level spell. A bonus-action
   * heal that touches several wounded allies at once (1d4 + spell mod each),
   * standing the downed among them back up through the shared healing rule.
   */
  'mass-healing-word': {
    id: 'mass-healing-word', name: 'Mass Healing Word', level: 3, castingTime: 'bonus',
    targeting: { kind: 'creature', range: 60, who: 'ally', count: 6 },
    concentration: false,
    icon: '💞',
    cast({ state, casterId, targetIds }) {
      const mod = spellMod(state, casterId);
      const events: GameEvent[] = [];
      for (const tid of new Set(targetIds)) {
        const heal = rollDice(state.rng, '1d4');
        state.rng = heal.state;
        events.push(...applyHealing(state, tid, casterId, heal.total + mod));
      }
      return events;
    },
  },

  /**
   * Shield: a reaction that adds +5 AC (and Magic Missile immunity) until the
   * caster's next turn. Never cast as a normal action — the engine autocasts it
   * for a defender that a hit would otherwise land on (see tryAutoShield); this
   * entry exists so the spell can be *known* and looked up.
   */
  shield: {
    id: 'shield', name: 'Shield', level: 1, castingTime: 'reaction',
    targeting: { kind: 'self' },
    concentration: false,
    icon: '🛡️',
    cast({ state, casterId }) {
      const c = state.combatants[casterId]!;
      if (!c.conditions.some((k) => k.id === 'shielded')) c.conditions.push({ id: 'shielded', sourceId: casterId });
      return [{ type: 'conditionApplied', combatantId: casterId, condition: 'shielded', sourceId: casterId }];
    },
  },

  /** Healing Word: a ranged, bonus-action single-target heal (2d4 + mod). */
  'healing-word': {
    id: 'healing-word', name: 'Healing Word', level: 1, castingTime: 'bonus',
    targeting: { kind: 'creature', range: 60, who: 'ally', count: 1 },
    concentration: false,
    icon: '🩹',
    cast({ state, casterId, slotLevel, targetIds }) {
      const mod = spellMod(state, casterId);
      const heal = rollDice(state.rng, `${1 + slotLevel}d4`); // 2d4 at 1st, +1d4 per higher slot
      state.rng = heal.state;
      return applyHealing(state, targetIds[0]!, casterId, heal.total + mod);
    },
  },

  /**
   * Suggestion: a Wisdom save or the target ambles out of the fight — the same
   * charmAway removal Animal Friendship uses, scoped to humanoids instead of
   * beasts. A hard single-target answer to one dangerous enemy.
   */
  suggestion: {
    id: 'suggestion', name: 'Suggestion', level: 2, castingTime: 'action',
    targeting: { kind: 'creature', range: 30, who: 'enemy', count: 1, creatureType: 'humanoid' },
    concentration: false,
    icon: '💭',
    cast({ state, casterId, targetIds }) {
      const targetId = targetIds[0]!;
      const save = savingThrow(state, targetId, 'wis', spellDc(state, casterId));
      const events: GameEvent[] = [save.event];
      if (!save.success) events.push(...charmAway(state, targetId));
      return events;
    },
  },

  /**
   * Command: one enemy grovels. On a failed Wisdom save it drops prone and
   * loses its next turn (the `commanded` condition, cleared at that turn's end).
   */
  command: {
    id: 'command', name: 'Command', level: 1, castingTime: 'action',
    targeting: { kind: 'creature', range: 60, who: 'enemy', count: 1, creatureType: 'humanoid' },
    concentration: false,
    icon: '❗',
    cast({ state, casterId, targetIds }) {
      const targetId = targetIds[0]!;
      const save = savingThrow(state, targetId, 'wis', spellDc(state, casterId));
      const events: GameEvent[] = [save.event];
      if (!save.success && !state.combatants[targetId]!.conditions.some((c) => c.id === 'commanded')) {
        state.combatants[targetId]!.conditions.push({ id: 'commanded', sourceId: casterId });
        events.push({ type: 'conditionApplied', combatantId: targetId, condition: 'commanded', sourceId: casterId });
      }
      return events;
    },
  },

  /**
   * Web: a 5x5 patch of sticky strands. Enemies caught (Dex save) are
   * restrained — no movement, disadvantage to attack, easy to hit — and get a
   * fresh Dex save at the end of each of their turns (repeatSave). Concentration
   * holds the web; dropping it frees everyone still stuck.
   */
  web: {
    id: 'web', name: 'Web', level: 2, castingTime: 'action',
    targeting: { kind: 'sphere5x5', range: 60 },
    concentration: true,
    icon: '🕸️',
    cast({ state, casterId, positions }) {
      const caster = state.combatants[casterId]!;
      const dc = spellDc(state, casterId);
      const events: GameEvent[] = [];
      const caught: Id[] = [];
      for (const pos of sphere5x5(positions[0]!)) {
        const tid = cellAt(state.grid, pos)?.occupantId;
        if (!tid) continue;
        const t = state.combatants[tid]!;
        if (!t.alive || t.team === caster.team || t.conditions.some((c) => c.id === 'restrained')) continue;
        const save = savingThrow(state, tid, 'dex', dc);
        events.push(save.event);
        if (!save.success) {
          t.conditions.push({ id: 'restrained', sourceId: casterId, concentration: true, repeatSave: { ability: 'dex', dc } });
          events.push({ type: 'conditionApplied', combatantId: tid, condition: 'restrained', sourceId: casterId });
          caught.push(tid);
        }
      }
      if (caught.length > 0) caster.concentratingOn = { spellId: 'web', targetIds: caught };
      return events;
    },
  },

  /**
   * Spiritual Weapon: a floating force blade. Casting it (a bonus action, a
   * 2nd-level slot) summons the weapon and makes its first attack; while it
   * lasts, the caster re-attacks each turn as a free bonus action (offered at
   * slotLevel 0, no slot). Anchored to the caster — it strikes an adjacent
   * enemy rather than roaming the board.
   */
  'spiritual-weapon': {
    id: 'spiritual-weapon', name: 'Spiritual Weapon', level: 2, castingTime: 'bonus',
    targeting: { kind: 'creature', range: 5, who: 'enemy', count: 1 },
    concentration: false,
    icon: '🌟',
    cast({ state, casterId, slotLevel, targetIds }) {
      const caster = state.combatants[casterId]!;
      const events: GameEvent[] = [];
      if (slotLevel >= 2) caster.spiritualWeapon = { expiresAtRound: state.round + 10 };
      const targetId = targetIds[0]!;
      const atk = spellAttack(state, casterId, targetId, { melee: true });
      events.push(atk.event);
      if (atk.hit) {
        const dmg = rollDice(state.rng, '1d8', atk.crit);
        state.rng = dmg.state;
        events.push(...applyDamage(state, targetId, casterId, dmg.total + spellMod(state, casterId), 'force', dmg.rolls));
      }
      return events;
    },
  },

  /**
   * Spiritual Guardians: a radiant aura around the caster. Any enemy that starts
   * its turn within 15 ft takes 3d8 radiant (Wisdom save halves) — resolved in
   * startTurn. Held by concentration; dropping it dispels the aura.
   */
  'spiritual-guardians': {
    id: 'spiritual-guardians', name: 'Spiritual Guardians', level: 3, castingTime: 'action',
    targeting: { kind: 'self' },
    concentration: true,
    icon: '👼',
    cast({ state, casterId }) {
      const caster = state.combatants[casterId]!;
      caster.spiritualGuardians = { dc: spellDc(state, casterId), mod: spellMod(state, casterId) };
      caster.concentratingOn = { spellId: 'spiritual-guardians', targetIds: [] };
      return []; // silent until an enemy starts its turn in the aura
    },
  },

  /**
   * Lightning Bolt: an 8d6 line to the board edge, Dexterity save for half. A
   * Fireball sibling in a line instead of a burst, and (like Fireball) it
   * strikes everything on the line, cover or no cover — Sculpt Spells spares
   * allies caught in it.
   */
  'lightning-bolt': {
    id: 'lightning-bolt', name: 'Lightning Bolt', level: 3, castingTime: 'action',
    targeting: { kind: 'line15' },
    concentration: false,
    icon: '⚡',
    cast({ state, casterId, slotLevel, positions }) {
      const caster = state.combatants[casterId]!;
      const sculpt = caster.featureIds.includes('sculpt-spells');
      const dir = directionFromDelta(caster.position, positions[0]!);
      const dc = spellDc(state, casterId);
      const dice = `${8 + (slotLevel - 3)}d6`;
      const events: GameEvent[] = [];
      for (const pos of line15(caster.position, dir)) {
        const tid = cellAt(state.grid, pos)?.occupantId;
        if (!tid) continue;
        const t = state.combatants[tid]!;
        if (!t.alive) continue;
        if (sculpt && t.team === caster.team) continue;
        const save = savingThrow(state, tid, 'dex', dc);
        events.push(save.event);
        const dmg = rollDice(state.rng, dice);
        state.rng = dmg.state;
        const amount = save.success ? Math.floor(dmg.total / 2) : dmg.total;
        if (amount > 0) events.push(...applyDamage(state, tid, casterId, amount, 'lightning', dmg.rolls));
      }
      return events;
    },
  },

  /**
   * Fear: a cone of dread. Enemies caught (Wisdom save) are frightened —
   * disadvantage on their attacks — with a repeat save each turn, held by
   * concentration.
   */
  fear: {
    id: 'fear', name: 'Fear', level: 3, castingTime: 'action',
    targeting: { kind: 'cone15' },
    concentration: true,
    icon: '😱',
    cast({ state, casterId, positions }) {
      const caster = state.combatants[casterId]!;
      const dir = directionFromDelta(caster.position, positions[0]!);
      const dc = spellDc(state, casterId);
      const events: GameEvent[] = [];
      const caught: Id[] = [];
      for (const pos of cone15(caster.position, dir)) {
        const tid = cellAt(state.grid, pos)?.occupantId;
        if (!tid) continue;
        const t = state.combatants[tid]!;
        if (!t.alive || t.team === caster.team || t.conditions.some((c) => c.id === 'frightened')) continue;
        const save = savingThrow(state, tid, 'wis', dc);
        events.push(save.event);
        if (!save.success) {
          t.conditions.push({ id: 'frightened', sourceId: casterId, concentration: true, repeatSave: { ability: 'wis', dc } });
          events.push({ type: 'conditionApplied', combatantId: tid, condition: 'frightened', sourceId: casterId });
          caught.push(tid);
        }
      }
      if (caught.length > 0) caster.concentratingOn = { spellId: 'fear', targetIds: caught };
      return events;
    },
  },

  /**
   * A dragonborn's breath weapon: a cone of elemental damage, Dexterity save
   * for half, a couple of times a fight. Damage only — no condition — so it's
   * the innate-spell path's second shape after Faerie Fire, and the AI values
   * it through simulated damage with no new weighting.
   *
   * Enemies only: a dragonborn aims its own breath, so no friendly fire to
   * confuse a player (or the AI) about where to stand.
   */
  'breath-weapon': {
    id: 'breath-weapon', name: 'Breath Weapon', level: 1, castingTime: 'action',
    targeting: { kind: 'cone15' },
    concentration: false,
    icon: '🐲',
    cast({ state, casterId, positions }) {
      const caster = state.combatants[casterId]!;
      const dir = directionFromDelta(caster.position, positions[0]!);
      const events: GameEvent[] = [];
      const dc = spellDc(state, casterId);
      for (const pos of cone15(caster.position, dir)) {
        const tid = cellAt(state.grid, pos)?.occupantId;
        if (!tid) continue;
        const t = state.combatants[tid]!;
        if (!t.alive || t.team === caster.team) continue;
        if (!hasLineOfSight(state.grid, caster.position, pos)) continue;
        const save = savingThrow(state, tid, 'dex', dc);
        events.push(save.event);
        const dmg = rollDice(state.rng, '2d6');
        state.rng = dmg.state;
        const amount = save.success ? Math.floor(dmg.total / 2) : dmg.total;
        if (amount > 0) events.push(...applyDamage(state, tid, casterId, amount, 'fire', dmg.rolls));
      }
      return events;
    },
  },
  'guiding-bolt': {
    id: 'guiding-bolt', name: 'Guiding Bolt', level: 1, castingTime: 'action',
    targeting: { kind: 'creature', range: 120, who: 'enemy', count: 1 },
    concentration: false,
    icon: '🌟',
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
    targeting: { kind: 'cube15' }, // a 3x3 square placed adjacent to the caster
    concentration: false,
    icon: '💥',
    cast({ state, casterId, slotLevel, positions }) {
      const caster = state.combatants[casterId]!;
      const sculpt = caster.featureIds.includes('sculpt-spells');
      const dir = directionFromDelta(caster.position, positions[0]!);
      const dc = spellDc(state, casterId);
      const events: GameEvent[] = [];
      for (const pos of cube15(caster.position, dir)) {
        const tid = cellAt(state.grid, pos)?.occupantId;
        if (!tid) continue;
        const t = state.combatants[tid]!;
        if (!t.alive || t.id === casterId) continue;
        if (sculpt && t.team === caster.team) continue;
        const save = savingThrow(state, t.id, 'con', dc);
        events.push(save.event);
        const dmg = rollDice(state.rng, `${1 + slotLevel}d8`); // 2d8 at slot 1
        state.rng = dmg.state;
        const amount = save.success ? Math.floor(dmg.total / 2) : dmg.total;
        if (amount > 0) events.push(...applyDamage(state, t.id, casterId, amount, 'thunder', dmg.rolls));
        if (!save.success && t.alive) {
          const push = {
            x: Math.sign(t.position.x - caster.position.x),
            y: Math.sign(t.position.y - caster.position.y),
          };
          events.push(...pushCreature(state, t.id, push, 2));
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
    icon: '☄️',
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
    icon: '👣',
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

  /**
   * A gnome's Minor Illusion, turned into a battlefield tool: drop a shimmering
   * false wall on an empty cell within range. It blocks line of sight like a
   * real wall (hasLineOfSight), but nothing about movement changes — walking
   * through it is exactly how it gets revealed (popIllusion, wired into every
   * movement path). It also expires on its own after a few rounds, so a gnome
   * that never gets challenged on it doesn't get a wall forever.
   *
   * This is the one spell in the game that doesn't touch a combatant at all —
   * it only writes to a grid cell — so it earns nothing directly from the
   * evaluator's per-unit scoring. What it *does* get for free: every place
   * that already calls hasLineOfSight (the threat term, the "can I see an
   * enemy" gradient, canHide) will treat the screen as real, so blocking an
   * archer's shot or opening a Hide for an ally happens through existing
   * machinery, not a bespoke weight. Reuses `emptyCell` targeting (the same
   * shape as Misty Step) rather than inventing a new one.
   */
  'minor-illusion': {
    id: 'minor-illusion', name: 'Minor Illusion', level: 0, castingTime: 'action',
    targeting: { kind: 'emptyCell', range: 30 },
    concentration: false,
    icon: '🌫️',
    cast({ state, casterId, positions }) {
      const at = positions[0]!;
      cellAt(state.grid, at)!.illusion = { sourceId: casterId, expiresAtRound: state.round + 3 };
      return [{ type: 'illusionCast', position: at, sourceId: casterId }];
    },
  },

  'faerie-fire': {
    id: 'faerie-fire', name: 'Faerie Fire', level: 1, castingTime: 'action',
    targeting: { kind: 'sphere2x2', range: 60 },
    concentration: true,
    icon: '🧚',
    cast({ state, casterId, positions }) {
      const events: GameEvent[] = [];
      const dc = spellDc(state, casterId);
      const lit: Id[] = [];
      for (const pos of sphere2x2(positions[0]!)) {
        const tid = cellAt(state.grid, pos)?.occupantId;
        if (!tid) continue;
        const t = state.combatants[tid]!;
        // Foes only, and only those not already lit. A Dex save shrugs it off.
        if (!t.alive || t.team === state.combatants[casterId]!.team) continue;
        if (t.conditions.some((c) => c.id === 'outlined')) continue;
        const save = savingThrow(state, tid, 'dex', dc);
        events.push(save.event);
        if (save.success) continue;
        // Outlined: attacks against it have advantage until the light fades, and
        // it can't melt back into hiding. Reveal it now if it already had.
        t.conditions = t.conditions.filter((c) => c.id !== 'hidden');
        t.conditions.push({ id: 'outlined', sourceId: casterId, concentration: true });
        events.push({ type: 'conditionApplied', combatantId: tid, condition: 'outlined', sourceId: casterId });
        lit.push(tid);
      }
      // Concentration holds the light on everyone it caught.
      if (lit.length > 0) state.combatants[casterId]!.concentratingOn = { spellId: 'faerie-fire', targetIds: lit };
      return events;
    },
  },

  /**
   * Animal Friendship — a hard counter, not a damage spell. Beast-only
   * (`creatureType`), touch range like the real spell (RAW: Range Touch), a
   * failed Wisdom save charms the beast off the board entirely (`charmAway`,
   * not `kill` — it wanders off, it isn't dead). No concentration: RAW this
   * lasts 24 hours, and once a beast is out of the fight there's nothing left
   * to sustain.
   *
   * Only the Wolf Pack, Spider Nest and Brown Bear encounters ever have a legal
   * target — `creatureType` filters it out of `validTarget`, so `legalActions`
   * generates no entry at all, and the tray simply won't show it against
   * goblins or skeletons (the same way Cure Wounds vanishes from the tray at
   * full HP with no one to heal). That's intentional — it rewards knowing the
   * bestiary, like a real prepared spell, not a blanket debuff with a beast
   * label stapled on.
   */
  'animal-friendship': {
    id: 'animal-friendship', name: 'Animal Friendship', level: 1, castingTime: 'action',
    targeting: { kind: 'creature', range: 0, who: 'enemy', count: 1, creatureType: 'beast' },
    concentration: false,
    icon: '🐾',
    cast({ state, casterId, targetIds }) {
      const targetId = targetIds[0]!;
      const dc = spellDc(state, casterId);
      const save = savingThrow(state, targetId, 'wis', dc);
      const events: GameEvent[] = [save.event];
      if (!save.success) events.push(...charmAway(state, targetId));
      return events;
    },
  },

  'hold-person': {
    id: 'hold-person', name: 'Hold Person', level: 2, castingTime: 'action',
    targeting: { kind: 'creature', range: 60, who: 'enemy', count: 1 },
    concentration: true,
    icon: '⛓️',
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
    icon: '💗',
    cast({ state, casterId, slotLevel, targetIds }) {
      const amount = 5 * (slotLevel - 1); // +5 at slot 2, +10 at slot 3...
      const events: GameEvent[] = [];
      for (const tid of new Set(targetIds)) {
        const t = state.combatants[tid]!;
        t.maxHp += amount;
        // Through the rule, so Aid stands a downed ally up like any other
        // healing — which is what raising their hit points means.
        events.push(...applyHealing(state, tid, casterId, amount));
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
  if (targetId !== casterId && isHidden(t)) return false;
  if (spell.targeting.kind === 'weaponAttack') {
    // The weapon decides: reach, range, line of sight, the lot.
    const weaponId = caster.equipped.mainHand;
    return !!weaponId && canAttackWith(state, caster, weaponId, targetId);
  }
  if (spell.targeting.kind !== 'creature') return false;
  const { range, who, creatureType } = spell.targeting;
  if (who === 'enemy' && t.team === caster.team) return false;
  // A downed creature can't be attacked — but healing it is the whole point.
  if (who === 'enemy' && isDown(t)) return false;
  if (who === 'ally' && t.team !== caster.team) return false;
  if (creatureType && t.creatureType !== creatureType) return false;
  if (range === 0) {
    return targetId === casterId || adjacent(caster.position, t.position);
  }
  return (
    distanceFeet(caster.position, t.position) <= range &&
    hasLineOfSight(state.grid, caster.position, t.position)
  );
}
