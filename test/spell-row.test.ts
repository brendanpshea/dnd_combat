/**
 * A wizard's two decisions on one row.
 *
 * The tray drew a spellbook grid and a prepared grid over the SAME spells, so a
 * level-up listed every name twice — the largest single thing on a screen the
 * player already called wasteful. Merging them into one row with two ticks says
 * it once.
 *
 * The merge costs something, though: the split version expressed "you cannot
 * prepare a spell you have not learned" by simply leaving unlearned spells out
 * of the second grid. One grid has to say it with a disabled tick instead, and
 * a wrongly-disabled tick is invisible in a screenshot — you only find it by
 * trying to click it. Hence `spellRow`, and hence this.
 *
 * Real spell ids throughout: these caps are the wizard's real ones.
 */
import { describe, it, expect } from 'vitest';
import { spellRow } from '../web/src/spellRow.js';
import { newCampaign, buildCampaignParty, spellbookPool, spellbookLimit, preparedLimit, chosenSpellbook } from '../src/campaign/campaign.js';

const BOOK = ['magic-missile', 'sleep', 'burning-hands', 'shield', 'mage-armor', 'color-spray'];
const opts = (over: Partial<Parameters<typeof spellRow>[1]> = {}) => ({
  book: BOOK, prepared: ['magic-missile', 'sleep'], bookCap: 6, prepCap: 4, ...over,
});

describe('the prepared tick depends on the book tick', () => {
  it('will not let you prepare a spell you have not learned', () => {
    // The whole reason the merged row needs logic at all.
    const r = spellRow('false-life', opts());
    expect(r.known, 'a spell outside the book reads as known').toBe(false);
    expect(r.prepareDisabled, 'an unlearned spell can be prepared').toBe(true);
  });

  it('lets you prepare one you have', () => {
    const r = spellRow('shield', opts());
    expect(r.known).toBe(true);
    expect(r.prepareDisabled, 'a known, unprepared spell under the cap is locked').toBe(false);
  });
});

describe('the caps stop you adding, never removing', () => {
  it('blocks a new book pick once the book is full', () => {
    const r = spellRow('false-life', opts({ bookCap: 6 }));
    expect(r.knownDisabled, 'a full book still accepts a seventh spell').toBe(true);
  });

  it('still lets you untick something in a full book', () => {
    // The trap this avoids: disable-at-cap applied to ticked rows too, and the
    // player cannot swap a spell out because every box is dead.
    const r = spellRow('shield', opts({ bookCap: 6 }));
    expect(r.knownDisabled, 'a full book cannot be changed at all').toBe(false);
  });

  it('blocks a new prepare at the cap but not an unprepare', () => {
    const full = { prepared: ['magic-missile', 'sleep', 'shield', 'mage-armor'], prepCap: 4 };
    expect(spellRow('color-spray', opts(full)).prepareDisabled,
      'a fifth spell was preparable with 4/4 prepared').toBe(true);
    expect(spellRow('shield', opts(full)).prepareDisabled,
      'a full prepared list cannot be changed at all').toBe(false);
  });
});

describe('a scribed scroll', () => {
  const scribed = ['web'];

  it('is known without being in the book', () => {
    // A copied scroll lives in `scribedSpells`, not the chosen book. It used to
    // appear in NEITHER grid, so 100 gold bought a spell that showed up nowhere.
    const r = spellRow('web', opts({ scribed }));
    expect(r.known, 'a scribed spell is not shown as known').toBe(true);
    expect(r.fixed, 'a scribed spell offers a tick it cannot honour').toBe(true);
  });

  it('can be prepared like anything else', () => {
    expect(spellRow('web', opts({ scribed })).prepareDisabled,
      'a spell bought for 100 gold cannot be prepared').toBe(false);
  });

  it('does not eat a slot in a full spellbook', () => {
    // It was bought, not chosen. If it counted against `bookCap` then scribing
    // would silently cost a level-up pick.
    const r = spellRow('web', opts({ scribed, bookCap: 6 }));
    expect(r.known).toBe(true);
    expect(spellRow('false-life', opts({ scribed, bookCap: 7 })).knownDisabled,
      'the book stopped accepting picks a slot early because a scroll took one').toBe(false);
  });
});

describe('against a real level-1 wizard', () => {
  // The caps in the fixtures above are only worth trusting if they are the
  // wizard's actual caps.
  const c = newCampaign(1);
  const idx = buildCampaignParty(c).findIndex((h) => h.classId === 'wizard');

  it('found a wizard to test with', () => {
    expect(idx, 'no wizard in the default party — this suite tests nothing').toBeGreaterThanOrEqual(0);
  });

  it('gives every pool spell a coherent row', () => {
    const book = chosenSpellbook(c, idx);
    const bookCap = spellbookLimit(c, idx)!;
    const prepCap = preparedLimit(c, idx);
    const pool = spellbookPool(c, idx);
    expect(pool.length, 'an empty pool tests nothing').toBeGreaterThan(0);
    for (const id of pool) {
      const r = spellRow(id, { book, prepared: [], bookCap, prepCap });
      // The invariant the merged row exists to enforce, over the real pool.
      if (!r.known) expect(r.prepareDisabled, `${id} is preparable while unknown`).toBe(true);
    }
    // ...and the default book is exactly at its cap, so the pool must contain
    // rows of both kinds or the loop above proves nothing.
    expect(book.length).toBe(bookCap);
    expect(pool.some((id) => !book.includes(id)),
      'every pool spell is already in the book — no unknown row to check').toBe(true);
  });
});
