/**
 * One slice of the gambit pricing run: fights the given seeds against every
 * outcome and prints a JSON tally on stdout. Spawned by gambit-price.ts — not
 * meant to be run by hand.
 *
 * Emits win/loss as a bitstring per level per outcome, INCLUDING the baseline
 * under the empty key. The parent does all the pairing, so the McNemar
 * arithmetic lives in exactly one place; a shard that computed its own deltas
 * would have to be trusted to have used the same baseline, and that is the one
 * thing a merged result cannot check.
 *
 * The bitstrings are in this shard's seed order, which is what keeps a
 * baseline entry and an outcome entry describing the same fight.
 */
import { LEVELS, OUTCOMES, outcomes } from './gambit-table.js';

const seeds = process.argv[2]!.split(',').map(Number);
const out: Record<string, Record<number, string>> = {};

const bits = (won: boolean[]) => won.map((w) => (w ? '1' : '0')).join('');

for (const level of LEVELS) {
  (out[''] ??= {})[level] = bits(outcomes(level, undefined, seeds));
  for (const o of OUTCOMES) {
    (out[o.name] ??= {})[level] = bits(outcomes(level, o, seeds));
  }
}

process.stdout.write(JSON.stringify(out));
