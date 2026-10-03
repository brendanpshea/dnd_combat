/**
 * `docs/atlas/` is every version of every scene that some reachable state can
 * produce (see scripts/atlas.ts). Like the route transcripts, it is generated
 * and committed on purpose: a content change shows up in review as an atlas
 * diff — the new version of a scene a party that never met Wren now reads —
 * which is where a line wrong on a route nobody plays becomes visible.
 *
 * So the check is "byte-for-byte what the modules produce right now".
 * Changing a module without regenerating fails here, with the fix in the
 * message.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { buildAtlas, ATLAS_DIR, ATLAS_CHAPTERS } from '../scripts/atlas.js';

const FIX = 'Run `npm run atlas` and commit the result (then read the diff for the scenes you changed — that is the point).';

describe('scene atlas', () => {
  // The reachability search runs once per chapter with text conditions
  // tracked (about ten seconds in all); the budget is an explicit 60 s.
  let files: Record<string, string> = {};
  beforeAll(() => { files = buildAtlas(); }, 60000);

  it('is up to date with the modules and the runtime', () => {
    const stale: string[] = [];
    for (const [name, body] of Object.entries(files)) {
      const path = join(ATLAS_DIR, name);
      if (!existsSync(path) || readFileSync(path, 'utf8') !== body) stale.push(name);
    }
    expect(Object.keys(files).length).toBeGreaterThanOrEqual(ATLAS_CHAPTERS.length);
    expect(stale, `stale atlas: ${stale.join(', ')}. ${FIX}`).toEqual([]);
  });

  it('has no file on disk that the generator no longer writes', () => {
    const onDisk = readdirSync(ATLAS_DIR).filter((f) => f.endsWith('.md'));
    const orphans = onDisk.filter((f) => !(f in files));
    expect(orphans, `orphaned atlas files: ${orphans.join(', ')}. Delete them, or ${FIX}`).toEqual([]);
  });

  it('covers every chapter, and stays readable', () => {
    for (const id of ATLAS_CHAPTERS) {
      expect(Object.keys(files).some((f) => f === `${id}.md` || f.startsWith(`${id}-`)), `no atlas for ${id}`).toBe(true);
    }
    for (const [name, body] of Object.entries(files)) {
      expect(body, `${name} has no generated-file banner`).toContain('Do not edit by hand');
      expect(body, `${name} prints undefined`).not.toMatch(/\bundefined\b/);
      expect(body, `${name} prints [object Object]`).not.toContain('[object Object]');
      expect(body, `${name} has an unresolved {token}`).not.toMatch(/\{\^?[a-z][a-z0-9-]*\}/);
      expect(body.length, `${name} is over 1 MB — the generator should have split it`).toBeLessThan(1024 * 1024);
    }
  });
});
