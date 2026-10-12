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
import type { EmbeddedDelve, EmbeddedTown, Effect, Requirement, ExploreNode, LandGround, Module, Scene } from './types.js';
import { apart, checkCitySpec, generateCity, type CitySize, type CitySpec } from './city-gen.js';
import { checkSpec, generateSpecDelve, type DelveSpec, type SpecTheme } from './delve-spec.js';
import { wander, toLine, nearestOn } from './town-map.js';
import { placeName, type NameStyle } from './names.js';
import { encodeSpec, decodeSpec, shareFor } from './delve-spec.js';
import { generateEncounter } from '../arena/encounter.js';
import { evenBudgetFor, memberCapFor, maxCountFor } from '../arena/run.js';
import { generatedEncounterId } from '../data/encounters.js';
import { FACTIONS } from '../data/factions.js';
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
  /** Places the story needs, with where they must be. */
  places?: LandPlace[];
  /** Delves the county rolls for itself, beyond any the author names (default 2). */
  delves?: number;
  /** Camps it rolls for itself — bandits, goblins, gnolls; some hostile (default 3). */
  camps?: number;
}

export type LandPlaceKind = 'city' | 'town' | 'village' | 'delve' | 'place' | 'camp';

/**
 * A place an author needs on the map. The map is built round these: the
 * generator finds ground that fits them, and refuses (saying why) when it
 * cannot, rather than quietly bending the story to the dice.
 */
export interface LandPlace {
  /** Its scene id: what the author's story links to, and constraints name. */
  id: Id;
  label: string;
  kind: LandPlaceKind;
  /** The ground it must stand on. */
  terrain?: 'plain' | 'forest' | 'hills' | 'marsh';
  /** At least this many miles from the city. */
  far?: number;
  /** Reached only through this place (an id, or 'city'): every road to it
   *  runs through there, and it lies beyond, on the far side from the city. */
  via?: Id;
  /** Closed until the party has been to this place — or, a delve, won it. */
  after?: Id;
  /** What a closed place says ("The bridge is down."). */
  note?: string;
  /** A town's or a city's own spec: people, places, rumours. */
  town?: Omit<CitySpec, 'size' | 'level' | 'name' | 'style'>;
  /** A delve's own spec (default: one for its ground, at the county's level). */
  delve?: DelveSpec;
  /** A place's text. */
  text?: string[];
  /** A camp's people (a faction id: bandits, goblins, kobolds, gnolls, lizardfolk). */
  faction?: Id;
  /** Whether a camp fights on sight (default: rolled, by who they are). */
  hostile?: boolean;
}

/**
 * Who camps out in the wild, where, and how they take to strangers. Not
 * every camp is a fight: half the point is that you cannot tell from the
 * road which ones are.
 */
const CAMPS: Record<string, { label: string; ground: Terrain[]; hostile: number; angry: string; calm: string; talk: string }> = {
  bandits: { label: 'Bandit Camp', ground: ['plain', 'forest'], hostile: 0.5,
    angry: 'A lookout whistles. Hard faces turn your way, and the blades come out.',
    calm: 'Outlaws — but not today\'s kind of trouble. They make room at the fire, for a coin.',
    talk: 'They tell you which roads the lord\'s men watch, and which they don\'t, and laugh at their own jokes.' },
  goblins: { label: 'Goblin Camp', ground: ['forest', 'hills'], hostile: 0.6,
    angry: 'Goblins boil out of the brush, shrieking, before you are halfway to the fire.',
    calm: 'The goblins here are fat on someone\'s sheep, and too full to fight. They eye you and grin.',
    talk: 'Between belches, the goblins boast of a hole in the hills full of shiny things, and who guards it.' },
  kobolds: { label: 'Kobold Warren', ground: ['hills'], hostile: 0.4,
    angry: 'A trip-line twangs underfoot. Little shapes with spears pour out of the burrows.',
    calm: 'Kobolds peer from their burrows, chattering. One brave one comes out to trade.',
    talk: 'The kobolds know every tunnel under these hills, and sell you a little of what they know.' },
  gnolls: { label: 'Gnoll Camp', ground: ['plain', 'hills'], hostile: 0.85,
    angry: 'Laughter, high and wrong, from every side at once. The gnolls have smelt you.',
    calm: 'The gnolls are gorged and sleepy. Their leader watches you go, and does not move.',
    talk: 'The gnoll leader growls something about the city, and the soft people in it.' },
  lizardfolk: { label: 'Lizardfolk Camp', ground: ['marsh'], hostile: 0.3,
    angry: 'The reeds part, and the lizardfolk come at you without a sound.',
    calm: 'Lizardfolk on a mudbank, gutting fish. They watch you with flat eyes, and let you be.',
    talk: 'Through signs and grunts, the lizardfolk warn you off the deep water to the south.' },
};
export const CAMP_FACTIONS = Object.keys(CAMPS);

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
/** Every place a segment crosses a polyline. */
function crossings(a: Pt, b: Pt, line: readonly Pt[]): Pt[] {
  const out: Pt[] = [];
  for (let i = 1; i < line.length; i++) { const x = crossing(a, b, [line[i - 1]!, line[i]!]); if (x) out.push(x); }
  return out;
}
const segmentsCross = (a: Pt, b: Pt, c: Pt, d: Pt) => !!crossing(a, b, [c, d]);

interface Place { id: Id; label: string; kind: CitySize | 'stop' | 'road' | 'delve' | 'place' | 'camp'; faction?: Id; p: Pt; text?: string; icon: string; from?: LandPlace }

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
const CROSSINGS: [string, string][] = [['Ford', 'The water runs knee-deep and fast over stones worn smooth by carts.'],
  ['Bridge', 'An old stone bridge, its parapet carved with the names of lovers.'],
  ['Ferry', 'A rope ferry, and a ferryman who wants a copper and asks no questions.']];

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
      if (!standable(p, g) || !free(p) || !keepsBehind(p)) continue;
      const s = score(p);
      if (s < low) { low = s; out = p; }
    }
    return out;
  };
  // A place beyond another stays nearer it than anything later put down.
  const keepsBehind = (p: Pt) => places.every((q) => {
    if (!q.from?.via) return true;
    const gate = q.from.via === 'city' ? places.find((x) => x.kind === 'city') : places.find((x) => x.id === q.from!.via);
    return !gate || miles(p, q.p) > miles(q.p, gate.p);
  });
  const toWater = (p: Pt) => Math.min(miles(p, nearestOn(p, [g.river!]).at), g.sea ? miles(p, nearestOn(p, [g.sea.points]).at) : Infinity);
  const flat = (p: Pt) => ({ plain: 0, forest: 0.6, hills: 0.4, marsh: 1.5, mountain: 9, water: 9 })[g.at(p)];

  const authored = spec.places;
  for (const pl of authored) names.add(pl.label);
  const slug = (l: string) => l.toLowerCase().replace(/[^a-z]+/g, '-').replace(/^-|-$/g, '');
  const ICON: Record<string, string> = { city: 'tok-gate', town: 'tok-market', village: 'tok-house', delve: 'tok-cave', place: 'tok-mystery', camp: 'tok-camp' };
  /** What an author's wishes cost a spot: the wrong ground, too near the city. */
  const wish = (p: Pt, pl?: LandPlace, city?: Pt) =>
    (pl?.terrain && g.at(p) !== pl.terrain ? 4 : 0) + (pl?.far && city && miles(p, city) < pl.far ? Infinity : 0);
  const put = (kind: Place['kind'], p: Pt, pl?: LandPlace) => {
    const label = pl?.label ?? (kind === 'delve' ? delveName(g.at(p)) : nameOf());
    const place: Place = { id: pl?.id ?? `${kind}-${slug(label)}`, label, kind, p, icon: ICON[kind]!, ...(pl ? { from: pl } : {}) };
    places.push(place);
    return place;
  };
  const delveName = (t: Terrain) => `${nameOf()} ${({ forest: 'Hollow', hills: 'Barrow', marsh: 'Mere', plain: 'Crypt', mountain: 'Mine', water: 'Wreck' } as const)[t]}`;
  const must = (p: Pt | undefined, what: string): Pt => { if (!p) throw new Reroll(`no room for ${what}`); return p; };

  // The city: near the middle, on the water — a ford, or the shore.
  const cityPl = authored.find((pl) => pl.kind === 'city');
  const cityAt = must(best((p) => miles(p, [50, 50]) * 0.5 + Math.abs(toWater(p) - 1) * 2 + flat(p) + wish(p, cityPl) + rng() * 0.5), 'the city');
  const city = put('city', cityAt, cityPl);
  const byId = (id: Id) => (id === 'city' ? city : places.find((q) => q.id === id));
  const free_ = authored.filter((pl) => pl.kind !== 'city' && !pl.via);

  // Towns half a day out, spread round the city, near water where they can.
  const townAt = (pl?: LandPlace) => best((p) => {
    const d = miles(p, cityAt);
    if (d < 7 || d > 14) return Infinity;
    const others = places.filter((q) => q.kind === 'town');
    if (others.some((q) => miles(p, q.p) < 8)) return Infinity;
    const spread = others.reduce((s, q) => s + Math.max(0, 1 - miles(p, q.p) / 16), 0);
    return Math.abs(d - 10) * 0.3 + Math.min(toWater(p), 4) * 0.3 + flat(p) + spread * 2 + wish(p, pl, cityAt) + rng();
  });
  for (const pl of free_.filter((x) => x.kind === 'town')) put('town', must(townAt(pl), pl.label), pl);
  while (places.filter((q) => q.kind === 'town').length < 2) { const at = townAt(); if (!at) break; put('town', at); }
  // Places only reached through another: near it, and beyond it — farther
  // from the city than it, and nearer it than anything else.
  const behind = authored.filter((pl) => pl.kind !== 'city' && pl.via);
  const placeBehind = () => { for (let left = behind.length; left > 0;) {
    const ready = behind.filter((pl) => !byId(pl.id) && byId(pl.via!));
    if (!ready.length) break;
    for (const pl of ready) {
      const gate = byId(pl.via!)!;
      const at = best((p) => {
        const d = miles(p, gate.p);
        if (d < 3 || d > 7.5) return Infinity;
        if (places.some((q) => q !== gate && miles(p, q.p) <= d)) return Infinity;
        if (gate !== city && miles(p, cityAt) <= miles(gate.p, cityAt)) return Infinity;
        return d * 0.2 + (pl.kind === 'delve' || pl.kind === 'place' ? 0 : flat(p)) + wish(p, pl, cityAt) + rng();
      });
      if (!at) { left = 0; break; }
      put(pl.kind === 'city' ? 'town' : pl.kind, at, pl);
      left--;
    }
  } };

  placeBehind();
  // Villages a morning's walk from anything.
  const villageAt = (pl?: LandPlace) => best((p) => {
    const d = Math.min(...places.map((q) => miles(p, q.p)));
    if (d < 3.5 || d > 7.5) return Infinity;
    return flat(p) + Math.min(toWater(p), 4) * 0.2 + wish(p, pl, cityAt) + rng() * 1.5;
  });
  for (const pl of free_.filter((x) => x.kind === 'village')) put('village', must(villageAt(pl), pl.label), pl);
  while (places.filter((q) => q.kind === 'village').length < 3) { const at = villageAt(); if (!at) break; put('village', at); }
  if (places.length < 5) throw new Reroll('too few places');
  placeBehind();
  // Delves and the author's places: out in the wild, off the roads.
  const wildAt = (pl?: LandPlace) => best((p) => {
    const d = Math.min(...places.map((q) => miles(p, q.p)));
    if (d < 3 || miles(p, cityAt) < 6) return Infinity;
    return (g.at(p) === 'plain' ? 1 : 0) + Math.max(0, d - 6) + wish(p, pl, cityAt) + rng() * 1.5;
  });
  for (const pl of free_.filter((x) => x.kind === 'delve' || x.kind === 'place' || x.kind === 'camp')) {
    const q = put(pl.kind, must(wildAt(pl), pl.label), pl);
    if (pl.kind === 'camp') q.faction = pl.faction ?? 'bandits';
  }
  // Camps: who lives rough on this ground, one band of each.
  for (let i = 0; i < spec.camps; i++) {
    const at = wildAt();
    if (!at) break;
    const taken = new Set(places.map((q) => q.faction));
    const who = dice.shuffle(CAMP_FACTIONS.filter((f) => CAMPS[f]!.ground.includes(g.at(at)) && !taken.has(f)))[0];
    if (!who) continue;
    const q = put('camp', at, { id: `camp-${who}`, label: CAMPS[who]!.label, kind: 'camp' });
    delete q.from;
    q.faction = who;
  }
  placeBehind();
  for (let i = 0; i < spec.delves; i++) { const at = wildAt(); if (at) put('delve', at); }
  const lost = behind.find((pl) => !byId(pl.id));
  if (lost) throw new Reroll(`no room for ${lost.label} beyond ${byId(lost.via!)?.label ?? lost.via}`);
  // Roads: the cheapest way to join the settlements, then a few more where
  // a straight road is cheap and crosses no other. Places reached through
  // one place hang off it alone; the rest of the wild, off the nearest.
  const towns = places.filter((q) => (q.kind === 'city' || q.kind === 'town' || q.kind === 'village') && !q.from?.via);
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
  const legs: [Place, Place][] = edges.map(([i, j]) => [towns[i]!, towns[j]!]);
  for (const q of places) {
    if (towns.includes(q)) continue;
    if (q.from?.via) { legs.push([byId(q.from.via)!, q]); continue; }
    const near = towns.reduce((a, b) => (legCost(q.p, b.p, g) < legCost(q.p, a.p, g) ? b : a));
    legs.push([near, q]);
  }

  // Stops on the way: a crossing where a road meets the river, a waystop
  // where a leg runs long.
  const paths: [Id, Id][] = [];
  const used = new Set<string>();
  const stop = (p: Pt, label: string, icon: string, text: string): Place | undefined => {
    if (!standable(p, g) && !/ (Ford|Bridge|Ferry)$/.test(label)) return undefined;
    // A crossing may stand closer in than a place: its label is short, and
    // it has to be where the river is.
    if (!free(p) || used.has(label)) return undefined;
    used.add(label);
    const pl: Place = { id: `stop-${label.toLowerCase().replace(/[^a-z]+/g, '-')}`, label, kind: 'stop', p, icon, text };
    places.push(pl);
    return pl;
  };
  /** Points on the river nearest a crossing first, out to a mile or so. */
  const alongRiver = (c: Pt): Pt[] => {
    const out: Pt[] = [];
    const r = g.river!;
    for (let i = 1; i < r.length; i++) for (let t = 0; t < 1; t += 0.1) {
      const a = r[i - 1]!, b = r[i]!;
      out.push([Math.round(a[0] + (b[0] - a[0]) * t), Math.round(a[1] + (b[1] - a[1]) * t)]);
    }
    return out.filter((p) => miles(p, c) < 2.5).sort((p, q) => miles(p, c) - miles(q, c));
  };
  const bridges: Pt[] = [];
  for (const [a, b] of legs) {
    // A town on the river is its own crossing: its bridge is its street.
    const far = crossings(a.p, b.p, g.river!).filter((x) => miles(x, a.p) > 1.5 && miles(x, b.p) > 1.5);
    // Where a meander crosses one road twice, both are bridges, no stop.
    if (far.length > 1) bridges.push(...far.map((x): Pt => [Math.round(x[0] * 10) / 10, Math.round(x[1] * 10) / 10]));
    const cross = far.length === 1 ? far[0] : undefined;
    let mid: Place | undefined;
    if (cross) {
      // Named for the nearer place ("Weisen Bridge"), and wherever along
      // the river near the crossing there is room for it.
      const near = miles(cross, a.p) < miles(cross, b.p) ? a : b;
      const [kind, text] = dice.pick(CROSSINGS);
      const label = `${near.label.length <= 12 ? near.label : near.label.split(' ')[0]!.slice(0, 12)} ${kind}`;
      for (const p of alongRiver(cross)) { mid = stop(p, label, kind === 'Bridge' ? 'tok-bridge' : 'tok-crossing', text); if (mid) break; }
      // No room for a stop: the road just has its bridge, drawn on the map.
      if (!mid) bridges.push([Math.round(cross[0] * 10) / 10, Math.round(cross[1] * 10) / 10]);
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

  // A place reached only through another wants a reason on the ground: a
  // ridge round it, open only on the side its gate is.
  for (const q of places) {
    if (!q.from?.via) continue;
    const gate = byId(q.from.via)!;
    const toward = Math.atan2((gate.p[1] - q.p[1]) * 0.4, (gate.p[0] - q.p[0]) * 0.2);
    const cells = [...g.cells];
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      const p: Pt = [(c + 0.5) * (100 / COLS), (r + 0.5) * (100 / ROWS)];
      const d = miles(p, q.p);
      if (d < 1.5 || d > 3.6 || cells[r * COLS + c] === 'w') continue;
      const off = Math.abs(((Math.atan2((p[1] - q.p[1]) * 0.4, (p[0] - q.p[0]) * 0.2) - toward + 3 * Math.PI) % (2 * Math.PI)) - Math.PI);
      if (off < 1.1) continue;
      // Not over anywhere else, nor across the river.
      if (places.some((x) => x !== q && miles(p, x.p) < 1.5) || toLine(p, g.river!) < 5) continue;
      cells[r * COLS + c] = 'M';
    }
    g.cells = cells.join('');
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
  for (const x of crossings(roadIn, south.p, g.river!)) if (miles(x, south.p) > 1.5) bridges.push([Math.round(x[0] * 10) / 10, Math.round(x[1] * 10) / 10]);

  const scenes: Record<Id, Scene> = {};
  const embedded: Record<Id, EmbeddedTown> = {};
  const delves: Record<Id, EmbeddedDelve> = {};
  const won = (id: Id) => `won-${id}`;
  const THEME: Record<Terrain, SpecTheme> = { forest: 'forest', marsh: 'bog', hills: 'stone', mountain: 'stone', plain: 'graveyard', water: 'bog' };
  const nodes: ExploreNode[] = places.map((pl) => {
    const node: ExploreNode = { id: pl.id, label: pl.label, icon: pl.icon, scene: pl.id, x: pl.p[0], y: pl.p[1] };
    // Closed until the party has been there — or won there.
    const after = pl.from?.after;
    if (after) {
      const target = byId(after)!;
      const req: Requirement = target.kind === 'delve' ? { kind: 'flag', flag: won(target.id) } : { kind: 'visited', scene: target.id };
      Object.assign(node, { requires: [req], note: pl.from!.note ?? `The way to ${pl.label} is closed. Not yet.` });
    }
    // A delve won is quiet after.
    if (pl.kind === 'delve') node.sceneWhen = [{ if: [{ kind: 'flag', flag: won(pl.id) }], to: `${pl.id}-quiet` }];
    return node;
  });
  for (const pl of places) {
    if (pl.kind === 'city' || pl.kind === 'town' || pl.kind === 'village') {
      embedded[pl.id] = { spec: { ...pl.from?.town, size: pl.kind, level: spec.level, name: pl.label, style }, onLeave: { to: 'land' } };
    } else if (pl.kind === 'delve') {
      const win: Effect[] = [{ kind: 'setFlag', flag: won(pl.id) }];
      delves[pl.id] = { spec: { level: spec.level, theme: THEME[g.at(pl.p)], ...pl.from?.delve }, onWin: { to: 'land', effects: win }, onLeave: { to: 'land' } };
      scenes[`${pl.id}-quiet`] = { id: `${pl.id}-quiet`, kind: 'story', noBack: true, text: [`${pl.label} is quiet now. Whatever held it holds it no longer.`],
        next: [{ id: 'on', label: 'Walk on', to: 'land' }] };
    } else if (pl.kind === 'camp') {
      const c = CAMPS[pl.faction!]!;
      const angry = pl.from?.hostile ?? rng() < c.hostile;
      const fid = `${pl.id}-fight`;
      const enc = generateEncounter({
        budget: Math.round(evenBudgetFor(spec.level) * shareFor('elite', spec.level)), maxMemberXp: memberCapFor(spec.level),
        maxCount: maxCountFor(spec.level), partyLevel: spec.level, members: FACTIONS[pl.faction!]!.members,
      }, seedRng(Math.floor(rng() * 2 ** 31))).value;
      const loot: Effect[] = [{ kind: 'setFlag', flag: won(pl.id) }, { kind: 'gold', amount: 15 * spec.level }];
      scenes[fid] = { id: fid, kind: 'battle', encounterId: generatedEncounterId(enc.members), mapId: g.at(pl.p) === 'marsh' ? 'marsh' : 'firepit',
        onWin: { to: `${pl.id}-quiet`, effects: loot } };
      scenes[`${pl.id}-quiet`] = { id: `${pl.id}-quiet`, kind: 'story', noBack: true, text: ['Cold ashes and trampled ground. Whoever camped here is gone.'],
        next: [{ id: 'on', label: 'Walk on', to: 'land' }] };
      nodes.find((n) => n.id === pl.id)!.sceneWhen = [{ if: [{ kind: 'flag', flag: won(pl.id) }], to: `${pl.id}-quiet` }];
      scenes[pl.id] = angry
        ? { id: pl.id, kind: 'story', noBack: true, text: [c.angry], next: [
            { id: 'fight', label: 'Fight', to: fid },
            { id: 'run', label: 'Fall back to the road', to: 'land' },
          ] }
        : { id: pl.id, kind: 'story', noBack: true, text: [c.calm], next: [
            { id: 'talk', label: 'Sit and talk a while', to: `${pl.id}-talk`, once: true },
            { id: 'fight', label: 'Attack them', to: fid },
            { id: 'on', label: 'Walk on', to: 'land' },
          ] };
      if (!angry) scenes[`${pl.id}-talk`] = { id: `${pl.id}-talk`, kind: 'story', noBack: true, text: [c.talk], next: [{ id: 'ok', label: 'Thank them and go', to: 'land' }] };
    } else if (pl.kind === 'place') {
      scenes[pl.id] = { id: pl.id, kind: 'story', noBack: true, text: pl.from!.text!, next: [{ id: 'on', label: 'Walk on', to: 'land' }] };
    } else if (pl.kind === 'stop') {
      scenes[pl.id] = { id: pl.id, kind: 'story', noBack: true, text: [pl.text!], next: [{ id: 'on', label: 'Walk on', to: 'land' }] };
    }
  }
  const sights = [g.sea ? 'the sea' : 'a river', ...new Set([...g.cells].map((c) => ({ f: 'forest', h: 'hills', m: 'marsh', M: 'mountains' } as Record<string, string>)[c]).filter(Boolean))];
  Object.assign(scenes, {
    start: { id: 'start', kind: 'story', text: [`The road crests a rise, and ${county} lies below you: ${sights.slice(0, -1).join(', ')}${sights.length > 1 ? ' and ' : ''}${sights.at(-1)}, and the smoke of ${city.label} in the middle of it.`],
      next: [{ id: 'on', label: `Go down into ${county}`, to: 'land', effects: [{ kind: 'xpToLevel', level: spec.level }] }] },
    land: { id: 'land', kind: 'explore', map: {
      title: county, theme: 'forest', art: { emoji: '🗺️' }, nodes, paths, entry: ['road-in'], camp: {},
      land: { cols: g.cols, rows: g.rows, cells: g.cells, river: g.river!, ...(bridges.length ? { bridges } : {}), ...(g.sea ? { sea: g.sea } : {}) },
    } },
    'road-in': { id: 'road-in', kind: 'story', noBack: true, text: ['The road runs on south, out of the county.'],
      next: [{ id: 'leave', label: `Leave ${county}`, to: 'left' }, { id: 'stay', label: 'Turn back', to: 'land' }] },
    left: { id: 'left', kind: 'ending', outcome: 'victory', text: [`${county} falls away behind you.`] },
  } satisfies Record<Id, Scene>);
  return {
    id: `land-${seed}`, title: county, blurb: `A generated county (level ${spec.level}).`,
    start: 'start', scenes, towns: embedded, ...(Object.keys(delves).length ? { delves } : {}), levelBand: { from: spec.level, to: spec.level },
  };
}

export function checkLandSpec(spec: LandSpec): Required<LandSpec> {
  const kind = spec.kind ?? 'valley';
  const level = spec.level ?? 2;
  if (!LAND_KINDS.includes(kind)) throw new Error(`Bad county spec: no land kind '${kind}'`);
  if (!Number.isInteger(level) || level < 1 || level > 5) throw new Error(`Bad county spec: level ${level}`);
  const places = spec.places ?? [];
  const delves = spec.delves ?? 2;
  const err = (m: string) => { throw new Error(`Bad county spec: ${m}`); };
  if (!Number.isInteger(delves) || delves < 0 || delves > 4) err(`${delves} delves; 0–4`);
  if (places.length > 8) err(`${places.length} places; at most 8`);
  const ids = new Set<string>();
  for (const pl of places) {
    if (!/^[a-z][a-z0-9-]*$/.test(pl.id)) err(`'${pl.id}': an id is lower-case letters, digits and dashes`);
    if (['land', 'start', 'road-in', 'left', 'city'].includes(pl.id) || /-quiet$/.test(pl.id)) err(`'${pl.id}' is a name the county uses itself`);
    if (ids.has(pl.id)) err(`two places called '${pl.id}'`);
    ids.add(pl.id);
    if (!['city', 'town', 'village', 'delve', 'place', 'camp'].includes(pl.kind)) err(`'${pl.id}': no kind of place '${pl.kind}'`);
    const settled = pl.kind === 'city' || pl.kind === 'town' || pl.kind === 'village';
    if (settled ? !/^[A-Z][A-Za-z' -]{1,12}$/.test(pl.label) : !pl.label || pl.label.length > 20) err(`'${pl.id}': a ${settled ? "town's name is 2–13 letters, capitalised" : 'label is 1–20 characters'}`);
    if (pl.delve) try { checkSpec({ level, ...pl.delve }); } catch (e) { err(`'${pl.id}': ${(e as Error).message}`); }
    if (pl.town) try { checkCitySpec({ ...pl.town, size: pl.kind === 'city' || pl.kind === 'village' ? pl.kind : 'town', level }); } catch (e) { err(`'${pl.id}': ${(e as Error).message}`); }
    if (pl.kind === 'place' && !pl.text?.length) err(`'${pl.id}': a place needs its text`);
    if (pl.terrain && !['plain', 'forest', 'hills', 'marsh'].includes(pl.terrain)) err(`'${pl.id}': no ground '${pl.terrain}'`);
    if (pl.kind === 'city' && (pl.via || pl.far)) err(`'${pl.id}': the city stands near the middle, through nothing`);
  }
  if (places.filter((pl) => pl.kind === 'city').length > 1) err('two cities');
  for (const pl of places) {
    for (const [what, to] of [['via', pl.via], ['after', pl.after]] as const) {
      if (to !== undefined && to !== 'city' && !ids.has(to)) err(`'${pl.id}' is ${what === 'via' ? 'reached through' : 'closed until'} '${to}', which is not one of the county's places`);
      if (to === pl.id) err(`'${pl.id}' cannot wait on itself`);
    }
  }
  // Through each other, round and round: nowhere to start.
  for (const pl of places) {
    const seen = new Set<string>();
    for (let at: LandPlace | undefined = pl; at?.via; at = places.find((x) => x.id === at!.via)) {
      if (seen.has(at.id)) err(`'${pl.id}': reached through itself, round a loop of places`);
      seen.add(at.id);
    }
  }
  const camps = spec.camps ?? 3;
  if (!Number.isInteger(camps) || camps < 0 || camps > 4) err(`${camps} camps; 0–4`);
  for (const pl of places) if (pl.kind === 'camp' && pl.faction !== undefined && !CAMP_FACTIONS.includes(pl.faction)) err(`'${pl.id}': no camp of '${pl.faction}' (have ${CAMP_FACTIONS.join(', ')})`);
  return { kind, level, places, delves, camps };
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
  // A delve's stub can be won or walked away from: what lies after it
  // waits on the win.
  for (const [at, d] of Object.entries(module.delves ?? {})) {
    stubs[at] = { id: at, kind: 'story', noBack: true, text: ['A delve.'], next: [
      { id: 'win', label: 'Win', to: d.onWin.to, ...(d.onWin.effects ? { effects: d.onWin.effects } : {}) },
      { id: 'out', label: 'Leave', to: d.onLeave.to },
    ] };
  }
  const { towns: _, delves: __, ...rest } = module;
  const errors = validateModule({ ...rest, scenes: { ...module.scenes, ...stubs } });
  for (const [at, t] of Object.entries(module.towns ?? {})) {
    try { generateCity(1, t.spec); } catch (e) { errors.push(`${at}: ${(e as Error).message}`); }
  }
  for (const [at, d] of Object.entries(module.delves ?? {})) {
    try { generateSpecDelve(1, d.spec); } catch (e) { errors.push(`${at}: ${(e as Error).message}`); }
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
