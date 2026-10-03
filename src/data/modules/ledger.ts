/**
 * The ledger: what crosses between the trilogy's chapters, and the budget each
 * chapter is held to. See docs/state-ledger.md. `test/ledger.test.ts` holds the
 * chapters to it, and `npm run check:story` prints each chapter's spend.
 */
import { npcAttitudeFlag } from '../../adventure/npcs.js';

/** What each chapter may hand on (besides NPC state, which the registry holds). */
export const LEDGER_CARRIES: Record<string, string[]> = {
  'hollow-road': ['won', 'captives-freed'],
  'sunken-barrows': ['won', 'seal-cracked', 'regard'],
  wyrmcalling: [],
};

/** An NPC may end a chapter in at most this many named fates. */
export const MAX_FATES = 3;

/** Tallies are read only at their band edges, never at a finer grain. */
export const LEDGER_BANDS: Record<string, number[]> = {
  // Wren's regard: cold (below 0), neutral (0–1), warm (2 or more).
  [npcAttitudeFlag('wren')]: [0, 2],
  // The valley's regard: 0, 1, 2 or more.
  'sunken-barrows:regard': [1, 2],
  regard: [1, 2],
};

/** Each chapter's ceiling: story flags it sets, conditional paragraphs, and
 *  states the reachability search walks. A change that would pass a ceiling
 *  has to earn the room (raise it here, in the same commit, with a reason). */
export interface Budget { flags: number; conditional: number; states: number }
export const LEDGER_BUDGET: Record<string, Budget> = {
  // Set just above the spend after the ledger round (Oct 2026): 39 / 94 /
  // 1.17M, 23 / 88 / 97k and 33 / 208 / 559k. Part 3 walked 3.0M before.
  'hollow-road': { flags: 41, conditional: 100, states: 1_250_000 },
  'sunken-barrows': { flags: 25, conditional: 95, states: 150_000 },
  wyrmcalling: { flags: 35, conditional: 215, states: 650_000 },
};

/** Walk a module's data and count what the budget counts. */
export function spend(module: unknown): { flags: number; conditional: number } {
  const flags = new Set<string>();
  let conditional = 0;
  const walk = (v: unknown): void => {
    if (Array.isArray(v)) { v.forEach(walk); return; }
    if (!v || typeof v !== 'object') return;
    const o = v as Record<string, unknown>;
    if ((o.kind === 'setFlag' || o.kind === 'addFlag') && typeof o.flag === 'string' && !o.flag.startsWith('npc.')) flags.add(o.flag);
    if (typeof o.text === 'string' && ('if' in o || 'assumes' in o)) conditional++;
    for (const x of Object.values(o)) walk(x);
  };
  walk(module);
  return { flags: flags.size, conditional };
}
