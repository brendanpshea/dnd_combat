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
export interface Budget { flags: number; conditional: number; states: number;
  /** Conditions that test more than MAX_CONDITION_FLAGS story flags at once
   *  (wideConditions). Zero is the goal: a chapter over it only shrinks it. */
  wide?: number }

/**
 * The most story flags (flag, notFlag, visited) one condition may test: a
 * choice, a line, a place's routing, an ending slide. A thing that needs more
 * is a sign the story wants a quest's status or a tally, not a cross-product.
 */
export const MAX_CONDITION_FLAGS = 2;

/**
 * The most flags one act (a .story file, Module.acts) may hand the others:
 * flags it sets that steer a path in another act (reach.ts `actExports`).
 * The proof walks each act with its own flags and these, so they are what
 * multiplies; an act's private flags only add.
 */
export const MAX_ACT_EXPORTS = 5;
export const LEDGER_BUDGET: Record<string, Budget> = {
  // Set just above the spend after the ledger round (Oct 2026): 39 / 94 /
  // 1.17M, 23 / 88 / 97k and 33 / 208 / 559k. Part 3 walked 3.0M before.
  // Lowered after the branch-trimming round (Oct 2026: dead choices out of
  // shared lists, near-duplicate lines merged, text-only flags dropped), from
  // 41 / 100 / 1.25M, 25 / 95 / 150k and 35 / 215 / 650k, to just above the
  // new spend: 36 / 89 / 1.19M, 23 / 84 / 97k and 34 / 203 / 559k.
  // Raised for the design review's fixes (Oct 2026): the den's alarm moved into
  // the dungeon itself (no story flag), and the captives became one fetch quest
  // (freed or taken, by the clock or the boss's fall). No new facts, but the
  // captives' two now change in more places: 0.65M states to 1.83M.
  // Lowered for the two-flag rule (Oct 2026): no condition tests more than
  // two story flags; Mira's mood is the captives', the reeve pays before the
  // crowd's hub, and Wren turns on a company the moment it walks past her.
  // And again for acts (Oct 2026): the proof walks each act with its own
  // flags and what the acts hand each other, and forgets a flag nothing
  // ahead can read. 1.74M states to 395k.
  'hollow-road': { flags: 36, conditional: 82, states: 450_000 },
  // Raised by exactly what round 17's bug fixes cost (Oct 2026): Halden's
  // bell for a company that never read the churchyard (+1).
  'sunken-barrows': { flags: 24, conditional: 87, states: 100_000 },
  // Its brood choices spell out every mix of the three dens cleared (88
  // conditions over two flags): to become a tally. Held, and only to shrink.
  wyrmcalling: { flags: 35, conditional: 205, states: 575_000, wide: 88 },
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

const CONDITION_KEYS = new Set(['requires', 'if', 'until', 'locked']);

/** Every condition in a module that tests more than MAX_CONDITION_FLAGS story
 *  flags, as `scene: flags` (once each, however often it is repeated). */
export function wideConditions(module: unknown): string[] {
  const out = new Set<string>();
  const walk = (v: unknown, at: string): void => {
    if (Array.isArray(v)) { v.forEach((x) => walk(x, at)); return; }
    if (!v || typeof v !== 'object') return;
    const o = v as Record<string, unknown>;
    const here = typeof o.id === 'string' && 'kind' in o && at === '' ? o.id : at;
    for (const [k, x] of Object.entries(o)) {
      if (CONDITION_KEYS.has(k) && Array.isArray(x)) {
        // An NPC's fate is one status, however many of its flags a test names
        // (`npc.wren.fate.*`): counted as one, as a quest's status would be.
        const fl = [...new Set(x.flatMap((r: { kind?: string; flag?: string; scene?: string }) =>
          (r?.kind === 'flag' || r?.kind === 'notFlag') && r.flag?.startsWith('npc.') ? [r.flag.split('.').slice(0, 3).join('.')]
          : r?.kind === 'flag' || r?.kind === 'notFlag' ? [`${r.kind === 'notFlag' ? 'not ' : ''}${r.flag}`] : r?.kind === 'visited' ? [`visited ${r.scene}`] : []))];
        if (fl.length > MAX_CONDITION_FLAGS) out.add(`${here}: ${fl.join(', ')}`);
      }
      walk(x, k === 'scenes' ? '' : here);
    }
  };
  walk(module, '');
  return [...out];
}
