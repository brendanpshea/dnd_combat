/**
 * Sample names for generated parties.
 *
 * A name is what makes a combat log read like a story instead of a spreadsheet
 * — and the narration bar has no room for anything else, since it speaks plain
 * English ("Sir Arthur hits Grix for 6!") rather than the log's tagged
 * "Fighter(T1) attacks Goblin Warrior 1(T2)".
 *
 * Two sets, because both sides of a skirmish are generated parties: one list
 * would put Sir Arthur against Sir Arthur. The log gets away with that (its
 * (T1)/(T2) tags disambiguate); plain English cannot.
 *
 * Lives in the builder rather than the campaign because *every* mode assembles
 * a party — skirmish, arena and CLI all call buildParty — and the campaign sits
 * above this layer, so it can read these but not the other way round.
 */
import type { Id, TeamId } from '../engine/types.js';
import { CLASSES } from '../data/classes.js';

export const HERO_NAMES: Record<Id, string> = {
  fighter: 'Sir Arthur',
  wizard: 'Morgana Le Fey',
  cleric: 'Elaine the Holy',
  rogue: 'Cedric the Sneaky',
  ranger: 'Sylva Thornwood',
  paladin: 'Ser Roland',
};

export const RIVAL_NAMES: Record<Id, string> = {
  fighter: 'Sir Kay',
  wizard: 'Vivian the Cold',
  cleric: 'Brother Mordred',
  rogue: 'Nessa Quickfingers',
  ranger: 'Kael Grimshaw',
  paladin: 'Dame Vex',
};

/** A starting name for a class, distinct per side so a mirror match reads. */
export function defaultNameFor(classId: Id, team: TeamId = 'team1'): string {
  const names = team === 'team1' ? HERO_NAMES : RIVAL_NAMES;
  return names[classId] ?? CLASSES[classId]?.name ?? 'Adventurer';
}
