/**
 * Knowing what you are about to fight.
 *
 * The gate names the monsters behind each door and says nothing else, so a
 * player who has not memorised the bestiary chooses a door on vibes. Meanwhile
 * twelve of the game's eighteen skills did nothing in the arena at all, among
 * them the four that exist precisely to answer "what IS that thing".
 *
 * So: what your party ALREADY KNOWS is laid open on every door card — armour
 * class, hit points, and what the thing shrugs off.
 *
 * WHY THIS IS PASSIVE, AND WAS NOT
 *
 * It used to be a rolled check: pick a lens, roll it once, see everything that
 * lens covers. Its own documentation admitted that failing cost nothing but the
 * study — which makes it a button with no reason not to press it, and a button
 * with no reason not to press it is a rule wearing a costume.
 *
 * As a passive it is strictly better in three ways. Knowledge becomes granular:
 * 10 + your best relevant bonus against `10 + CR` per creature, so you place
 * the small things and not the big one, and the gap is obviously about the
 * MONSTER rather than about a die. The lens question disappears — a party with
 * both a wizard and a cleric simply knows more, instead of having to pick one
 * and eat the other. And it turns into a progression readout: raise an
 * Intelligence score or pick up a proficiency and the door cards visibly tell
 * you more than they did last level.
 *
 * The gamble that used to sit here is now arena/gambit.ts, which has stakes.
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
 * How hard ONE creature is to place.
 *
 * Per creature rather than per line-up, which is what going passive bought: the
 * old rolled version took the hardest thing present and gated the whole wave
 * behind it, so a wizard who could name every goblin on the field was told
 * nothing about any of them because an ogre was standing there too.
 *
 * Scales with the creature and not with the party, because that is what the
 * question is about: a goblin is a goblin at any level. Floored at 10 so
 * nothing is free.
 */
export function loreDc(monsterId: Id): number {
  return Math.max(10, 10 + Math.ceil(MONSTERS[monsterId]?.cr ?? 0));
}

/**
 * What the party recognises without being asked: 10 + its best relevant bonus.
 *
 * The 5e passive rule, and the reason this can be free — a passive check is not
 * a decision, it is a description of who you brought. `bonusFor` is passed in
 * rather than computed here so this file stays free of the campaign layer.
 */
export function passiveKnown(
  members: readonly Id[], bonusFor: (skill: SkillId) => number,
): Set<Id> {
  const known = new Set<Id>();
  for (const id of new Set(members)) {
    const type = MONSTERS[id]?.creatureType;
    if (!type) continue;
    if (10 + bonusFor(LORE_SKILL[type]) >= loreDc(id)) known.add(id);
  }
  return known;
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
