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
  giveItem, equipItem, equipBlocked, unequipSlot, EquipSlot, partyLevelOf, LEVEL_XP, MAX_LEVEL,
  attemptSteal, attemptHaggle, bestAtSkill, HAGGLE, SkillRoll,
} from '../../campaign/campaign.js';
import { saveCampaign, loadCampaign, deleteSave } from '../../campaign/save.js';
import { runBattle, chooseFrom, argValue, parseSeed, AiLevel } from './battle.js';

function xpLine(c: CampaignState): string {
  const level = partyLevelOf(c);
  if (level >= MAX_LEVEL) return `Level ${level} (max)`;
  const next = LEVEL_XP[level]!; // threshold for level+1
  return `Level ${level}   XP ${c.xp}/${next}`;
}

function partySummary(c: CampaignState): string {
  const stage = currentStage(c);
  const lines = [
    `Gold: ${c.gold}   ${xpLine(c)}   Battles won: ${c.victories.length}/${STAGES.length}` +
    (stage ? `   Next: ${ENCOUNTERS[stage.encounterId]!.name} (${MAPS[stage.mapId]!.name})` : ''),
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

function showRoll(c: CampaignState, r: SkillRoll): void {
  console.log(
    `  ${c.characters[r.by]?.name ?? 'The party'} rolls ${r.skill}: d20(${r.natural}) = ${r.total} vs DC ${r.dc} — ` +
    (r.success ? 'success!' : 'failure.'),
  );
}

async function shop(c: CampaignState, rl: readline.Interface): Promise<void> {
  // Visit-scoped state: haggled prices, one steal, one haggle; getting caught
  // stealing ends all shenanigans for the visit.
  let priceMult = 1;
  let stealUsed = false;
  let haggleUsed = false;
  let banned = false;
  const price = (id: string) => Math.ceil(itemPrice(id)! * priceMult);

  for (;;) {
    console.log('\n=== Shop ===');
    if (priceMult < 1) console.log(`(haggled: ${Math.round((1 - priceMult) * 100)}% off this visit)`);
    if (priceMult > 1) console.log(`(the shopkeeper is annoyed: prices +${Math.round((priceMult - 1) * 100)}% this visit)`);
    if (banned) console.log('(the shopkeeper is watching you closely)');
    console.log(partySummary(c));
    const canScheme = !banned;
    const options = [
      ...SHOP_STOCK.map((id) => `Buy ${itemName(id)} (${price(id)}g)`),
      'Sell an item (half price)',
      'Manage equipment',
      'Give an item to someone',
      ...(canScheme && !haggleUsed ? ['Haggle over prices (skill check)'] : []),
      ...(canScheme && !stealUsed ? ['Try to steal something (Stealth + Sleight of Hand)'] : []),
      'Done — to battle!',
    ];
    const pick = await chooseFrom(rl, 'Shop?', options);
    const label = options[pick]!;
    if (label.startsWith('Done')) return;

    const charNames = c.characters.map((ch) => CLASSES[ch.classId]!.name);

    if (label.startsWith('Haggle')) {
      haggleUsed = true;
      const skills = Object.keys(HAGGLE) as Array<keyof typeof HAGGLE>;
      const skillPick = await chooseFrom(rl, 'How?', skills.map((s) => {
        const cfg = HAGGLE[s];
        const best = bestAtSkill(c, s);
        return `${s} (DC ${cfg.dc}, ${CLASSES[c.characters[best.idx]!.classId]!.name} +${best.bonus}` +
          `, success −${cfg.discount * 100}%${cfg.penalty > 0 ? `, failure +${cfg.penalty * 100}%` : ', failure: no harm'})`;
      }));
      const result = attemptHaggle(c, skills[skillPick]!);
      showRoll(c, result.roll);
      priceMult = result.priceMultiplier;
      continue;
    }

    if (label.startsWith('Try to steal')) {
      stealUsed = true;
      const result = attemptSteal(c);
      for (const r of result.rolls) showRoll(c, r);
      if (result.success) {
        console.log(`  Swiped: ${itemName(result.itemId!)}!`);
      } else {
        banned = true;
        console.log(`  Caught! The shopkeeper fines the party ${result.fine} gold and watches you closely.`);
      }
      continue;
    }

    if (label.startsWith('Give an item')) { await giveFlow(c, rl); continue; }
    if (label.startsWith('Manage equipment')) { await manageEquipment(c, rl); continue; }
    if (label.startsWith('Sell')) {
      const who = await chooseFrom(rl, 'Whose item?', charNames);
      const ch = c.characters[who]!;
      const sellable = ch.inventory.filter((s) => s.qty > 0 && itemPrice(s.itemId) !== undefined);
      if (sellable.length === 0) { console.log('Nothing to sell.'); continue; }
      const which = await chooseFrom(rl, 'Sell what?',
        sellable.map((s) => `${itemName(s.itemId)}×${s.qty} (+${Math.floor(itemPrice(s.itemId)! / 2)}g)`));
      sellItem(c, who, sellable[which]!.itemId);
      continue;
    }

    // Buy: pick index maps 1:1 onto SHOP_STOCK.
    const itemId = SHOP_STOCK[pick]!;
    const cost = price(itemId);
    if (c.gold < cost) { console.log('Not enough gold.'); continue; }
    const who = await chooseFrom(rl, 'Give it to whom?', charNames);
    buyItem(c, who, itemId, cost);
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
    campaign = newCampaign(baseSeed);
    console.log('\nA new party sets out: Fighter, Wizard, Cleric, Rogue. 100 gold.');
  }

  while (!isComplete(campaign)) {
    const stage = currentStage(campaign)!;
    console.log(`\n========== Stage ${campaign.stage + 1}/${STAGES.length} ==========`);
    console.log(partySummary(campaign));

    if (!auto) await shop(campaign, rl);

    const enc = ENCOUNTERS[stage.encounterId]!;
    console.log(`\nThe party (level ${partyLevelOf(campaign)}) faces ${enc.name} at ${MAPS[stage.mapId]!.name}` +
      (partyLevelOf(campaign) < enc.suggestedLevel ? ' — under-leveled, this will be tough!' : '') + '!');
    const combat = new Combat({
      seed: baseSeed + campaign.stage,
      mapId: stage.mapId,
      combatants: [...buildCampaignParty(campaign), ...buildEncounter(stage.encounterId, 'team2', 7)],
    });
    const aiTeams = new Set<string>(['team2']);
    if (auto) aiTeams.add('team1');

    const winner = await runBattle(combat, aiTeams, rl, (argValue('--ai') ?? 'normal') as AiLevel);
    if (winner !== 'team1') {
      console.log('\nThe party has fallen. The campaign is over.');
      deleteSave();
      rl.close();
      return;
    }

    const survivors = Object.values(combat.state.combatants).filter((x) => x.team === 'team1');
    const done = applyVictory(campaign, survivors, combat.state.rng);
    console.log(`\nVictory! +${done.xpGained} XP. Loot: ${done.gold} gold` +
      (done.items.length > 0
        ? `, ${done.items.map((i) => `${itemName(i.itemId)}×${i.qty}`).join(', ')}`
        : ''));
    if (done.leveledTo) console.log(`*** LEVEL UP! The party is now level ${done.leveledTo}. ***`);
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
