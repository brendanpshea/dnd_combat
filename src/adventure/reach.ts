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
 * From the states it reports:
 *   - scenes no state reaches (gated shut, though something routes to them);
 *   - states that cannot reach a victory ending, with the shortest way there.
 */
import type { Id } from '../engine/types.js';
import { HUB_REF, type Module, type Requirement, type Effect, type Scene } from './types.js';
import { requirementsOf } from './graph.js';

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
}

const isHubScene = (s: Scene | undefined) => s?.kind === 'explore' || s?.kind === 'dungeon';

/**
 * Results by the module's exact contents. A module is plain data, so its JSON
 * is its identity: an edited module is a different key, never a stale hit.
 * The search takes a couple of seconds on the largest chapter, and the
 * validator runs on the same unchanged modules many times over.
 */
const cache = new Map<string, ReachReport>();

export function checkModuleReach(module: Module): ReachReport {
  const key = JSON.stringify(module);
  const hit = cache.get(key);
  if (hit) return { ...hit, errors: [...hit.errors] };
  const report = searchModule(module);
  if (cache.size >= 64) cache.clear(); // generated delves would otherwise pile up
  cache.set(key, report);
  return { ...report, errors: [...report.errors] };
}

function searchModule(module: Module): ReachReport {
  const ids = Object.keys(module.scenes);
  const index = new Map(ids.map((id, i) => [id, i]));
  const hubs = ids.filter((id) => isHubScene(module.scenes[id]));
  const hubIndex = new Map(hubs.map((id, i) => [id, i]));

  // --- The facts worth tracking -------------------------------------------
  const facts = new Map<string, number>();
  const fact = (k: string) => { if (!facts.has(k)) facts.set(k, facts.size); };
  for (const s of Object.values(module.scenes)) {
    // An ending's slides only colour the last screen: nothing they read can
    // change where a party gets to, so tracking them would only multiply the
    // states (each carried flag doubles them) for no answer.
    if (s.kind === 'ending') continue;
    for (const r of requirementsOf(s)) {
      if (r.kind === 'flag' || r.kind === 'notFlag') fact(`flag:${r.flag}`);
      if (r.kind === 'companion' || r.kind === 'noCompanion') fact(`companion:${r.companion}`);
      if (r.kind === 'visited') fact(`visited:${r.scene}`);
    }
  }
  for (const h of hubs) fact(`visited:${h}`);
  if (facts.size > MAX_FACTS) {
    return { errors: [], states: 0, skipped: `${facts.size} facts to track; the search packs at most ${MAX_FACTS}` };
  }
  const bit = (k: string) => (facts.has(k) ? 1 << facts.get(k)! : 0);
  const factNames = [...facts.keys()];

  const mask = (reqs: Requirement[] | undefined): Mask => {
    let has = 0, not = 0;
    for (const r of reqs ?? []) {
      if (r.kind === 'flag') has |= bit(`flag:${r.flag}`);
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
    nodes: Array<{ req: Mask; when: Array<{ req: Mask; to: Id }>; to: Id; label: string }>;
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
          c.nodes.push({ req: mask(n.requires), when: (n.sceneWhen ?? []).map((w) => ({ req: mask(w.if), to: w.to })), to: n.scene, label: `goes to ${n.label}` });
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
  if (start === undefined) return { errors: [], states: 0, skipped: 'no start scene' };
  const startHub = hubIndex.get(module.start) ?? -1;
  // Choices carried in from earlier chapters (`module:flag`) may arrive
  // either way — a cold start has none — so the walk starts from every mix.
  const inherited = factNames.map((k, i) => (k.startsWith('flag:') && k.includes(':', 5) ? 1 << i : 0)).filter(Boolean);
  for (let mix = 0; mix < 1 << inherited.length; mix++) {
    let f = sceneVisitedBit[start]! | (startHub >= 0 ? hubVisitedBits[startHub]! : 0);
    inherited.forEach((b, j) => { if (mix & (1 << j)) f |= b; });
    add(start, startHub, f, -1, '');
  }
  for (let n = 0; n < sceneOf.length; n++) {
    if (sceneOf.length > MAX_STATES) {
      return { errors: [], states: sceneOf.length, skipped: `more than ${MAX_STATES} states` };
    }
    const s = sceneOf[n]!, f = factsOf[n]!, hub = hubOf[n]!;
    const c = compiled[s]!;
    const here = ids[s]!;
    for (const st of c.steps) if (met(st.req, f)) enter(n, st.to, st.set, st.clr, `${here}: ${st.label}`);
    for (const nd of c.nodes) {
      if (!met(nd.req, f)) continue;
      const w = nd.when.find((x) => met(x.req, f));
      enter(n, w ? w.to : nd.to, 0, 0, `${here}: ${nd.label}`);
    }
    for (const ev of c.events) if (!ev.until || !met(ev.until, f)) enter(n, ev.to, 0, 0, `${here}: ${ev.label}`);
    if (c.leave && hub >= 0 && hubs[hub] !== here) enter(n, HUB_REF, 0, 0, `${here}: goes back`);
    if (c.travel) {
      hubs.forEach((h, i) => { if (h !== here && (f & hubVisitedBits[i]!)) enter(n, h, 0, 0, `${here}: travels to ${h}`); });
    }
  }

  // --- What it found -------------------------------------------------------------
  const errors: string[] = [];
  const seenScenes = new Set(sceneOf.map((s) => ids[s]!));
  for (const id of ids) if (!seenScenes.has(id)) errors.push(`[${id}] can never be reached: every way in is shut by a requirement that cannot hold by then`);

  const victory = (n: number) => { const s = module.scenes[ids[sceneOf[n]!]!]; return s?.kind === 'ending' && s.outcome === 'victory'; };
  const N = sceneOf.length;
  if (sceneOf.some((_, n) => victory(n))) {
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
        + `${held.length ? ` (flags: ${held.join(', ')})` : ''}. One way there: ${shown.join(' → ')}`);
    }
  }
  return { errors, states: N };
}
