/**
 * Class features. Active features have an `apply` hook; passive ones are
 * consulted by the rules (Dueling, Sneak Attack, Disciple of Life) via their
 * presence in combatant.featureIds.
 */
import type { GameState, Id, Ability, DamageType, Combatant, Position } from '../engine/types.js';
import { proficiencyBonus, cellAt, isDown } from '../engine/types.js';
import type { SkillId } from './classes.js';
import { MONSTERS } from './monsters.js';
import { attemptHide } from '../engine/rules/hide.js';
import { rollDice } from '../engine/dice.js';
import { applyHealing } from '../engine/rules/heal.js';
import { savingThrow, saveForHalf, charmWarded, immuneToCharmAndFear } from '../engine/rules/saves.js';
import { applyDamage, kill, dropToZero, resolveAttack } from '../engine/rules/attack.js';
import { pushCreature } from '../engine/rules/movement.js';
import { distanceFeet, cone15, line15, sphere2x2, DIRECTIONS, type Direction8 } from '../engine/grid.js';
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
  /**
   * A limited pool, and the clock it refills on.
   *
   * `per` used to be the single-member union `'encounter'`, which meant every
   * limited feature in the game recharged at the start of every fight. That is
   * right for a monster — few survive to a second one — and wrong for the eight
   * features a player class owns. Lay on Hands was the loudest: a level-5
   * paladin's 25 HP healing pool is meant to be the whole day's budget, and it
   * came back in full for each wave.
   *
   * The consequence was systemic rather than cosmetic. Spell slots persist
   * across an arena day, so the wizard was the only character in the party
   * doing resource management, and the martial and Channel Divinity classes
   * were quietly stronger than their class tables assume.
   *
   *   encounter   refills every fight. Monsters, species traits, item powers.
   *   shortRest   survives a fight, refills at the arena's lunch break.
   *   longRest    survives the day, refills overnight.
   *
   * Only non-encounter pools are carried out of a fight and persisted
   * (`readBackSurvivors`), so an encounter pool cannot leak into the next wave
   * even from an old save.
   */
  uses?: {
    count: number | 'proficiency' | 'fiveTimesLevel' | 'charismaMod' | 'level';
    per: 'encounter' | 'shortRest' | 'longRest';
  };
  /**
   * A recharge ability (dragon breath): starts available, is spent on use, and
   * at the start of the owner's turn rolls a d6 — on a result at or above this
   * threshold it recharges. `recharge: 5` is the classic "Recharge 5–6", `6` is
   * "Recharge 6". Stored as a one-charge `featureUses` pool, so the same gate
   * and decrement that serve `uses` serve it; the roll lives in startTurn.
   */
  recharge?: number;
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

// --- dragon breath weapons -------------------------------------------------
// One shape for every chromatic wyrmling: a cone or line of elemental damage,
// half on a save. The per-color numbers are the only difference, so they live
// in a registry the feature apply and the AI both read (src/ai prices it off
// the same spec without naming a color).

export interface BreathSpec {
  shape: 'cone' | 'line';
  length?: number;           // line reach in cells (cone is fixed by cone15)
  save: Ability;             // the ability the *target* rolls
  damageType: DamageType;
  dice: string;              // SRD wyrmling dice — red breathes hardest
}

export const BREATH_WEAPONS: Record<Id, BreathSpec> = {
  'breath-acid':      { shape: 'line', length: 3, save: 'dex', damageType: 'acid',      dice: '5d8' }, // Black
  'breath-lightning': { shape: 'line', length: 6, save: 'dex', damageType: 'lightning', dice: '6d6' }, // Blue
  'breath-poison':    { shape: 'cone',            save: 'con', damageType: 'poison',    dice: '6d6' }, // Green
  'breath-fire':      { shape: 'cone',            save: 'dex', damageType: 'fire',      dice: '7d6' }, // Red
  'breath-cold':      { shape: 'cone',            save: 'con', damageType: 'cold',      dice: '5d8' }, // White
  // Young dragons, one age category up. A wyrmling's breath is a strong hit; a
  // young dragon's is the reason the fight is about positioning, so the line
  // ones reach further as well as hitting harder.
  'breath-acid-young':      { shape: 'line', length: 6, save: 'dex', damageType: 'acid',      dice: '11d8' },
  'breath-lightning-young': { shape: 'line', length: 12, save: 'dex', damageType: 'lightning', dice: '10d10' },
  'breath-poison-young':    { shape: 'cone',            save: 'con', damageType: 'poison',    dice: '12d6' },
  'breath-fire-young':      { shape: 'cone',            save: 'dex', damageType: 'fire',      dice: '16d6' },
  'breath-cold-young':      { shape: 'cone',            save: 'con', damageType: 'cold',      dice: '8d8' },
  // The chimera's goat head breathes fire on the same recharge, at its own
  // (lower) CR 6 scale — it is not a dragon and shouldn't hit like one.
  'breath-fire-chimera':    { shape: 'cone',            save: 'dex', damageType: 'fire',      dice: '7d8' },
  // The hell hound's is a CR 3 cone — a pack of them is the threat, not any
  // one breath.
  'breath-fire-hound':      { shape: 'cone',            save: 'dex', damageType: 'fire',      dice: '6d6' },
  // Mephit breath, at CR 1/2 scale. Their SRD versions also blind or slow;
  // a breath spec carries damage only, so those riders are left off rather
  // than faked with the wrong condition.
  'breath-mephit-fire':     { shape: 'cone',            save: 'dex', damageType: 'fire',      dice: '2d4' },
  'breath-mephit-cold':     { shape: 'cone',            save: 'dex', damageType: 'cold',      dice: '2d4' },
};

/** The cells a breath covers when aimed a given direction. */
function breathCells(me: Combatant, dir: Direction8, spec: BreathSpec) {
  return spec.shape === 'line' ? line15(me.position, dir, spec.length) : cone15(me.position, dir);
}

/** Auto-aim: the direction whose cone/line covers the most enemy hit points.
 *  Undefined when no direction catches an enemy (don't waste the breath). */
export function bestBreathDirection(state: GameState, me: Combatant, featureId: Id): Direction8 | undefined {
  const spec = BREATH_WEAPONS[featureId];
  if (!spec) return undefined;
  let best: Direction8 | undefined;
  let bestHp = 0;
  for (const dir of Object.keys(DIRECTIONS) as Direction8[]) {
    let hp = 0;
    for (const pos of breathCells(me, dir, spec)) {
      const t = cellAt(state.grid, pos)?.occupantId ? state.combatants[cellAt(state.grid, pos)!.occupantId!] : undefined;
      if (t && t.alive && t.hp > 0 && t.team !== me.team) hp += t.hp;
    }
    if (hp > bestHp) { bestHp = hp; best = dir; }
  }
  return best;
}

/** Charm the nearest enemy within 30 ft out of the fight on a failed Wis save.
 *  Shared by Fey Charm (dryad) and Charm (succubus) -- same rule, two names. */
function charmNearestApply({ state, actorId }: FeatureContext): GameEvent[] {
  const me = state.combatants[actorId]!;
  const dc = 8 + proficiencyBonus(me.level) + abilityMod(me.abilities.cha);
  const foes = Object.values(state.combatants)
    .filter((c) => c.alive && c.hp > 0 && c.team !== me.team &&
      distanceFeet(me.position, c.position) <= 30)
    .sort((a, b) => distanceFeet(me.position, a.position) - distanceFeet(me.position, b.position));
  const target = foes[0];
  if (!target) return [];
  const { success, event } = savingThrow(state, target.id, 'wis', dc);
  const events: GameEvent[] = [event];
  // Aura of Devotion: charm does not land inside a devoted paladin's aura at
  // all, so the ward is checked before the condition rather than after.
  if (!success && !charmWarded(state, target) &&
      !target.conditions.some((k) => k.id === 'charmed' && k.sourceId === me.id)) {
    if (immuneToCharmAndFear(target)) return [];
    target.conditions.push({ id: 'charmed', sourceId: me.id, repeatSave: { ability: 'wis', dc } });
    events.push({ type: 'conditionApplied', combatantId: target.id, condition: 'charmed', sourceId: me.id });
  }
  return events;
}

/** The `apply` hook for a breath feature: aim, then save-for-half everyone caught. */
function breathApply(featureId: Id) {
  return ({ state, actorId }: FeatureContext): GameEvent[] => {
    const me = state.combatants[actorId]!;
    const spec = BREATH_WEAPONS[featureId]!;
    const dir = bestBreathDirection(state, me, featureId);
    if (!dir) return [];
    const dc = 8 + proficiencyBonus(me.level) + abilityMod(me.abilities.con);
    const events: GameEvent[] = [];
    for (const pos of breathCells(me, dir, spec)) {
      const tid = cellAt(state.grid, pos)?.occupantId;
      if (!tid) continue;
      const t = state.combatants[tid]!;
      if (!t.alive || t.hp <= 0 || t.team === me.team) continue;
      const { success, event } = savingThrow(state, t.id, spec.save, dc);
      events.push(event);
      const roll = rollDice(state.rng, spec.dice);
      state.rng = roll.state;
      const amount = saveForHalf(t, spec.save, roll.total, success);
      if (amount > 0) events.push(...applyDamage(state, t.id, actorId, amount, spec.damageType, roll.rolls));
    }
    return events;
  };
}

/**
 * The beasts a druid can wear, strongest first. Gated by druid level the way
 * the SRD gates them by challenge rating: CR 1/4 from level 2. There is no CR
 * 1/2 beast in this bestiary, so level 4 opens nothing new, and CR 1 forms
 * (dire wolf, brown bear) are level 8 in the rules — past this game's cap.
 *
 * Ordered rather than chosen: a feature has no target picker, so Wild Shape
 * takes the first form its level allows. Making the form a build decision is a
 * real improvement and a separate change; the list being data is what makes
 * that change small.
 */
/** Step back out of a beast form, restoring everything it overwrote. */
/**
 * Put a shape-changed creature back in its own body.
 *
 * Exported because Polymorph needs the same operation from three other places:
 * the beast's hit points running out, the caster losing concentration, and the
 * caster dying. Duplicating the restore in each would be four chances to forget
 * one of the seven fields.
 */
export function revertShape(me: Combatant): GameEvent[] {
  return revertWildShape(me);
}

function revertWildShape(me: Combatant): GameEvent[] {
  const shape = me.wildShape;
  if (!shape) return [];
  const o = shape.original;
  if (o.acOverride !== undefined) me.acOverride = o.acOverride; else delete me.acOverride;
  me.speed = o.speed;
  me.abilities = { ...o.abilities };
  me.equipped = { ...o.equipped };
  me.inventory = o.inventory.map((it) => ({ ...it }));
  me.featureIds = [...o.featureIds];
  me.attacksPerAction = o.attacksPerAction;
  // Polymorph: the original creature comes back with the hit points it had.
  // Wild Shape has no `hp` snapshot — the druid kept its own throughout — and
  // only sheds the beast's temporary ones.
  if (o.spellIds !== undefined) me.spellIds = [...o.spellIds];
  if (o.maxHp !== undefined) me.maxHp = o.maxHp;
  if (o.hp !== undefined) me.hp = Math.max(1, Math.min(o.hp, me.maxHp));
  // The beast's temporary hit points go with the beast.
  delete me.tempHp;
  delete me.wildShape;
  return [{ type: 'wildShapeEnded', combatantId: me.id, formId: shape.formId }];
}

export const WILD_SHAPE_FORMS: Array<{ monsterId: Id; minLevel: number }> = [
  { monsterId: 'wolf', minLevel: 2 },          // CR 1/4: speed 40, Pack Tactics
  { monsterId: 'giant-badger', minLevel: 2 },  // CR 1/4: AC 13, two attacks
];

/**
 * Spend a point from the monk's shared Focus pool.
 *
 * The pool lives on `monks-focus` and the techniques draw on it, so this is the
 * one place that knows that. Returns false when it is empty, and every
 * technique bails on false rather than firing for free — a bonus action that
 * silently does nothing is worse than a greyed-out button.
 */
function spendFocus(me: Combatant): boolean {
  const pool = me.featureUses['monks-focus'];
  if (!pool || pool.current <= 0) return false;
  pool.current -= 1;
  return true;
}

/** The adjacent enemy worth hitting most: the one closest to dropping. */
function bestAdjacentFoe(state: GameState, me: Combatant): Combatant | undefined {
  let best: Combatant | undefined;
  for (const c of Object.values(state.combatants)) {
    if (!c.alive || isDown(c) || c.team === me.team) continue;
    if (distanceFeet(c.position, me.position) > 5) continue;
    if (!best || c.hp < best.hp) best = c;
  }
  return best;
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
    uses: { count: 2, per: 'shortRest' },
    apply({ state, actorId }) {
      const c = state.combatants[actorId]!;
      const roll = rollDice(state.rng, `1d10+${c.level}`);
      state.rng = roll.state;
      return applyHealing(state, actorId, actorId, roll.total);
    },
  },
  'action-surge': {
    id: 'action-surge', name: 'Action Surge', trigger: 'free',
    uses: { count: 1, per: 'shortRest' },
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
  // --- levels 6 and 7 -------------------------------------------------------
  // Read where they apply rather than doing anything themselves, because each
  // one changes a roll somebody else is making: a save (saves.ts), a cantrip's
  // damage (spells.ts), or the halving of a Dex save (saveForHalf).
  /**
   * Land's Aid (Circle of the Land, Druid 3). The druid was the ONLY class with
   * no subclass feature at all — every other one gets something at 3rd and the
   * druid got nothing, which is a hole every single playthrough walks into
   * rather than the few that reach the deep waves.
   *
   * Spends a Wild Shape use rather than a pool of its own, exactly as the SRD
   * says, which makes it a real decision: a druid has two uses and this competes
   * with turning into a bear.
   *
   * Picks its own spot the way Call Lightning does, because features choose
   * their own targets here — nothing in the action layer aims one at a cell.
   * Enemies only take the damage ("each creature of your choice"), so an ally
   * standing in the flowers is safe and can be the one healed.
   */
  'lands-aid': {
    id: 'lands-aid', name: "Land's Aid", trigger: 'action',
    apply({ state, actorId }) {
      const me = state.combatants[actorId]!;
      const pool = me.featureUses['wild-shape'];
      if (!pool || pool.current <= 0) return [];

      // The 10-ft sphere catching the most enemy hit points.
      let best: Position | undefined;
      let bestHp = -1;
      for (const other of Object.values(state.combatants)) {
        if (!other.alive || isDown(other) || other.team === me.team) continue;
        if (distanceFeet(me.position, other.position) > 60) continue;
        let hp = 0;
        for (const pos of sphere2x2(other.position)) {
          const tid = cellAt(state.grid, pos)?.occupantId;
          if (!tid) continue;
          const t = state.combatants[tid]!;
          if (t.alive && !isDown(t) && t.team !== me.team) hp += t.hp;
        }
        if (hp > bestHp) { bestHp = hp; best = other.position; }
      }
      if (!best) return [];
      pool.current -= 1;

      const dc = 8 + proficiencyBonus(me.level) + abilityMod(me.abilities.wis);
      const events: GameEvent[] = [];
      const inSphere = sphere2x2(best)
        .map((pos) => cellAt(state.grid, pos)?.occupantId)
        .filter((id): id is Id => id !== undefined)
        .map((id) => state.combatants[id]!)
        .filter((t) => t.alive && !isDown(t));

      for (const t of inSphere) {
        if (t.team === me.team) continue;
        const { success, event } = savingThrow(state, t.id, 'con', dc);
        events.push(event);
        const roll = rollDice(state.rng, '2d6');
        state.rng = roll.state;
        events.push(...applyDamage(state, t.id, actorId, saveForHalf(t, 'con', roll.total, success), 'necrotic', roll.rolls));
      }
      // …and the life-giving half, on whichever ally in the sphere needs it most.
      const hurt = inSphere
        .filter((t) => t.team === me.team && t.hp < t.maxHp)
        .sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
      if (hurt) {
        const heal = rollDice(state.rng, '2d6');
        state.rng = heal.state;
        events.push(...applyHealing(state, hurt.id, actorId, heal.total));
      }
      return events;
    },
  },
  /**
   * Remarkable Athlete (Champion, Fighter 3). Advantage on initiative is read in
   * rollInitiative; the half-speed move after a critical hit is granted in
   * resolveAttack. Both live where the roll happens, since neither does anything
   * on its own turn.
   */
  'remarkable-athlete': { id: 'remarkable-athlete', name: 'Remarkable Athlete', trigger: 'passive' },
  'aura-of-devotion': { id: 'aura-of-devotion', name: 'Aura of Devotion', trigger: 'passive' },
  /** Escape the Horde: opportunity attacks against you have disadvantage. Read
   *  in resolveAttack, which is where whether an attack IS an opportunity attack
   *  is known — collectAttackSources is never told. */
  'escape-the-horde': { id: 'escape-the-horde', name: 'Escape the Horde', trigger: 'passive' },
  /** Blessed Healer: healing someone else with a slot heals you for 2 + the
   *  slot's level. Read in the castSpell path, the only place that knows a slot
   *  was spent AND who the healing actually reached. */
  'blessed-healer': { id: 'blessed-healer', name: 'Blessed Healer', trigger: 'passive' },
  'aura-of-protection': { id: 'aura-of-protection', name: 'Aura of Protection', trigger: 'passive' },
  evasion: { id: 'evasion', name: 'Evasion', trigger: 'passive' },
  roving: { id: 'roving', name: 'Roving', trigger: 'passive' },
  /** Blessed Strikes / Elemental Fury, taken as the caster half of each: the
   *  class's spellcasting modifier is added to its damaging cantrips. Shares
   *  the Evoker's machinery, which already does exactly this. */
  'potent-spellcasting': { id: 'potent-spellcasting', name: 'Potent Spellcasting', trigger: 'passive' },
  countercharm: { id: 'countercharm', name: 'Countercharm', trigger: 'passive' },
  'sculpt-spells': { id: 'sculpt-spells', name: 'Sculpt Spells (Evoker)', trigger: 'passive' },
  'enhanced-cantrip': { id: 'enhanced-cantrip', name: 'Potent Cantrip (Evoker)', trigger: 'passive' },
  /**
   * Fast Hands (Thief, level 3). The SRD's version is three things: pick a
   * lock, pick a pocket, or use an object — and only the last one exists on a
   * battle grid, where "use an object" is drinking a potion or throwing a
   * flask. So the feature is a flag the action economy reads: `useItem` costs
   * a Bonus Action instead of an Action.
   *
   * `bonusVerb` cannot express it — that switch names the three movement-ish
   * verbs Cunning Action covers, and item use is not one of them.
   */
  'fast-hands': {
    id: 'fast-hands', name: 'Fast Hands', trigger: 'passive',
  },
  /**
   * Steady Aim (Rogue 3): stand still, and the next attack has advantage.
   *
   * The rogue's whole damage output is Sneak Attack, and Sneak Attack needs
   * either advantage or an ally in reach. A rogue that has neither — the common
   * case for the archer, who is deliberately standing away from the melee —
   * deals shortbow damage and nothing else. That showed up as the worst class
   * in the arena by a distance: bottom-third damage, the most downs, the worst
   * finish rate. This is the SRD's own answer to it.
   *
   * The cost is real and is enforced in `isLegalAction`, not here: it cannot be
   * used after moving, and it drops the rogue's remaining movement to zero. So
   * it is bought with mobility, which is exactly the trade that makes it a
   * decision rather than a free +advantage every turn.
   */
  'steady-aim': {
    id: 'steady-aim', name: 'Steady Aim', trigger: 'bonus',
    apply({ state, actorId }) {
      const c = state.combatants[actorId]!;
      // Speed 0 for the rest of the turn. Setting the cap to what is already
      // spent (rather than to zero) keeps `movementUsed <= movementMax` true,
      // which the movement rules rely on.
      c.turn.movementMax = c.turn.movementUsed;
      c.conditions.push({ id: 'aiming', sourceId: actorId });
      return [{ type: 'conditionApplied', combatantId: actorId, condition: 'aiming', sourceId: actorId }];
    },
  },
  /**
   * Pact Magic: a marker, not an effect.
   *
   * The mechanics live in two places that read it — `recoverSlotsOnShortRest`
   * gives every slot back rather than the half-level budget Arcane Recovery
   * uses, and the class's own `slotsByLevel` puts all of them at one tier. This
   * exists so both can ask "is this a pact caster" without either of them
   * hard-coding the class id, which is how the warlock would end up half
   * implemented the day somebody adds a second pact class.
   */
  'pact-magic': { id: 'pact-magic', name: 'Pact Magic', trigger: 'passive' },
  /**
   * Eldritch Invocations: the level-1 heading itself, kept as a marker.
   *
   * The invocations proper are CHOICES (see the warlock's `choices`), because
   * the SRD gives a warlock several and lets it pick. What this feature does is
   * name the thing in the class table, so the SRD level-heading check has
   * something to match and a character sheet has something to print.
   */
  'eldritch-invocations': { id: 'eldritch-invocations', name: 'Eldritch Invocations', trigger: 'passive' },
  /**
   * Agonizing Blast: +Charisma to every beam of Eldritch Blast.
   *
   * Named for the SRD heading rather than for the invocation, because that is
   * what the class actually gets at level 1 — and because there is no
   * invocation-picking screen here, so a feature called "Agonizing Blast" would
   * be claiming a choice the player never makes. Agonizing Blast is the one
   * every warlock takes, and a warlock without it is a warlock that does not
   * work.
   *
   * Read inside the spell rather than as a damage hook, because it applies per
   * BEAM — a generic "+Cha to spell damage" would pay it once and quietly halve
   * the invocation for a warlock who has earned a second beam.
   */
  'agonizing-blast': { id: 'agonizing-blast', name: 'Agonizing Blast', trigger: 'passive' },
  /**
   * Magical Cunning (Warlock 2): an action to get a pact slot back.
   *
   * The SRD's rite is a minute long and returns half the warlock's maximum,
   * once per long rest. A minute is ten rounds, which is longer than most
   * fights here, so the printed version is a between-fights button — and the
   * arena already short-rests between the day's two fights, which refills
   * everything anyway. As printed it would do nothing at all.
   *
   * So it is an ACTION for ONE slot, in the fight, once per long rest. That is
   * the same resource in the place it can matter: a warlock holding two slots
   * gets a third across a long fight, at the cost of a whole turn — which is a
   * real decision, and reads as the same feature rather than as a new one.
   */
  'magical-cunning': {
    id: 'magical-cunning', name: 'Magical Cunning', trigger: 'action',
    uses: { count: 1, per: 'longRest' },
    apply({ state, actorId }) {
      const c = state.combatants[actorId]!;
      // The pact tier is the only one a warlock has, so refill the highest
      // tier that is missing anything rather than assuming an index.
      for (let i = c.spellSlots.length - 1; i >= 0; i--) {
        const pool = c.spellSlots[i]!;
        if (pool.max > 0 && pool.current < pool.max) {
          pool.current += 1;
          return [{ type: 'recharged', combatantId: actorId, featureId: 'magical-cunning' }];
        }
      }
      return [];
    },
  },
  /**
   * Pact of the Tome: the Book of Shadows.
   *
   * Three cantrips from any class's list and a ritual, which the builder folds
   * in as granted spells so they do not eat the warlock's own cantrip budget —
   * the SRD is explicit that feature-granted spells do not count against what
   * you prepare.
   *
   * The three are chosen rather than offered, for now: a picker over every
   * cantrip in the game is a screen this does not have, and the useful answer
   * for a warlock is narrow anyway. Vicious Mockery is the pick that is not
   * about damage — a Wisdom save that leaves disadvantage behind, which
   * Eldritch Blast cannot do at any level. Sacred Flame is a Dexterity save,
   * so it goes through the armoured things a spell attack struggles with. Ray
   * of Frost slows what is closing.
   */
  'pact-of-the-tome': { id: 'pact-of-the-tome', name: 'Pact of the Tome', trigger: 'passive' },
  /**
   * Fiend Spells (Fiend patron): always prepared, and not counted against the
   * warlock's own prepared list — the SRD says so in as many words. This is
   * where a warlock gets Fireball, which is not on its own spell list at all.
   */
  'fiend-spells': { id: 'fiend-spells', name: 'Fiend Spells', trigger: 'passive' },
  /**
   * Armor of Shadows: Mage Armor on yourself, at will and for free.
   *
   * Applied in the builder rather than as a spell the warlock casts, because
   * "at will, no slot, no concentration" means it is simply always on — a
   * button that can never be declined is a worse way to say the same thing.
   */
  'armor-of-shadows': { id: 'armor-of-shadows', name: 'Armor of Shadows', trigger: 'passive' },
  /**
   * Fiendish Vigor: False Life on yourself at will, so the warlock walks into
   * every fight already wearing the temporary hit points. The average of
   * 2d4+4 rather than a roll, for the same reason the camp version takes the
   * average: a value that silently varies invites re-rolling it.
   */
  'fiendish-vigor': { id: 'fiendish-vigor', name: 'Fiendish Vigor', trigger: 'passive' },
  /**
   * Repelling Blast: each beam of Eldritch Blast shoves its target 10 feet.
   *
   * The one invocation that changes the shape of a fight rather than its
   * numbers — a warlock with this can hold a doorway, and pushing something out
   * of reach costs it a turn of walking back.
   */
  'repelling-blast': { id: 'repelling-blast', name: 'Repelling Blast', trigger: 'passive' },
  /**
   * Gift of the Protectors: an ally who would drop to 0 drops to 1 instead,
   * once per short rest. Rides `dropToZero`, the single place every route to
   * zero passes through — the same hook Death Ward uses, for the same reason.
   */
  'gift-of-the-protectors': {
    id: 'gift-of-the-protectors', name: 'Gift of the Protectors', trigger: 'passive',
    uses: { count: 1, per: 'shortRest' },
  },
  /**
   * Dark One's Blessing (Fiend patron): temporary hit points when you drop
   * something. Checked in `applyDamage`, which is the one place that knows both
   * that a creature reached zero and who put it there.
   */
  'dark-ones-blessing': { id: 'dark-ones-blessing', name: "Dark One's Blessing", trigger: 'passive' },
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
    uses: { count: 1, per: 'shortRest' },
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
    uses: { count: 1, per: 'shortRest' },
    apply({ state, actorId }) {
      const me = state.combatants[actorId]!;
      // Base Channel Divinity every cleric gets, not the Life Domain's
      // Preserve Life. RAW turns every undead within 30 ft that fails a Wisdom
      // save, and turned means *flees*: it spends its turns running for the
      // nearest edge and is gone when it gets there. Not concentration, so
      // nothing the party does calls it back — but the skeleton is on the board
      // and killable the whole way out, which is the difference between turning
      // a horde and deleting it.
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
        if (!success) {
          t.conditions.push({ id: 'fleeing', sourceId: actorId });
          events.push({ type: 'conditionApplied', combatantId: t.id, condition: 'fleeing', sourceId: actorId });
        }
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
  // Origin feat. Passive: the attack rule rerolls a below-average weapon damage
  // roll once a turn (see rules/attack.ts). Listed here so it appears on the
  // character sheet with everything else the hero has — a feature the engine
  // reads but no panel names is a feat the player cannot tell they took.
  'savage-attacker': { id: 'savage-attacker', name: 'Savage Attacker', trigger: 'passive' },
  /**
   * Origin feat. Two halves, both automatic: `rollInitiative` adds proficiency,
   * and then swaps the holder into a spellcaster ally's place when that helps
   * (see rules/initiative.ts). The swap is the half that matters — see feats.ts
   * for the measurement showing the bonus alone is worth almost nothing.
   */
  alert: { id: 'alert', name: 'Alert', trigger: 'passive' },
  /**
   * Origin feat (the SRD's Lucky, renamed). Three rerolls a day, spent by
   * `rules/luck.ts` on the first three natural rolls of 10 or less — no prompt
   * and no AI scoring, deliberately.
   */
  fated: {
    id: 'fated', name: 'Fated', trigger: 'passive',
    uses: { count: 3, per: 'longRest' },
  },
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
  // Bracers of Defense: +2 AC, but only with no armour and no shield — read in
  // acOf, which is where every other AC grant is read.
  'bracers-defense': { id: 'bracers-defense', name: 'Bracers of Defense', trigger: 'passive' },
  // Cloak of Displacement: attacks against the wearer have disadvantage, and
  // the property switches off until the start of its next turn once something
  // lands. Read in collectAttackSources; the "something landed" half is a
  // condition the damage path applies.
  'cloak-displacement': { id: 'cloak-displacement', name: 'Cloak of Displacement', trigger: 'passive' },
  // Mantle of Spell Resistance: advantage on saves against spells. savingThrow
  // already knows whether a save is magical, so this reads that flag.
  'mantle-spell-resistance': { id: 'mantle-spell-resistance', name: 'Mantle of Spell Resistance', trigger: 'passive' },
  // Wand of the War Mage: a bonus to spell attack rolls, and spells that ignore
  // half cover. Read in spells.ts's single spellAttack chokepoint.
  'war-mage-1': { id: 'war-mage-1', name: 'Wand of the War Mage +1', trigger: 'passive' },
  // Ring of Free Action: difficult terrain is free, and magic cannot Restrain
  // or Paralyze the wearer. Read in movement (terrain cost) and wherever those
  // two conditions are applied.
  'free-action': { id: 'free-action', name: 'Ring of Free Action', trigger: 'passive' },
  /**
   * Berserker Axe's curse: everything else you swing is worse. Read in
   * collectAttackSources, which is where every other source of disadvantage
   * lives — so this competes with advantage the ordinary way rather than being
   * a special case in the attack maths.
   */
  'berserker-curse': { id: 'berserker-curse', name: "Berserker's Grip", trigger: 'passive' },
  /** Necklace of Prayer Beads: Bless, as a bonus action, once before a rest. */
  'prayer-bead-bless': {
    id: 'prayer-bead-bless', name: 'Prayer Bead: Bless', trigger: 'bonus',
    uses: { count: 1, per: 'encounter' },
    apply({ state, actorId }) {
      const actor = state.combatants[actorId]!;
      const events: GameEvent[] = [];
      // The three nearest allies, self included — Bless's own three targets.
      const allies = Object.values(state.combatants)
        .filter((c) => c.alive && !isDown(c) && c.team === actor.team)
        .sort((a, b) => distanceFeet(actor.position, a.position) - distanceFeet(actor.position, b.position))
        .slice(0, 3);
      for (const a of allies) {
        if (a.conditions.some((k) => k.id === 'blessed')) continue;
        a.conditions.push({ id: 'blessed', sourceId: actorId });
        events.push({ type: 'conditionApplied', combatantId: a.id, condition: 'blessed', sourceId: actorId });
      }
      return events;
    },
  },
  /**
   * Mace of Terror: a 30-foot wave of fear, three times before a rest.
   *
   * Applied as `fleeing` — the condition Turn Undead uses — because the SRD's
   * frightened-in-this-way IS a rout: "must spend its turns trying to move as
   * far away from you as it can". A save at the end of each turn ends it, which
   * is the difference between this and a Turn: a turned skeleton runs off the
   * board, and a terrified ogre may well come back.
   */
  'wave-of-terror': {
    id: 'wave-of-terror', name: 'Wave of Terror', trigger: 'action',
    uses: { count: 3, per: 'encounter' },
    apply({ state, actorId }) {
      const actor = state.combatants[actorId]!;
      const events: GameEvent[] = [];
      for (const t of Object.values(state.combatants)) {
        if (!t.alive || isDown(t) || t.team === actor.team) continue;
        if (distanceFeet(actor.position, t.position) > 30) continue;
        if (t.conditions.some((k) => k.id === 'fleeing')) continue;
        const save = savingThrow(state, t.id, 'wis', 15, { magical: true });
        events.push(save.event);
        if (save.success) continue;
        t.conditions.push({ id: 'fleeing', sourceId: actorId, repeatSave: { ability: 'wis', dc: 15 } });
        events.push({ type: 'conditionApplied', combatantId: t.id, condition: 'fleeing', sourceId: actorId });
      }
      return events;
    },
  },
  // Ring of Evasion: a reaction that turns a failed Dexterity save into a
  // success, three times before a rest. Fired automatically in saves.ts, the
  // way the Shield spell fires in the attack path — a prompt on every failed
  // Dex save would be four taps a round for something nobody declines.
  'ring-evasion': {
    id: 'ring-evasion', name: 'Ring of Evasion', trigger: 'free',
    uses: { count: 3, per: 'encounter' },
  },
  'war-mage-2': { id: 'war-mage-2', name: 'Wand of the War Mage +2', trigger: 'passive' },
  'brooch-shielding': { id: 'brooch-shielding', name: 'Brooch of Shielding', trigger: 'passive' },
  'bracers-archery': { id: 'bracers-archery', name: 'Bracers of Archery', trigger: 'passive' },
  'boots-winterlands': { id: 'boots-winterlands', name: 'Boots of the Winterlands', trigger: 'passive' },
  'gloves-thievery': { id: 'gloves-thievery', name: 'Gloves of Thievery', trigger: 'passive' },
  // Monster passives — consulted by the rules via featureIds (see attack.ts and
  // movement.ts), no apply hook needed.
  // Long-Limbed (Bugbear): 10-ft melee reach — read in resolveAttack/canAttackWith.
  'long-limbed': { id: 'long-limbed', name: 'Long-Limbed', trigger: 'passive' },
  // Brute (Bugbear): +1 weapon damage die on a melee hit — read in resolveAttack.
  brute: { id: 'brute', name: 'Brute', trigger: 'passive' },
  // Rampage (Gnoll/Giant Hyena): a bonus melee attack after a melee kill.
  rampage: { id: 'rampage', name: 'Rampage', trigger: 'passive' },
  // Charge (Boar): extra weapon die after moving 15+ ft — read in resolveAttack.
  charge: { id: 'charge', name: 'Charge', trigger: 'passive' },
  // Burrow / Earth Glide: ignore difficult terrain — read in movement.ts.
  burrow: { id: 'burrow', name: 'Burrow', trigger: 'passive' },
  'earth-glide': { id: 'earth-glide', name: 'Earth Glide', trigger: 'passive' },
  // Fire Form (Fire Elemental): melee attackers take fire damage — resolveAttack.
  'fire-form': { id: 'fire-form', name: 'Fire Form', trigger: 'passive' },
  // Magic Resistance (Satyr/Unicorn): advantage on saves vs spells — saves.ts.
  'magic-resistance': { id: 'magic-resistance', name: 'Magic Resistance', trigger: 'passive' },
  // Horn Charge (Unicorn): extra weapon die after moving 15+ ft — resolveAttack.
  'unicorn-charge': { id: 'unicorn-charge', name: 'Horn Charge', trigger: 'passive' },
  // Trampling Charge (Gorgon): charge + knock prone on a failed Str save.
  'trampling-charge': { id: 'trampling-charge', name: 'Trampling Charge', trigger: 'passive' },

  // Whelm (Water Elemental): each adjacent enemy makes a Strength save or is
  // restrained (save ends).
  whelm: {
    id: 'whelm', name: 'Whelm', trigger: 'action', uses: { count: 1, per: 'encounter' },
    apply({ state, actorId }) {
      const me = state.combatants[actorId]!;
      const dc = 8 + proficiencyBonus(me.level) + abilityMod(me.abilities.str);
      const events: GameEvent[] = [];
      for (const t of Object.values(state.combatants)) {
        if (!t.alive || t.hp <= 0 || t.team === me.team) continue;
        if (distanceFeet(me.position, t.position) > 5) continue;
        if (t.conditions.some((c) => c.id === 'restrained')) continue;
        const { success, event } = savingThrow(state, t.id, 'str', dc);
        events.push(event);
        if (!success) {
          t.conditions.push({ id: 'restrained', sourceId: actorId, repeatSave: { ability: 'str', dc } });
          events.push({ type: 'conditionApplied', combatantId: t.id, condition: 'restrained', sourceId: actorId });
        }
      }
      return events;
    },
  },
  // Engulf (Gelatinous Cube): the cube flows over an adjacent creature — a
  // Dexterity save or be swallowed, taking acid immediately and again at the
  // start of each of the cube's turns until it squirms free (the tick lives in
  // startTurn, off the cube's holdDamage).
  //
  // Two departures from the SRD, both deliberate. The book's version happens by
  // moving *through* an occupied square, which this engine has no rule for and
  // should not grow one for a single monster; here it is simply an action taken
  // while adjacent. And engulfed is modeled as `restrained` rather than a new
  // condition — the cube does not carry you around, but it does hold you in
  // place while it digests you, and that is the part the fight is about.
  //
  // No use limit: a cube that engulfs once and then politely stops is not a
  // cube. The Dex save (repeated, save-ends) is the pressure valve instead.
  engulf: {
    id: 'engulf', name: 'Engulf', trigger: 'action',
    apply({ state, actorId }) {
      const me = state.combatants[actorId]!;
      const dc = 8 + proficiencyBonus(me.level) + abilityMod(me.abilities.str);
      const target = Object.values(state.combatants)
        .filter((c) => c.alive && c.hp > 0 && c.team !== me.team &&
          distanceFeet(me.position, c.position) <= 5 &&
          !c.conditions.some((k) => k.id === 'restrained'))
        .sort((a, b) => a.hp - b.hp)[0];
      if (!target) return [];
      const { success, event } = savingThrow(state, target.id, 'dex', dc);
      const events: GameEvent[] = [event];
      if (!success) {
        target.conditions.push({ id: 'restrained', sourceId: actorId, repeatSave: { ability: 'str', dc } });
        events.push({ type: 'conditionApplied', combatantId: target.id, condition: 'restrained', sourceId: actorId });
        const dmg = rollDice(state.rng, '3d6');
        state.rng = dmg.state;
        events.push(...applyDamage(state, target.id, actorId, dmg.total, 'acid', dmg.rolls));
      }
      return events;
    },
  },
  // Whirlwind (Air Elemental): each adjacent enemy makes a Strength save,
  // taking 3d8 bludgeoning and a 10-ft shove on a failure (half, no push, on a
  // success).
  whirlwind: {
    id: 'whirlwind', name: 'Whirlwind', trigger: 'action', uses: { count: 1, per: 'encounter' },
    apply({ state, actorId }) {
      const me = state.combatants[actorId]!;
      const dc = 8 + proficiencyBonus(me.level) + abilityMod(me.abilities.str);
      const events: GameEvent[] = [];
      for (const t of Object.values(state.combatants)) {
        if (!t.alive || t.hp <= 0 || t.team === me.team) continue;
        if (distanceFeet(me.position, t.position) > 5) continue;
        const { success, event } = savingThrow(state, t.id, 'str', dc);
        events.push(event);
        const dmg = rollDice(state.rng, '3d8');
        state.rng = dmg.state;
        const amount = saveForHalf(t, 'str', dmg.total, success);
        events.push(...applyDamage(state, t.id, actorId, amount, 'bludgeoning', dmg.rolls));
        if (!success && state.combatants[t.id]!.alive) {
          const dir = {
            x: Math.sign(t.position.x - me.position.x),
            y: Math.sign(t.position.y - me.position.y),
          };
          if (dir.x !== 0 || dir.y !== 0) events.push(...pushCreature(state, t.id, dir, 2));
        }
        if (state.winner) break;
      }
      return events;
    },
  },
  // Fey Invisibility (Sprite/Green Hag): vanish, gaining the benefits of being
  // hidden until the creature attacks.
  'fey-invisibility': {
    id: 'fey-invisibility', name: 'Fey Invisibility', trigger: 'action', uses: { count: 1, per: 'encounter' },
    apply({ state, actorId }) {
      const me = state.combatants[actorId]!;
      if (me.conditions.some((c) => c.id === 'hidden')) return [];
      me.conditions.push({ id: 'hidden', sourceId: actorId });
      return [{ type: 'conditionApplied', combatantId: actorId, condition: 'hidden', sourceId: actorId }];
    },
  },
  // Fey Charm (Dryad): the nearest enemy within 30 ft makes a Wisdom save or is
  // charmed out of the fight.
  'fey-charm': {
    id: 'fey-charm', name: 'Fey Charm', trigger: 'action', uses: { count: 1, per: 'encounter' },
    apply: charmNearestApply,
  },
  // The succubus's Charm is the same mechanic under a name that fits a fiend
  // -- a stat block shouldn't tell the player it used "Fey Charm".
  charm: {
    id: 'charm', name: 'Charm', trigger: 'action', uses: { count: 1, per: 'encounter' },
    apply: charmNearestApply,
  },
  // Luring Song (Harpy): every enemy within 30 ft that fails a Wisdom save is
  // charmed out of the fight.
  'luring-song': {
    id: 'luring-song', name: 'Luring Song', trigger: 'action', uses: { count: 1, per: 'encounter' },
    apply({ state, actorId }) {
      const me = state.combatants[actorId]!;
      const dc = 8 + proficiencyBonus(me.level) + abilityMod(me.abilities.cha);
      const events: GameEvent[] = [];
      const foes = Object.values(state.combatants).filter(
        (c) => c.alive && c.hp > 0 && c.team !== me.team &&
          distanceFeet(me.position, c.position) <= 30,
      );
      for (const t of foes) {
        const { success, event } = savingThrow(state, t.id, 'wis', dc);
        events.push(event);
        // The harpy's song is this game's other charm; the same ward stops it.
        if (!success && !charmWarded(state, t) && !t.conditions.some((k) => k.id === 'lured')) {
          if (immuneToCharmAndFear(t)) continue;
          t.conditions.push({ id: 'lured', sourceId: me.id, repeatSave: { ability: 'wis', dc } });
          events.push({ type: 'conditionApplied', combatantId: t.id, condition: 'lured', sourceId: me.id });
        }
      }
      return events;
    },
  },
  // Petrifying Breath (Gorgon): each enemy within 15 ft makes a Constitution
  // save or begins to turn to stone — modeled as restrained (save ends), the
  // engine's closest analogue to petrification.
  'petrifying-breath': {
    id: 'petrifying-breath', name: 'Petrifying Breath', trigger: 'action', uses: { count: 1, per: 'encounter' },
    apply({ state, actorId }) {
      const me = state.combatants[actorId]!;
      const dc = 8 + proficiencyBonus(me.level) + abilityMod(me.abilities.con);
      const events: GameEvent[] = [];
      for (const t of Object.values(state.combatants)) {
        if (!t.alive || t.hp <= 0 || t.team === me.team) continue;
        if (distanceFeet(me.position, t.position) > 15) continue;
        if (t.conditions.some((c) => c.id === 'restrained')) continue;
        const { success, event } = savingThrow(state, t.id, 'con', dc);
        events.push(event);
        if (!success) {
          t.conditions.push({ id: 'restrained', sourceId: actorId, repeatSave: { ability: 'con', dc } });
          events.push({ type: 'conditionApplied', combatantId: t.id, condition: 'restrained', sourceId: actorId });
        }
      }
      return events;
    },
  },
  // Consume Life (Will-o'-Wisp): a bonus-action life drain on the nearest
  // adjacent living enemy — a Constitution save halves 3d8 necrotic, and the
  // wisp regains hit points equal to the damage dealt. The SRD version only
  // finishes creatures already at 0 HP; that's toothless here, where downed
  // heroes never die, so this drains the living instead, keeping the "feed to
  // heal itself" identity that makes the wisp dangerous in a drawn-out fight.
  'consume-life': {
    id: 'consume-life', name: 'Consume Life', trigger: 'bonus', uses: { count: 1, per: 'encounter' },
    apply({ state, actorId }) {
      const me = state.combatants[actorId]!;
      const dc = 8 + proficiencyBonus(me.level) + abilityMod(me.abilities.con);
      const target = Object.values(state.combatants)
        .filter((c) => c.alive && c.hp > 0 && c.team !== me.team && distanceFeet(me.position, c.position) <= 5)
        .sort((a, b) => distanceFeet(me.position, a.position) - distanceFeet(me.position, b.position))[0];
      if (!target) return [];
      const { success, event } = savingThrow(state, target.id, 'con', dc);
      const events: GameEvent[] = [event];
      const roll = rollDice(state.rng, '3d8');
      state.rng = roll.state;
      const dealt = saveForHalf(target, 'con', roll.total, success);
      events.push(...applyDamage(state, target.id, actorId, dealt, 'necrotic', roll.rolls));
      // Drain what it dealt back into itself (capped by the target's real loss
      // and the wisp's own maximum, both handled by applyHealing).
      if (dealt > 0) events.push(...applyHealing(state, actorId, actorId, dealt));
      return events;
    },
  },
  // Dreadful Glare (Mummy): an action that fixes a baleful stare on the nearest
  // enemy within 60 ft — a Wisdom save or be frightened (save ends). A badly
  // failed save (by 5 or more) locks them rigid with terror instead: paralyzed
  // (save ends), the SRD escalation that makes the mummy a genuine threat.
  'dreadful-glare': {
    id: 'dreadful-glare', name: 'Dreadful Glare', trigger: 'action', uses: { count: 1, per: 'encounter' },
    apply({ state, actorId }) {
      const me = state.combatants[actorId]!;
      const dc = 8 + proficiencyBonus(me.level) + abilityMod(me.abilities.cha);
      const target = Object.values(state.combatants)
        .filter((c) => c.alive && c.hp > 0 && c.team !== me.team &&
          distanceFeet(me.position, c.position) <= 60 &&
          !c.conditions.some((k) => k.id === 'frightened' || k.id === 'paralyzed'))
        .sort((a, b) => distanceFeet(me.position, a.position) - distanceFeet(me.position, b.position))[0];
      if (!target) return [];
      const { success, event } = savingThrow(state, target.id, 'wis', dc);
      const events: GameEvent[] = [event];
      if (!success) {
        // Failing by 5 or more escalates fright to full paralysis.
        const bigFail = event.type === 'savingThrow' && event.total <= dc - 5;
        const condition = bigFail ? 'paralyzed' : 'frightened';
        target.conditions.push({ id: condition, sourceId: actorId, repeatSave: { ability: 'wis', dc } });
        events.push({ type: 'conditionApplied', combatantId: target.id, condition, sourceId: actorId });
      }
      return events;
    },
  },

  /**
   * Wild Shape (2024): a bonus action to wear a beast's stat block, and a
   * bonus action to step back out of it. Two uses a fight.
   *
   * The 2024 version keeps your hit points, Hit Point Dice and mental
   * abilities, and hands you temporary hit points equal to your druid level.
   * That is the whole reason this is tractable: there is one hit point pool,
   * not two, so nothing has to reconcile them when the shape drops. What the
   * beast replaces is AC, speed, Strength/Dexterity/Constitution, what you are
   * holding, and the traits that come with the body.
   *
   * You keep your class features and lose the ability to cast (enforced in
   * actions.ts). Reverting costs a use of nothing -- only assuming a shape
   * spends one -- which is why this manages its own pool.
   */
  'wild-shape': {
    id: 'wild-shape', name: 'Wild Shape', trigger: 'bonus',
    uses: { count: 2, per: 'shortRest' }, manualUses: true,
    apply({ state, actorId }) {
      const me = state.combatants[actorId]!;
      if (me.wildShape) return revertWildShape(me);

      const pool = me.featureUses['wild-shape'];
      if (!pool || pool.current <= 0) return [];
      const choice = WILD_SHAPE_FORMS.find((f) => f.minLevel <= me.level);
      const beast = choice ? MONSTERS[choice.monsterId] : undefined;
      if (!beast) return [];
      pool.current -= 1;

      me.wildShape = {
        formId: beast.id,
        original: {
          ...(me.acOverride !== undefined ? { acOverride: me.acOverride } : {}),
          speed: me.speed,
          abilities: { ...me.abilities },
          equipped: { ...me.equipped },
          inventory: me.inventory.map((it) => ({ ...it })),
          featureIds: [...me.featureIds],
          attacksPerAction: me.attacksPerAction,
        },
      };
      me.acOverride = beast.ac;
      me.speed = beast.speed;
      me.abilities = {
        ...me.abilities,
        str: beast.abilities.str, dex: beast.abilities.dex, con: beast.abilities.con,
      };
      // The body comes with its weapons and whatever it can do with them, laid
      // out exactly as buildMonster lays a monster out: first weapon in hand,
      // the rest reachable with the free interaction.
      me.equipped = { mainHand: beast.weaponIds[0]! };
      me.inventory = beast.weaponIds.slice(1).map((w) => ({ itemId: w, qty: 1 }));
      me.attacksPerAction = beast.attacksPerAction ?? 1;
      me.featureIds = [...me.featureIds, ...(beast.featureIds ?? [])];
      // Temporary hit points equal to druid level, and they do not stack.
      me.tempHp = Math.max(me.tempHp ?? 0, me.level);

      return [{ type: 'wildShaped', combatantId: actorId, formId: beast.id, tempHp: me.tempHp }];
    },
  },
  /**
   * Bardic Inspiration: a bonus action handing one ally a d6 to spend on their
   * next attack roll or saving throw. The pool is the bard's Charisma modifier
   * and it is shared with Cutting Words -- the bard's whole resource is "how
   * many dice do I have left, and do I spend them helping or hindering".
   *
   * The SRD die is a d6 usable on any d20 test within the hour. Here it is
   * attack rolls and saves, because those are the d20 tests a fight contains;
   * an ability check on the battle grid does not exist.
   */
  'bardic-inspiration': {
    id: 'bardic-inspiration', name: 'Bardic Inspiration', trigger: 'bonus',
    uses: { count: 'charismaMod', per: 'longRest' },
    apply({ state, actorId }) {
      const me = state.combatants[actorId]!;
      // The ally most likely to use it: whoever is in the fight and has not
      // already been handed a die.
      const target = Object.values(state.combatants)
        .filter((c) => c.alive && c.hp > 0 && c.team === me.team && c.id !== actorId &&
          distanceFeet(me.position, c.position) <= 60 &&
          !c.conditions.some((k) => k.id === 'inspiring'))
        .sort((a, b) => distanceFeet(me.position, a.position) - distanceFeet(me.position, b.position))[0];
      if (!target) return [];
      target.conditions.push({ id: 'inspiring', sourceId: actorId });
      return [{ type: 'conditionApplied', combatantId: target.id, condition: 'inspiring', sourceId: actorId }];
    },
  },
  /**
   * Cutting Words (College of Lore): a passive marker. The subtraction itself
   * happens inside resolveAttack, because it is a reaction to someone else's
   * roll and there is no turn on which the bard could declare it -- the same
   * shape as the Shield spell's auto-cast.
   */
  'cutting-words': { id: 'cutting-words', name: 'Cutting Words', trigger: 'passive' },
  /** Jack of All Trades: half proficiency on skills you lack. Read by
   *  skillBonus; nothing on the battle grid consults it. */
  'jack-of-all-trades': { id: 'jack-of-all-trades', name: 'Jack of All Trades', trigger: 'passive' },
  /** Expertise: double proficiency on the bard's two class skills. Also
   *  skillBonus only. */
  expertise: { id: 'expertise', name: 'Expertise', trigger: 'passive' },
  // Horrifying Visage (Banshee): the banshee's ruined face, seen by every enemy
  // within 60 ft — a Wisdom save or be frightened (save ends).
  'horrifying-visage': {
    id: 'horrifying-visage', name: 'Horrifying Visage', trigger: 'action', uses: { count: 1, per: 'encounter' },
    apply({ state, actorId }) {
      const me = state.combatants[actorId]!;
      const dc = 8 + proficiencyBonus(me.level) + abilityMod(me.abilities.cha);
      const events: GameEvent[] = [];
      for (const t of Object.values(state.combatants)) {
        if (!t.alive || t.hp <= 0 || t.team === me.team) continue;
        if (distanceFeet(me.position, t.position) > 60) continue;
        if (t.conditions.some((k) => k.id === 'frightened')) continue;
        const { success, event } = savingThrow(state, t.id, 'wis', dc);
        events.push(event);
        if (!success) {
          if (immuneToCharmAndFear(t)) continue;
          t.conditions.push({ id: 'frightened', sourceId: actorId, repeatSave: { ability: 'wis', dc } });
          events.push({ type: 'conditionApplied', combatantId: t.id, condition: 'frightened', sourceId: actorId });
        }
      }
      return events;
    },
  },
  // Wail (Banshee, once per encounter): a keening scream that stops hearts.
  // Every living enemy within 30 ft makes a Constitution save or drops to 0 hit
  // points outright; a success costs 3d6 psychic instead. Constructs and undead
  // have no life to take and are unaffected.
  //
  // The drop is applied directly rather than as damage, because that is what the
  // ability says — psychic resistance must not halve it, and temporary hit
  // points must not soak it. Heroes go down (they never die here); a monster
  // caught in it dies, which needs the win check kill() would normally run.
  wail: {
    id: 'wail', name: 'Wail', trigger: 'action', uses: { count: 1, per: 'encounter' },
    apply({ state, actorId }) {
      const me = state.combatants[actorId]!;
      const dc = 8 + proficiencyBonus(me.level) + abilityMod(me.abilities.cha);
      const events: GameEvent[] = [];
      for (const t of Object.values(state.combatants)) {
        if (!t.alive || t.hp <= 0 || t.team === me.team) continue;
        if (t.creatureType === 'construct' || t.creatureType === 'undead') continue;
        if (distanceFeet(me.position, t.position) > 30) continue;
        const { success, event } = savingThrow(state, t.id, 'con', dc);
        events.push(event);
        if (success) {
          const roll = rollDice(state.rng, '3d6');
          events.push(...applyDamage(state, t.id, actorId, roll.total, 'psychic', roll.rolls));
        } else if (t.unconsciousAtZero) {
          events.push(...dropToZero(state, t.id));
        } else {
          events.push(...kill(state, t.id));
        }
      }
      return events;
    },
  },
  // Chromatic wyrmling breath weapons (Recharge 5–6). Shape/element/save/dice
  // come from BREATH_WEAPONS; the DC is the dragon's Constitution. Auto-aimed at
  // the direction catching the most foes, since a monster ability picks no cell.
  'breath-acid':      { id: 'breath-acid',      name: 'Acid Breath',      trigger: 'action', recharge: 5, apply: breathApply('breath-acid') },
  'breath-lightning': { id: 'breath-lightning', name: 'Lightning Breath', trigger: 'action', recharge: 5, apply: breathApply('breath-lightning') },
  'breath-poison':    { id: 'breath-poison',    name: 'Poison Breath',    trigger: 'action', recharge: 5, apply: breathApply('breath-poison') },
  'breath-fire':      { id: 'breath-fire',      name: 'Fire Breath',      trigger: 'action', recharge: 5, apply: breathApply('breath-fire') },
  'breath-cold':      { id: 'breath-cold',      name: 'Cold Breath',      trigger: 'action', recharge: 5, apply: breathApply('breath-cold') },
  'breath-acid-young':      { id: 'breath-acid-young',      name: 'Acid Breath',      trigger: 'action', recharge: 5, apply: breathApply('breath-acid-young') },
  'breath-lightning-young': { id: 'breath-lightning-young', name: 'Lightning Breath', trigger: 'action', recharge: 5, apply: breathApply('breath-lightning-young') },
  'breath-poison-young':    { id: 'breath-poison-young',    name: 'Poison Breath',    trigger: 'action', recharge: 5, apply: breathApply('breath-poison-young') },
  'breath-fire-young':      { id: 'breath-fire-young',      name: 'Fire Breath',      trigger: 'action', recharge: 5, apply: breathApply('breath-fire-young') },
  'breath-cold-young':      { id: 'breath-cold-young',      name: 'Cold Breath',      trigger: 'action', recharge: 5, apply: breathApply('breath-cold-young') },
  'breath-fire-chimera':    { id: 'breath-fire-chimera',    name: 'Fire Breath',      trigger: 'action', recharge: 5, apply: breathApply('breath-fire-chimera') },
  'breath-fire-hound':      { id: 'breath-fire-hound',      name: 'Fire Breath',      trigger: 'action', recharge: 5, apply: breathApply('breath-fire-hound') },
  'breath-mephit-fire':     { id: 'breath-mephit-fire',     name: 'Fire Breath',      trigger: 'action', recharge: 6, apply: breathApply('breath-mephit-fire') },
  'breath-mephit-cold':     { id: 'breath-mephit-cold',     name: 'Frost Breath',     trigger: 'action', recharge: 6, apply: breathApply('breath-mephit-cold') },
  // Colossus Slayer (Ranger, Hunter): once per turn, +1d8 on a hit against a
  // target below its HP max. Existence alone is the feature — the rider and
  // the once-per-turn gate live in resolveAttack, next to Sneak Attack.
  'colossus-slayer': { id: 'colossus-slayer', name: "Hunter's Prey: Colossus Slayer", trigger: 'passive' },
  'lay-on-hands': {
    id: 'lay-on-hands', name: 'Lay on Hands', trigger: 'action',
    uses: { count: 'fiveTimesLevel', per: 'longRest' },
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
    uses: { count: 1, per: 'shortRest' },
    apply({ state, actorId }) {
      const c = state.combatants[actorId]!;
      c.conditions.push({ id: 'sacredWeapon', sourceId: actorId });
      return [{ type: 'conditionApplied', combatantId: actorId, condition: 'sacredWeapon', sourceId: actorId }];
    },
  },
  // --- barbarian -----------------------------------------------------------
  /**
   * Rage: the class, in one bonus action.
   *
   * Three riders, all read elsewhere off the `raging` condition rather than
   * applied here — bonus melee damage (attack.ts), half damage from blades,
   * arrows and clubs (attack.ts), and advantage on Strength saves (saves.ts).
   * The condition is the whole state, so nothing has to be unwound.
   *
   * NO DURATION. RAW a rage ends after ten minutes, or early if the barbarian
   * neither attacks nor takes damage on their turn. Ten minutes is every fight
   * this game has ever run, and the lapse clause fires when a barbarian spends
   * a round doing nothing — which, given the class has no other use for its
   * action, does not happen. Building turn-tracking for a rule that cannot
   * trigger would be machinery pretending to be fidelity.
   *
   * `longRest` is what makes the count mean anything: rage lasts the whole
   * fight, so a per-encounter pool would refill before it was ever empty and
   * the number would be decoration. It is the day that rations this.
   */
  rage: {
    id: 'rage', name: 'Rage', trigger: 'bonus',
    uses: { count: 'proficiency', per: 'longRest' },
    apply({ state, actorId }) {
      const c = state.combatants[actorId]!;
      if (c.conditions.some((k) => k.id === 'raging')) return [];
      c.conditions.push({ id: 'raging', sourceId: actorId });
      return [{ type: 'conditionApplied', combatantId: actorId, condition: 'raging', sourceId: actorId }];
    },
  },
  /**
   * Unarmored Defense — read by `acOf`, not applied here.
   *
   * Passive rather than a grant on the class, because it is conditional on
   * wearing no armour and the AC function is the only place that can know.
   */
  'unarmored-defense': {
    id: 'unarmored-defense', name: 'Unarmored Defense', trigger: 'passive',
  },
  /**
   * Reckless Attack: swing wide open.
   *
   * Free rather than an action — it costs nothing but the risk, which is the
   * decision. Its own condition rather than reusing `outlined`: outlined is
   * set by Faerie Fire and by the ranger's mark, it does not grant the bearer
   * anything, and the attack log names its reasons, so conflating them would
   * make the log say "faerie fire" about a barbarian nobody has lit up.
   *
   * Lasts until the start of the barbarian's next turn (`turn.ts` sweeps it),
   * which is what makes it a real gamble rather than a free upgrade: the
   * advantage is spent this turn, and the whole enemy team swings back at it.
   */
  'reckless-attack': {
    id: 'reckless-attack', name: 'Reckless Attack', trigger: 'free',
    apply({ state, actorId }) {
      const c = state.combatants[actorId]!;
      if (c.conditions.some((k) => k.id === 'reckless')) return [];
      c.conditions.push({ id: 'reckless', sourceId: actorId });
      return [{ type: 'conditionApplied', combatantId: actorId, condition: 'reckless', sourceId: actorId }];
    },
  },
  /** Danger Sense: advantage on Dexterity saves — read by `savingThrow`. */
  'danger-sense': {
    id: 'danger-sense', name: 'Danger Sense', trigger: 'passive',
    saveAdvantage: ['dex'],
  },
  /** Fast Movement: +10 ft of speed, folded in by the builder. */
  'fast-movement': {
    id: 'fast-movement', name: 'Fast Movement', trigger: 'passive',
  },
  /**
   * Berserker's Frenzy: one extra melee attack while raging, as a bonus action.
   *
   * The SRD version costs a level of exhaustion, which this game does not
   * model — so the cost here is the bonus action itself, which is the same
   * thing a barbarian would otherwise spend on Rage. Read by the attack rules
   * as an extra-attack grant rather than applied, so it composes with the
   * level-5 Extra Attack instead of racing it.
   */
  frenzy: {
    id: 'frenzy', name: 'Frenzy', trigger: 'passive',
  },
  /** Mindless Rage: can't be charmed or frightened while raging. */
  'mindless-rage': {
    id: 'mindless-rage', name: 'Mindless Rage', trigger: 'passive',
  },
  /** Feral Instinct: advantage on initiative rolls. */
  'feral-instinct': {
    id: 'feral-instinct', name: 'Feral Instinct', trigger: 'passive',
  },
  /**
   * Arcane Recovery, and the druid's Natural Recovery, which are the same rule.
   *
   * On a short rest, recover spell slots totalling half your level rounded up,
   * nothing above 5th level. Once between long rests.
   *
   * Both are `passive` and neither has an `apply`: this happens in camp, on a
   * rest, not on a turn — `shortRest` in campaign.ts reads them. What they DO
   * carry is a `longRest` pool of one, which is exactly the "once per long
   * rest" clause and needed no new mechanism at all now that pools have clocks.
   * Before the rest-scoping, a once-per-day feature had nowhere to live.
   *
   * Why the wizard needed this and the fighter did not: every other class's
   * short-rest resource came back at the arena's lunch break, and the caster's
   * did not. A wizard who spent their slots in the morning fight was a
   * crossbow with a book for the rest of the day.
   */
  'arcane-recovery': {
    id: 'arcane-recovery', name: 'Arcane Recovery', trigger: 'passive',
    uses: { count: 1, per: 'longRest' },
  },
  'natural-recovery': {
    id: 'natural-recovery', name: 'Natural Recovery', trigger: 'passive',
    uses: { count: 1, per: 'longRest' },
  },

  // --- sorcerer ---------------------------------------------------------------
  /**
   * Font of Magic: the sorcery-point pool itself.
   *
   * `passive` with a pool and no `apply` — there is nothing to press. The pool
   * IS the feature, and everything that spends it (currently one Metamagic
   * option) reads it by id. `count: 'level'` is the SRD's own table: a
   * 5th-level sorcerer has five points.
   *
   * `longRest`, so a sorcerer is the second class in the game whose budget is
   * the DAY rather than the fight. That is the design of the class and it is
   * also what makes the arena's two-fights-a-day shape mean something for it:
   * points spent winning the morning are points not available at lunch, and
   * the short rest does not give them back.
   *
   * Deliberately NOT convertible to spell slots yet. The SRD's exchange rate is
   * the sorcerer's most powerful lever and the one most likely to distort a
   * measurement, and it is a separate decision from Metamagic — this ships the
   * pool and one thing to spend it on, so the next measurement has a baseline.
   */
  'font-of-magic': {
    id: 'font-of-magic', name: 'Font of Magic', trigger: 'passive',
    uses: { count: 'level', per: 'longRest' },
  },
  /**
   * Metamagic (Quickened Spell).
   *
   * A marker, not a button: holding this feature is what makes
   * `metamagic: 'quickened'` a legal field on a cast. The rule lives in
   * engine/rules/metamagic.ts because it changes the timing of an action, which
   * is engine business, not a `FeatureData.apply` hook — an `apply` runs on its
   * own and cannot reach inside somebody else's cast.
   *
   * One option rather than the SRD's two, on purpose: Quickened is the one
   * whose value the existing scorer can already read (a second spell is worth
   * what that spell is worth). Empowered and Heightened both need a price for
   * something nothing in this codebase currently computes, and inventing one
   * before it is measured is how the last six modifiers got mispriced.
   */
  'metamagic-quickened': {
    id: 'metamagic-quickened', name: 'Metamagic: Quickened Spell', trigger: 'passive',
  },
  'metamagic-heightened': {
    id: 'metamagic-heightened', name: 'Metamagic: Heightened Spell', trigger: 'passive',
  },
  /**
   * Draconic Resilience (Draconic Sorcery, level 3): scales instead of armour,
   * and a hit point per level.
   *
   * Passive and hookless — the AC lives in `acOf` and the hit points in the
   * builder, which are the two places that could act on it. What it does for
   * the class is stop the d6 caster from being the thing every monster runs at
   * first: 10 + Dex + Cha at level 8 is AC 17, which is plate.
   */
  'draconic-resilience': {
    id: 'draconic-resilience', name: 'Draconic Resilience', trigger: 'passive',
  },
  /**
   * Draconic Spells (level 3 and 5): always prepared, off the sorcerer's list.
   *
   * Of the SRD's eight, this game has two — Command at 3 and Fear at 5. Alter
   * Self, Chromatic Orb, Dragon's Breath, Fly, Arcane Eye and Charm Monster
   * are all unimplemented, and inventing them to fill the table out would be
   * four new spells hiding inside a subclass change. Fear is on the sorcerer's
   * own list anyway, so what this actually buys is Command four levels early.
   */
  'draconic-spells': {
    id: 'draconic-spells', name: 'Draconic Spells', trigger: 'passive',
  },

  // --- monk -----------------------------------------------------------------
  /**
   * Martial Arts: the monk fights with its hands, on Dexterity, and gets a
   * second swing for free.
   *
   * The Dexterity half needed nothing new — the unarmed strike is a `finesse`
   * weapon and `attackAbility` already takes the better of Strength and
   * Dexterity, which for a monk is always Dexterity. The growing die is read in
   * `resolveAttack`, exactly as Shillelagh's is, because a die that scales with
   * its wielder cannot sit on the weapon.
   *
   * The free bonus-action strike is the class's rhythm and is offered through
   * the same path as the barbarian's Frenzy: a bonus-action attack with the
   * weapon in hand, which for a monk is a fist.
   */
  'martial-arts': {
    id: 'martial-arts', name: 'Martial Arts', trigger: 'passive',
  },
  /** Unarmored Defense: 10 + Dex + Wis, read by `acOf`. */
  'monk-defense': {
    id: 'monk-defense', name: 'Unarmored Defense', trigger: 'passive',
  },
  /**
   * Monk's Focus: the pool everything else spends.
   *
   * One point per level, back on a short rest — which is a clock that did not
   * exist until feature pools got them, and the reason the monk could not have
   * been built before now. `count: 'level'` is its own kind because this is the
   * only resource in the game that tracks the character one-for-one.
   *
   * The pool lives on this feature and the three techniques spend it, rather
   * than each carrying its own: they are three things to do with one budget,
   * and that budget being shared is the decision the class is made of.
   */
  'monks-focus': {
    id: 'monks-focus', name: "Monk's Focus", trigger: 'passive',
    uses: { count: 'level', per: 'shortRest' },
  },
  /**
   * Flurry of Blows: a focus point for two more unarmed strikes.
   *
   * Auto-targets the adjacent enemy it can hurt most, rather than asking. The
   * feature system has no targeted-activation path, and inventing one for this
   * would be a lot of machinery for a button whose answer is almost always "the
   * thing I am already punching".
   */
  'flurry-of-blows': {
    id: 'flurry-of-blows', name: 'Flurry of Blows', trigger: 'bonus',
    manualUses: true,
    apply({ state, actorId }) {
      const me = state.combatants[actorId]!;
      const target = bestAdjacentFoe(state, me);
      if (!target || !spendFocus(me)) return [];
      const events: GameEvent[] = [];
      for (let i = 0; i < 2 && state.combatants[target.id]?.alive; i++) {
        const before = state.combatants[target.id]!.hp;
        events.push(...resolveAttack(state, actorId, target.id, 'unarmed-strike', {}));
        // Open Hand Technique: a Flurry strike that lands puts them on the
        // floor. Read off the hit rather than passed down, so the technique is
        // a property of the monk rather than of the attack rules.
        const t = state.combatants[target.id]!;
        if (me.featureIds.includes('open-hand-technique') && t.alive && t.hp < before &&
            !t.conditions.some((k) => k.id === 'prone')) {
          t.conditions.push({ id: 'prone', sourceId: actorId });
          events.push({ type: 'conditionApplied', combatantId: t.id, condition: 'prone', sourceId: actorId });
        }
      }
      return events;
    },
  },
  /** Patient Defense: a focus point to Dodge as a bonus action. */
  'patient-defense': {
    id: 'patient-defense', name: 'Patient Defense', trigger: 'bonus',
    manualUses: true,
    apply({ state, actorId }) {
      const me = state.combatants[actorId]!;
      if (me.conditions.some((k) => k.id === 'dodging') || !spendFocus(me)) return [];
      me.conditions.push({ id: 'dodging', sourceId: actorId });
      return [{ type: 'conditionApplied', combatantId: actorId, condition: 'dodging', sourceId: actorId }];
    },
  },
  /** Step of the Wind: a focus point to Disengage AND Dash as a bonus action. */
  'step-of-the-wind': {
    id: 'step-of-the-wind', name: 'Step of the Wind', trigger: 'bonus',
    manualUses: true,
    apply({ state, actorId }) {
      const me = state.combatants[actorId]!;
      if (me.turn.disengaged || !spendFocus(me)) return [];
      me.turn.disengaged = true;
      me.turn.movementMax += me.speed;   // Dash
      return [];
    },
  },
  /**
   * Stunning Strike: a focus point to take an enemy's turn away.
   *
   * RAW this rides on a hit you have already landed, which needs a "you hit —
   * spend now?" interrupt the turn loop does not have. Here it is a bonus
   * action against an adjacent enemy, save or stunned until the end of its next
   * turn. The cost, the resource and the effect are the SRD's; what moved is
   * when you decide, and deciding before rather than after is if anything the
   * harder call.
   */
  'stunning-strike': {
    id: 'stunning-strike', name: 'Stunning Strike', trigger: 'bonus',
    manualUses: true,
    apply({ state, actorId }) {
      const me = state.combatants[actorId]!;
      const target = bestAdjacentFoe(state, me);
      if (!target) return [];
      const dc = 8 + proficiencyBonus(me.level) + abilityMod(me.abilities.wis);
      if (!spendFocus(me)) return [];
      const save = savingThrow(state, target.id, 'con', dc);
      const events: GameEvent[] = [save.event];
      if (!save.success) {
        // Until the end of its NEXT turn, so a stun taken before its turn costs
        // it that turn — which is the whole point of spending a point on it.
        target.conditions.push({ id: 'stunned', sourceId: actorId, expiresAtRound: state.round + 1 });
        events.push({ type: 'conditionApplied', combatantId: target.id, condition: 'stunned', sourceId: actorId });
      }
      return events;
    },
  },
  /**
   * Deflect Attacks: catch the blow.
   *
   * A reaction that halves an incoming melee hit — read in `applyDamage`, since
   * that is the only place that sees the number before it lands. RAW reduces by
   * 1d10 + Dex + level, which at these levels is most of a hit; halving is the
   * same idea with a shape that cannot accidentally heal.
   */
  'deflect-attacks': {
    id: 'deflect-attacks', name: 'Deflect Attacks', trigger: 'passive',
  },
  /** Empowered Strikes: the monk's fists count as magical. */
  'empowered-strikes': {
    id: 'empowered-strikes', name: 'Empowered Strikes', trigger: 'passive',
  },
  /**
   * Open Hand Technique: a Flurry hit knocks the target down.
   *
   * The SRD offers three riders and lets you pick per strike. Prone is the one
   * with something to say on a grid — it costs the target half its movement to
   * stand and hands every melee ally advantage — where "push 15 feet" and "no
   * reactions" mostly do not change where anyone stands.
   */
  'open-hand-technique': {
    id: 'open-hand-technique', name: 'Open Hand Technique', trigger: 'passive',
  },
  /**
   * Magical Discoveries (Bard 6): two spells from outside the bard's list.
   *
   * The College of Lore's level-6 feature, and the bard had nothing at 6 at
   * all — which in a game that stops at 7 is a whole tier of the class missing.
   * Playtesting found it as "the bard falls off", and it did.
   *
   * Passive with no `apply`, because the mechanism already existed:
   * `spellsByLevel` is a table of "what this class can have at what level", and
   * two off-list spells written at level 6 are exactly that. Spiritual Weapon
   * and Fireball — a bonus-action damage engine that does not need
   * concentration, and the one spell everybody knows — chosen because between
   * them they answer the two things a level-6 bard cannot otherwise do:
   * contribute damage every round, and clear a crowd.
   *
   * They land in the preparable pool, so the existing spell tray offers them
   * like any other. No new selection interface, because there is already one.
   */
  'magical-discoveries': {
    id: 'magical-discoveries', name: 'Magical Discoveries', trigger: 'passive',
  }
};
