/**
 * The defeat tax.
 *
 * A lost day used to cost a day and nothing else, which left the arena's grind
 * unbounded: win the morning, throw the afternoon, bank the experience, repeat.
 * What these tests defend is that the bill scales with the run rather than
 * sitting at a constant, that it can be met by selling but never by stripping
 * the armor off the party's back, and that running out of money ends the run
 * cleanly instead of spiralling.
 */
import { describe, it, expect } from 'vitest';
import {
  REVIVAL_SHARE, revivalCost, payRevival, liquidValue, isFirstDefeat,
} from '../src/arena/revival.js';
import { newArenaRun, advanceDay, wavePurse } from '../src/arena/run.js';
import { newCampaign, itemPrice, addItem, type CampaignState } from '../src/campaign/campaign.js';

function camp(gold = 0): CampaignState {
  const c = newCampaign(7);
  c.gold = gold;
  for (const ch of c.characters) ch.inventory = [];
  return c;
}

describe('what a defeat costs', () => {
  it('is a share of the day\'s purse, so it scales with the run', () => {
    for (const [level, wave] of [[1, 1], [3, 5], [5, 9], [7, 15]] as const) {
      expect(revivalCost(level, wave)).toBe(Math.round(wavePurse(level, wave) * REVIVAL_SHARE));
    }
  });

  it('costs far more late than early — which a flat fee could never do', () => {
    // The bounty bug in miniature: a constant that stings at level 1 is a
    // rounding error at level 7. If this spread ever collapses, the tax has
    // stopped being felt at one end of the run or the other.
    const early = revivalCost(1, 1);
    const late = revivalCost(7, 15);
    expect(late / early).toBeGreaterThan(5);
  });

  it('exempts the run\'s first defeat, and only the first', () => {
    let run = newArenaRun(1);
    expect(isFirstDefeat(run), 'nothing lost yet').toBe(true);

    run = advanceDay(run, false, 0);              // lose day 1 — free
    expect(isFirstDefeat(run), 'one defeat behind us').toBe(false);

    run = advanceDay(run, false, 0);
    expect(isFirstDefeat(run)).toBe(false);
  });

  it('does not hand out a fresh exemption for every day cleared', () => {
    // The grace is "your first defeat", not "your first defeat since a win".
    // Deriving it from day-minus-cleared makes that automatic; a counter reset
    // on a win would have made the whole tax optional for a careful grinder.
    let run = newArenaRun(1);
    run = advanceDay(run, true, 0);               // win the morning
    run = advanceDay(run, true, 50);              // clear day 1
    expect(isFirstDefeat(run), 'still never lost').toBe(true);
    run = advanceDay(run, false, 0);              // lose day 2 — the free one
    expect(isFirstDefeat(run)).toBe(false);

    run = advanceDay(run, true, 0);
    run = advanceDay(run, true, 50);              // clear another day
    expect(isFirstDefeat(run), 'a win does not restore the grace').toBe(false);
  });
});

describe('settling the bill', () => {
  it('takes it out of coin when there is enough', () => {
    const c = camp(500);
    const bill = payRevival(c, 200);
    expect(bill.insolvent).toBe(false);
    expect(bill.fromPurse).toBe(200);
    expect(bill.sold).toEqual([]);
    expect(c.gold).toBe(300);
  });

  it('sells the dearest thing first, so one treasure goes rather than eight trinkets', () => {
    const c = camp(0);
    addItem(c.characters[0]!.inventory, 'potion-healing', 3);   // 50g each → 25g
    addItem(c.characters[1]!.inventory, 'splint');              // 200g → 100g
    const bill = payRevival(c, 90);
    expect(bill.insolvent).toBe(false);
    expect(bill.sold.map((s) => s.itemId), 'the splint covered it alone').toEqual(['splint']);
    // Sold for 100, owed 90 — the change stays in the purse.
    expect(c.gold).toBe(10);
    expect(c.characters[0]!.inventory[0]!.qty, 'the potions are untouched').toBe(3);
  });

  it('keeps selling until the bill is met', () => {
    const c = camp(0);
    addItem(c.characters[0]!.inventory, 'potion-healing', 4);   // 25g each
    const bill = payRevival(c, 90);
    expect(bill.insolvent).toBe(false);
    expect(bill.sold.length).toBe(4);
    expect(c.gold).toBe(10);
  });

  it('never sells worn gear, however desperate', () => {
    // Stripping a party's armor to pay for its own revival is the purest death
    // spiral available. Ending the run is the better outcome, so equipped
    // items are invisible to both the valuation and the sale.
    const c = camp(0);
    c.characters[0]!.equipped = { mainHand: 'longsword', armor: 'plate' };
    expect(liquidValue(c), 'plate is worth 1500 and counts for nothing').toBe(0);
    const bill = payRevival(c, 50);
    expect(bill.insolvent).toBe(true);
    expect(c.characters[0]!.equipped.armor, 'still wearing it').toBe('plate');
  });
});

describe('going under', () => {
  it('declares insolvency rather than part-paying', () => {
    const c = camp(30);
    addItem(c.characters[0]!.inventory, 'potion-healing');   // 25g
    expect(liquidValue(c)).toBe(55);
    const bill = payRevival(c, 200);
    expect(bill.insolvent).toBe(true);
  });

  it('takes nothing on the way out', () => {
    // The run is ending on the final screen. Emptying the packs first would
    // make that screen a lie about what the party had actually accumulated.
    const c = camp(30);
    addItem(c.characters[0]!.inventory, 'potion-healing');
    payRevival(c, 200);
    expect(c.gold, 'coin untouched').toBe(30);
    expect(c.characters[0]!.inventory[0]!.qty, 'pack untouched').toBe(1);
  });

  it('pays exactly when the party can just barely afford it', () => {
    const c = camp(0);
    addItem(c.characters[0]!.inventory, 'splint');   // sells for 100
    expect(liquidValue(c)).toBe(100);
    const bill = payRevival(c, 100);
    expect(bill.insolvent).toBe(false);
    expect(c.gold).toBe(0);
  });

  it('never leaves the purse negative', () => {
    for (const cost of [1, 37, 99, 100]) {
      const c = camp(0);
      addItem(c.characters[0]!.inventory, 'splint');
      payRevival(c, cost);
      expect(c.gold, `cost ${cost}`).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('valuation', () => {
  it('counts coin plus every pack at the shop\'s half price', () => {
    const c = camp(100);
    addItem(c.characters[0]!.inventory, 'potion-healing', 2);
    addItem(c.characters[2]!.inventory, 'splint');
    const half = (id: string) => Math.floor(itemPrice(id)! / 2);
    expect(liquidValue(c)).toBe(100 + half('potion-healing') * 2 + half('splint'));
  });

  it('ignores anything the shop will not price', () => {
    const c = camp(10);
    addItem(c.characters[0]!.inventory, 'not-a-real-item');
    expect(liquidValue(c)).toBe(10);
  });
});
