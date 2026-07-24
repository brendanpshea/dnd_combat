import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import {
  newCampaign, currentStage, isComplete, buildCampaignParty, applyVictory,
  buyItem, sellItem, itemPrice, itemName, STAGES, STARTING_GOLD, SHOP_STOCK, shopOffering,
  treasureFor, rarityOf, levelForXp, partyLevelOf, xpAward, LEVEL_XP,
  giveItem, equipItem, equipBlocked, unequipSlot, setPartyClass, parseCampaign,
  partySkillCheck, attemptSteal, shortRest, longRest, fullRest, useStoreHealing, useStoreSpell,
  hitDiceLeft, hitDiceMax, isCampBuffPotion, drinkCampBuffPotion,
  levelUpSummary, setLevelChoice, partyNeedsRest,
  partyStash, claimFromStash, stashItem, sellFromStash,
  preparableSpells, preparedLimit, preparedSpells, knownCantrips, setPrepared, resetPrepared,
  cantripPool, cantripLimit, setCantrips, knownRitualSpells,
  spellbookPool, spellbookLimit, chosenSpellbook, setSpellbook,
  scrollLearnable, learnSpellFromScroll, itemCategory,
} from '../src/campaign/campaign.js';
import { encounterXP } from '../src/data/monsters.js';
import * as campaignModule from '../src/campaign/campaign.js';
import { saveCampaign, loadCampaign, deleteSave } from '../src/campaign/save.js';
import { Combat } from '../src/engine/combat.js';
import { buildEncounter } from '../src/data/monsters.js';
import { chooseAction } from '../src/ai/greedy.js';
import { ITEMS } from '../src/data/items.js';
import { CLASSES } from '../src/data/classes.js';
import { SPELLS } from '../src/data/spells.js';
import { attackableWeapons } from '../src/engine/rules/equipment.js';
import { buildParty } from '../src/builder/character.js';

describe('campaign state', () => {
  it('new campaign: 4 characters with class kits, starting gold, stage 0', () => {
    const c = newCampaign();
    expect(c.gold).toBe(STARTING_GOLD);
    expect(c.stage).toBe(0);
    expect(c.characters).toHaveLength(4);
    expect(c.characters[0]!.classId).toBe('fighter');
    expect(c.characters[0]!.inventory.some((s) => s.itemId === 'potion-healing')).toBe(true);
    expect(c.xp).toBe(0);
    expect(partyLevelOf(c)).toBe(1);
    expect(currentStage(c)!.encounterId).toBe('kobolds'); // easiest first
    expect(isComplete(c)).toBe(false);
  });

  it('shop: buying deducts gold and adds to that character; selling refunds half', () => {
    const c = newCampaign();
    expect(buyItem(c, 1, 'potion-greater-healing')).toBe(false); // 150 > 100
    expect(buyItem(c, 1, 'potion-healing')).toBe(true);          // 50
    expect(c.gold).toBe(STARTING_GOLD - 50);
    const wiz = c.characters[1]!;
    expect(wiz.inventory.find((s) => s.itemId === 'potion-healing')!.qty).toBe(2); // kit + bought
    expect(sellItem(c, 1, 'potion-healing')).toBe(true);
    expect(c.gold).toBe(STARTING_GOLD - 50 + 25);
    expect(sellItem(c, 1, 'potion-greater-healing')).toBe(false); // wizard doesn't have one
  });

  it('every shop item has a price and a display name', () => {
    for (const id of SHOP_STOCK) {
      expect(itemPrice(id)).toBeGreaterThan(0);
      expect(itemName(id)).not.toBe(id); // resolved to a human name
    }
  });

  it('shopOffering stocks staples always, magical wares limited and level-scaled', () => {
    const l1 = shopOffering(SHOP_STOCK, 1, 'sb-market');
    const l3 = shopOffering(SHOP_STOCK, 3, 'sb-market');
    const l5 = shopOffering(SHOP_STOCK, 5, 'sb-market');

    // Mundane staples are on the shelf at every level — even ones the loot
    // tables rate "uncommon" (a plain rapier), and always the healing potion.
    for (const shelf of [l1, l3, l5]) {
      for (const staple of ['potion-healing', 'rapier', 'greatsword', 'leather', 'longbow']) {
        expect(shelf, `staple ${staple}`).toContain(staple);
      }
    }
    // A 1st-level party is offered NO enchanted gear (no +1, adamantine, trinkets).
    const enchanted = (id: string) => id.endsWith('plus1') || id.includes('adamantine') || id.includes('moontouched')
      || ['gauntlets-ogre-power', 'headband-intellect', 'cloak-protection', 'brooch-shielding', 'bracers-archery', 'boots-winterlands', 'gloves-thievery'].includes(id);
    expect(l1.some(enchanted)).toBe(false);
    // Magical rotation grows with level, and never carries the whole catalogue.
    const magical = (shelf: string[]) => shelf.filter((id) => enchanted(id) || id.includes('resistance') || id.includes('giant-strength') || (id.includes('scroll') && itemPrice(id)! > 60));
    expect(magical(l5).length).toBeGreaterThan(magical(l1).length);
    expect(l5.length).toBeLessThan(SHOP_STOCK.length); // not everything at once
  });

  it('shopOffering is stable per (level, shop) but varies across both', () => {
    // Same shop, same level → identical shelf (no re-rolling by leaving/re-entering).
    expect(shopOffering(SHOP_STOCK, 4, 'sb-market')).toEqual(shopOffering(SHOP_STOCK, 4, 'sb-market'));
    // Different shop, or a level-up → a different magical mix.
    expect(shopOffering(SHOP_STOCK, 4, 'sb-market')).not.toEqual(shopOffering(SHOP_STOCK, 4, 'wc-stores'));
    expect(shopOffering(SHOP_STOCK, 4, 'sb-market')).not.toEqual(shopOffering(SHOP_STOCK, 6, 'sb-market'));
  });

  it('buildCampaignParty uses the XP-derived level and persisted gear', () => {
    const c = newCampaign();
    c.characters[0]!.inventory = [{ itemId: 'potion-greater-healing', qty: 3 }];
    c.xp = 900; // level 3
    const party = buildCampaignParty(c);
    expect(party).toHaveLength(4);
    expect(party[0]!.level).toBe(3);
    expect(party[0]!.inventory).toEqual([{ itemId: 'potion-greater-healing', qty: 3 }]);
    expect(party[1]!.spellSlots).toEqual([{ current: 4, max: 4 }, { current: 2, max: 2 }]);
  });

  it('keeps initial party identities and portrait choices in combat', () => {
    const c = newCampaign();
    const fighter = c.characters[0]!;
    expect(c.partyReady).toBe(false);
    expect(fighter.name).toBe('Sir Arthur'); // flavourful sample name, not the class
    expect(fighter.portraitId).toBe('fighter');
    fighter.name = 'Aster';
    fighter.portraitId = 'wizard';
    const party = buildCampaignParty(c);
    expect(party[0]!.name).toBe('Aster');
    expect(party[0]!.portraitId).toBe('wizard');
  });

  it('swaps unique class roles during party creation and resets both starting kits', () => {
    const c = newCampaign();
    expect(setPartyClass(c, 0, 'wizard')).toBe(true);
    expect(c.characters[0]!.classId).toBe('wizard');
    expect(c.characters[0]!.equipped.mainHand).toBe('dagger');   // wizard kit
    expect(c.characters[1]!.classId).toBe('fighter');
    expect(c.characters[1]!.equipped.mainHand).toBe('longsword');
    c.partyReady = true;
    expect(setPartyClass(c, 0, 'fighter')).toBe(false);
  });

  it('applyVictory: awards XP, generates treasure, reads gear back, advances', () => {
    const c = newCampaign();
    const party = buildCampaignParty(c);
    party[0]!.inventory = party[0]!.inventory.filter((s) => s.itemId !== 'potion-healing');
    const result = applyVictory(c, party, 12345);
    expect(result.stage.encounterId).toBe('kobolds');
    expect(c.stage).toBe(1);
    expect(result.xpGained).toBe(xpAward('kobolds', 4)); // encounterXP/4
    expect(c.xp).toBe(result.xpGained);
    expect(result.gold).toBeGreaterThan(0);
    expect(c.gold).toBe(STARTING_GOLD + result.gold);
    expect(result.items.length).toBeGreaterThan(0);
    expect(c.victories).toEqual(['kobolds']);
  });

  it('a hero downed in a won fight recovers to 1 HP, not 0', () => {
    const c = newCampaign();
    const party = buildCampaignParty(c);
    party[0]!.hp = 0; // downed but alive (the party still won)
    applyVictory(c, party, 12345);
    expect(buildCampaignParty(c)[0]!.hp).toBe(1);
  });

  it('persists battle HP; a short rest spends hit dice to heal, a long rest tops off and refreshes dice', () => {
    const c = newCampaign();
    const party = buildCampaignParty(c);
    const fighter = party[0]!;
    fighter.hp = 1;
    applyVictory(c, party, 12345);

    expect(buildCampaignParty(c)[0]!.hp).toBe(1);
    // A level-1 hero has one hit die; badly hurt, the auto-spender uses it.
    expect(hitDiceMax(c)).toBe(1);
    const result = shortRest(c);
    const restedFighter = buildCampaignParty(c)[0]!;
    expect(result.hitDiceSpent).toBe(1);
    expect(result.totalHealed).toBeGreaterThan(0);
    expect(restedFighter.hp).toBe(1 + result.totalHealed);
    expect(restedFighter.hp).toBeLessThanOrEqual(restedFighter.maxHp);
    // The die is spent — a second short rest can't heal further.
    expect(hitDiceLeft(c, 0)).toBe(0);
    expect(shortRest(c).hitDiceSpent).toBe(0);

    const beforeLong = buildCampaignParty(c)[0]!;
    const longRestResult = longRest(c);
    expect(longRestResult.totalHealed).toBe(beforeLong.maxHp - beforeLong.hp);
    expect(buildCampaignParty(c)[0]!.hp).toBe(beforeLong.maxHp);
    // Half the pool comes back (minimum one die).
    expect(hitDiceLeft(c, 0)).toBe(1);
  });

  it('fullRest restores HP, slots, and the whole hit-die pool between adventures', () => {
    const c = newCampaign(500); // a few levels in, so casters have slots and >1 hit die
    // Wound the whole party, drain a slot, and spend every hit die.
    for (const ch of c.characters) ch.resources = { hp: 1, slots: [0], hitDice: 0 };
    // One hero is also nursing a camp giant-strength buff.
    const fighter = c.characters.findIndex((ch) => ch.classId === 'fighter');
    c.characters[fighter]!.resources = { hp: 1, hitDice: 0, effects: { giantStrength: 23 } };

    fullRest(c);

    const party = buildCampaignParty(c);
    for (let i = 0; i < c.characters.length; i++) {
      // No lingering resources object at all: absent means full everywhere.
      expect(c.characters[i]!.resources).toBeUndefined();
      expect(party[i]!.hp).toBe(party[i]!.maxHp);
      expect(hitDiceLeft(c, i)).toBe(hitDiceMax(c));
    }
    // The camp giant-strength buff is gone (no Strength 23 carried over).
    expect(party[fighter]!.abilities.str).toBeLessThan(23);
  });

  it('a short rest does not waste a hit die on a trivial top-off', () => {
    const c = newCampaign();
    const party = buildCampaignParty(c);
    const fighter = party[0]!;
    // Only a point or two down — less than a die's average — so a smart
    // auto-spender leaves the die in the pool rather than burn it.
    fighter.hp = fighter.maxHp - 1;
    applyVictory(c, party, 12345);
    const result = shortRest(c);
    expect(result.hitDiceSpent).toBe(0);
    expect(hitDiceLeft(c, 0)).toBe(hitDiceMax(c));
  });

  it('persists spell slots spent mid-battle, and a long rest restores them', () => {
    const c = newCampaign();
    const wizardIdx = 1;
    const party = buildCampaignParty(c);
    const wizard = party[wizardIdx]!;
    expect(wizard.spellSlots[0]!.current).toBe(2);
    wizard.spellSlots[0]!.current = 0; // as if Magic Missile went out twice in the fight
    applyVictory(c, party, 777);

    expect(c.characters[wizardIdx]!.resources?.slots).toEqual([0]);
    expect(buildCampaignParty(c)[wizardIdx]!.spellSlots[0]!.current).toBe(0);

    longRest(c);
    expect(c.characters[wizardIdx]!.resources?.slots).toBeUndefined();
    expect(buildCampaignParty(c)[wizardIdx]!.spellSlots[0]!.current).toBe(2);
  });

  it('uses store healing sources on a selected party member', () => {
    const c = newCampaign(42);
    c.characters[1]!.resources = { hp: 1 };
    expect(useStoreHealing(c, 0, 1, 'potion-healing')?.healed).toBeGreaterThan(0);
    expect(c.characters[0]!.inventory.some((s) => s.itemId === 'potion-healing')).toBe(false);

    // A level-1 cleric has two 1st-level slots. Casting Cure Wounds in the
    // shop spends one, same as it would mid-battle — no free lunch.
    c.characters[3]!.resources = { hp: 1 };
    expect(useStoreHealing(c, 2, 3, 'cure-wounds')?.healed).toBeGreaterThan(0);
    expect(c.characters[2]!.resources?.slots).toEqual([1]);
  });

  it('runs a caster out of spell slots in the shop, and a long rest refills them', () => {
    const c = newCampaign(42);
    // Spend both of the cleric's 1st-level slots.
    expect(useStoreHealing(c, 2, 0, 'cure-wounds')).toBeDefined();
    expect(useStoreHealing(c, 2, 0, 'cure-wounds')).toBeDefined();
    expect(c.characters[2]!.resources?.slots).toEqual([0]);
    // A third cast has nothing to spend and is refused outright.
    expect(useStoreHealing(c, 2, 0, 'cure-wounds')).toBeUndefined();

    longRest(c);
    expect(c.characters[2]!.resources?.slots).toBeUndefined(); // absent = fully rested
    expect(buildCampaignParty(c)[2]!.spellSlots[0]!.current).toBe(2);

    // A short rest, by contrast, leaves slots untouched.
    useStoreHealing(c, 2, 0, 'cure-wounds');
    expect(c.characters[2]!.resources?.slots).toEqual([1]);
    shortRest(c);
    expect(c.characters[2]!.resources?.slots).toEqual([1]);
  });

  it('mage armor and find familiar interact correctly with slots (mage armor spends one, familiar is free)', () => {
    const c = newCampaign(42);
    const wizardIdx = 1;
    // Both must be prepared to be castable from the store; a level-1 wizard's
    // auto-default doesn't include them, so prepare them explicitly here.
    setPrepared(c, wizardIdx, ['mage-armor', 'find-familiar']);
    expect(buildCampaignParty(c)[wizardIdx]!.spellSlots[0]!.current).toBe(2);

    expect(useStoreSpell(c, wizardIdx, 'find-familiar')).toBe(true);
    expect(c.characters[wizardIdx]!.resources?.slots).toBeUndefined(); // ritual, no cost

    expect(useStoreSpell(c, wizardIdx, 'mage-armor')).toBe(true);
    expect(c.characters[wizardIdx]!.resources?.slots).toEqual([1]);
    expect(c.characters[wizardIdx]!.resources?.effects?.familiar).toEqual({ kind: 'owl' });
    expect(c.characters[wizardIdx]!.resources?.effects?.mageArmor).toBe(true);
  });

  it('party levels up mid-ladder and the level-up is reported', () => {
    const c = newCampaign();
    let sawLevel2 = false;
    for (let i = 0; !isComplete(c); i++) {
      const before = partyLevelOf(c);
      const r = applyVictory(c, buildCampaignParty(c), 100 + i);
      if (r.leveledTo) {
        expect(r.leveledTo).toBe(partyLevelOf(c));
        expect(r.leveledFrom).toBe(before);
        if (r.leveledTo === 2) sawLevel2 = true;
      }
    }
    expect(sawLevel2).toBe(true);
    expect(partyLevelOf(c)).toBe(5); // the extended ladder reaches the L5 cap by the finale
  });

  it('completing all stages finishes the campaign', () => {
    const c = newCampaign();
    for (let i = 0; i < STAGES.length; i++) {
      applyVictory(c, buildCampaignParty(c));
    }
    expect(isComplete(c)).toBe(true);
    expect(() => applyVictory(c, [])).toThrow(/complete/);
  });
});

describe('XP, leveling, and treasure', () => {
  it('levelForXp follows the thresholds and caps at 5', () => {
    expect(levelForXp(0)).toBe(1);
    expect(levelForXp(299)).toBe(1);
    expect(levelForXp(300)).toBe(2);
    expect(levelForXp(899)).toBe(2);
    expect(levelForXp(900)).toBe(3);
    expect(levelForXp(2699)).toBe(3);
    expect(levelForXp(2700)).toBe(4);
    expect(levelForXp(6500)).toBe(5);
    expect(levelForXp(99999)).toBe(5);
    expect(LEVEL_XP.length).toBe(5);
  });

  it('the ladder is ordered easy -> hard by encounter XP', () => {
    const xps = STAGES.map((s) => encounterXP(s.encounterId));
    // final stage (the giants) is the intended finale; overall trend rises.
    expect(xps[0]!).toBeLessThan(xps[xps.length - 1]!);
    expect(STAGES[STAGES.length - 1]!.encounterId).toBe('giants');
  });

  it('treasureFor is deterministic, scales with XP, and stays in-pool', () => {
    const a = treasureFor(500, 42);
    const b = treasureFor(500, 42);
    expect(a).toEqual(b);
    for (const xp of [150, 500, 1100]) {
      for (let seed = 1; seed <= 60; seed++) {
        const t = treasureFor(xp, seed);
        expect(t.gold).toBeGreaterThan(0);
        // gold tracks XP (~half): higher XP fights pay more on average.
      }
    }
    // Bigger fights roll more items.
    const small = treasureFor(150, 5).items.reduce((n, s) => n + s.qty, 0);
    const big = treasureFor(1100, 5).items.reduce((n, s) => n + s.qty, 0);
    expect(big).toBeGreaterThan(small);
  });

  it('a rare bonus tier guarantees a rare drop (finale trophy)', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const t = treasureFor(550, seed, 'rare');
      expect(t.items.some((s) => rarityOf(s.itemId) === 'rare')).toBe(true);
    }
  });
});

describe('party loot stash', () => {
  it('treasure drops land in the shared stash, not on the fighter', () => {
    const c = newCampaign(3);
    const before = c.characters[0]!.inventory.reduce((n, s) => n + s.qty, 0);
    const result = applyVictory(c, buildCampaignParty(c));
    expect(result.items.length).toBeGreaterThan(0);
    // The fighter's pack is unchanged; the loot is in the stash.
    expect(c.characters[0]!.inventory.reduce((n, s) => n + s.qty, 0)).toBe(before);
    const stashed = partyStash(c).reduce((n, s) => n + s.qty, 0);
    expect(stashed).toBe(result.items.reduce((n, s) => n + s.qty, 0));
  });

  it('claim moves an item from the stash to a member, and stash-it moves it back', () => {
    const c = newCampaign(3);
    partyStash(c).push({ itemId: 'potion-healing', qty: 1 });
    expect(claimFromStash(c, 2, 'potion-healing')).toBe(true);
    expect(partyStash(c).some((s) => s.itemId === 'potion-healing')).toBe(false);
    expect(c.characters[2]!.inventory.some((s) => s.itemId === 'potion-healing' && s.qty > 0)).toBe(true);

    expect(stashItem(c, 2, 'potion-healing')).toBe(true);
    expect(partyStash(c).some((s) => s.itemId === 'potion-healing' && s.qty > 0)).toBe(true);
  });

  it('sells straight from the stash for half price', () => {
    const c = newCampaign(3);
    partyStash(c).push({ itemId: 'greatsword', qty: 1 });
    const gold = c.gold;
    expect(sellFromStash(c, 'greatsword')).toBe(true);
    expect(c.gold).toBe(gold + Math.floor((itemPrice('greatsword') ?? 0) / 2));
    expect(partyStash(c).some((s) => s.itemId === 'greatsword')).toBe(false);
  });

  it('a legacy save with no stash field is treated as empty', () => {
    const c = newCampaign(3);
    delete c.stash;
    expect(partyStash(c)).toEqual([]);
    expect(claimFromStash(c, 0, 'potion-healing')).toBe(false);
  });

  it('a party cleric adds a Guidance d4 to shop skill checks', () => {
    const c = newCampaign(7);
    const withCleric = campaignModule.partySkillCheck(c, 'persuasion', 15);
    expect(withCleric.guidance).toBeGreaterThanOrEqual(1);
    expect(withCleric.guidance).toBeLessThanOrEqual(4);
    // A party with no cleric gets no Guidance.
    for (const ch of c.characters) if (ch.classId === 'cleric') ch.classId = 'rogue';
    const noCleric = campaignModule.partySkillCheck(c, 'persuasion', 15);
    expect(noCleric.guidance).toBeUndefined();
  });

  it('characterSkills lists every skill, proficient ones first and starred', () => {
    const c = newCampaign();
    const rogueIdx = c.characters.findIndex((ch) => ch.classId === 'rogue');
    expect(rogueIdx).toBeGreaterThanOrEqual(0);
    const rows = campaignModule.characterSkills(c, rogueIdx);
    // Every D&D skill appears exactly once.
    expect(rows.length).toBe(18);
    expect(new Set(rows.map((r) => r.skill)).size).toBe(18);
    // The rogue is proficient in at least a couple of skills, and they sort
    // ahead of the non-proficient ones.
    const firstNonProf = rows.findIndex((r) => !r.proficient);
    expect(firstNonProf).toBeGreaterThan(0);
    expect(rows.slice(0, firstNonProf).every((r) => r.proficient)).toBe(true);
    expect(rows.slice(firstNonProf).every((r) => !r.proficient)).toBe(true);
    // A proficient skill's bonus matches the raw bonus helper.
    const prof = rows[0]!;
    expect(prof.bonus).toBe(campaignModule.characterSkillBonus(c, rogueIdx, prof.skill));
    expect(campaignModule.characterSkillProficient(c, rogueIdx, prof.skill)).toBe(true);
  });

  it('characterSkills returns [] for an out-of-range index', () => {
    const c = newCampaign();
    expect(campaignModule.characterSkills(c, 99)).toEqual([]);
    expect(campaignModule.characterSkillProficient(c, 99, 'stealth')).toBe(false);
  });

  it('loading a save converts retired Scroll of Cure Wounds into healing potions', () => {
    const c = newCampaign(3);
    c.characters[2]!.inventory = [
      { itemId: 'scroll-cure-wounds', qty: 2 },
      { itemId: 'potion-healing', qty: 1 },
    ];
    c.stash = [{ itemId: 'scroll-cure-wounds', qty: 1 }];
    const loaded = parseCampaign(JSON.stringify(c))!;
    // No scrolls survive; the cleric's two scrolls merge into the existing potion.
    expect(loaded.characters[2]!.inventory.some((s) => s.itemId === 'scroll-cure-wounds')).toBe(false);
    expect(loaded.characters[2]!.inventory.find((s) => s.itemId === 'potion-healing')!.qty).toBe(3);
    expect(loaded.stash).toEqual([{ itemId: 'potion-healing', qty: 1 }]);
  });
});

describe('equipment management', () => {
  it('proficiency gating: wizard cannot wear armor, rogue only light', () => {
    const c = newCampaign();
    c.characters[1]!.inventory.push({ itemId: 'splint', qty: 1 });   // wizard
    c.characters[3]!.inventory.push({ itemId: 'splint', qty: 1 });   // rogue
    c.characters[0]!.inventory.push({ itemId: 'splint', qty: 1 });   // fighter
    expect(equipBlocked(c, 1, 'splint', 'armor')).toMatch(/can't wear/);
    expect(equipBlocked(c, 3, 'splint', 'armor')).toMatch(/can't wear/);
    expect(equipBlocked(c, 0, 'splint', 'armor')).toBeUndefined();
    expect(equipItem(c, 0, 'splint', 'armor')).toBe(true);
    expect(c.characters[0]!.equipped.armor).toBe('splint');
    // Old scale mail went back to inventory.
    expect(c.characters[0]!.inventory.some((s) => s.itemId === 'scale-mail')).toBe(true);
  });

  it('two-handed weapons clear the off-hand; shield needs a free main hand', () => {
    const c = newCampaign();
    c.characters[0]!.inventory.push({ itemId: 'greatsword', qty: 1 });
    expect(equipItem(c, 0, 'greatsword', 'mainHand')).toBe(true);
    const ftr = c.characters[0]!;
    expect(ftr.equipped.mainHand).toBe('greatsword');
    expect(ftr.equipped.offHand).toBeUndefined(); // shield stowed
    expect(ftr.inventory.some((s) => s.itemId === 'shield')).toBe(true);
    // Can't re-equip the shield while holding a two-hander.
    expect(equipBlocked(c, 0, 'shield', 'offHand')).toMatch(/two-handed/);
  });

  it('giveItem moves one item between characters', () => {
    const c = newCampaign();
    expect(giveItem(c, 0, 1, 'potion-healing')).toBe(true);
    expect(c.characters[0]!.inventory.some((s) => s.itemId === 'potion-healing')).toBe(false);
    expect(c.characters[1]!.inventory.find((s) => s.itemId === 'potion-healing')!.qty).toBe(2);
    expect(giveItem(c, 0, 1, 'potion-healing')).toBe(false); // none left
    expect(giveItem(c, 1, 1, 'potion-healing')).toBe(false); // self
  });

  it('unequip returns gear to the pack, main hand included', () => {
    const c = newCampaign();
    expect(unequipSlot(c, 0, 'offHand')).toBe(true);
    expect(c.characters[0]!.inventory.some((s) => s.itemId === 'shield')).toBe(true);

    // The main hand was exempt, to stop a hero going weaponless. It guarded
    // nothing — a stowed weapon is still attackable, because the free
    // interaction draws it — while stranding the sword in the hand: giving and
    // selling work from packs, so a main weapon could never be handed on.
    const sword = c.characters[0]!.equipped.mainHand!;
    expect(unequipSlot(c, 0, 'mainHand')).toBe(true);
    expect(c.characters[0]!.equipped.mainHand).toBeUndefined();
    expect(c.characters[0]!.inventory.some((s) => s.itemId === sword)).toBe(true);
    expect(unequipSlot(c, 0, 'mainHand')).toBe(false);   // nothing there now
  });

  it('a hero can hand on the weapon in their hand once it is stowed', () => {
    const c = newCampaign();
    const sword = c.characters[0]!.equipped.mainHand!;
    unequipSlot(c, 0, 'mainHand');
    expect(giveItem(c, 0, 1, sword)).toBe(true);
    expect(c.characters[1]!.inventory.some((s) => s.itemId === sword)).toBe(true);
  });

  it('a stowed weapon still swings, so unequipping does not disarm anyone', () => {
    const c = newCampaign();
    unequipSlot(c, 0, 'mainHand');
    const fighter = buildCampaignParty(c, 'team1')[0]!;
    expect(fighter.equipped.mainHand).toBeUndefined();
    expect(attackableWeapons(fighter).length).toBeGreaterThan(0);
  });

  it('a +1 weapon carries into battle with working bonuses', () => {
    const c = newCampaign();
    c.characters[0]!.inventory.push({ itemId: 'longsword-plus1', qty: 1 });
    expect(equipItem(c, 0, 'longsword-plus1', 'mainHand')).toBe(true);
    const party = buildCampaignParty(c);
    expect(party[0]!.equipped.mainHand).toBe('longsword-plus1');
    // Mastery persists on the +1 blade.
    expect(party[0]!.weaponMasteries).toContain('longsword-plus1');
  });
});

describe('item categories (shop shelf filter)', () => {
  it('buckets each item by shelf', () => {
    expect(itemCategory('greatsword')).toBe('weapon');
    expect(itemCategory('longbow')).toBe('weapon');
    expect(itemCategory('half-plate')).toBe('armor');
    expect(itemCategory('shield')).toBe('armor');
    expect(itemCategory('shield-plus1')).toBe('armor');
    expect(itemCategory('potion-healing')).toBe('potion');
    expect(itemCategory('alchemists-fire')).toBe('potion'); // non-scroll consumable
    expect(itemCategory('scroll-fireball')).toBe('scroll');
    expect(itemCategory('cloak-protection')).toBe('trinket');
  });

  it('every priced shop item lands in a real category', () => {
    for (const id of SHOP_STOCK) {
      if (itemPrice(id) === undefined) continue;
      expect(['weapon', 'armor', 'potion', 'scroll', 'trinket', 'other']).toContain(itemCategory(id));
    }
  });
});

describe('shop skills', () => {
  const {
    skillBonus, bestAtSkill, partySkillCheck, attemptSteal, attemptHaggle,
    STEAL_FINE,
  } = campaignModule;

  it('skill bonuses reflect class skills plus Human Skillful defaults', () => {
    const c = newCampaign(5);
    expect(bestAtSkill(c, 'stealth').idx).toBe(3);          // rogue (dex 16 + prof)
    expect(bestAtSkill(c, 'sleight-of-hand').idx).toBe(3);
    expect(bestAtSkill(c, 'deception').idx).toBe(1);        // Human wizard Skillful
    expect(bestAtSkill(c, 'intimidation').idx).toBe(0);     // fighter proficient
    expect(bestAtSkill(c, 'persuasion').idx).toBe(2);       // cleric proficient
    expect(skillBonus('rogue', 1, 'stealth')).toBe(5);      // +3 dex +2 prof
    expect(skillBonus('wizard', 1, 'stealth')).toBe(3);     // +3 dex, untrained
  });

  it('skill checks are deterministic and advance the campaign rng', () => {
    const a = newCampaign(42);
    const b = newCampaign(42);
    const r1 = partySkillCheck(a, 'stealth', 13);
    const r2 = partySkillCheck(b, 'stealth', 13);
    expect(r1).toEqual(r2);
    expect(a.rng).not.toBe(newCampaign(42).rng); // state advanced
  });

  it('steal: success grabs a random stock item; failure fines up to 50g', () => {
    let successes = 0;
    let failures = 0;
    for (let seed = 1; seed <= 60; seed++) {
      const c = newCampaign(seed);
      const before = c.gold;
      const itemsBefore = c.characters.reduce((n, ch) => n + ch.inventory.reduce((m, s) => m + s.qty, 0), 0);
      const result = attemptSteal(c);
      expect(result.rolls).toHaveLength(2);
      if (result.success) {
        successes++;
        expect(result.itemId).toBeDefined();
        expect(SHOP_STOCK).toContain(result.itemId);
        expect(c.gold).toBe(before);
        const itemsAfter = c.characters.reduce((n, ch) => n + ch.inventory.reduce((m, s) => m + s.qty, 0), 0);
        expect(itemsAfter).toBe(itemsBefore + 1);
      } else {
        failures++;
        expect(result.fine).toBe(Math.min(before, STEAL_FINE));
        expect(c.gold).toBe(before - result.fine);
      }
    }
    expect(successes).toBeGreaterThan(5);  // rogue +5/+5 vs DC 13 twice ≈ 42%
    expect(failures).toBeGreaterThan(5);
  });

  it('haggle: success discounts, failure penalizes (except persuasion)', () => {
    let sawPersuadeFail = false;
    let sawIntimidateSuccess = false;
    let sawIntimidateFail = false;
    for (let seed = 1; seed <= 80; seed++) {
      const p = attemptHaggle(newCampaign(seed), 'persuasion');
      if (!p.roll.success) {
        expect(p.priceMultiplier).toBe(1);
        sawPersuadeFail = true;
      } else {
        expect(p.priceMultiplier).toBeCloseTo(0.8);
      }
      const i = attemptHaggle(newCampaign(seed + 1000), 'intimidation');
      if (i.roll.success) { expect(i.priceMultiplier).toBeCloseTo(0.75); sawIntimidateSuccess = true; }
      else { expect(i.priceMultiplier).toBeCloseTo(1.25); sawIntimidateFail = true; }
    }
    expect(sawPersuadeFail && sawIntimidateSuccess && sawIntimidateFail).toBe(true);
  });

  it('haggled price override works in buyItem', () => {
    const c = newCampaign(1);
    c.gold = 40; // base potion is 50; haggled to 40
    expect(buyItem(c, 0, 'potion-healing', 40)).toBe(true);
    expect(c.gold).toBe(0);
  });
});

describe('shop visit persistence (web refresh safety)', () => {
  const { shopVisitFor, parseCampaign } = campaignModule;

  it('shopVisit survives serialization and is cleared by applyVictory', () => {
    const c = newCampaign(9);
    const v = shopVisitFor(c);
    v.stealUsed = true;
    v.banned = true;
    const roundTrip = parseCampaign(JSON.stringify(c))!;
    expect(shopVisitFor(roundTrip).stealUsed).toBe(true);
    expect(shopVisitFor(roundTrip).banned).toBe(true);

    applyVictory(c, buildCampaignParty(c), 1);
    expect(c.shopVisit).toBeUndefined();
    expect(shopVisitFor(c).stealUsed).toBe(false); // fresh visit next stage
  });

  it('parseCampaign rejects garbage and defaults missing rng', () => {
    expect(parseCampaign('not json{')).toBeUndefined();
    expect(parseCampaign('{"gold": "x"}')).toBeUndefined();
    const old = { ...newCampaign(1) } as Record<string, unknown>;
    delete old['rng'];
    const parsed = parseCampaign(JSON.stringify(old))!;
    expect(typeof parsed.rng).toBe('number');
  });

  it('story mode: new campaigns default on; old saves migrate to off (normal)', () => {
    expect(newCampaign(1).storyMode).toBe(true);
    const old = newCampaign(1) as unknown as Record<string, unknown>;
    delete old['storyMode'];
    expect(parseCampaign(JSON.stringify(old))!.storyMode).toBe(false);
  });

  it('pre-XP saves get seeded XP so the party does not de-level', () => {
    const old = newCampaign(1) as unknown as Record<string, unknown>;
    old['stage'] = 6; // mid-ladder
    delete old['xp'];
    const parsed = parseCampaign(JSON.stringify(old))!;
    expect(typeof parsed.xp).toBe('number');
    // Should reflect XP earned through the first 6 stages, i.e. already L2.
    expect(partyLevelOf(parsed)).toBeGreaterThanOrEqual(2);
  });

  it('persists selected species and upgrades older campaign saves to humans', () => {
    const campaign = newCampaign(1, ['dwarf', 'elf', 'orc', 'human']);
    expect(buildCampaignParty(campaign).map((c) => c.speciesId)).toEqual(['dwarf', 'elf', 'orc', 'human']);

    const old = newCampaign(1) as unknown as { characters: Array<Record<string, unknown>> };
    delete old.characters[0]!['speciesId'];
    expect(parseCampaign(JSON.stringify(old))!.characters[0]!.speciesId).toBe('human');
  });

  it('human Skillful adds the campaign proficiency assigned to each class', () => {
    const humanFighter = campaignModule.skillBonus('fighter', 1, 'persuasion', 'human');
    const dwarfFighter = campaignModule.skillBonus('fighter', 1, 'persuasion', 'dwarf');
    expect(humanFighter).toBe(dwarfFighter + 2);
  });
});

describe('campaign persistence', () => {
  it('save/load round-trips; delete removes; corrupt file loads as undefined', () => {
    const file = path.join(os.tmpdir(), `dnd-campaign-test-${Date.now()}.json`);
    const c = newCampaign();
    buyItem(c, 2, 'scroll-magic-missile');
    applyVictory(c, buildCampaignParty(c));
    saveCampaign(c, file);
    const loaded = loadCampaign(file)!;
    expect(loaded).toEqual(c);
    deleteSave(file);
    expect(loadCampaign(file)).toBeUndefined();
    fs.writeFileSync(file, 'not json{');
    expect(loadCampaign(file)).toBeUndefined();
    fs.unlinkSync(file);
  });
});

describe('campaign battles (headless AI playthrough)', () => {
  it('the full ladder is playable: AI party fights each stage from campaign state', () => {
    const c = newCampaign();
    let stagesWon = 0;
    let attempts = 0;
    while (!isComplete(c) && attempts++ < 12) {
      const stage = currentStage(c)!;
      const combat = new Combat({
        seed: 1000 + attempts,
        mapId: stage.mapId,
        combatants: [...buildCampaignParty(c), ...buildEncounter(stage.encounterId, 'team2', 7)],
      });
      let steps = 0;
      while (!combat.isOver() && steps++ < 6000) {
        combat.apply(chooseAction(combat.state, combat.activeId));
      }
      expect(combat.isOver()).toBe(true);
      if (combat.winner() === 'team1') {
        const survivors = Object.values(combat.state.combatants).filter((x) => x.team === 'team1');
        applyVictory(c, survivors);
        stagesWon++;
      }
      // On a loss, just retry with a different seed (campaign CLI would end).
    }
    expect(stagesWon).toBeGreaterThanOrEqual(2); // the ladder is winnable, not scripted
  }, 60000);
});

describe('names in old saves', () => {
  it('upgrades a party that was named after its classes', () => {
    // Saves from before characters had names stored the class as the name, so
    // the game announced "☠ Wizard is down!" on the monsters' turn — a class,
    // not a character. The old migration only filled a *missing* name, so these
    // slipped through.
    const c = newCampaign(1);
    for (const ch of c.characters) ch.name = CLASSES[ch.classId]!.name; // 'Fighter', 'Wizard', ...
    const revived = parseCampaign(JSON.stringify(c))!;
    expect(revived.characters.map((ch) => ch.name)).toEqual([
      'Sir Arthur', 'Morgana Le Fey', 'Elaine the Holy', 'Cedric the Sneaky',
    ]);
  });

  it('keeps a name the player actually chose', () => {
    const c = newCampaign(1);
    c.characters[1]!.name = 'Zatanna';
    expect(parseCampaign(JSON.stringify(c))!.characters[1]!.name).toBe('Zatanna');
  });

  it('names generated parties on both sides, so a mirror match reads', () => {
    // buildParty never passed a name, so every skirmish was "Fighter" vs
    // "Fighter" — and one list for both sides would be Sir Arthur vs Sir Arthur.
    const heroes = buildParty('team1', 0, 1).map((c) => c.name);
    const rivals = buildParty('team2', 7, 1).map((c) => c.name);
    expect(heroes[0]).toBe('Sir Arthur');
    expect(rivals[0]).toBe('Sir Kay');
    expect(heroes.some((n) => rivals.includes(n))).toBe(false);
  });
});

describe('skill gambits identify the character, not the class', () => {
  it('reports the roller by index, so a name can be shown and duplicate classes are unambiguous', () => {
    const c = newCampaign(7);
    const roll = partySkillCheck(c, 'stealth', 15);
    expect(typeof roll.by).toBe('number');
    expect(c.characters[roll.by]).toBeDefined();
    // A rogue is best at stealth, and this party's rogue is Cedric.
    expect(c.characters[roll.by]!.name).toBe('Cedric the Sneaky');
  });

  it('gives a stolen item to the hero whose hands did the stealing', () => {
    // The sleight-of-hand roller pockets it — that's the roll whose index the
    // thief is looked up by, so the two must not drift apart.
    const c = newCampaign(3);
    for (let i = 0; i < 60; i++) {
      const before = c.characters.map((ch) => ch.inventory.reduce((n, s2) => n + s2.qty, 0));
      const result = attemptSteal(c);
      if (!result.success) continue;
      const after = c.characters.map((ch) => ch.inventory.reduce((n, s2) => n + s2.qty, 0));
      const sleight = result.rolls.find((r) => r.skill === 'sleight-of-hand')!;
      expect(after.findIndex((n, i2) => n > before[i2]!)).toBe(sleight.by);
      return;
    }
    throw new Error('no successful steal in 60 attempts — check the DC');
  });
});

describe('spell preparation (ignorable — a sensible default is auto-prepared)', () => {
  it('a character who never touches prepared spells gets a capped default subset', () => {
    const c = newCampaign();
    const wizardIdx = 1;
    expect(c.characters[wizardIdx]!.prepared).toBeUndefined();
    const pool = preparableSpells(c, wizardIdx);
    const cap = preparedLimit(c, wizardIdx);
    const def = preparedSpells(c, wizardIdx);
    // A level-1 wizard knows more leveled spells than it can prepare, so the
    // default is a genuine subset — capped, and every entry a real known spell.
    expect(pool.length).toBeGreaterThan(cap);
    expect(def).toHaveLength(cap);
    for (const id of def) expect(pool).toContain(id);
    // The built combatant carries exactly the prepared subset — the leveled
    // spells left unprepared are genuinely absent, not merely hidden.
    const built = buildCampaignParty(c)[wizardIdx]!;
    for (const id of def) expect(built.spellIds).toContain(id);
    const unprepared = pool.filter((id) => !def.includes(id));
    for (const id of unprepared) expect(built.spellIds).not.toContain(id);
  });

  it('cantrips are always known and are never part of the prepared list', () => {
    const c = newCampaign();
    const wizardIdx = 1;
    const cantrips = knownCantrips(c, wizardIdx);
    expect(cantrips).toContain('fire-bolt');
    expect(preparableSpells(c, wizardIdx).some((id) => cantrips.includes(id))).toBe(false);
    const built = buildCampaignParty(c)[wizardIdx]!;
    for (const id of cantrips) expect(built.spellIds).toContain(id);
  });

  it('setPrepared saves a custom subset, capped at the level limit', () => {
    const c = newCampaign();
    const wizardIdx = 1;
    const pool = preparableSpells(c, wizardIdx);
    setPrepared(c, wizardIdx, [pool[0]!]);
    expect(c.characters[wizardIdx]!.prepared).toEqual([pool[0]!]);
    expect(preparedSpells(c, wizardIdx)).toEqual([pool[0]!]);

    const built = buildCampaignParty(c)[wizardIdx]!;
    expect(built.spellIds).toContain(pool[0]!);
    // A spell left out of the custom prepared list is genuinely gone from the
    // built combatant, not just hidden — this is the whole feature.
    const droppedLeveled = pool.find((id) => id !== pool[0]);
    if (droppedLeveled) expect(built.spellIds).not.toContain(droppedLeveled);

    // A selection larger than the cap is silently trimmed, not rejected.
    const cap = preparedLimit(c, wizardIdx);
    setPrepared(c, wizardIdx, [...pool, ...pool]); // dupes, over-cap
    expect(c.characters[wizardIdx]!.prepared).toHaveLength(Math.min(cap, pool.length));
  });

  it('growSpellsForLevel fills the known tiers (cantrips, spellbook) but never touches prepared', () => {
    const c = newCampaign();
    c.xp = LEVEL_XP[2]!; // level 3
    const w = 1;
    // Hand-pick deliberately short lists at this level.
    setCantrips(c, w, knownCantrips(c, w).slice(0, 2));
    setSpellbook(c, w, chosenSpellbook(c, w).slice(0, 3));
    setPrepared(c, w, preparableSpells(c, w).slice(0, 2));
    const keptBook = c.characters[w]!.spellbook!.slice();
    const keptPrepared = c.characters[w]!.prepared!.slice();

    // Level up, then grow (as a victory that crosses a level boundary does).
    c.xp = LEVEL_XP[4]!; // level 5
    campaignModule.growSpellsForLevel(c);

    // The KNOWN tiers grow to their new caps, keeping every pick...
    expect(c.characters[w]!.cantrips!.length).toBe(cantripLimit(c, w));
    expect(c.characters[w]!.spellbook!.length).toBe(spellbookLimit(c, w));
    for (const id of keptBook) expect(c.characters[w]!.spellbook).toContain(id);
    // ...but the PREPARED list is left exactly as the player set it — no
    // auto-preparing of new high-level spells, no forgetting the lean loadout.
    expect(c.characters[w]!.prepared).toEqual(keptPrepared);
  });

  it('a level-up victory never rewrites a customized prepared list', () => {
    const w = 1;
    // A win that crosses into the next level used to flood prepared with the
    // strongest spells; now it leaves the player's exact choice alone.
    const c = newCampaign();
    c.xp = LEVEL_XP[3]! - 1;                      // one XP shy of level 4
    setPrepared(c, w, [preparableSpells(c, w)[0]!]);
    const before = c.characters[w]!.prepared!.slice();
    applyVictory(c, buildCampaignParty(c), 1);
    expect(levelForXp(c.xp)).toBe(4);            // the level really did rise
    expect(c.characters[w]!.prepared).toEqual(before); // untouched
  });

  it('the auto-default prepares a spread of spell levels, not only the strongest', () => {
    const c = newCampaign();
    c.xp = LEVEL_XP[4]!; // level 5 wizard: level-1/2/3 spells all available
    const w = 1;
    const levels = preparedSpells(c, w).map((id) => SPELLS[id]?.level ?? 0);
    // The default set spans more than one spell level, so lower slots aren't
    // wasted on an all-top-tier loadout.
    expect(new Set(levels).size).toBeGreaterThan(1);
    expect(levels).toContain(1); // still has a low-level spell to fill a 1st slot
    expect(Math.max(...levels)).toBeGreaterThan(1); // and a strong one
  });

  it('resetPrepared drops back to the auto-prepared default', () => {
    const c = newCampaign();
    const wizardIdx = 1;
    const pool = preparableSpells(c, wizardIdx);
    const autoDefault = preparedSpells(c, wizardIdx); // before any custom pick
    setPrepared(c, wizardIdx, [pool[0]!]);
    expect(c.characters[wizardIdx]!.prepared).toBeDefined();
    resetPrepared(c, wizardIdx);
    expect(c.characters[wizardIdx]!.prepared).toBeUndefined();
    expect(preparedSpells(c, wizardIdx)).toEqual(autoDefault);
  });

  it('a non-caster has an empty preparable/prepared list and is unaffected', () => {
    const c = newCampaign();
    const fighterIdx = 0;
    expect(preparableSpells(c, fighterIdx)).toEqual([]);
    expect(preparedSpells(c, fighterIdx)).toEqual([]);
    expect(setPrepared(c, fighterIdx, ['fireball'])).toBe(true); // doesn't error
    expect(c.characters[fighterIdx]!.prepared).toEqual([]); // filtered to nothing
  });

  // Regression: the default used to be uncapped while the display showed the
  // cap, so a party card could read "9/6 prepared" — a caster with more
  // prepared than its own limit, which 5e never allows and which just reads
  // as broken. The default must never exceed the cap, at any level either
  // class reaches, whether the player has ever opened the panel or not.
  it('the default prepared count never exceeds the prepared limit, at any level', () => {
    for (const classId of ['cleric', 'wizard'] as const) {
      const c = newCampaign();
      const idx = c.characters.findIndex((ch) => ch.classId === classId);
      for (let xp = 0; xp <= LEVEL_XP[LEVEL_XP.length - 1]!; xp += 200) {
        c.xp = xp;
        const cap = preparedLimit(c, idx);
        const def = preparedSpells(c, idx);
        expect(def.length).toBeLessThanOrEqual(cap);
        // And it matches what battle actually builds — no display/reality gap.
        const built = buildCampaignParty(c)[idx]!;
        for (const id of def) expect(built.spellIds).toContain(id);
      }
    }
  });

  it('"use recommended" never shows or produces a count above the cap', () => {
    const c = newCampaign();
    const wizardIdx = 1;
    setPrepared(c, wizardIdx, ['fire-bolt']); // an arbitrary prior custom pick
    resetPrepared(c, wizardIdx);
    expect(preparedSpells(c, wizardIdx).length).toBeLessThanOrEqual(preparedLimit(c, wizardIdx));
  });
});

describe('spells-known model (cantrips chosen, rituals always ready)', () => {
  it('a level-1 wizard: 3 cantrips, spellbook 6, prepares 4 (2024 counts)', () => {
    const c = newCampaign();
    const w = 1;
    expect(cantripLimit(c, w)).toBe(3);
    expect(spellbookLimit(c, w)).toBe(6);
    expect(preparedLimit(c, w)).toBe(4);
    expect(knownCantrips(c, w)).toEqual(['fire-bolt', 'ray-of-frost', 'shocking-grasp']);
    const book = chosenSpellbook(c, w);
    expect(book).toHaveLength(6);
    expect(book).toContain('shield');
    expect(book).not.toContain('false-life'); // last in order, trimmed from the 6
    const prepared = preparedSpells(c, w);
    expect(prepared).toHaveLength(4);
    expect(prepared).toContain('shield');
    // False Life stays available to scribe into the spellbook (the class pool).
    expect(spellbookPool(c, w)).toContain('false-life');
  });

  it('Find Familiar is an always-ready ritual: castable even though it is not in the prepared pool', () => {
    const c = newCampaign();
    const w = 1;
    expect(preparableSpells(c, w)).not.toContain('find-familiar'); // not a prepared slot
    expect(knownRitualSpells(c, w)).toContain('find-familiar');
    // On the built combatant regardless of what leveled spells were prepared.
    setPrepared(c, w, ['magic-missile']); // deliberately exclude find-familiar
    expect(buildCampaignParty(c)[w]!.spellIds).toContain('find-familiar');
    // And offered in the store.
    expect(useStoreSpell(c, w, 'find-familiar')).toBe(true);
  });

  it('cantrips are choosable and capped, changeable and resettable', () => {
    const c = newCampaign();
    const w = 1;
    const pool = cantripPool(c, w);
    expect(pool).toHaveLength(7); // fire-bolt, ray-of-frost, shocking-grasp, poison-spray, true-strike, acid-splash, minor-illusion
    expect(pool).toEqual(expect.arrayContaining(['poison-spray', 'true-strike', 'minor-illusion']));
    setCantrips(c, w, ['acid-splash', 'ray-of-frost']);
    expect(knownCantrips(c, w)).toEqual(['acid-splash', 'ray-of-frost']);
    expect(buildCampaignParty(c)[w]!.spellIds).toContain('acid-splash');
    expect(buildCampaignParty(c)[w]!.spellIds).not.toContain('fire-bolt'); // unchosen
    // Over-cap is trimmed to the limit.
    setCantrips(c, w, pool); // all 7
    expect(knownCantrips(c, w)).toHaveLength(cantripLimit(c, w));
    // Reset restores the default.
    resetPrepared(c, w);
    expect(knownCantrips(c, w)).toEqual(['fire-bolt', 'ray-of-frost', 'shocking-grasp']);
  });

  it('a wizard chooses its spellbook, and can only prepare from it', () => {
    const c = newCampaign();
    const w = 1;
    // Choose a specific spellbook (6 of the class pool), including False Life.
    setSpellbook(c, w, ['magic-missile', 'sleep', 'burning-hands', 'shield', 'mage-armor', 'false-life']);
    expect(chosenSpellbook(c, w)).toContain('false-life');
    expect(preparableSpells(c, w)).not.toContain('color-spray'); // left out of the spellbook
    // Preparing filters to the spellbook — color-spray can't be prepared.
    setPrepared(c, w, ['color-spray', 'false-life']);
    expect(c.characters[w]!.prepared).toEqual(['false-life']);
    expect(buildCampaignParty(c)[w]!.spellIds).toContain('false-life');
    expect(buildCampaignParty(c)[w]!.spellIds).not.toContain('color-spray');
  });

  it('a cleric knows its whole list (incl. Guidance cantrip) and prepares a subset', () => {
    const c = newCampaign();
    const clr = 2;
    // Guidance is a known cleric cantrip, shown in the panel.
    expect(knownCantrips(c, clr)).toContain('guidance');
    // The preparable pool is the full cleric leveled list, not a limited spellbook.
    const pool = preparableSpells(c, clr);
    expect(pool).toEqual(expect.arrayContaining(['cure-wounds', 'bless', 'command', 'bane', 'shield-of-faith']));
    expect(pool.length).toBeGreaterThan(preparedLimit(c, clr)); // prepares a subset
    // Guidance is never offered in combat (outOfCombat), even though known.
    expect(buildCampaignParty(c)[clr]!.spellIds).toContain('guidance');
  });
});

describe('wizard spellbook: learning spells from scrolls', () => {
  it('ray of sickness is not on the default wizard list', () => {
    const c = newCampaign();
    const wizardIdx = 1;
    expect(preparableSpells(c, wizardIdx)).not.toContain('ray-of-sickness');
  });

  it('a wizard holding the scroll can learn it for a fee, consuming the scroll', () => {
    const c = newCampaign(9);
    const wizardIdx = 1;
    c.characters[wizardIdx]!.inventory.push({ itemId: 'scroll-ray-of-sickness', qty: 1 });
    const learnable = scrollLearnable(c, wizardIdx, 'scroll-ray-of-sickness');
    expect(learnable?.spellId).toBe('ray-of-sickness');
    expect(learnable!.fee).toBeGreaterThan(0);

    const goldBefore = c.gold;
    expect(learnSpellFromScroll(c, wizardIdx, 'scroll-ray-of-sickness')).toBe(true);
    expect(c.gold).toBe(goldBefore - learnable!.fee);
    expect(c.characters[wizardIdx]!.inventory.some((s) => s.itemId === 'scroll-ray-of-sickness')).toBe(false);
    expect(c.characters[wizardIdx]!.scribedSpells).toEqual(['ray-of-sickness']);

    // Once learned it joins the pool the prepare panel draws from. It isn't
    // auto-prepared (a real cap means a just-learned spell has to be chosen),
    // but preparing it makes it live on the built combatant.
    expect(preparableSpells(c, wizardIdx)).toContain('ray-of-sickness');
    setPrepared(c, wizardIdx, ['ray-of-sickness']);
    expect(buildCampaignParty(c)[wizardIdx]!.spellIds).toContain('ray-of-sickness');

    // Learning it a second time is refused — already known.
    expect(scrollLearnable(c, wizardIdx, 'scroll-ray-of-sickness')).toBeUndefined();
  });

  it('refuses to learn without gold, without the scroll, or for a non-wizard', () => {
    const c = newCampaign(9);
    const wizardIdx = 1;
    c.characters[wizardIdx]!.inventory.push({ itemId: 'scroll-ray-of-sickness', qty: 1 });

    // Not enough gold.
    c.gold = 0;
    expect(learnSpellFromScroll(c, wizardIdx, 'scroll-ray-of-sickness')).toBe(false);
    expect(c.characters[wizardIdx]!.spellbook).toBeUndefined();

    // A class that isn't the wizard can't learn it even with the scroll and gold.
    c.gold = 1000;
    const fighterIdx = 0;
    c.characters[fighterIdx]!.inventory.push({ itemId: 'scroll-ray-of-sickness', qty: 1 });
    expect(scrollLearnable(c, fighterIdx, 'scroll-ray-of-sickness')).toBeUndefined();
    expect(learnSpellFromScroll(c, fighterIdx, 'scroll-ray-of-sickness')).toBe(false);

    // No scroll in hand.
    c.characters[wizardIdx]!.inventory = c.characters[wizardIdx]!.inventory.filter((s) => s.itemId !== 'scroll-ray-of-sickness');
    expect(learnSpellFromScroll(c, wizardIdx, 'scroll-ray-of-sickness')).toBe(false);
  });

  it('a scroll of a spell already known outright is not learnable', () => {
    const c = newCampaign();
    const wizardIdx = 1;
    c.characters[wizardIdx]!.inventory.push({ itemId: 'scroll-fireball', qty: 1 });
    // Fireball is already on the wizard's default table — nothing to learn.
    expect(scrollLearnable(c, wizardIdx, 'scroll-fireball')).toBeUndefined();
  });
});

describe('level-up summary (derived gains + choices)', () => {
  it('surfaces the headline gains for each class, diffed from the class table', () => {
    const c = newCampaign();
    const g = levelUpSummary(c, 4, 5);
    const fighter = g.find((x) => x.classId === 'fighter')!;
    expect(fighter.hp).toBeGreaterThan(0);
    expect(fighter.proficiency).toBe(1);       // +2 → +3 at level 5
    expect(fighter.extraAttack).toBe(true);    // the level-5 spike
    expect(fighter.features).toContain('Extra Attack');
    expect(fighter.isCaster).toBe(false);

    const wizard = g.find((x) => x.classId === 'wizard')!;
    expect(wizard.newSpellLevel).toBe(3);      // Fireball tier opens
    expect(wizard.spellbook).toBeGreaterThan(0);
    expect(wizard.prepared).toBeGreaterThan(0);
    expect(wizard.isCaster).toBe(true);
  });

  it('collapses repeated feature families and reports nothing for a no-op', () => {
    const c = newCampaign();
    const rogue = levelUpSummary(c, 1, 2).find((x) => x.classId === 'rogue')!;
    // Cunning Action: Dash / Disengage / Hide → one gain, not three.
    expect(rogue.features).toEqual(['Cunning Action']);
    expect(levelUpSummary(c, 3, 3)).toEqual([]); // toLevel <= fromLevel
  });

  it('offers a build choice only in the band it unlocks, and setLevelChoice applies it mid-run', () => {
    const c = newCampaign();
    // Swap a member to Paladin, whose Fighting Style unlocks at 2nd level.
    setPartyClass(c, 0, 'paladin');
    c.partyReady = true;
    expect(levelUpSummary(c, 1, 1)).toEqual([]);
    const at2 = levelUpSummary(c, 1, 2)[0]!;
    const fs = at2.choices.find((ch) => ch.pointId === 'fighting-style')!;
    expect(fs).toBeDefined();
    expect(fs.atLevel).toBe(2);
    expect(fs.options.length).toBeGreaterThan(1);
    // Not offered again once past its level.
    expect(levelUpSummary(c, 2, 3)[0]!.choices.some((ch) => ch.pointId === 'fighting-style')).toBe(false);
    // The pick sticks after launch (setPartyChoice would have refused).
    const pick = fs.options.find((o) => o.id !== fs.current)!;
    expect(setLevelChoice(c, 0, 'fighting-style', pick.id)).toBe(true);
    expect(c.characters[0]!.choices?.['fighting-style']).toBe(pick.id);
  });
});

describe('needs-a-rest nudge', () => {
  it('is false at full strength and true once a hero is badly hurt', () => {
    const c = newCampaign();
    expect(partyNeedsRest(c)).toBe(false);
    c.characters[0]!.resources = { hp: 1 };   // fighter down to 1 HP
    expect(partyNeedsRest(c)).toBe(true);
  });

  it('fires when a caster has burned through its slots', () => {
    const c = newCampaign();
    // Wizard (idx 1) at level 1 has [2] first-level slots; spend both.
    c.characters[1]!.resources = { hp: c.characters[1]!.resources?.hp ?? 7, slots: [0] };
    expect(partyNeedsRest(c)).toBe(true);
  });
});

describe('camp buff potions (drink before the fight, lasts until a rest)', () => {
  it('drinking giant strength in camp raises the built combatant\'s Strength', () => {
    const c = newCampaign();
    const fighter = 0;
    const base = buildCampaignParty(c)[fighter]!.abilities.str;
    c.characters[fighter]!.inventory.push({ itemId: 'potion-giant-strength-hill', qty: 1 });
    expect(isCampBuffPotion('potion-giant-strength-hill')).toBe(true);
    expect(drinkCampBuffPotion(c, fighter, 'potion-giant-strength-hill')).toContain('Strength');
    // Consumed from the pack, and now applied when the party is built.
    expect(c.characters[fighter]!.inventory.some((s) => s.itemId === 'potion-giant-strength-hill' && s.qty > 0)).toBe(false);
    expect(buildCampaignParty(c)[fighter]!.abilities.str).toBe(21);
    expect(21).toBeGreaterThan(base);
  });

  it('a resistance potion grants the damage-type resistance until a rest', () => {
    const c = newCampaign();
    const i = 2;
    c.characters[i]!.inventory.push({ itemId: 'potion-fire-resistance', qty: 1 });
    drinkCampBuffPotion(c, i, 'potion-fire-resistance');
    expect(buildCampaignParty(c)[i]!.resistances).toContain('fire');
    // A short rest ends the 1-hour potion.
    shortRest(c);
    expect(buildCampaignParty(c)[i]!.resistances).not.toContain('fire');
    expect(c.characters[i]!.resources?.effects?.resistances).toBeUndefined();
  });

  it('a long rest also clears a camp buff, and refuses to drink what you don\'t hold', () => {
    const c = newCampaign();
    const i = 0;
    expect(drinkCampBuffPotion(c, i, 'potion-giant-strength-frost')).toBeNull(); // none in pack
    c.characters[i]!.inventory.push({ itemId: 'potion-giant-strength-frost', qty: 1 });
    drinkCampBuffPotion(c, i, 'potion-giant-strength-frost');
    expect(buildCampaignParty(c)[i]!.abilities.str).toBe(23);
    longRest(c);
    expect(c.characters[i]!.resources?.effects?.giantStrength).toBeUndefined();
    expect(buildCampaignParty(c)[i]!.abilities.str).toBeLessThan(23);
  });
});
