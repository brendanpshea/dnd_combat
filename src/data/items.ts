/**
 * Consumable magic items. Like spells/features, `apply` is a small hook over
 * engine helpers. `cost`/`rarity` exist now so stores and treasure drops are
 * a data concern later.
 */
import type { GameState, Id } from '../engine/types.js';
import { abilityMod, proficiencyBonus } from '../engine/types.js';
import { rollDice, rollD20, resolveRollMode } from '../engine/dice.js';
import { applyDamage, collectAttackSources } from '../engine/rules/attack.js';
import { applyLucky } from '../engine/rules/luck.js';
import { applyHealing } from '../engine/rules/heal.js';
import { SPELLS } from './spells.js';
import { acOf, Rarity } from './armor.js';
import type { GameEvent } from '../engine/events.js';

export interface UseContext {
  state: GameState;
  userId: Id;
  targetIds: Id[];
  positions: Array<{ x: number; y: number }>;
}

export interface ConsumableData {
  id: Id;
  name: string;
  useTime: 'action' | 'bonus';
  /**
   * self: no target. ally: adjacent ally or self (action to administer to
   * another). thrown: enemy within range (attack roll). spell: delegates
   * targeting/resolution to SPELLS[spellId] at its base level.
   */
  targeting:
    | { kind: 'self' }
    | { kind: 'ally' }
    | { kind: 'thrown'; range: { normal: number; long: number } }
    | { kind: 'spell'; spellId: Id };
  cost: number; // gp
  rarity: Rarity;
  apply(ctx: UseContext): GameEvent[];
}

function healPotion(dice: string) {
  return ({ state, userId, targetIds }: UseContext): GameEvent[] => {
    const targetId = targetIds[0] ?? userId;
    const roll = rollDice(state.rng, dice);
    state.rng = roll.state;
    // Through the rule: a potion poured into a downed ally wakes them, exactly
    // as Cure Wounds does. Healing that only sometimes revives is a bug.
    return applyHealing(state, targetId, userId, roll.total);
  };
}

export const ITEMS: Record<Id, ConsumableData> = {
  'potion-healing': {
    id: 'potion-healing', name: 'Potion of Healing', useTime: 'bonus',
    targeting: { kind: 'ally' }, cost: 50, rarity: 'common',
    apply: healPotion('2d4+2'),
  },
  'potion-greater-healing': {
    id: 'potion-greater-healing', name: 'Potion of Greater Healing', useTime: 'bonus',
    targeting: { kind: 'ally' }, cost: 150, rarity: 'uncommon',
    apply: healPotion('4d4+4'),
  },
  'alchemists-fire': {
    id: 'alchemists-fire', name: "Alchemist's Fire", useTime: 'action',
    targeting: { kind: 'thrown', range: { normal: 20, long: 60 } }, cost: 50, rarity: 'common',
    apply({ state, userId, targetIds }) {
      const targetId = targetIds[0]!;
      const user = state.combatants[userId]!;
      const target = state.combatants[targetId]!;
      // Improvised thrown attack: Dex-based, proficient.
      const fake = { melee: false, range: { normal: 20, long: 60 }, properties: [] };
      const { adv, dis } = collectAttackSources(state, user, target, fake as never, false);
      const mode = resolveRollMode(adv, dis);
      const d20 = applyLucky(state, userId, rollD20(state.rng, mode), mode);
      state.rng = d20.state;
      const total = d20.natural + abilityMod(user.abilities.dex) + proficiencyBonus(user.level);
      const ac = acOf(target);
      const hit = d20.natural !== 1 && (d20.natural === 20 || total >= ac);
      const events: GameEvent[] = [{
        type: 'attackRolled', attackerId: userId, targetId, weaponId: 'alchemists-fire',
        natural: d20.natural, total, targetAc: ac, mode, advSources: adv, disSources: dis,
        hit, crit: false, opportunity: false,
      }];
      if (hit) {
        const dmg = rollDice(state.rng, '1d4');
        state.rng = dmg.state;
        events.push(...applyDamage(state, targetId, userId, dmg.total, 'fire', dmg.rolls));
      }
      return events;
    },
  },
  'scroll-magic-missile': {
    id: 'scroll-magic-missile', name: 'Scroll of Magic Missile', useTime: 'action',
    targeting: { kind: 'spell', spellId: 'magic-missile' }, cost: 60, rarity: 'common',
    apply: scrollApply('magic-missile'),
  },
};

/** A scroll casts the spell at its base level, no slot required. */
function scrollApply(spellId: Id) {
  return ({ state, userId, targetIds, positions }: UseContext): GameEvent[] => {
    const spell = SPELLS[spellId]!;
    return spell.cast({
      state, casterId: userId, slotLevel: Math.max(1, spell.level),
      targetIds, positions,
    });
  };
}

