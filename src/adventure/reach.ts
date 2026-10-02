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
import { requirementsOf, effectsOf, parasOf, flagsWritten } from './graph.js';
import { isNpcFlag } from './npcs.js';
import { MODULES } from '../data/modules/index.js';

/** The most facts a state can carry: they share one number, exact to 2^53. */
const MAX_FACTS = 52;
/** A search bigger than this is reported, not run. */
const MAX_STATES = 3_000_000;

/** Facts that must hold (`has`), must not (`not`), and the hub the party
 *  must be at (`at`, an index into the hubs; -2 for nowhere it can be). */
interface Mask { has: number; not: number; at?: number }
interface Step { to: Id; req: Mask; set: number; clr: number; label: string; /** loses a day (`passDay`) */ day?: true }

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
 *  not handed can never hold. (Facts use bits 0–51.) */
const NEVER = 2 ** 52;

// Fact sets are non-negative numbers up to 2^53: JavaScript's bitwise
// operators see only 32 bits, so a set wider than that is done in two halves.
// The low half alone is the common case, and the fast one.
const LO = 2 ** 32;
const lo = (a: number) => a % LO;
const hi = (a: number) => Math.floor(a / LO);
const and = (a: number, b: number) =>
  (a < LO && b < LO ? (a & b) >>> 0 : ((lo(a) & lo(b)) >>> 0) + (hi(a) & hi(b)) * LO);
const or = (a: number, b: number) =>
  (a < LO && b < LO ? (a | b) >>> 0 : ((lo(a) | lo(b)) >>> 0) + (hi(a) | hi(b)) * LO);
const without = (a: number, b: number) =>
  (a < LO && b < LO ? (a & ~b) >>> 0 : ((lo(a) & ~lo(b)) >>> 0) + ((hi(a) & ~hi(b)) >>> 0) * LO);
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

/**
 * What each scene takes for granted (`assumes` on the scene, or on any of its
 * paragraphs), by where it is said. The search proves each holds on every
 * route that reaches the scene.
 */
function assumptionsOf(scene: Scene): Array<{ where: string; reqs: Requirement[]; when: Requirement[] }> {
  const out: Array<{ where: string; reqs: Requirement[]; when: Requirement[] }> = [];
  if ('assumes' in scene && scene.assumes?.length) out.push({ where: 'the scene', reqs: scene.assumes, when: [] });
  for (const { where, paras } of parasOf(scene)) {
    for (const p of paras) {
      if (typeof p !== 'string' && p.assumes?.length) {
        // Only where the line shows: its own `if` must hold too.
        out.push({ where: `${where} "${p.text.slice(0, 40)}${p.text.length > 40 ? '…' : ''}"`, reqs: p.assumes, when: p.if ?? [] });
      }
    }
  }
  return out;
}
const assumedReads = (module: Module): Requirement[] =>
  Object.values(module.scenes).flatMap((s) => assumptionsOf(s).flatMap((a) => [...a.reqs, ...a.when]));

/** All the words a scene can show: its prose (every field, every variant),
 *  its choice and approach labels, its map's labels, its ending's slides.
 *  `can` says whether a line's condition might hold (a hidden choice shows
 *  only when its requirements might); by default, every line counts. */
function sceneWords(scene: Scene, can: (reqs: Requirement[] | undefined) => boolean = () => true): string {
  const out: string[] = [];
  for (const { paras } of parasOf(scene)) for (const p of paras) if (typeof p === 'string' || can(p.if)) out.push(typeof p === 'string' ? p : p.text);
  const shown = (x: { requires?: Requirement[]; hideWhenBlocked?: boolean }) => !x.hideWhenBlocked || can(x.requires);
  if (scene.kind === 'story' || scene.kind === 'dialogue') for (const c of scene.next) if (shown(c)) out.push(c.label);
  if (scene.kind === 'dialogue') out.push(scene.npc.name);
  if (scene.kind === 'challenge') for (const a of scene.approaches) if (shown(a)) out.push(a.label, a.hint ?? '');
  if (scene.kind === 'battle' && scene.parley?.label) out.push(scene.parley.label);
  if (scene.kind === 'ending') for (const sl of scene.slides ?? []) if (can(sl.if)) out.push(sl.text);
  if (scene.kind === 'explore') for (const n of scene.map.nodes) out.push(n.label, n.note ?? '');
  return out.join('\n');
}

/** A flag that can arrive from an earlier chapter: one carried (`module:flag`),
 *  or an NPC's campaign-wide state (`npc.…`). */
const inherited = (flag: string) => flag.includes(':') || isNpcFlag(flag);

/** The inherited flags a party's path, or a line's assumption, can depend on. */
function carriedReads(module: Module): string[] {
  const out = new Set<string>();
  for (const r of [...pathReads(module), ...assumedReads(module)]) {
    if ((r.kind === 'flag' || r.kind === 'notFlag') && inherited(r.flag)) out.add(r.flag);
  }
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
 * against the 52 facts a state can hold.
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
    // With no chapter before, NPC state starts clean; carried choices could be anything.
    const free = reads.filter((f) => f.includes(':'));
    if (free.length > MAX_FREE_CARRIED) return { errors: [], states: 0, skipped: `${free.length} carried flags read, with no earlier chapter to say which arrive together` };
    handed = Array.from({ length: 1 << free.length }, (_, mix) => free.filter((_, i) => mix & (1 << i)));
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
    // The same finding in another mix of carried choices is the same finding.
    for (const e of run.errors) if (!errors.some((x) => sameFinding(x, e))) errors.push(e);
    for (const full of fulls) {
      for (const own of run.outputs) {
        // NPC state this chapter can change is handed on as it left it.
        const out = [...new Set([...full.filter((f) => !run.rewrites.has(f)), ...own])].sort();
        carried.set(out.join('|'), out);
      }
    }
  }
  const unreached = Object.keys(module.scenes).filter((id) => !seen.has(id))
    .map((id) => `[${id}] can never be reached: every way in is shut by a requirement that cannot hold by then`);
  return { errors: [...unreached, ...errors], states, carried: [...carried.values()] };
}

const sameFinding = (a: string, b: string) => {
  const bare = (e: string) => e.replace(/ \(carried in: [^)]*\)/, '');
  return bare(a) === bare(b);
};

interface Run {
  errors: string[];
  states: number;
  skipped?: string;
  seen: Set<Id>;
  /** What it hands on (fully named), by every mix a victory state holds. */
  outputs: string[][];
  /** Inherited flags it tracks and may change, so hands on afresh. */
  rewrites: Set<string>;
}

function searchModule(module: Module, handed: ReadonlySet<string>, chapters: readonly Module[]): Run {
  const none: Run = { errors: [], states: 0, seen: new Set(), outputs: [], rewrites: new Set() };
  const ids = Object.keys(module.scenes);
  const index = new Map(ids.map((id, i) => [id, i]));
  const hubs = ids.filter((id) => isHubScene(module.scenes[id]));
  const hubIndex = new Map(hubs.map((id, i) => [id, i]));

  // --- The facts worth tracking -------------------------------------------
  const facts = new Map<string, number>();
  const fact = (k: string) => { if (!facts.has(k)) facts.set(k, facts.size); };
  // Inherited flags are settled for the run — unless this chapter can change
  // them (NPC state), when they are facts that start as they were handed.
  const written = flagsWritten(module);
  const settled = new Set(carriedReads(module).filter((f) => !written.has(f)));
  // A counted flag (a tally: set to a number, or read against one) has more
  // than two states, and a bit cannot hold it. It is left untracked, so a
  // requirement on it is taken as possible either way, like gold or items.
  const counted = new Set([
    ...Object.values(module.scenes).flatMap(effectsOf), ...(module.dawns ?? []).flatMap((d) => d.effects ?? []),
  ].flatMap((e) => (e.kind === 'setFlag' && typeof e.value === 'number' ? [e.flag]
    // A snapshot can hold any value its source can: never a bit.
    : e.kind === 'copyFlag' || e.kind === 'addFlag' ? [e.kind === 'copyFlag' ? e.to : e.flag] : [])));
  for (const r of [...pathReads(module), ...assumedReads(module)]) if ((r.kind === 'flag' && typeof r.value === 'number') || r.kind === 'count') counted.add(r.flag);
  for (const r of [...pathReads(module), ...assumedReads(module)]) {
    if ((r.kind === 'flag' || r.kind === 'notFlag') && !settled.has(r.flag) && !counted.has(r.flag)) fact(`flag:${r.flag}`);
    if (r.kind === 'companion' || r.kind === 'noCompanion') fact(`companion:${r.companion}`);
    if (r.kind === 'visited') fact(`visited:${r.scene}`);
  }
  for (const h of hubs) fact(`visited:${h}`);
  // What this chapter hands on, where a later chapter reads it: tracked so a
  // victory can say which mixes it carries.
  const downstream = new Set(sequelsOf(module, chapters).flatMap(carriedReads));
  const handsOn = [
    ...(module.carries ?? []).filter((f) => downstream.has(`${module.id}:${f}`)).map((f) => ({ flag: f, as: `${module.id}:${f}` })),
    ...[...downstream].filter((f) => isNpcFlag(f) && written.has(f)).map((f) => ({ flag: f, as: f })),
  ];
  handsOn.forEach((h) => fact(`flag:${h.flag}`));
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
  const bit = (k: string) => (facts.has(k) ? 2 ** facts.get(k)! : 0);
  // A flag read only behind a cosmetic redirect is neither a fact nor
  // settled: such a redirect is taken both ways.
  const untracked = (r: Requirement) =>
    (r.kind === 'flag' || r.kind === 'notFlag') && !facts.has(`flag:${r.flag}`) && !settled.has(r.flag);
  const factNames = [...facts.keys()];

  const mask = (reqs: Requirement[] | undefined): Mask => {
    let has = 0, not = 0;
    let at: number | undefined;
    for (const r of reqs ?? []) {
      // A carried flag is settled for the whole run: met, or never.
      if ((r.kind === 'flag' || r.kind === 'notFlag') && settled.has(r.flag)) {
        if (handed.has(r.flag) !== (r.kind === 'flag')) has = or(has, NEVER);
      }
      else if (r.kind === 'flag') has = or(has, bit(`flag:${r.flag}`));
      else if (r.kind === 'notFlag') not = or(not, bit(`flag:${r.flag}`));
      else if (r.kind === 'companion') has = or(has, bit(`companion:${r.companion}`));
      else if (r.kind === 'noCompanion') not = or(not, bit(`companion:${r.companion}`));
      else if (r.kind === 'visited') has = or(has, bit(`visited:${r.scene}`));
      else if (r.kind === 'at') {
        const h = hubIndex.get(r.hub) ?? -2;
        at = at === undefined || at === h ? h : -2; // two different places: nowhere
      }
      // gold, items, classes, species: not tracked, taken as possible.
    }
    return { has, not, ...(at !== undefined ? { at } : {}) };
  };
  const effects = (es: Effect[] | undefined): { set: number; clr: number } => {
    let set = 0, clr = 0;
    for (const e of es ?? []) {
      let b = 0, on = true;
      if (e.kind === 'setFlag') { b = bit(`flag:${e.flag}`); on = e.value !== false; }
      else if (e.kind === 'clearFlag') { b = bit(`flag:${e.flag}`); on = false; }
      else if (e.kind === 'joinParty') b = bit(`companion:${e.companion}`);
      else if (e.kind === 'leaveParty') { b = bit(`companion:${e.companion}`); on = false; }
      if (on) { set = or(set, b); clr = without(clr, b); } else { clr = or(clr, b); set = without(set, b); }
    }
    return { set, clr };
  };
  const met = (m: Mask, f: number, h: number) => and(f, m.has) === m.has && and(f, m.not) === 0 && (m.at === undefined || m.at === h);
  const OPEN: Mask = { has: 0, not: 0 };
  const step = (to: Id, label: string, req: Mask = OPEN, eff: Effect[] | undefined = undefined): Step =>
    ({ to, label, req, ...effects(eff), ...(eff?.some((e) => e.kind === 'passDay') ? { day: true as const } : {}) });

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
        c.leave = !s.noFlee && s.surprise !== 'party'; // caught out: no falling back
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
   *  stands in — as `campRule`), or a long rest scene. */
  const campAt = (s: Scene | undefined) =>
    s?.kind === 'explore' ? !!s.map.camp : s?.kind === 'dungeon' ? !!s.dungeon.camp : false;
  const sleeps = ids.map((id) => {
    const s = module.scenes[id];
    return s?.kind === 'rest' && s.variant === 'long';
  });
  const sceneVisitedBit = ids.map((id) => bit(`visited:${id}`));

  // --- The walk ----------------------------------------------------------------
  // A state is (scene, hub + 1, facts): packed into one safe integer while
  // that fits, and keyed by a string past it.
  const H = hubs.length + 1;
  const FACT_SPAN = 2 ** facts.size;
  const packs = ids.length * H * FACT_SPAN <= Number.MAX_SAFE_INTEGER;
  const pack = (scene: number, hub: number, f: number): number | string =>
    (packs ? (scene * H + hub + 1) * FACT_SPAN + f : `${scene * H + hub + 1}|${f}`);
  const sceneOf: number[] = [], hubOf: number[] = [], factsOf: number[] = [];
  const parent: number[] = [], via: string[] = [];
  const idOf = new Map<number | string, number>();
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
    let f = or(or(without(factsOf[n]!, clr), set), sceneVisitedBit[t]!);
    let h = hub;
    const hx = hubIndex.get(target);
    if (hx !== undefined) { h = hx; f = or(f, hubVisitedBits[hx]!); }
    const m = add(t, h, f, n, label);
    edgeFrom.push(n); edgeTo.push(m);
  };

  const start = index.get(module.start);
  if (start === undefined) return { ...none, skipped: 'no start scene' };
  const startHub = hubIndex.get(module.start) ?? -1;
  const handedBits = [...handed].reduce((acc, f) => or(acc, bit(`flag:${f}`)), 0);
  add(start, startHub, or(or(handedBits, sceneVisitedBit[start]!), startHub >= 0 ? hubVisitedBits[startHub]! : 0), -1, '');
  for (let n = 0; n < sceneOf.length; n++) {
    if (sceneOf.length > MAX_STATES) {
      return { ...none, states: sceneOf.length, skipped: `more than ${MAX_STATES} states` };
    }
    const s = sceneOf[n]!, f = factsOf[n]!, hub = hubOf[n]!;
    const c = compiled[s]!;
    const here = ids[s]!;
    // The next morning that matters, if any is still to come.
    const next = dawnSteps.find((d) => !and(f, d.bit));
    for (const st of c.steps) {
      if (!met(st.req, f, hub)) continue;
      enter(n, st.to, st.set, st.clr, `${here}: ${st.label}`);
      // A day lost may bring that morning (or may not yet).
      // The step's effects, then the morning's.
      if (st.day && next) {
        enter(n, st.to, or(or(without(st.set, next.clr), next.set), next.bit), or(st.clr, next.clr),
          `${here}: ${st.label}, and loses a day to the morning of day ${next.day}`);
      }
    }
    for (const nd of c.nodes) {
      if (!met(nd.req, f, hub)) continue;
      // First matching redirect wins; one that reads an untracked flag may or
      // may not apply, so it is taken and the search carries on past it too.
      let to: Id = nd.to;
      for (const w of nd.when) {
        if (w.maybe) { enter(n, w.to, 0, 0, `${here}: ${nd.label}`); continue; }
        if (met(w.req, f, hub)) { to = w.to; break; }
      }
      enter(n, to, 0, 0, `${here}: ${nd.label}`);
    }
    for (const ev of c.events) if (!ev.until || !met(ev.until, f, hub)) enter(n, ev.to, 0, 0, `${here}: ${ev.label}`);
    if (c.leave && hub >= 0 && hubs[hub] !== here) enter(n, HUB_REF, 0, 0, `${here}: goes back`);
    if (c.travel) {
      hubs.forEach((h, i) => { if (h !== here && and(f, hubVisitedBits[i]!)) enter(n, h, 0, 0, `${here}: travels to ${h}`); });
    }
    // A night slept may bring the next morning that matters (or may not yet:
    // the nights between change nothing, and the walk has those already).
    if (next) {
      const scene = module.scenes[here];
      const camp = isHubScene(scene) && campAt(scene);
      const label = `sleeps until the morning of day ${next.day}`;
      if (camp) enter(n, here, or(next.set, next.bit), next.clr, `${here}: ${label}`);
      if (sleeps[s]) enter(n, (scene as Extract<Scene, { kind: 'rest' }>).next, or(next.set, next.bit), next.clr, `${here}: ${label}`);
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
      const held = factNames.filter((k, i) => k.startsWith('flag:') && and(factsOf[n]!, 2 ** i)).map((k) => k.slice(5));
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
  // The cast (Module.cast): no route shows a name before one of its
  // introductions. Walk forward from the start without entering any
  // introducing scene; a state there whose scene mentions the name is a route
  // that shows it first. No extra facts: it reads the graph already built.
  // The cast: the module's own list, and the registry's NPCs this chapter introduces.
  const cast = [
    ...(module.cast ?? []),
    ...Object.values(module.npcs ?? {}).flatMap((npc) => {
      const at = npc.introducedAt?.[module.id];
      return at?.length ? [{ name: npc.name, ...(npc.aka ? { aka: npc.aka } : {}), introducedAt: at }] : [];
    }),
  ];
  for (const member of cast) {
    const intro = new Set(member.introducedAt.map((sid) => index.get(sid)).filter((x): x is number => x !== undefined));
    // The name as written (proper nouns are capitalised: "Wren", not a wren);
    // an alias in any case ("The chief" opening a sentence).
    const word = (w: string, flags: string) => new RegExp(`\\b${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, flags);
    const words = [word(member.name, ''), ...(member.aka ?? []).map((a) => word(a, 'i'))];
    // A scene that can name them at all; then, state by state, whether it
    // does with what the party holds there (a line behind a flag only an
    // introduction sets never shows before one).
    const mentions = ids.map((id, si) => !intro.has(si) && words.some((re) => re.test(sceneWords(module.scenes[id]!))));
    if (!mentions.some(Boolean)) continue;
    const said = new Map<string, boolean>();
    const names = (n: number) => {
      const si = sceneOf[n]!;
      if (!mentions[si]) return false;
      const key = `${si}|${factsOf[n]!}`;
      let hit = said.get(key);
      if (hit === undefined) {
        hit = words.some((re) => re.test(sceneWords(module.scenes[ids[si]!]!, (reqs) => met(mask(reqs), factsOf[n]!, hubOf[n]!))));
        said.set(key, hit);
      }
      return hit;
    };
    const from = new Int32Array(N).fill(-2);
    const queue: number[] = [];
    for (let n = 0; n < N; n++) if (parent[n] === -1 && !intro.has(sceneOf[n]!)) { from[n] = -1; queue.push(n); }
    let found = -1;
    for (let q = 0; q < queue.length && found < 0; q++) {
      const n = queue[q]!;
      if (names(n)) { found = n; break; }
      for (let i = fwdOff[n]!; i < fwdOff[n + 1]!; i++) {
        const m = fwd[i]!;
        if (from[m] !== -2 || intro.has(sceneOf[m]!)) continue;
        from[m] = n; queue.push(m);
      }
    }
    if (found < 0) continue;
    const path: string[] = [];
    for (let m = found; from[m]! >= 0; m = from[m]!) path.unshift(`${ids[sceneOf[from[m]!]!]} → ${ids[sceneOf[m]!]}`);
    errors.push(`[${ids[sceneOf[found]!]}] names ${member.name} before any introduction (${member.introducedAt.join(', ')})${carriedNote}.`
      + ` One way: ${path.length ? path.join(', ') : '(the start)'}`);
  }

  // What each line takes for granted (`assumes`) holds on every route that
  // reaches it. States are numbered breadth-first, so the first state found
  // breaking an assumption has the shortest way there.
  const unseen = (r: Requirement): string | null => {
    if (r.kind === 'item' || r.kind === 'gold' || r.kind === 'classInParty' || r.kind === 'speciesInParty') return r.kind;
    if (r.kind === 'count') return `the tally '${r.flag}'`;
    if ((r.kind === 'flag' || r.kind === 'notFlag') && !settled.has(r.flag) && !facts.has(`flag:${r.flag}`)) return `the counted flag '${r.flag}'`;
    return null;
  };
  const describe = (r: Requirement): string =>
    r.kind === 'flag' ? r.flag : r.kind === 'notFlag' ? `not ${r.flag}` : r.kind === 'companion' ? `${r.companion} in the party`
      : r.kind === 'noCompanion' ? `${r.companion} not in the party` : r.kind === 'visited' ? `visited ${r.scene}`
      : r.kind === 'at' ? `at ${r.hub}` : r.kind;
  const assumed = ids.map((id) => assumptionsOf(module.scenes[id]!).map((a) => ({ ...a, mask: mask(a.reqs), shows: mask(a.when) })));
  const broken = new Set<string>();
  ids.forEach((id, si) => {
    for (const a of assumed[si]!) {
      const blind = [...a.reqs, ...a.when].map(unseen).find((x) => x);
      if (blind) {
        errors.push(`[${id}] assumes something the search can't see (${blind}), at ${a.where}: assume a flag, a companion or a visit instead`);
        broken.add(`${si}|${a.where}`);
      }
    }
  });
  for (let n = 0; n < N; n++) {
    const si = sceneOf[n]!;
    for (const a of assumed[si]!) {
      const key = `${si}|${a.where}`;
      if (broken.has(key) || !met(a.shows, factsOf[n]!, hubOf[n]!) || met(a.mask, factsOf[n]!, hubOf[n]!)) continue;
      broken.add(key);
      const path: string[] = [];
      for (let m = n; parent[m]! >= 0; m = parent[m]!) path.unshift(via[m]!);
      const shown = path.length > 10 ? ['…', ...path.slice(-10)] : path;
      errors.push(`[${ids[si]}] ${a.where} assumes ${a.reqs.map(describe).join(' and ')}, but a party can get here without it`
        + `${carriedNote}. One way: ${shown.join(' → ') || '(the start)'}`);
    }
  }

  // What a victory hands on.
  const outputs = new Map<number, string[]>();
  const handBits = handsOn.map((h) => bit(`flag:${h.flag}`));
  for (let n = 0; n < N; n++) {
    if (!victory(n)) continue;
    const m = handBits.reduce((acc, b) => or(acc, and(factsOf[n]!, b)), 0);
    if (!outputs.has(m)) outputs.set(m, handsOn.filter((_, i) => and(factsOf[n]!, handBits[i]!)).map((h) => h.as));
  }
  return { errors, states: N, seen: seenScenes, outputs: [...outputs.values()], rewrites: new Set(handsOn.filter((h) => isNpcFlag(h.flag)).map((h) => h.flag)) };
}
