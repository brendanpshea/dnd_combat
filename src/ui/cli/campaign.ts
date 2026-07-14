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
  applyVictory, buyItem, sellItem, itemPrice, itemName, SHOP_STOCK, STAGES,
  giveItem, equipItem, equipBlocked, unequipSlot, EquipSlot,
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
    const eq = [
      itemName(ch.equipped.mainHand),
      ch.equipped.offHand ? itemName(ch.equipped.offHand) : undefined,
      ch.equipped.armor ? itemName(ch.equipped.armor) : 'unarmored',
    ].filter(Boolean).join(' / ');
    const items = ch.inventory
      .filter((s) => s.qty > 0)
      .map((s) => `${itemName(s.itemId)}×${s.qty}`)
      .join(', ');
    lines.push(`  ${CLASSES[ch.classId]!.name} [${eq}]: ${items || '(no items)'}`);
  }
  return lines.join('\n');
}

async function manageEquipment(c: CampaignState, rl: readline.Interface): Promise<void> {
  const charNames = c.characters.map((ch) => CLASSES[ch.classId]!.name);
  const who = await chooseFrom(rl, 'Whose gear?', [...charNames, 'Back']);
  if (who === charNames.length) return;
  const ch = c.characters[who]!;
  for (;;) {
    const gear = ch.inventory.filter((s) => s.qty > 0);
    const options = [
      ...gear.map((s) => `Equip ${itemName(s.itemId)}`),
      ...(ch.equipped.offHand ? [`Unequip off-hand (${itemName(ch.equipped.offHand)})`] : []),
      ...(ch.equipped.armor ? [`Unequip armor (${itemName(ch.equipped.armor)})`] : []),
      'Back',
    ];
    console.log(`\n${charNames[who]}: main ${itemName(ch.equipped.mainHand)}, ` +
      `off ${ch.equipped.offHand ? itemName(ch.equipped.offHand) : '—'}, ` +
      `armor ${ch.equipped.armor ? itemName(ch.equipped.armor) : '—'}`);
    const pick = await chooseFrom(rl, 'Equip?', options);
    if (pick === options.length - 1) return;
    let idx = pick;
    if (idx < gear.length) {
      const itemId = gear[idx]!.itemId;
      // Choose slot: armor items force armor; shield forces off-hand; weapons ask.
      let slot: EquipSlot;
      if (equipBlocked(c, who, itemId, 'armor') === undefined) slot = 'armor';
      else if (itemId === 'shield') slot = 'offHand';
      else {
        const s = await chooseFrom(rl, 'Which hand?', ['Main hand', 'Off-hand']);
        slot = s === 0 ? 'mainHand' : 'offHand';
      }
      const blocked = equipBlocked(c, who, itemId, slot);
      if (blocked) { console.log(`Can't: ${blocked}.`); continue; }
      equipItem(c, who, itemId, slot);
      continue;
    }
    idx -= gear.length;
    if (ch.equipped.offHand && idx === 0) { unequipSlot(c, who, 'offHand'); continue; }
    unequipSlot(c, who, 'armor');
  }
}

async function giveFlow(c: CampaignState, rl: readline.Interface): Promise<void> {
  const charNames = c.characters.map((ch) => CLASSES[ch.classId]!.name);
  const from = await chooseFrom(rl, 'Who gives?', [...charNames, 'Back']);
  if (from === charNames.length) return;
  const items = c.characters[from]!.inventory.filter((s) => s.qty > 0);
  if (items.length === 0) { console.log('Nothing to give.'); return; }
  const which = await chooseFrom(rl, 'Give what?', items.map((s) => `${itemName(s.itemId)}×${s.qty}`));
  const to = await chooseFrom(rl, 'To whom?', charNames);
  if (!giveItem(c, from, to, items[which]!.itemId)) console.log("Can't do that.");
}

async function shop(c: CampaignState, rl: readline.Interface): Promise<void> {
  for (;;) {
    console.log('\n=== Shop ===');
    console.log(partySummary(c));
    const options = [
      ...SHOP_STOCK.map((id) => `Buy ${itemName(id)} (${itemPrice(id)}g)`),
      'Sell an item (half price)',
      'Manage equipment',
      'Give an item to someone',
      'Done — to battle!',
    ];
    const pick = await chooseFrom(rl, 'Shop?', options);
    if (pick === options.length - 1) return;

    const charNames = c.characters.map((ch) => CLASSES[ch.classId]!.name);
    if (pick === options.length - 2) { await giveFlow(c, rl); continue; }
    if (pick === options.length - 3) { await manageEquipment(c, rl); continue; }
    if (pick === options.length - 4) {
      // Sell flow.
      const who = await chooseFrom(rl, 'Whose item?', charNames);
      const ch = c.characters[who]!;
      const sellable = ch.inventory.filter((s) => s.qty > 0 && itemPrice(s.itemId) !== undefined);
      if (sellable.length === 0) { console.log('Nothing to sell.'); continue; }
      const which = await chooseFrom(rl, 'Sell what?',
        sellable.map((s) => `${itemName(s.itemId)}×${s.qty} (+${Math.floor(itemPrice(s.itemId)! / 2)}g)`));
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
    const done = applyVictory(campaign, survivors, combat.state.rng);
    console.log(`\nVictory! Loot: ${done.gold} gold` +
      (done.items.length > 0
        ? `, ${done.items.map((i) => `${itemName(i.itemId)}×${i.qty}`).join(', ')}`
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
