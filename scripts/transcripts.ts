/**
 * Route transcripts: the exact text a player reads, in order, for a handful of
 * fixed playthroughs of the trilogy.
 *
 *   npm run transcripts              # write docs/transcripts/<route>.md
 *   npm run transcripts -- --check   # fail if the files on disk are stale
 *
 * WHY
 *
 * A module is a graph of scenes, and the contradictions reviewers keep finding
 * live *between* scenes: a character greets you from camp right after walking
 * down the mountain beside you, a dawn announces something the party already
 * stopped. Each scene reads fine on its own in the source; the mistake only
 * shows when two of them are read in the order a player meets them. So this
 * plays real routes headlessly and prints what the player would see.
 *
 * WHERE THE WORDS COME FROM
 *
 * Prose is read off the runtime's own event stream (`text`, `room`, `dawn`,
 * `check` …), so conditional paragraphs (`{ if, text }`), ending slides and
 * dawns appear exactly when the player would see them. Only what the runtime
 * does not emit — a choice's label, a map marker's name, an NPC's name, an
 * encounter's name — is taken from the module data.
 *
 * HOW A ROUTE IS DRIVEN
 *
 * The driver below mirrors `runModule` (src/adventure/runner.ts) step for
 * step, and adds what a player can do that `runModule` never does: fall back
 * from a fight, try a parley, make camp on a map, and steer a skill check.
 * Checks are steered the honest way — the dice still come from
 * `campaign.rng`; the driver tries the action on a copy of the state, and if
 * the outcome is not the one the route wants, re-seeds the rng and tries again
 * (up to 64 times). The rng then carries on from the seed that worked, so a
 * route is fully deterministic. Battles are not simulated: the route decides
 * won/lost, and a win grants encounter XP as `runModule` does (no treasure).
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import type { Module, Scene, Choice } from '../src/adventure/types.js';
import { HUB_REF } from '../src/adventure/types.js';
import { refsOf } from '../src/adventure/graph.js';
import { roomOf, linksFrom } from '../src/adventure/dungeon.js';
import {
  type AdventureState, type AdventureEvent,
  startAdventure, carryCompanyInto, carriedFlags, currentScene, enterScene, legalChoices, choose,
  rollSceneCheck, nightsLeft, legalApproaches, tryApproach, exploreNodes, enterNode, resolveBattle,
  resolveShopOrRest, dungeonExits, walkTo, canSearch, searchRoom, forceDoor, dungeonExitHere,
  leaveDungeon, battleOptions, parleyBattle, fleeBattle, campRule, campRest, dungeonProgress,
  endingText, dayOf,
} from '../src/adventure/runtime.js';
import { type CampaignState, newCampaign, xpAward, itemName, fullRest } from '../src/campaign/campaign.js';
import { seedRng } from '../src/engine/rng.js';
import { ENCOUNTERS } from '../src/data/encounters.js';
import { SKILL_LABEL, type SkillId } from '../src/data/classes.js';
import { moduleById } from '../src/data/modules/index.js';

// --- Routes -----------------------------------------------------------------

type CheckWish = 'pass' | 'fail' | 'natural';

/** One thing the player could do next, as the policy sees it. */
interface Option {
  /** Stable key: how often this exact option has been taken drives `times`. */
  key: string;
  /** What the player taps, as the transcript prints it. */
  label: string;
  /** Static scene-graph distance to a victory ending (lower = progress). */
  dist: number;
  /** Times this option was taken before on this route. */
  times: number;
  /** Leads somewhere never seen (an unvisited scene, an unexplored marker…). */
  novel: boolean;
  /** Its target is a defeat ending: never taken while anything else is on offer. */
  defeat: boolean;
  /** Keyword score for the cruel route (see CRUEL_WORDS). */
  cruel: number;
  /** The merciful route's score for it (see `mercy`). */
  mercy: number;
  /** Runs the option; returns the events it produced. */
  run: () => AdventureEvent[];
  /** The option rolls dice the route may want to steer. */
  rolls: boolean;
  /** Printed before the events: how the option reads. */
  kind: 'choice' | 'node' | 'approach' | 'room' | 'search' | 'force' | 'leave';
}

interface Route {
  id: string;
  title: string;
  summary: string[];
  seed: number;
  chapters: string[];
  /** Cold start: a fresh company starts the first chapter listed, as the menu does. */
  cold?: boolean;
  /** Lexicographic score, lower is better. */
  score(o: Option): number[];
  check: CheckWish;
  /** Before a fight. */
  battle(ctx: BattleCtx): 'fight' | 'parley' | 'flee';
  /** The fight itself. */
  win(ctx: BattleCtx): boolean;
  /** Make camp on this map now? */
  camp(ctx: { fightsSinceRest: number; lostSinceRest: number }): boolean;
}

interface BattleCtx {
  sceneId: string;
  attempts: number;
  /** How many times the route has stood at this fight's door. */
  doorVisits: number;
  canFlee: boolean;
  canParley: boolean;
  /** Losing this fight lands on a defeat ending (so no route loses it on purpose). */
  lossEnds: boolean;
  /** The fight has its own loss beat (`onLoss`) that does not end the run. */
  authoredLoss: boolean;
  /** 1 for the first distinct fight met in the chapter, 2 for the next… */
  ordinal: number;
}

const CAP = 999; // stands in for "no static way to a victory ending"
const d = (o: Option) => Math.min(o.dist, CAP);

/**
 * The cruel route's heuristic: a keyword score over the option's label and
 * id. Selfish, violent and refusing words score; merciful ones count against.
 * Applied only to an option not yet taken, so a cruel choice that loops back
 * cannot trap the route.
 */
const CRUEL_WORDS: Array<[RegExp, number]> = [
  [/\bkill|\bexecut|\bhang\b|\bslay|\bmurder|end it|finish (him|her|them|it)|cut (his|her) throat|\bstab/i, 4],
  [/\bkeep\b|\bpocket|\bloot|\bsteal|\btake (it|the|all|everything)|\bsell|\bcharge|\bdemand|\bextort|\bthreat|\bintimidat|\bbully/i, 3],
  [/\brefuse|\bleave (him|her|them|it)|\babandon|\bwalk away|\bignore|\bno\b|\bnot our|\bnone of/i, 2],
  [/\bfight|\battack|\bcharge in|\bdraw steel|\bburn|\bsmash|\bforce/i, 1],
  [/\bspare|\bfree\b|\bfree (him|her|them)|\bhelp|\bsave|\bmercy|\bforgive|\bthank|\bshare|\bgive|\breturn (it|the)|\bpay\b|\bcomfort|\bbury/i, -2],
];
function cruelty(text: string): number {
  return CRUEL_WORDS.reduce((s, [re, w]) => s + (re.test(text) ? w : 0), 0);
}

/**
 * The merciful route's heuristic: the cruel words counted the other way,
 * and owning a wrong or keeping faith scores too.
 */
const KIND_WORDS: Array<[RegExp, number]> = [
  // Owning a wrong outweighs naming it ("Killing her broke the vigil… sorry").
  [/\bsorry|\bapolog/i, 6],
  [/\bvigil|\bbless|\bmend|for the reeve/i, 3],
];
function mercy(text: string): number {
  return KIND_WORDS.reduce((s, [re, w]) => s + (re.test(text) ? w : 0), -cruelty(text));
}

/**
 * Distance to the ending, plus a penalty for each time the option was taken
 * before, so a gated road sends a route round the hub until the gate opens
 * instead of looping. Walking back through a dungeon room costs only 1 a time
 * (rooms are one step apart), so a route crosses a room it has seen rather
 * than walking out of the dungeon.
 */
const rush = (o: Option): number => d(o) + (o.kind === 'room' ? 1 : 4) * o.times;

/**
 * Untaken options first — the furthest from the ending first, so a hub's side
 * content comes before the road on — then, once everything here has been
 * done, the rusher's score, so a seen-out hub is left rather than toured again
 * (an inn's "take a room" taken twice is two days off the chapter's clock).
 */
const completionist = (o: Option): number[] => {
  const fresh = o.kind === 'room' ? o.novel : o.times === 0;
  return [o.defeat ? 1 : 0, fresh ? 0 : 1, fresh ? -d(o) : rush(o)];
};

const ROUTES: Route[] = [
  {
    id: 'trilogy-completionist',
    title: 'Trilogy — completionist',
    summary: [
      'Plays all three chapters with one carried company.',
      'Prefers whatever it has not done yet: an untaken choice, an unexplored marker, an unseen room, an unsearched room, a door not yet forced. Among new options it takes the one *furthest* from the ending first (side content before the road on), so it sees each hub out before leaving it.',
      'Steers every skill check it rolls to a pass (re-seeding the rng until it passes, where that is possible at all).',
      'Fights every fight and wins it (never parleys, never falls back). Camps on a map after every two fights.',
    ],
    seed: 11,
    chapters: ['hollow-road', 'sunken-barrows', 'wyrmcalling'],
    score: completionist,
    check: 'pass',
    battle: () => 'fight',
    win: () => true,
    camp: ({ fightsSinceRest }) => fightsSinceRest >= 2,
  },
  {
    id: 'trilogy-rusher',
    title: 'Trilogy — rusher',
    summary: [
      'Plays all three chapters with one carried company.',
      'Heads for the ending: every option is scored by the static scene-graph distance from its target to the nearest victory ending (refs walked backwards from the endings; `@hub` returns count as no progress), plus 4 for each time it has already taken that option (1 for walking back into a dungeon room) — so a gated road sends it round the hub until the gate opens, rather than looping.',
      'In a dungeon it walks the room links toward the nearest goal room and leaves by the way out nearest the ending; it searches or forces a door only when nothing else is left.',
      'Natural rolls on every check. Parleys where a fight offers it (natural roll), otherwise fights and wins. Never camps.',
    ],
    seed: 23,
    chapters: ['hollow-road', 'sunken-barrows', 'wyrmcalling'],
    score: (o) => [o.defeat ? 1 : 0, rush(o)],
    check: 'natural',
    battle: ({ canParley }) => (canParley ? 'parley' : 'fight'),
    win: () => true,
    camp: () => false,
  },
  {
    id: 'trilogy-cruel',
    title: 'Trilogy — cruel',
    summary: [
      'Plays all three chapters with one carried company.',
      'Prefers selfish and violent options: a keyword score over each untaken option\'s label and id — kill/execute/"end it"/stab (+4), keep/loot/steal/sell/demand/threaten (+3), refuse/leave them/abandon/walk away/ignore/"no" (+2), fight/attack/burn/force (+1), and spare/free/help/save/mercy/give/pay/bury (−2). Ties, and options already taken, fall back to the rusher\'s distance score.',
      'Natural rolls on every check. Never parleys or falls back; fights and wins. Camps on a map after every two fights.',
    ],
    seed: 37,
    chapters: ['hollow-road', 'sunken-barrows', 'wyrmcalling'],
    score: (o) => [o.defeat ? 1 : 0, o.times > 0 ? 0 : -o.cruel, rush(o)],
    check: 'natural',
    battle: () => 'fight',
    win: () => true,
    camp: ({ fightsSinceRest }) => fightsSinceRest >= 2,
  },
  {
    id: 'trilogy-merciful',
    title: 'Trilogy — merciful',
    summary: [
      'Plays all three chapters with one carried company.',
      'Prefers kind options: the cruel route\'s keyword score counted the other way (spare/free/help/save/mercy/give/pay/bury first; kill/keep/loot/refuse last), with owning a wrong (sorry, apologise: +6) or keeping faith (vigil, bless, mend, "for the reeve": +3) scoring too. Ties, and options already taken, fall back to the rusher\'s distance score.',
      'Steers every skill check it rolls to a pass. Talks a fight down where it can; otherwise fights and wins. Camps on a map after every two fights.',
    ],
    seed: 79,
    chapters: ['hollow-road', 'sunken-barrows', 'wyrmcalling'],
    score: (o) => [o.defeat ? 1 : 0, o.times > 0 ? 0 : -o.mercy, rush(o)],
    check: 'pass',
    battle: ({ canParley }) => (canParley ? 'parley' : 'fight'),
    win: () => true,
    camp: ({ fightsSinceRest }) => fightsSinceRest >= 2,
  },
  {
    id: 'trilogy-unlucky',
    title: 'Trilogy — unlucky',
    summary: [
      'Plays all three chapters with one carried company, choosing like the rusher (distance to the ending).',
      'Steers every skill check it rolls to a failure — except where failing would land on a defeat ending, which it passes instead.',
      'At a fight\'s door: tries the parley if there is one (steered to fail). Numbering the chapter\'s fights in the order it meets them: it falls back from the 2nd, 5th, 8th… the first time it can; it loses the first attempt at the 1st, 4th, 7th… and at every fight with its own loss beat (`onLoss`) — never one whose loss ends the run — so the module\'s defeat scene or the fight\'s loss beat plays, and it wins the retry. Every other fight it wins.',
      'Camps on a map after any lost fight.',
    ],
    seed: 41,
    chapters: ['hollow-road', 'sunken-barrows', 'wyrmcalling'],
    score: (o) => [o.defeat ? 1 : 0, rush(o)],
    check: 'fail',
    battle: ({ canParley, canFlee, doorVisits, ordinal }) =>
      (canParley ? 'parley' : canFlee && doorVisits === 1 && ordinal % 3 === 2 ? 'flee' : 'fight'),
    win: ({ attempts, lossEnds, authoredLoss, ordinal }) =>
      attempts > 0 || lossEnds || !(authoredLoss || ordinal % 3 === 1),
    camp: ({ lostSinceRest }) => lostSinceRest > 0,
  },
  {
    id: 'cold-sunken-barrows',
    title: 'Cold start — The Sunken Barrows',
    summary: [
      'A fresh company starts chapter two from the menu, exactly as the app does it: `newCampaign` + `startAdventure` + `enterScene(start)`, no carried flags. The module\'s own opening `xpToLevel` floors bring it up to the chapter\'s level.',
      'Chooses like the completionist (untaken first, side content before progress), steers checks to a pass, fights and wins every fight, camps after every two fights.',
    ],
    seed: 53,
    chapters: ['sunken-barrows'],
    cold: true,
    score: completionist,
    check: 'pass',
    battle: () => 'fight',
    win: () => true,
    camp: ({ fightsSinceRest }) => fightsSinceRest >= 2,
  },
  {
    id: 'cold-wyrmcalling',
    title: 'Cold start — The Wyrmcalling',
    summary: [
      'A fresh company starts chapter three from the menu, exactly as the app does it: `newCampaign` + `startAdventure` + `enterScene(start)`, no carried flags. The module\'s own opening `xpToLevel` floors bring it up to the chapter\'s level.',
      'Chooses like the completionist (untaken first, side content before progress), steers checks to a pass, fights and wins every fight, camps after every two fights.',
    ],
    seed: 67,
    chapters: ['wyrmcalling'],
    cold: true,
    score: completionist,
    check: 'pass',
    battle: () => 'fight',
    win: () => true,
    camp: ({ fightsSinceRest }) => fightsSinceRest >= 2,
  },
];

// --- Static distances -------------------------------------------------------

/** Each scene's shortest static distance (in routing edges) to a victory ending. */
function distancesToVictory(module: Module): Map<string, number> {
  const back = new Map<string, string[]>();
  for (const scene of Object.values(module.scenes)) {
    for (const to of refsOf(scene)) {
      if (to === HUB_REF) continue;
      (back.get(to) ?? back.set(to, []).get(to)!).push(scene.id);
    }
  }
  const dist = new Map<string, number>();
  const q: string[] = [];
  for (const s of Object.values(module.scenes)) {
    if (s.kind === 'ending' && s.outcome === 'victory') { dist.set(s.id, 0); q.push(s.id); }
  }
  while (q.length) {
    const cur = q.shift()!;
    for (const from of back.get(cur) ?? []) {
      if (dist.has(from)) continue;
      dist.set(from, dist.get(cur)! + 1);
      q.push(from);
    }
  }
  return dist;
}

/** Rooms from `from` to the nearest goal room, walking links (doors ignored). */
function roomsToGoal(scene: Extract<Scene, { kind: 'dungeon' }>, from: string): number {
  const dg = scene.dungeon;
  const goals = new Set(dg.rooms.filter((r) => r.goal).map((r) => r.id));
  if (goals.size === 0) return 0;
  const seen = new Map([[from, 0]]);
  const q = [from];
  while (q.length) {
    const cur = q.shift()!;
    if (goals.has(cur)) return seen.get(cur)!;
    for (const { to } of linksFrom(dg, cur)) {
      if (seen.has(to)) continue;
      seen.set(to, seen.get(cur)! + 1);
      q.push(to);
    }
  }
  return CAP;
}

// --- The driver -------------------------------------------------------------

/** Run `act` with the rng re-seeded until its first roll comes out as wished. */
function steered(
  state: AdventureState, module: Module, wish: CheckWish, act: (s: AdventureState) => AdventureEvent[],
): { events: AdventureEvent[]; note?: string } {
  if (wish === 'natural') return { events: act(state) };
  const base = state.campaign.rng;
  const outcome = (events: AdventureEvent[]): boolean | undefined => {
    const e = events.find((x) => x.type === 'check' || x.type === 'groupCheck');
    return e && (e.type === 'check' || e.type === 'groupCheck') ? e.success : undefined;
  };
  const landsOnDefeat = (s: AdventureState): boolean => {
    const sc = module.scenes[s.sceneId];
    return sc?.kind === 'ending' && sc.outcome === 'defeat';
  };
  const trial = (rng: number, want: boolean): boolean => {
    const copy = structuredClone(state);
    copy.campaign.rng = rng;
    const ev = act(copy);
    const got = outcome(ev);
    return got === undefined || (got === want && !landsOnDefeat(copy));
  };
  const seedFor = (want: boolean): number | undefined => {
    for (let k = 0; k < 64; k++) {
      const rng = k === 0 ? base : seedRng((base ^ Math.imul(k, 0x9e3779b1)) >>> 0);
      if (trial(rng, want)) return rng;
    }
    return undefined;
  };
  let rng = seedFor(wish === 'pass');
  let note: string | undefined;
  if (rng === undefined && wish === 'fail') { rng = seedFor(true); note = 'route wanted a failure; failing here ends the run, so it passes'; }
  if (rng === undefined) { rng = base; note = `route wanted a ${wish}; no seed in 64 gave one`; }
  state.campaign.rng = rng;
  return { events: act(state), ...(note ? { note } : {}) };
}

interface ChapterResult {
  module: Module;
  state: AdventureState;
  ending: 'victory' | 'defeat';
  lines: string[];
  carriedIn: Record<string, boolean | number>;
}

class Transcript {
  lines: string[] = [];
  private seen = new Set<string>();
  private pendingRepeats: string[] = [];
  constructor(private module: Module, private state: () => AdventureState) {}

  private flushRepeats(): void {
    if (this.pendingRepeats.length === 0) return;
    const firsts = this.pendingRepeats.map((p) => `“${p.replace(/[*_]/g, '').split(/\s+/).slice(0, 7).join(' ')}…”`);
    this.lines.push(`_(${this.pendingRepeats.length === 1 ? 'a paragraph' : `${this.pendingRepeats.length} paragraphs`} shown before: ${firsts.join(' / ')})_`, '');
    this.pendingRepeats = [];
  }
  seenParagraph(p: string): boolean { return this.seen.has(p); }
  line(s: string): void { this.flushRepeats(); this.lines.push(s, ''); }
  /** A paragraph the player reads; one already printed in this chapter is folded. */
  para(p: string, quote = false): void {
    if (this.seen.has(p)) { this.pendingRepeats.push(p); return; }
    this.seen.add(p);
    this.flushRepeats();
    this.lines.push(quote ? `> ${p}` : p, '');
  }

  events(events: AdventureEvent[]): void {
    const module = this.module;
    let speaker: string | null = null;
    for (const e of events) {
      switch (e.type) {
        case 'scene': {
          const sc = module.scenes[e.sceneId]!;
          speaker = null;
          if (sc.kind === 'explore') { this.line(`**↳ ${sc.map.title}** <sub>(map \`${e.sceneId}\`)</sub>`); break; }
          if (sc.kind === 'dungeon') { this.line(`**↳ ${sc.dungeon.title}** <sub>(dungeon \`${e.sceneId}\`)</sub>`); break; }
          this.line(`<sub>scene \`${e.sceneId}\`${e.revisit ? ' (again)' : ''}</sub>`);
          if (sc.kind === 'dialogue') { speaker = sc.npc.name; this.line(`**${sc.npc.name}**`); }
          if (sc.kind === 'shop') this.line(`_The shop: ${sc.title ?? sc.npc?.name ?? 'a merchant'} (the route buys nothing)._`);
          break;
        }
        case 'text':
          for (const p of e.paragraphs) this.para(p, speaker !== null);
          speaker = null;
          break;
        case 'check': {
          const r = e.roll;
          const who = this.state().campaign.characters[r.by]?.name ?? `hero ${r.by}`;
          this.line(`\`[${SKILL_LABEL[r.skill as SkillId] ?? r.skill} DC ${r.dc} — ${who} rolls ${r.total} — ${e.success ? 'passed' : 'failed'}]\``);
          break;
        }
        case 'groupCheck': {
          const r0 = e.result.rolls[0];
          const passed = e.result.rolls.filter((r) => r.success).length;
          this.line(`\`[Group ${r0 ? SKILL_LABEL[r0.skill as SkillId] ?? r0.skill : ''} DC ${r0?.dc ?? '?'} — ${passed}/${e.result.rolls.length} pass — ${e.success ? 'passed' : 'failed'}]\``);
          break;
        }
        case 'gold': if (e.amount !== 0) this.line(`_${e.amount > 0 ? '+' : ''}${e.amount} gold (${e.total})_`); break;
        case 'item': if (e.qty > 0) this.line(`_${e.gained ? 'Gained' : 'Lost'}: ${itemName(e.itemId)}${e.qty > 1 ? ` ×${e.qty}` : ''}_`); break;
        case 'xp': if (e.leveledTo) this.line(`_Level up: ${e.leveledFrom} → ${e.leveledTo}_`); break;
        case 'journal': this.line(`_Journal (${e.entry.kind}): ${e.entry.title}_`); break;
        case 'companion': {
          const name = module.companions?.[e.companionId]?.name ?? e.companionId;
          this.line(`_${name} ${e.joined ? 'joins the party' : 'leaves the party'}._`);
          break;
        }
        case 'secretRevealed': this.line(`_Spotted: a hidden marker (${e.nodeId})._`); break;
        case 'dawn': this.line(`**Dawn — day ${e.day}.**`); break;
        case 'room': {
          this.line(`**→ ${e.name}** <sub>(room \`${e.roomId}\`)</sub>`);
          for (const p of e.firstVisit ?? []) this.para(p);
          break;
        }
        case 'doorFound': {
          const sc = module.scenes[this.state().hub ?? ''];
          const names = e.link.split('~').map((id) => (sc?.kind === 'dungeon' ? roomOf(sc.dungeon, id)?.name : undefined) ?? id);
          this.line(`_A hidden door: ${names.join(' ↔ ')}._`);
          break;
        }
        case 'startBattle':
          this.line(`**Battle:** ${ENCOUNTERS[e.encounterId]?.name ?? e.encounterId} <sub>(\`${e.encounterId}\` on \`${e.mapId}\`)</sub>`);
          break;
        case 'rest': this.line(`_${e.variant === 'long' ? 'Long' : 'Short'} rest._`); break;
        case 'ending': this.line(`### Ending: ${e.outcome}`); break;
        case 'flag': case 'heal': case 'enterShop': break;
      }
    }
  }
}

function playChapter(
  route: Route, module: Module, state: AdventureState, opening: AdventureEvent[],
  counts: Map<string, number>, maxSteps = 6000,
): ChapterResult {
  const carriedIn = { ...state.flags };
  const t = new Transcript(module, () => state);
  const dist = distancesToVictory(module);
  const distOf = (id: string): number => (id === HUB_REF ? CAP : dist.get(id) ?? CAP);
  const isDefeat = (id: string): boolean => {
    const sc = module.scenes[id];
    return sc?.kind === 'ending' && sc.outcome === 'defeat';
  };
  const novelScene = (id: string): boolean => id !== HUB_REF && !state.visited.includes(id);
  const doorVisits = new Map<string, number>();
  const fightOrder: string[] = [];
  let fightsSinceRest = 0;
  let lostSinceRest = 0;
  let campedAt = -1;

  t.events(opening);

  // The option runners close over `state`; `steered` swaps the real state for a
  // copy while trialling, so each runner reads the state it is handed.
  let live = state;
  const S = () => live;
  const steer = (wish: CheckWish, act: (s: AdventureState) => AdventureEvent[]) => {
    const r = steered(state, module, wish, (s) => { live = s; try { return act(s); } finally { live = state; } });
    return r;
  };
  const runOption = (o: Option, prefix: string, suffix: string): void => {
    counts.set(o.key, (counts.get(o.key) ?? 0) + 1);
    t.line(`${prefix}${o.label}${suffix}`);
    if (o.rolls && route.check !== 'natural') {
      const { events, note } = steer(route.check, () => o.run());
      if (note) t.line(`<sub>(${note})</sub>`);
      t.events(events);
    } else {
      t.events(o.run());
    }
  };
  const choose1 = (opts: Option[], prefix: string, suffix = ''): void => {
    const ranked = opts.map((o, i) => ({ o, s: [...route.score(o), i] }));
    ranked.sort((a, b) => {
      for (let k = 0; k < a.s.length; k++) if (a.s[k] !== b.s[k]) return a.s[k]! - b.s[k]!;
      return 0;
    });
    runOption(ranked[0]!.o, prefix, suffix);
  };

  const base = (key: string, target: string): Pick<Option, 'key' | 'times' | 'dist' | 'novel' | 'defeat'> => ({
    key, times: counts.get(key) ?? 0, dist: distOf(target), novel: novelScene(target), defeat: isDefeat(target),
  });

  for (let step = 0; step < maxSteps; step++) {
    const scene = currentScene(state, module);
    switch (scene.kind) {
      case 'ending': {
        // The ending's paragraphs and slides came in on the event stream; they
        // must be exactly what `endingText` says this party sees.
        if (endingText(state, scene).some((p) => !t.seenParagraph(p))) {
          throw new Error(`${route.id}: ending '${scene.id}' text does not match endingText`);
        }
        return { module, state, ending: scene.outcome, lines: t.lines, carriedIn };
      }

      case 'story':
      case 'dialogue': {
        const options = legalChoices(state, module).filter((x) => !x.blocked);
        if (options.length === 0) throw new Error(`${route.id}: dead end at '${scene.id}'`);
        const opts: Option[] = options.map(({ choice }) => {
          const c: Choice = choice;
          return {
            ...base(`${scene.id}:${c.id}`, c.to),
            label: c.label,
            defeat: isDefeat(c.to),
            cruel: cruelty(`${c.label} ${c.id}`), mercy: mercy(`${c.label} ${c.id}`),
            rolls: !!c.check,
            kind: 'choice' as const,
            run: () => choose(S(), module, c.id),
          };
        });
        choose1(opts, '**» ', '**');
        break;
      }

      case 'check': {
        const events = route.check === 'natural'
          ? rollSceneCheck(state, module)
          : steer(route.check, () => rollSceneCheck(S(), module)).events;
        t.events(events);
        break;
      }

      case 'challenge': {
        const options = legalApproaches(state, module).filter((a) => !a.blocked && !a.spent);
        if (options.length === 0) throw new Error(`${route.id}: challenge dead end at '${scene.id}'`);
        const opts: Option[] = options.map(({ approach: a }) => {
          const target = (a.success ?? scene.success).to;
          return {
            ...base(`${scene.id}::${a.id}`, target),
            label: `${a.label}${a.hint ? ` — ${a.hint}` : ''}`,
            defeat: false,
            cruel: cruelty(`${a.label} ${a.id} ${a.hint ?? ''}`), mercy: mercy(`${a.label} ${a.id} ${a.hint ?? ''}`),
            rolls: true, kind: 'approach' as const,
            run: () => tryApproach(S(), module, a.id),
          };
        });
        choose1(opts, '**» ', '**');
        break;
      }

      case 'battle': {
        const opt = battleOptions(state, module);
        const attempts = state.battleAttempts?.[scene.id] ?? 0;
        const visits = (doorVisits.get(scene.id) ?? 0) + 1;
        doorVisits.set(scene.id, visits);
        const lossTo = scene.onLoss?.to ?? module.defeatScene;
        const ctx: BattleCtx = {
          sceneId: scene.id, attempts, doorVisits: visits,
          canFlee: !!opt.fallBack, canParley: !!opt.parley,
          lossEnds: !!lossTo && isDefeat(lossTo),
          authoredLoss: !!scene.onLoss && !isDefeat(scene.onLoss.to),
          ordinal: (fightOrder.includes(scene.id) ? fightOrder : fightOrder.concat(scene.id)).indexOf(scene.id) + 1,
        };
        if (!fightOrder.includes(scene.id)) fightOrder.push(scene.id);
        const decision = route.battle(ctx);
        if (decision === 'parley' && opt.parley) {
          t.line(`**» [${SKILL_LABEL[opt.parley.skill as SkillId] ?? opt.parley.skill} DC ${opt.parley.dc}] ${opt.parley.label}**`);
          const events = route.check === 'natural'
            ? parleyBattle(state, module)
            : steer(route.check, () => parleyBattle(S(), module)).events;
          t.events(events);
          break;
        }
        if (decision === 'flee' && opt.fallBack) {
          t.line(`**» Fall back to ${opt.fallBack.title}**`);
          t.events(fleeBattle(state, module, false));
          break;
        }
        const won = route.win(ctx);
        t.line(`**» Fight — ${won ? 'won' : 'lost'}**`);
        if (won && scene.loot !== false) {
          state.campaign.xp += xpAward(scene.encounterId, Math.max(1, state.campaign.characters.length));
        }
        fightsSinceRest++;
        if (!won) lostSinceRest++;
        t.events(resolveBattle(state, module, won));
        break;
      }

      case 'shop':
      case 'rest':
        if (scene.kind === 'rest') { fightsSinceRest = 0; lostSinceRest = 0; }
        t.events(resolveShopOrRest(state, module));
        break;

      case 'explore':
      case 'dungeon': {
        // Make camp first, if the route wants to and the place allows it.
        if (campRule(state, module) && nightsLeft(state, module) !== 0 && campedAt !== step - 1 && route.camp({ fightsSinceRest, lostSinceRest })) {
          campedAt = step;
          fightsSinceRest = 0; lostSinceRest = 0;
          t.line(`**» Make camp (long rest)** <sub>(day ${dayOf(state)})</sub>`);
          t.events(campRest(state, module, 'long'));
          break;
        }
        if (scene.kind === 'explore') {
          const nodes = exploreNodes(state, module).filter((n) => !n.blocked);
          if (nodes.length === 0) throw new Error(`${route.id}: explore dead end at '${scene.id}'`);
          const opts: Option[] = nodes.map(({ node, explored }) => {
            return {
              ...base(`${scene.id}#${node.id}`, node.scene),
              novel: !explored,
              label: node.label,
              cruel: cruelty(`${node.label} ${node.id}`), mercy: mercy(`${node.label} ${node.id}`),
              rolls: false, kind: 'node' as const,
              run: () => enterNode(S(), module, node.id),
            };
          });
          choose1(opts, '→ ');
          break;
        }
        // A dungeon: every door that opens, every door that can be forced, a
        // search if one is left, and the way out if this room has one.
        const p = dungeonProgress(state, scene.id, scene.dungeon);
        const dDist = distOf(scene.id);
        const opts: Option[] = [];
        for (const x of dungeonExits(state, module)) {
          const name = roomOf(scene.dungeon, x.to)?.name ?? x.to;
          if (!x.blocked) {
            opts.push({
              key: `${scene.id}>${x.to}`, times: counts.get(`${scene.id}>${x.to}`) ?? 0,
              dist: dDist + roomsToGoal(scene, x.to), novel: !p.seen.includes(x.to), defeat: false,
              label: name, cruel: 0, mercy: 0, rolls: false, kind: 'room',
              run: () => walkTo(S(), module, x.to),
            });
          } else if (x.force) {
            opts.push({
              key: `${scene.id}!${x.link}`, times: counts.get(`${scene.id}!${x.link}`) ?? 0,
              dist: dDist + roomsToGoal(scene, p.at) + 0.5, novel: true, defeat: false,
              label: `Force the door to ${name} [${SKILL_LABEL[x.force.skill as SkillId] ?? x.force.skill} DC ${x.force.dc}]`,
              cruel: 1, mercy: -1, rolls: true, kind: 'force',
              run: () => forceDoor(S(), module, x.link),
            });
          }
        }
        if (canSearch(state, module)) {
          const key = `${scene.id}?${p.at}`;
          opts.push({
            key, times: counts.get(key) ?? 0, dist: dDist + roomsToGoal(scene, p.at) + 0.5, novel: true, defeat: false,
            label: 'Search the room', cruel: 0, mercy: 0, rolls: true, kind: 'search',
            run: () => searchRoom(S(), module),
          });
        }
        const exit = dungeonExitHere(state, module);
        if (exit) {
          const key = `${scene.id}^${p.at}`;
          opts.push({
            ...base(key, exit.to), label: exit.label, cruel: 0, mercy: 0, rolls: false, kind: 'leave',
            run: () => leaveDungeon(S(), module),
          });
        }
        if (opts.length === 0) throw new Error(`${route.id}: dungeon dead end at '${scene.id}'`);
        choose1(opts, '→ ');
        break;
      }
    }
  }
  throw new Error(`${route.id}: '${module.id}' did not reach an ending within ${maxSteps} steps`);
}

// --- Whole routes -----------------------------------------------------------

function flagList(flags: Record<string, boolean | number>): string {
  const keys = Object.keys(flags).sort();
  if (keys.length === 0) return '_none_';
  return keys.map((k) => `\`${k}${flags[k] === true ? '' : `=${flags[k]}`}\``).join(', ');
}

export function renderRoute(route: Route): string {
  const modules = route.chapters.map((id) => {
    const m = moduleById(id);
    if (!m) throw new Error(`Unknown module ${id}`);
    return m;
  });
  const campaign: CampaignState = newCampaign(route.seed);
  campaign.partyReady = true;
  const results: ChapterResult[] = [];

  let state = startAdventure(campaign, modules[0]!);
  let opening = enterScene(state, modules[0]!, modules[0]!.start);
  for (let i = 0; i < modules.length; i++) {
    const module = modules[i]!;
    const res = playChapter(route, module, state, opening, new Map());
    results.push(res);
    if (res.ending !== 'victory' || i === modules.length - 1) break;
    const sequel = modules[i + 1]!;
    if (module.sequel !== sequel.id) throw new Error(`${module.id} is not followed by ${sequel.id}`);
    // carryCompanyInto enters the sequel's start itself and keeps the events;
    // mirror it on a copy to read what the player sees on arrival.
    const shadow = structuredClone(campaign);
    fullRest(shadow);
    const probe = startAdventure(shadow, sequel);
    probe.flags = carriedFlags(module, res.state);
    opening = enterScene(probe, sequel, sequel.start);
    state = carryCompanyInto(campaign, sequel, { module, state: res.state });
    if (state.sceneId !== probe.sceneId) throw new Error('carryCompanyInto disagrees with its mirror');
  }

  const last = results[results.length - 1]!;
  const out: string[] = [];
  out.push(`# Route: ${route.id}`, '');
  out.push('> Generated by `npm run transcripts` (scripts/transcripts.ts). Do not edit by hand — regenerate.', '');
  out.push(`**${route.title}.** ${route.summary.join(' ')}`, '');
  out.push(`- **Seed:** \`newCampaign(${route.seed})\``);
  out.push(`- **Party:** ${campaign.characters.map((c) => `${c.name} (${c.speciesId} ${c.classId})`).join(', ')}`);
  out.push(`- **Chapters:** ${results.map((r) => `${r.module.title} → ${r.ending}`).join('; ')}${results.length < modules.length ? ` (stopped: ${modules.slice(results.length).map((m) => m.title).join(', ')} not reached)` : ''}`);
  out.push(`- **Ending reached:** \`${last.state.sceneId}\` (${last.ending}) in ${last.module.title}`);
  for (const r of results) {
    out.push(`- **${r.module.title}** — flags carried in: ${route.cold || r === results[0] ? '_none (start of the run)_' : flagList(r.carriedIn)}; ` +
      `flags carried out: ${r.module.sequel && r.ending === 'victory' ? flagList(carriedFlags(r.module, r.state)) : '_— (no sequel played)_'}`);
  }
  out.push('- **Not simulated:** battles (the route decides won/lost; a win adds encounter XP as `runModule` does, no treasure), shopping, gear, fast travel. Paragraphs already shown earlier in the same chapter are folded to their first words.');
  out.push('');
  for (const r of results) {
    out.push(`## ${r.module.title} \`${r.module.id}\``, '');
    out.push(...r.lines);
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd() + '\n';
}

export function buildTranscripts(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const r of ROUTES) out[`${r.id}.md`] = renderRoute(r);
  return out;
}

export const TRANSCRIPT_DIR = fileURLToPath(new URL('../docs/transcripts/', import.meta.url));

function main(): void {
  const check = process.argv.includes('--check');
  const files = buildTranscripts();
  if (check) {
    const stale = Object.entries(files).filter(([f, body]) => {
      const p = join(TRANSCRIPT_DIR, f);
      return !existsSync(p) || readFileSync(p, 'utf8') !== body;
    }).map(([f]) => f);
    if (stale.length) { console.error(`Stale transcripts: ${stale.join(', ')}`); process.exit(1); }
    console.log('Transcripts up to date.');
    return;
  }
  mkdirSync(TRANSCRIPT_DIR, { recursive: true });
  for (const [f, body] of Object.entries(files)) {
    writeFileSync(join(TRANSCRIPT_DIR, f), body);
    console.log(`${f}  ${(body.length / 1024).toFixed(1)} KB`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
