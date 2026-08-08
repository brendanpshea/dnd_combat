/**
 * What each square you could walk to would cost you to reach.
 *
 * THE INFORMATION EXISTED AND NOBODY COULD SEE IT.
 *
 * `readWalk` has always been able to say, for any destination, who gets a free
 * swing at you on the way and how much of the map's hazard you would wade
 * through — along the exact route the engine will walk. It was read at one
 * moment only: after the tap, to raise a confirm dialog. So the player learned
 * about the fire by being asked whether they meant it, and learned about the
 * fire they had *already* been walked through not at all (the dialog only fired
 * on opportunity attacks).
 *
 * A blue region where every square looks equally free is a promise the board
 * cannot keep. This colours it: clean, costly, or possibly fatal. The tap
 * confirm is still there for the last two — this is what stops it being a
 * surprise.
 */
import type { GameState, Combatant, Position } from '../../src/engine/types.js';
import { readWalk } from '../../src/engine/rules/movement.js';

export type RiskLevel = 'risky' | 'lethal';

export interface MoveRisk {
  level: RiskLevel;
  /** Worst case, in hit points: every opportunity attack landing, plus hazards. */
  damage: number;
  /** Plain sentence for the badge's title and the cell's screen-reader label. */
  why: string;
}

/** Worst case is never crits — see `worstCaseWalkDamage` for why. */
export function riskOfWalk(state: GameState, mover: Combatant, to: Position): MoveRisk | undefined {
  const walk = readWalk(state, mover, to);
  const swings = walk.provokers.reduce((sum, p) => sum + p.maxDamage, 0);
  const damage = swings + walk.hazardDamage;
  if (damage <= 0) return undefined;
  const parts: string[] = [];
  if (walk.provokers.length > 0) {
    // Names, not a count. "2 free attacks" is a number; "the gnoll and the
    // ogre get a free attack" is the board you are looking at.
    const names = walk.provokers.map((p) => p.name);
    const list = names.length === 1 ? names[0]
      : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
    parts.push(`${list} get${names.length === 1 ? 's' : ''} a free attack`);
  }
  if (walk.hazardDamage > 0) parts.push('the route crosses a hazard');
  return {
    level: damage >= mover.hp ? 'lethal' : 'risky',
    damage,
    why: `${parts.join(', and ')} — up to ${damage} damage`,
  };
}

/** The same read across a whole set of offered destinations. */
export function moveRisks(
  state: GameState,
  mover: Combatant,
  cells: Iterable<string>,
): Map<string, MoveRisk> {
  const out = new Map<string, MoveRisk>();
  for (const k of cells) {
    const [x, y] = k.split(',').map(Number) as [number, number];
    const risk = riskOfWalk(state, mover, { x, y });
    if (risk) out.set(k, risk);
  }
  return out;
}
