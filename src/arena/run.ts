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
import type { StallVisit } from './stall.js';
import type { GambitAttempt } from './gambit.js';
import type { RngState } from '../engine/rng.js';
import { generateEncounter, type GeneratedEncounter } from './encounter.js';
import { generateArenaMap, type LayoutName } from './map.js';

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
// Levels 1 and 2 re-measured after the spell-scoring sweep (1500 -> 1650,
// 2600 -> 2900). The AI
// now puts up wards and buffs it previously scored below a cantrip, so the same
// budget became an easier fight — 66% against a bound of "roughly even". This
// is the re-measurement the calibration test asks for by name when it fires,
// not a difficulty decision taken for its own sake.
// Level 9's 34000 is extrapolated, NOT measured: it continues the +5000 step
// the last two rungs take. The calibration test will say so when a run reaches
// level 9 often enough to measure, and this comment is what it is arguing with.
export const EVEN_BUDGET = [1650, 2900, 6200, 8000, 14000, 20000, 23000, 28000, 34000];

export function evenBudgetFor(level: number): number {
  const i = Math.min(Math.max(level, 1), EVEN_BUDGET.length) - 1;
  return EVEN_BUDGET[i]!;
}

/**
 * What choosing between three doors is worth, and what it costs.
 *
 * Gates (see gates.ts) offer three independent waves and let the player take
 * one. Even with the doors built on the one axis that is difficulty-flat, a
 * pick is worth a great deal. Measured at level 3, wave 16 (where the ramp
 * crosses even), 100 waves x 3 runs per door, greedy on both sides, the two
 * columns run on identical seeds so they are paired:
 *
 *                            no tax     at 1.03
 *   one door, no choice       46.3%       37.0%   <- what the arena used to be
 *   mean of the three         45.4%       41.7%
 *   fewest bodies             56.0%       49.3%   <- the obvious card heuristic
 *   best of three             75.0%       72.7%   <- always picks right
 *   worst of three            17.3%       11.7%   <- always picks wrong
 *
 * So a player applying the most obvious visible rule gains about ten points
 * over the old arena, and a perfect one nearly thirty. Left alone that is the
 * documented failure mode of this whole file arriving by a new route: every
 * wave quietly softer than EVEN_BUDGET claims, with nothing in the suite
 * noticing.
 *
 * 1.03 is a PARTIAL correction, on purpose. Budget is worth about 2.2 points of
 * win rate per 0.01 here, so this takes back roughly two thirds of what the
 * obvious heuristic gains and leaves the sensible chooser about three points
 * ahead of the old arena — while the careless one is a good deal worse off.
 * That gap is what the choice is *for*; pricing it away entirely would leave
 * three doors that are decoration.
 *
 * Re-measure alongside EVEN_BUDGET, and re-derive properly once the playtest
 * script models a door-choice policy. This is calibrated against a heuristic
 * chooser, which is a proxy for a player and not a player — which is also why
 * it is deliberately not tuned to the last decimal against that proxy.
 */
export const GATE_TAX = 1.03;

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
 * At 0.03 it crosses even around wave 16 instead. The nice property of this
 * slope is that the cap and the even point arrive together: you finish
 * levelling right as the fights stop being winnable on average, so the last
 * stretch of a run is the hard part rather than the middle being a wall.
 *
 * THAT SAID, THIS COMMENT WAS OUT OF DATE. It claimed the median run reached
 * wave 14 with a quarter reaching 18, measured over twenty playthroughs. Re-
 * measured at forty: the median run reaches wave 9. The drift is not from the
 * slope — it is everything else that has moved since (a bigger bestiary, six
 * spells corrected to require Concentration, a smaller wave purse when bounties
 * arrived), which is the same decay EVEN_BUDGET's comment warns about, landing
 * on a different constant. Recorded here rather than quietly corrected, because
 * "the playtest number is stale" is the useful thing to know.
 *
 * Gates did not move it: 40 playthroughs before and after both read a median of
 * 9, because the playtest drives waves directly and so pays GATE_TAX without
 * ever getting to choose a door. The tax and the chokepoint fix in map.ts —
 * which put a whole missing layout back into circulation — roughly cancel.
 *
 * Re-measure with `npx tsx scripts/playtest.ts` after changing the XP curve or
 * adding a level — the two are coupled, and only the playtest sees it. Forty
 * runs, not twenty: at twenty the median read 8 and 10 on the two branches that
 * both read 9 at forty.
 */
export function waveDifficulty(wave: number): number {
  return (0.55 + 0.03 * (wave - 1)) * GATE_TAX;
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

/**
 * Two fights to a day, and they share a wave number.
 *
 * The afternoon is NOT a harder wave — it is the same budget against a party
 * that has already spent a morning. Depletion is the ramp; making the wave
 * number climb as well would ramp it twice and stop "wave" meaning one thing.
 */
export type DayHalf = 'morning' | 'afternoon';

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
export function buildWave(
  runSeed: number, level: number, wave: number,
  layout?: LayoutName, door = 0, half: DayHalf = 'morning',
): ArenaWave {
  // Mix all of them so consecutive waves don't correlate, the doors of one
  // half are three different fights rather than three drafts of the same one,
  // and the afternoon is a different fight from the morning at the same budget.
  let rng: RngState =
    (runSeed * 2654435761 + wave * 40503 + door * 2246822519 +
      (half === 'afternoon' ? 1013904223 : 0)) >>> 0;
  const budget = waveBudget(level, wave);
  const e = generateEncounter(
    { budget, maxMemberXp: memberCapFor(level), maxCount: maxCountFor(level), partyLevel: level },
    rng,
  ); rng = e.state;
  const m = generateArenaMap(layout ? { layout } : {}, rng); rng = m.state;
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
  /**
   * Which of the quasit's lines this run has already heard (see chorus.ts).
   *
   * Kept in the run rather than in memory so "the first time you lose a day"
   * survives closing the tab — and so a fresh run gets the whole thing back,
   * which is right: the commentary is part of a run, not part of a save file
   * that accumulates forever.
   */
  heard?: string[];
  /**
   * This morning's trip to the stall — the haggle already made, the theft
   * already attempted, and the prices they left behind. Keyed to the day, so a
   * new day is a new merchant mood and closing the panel cannot reroll a failed
   * haggle. Absent = nobody has been to market yet.
   */
  stall?: StallVisit;
  /**
   * The one pre-fight skill check offered for this fight (see gambit.ts).
   *
   * Records its door for the same reason `creep` does: three gates hold three
   * rosters, so each draws its own question, and an attempt made at one gate
   * must not follow you through another. Without that, opening each door in
   * turn is a way to shop for a skill the party happens to be good at.
   */
  gambit?: GambitAttempt;
  /**
   * Which of the wave's three doors is selected (see gates.ts). Optional so a
   * save written before gates existed loads and simply starts on door 0.
   */
  gate?: number;
  /** Which half of the day is next. Absent = morning (and pre-day saves). */
  half?: DayHalf;
  /**
   * Days that have passed, failures included — the narrative clock. A defeat
   * ends the day and this advances: "come back tomorrow".
   *
   * Deliberately NOT what item cooldowns count. See `cleared`.
   */
  day?: number;
  /**
   * The party level this day's fights were generated at, frozen on arrival.
   *
   * Two things depend on it and both are load-bearing.
   *
   * A RETRY IS THE SAME PUZZLE. `buildWave` keys the encounter off the party's
   * level, so without this a party that gained a level while stuck would come
   * back to a *different* fight — the thing they had been learning would be
   * gone. Freezing the level is what makes "solve it" a coherent instruction.
   *
   * AND LEVELLING IS A REAL WAY OUT. `EVEN_BUDGET` is calibrated so each level
   * wins about half its fights at its own budget, which makes levelling exactly
   * neutral against a live-scaled wave — grinding could never help. Against a
   * frozen one it helps a great deal, which is the difficulty valve: lose
   * enough, win enough mornings, come back stronger to an unchanged problem.
   *
   * Cleared on a win, so the next day generates at the level you have now and
   * the valve closes behind you.
   */
  dayLevel?: number;
}

export function newArenaRun(seed: number): ArenaRunState {
  return {
    seed, wave: 1, cleared: 0, clearedFirstTry: 0, attempts: 0, fights: 0, wins: 0,
    gold: 0, spellsUsed: [], bounties: 0,
    half: 'morning', day: 1,
  };
}

/**
 * Advance the run past a finished fight.
 *
 * Four outcomes, and only two of them move the wave:
 *
 *   won the morning    -> afternoon, same wave, same frozen level, no rest
 *   won the afternoon  -> the day is cleared: next wave, tomorrow, level thaws
 *   lost either        -> back to the morning of the same wave, tomorrow
 *
 * A defeat costs the day, not the run: XP, gold and anything bought are kept,
 * and the two fights waiting tomorrow are byte-identical to the ones that just
 * beat you, because `dayLevel` pins them. That is what makes a hard day a
 * puzzle rather than a wall — and what makes grinding mornings for XP a real
 * way through it, since the problem does not grow with you.
 */
export function advanceDay(run: ArenaRunState, won: boolean, purse: number,
  learned: { spellsUsed?: Id[]; bounties?: number } = {},
): ArenaRunState {
  const half = run.half ?? 'morning';
  if (won && half === 'morning') {
    // Mid-day: nothing clears, nothing rests, the level stays frozen — but it
    // IS a fight, and it IS won.
    //
    // This first shipped by routing the won morning through `recordResult`'s
    // *loss* path, because that is the branch that leaves the wave alone. The
    // side effect was that every won morning was tallied as a defeat, and since
    // roughly half of all fights are mornings, the run reported a win rate near
    // a fifth of its real value. Nothing depended on the number at the time; a
    // medal graded on win rate does.
    return {
      ...noteLearned(run, learned),
      fights: run.fights + 1,
      wins: run.wins + 1,
      half: 'afternoon',
      gate: 0,
    };
  }
  if (won) {
    const next = recordResult(run, true, purse, learned);
    // The frozen level is *dropped*, not zeroed: tomorrow's fights generate at
    // whatever level the party is now, which is how the valve closes behind a
    // party that ground its way through.
    const { dayLevel: _thawed, ...cleared } = next;
    return { ...cleared, half: 'morning', day: (run.day ?? 1) + 1 };
  }
  // Lost. The day ends; tomorrow is the same day over again.
  const next = recordResult(run, false, 0, learned);
  return { ...next, half: 'morning', day: (run.day ?? 1) + 1, gate: 0 };
}

/**
 * Fold in what a fight taught the run, win or lose.
 *
 * A spell tried in a fight you lost is still a spell you have tried, so this
 * accumulates either way — otherwise a retry could re-claim Something New with
 * the spell that failed the first time.
 */
function noteLearned(
  run: ArenaRunState, learned: { spellsUsed?: Id[]; bounties?: number },
): ArenaRunState {
  return {
    ...run,
    spellsUsed: [...new Set([...run.spellsUsed, ...(learned.spellsUsed ?? [])])],
    bounties: run.bounties + (learned.bounties ?? 0),
  };
}

/** Record an attempt at the current wave. A win advances; a loss stays put. */
export function recordResult(
  run: ArenaRunState, won: boolean, purse: number,
  learned: { spellsUsed?: Id[]; bounties?: number } = {},
): ArenaRunState {
  const fights = run.fights + 1;
  const wins = run.wins + (won ? 1 : 0);
  run = noteLearned(run, learned);
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
    // A cleared wave releases the door: the next wave's three are a fresh
    // choice, and leaving the old index set would pre-select door 2 of 3.
    gate: 0,
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

