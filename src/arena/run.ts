/**
 * The arena run: a series of generated fights at an escalating budget, with a
 * full rest and a shop between each.
 *
 * DIFFICULTY IS MEASURED, NOT GUESSED. `EVEN_BUDGET` below is the adjusted-XP
 * budget at which a standard party wins about half its fights, taken by
 * simulating generated encounters against the greedy AI (see
 * test/arena.test.ts, which re-checks the shape of the curve). Levels 1 and 3
 * are measured directly; the rest interpolate on the geometric fit between
 * them, because a full sweep at level 5 costs more compute than it's worth for
 * a number the wave ramp re-tunes anyway.
 *
 * Full rest between waves is deliberate: it removes attrition as a difficulty
 * axis, which makes every wave an independent tactical problem and — the
 * reason it matters here — makes the win rate a clean measurement instead of a
 * number confounded by how much healing was left over from wave three.
 */
import type { MapData } from '../data/maps.js';
import type { RngState } from '../engine/rng.js';
import { generateEncounter, type GeneratedEncounter } from './encounter.js';
import { generateArenaMap } from './map.js';

/**
 * Adjusted-XP budget for a roughly even fight, by party level. L1, L3 and L5
 * are simulator-measured 50% win points (80 fights each, so about +/-6 points:
 * 48%, 45%, 49%). L2 and L4 sit on the geometric curve through them.
 *
 * RE-MEASURE THIS WHEN THE BESTIARY CHANGES SHAPE. The first calibration was
 * taken against a 58-monster roster and quietly went stale as that grew to
 * 132: by the time it was next checked the party was winning 78% at the L3
 * "even" budget and 65% at L5, so every wave was softer than the ramp claimed.
 * Adding monsters changes what a budget buys, and nothing in the test suite
 * notices — the constants are a measurement, not a rule, and they decay.
 */
export const EVEN_BUDGET = [1500, 2900, 5700, 9400, 15500];

export function evenBudgetFor(level: number): number {
  const i = Math.min(Math.max(level, 1), EVEN_BUDGET.length) - 1;
  return EVEN_BUDGET[i]!;
}

/**
 * How hard a wave should be, as a share of the even-fight budget.
 *
 * Wave 1 opens well under an even fight so a run doesn't die on the doorstep,
 * and the ramp crosses "even" around wave 6 and keeps climbing — so a run has
 * a natural end, found by the player rather than imposed by a wave cap.
 */
export function waveDifficulty(wave: number): number {
  return 0.55 + 0.09 * (wave - 1);
}

/**
 * The dearest single monster a party of this level should ever meet.
 *
 * Roughly one CR band above the party, which is where a hit stops being a
 * threat and starts being a coin flip on whether a character still exists.
 * Uncapped from level 5, because by then the squishiest hero has the HP to
 * survive a big one and the CR 6-10 shelf is the point of the late waves.
 */
const MEMBER_CAP = [200, 1100, 2300, 3900];
// Level 1 sits a whole band lower than the pattern would suggest (200, not
// 450). Measured: at 450 the generator still fields gargoyle pairs and
// wyrmling pairs, which the party loses 85-100% of the time — the gargoyle
// resists all three physical damage types and a level-1 party owns nothing
// else, and a wyrmling's breath covers more hit points than the whole party
// has. Dropping the band took level-1 fights the party loses more often than
// it wins from 14 in 48 to 4 in 48.

export function memberCapFor(level: number): number {
  return MEMBER_CAP[Math.max(1, level) - 1] ?? Infinity;
}

/**
 * The most bodies a party of this level should ever face.
 *
 * 5e's group multiplier (x2 for three to six monsters) badly under-prices a
 * crowd against low-level heroes, and the measurements are not close:
 *
 *   six giant badgers   600 adjusted XP   party wins 25%
 *   five orcs         1,000 adjusted XP   party wins 70%
 *
 * The cheaper fight is three times harder. With 7-13 HP a hero dies to any two
 * hits, so what matters is how many attacks arrive per round, and the
 * multiplier flattens exactly that. Capping headcount is a blunter instrument
 * than repricing the multiplier, but it is the one that acts on the quantity
 * actually doing the damage.
 */
const COUNT_CAP = [3, 4, 5];

export function maxCountFor(level: number): number {
  return COUNT_CAP[Math.max(1, level) - 1] ?? 6;
}

export function waveBudget(level: number, wave: number): number {
  return Math.round(evenBudgetFor(level) * waveDifficulty(wave));
}

/** Gold paid for clearing a wave — the shop between fights is the point of it. */
export function wavePurse(level: number, wave: number): number {
  return Math.round(40 + waveBudget(level, wave) * 0.02);
}

export interface ArenaWave {
  wave: number;
  encounter: GeneratedEncounter;
  map: MapData;
  /** Budget this wave was generated against, for display and for tests. */
  budget: number;
  purse: number;
}

/**
 * Build wave `n`. Seeded off the run seed and the wave number rather than a
 * rolling state, so a retry regenerates *the same fight* — a wave you failed is
 * a tactical problem to solve, not a slot machine to reroll until it's easy.
 */
export function buildWave(runSeed: number, level: number, wave: number): ArenaWave {
  // Mix the two so consecutive waves don't correlate.
  let rng: RngState = (runSeed * 2654435761 + wave * 40503) >>> 0;
  const budget = waveBudget(level, wave);
  const e = generateEncounter(
    { budget, maxMemberXp: memberCapFor(level), maxCount: maxCountFor(level), partyLevel: level },
    rng,
  ); rng = e.state;
  const m = generateArenaMap({}, rng); rng = m.state;
  return { wave, encounter: e.value, map: m.value.map, budget, purse: wavePurse(level, wave) };
}

export interface ArenaRunState {
  seed: number;
  /** The wave about to be fought (1-based). */
  wave: number;
  /** Waves cleared. */
  cleared: number;
  /** Waves cleared on the first attempt — the score that actually means
   *  something, since retries are unlimited. */
  clearedFirstTry: number;
  /** Attempts spent on the current wave (0 = not yet tried). */
  attempts: number;
  /** Total fights fought, for the run's win rate. */
  fights: number;
  /** Total fights won. */
  wins: number;
  gold: number;
}

export function newArenaRun(seed: number): ArenaRunState {
  return { seed, wave: 1, cleared: 0, clearedFirstTry: 0, attempts: 0, fights: 0, wins: 0, gold: 0 };
}

/** Record an attempt at the current wave. A win advances; a loss stays put. */
export function recordResult(run: ArenaRunState, won: boolean, purse: number): ArenaRunState {
  const fights = run.fights + 1;
  const wins = run.wins + (won ? 1 : 0);
  if (!won) {
    return { ...run, fights, wins, attempts: run.attempts + 1 };
  }
  return {
    ...run,
    fights,
    wins,
    cleared: run.cleared + 1,
    clearedFirstTry: run.clearedFirstTry + (run.attempts === 0 ? 1 : 0),
    wave: run.wave + 1,
    attempts: 0,
    gold: run.gold + purse,
  };
}

/** Win rate across every fight in the run, 0–1. Undefined before the first. */
export function winRate(run: ArenaRunState): number | undefined {
  return run.fights === 0 ? undefined : run.wins / run.fights;
}

/** A short human line for the run summary. */
export function runSummary(run: ArenaRunState): string {
  if (run.cleared === 0) return 'No waves cleared yet.';
  const rate = winRate(run);
  const pct = rate === undefined ? '' : ` · ${Math.round(rate * 100)}% of fights won`;
  return `${run.cleared} wave${run.cleared === 1 ? '' : 's'} cleared ` +
    `(${run.clearedFirstTry} first try)${pct}`;
}

