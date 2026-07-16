/**
 * Arena CLI: npx tsx scripts/arena.ts [games] [preset] [--serial]
 * Pits the simulation AI against greedy over seeded mirror matches.
 *
 * Games are independent, so seeds are dealt across one child process per core.
 * Results are identical to a serial run — each game is driven solely by its own
 * seed — but a full read takes a fraction of the wall clock, which is the
 * difference between measuring a change and guessing at it. `--serial` runs
 * in-process, for profiling or debugging a single game.
 */
import { spawn } from 'node:child_process';
import { cpus } from 'node:os';
import { fileURLToPath } from 'node:url';
import * as path from 'node:path';
import { runArena, type ArenaResult } from '../src/ai/arena.js';
import { chooseAction } from '../src/ai/greedy.js';
import { chooseActionSim, SIM_PRESETS } from '../src/ai/simulated.js';

const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const serial = process.argv.includes('--serial');
const n = Number(args[0] ?? 50);
const preset = (args[1] ?? 'normal') as keyof typeof SIM_PRESETS;
const seeds = Array.from({ length: n }, (_, i) => i + 1);

function runShard(shardSeeds: number[]): Promise<ArenaResult> {
  const here = path.dirname(fileURLToPath(import.meta.url));
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      ['--import', 'tsx', path.join(here, 'arena-shard.ts'), shardSeeds.join(','), preset],
      { stdio: ['ignore', 'pipe', 'inherit'] },
    );
    let out = '';
    child.stdout.on('data', (d) => (out += d));
    child.on('error', reject);
    child.on('close', (code) =>
      code === 0 ? resolve(JSON.parse(out) as ArenaResult) : reject(new Error(`shard exited ${code}`)),
    );
  });
}

const t0 = Date.now();
let result: ArenaResult;

if (serial || n < 4) {
  console.log(`Arena: sim(${preset}) vs greedy — ${n} seeds × 2 sides (serial)...`);
  result = runArena((s, id) => chooseActionSim(s, id, SIM_PRESETS[preset]), chooseAction, seeds);
} else {
  // Round-robin rather than contiguous blocks: game length varies a lot by
  // seed, so dealing them out keeps one shard from drawing all the long games
  // and leaving the other cores idle.
  const workers = Math.min(cpus().length, n);
  const shards: number[][] = Array.from({ length: workers }, () => []);
  seeds.forEach((s, i) => shards[i % workers]!.push(s));
  console.log(`Arena: sim(${preset}) vs greedy — ${n} seeds × 2 sides across ${workers} processes...`);
  const parts = await Promise.all(shards.map(runShard));
  result = parts.reduce(
    (acc, p) => ({
      games: acc.games + p.games,
      aWins: acc.aWins + p.aWins,
      bWins: acc.bWins + p.bWins,
      stalls: acc.stalls + p.stalls,
      aWinRate: 0,
    }),
    { games: 0, aWins: 0, bWins: 0, stalls: 0, aWinRate: 0 },
  );
  result.aWinRate = result.aWins / result.games;
}

const secs = ((Date.now() - t0) / 1000).toFixed(1);
// A win rate off N games carries a standard error of ~sqrt(0.25/N); printing it
// stops a 50-game read of "52%" being mistaken for a real gain over 50%. Two
// runs inside ~2 SE of each other are indistinguishable — re-measure on more
// games (or the same seeds) rather than believing the prettier number.
const sePts = (100 * Math.sqrt(0.25 / result.games)).toFixed(1);
console.log(
  `sim wins ${result.aWins}/${result.games} (${(result.aWinRate * 100).toFixed(1)}% ± ${sePts}), ` +
  `greedy ${result.bWins}, stalls ${result.stalls} — ${secs}s`,
);
