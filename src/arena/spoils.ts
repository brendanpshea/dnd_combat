/**
 * What the arena gives you for doing something worth watching.
 *
 * Magic used to be a purchase. You saved up, you clicked, you owned it — which
 * is the least interesting way to acquire anything, and it made the shop the
 * most important screen in the game. Permanent magic now comes only from
 * bounties: the optional objectives named before the fight, which are already
 * the one part of the arena that rewards playing well rather than playing long.
 *
 * THREE, PICK ONE.
 *
 * Not a single fixed drop. A random award means the wizard never gets the wand
 * and the party's shape is decided by dice; a shop means no discovery at all.
 * Offering three and taking one is the middle: the roll decides what is on the
 * table, and the player decides what leaves with them. It is also the only
 * version where a reward can be *interesting* — passing over two good things is
 * what makes the third feel chosen.
 *
 * SEEDED OFF THE DAY, WHICH IS LOAD-BEARING.
 *
 * A retried day is the same day: same monsters, same ground, same doors. The
 * offer has to be the same three items too. If it rerolled, the optimal play
 * would be to deliberately lose days until the offer is good, and every part of
 * the freeze-the-day design would quietly become a slot machine. So the seed is
 * the run, the day and the half — never the attempt.
 *
 * WHAT IS ON OFFER SCALES WITH THE PARTY.
 *
 * Levels 1-3 are paid in consumables, because that is when a scroll or a
 * resistance potion genuinely changes a fight and a permanent item would
 * trivialise the ramp. From level 4 the awards are things you keep. That split
 * also fixes a measured problem: the median run ends around level 3 while rare
 * items unlock at 5, so most of the good content had never been seen by a
 * typical party. Consumable awards early mean every run gets *something*.
 */
import type { Id } from '../engine/types.js';
import { ITEMS } from '../data/items.js';
import { rarityOf, isMagicalWare, isPermanentMagic, SHOP_STOCK, MAGIC_SPOILS } from '../campaign/campaign.js';
import { next, type RngState } from '../engine/rng.js';

/** How many items an award puts on the table. */
export const SPOIL_CHOICES = 3;

/** The level at which awards stop being supplies and start being treasure. */
export const PERMANENT_FROM_LEVEL = 4;

export type SpoilTier = 'consumable' | 'permanent';

export function spoilTierFor(level: number): SpoilTier {
  return level >= PERMANENT_FROM_LEVEL ? 'permanent' : 'consumable';
}

/**
 * When each rarity becomes worth offering, per tier.
 *
 * The consumable gate is nearly open, and it has to be: every magical
 * consumable in the game is uncommon or better, so reusing the shop's
 * uncommon-at-3 rule left levels 1 and 2 with an EMPTY POOL — a bounty that
 * paid nothing at all, which is precisely the silent failure this codebase
 * keeps rediscovering. A first-level party that earns a bounty should get a
 * Scroll of Web out of it.
 *
 * The permanent gate is the shop's, because a kept item is a lasting change to
 * a party's power and handing a level-4 party a rare weapon skips the ramp.
 */
const AWARD_MIN_LEVEL: Record<SpoilTier, Record<string, number>> = {
  consumable: { common: 1, uncommon: 1, rare: 3 },
  permanent: { common: 1, uncommon: 3, rare: 5 },
};

/** Everything the arena might hand over, by tier. Derived, never hand-kept. */
export function spoilPool(tier: SpoilTier, level: number): Id[] {
  const source = tier === 'permanent' ? MAGIC_SPOILS : SHOP_STOCK;
  return source.filter((id) => {
    if (tier === 'permanent') {
      if (!isPermanentMagic(id)) return false;
    } else {
      // Consumable awards are the magical ones — a scroll of Fireball, a
      // resistance potion. Handing a party a plain dagger for a bounty they
      // fought for would read as an insult.
      if (!isMagicalWare(id) || isPermanentMagic(id)) return false;
    }
    return level >= (AWARD_MIN_LEVEL[tier][rarityOf(id)] ?? 1);
  });
}

/**
 * The three items on offer for one claimed bounty.
 *
 * `bountyIndex` separates two bounties claimed in the same fight, so a party
 * that earns both is not offered the same three things twice.
 *
 * Returns fewer than three only if the pool itself is smaller, which a test
 * guards against — an award of one item is not a choice, and an award of none
 * is a bug that would look exactly like a bounty quietly paying nothing.
 */
export function spoilOffer(
  runSeed: number, day: number, half: 'morning' | 'afternoon',
  bountyIndex: number, level: number,
): Id[] {
  const pool = spoilPool(spoilTierFor(level), level);
  // The attempt number is deliberately absent: a retried day must offer the
  // same three items, or losing on purpose becomes a way to reroll the prize.
  let rng: RngState = (
    runSeed * 2654435761 +
    day * 40503 +
    (half === 'afternoon' ? 1013904223 : 0) +
    bountyIndex * 2246822519 +
    level * 374761393
  ) >>> 0;
  const rest = [...pool];
  const picked: Id[] = [];
  while (picked.length < SPOIL_CHOICES && rest.length > 0) {
    const r = next(rng); rng = r.state;
    picked.push(...rest.splice(Math.floor(r.value * rest.length), 1));
  }
  return picked;
}

/** A short line for why this item is on the table, shown under its name. */
export function spoilBlurb(itemId: Id): string {
  const item = ITEMS[itemId];
  if (item?.charges !== undefined) return `${item.charges} charges, recharging`;
  return rarityOf(itemId);
}
