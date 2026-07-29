/**
 * Arena map generation: a fresh board per fight, in the same ASCII shape the
 * hand-authored maps use, so everything downstream (parseMap, the themes, the
 * renderer) is unchanged.
 *
 * Boards are 8 wide always — 8 columns is what keeps cells finger-sized on a
 * phone — and a 50/50 roll between 8x8 (a tight brawl) and 8x12 (room for an
 * approach: ranged rounds before the lines meet).
 *
 * VALIDATION IS THE POINT. A generated map that walls a spawn off, or seals
 * one side from the other, does not look broken — it produces a battle where
 * the AI never engages and nothing ever ends. `validateArenaMap` is run on
 * every board before it ships, and the generator rerolls rather than returning
 * something it cannot vouch for.
 */
import type { MapData, MapTheme } from '../data/maps.js';
import { parseMap } from '../data/maps.js';
import { next, type RngState } from '../engine/rng.js';
import { blocksMovement } from '../engine/grid.js';

const WIDTH = 8;
/** Files a party and an encounter deploy on (see buildParty / buildEncounter). */
const DEPLOY_FILES = [0, 1, 2, 3, 4, 5, 6, 7];
const THEMES: MapTheme[] = ['stone', 'forest', 'graveyard', 'ember', 'village', 'bog'];

/** Terrain a theme prefers for its scatter, so a bog is boggy and a forge burns. */
/**
 * Hazard rates, now that a hazard means something different on each theme.
 *
 * Four of these were zero. That was defensible while every hazard in the game
 * was the same 1d4 of fire — a lava tile in a graveyard is nonsense, so the
 * graveyard simply had none — and it stopped being defensible the moment each
 * theme got its own: brambles, grave gas and burning wreckage were written,
 * drawn, and generated exactly never.
 *
 * The rates are deliberately unequal, because the hazards are. Lava is 3d6 and
 * stays at 8% on the volcano where it belongs; a bramble thicket is 1d4 and a
 * snare, so a forest can afford more of it than a lava field can. Stone keeps a
 * token seam: a ruin with a crack of molten rock in it is a set-piece, not the
 * ordinary state of a dungeon.
 */
export const THEME_SCATTER: Record<MapTheme, { difficult: number; hazard: number }> = {
  stone:     { difficult: 0.06, hazard: 0.02 },
  forest:    { difficult: 0.14, hazard: 0.06 },
  graveyard: { difficult: 0.08, hazard: 0.04 },
  ember:     { difficult: 0.04, hazard: 0.08 },
  village:   { difficult: 0.04, hazard: 0.04 },
  bog:       { difficult: 0.20, hazard: 0.05 },
};

export interface ArenaMapOptions {
  /** Force a depth instead of rolling 50/50. Any row count the validator
   *  accepts; the generator itself rolls 12 or 16 (see below). */
  height?: number;
  theme?: MapTheme;
  /**
   * Force a named layout instead of drawing one by weight. The arena's gates
   * use this: a door that promises barricades has to deliver them, or the
   * promise on the card is a lie. An unknown name falls back to the weighted
   * draw rather than throwing, so a stale id degrades to "some board".
   */
  layout?: LayoutName;
}

/** The stamps `layout` may name. */
export type LayoutName =
  'chokepoint' | 'pillars' | 'redoubt' | 'crossfire' | 'ruin' | 'open';

/**
 * Why a candidate board was rejected. Surfaced (rather than swallowed) so the
 * tests can assert the validator actually catches each failure mode.
 */
export type MapFault =
  | 'deploy-blocked'      // a spawn file is a wall
  | 'disconnected'        // some open cell can't be reached from the party's rank
  | 'spawn-hazard'        // a spawn sits on or beside fire
  | 'too-walled';         // so much blocking terrain the fight becomes a maze

export function validateArenaMap(map: MapData): MapFault[] {
  const grid = parseMap(map);
  const { width, height, cells } = grid;
  const at = (x: number, y: number) => cells[y * width + x]!;
  const faults: MapFault[] = [];
  const ranks = [0, height - 1];

  for (const y of ranks) {
    for (const x of DEPLOY_FILES) {
      if (blocksMovement(at(x, y).terrain)) { faults.push('deploy-blocked'); break; }
    }
  }
  for (const y of ranks) {
    for (const x of DEPLOY_FILES) {
      const hot = at(x, y).terrain === 'hazard' ||
        [[0, 1], [0, -1], [1, 0], [-1, 0]].some(([dx, dy]) => {
          const nx = x + dx!, ny = y + dy!;
          return nx >= 0 && nx < width && ny >= 0 && ny < height && at(nx, ny).terrain === 'hazard';
        });
      if (hot) { faults.push('spawn-hazard'); break; }
    }
  }

  // Barricades count: they are as impassable as a wall, and a board packed
  // with them is the same maze even though you can see across it.
  const blocked = cells.filter((c) => blocksMovement(c.terrain)).length;
  if (blocked > cells.length * 0.26) faults.push('too-walled');

  // Flood fill from a party spawn: every non-wall cell must be reachable, or
  // some part of the board is a pocket the fight can never use — and, worse,
  // an enemy deployed into one can never be reached.
  const seen = new Set<number>();
  const stack = [0 * width + DEPLOY_FILES[0]!];
  while (stack.length) {
    const i = stack.pop()!;
    if (seen.has(i)) continue;
    const x = i % width, y = Math.floor(i / width);
    if (blocksMovement(at(x, y).terrain)) continue;
    seen.add(i);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nx = x + dx, ny = y + dy;
      if (nx >= 0 && nx < width && ny >= 0 && ny < height) stack.push(ny * width + nx);
    }
  }
  const openCells = cells.filter((c) => !blocksMovement(c.terrain)).length;
  if (seen.size < openCells) faults.push('disconnected');

  return [...new Set(faults)];
}

/**
 * A board layout, stamped rather than sprinkled.
 *
 * Scattered single cells were what this used to do, and they buy nothing: a
 * lone hazard is one step to walk round, and wall noise is porous enough that
 * no sightline stays broken for long. What creates a decision is *contiguous
 * shape* — a band you have to find the gap in, a massif that splits the board
 * into two lanes, a barricade you have to flank rather than walk through.
 *
 * `#` wall (blocks sight and movement), `+` barricade (blocks movement only,
 * and gives half cover to whoever is behind it), `~` difficult, `^` hazard.
 *
 * Every layout is written for the middle of the board; `draft` mirrors it
 * horizontally at random and keeps it clear of the deploy ranks.
 */
type Stamp = (put: (x: number, y: number, ch: string) => void, mid: number, roll: () => number, height: number) => void;

const LAYOUTS: Array<{ name: LayoutName; weight: number; stamp: Stamp }> = [
  {
    // A wall across the board with one or two ways through. The melee line has
    // somewhere worth standing, and the shooters behind it have a lane to hold.
    name: 'chokepoint', weight: 20,
    stamp: (put, mid, roll) => {
      const gapA = 1 + Math.floor(roll() * 3);
      const gapB = 5 + Math.floor(roll() * 2);
      // Part of the band is barricade rather than wall — a stretch you can see
      // and shoot over but not walk through. That is the sniping step: behind
      // it a rogue has cover from everything on the far side, which is both
      // +2 AC and (canHide) somewhere to disappear, while still having a shot.
      // A band of pure wall gives none of that; it is only an obstacle.
      const lowFrom = 2 + Math.floor(roll() * 3);
      for (let x = 0; x < WIDTH; x++) {
        if (x === gapA || x === gapB) continue;
        put(x, mid, x >= lowFrom && x < lowFrom + 2 ? '+' : '#');
      }
      // And a barricade beside each gap: holding a doorway should be worth
      // something to whoever gets there first.
      //
      // BESIDE, not in front of. These used to sit at (gap, mid-1) and
      // (gap, mid+1) — directly in the doorway's approach — and because the
      // band blocks left and right, that left the gap with no orthogonal way in
      // at all. Every chokepoint board failed the connectivity check, and since
      // an unforced reroll draws a fresh layout the failure was invisible: this
      // is the heaviest-weighted layout in the table (20 of 100) and it had
      // never once shipped. Offsetting by a column keeps the cover and leaves
      // the doorway open.
      put(gapA - 1, mid - 1, '+');
      put(gapB + 1, mid + 1, '+');
    },
  },
  {
    // Pillars. Nothing is blocked for long, but no sightline is safe either:
    // one step either way changes who can see whom.
    name: 'pillars', weight: 18,
    stamp: (put, mid, roll, height) => {
      const step = 3;
      for (let y = 2; y <= height - 3; y += step) {
        const off = (y / step) % 2 === 0 ? 1 : 3;
        for (let x = off; x < WIDTH; x += 3) put(x, y, roll() < 0.3 ? '+' : '#');
      }
    },
  },
  {
    // A ring of barricades in the middle: strong from the front, open from
    // behind. Worth taking, and worth going round.
    name: 'redoubt', weight: 16,
    stamp: (put, mid) => {
      for (let x = 2; x <= 5; x++) put(x, mid - 1, '+');
      put(2, mid, '+');
      put(5, mid, '+');
    },
  },
  {
    // Barricades down both flanks, an open lane between. Shooters want the
    // edges; anything that has to close wants the middle, and gets shot doing
    // it. This is the one that most rewards a rogue: two long walls to work.
    name: 'crossfire', weight: 16,
    stamp: (put, mid, roll, height) => {
      const span = Math.min(5, Math.max(3, height - 6));
      for (let k = 0; k < span; k++) {
        put(1, mid - 1 + k, '+');
        put(WIDTH - 2, mid - 1 + k, '+');
      }
    },
  },
  {
    // A solid block off to one side with rubble around it: two unequal lanes,
    // and a hard corner to break line of sight behind.
    name: 'ruin', weight: 16,
    stamp: (put, mid, roll) => {
      const x0 = roll() < 0.5 ? 1 : 4;
      for (let x = x0; x < x0 + 3; x++) {
        for (let y = mid - 1; y <= mid + 1; y++) put(x, y, '#');
      }
      put(x0 - 1 < 0 ? x0 + 3 : x0 - 1, mid, '+');
      put(x0 + 1, mid + 2, '+');
    },
  },
  {
    // Nearly bare, with a couple of barricades to duck behind. Kept so the set
    // still produces an honest open field — some fights should have no cover
    // to argue about.
    name: 'open', weight: 14,
    stamp: (put, mid, roll) => {
      put(2 + Math.floor(roll() * 2), mid, '+');
      put(4 + Math.floor(roll() * 2), mid + 1 + Math.floor(roll() * 2), '+');
    },
  },
];

/** One candidate board — not yet validated. */
function draft(
  theme: MapTheme, height: number, state: RngState, forced?: LayoutName,
): { rows: string[]; state: RngState } {
  let rng = state;
  const roll = () => { const r = next(rng); rng = r.state; return r.value; };
  const grid: string[][] = Array.from({ length: height }, () => Array<string>(WIDTH).fill('.'));

  // Blocking terrain stays out of the two ranks at each end: that is what makes
  // deployment reliably legal instead of lucky.
  const lo = 2, hi = height - 3;
  const mirror = roll() < 0.5;
  const put = (x: number, y: number, ch: string) => {
    if (y < lo || y > hi) return;
    const px = mirror ? WIDTH - 1 - x : x;
    if (px < 0 || px >= WIDTH) return;
    grid[y]![px] = ch;
  };

  // Roll regardless of whether a layout was forced, so forcing one does not
  // shift the rest of the RNG stream and change the hazards and mud too.
  const total = LAYOUTS.reduce((a, l) => a + l.weight, 0);
  let pick = roll() * total;
  const drawn = LAYOUTS.find((l) => (pick -= l.weight) < 0) ?? LAYOUTS[0]!;
  const layout = (forced && LAYOUTS.find((l) => l.name === forced)) || drawn;
  // Where the shape sits: centred, nudged a rank or two so two boards from the
  // same layout do not read as the same board.
  const mid = Math.max(lo + 1, Math.min(hi - 1, Math.floor(height / 2) + (Math.floor(roll() * 3) - 1)));
  layout.stamp(put, mid, roll, height);

  // Hazards and mud as POOLS, not confetti. A single fire tile is one step to
  // walk round and so is never a decision; a four-cell pool across a lane is a
  // real question — go through and take 2d6, or go round and lose the turn.
  const scatter = THEME_SCATTER[theme];
  const pools = (chance: number, ch: string) => {
    if (chance <= 0) return;
    // Roughly the old per-cell budget, spent in one or two blobs instead.
    const budget = Math.round(chance * WIDTH * height);
    let placed = 0;
    for (let attempt = 0; attempt < 6 && placed < budget; attempt++) {
      let x = Math.floor(roll() * WIDTH);
      let y = lo + Math.floor(roll() * Math.max(1, hi - lo + 1));
      const size = 2 + Math.floor(roll() * 4);
      for (let k = 0; k < size && placed < budget; k++) {
        if (y >= lo && y <= hi && x >= 0 && x < WIDTH && grid[y]![x] === '.') {
          grid[y]![x] = ch;
          placed++;
        }
        // Random walk: a blob with a ragged edge, not a rectangle.
        if (roll() < 0.5) x += roll() < 0.5 ? 1 : -1;
        else y += roll() < 0.5 ? 1 : -1;
      }
    }
  };
  pools(scatter.hazard, '^');
  pools(scatter.difficult, '~');

  return { rows: grid.map((r) => r.join('')), state: rng };
}

export interface GeneratedMap {
  map: MapData;
  /** How many candidates were rejected before this one passed. */
  rerolls: number;
}

/**
 * A validated arena board. Rerolls until a candidate passes; falls back to a
 * bare open field, which is trivially valid, so this can never fail to return
 * a playable map.
 */
export function generateArenaMap(
  opts: ArenaMapOptions,
  state: RngState,
): { value: GeneratedMap; state: RngState } {
  let rng = state;
  let height: number;
  if (opts.height !== undefined) {
    height = opts.height;
  } else {
    const r = next(rng); rng = r.state;
    // Depth is the single biggest lever on whether positioning means anything,
    // and 8 rows is below the floor. The longest possible shot on an 8x8 board
    // is 35 ft; a shortbow reaches 80 and a cantrip 60-120, so every shooter can
    // hit every target from its starting cell and no one ever has a reason to
    // move. Measured at level 1 over 40 seeds against crossbow bandits, a party
    // that never took a step BEAT one played properly on 8x8 (48% vs 40%); at 12
    // rows the same refusal to move costs 22 points, and at 20 rows, 28.
    //
    // 10 and 12, not 12 and 16. The win rate is flat across depths — it is the
    // ranged band that changes, not the difficulty — so depth should be chosen
    // for what fits a phone, and 16 does not: the board is 8 wide, so 8x16 is
    // aspect 2.0, and the width formula in styles.css then spends about 607px
    // of an 844px screen on the board alone, squeezing the top bar and the
    // action bar. 12 keeps the whole effect and fits.
    height = r.value < 0.5 ? 10 : 12;
  }
  let theme = opts.theme;
  if (theme === undefined) {
    const r = next(rng); rng = r.state;
    theme = THEMES[Math.floor(r.value * THEMES.length)]!;
  }

  for (let attempt = 0; attempt < 24; attempt++) {
    const d = draft(theme, height, rng, opts.layout); rng = d.state;
    const map: MapData = { id: `arena-${theme}-${height}`, name: 'Arena', theme, rows: d.rows };
    if (validateArenaMap(map).length === 0) {
      return { value: { map, rerolls: attempt }, state: rng };
    }
  }
  const open: MapData = {
    id: `arena-${theme}-${height}`, name: 'Arena', theme,
    rows: Array.from({ length: height }, () => '.'.repeat(WIDTH)),
  };
  return { value: { map: open, rerolls: 24 }, state: rng };
}
