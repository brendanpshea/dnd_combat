import type { Combatant, TeamId, Position, AbilityScores } from '../src/engine/types.js';

let counter = 0;

export function makeCombatant(over: Partial<Combatant> & { team: TeamId; position: Position }): Combatant {
  const abilities: AbilityScores = { str: 16, dex: 13, con: 16, int: 10, wis: 12, cha: 8 };
  return {
    id: over.id ?? `c${++counter}`,
    name: over.name ?? over.id ?? `c${counter}`,
    team: over.team,
    classId: 'fighter',
    speciesId: 'human',
    level: 1,
    abilities,
    maxHp: 13,
    hp: 13,
    ac: 17,
    speed: 30,
    position: over.position,
    initiative: 0,
    savingThrowProfs: ['str', 'con'],
    spellSlots: [],
    featureUses: {},
    weaponIds: ['longsword', 'javelin'],
    conditions: [],
    turn: {
      actionUsed: false, bonusActionUsed: false, reactionUsed: false,
      movementUsed: 0, movementMax: 30, disengaged: false, sneakAttackUsed: false,
    },
    alive: true,
    ...over,
  };
}
