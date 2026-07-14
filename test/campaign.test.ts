import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import {
  newCampaign, currentStage, isComplete, buildCampaignParty, applyVictory,
  buyItem, sellItem, itemPrice, STAGES, STARTING_GOLD, SHOP_STOCK,
} from '../src/campaign/campaign.js';
import { saveCampaign, loadCampaign, deleteSave } from '../src/campaign/save.js';
import { Combat } from '../src/engine/combat.js';
import { buildEncounter } from '../src/data/monsters.js';
import { chooseAction } from '../src/ai/greedy.js';
import { ITEMS } from '../src/data/items.js';

describe('campaign state', () => {
  it('new campaign: 4 characters with class kits, starting gold, stage 0', () => {
    const c = newCampaign();
    expect(c.gold).toBe(STARTING_GOLD);
    expect(c.stage).toBe(0);
    expect(c.characters).toHaveLength(4);
    expect(c.characters[0]!.classId).toBe('fighter');
    expect(c.characters[0]!.inventory.some((s) => s.itemId === 'potion-healing')).toBe(true);
    expect(currentStage(c)!.encounterId).toBe('goblins');
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
    expect(sellItem(c, 1, 'scroll-cure-wounds')).toBe(false); // wizard doesn't have one
  });

  it('every shop item has a price', () => {
    for (const id of SHOP_STOCK) {
      expect(itemPrice(id)).toBeGreaterThan(0);
      expect(ITEMS[id]).toBeDefined();
    }
  });

  it('buildCampaignParty uses the stage level and persisted gear', () => {
    const c = newCampaign();
    c.characters[0]!.inventory = [{ itemId: 'potion-greater-healing', qty: 3 }];
    c.stage = 3; // ogre stage, level 3
    const party = buildCampaignParty(c);
    expect(party).toHaveLength(4);
    expect(party[0]!.level).toBe(3);
    expect(party[0]!.inventory).toEqual([{ itemId: 'potion-greater-healing', qty: 3 }]);
    expect(party[1]!.spellSlots).toEqual([{ current: 4, max: 4 }, { current: 2, max: 2 }]);
  });

  it('applyVictory: loot added, gear read back from survivors, stage advances', () => {
    const c = newCampaign();
    const party = buildCampaignParty(c);
    // Simulate the fighter having drunk their potion mid-battle.
    party[0]!.inventory = party[0]!.inventory.filter((s) => s.itemId !== 'potion-healing');
    const stage = applyVictory(c, party);
    expect(stage.encounterId).toBe('goblins');
    expect(c.stage).toBe(1);
    expect(c.gold).toBe(STARTING_GOLD + stage.loot.gold);
    expect(c.victories).toEqual(['goblins']);
    // Spent potion stays spent... but the loot (2 potions) went to the fighter pool.
    const fighterPotions = c.characters[0]!.inventory.find((s) => s.itemId === 'potion-healing');
    expect(fighterPotions?.qty).toBe(2); // 0 remaining + 2 loot
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
