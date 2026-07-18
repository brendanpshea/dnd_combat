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
      const count = f.uses.count === 'proficiency' ? proficiencyBonus(level) : f.uses.count;
      featureUses[fid] = { current: count, max: count };
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

  // Class magic, plus whatever the species brings of its own — a wood elf knows
  // True Strike (cantrip) and, from 3rd, Faerie Fire (innate) whether or not it
  // ever opened a spellbook.
  const spellIds = [...new Set([
    ...(cls.spellcasting ? known(cls.spellcasting.spellsByLevel) : []),
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
    spellSlots: slots.map((n) => ({ current: n, max: n })),
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
