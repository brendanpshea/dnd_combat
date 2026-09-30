/**
 * Dungeons as graphs: where the rooms go, and whether the place works.
 *
 * A `Dungeon` (types.ts) is rooms and links and nothing else. This file is
 * everything that can be worked out from that alone:
 *
 *   layoutDungeon   puts each room on a cell of a coarse grid and routes a
 *                   corridor along the grid for every link, so the map is
 *                   drawn rather than typed in. Deterministic: the same
 *                   dungeon always lays out the same way.
 *   checkDungeon    the proofs a shipped dungeon has to pass. Every room can
 *                   be reached; the goal can be reached with the keys the
 *                   dungeon itself hands out, without relying on a secret
 *                   door being found; no one-way drop or spent key can leave a
 *                   party with no way on and no way out; the torch lasts the
 *                   distance; and the layout is clean.
 *
 * A key here is anything a lock asks for that a room can hand over: a flag set
 * by winning its fight, an item from searching it, a scene it leads to. The
 * checks read those straight off the room's scenes (graph.ts), so a new lock
 * needs no bookkeeping beyond writing it.
 */
import type { Id } from '../engine/types.js';
import type { Dungeon, DungeonLink, DungeonRoom, Module, Requirement, RoomSize } from './types.js';
import { HUB_REF } from './types.js';
import { effectsOf, refsOf } from './graph.js';

// --- The graph ---------------------------------------------------------------

/** A link's identity: stable across saves, unlike its index. */
export const linkKey = (l: Pick<DungeonLink, 'a' | 'b'>): string => `${l.a}~${l.b}`;

/** The links out of `roomId` that can be walked from it, and where they go. */
export function linksFrom(d: Dungeon, roomId: Id): Array<{ link: DungeonLink; to: Id }> {
  const out: Array<{ link: DungeonLink; to: Id }> = [];
  for (const link of d.links) {
    if (link.a === roomId) out.push({ link, to: link.b });
    else if (link.b === roomId && !link.door?.oneWay) out.push({ link, to: link.a });
  }
  return out;
}

/** The link joining two rooms, whichever way it was written. */
export function linkBetween(d: Dungeon, x: Id, y: Id): DungeonLink | undefined {
  return d.links.find((l) => (l.a === x && l.b === y) || (l.a === y && l.b === x));
}

export function roomOf(d: Dungeon, id: Id): DungeonRoom | undefined {
  return d.rooms.find((r) => r.id === id);
}

// --- Layout ------------------------------------------------------------------

type Cell = [number, number];
const ck = (c: Cell) => `${c[0]},${c[1]}`;

export interface DungeonLayout {
  /** Each room's cell, shifted so the smallest column and row are 0. */
  cells: Record<Id, Cell>;
  /** Each link's corridor as the cells it runs through, both rooms included. */
  corridors: Record<string, Cell[]>;
  cols: number;
  rows: number;
  /** What could not be laid out cleanly. Empty for a good layout. */
  faults: string[];
}

const DIRS: Cell[] = [[1, 0], [0, 1], [0, -1], [-1, 0]];

/**
 * The cheapest corridor from `from` to `to` along the grid: one step per cell,
 * one more for every turn, never through a room or another corridor.
 */
function route(from: Cell, to: Cell, blocked: Set<string>, box: { c0: number; c1: number; r0: number; r1: number }): Cell[] | null {
  // Dijkstra over (cell, heading). The grids are a few dozen cells a side.
  const key = (c: Cell, d: number) => `${c[0]},${c[1]},${d}`;
  const best = new Map<string, number>();
  const prev = new Map<string, string | null>();
  const cellOf = new Map<string, Cell>();
  // Costs are small whole numbers, so a bucket per cost is the priority queue.
  const buckets: Array<Array<{ c: Cell; d: number; cost: number; k: string }>> = [];
  const push = (x: { c: Cell; d: number; cost: number; k: string }) => { (buckets[x.cost] ??= []).push(x); };
  const startK = key(from, -1);
  best.set(startK, 0); prev.set(startK, null); cellOf.set(startK, from);
  push({ c: from, d: -1, cost: 0, k: startK });
  const goal = ck(to);
  for (let b = 0; b < buckets.length; b++) {
    const bucket = buckets[b];
    if (!bucket) continue;
    for (let i = 0; i < bucket.length; i++) {
    const cur = bucket[i]!;
    if (cur.cost > (best.get(cur.k) ?? Infinity)) continue;
    if (ck(cur.c) === goal) {
      const path: Cell[] = [];
      let k: string | null = cur.k;
      while (k) { path.unshift(cellOf.get(k)!); k = prev.get(k) ?? null; }
      return path;
    }
    DIRS.forEach(([dx, dy], d) => {
      const n: Cell = [cur.c[0] + dx, cur.c[1] + dy];
      if (n[0] < box.c0 || n[0] > box.c1 || n[1] < box.r0 || n[1] > box.r1) return;
      if (ck(n) !== goal && blocked.has(ck(n))) return;
      const cost = cur.cost + 1 + (cur.d >= 0 && cur.d !== d ? 1 : 0);
      const nk = key(n, d);
      if (cost >= (best.get(nk) ?? Infinity)) return;
      best.set(nk, cost); prev.set(nk, cur.k); cellOf.set(nk, n);
      push({ c: n, d, cost, k: nk });
    });
    }
  }
  return null;
}

const pathCost = (p: Cell[]) => {
  let bends = 0;
  for (let i = 2; i < p.length; i++) {
    const a = p[i - 2]!, b = p[i - 1]!, c = p[i]!;
    if ((b[0] - a[0]) !== (c[0] - b[0]) || (b[1] - a[1]) !== (c[1] - b[1])) bends++;
  }
  return p.length - 1 + 2 * bends;
};

/**
 * Lay a dungeon out on a grid. Pinned rooms go where they are pinned; the rest
 * are placed breadth-first from the entry, each on the free cell nearby that
 * gives the shortest, straightest corridors to the rooms already down. A room
 * sits `length` cells from its neighbour where it can, so a long walk looks it.
 */
export function layoutDungeon(d: Dungeon): DungeonLayout {
  const faults: string[] = [];
  const cells = new Map<Id, Cell>();
  const roomAt = new Map<string, Id>();
  const corridorAt = new Set<string>();
  const corridors: Record<string, Cell[]> = {};

  const adjacency = new Map<Id, DungeonLink[]>();
  for (const r of d.rooms) adjacency.set(r.id, []);
  for (const l of d.links) {
    adjacency.get(l.a)?.push(l);
    adjacency.get(l.b)?.push(l);
  }
  const other = (l: DungeonLink, id: Id) => (l.a === id ? l.b : l.a);

  const bounds = () => {
    let c0 = 0, c1 = 0, r0 = 0, r1 = 0, any = false;
    for (const [c, r] of cells.values()) {
      if (!any) { c0 = c1 = c; r0 = r1 = r; any = true; }
      c0 = Math.min(c0, c); c1 = Math.max(c1, c); r0 = Math.min(r0, r); r1 = Math.max(r1, r);
    }
    return { c0, c1, r0, r1 };
  };

  const place = (id: Id, c: Cell) => { cells.set(id, c); roomAt.set(ck(c), id); };

  /** Route every link from `id` to a room already placed; null if any fails. */
  const routeAll = (id: Id, at: Cell, commit: boolean): { cost: number; failed: DungeonLink[] } => {
    const blocked = new Set<string>([...roomAt.keys(), ...corridorAt]);
    blocked.add(ck(at));
    const b = bounds();
    const box = { c0: Math.min(b.c0, at[0]) - 3, c1: Math.max(b.c1, at[0]) + 3, r0: Math.min(b.r0, at[1]) - 3, r1: Math.max(b.r1, at[1]) + 3 };
    let cost = 0;
    const failed: DungeonLink[] = [];
    const laid: Array<[string, Cell[]]> = [];
    for (const l of adjacency.get(id) ?? []) {
      const o = other(l, id);
      const oc = cells.get(o);
      if (!oc || o === id || corridors[linkKey(l)]) continue;
      const p = route(at, oc, blocked, box);
      if (!p) { failed.push(l); cost += 1000; continue; }
      for (const c of p.slice(1, -1)) blocked.add(ck(c));
      cost += pathCost(p) + Math.abs((p.length - 1) - (l.length ?? 1));
      laid.push([linkKey(l), l.a === id ? p : [...p].reverse()]);
    }
    if (commit) {
      for (const [k, p] of laid) {
        corridors[k] = p;
        for (const c of p.slice(1, -1)) corridorAt.add(ck(c));
      }
    }
    return { cost, failed };
  };

  // 1. The pins, and the corridors between them.
  for (const r of d.rooms) {
    if (!r.at) continue;
    if (roomAt.has(ck(r.at))) faults.push(`rooms '${roomAt.get(ck(r.at))}' and '${r.id}' are pinned to the same cell`);
    else place(r.id, [r.at[0], r.at[1]]);
  }
  for (const r of d.rooms) if (r.at && cells.get(r.id)) routeAll(r.id, cells.get(r.id)!, true);

  // 2. Everyone else, breadth-first from the entry; any room the links never
  //    reach is laid out after, so a broken dungeon still draws.
  const order: Id[] = [];
  const seen = new Set<Id>();
  const bfs = (start: Id) => {
    const q = [start]; seen.add(start);
    while (q.length) {
      const id = q.shift()!;
      order.push(id);
      for (const l of adjacency.get(id) ?? []) {
        const o = other(l, id);
        if (!seen.has(o) && adjacency.has(o)) { seen.add(o); q.push(o); }
      }
    }
  };
  if (adjacency.has(d.entry)) bfs(d.entry);
  for (const r of d.rooms) if (!seen.has(r.id)) bfs(r.id);

  for (const id of order) {
    if (cells.has(id)) continue;
    const placedNbrs = (adjacency.get(id) ?? []).map((l) => ({ l, c: cells.get(other(l, id)) })).filter((x) => x.c) as Array<{ l: DungeonLink; c: Cell }>;
    if (placedNbrs.length === 0) {
      // The first room down, or one the links never reach: the nearest free
      // cell to the right of everything so far.
      let c: Cell = cells.size === 0 ? [0, 0] : [bounds().c1 + 2, 0];
      while (roomAt.has(ck(c)) || corridorAt.has(ck(c))) c = [c[0] + 1, c[1]];
      place(id, c);
      continue;
    }
    // Candidates: free cells within three steps of any placed neighbour.
    const cand = new Map<string, Cell>();
    for (const { c } of placedNbrs) {
      for (let dx = -3; dx <= 3; dx++) {
        for (let dy = -3; dy <= 3; dy++) {
          if (Math.abs(dx) + Math.abs(dy) === 0 || Math.abs(dx) + Math.abs(dy) > 3) continue;
          const n: Cell = [c[0] + dx, c[1] + dy];
          if (!roomAt.has(ck(n)) && !corridorAt.has(ck(n))) cand.set(ck(n), n);
        }
      }
    }
    const guess = (n: Cell) => placedNbrs.reduce((s, { l, c }) => {
      const m = Math.abs(n[0] - c[0]) + Math.abs(n[1] - c[1]);
      // Straight runs beat dog-legs, and a room likes to sit `length` away.
      return s + m + Math.abs(m - (l.length ?? 1)) + (n[0] !== c[0] && n[1] !== c[1] ? 1 : 0);
    }, 0);
    const ranked = [...cand.values()].sort((a, b) => guess(a) - guess(b) || a[1] - b[1] || a[0] - b[0]);
    let best: { c: Cell; cost: number } | null = null;
    for (const c of ranked.slice(0, 12)) {
      const { cost, failed } = routeAll(id, c, false);
      if (failed.length === 0 && (!best || cost < best.cost)) best = { c, cost };
    }
    const at = best?.c ?? ranked[0] ?? [bounds().c1 + 2, 0];
    place(id, at);
    const { failed } = routeAll(id, at, true);
    for (const l of failed) faults.push(`no clear corridor for '${l.a}' — '${l.b}'`);
  }

  // 3. Normalise to a grid starting at 0,0.
  const b = bounds();
  const out: Record<Id, Cell> = {};
  for (const [id, [c, r]] of cells) out[id] = [c - b.c0, r - b.r0];
  const outCorr: Record<string, Cell[]> = {};
  for (const [k, p] of Object.entries(corridors)) outCorr[k] = p.map(([c, r]) => [c - b.c0, r - b.r0] as Cell);
  for (const l of d.links) if (!outCorr[linkKey(l)] && !faults.some((f) => f.includes(`'${l.a}' — '${l.b}'`))) {
    faults.push(`no clear corridor for '${l.a}' — '${l.b}'`);
  }
  return { cells: out, corridors: outCorr, cols: b.c1 - b.c0 + 1, rows: b.r1 - b.r0 + 1, faults };
}

/** How much of a layout cell a room's box fills, by size (for drawing). */
export const ROOM_BOX: Record<RoomSize, { w: number; h: number }> = {
  small: { w: 0.6, h: 0.44 },
  medium: { w: 0.72, h: 0.52 },
  large: { w: 0.84, h: 0.6 },
};

// --- Keys --------------------------------------------------------------------

/**
 * What a room can hand the party, as tokens: `flag:x` for a flag its scenes
 * set, `item:x` for an item they give, `visited:s` for a scene they lead to.
 * Read from the room's fight, event and search, following each scene's
 * routes until they come back to a location. Generous on purpose — a key a
 * failed check would not have given still counts — because the question is
 * whether a lock CAN be opened, and the runtime answers the rest.
 */
export function roomGrants(module: Module, room: DungeonRoom): Set<string> {
  const out = new Set<string>();
  const start = [room.fight, room.event?.scene, room.search].filter((x): x is Id => !!x);
  const seen = new Set<Id>();
  const q = [...start];
  while (q.length) {
    const id = q.shift()!;
    if (id === HUB_REF || seen.has(id)) continue;
    seen.add(id);
    const scene = module.scenes[id];
    if (!scene || scene.kind === 'explore' || scene.kind === 'dungeon') continue;
    out.add(`visited:${id}`);
    for (const e of effectsOf(scene)) {
      if (e.kind === 'setFlag' && e.value !== false) out.add(`flag:${e.flag}`);
      if (e.kind === 'addItem') out.add(`item:${e.itemId}`);
    }
    q.push(...refsOf(scene));
  }
  return out;
}

/** Whether `req` is met by the tokens in hand. Anything a room cannot hand
 *  out (gold, a class, a flag cleared) is not provable, so counts as unmet. */
function metBy(req: Requirement, keys: Set<string>): boolean {
  switch (req.kind) {
    case 'flag': return (req.value === undefined || req.value === true || typeof req.value === 'number') && keys.has(`flag:${req.flag}`);
    case 'item': return keys.has(`item:${req.itemId}`);
    case 'visited': return keys.has(`visited:${req.scene}`);
    default: return false;
  }
}

type Mode = 'open' | 'play' | 'proof';

/**
 * A party's progress through the graph: where it stands and what it holds.
 * `open` walks every door; `play` walks secrets (they may be found) but not
 * locks without their key; `proof` walks neither, for what is guaranteed.
 */
interface Walk { room: Id; keys: Set<string>; cost: number }

type Grants = Map<Id, Set<string>>;
/** Each room's keys — only the tokens some lock here asks for, since those are
 *  all that can change where a party gets to (and every other token would make
 *  the search track which rooms were visited, which grows exponentially). */
function grantsOf(module: Module, d: Dungeon): Grants {
  const wanted = new Set<string>();
  for (const l of d.links) {
    for (const r of l.door?.locked ?? []) {
      if (r.kind === 'flag') wanted.add(`flag:${r.flag}`);
      if (r.kind === 'item') wanted.add(`item:${r.itemId}`);
      if (r.kind === 'visited') wanted.add(`visited:${r.scene}`);
    }
  }
  return new Map(d.rooms.map((r) => [r.id, new Set([...roomGrants(module, r)].filter((t) => wanted.has(t)))]));
}

function explore(grants: Grants, d: Dungeon, from: Walk, mode: Mode): Walk[] {
  const stateKey = (w: Walk) => `${w.room}|${[...w.keys].sort().join(',')}`;
  const best = new Map<string, Walk>();
  const start: Walk = { ...from, keys: new Set([...from.keys, ...(grants.get(from.room) ?? [])]) };
  best.set(stateKey(start), start);
  const frontier: Walk[] = [start];
  while (frontier.length) {
    frontier.sort((a, b) => a.cost - b.cost);
    const w = frontier.shift()!;
    if (w.cost > (best.get(stateKey(w))?.cost ?? Infinity)) continue;
    for (const { link, to } of linksFrom(d, w.room)) {
      const door = link.door;
      if (mode !== 'open') {
        if (door?.secret && mode === 'proof') continue;
        if (door?.locked && !door.locked.every((r) => metBy(r, w.keys))) continue;
      }
      const keys = new Set([...w.keys, ...(grants.get(to) ?? [])]);
      const next: Walk = { room: to, keys, cost: w.cost + (link.length ?? 1) };
      const k = stateKey(next);
      if (next.cost < (best.get(k)?.cost ?? Infinity)) { best.set(k, next); frontier.push(next); }
    }
  }
  return [...best.values()];
}

/** The cheapest guaranteed walk from the entry to `goal`, or undefined. */
export function goalCost(module: Module, d: Dungeon, goal: Id): number | undefined {
  return goalCostWith(grantsOf(module, d), d, goal);
}

function goalCostWith(grants: Grants, d: Dungeon, goal: Id): number | undefined {
  const walks = explore(grants, d, { room: d.entry, keys: new Set(), cost: 0 }, 'proof').filter((w) => w.room === goal);
  return walks.length ? Math.min(...walks.map((w) => w.cost)) : undefined;
}

// --- The checks --------------------------------------------------------------

/** Everything wrong with dungeon scene `id` of `module`. Empty = it works. */
export function checkDungeon(module: Module, id: Id, d: Dungeon): string[] {
  const errors: string[] = [];
  const err = (m: string) => errors.push(`[${id}] ${m}`);
  const rooms = new Map(d.rooms.map((r) => [r.id, r]));
  const sceneKind = (ref: Id) => (ref === HUB_REF ? 'hub' : module.scenes[ref]?.kind);

  // Shape.
  if (rooms.size !== d.rooms.length) err('two rooms share an id');
  if (!rooms.has(d.entry)) { err(`entry '${d.entry}' is not a room`); return errors; }
  const pairs = new Set<string>();
  for (const l of d.links) {
    if (!rooms.has(l.a) || !rooms.has(l.b)) { err(`link '${l.a}' — '${l.b}' names a room that does not exist`); continue; }
    if (l.a === l.b) err(`room '${l.a}' links to itself`);
    const pair = [l.a, l.b].sort().join('~');
    if (pairs.has(pair)) err(`'${l.a}' and '${l.b}' are linked twice`);
    pairs.add(pair);
    if (l.length !== undefined && (!Number.isInteger(l.length) || l.length < 1)) err(`link '${l.a}' — '${l.b}' has length ${l.length}`);
    const door = l.door;
    if (!door) continue;
    if (door.secret && (door.secret.dc < 1 || door.secret.dc > 30)) err(`secret door '${l.a}' — '${l.b}' DC out of range`);
    if (door.force && !door.locked?.length) err(`door '${l.a}' — '${l.b}' can be forced but is not locked`);
    if (door.force && (door.force.dc < 1 || door.force.dc > 30)) err(`door '${l.a}' — '${l.b}' force DC out of range`);
    if (door.ambush) {
      if (door.ambush.chance <= 0 || door.ambush.chance > 1) err(`ambush on '${l.a}' — '${l.b}' has chance ${door.ambush.chance}`);
      if (sceneKind(door.ambush.battle) !== 'battle') err(`ambush on '${l.a}' — '${l.b}' is not a battle scene`);
    }
  }
  for (const r of d.rooms) {
    if (r.fight && sceneKind(r.fight) !== 'battle') err(`room '${r.id}' fight '${r.fight}' is not a battle scene`);
  }
  if (d.torch) {
    if (d.torch.length < 1) err('torch has no length');
  }

  // A way out, or a reason to be here.
  const goals = d.rooms.filter((r) => r.goal).map((r) => r.id);
  const exits = d.rooms.filter((r) => r.exit).map((r) => r.id);
  if (goals.length === 0 && exits.length === 0) err('has neither a goal room nor an exit');

  const grants = grantsOf(module, d);
  // 1. Every room can be reached, with every door open.
  const open = new Set(explore(grants, d, { room: d.entry, keys: new Set(), cost: 0 }, 'open').map((w) => w.room));
  for (const r of d.rooms) if (!open.has(r.id)) err(`room '${r.id}' cannot be reached from the entry`);

  // 2. The goal can be reached with what the dungeon hands out, secrets unfound.
  for (const g of goals) {
    const cost = goalCostWith(grants, d, g);
    if (cost === undefined) {
      err(`goal '${g}' cannot be reached without a secret door or a key the dungeon does not give`);
    } else if (d.torch && cost > d.torch.length) {
      // 3. …and before the light gives out.
      err(`the torch (${d.torch.length}) runs out before the goal '${g}' (${cost} away)`);
    }
  }

  // 4. No trap: from anywhere the party can get to, some way on or out remains.
  const outs = new Set([...goals, ...exits]);
  const played = explore(grants, d, { room: d.entry, keys: new Set(), cost: 0 }, 'play');
  const trapped = new Set<Id>();
  for (const w of played) {
    if (outs.has(w.room) || trapped.has(w.room)) continue;
    const onward = explore(grants, d, { ...w, cost: 0 }, 'play');
    if (!onward.some((x) => outs.has(x.room))) trapped.add(w.room);
  }
  for (const t of trapped) err(`a party in '${t}' can be left with no way on and no way out`);

  // 5. It draws.
  for (const f of layoutDungeon(d).faults) err(`layout: ${f}`);
  return errors;
}
