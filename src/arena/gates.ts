/**
 * Arena gates: three doors before every wave, and you pick one.
 *
 * The arena's loop was a queue — the next wave was the next wave, and the only
 * decision on the pre-wave screen was what to buy. A gate turns that into a
 * choice made with information: three fights, each with its roster, its ground
 * and its bounties on the card, and you commit to one.
 *
 * WHY THE DOORS DIFFER BY GROUND AND NOT BY COMPOSITION.
 *
 * The first cut of this file forced a *shape* on each door — a swarm of small
 * things, a mixed warband, one big champion — which is the more interesting
 * axis and turned out to be one this game cannot price. Measured at level 3,
 * N=200 per shape, greedy on both sides, all three at the same 6,200 budget:
 *
 *   warband   40.5%      swarm   24.5%      champion   56.0%
 *
 * A 31-point spread at identical XP, because 5e's group multiplier badly
 * under-prices a crowd (the same effect documented at COUNT_CAP in run.ts).
 * Per-shape budget multipliers fixed level 3 — 0.83 and 1.15 brought all three
 * to about 41% — and then failed everywhere else, because the champion cannot
 * spend its budget at the ends of the level range: 29% of it at level 1, where
 * `memberCapFor` deliberately blocks any monster big enough to headline, and
 * 61% at level 7, where the roster runs out at 7,200 XP. No multiplier fixes a
 * budget that cannot be spent.
 *
 * Creature type is worse still. Same method, forcing one type per fight:
 *
 *   fey 4%   beast 14%   humanoid 17%   dragon 27%   giant 29%   construct 30%
 *   monstrosity 38%   fiend 41%   ooze 68%   elemental 72%   aberration 73%
 *   undead 79%
 *
 * A 75-point spread. XP misprices creature type enormously.
 *
 * Ground is the flattest axis available. Same method, forcing a layout, N=150:
 *
 *   crossfire 38.0%   pillars 39.3%   open 39.3%   ruin 41.3%
 *   chokepoint 44.0%   redoubt 50.7%
 *
 * A 13-point spread, against 31 for shape and 75 for creature type. Four of the
 * six sit within three points of each other; the redoubt really is a friendlier
 * board, and is left in because a 13-point spread is a texture the player can
 * see and read off the card, where a 75-point one is a lottery they cannot.
 *
 * (The shape and type tables above were taken before the chokepoint fix in
 * map.ts — which is to say, on a board distribution that was missing its
 * heaviest layout. Their absolute values would move a little if retaken; the
 * spreads, which are the whole finding, would not.)
 *
 * So the doors are built on ground: each is an independent draw from exactly
 * the distribution a wave already came from, differing in the board it is
 * fought on. What varies between doors beyond that is whatever the generator
 * rolled, and that is plenty — the roster is the widest variable in the game,
 * which is precisely what those first two tables measure.
 *
 * THE HONEST CAVEAT. Three draws and a pick is easier than one draw and no
 * pick, however flat the axis, because the choice itself is worth something —
 * and it is supposed to be. That is priced in `waveDifficulty`, not here.
 */
import type { LayoutName } from './map.js';
import { type ArenaWave, type DayHalf, buildWave } from './run.js';
import { next, type RngState } from '../engine/rng.js';

/** What the ground looks like, for the door's card. */
const GROUND: Record<LayoutName, { name: string; blurb: string }> = {
  chokepoint: { name: 'The Breach', blurb: 'A wall across the middle, with two ways through.' },
  pillars: { name: 'The Colonnade', blurb: 'Broken pillars. No sightline stays safe for long.' },
  redoubt: { name: 'The Redoubt', blurb: 'A barricade ring in the middle, strong from the front.' },
  crossfire: { name: 'The Gauntlet', blurb: 'Barricades down both flanks, an open lane between.' },
  ruin: { name: 'The Ruin', blurb: 'A fallen block, and two uneven lanes around it.' },
  open: { name: 'The Killing Floor', blurb: 'Open ground. Almost nothing to hide behind.' },
};
const LAYOUT_NAMES = Object.keys(GROUND) as LayoutName[];

export interface Gate {
  /** 0, 1 or 2 — the door's index, and what the run persists. */
  door: number;
  name: string;
  blurb: string;
  layout: LayoutName;
  wave: ArenaWave;
}

/** How many doors a wave offers. */
export const GATE_COUNT = 3;

/**
 * The doors for a wave.
 *
 * Seeded off the run, the wave and the half — so the afternoon is three
 * different doors from the morning's, at the same budget, and a retry offers
 * the same three: a wave you lost is a tactical problem, not a
 * slot machine to reroll until an easy door turns up. The grounds are drawn
 * without replacement, because three doors onto the same board is one door.
 */
export function gatesFor(
  runSeed: number, level: number, wave: number, half: DayHalf = 'morning',
): Gate[] {
  let rng: RngState =
    (runSeed * 40503 + wave * 2654435761 + (half === 'afternoon' ? 2166136261 : 0)) >>> 0;
  const roll = () => { const r = next(rng); rng = r.state; return r.value; };

  const layouts = [...LAYOUT_NAMES];
  const gates: Gate[] = [];
  for (let door = 0; door < GATE_COUNT; door++) {
    const layout = layouts.splice(Math.floor(roll() * layouts.length), 1)[0]!;
    gates.push({
      door,
      name: GROUND[layout].name,
      blurb: GROUND[layout].blurb,
      layout,
      wave: buildWave(runSeed, level, wave, layout, door, half),
    });
  }
  return gates;
}

/** The door a run has committed to, defaulting to the first. */
export function gateFor(gates: Gate[], door: number | undefined): Gate {
  return gates[door ?? 0] ?? gates[0]!;
}

/**
 * Whether the party is locked into a door.
 *
 * Committing happens by *losing*, not by choosing: you may compare the three
 * and change your mind freely until the first attempt, and after that the wave
 * is the one you failed. Same rule the wave's seed and its bounties already
 * follow — a defeat is a problem to solve, and walking back to take an easier
 * door would make it a reroll instead.
 */
export function gateLocked(attempts: number): boolean {
  return attempts > 0;
}
