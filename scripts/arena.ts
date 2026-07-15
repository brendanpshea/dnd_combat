/**
 * Arena CLI: npx tsx scripts/arena.ts [games] [preset]
 * Pits the simulation AI against greedy over seeded mirror matches.
 */
import { runArena } from '../src/ai/arena.js';
import { chooseAction } from '../src/ai/greedy.js';
import { chooseActionSim, SIM_PRESETS } from '../src/ai/simulated.js';

const n = Number(process.argv[2] ?? 50);
const preset = (process.argv[3] ?? 'normal') as keyof typeof SIM_PRESETS;
const seeds = Array.from({ length: n }, (_, i) => i + 1);

console.log(`Arena: sim(${preset}) vs greedy — ${n} seeds × 2 sides...`);
const t0 = Date.now();
const result = runArena(
  (s, id) => chooseActionSim(s, id, SIM_PRESETS[preset]),
  chooseAction,
  seeds,
);
const secs = ((Date.now() - t0) / 1000).toFixed(1);
console.log(
  `sim wins ${result.aWins}/${result.games} (${(result.aWinRate * 100).toFixed(1)}%), ` +
  `greedy ${result.bWins}, stalls ${result.stalls} — ${secs}s`,
);
