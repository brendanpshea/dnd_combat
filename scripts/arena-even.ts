/**
 * What an even fight actually costs, per party level — measured, not guessed.
 *
 * `EVEN_BUDGET` is the arena's claim about the encounter budget a party of a
 * given level should win about half the time. Every wave's difficulty is a
 * multiple of it, so if one rung is wrong every fight at that level is wrong.
 *
 * WHAT IT SAID, THE FIRST TIME IT WAS RUN
 *
 * The table's level-to-level ratios are 1.73, 2.38, 1.29, 1.75, 1.43, 1.15,
 * and the 2.38 at L2→L3 looks like an outlier in a curve that ought to be
 * smooth. It is not one: measured at n=60, level 3 wins 57%, which is as close
 * to even as any other rung. The step is large because level 3 is where
 * subclass features land, and the party really does get that much stronger.
 *
 * Measured win rates at the shipped budgets, n=60: 52, 57, 57, 57, 63, 43, 37.
 * Levels 6 and 7 look low — but cutting level 6's budget by 15% did not move
 * its win rate at all (43% at 20000 and 43% at 17000), and level 7 read 48, 58
 * and 48 across three neighbouring budgets. At n=60 the standard error near
 * p=0.5 is about six points, so both of those are noise around an adequate
 * number rather than a curve that needs bending.
 *
 * The conclusion, therefore, is that the table is fine at the resolution this
 * can resolve — and that a real answer for the top two rungs needs several
 * hundred samples per point, not sixty. This script is here so that is a matter
 * of leaving it running rather than of rewriting it.
 *
 *   npx tsx scripts/arena-even.ts [samplesPerPoint]
 */
import { newCampaign, buildCampaignParty, partyLevelOf } from '../src/campaign/campaign.js';
import { generateEncounter } from '../src/arena/encounter.js';
import { memberCapFor, maxCountFor, EVEN_BUDGET } from '../src/arena/run.js';
import { buildMonster } from '../src/data/monsters.js';
import { Combat } from '../src/engine/combat.js';
import { chooseAction } from '../src/ai/greedy.js';

const SAMPLES = Number(process.argv[2] ?? 60);

/**
 * How far a measured win rate can sit from the truth, at this sample size.
 *
 * Printed alongside every number because the first read of this script was
 * taken at n=16 and produced a table where level 1 was harder than level 2 —
 * impossible, and only obviously impossible because the two were next to each
 * other. Most noise does not announce itself that clearly.
 */
const MARGIN = Math.round(100 * 1.96 * Math.sqrt(0.25 / SAMPLES));

function partyAt(level: number, seed: number) {
  const c = newCampaign(seed);
  c.xp = 0;
  while (partyLevelOf(c) < level) c.xp += 100;
  return buildCampaignParty(c);
}

/** Win rate for a party of `level` against encounters worth `budget`. */
function winRate(level: number, budget: number): number {
  let wins = 0;
  for (let s = 1; s <= SAMPLES; s++) {
    const e = generateEncounter(
      { budget, maxMemberXp: memberCapFor(level), maxCount: maxCountFor(level), partyLevel: level },
      (s * 2654435761 + budget) >>> 0,
    );
    const foes = e.value.members.map((id, i) =>
      buildMonster(id, 'team2', { x: [3, 1, 5, 2, 6, 0, 7, 4][i % 8]!, y: 6 }, String(i + 1)));
    const combat = new Combat({ combatants: [...partyAt(level, s), ...foes], seed: s * 7 + level });
    let steps = 0;
    while (!combat.state.winner && steps++ < 600) combat.apply(chooseAction(combat.state, combat.activeId!));
    if (combat.state.winner === 'team1') wins++;
  }
  return wins / SAMPLES;
}

// Only the direct question, at high sample count. An earlier version of this
// bisected for the 50% point and produced a table where level 1 was harder than
// level 2 — impossible, and a sign the estimator was noisier than the effect.
// A win rate at a fixed budget is one measurement, not seven chained ones.
console.log(`n=${SAMPLES}, so a win rate here is +/-${MARGIN} points at 95% confidence.` +
  (MARGIN > 8 ? '  <- too coarse to conclude anything; raise n.' : ''));
console.log(`level  shipped budget   win rate (n=${SAMPLES})   ratio to previous rung`);
for (let level = 1; level <= 7; level++) {
  const shipped = EVEN_BUDGET[level - 1]!;
  const ratio = level > 1 ? (shipped / EVEN_BUDGET[level - 2]!).toFixed(2) + 'x' : '—';
  console.log(String(level).padStart(5), String(shipped).padStart(15),
    `${Math.round(winRate(level, shipped) * 100)}%`.padStart(16), ratio.padStart(24));
}
