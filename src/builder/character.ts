/**
 * Character construction: class + species + level → Combatant.
 */
import type { Combatant, TeamId, Position, AbilityScores, Ability, Id, ResourcePool } from '../engine/types.js';
import { abilityMod, proficiencyBonus } from '../engine/types.js';
import { CLASSES } from '../data/classes.js';
import { defaultNameFor } from './names.js';
import { FEATURES } from '../data/features.js';
import { SPECIES } from '../data/species.js';

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
  equipped?: { mainHand: Id; offHand?: Id | 'shield'; armor?: Id };
}

export function buildCharacter(opts: BuildOptions): Combatant {
  const cls = CLASSES[opts.classId];
  if (!cls) throw new Error(`Unknown class: ${opts.classId}`);
  const speciesId = opts.speciesId ?? 'human';
  const species = SPECIES[speciesId];
  if (!species) throw new Error(`Unknown species: ${speciesId}`);
  const level = opts.level ?? 1;
  const abilities = assignStats(cls.statPriority);
  const conMod = abilityMod(abilities.con);
  const maxHp = hpForLevel(cls.hitDie, conMod, level) + (species.hpPerLevel ?? 0) * level;

  const featureIds = [
    ...Object.entries(cls.featuresByLevel)
    .filter(([lvl]) => Number(lvl) <= level)
    .flatMap(([, ids]) => ids),
    ...(species.featureIds ?? []),
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
  const spellIds = cls.spellcasting
    ? Object.entries(cls.spellcasting.spellsByLevel)
        .filter(([lvl]) => Number(lvl) <= level)
        .flatMap(([, ids]) => ids)
    : [];

  const combatant: Combatant = {
    id: `${opts.team}-${opts.classId}`,
    name: opts.name ?? cls.name,
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
    inventory: (opts.inventory ?? cls.equipment.inventory).map((s) => ({ ...s })),
    equipped: opts.equipped
      ? { ...opts.equipped }
      : {
          mainHand: cls.equipment.mainHand,
          ...(cls.equipment.offHand !== undefined ? { offHand: cls.equipment.offHand } : {}),
          ...(cls.equipment.armor !== undefined ? { armor: cls.equipment.armor } : {}),
        },
    weaponMasteries: [...cls.weaponMasteries],
    attacksPerAction: 1,
    resistances: [...(species.resistances ?? [])],
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
