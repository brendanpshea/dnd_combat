# Square maps: random dungeons and towns

`src/gridmap/` makes Gold Box-style maps: a fixed square of cells (16×16 by
default), every square a cell, and walls and doors on the edges between
cells, not in them. It is standalone. It imports nothing from the adventure
code but the seeded random generator, so another game can use it as it is.

```ts
import { generateDungeon, generateLevels, generateTown, edge, toAscii, placesLegend } from './src/gridmap/index.js';

const level = generateDungeon(42);                    // 16×16
const crypt = generateDungeon(43, { size: 24, theme: 'crypt', keys: 2, boss: true });
const stack = generateLevels(44, { levels: 4, themes: ['classic', 'maze', 'crypt', 'halls'] });
const town = generateTown(42, { places: [{ kind: 'inn', name: 'The Gilded Gull' }, { kind: 'temple', name: 'Tyr\'s House' }] });

edge(level, 3, 4, 'n');   // 'open' | 'wall' | 'door' | 'locked' | 'secret'
console.log(toAscii(town), placesLegend(town));
```

Preview any seed: `npx tsx scripts/gridmap-preview.ts [seed] [size] [theme] [levels]`.

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
- `features`: markers on squares. The way in (`entrance`, or `stairs-up` on a
  deeper level), `stairs-down`, `key` (with the key's name), `encounter`,
  `sub-boss`, `boss`, `treasure`, and `special` squares, where a game puts
  traps or messages.
- `locks`: doors that a named key opens. A `locked` edge with no lock here
  has no key: it is picked or broken.
- `theme` and `level`, for a dungeon.

`distances(m, x, y, pass?, keys?)` gives the steps from a square to every
other. By default it walks through open edges and plain doors only, and
through a keyed door when its key is in `keys`. `solve(m)` walks the map as a
player would, picking up each key it reaches. It returns the keys in the order
found and every square reached.

## Dungeons

1. **Rooms:** rectangles (sides 2–4 by default), never touching one another.
2. **Corridors:** every other square is carved as a maze, so the map is
   dense, as Gold Box maps are.
3. **Doors:** a random spanning tree of plain doors joins every room to the
   corridors. Every square can be walked to without a key or a found secret
   door. A few second doors, in another wall of a room, make loops; those may
   be locked or secret.
4. **Dead ends:** some corridor tips are filled back in as rock.
5. **The way in:** an entrance in a corridor at the map's edge, or stairs up
   on the square `upAt` names.
6. **Boss** (`boss: true`): in the farthest room that can be locked without
   cutting anything else off. Its door opens to the `boss` key, which the
   sub-boss holds in the farthest room left open. The boss room has treasure.
7. **Stairs down:** in the deepest room still open. On a level with no boss,
   a sub-boss (`subBoss: true`) guards them.
8. **Keyed rooms** (`keys: n`): rooms locked with `key-1`, `key-2`…, each with
   treasure. Each key lies on an open square, a room if there is one. A room
   is only locked if the rest of the level can still be reached without it,
   so no key is ever shut behind its own door.
9. **Encounters and special squares:** encounters spread at least three steps
   apart and away from the way in; special squares in rooms. No two markers
   share a square.

`DungeonSpec`: `size` (8–64), `theme`, `rooms`, `roomSize`, `loops`,
`pruneDeadEnds`, `locked`, `secret`, `upAt`, `stairsDown`, `boss`,
`subBoss`, `keys`, `encounters`, `specials` and `level`.

### Layout themes

A theme (`THEMES`) sets the knobs for a kind of place; anything given in the
spec overrides it. On a small map, a theme's rooms shrink to fit.

| Theme | The place |
|---|---|
| `classic` | rooms and winding corridors |
| `maze` | mostly passages, a few cells of room, dead ends left in |
| `halls` | great halls, short corridors, more ways round |
| `caves` | open caverns and tunnels: no doors, many loops |
| `crypt` | many small vaults, tight passages, secret doors |

### Levels

`generateLevels(seed, { levels, themes?, ...spec })` stacks levels. Each
level's stairs up stand on the square of the stairs down above it, so a party
going down arrives where it left. A sub-boss guards each level's stairs down,
and the boss waits on the last level, unless `boss: false`. `themes` gives a
theme to each level, top first.

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

`test/gridmap.test.ts` checks every guarantee above over many seeds, at sizes
8 to 32, for every theme:

- the same seed makes the same map;
- edges read the same from both sides;
- rock is walled in;
- every open square is reachable through plain doors;
- the stairs are in the deepest room;
- every level is solvable by collecting keys, every lock has its key, and
  every lock shuts something away;
- the boss can be reached only with its key, and the sub-boss holds that key;
- encounters are spread apart, and no two markers share a square;
- the themes differ as they say (halls bigger, crypts smaller, caves doorless);
- in a stack, every stairs down lands on the next level's stairs up;
- rooms only ever open onto corridors;
- loops, locked and secret doors and pruned dead ends all occur;
- every street joins every other, and the gate is on the wall;
- every building has exactly one door, and it opens onto a street;
- every place is housed.
