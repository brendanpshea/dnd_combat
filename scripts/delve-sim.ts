/**
 * Whole delves, played through with real fights.
 *
 *   npx tsx scripts/delve-sim.ts [--n 20] [--levels 1,3,5] [--fights authored,generated,inhabitants]
 *                                [--floors 1] [--shape classic] [--pieces warden,lair] [--seed0 1] [--json]
 *
 * The delve tests prove a generated place CAN be won. This asks whether it
 * WILL be, and at what cost: every fight is the real combat engine with the
 * greedy AI on both sides, on the board the game draws for that room; hit
 * points, spell slots and items carry from fight to fight; the party rests
 * by the dungeon's own rules, and walks back in after a wipe.
 *
 * The player it models is careful, not clever: it explores every room it can
 * reach before the goal, searches everything, rests when hurt, never talks a
 * fight down and never sneaks. That is the honest baseline for "how hard is
 * this place" — a cleverer player only does better.
 */
import { Combat } from '../src/engine/combat.js';
import { chooseAction } from '../src/ai/greedy.js';
import { isDown, type TeamId } from '../src/engine/types.js';
import {
  newCampaign, buildCampaignParty, applyAdventureVictory, readBackSurvivors, levelForXp, itemPrice, type CampaignState,
} from '../src/campaign/campaign.js';
import { buildEncounter, encounterFor } from '../src/data/encounters.js';
import { adjustedXp } from '../src/arena/encounter.js';
import { evenBudgetFor } from '../src/arena/run.js';
import {
  startAdventure, enterScene, currentScene, legalChoices, choose, resolveBattle, battleWonBefore,
  dungeonExits, walkTo, forceDoor, canSearch, searchRoom, dungeonExitHere, leaveDungeon,
  dungeonProgress, dungeonRoute, battleMap, battleSeed, restOptions, campRest, type AdventureState,
} from '../src/adventure/runtime.js';
import { generateSpecDelve, SHARES, type DelveSpec } from '../src/adventure/delve-spec.js';
import type { Module } from '../src/adventure/types.js';

const MAX_DECISIONS = 4000;
const MAX_WIPES = 3;
const HURT_HP = Number(arg('hurt-hp', '0.7'));
const HURT_SLOTS = Number(arg('hurt-slots', '0.5'));

export interface FightRecord {
  scene: string; won: boolean; rounds: number; share: number; kind: 'room' | 'key' | 'goal' | 'piece' | 'ambush' | 'camp';
  /** What the party walked in with. */
  hp: number; slots: number;
  /** The first time this fight was fought in this delve. */
  first: boolean;
}
export interface DelveResult {
  won: boolean; wipes: number; fights: FightRecord[]; longRests: number; shortRests: number;
  endLevel: number; startLevel: number; stalled: boolean; steps: number;
  /** Coin picked up, and what the loot it carried out would sell for (half
   *  price, as the shops buy). What a delve pays, for the town to spend. */
  gold: number; lootValue: number;
}

/** One fight, to the end, with the real engine. */
function fight(state: AdventureState, module: Module): { won: boolean; rounds: number; stalled: boolean } {
  const scene = currentScene(state, module);
  if (scene.kind !== 'battle') throw new Error('not a battle');
  const board = battleMap(state, module);
  const heroes = buildCampaignParty(state.campaign);
  const combat = new Combat({
    seed: battleSeed(state, scene.id), map: board,
    combatants: [...heroes, ...buildEncounter(scene.encounterId, 'team2', board.rows.length - 1)],
  });
  let n = 0;
  while (!combat.winner() && n++ < MAX_DECISIONS) combat.apply(chooseAction(combat.state, combat.activeId) ?? { kind: 'endTurn' });
  const winner: TeamId | null = combat.winner();
  const won = winner === 'team1';
  const survivors = Object.values(combat.state.combatants).filter((x) => x.team === 'team1');
  if (won) {
    if (scene.loot === false || battleWonBefore(state, scene.id)) readBackSurvivors(state.campaign, survivors);
    else applyAdventureVictory(state.campaign, survivors, scene.encounterId, combat.state.rng, scene.loot?.bonusTier);
  }
  resolveBattle(state, module, won);
  return { won, rounds: combat.state.round, stalled: !winner };
}

/** What the party has left, 0–1: hit points, and spell slots (where it has any). */
function reserves(c: CampaignState): { hp: number; slots: number } {
  const party = buildCampaignParty(c);
  const hp = party.reduce((a, p) => a + p.hp, 0) / Math.max(1, party.reduce((a, p) => a + p.maxHp, 0));
  const pools = party.flatMap((p) => p.spellSlots);
  const max = pools.reduce((a, x) => a + x.max, 0);
  return { hp, slots: max ? pools.reduce((a, x) => a + x.current, 0) / max : 1 };
}

/** Worth resting: a careful player tops up before the next door, not after
 *  the party is on its knees. */
function hurt(c: CampaignState): boolean {
  const r = reserves(c);
  return r.hp < HURT_HP || r.slots < HURT_SLOTS || buildCampaignParty(c).some((p) => isDown(p));
}

export function simulateDelve(module: Module, seed: number, startLevel: number): DelveResult {
  const state = startAdventure(newCampaign(seed), module);
  state.campaign.partyReady = true;
  enterScene(state, module, module.start);
  const r: DelveResult = { won: false, wipes: 0, fights: [], longRests: 0, shortRests: 0, endLevel: 0, startLevel, stalled: false, steps: 0, gold: 0, lootValue: 0 };
  const goldAtStart = state.campaign.gold;
  const carried = () => [...(state.campaign.stash ?? []), ...state.campaign.characters.flatMap((c) => c.inventory)]
    .reduce((a, x) => a + Math.floor((itemPrice(x.itemId) ?? 0) / 2) * x.qty, 0);
  const lootAtStart = carried();
  let shortsSinceLong = 0;
  /** Rooms already walked to for a rest this time round: never twice. */
  const restTried = new Set<string>();
  /** Floors whose pre-boss rest has been had (or could not be). Cleared by a wipe. */
  const restedForBoss = new Set<string>();
  const level = () => levelForXp(state.campaign.xp);
  for (; r.steps < 4000; r.steps++) {
    const scene = currentScene(state, module);
    if (scene.kind === 'ending') { r.won = scene.outcome === 'victory'; break; }
    if (scene.kind === 'battle') {
      const kind: FightRecord['kind'] = scene.id.includes('camp-fight') ? 'camp' : scene.id.includes('ambush') ? 'ambush'
        : /-p\d+-/.test(scene.id) ? 'piece' : scene.id.endsWith('fight-key') ? 'key'
        : Object.values(module.scenes).some((s) => s.kind === 'dungeon' && s.dungeon.rooms.some((x) => x.goal && x.fight === scene.id)) ? 'goal' : 'room';
      const enc = encounterFor(scene.encounterId)!;
      const share = adjustedXp(enc.members) / evenBudgetFor(level());
      const before = reserves(state.campaign);
      const out = fight(state, module);
      r.fights.push({ scene: scene.id, won: out.won, rounds: out.rounds, share, kind, hp: before.hp, slots: before.slots,
        first: !r.fights.some((x) => x.scene === scene.id) });
      restTried.clear();
      if (out.stalled) r.stalled = true;
      if (!out.won) restedForBoss.clear();
      if (!out.won && ++r.wipes >= MAX_WIPES) break;
      continue;
    }
    if (scene.kind === 'dungeon') {
      const d = scene.dungeon;
      const p = dungeonProgress(state, scene.id, d);
      // Hurt: a night if it can, an hour if not — walking back to somewhere
      // quiet first, the way a player does (no resting next to a room still
      // full of enemies), and to a safe room for a night when there is one.
      // Everything else seen to: about to walk into the goal. A careful party
      // goes in rested, so the bar for resting is higher here.
      const goalId = d.rooms.find((x) => x.goal)?.id;
      const onlyGoalLeft = !d.rooms.some((x) => x.id !== goalId && !p.seen.includes(x.id) && dungeonRoute(state, module, x.id));
      const res = reserves(state.campaign);
      const beforeBoss = onlyGoalLeft && (res.hp < 0.9 || res.slots < 0.8) && !restedForBoss.has(scene.id);
      if (hurt(state.campaign) || beforeBoss) {
        const opt = restOptions(state, module);
        if (opt.long.ok) {
          campRest(state, module, 'long'); r.longRests++; shortsSinceLong = 0; restTried.clear();
          if (beforeBoss) restedForBoss.add(scene.id);
          continue;
        }
        const won = (id: string) => { const f = d.rooms.find((x) => x.id === id)?.fight; return !f || battleWonBefore(state, f); };
        const quiet = (id: string) => won(id) && d.links.every((l) => (l.a !== id && l.b !== id) || won(l.a === id ? l.b : l.a));
        const reach = (id: string) => id !== p.at && !restTried.has(id) && p.seen.includes(id) && quiet(id) && dungeonRoute(state, module, id);
        const safe = d.rooms.find((x) => x.rest === 'safe' && reach(x.id));
        if (safe) { restTried.add(safe.id); walkTo(state, module, safe.id); continue; }
        if (opt.short.ok && shortsSinceLong < 2) { campRest(state, module, 'short'); r.shortRests++; shortsSinceLong++; continue; }
        const calm = shortsSinceLong < 2 ? d.rooms.find((x) => x.rest !== 'none' && reach(x.id)) : undefined;
        if (calm) { restTried.add(calm.id); walkTo(state, module, calm.id); continue; }
        // Nothing more to be had: go in as it is.
        if (beforeBoss) restedForBoss.add(scene.id);
      }
      const exit = dungeonExitHere(state, module);
      if (canSearch(state, module)) { searchRoom(state, module); continue; }
      const goal = d.rooms.find((x) => x.goal)?.id;
      // Everything it can reach first, the goal last.
      const next = d.rooms.find((x) => x.id !== goal && !p.seen.includes(x.id) && dungeonRoute(state, module, x.id));
      if (next) { walkTo(state, module, next.id); continue; }
      const shut = dungeonExits(state, module).find((x) => x.blocked && x.force);
      if (shut) { forceDoor(state, module, shut.link); continue; }
      if (exit && exit.label === 'Down the stairs') { leaveDungeon(state, module); continue; }
      if (goal && p.at !== goal && dungeonRoute(state, module, goal)) { walkTo(state, module, goal); continue; }
      // Nowhere new to go: back along a known way to a room with a door not yet tried.
      const open = dungeonExits(state, module).filter((x) => !x.blocked);
      if (open.length) { walkTo(state, module, open[r.steps % open.length]!.to); continue; }
      if (exit) { leaveDungeon(state, module); continue; }
      break;
    }
    const options = legalChoices(state, module).filter((o) => !o.blocked);
    const pick = options.find((o) => o.choice.id === 'in' || o.choice.id === 'on') ?? options[0];
    if (!pick) break;
    choose(state, module, pick.choice.id);
  }
  r.endLevel = level();
  r.gold = state.campaign.gold - goldAtStart;
  r.lootValue = carried() - lootAtStart;
  return r;
}

// --- CLI ---------------------------------------------------------------------

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1]! : fallback;
}

if (process.argv[1]?.endsWith('delve-sim.ts')) {
  const N = Number(arg('n', '20'));
  const seed0 = Number(arg('seed0', '1'));
  const levels = arg('levels', '1,3,5').split(',').map(Number);
  const modes = arg('fights', 'authored,generated,inhabitants').split(',') as NonNullable<DelveSpec['fights']>[];
  const floors = Number(arg('floors', '1'));
  const shape = arg('shape', 'classic') as NonNullable<DelveSpec['shape']>;
  const pieces = arg('pieces', '').split(',').filter(Boolean).map((piece) => ({ piece }));
  const json = process.argv.includes('--json');
  // Sweeps: --room 0.3 / --boss 0.5,0.5,0.45 (one per level, last repeats).
  for (const role of ['room', 'elite', 'boss'] as const) {
    const v = arg(role, '');
    if (v) SHARES[role] = v.split(',').map(Number);
  }
  const rows: unknown[] = [];
  for (const level of levels) for (const fights of modes) {
    const res: DelveResult[] = [];
    const t = Date.now();
    for (let s = seed0; s < seed0 + N; s++) {
      const { module } = generateSpecDelve(s, { level, fights, floors, shape, theme: 'stone', ...(pieces.length ? { pieces } : {}) });
      res.push(simulateDelve(module, s, level));
    }
    const all = res.flatMap((x) => x.fights);
    const first = (k: FightRecord['kind']) => {
      const f = all.filter((x) => x.kind === k && x.first);
      const m = (g: (x: FightRecord) => number) => (f.reduce((a, x) => a + g(x), 0) / f.length).toFixed(2);
      return f.length ? `${k} ${(100 * f.filter((x) => x.won).length / f.length).toFixed(0)}% of ${f.length} @${m((x) => x.share)} hp${m((x) => x.hp)} sl${m((x) => x.slots)}` : '';
    };
    const row = {
      level, fights, floors, n: N,
      cleared: res.filter((x) => x.won).length,
      noWipe: res.filter((x) => x.won && x.wipes === 0).length,
      wipes: res.reduce((a, x) => a + x.wipes, 0),
      nFights: all.length, longRests: res.reduce((a, x) => a + x.longRests, 0), shortRests: res.reduce((a, x) => a + x.shortRests, 0),
      stalled: res.filter((x) => x.stalled).length,
      gold: Math.round(res.reduce((a, x) => a + x.gold, 0) / N), loot: Math.round(res.reduce((a, x) => a + x.lootValue, 0) / N),
      byKind: ['room', 'key', 'goal', 'piece', 'ambush', 'camp'].map((k) => first(k as FightRecord['kind'])).filter(Boolean),
      secs: Math.round((Date.now() - t) / 1000),
    };
    rows.push(row);
    if (!json) {
      console.log(`L${level} ${fights.padEnd(11)} cleared ${row.cleared}/${N} (no wipe ${row.noWipe}) wipes ${row.wipes} fights ${row.nFights} rests ${row.longRests}L/${row.shortRests}S stalled ${row.stalled} ${row.secs}s`);
      console.log(`   ${row.byKind.join(' | ')}`);
      console.log(`   pays: ${row.gold} gold + ${row.loot} in loot (at sale price), a delve on average`);
    }
  }
  if (json) console.log(JSON.stringify(rows));
}
