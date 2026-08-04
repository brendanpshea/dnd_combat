import type { Combatant, TeamId, Position, AbilityScores } from '../src/engine/types.js';

let counter = 0;

/**
 * Drop keys whose value is literally `undefined`.
 *
 * `exactOptionalPropertyTypes` draws a distinction between "absent" and
 * "present and undefined", and spreading a `Partial<Combatant>` could deliver
 * the second — `{ hp: undefined }` is a valid Partial and not a valid
 * Combatant. Stripping them makes the spread honest instead of casting the
 * complaint away, which would have hidden the same class of bug everywhere
 * this helper is used.
 */
function defined<T extends object>(o: T): T {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T;
}

/**
 * A plain fighter, overridable field by field.
 *
 * `team` and `position` are required on the argument and therefore always
 * arrive through the spread at the bottom; writing them out above as well only
 * told TypeScript that the spread was about to overwrite what we had just set.
 */
export function makeCombatant(over: Partial<Combatant> & { team: TeamId; position: Position }): Combatant {
  const abilities: AbilityScores = { str: 16, dex: 13, con: 16, int: 10, wis: 12, cha: 8 };
  return {
    id: over.id ?? `c${++counter}`,
    name: over.name ?? over.id ?? `c${counter}`,
    classId: 'fighter',
    speciesId: 'human',
    // A human fighter is a humanoid. It went unstated while nothing asked, and
    // then Hold Person got its SRD `humanoid` gate and every test dummy became
    // immune to it.
    creatureType: 'humanoid',
    level: 1,
    abilities,
    maxHp: 13,
    hp: 13,
    tempHp: 0,
    speed: 30,
    initiative: 0,
    savingThrowProfs: ['str', 'con'],
    spellSlots: [],
    spellIds: [],
    featureIds: [],
    featureUses: {},
    // Required on Combatant, and the helper never set it: engine code that
    // reads it would have found `undefined` rather than an empty list.
    innateSpells: {},
    inventory: [{ itemId: 'javelin', qty: 1 }],
    equipped: { mainHand: 'longsword', offHand: 'shield', armor: 'scale-mail' },
    weaponMasteries: [],
    attacksPerAction: 1,
    resistances: [],
    vulnerabilities: [],
    immunities: [],
    conditions: [],
    hasActed: false,
    turn: {
      actionUsed: false, bonusActionUsed: false, reactionUsed: false,
      movementUsed: 0, movementMax: 30, dashSpeed: 30, disengaged: false,
      attackedThisTurn: false, attacksLeft: 0, interacted: false, sneakAttackUsed: false,
      colossusUsed: false, savageUsed: false,
      leveledSpellCast: false,
      quickenedThisTurn: false,
    },
    alive: true,
    ...defined(over),
  };
}
