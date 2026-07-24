/**
 * The Training Yard: a fixed, gentle first battle with a step-by-step coach that
 * walks a total newcomer through the whole toolkit — move, melee, a ranged
 * cantrip, a leveled spell, and a heal — by actually doing each one. It's guided
 * but never hard-railed: you can tap anything, and the coach simply advances
 * when the engine reports you did the thing it asked (each step keys off the
 * same events the rest of the UI reads, so there are no engine or rules changes).
 *
 * The party is a Fighter, a Wizard, and a Cleric so every common action has a
 * natural owner, and Rurik the fighter starts wounded so a heal always has a
 * target. Four kobolds on open ground keep the fight alive long enough to try
 * each mechanic, while staying comfortably winnable — and if a bold player
 * clears the yard early, the coach rides the victory to its finish.
 */
import { Combat } from '../../src/engine/combat.js';
import { buildCharacter } from '../../src/builder/character.js';
import { buildMonster } from '../../src/data/monsters.js';
import { WEAPONS } from '../../src/data/weapons.js';
import { SPELLS } from '../../src/data/spells.js';
import type { GameEvent } from '../../src/engine/events.js';
import type { GameState, Id, TeamId } from '../../src/engine/types.js';

export interface CoachStep {
  text: string;
  /** Advance to the next step when this turn's events satisfy it. `isPlayer`
   *  is true for a human-controlled combatant. */
  done: (events: GameEvent[], state: GameState, isPlayer: (id: Id) => boolean) => boolean;
}

const TRAINING_SEED = 424242;

/** A brand-new player's first fight: Fighter + Wizard + Cleric vs four kobolds
 *  on an open field. The heroes start a rank back so closing the distance
 *  teaches move-then-attack, and Rurik begins wounded so the Cleric's heal has
 *  an obvious mark. */
export function makeTrainingCombat(): { combat: Combat; aiTeams: Set<TeamId> } {
  const rurik = buildCharacter({ classId: 'fighter', team: 'team1', level: 1, name: 'Rurik', position: { x: 3, y: 1 }, speciesId: 'human' });
  // Start the fighter scuffed so "heal a hurt ally" has a target from turn one.
  rurik.hp = Math.min(rurik.hp, 5);
  const heroes = [
    rurik,
    buildCharacter({ classId: 'wizard', team: 'team1', level: 1, name: 'Elsa', position: { x: 1, y: 0 }, speciesId: 'human' }),
    buildCharacter({ classId: 'cleric', team: 'team1', level: 1, name: 'Brother Alden', position: { x: 5, y: 0 }, speciesId: 'human' }),
  ];
  const foes = [
    buildMonster('kobold', 'team2', { x: 1, y: 6 }, '1'),
    buildMonster('kobold', 'team2', { x: 3, y: 7 }, '2'),
    buildMonster('kobold', 'team2', { x: 5, y: 6 }, '3'),
    buildMonster('kobold', 'team2', { x: 6, y: 7 }, '4'),
  ];
  const combat = new Combat({ seed: TRAINING_SEED, mapId: 'open', combatants: [...heroes, ...foes] });
  return { combat, aiTeams: new Set<TeamId>(['team2']) };
}

// --- Step predicates: each reads the events of a single confirmed action. ----

const playerMoved = (e: GameEvent[], isP: (id: Id) => boolean) =>
  e.some((x) => x.type === 'moved' && isP(x.combatantId));

/** A melee weapon swing (a pure-melee weapon has no range band) — distinct from
 *  a ranged cantrip or a thrown attack. */
const playerMeleeAttack = (e: GameEvent[], isP: (id: Id) => boolean) =>
  e.some((x) => x.type === 'attackRolled' && isP(x.attackerId) && !!WEAPONS[x.weaponId]?.melee && !WEAPONS[x.weaponId]?.range);

const playerCantrip = (e: GameEvent[], isP: (id: Id) => boolean) =>
  e.some((x) => x.type === 'spellCast' && isP(x.casterId) && SPELLS[x.spellId]?.level === 0);

/** Any leveled spell that isn't a heal — Magic Missile, Burning Hands, Bless,
 *  Command… — so the "spend a slot" lesson stays separate from the heal lesson. */
const HEAL_SPELLS = new Set<Id>(['cure-wounds', 'healing-word', 'mass-healing-word', 'prayer-of-healing']);
const playerLeveledSpell = (e: GameEvent[], isP: (id: Id) => boolean) =>
  e.some((x) => x.type === 'spellCast' && isP(x.casterId) && (SPELLS[x.spellId]?.level ?? 0) >= 1 && !HEAL_SPELLS.has(x.spellId));

const playerHealed = (e: GameEvent[], isP: (id: Id) => boolean) =>
  e.some((x) => x.type === 'healed' && isP(x.sourceId) && x.amount > 0);

const playerEndedTurn = (e: GameEvent[], isP: (id: Id) => boolean) =>
  e.some((x) => x.type === 'turnEnded' && isP(x.combatantId));

/**
 * The curriculum. Every step names the hero and the exact tap, but the gate is
 * the *mechanic*, not the hero — so on a turn where the asked-for action doesn't
 * fit the active hero, the player just attacks or ends the turn and the coach
 * waits patiently for the right moment. A finished fight always completes the
 * whole script (the driver in App forces it on `combatEnded`), so racing ahead
 * never strands the banner.
 */
export const TRAINING_COACH: CoachStep[] = [
  {
    text: '👋 Welcome to the training yard! The bobbing gold arrow marks whose turn it is — Rurik the fighter is up. Tap a glowing blue tile to march him toward a kobold.',
    done: (e, _s, isP) => playerMoved(e, isP),
  },
  {
    text: '⚔️ Melee attack: once Rurik is right beside a kobold, tap the enemy (its red ring) and confirm to swing his sword.',
    done: (e, _s, isP) => playerMeleeAttack(e, isP),
  },
  {
    text: '➤ Rurik has used his action. Tap End turn to pass the initiative along — turns cycle through your heroes and the kobolds in order.',
    done: (e, _s, isP) => playerEndedTurn(e, isP),
  },
  {
    text: '🔥 Ranged cantrip: when it\'s a caster\'s turn, open the 🔮 spell bar and fling a free at-will cantrip — Elsa\'s Fire Bolt (or Alden\'s Sacred Flame) hits from clear across the field, no need to close in.',
    done: (e, _s, isP) => playerCantrip(e, isP),
  },
  {
    text: '✨ Leveled spell: cantrips are free, but spell slots power your best magic. On Elsa\'s turn, spend a slot on Magic Missile — three darts that auto-hit for guaranteed damage. (Her slot pips sit under her name.)',
    done: (e, _s, isP) => playerLeveledSpell(e, isP),
  },
  {
    text: '💚 Heal: Rurik is bloodied. On Brother Alden\'s turn, step beside Rurik and cast Cure Wounds from the 🔮 bar to patch him back up — keeping the party standing wins fights.',
    done: (e, _s, isP) => playerHealed(e, isP),
  },
  {
    text: '🎉 That\'s the whole toolkit — move, strike, cantrip, spell, and heal. Finish off the kobolds and clear the yard. You\'ve got this!',
    done: (e) => e.some((x) => x.type === 'combatEnded'),
  },
];
