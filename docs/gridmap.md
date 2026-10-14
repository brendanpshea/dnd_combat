# Square maps: random dungeons and towns

`src/gridmap/` makes Gold Box-style maps: a fixed square of cells (16×16 by
default), every square a cell, and walls and doors on the edges between
cells, not in them. It is standalone. It imports nothing from the adventure
code but the seeded random generator, so another game can use it as it is.

```ts
import { generateDungeon, generateTown, edge, toAscii, placesLegend } from './src/gridmap/index.js';

const level = generateDungeon(42);                    // 16×16
const deeper = generateDungeon(43, { size: 24, stairsUp: true });
const town = generateTown(42, { places: [{ kind: 'inn', name: 'The Gilded Gull' }, { kind: 'temple', name: 'Tyr\'s House' }] });

edge(level, 3, 4, 'n');   // 'open' | 'wall' | 'door' | 'locked' | 'secret'
console.log(toAscii(town), placesLegend(town));
```

Preview any seed: `npx tsx scripts/gridmap-preview.ts [seed] [size]`.

## The map

A `GridMap` is plain data. A game can save it, draw it, or walk it.

- `size`, and the `seed` it was made from (the same seed and spec always
  make the same map).
- `area[y * size + x]`: which area a cell belongs to, or -1 for solid rock.
- `east[i]` and `south[i]`: the edge east of and south of each cell. Each
  edge is stored once; `edge(m, x, y, dir)` reads any side, and the map's
  border is always wall.
- `areas`: each room, corridor, street or building, with its cells, and a
  town building's `place` (`{ kind, name }`).
- `features`: the `entrance` (or `stairs-up`), `stairs-down`, and `special`
  squares, which are where a game puts encounters, traps or messages.

`distances(m, x, y, pass?)` gives the steps from a square to every other.
By default it walks through open edges and plain doors only.

## Dungeons

1. **Rooms:** rectangles (sides 2–4 by default), never touching one another.
2. **Corridors:** every other square is carved as a maze, so the map is
   dense, as Gold Box maps are.
3. **Doors:** a random spanning tree of plain doors joins every room to the
   corridors. Every square can be walked to without a key or a found secret
   door. A few second doors, in another wall of a room, make loops; those may
   be locked or secret.
4. **Dead ends:** some corridor tips are filled back in as rock.
5. **Features:** the entrance in a corridor at the map's edge, stairs down in
   the room farthest from it, and special squares in rooms.

`DungeonSpec`: `size` (8–64), `rooms`, `roomSize`, `loops`, `pruneDeadEnds`,
`locked`, `secret`, `specials` and `stairsUp`.

## Towns

A wall round the edge, and streets running the full width and height, at
least one each way, so every street joins every other. The blocks between
them are split into buildings of at most six squares. Each building has
exactly one door, onto a street. The town's places go into the larger
buildings with open doors; the rest are houses with locked doors. The gate
(the entrance) is a street square on the town wall.

`TownSpec`: `size` (8–64), `places` (default: inn, temple, shop, training
hall, city hall, tavern), `blockSize` and `maxBuilding`. A town that cannot
fit its places throws an error rather than leaving one out.

## What the tests promise

`test/gridmap.test.ts` checks every guarantee above over 120 seeds, at sizes
8 to 32:

- the same seed makes the same map;
- edges read the same from both sides;
- rock is walled in;
- every open square is reachable through plain doors;
- the stairs are at the far end;
- rooms only ever open onto corridors;
- loops, locked and secret doors and pruned dead ends all occur;
- every street joins every other, and the gate is on the wall;
- every building has exactly one door, and it opens onto a street;
- every place is housed.
