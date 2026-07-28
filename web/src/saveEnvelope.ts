/**
 * A version stamp on every browser save, and an honest answer when it is wrong.
 *
 * THE FAILURE THIS EXISTS FOR
 *
 * The campaign and arena saves carried no version at all. Both parsers are
 * defensive — a blob they cannot read returns `undefined` — and the caller
 * reads `undefined` as "no save", so the screen offers a fresh start.
 *
 * That is the correct behaviour for a corrupt save and a catastrophe for an old
 * one. The day a shipped update changes a field these parsers depend on, every
 * party in progress silently becomes a New Game button, and the player is never
 * told their save existed. They assume the game ate it, because it did.
 *
 * A version stamp does not by itself migrate anything. What it buys is the
 * ability to TELL THE DIFFERENCE between "this is not a save" and "this is a
 * save from a version I no longer understand" — and the second one deserves a
 * sentence rather than silence.
 *
 * WHY THE STAMP GOES OUTSIDE THE STATE
 *
 * Wrapping rather than adding a field: the state types are shared with the CLI
 * and the tests, and a version belongs to the *storage format*, not to a
 * campaign. It also means an unwrapped blob — every save written before this —
 * is recognisable on sight, and is read as version 0 rather than as garbage.
 */

/**
 * Bump when a change makes an older save unreadable, NOT for every change.
 *
 * Most changes are backward compatible: fields are added, parsers back-fill
 * defaults, "absent means full" covers the resource fields. Bumping for those
 * would throw away saves that would have loaded perfectly.
 *
 * Bump when a field changes meaning or disappears — when loading an old save
 * would produce a WRONG game rather than a missing one. A party that quietly
 * loses its levels is worse than a party the game admits it cannot open.
 */
export const SAVE_VERSION = 1;

/** What a stored save looks like on disk from now on. */
export interface Envelope<T> {
  v: number;
  data: T;
}

export function wrap<T>(data: T): string {
  return JSON.stringify({ v: SAVE_VERSION, data } satisfies Envelope<T>);
}

export type Unwrapped =
  /** A save this build understands. `raw` is the JSON of the inner state. */
  | { kind: 'ok'; raw: string; version: number }
  /** Written by a NEWER build — the player downgraded, or a stale tab. */
  | { kind: 'future'; version: number }
  /** Not a save at all: corrupt, truncated, or something else's key. */
  | { kind: 'unreadable' };

/**
 * Peel the envelope off a stored blob.
 *
 * An unwrapped object is version 0 — every save written before this shipped —
 * and is handed back to be parsed exactly as it always was. That is the whole
 * migration for this bump: the old format is still readable, and now it is also
 * identifiable.
 */
export function unwrap(raw: string | null): Unwrapped {
  if (!raw) return { kind: 'unreadable' };
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { kind: 'unreadable' };
  }
  if (!parsed || typeof parsed !== 'object') return { kind: 'unreadable' };
  const env = parsed as Partial<Envelope<unknown>>;
  if (typeof env.v !== 'number' || env.data === undefined) {
    // No stamp: a pre-versioning save. Read it as it stands.
    return { kind: 'ok', raw, version: 0 };
  }
  if (env.v > SAVE_VERSION) return { kind: 'future', version: env.v };
  return { kind: 'ok', raw: JSON.stringify(env.data), version: env.v };
}

/**
 * Why a save could not be opened, in words a player can act on — or undefined
 * when there simply was no save, which needs no explanation at all.
 *
 * The distinction is the entire point of the version stamp. "You have no saved
 * game" and "your saved game is from a newer version of the game" are different
 * facts, and only one of them is alarming to be told nothing about.
 */
export function loadProblem(u: Unwrapped, hadRaw: boolean): string | undefined {
  if (u.kind === 'future') {
    return 'This save was made by a newer version of the game. Update, or start a new run — '
      + 'the old save is left untouched.';
  }
  if (u.kind === 'unreadable' && hadRaw) {
    return 'A saved game was found but could not be read. It may be from a much older version. '
      + 'Starting fresh will replace it.';
  }
  return undefined;
}
