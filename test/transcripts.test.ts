/**
 * `docs/transcripts/` is the text a player reads on a handful of fixed routes
 * through the trilogy (see scripts/transcripts.ts). It is generated, and it is
 * committed on purpose: a content change shows up in review as a transcript
 * diff — the paragraph a player now reads in a different order, the slide that
 * stopped showing — which is where contradictions between scenes become
 * visible.
 *
 * So, like the content reference, the check is "byte-for-byte what the
 * modules produce right now". Changing a module without regenerating fails
 * here, with the fix in the message.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { buildTranscripts, TRANSCRIPT_DIR } from '../scripts/transcripts.js';

const FIX = 'Run `npm run transcripts` and commit the result (then read the diff — that is the point).';

describe('route transcripts', () => {
  // Every route is played headlessly here (no battles are simulated); it takes
  // about a second, and the budget is an explicit 20 s.
  let files: Record<string, string> = {};
  beforeAll(() => { files = buildTranscripts(); }, 20000);

  it('are up to date with the modules and the runtime', () => {
    const stale: string[] = [];
    for (const [name, body] of Object.entries(files)) {
      const path = join(TRANSCRIPT_DIR, name);
      if (!existsSync(path) || readFileSync(path, 'utf8') !== body) stale.push(name);
    }
    expect(Object.keys(files).length).toBeGreaterThan(0);
    expect(stale, `stale transcripts: ${stale.join(', ')}. ${FIX}`).toEqual([]);
  });

  it('has no transcript on disk that the generator no longer writes', () => {
    const onDisk = readdirSync(TRANSCRIPT_DIR).filter((f) => f.endsWith('.md'));
    const orphans = onDisk.filter((f) => !(f in files));
    expect(orphans, `orphaned transcripts: ${orphans.join(', ')}. Delete them, or ${FIX}`).toEqual([]);
  });

  it('every route reaches a victory in every chapter it plays, and stays readable', () => {
    for (const [name, body] of Object.entries(files)) {
      expect(body, `${name} has no generated-file banner`).toContain('Do not edit by hand');
      expect(body, `${name} ends in defeat`).not.toMatch(/### Ending: defeat/);
      expect(body, `${name} prints undefined`).not.toMatch(/\bundefined\b/);
      expect(body, `${name} prints [object Object]`).not.toContain('[object Object]');
      expect(body.length, `${name} is over 150 KB — trim the route`).toBeLessThan(150 * 1024);
    }
  });

  // docs/design-decisions.md: the level curve is the same on every route, and
  // Part 3 tops out at 5th. The most thorough routes are here, so a roster or
  // reward that pays past the cap shows up as a 6th level.
  it('no route levels past 5th', () => {
    for (const [name, body] of Object.entries(files)) {
      const over = [...body.matchAll(/Level up: \d+ → (\d+)/g)].filter((m) => Number(m[1]) > 5);
      expect(over.map((m) => m[0]), `${name} reaches 6th: lower the XP its optional fights pay`).toEqual([]);
    }
  });
});
