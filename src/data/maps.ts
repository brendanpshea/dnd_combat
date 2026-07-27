/**
 * Battle maps as ASCII art. Rows are listed top rank first (y = height-1),
 * matching how the board renders. Adding a map is a data edit.
 *
 *   .  open    #  wall (blocks movement + line of sight)
 *   ~  difficult (costs double movement)
 *   ^  hazard (1d4 fire when entered)
 *
 * Teams deploy on the first and last ranks (y=0 and y=height-1 — see
 * `farRank`), so those rows must stay walkable where parties spawn (files
 * b, c, e, g by default). Maps may be taller than wide: a portrait phone has
 * more room down than across, and a tall board is what gives a fight an
 * approach phase — ranged rounds before the lines meet.
 */
import type { GridState, Cell, TerrainId } from '../engine/types.js';

/** Visual theme — the whole board is styled as a place, not just its terrain. */
export type MapTheme = 'stone' | 'forest' | 'graveyard' | 'ember' | 'village' | 'bog';

export interface MapData {
  id: string;
  name: string;
  theme: MapTheme;
  rows: string[]; // height entries of width chars
}

const CHAR_TERRAIN: Record<string, TerrainId> = {
  '.': 'open', '#': 'wall', '~': 'difficult', '^': 'hazard',
  // A barricade: chest-high, so you cannot walk through it but you can see and
  // shoot over it, at +2 AC to whoever is behind it.
  '+': 'cover',
};

export function parseMap(map: MapData): GridState {
  const height = map.rows.length;
  const width = map.rows[0]!.length;
  const cells: Cell[] = new Array(width * height);
  map.rows.forEach((row, i) => {
    if (row.length !== width) throw new Error(`Map ${map.id}: ragged row ${i}`);
    const y = height - 1 - i;
    for (let x = 0; x < width; x++) {
      const t = CHAR_TERRAIN[row[x]!];
      if (!t) throw new Error(`Map ${map.id}: unknown terrain char '${row[x]}'`);
      cells[y * width + x] = { terrain: t };
    }
  });
  return { width, height, cells };
}

export const MAPS: Record<string, MapData> = {
  open: {
    id: 'open', name: 'Open Field', theme: 'forest',
    rows: [
      '........',
      '........',
      '........',
      '........',
      '........',
      '........',
      '........',
      '........',
    ],
  },
  ruins: {
    id: 'ruins', name: 'Walled Ruins', theme: 'stone',
    rows: [
      '........',
      '..#..#..',
      '..#..#..',
      '.....#..',
      '..#.....',
      '..#..#..',
      '..#..#..',
      '........',
    ],
  },
  marsh: {
    id: 'marsh', name: 'Misty Marsh', theme: 'forest',
    rows: [
      '........',
      '..~~....',
      '.~~~~...',
      '..~~~~#.',
      '.#~~~~..',
      '...~~~~.',
      '....~~..',
      '........',
    ],
  },
  firepit: {
    id: 'firepit', name: 'Fire Pit Arena', theme: 'ember',
    rows: [
      '........',
      '.#....#.',
      '...^^...',
      '..^^^^..',
      '..^^^^..',
      '...^^...',
      '.#....#.',
      '........',
    ],
  },
  corridor: {
    id: 'corridor', name: 'The Corridor', theme: 'graveyard',
    rows: [
      '........',
      '.##..##.',
      '.#....#.',
      '.#.~~.#.',
      '.#.~~.#.',
      '.#....#.',
      '.##..##.',
      '........',
    ],
  },
  // A town square. The stall *fronts* are barricades (`+`): you cannot walk
  // through a market stall, but you can shoot over the counter, and whoever is
  // behind one has half cover and somewhere to duck out of sight. The corner
  // buildings stay solid walls. This map's comment always claimed cover to
  // duck behind and lanes to flank down; until barricades existed it had only
  // the lanes.
  village: {
    id: 'village', name: 'Market Square', theme: 'village',
    rows: [
      '........',
      '.#....#.',
      '..++++..',
      '........',
      '........',
      '..++++..',
      '.#....#.',
      '........',
    ],
  },
  // A grassy clearing: trees (`#`, solid, and they break line of sight) among
  // shrubs (`+`, which you can see over and shoot through but not walk through).
  // Mixing the two is what gives an archer somewhere to stand that is neither
  // fully exposed nor fully blind.
  grove: {
    id: 'grove', name: 'Sunlit Grove', theme: 'forest',
    rows: [
      '........',
      '..#...+.',
      '......#.',
      '...+....',
      '....#...',
      '.+......',
      '.#...+..',
      '........',
    ],
  },
  // Denser woodland: two thickets of trees frame a central glade, with a
  // shrub-lined lane down each flank. More cover, tighter approaches.
  thicket: {
    id: 'thicket', name: 'Bramble Thicket', theme: 'forest',
    rows: [
      '........',
      '.#.##.#.',
      '.#....#.',
      '...##...',
      '...##...',
      '.#....#.',
      '.#.##.#.',
      '........',
    ],
  },
  // A sunken causeway: two channels of black water (difficult) flanking a dry
  // central lane. Melee presses up the middle; the reeds slow anyone who strays.
  bog: {
    id: 'bog', name: 'The Black Ford', theme: 'bog',
    rows: [
      '........',
      '...~~...',
      '.~~..~~.',
      '..~..~..',
      '..~..~..',
      '.~~..~~.',
      '...~~...',
      '........',
    ],
  },
  // A road ambush at range: open ground funneled by rock. Attackers start far
  // enough away that ranged rounds happen before contact.
  pass: {
    id: 'pass', name: 'The High Pass', theme: 'stone',
    rows: [
      '........',
      '.#....#.',
      '........',
      '#..~~..#',
      '##....##',
      '#......#',
      '........',
      '.#....#.',
      '..~..~..',
      '........',
      '.#....#.',
      '........',
    ],
  },
  // A defended climb toward a perch: the far quarter is high ground behind a
  // choke, made for a flyer or archer that wants to be shot at last.
  cliff: {
    id: 'cliff', name: 'The Toll-Cliff', theme: 'stone',
    rows: [
      '........',
      '.#....#.',
      '###..###',
      '........',
      '..~..~..',
      '........',
      '.~....~.',
      '........',
      '........',
      '..#..#..',
      '........',
      '........',
    ],
  },
};

/**
 * Tall maps (8×12): the same width as every other map — so cells stay
 * finger-sized on a phone — but half again as deep. 60 ft of board instead of
 * 40 means two full moves to close, which is what makes bows, spells, and
 * positioning matter before the lines meet. Reserve these for fights that
 * want an approach: ambushes at range, boss arenas, a defended climb.
 */
export const MAP_IDS = Object.keys(MAPS);

/**
 * The deployment rank furthest from the player's (y = height-1). Callers used
 * to hardcode 7, which silently deployed every enemy mid-board on anything
 * taller than 8 — the far edge is a property of the map, not a constant.
 */
export function farRank(mapId?: string): number {
  const map = mapId ? MAPS[mapId] : undefined;
  return (map ? map.rows.length : 8) - 1;
}
