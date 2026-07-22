/**
 * The Training Yard: a fixed, gentle first battle with a step-by-step coach.
 * Two heroes against two kobolds on open ground, easy AI, a fixed seed — so a
 * total newcomer learns the move → attack → end-turn loop by doing it, guided
 * but never hard-railed (you can tap anything; the coach just advances when you
 * do the thing it asked, and its text covers the "not in range yet" case).
 *
 * It's a real `Combat` driven by the shared <Battle>, plus a `CoachStep[]` the
 * battle steps through off the same events everything else reads — no engine or
 * rules changes, and nothing here is module- or content-specific.
 */
import { Combat } from '../../src/engine/combat.js';
import { buildCharacter } from '../../src/builder/character.js';
import { buildMonster } from '../../src/data/monsters.js';
import type { GameEvent } from '../../src/engine/events.js';
import type { GameState, Id, TeamId } from '../../src/engine/types.js';

export interface CoachStep {
  text: string;
  /** Advance to the next step when this turn's events satisfy it. `isPlayer`
   *  is true for a human-controlled combatant. */
  done: (events: GameEvent[], state: GameState, isPlayer: (id: Id) => boolean) => boolean;
}

const TRAINING_SEED = 424242;

/** A brand-new player's first fight: Fighter + Wizard vs two kobolds, open
 *  field, so heroes must close the distance (teaching move-then-attack) and
 *  the fight is comfortably winnable. */
export function makeTrainingCombat(): { combat: Combat; aiTeams: Set<TeamId> } {
  const heroes = [
    buildCharacter({ classId: 'fighter', team: 'team1', level: 1, name: 'Rurik', position: { x: 3, y: 0 }, speciesId: 'human' }),
    buildCharacter({ classId: 'wizard', team: 'team1', level: 1, name: 'Elsa', position: { x: 5, y: 0 }, speciesId: 'human' }),
  ];
  const foes = [
    buildMonster('kobold', 'team2', { x: 3, y: 7 }, '1'),
    buildMonster('kobold', 'team2', { x: 5, y: 7 }, '2'),
  ];
  const combat = new Combat({ seed: TRAINING_SEED, mapId: 'open', combatants: [...heroes, ...foes] });
  return { combat, aiTeams: new Set<TeamId>(['team2']) };
}

const playerMoved = (e: GameEvent[], isP: (id: Id) => boolean) =>
  e.some((x) => x.type === 'moved' && isP(x.combatantId));
const playerActed = (e: GameEvent[], isP: (id: Id) => boolean) =>
  e.some((x) => (x.type === 'attackRolled' && isP(x.attackerId)) || (x.type === 'spellCast' && isP(x.casterId)));

/** The coach walks the loop once, then turns the player loose to finish. Each
 *  step is tolerant — it also advances on a later action — so a ranged opener
 *  or an out-of-range turn never strands the player on a step they can't clear. */
export const TRAINING_COACH: CoachStep[] = [
  {
    text: '👋 Welcome to the training yard! The bobbing gold arrow shows whose turn it is. Tap a glowing blue tile to move a hero toward a kobold.',
    done: (e, _s, isP) => playerMoved(e, isP) || playerActed(e, isP),
  },
  {
    text: '⚔️ Now attack — step beside a kobold and tap it (the red ring), then confirm. Elsa the wizard can also fling Fire Bolt from range using the 🔮 action bar.',
    done: (e, _s, isP) => playerActed(e, isP),
  },
  {
    text: '➤ You\'ve acted. When your hero is done, tap End turn to pass the initiative to the enemy — then it\'s the kobolds\' move.',
    done: (e, _s, isP) => e.some((x) => x.type === 'turnEnded' && isP(x.combatantId)),
  },
  {
    text: '🎉 That\'s the whole loop: move, attack, end turn. Keep it up and clear the yard — you\'ve got this.',
    done: (e) => e.some((x) => x.type === 'combatEnded'),
  },
];
