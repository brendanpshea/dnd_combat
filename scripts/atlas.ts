/**
 * The scene atlas: every version of every scene's text that some reachable
 * state can produce, with when each version shows.
 *
 *   npm run atlas              # write docs/atlas/<chapter>.md
 *   npm run atlas -- --check   # fail if the files on disk are stale
 *
 * WHY
 *
 * The route transcripts (scripts/transcripts.ts) show a few fixed
 * playthroughs. A line that is wrong only on a path none of them takes — one
 * that implies Wren remembers the party, shown to a party that never met her —
 * is invisible there. The atlas reads every scene the other way round: not
 * one route, but every version of the scene any route can reach.
 *
 * HOW
 *
 * 1. Each scene's *atoms*: what its conditions read (a paragraph's `if`, a
 *    choice's or approach's `requires`, a map marker's `requires` and
 *    `sceneWhen`, an ending's slides, `again` on a return visit).
 * 2. The reachability search (`collectReach` in src/adventure/reach.ts), with
 *    those conditions tracked too, hands over every state it reaches, chapter
 *    by chapter, with the carried flags each walk stands for. Each state at a
 *    scene says what its atoms can be there:
 *      - exactly, for a fact of the search, a carried flag, where the party is,
 *        or a tally the ledger bands (`LEDGER_BANDS`: Wren's regard, the
 *        valley's regard), followed value by value across the chapters;
 *      - one at a time, for a flag only text reads (a "shadow": each value is
 *        reachable alone; two such flags are not known to go together);
 *      - either way, for what the search does not track (gold, an item, a
 *        class in the party, a return visit, any other tally). These are
 *        marked `?` in conditions.
 * 3. Each reachable combination is rendered with the runtime's own functions
 *    (`sceneParagraphs`, `legalChoices`, `endingText` …) on a synthetic
 *    state. Identical renderings merge, and their combinations are described
 *    in as few words as hold over the reachable ones.
 *
 * A scene with more versions than `MAX_VARIANTS` is printed once instead,
 * with each conditional line marked with when it shows.
 *
 * A paragraph whose exact text shows in other scenes too (a reused constant)
 * is marked with them, and each chapter starts with an index of them: a line
 * written for one scene can be wrong in another that shares it.
 */
import { writeFileSync, mkdirSync, existsSync, readFileSync, readdirSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import type { Id } from '../src/engine/types.js';
import type { Module, Scene, Requirement, Para, NpcDef } from '../src/adventure/types.js';
import { parasOf } from '../src/adventure/graph.js';
import { collectReach, type ReachRun } from '../src/adventure/reach.js';
import {
  type AdventureState, sceneParagraphs, introParagraphs, paragraphsFor,
  endingText,
} from '../src/adventure/runtime.js';
import type { CampaignState } from '../src/campaign/campaign.js';
import { ENCOUNTERS } from '../src/data/encounters.js';
import { SKILL_LABEL, type SkillId } from '../src/data/classes.js';
import { moduleById } from '../src/data/modules/index.js';
import { LEDGER_BANDS } from '../src/data/modules/ledger.js';

/** The chapters the atlas covers, in order (the search needs each one's predecessor first). */
export const ATLAS_CHAPTERS = ['hollow-road', 'sunken-barrows', 'wyrmcalling'];
export const ATLAS_DIR = fileURLToPath(new URL('../docs/atlas/', import.meta.url));
/** Past this many versions, a scene is printed once with its lines marked. */
const MAX_VARIANTS = 12;
/** Past this many reachable combinations of a scene's atoms, likewise. */
const MAX_COMBOS = 4096;
/** A file larger than this is split. */
const MAX_FILE = 1024 * 1024;

// --- Atoms ----------------------------------------------------------------

/**
 * One thing a scene's conditions read. A value is a small integer: 1/0 for
 * holds/doesn't, or a band index for a tally (or gold) read against numbers.
 */
interface Atom {
  key: string;
  /** Band edges, for a tally: band 0 is below the first edge. */
  edges?: number[];
}
const domainOf = (a: Atom) => (a.edges ? a.edges.length + 1 : 2);

/** The atom a requirement reads, and which of its values satisfy it. */
function atomOf(r: Requirement, tallies: ReadonlySet<string>): { key: string; edge?: number[]; holds: (v: number, a: Atom) => boolean } | null {
  const inBand = (a: Atom, v: number, lo?: number, hi?: number) => {
    const from = v === 0 ? -Infinity : a.edges![v - 1]!;
    const to = v === a.edges!.length ? Infinity : a.edges![v]!;
    return (lo === undefined || from >= lo) && (hi === undefined || to <= hi);
  };
  switch (r.kind) {
    case 'flag':
      if (tallies.has(r.flag)) {
        const n = typeof r.value === 'number' ? r.value : 1;
        return { key: `flag:${r.flag}`, edge: [n], holds: (v, a) => inBand(a, v, n) };
      }
      // A number read off a flag that only ever holds true: 1 or 0.
      if (typeof r.value === 'number') { const n = r.value; return { key: `flag:${r.flag}`, holds: (v) => v >= n }; }
      if (r.value === false) return { key: `flag:${r.flag}`, holds: (v) => v === 0 };
      return { key: `flag:${r.flag}`, holds: (v) => v === 1 };
    case 'notFlag':
      if (tallies.has(r.flag)) return { key: `flag:${r.flag}`, edge: [1], holds: (v, a) => inBand(a, v, undefined, 1) };
      return { key: `flag:${r.flag}`, holds: (v) => v === 0 };
    case 'count':
      if (!tallies.has(r.flag)) return { key: `flag:${r.flag}`, holds: (v) => (r.atLeast === undefined || v >= r.atLeast) && (r.below === undefined || v < r.below) };
      return { key: `flag:${r.flag}`, edge: [r.atLeast, r.below].filter((x): x is number => x !== undefined), holds: (v, a) => inBand(a, v, r.atLeast, r.below) };
    case 'companion': return { key: `companion:${r.companion}`, holds: (v) => v === 1 };
    case 'noCompanion': return { key: `companion:${r.companion}`, holds: (v) => v === 0 };
    case 'visited': return { key: `visited:${r.scene}`, holds: (v) => v === 1 };
    case 'at': return { key: `at:${r.hub}`, holds: (v) => v === 1 };
    case 'gold': return { key: 'gold', edge: [r.atLeast], holds: (v, a) => inBand(a, v, r.atLeast) };
    case 'item': return { key: `item:${r.itemId}`, holds: (v) => v === 1 };
    case 'classInParty': return { key: `class:${r.classId}`, holds: (v) => v === 1 };
    case 'speciesInParty': return { key: `species:${r.speciesId}`, holds: (v) => v === 1 };
    default: return null;
  }
}

/** Every condition that changes what a scene shows, by where. */
function sceneConditions(scene: Scene): Requirement[][] {
  const out: Requirement[][] = [];
  for (const { paras } of parasOf(scene)) for (const p of paras) if (typeof p !== 'string' && p.if?.length) out.push(p.if);
  switch (scene.kind) {
    case 'story': case 'dialogue': for (const c of scene.next) if (c.requires?.length) out.push(c.requires); break;
    case 'challenge': for (const a of scene.approaches) if (a.requires?.length) out.push(a.requires); break;
    case 'explore': for (const n of scene.map.nodes) {
      if (n.requires?.length) out.push(n.requires);
      for (const w of n.sceneWhen ?? []) out.push(w.if);
    } break;
    case 'ending': for (const s of scene.slides ?? []) out.push(s.if); break;
    default: break;
  }
  return out;
}

/** Flags that hold a number (a tally): added to, set to a number, or copied
 *  into, in any chapter — a carried one under its carried name too. A flag
 *  only ever set true is not one, even where a count reads it. */
function talliesOf(chapters: readonly Module[]): Set<string> {
  const out = new Set<string>();
  for (const m of chapters) {
    const walk = (v: unknown): void => {
      if (Array.isArray(v)) { v.forEach(walk); return; }
      if (!v || typeof v !== 'object') return;
      const o = v as Record<string, unknown>;
      const set = (f: string) => { out.add(f); if (m.carries?.includes(f)) out.add(`${m.id}:${f}`); };
      if (typeof o.flag === 'string' && (o.kind === 'addFlag' || (o.kind === 'setFlag' && typeof o.value === 'number'))) set(o.flag);
      if (o.kind === 'copyFlag' && typeof o.to === 'string') set(o.to);
      for (const x of Object.values(o)) walk(x);
    };
    walk(m.scenes); walk(m.dawns);
  }
  return out;
}

/** Everything the atlas asks the search to track: every display condition. A
 *  pure function of the module (the search caches by it). */
function atlasReads(module: Module): Requirement[] {
  const out = Object.values(module.scenes).flatMap((s) => sceneConditions(s).flat());
  for (const d of module.dawns ?? []) for (const p of d.text) if (typeof p !== 'string') out.push(...(p.if ?? []));
  return out;
}

// --- Words ------------------------------------------------------------------

const PART: Record<string, string> = { 'hollow-road': 'Part 1', 'sunken-barrows': 'Part 2', wyrmcalling: 'Part 3' };

function atomWords(a: Atom, npcs: Record<Id, NpcDef>): (v: number) => string {
  const [kind, ...rest] = a.key.split(':');
  const id = rest.join(':');
  const band = (name: string) => (v: number) => {
    const e = a.edges!;
    if (v === 0) return `${name} < ${e[0]}`;
    if (v === e.length) return `${name} ≥ ${e[e.length - 1]}`;
    return e[v - 1] === e[v]! - 1 ? `${name} ${e[v - 1]}` : `${name} ${e[v - 1]}–${e[v]! - 1}`;
  };
  const yesNo = (yes: string, no: string) => (v: number) => (v ? yes : no);
  const name = (npc: string) => npcs[npc]?.name ?? npc;
  if (kind === 'flag') {
    const npc = /^npc\.([^.]+)\.(fate\.(.+)|met|attitude)$/.exec(id);
    if (npc) {
      const who = name(npc[1]!);
      if (npc[2] === 'met') return yesNo(`met ${who}`, `never met ${who}`);
      if (npc[2] === 'attitude') return band(`${who}'s regard`);
      return yesNo(`${who} ${npc[3]}`, `${who} not ${npc[3]}`);
    }
    const carried = /^([^:]+):(.+)$/.exec(id);
    if (carried) {
      const what = `${PART[carried[1]!] ?? carried[1]} ${carried[2]}`;
      return a.edges ? band(what) : yesNo(what, `not ${what}`);
    }
    return a.edges ? band(`\`${id}\``) : yesNo(`\`${id}\``, `not \`${id}\``);
  }
  if (kind === 'companion') return yesNo(`${name(id)} in the party`, `${name(id)} not in the party`);
  if (kind === 'visited') return yesNo(`been to \`${id}\``, `not been to \`${id}\``);
  if (kind === 'at') return yesNo(`at \`${id}\``, `not at \`${id}\``);
  if (kind === 'gold') return band('gold');
  if (kind === 'item') return yesNo(`has ${id}`, `no ${id}`);
  if (kind === 'class') return yesNo(`a ${id} in the party`, `no ${id} in the party`);
  if (kind === 'species') return yesNo(`a ${id} in the party`, `no ${id} in the party`);
  if (kind === 'return') return yesNo('a return visit', 'the first visit');
  return (v) => `${a.key}=${v}`;
}

/** A requirement list in plain words, for a choice's "needs". */
function reqWords(reqs: Requirement[], tallies: ReadonlySet<string>, npcs: Record<Id, NpcDef>): string {
  return reqs.map((r) => {
    const at = atomOf(r, tallies);
    if (!at) return r.kind;
    const a: Atom = { key: at.key, ...(at.edge ? { edges: at.edge } : {}) };
    const words = atomWords(a, npcs);
    const ok = Array.from({ length: domainOf(a) }, (_, v) => v).filter((v) => at.holds(v, a));
    return ok.length === 1 ? words(ok[0]!) : ok.map(words).join(' or ');
  }).join(' · ');
}

// --- What each scene can be -------------------------------------------------

/** How a state knows an atom: exactly (a fact, a carried flag, the hub), one
 *  at a time (a shadow), or not at all. */
type Source = { kind: 'fact'; pow: number } | { kind: 'settled'; flag: string } | { kind: 'hub'; hub: Id }
  | { kind: 'shadow'; bit: number } | { kind: 'tally'; t: number; edges: number[] } | { kind: 'untracked' };

interface SceneInfo {
  id: Id;
  atoms: Atom[];
  holds: Array<Array<{ i: number; ok: (v: number) => boolean }>>;
  /** What reachable states say, one character per atom: the set of values
   *  it can take there, as a bitmask (`48 + mask`). */
  patterns: Set<string>;
  /** The scene was reached at all. */
  reached: boolean;
}

/** The atoms of one set of conditions (a scene, or a chapter's dawns). */
function infoFor(id: Id, conds: Requirement[][], tallies: ReadonlySet<string>, again: boolean): SceneInfo {
  const atoms: Atom[] = [];
  const index = new Map<string, number>();
  const holds: SceneInfo['holds'] = [];
  for (const reqs of conds) {
    for (const r of reqs) {
      const at = atomOf(r, tallies);
      if (!at) continue;
      let i = index.get(at.key);
      if (i === undefined) { i = atoms.length; index.set(at.key, i); atoms.push({ key: at.key }); }
      if (at.edge) atoms[i]!.edges = [...new Set([...(atoms[i]!.edges ?? []), ...at.edge])].sort((x, y) => x - y);
    }
  }
  // A second pass, once every atom's bands are known.
  for (const reqs of conds) {
    holds.push(reqs.flatMap((r) => {
      const at = atomOf(r, tallies);
      if (!at) return [];
      const i = index.get(at.key)!;
      return [{ i, ok: (v: number) => at.holds(v, atoms[i]!) }];
    }));
  }
  if (again) atoms.push({ key: 'return:' });
  return { id, atoms, holds, patterns: new Set(), reached: false };
}

const inheritedFlag = (flag: string) => flag.includes(':') || flag.startsWith('npc.');

function sourceOf(a: Atom, run: ReachRun): Source {
  const [kind, ...rest] = a.key.split(':');
  const id = rest.join(':');
  if (kind === 'at') return { kind: 'hub', hub: id };
  const t = kind === 'flag' ? run.tallies.indexOf(id) : -1;
  if (t >= 0) return { kind: 'tally', t, edges: a.edges ?? [1] };
  if (a.edges || !['flag', 'companion', 'visited'].includes(kind!)) return { kind: 'untracked' };
  const f = run.facts.indexOf(a.key);
  if (f >= 0) return { kind: 'fact', pow: 2 ** f };
  if (kind === 'flag' && inheritedFlag(id) && run.fixed.has(id)) return { kind: 'settled', flag: id };
  const s = run.shadows.indexOf(a.key);
  if (s >= 0) return { kind: 'shadow', bit: 1 << s };
  return { kind: 'untracked' };
}

/** A carried tally (`sunken-barrows:regard`) from a chapter this company
 *  never won (its `won` is not in the arriving mix): it was never handed on,
 *  so it reads 0. */
function notPlayed(a: Atom, full: readonly string[]): boolean {
  const m = /^flag:([^:.]+):/.exec(a.key);
  return !!m && !!moduleById(m[1]!)?.carries?.includes('won') && !full.includes(`${m[1]}:won`);
}
/** The value of an atom that reads 0. */
const bandOfZero = (a: Atom) => (a.edges ? a.edges.filter((e) => e <= 0).length : 0);

/** Fold one walk's states into each scene's reachable combinations. */
function absorb(run: ReachRun, infos: Map<Id, SceneInfo>, dawn: SceneInfo | null, sleeps: ReadonlySet<Id>): void {
  const bySceneIndex = run.ids.map((id) => infos.get(id)!);
  const sources = bySceneIndex.map((info) => info.atoms.map((a) => sourceOf(a, run)));
  const dawnSources = dawn ? dawn.atoms.map((a) => sourceOf(a, run)) : [];
  const fulls = run.fulls.length ? run.fulls : [[...run.handed]];
  const W = run.tallyWords;
  // What each state says, before carried flags: '0', '1', 'b' (both, a
  // shadow), '*' (untracked), 's' (settled: per arriving mix), 't' (a
  // tracked tally: filled in below with its band, as 'A' + band).
  const say = (src: Source[], n: number): string => {
    let k = '';
    for (const s of src) {
      if (s.kind === 'fact') k += Math.floor(run.factsOf[n]! / s.pow) % 2 ? '1' : '0';
      else if (s.kind === 'hub') k += run.hubOf[n]! >= 0 && run.hubs[run.hubOf[n]!] === s.hub ? '1' : '0';
      else if (s.kind === 'shadow') {
        const on = run.mayOn[n]! & s.bit, off = run.mayOff[n]! & s.bit;
        k += on && off ? 'b' : on ? '1' : '0';
      } else k += s.kind === 'settled' ? 's' : s.kind === 'tally' ? 't' : '*';
    }
    return k;
  };
  // Each place's keys interned (one per scene, and the dawn as the last),
  // and, per combo of tally values, the bands its tally atoms read (base 4).
  const places = [...sources, dawnSources];
  const D = sources.length;
  const interned = places.map(() => new Map<string, number>());
  const keyStrs: string[][] = places.map(() => []);
  const intern = (p: number, k: string) => {
    let id = interned[p]!.get(k);
    if (id === undefined) { id = keyStrs[p]!.length; interned[p]!.set(k, id); keyStrs[p]!.push(k); }
    return id;
  };
  const tallyAtoms = places.map((src) => src.filter((x): x is Extract<Source, { kind: 'tally' }> => x.kind === 'tally'));
  const bandsOf = tallyAtoms.map((ts) => Array.from({ length: W * 32 }, (_, c) => {
    const v = run.comboValues(c);
    return ts.reduce((acc, t, j) => acc + t.edges.filter((e) => v[t.t]! >= e).length * 4 ** j, 0);
  }));
  const M = 4096;
  const stateKey = new Int32Array(run.sceneOf.length);
  const dawnKey = new Int32Array(run.sceneOf.length).fill(-1);
  for (let n = 0; n < run.sceneOf.length; n++) {
    const s = run.sceneOf[n]!;
    stateKey[n] = intern(s, say(sources[s]!, n));
    if (dawn && sleeps.has(run.ids[s]!)) dawnKey[n] = intern(D, say(dawnSources, n));
  }
  const fill = (p: number, code: number): string => {
    const [id, bands] = [Math.floor(code / M), code % M];
    let j = 0;
    return keyStrs[p]![id]!.replace(/t/g, () => String.fromCharCode(65 + (Math.floor(bands / 4 ** j++) % 4)));
  };
  const expand = (info: SceneInfo, src: Source[], ks: Iterable<string>, mixes: readonly string[][]) => {
    for (const k of ks) {
      info.reached = true;
      for (const full of mixes) {
        let p = '';
        info.atoms.forEach((a, i) => {
          const c = k[i]!;
          const mask = c === '0' ? 1 : c === '1' ? 2 : c === 'b' ? 3
            : c >= 'A' && c <= 'Z' ? 1 << (c.charCodeAt(0) - 65)
              : c === 's' ? (full.includes((src[i] as { flag: string }).flag) ? 2 : 1)
                : notPlayed(a, full) ? 1 << bandOfZero(a) : 2 ** domainOf(a) - 1;
          p += String.fromCharCode(48 + mask);
        });
        info.patterns.add(p);
      }
    }
  };
  // Seed by seed: the arriving mixes that start the tallies alike, and what
  // the states a party from them reaches say, with each combination of tally
  // values the state can hold there (so tallies go together exactly).
  for (let seed = 0; seed < run.seeds; seed++) {
    const mixes = fulls.filter((_, j) => (run.seedOfFull[j] ?? 0) === seed);
    if (!mixes.length) continue;
    const sets = run.tallySets(seed);
    const codes = places.map(() => new Set<number>());
    for (let n = 0; n < run.sceneOf.length; n++) {
      const s = run.sceneOf[n]!;
      for (let w = 0; w < W; w++) {
        let bits = sets[n * W + w]!;
        while (bits) {
          const low = bits & -bits; bits ^= low;
          const c = w * 32 + 31 - Math.clz32(low);
          codes[s]!.add(stateKey[n]! * M + bandsOf[s]![c]!);
          if (dawnKey[n]! >= 0) codes[D]!.add(dawnKey[n]! * M + bandsOf[D]![c]!);
        }
      }
    }
    bySceneIndex.forEach((info, s) => expand(info, sources[s]!, [...codes[s]!].map((c) => fill(s, c)), mixes));
    if (dawn) expand(dawn, dawnSources, [...codes[D]!].map((c) => fill(D, c)), mixes);
  }
}

// --- Rendering ----------------------------------------------------------------

/**
 * The reachable combinations of some of a scene's atoms (`idxs`; the others
 * are -1 in each), or null when there are more than `MAX_COMBOS`.
 */
function combosOver(info: SceneInfo, idxs: number[]): number[][] | null {
  const seen = new Set<string>();
  for (const p of info.patterns) {
    const choices = idxs.map((i) => {
      const mask = p.charCodeAt(i) - 48;
      return Array.from({ length: domainOf(info.atoms[i]!) }, (_, v) => v).filter((v) => mask & (1 << v));
    });
    if (seen.size + choices.reduce((n, c) => n * c.length, 1) > MAX_COMBOS * 4) return null;
    const rec = (j: number, acc: string) => {
      if (j === choices.length) { seen.add(acc); return; }
      for (const v of choices[j]!) rec(j + 1, acc + String.fromCharCode(48 + v));
    };
    rec(0, '');
    if (seen.size > MAX_COMBOS) return null;
  }
  return [...seen].sort().map((k) => {
    const out = info.atoms.map(() => -1);
    idxs.forEach((i, j) => { out[i] = k.charCodeAt(j) - 48; });
    return out;
  });
}

/** A state that holds exactly these atom values, for the runtime to read. */
function stateFor(module: Module, sceneId: Id, atoms: Atom[], values: number[]): AdventureState {
  const flags: Record<string, boolean | number> = {};
  const companions: Array<{ id: Id }> = [];
  const visited: Id[] = [];
  const characters: Array<{ classId: string; speciesId: string; inventory: Array<{ itemId: string; qty: number }> }> = [];
  const stash: Array<{ itemId: string; qty: number }> = [];
  let gold = 0, hub: Id | undefined, returning = false;
  atoms.forEach((a, i) => {
    const v = values[i]!;
    const [kind, ...rest] = a.key.split(':');
    const id = rest.join(':');
    const rep = a.edges ? (v === 0 ? a.edges[0]! - 1 : a.edges[v - 1]!) : v;
    if (kind === 'flag') { if (a.edges) flags[id] = rep; else if (v) flags[id] = true; }
    else if (kind === 'gold') gold = Math.max(0, rep);
    else if (!v) return;
    else if (kind === 'companion') companions.push({ id });
    else if (kind === 'visited') visited.push(id);
    else if (kind === 'at') hub = id;
    else if (kind === 'item') stash.push({ itemId: id, qty: 1 });
    else if (kind === 'class') characters.push({ classId: id, speciesId: '', inventory: [] });
    else if (kind === 'species') characters.push({ classId: '', speciesId: id, inventory: [] });
    else if (kind === 'return') returning = true;
  });
  const campaign = { gold, characters, stash } as unknown as CampaignState;
  return {
    campaign, moduleId: module.id, sceneId, flags, visited, companions, returning,
    ...(hub ? { hub } : {}),
    exploredNodes: [], wanderingRolled: [], journal: [], guidanceSpent: [], consumedChoices: [], spentApproaches: [], shopVisits: {},
  };
}

// --- Shared text --------------------------------------------------------------

/** Past this many other scenes, a shared paragraph's note points to the index
 *  instead of naming them. */
const MAX_NAMED_SHARERS = 3;

/**
 * Paragraphs whose exact text shows in more than one scene of a chapter (a
 * constant reused: one "den flown" for three dens). A writer reads the scene
 * they edit; the note says which others read the same words.
 */
interface SharedText {
  /** By trimmed text: its number in the index, and the scenes that use it. */
  byText: Map<string, { n: number; scenes: Id[] }>;
}
function sharedTextOf(module: Module): SharedText {
  const users = new Map<string, Id[]>();
  for (const [id, scene] of Object.entries(module.scenes)) {
    const texts = parasOf(scene).flatMap(({ paras }) => paras.map((p) => (typeof p === 'string' ? p : p.text)));
    if (scene.kind === 'ending') texts.push(...(scene.slides ?? []).map((sl) => sl.text));
    for (const t of new Set(texts.map((x) => x.trim()).filter(Boolean))) users.set(t, [...(users.get(t) ?? []), id]);
  }
  const byText = new Map<string, { n: number; scenes: Id[] }>();
  for (const [t, scenes] of users) if (scenes.length > 1) byText.set(t, { n: byText.size + 1, scenes });
  return { byText };
}
/** The note under a paragraph in scene `id`, or '' when no other scene shows it. */
function sharedNote(shared: SharedText, id: Id, text: string): string {
  const s = shared.byText.get(text.trim());
  if (!s) return '';
  const others = s.scenes.filter((x) => x !== id);
  return others.length > MAX_NAMED_SHARERS
    ? `<sub>(shared ×${s.scenes.length}, see index S${s.n})</sub>`
    : `<sub>(shared with: ${others.map((x) => `\`${x}\``).join(', ')})</sub>`;
}
function sharedIndex(shared: SharedText): string[] {
  if (!shared.byText.size) return [];
  const entries = [...shared.byText.entries()].map(([t, s]) => ({ t, ...s, w: t.replace(/[*_`]/g, '').split(/\s+/) }));
  // Enough first words to tell each from the others.
  const opening = (e: (typeof entries)[number]) => {
    let n = Math.min(10, e.w.length);
    while (n < e.w.length && entries.some((o) => o !== e && o.w.slice(0, n).join(' ') === e.w.slice(0, n).join(' '))) n++;
    return n < e.w.length ? `${e.w.slice(0, n).join(' ')} …` : e.w.join(' ');
  };
  // Grouped by the scenes that share them.
  const groups = new Map<string, typeof entries>();
  for (const e of entries) { const k = e.scenes.join(' '); groups.set(k, [...(groups.get(k) ?? []), e]); }
  return [
    '## Shared paragraphs', '',
    'Paragraphs whose exact text shows in more than one scene (a reused constant), grouped by the scenes that share them. Each is marked where it shows. **Change one, and read it in every scene listed**: a line written for one of them may be wrong in another.', '',
    ...[...groups.values()].flatMap((g) => [
      `- ${g[0]!.scenes.map((x) => `\`${x}\``).join(', ')}:`,
      ...g.map((e) => `  - **S${e.n}** “${opening(e)}”`),
    ]),
    '',
  ];
}

const skill = (s: SkillId, dc: number) => `[${SKILL_LABEL[s] ?? s} DC ${dc}]`;
const quote = (paras: string[]) => paras.map((p) => p.trim()).filter(Boolean);

/** The prose a player reads at a scene in one state, in order. What they can
 *  do there (choices, approaches, map markers) is listed once, apart: see
 *  `optionLines`. */
function renderScene(scene: Scene, st: AdventureState, note: (text: string) => string): string[] {
  const out: string[] = [];
  const para = (ps: string[]) => { for (const p of quote(ps)) { out.push(p, ''); const n = note(p); if (n) out.push(n, ''); } };
  const section = (title: string, ps: Para[] | undefined) => {
    const shown = ps ? quote(paragraphsFor(st, ps)) : [];
    if (!shown.length) return;
    out.push(`*${title}:*`, '');
    para(shown);
  };
  switch (scene.kind) {
    case 'story': case 'dialogue':
      if (scene.kind === 'dialogue') out.push(`**${scene.npc.name}:**`, '');
      para(sceneParagraphs(st, scene));
      break;
    case 'check':
      para(introParagraphs(st, scene));
      out.push(`**Check:** ${skill(scene.skill, scene.dc)}`, '');
      section('Pass', scene.success.text);
      section('Fail', scene.failure.text);
      break;
    case 'challenge':
      para(introParagraphs(st, scene));
      section('Got past', scene.success.text);
      section('Failed', scene.failure.text);
      for (const a of scene.approaches) {
        section(`${a.label}, passed`, a.success?.text);
        section(`${a.label}, failed`, a.failure?.text);
      }
      break;
    case 'battle':
      para(introParagraphs(st, scene));
      out.push(`**Battle:** ${ENCOUNTERS[scene.encounterId]?.name ?? scene.encounterId}${scene.parley ? ` · parley: ${scene.parley.label ?? 'Parley'}${scene.parley.skill ? ` ${skill(scene.parley.skill, scene.parley.dc)}` : ''}` : ''}`, '');
      section('Won', scene.onWin.text);
      section('Lost', scene.onLoss?.text);
      if (scene.parley) {
        section('Talked down', scene.parley.success.text);
        section('Talk failed', scene.parley.failure?.text);
        section('Talk refused', scene.parley.refused);
      }
      break;
    case 'explore':
      out.push(`**Map:** ${scene.map.title}`, '');
      break;
    case 'dungeon':
      out.push(`**Dungeon:** ${scene.dungeon.title}`, '');
      for (const r of scene.dungeon.rooms) section(`${r.name}, first visit`, r.firstVisit);
      break;
    case 'shop': case 'rest':
      para(scene.intro ? paragraphsFor(st, scene.intro) : []);
      break;
    case 'ending':
      out.push(`**Ending: ${scene.outcome}**`, '');
      para(endingText(st, scene));
      break;
  }
  return out;
}

/**
 * What a party can do at a scene — its choices, a challenge's approaches, a
 * map's markers — each once, with when it is open (from the reachable
 * combinations, as for a version), and what a player sees when it is not:
 * greyed with the runtime's reason, or hidden.
 */
function optionLines(scene: Scene, when: (reqs: Requirement[], prior?: Requirement[][]) => string): string[] {
  const out: string[] = [];
  const gate = (reqs: Requirement[] | undefined, hide: boolean | undefined) => {
    if (!reqs?.length) return '';
    const w = when(reqs);
    if (w === 'always') return ' <sub>open on every route here</sub>';
    if (w === 'never') return ` <sub>**never open on any reachable route** (${hide ? 'hidden' : 'greyed'})</sub>`;
    return ` <sub>open when ${w}; otherwise ${hide ? 'hidden' : 'greyed'}</sub>`;
  };
  if (scene.kind === 'story' || scene.kind === 'dialogue') {
    for (const c of scene.next) {
      out.push(`- » **${c.label}**${c.check ? ` ${skill(c.check.skill, c.check.dc)}` : ''}${c.hint ? ` — _${c.hint}_` : ''}${c.once ? ' <sub>(once)</sub>' : ''}${gate(c.requires, c.hideWhenBlocked)}`);
    }
  }
  if (scene.kind === 'challenge') {
    for (const a of scene.approaches) out.push(`- » **${a.label}** ${skill(a.skill, a.dc)}${a.hint ? ` — _${a.hint}_` : ''}${gate(a.requires, a.hideWhenBlocked)}`);
  }
  if (scene.kind === 'explore') {
    for (const n of scene.map.nodes) {
      out.push(`- **${n.label}**${n.mystery ? ` <sub>(“${n.mystery}” until entered)</sub>` : ''} → \`${n.scene}\`${n.hidden ? ' <sub>(secret)</sub>' : ''}${gate(n.requires, false)}${n.requires?.length && n.note ? ` <sub>— “${n.note}”</sub>` : ''}`);
      const earlier: Requirement[][] = [];
      for (const w of n.sceneWhen ?? []) {
        // The first redirect that holds wins: this one, and none before it.
        const wd = when(w.if, [...earlier]);
        out.push(`  - goes to \`${w.to}\` instead ${wd === 'never' ? '**on no reachable route**' : wd === 'always' ? 'on every route here' : `when ${wd}`}`);
        earlier.push(w.if);
      }
    }
  }
  return out.length ? [...out, ''] : out;
}

// --- Saying when ------------------------------------------------------------

/**
 * When a version shows, in as few words as hold over the reachable states.
 * `group` holds the combinations that give this version, `all` every
 * reachable one. Each term starts as one combination and widens, atom by
 * atom, while every reachable combination it then covers is in the group.
 */
function describe(group: number[][], all: number[][], atoms: Atom[], words: Array<(v: number) => string>, unsure: boolean[]): string[] {
  const inGroup = new Set(group.map((g) => g.join(',')));
  const matches = (term: Array<Set<number> | null>, s: number[]) => term.every((t, i) => !t || t.has(s[i]!));
  const valid = (term: Array<Set<number> | null>) => all.every((s) => !matches(term, s) || inGroup.has(s.join(',')));
  const covered = new Set<string>();
  const terms: Array<Array<Set<number> | null>> = [];
  for (const g of group) {
    if (covered.has(g.join(','))) continue;
    const term: Array<Set<number> | null> = g.map((v) => (v < 0 ? null : new Set([v])));
    for (let i = 0; i < atoms.length; i++) {
      const was = term[i];
      if (!was) continue;
      term[i] = null;
      if (valid(term)) continue;
      term[i] = was;
      // A tally: widen band by band.
      for (let v = 0; v < domainOf(atoms[i]!); v++) {
        if (was.has(v)) continue;
        was.add(v);
        if (!valid(term)) was.delete(v);
      }
      if (was.size === domainOf(atoms[i]!)) term[i] = null;
    }
    terms.push(term);
    for (const s of all) if (matches(term, s)) covered.add(s.join(','));
  }
  return terms.map((term) => {
    const parts = term.flatMap((t, i) => {
      if (!t) return [];
      const vs = [...t].sort((x, y) => x - y);
      const w = vs.map(words[i]!).join(' or ');
      return [unsure[i] ? `${w}?` : w];
    });
    return parts.length ? parts.join(' · ') : 'always';
  });
}

// --- A chapter ----------------------------------------------------------------

interface ChapterAtlas {
  scenes: Array<{ id: Id; text: string }>;
  shared: SharedText;
  dawns: string;
  neverShown: string[];
  variants: number;
  timeMs: number;
  states: number;
}

function buildChapter(module: Module): ChapterAtlas {
  const t0 = Date.now();
  const npcs = module.npcs ?? {};
  const shared = sharedTextOf(module);
  const tallies = talliesOf(ATLAS_CHAPTERS.map((c) => moduleById(c)!));
  const infos = new Map<Id, SceneInfo>();
  for (const [id, scene] of Object.entries(module.scenes)) {
    infos.set(id, infoFor(id, sceneConditions(scene), tallies, 'again' in scene && !!scene.again?.length));
  }
  const dawnConds = (module.dawns ?? []).flatMap((d) => d.text.flatMap((p) => (typeof p !== 'string' && p.if?.length ? [p.if] : [])));
  const dawn = module.dawns?.length ? infoFor('@dawn', dawnConds, tallies, false) : null;
  const sleeps = new Set(Object.values(module.scenes).filter((s) =>
    (s.kind === 'explore' && s.map.camp) || (s.kind === 'dungeon' && s.dungeon.camp) || (s.kind === 'rest' && s.variant === 'long')).map((s) => s.id));
  // Which atoms the search cannot pin (marked `?`), by scene.
  const unsure = new Map<Id, boolean[]>();
  const report = collectReach(module, atlasReads, (run) => {
    for (const info of [...infos.values(), ...(dawn ? [dawn] : [])]) {
      const u = unsure.get(info.id) ?? info.atoms.map(() => false);
      info.atoms.forEach((a, i) => { if (sourceOf(a, run).kind === 'untracked') u[i] = true; });
      unsure.set(info.id, u);
    }
    absorb(run, infos, dawn, sleeps);
  }, undefined, LEDGER_BANDS);
  if (report.skipped) throw new Error(`${module.id}: the search did not run (${report.skipped})`);

  const neverShown: string[] = [];
  let variants = 0;
  const needs = (reqs: Requirement[]) => reqWords(reqs, tallies, npcs);
  const scenes = Object.entries(module.scenes).map(([id, scene]) => {
    const info = infos.get(id)!;
    const head = `## \`${id}\` · ${scene.kind}${scene.kind === 'dialogue' ? ` · ${scene.npc.name}` : ''}`;
    if (!info.reached) return { id, text: `${head}\n\n_No reachable state comes here._\n` };
    const words = info.atoms.map((a) => atomWords(a, npcs));
    const u = unsure.get(id) ?? info.atoms.map(() => false);
    const full = combosOver(info, info.atoms.map((_, i) => i));
    const overflow = !full;
    const all = full ?? [];
    const lines: string[] = [head, ''];
    const conds = sceneConditions(scene);
    const note = (t: string) => sharedNote(shared, id, t);
    // The reachable combinations of what some conditions read: all of them,
    // or (a scene with too many) just those conditions' atoms.
    const over = (list: Requirement[][]) => full ?? combosOver(info,
      [...new Set(list.flatMap((r) => { const ci = conds.indexOf(r); return ci < 0 ? [] : info.holds[ci]!.map((h) => h.i); }))].sort((x, y) => x - y));
    const ok = (reqs: Requirement[], s: number[]) => {
      const ci = conds.indexOf(reqs);
      return ci < 0 || info.holds[ci]!.every(({ i, ok: f }) => f(s[i]!));
    };
    // Lines no reachable state shows (only where every atom is pinned).
    const dead = conds.filter((c, ci) => {
      if (info.holds[ci]!.some(({ i }) => u[i])) return false;
      const scope = over([c]);
      return !!scope && !scope.some((s) => ok(c, s));
    });
    // Group the combinations by what they render to.
    const byText = new Map<string, number[][]>();
    for (const s of all) {
      const body = renderScene(scene, stateFor(module, id, info.atoms, s), note).join('\n').trim();
      byText.set(body, [...(byText.get(body) ?? []), s]);
    }
    /** When `reqs` hold here (and, for a map's redirect, none of `prior` do). */
    const when = (reqs: Requirement[], prior: Requirement[][] = []): string => {
      const scope = conds.includes(reqs) ? over([reqs, ...prior])?.filter((s) => prior.every((r) => !ok(r, s))) : null;
      if (!scope) return needs(reqs);
      const group = scope.filter((s) => ok(reqs, s));
      if (!group.length) return 'never';
      if (group.length === scope.length && !prior.length) return 'always';
      return describe(group, scope, info.atoms, words, u).join(' — or — ');
    };
    if (info.atoms.length) {
      lines.push(`<sub>reads: ${info.atoms.map((a, i) => `${a.key.replace(/:$/, '')}${u[i] ? '?' : ''}`).join(', ')}</sub>`, '');
    }
    if (overflow || byText.size > MAX_VARIANTS) {
      // Too many versions to print: print the scene once, each conditional line marked.
      lines.push(`**${overflow ? 'Too many combinations' : `${byText.size} versions`}** — printed once, each conditional line marked with when it shows.`, '');
      lines.push(...lineByLine(scene, when, note));
      variants += 1;
    } else {
      const groups = [...byText.entries()];
      variants += groups.length;
      if (groups.length > 1) lines.push(`**${groups.length} versions**`, '');
      groups.forEach(([body, group], k) => {
        if (groups.length > 1) lines.push(`### ${k + 1}. when ${describe(group, all, info.atoms, words, u).join(' — or — ')}`, '');
        lines.push(body, '');
      });
    }
    lines.push(...optionLines(scene, when));
    // A choice hidden when blocked that never opens is often deliberate (one
    // list of ways on, shared by several scenes): marked where it is listed,
    // not gathered with the dead lines.
    const hidden = new Set<Requirement[]>([
      ...(scene.kind === 'story' || scene.kind === 'dialogue' ? scene.next : scene.kind === 'challenge' ? scene.approaches : [])
        .flatMap((c) => (c.hideWhenBlocked && c.requires ? [c.requires] : [])),
    ]);
    const shownDead = dead.filter((c) => !hidden.has(c));
    if (shownDead.length) {
      lines.push('**Never shown on any reachable route:**', '');
      for (const c of shownDead) {
        const what = lineFor(scene, c);
        lines.push(`- when ${needs(c)}: ${what}`);
        neverShown.push(`\`${id}\` — when ${needs(c)}: ${what}`);
      }
      lines.push('');
    }
    return { id, text: lines.join('\n') };
  });

  // The chapter's dawns, against the states a party can sleep in.
  let dawns = '';
  if (dawn && module.dawns?.length) {
    const words = dawn.atoms.map((a) => atomWords(a, npcs));
    const u = unsure.get('@dawn') ?? dawn.atoms.map(() => false);
    const all = combosOver(dawn, dawn.atoms.map((_, i) => i)) ?? [];
    const out: string[] = ['## Dawns', ''];
    for (const d of module.dawns) {
      const byText = new Map<string, number[][]>();
      for (const s of all.length ? all : [dawn.atoms.map(() => 0)]) {
        const body = quote(paragraphsFor(stateFor(module, '@dawn', dawn.atoms, s), d.text)).join('\n\n');
        byText.set(body, [...(byText.get(body) ?? []), s]);
      }
      out.push(`### Day ${d.day}`, '');
      const groups = [...byText.entries()];
      for (const [body, group] of groups) {
        if (groups.length > 1) out.push(`#### when ${describe(group, all, dawn.atoms, words, u).join(' — or — ')}`, '');
        out.push(body, '');
      }
    }
    dawns = out.join('\n');
  }
  return { scenes, shared, dawns, neverShown, variants, timeMs: Date.now() - t0, states: report.states };
}

/** The words of whatever a condition list guards in a scene. */
function lineFor(scene: Scene, reqs: Requirement[]): string {
  for (const { paras } of parasOf(scene)) for (const p of paras) if (typeof p !== 'string' && p.if === reqs) return `"${clip(p.text)}"`;
  if (scene.kind === 'story' || scene.kind === 'dialogue') { const c = scene.next.find((x) => x.requires === reqs); if (c) return `the choice "${c.label}"`; }
  if (scene.kind === 'challenge') { const a = scene.approaches.find((x) => x.requires === reqs); if (a) return `the approach "${a.label}"`; }
  if (scene.kind === 'explore') for (const n of scene.map.nodes) {
    if (n.requires === reqs) return `the marker "${n.label}"`;
    const w = n.sceneWhen?.find((x) => x.if === reqs);
    if (w) return `the marker "${n.label}" going to \`${w.to}\``;
  }
  if (scene.kind === 'ending') { const s = scene.slides?.find((x) => x.if === reqs); if (s) return `the slide "${clip(s.text)}"`; }
  return '(a condition)';
}
const clip = (t: string, n = 140) => (t.length > n ? `${t.slice(0, n).trimEnd()}…` : t);

/** A scene's prose printed once, each conditional line marked with when it shows. */
function lineByLine(scene: Scene, whenRaw: (reqs: Requirement[]) => string, note: (text: string) => string): string[] {
  const out: string[] = [];
  const when = (reqs: Requirement[]) => {
    const w = whenRaw(reqs);
    return w === 'always' ? 'on every route here' : w === 'never' ? 'on no reachable route' : w;
  };
  const para = (title: string, ps: readonly Para[] | undefined) => {
    if (!ps?.length) return;
    out.push(`*${title}:*`, '');
    for (const p of ps) {
      out.push(typeof p === 'string' ? p : !p.if?.length ? p.text : `> **[${when(p.if).startsWith('on ') ? '' : 'when '}${when(p.if)}]** ${p.text}`, '');
      const n = note(typeof p === 'string' ? p : p.text);
      if (n) out.push(n, '');
    }
  };
  for (const { where, paras } of parasOf(scene)) para(where, paras);
  if (scene.kind === 'ending') {
    out.push('*slides:*', '');
    for (const s of scene.slides ?? []) {
      out.push(s.if.length ? `> **[${when(s.if).startsWith('on ') ? '' : 'when '}${when(s.if)}]** ${s.text}` : s.text, '');
      const n = note(s.text);
      if (n) out.push(n, '');
    }
  }
  return out;
}

// --- Files ----------------------------------------------------------------------

function header(module: Module, a: ChapterAtlas, part?: { n: number; of: number }): string[] {
  return [
    `# Scene atlas: ${module.title} \`${module.id}\`${part ? ` (${part.n} of ${part.of})` : ''}`,
    '',
    '> Generated by `npm run atlas` (scripts/atlas.ts). Do not edit by hand — regenerate.',
    '',
    'Every version of every scene that some reachable state can produce — every route, carried choices from earlier chapters included — with when each version shows. Read every version of a scene you change; see "Reading the atlas" in docs/module-writing-guide.md.',
    '',
    '- **when …** names what the version needs, in as few words as hold over the reachable states (the rest can go either way). "— or —" joins alternatives.',
    '- A condition ending in **?** is one the search does not track (gold, an item, a class in the party, a return visit, a tally the ledger does not band): both ways are shown, though not every party can bring both. Wren\'s regard and the valley\'s regard are tracked exactly.',
    '- A flag only text reads is checked one at a time: each value shown is reachable, but two such flags together may not be.',
    '- `reads:` lists what the scene\'s conditions read. Choices show as a player sees them in that version: offered, ~~greyed~~ with the reason, or absent (hidden).',
    '- <sub>(shared with: …)</sub> under a paragraph: the same words show in those scenes too (many: see the index of shared paragraphs). Change it, and read it in every one.',
    '',
    `${a.scenes.length} scenes · ${a.variants} versions · ${a.states.toLocaleString('en-US')} states searched (with text conditions tracked).`,
    '',
    ...(!part || part.n === 1 ? sharedIndex(a.shared) : []),
  ];
}

export function buildAtlas(): Record<string, string> {
  const files: Record<string, string> = {};
  for (const id of ATLAS_CHAPTERS) {
    const module = moduleById(id);
    if (!module) throw new Error(`no module ${id}`);
    const a = buildChapter(module);
    const tail: string[] = [];
    if (a.neverShown.length) tail.push('## Never shown', '', 'Conditional lines whose condition no reachable state meets (every atom pinned): dead text, or a condition that is wrong.', '', ...a.neverShown.map((l) => `- ${l}`), '');
    if (a.dawns) tail.push(a.dawns);
    // Split into parts under MAX_FILE.
    const chunks: string[][] = [[]];
    let size = 0;
    for (const s of a.scenes) {
      if (size + s.text.length > MAX_FILE * 0.95 && chunks[chunks.length - 1]!.length) { chunks.push([]); size = 0; }
      chunks[chunks.length - 1]!.push(s.text);
      size += s.text.length;
    }
    chunks.forEach((chunk, i) => {
      const name = chunks.length === 1 ? `${id}.md` : `${id}-${i + 1}.md`;
      const part = chunks.length === 1 ? undefined : { n: i + 1, of: chunks.length };
      const body = [...header(module, a, part), ...chunk, ...(i === chunks.length - 1 ? tail : [])].join('\n');
      files[name] = body.replace(/\n{3,}/g, '\n\n').trimEnd() + '\n';
    });
  }
  return files;
}

function main(): void {
  const check = process.argv.includes('--check');
  const t = Date.now();
  const files = buildAtlas();
  if (check) {
    const stale = Object.entries(files).filter(([f, body]) => {
      const p = join(ATLAS_DIR, f);
      return !existsSync(p) || readFileSync(p, 'utf8') !== body;
    }).map(([f]) => f);
    if (stale.length) { console.error(`Stale atlas: ${stale.join(', ')}`); process.exit(1); }
    console.log('Atlas up to date.');
    return;
  }
  mkdirSync(ATLAS_DIR, { recursive: true });
  for (const f of readdirSync(ATLAS_DIR)) if (f.endsWith('.md') && !(f in files)) unlinkSync(join(ATLAS_DIR, f));
  for (const [f, body] of Object.entries(files)) {
    writeFileSync(join(ATLAS_DIR, f), body);
    console.log(`${f}  ${(body.length / 1024).toFixed(1)} KB`);
  }
  console.log(`${((Date.now() - t) / 1000).toFixed(1)} s`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
