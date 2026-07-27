/**
 * What a defeat costs.
 *
 * Before this, losing a day cost a day and nothing else. That made the arena's
 * one real decision — press on or play it safe — free to get wrong, and it left
 * the grind unbounded: win the morning, throw the afternoon, bank the morning's
 * experience, repeat forever. A meter on that loop is the whole point.
 *
 * The bill is the arena's fiction as much as its economy. The powers that be
 * will put your party back on its feet, and they take their cut for it.
 *
 * PRICED AS A SHARE OF THE DAY'S PURSE, NOT AS FLAT GOLD.
 *
 * A flat number cannot work here and we have already been burned by trying:
 * arena bounties shipped at a flat 60g, which doubled a level-1 wave's purse
 * and was a ninth of a late one. The purse runs from 40g at level 1 to over
 * 400g at level 7 — a tenfold spread — so any constant is either ruinous at the
 * bottom or invisible at the top. A share holds the pressure steady across the
 * whole run.
 *
 * WHEN YOU CANNOT PAY
 *
 * You sell. Anything in a pack can go, at the shop's usual half price, most
 * valuable first — one treasure rather than the whole kit. Worn gear is NOT
 * sold: stripping a party's armor to pay for its own revival is the purest
 * form of death spiral, and the run ending cleanly is a better outcome than a
 * party shuffling on in rags. If the packs cannot cover it either, the run is
 * over, and that is the arena's first real loss condition.
 */
import type { Id } from '../engine/types.js';
import { type CampaignState, itemPrice, sellItem, partyLevelOf } from '../campaign/campaign.js';
import { wavePurse } from './run.js';

/**
 * The bill as a multiple of one day's purse.
 *
 * At 1.0 a defeat costs a day's takings — you lose the day and the day's pay,
 * which is the plainest statement of "that one did not count" the economy can
 * make. Measured over 40 day-runs it costs about 8 points of days-cleared and
 * ends roughly one run in six in insolvency rather than in giving up, which is
 * enough to be felt without being the usual way a run finishes.
 */
export const REVIVAL_SHARE = 2.0;

/** What the powers that be charge to put the party back on its feet. */
export function revivalCost(level: number, wave: number): number {
  return Math.round(wavePurse(level, wave) * REVIVAL_SHARE);
}

/** Gold a character could raise by emptying their pack (half price, as the shop pays). */
function packValue(c: CampaignState, charIdx: number): number {
  const ch = c.characters[charIdx];
  if (!ch) return 0;
  return ch.inventory.reduce((sum, stack) => {
    const price = itemPrice(stack.itemId);
    return price === undefined ? sum : sum + Math.floor(price / 2) * stack.qty;
  }, 0);
}

/** Everything the party could put together right now: coin plus every pack. */
export function liquidValue(c: CampaignState): number {
  return c.gold + c.characters.reduce((sum, _ch, i) => sum + packValue(c, i), 0);
}

export interface RevivalBill {
  cost: number;
  /** Gold paid from coin already in hand. */
  fromPurse: number;
  /** What had to be sold to make up the difference, in the order it went. */
  sold: Array<{ itemId: Id; gold: number }>;
  /** True when even selling every pack could not cover it: the run is over. */
  insolvent: boolean;
}

/**
 * Settle the bill, selling from packs only as far as necessary.
 *
 * Sells the most valuable item first, so a party that owes 200g loses one good
 * thing rather than eight small ones — which is both what a player would do at
 * a counter and the version that leaves a usable kit behind.
 *
 * On insolvency NOTHING is sold and no gold changes hands. The run is ending;
 * emptying the packs on the way out would only make the final screen a lie
 * about what the party had achieved.
 */
export function payRevival(c: CampaignState, cost: number): RevivalBill {
  if (liquidValue(c) < cost) {
    return { cost, fromPurse: 0, sold: [], insolvent: true };
  }
  const sold: RevivalBill['sold'] = [];
  let guard = 0;
  while (c.gold < cost && guard++ < 500) {
    // The dearest thing anyone is carrying.
    let best: { charIdx: number; itemId: Id; gold: number } | undefined;
    for (const [charIdx, ch] of c.characters.entries()) {
      for (const stack of ch.inventory) {
        if (stack.qty <= 0) continue;
        const price = itemPrice(stack.itemId);
        if (price === undefined) continue;
        const gold = Math.floor(price / 2);
        if (!best || gold > best.gold) best = { charIdx, itemId: stack.itemId, gold };
      }
    }
    if (!best) break;
    if (!sellItem(c, best.charIdx, best.itemId)) break;
    sold.push({ itemId: best.itemId, gold: best.gold });
  }
  // `liquidValue` already said this is affordable, so the loop cannot leave the
  // party short — but pay defensively rather than letting gold go negative.
  const fromPurse = Math.min(c.gold, cost);
  c.gold -= fromPurse;
  return { cost, fromPurse, sold, insolvent: false };
}

/**
 * Is this the run's first defeat?
 *
 * The first one is free. Not sentiment: at level 1 the bill is 80g against a
 * 100gp starting purse, so a party that loses its opening day is nearly broke
 * before it has learned what the arena is — and measurement found runs going
 * under on day 2, which is a bad first impression rather than a loss condition.
 * A grinder loses dozens of days and never notices the exemption.
 *
 * Derived rather than stored: every day either clears or is lost, so the lost
 * ones are simply the days that have passed minus the ones that counted. No
 * new field, and nothing to keep in sync.
 */
export function isFirstDefeat(run: { day?: number; cleared: number }): boolean {
  return Math.max(0, (run.day ?? 1) - 1 - run.cleared) === 0;
}

/** The bill for losing the day this run is on. */
export function revivalCostFor(c: CampaignState, wave: number, dayLevel?: number): number {
  return revivalCost(dayLevel ?? partyLevelOf(c), wave);
}
