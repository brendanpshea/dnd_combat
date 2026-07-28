/**
 * The arena's stall.
 *
 * The shop was a vending machine — a price list and a Buy button. Haggling and
 * a steal gambit have existed in `campaign.ts` for a long time and the arena
 * simply never called them, so a party with a bard and a rogue got nothing for
 * either at the one screen where a social skill plausibly matters.
 *
 * What matters most here is not the arithmetic but the reset: a visit belongs
 * to the DAY, not to the panel. If closing and reopening the stall started a
 * fresh visit, a failed haggle could be rerolled at will — the same
 * reroll-by-retry hole the frozen day exists to close everywhere else.
 */
import { describe, it, expect } from 'vitest';
import {
  newStallVisit, stallVisitOf, stallPrice, stallResale, stallWillBuy,
} from '../src/arena/stall.js';
import {
  newCampaign, itemPrice, attemptHaggle, attemptSteal, sellItem, addItem,
  HAGGLE, STEAL_FINE, type CampaignState,
} from '../src/campaign/campaign.js';
import { newArenaRun } from '../src/arena/run.js';

/**
 * A fresh party, seeded per call.
 *
 * The seed is a parameter for a reason: an earlier draft built every campaign
 * from one fixed seed inside a loop, so forty iterations were the same
 * campaign forty times and reported a 100% steal rate. A loop over a constant
 * measures one sample, however many times it runs.
 */
function camp(seed: number, gold = 500): CampaignState {
  const c = newCampaign(seed);
  c.gold = gold;
  return c;
}

describe('a visit belongs to the day', () => {
  it('starts fresh, with the merchant asking list price', () => {
    const v = newStallVisit(1);
    expect(v.priceMult).toBe(1);
    expect(v.haggleUsed).toBe(false);
    expect(v.stealUsed).toBe(false);
  });

  it('keeps the same visit all through one day', () => {
    // Reopening the panel must not reroll a failed haggle.
    const spent = { day: 3, priceMult: 1.25, haggleUsed: true, stealUsed: true };
    expect(stallVisitOf(spent, 3), 'same day, same visit').toBe(spent);
  });

  it('starts a new one when the day turns', () => {
    const spent = { day: 3, priceMult: 1.25, haggleUsed: true, stealUsed: true };
    const fresh = stallVisitOf(spent, 4);
    expect(fresh.day).toBe(4);
    expect(fresh.priceMult, 'yesterday\'s bad mood does not carry').toBe(1);
    expect(fresh.haggleUsed).toBe(false);
    expect(fresh.stealUsed).toBe(false);
  });

  it('treats a run that has never been to market as a fresh visit', () => {
    // "Absent means fresh", the same convention hit points and charges use.
    expect(newArenaRun(1).stall).toBeUndefined();
    expect(stallVisitOf(undefined, 1).priceMult).toBe(1);
  });
});

describe('what the stall charges and pays', () => {
  it('scales the asking price by the haggle, rounding the merchant\'s way', () => {
    const list = itemPrice('splint')!;
    expect(stallPrice('splint', newStallVisit(1))).toBe(list);
    expect(stallPrice('splint', { day: 1, priceMult: 0.8, haggleUsed: true, stealUsed: false }))
      .toBe(Math.ceil(list * 0.8));
    // A bad intimidation costs you.
    expect(stallPrice('splint', { day: 1, priceMult: 1.25, haggleUsed: true, stealUsed: false }))
      .toBeGreaterThan(list);
  });

  it('pays half of list, and is NOT moved by haggling', () => {
    // Talking a merchant down on what they charge is a different conversation
    // from talking them up on what they pay. One roll doing both would be worth
    // roughly double what it should be.
    const list = itemPrice('splint')!;
    expect(stallResale('splint')).toBe(Math.floor(list / 2));
    expect(stallResale('splint')).toBeLessThan(stallPrice('splint', newStallVisit(1)));
  });

  it('never prices an unpriced thing at NaN', () => {
    expect(stallPrice('not-a-real-item', newStallVisit(1))).toBe(0);
    expect(stallResale('not-a-real-item')).toBe(0);
  });
});

describe('the gambits themselves', () => {
  it('moves prices down on a success and up on a bad risk', () => {
    // Across many campaigns, every haggle skill produces both outcomes and
    // never lands outside its own configured band.
    for (const skill of Object.keys(HAGGLE) as Array<keyof typeof HAGGLE>) {
      const cfg = HAGGLE[skill];
      const seen = new Set<number>();
      for (let seed = 1; seed <= 60; seed++) {
        const c = newCampaign(seed);
        seen.add(attemptHaggle(c, skill).priceMultiplier);
      }
      expect(seen.has(1 - cfg.discount), `${skill} never succeeded`).toBe(true);
      for (const mult of seen) {
        expect([1 - cfg.discount, 1 + cfg.penalty], `${skill} → ${mult}`).toContain(mult);
      }
    }
  });

  it('either pockets something from the shelf or costs a fine', () => {
    const shelf = ['potion-healing', 'dagger', 'splint'];
    let stolen = 0;
    let fined = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const c = camp(seed);
      const before = c.gold;
      const r = attemptSteal(c, shelf);
      if (r.success) {
        stolen += 1;
        expect(shelf, 'took something not on the shelf').toContain(r.itemId);
        expect(c.gold, 'a clean theft costs nothing').toBe(before);
      } else {
        fined += 1;
        expect(c.gold).toBe(before - Math.min(before, STEAL_FINE));
      }
    }
    // Measured at 49-58% across party compositions: a real gamble, which is
    // what a once-a-morning gambit should be. Bounds rather than an exact rate,
    // so a bit of drift in skill bonuses does not fail the suite.
    expect(stolen, 'never once succeeded').toBeGreaterThan(5);
    expect(fined, 'never once got caught').toBeGreaterThan(5);
  });

  it('cannot fine a penniless party into debt', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const c = camp(seed, 10);
      attemptSteal(c, ['dagger']);
      expect(c.gold).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('what the stall will not buy', () => {
  /**
   * Found by driving the real shop: a Light Crossbow showed up on the sell list
   * at "+0g". It has no price, `sellItem` refuses anything unpriced, and so the
   * row took a tap, took a confirm, and did nothing — which is worse than not
   * being offered at all. A button that visibly fails teaches a player not to
   * trust the ones beside it.
   */
  it('refuses anything the shop has no price for', () => {
    expect(itemPrice('light-crossbow'), 'the case that was found').toBeUndefined();
    expect(stallWillBuy('light-crossbow')).toBe(false);
  });

  it('buys what it has a price for', () => {
    for (const id of ['potion-healing', 'longsword', 'splint']) {
      expect(itemPrice(id), id).toBeDefined();
      expect(stallWillBuy(id), id).toBe(true);
    }
  });

  it('agrees with sellItem, which is the thing that actually refuses', () => {
    // The list and the transaction have to hold the same opinion, or one of
    // them is lying to the player.
    for (const id of ['light-crossbow', 'potion-healing', 'longsword']) {
      const c = camp(1);
      addItem(c.characters[0]!.inventory, id);
      expect(sellItem(c, 0, id), id).toBe(stallWillBuy(id));
    }
  });
});
