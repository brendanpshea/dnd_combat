/**
 * Every monster without art has a prompt written for it.
 *
 * The emoji fallback means a monster with no art is not a broken image — it is
 * a silent one. Nothing anywhere fails, so a creature added today is simply on
 * the emoji forever unless somebody notices. Thirty-five of a hundred and
 * thirty-eight monsters had no art, nine of them had no prompt either, and the
 * doc's own status line said "80 of the 132" — a count that had been wrong for
 * long enough that nobody could tell which of the three numbers to trust.
 *
 * So the worklist is checked rather than described. `art/prompts.md` §8 is the
 * generation queue: what a monster needs to exist is a `**Name** (\`id\`)`
 * header with a prompt line under it. Either a monster has art or it has one of
 * those, and this is what says so.
 *
 * Deliberately NOT a check that §8 is free of monsters that now have art. A
 * generated prompt is worth keeping — it is the record of how the thing was
 * drawn, and what a re-roll would start from.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { MONSTERS } from '../src/data/monsters.js';
import { HAS_ART } from '../web/src/art-registry.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const doc = readFileSync(fileURLToPath(new URL('../art/prompts.md', import.meta.url)), 'utf8');

/** Ids with a real prompt in the generation section, not merely a mention. */
function prompted(): Set<string> {
  const lines = doc.split('\n');
  const from = lines.findIndex((l) => l.startsWith('## 8.'));
  const to = lines.findIndex((l) => l.startsWith('## 9.'));
  expect(from, 'section 8 (the generation queue) has moved or gone').toBeGreaterThan(0);
  expect(to).toBeGreaterThan(from);
  const ids = new Set<string>();
  for (let i = from; i < to; i++) {
    const m = lines[i]!.match(/^\*\*.+?\*\*\s*\(`([a-z0-9-]+)`\)/);
    // The prompt itself may sit one or two lines below the header — some
    // entries carry a line of design intent in between.
    if (m && lines.slice(i + 1, i + 4).some((l) => l.trim().startsWith('>'))) ids.add(m[1]!);
  }
  return ids;
}

describe('the art worklist', () => {
  const withPrompt = prompted();
  const noArt = Object.keys(MONSTERS).filter((id) => !HAS_ART.has(id));

  it('finds the queue it is meant to be reading', () => {
    // Guards the guard: a parser that matched nothing would pass the next
    // assertion only when every monster already had art.
    expect(withPrompt.size).toBeGreaterThan(20);
  });

  it('has a prompt for every monster still on the emoji fallback', () => {
    const orphans = noArt
      .filter((id) => !withPrompt.has(id))
      .map((id) => `${id} (${MONSTERS[id]!.name})`);
    expect(orphans, 'add these to art/prompts.md §8').toEqual([]);
  });

  it('names them in a form the pipeline can act on', () => {
    // The filename convention in §9 is `portrait-<id>` / `token-<id>`, so the
    // backtick id in the header is what ties a prompt to the file it produces.
    // A prompt headed with a display name instead is one nobody can file.
    for (const id of noArt) {
      expect(doc, id).toContain(`\`${id}\``);
    }
  });

  /**
   * The doc carried three counts of how much was left, in three places, and all
   * three disagreed with the code and with each other. They are generated now.
   */
  it('states counts that match the code', () => {
    let out = '';
    try {
      out = execFileSync('npx', ['tsx', 'scripts/art-backlog.ts', '--check'], {
        cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
      });
    } catch (e) {
      const err = e as { stdout?: string; stderr?: string };
      throw new Error(`${err.stderr ?? ''}${err.stdout ?? ''}`);
    }
    expect(out).toContain('up to date');
  }, 60000);
});
