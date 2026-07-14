/**
 * Character construction: class + species + level → Combatant.
 */
import type { Combatant, TeamId, Position, AbilityScores, Ability, Id, ResourcePool } from '../engine/types.js';
import { abilityMod } from '../engine/types.js';
import { CLASSES } from '../data/classes.js';
import { FEATURES } from '../data/features.js';
import { armorClass } from '../data/armor.js';

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
  level?: number;
  speciesId?: Id; // v1: 'human' (no mechanical effect; see SPEC)
}

export function buildCharacter(opts: BuildOptions): Combatant {
  const cls = CLASSES[opts.classId];
  if (!cls) throw new Error(`Unknown class: ${opts.classId}`);
  const level = opts.level ?? 1;
  const abilities = assignStats(cls.statPriority);
  const conMod = abilityMod(abilities.con);
  const dexMod = abilityMod(abilities.dex);
  const maxHp = hpForLevel(cls.hitDie, conMod, level);

  const featureIds = Object.entries(cls.featuresByLevel)
    .filter(([lvl]) => Number(lvl) <= level)
    .flatMap(([, ids]) => ids);

  const featureUses: Record<Id, ResourcePool> = {};
  for (const fid of featureIds) {
    const f = FEATURES[fid];
    if (f?.uses) featureUses[fid] = { current: f.uses.count, max: f.uses.count };
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
    team: opts.team,
    classId: cls.id,
    speciesId: opts.speciesId ?? 'human',
    level,
    abilities,
    maxHp,
    hp: maxHp,
    ac: armorClass(cls.armorId, dexMod, cls.shield),
    speed: 30,
    position: opts.position,
    initiative: 0,
    savingThrowProfs: [...cls.savingThrows],
    spellSlots: slots.map((n) => ({ current: n, max: n })),
    spellIds,
    featureIds,
    featureUses,
    weaponIds: [...cls.weaponIds],
    weaponMasteries: [...cls.weaponMasteries],
    conditions: [],
    turn: {
      actionUsed: false, bonusActionUsed: false, reactionUsed: false,
      movementUsed: 0, movementMax: 30, disengaged: false,
      attackedThisTurn: false, sneakAttackUsed: false,
    },
    alive: true,
  };
  if (cls.spellcasting) combatant.spellcastingAbility = cls.spellcasting.ability;
  combatant.armorId = cls.armorId;
  return combatant;
}

/** The standard v1 party of four, placed on a rank. */
export function buildParty(team: TeamId, rank: number, files: number[] = [1, 2, 4, 6]): Combatant[] {
  const order: Id[] = ['fighter', 'wizard', 'cleric', 'rogue'];
  return order.map((classId, i) =>
    buildCharacter({ classId, team, position: { x: files[i]!, y: rank } }),
  );
}
