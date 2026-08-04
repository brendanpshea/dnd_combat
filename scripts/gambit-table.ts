/**
 * The gambit table, and one fight simulated against it.
 *
 * Split out of gambit-price.ts so the parent and its worker processes share one
 * definition of what is being measured — a table that drifted between the two
 * would produce a merged result describing no experiment at all.
 *
 * WHAT IS BEING MEASURED
 *
 * The design says success makes the fight somewhat easier and failure somewhat
 * harder, and that the two should be priced to match — that is the whole reason
 * 50% odds is the line where taking the gamble stops being obvious. None of
 * which means anything until the outcomes are measured, because "starts
 * frightened" and "starts surprised" are not remotely the same size, and a
 * table of outcomes that swings from two points to thirty is a lottery wearing
 * a skill check's clothes.
 *
 * So: the same wave, fought with and without each candidate outcome, greedy on
 * both sides. The number that matters is the win-rate DELTA against an
 * untouched fight.
 *
 * WHAT COUNTS AS THE RIGHT SIZE
 *
 * Big enough that the player can feel it, small enough that no single roll
 * decides the fight. The arena's own even-fight target is about 50%, so an
 * outcome worth ten points moves a coin flip to 60/40 — noticeable, survivable.
 * Anything past twenty is doing more than the fight is.
 *
 *   npx tsx scripts/gambit-price.ts [samplesPerPoint]
 */
import { newCampaign, buildCampaignParty, partyLevelOf } from '../src/campaign/campaign.js';
import { memberCapFor, maxCountFor, EVEN_BUDGET } from '../src/arena/run.js';
import { generateEncounter } from '../src/arena/encounter.js';
import { generateArenaMap } from '../src/arena/map.js';
import { buildMonster } from '../src/data/monsters.js';
import { Combat } from '../src/engine/combat.js';
import { chooseAction } from '../src/ai/greedy.js';
import { parseMap } from '../src/data/maps.js';
import { cellAt } from '../src/engine/types.js';
import { blocksMovement } from '../src/engine/grid.js';
import type { Combatant, TeamId, Id, Position, GridState } from '../src/engine/types.js';

export const LEVELS = [3, 5, 7];

export interface Outcome {
  name: string;
  /** Which side it is meant to help — for reading the sign of the delta. */
  side: 'us' | 'them';
  /**
   * Mutates the built combatants in place, before the fight starts.
   *
   * `members` is the wave's monster ids, so an outcome that RECRUITS something
   * can build a creature scaled to this fight rather than a fixed one. Pushing
   * onto either array adds a combatant — the harness spreads both after this
   * runs.
   */
  apply(party: Combatant[], foes: Combatant[], members: readonly Id[]): void;
  /** Some outcomes are setup-level rather than combatant-level. */
  surprise?: TeamId;
}

const cond = (c: Combatant, id: Parameters<typeof String>[0] extends never ? never : string) =>
  c.conditions.push({ id: id as never });

/** The weakest N foes, by hit points — who a scare would land on. */
const weakest = (foes: Combatant[], n: number) =>
  [...foes].sort((a, b) => a.hp - b.hp).slice(0, n);
/** The one that headlines the wave. */
const champion = (foes: Combatant[]) =>
  [...foes].sort((a, b) => b.hp - a.hp).slice(0, 1);

/**
 * Hiding needs a NUMBER, not just the condition.
 *
 * `discoverHidden` skips any `hidden` whose `hideCheck` is undefined, so a bare
 * `{ id: 'hidden' }` can never be found — permanently invisible, which is not a
 * gambit, it is a win button. The value is the Stealth total that earned it, so
 * it is measured at two: 15, about what a proficient scout rolls, and 20, a
 * good roll. Monsters spot with 15 + Wis + proficiency, so the gap between
 * those two is most of the difference between "seen on their first turn" and
 * "seen never".
 */
const hide = (c: Combatant, hideCheck: number) =>
  c.conditions.push({ id: 'hidden', sourceId: c.id, hideCheck });

/** Strange herbs, taken badly: a fifth of everyone's health, never fatal. */
const bleed = (c: Combatant) => { c.hp = Math.max(1, c.hp - Math.floor(c.maxHp * 0.2)); };
/** Taken well: a fifth of maximum, as temporary hit points. */
const dose = (c: Combatant) => { c.tempHp = (c.tempHp ?? 0) + Math.floor(c.maxHp * 0.2); };

/**
 * A free, walkable square on or near `row`, avoiding everyone already placed.
 *
 * A recruit dropped onto a wall or onto somebody else makes `startCombat`
 * throw, and the wave generator picks its own board every sample, so the spot
 * has to be found rather than hardcoded.
 */
function freeCell(grid: GridState, taken: Combatant[], rows: number[]): Position | undefined {
  for (const y of rows) {
    for (const x of [3, 4, 2, 5, 1, 6, 0, 7]) {
      const cell = cellAt(grid, { x, y });
      // `cover` is a barricade and blocks movement exactly as a wall does —
      // startCombat throws on both, and checking only for walls put a stone
      // giant inside a barricade on the first sample.
      if (!cell || blocksMovement(cell.terrain)) continue;
      if (taken.some((c) => c.position.x === x && c.position.y === y)) continue;
      return { x, y };
    }
  }
  return undefined;
}

/**
 * The creature that could have gone either way.
 *
 * Scaled to the wave by copying its MEDIAN member — a fixed monster would be a
 * rounding error at level 7 and the whole fight at level 1. Success puts it on
 * your side, failure adds a second one to theirs, which is the same creature
 * either way and so the only honestly symmetric version of "it fights for you
 * or against you".
 */
let WHICH_RECRUIT = 0.5;

function recruit(
  members: readonly Id[], team: TeamId, party: Combatant[], foes: Combatant[], grid: GridState,
  which = 0.5,
): Combatant | undefined {
  WHICH_RECRUIT = which;
  const sorted = [...foes].sort((a, b) => a.maxHp - b.maxHp);
  const pick = sorted[Math.floor(sorted.length * WHICH_RECRUIT)];
  if (!pick) return undefined;
  const idx = foes.indexOf(pick);
  const monsterId = members[idx];
  if (!monsterId) return undefined;
  const all = [...party, ...foes];
  const rows = team === 'team1'
    ? [1, 2, 0, 3]
    : [grid.height - 3, grid.height - 2, grid.height - 4, grid.height - 1];
  const at = freeCell(grid, all, rows);
  if (!at) return undefined;
  return buildMonster(monsterId, team, at, `recruit-${team}`);
}

const half = (foes: Combatant[]) => weakest(foes, Math.max(1, Math.ceil(foes.length / 2)));

/**
 * The gambits as PAIRS, because a pair is the thing being designed.
 *
 * A success worth +20 next to a failure worth -3 is not a gamble, it is a
 * button you always press; the two numbers only mean anything side by side.
 */
export interface Gambit {
  skill: string;
  flavour: string;
  success: Outcome;
  failure: Outcome;
}

export const GAMBITS: Gambit[] = [
  {
    skill: 'Stealth', flavour: 'creep in',
    success: { name: 'surprise them', side: 'us', apply: () => {}, surprise: 'team2' },
    failure: { name: 'surprise us', side: 'them', apply: () => {}, surprise: 'team1' },
  },
  {
    skill: 'Religion', flavour: 'appease the local gods',
    success: { name: 'party blessed', side: 'us', apply: (p) => p.forEach((c) => cond(c, 'blessed')) },
    failure: { name: 'party baned', side: 'them', apply: (p) => p.forEach((c) => cond(c, 'baned')) },
  },
  {
    skill: 'Intimidate', flavour: 'cow them / enrage them — HALF',
    success: { name: 'half foes frightened', side: 'us', apply: (_p, f) => half(f).forEach((c) => cond(c, 'frightened')) },
    failure: { name: 'half foes blessed', side: 'them', apply: (_p, f) => half(f).forEach((c) => cond(c, 'blessed')) },
  },
  {
    skill: 'Perception', flavour: 'spot them / lose them',
    success: { name: 'foes outlined', side: 'us', apply: (_p, f) => f.forEach((c) => cond(c, 'outlined')) },
    failure: { name: 'foes hidden @15', side: 'them', apply: (_p, f) => f.forEach((c) => hide(c, 15)) },
  },
  {
    skill: 'Arcana', flavour: 'a hasted ally / a hasted enemy',
    success: { name: 'party hasted', side: 'us', apply: (p) => p.forEach((c) => cond(c, 'hasted')) },
    failure: { name: 'foes hasted', side: 'them', apply: (_p, f) => f.forEach((c) => cond(c, 'hasted')) },
  },
  {
    skill: 'Arcana', flavour: 'hasted — ONE only',
    success: { name: 'champion of ours hasted', side: 'us', apply: (p) => { if (p[0]) cond(p[0], 'hasted'); } },
    failure: { name: 'their champion hasted', side: 'them', apply: (_p, f) => champion(f).forEach((c) => cond(c, 'hasted')) },
  },
  /*
   * AC IS TESTED WITH `warded`, NOT `shielded`.
   *
   * Shield is a REACTION and `turn.ts` lists it as self-clearing: it is stripped
   * at the start of the holder's own turn, so a copy applied before the fight
   * never survives to stop an attack. Measured at +/-0.3 across 750 fights —
   * almost no flipped pairs at all, which is the signature of a condition that
   * is not there rather than one that does not matter.
   *
   * Shield of Faith is +2 rather than +5 and has a duration, so it is the
   * honest way to ask whether durable AC moves a fight.
   */
  {
    skill: 'Investigation', flavour: 'braced / caught out (+2 AC, lasting)',
    success: { name: 'party warded', side: 'us', apply: (p) => p.forEach((c) => cond(c, 'warded')) },
    failure: { name: 'foes warded', side: 'them', apply: (_p, f) => f.forEach((c) => cond(c, 'warded')) },
  },
  {
    skill: 'Investigation', flavour: '+2 AC — HALF only',
    success: { name: 'half party warded', side: 'us', apply: (p) => p.slice(0, 2).forEach((c) => cond(c, 'warded')) },
    failure: { name: 'half foes warded', side: 'them', apply: (_p, f) => half(f).forEach((c) => cond(c, 'warded')) },
  },
  {
    skill: 'Animal Hand.', flavour: 'median creature joins you / them',
    success: { name: 'recruit(med) joins US', side: 'us', apply: (p, f, m) => {
      const r = CURRENT_GRID && recruit(m, 'team1', p, f, CURRENT_GRID, 0.5);
      if (r) p.push(r);
    } },
    failure: { name: 'recruit(med) joins THEM', side: 'them', apply: (p, f, m) => {
      const r = CURRENT_GRID && recruit(m, 'team2', p, f, CURRENT_GRID, 0.5);
      if (r) f.push(r);
    } },
  },
  {
    // The median creature swung 47 points. The weakest is the same idea at the
    // smallest size the wave can offer, which is the only dial this outcome has.
    skill: 'Animal Hand.', flavour: 'WEAKEST creature joins you / them',
    success: { name: 'recruit(min) joins US', side: 'us', apply: (p, f, m) => {
      const r = CURRENT_GRID && recruit(m, 'team1', p, f, CURRENT_GRID, 0);
      if (r) p.push(r);
    } },
    failure: { name: 'recruit(min) joins THEM', side: 'them', apply: (p, f, m) => {
      const r = CURRENT_GRID && recruit(m, 'team2', p, f, CURRENT_GRID, 0);
      if (r) f.push(r);
    } },
  },
  {
    skill: 'Medicine', flavour: 'the strange herbs',
    success: { name: 'party +20% max as temp', side: 'us', apply: (p) => p.forEach(dose) },
    failure: { name: 'party -20% of max HP', side: 'them', apply: (p) => p.forEach(bleed) },
  },
];

export const OUTCOMES: Outcome[] = [
  ...GAMBITS.flatMap((g) => [g.success, g.failure]),
];

/**
 * The board for the sample being built.
 *
 * A module-level handoff rather than another `apply` parameter: only the
 * recruiting outcomes need it, and threading a grid through every entry in the
 * table to serve two of them is worse than one clearly-scoped variable.
 */
let CURRENT_GRID: GridState | undefined;

function partyAt(level: number, seed: number): Combatant[] {
  const c = newCampaign(seed);
  c.xp = 0;
  while (partyLevelOf(c) < level) c.xp += 100;
  return buildCampaignParty(c);
}

/**
 * Win rate over the same set of generated waves, with one outcome applied.
 *
 * The wave, the party and the combat seed are all functions of the sample
 * index only, so every column of the table fights EXACTLY the same fights. A
 * delta is then a difference in outcome rather than a difference in draw, which
 * at these sample sizes is most of the noise removed.
 */
export function outcomes(level: number, outcome: Outcome | undefined, seeds: number[]): boolean[] {
  const won: boolean[] = [];
  for (const s of seeds) {
    // The arena's own even-fight budget, so the baseline sits near 50% and an
    // outcome worth ten points has room to show. Measured on a wave that is
    // already a rout in either direction, every outcome reads as zero.
    const e = generateEncounter(
      { budget: EVEN_BUDGET[level - 1]!, maxMemberXp: memberCapFor(level), maxCount: maxCountFor(level), partyLevel: level },
      (s * 2654435761 + level) >>> 0,
    );
    const map = generateArenaMap({}, (s * 40503 + level) >>> 0).value.map;
    const grid = parseMap(map);
    const foes = e.value.members.map((id, i) =>
      buildMonster(id, 'team2', { x: [3, 1, 5, 2, 6, 0, 7, 4][i % 8]!, y: grid.height - 2 }, String(i + 1)));
    const party = partyAt(level, s);
    CURRENT_GRID = grid;
    outcome?.apply(party, foes, e.value.members);
    const combat = new Combat({
      combatants: [...party, ...foes],
      map,
      seed: s * 7 + level,
      ...(outcome?.surprise ? { surprisedTeam: outcome.surprise } : {}),
    });
    let steps = 0;
    while (!combat.state.winner && steps++ < 600) combat.apply(chooseAction(combat.state, combat.activeId!));
    won.push(combat.state.winner === 'team1');
  }
  return won;
}

const rate = (won: boolean[]) => (100 * won.filter(Boolean).length) / won.length;

/**
 * The paired delta, and how much of it is signal.
 *
 * Every column fights the same fights, so the only samples carrying any
 * information about an outcome are the ones it FLIPPED. Reading two independent
 * win rates and subtracting throws that away and reports a confidence interval
 * twice as wide as the experiment actually earned — at n=400 that is +/-5
 * points against +/-2, which is the difference between "these two outcomes are
 * the same size" being a finding and being unmeasurable.
 *
 * b = the outcome lost a fight the baseline won; c = it won one the baseline
 * lost. The delta is (c - b)/n and its standard error is sqrt(b + c)/n — the
 * McNemar form, which cares only about the discordant pairs.
 */
function paired(base: boolean[], test: boolean[]): { delta: number; se: number } {
  let b = 0;
  let c = 0;
  for (const [i, won] of base.entries()) {
    if (won && !test[i]) b++;
    if (!won && test[i]) c++;
  }
  const n = base.length;
  return { delta: (100 * (c - b)) / n, se: (100 * Math.sqrt(b + c)) / n };
}

