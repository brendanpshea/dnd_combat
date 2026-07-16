/**
 * One arena shard: plays the given seeds and prints a JSON tally on stdout.
 * Spawned by scripts/arena.ts — not meant to be run by hand.
 */
import { runArena } from '../src/ai/arena.js';
import { chooseAction } from '../src/ai/greedy.js';
import { chooseActionSim, SIM_PRESETS } from '../src/ai/simulated.js';

const seeds = process.argv[2]!.split(',').map(Number);
const preset = process.argv[3] as keyof typeof SIM_PRESETS;

const result = runArena(
  (s, id) => chooseActionSim(s, id, SIM_PRESETS[preset]),
  chooseAction,
  seeds,
);
process.stdout.write(JSON.stringify(result));
