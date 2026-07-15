/**
 * AI arena: pit two policies against each other over seeded games and report
 * win rates. The empirical gate for any AI change — improvements are
 * measured, not vibed.
 */
import type { GameState, Id, TeamId } from '../engine/types.js';
import { Combat } from '../engine/combat.js';
import { buildParty } from '../builder/character.js';
import { MAP_IDS } from '../data/maps.js';
import type { Action } from '../engine/actions.js';

export type Policy = (state: GameState, actorId: Id) => Action;

export interface ArenaResult {
  games: number;
  aWins: number;
  bWins: number;
  stalls: number;
  aWinRate: number;
}

/**
 * Each seed is played twice with sides swapped (to cancel first-mover and
 * map asymmetries). Maps rotate through the pool; level rotates 1-3.
 */
export function runArena(a: Policy, b: Policy, seeds: number[], maxSteps = 4000): ArenaResult {
  let aWins = 0;
  let bWins = 0;
  let stalls = 0;
  let games = 0;

  for (const seed of seeds) {
    for (const aTeam of ['team1', 'team2'] as TeamId[]) {
      const mapId = MAP_IDS[seed % MAP_IDS.length]!;
      const level = (seed % 3) + 1;
      const combat = new Combat({
        seed,
        mapId,
        combatants: [...buildParty('team1', 0, level), ...buildParty('team2', 7, level)],
      });
      let steps = 0;
      while (!combat.isOver() && steps++ < maxSteps) {
        const actor = combat.activeId;
        const team = combat.state.combatants[actor]!.team;
        const policy = team === aTeam ? a : b;
        combat.apply(policy(combat.state, actor));
      }
      games++;
      const winner = combat.winner();
      if (winner === null) stalls++;
      else if (winner === aTeam) aWins++;
      else bWins++;
    }
  }
  return { games, aWins, bWins, stalls, aWinRate: aWins / games };
}
