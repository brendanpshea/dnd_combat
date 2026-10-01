/**
 * Every state a party can get a module into, and whether it can still win.
 *
 * The validator's own reachability walk treats every route as open: a choice
 * that needs a flag counts as taken whether or not the flag can be set by
 * then. That misses the bug that matters most to a player — a state that can
 * be reached but can never reach the ending. One shipped: the Hollow Road's
 * victory scene offered "Back to the Ashfang Den", and with the chief dead the
 * den had nothing left that led to the ending.
 *
 * This search is exhaustive over an abstraction of the run:
 *
 *   state = (scene, the location `@hub` returns to, a set of facts)
 *
 * where the facts are only those something can ask about: every flag a
 * requirement reads, every companion a requirement names, every scene a
 * `visited` requirement names, and the locations visited (fast travel goes
 * only to those). The state packs into one number, so the search is a plain
 * breadth-first walk over integers.
 *
 * Every roll goes both ways — a check passes and fails, a fight is won and
 * lost — because a party can get either. Things the abstraction cannot see
 * (gold, items, classes; a `once` choice already spent; a dungeon's doors,
 * which `checkDungeon` proves separately) are taken as possible. So the search
 * can find a few states a real party could not reach, but it never misses one
 * it could.
 *
 * Choices carried in from earlier chapters are not facts: the walk runs once
 * per mix the chapter before can hand on (see `searchChapter`).
 *
 * From the states it reports:
 *   - scenes no state reaches (gated shut, though something routes to them);
 *   - states that cannot reach a victory ending, with the shortest way there.
 */
import type { Id } from '../engine/types.js';
import { HUB_REF, type Module, type Requirement, type Effect, type Scene } from './types.js';
import { requirementsOf, effectsOf } from './graph.js';
import { MODULES } from '../data/modules/index.js';

/** The most facts a state can carry: they share a 32-bit word. */
const MAX_FACTS = 31;
/** A search bigger than this is reported, not run. */
const MAX_STATES = 3_000_000;

interface Mask { has: number; not: number }
interface Step { to: Id; req: Mask; set: number; clr: number; label: string }

export interface ReachReport {
  errors: string[];
  states: number;
  /** Why the search did not run, when it did not. */
  skipped?: string;
  /** Every mix of carried flags (`module:flag`) a victory here can hand the
   *  sequel: those this chapter carries, and those it was handed, passed on. */
  carried?: string[][];
}

/** A mask bit no state holds: a requirement on a carried flag the run was
 *  not handed can never hold. (Facts use bits 0–30.) */
const NEVER = 1 << 31;
/** A chapter with no earlier chapter to say what it is handed: every mix of
 *  the carried flags it reads is tried, up to this many flags. */
const MAX_FREE_CARRIED = 12;

/**
 * A "you've been here" beat: a map marker's conditional redirect to a scene
 * that changes nothing and only leads back. The flag behind it can't change
 * where a party gets to, so it needn't be tracked; the walk takes both the
 * redirect and the original scene instead (an over-approximation).
 */
function cosmetic(module: Module, to: Id, hub: Id): boolean {
  const t = module.scenes[to];
  if (!t || (t.kind !== 'story' && t.kind !== 'dialogue')) return false;
  return t.next.every((c) => !c.effects?.length && !c.check && !c.requires?.length && (c.to === HUB_REF || c.to === hub));
}

/** Every requirement a party's path can depend on. Not an ending's slides,
 *  which only colour the last screen, nor a cosmetic redirect's. */
function pathReads(module: Module): Requirement[] {
  return Object.values(module.scenes).flatMap((s) => {
    if (s.kind === 'ending') return [];
    return s.kind === 'explore'
      ? s.map.nodes.flatMap((n) => [...(n.requires ?? []), ...(n.sceneWhen ?? []).filter((w) => !cosmetic(module, w.to, s.id)).flatMap((w) => w.if)])
      : requirementsOf(s);
  });
}

/** The carried flags (`module:flag`) a party's path can depend on. */
function carriedReads(module: Module): string[] {
  const out = new Set<string>();
  for (const r of pathReads(module)) if ((r.kind === 'flag' || r.kind === 'notFlag') && r.flag.includes(':')) out.add(r.flag);
  return [...out].sort();
}

/** The chapters that come after this one, in order. */
function sequelsOf(module: Module, chapters: readonly Module[]): Module[] {
  const out: Module[] = [];
  for (let id = module.sequel; id; ) {
    const m = chapters.find((x) => x.id === id);
    if (!m || out.includes(m)) break;
    out.push(m);
    id = m.sequel;
  }
  return out;
}

const isHubScene = (s: Scene | undefined) => s?.kind === 'explore' || s?.kind === 'dungeon';

/**
 * Results by the module's exact contents. A module is plain data, so its JSON
 * is its identity: an edited module is a different key, never a stale hit.
 * The search takes a couple of seconds on the largest chapter, and the
 * validator runs on the same unchanged modules many times over.
 */
const cache = new Map<string, ReachReport>();

export function checkModuleReach(module: Module, chapters: readonly Module[] = MODULES): ReachReport {
  // Other chapters (a test's own) are searched afresh: the cache is for the shipped ones.
  if (chapters !== MODULES) return searchChapter(module, chapters);
  const key = JSON.stringify(module);
  const hit = cache.get(key);
  if (hit) return { ...hit, errors: [...hit.errors] };
  const report = searchChapter(module, chapters);
  if (cache.size >= 64) cache.clear(); // generated delves would otherwise pile up
  cache.set(key, report);
  return { ...report, errors: [...report.errors] };
}

/**
 * Carried flags never change once a chapter starts, so they are not facts of
 * the state: the walk runs once per mix it can be handed, with each carried
 * requirement already settled. The mixes are the real ones — what a victory
 * in the chapter before can hand on (worked out by searching that chapter),
 * plus a cold start with none — so a pairing no party can bring (a scout both
 * saved and left behind) is never searched, and carried choices do not count
 * against the 31 facts a state can hold.
 */
function searchChapter(module: Module, chapters: readonly Module[]): ReachReport {
  const reads = carriedReads(module);
  const prev = chapters.find((m) => m.sequel === module.id && m.id !== module.id);
  let handed: string[][];
  if (prev) {
    const before = checkModuleReach(prev, chapters);
    if (before.skipped) return { errors: [], states: 0, skipped: `the chapter before (${prev.id}) was not searched: ${before.skipped}` };
    handed = [[], ...(before.carried ?? [])];
  } else {
    if (reads.length > MAX_FREE_CARRIED) return { errors: [], states: 0, skipped: `${reads.length} carried flags read, with no earlier chapter to say which arrive together` };
    handed = Array.from({ length: 1 << reads.length }, (_, mix) => reads.filter((_, i) => mix & (1 << i)));
  }
  // One walk per distinct mix of the flags this chapter actually reads.
  const groups = new Map<string, string[][]>();
  for (const full of handed) {
    const k = full.filter((f) => reads.includes(f)).sort().join('|');
    groups.set(k, [...(groups.get(k) ?? []), full]);
  }
  const seen = new Set<string>();
  const errors: string[] = [];
  const carried = new Map<string, string[]>();
  let states = 0;
  for (const [k, fulls] of groups) {
    const run = searchModule(module, new Set(k ? k.split('|') : []), chapters);
    if (run.skipped) return { errors: [], states: states + run.states, skipped: run.skipped };
    states += run.states;
    run.seen.forEach((id) => seen.add(id));
    for (const e of run.errors) if (!errors.includes(e)) errors.push(e);
    for (const full of fulls) {
      for (const own of run.outputs) {
        const out = [...new Set([...full, ...own.map((f) => `${module.id}:${f}`)])].sort();
        carried.set(out.join('|'), out);
      }
    }
  }
  const unreached = Object.keys(module.scenes).filter((id) => !seen.has(id))
    .map((id) => `[${id}] can never be reached: every way in is shut by a requirement that cannot hold by then`);
  return { errors: [...unreached, ...errors], states, carried: [...carried.values()] };
}

interface Run {
  errors: string[];
  states: number;
  skipped?: string;
  seen: Set<Id>;
  /** The chapter's own carried flags, by every mix a victory state holds. */
  outputs: string[][];
}

function searchModule(module: Module, handed: ReadonlySet<string>, chapters: readonly Module[]): Run {
  const none: Run = { errors: [], states: 0, seen: new Set(), outputs: [] };
  const ids = Object.keys(module.scenes);
  const index = new Map(ids.map((id, i) => [id, i]));
  const hubs = ids.filter((id) => isHubScene(module.scenes[id]));
  const hubIndex = new Map(hubs.map((id, i) => [id, i]));

  // --- The facts worth tracking -------------------------------------------
  const facts = new Map<string, number>();
  const fact = (k: string) => { if (!facts.has(k)) facts.set(k, facts.size); };
  const settled = new Set(carriedReads(module));
  for (const r of pathReads(module)) {
    if ((r.kind === 'flag' || r.kind === 'notFlag') && !r.flag.includes(':')) fact(`flag:${r.flag}`);
    if (r.kind === 'companion' || r.kind === 'noCompanion') fact(`companion:${r.companion}`);
    if (r.kind === 'visited') fact(`visited:${r.scene}`);
  }
  for (const h of hubs) fact(`visited:${h}`);
  // What this chapter hands on, where a later chapter reads it: tracked so a
  // victory can say which mixes it carries.
  const downstream = new Set(sequelsOf(module, chapters).flatMap(carriedReads));
  const handsOn = (module.carries ?? []).filter((f) => downstream.has(`${module.id}:${f}`));
  handsOn.forEach((f) => fact(`flag:${f}`));
  // The chapter's clock: which of the mornings that change something have
  // come. They come in order, so the next is always the first not yet come.
  // A dawn that touches nothing tracked changes nowhere a party can get to,
  // and one that sets a flag no scene sets is marked by that flag alone.
  const sceneSets = new Set(Object.values(module.scenes).flatMap(effectsOf)
    .flatMap((e) => (e.kind === 'setFlag' || e.kind === 'clearFlag' ? [e.flag] : [])));
  const dawns = (module.dawns ?? []).flatMap((d) => {
    const flags = (d.effects ?? []).flatMap((e) => (e.kind === 'setFlag' && e.value !== false ? [e.flag] : []));
    const touches = (d.effects ?? []).some((e) =>
      ((e.kind === 'setFlag' || e.kind === 'clearFlag') && facts.has(`flag:${e.flag}`)) ||
      ((e.kind === 'joinParty' || e.kind === 'leaveParty') && facts.has(`companion:${e.companion}`)));
    if (!touches) return [];
    const own = flags.find((f) => facts.has(`flag:${f}`) && !sceneSets.has(f));
    const key = own ? `flag:${own}` : `dawn:${d.day}`;
    fact(key);
    return [{ day: d.day, key, effects: d.effects }];
  });
  if (facts.size > MAX_FACTS) {
    return { ...none, skipped: `${facts.size} facts to track; the search packs at most ${MAX_FACTS}` };
  }
  const bit = (k: string) => (facts.has(k) ? 1 << facts.get(k)! : 0);
  // A flag read only behind a cosmetic redirect is neither a fact nor
  // settled: such a redirect is taken both ways.
  const untracked = (r: Requirement) =>
    (r.kind === 'flag' || r.kind === 'notFlag') && !facts.has(`flag:${r.flag}`) && !settled.has(r.flag);
  const factNames = [...facts.keys()];

  const mask = (reqs: Requirement[] | undefined): Mask => {
    let has = 0, not = 0;
    for (const r of reqs ?? []) {
      // A carried flag is settled for the whole run: met, or never.
      if ((r.kind === 'flag' || r.kind === 'notFlag') && settled.has(r.flag)) {
        if (handed.has(r.flag) !== (r.kind === 'flag')) has |= NEVER;
      }
      else if (r.kind === 'flag') has |= bit(`flag:${r.flag}`);
      else if (r.kind === 'notFlag') not |= bit(`flag:${r.flag}`);
      else if (r.kind === 'companion') has |= bit(`companion:${r.companion}`);
      else if (r.kind === 'noCompanion') not |= bit(`companion:${r.companion}`);
      else if (r.kind === 'visited') has |= bit(`visited:${r.scene}`);
      // gold, items, classes, species: not tracked, taken as possible.
    }
    return { has, not };
  };
  const effects = (es: Effect[] | undefined): { set: number; clr: number } => {
    let set = 0, clr = 0;
    for (const e of es ?? []) {
      let b = 0, on = true;
      if (e.kind === 'setFlag') { b = bit(`flag:${e.flag}`); on = e.value !== false; }
      else if (e.kind === 'clearFlag') { b = bit(`flag:${e.flag}`); on = false; }
      else if (e.kind === 'joinParty') b = bit(`companion:${e.companion}`);
      else if (e.kind === 'leaveParty') { b = bit(`companion:${e.companion}`); on = false; }
      if (on) { set |= b; clr &= ~b; } else { clr |= b; set &= ~b; }
    }
    return { set, clr };
  };
  const met = (m: Mask, f: number) => (f & m.has) === m.has && (f & m.not) === 0;
  const OPEN: Mask = { has: 0, not: 0 };
  const step = (to: Id, label: string, req: Mask = OPEN, eff: Effect[] | undefined = undefined): Step => ({ to, label, req, ...effects(eff) });

  // --- Each scene's ways out, compiled once ----------------------------------
  // `leave` marks the implicit way back to the hub; `when` the explore nodes,
  // whose first matching conditional destination wins.
  interface Compiled {
    steps: Step[];
    leave: boolean;
    nodes: Array<{ req: Mask; when: Array<{ req: Mask; to: Id; maybe: boolean }>; to: Id; label: string }>;
    events: Array<{ until: Mask | null; to: Id; label: string }>;
    travel: boolean;
  }
  const compiled: Compiled[] = ids.map((id) => {
    const s = module.scenes[id]!;
    const c: Compiled = { steps: [], leave: false, nodes: [], events: [], travel: false };
    const out = (o: { to: Id; effects?: Effect[] }, label: string, req?: Mask) => c.steps.push(step(o.to, label, req, o.effects));
    switch (s.kind) {
      case 'story': case 'dialogue':
        for (const ch of s.next) {
          const req = mask(ch.requires);
          c.steps.push(step(ch.to, `"${ch.label}"`, req, ch.effects));
          if (ch.check) c.steps.push(step(ch.check.failTo, `"${ch.label}" (fails)`, req, [...(ch.effects ?? []), ...(ch.check.failEffects ?? [])]));
        }
        c.leave = !s.noBack;
        break;
      case 'check': out(s.success, 'passes the check'); out(s.failure, 'fails the check'); break;
      case 'challenge':
        out(s.success, 'gets past'); out(s.failure, 'fails to get past');
        for (const a of s.approaches) {
          const req = mask(a.requires);
          if (a.success) out(a.success, `"${a.label}"`, req);
          if (a.failure && s.retry !== 'perApproach') out(a.failure, `"${a.label}" (fails)`, req);
        }
        c.leave = !s.noBack;
        break;
      case 'battle':
        out(s.onWin, 'wins the fight');
        if (s.onLoss) out(s.onLoss, 'loses the fight');
        else c.steps.push(step(module.defeatScene ?? id, 'loses the fight'));
        if (s.parley) {
          out(s.parley.success, 'talks them down');
          if (s.parley.failure) out(s.parley.failure, 'fails to talk them down');
        }
        c.leave = !s.noFlee;
        break;
      case 'shop': case 'rest': c.steps.push(step(s.next, 'moves on')); break;
      case 'explore':
        for (const n of s.map.nodes) {
          c.nodes.push({ req: mask(n.requires), to: n.scene, label: `goes to ${n.label}`,
            when: (n.sceneWhen ?? []).map((w) => ({ req: mask(w.if.filter((r) => !untracked(r))), to: w.to, maybe: w.if.some(untracked) })) });
          if (n.wandering) c.steps.push(step(n.wandering.battleScene, `is jumped on the way to ${n.label}`, mask(n.requires)));
        }
        if (s.map.camp?.risky) c.steps.push(step(s.map.camp.risky.battleScene, 'is attacked in camp'));
        c.travel = true;
        break;
      case 'dungeon': {
        const d = s.dungeon;
        for (const r of d.rooms) {
          if (r.fight) c.steps.push(step(r.fight, `walks into ${r.name}`));
          if (r.event) c.events.push({ until: r.event.until ? mask(r.event.until) : null, to: r.event.scene, label: `walks into ${r.name}` });
          if (r.search) c.steps.push(step(r.search, `searches ${r.name}`));
          if (r.exit) c.steps.push(step(r.exit.to, `leaves by ${r.name}`));
        }
        for (const l of d.links) if (l.door?.ambush) c.steps.push(step(l.door.ambush.battle, 'is ambushed in a corridor'));
        if (d.torch) c.steps.push(step(d.torch.out, 'runs out of light'));
        if (d.camp?.risky) c.steps.push(step(d.camp.risky.battleScene, 'is attacked in camp'));
        c.travel = d.rooms.some((r) => r.exit);
        break;
      }
      case 'ending': break;
    }
    return c;
  });
  const hubVisitedBits = hubs.map((h) => bit(`visited:${h}`));
  const dawnSteps = dawns.map((d) => ({ day: d.day, bit: bit(d.key), ...effects(d.effects) }));
  /** Where a party can sleep the night, by scene: at a camp (the place it
   *  stands in, or the one it came from — as `campRule`), or a long rest scene. */
  const campAt = (s: Scene | undefined) =>
    s?.kind === 'explore' ? !!s.map.camp : s?.kind === 'dungeon' ? !!s.dungeon.camp : false;
  const sleeps = ids.map((id) => {
    const s = module.scenes[id];
    return s?.kind === 'rest' && s.variant === 'long';
  });
  const sceneVisitedBit = ids.map((id) => bit(`visited:${id}`));

  // --- The walk ----------------------------------------------------------------
  // A state is (scene, hub + 1, facts) packed into one safe integer.
  const H = hubs.length + 1;
  const FACT_SPAN = 2 ** facts.size;
  const pack = (scene: number, hub: number, f: number) => (scene * H + hub + 1) * FACT_SPAN + (f >>> 0);
  const sceneOf: number[] = [], hubOf: number[] = [], factsOf: number[] = [];
  const parent: number[] = [], via: string[] = [];
  const idOf = new Map<number, number>();
  const edgeFrom: number[] = [], edgeTo: number[] = [];

  const add = (scene: number, hub: number, f: number, from: number, label: string): number => {
    const key = pack(scene, hub, f);
    let n = idOf.get(key);
    if (n === undefined) {
      n = sceneOf.length;
      idOf.set(key, n);
      sceneOf.push(scene); hubOf.push(hub); factsOf.push(f); parent.push(from); via.push(label);
    }
    return n;
  };
  /** Walk from state `n` to scene `to`, after effects. */
  const enter = (n: number, toRef: Id, set: number, clr: number, label: string) => {
    const hub = hubOf[n]!;
    const target = toRef === HUB_REF ? (hub >= 0 ? hubs[hub]! : module.start) : toRef;
    const t = index.get(target);
    if (t === undefined) return; // a dangling ref; the validator reports it
    let f = ((factsOf[n]! & ~clr) | set) | sceneVisitedBit[t]!;
    let h = hub;
    const hi = hubIndex.get(target);
    if (hi !== undefined) { h = hi; f |= hubVisitedBits[hi]!; }
    const m = add(t, h, f, n, label);
    edgeFrom.push(n); edgeTo.push(m);
  };

  const start = index.get(module.start);
  if (start === undefined) return { ...none, skipped: 'no start scene' };
  const startHub = hubIndex.get(module.start) ?? -1;
  add(start, startHub, sceneVisitedBit[start]! | (startHub >= 0 ? hubVisitedBits[startHub]! : 0), -1, '');
  for (let n = 0; n < sceneOf.length; n++) {
    if (sceneOf.length > MAX_STATES) {
      return { ...none, states: sceneOf.length, skipped: `more than ${MAX_STATES} states` };
    }
    const s = sceneOf[n]!, f = factsOf[n]!, hub = hubOf[n]!;
    const c = compiled[s]!;
    const here = ids[s]!;
    for (const st of c.steps) if (met(st.req, f)) enter(n, st.to, st.set, st.clr, `${here}: ${st.label}`);
    for (const nd of c.nodes) {
      if (!met(nd.req, f)) continue;
      // First matching redirect wins; one that reads an untracked flag may or
      // may not apply, so it is taken and the search carries on past it too.
      let to: Id = nd.to;
      for (const w of nd.when) {
        if (w.maybe) { enter(n, w.to, 0, 0, `${here}: ${nd.label}`); continue; }
        if (met(w.req, f)) { to = w.to; break; }
      }
      enter(n, to, 0, 0, `${here}: ${nd.label}`);
    }
    for (const ev of c.events) if (!ev.until || !met(ev.until, f)) enter(n, ev.to, 0, 0, `${here}: ${ev.label}`);
    if (c.leave && hub >= 0 && hubs[hub] !== here) enter(n, HUB_REF, 0, 0, `${here}: goes back`);
    if (c.travel) {
      hubs.forEach((h, i) => { if (h !== here && (f & hubVisitedBits[i]!)) enter(n, h, 0, 0, `${here}: travels to ${h}`); });
    }
    // A night slept may bring the next morning that matters (or may not yet:
    // the nights between change nothing, and the walk has those already).
    const next = dawnSteps.find((d) => !(f & d.bit));
    if (next) {
      const scene = module.scenes[here];
      const camp = isHubScene(scene) ? campAt(scene) : hub >= 0 && campAt(module.scenes[hubs[hub]!]);
      const label = `sleeps until the morning of day ${next.day}`;
      if (camp) enter(n, here, next.set | next.bit, next.clr, `${here}: ${label}`);
      if (sleeps[s]) enter(n, (scene as Extract<Scene, { kind: 'rest' }>).next, next.set | next.bit, next.clr, `${here}: ${label}`);
    }
  }

  // --- What it found -------------------------------------------------------------
  const errors: string[] = [];
  const seenScenes = new Set(sceneOf.map((s) => ids[s]!));
  const carriedNote = handed.size ? ` (carried in: ${[...handed].join(', ')})` : '';

  const victory = (n: number) => { const s = module.scenes[ids[sceneOf[n]!]!]; return s?.kind === 'ending' && s.outcome === 'victory'; };
  const N = sceneOf.length;
  // A module with a victory ending: a state that cannot reach one is stranded,
  // even in a run (a mix of carried choices) where none is reached at all.
  if (Object.values(module.scenes).some((sc) => sc.kind === 'ending' && sc.outcome === 'victory')) {
    // Which states can still get to a victory: backwards from the victories.
    const offsets = new Int32Array(N + 1);
    for (const t of edgeTo) offsets[t + 1]!++;
    for (let i = 0; i < N; i++) offsets[i + 1]! += offsets[i]!;
    const fill = offsets.slice(0, N);
    const preds = new Int32Array(edgeTo.length);
    for (let e = 0; e < edgeTo.length; e++) preds[fill[edgeTo[e]!]!++] = edgeFrom[e]!;
    const good = new Uint8Array(N);
    const stack: number[] = [];
    for (let n = 0; n < N; n++) if (victory(n)) { good[n] = 1; stack.push(n); }
    while (stack.length) {
      const n = stack.pop()!;
      for (let i = offsets[n]!; i < offsets[n + 1]!; i++) {
        const p = preds[i]!;
        if (!good[p]) { good[p] = 1; stack.push(p); }
      }
    }
    // The first (shortest-path) stranded state in each scene, a few scenes deep.
    const reported = new Set<number>();
    for (let n = 0; n < N && reported.size < 3; n++) {
      const scene = module.scenes[ids[sceneOf[n]!]!]!;
      if (good[n] || scene.kind === 'ending' || reported.has(sceneOf[n]!)) continue;
      reported.add(sceneOf[n]!);
      const path: string[] = [];
      for (let m = n; parent[m]! >= 0; m = parent[m]!) path.unshift(via[m]!);
      const shown = path.length > 10 ? ['…', ...path.slice(-10)] : path;
      const held = factNames.filter((k, i) => k.startsWith('flag:') && factsOf[n]! & (1 << i)).map((k) => k.slice(5));
      errors.push(`[${ids[sceneOf[n]!]}] a party can be stranded here with no way left to a victory ending`
        + `${held.length ? ` (flags: ${held.join(', ')})` : ''}${carriedNote}. One way there: ${shown.join(' → ')}`);
    }
  }
  // A `perApproach` challenge spends every approach tried, for good. With no
  // way back out (`noBack`), a party that comes back to it after trying it
  // can arrive with nothing left to try. The search can't see spent
  // approaches, so it looks for the shape instead: leave the challenge, and
  // find a way to stand in front of it again.
  const fwdOff = new Int32Array(N + 1);
  for (const f of edgeFrom) fwdOff[f + 1]!++;
  for (let i = 0; i < N; i++) fwdOff[i + 1]! += fwdOff[i]!;
  const fwd = new Int32Array(edgeFrom.length);
  const fill2 = fwdOff.slice(0, N);
  for (let e = 0; e < edgeFrom.length; e++) fwd[fill2[edgeFrom[e]!]!++] = edgeTo[e]!;
  ids.forEach((id, ci) => {
    const sc = module.scenes[id];
    if (sc?.kind !== 'challenge' || sc.retry !== 'perApproach' || !sc.noBack) return;
    const seen = new Uint8Array(N);
    const stack: number[] = [];
    for (let n = 0; n < N; n++) {
      if (sceneOf[n] !== ci) continue;
      for (let i = fwdOff[n]!; i < fwdOff[n + 1]!; i++) {
        const m = fwd[i]!;
        if (sceneOf[m] !== ci && !seen[m]) { seen[m] = 1; stack.push(m); }
      }
    }
    while (stack.length) {
      const n = stack.pop()!;
      if (sceneOf[n] === ci) {
        errors.push(`[${id}] a party can come back to this challenge after trying it. Approaches already tried stay spent, and with noBack there may be nothing left to try. Route the way back past it (e.g. a sceneWhen on the flag its outcome sets).`);
        return;
      }
      for (let i = fwdOff[n]!; i < fwdOff[n + 1]!; i++) {
        const m = fwd[i]!;
        if (!seen[m]) { seen[m] = 1; stack.push(m); }
      }
    }
  });
  // What a victory hands on.
  const outputs = new Map<number, string[]>();
  const handBits = handsOn.map((f) => bit(`flag:${f}`));
  for (let n = 0; n < N; n++) {
    if (!victory(n)) continue;
    const m = handBits.reduce((acc, b) => acc | (factsOf[n]! & b), 0);
    if (!outputs.has(m)) outputs.set(m, handsOn.filter((_, i) => factsOf[n]! & handBits[i]!));
  }
  return { errors, states: N, seen: seenScenes, outputs: [...outputs.values()] };
}
