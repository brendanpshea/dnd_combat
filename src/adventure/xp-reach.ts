/**
 * The most XP a company can hold, at every fight's door and at every ending.
 *
 * docs/design-decisions.md: levels come from fights, and Part 3 tops out at
 * 5th. Twice a roster or reward change let some route over-level, and only the
 * seven replayed routes (scripts/transcripts.ts) were there to catch it. This
 * checks every route instead.
 *
 * It reuses the reachability search (reach.ts), which walks every state a
 * chapter can be in, with each edge tagged with what it pays (`traceXp`): a
 * won fight's encounter XP (`xpAward`, unless `loot: false`) and its win's
 * rewards, and every `xp` / `xpToLevel` effect wherever effects run (choices,
 * outcomes, parleys, approaches, mornings). Each payment carries the key that
 * stops it paying twice in a run: a won fight (`battleWonBefore`), a `once`
 * choice, a shared `attempt`, a parley, a spent approach, a morning. A plain
 * choice or a check scene's outcome has none: it pays every time. XP is not
 * part of a state, so:
 *
 *   - The state graph is cut into strongly-connected components, where a
 *     party can go round and round. Something there that pays every time is
 *     XP that can be farmed: reported. Something keyed is counted once.
 *   - Over the components, which form a DAG, the most XP is carried forward
 *     from the start (the longest path): into a component, the best of its
 *     ways in; out of it, that plus what it pays inside.
 *   - A key that one route can meet twice, in two components (the same
 *     optional fight, open again once some unrelated flag has changed), would
 *     be counted twice by that. Such a key is left out of the longest path
 *     and counted once, everywhere some route that pays it can reach.
 *   - The search sees a marker's "already done" redirect as open both ways
 *     (reach.ts: `cosmetic`), so it would let a side trip pay again, or a
 *     skill check be farmed. `sideTrips` proves, from the module, which
 *     side trips can pay only once in all, and keys their payments as one.
 *
 * The result is an upper bound, never an underestimate: every roll goes the
 * way that pays, and a twice-met key may be counted where the route that pays
 * it and the route that reaches the state are not one route. So a fight
 * reported met above its band may be a bound no party reaches: the path
 * printed with it says how. On the shipped trilogy it meets the best replayed
 * route exactly at several fights (test/xp-ceiling.test.ts holds it above
 * every one).
 *
 * Across chapters, a chapter starts at the most XP its chapter before can end
 * a victory with (cold starts lie under that: their `xpToLevel` floor is a
 * `max`, so it is counted where it runs).
 */
import type { Id } from '../engine/types.js';
import { HUB_REF, type Module, type Scene, type Effect, type Outcome, type Requirement } from './types.js';
import { refsOf, effectsOf } from './graph.js';
import { isNpcFlag } from './npcs.js';
import { traceXp, type XpGraph, type XpPay } from './reach.js';
import { MODULES } from '../data/modules/index.js';
import { LEVEL_XP, levelForXp, xpAward } from '../campaign/campaign.js';

/** The company the app makes (`newCampaign`): four heroes share a fight's XP. */
export const PARTY_SIZE = 4;

export interface XpAt {
  scene: Id;
  /** The most XP a party can hold here (at a fight: on first meeting it). */
  max: number;
  level: number;
  /** XP still to go before the next level. */
  headroom: number;
  /** One way to that much: what paid, in order (`+xp where: what`). */
  path: string[];
}
export interface XpBattle extends XpAt { encounterId: Id }
export interface XpEnding extends XpAt { outcome: string }

export interface XpReport {
  module: Id;
  /** The XP the chapter was started at (the chapter before's victory max). */
  startXp: number;
  battles: XpBattle[];
  endings: XpEnding[];
  /** The most XP a victory ending can be reached with (what the sequel starts at). */
  victoryMax: number;
  /** XP that can be taken again and again: each a finding. */
  farmable: string[];
  states: number;
  skipped?: string;
}

const at = (scene: Id, max: number, path: string[]): XpAt => {
  const level = levelForXp(max);
  return { scene, max, level, headroom: (LEVEL_XP[level] ?? Infinity) - max, path };
};

const cache = new Map<string, XpReport>();

/**
 * The XP ceiling of one chapter: per fight, the most XP a party can meet it
 * with for the first time; per ending, the most it can end with; and any XP
 * that can be farmed. `startXp` defaults to the chapter before's victory max
 * (0 for a first chapter).
 */
export function maxXpReport(
  module: Module, chapters: readonly Module[] = MODULES, opts: { startXp?: number; partySize?: number } = {},
): XpReport {
  const partySize = opts.partySize ?? PARTY_SIZE;
  let startXp = opts.startXp;
  if (startXp === undefined) {
    const prev = chapters.find((m) => m.sequel === module.id && m.id !== module.id);
    startXp = prev ? maxXpReport(prev, chapters, { partySize }).victoryMax : 0;
  }
  const key = chapters === MODULES ? `${partySize}|${startXp}|${JSON.stringify(module)}` : null;
  const hit = key ? cache.get(key) : undefined;
  if (hit) return hit;

  const battleXp = (sc: BattleScene) => (sc.loot === false ? 0 : xpAward(sc.encounterId, partySize));
  const trips = sideTrips(module, battleXp);
  // At a fight's door, the fight has not paid yet: nor has its side trip,
  // when its win pays (a trip pays once, and its payers are not met after).
  const unpaid = (id: Id): string[] => {
    const sc = module.scenes[id];
    if (sc?.kind !== 'battle') return [];
    const trip = trips.get(id);
    return [`battle:${id}`, ...(trip && exitsOf(sc, battleXp).some((x) => x.pays) ? [trip] : [])];
  };
  const battles = new Map<Id, XpBattle>();
  const endings = new Map<Id, XpEnding>();
  const farmable = new Set<string>();
  const reach = traceXp(module, {
    battleXp,
    group: (id) => trips.get(id),
    levelXp: (level) => LEVEL_XP[level - 1] ?? 0,
    onGraph: (g) => {
      const r = analyse(g, startXp!, unpaid);
      r.farmable.forEach((f) => farmable.add(f));
      for (const [scene, x] of r.best) {
        const s = module.scenes[scene]!;
        if (s.kind === 'battle') {
          const was = battles.get(scene);
          if (!was || x.max > was.max) battles.set(scene, { ...at(scene, x.max, x.path), encounterId: s.encounterId });
        } else if (s.kind === 'ending') {
          const was = endings.get(scene);
          if (!was || x.max > was.max) endings.set(scene, { ...at(scene, x.max, x.path), outcome: s.outcome });
        }
      }
    },
  }, chapters);
  const victories = [...endings.values()].filter((e) => e.outcome === 'victory');
  const report: XpReport = {
    module: module.id, startXp,
    battles: [...battles.values()].sort((a, b) => b.max - a.max),
    endings: [...endings.values()].sort((a, b) => b.max - a.max),
    victoryMax: victories.length ? Math.max(...victories.map((e) => e.max)) : startXp,
    farmable: [...farmable],
    states: reach.states,
    ...(reach.skipped ? { skipped: reach.skipped } : {}),
  };
  if (key) { if (cache.size >= 16) cache.clear(); cache.set(key, report); }
  return report;
}

type BattleScene = Extract<Scene, { kind: 'battle' }>;

/** A way out of a scene that can run effects: where it goes (null: it stays),
 *  and whether it pays XP. */
function exitsOf(scene: Scene, battleXp: (s: BattleScene) => number): Array<{ effects: Effect[]; to: Id | null; pays: boolean; floor: boolean }> {
  const out: Array<{ effects: Effect[]; to: Id | null; bonus?: number }> = [];
  const o = (x: Outcome | undefined, bonus = 0) => { if (x) out.push({ effects: x.effects ?? [], to: x.to, bonus }); };
  switch (scene.kind) {
    case 'story': case 'dialogue':
      for (const ch of scene.next) {
        out.push({ effects: ch.effects ?? [], to: ch.to });
        if (ch.check) out.push({ effects: [...(ch.effects ?? []), ...(ch.check.failEffects ?? [])], to: ch.check.failTo });
      }
      break;
    case 'check': o(scene.success); o(scene.failure); break;
    case 'challenge':
      o(scene.success); o(scene.failure);
      for (const a of scene.approaches) {
        o(a.success);
        if (a.failure) out.push({ effects: a.failure.effects ?? [], to: scene.retry === 'perApproach' ? null : a.failure.to });
      }
      break;
    case 'battle':
      o(scene.onWin, battleXp(scene)); o(scene.onLoss);
      if (scene.parley) { o(scene.parley.success); o(scene.parley.failure); }
      break;
    default: break;
  }
  return out.map((x) => ({
    effects: x.effects, to: x.to,
    pays: !!x.bonus || x.effects.some((e) => e.kind === 'xp' && e.amount !== 0),
    floor: x.effects.some((e) => e.kind === 'xpToLevel'),
  }));
}

/**
 * Side trips: a map marker's scenes that pay at most once in a run, though
 * the search sees them as open again and again. The pattern is the optional
 * fight or puzzle behind a marker that turns into an "already done" beat on
 * a flag (`sceneWhen`), the flag set by whatever pays. The search does not
 * track such a flag (the beat is cosmetic: see reach.ts), so on its own it
 * would count the serpent pool won twice — once from each of its two doors —
 * or a skill check that pays as farmable.
 *
 * A marker's scenes (everything its scene leads to short of a map, a dungeon
 * or an ending) are one trip, paying once, when all of this holds:
 *   - the marker's redirect is on plain flags that nothing ever unsets, and no
 *     redirect before it leads into the trip;
 *   - nothing else leads into the trip: no other marker, scene, room,
 *     wandering or camp fight, and not the chapter's start or defeat scene;
 *   - every way out of a trip scene that pays sets every one of those flags;
 *   - after it pays, the trip offers nothing else that pays before the party
 *     is back on a map.
 * Then a run enters the trip only while the flags are not all set, and the
 * first payment sets them and leaves nothing more to take: one payment, at
 * most, per run. Its scenes' payments are keyed as one (`trip:<map>/<marker>`).
 */
export function sideTrips(module: Module, battleXp: (s: BattleScene) => number): Map<Id, string> {
  const scenes = module.scenes;
  const all = [...Object.values(scenes).flatMap(effectsOf), ...(module.dawns ?? []).flatMap((d) => d.effects ?? [])];
  const unstable = new Set(all.flatMap((e) => (
    e.kind === 'clearFlag' || e.kind === 'addFlag' || (e.kind === 'setFlag' && (e.value === false || typeof e.value === 'number')) ? [e.flag]
      : e.kind === 'copyFlag' ? [e.to] : [])));
  const stable = (r: Requirement) => r.kind === 'flag' && (r.value === undefined || r.value === true)
    && !unstable.has(r.flag) && !r.flag.includes(':') && !isNpcFlag(r.flag);
  const stop = (id: Id) => id === HUB_REF || !scenes[id] || ['explore', 'dungeon', 'ending'].includes(scenes[id]!.kind);
  /** Every scene reachable from `from` short of a map or an ending. */
  const closure = (from: Id[], within?: Set<Id>): Set<Id> => {
    const seen = new Set<Id>();
    const todo = from.filter((x) => !stop(x) && (!within || within.has(x)));
    while (todo.length) {
      const id = todo.pop()!;
      if (seen.has(id)) continue;
      seen.add(id);
      for (const r of refsOf(scenes[id]!)) if (!stop(r) && !seen.has(r) && (!within || within.has(r))) todo.push(r);
    }
    return seen;
  };
  const exits = new Map<Id, ReturnType<typeof exitsOf>>();
  const exitsAt = (id: Id) => { let x = exits.get(id); if (!x) exits.set(id, (x = exitsOf(scenes[id]!, battleXp))); return x; };
  const pays = (id: Id) => exitsAt(id).some((x) => x.pays);

  const out = new Map<Id, string>();
  const claimed = new Set<Id>();
  for (const hub of Object.values(scenes)) {
    if (hub.kind !== 'explore') continue;
    for (const node of hub.map.nodes) {
      const ws = node.sceneWhen ?? [];
      if (!ws.some((w) => w.if.length > 0 && w.if.every(stable))) continue;
      // The marker's scene, and any redirect that can lead to pay (an
      // "already done" beat that cannot is no part of it).
      const trip = closure([node.scene, ...ws.map((w) => w.to).filter((t) => [...closure([t])].some(pays))]);
      if (!trip.size) continue;
      // Nothing else leads in. The marker's own wandering fight may: it is
      // rolled once, on the first visit, before the trip can have paid — so
      // long as nothing else leads to that fight.
      const own = node.wandering?.battleScene;
      const ownOnly = !!own && !trip.has(own) && Object.values(scenes).every((sc) => sc.id === own || (sc.kind === 'explore'
        ? sc.map.nodes.every((n) => n === node || (![n.scene, ...(n.sceneWhen ?? []).map((w) => w.to)].includes(own) && n.wandering?.battleScene !== own))
          && sc.map.camp?.risky?.battleScene !== own
        : !refsOf(sc).includes(own)));
      const leaks = Object.values(scenes).some((sc) => {
        if (trip.has(sc.id) || (ownOnly && sc.id === own)) return false;
        if (sc.kind === 'explore') {
          return sc.map.nodes.some((n) => (n !== node && [n.scene, ...(n.sceneWhen ?? []).map((w) => w.to)].some((t) => trip.has(t)))
            || (n.wandering && trip.has(n.wandering.battleScene)))
            || (!!sc.map.camp?.risky && trip.has(sc.map.camp.risky.battleScene));
        }
        return refsOf(sc).some((t) => trip.has(t));
      });
      if (leaks || trip.has(module.start) || (module.defeatScene && trip.has(module.defeatScene))) continue;
      if ([...trip].some((id) => claimed.has(id))) continue;
      // Every way out that pays shuts the trip, at once or on every way on
      // from it before the party is out of it: it sets the flags of a
      // redirect that shuts it (that redirect, and every one before it, leads
      // only to scenes that pay nothing). After it, nothing more pays.
      const payers = new Set([...trip].filter(pays));
      const dry = (from: Id[]) => ![...closure(from, trip)].some((t) => payers.has(t));
      const shuts = ws.flatMap((w, i) => (w.if.length > 0 && w.if.every(stable) && dry(ws.slice(0, i + 1).map((v) => v.to))
        ? [w.if.map((r) => (r as { flag: string }).flag)] : []));
      const closes = (x: { effects: Effect[] }) => {
        const sets = new Set(x.effects.flatMap((e) => (e.kind === 'setFlag' && (e.value === undefined || e.value === true) ? [e.flag] : [])));
        return shuts.some((flags) => flags.every((f) => sets.has(f)));
      };
      /** Can a party get from `id` out of the trip without it shutting? */
      const leavesOpen = (id: Id, seen = new Set<Id>()): boolean => {
        if (!trip.has(id)) return true;
        if (seen.has(id)) return false;
        seen.add(id);
        const sc = scenes[id]!;
        if ((sc.kind === 'story' || sc.kind === 'dialogue' || sc.kind === 'challenge') && !sc.noBack) return true;
        if (sc.kind === 'battle' && ((!sc.noFlee && sc.surprise !== 'party') || (!sc.onLoss && module.defeatScene))) return true;
        const next = sc.kind === 'shop' || sc.kind === 'rest' ? [{ to: sc.next as Id | null, effects: [] as Effect[] }] : exitsAt(id);
        return next.some((x) => x.to !== null && !closes(x) && leavesOpen(x.to, seen));
      };
      const ok = [...trip].every((id) => exitsAt(id).every((x) => {
        if (x.floor) return false;
        if (!x.pays) return true;
        if (x.to === null) return false;
        return (closes(x) || !leavesOpen(x.to)) && dry([x.to]);
      }));
      if (!ok || !payers.size) continue;
      for (const id of trip) { out.set(id, `trip:${hub.id}/${node.id}`); claimed.add(id); }
    }
  }
  return out;
}

const said = (p: XpPay, v: number) => (p.add ? `+${p.add}` : `to ${Math.max(v, p.floor)} (a level's floor)`);

/** One walk: the most XP each battle and ending scene can be met with. */
function analyse(g: XpGraph, startXp: number, unpaid: (scene: Id) => readonly string[]): { best: Map<Id, { max: number; path: string[] }>; farmable: string[] } {
  const N = g.sceneOf.length, E = g.edgeFrom.length;
  // Edges by source.
  const off = new Int32Array(N + 1);
  for (let e = 0; e < E; e++) off[g.edgeFrom[e]! + 1]!++;
  for (let i = 0; i < N; i++) off[i + 1]! += off[i]!;
  const adj = new Int32Array(E);
  { const fill = off.slice(0, N); for (let e = 0; e < E; e++) adj[fill[g.edgeFrom[e]!]!++] = e; }

  // Strongly-connected components (Tarjan, without recursion). Components
  // complete sinks first, so a higher number comes earlier in the DAG.
  const index = new Int32Array(N).fill(-1), low = new Int32Array(N), comp = new Int32Array(N).fill(-1);
  const onStack = new Uint8Array(N), stack = new Int32Array(N), call = new Int32Array(N), next = new Int32Array(N);
  let sp = 0, cp = 0, counter = 0, comps = 0;
  for (let root = 0; root < N; root++) {
    if (index[root] !== -1) continue;
    call[cp++] = root; index[root] = low[root] = counter++; stack[sp++] = root; onStack[root] = 1; next[root] = off[root]!;
    while (cp) {
      const v = call[cp - 1]!;
      if (next[v]! < off[v + 1]!) {
        const w = g.edgeTo[adj[next[v]!++]!]!;
        if (index[w] === -1) { index[w] = low[w] = counter++; stack[sp++] = w; onStack[w] = 1; next[w] = off[w]!; call[cp++] = w; }
        else if (onStack[w] && index[w]! < low[v]!) low[v] = index[w]!;
        continue;
      }
      cp--;
      if (cp && low[v]! < low[call[cp - 1]!]!) low[call[cp - 1]!] = low[v]!;
      if (low[v] === index[v]) {
        let w: number;
        do { w = stack[--sp]!; onStack[w] = 0; comp[w] = comps; } while (w !== v);
        comps++;
      }
    }
  }

  // The components as a DAG: each one's ways out to others (by edge).
  const doff = new Int32Array(comps + 1);
  for (let e = 0; e < E; e++) { const c = comp[g.edgeFrom[e]!]!; if (c !== comp[g.edgeTo[e]!]) doff[c + 1]!++; }
  for (let i = 0; i < comps; i++) doff[i + 1]! += doff[i]!;
  const dag = new Int32Array(doff[comps]!);
  { const fill = doff.slice(0, comps); for (let e = 0; e < E; e++) { const c = comp[g.edgeFrom[e]!]!; if (c !== comp[g.edgeTo[e]!]) dag[fill[c]!++] = e; } }

  // Every once-only payment, by key: where it is paid (inside a component, or
  // on an edge between two), the most it pays, and how. A payment that
  // repeats, inside a component, is farmable.
  interface Key { add: number; label: string; inside: Set<number>; across: number[] }
  const keys = new Map<string, Key>();
  const farm = new Set<string>();
  for (let e = 0; e < E; e++) {
    const pay = g.edgePay[e]!;
    if (!pay) continue;
    const c = comp[g.edgeFrom[e]!]!, within = c === comp[g.edgeTo[e]!];
    for (const p of g.pays[pay]!) {
      if (p.key === null) { if (within && p.add > 0) farm.add(g.edgeLabel.get(e) ?? '?'); continue; }
      let k = keys.get(p.key);
      if (!k) keys.set(p.key, (k = { add: 0, label: '', inside: new Set(), across: [] }));
      if (p.add > k.add || !k.label) { k.add = Math.max(k.add, p.add); k.label = g.edgeLabel.get(e) ?? '?'; }
      if (within) k.inside.add(c); else if (k.across[k.across.length - 1] !== e) k.across.push(e);
    }
  }
  // A key met at most once on any route is counted where it is paid, by the
  // longest path below. One a route can meet again further on (the same
  // fight, won with other facts held) cannot be: the walk does not know it was
  // paid. Such a key is counted, once, at every state some route paying it
  // reaches (`hit`), and the longest path leaves it out.
  const again = new Map<string, { add: number; label: string; hit: Uint8Array }>();
  const seen = new Uint8Array(comps), queue = new Int32Array(comps);
  for (const [name, k] of keys) {
    if (k.inside.size + k.across.length <= 1) continue;
    // Strictly after some payment: past an edge that pays, or out of a component that does.
    seen.fill(0);
    let qn = 0;
    const push = (c: number) => { if (!seen[c]) { seen[c] = 1; queue[qn++] = c; } };
    for (const e of k.across) push(comp[g.edgeTo[e]!]!);
    for (const c of k.inside) for (let i = doff[c]!; i < doff[c + 1]!; i++) push(comp[g.edgeTo[dag[i]!]!]!);
    for (let q = 0; q < qn; q++) { const c = queue[q]!; for (let i = doff[c]!; i < doff[c + 1]!; i++) push(comp[g.edgeTo[dag[i]!]!]!); }
    const twice = k.across.some((e) => seen[comp[g.edgeFrom[e]!]!] || k.inside.has(comp[g.edgeFrom[e]!]!))
      || [...k.inside].some((c) => seen[c]);
    if (!twice) continue;
    const hit = seen.slice();
    for (const c of k.inside) hit[c] = 1;
    again.set(name, { add: Math.max(0, k.add), label: k.label, hit });
  }

  // What each component pays inside it (once per key), and its highest floor.
  const sumIn = new Float64Array(comps), floorIn = new Float64Array(comps);
  const inside = new Map<number, Array<{ key: string; add: number; label: string }>>();
  for (const [name, k] of keys) {
    if (again.has(name)) continue;
    for (const c of k.inside) {
      sumIn[c]! += Math.max(0, k.add);
      if (!inside.has(c)) inside.set(c, []);
      inside.get(c)!.push({ key: name, add: Math.max(0, k.add), label: k.label });
    }
  }
  for (let e = 0; e < E; e++) {
    const pay = g.edgePay[e]!, c = comp[g.edgeFrom[e]!]!;
    if (pay && c === comp[g.edgeTo[e]!]) for (const p of g.pays[pay]!) floorIn[c] = Math.max(floorIn[c]!, p.floor);
  }
  const counted = (p: XpPay) => p.key === null || !again.has(p.key);
  const step = (pay: number, v: number) => { for (const p of g.pays[pay]!) if (counted(p)) v = Math.max(v + p.add, p.floor); return v; };

  // The longest path over the DAG, from the start.
  const valIn = new Float64Array(comps).fill(-Infinity), valOut = new Float64Array(comps).fill(-Infinity);
  const pred = new Int32Array(comps).fill(-1);
  valIn[comp[0]!] = startXp;
  for (let c = comps - 1; c >= 0; c--) {
    if (valIn[c] === -Infinity) continue;
    valOut[c] = Math.max(valIn[c]!, floorIn[c]!) + sumIn[c]!;
    for (let i = doff[c]!; i < doff[c + 1]!; i++) {
      const e = dag[i]!, d = comp[g.edgeTo[e]!]!;
      const v = step(g.edgePay[e]!, valOut[c]!);
      if (v > valIn[d]!) { valIn[d] = v; pred[d] = e; }
    }
  }
  // Untracked mornings: anywhere, once.
  const morningAdd = g.loose.reduce((a, p) => a + Math.max(0, p.add), 0);
  const morningFloor = g.loose.reduce((a, p) => Math.max(a, p.floor), 0);

  /** What paid on the best way into component `c` and through it (less `skip`). */
  const pathTo = (c: number, skip: readonly string[]): string[] => {
    const chain: number[] = [];
    for (let d = c; pred[d]! >= 0; d = comp[g.edgeFrom[pred[d]!]!]!) chain.unshift(pred[d]!);
    const out: string[] = [];
    let v = startXp;
    const through = (d: number) => {
      v = Math.max(v, floorIn[d]!);
      for (const x of inside.get(d) ?? []) if (d !== c || !skip.includes(x.key)) { v += x.add; out.push(`+${x.add} ${x.label} (in a loop)`); }
    };
    for (const e of chain) {
      through(comp[g.edgeFrom[e]!]!);
      for (const p of g.pays[g.edgePay[e]!]!) {
        if (!counted(p)) continue;
        if (p.add || p.floor > v) out.push(`${said(p, v)} ${g.edgeLabel.get(e) ?? '?'}`);
        v = Math.max(v + p.add, p.floor);
      }
    }
    through(c);
    for (const [name, x] of again) if (!skip.includes(name) && x.hit[c] && x.add) out.push(`+${x.add} ${x.label} (somewhere before)`);
    return out;
  };

  const best = new Map<Id, { max: number; c: number; skip: readonly string[] }>();
  const skips = g.ids.map(unpaid);
  for (let n = 0; n < N; n++) {
    const c = comp[n]!;
    if (valIn[c] === -Infinity) continue;
    const scene = g.ids[g.sceneOf[n]!]!;
    // What cannot have paid yet on arriving here (at a fight's door, its own win).
    const skip = skips[g.sceneOf[n]!]!;
    let max = valOut[c]!;
    for (const x of inside.get(c) ?? []) if (skip.includes(x.key)) max -= x.add;
    for (const [name, x] of again) if (!skip.includes(name) && x.hit[c]) max += x.add;
    max = Math.max(max, morningFloor) + morningAdd;
    const was = best.get(scene);
    if (!was || max > was.max) best.set(scene, { max, c, skip });
  }
  const out = new Map<Id, { max: number; path: string[] }>();
  for (const [scene, x] of best) out.set(scene, { max: x.max, path: pathTo(x.c, x.skip) });
  const farmable = [...farm].map((label) => `[${label.split(':')[0]}] XP can be farmed: "${label}" pays every time, and a party can come round to take it again`);
  return { best: out, farmable };
}
