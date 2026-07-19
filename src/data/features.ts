/**
 * Class features. Active features have an `apply` hook; passive ones are
 * consulted by the rules (Dueling, Sneak Attack, Disciple of Life) via their
 * presence in combatant.featureIds.
 */
import type { GameState, Id, Ability } from '../engine/types.js';
import { proficiencyBonus } from '../engine/types.js';
import type { SkillId } from './classes.js';
import { attemptHide } from '../engine/rules/hide.js';
import { rollDice } from '../engine/dice.js';
import { applyHealing } from '../engine/rules/heal.js';
import { savingThrow } from '../engine/rules/saves.js';
import { charmAway } from '../engine/rules/attack.js';
import { distanceFeet } from '../engine/grid.js';
import { abilityMod } from '../engine/types.js';
import type { GameEvent } from '../engine/events.js';

export interface FeatureContext {
  state: GameState;
  actorId: Id;
}

export interface FeatureData {
  id: Id;
  name: string;
  trigger: 'action' | 'bonus' | 'free' | 'passive';
  uses?: { count: number | 'proficiency' | 'fiveTimesLevel'; per: 'encounter' };
  apply?(ctx: FeatureContext): GameEvent[];
  /**
   * This feature spends a variable amount from its own pool inside `apply`
   * (Lay on Hands: 1-63 HP off a level-scaled total) rather than one flat "use"
   * — the mirror of Preserve Life's *internal* pool, except this one persists
   * across activations instead of resetting each cast. Set true to skip
   * step()'s generic `uses.current -= 1` so `apply` owns the decrement.
   */
  manualUses?: boolean;
  /**
   * Extra damage dice this feature contributes when the attack has advantage.
   * The mirror of a weapon's `bonusDiceOnAdvantage`, and the single source of
   * truth for the amount — the attack rule reads it too.
   *
   * Declared as data so policies can price what advantage is worth to a kit
   * without knowing the feature by name: it's the difference between hiding
   * being a rogue's whole gameplan and a cleric's waste of a turn, and
   * `src/ai/` may not name content (test-enforced).
   */
  advantageDice?(level: number): string;
  /**
   * This feature does what the named action verb does, only as a bonus action
   * (Cunning Action, Nimble Escape). Declared so the UI can offer *one* "Hide"
   * instead of two identical-looking buttons — a rogue's bar listed Dash,
   * Disengage and Hide twice each, six of its nine entries, and the player had
   * no way to tell which was which.
   */
  bonusVerb?: 'dash' | 'disengage' | 'hide';
  /** Proficiency in a skill, for anyone who has this feature. */
  grantsSkill?: SkillId;
  /**
   * Advantage on saving throws using these abilities (Gnomish Cunning: Int,
   * Wis, Cha). `savingThrow` reads it directly off the roller's featureIds, so
   * a second species wanting the same shield — a halfling's Brave, say, scoped
   * to just the fear save — is another one-line feature, not new mechanism.
   */
  saveAdvantage?: Ability[];
}

export const FEATURES: Record<Id, FeatureData> = {
  'heroic-inspiration': {
    id: 'heroic-inspiration', name: 'Heroic Inspiration', trigger: 'free',
    uses: { count: 1, per: 'encounter' },
    apply({ state, actorId }) {
      const c = state.combatants[actorId]!;
      c.conditions.push({ id: 'inspired', sourceId: actorId });
      return [{ type: 'conditionApplied', combatantId: actorId, condition: 'inspired', sourceId: actorId }];
    },
  },
  'adrenaline-rush': {
    id: 'adrenaline-rush', name: 'Adrenaline Rush', trigger: 'bonus',
    uses: { count: 'proficiency', per: 'encounter' },
    apply({ state, actorId }) {
      const c = state.combatants[actorId]!;
      c.turn.movementMax += c.speed;
      c.tempHp = Math.max(c.tempHp ?? 0, proficiencyBonus(c.level));
      return [{ type: 'dashed', combatantId: actorId }];
    },
  },
  'relentless-endurance': {
    id: 'relentless-endurance', name: 'Relentless Endurance', trigger: 'passive',
    uses: { count: 1, per: 'encounter' },
  },
  trance: { id: 'trance', name: 'Trance', trigger: 'passive' },
  /**
   * Proficiency in Perception. Declared as a feature rather than a skill list
   * on the combatant because skills live in the campaign layer, and the engine
   * needs this to spot a hidden rogue — one fact, read by both.
   */
  'keen-senses': { id: 'keen-senses', name: 'Keen Senses', trigger: 'passive', grantsSkill: 'perception' },
  'gnomish-cunning': {
    id: 'gnomish-cunning', name: 'Gnomish Cunning', trigger: 'passive',
    saveAdvantage: ['int', 'wis', 'cha'],
  },
  // Existence alone is the whole feature: every d20-rolling call site checks
  // featureIds.includes('lucky') directly (see engine/rules/luck.ts) rather
  // than reading a field off this, so there is nothing else to declare.
  lucky: { id: 'lucky', name: 'Lucky', trigger: 'passive' },
  // Naturally Stealthy, reframed: RAW hides you behind a larger ally, which
  // needs a size system this game doesn't have. Stealth proficiency instead —
  // a halfling's own Hide check is simply better (stealthBonus in hide.ts),
  // which is the part of the trait that actually matters at the table.
  'naturally-stealthy': { id: 'naturally-stealthy', name: 'Naturally Stealthy', trigger: 'passive', grantsSkill: 'stealth' },
  'second-wind': {
    id: 'second-wind', name: 'Second Wind', trigger: 'bonus',
    uses: { count: 2, per: 'encounter' },
    apply({ state, actorId }) {
      const c = state.combatants[actorId]!;
      const roll = rollDice(state.rng, `1d10+${c.level}`);
      state.rng = roll.state;
      return applyHealing(state, actorId, actorId, roll.total);
    },
  },
  'action-surge': {
    id: 'action-surge', name: 'Action Surge', trigger: 'free',
    uses: { count: 1, per: 'encounter' },
    apply({ state, actorId }) {
      const c = state.combatants[actorId]!;
      c.turn.actionUsed = false;
      return [];
    },
  },
  'nimble-escape': {
    id: 'nimble-escape', name: 'Nimble Escape', trigger: 'bonus', bonusVerb: 'disengage',
    apply({ state, actorId }) {
      const c = state.combatants[actorId]!;
      c.turn.disengaged = true;
      return [{ type: 'disengaged', combatantId: actorId }];
    },
  },
  'nimble-hide': {
    id: 'nimble-hide', name: 'Nimble Escape: Hide', trigger: 'bonus', bonusVerb: 'hide',
    apply({ state, actorId }) {
      return attemptHide(state, actorId);
    },
  },
  'pack-tactics': { id: 'pack-tactics', name: 'Pack Tactics', trigger: 'passive' },
  'improved-critical': { id: 'improved-critical', name: 'Improved Critical (Champion)', trigger: 'passive' },
  assassinate: { id: 'assassinate', name: 'Assassinate', trigger: 'passive' },
  'sculpt-spells': { id: 'sculpt-spells', name: 'Sculpt Spells (Evoker)', trigger: 'passive' },
  'cunning-dash': {
    id: 'cunning-dash', name: 'Cunning Action: Dash', trigger: 'bonus', bonusVerb: 'dash',
    apply({ state, actorId }) {
      const c = state.combatants[actorId]!;
      c.turn.movementMax += c.speed;
      return [{ type: 'dashed', combatantId: actorId }];
    },
  },
  'cunning-disengage': {
    id: 'cunning-disengage', name: 'Cunning Action: Disengage', trigger: 'bonus', bonusVerb: 'disengage',
    apply({ state, actorId }) {
      const c = state.combatants[actorId]!;
      c.turn.disengaged = true;
      return [{ type: 'disengaged', combatantId: actorId }];
    },
  },
  'cunning-hide': {
    id: 'cunning-hide', name: 'Cunning Action: Hide', trigger: 'bonus', bonusVerb: 'hide',
    apply({ state, actorId }) {
      return attemptHide(state, actorId);
    },
  },
  'preserve-life': {
    id: 'preserve-life', name: 'Channel Divinity: Preserve Life', trigger: 'action',
    uses: { count: 1, per: 'encounter' },
    apply({ state, actorId }) {
      const me = state.combatants[actorId]!;
      const events: GameEvent[] = [];
      let pool = 5 * me.level;
      // Most-wounded allies within 30 ft first; never above half max HP.
      const targets = Object.values(state.combatants)
        .filter((c) => c.alive && c.team === me.team &&
          distanceFeet(me.position, c.position) <= 30 &&
          c.hp < Math.floor(c.maxHp / 2))
        .sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp);
      for (const t of targets) {
        if (pool <= 0) break;
        const amount = Math.min(pool, Math.floor(t.maxHp / 2) - t.hp);
        if (amount <= 0) continue;
        pool -= amount;
        events.push(...applyHealing(state, t.id, actorId, amount));
      }
      return events;
    },
  },
  'turn-undead': {
    id: 'turn-undead', name: 'Channel Divinity: Turn Undead', trigger: 'action',
    uses: { count: 1, per: 'encounter' },
    apply({ state, actorId }) {
      const me = state.combatants[actorId]!;
      // Base Channel Divinity every cleric gets, not the Life Domain's
      // Preserve Life. RAW turns (forces to flee) every undead within 30 ft
      // that fails a Wisdom save; this game has no "must flee" AI, so a turned
      // undead is removed from the fight via charmAway — the same not-a-death
      // exit Animal Friendship uses, scoped here to creatureType 'undead'.
      const dc = 8 + proficiencyBonus(me.level) + abilityMod(me.abilities.wis);
      const targets = Object.values(state.combatants).filter(
        (c) => c.alive && c.hp > 0 && c.team !== me.team &&
          c.creatureType === 'undead' &&
          distanceFeet(me.position, c.position) <= 30,
      );
      const events: GameEvent[] = [{ type: 'turnedUndead', combatantId: actorId, dc }];
      for (const t of targets) {
        const { success, event } = savingThrow(state, t.id, 'wis', dc);
        events.push(event);
        if (!success) events.push(...charmAway(state, t.id));
        if (state.winner) break;
      }
      return events;
    },
  },
  'undead-fortitude': { id: 'undead-fortitude', name: 'Undead Fortitude', trigger: 'passive' },
  dueling: { id: 'dueling', name: 'Fighting Style: Dueling', trigger: 'passive' },
  defense: { id: 'defense', name: 'Fighting Style: Defense', trigger: 'passive' },
  archery: { id: 'archery', name: 'Fighting Style: Archery', trigger: 'passive' },
  'great-weapon-fighting': { id: 'great-weapon-fighting', name: 'Fighting Style: Great Weapon Fighting', trigger: 'passive' },
  'two-weapon-fighting': { id: 'two-weapon-fighting', name: 'Fighting Style: Two-Weapon Fighting', trigger: 'passive' },
  'sneak-attack': {
    id: 'sneak-attack', name: 'Sneak Attack', trigger: 'passive',
    advantageDice: (level) => `${Math.ceil(level / 2)}d6`,
  },
  'disciple-of-life': { id: 'disciple-of-life', name: 'Disciple of Life', trigger: 'passive' },
  // Extra Attack (Fighter 5): the builder reads this to set attacksPerAction: 2.
  'extra-attack': { id: 'extra-attack', name: 'Extra Attack', trigger: 'passive' },
  // Uncanny Dodge (Rogue 5): the first hit against the rogue each round has its
  // damage halved (a reaction in 5e; here a once-per-round passive checked in
  // resolveAttack). Existence alone is the feature.
  'uncanny-dodge': { id: 'uncanny-dodge', name: 'Uncanny Dodge', trigger: 'passive' },
  // Trinket-granted passives; their effects live in the rules that read them.
  'cloak-protection': { id: 'cloak-protection', name: 'Cloak of Protection', trigger: 'passive' },
  'brooch-shielding': { id: 'brooch-shielding', name: 'Brooch of Shielding', trigger: 'passive' },
  'bracers-archery': { id: 'bracers-archery', name: 'Bracers of Archery', trigger: 'passive' },
  'boots-winterlands': { id: 'boots-winterlands', name: 'Boots of the Winterlands', trigger: 'passive' },
  'gloves-thievery': { id: 'gloves-thievery', name: 'Gloves of Thievery', trigger: 'passive' },
  'long-limbed': { id: 'long-limbed', name: 'Long-Limbed', trigger: 'passive' },
  brute: { id: 'brute', name: 'Brute', trigger: 'passive' },
  rampage: { id: 'rampage', name: 'Rampage', trigger: 'passive' },
  swallow: { id: 'swallow', name: 'Swallow', trigger: 'passive' },
  relentless: { id: 'relentless', name: 'Relentless', trigger: 'passive' },
  charge: { id: 'charge', name: 'Charge', trigger: 'passive' },
  burrow: { id: 'burrow', name: 'Burrow', trigger: 'passive' },
  'fire-form': { id: 'fire-form', name: 'Fire Form', trigger: 'passive' },
  whelm: { id: 'whelm', name: 'Whelm', trigger: 'action', uses: { count: 1, per: 'encounter' } },
  whirlwind: { id: 'whirlwind', name: 'Whirlwind', trigger: 'action', uses: { count: 1, per: 'encounter' } },
  'earth-glide': { id: 'earth-glide', name: 'Earth Glide', trigger: 'passive' },
  // Colossus Slayer (Ranger, Hunter): once per turn, +1d8 on a hit against a
  // target below its HP max. Existence alone is the feature — the rider and
  // the once-per-turn gate live in resolveAttack, next to Sneak Attack.
  'colossus-slayer': { id: 'colossus-slayer', name: "Hunter's Prey: Colossus Slayer", trigger: 'passive' },
  'lay-on-hands': {
    id: 'lay-on-hands', name: 'Lay on Hands', trigger: 'action',
    uses: { count: 'fiveTimesLevel', per: 'encounter' },
    manualUses: true,
    apply({ state, actorId }) {
      const me = state.combatants[actorId]!;
      const pool = me.featureUses['lay-on-hands']?.current ?? 0;
      if (pool <= 0) return [];
      // Touch range: the most wounded ally adjacent (or self), same
      // most-wounded-first sort Preserve Life uses for its 30 ft radius.
      const target = Object.values(state.combatants)
        .filter((c) => c.alive && c.team === me.team && c.hp < c.maxHp &&
          (c.id === me.id || distanceFeet(me.position, c.position) <= 5))
        .sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
      if (!target) return [];
      const amount = Math.min(pool, target.maxHp - target.hp);
      me.featureUses['lay-on-hands']!.current -= amount;
      return applyHealing(state, target.id, actorId, amount);
    },
  },
  // Divine Smite (Paladin): a bonus-action spell cast on a melee hit, in the
  // 2024 rules. The engine resolves an attack atomically with no "react to
  // your own hit" prompt, so this fires automatically in resolveAttack —
  // consuming the lowest available slot and the bonus action, which is what
  // caps a real smite to once per turn.
  'divine-smite': { id: 'divine-smite', name: 'Divine Smite', trigger: 'passive' },
  // Sacred Weapon (Paladin, Devotion): a Channel Divinity that adds Charisma
  // to the paladin's own attack rolls for the rest of the encounter. Applying
  // it just marks the `sacredWeapon` condition; resolveAttack reads it.
  'sacred-weapon': {
    id: 'sacred-weapon', name: 'Channel Divinity: Sacred Weapon', trigger: 'bonus',
    uses: { count: 1, per: 'encounter' },
    apply({ state, actorId }) {
      const c = state.combatants[actorId]!;
      c.conditions.push({ id: 'sacredWeapon', sourceId: actorId });
      return [{ type: 'conditionApplied', combatantId: actorId, condition: 'sacredWeapon', sourceId: actorId }];
    },
  },
};
