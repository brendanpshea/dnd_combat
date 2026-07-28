/**
 * Consumable magic items. Like spells/features, `apply` is a small hook over
 * engine helpers. `cost`/`rarity` exist now so stores and treasure drops are
 * a data concern later.
 */
import type { GameState, Id, DamageType } from '../engine/types.js';
import { wardedAgainstMagicalBinding } from '../engine/types.js';
import { abilityMod, proficiencyBonus } from '../engine/types.js';
import { rollDice, rollD20, resolveRollMode } from '../engine/dice.js';
import { applyDamage, collectAttackSources } from '../engine/rules/attack.js';
import { applyLucky } from '../engine/rules/luck.js';
import { applyHealing } from '../engine/rules/heal.js';
import { savingThrow } from '../engine/rules/saves.js';
import { pushCreature } from '../engine/rules/movement.js';
import { summonCombatant } from '../engine/rules/summon.js';
import { distanceFeet } from '../engine/grid.js';
import { SPELLS } from './spells.js';
import { acOf, Rarity } from './armor.js';
import { CLASSES, classScrollPool } from './classes.js';
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
  /**
   * A wand or staff rather than a consumable: using it spends a charge instead
   * of the item, and the charges come back on a long rest.
   *
   * The SRD says "regains 1d6 + 1 expended charges daily at dawn", with a 1-in-
   * 20 chance of crumbling to ash on the last charge. Both are modelled as a
   * clean refill on a long rest, because the arena long-rests between every
   * wave: a partial recharge would make a wand's usefulness depend on how many
   * waves ago you last fired it, which is bookkeeping rather than a decision,
   * and destroying the player's rare item on a 5% roll is a punishment for
   * using the thing they bought.
   */
  charges?: number;
  /**
   * When the charges come back. Defaults to every long rest.
   *
   * `{ days: N }` is a cooldown counted in days CLEARED (see arena/day.ts) —
   * what the conjurations use, because a straight nightly refill would put a
   * CR 5 elemental in every fight. `'never'` is once per run.
   * The SRD's clocks for those are days — a Marble Elephant is once per seven,
   * a brazier once per dawn — and the arena long-rests between every wave, so
   * "once per rest" would have meant a CR 5 ally in every single fight. That is
   * not a translation of the SRD's intent, it is the opposite of it.
   *
   * The measurement is what settled it. Party win rate at level 5, N=100, with
   * one conjuration item added and nothing else changed:
   *
   *   bare 60%   Golden Lion 62%   Bronze Griffon 67%
   *              Marble Elephant 72%   Fire Elemental 80%
   *
   * A clean ladder by challenge rating, and +20 points for the elemental — the
   * largest single item effect in the game by a wide margin. Once a run, that
   * is a card you hold for the wave that needs it. Once a wave, it is the game.
   */
  refills?: 'rest' | 'never' | { days: number };
  /**
   * Who may use it. Wands that the SRD requires a spellcaster to attune to are
   * gated here; the ones that need no attunement at all (Wand of Magic
   * Missiles) are left open, which is what makes them worth a fighter's slot.
   */
  requires?: 'spellcaster';
  /**
   * The monster this item conjures, declared rather than only performed.
   *
   * `apply` does the summoning; this field exists so a *policy* can see what
   * the item is worth without knowing the item. Greedy's item scoring treats
   * every self-targeting item as a healing potion, so the Staff of the Python
   * scored zero and was never used in twelve measured fights — invisible to
   * exactly the policy every measurement in this repo runs on.
   */
  summons?: Id;
  apply(ctx: UseContext): GameEvent[];
}

/** A wand/staff rather than a one-shot: spends charges, is never consumed. */
export function isCharged(item: ConsumableData): boolean {
  return item.charges !== undefined;
}

/**
 * Charges left in a carried wand.
 *
 * Falls back to FULL when the pool is missing, which matters more than it
 * looks: `itemUses` is built by `buildCharacter` from the inventory it is
 * handed, so a wand pushed onto a combatant's inventory *after* it was built
 * has no pool — and the strict reading made that wand permanently unusable
 * with nothing to say why. The campaign never hits it (a fight rebuilds
 * everyone from the roster), which is exactly what makes it the kind of bug
 * that survives: it only bites hand-built combatants, which is to say tests and
 * measurement scripts. It cost me a measurement that read +0.0% for four items
 * before I noticed they had never been used at all.
 */
export function chargesLeft(c: { itemUses?: Record<Id, { current: number; max: number }> }, item: ConsumableData): number {
  return c.itemUses?.[item.id]?.current ?? item.charges ?? 0;
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
    // Bonus action, because the spell is: a scroll casts what is written on it
    // and takes as long as casting it takes. Hand-written as an action, which
    // quietly made the scroll worse than the spell; found when generation gave
    // every other scroll the rule and this one disagreed.
    id: 'scroll-shield-of-faith', name: 'Scroll of Shield of Faith', useTime: 'bonus',
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
  // --- wands ----------------------------------------------------------------
  //
  // A wand is a scroll you get to keep. The difference matters more than it
  // sounds: a scroll is a decision made once, at the moment you spend it, and
  // a wand is a decision made every turn of every fight until it runs dry.
  //
  // Charges refill on a long rest, and the arena rests between every wave, so a
  // wand is a per-wave resource. That is the intended shape — it gives a caster
  // something to spend when the slots are gone, and gives the classes with no
  // slots at all something to cast.
  'wand-magic-missiles': {
    id: 'wand-magic-missiles', name: 'Wand of Magic Missiles', useTime: 'action',
    targeting: { kind: 'spell', spellId: 'magic-missile' },
    cost: 700, rarity: 'uncommon', charges: 7,
    // No attunement in the SRD, and so no `requires` here — this is the one
    // wand a fighter can carry, and the only levelled spell most martials will
    // ever cast. Worth its slot for that alone.
    apply: scrollApply('magic-missile'),
  },
  'wand-web': {
    id: 'wand-web', name: 'Wand of Web', useTime: 'action',
    targeting: { kind: 'spell', spellId: 'web' },
    cost: 800, rarity: 'uncommon', charges: 7, requires: 'spellcaster',
    apply: scrollApply('web'),
  },
  'wand-fireballs': {
    id: 'wand-fireballs', name: 'Wand of Fireballs', useTime: 'action',
    targeting: { kind: 'spell', spellId: 'fireball' },
    cost: 1600, rarity: 'rare', charges: 7, requires: 'spellcaster',
    apply: scrollApply('fireball'),
  },
  'wand-lightning-bolts': {
    id: 'wand-lightning-bolts', name: 'Wand of Lightning Bolts', useTime: 'action',
    targeting: { kind: 'spell', spellId: 'lightning-bolt' },
    cost: 1600, rarity: 'rare', charges: 7, requires: 'spellcaster',
    apply: scrollApply('lightning-bolt'),
  },

  'ring-of-the-ram': {
    id: 'ring-of-the-ram', name: 'Ring of the Ram', useTime: 'action',
    targeting: { kind: 'thrown', range: { normal: 60, long: 60 } },
    cost: 1300, rarity: 'rare', charges: 3,
    /**
     * A spectral ram's head: 2d10 force at 60 feet, and the target is shoved
     * five feet back.
     *
     * This is the item that most changes what a turn can be, because the game
     * has almost no way to move an enemy. Thunderwave and Command are the whole
     * list, which is why the Into the Fire bounty measured one claim in
     * twenty-three wins: enemies path around hazards, so something has to push
     * them in. Now something can.
     *
     * Attacks at a flat +7 per the SRD, not off the user's stats — the ring
     * does the aiming, which is what makes it worth a slot for a character with
     * a poor attack bonus.
     *
     * Modelled at one charge per use rather than the SRD's "spend 1 to 3 for
     * 2d10 and 5 feet each": three charges is already a small budget, and a
     * variable spend on an item this simple is a slider rather than a decision.
     */
    apply({ state, userId, targetIds }) {
      const targetId = targetIds[0]!;
      const user = state.combatants[userId]!;
      const target = state.combatants[targetId]!;
      const d20 = applyLucky(state, userId, rollD20(state.rng, 'flat'), 'flat');
      state.rng = d20.state;
      const total = d20.natural + 7;
      const ac = acOf(target);
      const hit = d20.natural !== 1 && (d20.natural === 20 || total >= ac);
      const events: GameEvent[] = [{
        type: 'attackRolled', attackerId: userId, targetId, weaponId: 'ring-of-the-ram',
        natural: d20.natural, total, targetAc: ac, mode: 'flat', advSources: [], disSources: [],
        hit, crit: false, opportunity: false,
      }];
      if (!hit) return events;
      const dmg = rollDice(state.rng, d20.natural === 20 ? '4d10' : '2d10');
      state.rng = dmg.state;
      events.push(...applyDamage(state, targetId, userId, dmg.total, 'force', dmg.rolls,
        { tags: ['Ring of the Ram'], magical: true }));
      // Shoved directly away from the ring's bearer. A creature already dead or
      // pinned against a wall simply doesn't move; pushCreature handles both,
      // and burns it if the square it lands in is on fire.
      if (state.combatants[targetId]?.alive) {
        const dx = Math.sign(target.position.x - user.position.x);
        const dy = Math.sign(target.position.y - user.position.y);
        if (dx !== 0 || dy !== 0) events.push(...pushCreature(state, targetId, { x: dx, y: dy }, 1));
      }
      return events;
    },
  },
  'wand-paralysis': {
    id: 'wand-paralysis', name: 'Wand of Paralysis', useTime: 'action',
    targeting: { kind: 'thrown', range: { normal: 60, long: 60 } },
    cost: 1700, rarity: 'rare', charges: 7, requires: 'spellcaster',
    apply({ state, userId, targetIds }) {
      const targetId = targetIds[0]!;
      const save = savingThrow(state, targetId, 'con', 15, { magical: true });
      const events: GameEvent[] = [save.event];
      const t = state.combatants[targetId]!;
      // Free Action is the counter, exactly as it is for Hold Person: this is
      // magic causing the Paralyzed condition, which is what the ring refuses.
      if (!save.success && !wardedAgainstMagicalBinding(t, 'paralyzed')) {
        t.conditions.push({ id: 'paralyzed', sourceId: userId, repeatSave: { ability: 'con', dc: 15 } });
        events.push({ type: 'conditionApplied', combatantId: targetId, condition: 'paralyzed', sourceId: userId });
      }
      return events;
    },
  },
  'staff-healing': {
    id: 'staff-healing', name: 'Staff of Healing', useTime: 'action',
    targeting: { kind: 'ally' },
    cost: 1500, rarity: 'rare', charges: 10, requires: 'spellcaster',
    // Cure Wounds at will, near enough — ten charges is more than a fight, so
    // this is the item that lets a cleric spend its slots on something other
    // than topping people up. That is the point of it: it does not add healing
    // so much as free the slots that were doing the healing.
    apply: scrollApply('cure-wounds'),
  },

  'staff-python': {
    id: 'staff-python', name: 'Staff of the Python', useTime: 'action',
    targeting: { kind: 'self' },
    cost: 900, rarity: 'uncommon', charges: 1, summons: 'giant-constrictor-snake',
    /**
     * Throw the staff down and it becomes a Giant Constrictor Snake, which
     * fights beside you and takes its turn immediately after yours.
     *
     * This is the first item in the game that puts a real creature on the
     * board — not a Spiritual Weapon's floating marker but a combatant with a
     * stat block, an initiative slot and hit points to lose. See engine/rules/
     * summon.ts for the three things that keep that from breaking the fight.
     *
     * One charge, refilled on a long rest, which is the SRD's "can't use the
     * property again for 1 hour" read through this game's clock: one snake per
     * wave. The SRD's dismiss-and-recall is left out — recalling a hurt snake
     * to heal it is a bookkeeping loop, not a decision.
     */
    apply({ state, userId }) {
      const user = state.combatants[userId]!;
      return summonCombatant(state, {
        monsterId: 'giant-constrictor-snake',
        summonerId: userId,
        near: user.position,
        idHint: 'python',
      });
    },
  },

  'wand-fear': {
    id: 'wand-fear', name: 'Wand of Fear', useTime: 'action',
    targeting: { kind: 'self' },
    cost: 1400, rarity: 'rare', charges: 7,
    // A 60-foot rout, DC 15. No attunement requirement in the SRD, so no
    // `requires` — a fighter can carry this one, like the Wand of Magic
    // Missiles, and it is the only crowd control most martials will ever hold.
    apply({ state, userId }) {
      const user = state.combatants[userId]!;
      const events: GameEvent[] = [];
      for (const t of Object.values(state.combatants)) {
        if (!t.alive || t.team === user.team) continue;
        if (distanceFeet(user.position, t.position) > 60) continue;
        if (t.conditions.some((k) => k.id === 'fleeing')) continue;
        const save = savingThrow(state, t.id, 'wis', 15, { magical: true });
        events.push(save.event);
        if (save.success) continue;
        t.conditions.push({ id: 'fleeing', sourceId: userId, repeatSave: { ability: 'wis', dc: 15 } });
        events.push({ type: 'conditionApplied', combatantId: t.id, condition: 'fleeing', sourceId: userId });
      }
      return events;
    },
  },
  'wand-binding': {
    id: 'wand-binding', name: 'Wand of Binding', useTime: 'action',
    targeting: { kind: 'thrown', range: { normal: 60, long: 60 } },
    cost: 1700, rarity: 'rare', charges: 7,
    // DC 17 — the highest save in the game, and what makes this worth more than
    // a Wand of Web. Free Action is still the answer to it.
    apply({ state, userId, targetIds }) {
      const targetId = targetIds[0]!;
      const save = savingThrow(state, targetId, 'str', 17, { magical: true });
      const events: GameEvent[] = [save.event];
      const t = state.combatants[targetId]!;
      if (!save.success && !wardedAgainstMagicalBinding(t, 'restrained')) {
        t.conditions.push({ id: 'restrained', sourceId: userId, repeatSave: { ability: 'str', dc: 17 } });
        events.push({ type: 'conditionApplied', combatantId: targetId, condition: 'restrained', sourceId: userId });
      }
      return events;
    },
  },

  // --- conjurations ----------------------------------------------------------
  //
  // Everything here is the Staff of the Python's shape with a different stat
  // block, which is the point of having built `summonCombatant` as a general
  // thing: these five are data and an apply, and the engine did not move.
  //
  // ONE CHARGE EACH, refilled on a long rest. The SRD's real clocks are days —
  // a Marble Elephant is once per seven, a brazier once per dawn — and days do
  // not exist in this game. One per rest is the honest translation of "not
  // again today", and in the arena, which rests between waves, that is one
  // conjuration per fight: already the largest single thing an action can buy.
  'figurine-marble-elephant': {
    id: 'figurine-marble-elephant', name: 'Marble Elephant', useTime: 'action',
    targeting: { kind: 'self' },
    cost: 1400, rarity: 'rare', charges: 1, refills: { days: 3 }, summons: 'elephant',
    // The only one of the SRD's eight figurines this bestiary can field. The
    // rest want a griffon, a lion, a mastiff, an owl or a raven, and adding
    // those would enrol them in the arena roster as opposition as well —
    // a monster added here shows up in waves the same day.
    apply({ state, userId }) {
      const user = state.combatants[userId]!;
      return summonCombatant(state, {
        monsterId: 'elephant', summonerId: userId, near: user.position, idHint: 'figurine-marble-elephant',
      });
    },
  },
  'figurine-bronze-griffon': {
    id: 'figurine-bronze-griffon', name: 'Bronze Griffon', useTime: 'action',
    targeting: { kind: 'self' },
    cost: 1400, rarity: 'rare', charges: 1, refills: { days: 2 }, summons: 'griffon',
    // CR 2, two Rend attacks. The griffon already existed as opposition; this
    // is the same stat block pointed the other way, which is exactly what a
    // figurine is.
    apply({ state, userId }) {
      const user = state.combatants[userId]!;
      return summonCombatant(state, {
        monsterId: 'griffon', summonerId: userId, near: user.position, idHint: 'figurine-bronze-griffon',
      });
    },
  },
  'figurine-golden-lion': {
    id: 'figurine-golden-lion', name: 'Golden Lion', useTime: 'action',
    targeting: { kind: 'self' },
    cost: 1100, rarity: 'rare', charges: 1, refills: { days: 1 }, summons: 'lion',
    // CR 1, and cheap for it: 22 hit points does not last, but Pack Tactics
    // means it hands advantage to whoever is already in melee. The SRD makes
    // these in pairs; one is enough here, where a second body is worth more
    // than in a game with a party of six.
    apply({ state, userId }) {
      const user = state.combatants[userId]!;
      return summonCombatant(state, {
        monsterId: 'lion', summonerId: userId, near: user.position, idHint: 'figurine-golden-lion',
      });
    },
  },
  'brazier-fire-elemental': {
    id: 'brazier-fire-elemental', name: 'Brazier of Commanding Fire Elementals', useTime: 'action',
    targeting: { kind: 'self' },
    cost: 1800, rarity: 'rare', charges: 1, refills: { days: 4 }, summons: 'fire-elemental',
    // The four elemental items are all CR 5 and all Rare, which is the SRD's
    // own pricing and a great deal of ally for one action. The level gate on
    // rare items is what keeps that honest.
    apply({ state, userId }) {
      const user = state.combatants[userId]!;
      return summonCombatant(state, {
        monsterId: 'fire-elemental', summonerId: userId, near: user.position, idHint: 'brazier-fire-elemental',
      });
    },
  },
  'bowl-water-elemental': {
    id: 'bowl-water-elemental', name: 'Bowl of Commanding Water Elementals', useTime: 'action',
    targeting: { kind: 'self' },
    cost: 1800, rarity: 'rare', charges: 1, refills: { days: 4 }, summons: 'water-elemental',
    apply({ state, userId }) {
      const user = state.combatants[userId]!;
      return summonCombatant(state, {
        monsterId: 'water-elemental', summonerId: userId, near: user.position, idHint: 'bowl-water-elemental',
      });
    },
  },
  'censer-air-elemental': {
    id: 'censer-air-elemental', name: 'Censer of Controlling Air Elementals', useTime: 'action',
    targeting: { kind: 'self' },
    cost: 1800, rarity: 'rare', charges: 1, refills: { days: 4 }, summons: 'air-elemental',
    apply({ state, userId }) {
      const user = state.combatants[userId]!;
      return summonCombatant(state, {
        monsterId: 'air-elemental', summonerId: userId, near: user.position, idHint: 'censer-air-elemental',
      });
    },
  },
  'stone-earth-elemental': {
    id: 'stone-earth-elemental', name: 'Stone of Controlling Earth Elementals', useTime: 'action',
    targeting: { kind: 'self' },
    cost: 1800, rarity: 'rare', charges: 1, refills: { days: 4 }, summons: 'earth-elemental',
    apply({ state, userId }) {
      const user = state.combatants[userId]!;
      return summonCombatant(state, {
        monsterId: 'earth-elemental', summonerId: userId, near: user.position, idHint: 'stone-earth-elemental',
      });
    },
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


// ---------------------------------------------------------------------------
// Scrolls, derived from the spell list
// ---------------------------------------------------------------------------

/**
 * Every spell somebody could read gets a scroll, without anyone writing one.
 *
 * Scrolls used to be hand-authored one at a time, and the arithmetic of that
 * showed: 8 of 28 first-level spells had one, 5 of 15 at second, and nothing at
 * all at fourth. A ranger or paladin party could win a second-level scroll and
 * find that no one in the company could read it, because every scroll that
 * existed happened to be off their list. None of that was a decision — it was
 * the set of scrolls somebody had got round to typing.
 *
 * So the roster is a function of the spell list. Add a spell and its scroll
 * exists; the price, the rarity and the action it costs all follow from the
 * spell rather than being chosen again by hand.
 *
 * WHAT DOES NOT GET ONE
 *
 * A spell nobody has on their list. `useItem` checks `classScrollPool` before
 * it will let a scroll be read, so a scroll of a spell on no class list is an
 * item that can be bought, carried, and never used — the exact dead-data shape
 * this codebase keeps finding. Two spells fall out here, and both are class
 * features wearing a spell's clothes: Divine Smite and Breath Weapon.
 *
 * A reaction spell. Shield is cast when something hits you, and a scroll is
 * read on your own turn; a Scroll of Shield would be legal, purchasable and
 * pointless.
 *
 * A hand-written scroll keeps its own entry. Command is 40g and Ray of Sickness
 * is uncommon — tuned exceptions, and generation must not quietly flatten them.
 */
const SCROLL_COST: Record<number, number> = { 1: 50, 2: 120, 3: 250, 4: 500 };
const SCROLL_RARITY: Record<number, Rarity> = {
  1: 'common', 2: 'uncommon', 3: 'rare', 4: 'rare',
};

/** Spell ids at least one class could read from a scroll. */
function readableSpells(): Id[] {
  const pools = Object.keys(CLASSES)
    .filter((id) => CLASSES[id]?.spellcasting)
    .map((id) => classScrollPool(id));
  return Object.keys(SPELLS).filter((id) => {
    const s = SPELLS[id]!;
    if ((s.level ?? 0) < 1) return false;              // cantrips are not scrolls
    if (s.castingTime === 'reaction') return false;     // see above
    return pools.some((p) => p.has(id));
  });
}

for (const spellId of readableSpells()) {
  const id = `scroll-${spellId}`;
  if (ITEMS[id]) continue;                              // hand-tuned entry wins
  const spell = SPELLS[spellId]!;
  const level = Math.min(4, Math.max(1, spell.level));
  ITEMS[id] = {
    id, name: `Scroll of ${spell.name}`,
    // A scroll costs what the spell costs: a bonus-action spell read from a
    // scroll is still a bonus action, which is most of why Misty Step or
    // Healing Word on a scroll is worth carrying.
    useTime: spell.castingTime === 'bonus' ? 'bonus' : 'action',
    targeting: { kind: 'spell', spellId },
    cost: SCROLL_COST[level]!,
    rarity: SCROLL_RARITY[level]!,
    apply: scrollApply(spellId),
  };
}

/** Every scroll in the game, generated and hand-written alike. */
export const SCROLL_IDS: Id[] = Object.keys(ITEMS).filter((id) => id.startsWith('scroll-')).sort();
