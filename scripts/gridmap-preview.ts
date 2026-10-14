/**
 * Prints a random square dungeon and town (src/gridmap) as text:
 *   npx tsx scripts/gridmap-preview.ts [seed] [size]
 */
import { generateDungeon, generateTown, toAscii, placesLegend } from '../src/gridmap/index.js';

const seed = Number(process.argv[2] ?? 1);
const size = Number(process.argv[3] ?? 16);
console.log(`Dungeon, seed ${seed}, ${size}x${size}\n`);
console.log(toAscii(generateDungeon(seed, { size })));
const town = generateTown(seed, { size });
console.log(`\nTown, seed ${seed}, ${size}x${size}\n`);
console.log(toAscii(town));
console.log(placesLegend(town));
