/**
 * Prints random square maps (src/gridmap) as text:
 *   npx tsx scripts/gridmap-preview.ts [seed] [size] [theme] [levels]
 * Legend: E entrance, < > stairs, k key, K keyed door, L locked, S secret,
 * D door, ! encounter, b sub-boss, B boss, $ treasure, * special, ## rock.
 */
import { generateLevels, generateTown, toAscii, placesLegend } from '../src/gridmap/index.js';

const seed = Number(process.argv[2] ?? 1);
const size = Number(process.argv[3] ?? 16);
const theme = process.argv[4] ?? 'classic';
const levels = Number(process.argv[5] ?? 2);
generateLevels(seed, { size, theme, levels, keys: 1 }).forEach((m, i) => {
  console.log(`Dungeon level ${i + 1} of ${levels}, ${theme}, seed ${seed}, ${size}x${size}\n`);
  console.log(toAscii(m), '\n');
});
const town = generateTown(seed, { size });
console.log(`Town, seed ${seed}, ${size}x${size}\n`);
console.log(toAscii(town));
console.log(placesLegend(town));
