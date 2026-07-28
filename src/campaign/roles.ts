/**
 * What a class brings to a party, derived from the class rather than declared.
 *
 * A random party that can roll four wizards is a random party that can roll an
 * unwinnable run, and the arena will happily generate a fight that needs
 * somebody to stand in front. So the roller needs to know what a class is FOR —
 * and it has to keep knowing when the warlock and the sorcerer land, without
 * anyone remembering to come back here.
 *
 * Three of the four roles come straight off data that already exists:
 *
 *   melee     the class's main-hand weapon swings in reach
 *   ranged    something in its kit has a range, or it throws spells that do
 *   magic     it casts at all
 *
 * The fourth cannot. Healing lives inside a spell's `cast` function, not in its
 * data, so there is nothing to read — which leaves one small named list. It is
 * the only hand-kept thing here, and a test holds every entry to being a real
 * spell. That test earned its place immediately: the first draft of the list
 * included Prayer of Healing, which this game does not have. A new healing
 * spell nobody adds here makes a class look like a non-healer — a worse random
 * party rather than a crash, worth knowing about but not worth inventing a
 * spell-classification system for.
 */
import type { Id } from '../engine/types.js';
import { CLASSES } from '../data/classes.js';
import { WEAPONS } from '../data/weapons.js';
import { SPELLS } from '../data/spells.js';

export type PartyRole = 'melee' | 'ranged' | 'magic' | 'healing';

/**
 * Spells that put hit points back. Read `cure-wounds`' entry in spells.ts: the
 * healing is a `rollDice` inside `cast`, so no amount of cleverness here can
 * find it without running the spell.
 */
export const HEALING_SPELLS: readonly Id[] = [
  'cure-wounds', 'healing-word', 'mass-healing-word', 'aid', 'lesser-restoration',
];

/** Every leveled spell and cantrip a class can have by the level cap. */
function spellList(classId: Id): Id[] {
  const sc = CLASSES[classId]?.spellcasting;
  if (!sc) return [];
  return Object.values(sc.spellsByLevel).flat();
}

/** What this class covers. A class can cover several — most do. */
export function rolesOf(classId: Id): Set<PartyRole> {
  const cls = CLASSES[classId];
  const out = new Set<PartyRole>();
  if (!cls) return out;

  const kit = [cls.equipment.mainHand, ...cls.equipment.inventory.map((s) => s.itemId)];
  if (WEAPONS[cls.equipment.mainHand]?.melee) out.add('melee');
  if (kit.some((id) => WEAPONS[id]?.range)) out.add('ranged');

  if (cls.spellcasting) {
    out.add('magic');
    // A caster with a spell that reaches across the board is also the party's
    // ranged answer, which is what makes an all-caster party legal rather than
    // a party with nobody who can hit anything more than five feet away.
    const reaches = spellList(classId).some((id) => {
      const t = SPELLS[id]?.targeting as { range?: number } | undefined;
      return (t?.range ?? 0) >= 30;
    });
    if (reaches) out.add('ranged');
    if (spellList(classId).some((id) => HEALING_SPELLS.includes(id))) out.add('healing');
  }
  return out;
}

/** The roles a set of classes covers between them. */
export function rolesCovered(classIds: readonly Id[]): Set<PartyRole> {
  const out = new Set<PartyRole>();
  for (const id of classIds) for (const r of rolesOf(id)) out.add(r);
  return out;
}

/**
 * The roles a party must not go without.
 *
 * Healing is the one that turns a bad run into an unwinnable one: hit dice are
 * a within-day currency and a party with no way to top up mid-fight loses the
 * long fights it would otherwise win. Melee is the second — somebody has to be
 * the reason the archers are not being chewed on.
 */
export const REQUIRED_ROLES: readonly PartyRole[] = ['melee', 'ranged', 'magic', 'healing'];

export function missingRoles(classIds: readonly Id[]): PartyRole[] {
  const have = rolesCovered(classIds);
  return REQUIRED_ROLES.filter((r) => !have.has(r));
}
