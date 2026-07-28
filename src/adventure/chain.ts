/**
 * Chapters, and which of them you are allowed to start.
 *
 * The story modules are a linked list — each names its `sequel`, and finishing
 * one carries the company into the next — but the landing page offered all
 * three as peers. Picking the third handed you a fresh level-1 party in a module
 * written for level 4, and said nothing. That is not a choice; it is a trap
 * wearing a choice's clothes.
 *
 * So chapters lock. You may start the first, whatever you have finished, and
 * whatever you are in the middle of. Everything else is reached by playing to
 * it, which is now automatic — see `carryCompanyInto`.
 *
 * WHY THE ORDER IS DERIVED AND NOT DECLARED
 *
 * `MODULES` is a flat array in menu order, and a hand-kept "chapter 2 of 3"
 * beside a `sequel` link is one edit from disagreeing with it. The links are
 * already the truth about what follows what, so the chain is read out of them:
 * the head is the module nothing names as its sequel, and the rest follows the
 * chain. Adding a fourth chapter means setting one `sequel` field.
 */
import type { Id } from '../engine/types.js';
import type { Module } from './types.js';

/**
 * Split modules into ordered chains: a campaign is a head plus everything its
 * `sequel` links reach. A module in nobody's chain is a chain of one, which is
 * what the standalone test modules are.
 *
 * Cycles cannot hang this — each module is emitted at most once — but they also
 * cannot be represented as a chapter list, so the walk simply stops.
 */
export function moduleChains(modules: readonly Module[]): Module[][] {
  const byId = new Map(modules.map((m) => [m.id, m]));
  const isSequel = new Set(modules.flatMap((m) => (m.sequel ? [m.sequel] : [])));
  const chains: Module[][] = [];
  const placed = new Set<Id>();

  for (const head of modules) {
    if (isSequel.has(head.id)) continue;   // somebody else's chapter two
    const chain: Module[] = [];
    let cur: Module | undefined = head;
    while (cur && !placed.has(cur.id)) {
      placed.add(cur.id);
      chain.push(cur);
      cur = cur.sequel ? byId.get(cur.sequel) : undefined;
    }
    chains.push(chain);
  }

  // A module only reachable through a cycle has no head, so the loop above
  // never emitted it. Better a lone card than a chapter that vanishes.
  for (const m of modules) if (!placed.has(m.id)) chains.push([m]);
  return chains;
}

/** The chain containing `id`, and where in it that module sits. */
export function chapterOf(
  chains: readonly Module[][], id: Id,
): { chain: Module[]; index: number } | undefined {
  for (const chain of chains) {
    const index = chain.findIndex((m) => m.id === id);
    if (index >= 0) return { chain, index };
  }
  return undefined;
}

export type ChapterState = 'done' | 'playable' | 'locked';

/**
 * What the player may do with each chapter of one chain.
 *
 *   done      finished; replayable, but starting it fresh costs the save
 *   playable  the first chapter, or one whose predecessor is finished, or the
 *             one the current save is parked in
 *   locked    not yet reached
 *
 * `savedId` is what keeps a carried company reachable the instant it is carried:
 * finishing chapter one writes chapter two to the save slot, and chapter two is
 * playable because that is where the party is — not because anything was
 * unlocked separately. One fact, read two ways, so they cannot disagree.
 */
export function chapterStates(
  chain: readonly Module[], completed: ReadonlySet<Id>, savedId?: Id,
): ChapterState[] {
  return chain.map((m, i) => {
    if (completed.has(m.id)) return 'done';
    if (i === 0 || m.id === savedId) return 'playable';
    return completed.has(chain[i - 1]!.id) ? 'playable' : 'locked';
  });
}

/**
 * The chapter to put in front of the player: where they are, else the earliest
 * one they have not finished, else the last (a finished campaign shows its
 * ending rather than sending them back to chapter one).
 */
export function currentChapter(
  chain: readonly Module[], completed: ReadonlySet<Id>, savedId?: Id,
): number {
  const saved = chain.findIndex((m) => m.id === savedId);
  if (saved >= 0) return saved;
  const next = chain.findIndex((m) => !completed.has(m.id));
  return next >= 0 ? next : chain.length - 1;
}
