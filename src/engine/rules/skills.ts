/**
 * Skill checks, inside a fight.
 *
 * WHY THIS DID NOT EXIST
 *
 * Every skill check in this game happened OUTSIDE combat — in the shop, in an
 * adventure scene, in the arena's creep check — and all of them went through
 * `campaign.ts`'s `skillBonus(classId, ...)`, which reads a class table. A
 * `Combatant` did not carry its skill proficiencies at all, so the engine could
 * not roll a check even in principle.
 *
 * That had a consequence nobody had written down: Athletics and Acrobatics were
 * worth nothing once a fight started. They are the two most physical skills in
 * the game and the only two a fight would ever plausibly ask for, and no fight
 * could ask. Shove, the one move that should have asked, used a saving throw
 * against a flat DC instead.
 *
 * So `Combatant.skillProfs` now carries the folded answer (class + species +
 * background + origin feat, resolved by the builder) and this is the one place
 * that rolls against it. `applyLuck` is threaded through, exactly as the attack
 * and save rolls do, so Halfling Luck and Fated work on a contest too.
 */
import type { GameState, Id, Combatant } from '../types.js';
import { abilityMod, proficiencyBonus } from '../types.js';
import { SKILL_ABILITY, type SkillId } from '../../data/classes.js';
import { rollD20, type RollMode } from '../dice.js';
import { applyLuck } from './luck.js';

/** A creature's flat bonus for a skill: ability modifier plus proficiency. */
export function skillMod(c: Combatant, skill: SkillId): number {
  const trained = (c.skillProfs ?? []).includes(skill);
  return abilityMod(c.abilities[SKILL_ABILITY[skill]]) +
    (trained ? proficiencyBonus(c.level) : 0);
}

export interface SkillRollResult {
  natural: number;
  total: number;
  /** Which of the offered skills was used — the contest lets a defender pick. */
  skill: SkillId;
  /** Named luck source, when a reroll actually changed the die. */
  luck?: string;
}

export function rollSkill(
  state: GameState, combatantId: Id, skill: SkillId, mode: RollMode = 'flat',
): SkillRollResult {
  const c = state.combatants[combatantId]!;
  const d20 = applyLuck(state, combatantId, rollD20(state.rng, mode), mode);
  state.rng = d20.state;
  return {
    natural: d20.natural,
    total: d20.natural + skillMod(c, skill),
    skill,
    ...(d20.luck ? { luck: d20.luck } : {}),
  };
}

/**
 * The defender's best of several skills.
 *
 * A contest that lets the defender choose means it chooses WELL — the same
 * reasoning the old shove save used for "Strength or Dexterity, it chooses
 * which". Picking by modifier before rolling, not after, so this is a decision a
 * creature could actually make.
 */
export function bestSkill(c: Combatant, skills: readonly SkillId[]): SkillId {
  return skills.reduce((best, s) => (skillMod(c, s) > skillMod(c, best) ? s : best), skills[0]!);
}

/**
 * An opposed check. Ties go to the DEFENDER, which is the 5e rule for a contest
 * and the right default besides: the shove, the grapple and the disarm are all
 * things the attacker is trying to make happen.
 */
export interface ContestResult {
  attacker: SkillRollResult;
  defender: SkillRollResult;
  /** True when the attacker beat the defender outright. */
  won: boolean;
}

export function contest(
  state: GameState,
  attackerId: Id, attackerSkill: SkillId,
  defenderId: Id, defenderSkills: readonly SkillId[],
): ContestResult {
  const defender = state.combatants[defenderId]!;
  const attacker = rollSkill(state, attackerId, attackerSkill);
  const chosen = bestSkill(defender, defenderSkills);
  const def = rollSkill(state, defenderId, chosen);
  return { attacker, defender: def, won: attacker.total > def.total };
}
