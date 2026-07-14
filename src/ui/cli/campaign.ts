/**
 * Campaign CLI: a persistent party plays the encounter ladder, shopping
 * between battles. Progress saves to campaign-save.json after every victory.
 *
 * Usage: npm run campaign [-- --seed 123] [-- --auto] [-- --new]
 *   --auto  let the AI play your party (fast playthrough)
 *   --new   discard any existing save and start over
 */
import * as readline from 'node:readline/promises';
import { Combat } from '../../engine/combat.js';
import { buildEncounter, ENCOUNTERS } from '../../data/monsters.js';
import { MAPS } from '../../data/maps.js';
import { ITEMS } from '../../data/items.js';
import { CLASSES } from '../../data/classes.js';
import {
  CampaignState, newCampaign, currentStage, isComplete, buildCampaignParty,
  applyVictory, buyItem, sellItem, itemPrice, SHOP_STOCK, STAGES,
} from '../../campaign/campaign.js';
import { saveCampaign, loadCampaign, deleteSave } from '../../campaign/save.js';
import { runBattle, chooseFrom, argValue, parseSeed } from './battle.js';

function partySummary(c: CampaignState): string {
  const stage = currentStage(c);
  const lines = [
    `Gold: ${c.gold}   Battles won: ${c.victories.length}/${STAGES.length}` +
    (stage ? `   Next: ${ENCOUNTERS[stage.encounterId]!.name} (level ${stage.partyLevel}, ${MAPS[stage.mapId]!.name})` : ''),
  ];
  for (const ch of c.characters) {
    const items = ch.inventory
      .filter((s) => s.qty > 0)
      .map((s) => `${ITEMS[s.itemId]?.name ?? s.itemId}×${s.qty}`)
      .join(', ');
    lines.push(`  ${CLASSES[ch.classId]!.name}: ${items || '(no items)'}`);
  }
  return lines.join('\n');
}

async function shop(c: CampaignState, rl: readline.Interface): Promise<void> {
  for (;;) {
    console.log('\n=== Shop ===');
    console.log(partySummary(c));
    const options = [
      ...SHOP_STOCK.map((id) => `Buy ${ITEMS[id]!.name} (${itemPrice(id)}g)`),
      'Sell an item (half price)',
      'Done — to battle!',
    ];
    const pick = await chooseFrom(rl, 'Shop?', options);
    if (pick === options.length - 1) return;

    const charNames = c.characters.map((ch) => CLASSES[ch.classId]!.name);
    if (pick === options.length - 2) {
      // Sell flow.
      const who = await chooseFrom(rl, 'Whose item?', charNames);
      const ch = c.characters[who]!;
      const sellable = ch.inventory.filter((s) => s.qty > 0 && itemPrice(s.itemId) !== undefined);
      if (sellable.length === 0) { console.log('Nothing to sell.'); continue; }
      const which = await chooseFrom(rl, 'Sell what?',
        sellable.map((s) => `${ITEMS[s.itemId]?.name ?? s.itemId}×${s.qty} (+${Math.floor(itemPrice(s.itemId)! / 2)}g)`));
      sellItem(c, who, sellable[which]!.itemId);
      continue;
    }

    const itemId = SHOP_STOCK[pick]!;
    if (c.gold < itemPrice(itemId)!) { console.log('Not enough gold.'); continue; }
    const who = await chooseFrom(rl, 'Give it to whom?', charNames);
    buyItem(c, who, itemId);
  }
}

async function main() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const auto = process.argv.includes('--auto');
  const startNew = process.argv.includes('--new');
  const baseSeed = parseSeed();

  let campaign = startNew ? undefined : loadCampaign();
  if (campaign) {
    console.log('\nResuming saved campaign.');
  } else {
    campaign = newCampaign();
    console.log('\nA new party sets out: Fighter, Wizard, Cleric, Rogue. 100 gold.');
  }

  while (!isComplete(campaign)) {
    const stage = currentStage(campaign)!;
    console.log(`\n========== Stage ${campaign.stage + 1}/${STAGES.length} ==========`);
    console.log(partySummary(campaign));

    if (!auto) await shop(campaign, rl);

    const enc = ENCOUNTERS[stage.encounterId]!;
    console.log(`\nThe party (level ${stage.partyLevel}) faces ${enc.name} at ${MAPS[stage.mapId]!.name}!`);
    const combat = new Combat({
      seed: baseSeed + campaign.stage,
      mapId: stage.mapId,
      combatants: [...buildCampaignParty(campaign), ...buildEncounter(stage.encounterId, 'team2', 7)],
    });
    const aiTeams = new Set<string>(['team2']);
    if (auto) aiTeams.add('team1');

    const winner = await runBattle(combat, aiTeams, rl);
    if (winner !== 'team1') {
      console.log('\nThe party has fallen. The campaign is over.');
      deleteSave();
      rl.close();
      return;
    }

    const survivors = Object.values(combat.state.combatants).filter((x) => x.team === 'team1');
    const done = applyVictory(campaign, survivors);
    console.log(`\nVictory! Loot: ${done.loot.gold} gold` +
      (done.loot.items.length > 0
        ? `, ${done.loot.items.map((i) => `${ITEMS[i.itemId]?.name ?? i.itemId}×${i.qty}`).join(', ')}`
        : ''));
    if (!isComplete(campaign)) {
      saveCampaign(campaign);
      console.log('(progress saved)');
    }
  }

  console.log('\n##### THE CAMPAIGN IS COMPLETE — the ogre has fallen! #####');
  console.log(partySummary(campaign));
  deleteSave();
  rl.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
