/**
 * Character construction: class + species + level → Combatant.
 */
import type { Combatant, TeamId, Position, AbilityScores, Ability, Id, ResourcePool, DamageType } from '../engine/types.js';
import { abilityMod, proficiencyBonus } from '../engine/types.js';
import { CLASSES, type ChoiceGrant, type ChoicePoint } from '../data/classes.js';
import { defaultNameFor } from './names.js';
import { FEATURES } from '../data/features.js';
import { SPECIES } from '../data/species.js';
import { TRINKETS } from '../data/trinkets.js';
import { SPELLS } from '../data/spells.js';
import { ITEMS } from '../data/items.js';
import { WEAPONS } from '../data/weapons.js';
import { armorSpeedPenalty, armorClass } from '../data/armor.js';

/** Every spell a class's table grants at or below a character level, matching
 *  a predicate on the spell's own level. */
function classSpells(classId: Id, level: number, keep: (spellLevel: number) => boolean): Id[] {
  const cls = CLASSES[classId];
  if (!cls?.spellcasting) return [];
  return Object.entries(cls.spellcasting.spellsByLevel)
    .filter(([lvl]) => Number(lvl) <= level)
    .flatMap(([, ids]) => ids)
    .filter((id) => keep(SPELLS[id]?.level ?? 0));
}

/**
 * The leveled (non-cantrip, non-ritual) spells a class grants at or below a
 * level — the menu a caster's "known spells" are chosen from. Rituals (Find
 * Familiar) are excluded: they're always known and never occupy a slot.
 */
export function availableLeveledSpells(classId: Id, level: number): Id[] {
  return classSpells(classId, level, (l) => l > 0).filter((id) => !SPELLS[id]?.ritual);
}

/** Cantrips a class grants at or below a level — the menu its known cantrips
 *  are chosen from. */
export function classCantrips(classId: Id, level: number): Id[] {
  return classSpells(classId, level, (l) => l === 0);
}

/** Ritual spells a class grants at or below a level (Find Familiar): always
 *  known, never counted against the spellbook or prepared totals. */
export function classRituals(classId: Id, level: number): Id[] {
  return classSpells(classId, level, (l) => l > 0).filter((id) => SPELLS[id]?.ritual);
}

/** Read a per-level count table off the class, clamping to the last entry. */
function levelTable(table: number[] | undefined, level: number): number | undefined {
  return table ? (table[level - 1] ?? table[table.length - 1]) : undefined;
}

/** How many cantrips this caster knows at this level (default: all it's offered). */
export function cantripsKnownCount(classId: Id, level: number): number {
  return levelTable(CLASSES[classId]?.spellcasting?.cantripsKnownByLevel, level)
    ?? classCantrips(classId, level).length;
}

/** How many leveled spells a *spellbook* caster (wizard) knows at this level, or
 *  undefined for a caster that knows its whole leveled list (cleric). */
export function spellbookSize(classId: Id, level: number): number | undefined {
  return levelTable(CLASSES[classId]?.spellcasting?.spellbookByLevel, level);
}

/** How many leveled spells this caster can prepare at once (default: all it's
 *  offered — the half-caster/legacy behavior). */
export function preparedCount(classId: Id, level: number): number {
  return levelTable(CLASSES[classId]?.spellcasting?.preparedByLevel, level)
    ?? availableLeveledSpells(classId, level).length;
}

/**
 * Merge the grants of every choice point that applies at this level, taking the
 * player's pick or the point's default. This is the single fold that makes a
 * Fighting Style (or any future subclass/ancestry) real on the combatant.
 */
function resolveChoiceGrants(
  points: ChoicePoint[] | undefined,
  level: number,
  picks: Record<Id, Id> | undefined,
): Required<ChoiceGrant> {
  const merged: Required<ChoiceGrant> = { featureIds: [], spellIds: [], weaponMasteries: [], resistances: [] };
  for (const cp of points ?? []) {
    if (cp.atLevel > level) continue;
    const chosen = picks?.[cp.id] ?? cp.default;
    const opt = cp.options.find((o) => o.id === chosen) ?? cp.options.find((o) => o.id === cp.default);
    if (!opt) continue;
    merged.featureIds.push(...(opt.grants.featureIds ?? []));
    merged.spellIds.push(...(opt.grants.spellIds ?? []));
    merged.weaponMasteries.push(...(opt.grants.weaponMasteries ?? []));
    merged.resistances.push(...(opt.grants.resistances ?? []));
  }
  return merged;
}

export const STANDARD_ARRAY = [16, 16, 13, 12, 10, 8] as const;

export function assignStats(priority: readonly Ability[]): AbilityScores {
  const scores = {} as AbilityScores;
  priority.forEach((ab, i) => { scores[ab] = STANDARD_ARRAY[i]!; });
  return scores;
}

/** Average-rounded-up hit die per level after 1st (the 5e fixed value). */
function hpForLevel(hitDie: number, conMod: number, level: number): number {
  const first = hitDie + conMod;
  const perLevel = Math.ceil((hitDie + 1) / 2) + conMod;
  return first + (level - 1) * perLevel;
}

export interface BuildOptions {
  classId: Id;
  team: TeamId;
  position: Position;
  name?: string;
  portraitId?: Id;
  level?: number;
  speciesId?: Id;
  /** Campaign overrides: persisted gear instead of the class defaults. */
  inventory?: Array<{ itemId: Id; qty: number }>;
  equipped?: { mainHand: Id; offHand?: Id | 'shield'; armor?: Id; trinket?: Id; ring?: Id };
  /** Selected option per choice-point id (Fighting Style, …). Missing → default. */
  choices?: Record<Id, Id>;
  /**
   * Campaign override: remaining spell slots by level (index 0 = 1st), from
   * before a long rest. Missing entries (new slot levels from a level-up, or
   * the field itself) default to full — a level-up never strands a hero with
   * fewer slots than the table grants.
   */
  spellSlotsOverride?: number[];
  /**
   * Campaign override: exactly which leveled spells this caster has *prepared*
   * (castable), trimmed to `preparedCount`. Missing = the full class list
   * (skirmish / AI / mirror match, which have no prepare step). Always-known
   * rituals fold in regardless.
   */
  preparedOverride?: Id[];
  /** Campaign override: which cantrips this caster knows, chosen from
   *  `classCantrips` and trimmed to `cantripsKnownCount`. Missing = the full
   *  cantrip list. */
  cantripsOverride?: Id[];
  /** Wizard only: spells copied into the spellbook beyond the class default. */
  spellbookExtra?: Id[];
  /** Campaign override: charges left in carried wands, from before a long rest. */
  itemChargesOverride?: Record<Id, number>;
  /**
   * Campaign override: uses left in rest-scoped feature pools (Lay on Hands,
   * Action Surge), carried out of the last fight.
   *
   * Encounter-scoped pools are deliberately ignored even if one appears here —
   * they refill every fight by definition, and an old save written before the
   * pools were rest-scoped would otherwise start a paladin's Channel Divinity
   * spent forever.
   */
  featureUsesOverride?: Record<Id, number>;
}

/**
 * The Fiend patron's always-prepared spells, by warlock level.
 *
 * Straight from the SRD's Fiend Spells table, minus the ones this game has no
 * version of (Stinking Cloud at 5, Fire Shield at 7). This is where a warlock
 * gets Fireball — it is not on the warlock spell list at all, which is why the
 * class reads as having no area damage until level 5 and then suddenly does.
 */
function fiendSpells(level: number): Id[] {
  const out: Id[] = [];
  if (level >= 3) out.push('burning-hands', 'command', 'scorching-ray', 'suggestion');
  if (level >= 5) out.push('fireball');
  if (level >= 7) out.push('wall-of-fire');
  return out;
}

export function buildCharacter(opts: BuildOptions): Combatant {
  const cls = CLASSES[opts.classId];
  if (!cls) throw new Error(`Unknown class: ${opts.classId}`);
  const speciesId = opts.speciesId ?? 'human';
  const species = SPECIES[speciesId];
  if (!species) throw new Error(`Unknown species: ${speciesId}`);
  const level = opts.level ?? 1;
  const abilities = assignStats(cls.statPriority);
  // Level-4 Ability Score Increase. No feats yet, so it's a deterministic +2 to
  // the class's primary stat (capped at 20) — attack, damage, HP and spell DC
  // all read the modifier, so the boost flows without further wiring.
  if (level >= 4) {
    const primary = cls.statPriority[0];
    abilities[primary] = Math.min(20, abilities[primary] + 2);
  }
  // Every class gets one at 8th — the whole of what level 8 is in the SRD for
  // most of them, and the reason the level was cheap to add. It goes to the
  // same primary stat, capped at 20, so a class already at 20 gains nothing
  // rather than overflowing.
  if (level >= 8) {
    const primary = cls.statPriority[0];
    abilities[primary] = Math.min(20, abilities[primary] + 2);
  }
  // The Fighter alone gets a second Ability Score Increase at 6th. (Its 7th is
  // the Champion's Additional Fighting Style, a choice point rather than a stat
  // bump — see classes.ts.)
  if (level >= 6 && opts.classId === 'fighter') {
    const primary = cls.statPriority[0];
    abilities[primary] = Math.min(20, abilities[primary] + 2);
  }
  // A worn trinket (Gauntlets of Ogre Power, …) can raise an ability score, so
  // apply its floor before HP/AC-relevant mods are computed off the abilities.
  // Worn wondrous items — the trinket slot and the ring slot both fold in the
  // same way, so a grant added to one is available to the other for free.
  const worn = [opts.equipped?.trinket, opts.equipped?.ring]
    .map((id) => (id ? TRINKETS[id] : undefined))
    .filter((t): t is NonNullable<typeof t> => t !== undefined)
    // A class-gated item grants nothing to a class that cannot attune to it.
    // `equipBlocked` already refuses to put one on, but the builder is what the
    // arena and the campaign actually call — a save hand-edited, or an older
    // one written before the gate existed, must not quietly hand a wizard a
    // cleric's beads.
    .filter((t) => !t.classes || t.classes.includes(opts.classId));
  for (const t of worn) {
    for (const [ab, floor] of Object.entries(t.grants.abilityFloor ?? {})) {
      abilities[ab as Ability] = Math.max(abilities[ab as Ability], floor);
    }
  }

  const conMod = abilityMod(abilities.con);
  // A held weapon can grant things too (Berserker Axe: hit points per level).
  const heldGrants = [opts.equipped?.mainHand, opts.equipped?.offHand]
    .map((id) => (id && id !== 'shield' ? WEAPONS[id]?.grants : undefined))
    .filter((g): g is NonNullable<typeof g> => g !== undefined);
  const maxHp = hpForLevel(cls.hitDie, conMod, level) + (species.hpPerLevel ?? 0) * level +
    heldGrants.reduce((n, g) => n + (g.hpPerLevel ?? 0) * level, 0);

  const grants = resolveChoiceGrants(cls.choices, level, opts.choices);
  const speciesGrants = resolveChoiceGrants(species.choices, level, opts.choices);
  grants.featureIds.push(...speciesGrants.featureIds);
  grants.spellIds.push(...speciesGrants.spellIds);
  grants.weaponMasteries.push(...speciesGrants.weaponMasteries);
  grants.resistances.push(...speciesGrants.resistances);
  for (const g of heldGrants) grants.featureIds.push(...(g.featureIds ?? []));
  // A worn item's feature ids and resistances fold in the same way.
  for (const t of worn) {
    grants.featureIds.push(...(t.grants.featureIds ?? []));
    grants.resistances.push(...(t.grants.resistances ?? []));
  }

  // Deduped, because the same feature can now arrive twice: a 7th-level fighter
  // has two Fighting Style choices and nothing stops picking Dueling for both.
  // Most readers ask `featureIds.includes(...)` and would not notice, but
  // `advantageDice` SUMS across the list — a duplicated Sneak Attack would
  // quietly roll twice — so the list is made unique once, here, rather than
  // every reader having to be careful.
  const featureIds = [...new Set([
    ...Object.entries(cls.featuresByLevel)
    .filter(([lvl]) => Number(lvl) <= level)
    .flatMap(([, ids]) => ids),
    ...(species.featureIds ?? []),
    ...grants.featureIds,
  ])];

  const featureUses: Record<Id, ResourcePool> = {};
  for (const fid of featureIds) {
    const f = FEATURES[fid];
    if (f?.uses) {
      const count =
        f.uses.count === 'proficiency' ? proficiencyBonus(level) :
        f.uses.count === 'fiveTimesLevel' ? 5 * level :
        // Bardic Inspiration: uses equal to the bard's Charisma modifier,
        // minimum one — a bard with no Charisma is not a bard, but the pool
        // must never be zero or the feature simply isn't there.
        f.uses.count === 'charismaMod' ? Math.max(1, abilityMod(abilities.cha)) :
        // The monk's Focus Points: one per level, which is the only pool in the
        // game that scales one-for-one with the character rather than with
        // proficiency. It is the class's whole economy, so it gets its own kind
        // rather than an approximation.
        f.uses.count === 'level' ? level :
        f.uses.count;
      // Absent means full, the same convention HP, slots and wand charges use.
      const left = f.uses.per === 'encounter' ? undefined : opts.featureUsesOverride?.[fid];
      featureUses[fid] = { current: Math.max(0, Math.min(left ?? count, count)), max: count };
    } else if (f?.recharge) {
      featureUses[fid] = { current: 1, max: 1 }; // starts charged; recharge roll in startTurn
    }
  }

  // Charges in carried wands and staves. Built from the inventory rather than
  // stored on the stack, so a wand picked up mid-campaign arrives full and a
  // wand that has been fired keeps its count through the campaign override.
  const itemUses: Record<Id, ResourcePool> = {};
  for (const stack of opts.inventory ?? []) {
    const charges = ITEMS[stack.itemId]?.charges;
    if (charges === undefined) continue;
    const left = opts.itemChargesOverride?.[stack.itemId];
    itemUses[stack.itemId] = { current: Math.min(left ?? charges, charges), max: charges };
  }

  const slots = cls.spellcasting?.slotsByLevel[level - 1] ?? [];
  const known = (byLevel: Record<number, Id[]> | undefined): Id[] =>
    Object.entries(byLevel ?? {})
      .filter(([lvl]) => Number(lvl) <= level)
      .flatMap(([, ids]) => ids);
  // Innate spells the species grants at or below this level, with their per-
  // encounter use pools — a fighter's only route to a levelled spell.
  const innateSpells: Record<Id, { current: number; max: number }> = {};
  for (const s of species?.innateSpells ?? []) {
    if (s.atLevel <= level) innateSpells[s.spellId] = { current: s.uses, max: s.uses };
  }

  // "Spells known" model: the class table is the menu; the caster knows a
  // capped selection of cantrips and leveled spells, chosen in the campaign's
  // prepare panel or defaulted. An explicit override (which the campaign always
  // supplies) is filtered to the pool and trimmed to the class's known-count;
  // with no override — skirmish, an AI party, a mirror match — the caster knows
  // its whole list, since those contexts have no prepare step to narrow it.
  // Rituals (Find Familiar) are always known on top, never counted.
  const cantripPool = cls.spellcasting ? classCantrips(opts.classId, level) : [];
  const leveledPool = cls.spellcasting
    ? [...new Set([...availableLeveledSpells(opts.classId, level), ...(opts.spellbookExtra ?? [])])]
    : [];
  const rituals = cls.spellcasting ? classRituals(opts.classId, level) : [];

  const cantrips = opts.cantripsOverride && cls.spellcasting
    ? opts.cantripsOverride.filter((id) => cantripPool.includes(id)).slice(0, cantripsKnownCount(opts.classId, level))
    : cantripPool;
  const knownLeveled = opts.preparedOverride && cls.spellcasting
    ? opts.preparedOverride.filter((id) => leveledPool.includes(id)).slice(0, preparedCount(opts.classId, level))
    : leveledPool;

  // Class magic, plus whatever the species brings of its own — a wood elf knows
  // True Strike (cantrip) and, from 3rd, Faerie Fire (innate) whether or not it
  // ever opened a spellbook.
  const spellIds = [...new Set([
    ...cantrips,
    ...knownLeveled,
    ...rituals,
    ...known(species?.spellsByLevel),
    ...Object.keys(innateSpells),
    ...grants.spellIds,
    // Feature-granted spells, which the SRD is explicit do NOT count against
    // what the class can prepare: the Fiend patron's always-prepared list, and
    // the Book of Shadows' cantrips and ritual. Folded in here rather than into
    // the class table so they cannot be trimmed by the prepared-spell cap.
    ...(featureIds.includes('fiend-spells') ? fiendSpells(level) : []),
    ...(featureIds.includes('pact-of-the-tome')
      ? ['vicious-mockery', 'sacred-flame', 'ray-of-frost', 'find-familiar'] : []),
  ])];

  /**
   * Armor of Shadows means going without armour, not wearing it as well.
   *
   * Mage Armor ends the instant you don armour — `acOf` has always known that,
   * and it is the SRD rule for the spell whether it is cast from a slot or from
   * an invocation. So a warlock that starts in leather (11 + Dex) gains exactly
   * nothing from an invocation offering 13 + Dex, and the pick was dead the
   * moment it was granted.
   *
   * The fix is not to make Mage Armor beat armour — that would rewrite the
   * spell for every wizard too. It is that a warlock who took this invocation
   * would not be wearing the leather. Only when the ward is actually better,
   * so a warlock who later buys half plate keeps it.
   */
  const wornArmor = opts.equipped?.armor ?? cls.equipment.armor;
  const shedForWard = featureIds.includes('armor-of-shadows') && wornArmor !== undefined &&
    armorClass(wornArmor, abilityMod(abilities.dex), 0) < 13 + abilityMod(abilities.dex);

  const combatant: Combatant = {
    id: `${opts.team}-${opts.classId}`,
    name: opts.name ?? cls.name,
    unconsciousAtZero: true,   // heroes drop; monsters die
    creatureType: 'humanoid',  // every playable species is a humanoid
    // Gnomes and halflings are Small; everyone else is Medium. It matters for
    // cover: a barricade is chest-high to a person, and more of one to them.
    size: species.size ?? 'medium',
    ...(opts.portraitId !== undefined ? { portraitId: opts.portraitId } : {}),
    team: opts.team,
    classId: cls.id,
    speciesId,
    level,
    abilities,
    maxHp,
    hp: maxHp,
    tempHp: 0,
    // Roving (Ranger 6): +10 ft of walking speed. Armor heavier than you can
    // carry takes 10 back (SRD 5.2.1) — a wizard may wear plate, and will spend
    // the whole fight arriving.
    speed: species.speed + (featureIds.includes('roving') ? 10 : 0)
      // Fast Movement (Barbarian 5): +10 ft, on the same terms as Roving — the
      // heavy-armour penalty below applies to both.
      + (featureIds.includes('fast-movement') ? 10 : 0) -
      armorSpeedPenalty(opts.equipped?.armor ?? cls.equipment.armor, abilities.str),
    position: opts.position,
    initiative: 0,
    savingThrowProfs: [...cls.savingThrows],
    weaponProfs: { ...cls.weaponProfs, ...(cls.weaponProfs.specific ? { specific: [...cls.weaponProfs.specific] } : {}) },
    // Armor of Shadows and Fiendish Vigor are "at will, no slot, no
    // concentration", which for a fight means simply always on. A button that
    // can never be declined is a worse way to say the same thing.
    ...(featureIds.includes('armor-of-shadows') ? { mageArmor: true } : {}),
    ...(featureIds.includes('fiendish-vigor') ? { tempHp: 9 } : {}),   // 2d4+4, averaged
    spellSlots: slots.map((n, i) => ({
      current: opts.spellSlotsOverride ? Math.max(0, Math.min(n, opts.spellSlotsOverride[i] ?? n)) : n,
      max: n,
    })),
    spellIds,
    featureIds,
    featureUses,
    ...(Object.keys(itemUses).length > 0 ? { itemUses } : {}),
    innateSpells,
    inventory: (opts.inventory ?? cls.equipment.inventory).map((s) => ({ ...s })),
    equipped: (() => {
      const base = opts.equipped
        ? { ...opts.equipped }
        : {
            mainHand: cls.equipment.mainHand,
            ...(cls.equipment.offHand !== undefined ? { offHand: cls.equipment.offHand } : {}),
            ...(cls.equipment.armor !== undefined ? { armor: cls.equipment.armor } : {}),
          };
      if (shedForWard) delete base.armor;
      return base;
    })(),
    weaponMasteries: [...cls.weaponMasteries, ...grants.weaponMasteries],
    attacksPerAction: featureIds.includes('extra-attack') ? 2 : 1,
    resistances: [...(species.resistances ?? []), ...grants.resistances],
    vulnerabilities: [],
    immunities: [],
    conditions: [],
    hasActed: false,
    turn: {
      actionUsed: false, bonusActionUsed: false, reactionUsed: false,
      movementUsed: 0, movementMax: 30, disengaged: false,
      attackedThisTurn: false, attacksLeft: 0, interacted: false, sneakAttackUsed: false,
      colossusUsed: false,
    },
    alive: true,
  };
  if (cls.spellcasting) combatant.spellcastingAbility = cls.spellcasting.ability;
  // Find Familiar is a slot-free ritual that never dies in this model, so a
  // caster who knows it has no reason not to have cast it — grant the owl by
  // default (players, and the AI, forgot to summon it otherwise). The campaign
  // familiar flag still applies, redundantly and harmlessly.
  if (spellIds.includes('find-familiar')) combatant.familiar = { kind: 'owl' };
  // Divine Smite is a class *feature*, so it rides along free rather than
  // competing for one of the paladin's prepared spells — it just happens to be
  // expressed as a castable spell so the player can choose the slot level.
  if (combatant.featureIds.includes('divine-smite') && !combatant.spellIds.includes('divine-smite')) {
    combatant.spellIds.push('divine-smite');
  }
  return combatant;
}

/** The standard party of four, placed on a rank. */
export function buildParty(
  team: TeamId,
  rank: number,
  level = 1,
  files: number[] = [1, 2, 4, 6],
  speciesIds: Id[] = [],
): Combatant[] {
  const order: Id[] = ['fighter', 'wizard', 'cleric', 'rogue'];
  return order.map((classId, i) =>
    buildCharacter({
      classId, team, level,
      // Without this a generated party is "Fighter, Wizard, Cleric, Rogue", and
      // the narration bar reads "Wizard is down" — a class, not a character.
      // Distinct per side, or a mirror match kills Sir Arthur with Sir Arthur.
      name: defaultNameFor(classId, team),
      position: { x: files[i]!, y: rank },
      speciesId: speciesIds[i] ?? 'human',
    }),
  );
}
