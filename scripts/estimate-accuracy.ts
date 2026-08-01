/**
 * Is the chooser's damage estimate actually right? — npx tsx scripts/estimate-accuracy.ts
 *
 * `chooser-load.ts` measured whether the ranking is STABLE. It never measured
 * whether it is CORRECT, and those are different questions: a badly-sampled
 * estimate is perfectly stable, because the seeds are fixed. That gap shipped.
 * A level-1 wizard's Fire Bolt scored 0.00 — five fixed seeds, five misses,
 * permanently, for that one action on that one board — and the cantrip sorted
 * below a dagger. Reported as Shocking Grasp ranking under Fire Bolt.
 *
 * Ground truth here is the same estimator at a large sample count. What it
 * reports is how often a cheap estimate puts the wrong option first, and how
 * far off the numbers are, so the sample count and the seeding strategy are
 * chosen against data rather than against intuition.
 */
import { Combat } from '../src/engine/combat.js';
import { buildCampaignParty, newCampaign } from '../src/campaign/campaign.js';
import { buildEncounter, ENCOUNTERS } from '../src/data/encounters.js';
import { chooseAction } from '../src/ai/greedy.js';
import { groupActions } from '../web/src/actionGroups.js';
import { expectedDamage } from '../src/engine/rules/estimate.js';
import { farRank } from '../src/data/maps.js';
import type { GameState, Id } from '../src/engine/types.js';
import type { Action } from '../src/engine/actions.js';

const TRUTH_SAMPLES = 400;

/** The honest answer, at a sample count no interactive path could afford. */
function truth(state: GameState, actorId: Id, action: Action): number {
  // A salt as well as a sample count: `expectedDamage` replaces the state's rng
  // with its own seed, so passing a shifted rng in changes nothing at all. The
  // first version of this function did exactly that and would have averaged 400
  // identical numbers while reporting a confident zero error.
  return expectedDamage(state, actorId, action, { samples: TRUTH_SAMPLES, salt: 0x9e3779b9 });
}

const SAMPLES = Number(process.argv[2] ?? 5);
const ENCS = Object.keys(ENCOUNTERS);
let cases = 0, wrongTop = 0, wrongTop3 = 0;
let absErr = 0, relErr = 0, terms = 0, zeroed = 0, costlyTop = 0;

for (let seed = Number(process.argv[3] ?? 0); seed < Number(process.argv[3] ?? 0) + 24; seed++) {
  const campaign = newCampaign(1 + (seed % 5));
  const mapId = ['open', 'ruins', 'marsh', 'firepit'][seed % 4]!;
  const combat = new Combat({
    seed, mapId,
    combatants: [...buildCampaignParty(campaign), ...buildEncounter(ENCS[seed % ENCS.length]!, 'team2', farRank(mapId))],
  });
  for (let step = 0; step < 200 && !combat.isOver(); step++) {
    const actor = combat.state.combatants[combat.activeId];
    if (!actor) break;
    if (actor.team === 'team1') {
      const g = groupActions(combat.state, actor.id, combat.legalActions());
      for (const [targetId, opts] of g.perTarget) {
        if (combat.state.combatants[targetId]?.team === actor.team) continue;
        if (opts.length < 2) continue;
        const real = opts.map((o) => truth(combat.state, actor.id, o.action));
        const est = opts.map((o) => expectedDamage(combat.state, actor.id, o.action, { samples: SAMPLES }));
        // Rank BY THIS SAMPLE COUNT. `opts` arrives already ranked by whatever
        // the shipped default is, so reading its order made every sweep report
        // identical numbers — the first version of this harness did exactly
        // that and showed the same 110 errors at 1, 5, 12 and 30 samples.
        const order = opts.map((_, i) => i).sort((a, b) => est[b]! - est[a]!);
        const chosen = order[0]!;
        for (let i = 0; i < opts.length; i++) {
          absErr += Math.abs(est[i]! - real[i]!);
          if (real[i]! > 0.5) { relErr += Math.abs(est[i]! - real[i]!) / real[i]!; terms++; }
          // The failure that was reported: a real option estimated at nothing.
          if (real[i]! > 1 && est[i]! === 0) zeroed++;
        }
        const bestReal = real.indexOf(Math.max(...real));
        cases++;
        if (bestReal !== chosen) wrongTop++;
        if (order.indexOf(bestReal) >= 3) wrongTop3++;
        // The number that actually matters. Putting the second-best option
        // first is only a defect if the player loses something by taking it —
        // two attacks within a few percent of each other are interchangeable,
        // and calling that an error would tune the sample count against noise.
        if (real[bestReal]! > real[chosen]! * 1.10 + 0.5) costlyTop++;
      }
    }
    combat.apply(chooseAction(combat.state, combat.activeId));
  }
}

console.log(`samples=${SAMPLES}`);
console.log(`  n=${cases} chooser builds`);
console.log(`  best option NOT shown first: ${wrongTop} (${((wrongTop / cases) * 100).toFixed(1)}%)`);
console.log(`  ...and MATERIALLY better (>10%): ${costlyTop} (${((costlyTop / cases) * 100).toFixed(1)}%)`);
console.log(`  best option FOLDED AWAY:     ${wrongTop3} (${((wrongTop3 / cases) * 100).toFixed(1)}%)`);
console.log(`  mean relative error: ${((relErr / Math.max(1, terms)) * 100).toFixed(1)}%`);
console.log(`  real options estimated at exactly 0: ${zeroed}`);
