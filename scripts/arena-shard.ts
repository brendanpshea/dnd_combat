/**
 * One arena shard: plays the given seeds and prints a JSON tally on stdout.
 * Spawned by scripts/arena.ts — not meant to be run by hand.
 */
import { runArena } from '../src/ai/arena.js';
import { chooseAction } from '../src/ai/greedy.js';
import { chooseActionSim, SIM_PRESETS } from '../src/ai/simulated.js';

const seeds = process.argv[2]!.split(',').map(Number);
const preset = process.argv[3] as keyof typeof SIM_PRESETS;
// Optional per-field overrides, so a preset can be swept without editing it.
const opts = { ...SIM_PRESETS[preset], ...(process.argv[4] ? JSON.parse(process.argv[4]) : {}) };

const result = runArena(
  (s, id) => chooseActionSim(s, id, opts),
  chooseAction,
  seeds,
);
process.stdout.write(JSON.stringify(result));
