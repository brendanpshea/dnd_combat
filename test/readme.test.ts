/**
 * The README's headline numbers come from the data, so they cannot go stale.
 *
 * THE PROBLEM THIS EXISTS FOR
 *
 * The README claimed eight classes, 70 spells, 140 monsters and a 522-test
 * suite. By the time anyone read it properly there were twelve classes, 94
 * spells, 146 monsters and 2092 tests, the level cap had moved from 7 to 9, and
 * the main menu it described — "Campaign and Single battle" — had not existed
 * for a long time. Nothing was wrong with any individual edit; there was simply
 * nothing anywhere that would notice.
 *
 * This repo already applies the rule elsewhere: `docs/reference/` is generated
 * from `src/data/`, `art-registry.ts` from the art directory, `token-fill.ts`
 * from the token images, each with a `--check` the suite runs. A prose README
 * cannot be generated — it makes arguments, not lists — but the handful of
 * FACTS in it can be held to the same standard.
 *
 * So this checks the numbers and the links, and deliberately not the prose.
 * A test that pinned the wording would be a test that fights every improvement
 * to it.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { CLASSES } from '../src/data/classes.js';
import { SPELLS } from '../src/data/spells.js';
import { MONSTERS } from '../src/data/monsters.js';
import { ENCOUNTERS } from '../src/data/encounters.js';
import { MAPS } from '../src/data/maps.js';
import { SPECIES } from '../src/data/species.js';
import { MAX_LEVEL } from '../src/campaign/campaign.js';

const root = new URL('../', import.meta.url);
const readme = readFileSync(fileURLToPath(new URL('README.md', root)), 'utf8');

/** The number in the "What's in it" row whose label matches. */
function row(label: RegExp): number {
  const line = readme.split('\n').find((l) => l.startsWith('|') && label.test(l));
  expect(line, `no README row matching ${label}`).toBeDefined();
  const cell = line!.split('|')[2]!;
  const n = /\d[\d,]*/.exec(cell);
  expect(n, `no number in the README row for ${label}`).not.toBeNull();
  return Number(n![0].replace(/,/g, ''));
}

describe('the README counts match the data', () => {
  it.each([
    ['classes', /^\| Classes/, () => Object.keys(CLASSES).length],
    ['ancestries', /^\| Ancestries/, () => Object.keys(SPECIES).length],
    ['spells', /^\| Spells/, () => Object.keys(SPELLS).length],
    ['monsters', /^\| Monsters/, () => Object.keys(MONSTERS).length],
    ['encounters', /^\| Authored encounters/, () => Object.keys(ENCOUNTERS).length],
    ['maps', /^\| Maps/, () => Object.keys(MAPS).length],
  ])('%s', (_name, label, actual) => {
    expect(row(label)).toBe(actual());
  });

  it('states the real level cap', () => {
    expect(readme, `the README does not mention the level cap of ${MAX_LEVEL}`)
      .toMatch(new RegExp(`levels 1[–-]${MAX_LEVEL}`, 'i'));
  });

  it('counts the spellcasting monsters correctly', () => {
    const casters = Object.values(MONSTERS).filter((m) => m.spellcasting).length;
    expect(readme).toMatch(new RegExp(`${casters} cast spells`));
  });

  it('does not claim a fixed test total', () => {
    // The one number that cannot be checked from inside the suite without
    // circularity. A stale "522 tests" is what made the rest suspect, so if a
    // figure is quoted it must at least be the current order of magnitude.
    const quoted = /([\d,]+) tests across (\d+) files/.exec(readme);
    if (!quoted) return;
    expect(Number(quoted[1]!.replace(/,/g, '')),
      'the quoted test count is implausibly low — it has gone stale')
      .toBeGreaterThan(1500);
  });
});

describe('the README points at things that exist', () => {
  const links = [...readme.matchAll(/\]\(([^)#][^)]*)\)/g)]
    .map((m) => m[1]!)
    .filter((t) => !t.startsWith('http'))
    .map((t) => t.split('#')[0]!);

  it('has links to check', () => {
    expect(links.length).toBeGreaterThan(3);
  });

  it.each(links)('%s exists', (target) => {
    expect(existsSync(fileURLToPath(new URL(target, root))), `${target} is a broken link`).toBe(true);
  });

  it('only names npm scripts that are defined', () => {
    const pkg = JSON.parse(readFileSync(fileURLToPath(new URL('package.json', root)), 'utf8'));
    const defined = new Set(Object.keys(pkg.scripts));
    const named = [...new Set([...readme.matchAll(/npm run ([a-z:-]+)/g)].map((m) => m[1]!))];
    const missing = named.filter((s) => !defined.has(s));
    expect(missing, `the README documents scripts that do not exist: ${missing.join(', ')}`)
      .toEqual([]);
  });

  it('names map ids the game actually has', () => {
    // The CLI flag table lists them, and a renamed map would otherwise leave a
    // command in the README that errors.
    const table = readme.slice(readme.indexOf('| `--map <id>`'));
    const listed = [...table.slice(0, table.indexOf('|', 20)).matchAll(/`([a-z]+)`/g)].map((m) => m[1]!);
    expect(listed.length, 'no map ids found in the CLI table').toBeGreaterThan(3);
    for (const id of listed) expect(MAPS, `README lists a map that does not exist: ${id}`).toHaveProperty(id);
  });
});
