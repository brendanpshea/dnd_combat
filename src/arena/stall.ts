/**
 * The arena's stall: haggling, and the odd bit of theft.
 *
 * The arena's shop was a vending machine — a list of prices and a Buy button.
 * Adventure shops have had haggling and a steal gambit for a long time, both
 * built on party skill checks that already exist in `campaign.ts`; the arena
 * simply never called them. So a party with a silver-tongued bard and a
 * light-fingered rogue got nothing for either at the one screen where a social
 * skill could plausibly matter.
 *
 * ONE VISIT PER DAY, AND THE DAY IS THE RESET.
 *
 * A visit is not a screen you opened; it is the morning's trip to the market.
 * Haggle once, try the shelf once, and whatever you talked the merchant into
 * holds for the rest of that morning. Tying it to the day rather than to the
 * panel matters — otherwise closing and reopening the stall would reroll a
 * failed haggle, which is the same reroll-by-retry hole the day freeze exists
 * to close everywhere else.
 *
 * The stakes are asymmetric on purpose, matching the adventure table:
 * persuasion is safe and pays least, intimidation risks a 25% markup for the
 * best discount, deception sits between them at an easier DC. Stealing risks a
 * fine and pays an item outright.
 */
import type { Id } from '../engine/types.js';
import { itemPrice } from '../campaign/campaign.js';

export interface StallVisit {
  /** The day this visit belongs to. A new day is a new merchant mood. */
  day: number;
  /** Multiplier on every asking price this visit. 1 = the merchant's list. */
  priceMult: number;
  haggleUsed: boolean;
  stealUsed: boolean;
}

/** A fresh visit, as the stall looks before anybody has said anything. */
export function newStallVisit(day: number): StallVisit {
  return { day, priceMult: 1, haggleUsed: false, stealUsed: false };
}

/**
 * This morning's visit, starting a new one when the day has turned.
 *
 * Reading it is what creates it, so nothing has to remember to reset the stall
 * at dawn — the same "absent means fresh" convention the rest of the run state
 * uses for hit points and charges.
 */
export function stallVisitOf(stored: StallVisit | undefined, day: number): StallVisit {
  return stored && stored.day === day ? stored : newStallVisit(day);
}

/** What the merchant is asking for this item, after any haggling. */
export function stallPrice(itemId: Id, visit: StallVisit): number {
  return Math.ceil((itemPrice(itemId) ?? 0) * visit.priceMult);
}

/**
 * What the stall pays for something out of your pack.
 *
 * Half the list price, and deliberately NOT scaled by a haggle: talking a
 * merchant down on what they charge is a different conversation from talking
 * them up on what they pay, and letting one roll do both would make a good
 * intimidation check worth roughly double what it should be.
 */
export function stallResale(itemId: Id): number {
  return Math.floor((itemPrice(itemId) ?? 0) / 2);
}

/**
 * Will the stall buy this at all?
 *
 * Plenty of starting gear carries no price — a light crossbow, for one — and
 * `sellItem` refuses anything unpriced. Offering such a row at "+0g" costs a
 * tap and a confirm and then does nothing, which is worse than not offering it:
 * a button that visibly fails teaches a player not to trust the others.
 */
export function stallWillBuy(itemId: Id): boolean {
  return itemPrice(itemId) !== undefined;
}
