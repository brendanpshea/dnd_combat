/**
 * What a generated wave actually looks like, feature by feature.
 *
 * The first pass at eligibility rules produced a pool of eleven-plus skills
 * with five of them eligible in 100% of fights, which is not "the fight
 * licenses these skills" — it is "everything, always", and a card that says
 * "Acrobatics — ground to slip through" before every single combat has no more
 * connection to the fiction than a card that says nothing.
 *
 * The rules were guesses about what is rare. This measures it instead: how
 * often each creature type shows up, what the sharpest mind on the field
 * usually is, how much of each terrain a board carries, and how big the
 * warbands get. Thresholds written against these numbers can actually
 * discriminate.
 *
 * Run: npx tsx scripts/gambit-features.ts
 */
import { buildWave } from '../src/arena/run.js';
import { MONSTERS } from '../src/data/monsters.js';
import { parseMap } from '../src/data/maps.js';
import type { CreatureType, CreatureSize } from '../src/engine/types.js';

const LEVELS = [1, 3, 5, 7];
const RUNS = 60;
const WAVES = 6;
const HALVES = ['morning', 'afternoon'] as const;
const DOORS = 3;

const typeCount = new Map<CreatureType, number>();
const sizeCount = new Map<CreatureSize, number>();
const intBuckets = new Map<string, number>();
const coverBuckets = new Map<string, number>();
const diffBuckets = new Map<string, number>();
const countBuckets = new Map<number, number>();
let fights = 0;

const bump = <K,>(m: Map<K, number>, k: K) => m.set(k, (m.get(k) ?? 0) + 1);
const bucket = (n: number, edges: number[]): string => {
  for (const e of edges) if (n <= e) return `<=${e}`;
  return `>${edges[edges.length - 1]}`;
};

for (const level of LEVELS) {
  for (let seed = 1; seed <= RUNS; seed++) {
    for (let wave = 1; wave <= WAVES; wave++) {
      for (const half of HALVES) {
        for (let door = 0; door < DOORS; door++) {
          const w = buildWave(seed, level, wave, undefined, door, half);
          const grid = parseMap(w.map);
          const types = new Set<CreatureType>();
          const sizes = new Set<CreatureSize>();
          let maxInt = 0;
          for (const id of w.encounter.members) {
            const m = MONSTERS[id];
            if (!m) continue;
            types.add(m.creatureType);
            sizes.add(m.size);
            maxInt = Math.max(maxInt, m.abilities.int);
          }
          for (const t of types) bump(typeCount, t);
          for (const s of sizes) bump(sizeCount, s);
          bump(intBuckets, bucket(maxInt, [3, 5, 7, 9, 11, 13]));
          bump(coverBuckets, bucket(grid.cells.filter((c) => c.terrain === 'cover').length, [0, 4, 8, 16]));
          bump(diffBuckets, bucket(grid.cells.filter((c) => c.terrain === 'difficult').length, [0, 4, 8, 16]));
          bump(countBuckets, w.encounter.members.length);
          fights++;
        }
      }
    }
  }
}

const show = <K,>(title: string, m: Map<K, number>) => {
  console.log(`\n${title}  (n=${fights} fights)`);
  for (const [k, n] of [...m.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(k).padEnd(14)} ${((100 * n) / fights).toFixed(1).padStart(5)}%`);
  }
};

show('creature types present in a fight', typeCount);
show('creature sizes present', sizeCount);
show('sharpest Intelligence on the field', intBuckets);
show('cover cells on the board', coverBuckets);
show('difficult cells on the board', diffBuckets);
show('how many monsters', countBuckets);
