/**
 * Species balance harness: npx tsx scripts/species.ts [games]
 *
 * Species never meet in the mirror arena — both sides there are human — so the
 * normal gate can't tell whether a trait is worth anything or quietly broken.
 * This measures each species where it matters: a party of that species vs a
 * themed monster encounter, next to a human party's win rate on the same fights.
 * The gap is what the species is worth; the ×N is how often its signature
 * ability actually fired (a trait that only helps when unused is a different
 * story from one that helps because the AI reaches for it).
 *
 * Each (species, encounter) cell is an independent process, so a full read is a
 * couple of waves across the cores, not a serial slog — and it needs only a
 * dozen-ish games per cell, since we're looking for large deltas, not decimals.
 */
import { spawn } from 'node:child_process';
import { cpus } from 'node:os';
import { fileURLToPath } from 'node:url';
import * as path from 'node:path';

const games = Number(process.argv[2] ?? 12);

// Level-3 fights with real bite (so win rate has headroom) and high enough that
// level-3 traits like Faerie Fire are online. Parties are built at level 3.
const ENCOUNTERS = ['ogre', 'crypt', 'spiders'];

// Species with a signature spell to watch; the rest are passive (no ×N).
const SIGNATURE: Record<string, string | undefined> = {
  human: undefined, dwarf: undefined, orc: undefined,
  elf: 'faerie-fire', dragonborn: 'breath-weapon', tiefling: 'ray-of-sickness',
  gnome: 'animal-friendship',
};

const here = path.dirname(fileURLToPath(import.meta.url));
function cell(speciesId: string, encounterId: string): Promise<{ wins: number; casts: number; downs: number; games: number }> {
  return new Promise((resolve, reject) => {
    const args = [speciesId, encounterId, String(games), SIGNATURE[speciesId] ?? ''];
    const child = spawn(process.execPath, ['--import', 'tsx', path.join(here, 'species-shard.ts'), ...args],
      { stdio: ['ignore', 'pipe', 'inherit'] });
    let out = '';
    child.stdout.on('data', (d) => (out += d));
    child.on('error', reject);
    child.on('close', (code) => (code === 0 ? resolve(JSON.parse(out)) : reject(new Error(`shard ${code}`))));
  });
}

// Fire every cell at once; the OS scheduler fills the cores.
const speciesList = Object.keys(SIGNATURE);
const jobs = speciesList.flatMap((sp) => ENCOUNTERS.map((e) => ({ sp, e })));
console.log(`Species balance — ${games} games/cell, ${jobs.length} cells across ${Math.min(cpus().length, jobs.length)} cores...\n`);
const results = await Promise.all(jobs.map(({ sp, e }) => cell(sp, e).then((r) => ({ sp, e, ...r }))));

const stat = (sp: string, e: string) => {
  const r = results.find((x) => x.sp === sp && x.e === e)!;
  return { pct: r.wins / r.games, downs: r.downs / r.games, casts: r.casts };
};

// Heroes-downed/game is the balance signal — it has headroom even when every
// party wins, and it's exactly what a defensive trait (fire resist, an outline
// that ends a fight faster) moves. Win% is shown only when it slips below 100.
console.log(['species'.padEnd(11), ...ENCOUNTERS.map((e) => e.padEnd(20))].join(''));
for (const sp of speciesList) {
  const cells = ENCOUNTERS.map((e) => {
    const { pct, downs, casts } = stat(sp, e);
    const base = stat('human', e).downs;
    const delta = sp === 'human' ? '' : ` (${downs - base <= 0 ? '' : '+'}${(downs - base).toFixed(1)})`;
    const lost = pct < 1 ? ` ${(pct * 100).toFixed(0)}%w` : '';
    const cast = SIGNATURE[sp] ? ` ×${casts}` : '';
    return `${downs.toFixed(1)}dn${delta}${lost}${cast}`.padEnd(22);
  });
  console.log(sp.padEnd(11) + cells.join(''));
}
console.log('\ncolumns: heroes-downed/game (delta vs human) [win% if <100] ×signature-casts');
