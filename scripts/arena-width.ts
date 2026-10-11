/**
 * Does a wider board make position matter?
 *
 * THE QUESTION, AND WHY THIS IS THE INSTRUMENT FOR IT
 *
 * `arena/deploy.ts` and `arena/map.ts` both record the same measurement, taken
 * when the board was an 8x8 box: *a party that never took a step won as often
 * as one played properly*. That is what "the board is too small for tactics"
 * actually means, and it is the thing a bigger board is supposed to fix. So the
 * way to choose a width is to run that measurement again at several of them and
 * see where the refusal to move starts costing something.
 *
 * Depth was already chosen this way — the note in `arena/map.ts` reports the
 * cost of standing still at 8, 12 and 20 rows. This is the same experiment on
 * the other axis, which is the one a camera has just unlocked.
 *
 * WHAT IS HELD, AND WHAT MOVES
 *
 * Only the width. Same depth (12), same party, same encounter budget, same
 * seeds, same deployment rule, same AI on both sides. The terrain scales with
 * the board rather than staying an 8-wide stamp in the middle of a wider one,
 * so the blocked fraction stays near constant (measured: 8.1% at width 8 to
 * 6.5% at 20) and the extra columns are not simply extra bare floor.
 *
 * THE PAIRING IS THE POINT
 *
 * Each seed fights the SAME fight twice — same map, same monsters, same
 * deployment, same combat seed — once played properly and once with the party
 * forbidden to move. Only the pairs that DISAGREE carry information, so the
 * delta is read McNemar-style (SE = sqrt(b + c) / n) and is far tighter than
 * subtracting two independent win rates would be.
 *
 * Fights are fought at `evenBudgetFor(level)`, the measured budget where a
 * standard party wins about half its fights. A 50% baseline is where a win
 * rate is most sensitive to anything done to it; at 90% or 10% the ceiling and
 * the floor eat the effect being measured.
 *
 * HOW A PARTY IS MADE TO STAND STILL
 *
 * Its movement is spent before every decision, so `moveDestinations` returns
 * nothing and the real AI simply never sees a move to score. Nothing about the
 * AI is stubbed or scored differently — it plays the same way, from a position
 * it cannot leave. (Re-spent before every call, so a Dash cannot hand it back.)
 *
 *   npx tsx scripts/arena-width.ts [seedsPerCell] [--serial] [--widths 8,12,16]
 */
import { spawn } from 'node:child_process';
import { cpus } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const LEVELS = [1, 3, 5];
const DEFAULT_WIDTHS = [8, 12, 16, 20];
const DEFAULT_DEPTHS = [12];

const arg = (flag: string) => {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
};
const SEEDS = Number(process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : 150);
const SERIAL = process.argv.includes('--serial');
const WIDTHS = (arg('--widths')?.split(',').map(Number) ?? DEFAULT_WIDTHS).filter((n) => n > 0);
/*
 * Depth is swept too, and that is the instrument's own control. `arena/map.ts`
 * records the cost of standing still at 8, 12 and 20 rows — a measurement
 * taken before this script existed. If this cannot reproduce the shape of it,
 * nothing it says about WIDTH is worth reading either.
 */
const DEPTHS = (arg('--depths')?.split(',').map(Number) ?? DEFAULT_DEPTHS).filter((n) => n > 0);
/*
 * Which deployment, and why it is an option at all.
 *
 * The recorded depth result predates `arena/deploy.ts`: back then "both sides
 * deploy on opposite back ranks, every fight, forever", and the free approach
 * phase that created is exactly what made depth worth measuring. Varied
 * patterns were added to remove it. So "far-rank" reproduces the conditions
 * the old number was taken under, and the default — whatever `deployFoes`
 * rolls — is the game as it is played now.
 */
const DEPLOY = arg('--deploy') ?? 'mixed';
/** The fight's brief and ground — see src/arena/encounter.ts and map.ts. */
const BRIEF = arg('--brief') ?? 'mixed';
const LAYOUT = arg('--layout') ?? 'auto';
const ROLES = process.argv.includes('--roles') ? 'roles' : 'anywhere';

/** `width|depth|level` -> the two columns' bits, and the plays column's timings. */
type Shard = Record<string, { plays: string; stands: string; rounds: number[]; contact: number[] }>;

function runShard(seeds: number[]): Promise<Shard> {
  const here = path.dirname(fileURLToPath(import.meta.url));
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      ['--import', 'tsx', path.join(here, 'arena-width-shard.ts'),
        seeds.join(','), WIDTHS.join(','), LEVELS.join(','), DEPTHS.join(','),
        DEPLOY, BRIEF, LAYOUT, ROLES],
      { stdio: ['ignore', 'pipe', 'inherit'] },
    );
    let out = '';
    child.stdout.on('data', (d) => (out += d));
    child.on('error', reject);
    child.on('close', (code) =>
      code === 0 ? resolve(JSON.parse(out) as Shard) : reject(new Error(`shard exited ${code}`)));
  });
}

const allSeeds = Array.from({ length: SEEDS }, (_, i) => i + 1);
const workers = SERIAL ? 1 : Math.max(1, Math.min(cpus().length, Math.ceil(SEEDS / 4)));
const shards: number[][] = Array.from({ length: workers }, () => []);
// Round-robin, not blocks: a fight that stalls to the step cap costs many times
// what a decisive one does, and contiguous blocks would hand one worker a run
// of them while the rest idle.
allSeeds.forEach((s, i) => shards[i % workers]!.push(s));

console.log(`${SEEDS} seeds x ${WIDTHS.length} width(s) ${WIDTHS.join('/')} x ${DEPTHS.length} depth(s) ` +
  `${DEPTHS.join('/')} x ${LEVELS.length} levels | deploy ${DEPLOY} | brief ${BRIEF} | ` +
  `ground ${LAYOUT} | shooters ${ROLES} | ${workers} process${workers > 1 ? 'es' : ''}.`);
console.log('Fights are at the measured even budget, so the baseline sits near 50% where a win rate moves most.\n');

const t0 = Date.now();
const parts = await Promise.all(shards.map(runShard));

const bits = (key: string, column: 'plays' | 'stands'): boolean[] => {
  const out: boolean[] = [];
  for (const part of parts) for (const ch of part[key]?.[column] ?? '') out.push(ch === '1');
  return out;
};
const rate = (won: boolean[]) => (100 * won.filter(Boolean).length) / Math.max(1, won.length);
const nums = (key: string, field: 'rounds' | 'contact'): number[] =>
  parts.flatMap((part) => part[key]?.[field] ?? []);
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

/**
 * What standing still costs, and how much of that is signal.
 *
 * b = the fight was won when played and lost when standing; c = the reverse.
 * Only those carry information — the rest were decided by the dice and the
 * matchup, identically in both columns.
 */
function paired(play: boolean[], stand: boolean[]): { delta: number; se: number; n: number } {
  let b = 0, c = 0;
  for (const [i, won] of play.entries()) {
    if (won && !stand[i]) b++;
    if (!won && stand[i]) c++;
  }
  const n = play.length;
  return { delta: (100 * (b - c)) / n, se: (100 * Math.sqrt(b + c)) / n, n };
}

const sign = (n: number) => `${n > 0 ? '+' : ''}${n.toFixed(0)}`;

console.log(`${'board'.padEnd(8)} ${'level'.padEnd(6)} ${'plays'.padStart(7)} ${'stands'.padStart(7)} ${'cost of standing still'.padStart(24)} ${'rounds'.padStart(8)} ${'contact'.padStart(8)}`);
console.log('-'.repeat(74));
const byBoard = new Map<string, { delta: number; se: number }[]>();
for (const w of WIDTHS) {
  for (const h of DEPTHS) {
    for (const l of LEVELS) {
      const key = `${w}|${h}|${l}`;
      const p = bits(key, 'plays'), s = bits(key, 'stands');
      const d = paired(p, s);
      const board = `${w}x${h}`;
      if (!byBoard.has(board)) byBoard.set(board, []);
      byBoard.get(board)!.push(d);
      console.log(`${board.padEnd(8)} ${String(l).padEnd(6)} ${rate(p).toFixed(0).padStart(6)}% ` +
        `${rate(s).toFixed(0).padStart(6)}% ${`${sign(d.delta)} +/-${(1.96 * d.se).toFixed(1)}`.padStart(24)} ` +
        `${mean(nums(key, 'rounds')).toFixed(1).padStart(8)} ${mean(nums(key, 'contact')).toFixed(1).padStart(8)}`);
    }
  }
}

/*
 * THE SUMMARY CARRIES BOTH WIN RATES, not just the difference between them.
 *
 * The paired delta answers "does the AI's movement pay off here", and with
 * this AI the answer is usually no — which says more about the AI than about
 * the fight. "How often does a party that never moves WIN" answers the design
 * question directly: a fight that punishes standing still drives that number
 * down whether or not anything on the board knows how to exploit the
 * alternative.
 */
console.log(`\n${'board'.padEnd(8)} ${'plays'.padStart(7)} ${'stands'.padStart(7)} ` +
  `${'cost of standing still'.padStart(16)} ${'rounds'.padStart(8)} ${'to contact'.padStart(11)}`);
console.log('-'.repeat(80));
for (const [board, ds] of byBoard) {
  const [w, h] = board.split('x').map(Number) as [number, number];
  const delta = ds.reduce((a, d) => a + d.delta, 0) / ds.length;
  const se = Math.sqrt(ds.reduce((a, d) => a + d.se * d.se, 0)) / ds.length;
  const allRounds = LEVELS.flatMap((l) => nums(`${w}|${h}|${l}`, 'rounds'));
  const allContact = LEVELS.flatMap((l) => nums(`${w}|${h}|${l}`, 'contact'));
  const bar = '#'.repeat(Math.max(0, Math.round(delta / 2)));
  const allPlays = LEVELS.flatMap((l) => bits(`${w}|${h}|${l}`, 'plays'));
  const allStands = LEVELS.flatMap((l) => bits(`${w}|${h}|${l}`, 'stands'));
  console.log(`${board.padEnd(8)} ${`${rate(allPlays).toFixed(0)}%`.padStart(7)} ${`${rate(allStands).toFixed(0)}%`.padStart(7)} ` +
    `${`${sign(delta)} +/-${(1.96 * se).toFixed(1)}`.padStart(16)} ` +
    `${mean(allRounds).toFixed(1).padStart(8)} ${mean(allContact).toFixed(1).padStart(11)}  ${bar}`);
}
console.log(`\n${((Date.now() - t0) / 1000).toFixed(0)}s`);
