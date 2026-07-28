/**
 * Creeping in: the arena's one chance to start a fight before it starts.
 *
 * The engine has been able to surprise a team since combat was written —
 * `CombatSetup.surprisedTeam` incapacitates everyone on it through round one —
 * and only adventure mode ever set it, from authored scenes. The arena had no
 * way to earn it and no way to suffer it.
 *
 * A free round is an enormous swing, so this is deliberately NOT a passive
 * property of having a stealthy party. It is a gamble you opt into, once, at
 * the gate:
 *
 *   succeed   they are still looking the wrong way; they lose round one
 *   fail      they heard you coming; YOU lose round one
 *
 * The symmetry is the whole design. Surprise is powerful enough that handing it
 * out for a good Stealth modifier would flatten the fights it applies to; and
 * being surprised is punishing enough that inflicting it unasked would feel
 * arbitrary. Opt in, and you own both ends of it.
 *
 * WHY IT NEEDS COVER, AND WHY IT IS BOUND TO A DOOR
 *
 * You cannot sneak across the Killing Floor. Offering the gamble on open ground
 * would make it a pure dice roll with no read attached; requiring something to
 * creep behind ties it to the ground the gate card is already describing, which
 * is one more reason to weigh the doors against each other.
 *
 * And the attempt records WHICH door it was made at. The three doors hold
 * different monsters with different eyes, so a creep attempted at one and
 * cashed at another would be a way to shop for the easiest DC. Change your mind
 * and you simply walk in — the sneaking was for that gate.
 */
import type { Id, Combatant, GridState } from '../engine/types.js';
import { abilityMod, proficiencyBonus } from '../engine/types.js';
import { MONSTERS, buildMonster } from '../data/monsters.js';
import { CLASSES } from '../data/classes.js';
import { FEATURES } from '../data/features.js';

/**
 * Ordinary passive Perception: 10 + Wisdom + proficiency.
 *
 * Distinct from `passivePerceptionWithAdvantage` in the hide rules, which adds
 * 5 for a creature actively searching. Walking into your own ambush is the
 * unaware case, so it is the plain number that opposes you.
 */
export function passivePerception(c: Combatant): number {
  const proficient = (CLASSES[c.classId]?.skillProfs.includes('perception') ?? false) ||
    c.featureIds.some((f) => FEATURES[f]?.grantsSkill === 'perception');
  return 10 + abilityMod(c.abilities.wis) + (proficient ? proficiencyBonus(c.level) : 0);
}

/**
 * The DC to creep past this line-up: the sharpest pair of eyes in it.
 *
 * The sharpest rather than the average, because it only takes one sentry to
 * raise the alarm — and because averaging would make a big warband easier to
 * sneak past than a single alert scout, which is exactly backwards.
 */
export function ambushDc(members: readonly Id[]): number {
  let best = 10;
  for (const [i, id] of members.entries()) {
    if (!MONSTERS[id]) continue;
    best = Math.max(best, passivePerception(buildMonster(id, 'team2', { x: 0, y: 0 }, String(i))));
  }
  return best;
}

/**
 * Is there anything on this board to creep behind?
 *
 * Cover only — a wall you cannot see past is not something you sneak *through*,
 * and open ground is open ground. This is what keeps the gamble tied to the
 * terrain the gate card already describes.
 */
export function canCreepIn(grid: GridState): boolean {
  return grid.cells.some((c) => c.terrain === 'cover');
}

/** A creep attempt, recorded so it cannot be repeated or shopped around. */
export interface CreepAttempt {
  /** Day and half, so it belongs to one fight. */
  key: string;
  /** The door it was made at — surprise only applies if you fight that one. */
  door: number;
  /** True: they are surprised. False: you are. */
  success: boolean;
  /** Whoever the group check turned on, for the line on the card. */
  by: number;
  total: number;
  dc: number;
}

export function creepKey(day: number, half: 'morning' | 'afternoon'): string {
  return `${day}:${half}`;
}

/** The attempt made for this fight, if any. */
export function creepFor(
  stored: CreepAttempt | undefined, day: number, half: 'morning' | 'afternoon',
): CreepAttempt | undefined {
  return stored && stored.key === creepKey(day, half) ? stored : undefined;
}

/**
 * Which team, if either, walks into this fight flat-footed.
 *
 * Returns undefined unless a creep was attempted AND the party is fighting the
 * door it was attempted at. Everything else — no attempt, or a change of mind —
 * is an ordinary fight.
 */
export function surprisedTeam(
  attempt: CreepAttempt | undefined, door: number,
): 'team1' | 'team2' | undefined {
  if (!attempt || attempt.door !== door) return undefined;
  return attempt.success ? 'team2' : 'team1';
}
