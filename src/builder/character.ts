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
  equipped?: { mainHand: Id; offHand?: Id | 'shield'; armor?: Id; trinket?: Id };
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
  // A worn trinket (Gauntlets of Ogre Power, …) can raise an ability score, so
  // apply its floor before HP/AC-relevant mods are computed off the abilities.
  const trinket = opts.equipped?.trinket ? TRINKETS[opts.equipped.trinket] : undefined;
  for (const [ab, floor] of Object.entries(trinket?.grants.abilityFloor ?? {})) {
    abilities[ab as Ability] = Math.max(abilities[ab as Ability], floor);
  }

  const conMod = abilityMod(abilities.con);
  const maxHp = hpForLevel(cls.hitDie, conMod, level) + (species.hpPerLevel ?? 0) * level;

  const grants = resolveChoiceGrants(cls.choices, level, opts.choices);
  const speciesGrants = resolveChoiceGrants(species.choices, level, opts.choices);
  grants.featureIds.push(...speciesGrants.featureIds);
  grants.spellIds.push(...speciesGrants.spellIds);
  grants.weaponMasteries.push(...speciesGrants.weaponMasteries);
  grants.resistances.push(...speciesGrants.resistances);
  // A trinket's feature ids and resistances fold in the same way.
  grants.featureIds.push(...(trinket?.grants.featureIds ?? []));
  grants.resistances.push(...(trinket?.grants.resistances ?? []));

  const featureIds = [
    ...Object.entries(cls.featuresByLevel)
    .filter(([lvl]) => Number(lvl) <= level)
    .flatMap(([, ids]) => ids),
    ...(species.featureIds ?? []),
    ...grants.featureIds,
  ];

  const featureUses: Record<Id, ResourcePool> = {};
  for (const fid of featureIds) {
    const f = FEATURES[fid];
    if (f?.uses) {
      const count =
        f.uses.count === 'proficiency' ? proficiencyBonus(level) :
        f.uses.count === 'fiveTimesLevel' ? 5 * level :
        f.uses.count;
      featureUses[fid] = { current: count, max: count };
    } else if (f?.recharge) {
      featureUses[fid] = { current: 1, max: 1 }; // starts charged; recharge roll in startTurn
    }
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
  ])];

  const combatant: Combatant = {
    id: `${opts.team}-${opts.classId}`,
    name: opts.name ?? cls.name,
    unconsciousAtZero: true,   // heroes drop; monsters die
    creatureType: 'humanoid',  // every playable species is a humanoid
    ...(opts.portraitId !== undefined ? { portraitId: opts.portraitId } : {}),
    team: opts.team,
    classId: cls.id,
    speciesId,
    level,
    abilities,
    maxHp,
    hp: maxHp,
    tempHp: 0,
    speed: species.speed,
    position: opts.position,
    initiative: 0,
    savingThrowProfs: [...cls.savingThrows],
    spellSlots: slots.map((n, i) => ({
      current: opts.spellSlotsOverride ? Math.max(0, Math.min(n, opts.spellSlotsOverride[i] ?? n)) : n,
      max: n,
    })),
    spellIds,
    featureIds,
    featureUses,
    innateSpells,
    inventory: (opts.inventory ?? cls.equipment.inventory).map((s) => ({ ...s })),
    equipped: opts.equipped
      ? { ...opts.equipped }
      : {
          mainHand: cls.equipment.mainHand,
          ...(cls.equipment.offHand !== undefined ? { offHand: cls.equipment.offHand } : {}),
          ...(cls.equipment.armor !== undefined ? { armor: cls.equipment.armor } : {}),
        },
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
