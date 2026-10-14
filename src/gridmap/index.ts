/**
 * Square maps of a fixed size, walls and doors on the edges between cells
 * (Gold Box style): random dungeons and towns. Standalone: a game imports
 * these and walks the map however it likes. Overview in docs/gridmap.md.
 */
export * from './grid.js';
export { generateDungeon, type DungeonSpec } from './dungeon.js';
export { generateTown, DEFAULT_PLACES, type TownSpec, type TownPlace } from './town.js';
