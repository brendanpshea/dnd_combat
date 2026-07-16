/**
 * Battle maps as ASCII art. Rows are listed top rank first (y = height-1),
 * matching how the board renders. Adding a map is a data edit.
 *
 *   .  open    #  wall (blocks movement + line of sight)
 *   ~  difficult (costs double movement)
 *   ^  hazard (1d4 fire when entered)
 *
 * Teams deploy on ranks 1 and 8 (y=0 and y=7), so those rows must stay
 * walkable where parties spawn (files b, c, e, g by default).
 */
import type { GridState, Cell, TerrainId } from '../engine/types.js';

/** Visual theme — the whole board is styled as a place, not just its terrain. */
export type MapTheme = 'stone' | 'forest' | 'graveyard' | 'ember';

export interface MapData {
  id: string;
  name: string;
  theme: MapTheme;
  rows: string[]; // height entries of width chars
}

const CHAR_TERRAIN: Record<string, TerrainId> = {
  '.': 'open', '#': 'wall', '~': 'difficult', '^': 'hazard',
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
};

export const MAP_IDS = Object.keys(MAPS);
