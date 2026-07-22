/**
 * A minimal text driver for adventure modules. Not the player-facing surface
 * (the web app is) — this exists so the runtime has a headless human-drivable
 * front end alongside the auto-player, the same reason `--auto` battles do.
 *
 * `npm run adventure` plays the classic ladder as a module; `--module <id>`
 * selects another registered module, `--auto` plays it hands-off.
 */
import * as readline from 'node:readline/promises';
import { Combat } from '../../engine/combat.js';
import {
  newCampaign, buildCampaignParty, applyAdventureVictory, readBackSurvivors,
  type CampaignState,
} from '../../campaign/campaign.js';
import { buildEncounter, ENCOUNTERS } from '../../data/monsters.js';
import { SKILL_LABEL } from '../../data/classes.js';
import { CLASSIC_MODULE } from '../../data/modules/classic.js';
import { HIDEOUT_MODULE } from '../../data/modules/demo.js';
import { HOLLOW_ROAD_MODULE } from '../../data/modules/hollow-road.js';
import {
  startAdventure, currentScene, enterScene, legalChoices, choose, rollSceneCheck,
  legalApproaches, tryApproach,
  exploreNodes, enterNode, resolveBattle, resolveShopOrRest, battleSeed,
  type AdventureState, type AdventureEvent,
} from '../../adventure/runtime.js';
import type { Module } from '../../adventure/types.js';
import { runBattle } from './battle.js';

const MODULES: Record<string, Module> = {
  classic: CLASSIC_MODULE, hideout: HIDEOUT_MODULE, 'hollow-road': HOLLOW_ROAD_MODULE,
};

function argValue(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function render(events: AdventureEvent[], c: CampaignState): void {
  for (const e of events) {
    switch (e.type) {
      case 'scene': break;
      case 'text': for (const p of e.paragraphs) console.log(`\n${p}`); break;
      case 'check': {
        const who = c.characters[e.roll.by]?.name ?? 'Someone';
        const g = e.roll.guidance ? ` (+${e.roll.guidance} guidance)` : '';
        console.log(`\n🎲 ${who} rolls ${SKILL_LABEL[e.roll.skill]}: ` +
          `${e.roll.natural} → ${e.roll.total}${g} vs DC ${e.roll.dc} — ${e.success ? 'SUCCESS' : 'FAILURE'}`);
        break;
      }
      case 'groupCheck': {
        const passed = e.result.rolls.filter((r) => r.success).length;
        console.log(`\n🎲 Group check: ${passed}/${e.result.rolls.length} passed — ${e.success ? 'SUCCESS' : 'FAILURE'}`);
        break;
      }
      case 'flag': break;
      case 'gold': console.log(`   💰 Gold ${e.amount >= 0 ? '+' : ''}${e.amount} (now ${e.total})`); break;
      case 'item': console.log(`   🎁 ${e.gained ? 'Gained' : 'Lost'} ${e.itemId} ×${e.qty}`); break;
      case 'xp': console.log(`   ✨ +${e.amount} XP${e.leveledTo ? ` — LEVEL UP to ${e.leveledTo}!` : ''}`); break;
      case 'heal': if (e.amount > 0) console.log(`   ❤️ Healed ${e.amount} HP`); break;
      case 'journal': console.log(`   📖 Journal: ${e.entry.title}`); break;
      case 'secretRevealed': console.log(`   🔍 You notice something hidden…`); break;
      default: break;
    }
  }
}

async function pickIndex(rl: readline.Interface, labels: string[], auto: boolean): Promise<number> {
  labels.forEach((l, i) => console.log(`  ${i + 1}) ${l}`));
  // --auto picks at random so it makes real progress through explore maps
  // (always-index-0 would loop on a node that returns to the map).
  if (auto) return Math.floor(Math.random() * labels.length);
  while (true) {
    const ans = await rl.question('> ');
    const n = parseInt(ans, 10);
    if (n >= 1 && n <= labels.length) return n - 1;
    console.log('Invalid choice.');
  }
}

async function main() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const auto = process.argv.includes('--auto');
  const module = MODULES[argValue('--module') ?? 'classic'] ?? CLASSIC_MODULE;
  const campaign = newCampaign(Number(argValue('--seed') ?? 1));
  campaign.partyReady = true;

  const state: AdventureState = startAdventure(campaign, module);
  console.log(`\n=== ${module.title} ===\n${module.blurb}`);
  render(enterScene(state, module, module.start), campaign);

  for (let guard = 0; guard < 10000; guard++) {
    const scene = currentScene(state, module);
    if (scene.kind === 'ending') {
      console.log(`\n${scene.outcome === 'victory' ? '🏆 VICTORY' : '☠️ DEFEAT'} — the adventure ends.`);
      break;
    }

    if (scene.kind === 'story' || scene.kind === 'dialogue') {
      const options = legalChoices(state, module);
      console.log('');
      const labels = options.map((o) => o.blocked ? `${o.choice.label} — (${o.blocked})` : o.choice.label);
      const playable = options.filter((o) => !o.blocked);
      const idx = await pickIndex(rl, labels, auto);
      const chosen = options[idx]!;
      if (chosen.blocked) { console.log('That path is blocked.'); continue; }
      render(choose(state, module, chosen.choice.id), campaign);
      void playable;
    } else if (scene.kind === 'check') {
      render(rollSceneCheck(state, module), campaign);
    } else if (scene.kind === 'challenge') {
      const options = legalApproaches(state, module);
      console.log('\nHow do you handle this?');
      const idx = await pickIndex(rl, options.map((o) => {
        const chip = `[${o.approach.skill} DC ${o.approach.dc}]`;
        const tag = o.blocked ? ` — (${o.blocked})` : o.spent ? ' — (already tried)' : '';
        return `${chip} ${o.approach.label}${tag}`;
      }), auto);
      const pick = options[idx]!;
      if (pick.blocked || pick.spent) { console.log('Not available.'); continue; }
      render(tryApproach(state, module, pick.approach.id), campaign);
    } else if (scene.kind === 'explore') {
      const nodes = exploreNodes(state, module);
      console.log(`\n🗺️  ${scene.map.title}`);
      const idx = await pickIndex(rl, nodes.map((n) =>
        `${n.node.icon} ${n.node.label}${n.blocked ? ` — (${n.blocked})` : ''}`), auto);
      const node = nodes[idx]!;
      if (node.blocked) { console.log('Locked.'); continue; }
      render(enterNode(state, module, node.node.id), campaign);
    } else if (scene.kind === 'battle') {
      const enc = ENCOUNTERS[scene.encounterId];
      console.log(`\n⚔️  ${enc?.name ?? scene.encounterId} — fight!`);
      const combat = new Combat({
        seed: battleSeed(state, scene.id),
        mapId: scene.mapId,
        combatants: [...buildCampaignParty(campaign), ...buildEncounter(scene.encounterId, 'team2', 7)],
      });
      const aiTeams = new Set<string>(['team2']);
      if (auto) aiTeams.add('team1');
      const winner = await runBattle(combat, aiTeams, rl, 'normal');
      const won = winner === 'team1';
      if (won) {
        // Mirror the web driver: rewards come from the scene's own encounter
        // (respecting `loot`), never from the campaign ladder's current stage —
        // applyVictory here handed out the wrong monsters' XP/treasure and
        // advanced `stage` until it threw "Campaign already complete".
        const survivors = Object.values(combat.state.combatants).filter((x) => x.team === 'team1');
        if (scene.loot === false) readBackSurvivors(campaign, survivors);
        else applyAdventureVictory(campaign, survivors, scene.encounterId, combat.state.rng, scene.loot?.bonusTier);
      }
      render(resolveBattle(state, module, won), campaign);
    } else if (scene.kind === 'shop' || scene.kind === 'rest') {
      // The CLI adventure demo auto-resolves shops/rests (the web app has the
      // full shop UI). Rests heal; the note keeps the flow legible.
      console.log(scene.kind === 'rest' ? '\n🏕️  The party rests.' : '\n🏪 (shop — skipped in the CLI demo)');
      render(resolveShopOrRest(state, module), campaign);
    }
  }
  rl.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
