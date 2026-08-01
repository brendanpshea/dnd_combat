/**
 * How big is the attack chooser, really? — npx tsx scripts/chooser-load.ts
 *
 * Tapping an enemy opens a list of everything you could do to it. Reported as
 * overwhelming, and as encouraging bad plays (a wizard's dagger, a fighter's
 * Sacred Flame). Before ranking or folding anything, this counts what is
 * actually on screen: it plays whole battles with real campaign parties and,
 * every time a player-controlled hero is up, asks `groupActions` for the same
 * lists the UI would paint.
 *
 * Prints the distribution of options per tapped enemy, per class, so the
 * decision about how many to show first is made against the real shape rather
 * than against the worst case somebody remembers.
 */
import { Combat } from '../src/engine/combat.js';
import { buildCampaignParty, newCampaign } from '../src/campaign/campaign.js';
import { buildEncounter, ENCOUNTERS } from '../src/data/encounters.js';
import { chooseAction } from '../src/ai/greedy.js';
import { groupActions } from '../web/src/actionGroups.js';
import { farRank } from '../src/data/maps.js';

const ENCS = Object.keys(ENCOUNTERS);
const counts: number[] = [];
const shown: number[] = [];
const timings: number[] = [];
let atWillChecked = 0, atWillMissing = 0;
const byClass = new Map<string, number[]>();
/** How often the top-ranked option would change between consecutive turns. */
const topByActor = new Map<string, { top: string; set: string }[]>();

for (let seed = 0; seed < 60; seed++) {
  const campaign = newCampaign(1 + (seed % 5));
  const encId = ENCS[seed % ENCS.length]!;
  // No try/catch around setup: a scenario that will not build is a broken
  // measurement, not a data point to quietly drop. The first version swallowed
  // an out-of-bounds placement and reported a sample of zero.
  const mapId = ['open', 'ruins', 'marsh', 'firepit'][seed % 4]!;
  const combat = new Combat({
    seed,
    mapId,
    combatants: [...buildCampaignParty(campaign), ...buildEncounter(encId, 'team2', farRank(mapId))],
  });

  for (let step = 0; step < 400 && !combat.isOver(); step++) {
    const actor = combat.state.combatants[combat.activeId];
    if (!actor) break;
    if (actor.team === 'team1') {
      const t0 = performance.now();
      const g = groupActions(combat.state, actor.id, combat.legalActions());
      timings.push(performance.now() - t0);
      for (const [targetId, opts] of g.perTarget) {
        // Only enemies: the chooser on an ally is a heal or a shake-awake, and
        // was never the complaint.
        if (combat.state.combatants[targetId]?.team === actor.team) continue;
        counts.push(opts.length);
        shown.push(opts.filter((o) => !o.folded).length);
        const cls = actor.classId ?? 'monster';
        byClass.set(cls, [...(byClass.get(cls) ?? []), opts.length]);
        const key = `${seed}:${actor.id}:${targetId}`;
        // Record the whole set alongside the winner: churn only means
        // "the ranking reshuffled" when the same choices were on offer.
        topByActor.set(key, [...(topByActor.get(key) ?? []),
          { top: opts[0]?.label ?? '-', set: [...opts].map((o) => o.label).sort().join('|') }]);
        // Does the visible set always keep a play that costs nothing?
        const vis = opts.filter((o) => !o.folded);
        if (opts.some((o) => o.action.kind !== 'castSpell' || o.action.slotLevel === 0)) {
          atWillChecked++;
          if (!vis.some((o) => o.action.kind !== 'castSpell' || o.action.slotLevel === 0)) atWillMissing++;
        }
      }
    }
    combat.apply(chooseAction(combat.state, combat.activeId));
  }
}

const pct = (v: number[], q: number) => {
  const s = [...v].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(q * s.length))]!;
};
const line = (name: string, v: number[]) =>
  `${name.padEnd(10)} n=${String(v.length).padStart(6)}  med ${pct(v, 0.5)}  p75 ${pct(v, 0.75)}`
  + `  p90 ${pct(v, 0.9)}  max ${Math.max(...v)}`
  + `  >3: ${((v.filter((x) => x > 3).length / v.length) * 100).toFixed(0)}%`
  + `  >5: ${((v.filter((x) => x > 5).length / v.length) * 100).toFixed(0)}%`;

console.log('OPTIONS PER TAPPED ENEMY');
console.log(line('ALL', counts));
console.log(line('SHOWN', shown));
for (const [cls, v] of [...byClass].sort((a, b) => b[1].length - a[1].length)) console.log(line(cls, v));

// Stability: for one hero tapping one enemy across a battle, how often does the
// first option in the list change? A ranking that reshuffles under the thumb is
// worse than an arbitrary order the player has learned the shape of.
let seqs = 0, flips = 0, steps = 0, sameSet = 0, sameSetFlips = 0;
for (const labels of topByActor.values()) {
  if (labels.length < 2) continue;
  seqs++;
  for (let i = 1; i < labels.length; i++) {
    steps++;
    const changed = labels[i]!.top !== labels[i - 1]!.top;
    if (changed) flips++;
    if (labels[i]!.set === labels[i - 1]!.set) { sameSet++; if (changed) sameSetFlips++; }
  }
}
console.log(`\nAT-WILL GUARANTEE: ${atWillMissing}/${atWillChecked} taps hid every free option`);
console.log(`\nTOP-OPTION STABILITY`);
console.log(`  ${seqs} sequences, ${steps} consecutive pairs, ${flips} changes `
  + `(${steps ? ((flips / steps) * 100).toFixed(1) : '0'}% churn)`);
console.log(`  of which the SAME options were on offer: ${sameSet} pairs, ${sameSetFlips} changes `
  + `(${sameSet ? ((sameSetFlips / sameSet) * 100).toFixed(1) : '0'}% — the ranking reshuffling)`);

console.log(`\nCOST of one groupActions call (this is what a tap pays)`);
console.log(`  n=${timings.length}  med ${pct(timings, 0.5).toFixed(1)}ms  p90 ${pct(timings, 0.9).toFixed(1)}ms  max ${Math.max(...timings).toFixed(1)}ms`);
