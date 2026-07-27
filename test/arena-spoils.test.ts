/**
 * Where magic comes from.
 *
 * Permanent magic used to be a purchase; it is now the reward for a claimed
 * bounty, offered three at a time. What these tests defend is the plumbing
 * around that: that nothing fell down the gap between the two routes, that a
 * retried day cannot reroll the prize, and that no level of party is ever
 * offered an empty table.
 */
import { describe, it, expect } from 'vitest';
import {
  SHOP_STOCK, MAGIC_SPOILS, isObtainable, isPermanentMagic, isMagicalWare,
  shopOffering, rarityOf, itemName, itemPrice, treasureFor,
} from '../src/campaign/campaign.js';
import {
  spoilOffer, spoilPool, spoilTierFor, spoilTierLabel, SPOIL_CHOICES, PERMANENT_FROM_LEVEL,
} from '../src/arena/spoils.js';
import { ITEMS } from '../src/data/items.js';
import { WEAPONS } from '../src/data/weapons.js';
import { TRINKETS } from '../src/data/trinkets.js';
import { ARMOR } from '../src/data/armor.js';
import type { Id } from '../src/engine/types.js';

const LEVELS = [1, 2, 3, 4, 5, 6, 7];

describe('what is permanent and what is ammunition', () => {
  it('keeps weapons, armour, shields and trinkets', () => {
    expect(isPermanentMagic('sun-blade')).toBe(true);
    expect(isPermanentMagic('splint-plus1')).toBe(true);
    expect(isPermanentMagic('shield-plus1')).toBe(true);
    expect(isPermanentMagic('cloak-protection')).toBe(true);
  });

  it('keeps anything with a charge pool that comes back', () => {
    // A wand is treasure; a scroll is ammunition. The tell is the recharge.
    expect(isPermanentMagic('wand-fireballs')).toBe(true);
    expect(isPermanentMagic('figurine-golden-lion')).toBe(true);
    expect(isPermanentMagic('brazier-fire-elemental')).toBe(true);
  });

  it('treats single-use magic as ammunition, which stays purchasable', () => {
    expect(isPermanentMagic('scroll-fireball')).toBe(false);
    expect(isPermanentMagic('potion-fire-resistance')).toBe(false);
    expect(isPermanentMagic('potion-healing')).toBe(false);
  });

  it('never calls a mundane thing magic', () => {
    for (const id of ['dagger', 'longbow', 'splint', 'plate', 'shield']) {
      expect(isPermanentMagic(id), id).toBe(false);
    }
  });
});

describe('the two routes, and the gap between them', () => {
  it('sells no permanent magic at any level', () => {
    // The whole point of the change. If one slips through, magic is a purchase
    // again and the award screen is decoration.
    for (const level of LEVELS) {
      for (const id of shopOffering(SHOP_STOCK, level, 'test-market')) {
        expect(isPermanentMagic(id), `${itemName(id)} is on a level-${level} shelf`).toBe(false);
      }
    }
  });

  it('puts every permanent magic item on the award table', () => {
    for (const id of MAGIC_SPOILS) expect(isPermanentMagic(id), id).toBe(true);
    for (const id of SHOP_STOCK) expect(isPermanentMagic(id), id).toBe(false);
  });

  it('leaves nothing in neither list', () => {
    // The dead-data failure this codebase keeps rediscovering: an item that
    // exists in the data tables and can never be held by anybody.
    const overlap = SHOP_STOCK.filter((id) => MAGIC_SPOILS.includes(id));
    expect(overlap, 'an item that is both bought and awarded').toEqual([]);
    for (const id of [...SHOP_STOCK, ...MAGIC_SPOILS]) {
      expect(isObtainable(id), id).toBe(true);
    }
  });

  it('can still reach every enchanted weapon, armour and trinket in the data', () => {
    const enchanted: Id[] = [
      ...Object.keys(WEAPONS).filter((id) => isMagicalWare(id)),
      ...Object.keys(ARMOR).filter((id) => isMagicalWare(id)),
      ...Object.keys(TRINKETS),
    ];
    const unreachable = enchanted.filter((id) => !isObtainable(id));
    expect(unreachable, `unreachable: ${unreachable.map(itemName).join(', ')}`).toEqual([]);
  });
});

describe('the award pool', () => {
  it('is never empty, at any level', () => {
    // Levels 1 and 2 were empty on the first cut, because every magical
    // consumable is uncommon or better and the shop's uncommon-at-3 gate was
    // reused. A bounty that pays nothing is the quietest bug there is.
    for (const level of LEVELS) {
      const pool = spoilPool(spoilTierFor(level), level);
      expect(pool.length, `level ${level} has nothing to award`).toBeGreaterThanOrEqual(SPOIL_CHOICES);
    }
  });

  it('pays supplies early and treasure later', () => {
    expect(spoilTierFor(1)).toBe('consumable');
    expect(spoilTierFor(PERMANENT_FROM_LEVEL - 1)).toBe('consumable');
    expect(spoilTierFor(PERMANENT_FROM_LEVEL)).toBe('permanent');
    expect(spoilTierFor(7)).toBe('permanent');
  });

  it('offers only things you keep once it is paying treasure', () => {
    for (const level of [4, 5, 6, 7]) {
      for (const id of spoilPool('permanent', level)) expect(isPermanentMagic(id), id).toBe(true);
    }
  });

  it('holds rare items back until level 5, as the shop did', () => {
    for (const id of spoilPool('permanent', 4)) {
      expect(rarityOf(id), `${itemName(id)} offered at level 4`).not.toBe('rare');
    }
    expect(spoilPool('permanent', 5).some((id) => rarityOf(id) === 'rare')).toBe(true);
  });
});

describe('the offer itself', () => {
  it('puts three distinct things on the table', () => {
    for (const level of LEVELS) {
      const offer = spoilOffer(7, 3, 'morning', 0, level);
      expect(offer.length, `level ${level}`).toBe(SPOIL_CHOICES);
      expect(new Set(offer).size, 'the same item twice is not a choice').toBe(SPOIL_CHOICES);
    }
  });

  it('CANNOT be rerolled by losing the day', () => {
    // The load-bearing one. A retried day is the same day — same monsters, same
    // ground, same doors — and if the prize rerolled, the optimal play would be
    // to throw days until the offer was good. The attempt number is not in the
    // seed, so there is nothing to reroll.
    const first = spoilOffer(99, 4, 'afternoon', 0, 5);
    const retry = spoilOffer(99, 4, 'afternoon', 0, 5);
    expect(retry).toEqual(first);
  });

  it('differs by day, by half, and by which bounty paid for it', () => {
    const base = spoilOffer(99, 4, 'morning', 0, 5);
    expect(spoilOffer(99, 5, 'morning', 0, 5), 'a new day').not.toEqual(base);
    expect(spoilOffer(99, 4, 'afternoon', 0, 5), 'the other half').not.toEqual(base);
    expect(spoilOffer(99, 4, 'morning', 1, 5), 'the second bounty').not.toEqual(base);
    expect(spoilOffer(100, 4, 'morning', 0, 5), 'a different run').not.toEqual(base);
  });

  it('offers a level-1 party something worth having', () => {
    const offer = spoilOffer(1, 1, 'morning', 0, 1);
    expect(offer.length).toBe(SPOIL_CHOICES);
    for (const id of offer) {
      expect(isMagicalWare(id), `${itemName(id)} is a mundane consolation prize`).toBe(true);
      expect(ITEMS[id], `${itemName(id)} is not a consumable`).toBeDefined();
    }
  });
});

describe('a level-1 party is actually paid', () => {
  /**
   * The report that prompted this: "bounties at level 1 aren't showing items".
   * The award machinery was correct at every level — what was missing is that
   * the pre-fight card advertised coin and nothing else, so the pick-one-of-
   * three screen arrived unannounced and a player with no reason to expect it
   * concluded low levels paid no items at all.
   *
   * These pin down both halves: that the offer is real at the lowest level, and
   * that there is a phrase to put on the card saying so.
   */
  it('has a real, non-empty offer on the very first day', () => {
    for (let seed = 1; seed <= 25; seed++) {
      const offer = spoilOffer(seed, 1, 'morning', 0, 1);
      expect(offer.length, `seed ${seed}`).toBe(SPOIL_CHOICES);
    }
  });

  it('pays both bounties of a first fight, with different things on each table', () => {
    const first = spoilOffer(5, 1, 'morning', 0, 1);
    const second = spoilOffer(5, 1, 'morning', 1, 1);
    expect(second.length).toBe(SPOIL_CHOICES);
    expect(second, 'two bounties, two different tables').not.toEqual(first);
  });

  it('says what it pays, in words the card can print', () => {
    expect(spoilTierLabel(1)).toBe('a scroll or potion');
    expect(spoilTierLabel(3)).toBe('a scroll or potion');
    expect(spoilTierLabel(PERMANENT_FROM_LEVEL)).toBe('a magic item');
    expect(spoilTierLabel(7)).toBe('a magic item');
    // Whatever it says, it has to match what the player will actually be shown.
    for (const level of [1, 3, 4, 7]) {
      const tier = spoilTierFor(level);
      const offer = spoilOffer(1, 1, 'morning', 0, level);
      for (const id of offer) {
        expect(isPermanentMagic(id), `${id} at level ${level}`).toBe(tier === 'permanent');
      }
    }
  });
});

describe('the routine drop is not a second magic shop', () => {
  /**
   * The bug a player found on their very first fight: a Mace +1 and a Cloak of
   * Protection at level 1.
   *
   * Emptying the shops was only two thirds of the job. Treasure tiers unlocked
   * on the ENCOUNTER's experience alone, and a level-1 arena wave is worth
   * exactly 400 — the uncommon threshold, and 35 of that pool's 60 entries are
   * permanent magic. So the routine post-fight roll quietly went on handing out
   * enchanted gear, which both broke the level-1 power curve and made the
   * bounty award meaningless. Nothing tested it, so nothing said so.
   */
  it('never drops permanent magic in the arena, at any level', () => {
    for (const partyLevel of [1, 3, 5, 7]) {
      for (let seed = 1; seed <= 120; seed++) {
        const t = treasureFor(900, seed, undefined, 900, { partyLevel, noPermanentMagic: true });
        for (const stack of t.items) {
          expect(isPermanentMagic(stack.itemId),
            `${itemName(stack.itemId)} dropped at level ${partyLevel}`).toBe(false);
        }
      }
    }
  });

  it('caps the tier by the party as well as by the fight', () => {
    // 900 XP unlocks every tier on difficulty alone. A level-1 party still
    // cannot be handed an uncommon, let alone a rare.
    for (let seed = 1; seed <= 120; seed++) {
      for (const stack of treasureFor(900, seed, undefined, 900, { partyLevel: 1 }).items) {
        expect(rarityOf(stack.itemId), itemName(stack.itemId)).toBe('common');
      }
    }
    // By level 5 the good stuff is reachable again, or the gate is a wall.
    const rich = Array.from({ length: 200 }, (_, i) =>
      treasureFor(900, i + 1, undefined, 900, { partyLevel: 5 }).items).flat();
    expect(rich.some((s) => rarityOf(s.itemId) !== 'common'), 'level 5 never gets anything good').toBe(true);
  });

  it('reproduces the exact reported case: a level-1 wave pays no enchanted gear', () => {
    // 400 XP is what `buildWave` gives a level-1 wave-1 arena fight.
    for (let seed = 1; seed <= 200; seed++) {
      for (const stack of treasureFor(400, seed, undefined, 400,
        { partyLevel: 1, noPermanentMagic: true }).items) {
        expect(isMagicalWare(stack.itemId), itemName(stack.itemId)).toBe(false);
      }
    }
  });

  it('never hands over an empty stack when a pool is filtered away', () => {
    // `pick` off an empty array is `undefined`, which enters an inventory as a
    // stack of nothing and paints a blank row on the loot screen.
    for (let seed = 1; seed <= 100; seed++) {
      const t = treasureFor(900, seed, 'rare', 900, { partyLevel: 7, noPermanentMagic: true });
      for (const stack of t.items) {
        expect(stack.itemId, 'an undefined item id reached the pack').toBeTruthy();
        expect(itemPrice(stack.itemId) !== undefined || rarityOf(stack.itemId)).toBeTruthy();
      }
    }
  });
});
