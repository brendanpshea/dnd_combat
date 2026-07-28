/**
 * Scrolls are a function of the spell list, not a list somebody maintained.
 *
 * Hand-authored, the roster had the shape of whatever had been got round to:
 * 8 of 28 first-level spells had a scroll, 5 of 15 at second, and nothing at
 * all at fourth. The consequence was invisible until it was measured — a ranger
 * or paladin party could win a second-level scroll and find that nobody in the
 * company was allowed to read it, because every second-level scroll that
 * existed happened to be off their list.
 */
import { describe, it, expect } from 'vitest';
import { ITEMS, SCROLL_IDS } from '../src/data/items.js';
import { SPELLS } from '../src/data/spells.js';
import { CLASSES, classScrollPool } from '../src/data/classes.js';
import { SHOP_STOCK, isObtainable } from '../src/campaign/campaign.js';

const spellOf = (scrollId: string) => scrollId.slice('scroll-'.length);
const casters = Object.keys(CLASSES).filter((id) => CLASSES[id]?.spellcasting);

describe('which spells get a scroll', () => {
  it('covers every leveled spell somebody is allowed to read', () => {
    const missing = Object.keys(SPELLS).filter((id) => {
      const s = SPELLS[id]!;
      if ((s.level ?? 0) < 1 || s.castingTime === 'reaction') return false;
      if (!casters.some((c) => classScrollPool(c).has(id))) return false;
      return !ITEMS[`scroll-${id}`];
    });
    expect(missing).toEqual([]);
  });

  it('writes none for a spell no class can read', () => {
    // `useItem` refuses a scroll outside the reader's class pool, so one of
    // these would be purchasable, carryable and unusable — dead data with a
    // price tag. Divine Smite and Breath Weapon are class features wearing a
    // spell's clothes, and they are exactly the two that fall out here.
    for (const id of Object.keys(SPELLS)) {
      if (casters.some((c) => classScrollPool(c).has(id))) continue;
      expect(ITEMS[`scroll-${id}`], id).toBeUndefined();
    }
  });

  it('writes none for a reaction spell', () => {
    // Shield is cast when something hits you; a scroll is read on your turn.
    // The item would be legal, purchasable and pointless.
    for (const id of Object.keys(SPELLS)) {
      if (SPELLS[id]!.castingTime !== 'reaction') continue;
      expect(ITEMS[`scroll-${id}`], id).toBeUndefined();
    }
  });

  it('writes none for a cantrip', () => {
    for (const id of Object.keys(SPELLS)) {
      if ((SPELLS[id]!.level ?? 0) !== 0) continue;
      expect(ITEMS[`scroll-${id}`], id).toBeUndefined();
    }
  });
});

describe('what a generated scroll costs and how long it takes', () => {
  it('takes as long as the spell it casts', () => {
    // A bonus-action spell read from a scroll is still a bonus action, which is
    // most of why Misty Step or Healing Word on a scroll is worth carrying.
    for (const id of SCROLL_IDS) {
      const spell = SPELLS[spellOf(id)];
      if (!spell) continue;
      expect(ITEMS[id]!.useTime, id).toBe(spell.castingTime === 'bonus' ? 'bonus' : 'action');
    }
  });

  it('prices by spell level, monotonically', () => {
    const byLevel = new Map<number, number[]>();
    for (const id of SCROLL_IDS) {
      const lvl = SPELLS[spellOf(id)]?.level;
      if (lvl === undefined) continue;
      byLevel.set(lvl, [...(byLevel.get(lvl) ?? []), ITEMS[id]!.cost]);
    }
    const levels = [...byLevel.keys()].sort((a, b) => a - b);
    for (let i = 1; i < levels.length; i++) {
      const lo = Math.max(...byLevel.get(levels[i - 1]!)!);
      const hi = Math.min(...byLevel.get(levels[i]!)!);
      expect(hi, `level ${levels[i]} is not dearer than ${levels[i - 1]}`).toBeGreaterThan(lo);
    }
  });

  it('keeps the hand-tuned entries that predate generation', () => {
    // Command at 40g and Ray of Sickness at uncommon are deliberate exceptions.
    // Generation must fill gaps, not flatten decisions.
    expect(ITEMS['scroll-command']!.cost).toBe(40);
    expect(ITEMS['scroll-ray-of-sickness']!.rarity).toBe('uncommon');
  });
});

describe('who can actually use what is on sale', () => {
  it('leaves no caster with nothing to read at the tiers the arena awards', () => {
    // The failure this whole change exists to prevent, stated directly: a
    // paladin or ranger party winning a scroll nobody can open.
    for (const cls of casters) {
      const pool = classScrollPool(cls);
      for (const level of [1, 2]) {
        const mine = SCROLL_IDS.filter((id) =>
          pool.has(spellOf(id)) && SPELLS[spellOf(id)]?.level === level);
        expect(mine.length, `${cls} has no level-${level} scroll`).toBeGreaterThan(0);
      }
    }
  });

  it('puts every scroll somewhere a player can get it', () => {
    for (const id of SCROLL_IDS) {
      expect(isObtainable(id), id).toBe(true);
      expect(SHOP_STOCK, id).toContain(id);
    }
  });
});
