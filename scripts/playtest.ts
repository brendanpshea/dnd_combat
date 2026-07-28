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
  buyItem, equipItem, equipBlocked, addItem, MAX_LEVEL, applyPartyTemplate, setPartyClass,
  type CampaignState,
} from '../src/campaign/campaign.js';
import {
  ARMOR, armorClass, armorStealthDisadvantage, armorSpeedPenalty,
} from '../src/data/armor.js';
import { membersCoinXP } from '../src/data/encounters.js';
import {
  buildWave, newArenaRun, recordResult, advanceDay, type ArenaRunState, type DayHalf,
} from '../src/arena/run.js';
import { halfOf, dayOf, dayLevelOf, lunch, night, noteSpentItems } from '../src/arena/day.js';
import { revivalCost, payRevival, isFirstDefeat } from '../src/arena/revival.js';
import { runComplete, summarise, type MedalTier } from '../src/arena/medal.js';
import { bountiesFor, claimedBounties, spellsCastBy } from '../src/arena/bounties.js';
import { spoilOffer, spoilTierFor } from '../src/arena/spoils.js';
import { deployFoes } from '../src/arena/deploy.js';
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
/**
 * `--days` plays the arena the way the web game now does: two fights a day at
 * the SAME wave budget, a lunch break between them, a night after, and a defeat
 * that ends the day and sends you back to the morning fight tomorrow.
 *
 * The point of measuring it separately is that the old loop rests fully between
 * every fight, so it cannot see the only thing this mode adds — what a party
 * that has already spent a morning does in the afternoon.
 */
const DAYS = process.argv.includes('--days');
/**
 * How many times a player retries a day before walking away. Deliberately not
 * 0: a real player who loses the afternoon comes back tomorrow and tries the
 * same two fights again, sometimes after a level-up, and the whole freeze-the-
 * day design is a bet on what happens on those retries. Setting this to 0 would
 * measure a player the design does not have.
 */
const DAY_RETRIES = Number(process.env.DAY_RETRIES ?? 2);
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
  /** How often each enemy deployment shape came up. */
  deployPatterns: Map<string, number>;
  /** Gold in hand when a run ended, and gold at each shop visit. */
  goldAtEnd: number[];
  goldUnspendable: number;
  shopVisits: number;
  /** Waves cleared before reaching each level. */
  wavesToLevel: Map<number, number[]>;
  finalLevels: number[];
  finalXp: number[];
  finalWaves: number[];
  /** Level-5 snapshots: AC and max HP per class, to spot outliers. */
  endStats: Array<{ classId: Id; level: number; ac: number; maxHp: number }>;
  partyDowns: number;
  heroTurns: number;
  /** Win rate on the first crack at a wave, versus every retry after it. */
  /** Armor actually put on after a shop visit (see equipUpgrades). */
  armorEquipped: Map<Id, number>;
  /** Bounties earned, awards taken, and any award that came up empty. */
  bountiesClaimed: Map<Id, number>;
  spoilsTaken: Map<Id, number>;
  spoilTiers: Map<string, number>;
  spoilsEmpty: number;
  firstTry: { fights: number; wins: number };
  retry: { fights: number; wins: number };
  /** `--days` only: how the two-fight day actually plays out. */
  day: {
    morning: { fights: number; wins: number };
    afternoon: { fights: number; wins: number };
    /** Days entered, days cleared, and how many were cleared on a retry. */
    entered: number;
    cleared: number;
    clearedOnRetry: number;
    /** Where a lost day was lost, which is the whole question this mode asks. */
    lostInMorning: number;
    lostInAfternoon: number;
    /** Retries burned per abandoned day, and whether a level-up rescued it. */
    abandoned: number;
    rescuedByLevel: number;
    /** Lunch: dice spent, heroes raised, and how often nobody had a die left. */
    lunchDice: number[];
    lunchRevived: number;
    lunchBroke: number;
    /** The defeat tax: what was billed, what had to be sold, who went under. */
    billed: number[];
    soldToPay: number;
    daysWithSale: number;
    insolvent: number;
    /** The day each broke run went under — early is a bad first impression. */
    brokeOnDay: number[];
    /** Runs that reached the finish line, and the medals they took. */
    completed: number;
    medals: Map<MedalTier, number>;
    completedOnDay: number[];
    completerWinRates: number[];
    allWinRates: number[];
    /** Party level at the last day a run cleared. */
    daysPerRun: number[];
  };
}

const T: Tally = {
  fights: 0, wins: 0, rounds: [], stalls: [], errors: [], deployPatterns: new Map(),
  byWave: new Map(), byClass: new Map(), spellsCast: new Map(), featuresUsed: new Map(),
  itemsBought: new Map(), itemsUsed: new Map(), spellAvailableRuns: new Map(),
  itemAvailableRuns: new Map(), classDepth: new Map(), comps: [],
  monstersMet: new Map(), goldAtEnd: [], goldUnspendable: 0,
  shopVisits: 0, wavesToLevel: new Map(), finalLevels: [], finalXp: [], finalWaves: [], endStats: [],
  partyDowns: 0, heroTurns: 0,
  armorEquipped: new Map(),
  bountiesClaimed: new Map(), spoilsTaken: new Map(), spoilTiers: new Map(), spoilsEmpty: 0,
  firstTry: { fights: 0, wins: 0 }, retry: { fights: 0, wins: 0 },
  day: {
    morning: { fights: 0, wins: 0 }, afternoon: { fights: 0, wins: 0 },
    entered: 0, cleared: 0, clearedOnRetry: 0,
    lostInMorning: 0, lostInAfternoon: 0, abandoned: 0, rescuedByLevel: 0,
    lunchDice: [], lunchRevived: 0, lunchBroke: 0, daysPerRun: [],
    billed: [], soldToPay: 0, daysWithSale: 0, insolvent: 0, brokeOnDay: [],
    completed: 0, medals: new Map(), completedOnDay: [], completerWinRates: [], allWinRates: [],
  },
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

/**
 * Run one fight to a conclusion.
 *
 * `day` puts it inside the two-fight day: the wave is drawn for that half, the
 * purse is paid only after the afternoon (a day is one payday), heroes dropped
 * in the morning stay at 0 until lunch buys them back up, and the resting is
 * the caller's business rather than an automatic long rest.
 */
function fight(
  c: CampaignState, runSeed: number, level: number, wave: number, attempt = 1,
  day?: { half: DayHalf; dayNumber: number },
): boolean | 'stalled' {
  const half = day?.half ?? 'morning';
  const w = buildWave(runSeed, level, wave, undefined, 0, half);
  for (const m of w.encounter.members) bump(T.monstersMet, m);

  const party = buildCampaignParty(c);
  const grid = parseMap(w.map);
  // The same deployment the arena screen uses, seeded the same way.
  const spots = deployFoes(grid, w.encounter.members.length, (runSeed ^ (wave * 2654435761)) >>> 0);
  bump(T.deployPatterns, spots.value.pattern);
  const foes = w.encounter.members.map((mid, i) =>
    buildMonster(mid, 'team2', spots.value.positions[i] ?? { x: 0, y: grid.height - 1 },
      w.encounter.members.length > 1 ? String(i + 1) : ''));
  // The optional objectives for this wave, named the way the arena screen names
  // them. The harness never modelled these, which meant the entire bounty
  // system — and now the entire supply of permanent magic — was invisible to
  // every measurement ever taken.
  const combat = new Combat({
    // The *encounter* is deliberately the same every attempt (buildWave seeds
    // off the run and the wave, so a wave you failed is a problem to solve
    // rather than a slot machine). The dice must not be: without `attempt` in
    // here the AI replays a bit-identical fight and loses 100% of retries,
    // which looks exactly like a death spiral and is really just determinism.
    seed: (runSeed * 7919 + wave * 104729 + attempt * 2654435761 +
      (half === 'afternoon' ? 1013904223 : 0)) >>> 0,
    map: w.map,
    combatants: [...party, ...foes],
  });

  const offered = bountiesFor(runSeed, wave, party, combat.state);

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
    applyArenaVictory(c, survivors, w.encounter.rawXp, combat.state.rng,
      membersCoinXP(w.encounter.members), day ? { downedAtZero: true } : {});
    // Bounties, and the awards they carry. Permanent magic has no other source,
    // so if this never fires the whole item economy is dead and the sweep would
    // report a perfectly healthy-looking run with an empty pack.
    const claimed = claimedBounties(offered, {
      events: combat.log, state: combat.state, party: survivors,
      spellsUsedBefore: new Set<Id>(), rounds: combat.state.round,
      foes: w.encounter.members.length,
      // The sweep never studies — it plays the fight, not the gate screen.
      studied: false,
    });
    for (const [i, b] of claimed.entries()) {
      bump(T.bountiesClaimed, b.id);
      const offer = spoilOffer(runSeed, day?.dayNumber ?? wave, half, i, level);
      if (offer.length === 0) { T.spoilsEmpty += 1; continue; }
      // A player takes the shiniest thing on the table. Not always right, but
      // it is the choice that needs no knowledge of the party, and it keeps the
      // measurement about supply rather than about how clever the picker is.
      const take = [...offer].sort((a, b2) => (itemPrice(b2) ?? 0) - (itemPrice(a) ?? 0))[0]!;
      addItem(c.characters[T.fights % c.characters.length]!.inventory, take);
      bump(T.spoilsTaken, take);
      bump(T.spoilTiers, spoilTierFor(level));
    }
    // A day is one payday: the morning is the toll you pay to reach the
    // afternoon, not a second purse. Paying both would double a day's income
    // against the old loop's and make every shop comparison meaningless.
    if (!day || half === 'afternoon') c.gold += w.purse;
    if (!day) longRest(c);
  } else if (!day) {
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

/**
 * Wear what you bought.
 *
 * `buyItem` only fills a pack — equipping is a separate call the web player
 * makes by hand, and the harness never made it. Every armor purchase in every
 * sweep before this one therefore sat in a rucksack: parties were spending real
 * gold on Splint and fighting in their starting kit, which made armor
 * completely invisible to measurement and quietly understated the value of
 * every gold sink we have ever added.
 *
 * The choice is by resulting armor class, with two deductions that keep the
 * heaviest option from being automatic:
 *
 *   - a point off if it would cost this hero 10 feet of speed, and
 *   - a point off for Stealth disadvantage, but only for a hero who is
 *     actually proficient in Stealth — plate does not bother a cleric, and
 *     it ends a rogue's entire game plan.
 */
function equipUpgrades(c: CampaignState): void {
  for (let i = 0; i < c.characters.length; i++) {
    const ch = c.characters[i]!;
    const party = buildCampaignParty(c);
    const me = party[i]!;
    const dexMod = Math.floor((me.abilities.dex - 10) / 2);
    const shieldAc = me.equipped.offHand ? 2 : 0;
    const sneaks = (CLASSES[ch.classId]?.skillProfs ?? []).includes('stealth');
    const score = (id: Id | undefined): number => {
      if (id === undefined) return armorClass(undefined, dexMod, shieldAc);
      return armorClass(id, dexMod, shieldAc)
        - (armorSpeedPenalty(id, me.abilities.str) > 0 ? 1 : 0)
        - (sneaks && armorStealthDisadvantage(id) ? 1 : 0);
    };
    const candidates = ch.inventory
      .filter((s) => s.qty > 0 && ARMOR[s.itemId] && equipBlocked(c, i, s.itemId, 'armor') === undefined)
      .map((s) => s.itemId)
      .sort((a, b) => score(b) - score(a));
    const best = candidates[0];
    if (best !== undefined && score(best) > score(ch.equipped.armor)) {
      if (equipItem(c, i, best, 'armor')) bump(T.armorEquipped, best);
    }
  }
}

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
  equipUpgrades(c);
  const cheapest = Math.min(...shelf.map(priced));
  if (c.gold >= cheapest && Number.isFinite(cheapest)) T.goldUnspendable += 1;
}

// --- one run --------------------------------------------------------------

/**
 * The two-fight day, played the way the web game plays it.
 *
 * Morning and afternoon are the same wave budget drawn twice; the difference
 * between them is entirely what the party has left. A lost day rolls the
 * calendar forward and drops the party back on the morning fight — the same
 * morning fight, because the day's difficulty is frozen at the level it was
 * first met, so the only thing that changes on a retry is the party.
 */
function playDays(c: CampaignState, seed: number, seenLevels: Set<number>): number {
  let run: ArenaRunState = newArenaRun(seed);
  let retries = 0;                          // burned on the day now in progress
  let levelAtFirstTry = partyLevelOf(c);
  while (dayOf(run) <= 60) {
    const live = partyLevelOf(c);
    if (!seenLevels.has(live)) {
      seenLevels.add(live);
      const list = T.wavesToLevel.get(live) ?? [];
      list.push(run.wave);
      T.wavesToLevel.set(live, list);
    }
    // Freeze this day's difficulty the first time it is entered, exactly as the
    // arena screen does. Everything after this reads `dayLevel`, not `live`.
    if (run.dayLevel === undefined) run = { ...run, dayLevel: live };
    const dayLevel = dayLevelOf(run, live);
    if (retries === 0) { T.day.entered += 1; levelAtFirstTry = live; }

    let outcome: boolean | 'stalled';
    try {
      outcome = fight(c, seed, dayLevel, run.wave, retries + 1, { half: 'morning', dayNumber: dayOf(run) });
    } catch (err) {
      T.errors.push({ run: seed, where: `day ${dayOf(run)} morning`, message: String(err) });
      break;
    }
    if (outcome === 'stalled') break;
    T.day.morning.fights += 1;

    let won = false;
    if (outcome) {
      T.day.morning.wins += 1;
      run = advanceDay(run, true, 0);       // morning cleared → afternoon
      const meal = lunch(c);
      T.day.lunchDice.push(meal.hitDiceSpent ?? 0);
      T.day.lunchRevived += meal.revived ?? 0;
      if ((meal.hitDiceSpent ?? 0) === 0) T.day.lunchBroke += 1;

      try {
        outcome = fight(c, seed, dayLevel, run.wave, retries + 1, { half: 'afternoon', dayNumber: dayOf(run) });
      } catch (err) {
        T.errors.push({ run: seed, where: `day ${dayOf(run)} afternoon`, message: String(err) });
        break;
      }
      if (outcome === 'stalled') break;
      T.day.afternoon.fights += 1;
      if (outcome) { T.day.afternoon.wins += 1; won = true; }
      else T.day.lostInAfternoon += 1;
    } else T.day.lostInMorning += 1;

    let broke = false;
    if (!won) {
      // The powers that be put the party back on its feet, and take their cut.
      const bill = isFirstDefeat(run) ? 0 : revivalCost(dayLevel, run.wave);
      T.day.billed.push(bill);
      const paid = payRevival(c, bill);
      if (paid.insolvent) { T.day.insolvent += 1; T.day.brokeOnDay.push(dayOf(run)); broke = true; }
      else {
        T.day.soldToPay += paid.sold.length;
        if (paid.sold.length > 0) T.day.daysWithSale += 1;
      }
      reviveParty(c);
    }
    run = advanceDay(run, won, 0);
    noteSpentItems(c, run.cleared);
    night(c, run.cleared);
    // The finish line: the experience for level 8, one rung past the top of
    // the implemented classes. Checked at the end of every day rather than only
    // after a won one — the experience is earned either way, and a party
    // holding enough of it should not have to keep fighting to be told so.
    if (runComplete(c.xp)) break;
    if (broke) break;

    if (won) {
      T.day.cleared += 1;
      if (retries > 0) {
        T.day.clearedOnRetry += 1;
        if (partyLevelOf(c) > levelAtFirstTry) T.day.rescuedByLevel += 1;
      }
      retries = 0;
      shop(c, partyLevelOf(c), `${seed}:${run.wave}`);
    } else {
      retries += 1;
      // A player who has lost the same day three times has learned what the
      // day is going to do. Walking away here is the honest model.
      if (retries > DAY_RETRIES) { T.day.abandoned += 1; break; }
    }
    if (run.wave > 40) break;
  }
  T.day.daysPerRun.push(dayOf(run) - 1);
  const summary = summarise(run, c.xp);
  T.day.allWinRates.push(summary.winRate);
  if (summary.completed) {
    T.day.completed += 1;
    bump(T.day.medals, summary.medal!);
    T.day.completedOnDay.push(summary.days);
    T.day.completerWinRates.push(summary.winRate);
  }
  return run.wave;
}

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

  if (DAYS) wave = playDays(c, seed, seenLevels);
  else while (losses < PATIENCE) {
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
  T.finalXp.push(c.xp);
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

if (DAYS) {
  const d = T.day;
  console.log('\n--- the arena day (two fights, one lunch) ---');
  console.log(`  days entered ${d.entered}, cleared ${d.cleared} (${pct(d.cleared, d.entered)}), abandoned ${d.abandoned}`);
  console.log(`  morning   ${pct(d.morning.wins, d.morning.fights)} of ${d.morning.fights}`);
  console.log(`  afternoon ${pct(d.afternoon.wins, d.afternoon.fights)} of ${d.afternoon.fights}` +
    '   (same wave budget — the gap is depletion)');
  const gap = (d.morning.fights && d.afternoon.fights)
    ? Math.round((d.morning.wins / d.morning.fights - d.afternoon.wins / d.afternoon.fights) * 100)
    : 0;
  console.log(`  afternoon costs ${gap} points of win rate`);
  if (gap <= 0) {
    console.log(`${FLAG}the afternoon is no harder than the morning — depletion is not biting`);
  }
  const lost = d.lostInMorning + d.lostInAfternoon;
  console.log(`  lost days: ${d.lostInMorning} in the morning, ${d.lostInAfternoon} in the afternoon` +
    (lost ? ` (${pct(d.lostInAfternoon, lost)} of losses come after a win)` : ''));
  console.log(`  retried days cleared ${d.clearedOnRetry}, of which ${d.rescuedByLevel} only after a level-up`);
  if (d.clearedOnRetry === 0 && lost > 0) {
    console.log(`${FLAG}no day was ever cleared on a retry — a lost day is a wall, not a puzzle`);
  }
  console.log(`  lunch: median ${median(d.lunchDice)} hit dice spent, ${d.lunchRevived} heroes raised, ` +
    `${pct(d.lunchBroke, d.lunchDice.length)} of lunches spent none`);
  console.log(`  days per run: median ${median(d.daysPerRun)}, max ${Math.max(0, ...d.daysPerRun)}`);
  console.log(`  XP at end: median ${median(T.finalXp)}, max ${Math.max(0, ...T.finalXp)} (level 8 is 34000)`);
  console.log(`  runs completed: ${d.completed} of ${RUNS}` +
    (d.completedOnDay.length ? ` — on day ${median(d.completedOnDay)} typically` : '') +
    `   medals ${[...d.medals.entries()].map(([m, n]) => `${m} ${n}`).join(', ') || 'none'}`);
  console.log(`  win rate — all runs: median ${median(d.allWinRates)}%` +
    (d.completerWinRates.length
      ? `, completers: median ${median(d.completerWinRates)}%, range ${Math.min(...d.completerWinRates)}-${Math.max(...d.completerWinRates)}%`
      : ''));
  if (d.completed === 0) {
    console.log(`${FLAG}nobody finished — the finish line is out of reach at this retry budget`);
  }
  console.log(`  defeat tax: median ${median(d.billed)}g billed over ${d.billed.length} lost days, ` +
    `${d.soldToPay} items sold across ${d.daysWithSale} of them`);
  console.log(`  runs ended broke: ${d.insolvent} of ${RUNS} (the rest gave up or stalled)` +
    (d.brokeOnDay.length ? ` — on day ${median(d.brokeOnDay)} typically, earliest ${Math.min(...d.brokeOnDay)}` : ''));
  if (d.insolvent === 0) {
    console.log(`${FLAG}nobody ever went under — the defeat tax is not a loss condition, only a fee`);
  }
}

{
  const claimed = [...T.bountiesClaimed.entries()].sort((a, b) => b[1] - a[1]);
  const taken = [...T.spoilsTaken.entries()].sort((a, b) => b[1] - a[1]);
  const total = [...T.spoilsTaken.values()].reduce((a, b) => a + b, 0);
  console.log('\n--- bounties and awards ---');
  console.log(`  bounties claimed ${[...T.bountiesClaimed.values()].reduce((a, b) => a + b, 0)}` +
    `   awards taken ${total}   (${[...T.spoilTiers.entries()].map(([k, n]) => `${k} ${n}`).join(', ') || 'none'})`);
  console.log(`  most claimed: ${claimed.slice(0, 5).map(([id, n]) => `${id}×${n}`).join(', ') || 'none'}`);
  console.log(`  most taken: ${taken.slice(0, 6).map(([id, n]) => `${itemName(id)}×${n}`).join(', ') || 'none'}`);
  console.log(`  distinct items awarded: ${T.spoilsTaken.size}`);
  if (total === 0) {
    console.log(`${FLAG}no award ever reached a player — permanent magic has no other source`);
  }
  if (T.spoilsEmpty > 0) {
    console.log(`${FLAG}${T.spoilsEmpty} bounties paid an EMPTY award — the pool was exhausted`);
  }
}

console.log('\n--- economy ---');
console.log(`  shop visits ${T.shopVisits}, distinct items bought ${T.itemsBought.size}`);
console.log(`  gold at end of run: median ${median(T.goldAtEnd)}, max ${Math.max(...T.goldAtEnd)}`);
if (T.goldUnspendable > 0) {
  console.log(`${FLAG}left the shop still able to afford something on ${T.goldUnspendable} of ${T.shopVisits} visits`);
}
const topBuys = [...T.itemsBought.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
console.log(`  most bought: ${topBuys.map(([id, n]) => `${itemName(id)}×${n}`).join(', ')}`);

{
  const worn = [...T.armorEquipped.entries()].sort((a, b) => b[1] - a[1]);
  console.log(`  armor actually worn: ${worn.length ? worn.map(([id, n]) => `${itemName(id)}×${n}`).join(', ') : 'none'}`);
}

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

console.log('\n--- enemy deployment ---');
{
  const total = [...T.deployPatterns.values()].reduce((a, b) => a + b, 0) || 1;
  console.log('  ' + [...T.deployPatterns.entries()].sort((a, b) => b[1] - a[1])
    .map(([k, n]) => `${k} ${Math.round((100 * n) / total)}%`).join('   '));
}

console.log('\n--- failures ---');
if (T.stalls.length) console.log(`${FLAG}${T.stalls.length} fights never ended: ${JSON.stringify(T.stalls.slice(0, 5))}`);
if (T.errors.length) {
  console.log(`${FLAG}${T.errors.length} runs threw:`);
  for (const e of T.errors.slice(0, 5)) console.log(`      run ${e.run} ${e.where}: ${e.message.slice(0, 160)}`);
}
if (!T.stalls.length && !T.errors.length) console.log('  no stalls, no exceptions.');
