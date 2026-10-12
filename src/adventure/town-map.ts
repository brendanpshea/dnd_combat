/**
 * A town's ground: water, a wall, and the streets, laid down before a single
 * shop is placed, so the shops can go where shops go — along the streets,
 * the market on the square, the gate on the road in.
 *
 * Real towns grow out of their ground: a ford or a bridge, a road meeting
 * another, a harbour. A map of pins with lines drawn between nearest
 * neighbours reads as pins; one with a river, a wall and roads running in
 * from the gates reads as a place.
 *
 * Everything here is percent coordinates on the map (0–100 each way), and
 * purely visual: the streets do not gate where the party may walk.
 */
import type { TownGround } from './types.js';

type Pt = [number, number];

export type Feature = 'river' | 'coast' | 'crossroads';

/** Distance from a point to a polyline. */
export function toLine(p: Pt, line: readonly Pt[]): number {
  let best = Infinity;
  for (let i = 1; i < line.length; i++) best = Math.min(best, toSegment(p, line[i - 1]!, line[i]!).d);
  return best;
}

/** Nearest point on a segment, and how far. */
function toSegment(p: Pt, a: Pt, b: Pt): { d: number; at: Pt } {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const len = dx * dx + dy * dy;
  const t = len ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len)) : 0;
  const at: Pt = [a[0] + t * dx, a[1] + t * dy];
  return { d: Math.hypot(p[0] - at[0], p[1] - at[1]), at };
}

/** Nearest point on any of some polylines. */
export function nearestOn(p: Pt, lines: readonly (readonly Pt[])[]): { d: number; at: Pt } {
  let best = { d: Infinity, at: p };
  for (const l of lines) for (let i = 1; i < l.length; i++) {
    const s = toSegment(p, l[i - 1]!, l[i]!);
    if (s.d < best.d) best = s;
  }
  return best;
}

const r1 = (n: number) => Math.round(n * 10) / 10;
const pt = (x: number, y: number): Pt => [r1(x), r1(y)];

/** A wandering line from a to b: straight enough to be a road, not a ruler. */
export function wander(a: Pt, b: Pt, rng: () => number, sway: number, steps = 5): Pt[] {
  const out: Pt[] = [a];
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len, ny = dx / len;
  let drift = 0;
  for (let i = 1; i < steps; i++) {
    drift = drift * 0.5 + (rng() - 0.5) * sway;
    const t = i / steps;
    out.push(pt(a[0] + dx * t + nx * drift, a[1] + dy * t + ny * drift));
  }
  out.push(b);
  return out;
}

export interface Ground extends TownGround {
  /** The square, where the main streets meet. */
  square: Pt;
  /** Where the main road comes in (the gate's marker sits just inside it). */
  mainGate: Pt;
}

/**
 * The ground for a town of a size. Villages get lanes and no wall; towns and
 * cities a wall, gates where the roads come through it, and a few more roads.
 */
export function layGround(size: 'village' | 'town' | 'city', rng: () => number, opts: { feature?: Feature; wall?: boolean } = {}): Ground {
  const roll = rng();
  const feature: Feature = opts.feature ?? (roll < 0.45 ? 'river' : roll < 0.7 ? 'coast' : 'crossroads');
  const coastSide = rng() < 0.5 ? 'left' : 'right';
  const square = pt(50 + (rng() - 0.5) * 14, 52 + (rng() - 0.5) * 10);

  // Roads in from the edges: the main one from the bottom (the way the party
  // came), and more for a bigger place. Never from the sea.
  const sides = (['top', 'left', 'right'] as const).filter((s) => !(feature === 'coast' && s === coastSide));
  const ways = size === 'village' ? 1 : size === 'town' ? 2 : 3;
  const ends: Pt[] = [pt(50 + (rng() - 0.5) * 30, 100)];
  for (const side of sides.slice(0, ways)) {
    const along = 30 + rng() * 40;
    ends.push(side === 'top' ? pt(along, 0) : side === 'left' ? pt(0, along) : pt(100, along));
  }
  const streets = ends.map((e) => wander(e, square, rng, 9));
  // Just inside, on the road itself: the first point of the main street
  // that is clear of the map's foot.
  const main = streets[0]!;
  const mainGate = nearestOn(pt(main.find(([, y]) => y <= 82)?.[0] ?? square[0], 80), [main]).at;

  const ground: Ground = { feature, streets, square, mainGate };

  if (feature === 'river') {
    // Across the map, above or below the square: the bridge is where a
    // street meets it, and a town grew up beside it.
    const y = square[1] + (rng() < 0.5 ? -1 : 1) * (18 + rng() * 6);
    ground.water = { kind: 'river', points: wander(pt(0, y + (rng() - 0.5) * 12), pt(100, y + (rng() - 0.5) * 12), rng, 10, 7) };
  } else if (feature === 'coast') {
    const x = coastSide === 'left' ? 11 : 89;
    ground.water = { kind: 'coast', side: coastSide, points: wander(pt(x, 0), pt(x, 100), rng, 6, 8) };
  }

  if (size !== 'village' && opts.wall !== false) {
    // A wall: a rough ellipse about the square, cut where the roads come in.
    const rx = size === 'city' ? 44 : 40, ry = size === 'city' ? 42 : 38;
    const ring: Pt[] = [];
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * Math.PI * 2;
      const k = 1 + (rng() - 0.5) * 0.08;
      ring.push(pt(50 + Math.cos(a) * rx * k, 50 + Math.sin(a) * ry * k));
    }
    // No wall into the sea: the harbour is open water.
    ground.wall = feature === 'coast'
      ? ring.filter(([x]) => coastSide === 'left' ? x > 12 : x < 88)
      : [...ring, ring[0]!];
  }
  return ground;
}

/** Fit for a marker: off the water, and not on the wall's line. */
export function dry(p: Pt, g: Ground): boolean {
  if (g.water?.kind === 'river' && toLine(p, g.water.points) < 7) return false;
  if (g.water?.kind === 'coast') {
    const shore = nearestOn(p, [g.water.points]).at[0];
    if (g.water.side === 'left' ? p[0] < shore + 8 : p[0] > shore - 8) return false;
  }
  return true;
}

/** A lane from a marker to the street it stands on, unless it is on one. */
export function laneTo(p: Pt, g: Ground): Pt[] | undefined {
  const { d, at } = nearestOn(p, g.streets);
  return d < 2.5 ? undefined : [p, pt(at[0], at[1])];
}
