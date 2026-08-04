/**
 * What is a pre-fight gambit actually worth, in fights won and lost?
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
import type { Combatant, TeamId } from '../src/engine/types.js';

const SAMPLES = Number(process.argv[2] ?? 120);
const LEVELS = [3, 5, 7];

/** How far a measured rate can sit from the truth, at this sample size. */
const MARGIN = 100 * 1.96 * Math.sqrt(0.25 / SAMPLES);

interface Outcome {
  name: string;
  /** Which side it is meant to help — for reading the sign of the delta. */
  side: 'us' | 'them';
  /** Mutates the built combatants in place, before the fight starts. */
  apply(party: Combatant[], foes: Combatant[]): void;
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

const OUTCOMES: Outcome[] = [
  // The two that already ship, as the yardstick everything else is read against.
  { name: 'SURPRISE them (creep success)', side: 'us', apply: () => {}, surprise: 'team2' },
  { name: 'SURPRISE us  (creep failure)', side: 'them', apply: () => {}, surprise: 'team1' },

  { name: 'foes: 2 weakest frightened', side: 'us', apply: (_p, f) => weakest(f, 2).forEach((c) => cond(c, 'frightened')) },
  { name: 'foes: all frightened', side: 'us', apply: (_p, f) => f.forEach((c) => cond(c, 'frightened')) },
  { name: 'foes: all sapped', side: 'us', apply: (_p, f) => f.forEach((c) => cond(c, 'sapped')) },
  { name: 'foes: all outlined', side: 'us', apply: (_p, f) => f.forEach((c) => cond(c, 'outlined')) },
  { name: 'foes: all poisoned', side: 'us', apply: (_p, f) => f.forEach((c) => cond(c, 'poisoned')) },
  { name: 'foes: all slowed', side: 'us', apply: (_p, f) => f.forEach((c) => cond(c, 'slowed')) },
  /*
   * Vex is DIRECTED and sits on the attacker: `attack.ts` looks for a `vexed`
   * whose `sourceId` is the creature being attacked, and grants advantage
   * against that one creature. An undirected `{ id: 'vexed' }` matches nothing,
   * which is why the first run of this table reported it at exactly 0.0 +/-0.0
   * — zero flipped fights out of 1200, a number too clean to be a finding.
   */
  { name: 'us:   vex on the champion', side: 'us', apply: (p, f) => {
    const boss = champion(f)[0];
    if (boss) for (const c of p) c.conditions.push({ id: 'vexed', sourceId: boss.id });
  } },
  { name: 'us:   blessed', side: 'us', apply: (p) => p.forEach((c) => cond(c, 'blessed')) },
  { name: 'us:   +5 temp HP each', side: 'us', apply: (p) => p.forEach((c) => { c.tempHp = (c.tempHp ?? 0) + 5; }) },
  { name: 'us:   +10 temp HP each', side: 'us', apply: (p) => p.forEach((c) => { c.tempHp = (c.tempHp ?? 0) + 10; }) },

  { name: 'us:   all sapped', side: 'them', apply: (p) => p.forEach((c) => cond(c, 'sapped')) },
  { name: 'us:   all outlined', side: 'them', apply: (p) => p.forEach((c) => cond(c, 'outlined')) },
  { name: 'us:   all slowed', side: 'them', apply: (p) => p.forEach((c) => cond(c, 'slowed')) },
  { name: 'us:   all frightened', side: 'them', apply: (p) => p.forEach((c) => cond(c, 'frightened')) },
  { name: 'us:   all prone', side: 'them', apply: (p) => p.forEach((c) => cond(c, 'prone')) },
  { name: 'foes: champion blessed', side: 'them', apply: (_p, f) => champion(f).forEach((c) => cond(c, 'blessed')) },
  { name: 'foes: all blessed', side: 'them', apply: (_p, f) => f.forEach((c) => cond(c, 'blessed')) },
  { name: 'foes: +5 temp HP each', side: 'them', apply: (_p, f) => f.forEach((c) => { c.tempHp = (c.tempHp ?? 0) + 5; }) },
];

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
function outcomes(level: number, outcome: Outcome | undefined): boolean[] {
  const won: boolean[] = [];
  for (let s = 1; s <= SAMPLES; s++) {
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
    outcome?.apply(party, foes);
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

console.log(`n=${SAMPLES} per cell. A single win rate is +/-${MARGIN.toFixed(0)} points;`);
console.log('deltas are paired (same waves, same party, same seed), so they are tighter than that.\n');

const base = new Map<number, boolean[]>();
for (const level of LEVELS) base.set(level, outcomes(level, undefined));
console.log(`baseline win rate   ${LEVELS.map((l) => `L${l} ${rate(base.get(l)!).toFixed(0)}%`).join('   ')}\n`);

const sign = (n: number) => `${n > 0 ? '+' : ''}${n.toFixed(0)}`;

console.log(`${'outcome'.padEnd(32)} ${LEVELS.map((l) => `L${l}`.padStart(9)).join('')}      mean +/-95%`);
console.log('-'.repeat(32 + 9 * LEVELS.length + 18));
for (const o of OUTCOMES) {
  const ps = LEVELS.map((l) => paired(base.get(l)!, outcomes(l, o)));
  const mean = ps.reduce((a, p) => a + p.delta, 0) / ps.length;
  // Independent levels, so the mean's variance is the average of theirs over k.
  const se = Math.sqrt(ps.reduce((a, p) => a + p.se * p.se, 0)) / ps.length;
  const cells = ps.map((p) => sign(p.delta).padStart(9)).join('');
  console.log(`${o.name.padEnd(32)} ${cells}   ${sign(mean).padStart(6)} +/-${(1.96 * se).toFixed(1)}`);
}
