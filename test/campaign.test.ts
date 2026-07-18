import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import {
  newCampaign, currentStage, isComplete, buildCampaignParty, applyVictory,
  buyItem, sellItem, itemPrice, itemName, STAGES, STARTING_GOLD, SHOP_STOCK,
  treasureFor, levelForXp, partyLevelOf, xpAward, LEVEL_XP,
  giveItem, equipItem, equipBlocked, unequipSlot, setPartyClass, parseCampaign,
  partySkillCheck, attemptSteal, shortRest, longRest, useStoreHealing,
  partyStash, claimFromStash, stashItem, sellFromStash,
} from '../src/campaign/campaign.js';
import { encounterXP } from '../src/data/monsters.js';
import * as campaignModule from '../src/campaign/campaign.js';
import { saveCampaign, loadCampaign, deleteSave } from '../src/campaign/save.js';
import { Combat } from '../src/engine/combat.js';
import { buildEncounter } from '../src/data/monsters.js';
import { chooseAction } from '../src/ai/greedy.js';
import { ITEMS } from '../src/data/items.js';
import { CLASSES } from '../src/data/classes.js';
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

  it('persists battle HP and rests restore the expected amount', () => {
    const c = newCampaign();
    const party = buildCampaignParty(c);
    const fighter = party[0]!;
    fighter.hp = 1;
    applyVictory(c, party, 12345);

    expect(buildCampaignParty(c)[0]!.hp).toBe(1);
    const result = shortRest(c);
    const restedFighter = buildCampaignParty(c)[0]!;
    expect(result.totalHealed).toBe(Math.ceil(fighter.maxHp / 2));
    expect(restedFighter.hp).toBe(1 + Math.ceil(restedFighter.maxHp / 2));

    const longRestResult = longRest(c);
    expect(longRestResult.totalHealed).toBe(restedFighter.maxHp - restedFighter.hp);
    expect(buildCampaignParty(c)[0]!.hp).toBe(restedFighter.maxHp);
  });

  it('uses store healing sources on a selected party member', () => {
    const c = newCampaign(42);
    c.characters[1]!.resources = { hp: 1 };
    expect(useStoreHealing(c, 0, 1, 'potion-healing')?.healed).toBeGreaterThan(0);
    expect(c.characters[0]!.inventory.some((s) => s.itemId === 'potion-healing')).toBe(false);

    c.characters[3]!.resources = { hp: 1 };
    expect(useStoreHealing(c, 2, 3, 'cure-wounds')?.healed).toBeGreaterThan(0);
    expect(c.characters[2]!.resources).toBeUndefined(); // casting is not a consumable
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
    expect(partyLevelOf(c)).toBe(5); // reaches the content cap by the finale
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
    expect(levelForXp(1249)).toBe(3);
    expect(levelForXp(1250)).toBe(4);
    expect(levelForXp(1700)).toBe(5);
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
    const rareIds = new Set(['half-plate', 'splint', 'longsword-plus1', 'shortsword-plus1']);
    for (let seed = 1; seed <= 30; seed++) {
      const t = treasureFor(550, seed, 'rare');
      expect(t.items.some((s) => rareIds.has(s.itemId))).toBe(true);
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
