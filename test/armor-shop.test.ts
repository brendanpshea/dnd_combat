/**
 * Can a player actually get the armor the game contains?
 *
 * Written after finding that studded leather — the best mundane light armor,
 * and what a rogue and a ranger start the game wearing — was on no ware list at
 * all, so a bard, a warlock or a Duelist fighter could never buy one. Scale mail
 * and chain mail were in the same state, each of them also somebody's starting
 * kit.
 *
 * The existing reachability guard missed all three because it asks whether the
 * *treasure pool* is reachable. These armors were in no pool, which is precisely
 * why nothing complained.
 */
import { describe, it, expect } from 'vitest';
import { ARMOR, armorClass, type ArmorData } from '../src/data/armor.js';
import { CLASSES, kitFor } from '../src/data/classes.js';
import { SHOP_STOCK, isObtainable, shopOffering } from '../src/campaign/campaign.js';

/** Plain armor: no +1, no adamantine, nothing above common. */
const mundane = (a: ArmorData) =>
  a.rarity === 'common' && !a.id.includes('adamantine') && !a.id.endsWith('plus1');

describe('armor reachability', () => {
  it('every mundane armor can be bought', () => {
    const missing = Object.values(ARMOR).filter(mundane).filter((a) => !isObtainable(a.id));
    expect(missing.map((a) => a.id)).toEqual([]);
  });

  it('every armor a class starts in can be bought', () => {
    // The strictest version of the same question: you must be able to replace,
    // or upgrade to, what somebody already walks in wearing.
    const startsIn = new Set<string>();
    for (const cls of Object.values(CLASSES)) {
      const kitIds = cls.kits?.map((k) => k.id) ?? [undefined];
      for (const kitId of kitIds) {
        const armor = kitFor(cls, kitId).equipment.armor;
        if (armor) startsIn.add(armor);
      }
    }
    expect(startsIn.size).toBeGreaterThan(3);
    for (const id of startsIn) expect(isObtainable(id), id).toBe(true);
  });

  it('mundane armor is a staple, on the shelf at every level', () => {
    // Armor must not be part of the level-gated magical rotation — a first-level
    // party saving for studded leather has to be able to see it.
    for (const level of [1, 3, 5, 8]) {
      const shelf = shopOffering(SHOP_STOCK, level, 'a-shop');
      for (const a of Object.values(ARMOR).filter(mundane)) {
        expect(shelf, `${a.id} at level ${level}`).toContain(a.id);
      }
    }
  });

  it('the light ladder has a rung above leather', () => {
    // The specific gap: leather (11) was the only buyable light armor, so a
    // light-armor class could never improve its armor at all.
    const light = Object.values(ARMOR).filter(mundane)
      .filter((a) => a.category === 'light' && isObtainable(a.id));
    expect(Math.max(...light.map((a) => a.base))).toBe(12);
  });
});

describe('the arena shopper measures the armour a hero would actually wear', () => {
  it('ranks by effective AC, not by the base number', async () => {
    /**
     * A harness guard, in the manner of the `map: wave.map` one.
     *
     * The shopper used to compare `armor.base`, which ignores the Dexterity cap.
     * That was harmless while every hero's Dexterity was middling — and stopped
     * being harmless once a kit could lead on Dexterity AND the whole armour
     * table went on sale. A Duelist fighter at 8th has Dex 20, and in studded
     * leather sits at AC 17. A shopper reading base numbers sees chain mail's 16
     * beat studded leather's 12, buys it, and takes the hero DOWN to 16 while
     * also costing it stealth. Every measurement of the kit would then have been
     * of a character nobody would play — exactly the failure mode this
     * repository keeps finding in its own harness.
     *
     * (Note the flaw only appears at high Dexterity: at Dex 16 chain mail really
     * is the better buy, which is why this survived as long as it did.)
     *
     * Read as source: running whole arena runs inside a unit test to watch a
     * purchase is not a trade worth making.
     */
    const { readFileSync } = await import('node:fs');
    const { fileURLToPath } = await import('node:url');
    const src = readFileSync(fileURLToPath(new URL('../scripts/arena-eda.ts', import.meta.url)), 'utf8');
    const fn = src.slice(src.indexOf('function shopForArmor'));
    const body = fn.slice(0, fn.indexOf('\nfunction '));
    expect(body).toContain('armorClass(');
    expect(body, 'ranks armour by base, ignoring the Dexterity cap')
      .not.toMatch(/\.armor\.base\s*>/);
  });

  it('and the cap is what makes the two differ', () => {
    // The concrete case the guard exists for: a Duelist fighter at 8th level.
    const dex20 = 5;
    const studded = 'studded-leather', chain = 'chain-mail';
    expect(ARMOR[chain]!.base).toBeGreaterThan(ARMOR[studded]!.base);   // base says chain mail
    expect(armorClass(studded, dex20, 0))
      .toBeGreaterThan(armorClass(chain, dex20, 0));                    // the hero says studded
    // ...and at the Dexterity an ordinary fighter has, the two agree — which is
    // why ranking by base was fine until kits existed.
    expect(armorClass(chain, 1, 0)).toBeGreaterThan(armorClass(studded, 1, 0));
  });
});
