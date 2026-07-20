/**
 * Consumable magic items. Like spells/features, `apply` is a small hook over
 * engine helpers. `cost`/`rarity` exist now so stores and treasure drops are
 * a data concern later.
 */
import type { GameState, Id, DamageType } from '../engine/types.js';
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
  'scroll-burning-hands': {
    id: 'scroll-burning-hands', name: 'Scroll of Burning Hands', useTime: 'action',
    targeting: { kind: 'spell', spellId: 'burning-hands' }, cost: 50, rarity: 'common',
    apply: scrollApply('burning-hands'),
  },
  'scroll-command': {
    id: 'scroll-command', name: 'Scroll of Command', useTime: 'action',
    targeting: { kind: 'spell', spellId: 'command' }, cost: 40, rarity: 'common',
    apply: scrollApply('command'),
  },
  'scroll-guiding-bolt': {
    id: 'scroll-guiding-bolt', name: 'Scroll of Guiding Bolt', useTime: 'action',
    targeting: { kind: 'spell', spellId: 'guiding-bolt' }, cost: 50, rarity: 'common',
    apply: scrollApply('guiding-bolt'),
  },
  'scroll-web': {
    id: 'scroll-web', name: 'Scroll of Web', useTime: 'action',
    targeting: { kind: 'spell', spellId: 'web' }, cost: 120, rarity: 'uncommon',
    apply: scrollApply('web'),
  },
  // Ray of Sickness isn't on any class's default table — a wizard has to find
  // this scroll and copy it in (campaign.ts's learnSpellFromScroll) before it
  // can be prepared. The scroll itself still casts the spell once, like any
  // other, whether or not it's ever copied.
  'scroll-ray-of-sickness': {
    id: 'scroll-ray-of-sickness', name: 'Scroll of Ray of Sickness', useTime: 'action',
    targeting: { kind: 'spell', spellId: 'ray-of-sickness' }, cost: 60, rarity: 'uncommon',
    apply: scrollApply('ray-of-sickness'),
  },
  'scroll-scorching-ray': {
    id: 'scroll-scorching-ray', name: 'Scroll of Scorching Ray', useTime: 'action',
    targeting: { kind: 'spell', spellId: 'scorching-ray' }, cost: 120, rarity: 'uncommon',
    apply: scrollApply('scorching-ray'),
  },
  'scroll-hold-person': {
    id: 'scroll-hold-person', name: 'Scroll of Hold Person', useTime: 'action',
    targeting: { kind: 'spell', spellId: 'hold-person' }, cost: 120, rarity: 'uncommon',
    apply: scrollApply('hold-person'),
  },
  'scroll-fireball': {
    id: 'scroll-fireball', name: 'Scroll of Fireball', useTime: 'action',
    targeting: { kind: 'spell', spellId: 'fireball' }, cost: 250, rarity: 'rare',
    apply: scrollApply('fireball'),
  },
  'scroll-lightning-bolt': {
    id: 'scroll-lightning-bolt', name: 'Scroll of Lightning Bolt', useTime: 'action',
    targeting: { kind: 'spell', spellId: 'lightning-bolt' }, cost: 250, rarity: 'rare',
    apply: scrollApply('lightning-bolt'),
  },
  'scroll-color-spray': {
    id: 'scroll-color-spray', name: 'Scroll of Color Spray', useTime: 'action',
    targeting: { kind: 'spell', spellId: 'color-spray' }, cost: 50, rarity: 'common',
    apply: scrollApply('color-spray'),
  },
  'scroll-bane': {
    id: 'scroll-bane', name: 'Scroll of Bane', useTime: 'action',
    targeting: { kind: 'spell', spellId: 'bane' }, cost: 50, rarity: 'common',
    apply: scrollApply('bane'),
  },
  'scroll-shield-of-faith': {
    id: 'scroll-shield-of-faith', name: 'Scroll of Shield of Faith', useTime: 'action',
    targeting: { kind: 'spell', spellId: 'shield-of-faith' }, cost: 50, rarity: 'common',
    apply: scrollApply('shield-of-faith'),
  },
  'scroll-blindness': {
    id: 'scroll-blindness', name: 'Scroll of Blindness', useTime: 'action',
    targeting: { kind: 'spell', spellId: 'blindness' }, cost: 120, rarity: 'uncommon',
    apply: scrollApply('blindness'),
  },
  'scroll-invisibility': {
    id: 'scroll-invisibility', name: 'Scroll of Invisibility', useTime: 'action',
    targeting: { kind: 'spell', spellId: 'invisibility' }, cost: 120, rarity: 'uncommon',
    apply: scrollApply('invisibility'),
  },
  'scroll-dispel-magic': {
    id: 'scroll-dispel-magic', name: 'Scroll of Dispel Magic', useTime: 'action',
    targeting: { kind: 'spell', spellId: 'dispel-magic' }, cost: 250, rarity: 'rare',
    apply: scrollApply('dispel-magic'),
  },
  'scroll-haste': {
    id: 'scroll-haste', name: 'Scroll of Haste', useTime: 'action',
    targeting: { kind: 'spell', spellId: 'haste' }, cost: 250, rarity: 'rare',
    apply: scrollApply('haste'),
  },

  // --- resistance potions: grants resistance to a damage type for the rest
  // of the encounter (like Mage Armor, a persisted flag rather than a
  // duration-tracked condition — nothing rebuilds the combatant mid-fight) --
  'potion-fire-resistance': resistancePotion('potion-fire-resistance', 'Potion of Fire Resistance', 'fire'),
  'potion-poison-resistance': resistancePotion('potion-poison-resistance', 'Potion of Poison Resistance', 'poison'),
  'potion-cold-resistance': resistancePotion('potion-cold-resistance', 'Potion of Cold Resistance', 'cold'),
  'potion-acid-resistance': resistancePotion('potion-acid-resistance', 'Potion of Acid Resistance', 'acid'),

  // --- giant strength: sets Strength to the giant's, if higher. Combat-scoped
  // (ability scores aren't part of a saved character, so nothing to revert) --
  'potion-giant-strength-hill': {
    id: 'potion-giant-strength-hill', name: 'Potion of Hill Giant Strength', useTime: 'bonus',
    targeting: { kind: 'ally' }, cost: 150, rarity: 'uncommon',
    apply: giantStrengthPotion(21),
  },
  'potion-giant-strength-frost': {
    id: 'potion-giant-strength-frost', name: 'Potion of Frost Giant Strength', useTime: 'bonus',
    targeting: { kind: 'ally' }, cost: 400, rarity: 'rare',
    apply: giantStrengthPotion(23),
  },
};

function resistancePotion(id: Id, name: string, damageType: DamageType): ConsumableData {
  return {
    id, name, useTime: 'bonus',
    targeting: { kind: 'ally' }, cost: 150, rarity: 'uncommon',
    apply({ state, targetIds, userId }) {
      const target = state.combatants[targetIds[0] ?? userId]!;
      if (!target.resistances.includes(damageType)) target.resistances.push(damageType);
      return [];
    },
  };
}

function giantStrengthPotion(strength: number) {
  return ({ state, targetIds, userId }: UseContext): GameEvent[] => {
    const target = state.combatants[targetIds[0] ?? userId]!;
    target.abilities.str = Math.max(target.abilities.str, strength);
    return [];
  };
}

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

