/**
 * What the two ticks on a merged spell row are allowed to do.
 *
 * The tray used to draw a wizard's spellbook and their prepared list as two
 * grids over the same names. Merging them into one row with two ticks removes
 * the duplication, but it also makes a rule that the split version expressed
 * only by omission — you cannot prepare a spell you have not learned — into
 * something the row has to say for itself.
 *
 * That rule plus two caps is enough logic to get wrong quietly, so it lives
 * here rather than inline in JSX: a disabled tick that should be live is
 * invisible in a screenshot and obvious in a test.
 */
import type { Id } from '../../src/engine/types.js';

export interface RowState {
  /** In the spellbook — either chosen or copied from a scroll. */
  known: boolean;
  prepared: boolean;
  /** Copied from a scroll: known for good, so there is no tick to offer. */
  fixed: boolean;
  knownDisabled: boolean;
  prepareDisabled: boolean;
}

export function spellRow(
  id: Id,
  { book, prepared, scribed = [], bookCap, prepCap }: {
    book: readonly Id[];
    prepared: readonly Id[];
    scribed?: readonly Id[];
    bookCap: number;
    prepCap: number;
  },
): RowState {
  const fixed = scribed.includes(id);
  // A scribed spell is known without occupying the book's capacity — it was
  // bought, not chosen — so it must not be counted against `bookCap` either.
  const known = fixed || book.includes(id);
  const isPrepared = prepared.includes(id);
  return {
    known,
    prepared: isPrepared,
    fixed,
    // Ticking off is always allowed; only ticking ON can hit a cap. Disabling
    // a ticked box at the cap would trap a player in their own choice.
    knownDisabled: fixed || (!known && book.length >= bookCap),
    prepareDisabled: !known || (!isPrepared && prepared.length >= prepCap),
  };
}
