/**
 * How long an arena run actually is: a headless simulation of whole runs.
 *
 * The finish line is 34,000 XP — 5e's level-8 threshold, one rung past the
 * level-7 ceiling the classes are built to. That number was chosen for what it
 * MEANS ("past the last implemented level") and had never been checked against
 * what it COSTS. A finish line is a promise about how long a mode is.
 *
 * THE ANSWER: about 25-35 wins. XP per hero scales steeply with the wave —
 * 99 at wave 1, 592 by wave 8, 2156 by wave 22, ~5000 by wave 44 — so the
 * finish arrives from the late fights rather than from a long grind. The
 * target is well placed.
 *
 * WHAT THIS SCRIPT CANNOT TELL YOU. It plays fights and rests; it does not
 * shop, drink potions, claim bounties or re-prepare spells, all of which a
 * player does between waves and all of which matter most exactly when a wave
 * is too hard. So a run that stalls here has not proved a dead end — it has
 * proved that the AI cannot fight its way past one without the tools. Read a
 * stall as a question, not a finding.
 *
 * Plays the real thing: real waves from `buildWave`, the real greedy AI on both
 * sides, the real day loop with lunch and night, real XP through
 * `applyArenaVictory`. Retries a lost wave the way a player would, up to a cap,
 * so the measurement includes the grind rather than assuming it away.
 *
 *   npx tsx scripts/arena-run.ts [runs] [--max-days N]
 */
import { newCampaign, applyArenaVictory, buildCampaignParty, partyLevelOf, reviveParty } from '../src/campaign/campaign.js';
import { newArenaRun, buildWave, advanceDay, type ArenaRunState } from '../src/arena/run.js';
import { dayOf, halfOf, dayLevelOf, lunch, night } from '../src/arena/day.js';
import { RUN_TARGET_XP } from '../src/arena/medal.js';
import { Combat } from '../src/engine/combat.js';
import { chooseAction } from '../src/ai/greedy.js';
import { buildMonster } from '../src/data/monsters.js';

const RUNS = Number(process.argv[2] ?? 30);
const MAX_DAYS = Number(process.argv[process.argv.indexOf('--max-days') + 1] || 200);

interface Outcome {
  finished: boolean; days: number; fights: number; wins: number; xp: number; level: number;
}

function playOne(seed: number): Outcome {
  const c = newCampaign(seed);
  let run: ArenaRunState = newArenaRun(seed);
  let guard = 0;
  while (c.xp < RUN_TARGET_XP && dayOf(run) <= MAX_DAYS && guard++ < 4000) {
    const half = halfOf(run);
    const level = dayLevelOf(run, partyLevelOf(c));
    const wave = buildWave(run.seed, level, run.wave, undefined, run.gate ?? 0, half);
    const party = buildCampaignParty(c);
    const foes = wave.encounter.members.map((id, i) =>
      buildMonster(id, 'team2', { x: [3, 1, 5, 2, 6, 0, 7, 4][i % 8]!, y: 6 }, String(i + 1)));
    // The retry has to be a DIFFERENT fight.
    //
    // A lost wave leaves `run.wave` alone (that is what "try again" means) and
    // the night's long rest puts the party back exactly as it was, so keying
    // the combat seed on the wave alone made every retry a bit-identical replay
    // of the fight that was just lost. A stall was not a hard wave — it was a
    // guaranteed infinite loop, and the 88% stall rate was measuring this line.
    // `run.attempts` counts retries, so the dice differ while the matchup does
    // not, which is what a player actually gets when they take the wave again.
    const combat = new Combat({
      combatants: [...party, ...foes], seed: seed * 31 + run.wave * 101 + run.attempts,
    });
    let steps = 0;
    while (!combat.state.winner && steps++ < 600) {
      combat.apply(chooseAction(combat.state, combat.activeId!));
    }
    const won = combat.state.winner === 'team1';
    if (process.env.TRACE && seed === 1 && run.wave <= 14) {
      console.log(`  d${dayOf(run)} ${half} wave${run.wave} L${level} budget${wave.budget}` +
        ` foes=${wave.encounter.members.length} -> ${won ? 'WIN' : 'loss'} xp=${c.xp}`);
    }
    const survivors = Object.values(combat.state.combatants).filter((x) => x.team === 'team1');
    if (won) {
      // `wave.encounter.rawXp` is what the app itself awards — `encounterXP`
      // takes an encounter ID, not a member list, and quietly returns 0 for an
      // array. That was the first version of this script, and it reported every
      // run stuck at 0 XP after 240 fights.
      applyArenaVictory(c, survivors, wave.encounter.rawXp, combat.state.rng, 0,
        { downedAtZero: half === 'morning' });
    }
    const before = dayOf(run);
    run = advanceDay(run, won, wave.purse);
    if (won && half === 'morning') { lunch(c); continue; }
    // A lost day costs gold at the healers and the party comes back — the
    // first version of this script skipped that, so the fallen stayed at 0 HP
    // into the next fight and every run death-spiralled to a 10% win rate.
    // That looked exactly like a difficulty finding and was a harness bug.
    if (!won) reviveParty(c);
    night(c, run.cleared);
    void before;
  }
  return {
    finished: c.xp >= RUN_TARGET_XP,
    days: dayOf(run) - 1, fights: run.fights, wins: run.wins,
    xp: c.xp, level: partyLevelOf(c),
  };
}

const out: Outcome[] = [];
for (let s = 1; s <= RUNS; s++) out.push(playOne(s));
const med = (xs: number[]) => xs.slice().sort((a, b) => a - b)[Math.floor(xs.length / 2)]!;
const done = out.filter((o) => o.finished);
console.log(`runs ${RUNS} · finished ${done.length} (${Math.round(done.length / RUNS * 100)}%) within ${MAX_DAYS} days`);
if (done.length) {
  console.log(`  finished: median ${med(done.map((o) => o.days))} days, ${med(done.map((o) => o.fights))} fights,` +
    ` win rate ${Math.round(med(done.map((o) => o.wins / Math.max(1, o.fights))) * 100)}%`);
}
for (const [i, o] of out.entries()) {
  if (i < 5) console.log(`  run ${i + 1}: ${o.days}d ${o.fights}f ${o.wins}w  xp ${o.xp} L${o.level}`);
}
const stuck = out.filter((o) => !o.finished);
if (stuck.length) {
  console.log(`  unfinished: median ${med(stuck.map((o) => o.xp))} XP of ${RUN_TARGET_XP}` +
    ` (level ${med(stuck.map((o) => o.level))}), ${med(stuck.map((o) => o.fights))} fights`);
}
console.log(`  XP spread: ${out.map((o) => o.xp).sort((a, b) => a - b).filter((_, i, a) => i === 0 || i === a.length - 1).join(' … ')}`);
