/**
 * What is a pre-fight gambit actually worth, in fights won and lost?
 *
 * The table itself lives in gambit-table.ts; this runs it and reports.
 *
 *   npx tsx scripts/gambit-price.ts [samplesPerLevel] [--serial]
 *
 * WHY IT SHARDS
 *
 * A run is samples x levels x outcomes fights, each up to 600 greedy decisions
 * — twenty-odd thousand fights, which took a quarter of an hour on one core
 * while the other three sat idle.
 *
 * Sharding by SEED rather than by outcome is what makes the merge exact: every
 * shard fights its own slice against both the baseline and every outcome, so a
 * baseline entry and an outcome entry always describe the same fight, and
 * concatenating the shards reproduces the serial result rather than
 * approximating it.
 *
 * Sharding by outcome would have been simpler and wrong twice over: every
 * worker would re-fight the whole baseline, and the pairing would depend on
 * each having computed the same one — the one thing a merged tally cannot
 * check.
 *
 * Seeds are dealt round-robin, not in blocks. Fight length varies enormously —
 * a stalemate runs to the 600-step cap — so contiguous blocks let one shard
 * draw all the long games and leave three cores waiting on it.
 */
import { spawn } from 'node:child_process';
import { cpus } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { LEVELS, OUTCOMES, GAMBITS } from './gambit-table.js';

const SAMPLES = Number(process.argv[2] ?? 120);
const SERIAL = process.argv.includes('--serial');

/** How far a single measured win rate can sit from the truth, at this n. */
const MARGIN = 100 * 1.96 * Math.sqrt(0.25 / SAMPLES);

type Shard = Record<string, Record<number, string>>;

function runShard(seeds: number[]): Promise<Shard> {
  const here = path.dirname(fileURLToPath(import.meta.url));
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      ['--import', 'tsx', path.join(here, 'gambit-shard.ts'), seeds.join(',')],
      { stdio: ['ignore', 'pipe', 'inherit'] },
    );
    let out = '';
    child.stdout.on('data', (d) => (out += d));
    child.on('error', reject);
    child.on('close', (code) =>
      code === 0 ? resolve(JSON.parse(out) as Shard) : reject(new Error(`shard exited ${code}`)),
    );
  });
}

const allSeeds = Array.from({ length: SAMPLES }, (_, i) => i + 1);
// At least eight seeds per worker: below that the tsx startup cost per process
// is a bigger share of the run than the work it saves.
const workers = SERIAL ? 1 : Math.max(1, Math.min(cpus().length, Math.ceil(SAMPLES / 8)));
const shards: number[][] = Array.from({ length: workers }, () => []);
allSeeds.forEach((s, i) => shards[i % workers]!.push(s));

console.log(`n=${SAMPLES} per level, ${OUTCOMES.length} outcomes, ${LEVELS.length} levels, ` +
  `${workers} process${workers > 1 ? 'es' : ''}.`);
console.log(`A single win rate is +/-${MARGIN.toFixed(0)} points; deltas are paired ` +
  `(same waves, same party, same seed), so they are tighter than that.\n`);

const t0 = Date.now();
const parts = await Promise.all(shards.map(runShard));

/** Every shard's bits for one key, concatenated in shard order. */
function joined(key: string, level: number): boolean[] {
  const bits: boolean[] = [];
  for (const part of parts) {
    for (const ch of part[key]?.[level] ?? '') bits.push(ch === '1');
  }
  return bits;
}

const rate = (won: boolean[]) => (100 * won.filter(Boolean).length) / won.length;

/**
 * The paired delta, and how much of it is signal.
 *
 * Every column fights the same fights, so the only samples carrying information
 * about an outcome are the ones it FLIPPED. Reading two independent win rates
 * and subtracting throws that away and reports a confidence interval twice as
 * wide as the experiment earned — at n=250 that is +/-6 points against +/-2,
 * the difference between "these two outcomes are the same size" being a finding
 * and being unmeasurable.
 *
 * b = the outcome lost a fight the baseline won; c = it won one the baseline
 * lost. The delta is (c - b)/n, its standard error sqrt(b + c)/n — the McNemar
 * form, which cares only about the discordant pairs.
 */
function paired(base: boolean[], test: boolean[]): { delta: number; se: number } {
  let b = 0;
  let c = 0;
  for (const [i, won] of base.entries()) {
    if (won && !test[i]) b++;
    if (!won && test[i]) c++;
  }
  const n = base.length;
  return { delta: (100 * (c - b)) / n, se: (100 * Math.sqrt(b + c)) / n };
}

const sign = (n: number) => `${n > 0 ? '+' : ''}${n.toFixed(0)}`;

console.log(`baseline win rate   ${LEVELS.map((l) => `L${l} ${rate(joined('', l)).toFixed(0)}%`).join('   ')}\n`);

const measured = new Map<string, { delta: number; se: number }>();
for (const o of OUTCOMES) {
  const ps = LEVELS.map((l) => paired(joined('', l), joined(o.name, l)));
  const delta = ps.reduce((a, p) => a + p.delta, 0) / ps.length;
  const se = Math.sqrt(ps.reduce((a, p) => a + p.se * p.se, 0)) / ps.length;
  measured.set(o.name, { delta, se });
  console.log(`  ${o.name.padEnd(26)} ${sign(delta).padStart(5)} +/-${(1.96 * se).toFixed(1)}   ` +
    ps.map((x, k) => `L${LEVELS[k]} ${sign(x.delta)}`).join('  '));
}

/*
 * The pair table.
 *
 * SWING is what the gamble is worth: the distance between winning the roll and
 * losing it, which is the number a player feels. TILT is how lopsided it is — a
 * success worth +20 beside a failure worth -3 is not a gamble, it is a button
 * you always press, however dramatic the dice look.
 */
console.log(`\n${'skill'.padEnd(14)} ${'gambit'.padEnd(38)} ${'success'.padStart(8)} ${'failure'.padStart(8)} ${'swing'.padStart(7)} ${'tilt'.padStart(6)}`);
console.log('-'.repeat(85));
for (const g of GAMBITS) {
  const s1 = measured.get(g.success.name)!;
  const f1 = measured.get(g.failure.name)!;
  console.log(
    `${g.skill.padEnd(14)} ${g.flavour.padEnd(38)} ${sign(s1.delta).padStart(8)} ${sign(f1.delta).padStart(8)} ` +
    `${(s1.delta - f1.delta).toFixed(0).padStart(7)} ${sign(s1.delta + f1.delta).padStart(6)}`,
  );
}
console.log(`\n${((Date.now() - t0) / 1000).toFixed(0)}s`);
