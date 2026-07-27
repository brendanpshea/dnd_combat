/**
 * Conjured allies: a real combatant, brought onto the board mid-fight.
 *
 * Everything else the game calls a "summon" is a marker — a Spiritual Weapon
 * and a Flaming Sphere are entries in `Combatant.summons`, a position and a
 * kind, animated by `activateSummons` on the caster's turn. That is the right
 * shape for a floating hammer and the wrong shape for a snake: a snake has hit
 * points, an AC, a stat block, its own place in the initiative order, and can
 * be killed. It is a combatant, so it is built as one.
 *
 * THREE THINGS MAKE THIS SAFE, and each of them is a way it went wrong first.
 *
 * It does not decide the fight. `checkWinner` skips anything with `summonedBy`
 * set: a party face-down on the floor has lost even if its snake is up, and
 * counting one would hang the game exactly the way the both-sides-down case
 * used to.
 *
 * It acts on its own. The SRD lets you command it, and a per-combatant control
 * flag would mean a fifth character sheet on a phone screen for a creature
 * whose whole job is "bite the nearest thing". `actsOnItsOwn` marks it, and the
 * frontend runs the same AI over it that it runs over the monsters.
 *
 * It never reaches the campaign. A summon in a survivor list would be read back
 * into the party roster, and the arena would carry a snake between waves
 * forever. `livingParty` is the filter every boundary uses.
 */
import type { GameState, Combatant, Id, Position, TeamId } from '../types.js';
import type { GameEvent } from '../events.js';
import { cellAt } from '../types.js';
import { buildMonster } from '../../data/monsters.js';
import { blocksMovement } from '../grid.js';

/**
 * Does this creature run itself?
 *
 * True for conjured allies. The frontend ORs this with its own "is this team
 * played by the computer" test, so a summoned snake on the player's side is
 * driven by the AI while the player's own characters are not.
 */
export function actsOnItsOwn(c: Combatant): boolean {
  return c.summonedBy !== undefined;
}

/**
 * The combatants that count as a side's real roster — everything it brought,
 * and nothing it conjured. Used wherever a fight's survivors flow back into
 * something persistent.
 */
export function livingParty(state: GameState, team: TeamId): Combatant[] {
  return Object.values(state.combatants).filter((c) => c.team === team && !actsOnItsOwn(c));
}

/** The nearest unoccupied, walkable cell to `at`, searched outward. */
function freeCellNear(state: GameState, at: Position): Position | undefined {
  const { width, height } = state.grid;
  for (let r = 0; r <= Math.max(width, height); r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        // Only the ring at radius r, so nearer cells are always tried first.
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const p = { x: at.x + dx, y: at.y + dy };
        if (p.x < 0 || p.y < 0 || p.x >= width || p.y >= height) continue;
        const cell = cellAt(state.grid, p);
        if (!cell || cell.occupantId !== undefined || blocksMovement(cell.terrain)) continue;
        return p;
      }
    }
  }
  return undefined;
}

export interface SummonOptions {
  monsterId: Id;
  summonerId: Id;
  /** Where it wants to appear; the nearest free cell to this is used. */
  near: Position;
  /** Id prefix, so two snakes from one staff do not collide. */
  idHint?: string;
}

/**
 * Put a conjured creature on the board, in initiative, ready to act.
 *
 * It takes its turn immediately after its summoner, which is what the SRD means
 * by "shares your Initiative count" and is also the only insertion point that
 * needs no arithmetic on `turnIndex`: the summoner is by definition the current
 * turn, so inserting at `turnIndex + 1` cannot move the index.
 *
 * Returns no events if there is nowhere to put it — a creature that cannot be
 * placed simply is not summoned, rather than being dropped inside a wall.
 */
export function summonCombatant(state: GameState, opts: SummonOptions): GameEvent[] {
  const summoner = state.combatants[opts.summonerId];
  if (!summoner) return [];
  const spot = freeCellNear(state, opts.near);
  if (!spot) return [];

  const id = `${opts.idHint ?? opts.monsterId}-${opts.summonerId}-${state.round}`;
  if (state.combatants[id]) return [];   // already out; one at a time

  const beast: Combatant = {
    ...buildMonster(opts.monsterId, summoner.team, spot),
    id,
    summonedBy: opts.summonerId,
  };
  state.combatants[id] = beast;
  const cell = cellAt(state.grid, spot);
  if (cell) cell.occupantId = id;

  // Straight after its summoner. Anywhere else and the index maths matters.
  const at = state.initiativeOrder.indexOf(opts.summonerId);
  if (at < 0) state.initiativeOrder.push(id);
  else state.initiativeOrder.splice(at + 1, 0, id);

  return [{ type: 'summoned', combatantId: id, summonerId: opts.summonerId, position: spot }];
}
