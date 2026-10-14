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

/**
 * The default board width, and still the only one the game ships.
 *
 * It is a DEFAULT rather than a constant because the cap was never a rule: the
 * board is eight wide because `styles.css` fits the whole thing on a phone and
 * eight columns is where the cells stop being finger-sized. A camera now
 * decides how much of a board is on screen (web/src/boardCamera.ts), so width
 * is a design question again and the generator has to be able to answer it.
 *
 * Everything below that used to be written against 8 is written against the
 * width it is handed, in the same proportions — so a width-8 board is the
 * board it always was, cell for cell, and test/arena-map.test.ts holds that.
 */
export const DEFAULT_WIDTH = 8;
/** Files a party and an encounter deploy on (see buildParty / buildEncounter). */
const deployFiles = (width: number) => Array.from({ length: width }, (_, i) => i);
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
  /** Columns. Defaults to `DEFAULT_WIDTH`, which is the only width shipped. */
  width?: number;
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
  'chokepoint' | 'pillars' | 'redoubt' | 'crossfire' | 'ruin' | 'open'
  | 'gallery' | 'rooms';

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
  // From the map in hand, not from a module constant: a validator that checked
  // eight files of a twelve-wide board would pass a map with a wall across the
  // four columns it never looked at.
  const DEPLOY_FILES = deployFiles(width);

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
 *
 * A STAMP'S `y` IS UPSIDE DOWN, and until `gallery` every layout was symmetric
 * enough not to care. `draft` builds `grid[y]` and hands the rows out in that
 * order; `parseMap` reads row `i` as `y = height - 1 - i` (top rank first). So
 * a stamp's row 0 becomes the FAR rank — the enemy's — and its last row
 * becomes the party's. `lo` and `hi` are symmetric, so nothing noticed.
 *
 * It bites the moment a layout means something by which end it is at: the
 * first cut of `gallery` put its firing line two rows above the middle and the
 * barricades came out two rows in front of the PARTY, handing the shooters'
 * cover to the people it was meant to be used against.
 */
type Stamp = (put: (x: number, y: number, ch: string) => void, mid: number, roll: () => number, height: number, width: number) => void;

const LAYOUTS: Array<{ name: LayoutName; weight: number; stamp: Stamp }> = [
  {
    /*
     * LONGBOWS BEHIND COVER.
     *
     * A barricade line laid just in front of the enemy's own rank, with two
     * ways through. A barricade blocks movement and not sight, so whatever
     * stands behind it can shoot over it the whole fight while holding half
     * cover (+2 AC) and somewhere to hide — and a party that wants to stop
     * being shot has to come through a gap or go round the end, in the open,
     * under fire.
     *
     * This is the shape that makes standing still cost something. A band
     * across the MIDDLE (chokepoint) is an obstacle both sides share; a band
     * in front of one side's deployment is an advantage one side holds, and
     * taking it away is the fight.
     */
    name: 'gallery', weight: 0,
    stamp: (put, _mid, roll, _height, width) => {
      /*
       * Two or three rows in FRONT of the shooters' own rank — and written as
       * a distance from the top of the stamp rather than from `mid`, because
       * the stamp's rows are upside down (see the note above `LAYOUTS`) and
       * `put` will not write above row 2 at all. Hung off `mid` instead, the
       * line wandered as far as the middle of the board, where it is cover for
       * whoever gets there first rather than cover the shooters hold.
       */
      const line = 3 + Math.floor(roll() * 2);
      const gapA = 1 + Math.floor(roll() * Math.max(1, Math.floor(width / 2) - 1));
      const gapB = Math.floor(width / 2) + 1 + Math.floor(roll() * Math.max(1, Math.floor(width / 2) - 2));
      for (let x = 0; x < width; x++) {
        if (x === gapA || x === gapB) continue;
        put(x, line, '+');
      }
      // Corners to fall back to, rather than one flat firing step. Offset a
      // column from each doorway: a stub in a doorway's own approach is what
      // makes a board fail the connectivity check, which is how the
      // chokepoint layout once went un-shipped for months.
      // `line - 1` is BEHIND the barricade from the shooters' side, the stamp
      // being upside down. Offset a column from each doorway: a stub in a
      // doorway's own approach is what makes a board fail the connectivity
      // check, which is how the chokepoint layout once went un-shipped.
      put(Math.max(0, gapA - 1), line - 1, '+');
      put(Math.min(width - 1, gapB + 1), line - 1, '+');
    },
  },
  {
    /*
     * ROOMS.
     *
     * Two bands with their doorways at opposite ends, so crossing the board is
     * a zig-zag rather than a walk, and a stub beside each doorway so a band
     * reads as a chamber wall rather than a fence. Sightlines break at every
     * doorway: what you can shoot changes with every step, which is the thing
     * an open field never asks.
     *
     * The doorways are deliberately offset. Lined up, the two bands are one
     * corridor and the board is a chokepoint with extra walls.
     */
    name: 'rooms', weight: 0,
    stamp: (put, mid, roll, height, width) => {
      // Far enough apart to leave a room between them. The gap also keeps each
      // stub clear of the other band's doorway.
      const d = Math.max(2, Math.floor((height - 5) / 4));
      const lower = mid - d, upper = mid + d;
      const near = 1 + Math.floor(roll() * Math.max(1, Math.floor(width / 3)));
      const far = width - 2 - Math.floor(roll() * Math.max(1, Math.floor(width / 3)));
      for (let x = 0; x < width; x++) {
        if (x !== near) put(x, lower, roll() < 0.25 ? '+' : '#');
        if (x !== far) put(x, upper, roll() < 0.25 ? '+' : '#');
      }
      // Beside the doorways, never in them — see the note in `gallery`, and
      // the one on `chokepoint` that this rule was learned from.
      put(Math.max(0, near - 1), lower + 1, '#');
      put(Math.min(width - 1, far + 1), upper - 1, '#');
    },
  },
  {
    // A wall across the board with one or two ways through. The melee line has
    // somewhere worth standing, and the shooters behind it have a lane to hold.
    name: 'chokepoint', weight: 20,
    stamp: (put, mid, roll, _height, width) => {
      // Two ways through, one in each half. Written as fractions of the width
      // so a wider band still has exactly two gaps rather than the same two
      // columns with a longer wall either side of them.
      const half = Math.floor(width / 2);
      const gapA = 1 + Math.floor(roll() * Math.max(1, half - 1));
      const gapB = half + 1 + Math.floor(roll() * Math.max(1, half - 2));
      // Part of the band is barricade rather than wall — a stretch you can see
      // and shoot over but not walk through. That is the sniping step: behind
      // it a rogue has cover from everything on the far side, which is both
      // +2 AC and (canHide) somewhere to disappear, while still having a shot.
      // A band of pure wall gives none of that; it is only an obstacle.
      const lowFrom = Math.floor(width / 4) + Math.floor(roll() * 3);
      for (let x = 0; x < width; x++) {
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
    stamp: (put, _mid, roll, height, width) => {
      const step = 3;
      for (let y = 2; y <= height - 3; y += step) {
        // Alternate rows by index: `y / step` is never whole for y = 2, 5, 8,
        // so reading it directly put every row on the same columns.
        const off = Math.floor(y / step) % 2 === 0 ? 1 : 3;
        for (let x = off; x < width; x += 3) put(x, y, roll() < 0.3 ? '+' : '#');
      }
    },
  },
  {
    // A ring of barricades in the middle: strong from the front, open from
    // behind. Worth taking, and worth going round.
    name: 'redoubt', weight: 16,
    stamp: (put, mid, _roll, _height, width) => {
      // The middle half of the board, whatever that is: on eight columns the
      // 2..5 it has always been.
      const from = Math.floor(width / 4), to = Math.ceil((width * 3) / 4) - 1;
      for (let x = from; x <= to; x++) put(x, mid - 1, '+');
      put(from, mid, '+');
      put(to, mid, '+');
    },
  },
  {
    // Barricades down both flanks, an open lane between. Shooters want the
    // edges; anything that has to close wants the middle, and gets shot doing
    // it. This is the one that most rewards a rogue: two long walls to work.
    name: 'crossfire', weight: 16,
    stamp: (put, mid, _roll, height, width) => {
      const span = Math.min(5, Math.max(3, height - 6));
      for (let k = 0; k < span; k++) {
        put(1, mid - 1 + k, '+');
        put(width - 2, mid - 1 + k, '+');
      }
    },
  },
  {
    // A solid block off to one side with rubble around it: two unequal lanes,
    // and a hard corner to break line of sight behind.
    name: 'ruin', weight: 16,
    stamp: (put, mid, roll, _height, width) => {
      const x0 = roll() < 0.5 ? 1 : Math.floor(width / 2);
      // The block grows with the board: three columns of eight is a quarter of
      // it, and a three-column block on twenty columns is a pebble.
      const span = Math.max(3, Math.round((width * 3) / 8));
      for (let x = x0; x < x0 + span; x++) {
        for (let y = mid - 1; y <= mid + 1; y++) put(x, y, '#');
      }
      put(x0 - 1 < 0 ? x0 + span : x0 - 1, mid, '+');
      put(x0 + 1, mid + 2, '+');
    },
  },
  {
    // Nearly bare, with a couple of barricades to duck behind. Kept so the set
    // still produces an honest open field — some fights should have no cover
    // to argue about.
    name: 'open', weight: 14,
    stamp: (put, mid, roll, _height, width) => {
      put(Math.floor(width / 4) + Math.floor(roll() * 2), mid, '+');
      put(Math.floor(width / 2) + Math.floor(roll() * 2), mid + 1 + Math.floor(roll() * 2), '+');
    },
  },
];

/** One candidate board — not yet validated. */
function draft(
  theme: MapTheme, height: number, width: number, state: RngState, forced?: LayoutName,
): { rows: string[]; state: RngState } {
  let rng = state;
  const roll = () => { const r = next(rng); rng = r.state; return r.value; };
  const grid: string[][] = Array.from({ length: height }, () => Array<string>(width).fill('.'));

  // Blocking terrain stays out of the two ranks at each end: that is what makes
  // deployment reliably legal instead of lucky.
  const lo = 2, hi = height - 3;
  const mirror = roll() < 0.5;
  const put = (x: number, y: number, ch: string) => {
    if (y < lo || y > hi) return;
    const px = mirror ? width - 1 - x : x;
    if (px < 0 || px >= width) return;
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
  layout.stamp(put, mid, roll, height, width);

  // Hazards and mud as POOLS, not confetti. A single fire tile is one step to
  // walk round and so is never a decision; a four-cell pool across a lane is a
  // real question — go through and take 2d6, or go round and lose the turn.
  const scatter = THEME_SCATTER[theme];
  const pools = (chance: number, ch: string) => {
    if (chance <= 0) return;
    // Roughly the old per-cell budget, spent in one or two blobs instead.
    const budget = Math.round(chance * width * height);
    let placed = 0;
    for (let attempt = 0; attempt < 6 && placed < budget; attempt++) {
      let x = Math.floor(roll() * width);
      let y = lo + Math.floor(roll() * Math.max(1, hi - lo + 1));
      const size = 2 + Math.floor(roll() * 4);
      for (let k = 0; k < size && placed < budget; k++) {
        if (y >= lo && y <= hi && x >= 0 && x < width && grid[y]![x] === '.') {
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
  const width = opts.width ?? DEFAULT_WIDTH;
  let theme = opts.theme;
  if (theme === undefined) {
    const r = next(rng); rng = r.state;
    theme = THEMES[Math.floor(r.value * THEMES.length)]!;
  }

  for (let attempt = 0; attempt < 24; attempt++) {
    const d = draft(theme, height, width, rng, opts.layout); rng = d.state;
    const map: MapData = { id: `arena-${theme}-${width}x${height}`, name: 'Arena', theme, rows: d.rows };
    if (validateArenaMap(map).length === 0) {
      return { value: { map, rerolls: attempt }, state: rng };
    }
  }
  const open: MapData = {
    id: `arena-${theme}-${width}x${height}`, name: 'Arena', theme,
    rows: Array.from({ length: height }, () => '.'.repeat(width)),
  };
  return { value: { map: open, rerolls: 24 }, state: rng };
}
