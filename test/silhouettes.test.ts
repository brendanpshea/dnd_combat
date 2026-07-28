/**
 * Every creature has a silhouette to fall back to, and every silhouette is
 * reachable.
 *
 * The silhouette is what the board shows while a token is in flight and forever
 * for the creatures that have no art. It replaced an emoji, and the emoji failed
 * quietly: it was sized off the viewport rather than the cell, so a 49px cell on
 * a 430px phone held a 20px speck, and nobody noticed for months because
 * nothing was ever *missing*. That is the failure mode these tests are for.
 *
 * Two kinds of drift to catch.
 *
 * `PLAN` is hand-kept — the only hand-kept thing in the chain — because "this
 * monster is really a spider" is a judgement the data cannot make. Hand-kept
 * means a rename silently drops the override and the spider goes back to being
 * a generic blob, with no error anywhere. So every id in it must exist and every
 * shape it names must exist.
 *
 * And `silhouettes.ts` is generated. A stale generated file is the standing
 * hazard in this codebase, so the last test runs the generator's own --check.
 */
import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { MONSTERS } from '../src/data/monsters.js';
import { CLASSES } from '../src/data/classes.js';
import { SILHOUETTE_PATH, SILHOUETTE_BOX } from '../web/src/silhouettes.js';
import { silhouetteKey, silhouettePath, PLAN } from '../web/src/silhouette.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const keys = Object.keys(SILHOUETTE_PATH);

describe('token silhouettes', () => {
  it('finds the shapes it is meant to be checking', () => {
    // Guards the guard: an empty import would pass everything below.
    expect(keys.length).toBeGreaterThan(20);
    expect(SILHOUETTE_BOX).toBe(64);
  });

  it('has one for every creature type in the bestiary', () => {
    // The whole point of keying off creature type is that a monster added
    // tomorrow is covered without anyone touching this. That only holds while
    // every type in the data has a shape.
    const types = new Set(Object.values(MONSTERS).map((m) => m.creatureType));
    const missing = [...types].filter((t) => !SILHOUETTE_PATH[`type-${t}`]);
    expect(missing, 'add these to TYPES in art/generate_svg_tokens.py').toEqual([]);
  });

  it('has one for every playable class', () => {
    const missing = Object.keys(CLASSES).filter((c) => !SILHOUETTE_PATH[`class-${c}`]);
    expect(missing, 'add these to CLASSES in art/generate_svg_tokens.py').toEqual([]);
  });

  it('resolves every monster and every class to a real shape', () => {
    for (const id of [...Object.keys(MONSTERS), ...Object.keys(CLASSES)]) {
      const key = silhouetteKey(id);
      expect(SILHOUETTE_PATH[key], `${id} -> ${key}`).toBeDefined();
      expect(silhouettePath(id).length, id).toBeGreaterThan(20);
    }
  });

  it('falls back to an upright shape for anything it has never heard of', () => {
    // Species-and-class portrait ids, adventure NPCs, a typo: a stand-in that
    // renders nothing would look exactly like the bug this replaced.
    for (const id of ['elf-wizard', 'not-a-creature', '']) {
      expect(silhouetteKey(id)).toBe('type-humanoid');
    }
  });

  it('overrides only monsters that exist', () => {
    // THE drift test. PLAN is keyed by monster id and read at render time with
    // no lookup against the table, so a renamed monster keeps its old key here
    // forever and quietly stops getting its body plan.
    // Every id it names is a monster. A renamed monster leaves a key here that
    // matches nothing, and the creature silently reverts to its type shape.
    const ghosts = Object.keys(PLAN).filter((id) => !MONSTERS[id]);
    expect(ghosts, 'these overrides name monsters that do not exist').toEqual([]);
    // Every shape it names is drawn.
    const unknown = Object.values(PLAN).filter((k) => !SILHOUETTE_PATH[k]);
    expect(unknown, 'these overrides name shapes that are not drawn').toEqual([]);

    const planned = Object.keys(MONSTERS).filter((id) => silhouetteKey(id).startsWith('plan-'));
    expect(planned.length, 'no body-plan override resolved at all').toBeGreaterThan(20);
    // A kobold is creature type dragon and must not be drawn as one.
    expect(silhouetteKey('kobold')).toBe('type-humanoid');
    // And the reverse: every plan shape drawn is actually used by something. An
    // unreachable silhouette is 200 bytes of dead art nobody will ever see.
    for (const key of keys.filter((k) => k.startsWith('plan-'))) {
      const users = planned.filter((id) => silhouetteKey(id) === key);
      expect(users.length, `${key} is drawn but nothing uses it`).toBeGreaterThan(0);
    }
  });

  it('gives the fliers, crawlers and slitherers their own shape', () => {
    // Spot-check the judgement rather than just the plumbing: these are the
    // three that made "monstrosity" too coarse in the first place.
    expect(silhouetteKey('griffon')).toBe('plan-winged');
    expect(silhouetteKey('giant-spider')).toBe('plan-manylegs');
    expect(silhouetteKey('giant-constrictor-snake')).toBe('plan-serpent');
    expect(silhouetteKey('ghost')).toBe('plan-drifting');
    // …and that the type path still wins where it is the better answer.
    expect(silhouetteKey('skeleton')).toBe('type-undead');
    expect(silhouetteKey('hill-giant')).toBe('type-giant');
    expect(silhouetteKey('fighter')).toBe('class-fighter');
  });

  it('is up to date with its generator', () => {
    // Same standing rule as the art registry, the reference docs and the SVG
    // terrain: the derived file is a function of its source, and a test is what
    // stops the two drifting.
    const run = () => execFileSync('python3', ['art/generate_svg_tokens.py', '--check'],
      { cwd: ROOT, encoding: 'utf8' });
    expect(run).not.toThrow();
  });
});
