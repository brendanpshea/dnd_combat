/**
 * Headless playtest: npx tsx scripts/playtest.ts [runs] [--verbose]
 *
 * Deals a random party, then plays it through the arena from level 1 to the
 * level cap — every fight resolved by the AI, every purse spent in the shop,
 * every level-up taken — and reports what looks wrong.
 *
 * This is not a test and it does not assert. Its job is to *notice*: content
 * that never appears, a class that contributes nothing, gold nobody can spend,
 * a fight that never ends. The probe answers "is this decision sensible", the
 * arena answers "is this strong", and this answers "does a whole run hold
 * together" — which is the question neither of the others can see.
 *
 * Everything it prints is a smell, not a verdict. Read the flagged lines, then
 * go and look.
 */
import { Combat } from '../src/engine/combat.js';
import { chooseAction } from '../src/ai/greedy.js';
import {
  newCampaign, randomizeParty, buildCampaignParty, partyLevelOf, longRest,
  applyArenaVictory, reviveParty, shopOffering, SHOP_STOCK, itemPrice, itemName,
  buyItem, MAX_LEVEL, applyPartyTemplate, setPartyClass, type CampaignState,
} from '../src/campaign/campaign.js';
import { membersCoinXP } from '../src/data/encounters.js';
import { buildWave, newArenaRun, recordResult, type ArenaRunState } from '../src/arena/run.js';
import { parseMap } from '../src/data/maps.js';
import { buildMonster } from '../src/data/monsters.js';
import { SPELLS } from '../src/data/spells.js';
import { FEATURES } from '../src/data/features.js';
import { MONSTERS } from '../src/data/monsters.js';
import { CLASSES } from '../src/data/classes.js';
import { WEAPONS } from '../src/data/weapons.js';
import { acOf } from '../src/data/armor.js';
import { isDown } from '../src/engine/types.js';
import type { Id, GameState } from '../src/engine/types.js';
import { legalActions, type Action } from '../src/engine/actions.js';
import { distanceCells } from '../src/engine/grid.js';

const RUNS = Number(process.argv[2] ?? 40);
const VERBOSE = process.argv.includes('--verbose');
/**
 * `--standard` fields the Classic Four instead of a random party. The point is
 * the controlled comparison: if a run dies at wave 5 either way, the wave ramp
 * is the problem; if only the random parties die there, the comps are.
 */
const STANDARD = process.argv.includes('--standard');
/**
 * `--comp=fighter,cleric,rogue,bard` fields exactly that party every run.
 *
 * The point is the controlled swap. "Mean waves reached when a class is
 * present" mixes the class with whatever else was rolled alongside it; holding
 * three slots fixed and varying the fourth is the only way to read a class's
 * own contribution.
 */
const COMP = (process.argv.find((a) => a.startsWith('--comp='))?.slice(7) ?? '').split(',').filter(Boolean);
/** Experiment: give a full rest after a defeat as well as after a win. */
const RESTED_RETRY = process.argv.includes('--rested-retry');
/**
 * `--play=<style>` drives the heroes like a particular kind of human instead of
 * like the AI. This exists because every sweep in this file used to run the AI
 * on BOTH sides, and an AI party always walks into the monsters — which hid a
 * bug where outnumbered monsters refused to approach a party that held its
 * ground, in a quarter of arena waves. Whole classes of bug are invisible to a
 * harness whose players are all optimal.
 *
 * Win rate is not the metric for most of these; they are meant to lose. The
 * metric is whether the fight still *resolves*: stalls and exceptions.
 */
type PlayStyle = 'optimal' | 'passive' | 'turtle' | 'rush' | 'hesitant' | 'hoarder' | 'nospells';
const PLAY_STYLES: PlayStyle[] = ['optimal', 'passive', 'turtle', 'rush', 'hesitant', 'hoarder', 'nospells'];
const PLAY = ((process.argv.find((a) => a.startsWith('--play='))?.slice(7) ?? 'optimal') as PlayStyle);
if (!PLAY_STYLES.includes(PLAY)) {
  console.error(`unknown --play=${PLAY}; expected one of ${PLAY_STYLES.join(', ')}`);
  process.exit(1);
}

/** Give up on a run after this many consecutive losses at one wave. */
const PATIENCE = Number(process.env.PATIENCE ?? 3);
/** Hard stop so a stalled fight can't hang the sweep. */
const MAX_DECISIONS = 4000;

// --- what we watch --------------------------------------------------------

interface Tally {
  fights: number;
  wins: number;
  rounds: number[];
  stalls: Array<{ run: number; level: number; wave: number }>;
  errors: Array<{ run: number; where: string; message: string }>;
  /** Wins/fights keyed `level:wave`. */
  byWave: Map<string, { fights: number; wins: number }>;
  /** Damage dealt and turns taken, per class, across every run. */
  byClass: Map<Id, { damage: number; turns: number; downs: number; runs: number; kills: number; denied: number; healed: number; idleTurns: number }>;
  spellsCast: Map<Id, number>;
  featuresUsed: Map<Id, number>;
  itemsBought: Map<Id, number>;
  /** Consumables actually drunk/thrown/read in a fight, not merely carried. */
  itemsUsed: Map<Id, number>;
  /** Runs in which at least one hero *had* this spell, so "never cast" can be
   *  told apart from "nobody ever held it". */
  spellAvailableRuns: Map<Id, number>;
  itemAvailableRuns: Map<Id, number>;
  /** Per class: how deep runs containing it got. */
  classDepth: Map<Id, number[]>;
  /** Each run's roster and how far it got. */
  comps: Array<{ classes: Id[]; wave: number; level: number }>;
  monstersMet: Map<Id, number>;
  /** Gold in hand when a run ended, and gold at each shop visit. */
  goldAtEnd: number[];
  goldUnspendable: number;
  shopVisits: number;
  /** Waves cleared before reaching each level. */
  wavesToLevel: Map<number, number[]>;
  finalLevels: number[];
  finalWaves: number[];
  /** Level-5 snapshots: AC and max HP per class, to spot outliers. */
  endStats: Array<{ classId: Id; level: number; ac: number; maxHp: number }>;
  partyDowns: number;
  heroTurns: number;
  /** Win rate on the first crack at a wave, versus every retry after it. */
  firstTry: { fights: number; wins: number };
  retry: { fights: number; wins: number };
}

const T: Tally = {
  fights: 0, wins: 0, rounds: [], stalls: [], errors: [],
  byWave: new Map(), byClass: new Map(), spellsCast: new Map(), featuresUsed: new Map(),
  itemsBought: new Map(), itemsUsed: new Map(), spellAvailableRuns: new Map(),
  itemAvailableRuns: new Map(), classDepth: new Map(), comps: [],
  monstersMet: new Map(), goldAtEnd: [], goldUnspendable: 0,
  shopVisits: 0, wavesToLevel: new Map(), finalLevels: [], finalWaves: [], endStats: [],
  partyDowns: 0, heroTurns: 0,
  firstTry: { fights: 0, wins: 0 }, retry: { fights: 0, wins: 0 },
};

const bump = <K,>(m: Map<K, number>, k: K, n = 1) => m.set(k, (m.get(k) ?? 0) + n);

function classTally(id: Id) {
  let t = T.byClass.get(id);
  if (!t) { t = { damage: 0, turns: 0, downs: 0, runs: 0, kills: 0, denied: 0, healed: 0, idleTurns: 0 }; T.byClass.set(id, t); }
  return t;
}

// --- one fight ------------------------------------------------------------

/** Resolve a generated wave. Returns whether the party won, or 'stalled'. */
/**
 * How a hero decides, per play style. Everything here is deliberately a *worse*
 * player than the AI — a real playtester hoards potions, forgets they have
 * spells, refuses to leave the back rank, or charges in and dies.
 */
function heroAction(style: PlayStyle, state: GameState, id: Id, round: number): Action {
  const best = (): Action => chooseAction(state, id) ?? { kind: 'endTurn' };
  if (style === 'optimal') return best();
  // The player who deals with the board only every other round.
  if (style === 'hesitant') return round % 2 === 0 ? best() : { kind: 'endTurn' };
  // The player who set the party down and walked away. Never moves, never acts.
  if (style === 'passive') return { kind: 'endTurn' };

  const legal = legalActions(state, id);
  const me = state.combatants[id]!;
  const foes = Object.values(state.combatants).filter((f) => f.team !== me.team && f.alive && !isDown(f));

  if (style === 'turtle') {
    // Fights from where it stands: will shoot, cast and quaff, but never steps.
    const a = best();
    if (a.kind !== 'move' && a.kind !== 'dash') return a;
    const stationary = legal.find((x) => x.kind === 'attack' || x.kind === 'castSpell');
    return stationary ?? { kind: 'endTurn' };
  }

  if (style === 'rush') {
    // Charges the nearest enemy and swings; no kiting, no positioning.
    const hit = legal.find((x) => x.kind === 'attack');
    if (hit) return hit;
    if (foes.length > 0) {
      const moves = legal.filter((x): x is Extract<Action, { kind: 'move' }> => x.kind === 'move');
      let pick: Action | undefined;
      let bestDist = Infinity;
      for (const m of moves) {
        const d = Math.min(...foes.map((f) => distanceCells(m.to, f.position)));
        if (d < bestDist) { bestDist = d; pick = m; }
      }
      if (pick && bestDist < Math.min(...foes.map((f) => distanceCells(me.position, f.position)))) return pick;
      const dash = legal.find((x) => x.kind === 'dash');
      if (dash && bestDist > 1) return dash;
    }
    return best();
  }

  // The two "forgot they had it" styles: take the AI's choice unless it reaches
  // for the thing this player never touches, then make it play on without.
  const veto = style === 'hoarder' ? 'useItem' : 'castSpell';
  const a = best();
  if (a.kind !== veto) return a;
  return legal.find((x) => x.kind === 'attack')
    ?? legal.find((x) => x.kind === 'move')
    ?? { kind: 'endTurn' as const };
}

function fight(c: CampaignState, runSeed: number, level: number, wave: number, attempt = 1): boolean | 'stalled' {
  const w = buildWave(runSeed, level, wave);
  for (const m of w.encounter.members) bump(T.monstersMet, m);

  const party = buildCampaignParty(c);
  const grid = parseMap(w.map);
  // The same spread the arena screen uses, so a wide group fans out.
  const files = [3, 1, 5, 2, 6, 0, 7, 4];
  const foes = w.encounter.members.map((mid, i) =>
    buildMonster(mid, 'team2', { x: files[i % files.length]!, y: grid.height - 1 },
      w.encounter.members.length > 1 ? String(i + 1) : ''));
  const combat = new Combat({
    // The *encounter* is deliberately the same every attempt (buildWave seeds
    // off the run and the wave, so a wave you failed is a problem to solve
    // rather than a slot machine). The dice must not be: without `attempt` in
    // here the AI replays a bit-identical fight and loses 100% of retries,
    // which looks exactly like a death spiral and is really just determinism.
    seed: (runSeed * 7919 + wave * 104729 + attempt * 2654435761) >>> 0,
    map: w.map,
    combatants: [...party, ...foes],
  });

  // Who is who, so damage can be attributed to a class rather than an id.
  const classOf = new Map<Id, Id>();
  for (const p of party) classOf.set(p.id, p.classId);

  let decisions = 0;
  let lastActor: Id | undefined;
  let actedThisTurn = false;
  let lastHeroClass: Id | undefined;
  while (!combat.winner() && decisions++ < MAX_DECISIONS) {
    const id = combat.activeId!;
    if (id !== lastActor) {
      lastActor = id;
      const cls = classOf.get(id);
      if (cls) {
        classTally(cls).turns += 1;
        T.heroTurns += 1;
        // A turn on which a hero attacks nothing, casts nothing, uses nothing.
        // Moving still counts as idle here: the question is whether the AI ever
        // finds something for this class to *do*.
        if (!actedThisTurn && lastHeroClass) classTally(lastHeroClass).idleTurns += 1;
        actedThisTurn = false;
        lastHeroClass = cls;
      }
      else {
        // An enemy turn that begins unable to act, or pinned in place, is a turn
        // somebody took away. Credit it to whoever's effect is holding them —
        // this is the only way control shows up next to damage, and without it a
        // wizard reads as one of the weaker classes in the party.
        const foe = combat.state.combatants[id]!;
        const holding = foe.conditions.find(
          (k) => (k.id === 'incapacitated' || k.id === 'unconscious' || k.id === 'paralyzed' ||
                  k.id === 'restrained' || k.id === 'charmed' || k.id === 'lured') &&
                 k.sourceId !== undefined && classOf.has(k.sourceId),
        );
        if (holding?.sourceId) classTally(classOf.get(holding.sourceId)!).denied += 1;
      }
    }
    const action: Action = classOf.has(id)
      ? heroAction(PLAY, combat.state, id, combat.state.round)
      : (chooseAction(combat.state, id) ?? { kind: 'endTurn' });
    if (action.kind === 'castSpell') bump(T.spellsCast, action.spellId);
    if (action.kind === 'useFeature') bump(T.featuresUsed, action.featureId);
    if (action.kind === 'useItem') bump(T.itemsUsed, action.itemId);
    if (action.kind === 'attack' || action.kind === 'castSpell' ||
        action.kind === 'useFeature' || action.kind === 'useItem') actedThisTurn = true;
    const events = combat.apply(action);
    for (const e of events) {
      if (e.type === 'damageDealt') {
        const cls = classOf.get(e.sourceId);
        if (cls) classTally(cls).damage += e.amount;
      }
      if (e.type === 'healed') {
        const cls = classOf.get(e.sourceId);
        if (cls) classTally(cls).healed += e.amount;
      }
      if (e.type === 'died' && !classOf.has(e.combatantId)) {
        // Attribute the kill to whoever was acting.
        const cls = classOf.get(combat.activeId ?? '');
        if (cls) classTally(cls).kills += 1;
      }
      if (e.type === 'downed' && classOf.has(e.combatantId)) {
        T.partyDowns += 1;
        classTally(classOf.get(e.combatantId)!).downs += 1;
      }
    }
  }

  T.fights += 1;
  T.rounds.push(combat.state.round);
  const att = attempt === 1 ? T.firstTry : T.retry;
  att.fights += 1;
  if (combat.winner() === 'team1') att.wins += 1;
  // First attempts only. Counting retries here makes a wave look far harder
  // than it is: retries are drawn only from the runs that already failed it, so
  // a wave one party is stuck on contributes a dozen losses and no wins.
  const key = `${level}:${wave}`;
  const bucket = T.byWave.get(key) ?? { fights: 0, wins: 0 };
  if (attempt === 1) bucket.fights += 1;

  if (!combat.winner()) {
    T.stalls.push({ run: runSeed, level, wave });
    T.byWave.set(key, bucket);
    return 'stalled';
  }

  const won = combat.winner() === 'team1';
  if (won) {
    if (attempt === 1) bucket.wins += 1;
    T.wins += 1;
    const survivors = Object.values(combat.state.combatants).filter((x) => x.team === 'team1');
    applyArenaVictory(c, survivors, w.encounter.rawXp, combat.state.rng, membersCoinXP(w.encounter.members));
    c.gold += w.purse;
    longRest(c);
  } else {
    reviveParty(c);
    if (RESTED_RETRY) longRest(c);
  }
  T.byWave.set(key, bucket);
  return won;
}

// --- the shop -------------------------------------------------------------

/**
 * Spend the purse the way a player reasonably would.
 *
 * Restock first, upgrade second. That ordering is not a detail: an earlier
 * version bought the dearest affordable item every time, which meant nobody
 * ever replaced a drunk healing potion, and the party quietly got worse the
 * longer a run went. It cost about 23 points of win rate by level 3 — a fresh
 * party won 67% of the fight the run party won 44% of — and it looked exactly
 * like a difficulty problem.
 */
const RESTOCK = ['potion-healing', 'potion-greater-healing'];

function shop(c: CampaignState, level: number, key: string): void {
  T.shopVisits += 1;
  const shelf = shopOffering(SHOP_STOCK, level, key);
  const priced = (id: Id) => itemPrice(id) ?? Infinity;

  // One healing potion per character before anything else.
  for (let i = 0; i < c.characters.length; i++) {
    const held = (c.characters[i]!.inventory ?? []).find((s2) => RESTOCK.includes(s2.itemId));
    if (held && held.qty > 0) continue;
    const potion = shelf.filter((id) => RESTOCK.includes(id) && priced(id) <= c.gold)
      .sort((a, b) => priced(a) - priced(b))[0];
    if (potion && buyItem(c, i, potion)) bump(T.itemsBought, potion);
  }

  let guard = 0;
  for (;;) {
    if (guard++ > 40) break;
    const affordable = shelf
      .map((id) => ({ id, price: priced(id) }))
      .filter((x) => x.price <= c.gold)
      .sort((a, b) => b.price - a.price);
    if (affordable.length === 0) break;
    const pick = affordable[0]!;
    // Spread purchases around the party rather than kitting out one hero.
    const buyer = guard % c.characters.length;
    if (!buyItem(c, buyer, pick.id)) break;
    bump(T.itemsBought, pick.id);
  }
  const cheapest = Math.min(...shelf.map(priced));
  if (c.gold >= cheapest && Number.isFinite(cheapest)) T.goldUnspendable += 1;
}

// --- one run --------------------------------------------------------------

function playRun(seed: number): void {
  const c = newCampaign(seed);
  if (COMP.length) {
    randomizeParty(c, { roles: true });   // names and species
    COMP.forEach((classId, i) => setPartyClass(c, i, classId));
  } else if (STANDARD) applyPartyTemplate(c, 'classic');
  else randomizeParty(c, { roles: true });
  c.partyReady = true;
  const comp = c.characters.map((ch) => `${ch.speciesId} ${ch.classId}`).join(', ');
  for (const ch of c.characters) classTally(ch.classId).runs += 1;
  // What this party could possibly have used, so "never cast" separates a
  // spell the AI ignores from one nobody was carrying.
  {
    const party = buildCampaignParty(c);
    for (const id of new Set(party.flatMap((p) => p.spellIds))) bump(T.spellAvailableRuns, id);
    // Weapons in the pack are not consumables: they are drawn and swung through
    // the attack action, never through useItem, so counting them here reported
    // a stack of javelins as "carried, never used" every single run.
    for (const id of new Set(party.flatMap((p) => p.inventory.map((it) => it.itemId)))) {
      if (WEAPONS[id]) continue;
      bump(T.itemAvailableRuns, id);
    }
  }

  let run: ArenaRunState = newArenaRun(seed);
  let wave = 1;
  let losses = 0;
  const seenLevels = new Set<number>([1]);

  while (losses < PATIENCE) {
    const level = partyLevelOf(c);
    if (!seenLevels.has(level)) {
      seenLevels.add(level);
      const list = T.wavesToLevel.get(level) ?? [];
      list.push(wave);
      T.wavesToLevel.set(level, list);
    }
    let outcome: boolean | 'stalled';
    try {
      outcome = fight(c, seed, level, wave, losses + 1);
    } catch (err) {
      T.errors.push({ run: seed, where: `L${level} wave ${wave}`, message: String(err) });
      break;
    }
    if (outcome === 'stalled') break;
    run = recordResult(run, outcome, 0);
    if (outcome) {
      shop(c, level, `${seed}:${wave}`);
      wave += 1;
      losses = 0;
    } else {
      losses += 1;
    }
    // Stop once the party has topped out and pushed a few waves past it.
    if (wave > 40) break;   // the ramp is unwinnable long before this
  }

  const finalLevel = partyLevelOf(c);
  T.finalLevels.push(finalLevel);
  T.finalWaves.push(wave);
  const classes = c.characters.map((ch) => ch.classId);
  T.comps.push({ classes: [...classes].sort(), wave, level: finalLevel });
  for (const id of classes) {
    const list = T.classDepth.get(id) ?? [];
    list.push(wave);
    T.classDepth.set(id, list);
  }
  T.goldAtEnd.push(c.gold);
  for (const combatant of buildCampaignParty(c)) {
    T.endStats.push({
      classId: combatant.classId, level: finalLevel,
      ac: acOf(combatant), maxHp: combatant.maxHp,
    });
  }
  if (VERBOSE) {
    console.log(`  run ${seed}: L${finalLevel}, wave ${wave}, ${c.gold}g — ${comp}`);
  }
}

// --- report ---------------------------------------------------------------

function pct(n: number, d: number): string {
  return d === 0 ? '   —' : `${Math.round((n / d) * 100)}%`.padStart(4);
}
function median(xs: number[]): number {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)]!;
}
const FLAG = '  ⚠ ';

console.log(`Playing ${RUNS} ${COMP.length ? COMP.join('/') : STANDARD ? 'Classic Four' : 'random'} parties through the arena…\n`);
for (let seed = 1; seed <= RUNS; seed++) playRun(seed);

console.log(`\n=== ${T.fights} fights across ${RUNS} runs ===`);
console.log(`overall win rate ${pct(T.wins, T.fights)}   median rounds/fight ${median(T.rounds)}`);
console.log(`party members downed: ${(T.partyDowns / T.fights).toFixed(2)} per fight`);
// First-try and retry rates are NOT comparable: retries are drawn only from the
// waves the party already failed, so a lower rate is selection, not a spiral.
// Printed for context, deliberately without a flag on the gap.
console.log(`first attempt at a wave ${pct(T.firstTry.wins, T.firstTry.fights)} (${T.firstTry.fights} fights)` +
  `   retry ${pct(T.retry.wins, T.retry.fights)} (${T.retry.fights} fights, and these are the hard ones by construction)`);
console.log(`final level: median ${median(T.finalLevels)}, min ${Math.min(...T.finalLevels)}, max ${Math.max(...T.finalLevels)}`);
console.log(`waves reached: median ${median(T.finalWaves)}, min ${Math.min(...T.finalWaves)}, max ${Math.max(...T.finalWaves)}`);

console.log('\n--- how far a run gets (share of runs still going at wave N) ---');
{
  const row: string[] = [];
  for (let w = 1; w <= 20; w++) {
    const alive = T.finalWaves.filter((f) => f >= w).length;
    row.push(pct(alive, T.finalWaves.length));
  }
  console.log('     ' + [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => String(n).padStart(4)).join(''));
  console.log('w1-10' + row.slice(0, 10).join(''));
  console.log('     ' + [11, 12, 13, 14, 15, 16, 17, 18, 19, 20].map((n) => String(n).padStart(4)).join(''));
  console.log('w11+ ' + row.slice(10).join(''));
}

console.log('\n--- first-attempt win rate by level and wave ---');
const levels = [...new Set([...T.byWave.keys()].map((k) => Number(k.split(':')[0])))].sort((a, b) => a - b);
for (const lvl of levels) {
  const cells: string[] = [];
  for (let w = 1; w <= 16; w++) {
    const b = T.byWave.get(`${lvl}:${w}`);
    cells.push(b && b.fights >= 3 ? pct(b.wins, b.fights) : '   ·');
  }
  console.log(`L${lvl} ${cells.join('')}`);
}

console.log('\n--- contribution by class (per run) ---');
const classRows = [...T.byClass.entries()].sort((a, b) => b[1].damage / b[1].runs - a[1].damage / a[1].runs);
for (const [id, v] of classRows) {
  const dmgPerTurn = v.turns > 0 ? v.damage / v.turns : 0;
  console.log(
    `${(CLASSES[id]?.name ?? id).padEnd(9)} runs ${String(v.runs).padStart(3)}` +
    `  dmg/turn ${dmgPerTurn.toFixed(1).padStart(5)}` +
    `  heal/turn ${(v.healed / Math.max(1, v.turns)).toFixed(1).padStart(5)}` +
    `  denied/turn ${(v.denied / Math.max(1, v.turns)).toFixed(2).padStart(5)}` +
    `  idle turns ${pct(v.idleTurns, v.turns)}` +
    `  downs/run ${(v.downs / Math.max(1, v.runs)).toFixed(2)}`,
  );
}

// Counted from the *chosen action*, so anything the engine fires on its own
// never appears: the Shield spell is an auto-reaction inside resolveAttack and
// Mage Armor is worn before the fight. Absent here means "never chosen", which
// for these two is not the same as "never happened".
const AUTOCAST = new Set<Id>(['shield', 'mage-armor']);

function mean(xs: number[]): number {
  return xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length;
}

console.log('\n--- spell usage (casts per run in which someone knew it) ---');
{
  const rows = [...T.spellAvailableRuns.entries()]
    .filter(([id]) => !SPELLS[id]?.outOfCombat && !AUTOCAST.has(id))
    .map(([id, runs]) => ({ id, runs, casts: T.spellsCast.get(id) ?? 0, per: (T.spellsCast.get(id) ?? 0) / runs }))
    .sort((a, b) => b.per - a.per);
  const shown = rows.slice(0, 10);
  console.log('  most used: ' + shown.map((r) => `${r.id} ${r.per.toFixed(1)}`).join(', '));
  // Held often, cast rarely: the AI is passing it over, or it does not work.
  const cold = rows.filter((r) => r.runs >= Math.max(3, RUNS * 0.15) && r.per < 0.1);
  if (cold.length) {
    console.log(`${FLAG}carried but (almost) never cast — ${cold.length}:`);
    for (const r of cold) {
      console.log(`      ${r.id.padEnd(30)} known in ${String(r.runs).padStart(3)} runs, cast ${r.casts}`);
    }
  }
}

console.log('\n--- consumables (used per run in which someone carried it) ---');
{
  const rows = [...T.itemAvailableRuns.entries()]
    .map(([id, runs]) => ({ id, runs, used: T.itemsUsed.get(id) ?? 0, per: (T.itemsUsed.get(id) ?? 0) / runs }))
    .sort((a, b) => b.per - a.per);
  for (const r of rows) {
    const flag = r.runs >= Math.max(3, RUNS * 0.15) && r.per < 0.1 ? FLAG.trim() + ' ' : '   ';
    console.log(`  ${flag}${itemName(r.id).padEnd(28)} carried in ${String(r.runs).padStart(3)} runs, used ${String(r.used).padStart(4)} (${r.per.toFixed(2)}/run)`);
  }
}

console.log('\n--- party composition ---');
{
  const rows = [...T.classDepth.entries()]
    .map(([id, waves]) => ({ id, n: waves.length, depth: mean(waves) }))
    .filter((r) => r.n >= 3)
    .sort((a, b) => b.depth - a.depth);
  console.log('  mean waves reached, by class present in the party:');
  for (const r of rows) {
    console.log(`    ${(CLASSES[r.id]?.name ?? r.id).padEnd(9)} ${r.depth.toFixed(1).padStart(5)} waves  (${r.n} runs)`);
  }
  const best = [...T.comps].sort((a, b) => b.wave - a.wave).slice(0, 5);
  const worst = [...T.comps].sort((a, b) => a.wave - b.wave).slice(0, 5);
  console.log('  deepest runs:  ' + best.map((c) => `w${c.wave} L${c.level} [${c.classes.join('/')}]`).join('\n                 '));
  console.log('  shallowest:    ' + worst.map((c) => `w${c.wave} L${c.level} [${c.classes.join('/')}]`).join('\n                 '));
}

console.log('\n--- content never used ---');
const heroSpells = new Set<Id>();
for (const cls of Object.values(CLASSES)) {
  for (const ids of Object.values(cls.spellcasting?.spellsByLevel ?? {})) ids.forEach((i) => heroSpells.add(i));
}
// Counted from the *chosen action*, so anything the engine fires on its own
// never appears here however often it goes off: the Shield spell is an
// auto-reaction inside resolveAttack, and Mage Armor is worn before the fight.
// A name on this list means "the AI never chose it", not "it never happened".
const unusedSpells = [...heroSpells].filter(
  (s) => !T.spellsCast.has(s) && !SPELLS[s]?.outOfCombat && !AUTOCAST.has(s),
);
const heroFeatures = new Set<Id>();
for (const cls of Object.values(CLASSES)) {
  for (const ids of Object.values(cls.featuresByLevel)) ids.forEach((i) => heroFeatures.add(i));
  for (const cp of cls.choices ?? []) for (const o of cp.options) (o.grants.featureIds ?? []).forEach((i) => heroFeatures.add(i));
}
const unusedFeatures = [...heroFeatures].filter(
  (f) => !T.featuresUsed.has(f) && FEATURES[f]?.trigger !== 'passive' && FEATURES[f]?.apply,
);
const unmetMonsters = Object.keys(MONSTERS).filter((m) => !T.monstersMet.has(m));
if (unusedSpells.length) console.log(`${FLAG}spells never cast (${unusedSpells.length}): ${unusedSpells.join(', ')}`);
if (unusedFeatures.length) console.log(`${FLAG}active features never used (${unusedFeatures.length}): ${unusedFeatures.join(', ')}`);
console.log(`  monsters never met: ${unmetMonsters.length} of ${Object.keys(MONSTERS).length}` +
  (unmetMonsters.length ? ` — ${unmetMonsters.slice(0, 14).join(', ')}${unmetMonsters.length > 14 ? '…' : ''}` : ''));

console.log('\n--- economy ---');
console.log(`  shop visits ${T.shopVisits}, distinct items bought ${T.itemsBought.size}`);
console.log(`  gold at end of run: median ${median(T.goldAtEnd)}, max ${Math.max(...T.goldAtEnd)}`);
if (T.goldUnspendable > 0) {
  console.log(`${FLAG}left the shop still able to afford something on ${T.goldUnspendable} of ${T.shopVisits} visits`);
}
const topBuys = [...T.itemsBought.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
console.log(`  most bought: ${topBuys.map(([id, n]) => `${itemName(id)}×${n}`).join(', ')}`);

console.log('\n--- end-of-run stats ---');
const byCls = new Map<Id, { ac: number[]; hp: number[] }>();
for (const s of T.endStats) {
  const e = byCls.get(s.classId) ?? { ac: [], hp: [] };
  e.ac.push(s.ac); e.hp.push(s.maxHp); byCls.set(s.classId, e);
}
for (const [id, v] of [...byCls.entries()].sort()) {
  console.log(`${(CLASSES[id]?.name ?? id).padEnd(9)} AC ${median(v.ac)} (${Math.min(...v.ac)}–${Math.max(...v.ac)})` +
    `   maxHP ${median(v.hp)} (${Math.min(...v.hp)}–${Math.max(...v.hp)})`);
}

console.log('\n--- failures ---');
if (T.stalls.length) console.log(`${FLAG}${T.stalls.length} fights never ended: ${JSON.stringify(T.stalls.slice(0, 5))}`);
if (T.errors.length) {
  console.log(`${FLAG}${T.errors.length} runs threw:`);
  for (const e of T.errors.slice(0, 5)) console.log(`      run ${e.run} ${e.where}: ${e.message.slice(0, 160)}`);
}
if (!T.stalls.length && !T.errors.length) console.log('  no stalls, no exceptions.');
