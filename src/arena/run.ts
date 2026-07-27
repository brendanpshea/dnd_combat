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
import type { Id } from '../engine/types.js';
import type { RngState } from '../engine/rng.js';
import { generateEncounter, type GeneratedEncounter } from './encounter.js';
import { generateArenaMap } from './map.js';

/**
 * Adjusted-XP budget for a roughly even fight, by party level. Every entry is
 * now measured directly at 150 fights (about +/-4 points), rather than three
 * measured and two interpolated — the interpolation is what hid the last drift.
 *
 * Re-measured after a playthrough sweep found that no party of any composition
 * reached level 5: runs died at wave 4-5, every time. The curve had gone
 * non-monotonic, level 1 winning 77% of its "even" fights and level 2 winning
 * 38% of its, so a run breezed the first level and hit a wall on the second.
 * Levels 3 and 5 were still honest; 1, 2 and 4 were not.
 *
 * RE-MEASURE THIS WHEN THE BESTIARY CHANGES SHAPE. The first calibration was
 * taken against a 58-monster roster and quietly went stale as that grew to
 * 132: by the time it was next checked the party was winning 78% at the L3
 * "even" budget and 65% at L5, so every wave was softer than the ramp claimed.
 * Adding monsters changes what a budget buys, and nothing in the test suite
 * notices — the constants are a measurement, not a rule, and they decay.
 */
/**
 * 6th and 7th were measured the same way the tripwire measures — greedy on both
 * sides, N=40, the seeds the test uses — so all seven numbers mean the same
 * thing. 21,000 and 24,000, a 35% and 55% step over 5th.
 *
 * 3rd moved from 5,700 to 6,200 in the same pass. Exposing upcasting (see
 * legalActions) handed every caster a use for spare high slots, which was worth
 * about eight points of win rate at 3rd and pushed the old number onto the
 * failing side of the tripwire. That is the mechanism this whole comment is
 * about: a change nowhere near this file moved what a budget buys.
 *
 * These will want re-measuring again the moment the class features for 6th and
 * 7th land, since half the party currently gains only hit points across those
 * two levels.
 *
 * 4th, 5th, 6th and 7th moved again when six spells were corrected against the
 * SRD to require Concentration — Sleep, Suggestion, Spiritual Weapon, Shining
 * Smite, Ensnaring Strike and Banishment. The party holds nearly every
 * concentration spell in the game and the monsters hold almost none, so a rule
 * that applies to both sides is in practice a party nerf, and only at the tiers
 * where the party has the spells: measured at N=150, 1st through 3rd did not
 * move at all (42.7 -> 42.0, 56.7 -> 58.7, 40.7 -> 41.3) while 5th fell 45.3 ->
 * 36.7 and 4th and 7th fell about six points each.
 *
 * 8,800 -> 8,000, 15,500 -> 14,000, 21,000 -> 20,000, 24,000 -> 23,000, which
 * puts all seven back in a 42-59% band. Note how lumpy the high end is: at 6th,
 * 21,000 reads 32.7% and 19,000 reads 56.0%, because 2,000 XP up there is one
 * more monster. The number between them is not a fine adjustment, it is the
 * only place to stand.
 */
export const EVEN_BUDGET = [1500, 2600, 6200, 8000, 14000, 20000, 23000];

export function evenBudgetFor(level: number): number {
  const i = Math.min(Math.max(level, 1), EVEN_BUDGET.length) - 1;
  return EVEN_BUDGET[i]!;
}

/**
 * How hard a wave should be, as a share of the even-fight budget.
 *
 * Wave 1 opens well under an even fight so a run doesn't die on the doorstep,
 * and the ramp keeps climbing — so a run has a natural end, found by the player
 * rather than imposed by a wave cap.
 *
 * The slope was 0.09, crossing "even" at wave 6, and that made the level cap
 * unreachable: the XP curve needs about fourteen cleared waves to reach level
 * 5, and at 0.09 the median run died at wave 7 with one run in twenty getting
 * there at all. The two curves were racing and the ramp won.
 *
 * At 0.03 it crosses even around wave 16 instead, and measured over twenty
 * playthroughs the median run reaches wave 14 and a quarter reach wave 18 —
 * which is where a party would cross the level 6 threshold (14,000 XP) once
 * that level exists. The nice property of this slope is that the cap and the
 * even point arrive together: you finish levelling right as the fights stop
 * being winnable on average, so the last stretch of a run is the hard part
 * rather than the middle being a wall.
 *
 * Re-measure with `npx tsx scripts/playtest.ts` after changing the XP curve or
 * adding a level — the two are coupled, and only the playtest sees it.
 */
export function waveDifficulty(wave: number): number {
  return 0.55 + 0.03 * (wave - 1);
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
// Level 1 held 3 for a while and it made the level a walkover: with a 200 XP
// member cap, three bodies is the most the generator can field and it tops out
// around 1,160 adjusted XP — well under the budget, so the wave ramp stopped
// meaning anything past wave 4 and the party won 77% of "even" fights. A
// fourth body brings it to 51%. The cap is still doing its job; it was simply
// one body too tight.
const COUNT_CAP = [4, 4, 5];

export function maxCountFor(level: number): number {
  return COUNT_CAP[Math.max(1, level) - 1] ?? 6;
}

export function waveBudget(level: number, wave: number): number {
  return Math.round(evenBudgetFor(level) * waveDifficulty(wave));
}

/**
 * Gold paid for clearing a wave — the shop between fights is the point of it.
 *
 * Came down from `40 + budget * 0.02` when bounties arrived. Bounties are not
 * new income, they are the same income made conditional: a wave offers two, each
 * paying a share of this purse, and the shares average 0.41. Dividing the old
 * formula by 1.41 therefore puts a player who claims about one of the two right
 * where the old purse left them. Ignore both and you are a little poorer; take
 * both and you are a little richer, which is the whole point.
 *
 * Scaled rather than shifted so the *shape* of the curve is unchanged — the
 * stall still gets dearer as the waves do, and bounties scale with it.
 */
export function wavePurse(level: number, wave: number): number {
  return Math.round(28 + waveBudget(level, wave) * 0.0142);
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
  /**
   * Leveled spells the party has cast at any point this run — what the
   * "Something New" bounty is measured against. A list rather than a Set so
   * the run state stays plain JSON for the save file.
   */
  spellsUsed: Id[];
  /** Bounties claimed, for the run summary. */
  bounties: number;
}

export function newArenaRun(seed: number): ArenaRunState {
  return {
    seed, wave: 1, cleared: 0, clearedFirstTry: 0, attempts: 0, fights: 0, wins: 0,
    gold: 0, spellsUsed: [], bounties: 0,
  };
}

/** Record an attempt at the current wave. A win advances; a loss stays put. */
export function recordResult(
  run: ArenaRunState, won: boolean, purse: number,
  learned: { spellsUsed?: Id[]; bounties?: number } = {},
): ArenaRunState {
  const fights = run.fights + 1;
  const wins = run.wins + (won ? 1 : 0);
  // A spell tried in a fight you lost is still a spell you have tried, so this
  // accumulates either way — otherwise a retry could re-claim Something New
  // with the spell that failed the first time.
  const spellsUsed = [...new Set([...run.spellsUsed, ...(learned.spellsUsed ?? [])])];
  const bounties = run.bounties + (learned.bounties ?? 0);
  run = { ...run, spellsUsed, bounties };
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

