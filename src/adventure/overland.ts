/**
 * The overland: a county to walk across, with a city near its middle and the
 * towns and villages round it, joined by roads.
 *
 * Laid out the way a county grows. The ground comes first — hills, forest,
 * marsh, a river or a coast — and the city goes where a city would: at a ford
 * near the middle, or on the shore. Towns stand half a day out on the roads,
 * villages a morning's walk from anything. The roads join them the cheap way
 * round, a ford or a bridge where they cross the river, a waystop where a leg
 * runs long.
 *
 * Scale: the default county is 20 miles across and 40 down — a day's walk by
 * two — which a phone, held upright, shows whole. A map unit is 0.2 miles
 * across and 0.4 down.
 *
 * Every town is a whole generated town (city-gen), spliced in the way a
 * written story splices one (Module.towns), so a county is an ordinary
 * module: the runtime, the save and the validator see nothing new.
 */
import type { Id } from '../engine/types.js';
import { Dice } from './dungeon-gen.js';
import { seedRng } from '../engine/rng.js';
import type { EmbeddedTown, ExploreNode, LandGround, Module, Scene } from './types.js';
import { apart, generateCity, type CitySize } from './city-gen.js';
import { wander, toLine, nearestOn } from './town-map.js';
import { placeName, type NameStyle } from './names.js';
import { encodeSpec, decodeSpec } from './delve-spec.js';
import { validateModule } from './validate.js';

type Pt = [number, number];

export type LandKind = 'valley' | 'coast' | 'hills' | 'forest' | 'marsh';
export const LAND_KINDS: LandKind[] = ['valley', 'coast', 'hills', 'forest', 'marsh'];
export type Terrain = 'plain' | 'forest' | 'hills' | 'marsh' | 'mountain' | 'water';

export interface LandSpec {
  /** What kind of country (default: a river valley). */
  kind?: LandKind;
  /** Party level the towns are stocked for (default 2). */
  level?: number;
}

/** 2-mile squares: 10 across, 20 down. */
export const COLS = 10, ROWS = 20;
const CODE: Record<Terrain, string> = { plain: 'p', forest: 'f', hills: 'h', marsh: 'm', mountain: 'M', water: 'w' };
export const TERRAIN_OF: Record<string, Terrain> = Object.fromEntries(Object.entries(CODE).map(([t, c]) => [c, t as Terrain]));

/** Miles between two points on the map. */
export function miles(a: Pt, b: Pt): number {
  return Math.hypot((a[0] - b[0]) * 0.2, (a[1] - b[1]) * 0.4);
}

/** Smooth noise: random values on a coarse lattice, eased between. */
function noise(rng: () => number, gx: number, gy: number): (x: number, y: number) => number {
  const v = Array.from({ length: (gx + 1) * (gy + 1) }, rng);
  const ease = (t: number) => t * t * (3 - 2 * t);
  return (x, y) => {
    const fx = (x / 100) * gx, fy = (y / 100) * gy;
    const i = Math.min(gx - 1, Math.floor(fx)), j = Math.min(gy - 1, Math.floor(fy));
    const tx = ease(fx - i), ty = ease(fy - j);
    const at = (a: number, b: number) => v[b * (gx + 1) + a]!;
    const top = at(i, j) * (1 - tx) + at(i + 1, j) * tx;
    const bot = at(i, j + 1) * (1 - tx) + at(i + 1, j + 1) * tx;
    return top * (1 - ty) + bot * ty;
  };
}

/** The lie of the land: terrain by square, a river, perhaps a sea. */
export interface Ground extends LandGround {
  at: (p: Pt) => Terrain;
}

export function layLand(kind: LandKind, rng: () => number): Ground {
  const e1 = noise(rng, 3, 6), e2 = noise(rng, 7, 13), m1 = noise(rng, 3, 6), m2 = noise(rng, 6, 12);
  const side: 'left' | 'right' = rng() < 0.5 ? 'left' : 'right';
  const sea = kind === 'coast'
    ? { side, points: wander([side === 'left' ? 16 : 84, 0], [side === 'left' ? 16 : 84, 100], rng, 8, 10) }
    : undefined;
  // A river down the county — or, on a coast, from the hills to the sea.
  const river = kind === 'coast'
    ? wander([side === 'left' ? 70 + rng() * 15 : 15 + rng() * 15, 0], [side === 'left' ? 18 : 82, 55 + rng() * 30], rng, 14, 9)
    : wander([35 + rng() * 30, 0], [35 + rng() * 30, 100], rng, 16, 10);

  const cells: string[] = [];
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    const p: Pt = [(c + 0.5) * (100 / COLS), (r + 0.5) * (100 / ROWS)];
    if (sea && (side === 'left' ? p[0] < nearestOn(p, [sea.points]).at[0] : p[0] > nearestOn(p, [sea.points]).at[0])) { cells.push('w'); continue; }
    const dRiver = toLine(p, river);
    let e = e1(...p) * 0.65 + e2(...p) * 0.35;
    let m = m1(...p) * 0.6 + m2(...p) * 0.4;
    // The river runs in the low ground, and wets what is near it.
    e -= 0.3 * Math.max(0, 1 - dRiver / 18);
    m += 0.2 * Math.max(0, 1 - dRiver / 12);
    if (kind === 'valley') e += (Math.abs(p[0] - 50) / 50) * 0.35 - 0.1;
    if (kind === 'coast') e += (side === 'left' ? p[0] : 100 - p[0]) / 100 * 0.4 - 0.15;
    if (kind === 'hills') e += 0.18;
    if (kind === 'forest') m += 0.22;
    if (kind === 'marsh') { e -= 0.12; m += 0.25; }
    const t: Terrain = e > 0.82 ? 'mountain' : e > 0.62 ? 'hills' : m > 0.66 && e < 0.42 ? 'marsh' : m > 0.52 ? 'forest' : 'plain';
    cells.push(CODE[t]);
  }
  const ground: Ground = {
    cols: COLS, rows: ROWS, cells: cells.join(''), river, ...(sea ? { sea } : {}),
    at: ([x, y]) => TERRAIN_OF[ground.cells[Math.min(ROWS - 1, Math.max(0, Math.floor(y / (100 / ROWS)))) * COLS + Math.min(COLS - 1, Math.max(0, Math.floor(x / (100 / COLS))))]!]!,
  };
  return ground;
}

/** Somewhere a place can stand: on land, off the river, clear of the edges. */
function standable(p: Pt, g: Ground): boolean {
  const t = g.at(p);
  if (t === 'water' || t === 'mountain') return false;
  if (miles(p, nearestOn(p, [g.river!]).at) < 0.7) return false;
  if (g.sea && miles(p, nearestOn(p, [g.sea.points]).at) < 0.8) return false;
  return p[0] >= 12 && p[0] <= 88 && p[1] >= 12 && p[1] <= 82;
}

/** What it costs to walk a mile of each ground. */
const COST: Record<Terrain, number> = { plain: 1, forest: 1.4, hills: 1.7, marsh: 2.2, mountain: 8, water: 60 };
function legCost(a: Pt, b: Pt, g: Ground): number {
  let sum = 0;
  for (let i = 0; i < 12; i++) { const t = (i + 0.5) / 12; sum += COST[g.at([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t])]; }
  return miles(a, b) * (sum / 12);
}

/** Where a segment crosses a polyline, if it does. */
function crossing(a: Pt, b: Pt, line: readonly Pt[]): Pt | undefined {
  for (let i = 1; i < line.length; i++) {
    const p = line[i - 1]!, q = line[i]!;
    const d = (b[0] - a[0]) * (q[1] - p[1]) - (b[1] - a[1]) * (q[0] - p[0]);
    if (!d) continue;
    const t = ((p[0] - a[0]) * (q[1] - p[1]) - (p[1] - a[1]) * (q[0] - p[0])) / d;
    const u = ((p[0] - a[0]) * (b[1] - a[1]) - (p[1] - a[1]) * (b[0] - a[0])) / d;
    if (t > 0 && t < 1 && u >= 0 && u <= 1) return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  }
  return undefined;
}
const segmentsCross = (a: Pt, b: Pt, c: Pt, d: Pt) => !!crossing(a, b, [c, d]);

interface Place { id: Id; label: string; kind: CitySize | 'stop' | 'road'; p: Pt; text?: string; icon: string }

/** The stops along a long leg, by the ground it runs through. Short labels. */
const STOPS: Record<Terrain, [string, string, string][]> = {
  plain: [['Crossroads', 'tok-crossing', 'Four ways meet at a gibbet and a milestone, its letters long weathered away.'],
    ['Wayside Inn', 'tok-tavern', 'A low inn with a smoking chimney. The ale is thin and the talk is all of the roads.'],
    ['Standing Stone', 'tok-ruin', 'A single stone taller than a man, leaning, with a ring of flowers left at its foot.']],
  forest: [['Woodcutter\'s Hut', 'tok-house', 'An empty hut, an axe in the block, and the feeling you are being watched.'],
    ['Forest Shrine', 'tok-temple', 'A mossy shrine to a god of the trees, with fresh offerings on it.']],
  hills: [['Old Watchtower', 'tok-lookout', 'A broken tower on the ridge. From the top you can see half the county.'],
    ['Cairn', 'tok-ruin', 'A heap of stones over someone once important. Travellers add a stone as they pass.']],
  marsh: [['Causeway', 'tok-tracks', 'A causeway of old logs across the bog. Things move in the water on either side.'],
    ['Reed Hut', 'tok-house', 'A hut on stilts among the reeds, smelling of eels.']],
  mountain: [['High Pass', 'tok-tracks', 'A cold pass between the peaks, the wind howling through it.']],
  water: [['Ferry', 'tok-crossing', 'A ferryman who wants a copper and asks no questions.']],
};
const CROSSINGS: [string, string][] = [['The Ford', 'The water runs knee-deep and fast over stones worn smooth by carts.'],
  ['Stone Bridge', 'An old stone bridge, its parapet carved with the names of lovers.'],
  ['Ferry', 'A rope ferry, and a ferryman who wants a copper and asks no questions.'],
  ['Mill Ford', 'A ford by a mill, its wheel turning slow in the current.']];

const STYLES: NameStyle[] = ['saxon', 'hearth', 'isles', 'gaelic', 'germanic', 'slavic', 'norse'];

class Reroll extends Error {}

export function draftLand(seed: number, spec: Required<LandSpec>): Module {
  const dice = new Dice(seedRng(seed));
  const rng = () => dice.float();
  const g = layLand(spec.kind, rng);
  const style = dice.pick(STYLES);
  const names = new Set<string>();
  const nameOf = () => {
    for (let i = 0; i < 20; i++) { const n = placeName(style, rng, 11, names); if (/^[A-Z][A-Za-z' -]{1,12}$/.test(n)) return n; }
    throw new Reroll('no name');
  };
  const county = nameOf();
  const places: Place[] = [];
  const free = (p: Pt) => places.every((q) => apart({ x: q.p[0], y: q.p[1] }, { x: p[0], y: p[1] }));
  const best = (score: (p: Pt) => number): Pt | undefined => {
    let out: Pt | undefined, low = Infinity;
    for (let x = 12; x <= 88; x += 2) for (let y = 12; y <= 82; y += 2) {
      const p: Pt = [x, y];
      if (!standable(p, g) || !free(p)) continue;
      const s = score(p);
      if (s < low) { low = s; out = p; }
    }
    return out;
  };
  const toWater = (p: Pt) => Math.min(miles(p, nearestOn(p, [g.river!]).at), g.sea ? miles(p, nearestOn(p, [g.sea.points]).at) : Infinity);
  const flat = (p: Pt) => ({ plain: 0, forest: 0.6, hills: 0.4, marsh: 1.5, mountain: 9, water: 9 })[g.at(p)];

  // The city: near the middle, on the water — a ford, or the shore.
  const cityAt = best((p) => miles(p, [50, 50]) * 0.5 + Math.abs(toWater(p) - 1) * 2 + flat(p) + rng() * 0.5);
  if (!cityAt) throw new Reroll('no city');
  const add = (kind: Place['kind'], p: Pt) => {
    const label = nameOf();
    places.push({ id: `${kind}-${label.toLowerCase().replace(/[^a-z]+/g, '-')}`, label, kind, p, icon: kind === 'city' ? 'tok-gate' : kind === 'town' ? 'tok-market' : 'tok-house' });
  };
  add('city', cityAt);
  // Towns half a day out, spread round the city, near water where they can.
  for (let i = 0; i < 2; i++) {
    const at = best((p) => {
      const d = miles(p, cityAt);
      if (d < 7 || d > 14) return Infinity;
      const others = places.filter((q) => q.kind === 'town');
      if (others.some((q) => miles(p, q.p) < 8)) return Infinity;
      const spread = others.reduce((s, q) => s + Math.max(0, 1 - miles(p, q.p) / 16), 0);
      return Math.abs(d - 10) * 0.3 + Math.min(toWater(p), 4) * 0.3 + flat(p) + spread * 2 + rng();
    });
    if (at) add('town', at);
  }
  // Villages a morning's walk from anything.
  for (let i = 0; i < 6; i++) {
    const at = best((p) => {
      const d = Math.min(...places.map((q) => miles(p, q.p)));
      if (d < 3.5 || d > 7.5) return Infinity;
      return flat(p) + Math.min(toWater(p), 4) * 0.2 + rng() * 1.5;
    });
    if (at) add('village', at);
  }
  if (places.length < 7) throw new Reroll('too few places');

  // Roads: the cheapest way to join them all, then a few more where a
  // straight road is cheap and crosses no other.
  const towns = [...places];
  const edges: [number, number][] = [];
  const joined = new Set([0]);
  while (joined.size < towns.length) {
    let pick: [number, number] | undefined, low = Infinity;
    for (const i of joined) for (let j = 0; j < towns.length; j++) {
      if (joined.has(j)) continue;
      const c = legCost(towns[i]!.p, towns[j]!.p, g);
      if (c < low) { low = c; pick = [i, j]; }
    }
    edges.push(pick!); joined.add(pick![1]);
  }
  const pairs: [number, number, number][] = [];
  for (let i = 0; i < towns.length; i++) for (let j = i + 1; j < towns.length; j++) {
    const m = miles(towns[i]!.p, towns[j]!.p);
    if (m < 11 && legCost(towns[i]!.p, towns[j]!.p, g) < m * 1.5) pairs.push([i, j, m]);
  }
  pairs.sort((a, b) => a[2] - b[2]);
  let extra = 0;
  for (const [i, j] of pairs) {
    if (extra >= 3) break;
    if (edges.some(([a, b]) => (a === i && b === j) || (a === j && b === i))) continue;
    if (edges.some(([a, b]) => a !== i && a !== j && b !== i && b !== j && segmentsCross(towns[i]!.p, towns[j]!.p, towns[a]!.p, towns[b]!.p))) continue;
    edges.push([i, j]); extra++;
  }

  // Stops on the way: a crossing where a road meets the river, a waystop
  // where a leg runs long.
  const paths: [Id, Id][] = [];
  const used = new Set<string>();
  const stop = (p: Pt, label: string, icon: string, text: string): Place | undefined => {
    if (!standable(p, g) && !label.match(/Ford|Bridge|Ferry/)) return undefined;
    if (!free(p) || used.has(label)) return undefined;
    used.add(label);
    const pl: Place = { id: `stop-${label.toLowerCase().replace(/[^a-z]+/g, '-')}`, label, kind: 'stop', p, icon, text };
    places.push(pl);
    return pl;
  };
  for (const [i, j] of edges) {
    const a = towns[i]!, b = towns[j]!;
    const cross = crossing(a.p, b.p, g.river!);
    let mid: Place | undefined;
    if (cross) {
      for (const [label, text] of dice.shuffle([...CROSSINGS])) { mid = stop([Math.round(cross[0]), Math.round(cross[1])], label, label === 'Stone Bridge' ? 'tok-bridge' : 'tok-crossing', text); if (mid) break; }
    } else if (miles(a.p, b.p) > 7) {
      for (const t of [0.5, 0.4, 0.6]) {
        const p: Pt = [Math.round(a.p[0] + (b.p[0] - a.p[0]) * t), Math.round(a.p[1] + (b.p[1] - a.p[1]) * t)];
        for (const [label, icon, text] of dice.shuffle([...STOPS[g.at(p)]])) { mid = stop(p, label, icon, text); if (mid) break; }
        if (mid) break;
      }
    }
    if (mid) paths.push([a.id, mid.id], [mid.id, b.id]);
    else paths.push([a.id, b.id]);
  }

  // The road in, from the edge nearest the south, to the nearest place.
  const south = towns.reduce((s, t) => (t.p[1] > s.p[1] ? t : s));
  let roadIn: Pt | undefined;
  // Below every place's own room: the map's foot is the county's edge.
  for (const y of [88, 86, 84]) for (const dx of [0, -4, 4, -8, 8, -12, 12, -16, 16, -20, 20]) {
    const p: Pt = [Math.max(12, Math.min(88, south.p[0] + dx)), y];
    if (!roadIn && free(p) && g.at(p) !== 'water') roadIn = p;
  }
  if (!roadIn) throw new Reroll('no road in');
  places.push({ id: 'road-in', label: 'The South Road', kind: 'road', p: roadIn, icon: 'tok-tracks' });
  paths.push(['road-in', south.id]);

  const scenes: Record<Id, Scene> = {};
  const embedded: Record<Id, EmbeddedTown> = {};
  const nodes: ExploreNode[] = places.map((pl) => ({ id: pl.id, label: pl.label, icon: pl.icon, scene: pl.id, x: pl.p[0], y: pl.p[1] }));
  for (const pl of places) {
    if (pl.kind === 'city' || pl.kind === 'town' || pl.kind === 'village') {
      embedded[pl.id] = { spec: { size: pl.kind, level: spec.level, name: pl.label, style }, onLeave: { to: 'land' } };
    } else if (pl.kind === 'stop') {
      scenes[pl.id] = { id: pl.id, kind: 'story', noBack: true, text: [pl.text!], next: [{ id: 'on', label: 'Walk on', to: 'land' }] };
    }
  }
  const city = places.find((p) => p.kind === 'city')!;
  const sights = [g.sea ? 'the sea' : 'a river', ...new Set([...g.cells].map((c) => ({ f: 'forest', h: 'hills', m: 'marsh', M: 'mountains' } as Record<string, string>)[c]).filter(Boolean))];
  Object.assign(scenes, {
    start: { id: 'start', kind: 'story', text: [`The road crests a rise, and ${county} lies below you: ${sights.slice(0, -1).join(', ')}${sights.length > 1 ? ' and ' : ''}${sights.at(-1)}, and the smoke of ${city.label} in the middle of it.`],
      next: [{ id: 'on', label: `Go down into ${county}`, to: 'land', effects: [{ kind: 'xpToLevel', level: spec.level }] }] },
    land: { id: 'land', kind: 'explore', map: {
      title: county, theme: 'forest', art: { emoji: '🗺️' }, nodes, paths, entry: ['road-in'], camp: {},
      land: { cols: g.cols, rows: g.rows, cells: g.cells, river: g.river!, ...(g.sea ? { sea: g.sea } : {}) },
    } },
    'road-in': { id: 'road-in', kind: 'story', noBack: true, text: ['The road runs on south, out of the county.'],
      next: [{ id: 'leave', label: `Leave ${county}`, to: 'left' }, { id: 'stay', label: 'Turn back', to: 'land' }] },
    left: { id: 'left', kind: 'ending', outcome: 'victory', text: [`${county} falls away behind you.`] },
  } satisfies Record<Id, Scene>);
  return {
    id: `land-${seed}`, title: county, blurb: `A generated county (level ${spec.level}).`,
    start: 'start', scenes, towns: embedded, levelBand: { from: spec.level, to: spec.level },
  };
}

export function checkLandSpec(spec: LandSpec): Required<LandSpec> {
  const kind = spec.kind ?? 'valley';
  const level = spec.level ?? 2;
  if (!LAND_KINDS.includes(kind)) throw new Error(`Bad county spec: no land kind '${kind}'`);
  if (!Number.isInteger(level) || level < 1 || level > 5) throw new Error(`Bad county spec: level ${level}`);
  return { kind, level };
}

/** Every built county's id: `land-<seed>-<spec>`, so a saved run rebuilds it. */
export function landId(seed: number, spec: LandSpec): string {
  return `land-${seed}-${encodeSpec(spec)}`;
}

export function landFromId(id: string): Module | undefined {
  const m = /^land-(\d+)-([A-Za-z0-9_-]+)$/.exec(id);
  if (!m) return undefined;
  try { return generateLand(Number(m[1]), decodeSpec(m[2]!) as LandSpec).module; } catch { return undefined; }
}

/**
 * The proofs, in parts. Proved whole, a county is nine towns' worth of
 * flags at once, and the reachability search gives up past three million
 * states. But a town touches the county at two points only — its door and
 * its road out — so: the county with each town a stub that goes back out,
 * and each town on its own, as the town generator proves every town.
 */
export function proveLand(module: Module): string[] {
  const stubs: Record<Id, Scene> = Object.fromEntries(Object.entries(module.towns ?? {}).map(([at, t]) =>
    [at, { id: at, kind: 'story', noBack: true, text: ['A town.'], next: [{ id: 'out', label: 'Leave', to: t.onLeave.to }] } satisfies Scene]));
  const { towns: _, ...rest } = module;
  const errors = validateModule({ ...rest, scenes: { ...module.scenes, ...stubs } });
  for (const [at, t] of Object.entries(module.towns ?? {})) {
    try { generateCity(1, t.spec); } catch (e) { errors.push(`${at}: ${(e as Error).message}`); }
  }
  return errors;
}

/** A playable, proven county. Deterministic in seed and spec. */
export function generateLand(seed: number, spec: LandSpec = {}): { module: Module; rerolls: number } {
  const full = checkLandSpec(spec);
  let last: string[] = [];
  for (let attempt = 0; attempt < 30; attempt++) {
    let module: Module;
    try { module = draftLand(seed * 37 + attempt + LAND_KINDS.indexOf(full.kind) * 7919, full); } catch (e) {
      if (!(e instanceof Reroll)) throw e;
      last = [e.message]; continue;
    }
    last = proveLand(module);
    if (last.length === 0) return { module: { ...module, id: landId(seed, spec) }, rerolls: attempt };
  }
  throw new Error(`No valid county for seed ${seed}: ${last.join('; ')}`);
}
