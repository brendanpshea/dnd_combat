/**
 * Exploratory analysis of the arena: who fights well, what actually gets cast,
 * and which magic items move a fight.
 *
 * WHY A SEPARATE SCRIPT FROM arena-run.ts
 *
 * `arena-run.ts` answers one question — how long is a run — with a fixed party.
 * This one answers "what is going on in there", which needs the opposite setup:
 * the party has to be randomized every run or every number it produces is a
 * fact about fighter/cleric/rogue/bard rather than about the game.
 *
 * WHAT IT MEASURES
 *
 *   1. Class performance   damage, healing, kills, downs, and the run win rate
 *                          with each class present, over random parties.
 *   2. Spell usage         every cast, by spell and by the class that cast it.
 *                          A spell with zero casts across thousands of rounds
 *                          is dead data — this is the counter that found Faerie
 *                          Fire and Ensnaring Strike sitting unused.
 *   3. Magic items         a controlled A/B, because the run simulation never
 *                          shops. Same fights, same seeds, trinket on and off.
 *
 * WHAT IT CANNOT TELL YOU
 *
 * The same caveat `arena-run.ts` carries: no shopping, no potions bought, no
 * bounties, no re-preparing spells between waves. And the AI is the greedy one,
 * so "what gets cast" is really "what the greedy scorer values" — a spell that
 * scores low is invisible here even when a human would use it every fight. That
 * makes the spell counts a diagnostic of the SCORER as much as of the spell.
 *
 * Per-class damage is likewise damage the AI chose to deal. A class that shows
 * low damage may be one the AI plays badly rather than one that is weak; the
 * honest reading of a low row is "look here", not "nerfed".
 *
 *   npx tsx scripts/arena-eda.ts [runs] [--max-days N] [--items] [--item-fights N]
 */
import {
  newCampaign, applyArenaVictory, buildCampaignParty, partyLevelOf, reviveParty, randomizeParty,
} from '../src/campaign/campaign.js';
import { newArenaRun, buildWave, advanceDay, type ArenaRunState } from '../src/arena/run.js';
import { dayOf, halfOf, dayLevelOf, lunch, night } from '../src/arena/day.js';
import { RUN_TARGET_XP } from '../src/arena/medal.js';
import { Combat } from '../src/engine/combat.js';
import { chooseAction } from '../src/ai/greedy.js';
import { buildMonster } from '../src/data/monsters.js';
import { TRINKETS, trinketSlot } from '../src/data/trinkets.js';
import { SPELLS } from '../src/data/spells.js';
import { CLASSES } from '../src/data/classes.js';
import type { Id } from '../src/engine/types.js';

const RUNS = Number(process.argv[2] ?? 40);
/**
 * `argv.indexOf(flag) + 1` is 0 when the flag is absent, and argv[0] is the node
 * binary — a truthy string that `Number()` turns into NaN. The `|| default`
 * never fires, and the run silently uses NaN. Look the flag up properly.
 */
function flag(name: string, fallback: number): number {
  const i = process.argv.indexOf(name);
  if (i < 0) return fallback;
  const v = Number(process.argv[i + 1]);
  return Number.isFinite(v) ? v : fallback;
}

const MAX_DAYS = flag('--max-days', 120);
const DO_ITEMS = process.argv.includes('--items');
/**
 * Control: play the DEFAULT party instead of a random one.
 *
 * Without this the script has no reference point. A 12% win rate over random
 * parties could be a finding about random parties or a bug in how this script
 * assembles one, and those look identical from the output. Running the same
 * loop against fighter/cleric/rogue/bard — the party `arena-run.ts` plays, with
 * a published win rate — tells the two apart.
 */
const FIXED = process.argv.includes('--fixed');
/**
 * Stop a run after this many losses in a row.
 *
 * THIS IS NOT A TUNING KNOB, IT IS A CORRECTNESS FIX.
 *
 * A run that hits a wave it cannot beat retries it forever, because the wave is
 * rebuilt from the same seed and the party cannot level without winning. The
 * first version of this script had no cap: 7252 fights across 60 runs, of which
 * the overwhelming majority were the same handful of parties re-losing the same
 * handful of fights a hundred times each. Every per-class average was really an
 * average over "how deep the stall was", not over play.
 *
 * Ten is what a player would do — a wave lost ten times running is a wall, and
 * the run is over whether or not the game says so.
 */
const GIVE_UP = flag('--give-up', 10);
const ITEM_FIGHTS = flag('--item-fights', 40);

// --- tallies ----------------------------------------------------------------

interface ClassTally {
  fights: number; damage: number; taken: number; healing: number;
  kills: number; downs: number; deaths: number; casts: number;
  runsIn: number; runsFinished: number;
}
const byClass = new Map<Id, ClassTally>();
const tally = (id: Id): ClassTally => {
  let t = byClass.get(id);
  if (!t) {
    t = { fights: 0, damage: 0, taken: 0, healing: 0, kills: 0, downs: 0, deaths: 0, casts: 0, runsIn: 0, runsFinished: 0 };
    byClass.set(id, t);
  }
  return t;
};

/** casts[spellId] = { total, byClass } */
const spellCasts = new Map<Id, { total: number; byClass: Map<Id, number> }>();
const itemUses = new Map<Id, number>();
/**
 * Reactions never produce a `spellCast` event — they fire from inside the
 * attack rules, not from the action list — so they would sit in the "never
 * cast" list forever no matter how often they went off. Counted from their own
 * events instead.
 *
 * Shield has no event of its own (it pushes the same `shielded` condition Mirror
 * Image does), so it cannot be separated here and is simply not claimed.
 */
let counterspells = 0;
const speciesRuns = new Map<Id, { runs: number; finished: number }>();

// --- one run ----------------------------------------------------------------

interface Outcome {
  finished: boolean; stalled: boolean; days: number; fights: number; wins: number;
  xp: number; level: number; classes: Id[];
}

function playOne(seed: number, collect: boolean): Outcome {
  const c = newCampaign(seed);
  // The whole point: species AND classes rerolled per run, with the role guard
  // the real button uses, so a run is never handed an unplayable party.
  if (!FIXED) randomizeParty(c);
  c.partyReady = true;
  const classes = c.characters.map((ch) => ch.classId);
  const species = c.characters.map((ch) => ch.speciesId);

  let run: ArenaRunState = newArenaRun(seed);
  let guard = 0;
  let lossStreak = 0;
  while (c.xp < RUN_TARGET_XP && dayOf(run) <= MAX_DAYS && lossStreak < GIVE_UP && guard++ < 4000) {
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

    // Who is who, so an event carrying only an id can be attributed to a class.
    const classOf = new Map<Id, Id>();
    for (const p of party) classOf.set(p.id, p.classId);
    if (collect) for (const p of party) tally(p.classId).fights++;

    let steps = 0;
    while (!combat.state.winner && steps++ < 600) {
      const events = combat.apply(chooseAction(combat.state, combat.activeId!));
      if (!collect) continue;
      for (const e of events) {
        switch (e.type) {
          case 'damageDealt': {
            const src = classOf.get(e.sourceId);
            if (src) tally(src).damage += e.amount;
            const dst = classOf.get(e.targetId);
            if (dst) tally(dst).taken += e.amount;
            break;
          }
          case 'healed': {
            const src = classOf.get(e.sourceId);
            // Self-healing counts — a potion is still hit points back on the
            // board — but it is the healer's own action either way.
            if (src) tally(src).healing += e.amount;
            break;
          }
          case 'died': {
            // A death on the enemy side is a kill for whoever last dealt
            // damage, which the event does not carry. Attribute instead to the
            // party as "an enemy died while you were here"? No — that is not a
            // statistic. Only count party deaths, which the event does support.
            const own = classOf.get(e.combatantId);
            if (own) tally(own).deaths++;
            break;
          }
          case 'downed': {
            const own = classOf.get(e.combatantId);
            if (own) tally(own).downs++;
            break;
          }
          case 'spellCast': {
            const src = classOf.get(e.casterId);
            let s = spellCasts.get(e.spellId);
            if (!s) { s = { total: 0, byClass: new Map() }; spellCasts.set(e.spellId, s); }
            s.total++;
            if (src) {
              s.byClass.set(src, (s.byClass.get(src) ?? 0) + 1);
              tally(src).casts++;
            }
            break;
          }
          case 'counterspelled': {
            if (classOf.has(e.byId)) counterspells++;
            break;
          }
          case 'itemUsed': {
            if (classOf.has(e.combatantId)) itemUses.set(e.itemId, (itemUses.get(e.itemId) ?? 0) + 1);
            break;
          }
          default: break;
        }
      }
    }

    const won = combat.state.winner === 'team1';
    const survivors = Object.values(combat.state.combatants).filter((x) => x.team === 'team1');
    if (won) {
      applyArenaVictory(c, survivors, wave.encounter.rawXp, combat.state.rng, 0,
        { downedAtZero: half === 'morning' });
    }
    lossStreak = won ? 0 : lossStreak + 1;
    run = advanceDay(run, won, wave.purse);
    if (won && half === 'morning') { lunch(c); continue; }
    if (!won) reviveParty(c);
    night(c, run.cleared);
  }

  const finished = c.xp >= RUN_TARGET_XP;
  if (collect) {
    for (const id of new Set(classes)) {
      tally(id).runsIn++;
      if (finished) tally(id).runsFinished++;
    }
    for (const id of new Set(species)) {
      const s = speciesRuns.get(id) ?? { runs: 0, finished: 0 };
      s.runs++; if (finished) s.finished++;
      speciesRuns.set(id, s);
    }
  }
  return {
    finished, stalled: lossStreak >= GIVE_UP, days: dayOf(run) - 1,
    fights: run.fights, wins: run.wins, xp: c.xp, level: partyLevelOf(c), classes,
  };
}

// --- item A/B ---------------------------------------------------------------

/**
 * The run simulation never shops, so a trinket would otherwise never appear in
 * any of the numbers above. Instead: the SAME fights twice, once with the item
 * on every party member and once without, and report the difference in fights
 * won. Same seeds both sides, so the comparison is the item and nothing else.
 *
 * Four members wearing four Cloaks of Protection is not a shopping trip anyone
 * would make. It is a sensitivity test: it asks how much this effect is worth
 * at all, loudly enough to show over the noise of forty fights.
 *
 * THE FIGHT HAS TO BE CONTESTABLE. The first version fixed on wave 8 at level 4
 * and the baseline won 4 of 60 — a fight that lost 93% of the time cannot get
 * measurably less lost, and every single trinket scored +0. A test with no
 * resolution reports "nothing matters", which is indistinguishable from a real
 * finding and is much easier to believe. So the wave is CALIBRATED first: the
 * one whose no-item win rate sits nearest a coin flip, where a real effect has
 * room to move the number in either direction.
 */
function itemAB(itemId: Id | undefined, fights: number, waveNo: number, level: number): number {
  let won = 0;
  for (let s = 1; s <= fights; s++) {
    const c = newCampaign(s);
    if (!FIXED) randomizeParty(c);
    c.partyReady = true;
    if (itemId) {
      const slot = trinketSlot(TRINKETS[itemId]!);
      for (const ch of c.characters) ch.equipped = { ...ch.equipped, [slot]: itemId };
    }
    const run = newArenaRun(s);
    const wave = buildWave(run.seed, level, waveNo, undefined, 0, 'afternoon');
    const party = buildCampaignParty(c);
    const foes = wave.encounter.members.map((id, i) =>
      buildMonster(id, 'team2', { x: [3, 1, 5, 2, 6, 0, 7, 4][i % 8]!, y: 6 }, String(i + 1)));
    const combat = new Combat({ combatants: [...party, ...foes], seed: s * 977 });
    let steps = 0;
    while (!combat.state.winner && steps++ < 600) combat.apply(chooseAction(combat.state, combat.activeId!));
    if (combat.state.winner === 'team1') won++;
  }
  return won;
}

// --- report -----------------------------------------------------------------

const pct = (n: number, d: number) => `${Math.round((n / Math.max(1, d)) * 100)}%`;
const pad = (s: string, n: number) => s.padEnd(n);
const num = (n: number, w = 6) => String(Math.round(n)).padStart(w);

const out: Outcome[] = [];
for (let s = 1; s <= RUNS; s++) out.push(playOne(s, true));

const finished = out.filter((o) => o.finished).length;
console.log(`\n=== ${RUNS} arena runs, ${FIXED ? 'DEFAULT party (control)' : 'party randomized every run (species + class, role-guarded)'}`);
console.log(`finished within ${MAX_DAYS} days: ${finished}/${RUNS} (${pct(finished, RUNS)})`);
const stalled = out.filter((o) => o.stalled).length;
const allFights = out.reduce((a, o) => a + o.fights, 0);
const allWins = out.reduce((a, o) => a + o.wins, 0);
console.log(`stalled (${GIVE_UP} losses in a row): ${stalled}/${RUNS} (${pct(stalled, RUNS)})`);
console.log(`fights ${allFights} · wins ${allWins} (${pct(allWins, allFights)})`);
// The pooled rate above is NOT the win rate a player experiences. A stalled run
// contributes a long tail of losses at the wall it died on and a finished run
// contributes a whole campaign of wins, so pooling them weights the answer by
// how badly each run went. The per-run median is the honest headline.
const medianOf = (xs: number[]) => xs.length ? xs.slice().sort((a, b) => a - b)[Math.floor(xs.length / 2)]! : 0;
const rate = (o: Outcome) => o.wins / Math.max(1, o.fights);
console.log(`per-run win rate: median ${pct(medianOf(out.map(rate)) * 100, 100)}` +
  ` (finished runs ${pct(medianOf(out.filter((o) => o.finished).map(rate)) * 100, 100)},` +
  ` stalled runs ${pct(medianOf(out.filter((o) => o.stalled).map(rate)) * 100, 100)})`);
console.log(`level reached: median ${medianOf(out.map((o) => o.level))}` +
  ` (stalled runs ${medianOf(out.filter((o) => o.stalled).map((o) => o.level))})`);

console.log(`\n--- classes (per fight the class was in)`);
console.log(pad('class', 12) + ['   dmg', ' taken', '  heal', ' downs', ' casts', '  runs', '  fin%'].join(''));
const rows = [...byClass.entries()].sort((a, b) => b[1].damage / Math.max(1, b[1].fights) - a[1].damage / Math.max(1, a[1].fights));
for (const [id, t] of rows) {
  const f = Math.max(1, t.fights);
  console.log(
    pad(CLASSES[id]?.name ?? id, 12) +
    num(t.damage / f) + num(t.taken / f) + num(t.healing / f) +
    num((t.downs / f) * 100) + num(t.casts / f) +
    num(t.runsIn) + pct(t.runsFinished, t.runsIn).padStart(6),
  );
}
// Party members go unconscious rather than dying — `died` fires for monsters —
// so downs is the column that carries "how often did this class fall over".
console.log('  dmg/taken/heal/casts are per fight; downs is per 100 fights;');
console.log('  fin% is the share of runs reaching the finish line with this class in the party.');

console.log(`\n--- spells cast (${[...spellCasts.values()].reduce((a, s) => a + s.total, 0)} casts)`);
const casts = [...spellCasts.entries()].sort((a, b) => b[1].total - a[1].total);
for (const [id, s] of casts) {
  const who = [...s.byClass.entries()].sort((a, b) => b[1] - a[1])
    .map(([cid, n]) => `${CLASSES[cid]?.name ?? cid} ${n}`).join(', ');
  console.log(`  ${pad(SPELLS[id]?.name ?? id, 22)} L${SPELLS[id]?.level ?? '?'} ${num(s.total, 5)}   ${who}`);
}

// The whole reason for the counter: what never came off the shelf.
const everPlayable = new Set<Id>();
for (const cls of Object.values(CLASSES)) {
  const sc = cls.spellcasting;
  if (!sc) continue;
  for (const id of Object.values(sc.spellsByLevel).flat()) if (!SPELLS[id]?.outOfCombat) everPlayable.add(id);
}
// Reactions are excluded: they have no `spellCast` event to be counted by, so
// listing them as "never cast" would be a bug in this script reported as a bug
// in the game.
const never = [...everPlayable]
  .filter((id) => !spellCasts.has(id) && SPELLS[id]?.castingTime !== 'reaction').sort();
console.log(`\n--- never cast (${never.length} of ${everPlayable.size} playable combat spells)`);
for (const id of never) console.log(`  ${pad(SPELLS[id]?.name ?? id, 22)} L${SPELLS[id]?.level}`);

console.log(`\n--- reactions (no spellCast event; counted from their own)`);
console.log(`  Counterspell fired ${counterspells} times`);
console.log('  Shield is not separable here — it shares Mirror Image\'s condition event.');

if (itemUses.size) {
  console.log(`\n--- consumables used`);
  for (const [id, n] of [...itemUses.entries()].sort((a, b) => b[1] - a[1])) console.log(`  ${pad(id, 26)} ${n}`);
}

console.log(`\n--- species (runs finished, ${RUNS} runs)`);
for (const [id, s] of [...speciesRuns.entries()].sort((a, b) => b[1].finished / Math.max(1, b[1].runs) - a[1].finished / Math.max(1, a[1].runs))) {
  console.log(`  ${pad(id, 14)} ${String(s.runs).padStart(3)} runs  ${pct(s.finished, s.runs).padStart(5)}`);
}

if (DO_ITEMS) {
  console.log(`\n=== magic items: same fights, item on all four vs nothing`);
  // Calibrate: find the wave nearest a coin flip on a cheap sample, so the A/B
  // has somewhere to move. A fight everyone loses and a fight everyone wins are
  // both worth exactly zero bits.
  const probe = 20;
  let best = { wave: 4, level: 3, rate: 1 };
  for (const [level, waveNo] of [[2, 2], [2, 4], [3, 4], [3, 6], [4, 6], [4, 8], [5, 10]] as Array<[number, number]>) {
    const rate = itemAB(undefined, probe, waveNo, level) / probe;
    if (Math.abs(rate - 0.5) < Math.abs(best.rate - 0.5)) best = { wave: waveNo, level, rate };
  }
  console.log(`calibrated on wave ${best.wave} at party level ${best.level}` +
    ` (baseline near ${pct(Math.round(best.rate * 100), 100)} on a ${probe}-fight probe)`);
  const base = itemAB(undefined, ITEM_FIGHTS, best.wave, best.level);
  console.log(`baseline (no trinket): ${base}/${ITEM_FIGHTS} won (${pct(base, ITEM_FIGHTS)})`);
  const deltas: Array<[Id, number]> = [];
  for (const id of Object.keys(TRINKETS)) deltas.push([id, itemAB(id, ITEM_FIGHTS, best.wave, best.level) - base]);
  for (const [id, d] of deltas.sort((a, b) => b[1] - a[1])) {
    console.log(`  ${pad(TRINKETS[id]?.name ?? id, 28)} ${(d >= 0 ? '+' : '') + d} fights`);
  }
  // Honesty about the resolution: at n fights, a swing of about +/-sqrt(n)/2 is
  // noise. Quote it rather than letting a reader treat +2 as a finding.
  console.log(`  a swing under +/-${Math.round(Math.sqrt(ITEM_FIGHTS) / 2)} fights is inside the noise at n=${ITEM_FIGHTS}.`);
}
