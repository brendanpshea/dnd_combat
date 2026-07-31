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
import {
  SHOP_STOCK, isObtainable, newCampaign, addItem, partyLevelOf, LEVEL_XP,
  scrollLearnable, learnSpellFromScroll, preparableSpells, setPrepared, preparedSpells,
  type CampaignState,
} from '../src/campaign/campaign.js';

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

/**
 * Scribing, reported from a real run: "I tried scribing web at level 3 and the
 * spellbook didn't update. Also we shouldn't allow scribing level 2 spells
 * below level 3."
 *
 * Two separate faults, both real.
 *
 * NO LEVEL GATE AT ALL. `scrollLearnable` checked the class pool and whether
 * the spell was already known, and nothing else — so a first-level wizard could
 * pay to copy a ninth-level scroll into a book they cannot cast from for eight
 * more levels. The gate is the class table, which already says which spells a
 * wizard of a given level may have.
 *
 * AND THE SCROLL VANISHED. `learnSpellFromScroll` puts the spell in
 * `scribedSpells`, and `preparableSpells` reads it, so the ENGINE knew — but
 * the tray's leveled pool for a wizard was `spellbookDraft`, the base book
 * alone. A scribed spell therefore appeared in neither list: not in the
 * spellbook, not among the spells you may prepare. 100 gold for something the
 * player could not see or use.
 */
describe('copying a scroll into a spellbook', () => {
  const wizardIdx = (c: CampaignState) => c.characters.findIndex((x) => x.classId === 'wizard');

  const runAt = (xp: number): CampaignState => {
    const c = newCampaign(5);
    c.partyReady = true;
    c.xp = xp;
    // An explicit book WITHOUT Web. The level-3 default already contains it,
    // which makes `scrollLearnable` decline for the "already known" reason and
    // would let these pass without the level gate they are about.
    const w = c.characters.findIndex((x) => x.classId === 'wizard');
    c.characters[w]!.spellbook = ['magic-missile', 'shield', 'burning-hands'];
    return c;
  };

  it('refuses a spell the caster is not high enough to have', () => {
    // Web is a 2nd-level spell the wizard table grants at character level 3.
    const c = runAt(0);
    expect(partyLevelOf(c)).toBe(1);
    const w = wizardIdx(c);
    addItem(c.characters[w]!.inventory, 'scroll-web');
    expect(scrollLearnable(c, w, 'scroll-web'),
      'a level-1 wizard was allowed to buy a 2nd-level spell').toBeUndefined();
    expect(learnSpellFromScroll(c, w, 'scroll-web')).toBe(false);
  });

  it('allows it once the caster is high enough', () => {
    const c = runAt(LEVEL_XP[2]!);   // level 3
    expect(partyLevelOf(c)).toBe(3);
    const w = wizardIdx(c);
    addItem(c.characters[w]!.inventory, 'scroll-web');
    c.gold = 500;
    expect(scrollLearnable(c, w, 'scroll-web')).toBeDefined();
    expect(learnSpellFromScroll(c, w, 'scroll-web')).toBe(true);
  });

  it('puts the spell somewhere the player can actually prepare it', () => {
    const c = runAt(LEVEL_XP[2]!);
    const w = wizardIdx(c);
    addItem(c.characters[w]!.inventory, 'scroll-web');
    c.gold = 500;
    expect(learnSpellFromScroll(c, w, 'scroll-web')).toBe(true);
    expect(preparableSpells(c, w), 'scribed spell is not preparable').toContain('web');
    // ...and preparing it sticks, rather than being filtered back out.
    setPrepared(c, w, [...preparedSpells(c, w).slice(0, 1), 'web']);
    expect(preparedSpells(c, w), 'the scribed spell would not stay prepared').toContain('web');
  });

  it('charges and consumes only on success', () => {
    const c = runAt(0);
    const w = wizardIdx(c);
    addItem(c.characters[w]!.inventory, 'scroll-web');
    const gold = c.gold;
    expect(learnSpellFromScroll(c, w, 'scroll-web')).toBe(false);
    expect(c.gold, 'a refused scribe still took the fee').toBe(gold);
    expect(c.characters[w]!.inventory.some((s) => s.itemId === 'scroll-web' && s.qty > 0),
      'a refused scribe still burnt the scroll').toBe(true);
  });
});

/**
 * The level gate is on the spell's LEVEL, not on the class's offer list.
 *
 * The first fix gated on `availableLeveledSpells`, which broke the feature
 * outright: the whole point of scribing is to learn spells that are NOT on your
 * default list. `test/campaign.test.ts` caught it — Ray of Sickness is a
 * wizard-list scroll the wizard table never offers, and it had stopped being
 * learnable at any level.
 */
describe('what the scribing gate is made of', () => {
  it('still allows a spell that is off the class offer list', () => {
    const c = newCampaign(9);
    c.partyReady = true;
    const w = c.characters.findIndex((x) => x.classId === 'wizard');
    expect(preparableSpells(c, w), 'this test needs a spell off the default list')
      .not.toContain('ray-of-sickness');
    addItem(c.characters[w]!.inventory, 'scroll-ray-of-sickness');
    expect(scrollLearnable(c, w, 'scroll-ray-of-sickness'),
      'gating on the offer list would reduce scribing to spells you could already pick')
      .toBeDefined();
  });
});
