/**
 * Knowing what you are about to fight.
 *
 * The gate names the monsters behind each door and says nothing else, so a
 * player who has not memorised the bestiary chooses a door on vibes. Meanwhile
 * twelve of the game's eighteen skills did nothing in the arena at all, among
 * them the four that exist precisely to answer "what IS that thing".
 *
 * So: one study before the fight. Pick a lens — Arcana, Nature, Religion or
 * History — and what you know about is laid open across ALL THREE doors: armour
 * class, hit points, and what it shrugs off. Pathfinder and Solasta both do
 * this, and it turns the door choice from a guess into a read.
 *
 * WHY IT LOOKS AT EVERY DOOR
 *
 * Because the point is to inform the choice of door, and a check that only saw
 * behind the door you had already picked would arrive too late to matter. It
 * also closes the reroll hole: if the study were per-door you could study one,
 * dislike the answer, and study the next — three checks a fight, and the best
 * of three is not a check at all.
 *
 * WHY YOU ONLY GET ONE
 *
 * A wizard and a cleric between them cover eight creature types, and letting
 * both roll every fight would make the lens irrelevant — you would simply take
 * all of them. One study per fight makes "which lens" a real question when a
 * wave is mixed, and it is the same once-a-visit rule the stall's haggling uses.
 *
 * Failure costs nothing but the study: you go in as blind as you would have
 * been anyway. The cost is the opportunity, not a penalty — the arena has
 * enough ways to lose money already.
 */
import type { Id } from '../engine/types.js';
import type { SkillId } from '../data/classes.js';
import { MONSTERS } from '../data/monsters.js';
import type { CreatureType } from '../engine/types.js';

/**
 * Which lens sees which kind of creature.
 *
 * The 5e convention, and the split is even enough across our bestiary that no
 * one skill dominates: 18 humanoid and 13 dragon for History; 16 beast, 7 giant
 * and 4 ooze for Nature; 14 undead and 16 fiend for Religion; 15 monstrosity,
 * 14 elemental, 8 construct and 3 aberration for Arcana.
 */
export const LORE_SKILL: Record<CreatureType, SkillId> = {
  aberration: 'arcana',
  construct: 'arcana',
  elemental: 'arcana',
  monstrosity: 'arcana',
  beast: 'nature',
  plant: 'nature',
  ooze: 'nature',
  giant: 'nature',
  undead: 'religion',
  fiend: 'religion',
  celestial: 'religion',
  fey: 'religion',
  humanoid: 'history',
  dragon: 'history',
};

/** The lenses that would see *something* in this line-up, commonest first. */
export function loreSkillsFor(members: readonly Id[]): SkillId[] {
  const counts = new Map<SkillId, number>();
  for (const id of members) {
    const type = MONSTERS[id]?.creatureType;
    if (!type) continue;
    const skill = LORE_SKILL[type];
    counts.set(skill, (counts.get(skill) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([skill]) => skill);
}

/** Which of these creatures a given lens would recognise. */
export function loreTargets(members: readonly Id[], skill: SkillId): Id[] {
  return [...new Set(members)].filter((id) => {
    const type = MONSTERS[id]?.creatureType;
    return type !== undefined && LORE_SKILL[type] === skill;
  });
}

/**
 * How hard this line-up is to place.
 *
 * Scales with the most dangerous thing on the field rather than with the party,
 * because that is what the question is actually about: a goblin is a goblin at
 * any level, and nobody has to think hard about it. Floored at 10 so the check
 * is never free and capped at 20 so a late wave is never hopeless.
 */
export function loreDc(members: readonly Id[], skill: SkillId): number {
  const seen = loreTargets(members, skill);
  const hardest = seen.reduce((cr, id) => Math.max(cr, MONSTERS[id]?.cr ?? 0), 0);
  return Math.max(10, Math.min(20, 10 + Math.ceil(hardest)));
}

/** What a successful study tells you about one creature. */
export interface Dossier {
  monsterId: Id;
  name: string;
  creatureType: CreatureType;
  ac: number;
  hp: number;
  /** Damage it shrugs off or suffers extra from, in words the card can print. */
  notes: string[];
}

export function dossierFor(monsterId: Id): Dossier | undefined {
  const m = MONSTERS[monsterId];
  if (!m) return undefined;
  const notes: string[] = [];
  if (m.immunities?.length) notes.push(`immune to ${m.immunities.join(', ')}`);
  if (m.resistances?.length) notes.push(`resists ${m.resistances.join(', ')}`);
  if (m.resistNonmagical?.length) {
    notes.push(`resists nonmagical ${m.resistNonmagical.join(', ')}`);
  }
  if (m.vulnerabilities?.length) notes.push(`VULNERABLE to ${m.vulnerabilities.join(', ')}`);
  if (notes.length === 0) notes.push('nothing it shrugs off');
  return {
    monsterId, name: m.name, creatureType: m.creatureType,
    ac: m.ac, hp: m.hp, notes,
  };
}

/**
 * The study already made for this fight, if any.
 *
 * Keyed by day and half rather than by door, so switching doors neither
 * re-rolls it nor loses it — one study, all three doors, exactly once.
 */
export interface LoreStudy {
  key: string;
  skill: SkillId;
  /** Index of the hero who recognised them, for the name on the card. */
  by: number;
  natural: number;
  total: number;
  dc: number;
  success: boolean;
}

export function loreKey(day: number, half: 'morning' | 'afternoon'): string {
  return `${day}:${half}`;
}

/** The study for this fight, or undefined if nobody has looked yet. */
export function studyFor(
  stored: LoreStudy | undefined, day: number, half: 'morning' | 'afternoon',
): LoreStudy | undefined {
  return stored && stored.key === loreKey(day, half) ? stored : undefined;
}
