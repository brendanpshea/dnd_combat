/**
 * Spell data. Per the spec, `cast` is the one place code lives inside data:
 * each spell is a small hook over engine helpers, never a branch in the engine.
 *
 * Targeting declarations drive legalActions and CLI prompts:
 * - enemy/ally/any: pick combatant(s) within range (feet; 0 = touch/adjacent)
 * - sphere2x2: pick an anchor cell for the 2x2 template
 * - cone: pick one of 8 directions (encoded as an adjacent cell position)
 */
import type { GameState, Combatant, Id, Ability, Position, CreatureType, ConditionId, DamageType } from '../engine/types.js';
import { abilityMod, proficiencyBonus, cellAt, isDown, ignoresHalfCover, wardedAgainstMagicalBinding } from '../engine/types.js';
import { rollD20, rollDice, resolveRollMode, parseDice } from '../engine/dice.js';
import { blocksMovement, adjacent, distanceFeet, sphere2x2, sphere5x5, cone15, cube15, line15, DIRECTIONS, Direction8, hasLineOfSight, webCell, coverBetween } from '../engine/grid.js';
import { isHidden } from '../engine/rules/hide.js';
import { applyDamage, collectAttackSources, consumeFamiliarHelp, resolveAttack, canAttackWith, charmAway, tryAutoShield, breakConcentration } from '../engine/rules/attack.js';
import { applyLucky } from '../engine/rules/luck.js';
import { attackableWeapons } from '../engine/rules/equipment.js';
import { BREATH_WEAPONS } from './features.js';
import { pushCreature } from '../engine/rules/movement.js';
import { savingThrow as rawSavingThrow, saveForHalf, immuneToCharmAndFear } from '../engine/rules/saves.js';

// Every saving throw a spell forces is a save against magic, so Magic
// Resistance (Satyr, Unicorn) grants advantage here without each spell needing
// to opt in.
function savingThrow(state: GameState, combatantId: Id, ability: Ability, dc: number) {
  return rawSavingThrow(state, combatantId, ability, dc, { magical: true });
}
import { applyHealing } from '../engine/rules/heal.js';
import type { GameEvent } from '../engine/events.js';
import { acOf, ARMOR, isShield } from './armor.js';
import { WEAPONS, weaponCategory } from './weapons.js';

export type SpellTargeting =
  | {
      kind: 'creature'; range: number; who: 'enemy' | 'ally' | 'any'; count: number;
      /** Restrict to one SRD creature type (Animal Friendship: beasts only). */
      /** Restrict to one creature type (Animal Friendship: beasts). */
      creatureType?: CreatureType;
      /**
       * Restrict to a set of creature types. Command and Suggestion talk a
       * target into doing something, so they need a mind and ears -- but not
       * specifically a humanoid one. They were gated to `humanoid` as a
       * shorthand for that, which broke the moment goblinoids became fey in
       * the 2024 rules and left the game's most common low-level enemy immune
       * to both spells. Neither is type-restricted in 2024 anyway; this lists
       * what can actually be talked to.
       */
      creatureTypes?: CreatureType[];
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
  | {
      kind: 'self';
      /**
       * Offer this even with nobody nearby.
       *
       * `self` covers two different things: a burst centred on the caster
       * (offered only when it would touch someone) and a buff on the caster
       * (Shillelagh, Ensnaring Strike), which is cast *before* closing and by a
       * ranger from sixty feet. Without this the buffs were never offered at
       * all — legalActions gated every `self` spell on an enemy within 5 ft, so
       * a druid could hold Shillelagh all run and never be given the option.
       */
      anyTime?: boolean;
    };

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
  /**
   * Known and preparable, but never offered as a combat action — Guidance,
   * whose only effect (a +1d4 to an ability check) applies to the campaign's
   * shop skill checks, not to anything on the battle grid. legalActions skips
   * it the same way it skips reaction spells.
   */
  outOfCombat?: boolean;
  /**
   * This spell gets stronger in a bigger slot, so it is worth offering at every
   * slot the caster can afford rather than only at its own level.
   *
   * Declared rather than inferred, because the scaling lives inside `cast` where
   * nothing else can see it — and because the flag is exactly the judgement
   * call: a menu entry only earns its place if picking it changes something.
   * Smites had this behaviour hard-coded in legalActions from the start; the
   * fourteen spells below were written with slot scaling that had never once
   * been reachable, because nothing ever offered them a higher slot. A 7th-level
   * caster's 4th-level slot is unspendable without this.
   */
  upcast?: boolean;
  /**
   * A ritual: always available to a caster whose class grants it, without
   * occupying one of their "known spells" slots — Find Familiar. The builder
   * folds known rituals onto the combatant like cantrips, and they're excluded
   * from the choosable/countable leveled pool.
   */
  ritual?: boolean;
  cast(ctx: CastContext): GameEvent[];
}

// --- shared helpers --------------------------------------------------------

function spellMod(state: GameState, casterId: Id): number {
  const c = state.combatants[casterId]!;
  return abilityMod(c.abilities[c.spellcastingAbility ?? 'int']);
}

/**
 * Which element is actually pointed at this creature right now — the type
 * Protection from Energy should ward against.
 *
 * Breath weapons count double: a wyrmling's cone is the single biggest hit the
 * spell can halve, and it is the reason anyone casts it. Otherwise the weapon
 * riders of the living enemies decide. Fire is the fallback, because it is the
 * commonest element in the bestiary and a wasted 3rd-level slot is a worse
 * outcome than a slightly wrong guess.
 */
const WARDABLE: DamageType[] = ['acid', 'cold', 'fire', 'lightning', 'thunder'];

export function threateningElement(state: GameState, target: Combatant): DamageType {
  const weight = new Map<DamageType, number>();
  const add = (t: DamageType | undefined, n: number) => {
    if (t && WARDABLE.includes(t)) weight.set(t, (weight.get(t) ?? 0) + n);
  };
  for (const c of Object.values(state.combatants)) {
    if (!c.alive || isDown(c) || c.team === target.team) continue;
    for (const fid of c.featureIds) add(BREATH_WEAPONS[fid]?.damageType, 10);
    for (const wid of attackableWeapons(c)) {
      add(WEAPONS[wid]?.damageType, 1);
      add(WEAPONS[wid]?.extraDamage?.type, 1);
    }
    add(c.deathBurst?.type, 2);
    add(c.holdDamage?.type, 2);
  }
  let best: DamageType = 'fire';
  let bestN = 0;
  for (const t of WARDABLE) {
    const n = weight.get(t) ?? 0;
    if (n > bestN) { bestN = n; best = t; }
  }
  return best;
}

/** Is this creature wearing or wielding enough metal for Heat Metal to bite?
 *  Reads the armour catalogue's own `metal` flag and the monster stat-block
 *  equivalent, so no spell has to keep its own list of what counts. */
export function wearsMetal(c: Combatant): boolean {
  const armor = c.equipped.armor !== undefined ? ARMOR[c.equipped.armor] : undefined;
  if (armor?.metal) return true;
  if (isShield(c.equipped.offHand)) return true;
  // A metal weapon in hand counts too: the SRD lets you heat a sword as
  // happily as a breastplate.
  //
  // "Has a metal edge" is *not* the same as "deals slashing or piercing" — a
  // wolf's bite and a gargoyle's claws both do, and neither is made of metal.
  // The real test is whether it is a manufactured weapon at all, which
  // weaponCategory answers: natural weapons belong to no category. Then the
  // damage type separates the swords and axes from the clubs and staves.
  const id = c.equipped.mainHand;
  const w = id ? WEAPONS[id] : undefined;
  if (!w || weaponCategory(id!) === undefined) return false;
  return METAL_WEAPON_TYPES.includes(w.damageType);
}

/** Among manufactured weapons, the slashing and piercing ones have a metal
 *  business end; clubs, quarterstaves and slings do not. */
const METAL_WEAPON_TYPES: DamageType[] = ['slashing', 'piercing'];

/**
 * One bolt from a held storm cloud: everything in the 2x2 patch makes a
 * Dexterity save, taking the cloud's dice, half on a success.
 */
export function strikeLightning(state: GameState, casterId: Id, anchor: Position): GameEvent[] {
  const caster = state.combatants[casterId]!;
  const storm = caster.stormCloud;
  if (!storm) return [];
  const events: GameEvent[] = [];
  const hit = new Set<Id>();
  for (const pos of sphere2x2(anchor)) {
    const tid = cellAt(state.grid, pos)?.occupantId;
    if (!tid || hit.has(tid)) continue;
    const t = state.combatants[tid]!;
    if (!t.alive || isDown(t) || t.team === caster.team) continue;
    hit.add(tid);
    const save = savingThrow(state, tid, 'dex', storm.dc);
    events.push(save.event);
    const dmg = rollDice(state.rng, storm.dice);
    state.rng = dmg.state;
    const amount = saveForHalf(state.combatants[tid]!, 'dex', dmg.total, save.success);
    if (amount > 0) events.push(...applyDamage(state, tid, casterId, amount, 'lightning', dmg.rolls));
  }
  events.unshift({ type: 'lightningStruck', casterId, cells: sphere2x2(anchor) });
  return events;
}

/**
 * Can this creature be put to sleep at all?
 *
 * 2024: "creatures that don't sleep, such as elves, or that have Immunity to
 * the Exhaustion condition automatically succeed". There is no condition
 * immunity list in this engine, so the rule is read off creature type — undead
 * and constructs are the things that carry Exhaustion immunity, and they are
 * also the things nobody expects to fall asleep. A skeleton dozing off is the
 * kind of thing that makes a rule system feel broken.
 *
 * Not cosmetic: undead and constructs are 19% of every body the arena fields,
 * so Sleep was landing on about one enemy in five that should have shrugged it
 * off, and it is the most-cast spell in the game by a factor of three.
 */
export function canBePutToSleep(c: Combatant): boolean {
  if (c.featureIds.includes('trance')) return false;          // elves
  return c.creatureType !== 'undead' && c.creatureType !== 'construct';
}

/**
 * Burn everything hostile standing in a caster's moonbeam. Called on the cast
 * and again from startTurn for whoever begins a turn in it.
 */
export function burnInMoonbeam(state: GameState, casterId: Id, onlyId?: Id): GameEvent[] {
  const caster = state.combatants[casterId]!;
  const beam = caster.moonbeam;
  if (!beam) return [];
  const events: GameEvent[] = [];
  const hit = new Set<Id>();
  for (const pos of sphere2x2(beam.position)) {
    const tid = cellAt(state.grid, pos)?.occupantId;
    if (!tid || hit.has(tid)) continue;
    if (onlyId !== undefined && tid !== onlyId) continue;
    const t = state.combatants[tid]!;
    if (!t.alive || isDown(t) || t.team === caster.team) continue;
    hit.add(tid);
    const save = savingThrow(state, tid, 'con', beam.dc);
    events.push(save.event);
    const dmg = rollDice(state.rng, beam.dice);
    state.rng = dmg.state;
    const amount = saveForHalf(state.combatants[tid]!, 'con', dmg.total, save.success);
    if (amount > 0) events.push(...applyDamage(state, tid, casterId, amount, 'radiant', dmg.rolls));
  }
  return events;
}

/**
 * Wand of the War Mage: +1 or +2 to spell attack rolls. Deliberately NOT added
 * to the save DC — the SRD gives the wand attack rolls only, and a caster
 * throwing Fireballs should get nothing from it.
 */
function warMageBonus(c: Combatant): number {
  if (c.featureIds.includes('war-mage-2')) return 2;
  if (c.featureIds.includes('war-mage-1')) return 1;
  return 0;
}

export function spellDc(state: GameState, casterId: Id): number {
  const c = state.combatants[casterId]!;
  return 8 + proficiencyBonus(c.level) + spellMod(state, casterId);
}

/**
 * Hold a smite ready. The slot is spent now and the next melee hit discharges
 * it (see `dischargeSmite` in engine/rules/attack.ts). The `smiting` condition
 * carries none of the data — it exists so the board shows a badge and the
 * player can see the swing is loaded.
 */
function armSmite({ state, casterId, slotLevel }: CastContext, spellId: Id): GameEvent[] {
  const c = state.combatants[casterId]!;
  c.armedSmite = { spellId, slotLevel };
  // Shining Smite and Ensnaring Strike hold their effect with Concentration
  // (Divine Smite and Searing Smite do not). Taking it when the smite is armed
  // is what makes arming one a real choice rather than a free rider.
  if (SPELLS[spellId]?.concentration) c.concentratingOn = { spellId, targetIds: [] };
  if (c.conditions.some((k) => k.id === 'smiting')) return [];
  c.conditions.push({ id: 'smiting', sourceId: casterId });
  return [{ type: 'conditionApplied', combatantId: casterId, condition: 'smiting', sourceId: casterId }];
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

/**
 * Enhanced Cantrip (Evoker, level 3): a simplified model of the 2024 Evocation
 * line — the evoker adds its Intelligence modifier to the damage of its
 * damaging cantrips. Returns 0 for casters without the feature.
 */
function enhancedCantripBonus(state: GameState, casterId: Id): number {
  const c = state.combatants[casterId]!;
  // Potent Spellcasting (Cleric 7 Blessed Strikes, Druid 7 Elemental Fury) is
  // the same rule off a different ability, so it rides the same helper — and
  // rides it wherever the evoker's bonus is already read, which is every
  // damaging cantrip rather than a list somebody has to remember to extend.
  if (c.featureIds.includes('potent-spellcasting')) {
    return Math.max(0, abilityMod(c.abilities[c.spellcastingAbility ?? 'wis']));
  }
  if (!c.featureIds.includes('enhanced-cantrip')) return 0;
  return Math.max(0, abilityMod(c.abilities.int));
}

/** Spell attack roll: shares the adv/dis machinery with weapon attacks. */
function spellAttack(
  state: GameState,
  casterId: Id,
  targetId: Id,
  opts: { melee: boolean; extraAdv?: string[]; via?: string },
): { hit: boolean; crit: boolean; event: GameEvent } {
  const caster = state.combatants[casterId]!;
  const target = state.combatants[targetId]!;
  // Reuse the weapon source collector with a synthetic profile.
  const fake = { melee: opts.melee, range: opts.melee ? undefined : { normal: 9999, long: 9999 }, properties: [] };
  const { adv, dis } = collectAttackSources(state, caster, target, fake as never, opts.melee);
  const warMage = warMageBonus(caster);
  adv.push(...(opts.extraAdv ?? []));
  const mode = resolveRollMode(adv, dis);
  const d20 = applyLucky(state, casterId, rollD20(state.rng, mode), mode);
  state.rng = d20.state;
  consumeFamiliarHelp(state, caster);
  let total = d20.natural + spellMod(state, casterId) + proficiencyBonus(caster.level) + warMage;
  if (caster.conditions.some((c) => c.id === 'blessed')) {
    const d4 = rollDice(state.rng, '1d4');
    state.rng = d4.state;
    total += d4.total;
  }
  if (caster.conditions.some((c) => c.id === 'baned')) {
    const d4 = rollDice(state.rng, '1d4');
    state.rng = d4.state;
    total -= d4.total;
  }
  const unconsciousAdjacent =
    target.conditions.some((c) => c.id === 'unconscious') && opts.melee;
  const crit = d20.natural === 20 || unconsciousAdjacent;
  /**
   * Half cover applies to a ranged spell attack exactly as it does to an arrow.
   * It did not, until now: a Fire Bolt across a barricade was unpenalised while
   * a shortbow shot at the same target took +2 AC, so the one piece of terrain
   * built to shape ranged fire was shaping only half of it.
   *
   * The size gate is the same one weapon attacks use — a barricade is chest
   * high, so it covers a kobold and not an ogre.
   *
   * Wand of the War Mage is the exception the SRD writes into the item: "you
   * ignore Half Cover when making a spell attack roll".
   */
  const behindCover = !opts.melee &&
    warMage === 0 &&
    !ignoresHalfCover(target.size ?? 'medium') &&
    coverBetween(state.grid, caster.position, target.position);
  const targetAc = acOf(target) + (behindCover ? 2 : 0);
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
      // Same flag a weapon attack sets, so the log can say why the AC was two
      // points higher rather than leaving the player to guess.
      ...(behindCover ? { cover: true } : {}),
      ...(opts.via ? { via: opts.via } : {}),
    },
  };
}

// --- Summons: AI-driven conjurations ---------------------------------------
// A Spiritual Weapon hammer or a Flaming Sphere is a *thing on the board*: it
// has a position, a token, and a will of its own. At the start of its caster's
// turn (activateSummons, called from startTurn) it chases the caster's nearest
// enemy and strikes — the caster spends nothing after the initial cast. They
// are not combatants: no HP, no AC, untargetable, and they never occupy a cell.

type Summon = NonNullable<Combatant['summons']>[number];

const SUMMON_SPECS: Record<Summon['kind'], { moveCells: number; spectral: boolean }> = {
  // 20-ft glide; spectral — passes through walls and creatures alike.
  'spiritual-weapon': { moveCells: 4, spectral: true },
  // 30-ft roll; a physical ball of fire — walls stop it.
  'flaming-sphere': { moveCells: 6, spectral: false },
};

/** The caster's nearest living enemy, measured from the summon (id tiebreak). */
function summonPrey(state: GameState, casterTeam: string, from: Position): Combatant | undefined {
  return Object.values(state.combatants)
    .filter((c) => c.alive && !isDown(c) && c.team !== casterTeam)
    .sort((a, b) =>
      distanceFeet(from, a.position) - distanceFeet(from, b.position) || a.id.localeCompare(b.id))[0];
}

/** One step of the chase: prefer the diagonal toward the prey, fall back to
 *  either axis. A spectral summon ignores walls and creatures; a physical one
 *  needs an unoccupied, non-wall cell. Returns null when boxed in. */
function summonStep(state: GameState, s: Summon, toward: Position): Position | null {
  const dx = Math.sign(toward.x - s.position.x);
  const dy = Math.sign(toward.y - s.position.y);
  const candidates: Position[] = [
    { x: s.position.x + dx, y: s.position.y + dy },
    { x: s.position.x + dx, y: s.position.y },
    { x: s.position.x, y: s.position.y + dy },
  ];
  const spectral = SUMMON_SPECS[s.kind].spectral;
  for (const p of candidates) {
    if (p.x === s.position.x && p.y === s.position.y) continue;
    const cell = cellAt(state.grid, p);
    if (!cell) continue;
    if (!spectral && (blocksMovement(cell.terrain) || cell.occupantId)) continue;
    if (spectral && cell.occupantId) continue; // may pass walls, but not stand on someone
    return p;
  }
  return null;
}

/** The summon's strike, shared by cast (an immediate hit if placed well) and
 *  the start-of-turn activation. Attacks/damage are attributed to the caster. */
function summonStrike(state: GameState, casterId: Id, s: Summon): GameEvent[] {
  const caster = state.combatants[casterId]!;
  const prey = summonPrey(state, caster.team, s.position);
  if (!prey || !adjacent(s.position, prey.position)) return [];
  const events: GameEvent[] = [];
  // `via` re-labels the log ("Elaine's Spiritual Weapon attacks…" rather than
  // "Elaine attacks…") and tells the board which summon token to flash. The
  // mechanics are unchanged: it is still the caster's spell attack and the
  // caster's save DC.
  if (s.kind === 'spiritual-weapon') {
    // A melee spell attack: 1d8 + spell mod force.
    const atk = spellAttack(state, casterId, prey.id, { melee: true, via: s.kind });
    events.push(atk.event);
    if (atk.hit) {
      const dmg = rollDice(state.rng, '1d8', atk.crit);
      state.rng = dmg.state;
      events.push(...applyDamage(state, prey.id, casterId, dmg.total + spellMod(state, casterId), 'force', dmg.rolls, { via: s.kind }));
    }
  } else {
    // The sphere rams: 2d6 fire, Dexterity save for half.
    const save = savingThrow(state, prey.id, 'dex', spellDc(state, casterId));
    events.push(save.event);
    const dmg = rollDice(state.rng, '2d6');
    state.rng = dmg.state;
    const amount = saveForHalf(state.combatants[prey.id]!, 'dex', dmg.total, save.success);
    if (amount > 0) events.push(...applyDamage(state, prey.id, casterId, amount, 'fire', dmg.rolls, { via: s.kind }));
  }
  return events;
}

/** Place (or re-place — one of each kind per caster) a summon on the board,
 *  striking immediately if it lands beside an enemy. */
function placeSummon(state: GameState, casterId: Id, s: Summon): GameEvent[] {
  const caster = state.combatants[casterId]!;
  caster.summons = [...(caster.summons ?? []).filter((x) => x.kind !== s.kind), s];
  return [
    { type: 'summonPlaced', casterId, kind: s.kind, position: { ...s.position } },
    ...summonStrike(state, casterId, s),
  ];
}

/**
 * Run the caster's summons at the start of their turn: expire what's out of
 * time, then each survivor glides toward the nearest enemy and strikes if it
 * reaches one. Called from startTurn for the combatant whose turn begins.
 */
export function activateSummons(state: GameState, casterId: Id): GameEvent[] {
  const caster = state.combatants[casterId];
  if (!caster?.summons?.length) return [];
  const events: GameEvent[] = [];
  const expired = caster.summons.filter((s) => s.expiresAtRound !== undefined && state.round > s.expiresAtRound);
  for (const s of expired) {
    events.push({ type: 'summonExpired', casterId, kind: s.kind, position: { ...s.position } });
  }
  caster.summons = caster.summons.filter((s) => !expired.includes(s));

  for (const s of caster.summons) {
    const prey = summonPrey(state, caster.team, s.position);
    if (!prey) continue;
    const from = { ...s.position };
    for (let i = 0; i < SUMMON_SPECS[s.kind].moveCells; i++) {
      if (adjacent(s.position, prey.position)) break;
      const next = summonStep(state, s, prey.position);
      if (!next) break;
      s.position = next;
    }
    if (s.position.x !== from.x || s.position.y !== from.y) {
      events.push({ type: 'summonMoved', casterId, kind: s.kind, from, to: { ...s.position } });
    }
    events.push(...summonStrike(state, casterId, s));
  }
  return events;
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

/**
 * Creature types that can be talked into something -- the target set for
 * Command and Suggestion. Excludes the mindless (constructs, oozes), the
 * unhearing dead, and creatures with no language to be commanded in.
 */
const PERSUADABLE: CreatureType[] = [
  'humanoid', 'fey', 'fiend', 'giant', 'dragon', 'monstrosity', 'aberration', 'elemental',
];

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
        events.push(...applyDamage(state, targetId, casterId, dmg.total + enhancedCantripBonus(state, casterId), 'fire', dmg.rolls));
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
      // 2024: no advantage vs metal armor (that 2014 rider was removed).
      const atk = spellAttack(state, casterId, targetId, { melee: true });
      const events: GameEvent[] = [atk.event];
      if (atk.hit) {
        const dmg = rollDice(state.rng, cantripDice('1d8', state.combatants[casterId]!.level), atk.crit);
        state.rng = dmg.state;
        events.push(...applyDamage(state, targetId, casterId, dmg.total + enhancedCantripBonus(state, casterId), 'lightning', dmg.rolls));
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
      // 2024: Poison Spray is a ranged spell attack (not a Con save).
      const atk = spellAttack(state, casterId, targetId, { melee: false });
      const events: GameEvent[] = [atk.event];
      if (atk.hit) {
        const dmg = rollDice(state.rng, cantripDice('1d12', state.combatants[casterId]!.level), atk.crit);
        state.rng = dmg.state;
        events.push(...applyDamage(state, targetId, casterId, dmg.total + enhancedCantripBonus(state, casterId), 'poison', dmg.rolls));
      }
      return events;
    },
  },

  /**
   * Starry Wisp: a mote of light, as a ranged spell attack. On a hit it lights
   * the target up — which is exactly `outlined`, the marker Faerie Fire and
   * Shining Smite already use: attacks against it have advantage and it cannot
   * benefit from being unseen.
   *
   * The SRD wording is "emits Dim Light ... and can't benefit from the Invisible
   * condition" until the end of the caster's next turn. There is no light level
   * in this engine, so the half that has teeth — you cannot hide, and you are
   * easier to hit — is what lands.
   */
  'starry-wisp': {
    id: 'starry-wisp', name: 'Starry Wisp', level: 0, castingTime: 'action',
    targeting: { kind: 'creature', range: 60, who: 'enemy', count: 1 },
    concentration: false,
    icon: '✨',
    cast({ state, casterId, targetIds }) {
      const targetId = targetIds[0]!;
      const atk = spellAttack(state, casterId, targetId, { melee: false });
      const events: GameEvent[] = [atk.event];
      if (!atk.hit) return events;
      const dmg = rollDice(state.rng, cantripDice('1d8', state.combatants[casterId]!.level), atk.crit);
      state.rng = dmg.state;
      events.push(...applyDamage(state, targetId, casterId, dmg.total + enhancedCantripBonus(state, casterId), 'radiant', dmg.rolls));
      const t = state.combatants[targetId]!;
      if (t.alive && !isDown(t) && !t.conditions.some((k) => k.id === 'outlined')) {
        t.conditions.push({ id: 'outlined', sourceId: casterId, expiresAtRound: state.round + 1 });
        events.push({ type: 'conditionApplied', combatantId: targetId, condition: 'outlined', sourceId: casterId });
      }
      return events;
    },
  },

  /**
   * Shillelagh: the druid's staff becomes the druid's best weapon. For the
   * duration a club or quarterstaff swings on the caster's spellcasting ability
   * instead of Strength, and its die grows (d8, d10 from level 5).
   *
   * Held as a condition rather than a change to the weapon, because the weapon
   * is shared data — WEAPONS['quarterstaff'] is the same object every
   * quarterstaff in the fight reads, so editing it would arm every enemy
   * holding one. resolveAttack asks the wielder, not the stick.
   */
  shillelagh: {
    id: 'shillelagh', name: 'Shillelagh', level: 0, castingTime: 'bonus',
    targeting: { kind: 'self', anyTime: true },
    concentration: false,
    icon: '🌳',
    cast({ state, casterId }) {
      const me = state.combatants[casterId]!;
      if (me.conditions.some((k) => k.id === 'shillelagh')) return [];
      me.conditions.push({ id: 'shillelagh', sourceId: casterId });
      return [{ type: 'conditionApplied', combatantId: casterId, condition: 'shillelagh', sourceId: casterId }];
    },
  },

  
  /**
   * Vicious Mockery: the bard's attack cantrip. A Wisdom save or 1d6 psychic
   * and disadvantage on the target's next attack roll.
   *
   * `sapped` is exactly the rider — the weapon mastery already means
   * "disadvantage on your next attack roll" and clears itself when spent — so
   * the insult lands on machinery that already exists rather than a fourth way
   * of saying the same thing.
   */
  'vicious-mockery': {
    id: 'vicious-mockery', name: 'Vicious Mockery', level: 0, castingTime: 'action',
    targeting: { kind: 'creature', range: 60, who: 'enemy', count: 1 },
    concentration: false,
    icon: '🗯️',
    cast({ state, casterId, targetIds }) {
      const targetId = targetIds[0]!;
      const target = state.combatants[targetId]!;
      const { success, event } = savingThrow(state, targetId, 'wis', spellDc(state, casterId));
      const events: GameEvent[] = [event];
      if (success) return events;
      const dmg = rollDice(state.rng, cantripDice('1d6', state.combatants[casterId]!.level));
      state.rng = dmg.state;
      events.push(...applyDamage(state, targetId, casterId, dmg.total + enhancedCantripBonus(state, casterId), 'psychic', dmg.rolls));
      if (target.alive && !target.conditions.some((c) => c.id === 'sapped')) {
        target.conditions.push({ id: 'sapped', sourceId: casterId });
        events.push({ type: 'conditionApplied', combatantId: targetId, condition: 'sapped', sourceId: casterId });
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
    upcast: true,
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
        // The one damaging cantrip that was not reading the caster bonus, and the
        // cleric's only one — so Potent Spellcasting would have been wholly inert
        // for the class it was added for. Save-based rather than an attack roll,
        // which is why it was missed; the 2024 feature does not care which it is.
        events.push(...applyDamage(state, targetId, casterId, dmg.total + enhancedCantripBonus(state, casterId), 'radiant', dmg.rolls));
      }
      return events;
    },
  },

  /**
   * Guidance: a cantrip with no battle-grid effect — its +1d4 helps an ability
   * check, and the only ability checks in this game are the campaign's shop
   * skill gambits, where a party cleric already grants it (partySkillCheck).
   * It exists here so it can be shown and prepared like any other cleric
   * cantrip; `outOfCombat` keeps legalActions from ever offering it in a fight.
   */
  guidance: {
    id: 'guidance', name: 'Guidance', level: 0, castingTime: 'action',
    targeting: { kind: 'self' },
    concentration: true,
    icon: '🔮',
    outOfCombat: true,
    cast() { return []; },
  },

  'cure-wounds': {
    id: 'cure-wounds', name: 'Cure Wounds', level: 1, castingTime: 'action',
    targeting: { kind: 'creature', range: 0, who: 'ally', count: 1 },
    concentration: false,
    upcast: true,
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
    ritual: true, // always available, never occupies a known-spell slot
    // A 10-minute ritual to summon a pet, not a combat action — and the familiar
    // is already granted before a fight starts, so casting it mid-battle would
    // do nothing anyway. Keep it off the in-combat action bar entirely.
    outOfCombat: true,
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
    concentration: true,
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
        if (!t.alive || !canBePutToSleep(t)) continue;
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
      // Concentration is the *cost* half of the rule and the half that matters
      // here: holding this means not holding anything else. Sleep ends when concentration
      // does; the sleepers already get their own end-of-turn saves.
      state.combatants[casterId]!.concentratingOn = { spellId: 'sleep', targetIds: [] };
      return events;
    },
  },

  'burning-hands': {
    id: 'burning-hands', name: 'Burning Hands', level: 1, castingTime: 'action',
    targeting: { kind: 'cone15' },
    concentration: false,
    upcast: true,
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
        const amount = saveForHalf(state.combatants[tid]!, 'dex', dmg.total, save.success);
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
    upcast: true,
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
        const amount = saveForHalf(state.combatants[tid]!, 'dex', dmg.total, save.success);
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
    upcast: true,
    icon: '🩹',
    cast({ state, casterId, slotLevel, targetIds }) {
      const mod = spellMod(state, casterId);
      const heal = rollDice(state.rng, `${2 * slotLevel}d4`); // 2024: 2d4 at 1st, +2d4 per higher slot
      state.rng = heal.state;
      return applyHealing(state, targetIds[0]!, casterId, heal.total + mod);
    },
  },

  /**
   * Suggestion: a Wisdom save or the target is talked into leaving — it turns
   * and runs for the nearest edge, and is gone from the fight when it gets
   * there.
   *
   * Held by concentration, and that is the interesting part: break the
   * caster's concentration before the target reaches the edge and the
   * suggestion lapses, the creature stops where it stands and rejoins the
   * fight. So it is a removal you have to *protect*, which is a different
   * decision from one that simply happens — and it is why the flight is
   * movement across the board rather than a puff of smoke at cast time.
   */
  suggestion: {
    id: 'suggestion', name: 'Suggestion', level: 2, castingTime: 'action',
    targeting: { kind: 'creature', range: 30, who: 'enemy', count: 1, creatureTypes: PERSUADABLE },
    concentration: true,
    icon: '💭',
    cast({ state, casterId, targetIds }) {
      const targetId = targetIds[0]!;
      const save = savingThrow(state, targetId, 'wis', spellDc(state, casterId));
      const events: GameEvent[] = [save.event];
      if (!save.success) {
        // `concentration: true` on the condition is what makes it droppable:
        // breakConcentration sweeps every condition it is sustaining, so the
        // flight ends the moment the caster is hit hard enough.
        state.combatants[targetId]!.conditions.push({ id: 'fleeing', sourceId: casterId, concentration: true });
        events.push({ type: 'conditionApplied', combatantId: targetId, condition: 'fleeing', sourceId: casterId });
      }
      state.combatants[casterId]!.concentratingOn = { spellId: 'suggestion', targetIds: [targetId] };
      return events;
    },
  },

  /**
   * Command: one enemy grovels. On a failed Wisdom save it drops prone and
   * loses its next turn (the `commanded` condition, cleared at that turn's end).
   */
  command: {
    id: 'command', name: 'Command', level: 1, castingTime: 'action',
    targeting: { kind: 'creature', range: 60, who: 'enemy', count: 1, creatureTypes: PERSUADABLE },
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
   * Web: a 5x5 patch of sticky strands that *lingers* on the board while the
   * caster concentrates. Enemies caught (Dex save) are restrained — no movement,
   * disadvantage to attack, easy to hit — and get a fresh Dex save at the end of
   * each of their turns (repeatSave). The strands stay put: a creature that
   * later *walks into* the web must save too (handled in movement), so a web
   * laid across a doorway keeps working long after the cast. Dropping
   * concentration clears the strands and frees everyone still stuck.
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
      const webbed: Position[] = [];
      for (const pos of sphere5x5(positions[0]!)) {
        // Lay the strands down first (they persist on the grid, cleared when
        // concentration drops) — then catch whoever is standing in them now.
        if (!webCell(state.grid, pos, casterId, dc)) continue;
        webbed.push(pos);
        const tid = cellAt(state.grid, pos)?.occupantId;
        if (!tid) continue;
        const t = state.combatants[tid]!;
        if (!t.alive || t.team === caster.team || t.conditions.some((c) => c.id === 'restrained')) continue;
        const save = savingThrow(state, tid, 'dex', dc);
        events.push(save.event);
        if (!save.success) {
          if (wardedAgainstMagicalBinding(t, 'restrained')) continue;
          t.conditions.push({ id: 'restrained', sourceId: casterId, concentration: true, repeatSave: { ability: 'dex', dc } });
          events.push({ type: 'conditionApplied', combatantId: tid, condition: 'restrained', sourceId: casterId });
          caught.push(tid);
        }
      }
      if (webbed.length > 0) events.push({ type: 'webSpun', sourceId: casterId, cells: webbed });
      // Hold concentration even if nobody's caught yet — the web lingers and
      // catches whoever wanders in. Clearing it (breakConcentration) sweeps the
      // strands and frees the restrained by source, so targetIds needn't be exhaustive.
      caster.concentratingOn = { spellId: 'web', targetIds: caught };
      return events;
    },
  },

  /**
   * Entangle: grasping vines fill a patch of ground. A Strength save or
   * restrained, and the vines stay put — anyone who walks in afterwards rolls
   * too, and the whole patch clears when the druid's concentration drops.
   *
   * Mechanically this is Web's clinging ground with a different way out: Web
   * asks Dexterity (squeeze free of the strands), Entangle asks Strength (tear
   * the vines). That difference is the entire reason a druid would take one
   * over the other, so the *cell* carries the ability rather than the rule
   * hardcoding Dexterity.
   */
  entangle: {
    id: 'entangle', name: 'Entangle', level: 1, castingTime: 'action',
    targeting: { kind: 'sphere5x5', range: 90 },
    concentration: true,
    icon: '🌱',
    cast({ state, casterId, positions }) {
      const caster = state.combatants[casterId]!;
      const dc = spellDc(state, casterId);
      const events: GameEvent[] = [];
      const caught: Id[] = [];
      const vined: Position[] = [];
      for (const pos of sphere5x5(positions[0]!)) {
        if (!webCell(state.grid, pos, casterId, dc, { ability: 'str', kind: 'entangle' })) continue;
        vined.push(pos);
        const tid = cellAt(state.grid, pos)?.occupantId;
        if (!tid) continue;
        const t = state.combatants[tid]!;
        if (!t.alive || t.team === caster.team || t.conditions.some((c) => c.id === 'restrained')) continue;
        const save = savingThrow(state, tid, 'str', dc);
        events.push(save.event);
        if (!save.success) {
          if (wardedAgainstMagicalBinding(t, 'restrained')) continue;
          t.conditions.push({ id: 'restrained', sourceId: casterId, concentration: true, repeatSave: { ability: 'str', dc } });
          events.push({ type: 'conditionApplied', combatantId: tid, condition: 'restrained', sourceId: casterId });
          caught.push(tid);
        }
      }
      if (vined.length > 0) events.push({ type: 'webSpun', sourceId: casterId, cells: vined });
      caster.concentratingOn = { spellId: 'entangle', targetIds: caught };
      return events;
    },
  },

  /**
   * Heat Metal: the druid's answer to armour. 2d8 fire, no attack roll and no
   * save, to a creature wearing metal or swinging metal — and on a failed
   * Constitution save it fumbles, taking disadvantage on its attacks until it
   * shakes the pain off.
   *
   * "Metal" is not invented here: every armour entry already declares it (for
   * Shocking Grasp) and monsters carry `metalArmor` for the same reason. A
   * spell that only works on the right target is only interesting because the
   * data can already answer which targets those are.
   */
  'heat-metal': {
    id: 'heat-metal', name: 'Heat Metal', level: 2, castingTime: 'action',
    targeting: { kind: 'creature', range: 60, who: 'enemy', count: 1 },
    concentration: true,
    upcast: true,
    icon: '🔥',
    cast({ state, casterId, slotLevel, targetIds }) {
      const targetId = targetIds[0]!;
      const target = state.combatants[targetId]!;
      const events: GameEvent[] = [];
      if (!wearsMetal(target)) return events;   // nothing to heat
      const dice = `${2 + Math.max(0, slotLevel - 2)}d8`;
      const dmg = rollDice(state.rng, dice);
      state.rng = dmg.state;
      events.push(...applyDamage(state, targetId, casterId, dmg.total, 'fire', dmg.rolls));
      if (target.alive && !isDown(target) && !target.conditions.some((c) => c.id === 'sapped')) {
        const save = savingThrow(state, targetId, 'con', spellDc(state, casterId));
        events.push(save.event);
        if (!save.success) {
          // The SRD makes them drop the object; there is no dropped-weapon
          // state here, so the pain shows up where it would anyway — they
          // cannot grip it properly and swing badly.
          target.conditions.push({ id: 'sapped', sourceId: casterId });
          events.push({ type: 'conditionApplied', combatantId: targetId, condition: 'sapped', sourceId: casterId });
        }
      }
      state.combatants[casterId]!.concentratingOn = { spellId: 'heat-metal', targetIds: [targetId] };
      return events;
    },
  },

  /**
   * Call Lightning: a storm cloud the druid holds overhead, dropping a bolt on
   * a chosen patch of ground now and again each round it keeps concentrating.
   *
   * The repeat is what makes it worth a 3rd-level slot, and it is also the only
   * part that needed new machinery: `stormCloud` on the caster, fired from
   * startTurn the same way a summon acts. Held by concentration like everything
   * else, so breaking it ends the storm.
   */
  'call-lightning': {
    id: 'call-lightning', name: 'Call Lightning', level: 3, castingTime: 'action',
    targeting: { kind: 'sphere2x2', range: 120 },
    concentration: true,
    upcast: true,
    icon: '⚡',
    cast({ state, casterId, slotLevel, positions }) {
      const caster = state.combatants[casterId]!;
      const dice = `${3 + Math.max(0, slotLevel - 3)}d10`;
      caster.stormCloud = { dice, dc: spellDc(state, casterId) };
      caster.concentratingOn = { spellId: 'call-lightning', targetIds: [] };
      return strikeLightning(state, casterId, positions[0]!);
    },
  },

  /**
   * Moonbeam: a column of cold light that burns whatever stands in it. Everyone
   * caught takes 2d10 radiant on a failed Constitution save, half on a success
   * — on the turn it lands, and again whenever a creature starts its turn in
   * the beam.
   *
   * Like Call Lightning it covers a 2x2 patch, so it is an area effect and not
   * a single-target one: two ogres shoulder to shoulder both burn. Unlike the
   * storm cloud it stays where it was put — the beam is anchored to the ground,
   * the cloud follows the druid.
   */
  moonbeam: {
    id: 'moonbeam', name: 'Moonbeam', level: 2, castingTime: 'action',
    targeting: { kind: 'sphere2x2', range: 120 },
    concentration: true,
    upcast: true,
    icon: '🌙',
    cast({ state, casterId, slotLevel, positions }) {
      const caster = state.combatants[casterId]!;
      const dice = `${2 + Math.max(0, slotLevel - 2)}d10`;
      caster.moonbeam = { position: { ...positions[0]! }, dice, dc: spellDc(state, casterId) };
      caster.concentratingOn = { spellId: 'moonbeam', targetIds: [] };
      return burnInMoonbeam(state, casterId);
    },
  },

  /**
   * Spiritual Weapon: a spectral hammer conjured onto the board (a bonus
   * action, a 2nd-level slot). It's a summon with a mind of its own: each of
   * the caster's turns it glides up to 20 ft toward the nearest enemy —
   * through walls, it's spectral — and strikes (1d8 + spell mod force, a melee
   * spell attack), all automatic (activateSummons). Place it beside an enemy
   * and it bonks them on the way in. No concentration; ~1 minute duration.
   */
  'spiritual-weapon': {
    id: 'spiritual-weapon', name: 'Spiritual Weapon', level: 2, castingTime: 'bonus',
    targeting: { kind: 'emptyCell', range: 60 },
    concentration: true,
    icon: '🔨',
    cast({ state, casterId, positions }) {
      // Concentration in the 2024 rules, which is what stops a cleric holding
      // this and Spirit Guardians at once. breakConcentration sweeps any summon
      // whose kind matches the spell being dropped, so the weapon goes with it.
      state.combatants[casterId]!.concentratingOn = { spellId: 'spiritual-weapon', targetIds: [] };
      return placeSummon(state, casterId, {
        kind: 'spiritual-weapon',
        position: { ...positions[0]! },
        expiresAtRound: state.round + 10,
      });
    },
  },

  /**
   * Flaming Sphere: a rolling ball of fire (an action, a 2nd-level slot,
   * concentration). The same summon chassis as Spiritual Weapon: each of the
   * caster's turns it rolls up to 30 ft after the nearest enemy — it's
   * physical, so walls stop it — and rams (2d6 fire, Dexterity save for
   * half). It burns until concentration drops (breakConcentration sweeps it).
   */
  'flaming-sphere': {
    id: 'flaming-sphere', name: 'Flaming Sphere', level: 2, castingTime: 'action',
    targeting: { kind: 'emptyCell', range: 60 },
    concentration: true,
    icon: '🔥',
    cast({ state, casterId, positions }) {
      const caster = state.combatants[casterId]!;
      caster.concentratingOn = { spellId: 'flaming-sphere', targetIds: [] };
      return placeSummon(state, casterId, {
        kind: 'flaming-sphere',
        position: { ...positions[0]! },
      });
    },
  },

  /**
   * Spirit Guardians: a radiant aura around the caster. Any enemy that starts
   * its turn within 15 ft takes 3d8 radiant (Wisdom save halves) — resolved in
   * startTurn. Held by concentration; dropping it dispels the aura.
   */
  'spiritual-guardians': {
    id: 'spiritual-guardians', name: 'Spirit Guardians', level: 3, castingTime: 'action',
    targeting: { kind: 'self' },
    concentration: true,
    upcast: true,
    icon: '👼',
    cast({ state, casterId, slotLevel }) {
      const caster = state.combatants[casterId]!;
      caster.spiritualGuardians = {
        dc: spellDc(state, casterId),
        mod: spellMod(state, casterId),
        // SRD: 3d8, +1d8 per slot level above 3.
        dice: `${3 + Math.max(0, slotLevel - 3)}d8`,
      };
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
    upcast: true,
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
        const amount = saveForHalf(state.combatants[tid]!, 'dex', dmg.total, save.success);
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
        if (immuneToCharmAndFear(t)) continue;
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
      // 2024 dragonborn: the save DC is Constitution-based (not the caster's
      // spellcasting ability — a dragonborn fighter has none), and the damage
      // is 1d10, growing to 2d10 / 3d10 / 4d10 at levels 5 / 11 / 17 exactly as
      // cantripDice steps it.
      const dc = 8 + proficiencyBonus(caster.level) + abilityMod(caster.abilities.con);
      const dice = cantripDice('1d10', caster.level);
      for (const pos of cone15(caster.position, dir)) {
        const tid = cellAt(state.grid, pos)?.occupantId;
        if (!tid) continue;
        const t = state.combatants[tid]!;
        if (!t.alive || t.team === caster.team) continue;
        if (!hasLineOfSight(state.grid, caster.position, pos)) continue;
        const save = savingThrow(state, tid, 'dex', dc);
        events.push(save.event);
        const dmg = rollDice(state.rng, dice);
        state.rng = dmg.state;
        const amount = saveForHalf(state.combatants[tid]!, 'dex', dmg.total, save.success);
        if (amount > 0) events.push(...applyDamage(state, tid, casterId, amount, 'fire', dmg.rolls));
      }
      return events;
    },
  },
  'guiding-bolt': {
    id: 'guiding-bolt', name: 'Guiding Bolt', level: 1, castingTime: 'action',
    targeting: { kind: 'creature', range: 120, who: 'enemy', count: 1 },
    concentration: false,
    upcast: true,
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
    upcast: true,
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
        const amount = saveForHalf(state.combatants[t.id]!, 'con', dmg.total, save.success);
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
    targeting: { kind: 'creature', range: 30, who: 'enemy', count: 1, creatureType: 'beast' },
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
      if (!save.success && !wardedAgainstMagicalBinding(state.combatants[targetId]!, 'paralyzed')) {
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
    upcast: true,
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

  /** Ray of Frost: a ranged spell attack, cold damage, and — on a hit — the
   *  target's speed drops 10 ft until its own next turn. Reuses `slowed`
   *  exactly as the Slow weapon mastery does (see turn.ts's startTurn): no new
   *  expiry logic needed, it already clears itself on schedule. */
  'ray-of-frost': {
    id: 'ray-of-frost', name: 'Ray of Frost', level: 0, castingTime: 'action',
    targeting: { kind: 'creature', range: 60, who: 'enemy', count: 1 },
    concentration: false,
    icon: '❄️',
    cast({ state, casterId, targetIds }) {
      const targetId = targetIds[0]!;
      const atk = spellAttack(state, casterId, targetId, { melee: false });
      const events: GameEvent[] = [atk.event];
      if (atk.hit) {
        const dmg = rollDice(state.rng, cantripDice('1d8', state.combatants[casterId]!.level), atk.crit);
        state.rng = dmg.state;
        events.push(...applyDamage(state, targetId, casterId, dmg.total + enhancedCantripBonus(state, casterId), 'cold', dmg.rolls));
        const target = state.combatants[targetId]!;
        if (target.alive && !target.conditions.some((c) => c.id === 'slowed')) {
          target.conditions.push({ id: 'slowed', sourceId: casterId });
          events.push({ type: 'conditionApplied', combatantId: targetId, condition: 'slowed', sourceId: casterId });
        }
      }
      return events;
    },
  },

  /**
   * Acid Splash: a small area cantrip — simplified from the 2024 "up to two
   * creatures within 5 ft of each other" to the same sphere2x2 anchor-cell
   * template Sleep and Faerie Fire already use, rather than inventing a new
   * targeting shape for one spell. Enemies only (a caster choosing their own
   * targets would never pick an ally); a cantrip, so a successful save takes
   * no damage at all, unlike the half-on-save area spells.
   */
  'acid-splash': {
    id: 'acid-splash', name: 'Acid Splash', level: 0, castingTime: 'action',
    targeting: { kind: 'sphere2x2', range: 60 },
    concentration: false,
    icon: '🧪',
    cast({ state, casterId, positions }) {
      const caster = state.combatants[casterId]!;
      const dc = spellDc(state, casterId);
      const events: GameEvent[] = [];
      for (const pos of sphere2x2(positions[0]!)) {
        const tid = cellAt(state.grid, pos)?.occupantId;
        if (!tid) continue;
        const t = state.combatants[tid]!;
        if (!t.alive || t.team === caster.team) continue;
        const save = savingThrow(state, tid, 'dex', dc);
        events.push(save.event);
        if (!save.success) {
          const dmg = rollDice(state.rng, cantripDice('1d6', caster.level));
          state.rng = dmg.state;
          events.push(...applyDamage(state, tid, casterId, dmg.total + enhancedCantripBonus(state, casterId), 'acid', dmg.rolls));
        }
      }
      return events;
    },
  },

  /**
   * Color Spray: a cone of blinding light, Constitution save, no concentration
   * — a fixed "until your next turn" blind rather than the save-ends flavor
   * Blindness applies with the same condition id. turn.ts's startTurn tells
   * the two apart by whether the condition carries a `repeatSave`.
   */
  'color-spray': {
    id: 'color-spray', name: 'Color Spray', level: 1, castingTime: 'action',
    targeting: { kind: 'cone15' },
    concentration: false,
    icon: '🌈',
    cast({ state, casterId, positions }) {
      const caster = state.combatants[casterId]!;
      const dir = directionFromDelta(caster.position, positions[0]!);
      const dc = spellDc(state, casterId);
      const events: GameEvent[] = [];
      for (const pos of cone15(caster.position, dir)) {
        const tid = cellAt(state.grid, pos)?.occupantId;
        if (!tid) continue;
        const t = state.combatants[tid]!;
        if (!t.alive || t.team === caster.team || t.conditions.some((c) => c.id === 'blinded')) continue;
        const save = savingThrow(state, tid, 'con', dc);
        events.push(save.event);
        if (!save.success) {
          t.conditions.push({ id: 'blinded', sourceId: casterId });
          events.push({ type: 'conditionApplied', combatantId: tid, condition: 'blinded', sourceId: casterId });
        }
      }
      return events;
    },
  },

  /**
   * False Life: a defensive self-buff, temporary HP that doesn't stack (the
   * same Math.max pattern Adrenaline Rush uses). A `self` target, so — like
   * Mage Armor and Find Familiar — there's no per-target event; the spellCast
   * event alone narrates the cast.
   */
  'false-life': {
    id: 'false-life', name: 'False Life', level: 1, castingTime: 'action',
    // `anyTime`, because temporary hit points are what you put up BEFORE anyone
    // reaches you. Without it the self-targeting gate only offered this with an
    // enemy already within 5 ft, which is the one moment it is least worth a
    // whole action — and it is why the skeleton bonechanter cast it three times
    // in sixty fights. The gate is right for a smite (which arms a melee swing)
    // and for Spirit Guardians (an aura that needs someone standing in it);
    // it was never right for a ward.
    targeting: { kind: 'self', anyTime: true },
    concentration: false,
    upcast: true,
    icon: '💀',
    cast({ state, casterId, slotLevel }) {
      const c = state.combatants[casterId]!;
      const roll = rollDice(state.rng, '2d4');
      state.rng = roll.state;
      const amount = roll.total + 4 + (slotLevel - 1) * 5; // 2d4+4 at slot 1, +5 per slot above
      c.tempHp = Math.max(c.tempHp ?? 0, amount);
      return [];
    },
  },

  /**
   * Inflict Wounds: the cleric's offensive counterpart to Cure Wounds — a
   * melee spell attack (touch range, like Cure Wounds) instead of a save, so
   * a cleric has a reason to be adjacent to something worth hurting.
   */
  'inflict-wounds': {
    id: 'inflict-wounds', name: 'Inflict Wounds', level: 1, castingTime: 'action',
    targeting: { kind: 'creature', range: 0, who: 'enemy', count: 1 },
    concentration: false,
    upcast: true,
    icon: '👻',
    cast({ state, casterId, slotLevel, targetIds }) {
      const targetId = targetIds[0]!;
      const atk = spellAttack(state, casterId, targetId, { melee: true });
      const events: GameEvent[] = [atk.event];
      if (atk.hit) {
        const dmg = rollDice(state.rng, `${1 + slotLevel}d10`, atk.crit); // 2d10 at slot 1
        state.rng = dmg.state;
        events.push(...applyDamage(state, targetId, casterId, dmg.total, 'necrotic', dmg.rolls));
      }
      return events;
    },
  },

  /**
   * Blindness: a straight Constitution save, no concentration — the ghoul-
   * paralysis pattern (attack.ts's onHitSave) as a spell instead of a weapon
   * rider. Persists until the target saves at the end of its turn
   * (`repeatSave`), which is exactly what tells turn.ts not to auto-clear it
   * the way Color Spray's fixed-duration blind clears.
   */
  blindness: {
    id: 'blindness', name: 'Blindness', level: 2, castingTime: 'action',
    targeting: { kind: 'creature', range: 30, who: 'enemy', count: 1 },
    concentration: false,
    icon: '🙈',
    cast({ state, casterId, targetIds }) {
      const targetId = targetIds[0]!;
      const dc = spellDc(state, casterId);
      const save = savingThrow(state, targetId, 'con', dc);
      const events: GameEvent[] = [save.event];
      if (!save.success) {
        const t = state.combatants[targetId]!;
        t.conditions.push({ id: 'blinded', sourceId: casterId, repeatSave: { ability: 'con', dc } });
        events.push({ type: 'conditionApplied', combatantId: targetId, condition: 'blinded', sourceId: casterId });
      }
      return events;
    },
  },

  /**
   * Invisibility: grants `hidden` with no `hideCheck`, so — like a wood elf's
   * Fey Invisibility — it can't be stripped by a passive Perception beat; only
   * attacking or casting a spell ends it (endHide, called from every attack
   * and cast path already). Touch range, ally-or-self, held by concentration.
   */
  invisibility: {
    id: 'invisibility', name: 'Invisibility', level: 2, castingTime: 'action',
    targeting: { kind: 'creature', range: 0, who: 'ally', count: 1 },
    concentration: true,
    icon: '👤',
    cast({ state, casterId, targetIds }) {
      const targetId = targetIds[0]!;
      const t = state.combatants[targetId]!;
      const events: GameEvent[] = [];
      if (!t.conditions.some((c) => c.id === 'hidden')) {
        t.conditions.push({ id: 'hidden', sourceId: casterId, concentration: true });
        events.push({ type: 'conditionApplied', combatantId: targetId, condition: 'hidden', sourceId: casterId });
      }
      state.combatants[casterId]!.concentratingOn = { spellId: 'invisibility', targetIds: [targetId] };
      return events;
    },
  },

  /**
   * Lesser Restoration: touch an ally and strip one of the SRD's short list of
   * curable conditions, if they're carrying any of them — the party's first
   * answer to a save-ends lockdown that hasn't broken on its own.
   */
  'lesser-restoration': {
    id: 'lesser-restoration', name: 'Lesser Restoration', level: 2, castingTime: 'bonus',
    targeting: { kind: 'creature', range: 0, who: 'ally', count: 1 },
    concentration: false,
    icon: '💫',
    cast({ state, targetIds }) {
      const CURABLE: ConditionId[] = ['blinded', 'paralyzed', 'poisoned'];
      const targetId = targetIds[0]!;
      const t = state.combatants[targetId]!;
      const removed = t.conditions.filter((c) => CURABLE.includes(c.id));
      t.conditions = t.conditions.filter((c) => !CURABLE.includes(c.id));
      return removed.map((c) => ({ type: 'conditionRemoved' as const, combatantId: targetId, condition: c.id }));
    },
  },

  /**
   * Dispel Magic: strips every concentration-linked condition currently on
   * the target (freeing an ally from an enemy's Web/Hold Person/Fear without
   * needing to target the caster who cast it) and, if the target is itself
   * concentrating on something, ends that too (breakConcentration) — so
   * pointing it at an enemy caster ends whatever they're sustaining. One
   * spell, both classic uses, entirely off existing primitives.
   */
  'dispel-magic': {
    id: 'dispel-magic', name: 'Dispel Magic', level: 3, castingTime: 'action',
    targeting: { kind: 'creature', range: 120, who: 'any', count: 1 },
    concentration: false,
    icon: '🚫',
    cast({ state, targetIds }) {
      const targetId = targetIds[0]!;
      const t = state.combatants[targetId]!;
      const events: GameEvent[] = [];
      const held = t.conditions.filter((c) => c.concentration);
      if (held.length > 0) {
        t.conditions = t.conditions.filter((c) => !c.concentration);
        for (const c of held) events.push({ type: 'conditionRemoved', combatantId: targetId, condition: c.id });
      }
      events.push(...breakConcentration(state, targetId));
      return events;
    },
  },

  /**
   * Bane: the enemy mirror of Bless — up to 3 targets, -1d4 instead of +1d4,
   * on both attack rolls and saving throws. Unlike Bless's willing allies,
   * Bane's targets get a Charisma save to resist. `baned` rides the exact
   * same "roll a d4, apply it" hooks `blessed` already touches in
   * resolveAttack, spellAttack, and savingThrow — three symmetric additions,
   * no new mechanism.
   */
  bane: {
    id: 'bane', name: 'Bane', level: 1, castingTime: 'action',
    targeting: { kind: 'creature', range: 30, who: 'enemy', count: 3 },
    concentration: true,
    icon: '💀',
    cast({ state, casterId, targetIds }) {
      const dc = spellDc(state, casterId);
      const events: GameEvent[] = [];
      const caught: Id[] = [];
      for (const tid of new Set(targetIds)) {
        const save = savingThrow(state, tid, 'cha', dc);
        events.push(save.event);
        if (!save.success) {
          const t = state.combatants[tid]!;
          if (!t.conditions.some((c) => c.id === 'baned')) {
            t.conditions.push({ id: 'baned', sourceId: casterId, concentration: true });
            events.push({ type: 'conditionApplied', combatantId: tid, condition: 'baned', sourceId: casterId });
          }
          caught.push(tid);
        }
      }
      if (caught.length > 0) state.combatants[casterId]!.concentratingOn = { spellId: 'bane', targetIds: caught };
      return events;
    },
  },

  /**
   * Shield of Faith: a bonus-action ward, +2 AC, no save (a willing ally, like
   * Bless). `warded` is read in armor.ts's acOf the same way `shielded` (the
   * Shield spell's +5) already is — one new line there, plus the condition.
   */
  'shield-of-faith': {
    id: 'shield-of-faith', name: 'Shield of Faith', level: 1, castingTime: 'bonus',
    targeting: { kind: 'creature', range: 60, who: 'ally', count: 1 },
    concentration: true,
    icon: '🛡️',
    cast({ state, casterId, targetIds }) {
      const targetId = targetIds[0]!;
      const t = state.combatants[targetId]!;
      const events: GameEvent[] = [];
      if (!t.conditions.some((c) => c.id === 'warded')) {
        t.conditions.push({ id: 'warded', sourceId: casterId, concentration: true });
        events.push({ type: 'conditionApplied', combatantId: targetId, condition: 'warded', sourceId: casterId });
      }
      state.combatants[casterId]!.concentratingOn = { spellId: 'shield-of-faith', targetIds: [targetId] };
      return events;
    },
  },

  /**
   * Sanctuary: the best thing on the cleric's 1st-level list, and the only
   * spell here that works by changing what the *enemy* may do. An attacker
   * that fails a Wisdom save cannot bring itself to strike the warded ally at
   * all — the attack is gone, not merely worse.
   *
   * Not concentration (the SRD ends it when the warded creature attacks, which
   * resolveAttack handles), so a cleric can hold Sanctuary and Bless at once —
   * exactly the turn the spell is for.
   */
  sanctuary: {
    id: 'sanctuary', name: 'Sanctuary', level: 1, castingTime: 'bonus',
    targeting: { kind: 'creature', range: 30, who: 'ally', count: 1 },
    concentration: false,
    icon: '⛪',
    cast({ state, casterId, targetIds }) {
      const targetId = targetIds[0]!;
      const t = state.combatants[targetId]!;
      if (t.conditions.some((c) => c.id === 'sanctuary')) return [];
      t.conditions.push({ id: 'sanctuary', sourceId: casterId, dc: spellDc(state, casterId) });
      return [{ type: 'conditionApplied', combatantId: targetId, condition: 'sanctuary', sourceId: casterId }];
    },
  },

  /**
   * Protection from Evil and Good: attacks against the warded ally have
   * disadvantage — but only from aberrations, celestials, elementals, fey,
   * fiends and undead (see PROTECTED_FROM).
   *
   * The narrowness is the point. Every other ward in the game is a flat number
   * against everyone; this one is worth a slot exactly when you know what you
   * are about to fight, and worth nothing when you guess wrong. Against this
   * bestiary — wraiths, banshees, ghouls, mephits, dryads, and every goblinoid
   * now that they are fey — it is live far more often than it reads.
   */
  'protection-from-evil-and-good': {
    id: 'protection-from-evil-and-good', name: 'Protection from Evil and Good', level: 1, castingTime: 'action',
    targeting: { kind: 'creature', range: 0, who: 'ally', count: 1 },
    concentration: true,
    icon: '✝️',
    cast({ state, casterId, targetIds }) {
      const targetId = targetIds[0]!;
      const t = state.combatants[targetId]!;
      const events: GameEvent[] = [];
      if (!t.conditions.some((c) => c.id === 'protected')) {
        t.conditions.push({ id: 'protected', sourceId: casterId, concentration: true });
        events.push({ type: 'conditionApplied', combatantId: targetId, condition: 'protected', sourceId: casterId });
      }
      state.combatants[casterId]!.concentratingOn = { spellId: 'protection-from-evil-and-good', targetIds: [targetId] };
      return events;
    },
  },

  /**
   * Warding Bond: the ally gains +1 AC, +1 to saves and resistance to all
   * damage, and the cleric takes the half that the resistance sheds.
   *
   * The party's total hit points barely move; what moves is *whose* they are.
   * That makes it the only spell in the game that plays to this engine's real
   * constraint — nobody dies, so the resource that decides a fight is how the
   * party's pooled hit points are distributed across people who can still act.
   * A cleric standing behind the line can spend their own body to keep the
   * fighter upright, which is a decision no amount of healing offers.
   */
  'warding-bond': {
    id: 'warding-bond', name: 'Warding Bond', level: 2, castingTime: 'action',
    targeting: { kind: 'creature', range: 0, who: 'ally', count: 1 },
    concentration: false,
    icon: '🔗',
    cast({ state, casterId, targetIds }) {
      const targetId = targetIds[0]!;
      if (targetId === casterId) return [];
      const t = state.combatants[targetId]!;
      if (t.conditions.some((c) => c.id === 'bonded')) return [];
      t.conditions.push({ id: 'bonded', sourceId: casterId });
      return [{ type: 'conditionApplied', combatantId: targetId, condition: 'bonded', sourceId: casterId }];
    },
  },

  /**
   * Protection from Energy: resistance to one damage type for the duration.
   *
   * One departure. The SRD lets the caster name the type; there is no way to
   * ask for that here (targeting picks creatures and cells, not words), so the
   * spell reads the room instead — it wards against whichever of the five
   * elements the enemies present can actually deal, counting breath weapons
   * first because that is the hit worth halving. Falling back to fire when
   * nothing obvious threatens keeps it from ever being a dead cast.
   *
   * It is the first spell in the game that rewards knowing what you are about
   * to fight, so the auto-pick is deliberately transparent: the log names the
   * element it chose.
   */
  'protection-from-energy': {
    id: 'protection-from-energy', name: 'Protection from Energy', level: 3, castingTime: 'action',
    targeting: { kind: 'creature', range: 0, who: 'ally', count: 1 },
    concentration: true,
    icon: '🔥',
    cast({ state, casterId, targetIds }) {
      const targetId = targetIds[0]!;
      const t = state.combatants[targetId]!;
      const damageType = threateningElement(state, t);
      const events: GameEvent[] = [];
      t.conditions = t.conditions.filter((c) => c.id !== 'energyWarded');
      t.conditions.push({ id: 'energyWarded', sourceId: casterId, concentration: true, damageType });
      events.push({ type: 'conditionApplied', combatantId: targetId, condition: 'energyWarded', sourceId: casterId });
      state.combatants[casterId]!.concentratingOn = { spellId: 'protection-from-energy', targetIds: [targetId] };
      return events;
    },
  },

  /**
   * Bestow Curse: a Wisdom save or the target attacks and saves at
   * disadvantage for the duration.
   *
   * The SRD offers a menu of four effects and the caster picks one. There is
   * no way to ask, so this takes the one that is always worth casting rather
   * than the strongest — a target that misses more *and* fails more saves is
   * softened for the whole party, which is what a 3rd-level slot spent on
   * control should buy. The others (lose your action on a save, +1d8 necrotic
   * from the caster) are either a re-skinned Hold Person or a damage rider,
   * and this list already has both.
   */
  'bestow-curse': {
    id: 'bestow-curse', name: 'Bestow Curse', level: 3, castingTime: 'action',
    targeting: { kind: 'creature', range: 0, who: 'enemy', count: 1 },
    concentration: true,
    icon: '☠️',
    cast({ state, casterId, targetIds }) {
      const targetId = targetIds[0]!;
      const t = state.combatants[targetId]!;
      const { success, event } = savingThrow(state, targetId, 'wis', spellDc(state, casterId));
      const events: GameEvent[] = [event];
      if (!success && !t.conditions.some((c) => c.id === 'cursed')) {
        t.conditions.push({ id: 'cursed', sourceId: casterId, concentration: true });
        events.push({ type: 'conditionApplied', combatantId: targetId, condition: 'cursed', sourceId: casterId });
        state.combatants[casterId]!.concentratingOn = { spellId: 'bestow-curse', targetIds: [targetId] };
      }
      return events;
    },
  },

  /**
   * Haste: the headline 3rd-level buff. `hasted` is read in three places —
   * turn.ts's startTurn doubles speed, armor.ts's acOf adds +2, and
   * actions.ts's Attack-action handler banks one extra attack alongside
   * multiattack follow-ups — the same three touch points Bless/Bane/Shield of
   * Faith needed, just one condition wearing all three hats at once. No
   * lethargy-on-end penalty yet (RAW: incapacitated one turn when it lapses).
   */
  haste: {
    id: 'haste', name: 'Haste', level: 3, castingTime: 'action',
    targeting: { kind: 'creature', range: 30, who: 'ally', count: 1 },
    concentration: true,
    icon: '🐇',
    cast({ state, casterId, targetIds }) {
      const targetId = targetIds[0]!;
      const t = state.combatants[targetId]!;
      const events: GameEvent[] = [];
      if (!t.conditions.some((c) => c.id === 'hasted')) {
        t.conditions.push({ id: 'hasted', sourceId: casterId, concentration: true });
        events.push({ type: 'conditionApplied', combatantId: targetId, condition: 'hasted', sourceId: casterId });
      }
      state.combatants[casterId]!.concentratingOn = { spellId: 'haste', targetIds: [targetId] };
      return events;
    },
  },

  /**
   * Hunter's Mark: a bonus-action, concentration mark that adds 1d6 force to
   * *every* hit against the marked target, not once per turn — that's what
   * makes the bonus action and concentration worth spending. The condition is
   * shaped exactly like Guiding Bolt's `guided` or Faerie Fire's `outlined`;
   * the rider itself lives in resolveAttack, scoped to whoever cast it via
   * `sourceId`. When the quarry drops, the mark automatically leaps to the
   * caster's nearest living enemy (transferHuntersMark in attack.ts) — one
   * cast covers the whole fight, no re-casting after every kill.
   */
  /**
   * The smites. All four are bonus-action self-buffs that *arm* the next melee
   * hit rather than reacting to one, because this engine resolves an attack
   * atomically — there is nowhere to ask "smite? y/n" between the hit and the
   * damage. Arming up front is also the better game: it makes the paladin spend
   * a resource on a prediction, and it puts the choice in the spell tray where
   * the player can see slots, icons and info cards.
   *
   * Divine Smite is here too, as a spell with no rider, so choosing the slot
   * level is a real decision. It stays a *feature* as well: with the bonus
   * action free and nothing armed, `resolveAttack` still fires it automatically
   * on a crit or a kill, so a player who never opens the tray loses nothing.
   *
   * The dice and riders live in SMITE_SPECS (engine/rules/attack.ts), next to
   * the code that discharges them.
   */
  'divine-smite': {
    id: 'divine-smite', name: 'Divine Smite', level: 1, castingTime: 'bonus',
    targeting: { kind: 'self' },
    concentration: false,
    icon: '⚡',
    cast: (ctx) => armSmite(ctx, 'divine-smite'),
  },
  'searing-smite': {
    id: 'searing-smite', name: 'Searing Smite', level: 1, castingTime: 'bonus',
    targeting: { kind: 'self' },
    concentration: false,
    icon: '🔥',
    cast: (ctx) => armSmite(ctx, 'searing-smite'),
  },
  /**
   * Shining Smite (2024): 2d6 radiant and the target lights up — attacks
   * against it have advantage until the spell ends. Replaces Thunderous and
   * Wrathful Smite, which are 2014 spells absent from the SRD 5.2 paladin list.
   *
   * The party-wide advantage is what makes it the interesting smite: the other
   * two were riders the paladin enjoyed alone.
   */
  'shining-smite': {
    id: 'shining-smite', name: 'Shining Smite', level: 2, castingTime: 'bonus',
    targeting: { kind: 'self' },
    concentration: true,
    icon: '🌟',
    cast: (ctx) => armSmite(ctx, 'shining-smite'),
  },
  /**
   * Ensnaring Strike: grasping vines on the ranger's next hit — a Strength
   * save or Restrained, with 1d6 piercing a round while it holds. The strike
   * itself deals no extra damage, which is why the spec is `damageless`.
   *
   * The tick rides on the ranger's `holdDamage`, the same field the gelatinous
   * cube digests with, so it starts and stops with the restraint. One
   * difference from the SRD: it lands at the start of the *ranger's* turn
   * rather than the victim's, because that is where the engine ticks a hold.
   * Same damage per round, a few seconds earlier.
   */
  'ensnaring-strike': {
    id: 'ensnaring-strike', name: 'Ensnaring Strike', level: 1, castingTime: 'bonus',
    targeting: { kind: 'self', anyTime: true },
    concentration: true,
    icon: '🌿',
    cast: (ctx) => armSmite(ctx, 'ensnaring-strike'),
  },

  'hunters-mark': {
    id: 'hunters-mark', name: "Hunter's Mark", level: 1, castingTime: 'bonus',
    targeting: { kind: 'creature', range: 90, who: 'enemy', count: 1 },
    concentration: true,
    icon: '🎯',
    cast({ state, casterId, targetIds }) {
      const targetId = targetIds[0]!;
      const target = state.combatants[targetId]!;
      target.conditions.push({ id: 'marked', sourceId: casterId, concentration: true });
      state.combatants[casterId]!.concentratingOn = { spellId: 'hunters-mark', targetIds: [targetId] };
      return [{ type: 'conditionApplied', combatantId: targetId, condition: 'marked', sourceId: casterId }];
    },
  },

  // --- 4th level ------------------------------------------------------------
  // A 4th-level slot arrives at 7th level. Until these, the only thing to spend
  // it on was upcasting a 3rd-level spell, which works but gives the tier no
  // identity of its own. Four spells, one reachable by each full caster, chosen
  // for effects the evaluator can actually see — damage, a condition, or a
  // creature leaving the fight. A 4th-level spell the AI cannot read would be
  // the most expensive dead data in the game.
  blight: {
    id: 'blight', name: 'Blight', level: 4, castingTime: 'action',
    targeting: { kind: 'creature', range: 30, who: 'enemy', count: 1 },
    concentration: false,
    upcast: true,
    icon: '🥀',
    cast({ state, casterId, slotLevel, targetIds }) {
      const targetId = targetIds[0]!;
      const dc = spellDc(state, casterId);
      const save = savingThrow(state, targetId, 'con', dc);
      const dice = `${8 + Math.max(0, slotLevel - 4)}d8`;
      const dmg = rollDice(state.rng, dice);
      state.rng = dmg.state;
      const amount = saveForHalf(state.combatants[targetId]!, 'con', dmg.total, save.success);
      return [save.event, ...applyDamage(state, targetId, casterId, amount, 'necrotic', dmg.rolls)];
    },
  },
  'ice-storm': {
    id: 'ice-storm', name: 'Ice Storm', level: 4, castingTime: 'action',
    targeting: { kind: 'sphere5x5', range: 300 },
    concentration: false,
    upcast: true,
    icon: '🧊',
    cast({ state, casterId, slotLevel, positions }) {
      const caster = state.combatants[casterId]!;
      const sculpt = caster.featureIds.includes('sculpt-spells');
      const dc = spellDc(state, casterId);
      const events: GameEvent[] = [];
      // SRD: 2d10 Bludgeoning + 4d6 Cold, +1d10 per slot level above 4.
      const hail = `${2 + Math.max(0, slotLevel - 4)}d10`;
      for (const pos of sphere5x5(positions[0]!)) {
        const tid = cellAt(state.grid, pos)?.occupantId;
        if (tid) {
          const t = state.combatants[tid]!;
          if (t.alive && !(sculpt && t.team === caster.team)) {
            const save = savingThrow(state, tid, 'dex', dc);
            events.push(save.event);
            const bludgeon = rollDice(state.rng, hail); state.rng = bludgeon.state;
            const cold = rollDice(state.rng, '4d6'); state.rng = cold.state;
            const total = bludgeon.total + cold.total;
            const amount = saveForHalf(t, 'dex', total, save.success);
            events.push(...applyDamage(state, tid, casterId, amount, 'cold', [...bludgeon.rolls, ...cold.rolls]));
          }
        }
        // The storm leaves the ground it fell on difficult to cross — as an
        // OVERLAY, not by rewriting the terrain. Overwriting made the ice
        // permanent and ate whatever was underneath it: three casts and a third
        // of the map was difficult ground for the rest of the fight, with no
        // way back. Walls are left alone; a hazard stays a hazard.
        const cell = cellAt(state.grid, pos);
        if (cell && !blocksMovement(cell.terrain)) cell.chilled = { expiresAtRound: state.round + 1 };
      }
      return events;
    },
  },
  banishment: {
    id: 'banishment', name: 'Banishment', level: 4, castingTime: 'action',
    targeting: { kind: 'creature', range: 30, who: 'enemy', count: 1 },
    concentration: true,
    icon: '🌀',
    cast({ state, casterId, targetIds }) {
      const targetId = targetIds[0]!;
      const dc = spellDc(state, casterId);
      const save = savingThrow(state, targetId, 'cha', dc);
      if (save.success) return [save.event];
      // Out of the fight rather than dead, which is what charmAway already
      // models for Suggestion — and it takes the same care over what a
      // departing creature leaves behind (its summons, whatever it charmed).
      // The SRD returns the victim when concentration ends; a fight here is
      // shorter than the spell's minute, so it does not come back.
      // Concentration: the SRD holds the banishment with it. Taking it is the
      // cost side of the rule, and was missing — the spell was flagged
      // `concentration: true` while never actually taking any, so the flag did
      // nothing and Banishment was strictly better than the book.
      state.combatants[casterId]!.concentratingOn = { spellId: 'banishment', targetIds: [targetId] };
      return [save.event, ...charmAway(state, targetId)];
    },
  },
  'phantasmal-killer': {
    id: 'phantasmal-killer', name: 'Phantasmal Killer', level: 4, castingTime: 'action',
    targeting: { kind: 'creature', range: 120, who: 'enemy', count: 1 },
    concentration: true,
    icon: '👁️',
    cast({ state, casterId, slotLevel, targetIds }) {
      const targetId = targetIds[0]!;
      const target = state.combatants[targetId]!;
      const dc = spellDc(state, casterId);
      const save = savingThrow(state, targetId, 'wis', dc);
      const events: GameEvent[] = [save.event];
      const dmg = rollDice(state.rng, `${4 + Math.max(0, slotLevel - 4)}d10`);
      state.rng = dmg.state;
      events.push(...applyDamage(state, targetId, casterId, dmg.total, 'psychic', dmg.rolls));
      if (!save.success && target.alive && !immuneToCharmAndFear(target)) {
        target.conditions.push({
          id: 'frightened', sourceId: casterId, concentration: true,
          repeatSave: { ability: 'wis', dc },
        });
        events.push({ type: 'conditionApplied', combatantId: targetId, condition: 'frightened', sourceId: casterId });
        state.combatants[casterId]!.concentratingOn = { spellId: 'phantasmal-killer', targetIds: [targetId] };
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
  const { range, who, creatureType, creatureTypes } = spell.targeting;
  if (who === 'enemy' && t.team === caster.team) return false;
  // A downed creature can't be attacked — but healing it is the whole point.
  if (who === 'enemy' && isDown(t)) return false;
  if (who === 'ally' && t.team !== caster.team) return false;
  if (creatureType && t.creatureType !== creatureType) return false;
  if (creatureTypes && !(t.creatureType && creatureTypes.includes(t.creatureType))) return false;
  if (range === 0) {
    return targetId === casterId || adjacent(caster.position, t.position);
  }
  return (
    distanceFeet(caster.position, t.position) <= range &&
    hasLineOfSight(state.grid, caster.position, t.position)
  );
}
