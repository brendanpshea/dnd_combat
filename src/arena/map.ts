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

const WIDTH = 8;
/** Files a party and an encounter deploy on (see buildParty / buildEncounter). */
const DEPLOY_FILES = [0, 1, 2, 3, 4, 5, 6, 7];
const THEMES: MapTheme[] = ['stone', 'forest', 'graveyard', 'ember', 'village', 'bog'];

/** Terrain a theme prefers for its scatter, so a bog is boggy and a forge burns. */
const THEME_SCATTER: Record<MapTheme, { difficult: number; hazard: number }> = {
  stone:     { difficult: 0.06, hazard: 0.00 },
  forest:    { difficult: 0.14, hazard: 0.00 },
  graveyard: { difficult: 0.08, hazard: 0.00 },
  ember:     { difficult: 0.04, hazard: 0.08 },
  village:   { difficult: 0.04, hazard: 0.00 },
  bog:       { difficult: 0.20, hazard: 0.02 },
};

export interface ArenaMapOptions {
  /** Force a depth instead of rolling 50/50. Any row count the validator
   *  accepts; the generator itself rolls 12 or 16 (see below). */
  height?: number;
  theme?: MapTheme;
}

/**
 * Why a candidate board was rejected. Surfaced (rather than swallowed) so the
 * tests can assert the validator actually catches each failure mode.
 */
export type MapFault =
  | 'deploy-blocked'      // a spawn file is a wall
  | 'disconnected'        // some open cell can't be reached from the party's rank
  | 'spawn-hazard'        // a spawn sits on or beside fire
  | 'too-walled';         // so much cover the fight becomes a maze

export function validateArenaMap(map: MapData): MapFault[] {
  const grid = parseMap(map);
  const { width, height, cells } = grid;
  const at = (x: number, y: number) => cells[y * width + x]!;
  const faults: MapFault[] = [];
  const ranks = [0, height - 1];

  for (const y of ranks) {
    for (const x of DEPLOY_FILES) {
      if (at(x, y).terrain === 'wall') { faults.push('deploy-blocked'); break; }
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

  const walls = cells.filter((c) => c.terrain === 'wall').length;
  if (walls > cells.length * 0.22) faults.push('too-walled');

  // Flood fill from a party spawn: every non-wall cell must be reachable, or
  // some part of the board is a pocket the fight can never use — and, worse,
  // an enemy deployed into one can never be reached.
  const seen = new Set<number>();
  const stack = [0 * width + DEPLOY_FILES[0]!];
  while (stack.length) {
    const i = stack.pop()!;
    if (seen.has(i)) continue;
    const x = i % width, y = Math.floor(i / width);
    if (at(x, y).terrain === 'wall') continue;
    seen.add(i);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nx = x + dx, ny = y + dy;
      if (nx >= 0 && nx < width && ny >= 0 && ny < height) stack.push(ny * width + nx);
    }
  }
  const openCells = cells.filter((c) => c.terrain !== 'wall').length;
  if (seen.size < openCells) faults.push('disconnected');

  return [...new Set(faults)];
}

/** One candidate board — not yet validated. */
function draft(theme: MapTheme, height: number, state: RngState): { rows: string[]; state: RngState } {
  let rng = state;
  const roll = () => { const r = next(rng); rng = r.state; return r.value; };
  const grid: string[][] = Array.from({ length: height }, () => Array<string>(WIDTH).fill('.'));

  const scatter = THEME_SCATTER[theme];
  // Cover clumps rather than confetti: a lone wall cell is noise, a two- or
  // three-cell block is something to fight around.
  const clumps = 2 + Math.floor(roll() * 3);
  for (let c = 0; c < clumps; c++) {
    // Keep cover out of the deploy ranks entirely — that is what makes the
    // spawn checks pass reliably instead of by luck.
    const cy = 2 + Math.floor(roll() * Math.max(1, height - 4));
    const cx = Math.floor(roll() * WIDTH);
    const size = 1 + Math.floor(roll() * 3);
    for (let k = 0; k < size; k++) {
      const x = Math.min(WIDTH - 1, Math.max(0, cx + Math.floor(roll() * 3) - 1));
      const y = Math.min(height - 3, Math.max(2, cy + Math.floor(roll() * 3) - 1));
      grid[y]![x] = '#';
    }
  }

  for (let y = 1; y < height - 1; y++) {
    for (let x = 0; x < WIDTH; x++) {
      if (grid[y]![x] !== '.') continue;
      const r = roll();
      if (r < scatter.hazard && y > 1 && y < height - 2) grid[y]![x] = '^';
      else if (r < scatter.hazard + scatter.difficult) grid[y]![x] = '~';
    }
  }

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
    const d = draft(theme, height, rng); rng = d.state;
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
