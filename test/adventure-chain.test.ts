/**
 * Chapters lock until you reach them.
 *
 * The landing page used to offer all three story modules as peers. Starting the
 * third gave you a fresh level-1 party in a module written for level 4 and said
 * nothing about it — the level band on the card described what you *should*
 * bring, not what you were being handed.
 */
import { describe, it, expect } from 'vitest';
import {
  moduleChains, chapterOf, chapterStates, currentChapter,
} from '../src/adventure/chain.js';
import { MODULES, moduleById } from '../src/data/modules/index.js';
import type { Module } from '../src/adventure/types.js';

const mod = (id: string, sequel?: string): Module =>
  ({ id, title: id, start: 's', scenes: {}, ...(sequel ? { sequel } : {}) } as unknown as Module);

const STORY = ['hollow-road', 'sunken-barrows', 'wyrmcalling'];

describe('reading the chapter order off the sequel links', () => {
  it('finds the story campaign in order', () => {
    const chains = moduleChains(MODULES);
    const story = chains.find((c) => c[0]!.id === 'hollow-road')!;
    expect(story.map((m) => m.id)).toEqual(STORY);
  });

  it('leaves standalone modules as chains of one', () => {
    // The test/demo modules are nobody's chapter. They must not be swept into
    // the story chain, or the campaign card would claim five chapters.
    for (const chain of moduleChains(MODULES)) {
      if (chain[0]!.id === 'hollow-road') continue;
      expect(chain, chain[0]!.id).toHaveLength(1);
    }
  });

  it('accounts for every module exactly once', () => {
    const flat = moduleChains(MODULES).flat().map((m) => m.id);
    expect(new Set(flat).size).toBe(flat.length);
    expect(new Set(flat)).toEqual(new Set(MODULES.map((m) => m.id)));
  });

  it('does not hang or lose a module on a cycle', () => {
    // A content bug, not a scenario — but a menu that never renders is a worse
    // failure than a chapter in the wrong place.
    const cyclic = [mod('a', 'b'), mod('b', 'a')];
    const chains = moduleChains(cyclic);
    expect(chains.flat().map((m) => m.id).sort()).toEqual(['a', 'b']);
  });

  it('locates a chapter within its chain', () => {
    const chains = moduleChains(MODULES);
    expect(chapterOf(chains, 'sunken-barrows')?.index).toBe(1);
    expect(chapterOf(chains, 'not-a-module')).toBeUndefined();
  });
});

describe('what you are allowed to start', () => {
  const chain = STORY.map((id) => moduleById(id)!);
  const states = (done: string[], saved?: string) =>
    chapterStates(chain, new Set(done), saved);

  it('offers chapter one and nothing else, at the very start', () => {
    expect(states([])).toEqual(['playable', 'locked', 'locked']);
  });

  it('opens the next chapter only once the one before it is finished', () => {
    expect(states(['hollow-road'])).toEqual(['done', 'playable', 'locked']);
    expect(states(['hollow-road', 'sunken-barrows'])).toEqual(['done', 'done', 'playable']);
  });

  it('lets you into the chapter your company is actually standing in', () => {
    // The load-bearing one. Finishing chapter one writes chapter two to the
    // save slot immediately; chapter two has to be reachable that instant, and
    // it is reachable *because the party is there* rather than because a second
    // record was updated in step. One fact, so the two cannot disagree.
    expect(states([], 'sunken-barrows')).toEqual(['playable', 'playable', 'locked']);
  });

  it('keeps a finished chapter available to replay', () => {
    expect(states(['hollow-road', 'sunken-barrows', 'wyrmcalling']))
      .toEqual(['done', 'done', 'done']);
  });

  it('never locks the first chapter, whatever the record says', () => {
    // A corrupt or half-written progress record must not be able to make the
    // game unstartable.
    expect(chapterStates(chain, new Set(['wyrmcalling']))[0]).toBe('playable');
  });
});

describe('which chapter to put in front of the player', () => {
  const chain = STORY.map((id) => moduleById(id)!);

  it('is where they are, when they are somewhere', () => {
    expect(currentChapter(chain, new Set(['hollow-road']), 'sunken-barrows')).toBe(1);
  });

  it('is the earliest unfinished one otherwise', () => {
    expect(currentChapter(chain, new Set())).toBe(0);
    expect(currentChapter(chain, new Set(['hollow-road']))).toBe(1);
  });

  it('stays on the ending once the campaign is done', () => {
    // Sending someone who finished the story back to chapter one would read as
    // having lost their progress.
    expect(currentChapter(chain, new Set(STORY))).toBe(2);
  });
});
