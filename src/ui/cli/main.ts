/**
 * One-off battle CLI. Renders the board, generates a menu straight from
 * legalActions(), applies the chosen action, prints the events.
 *
 * Usage: npm start [-- --seed 123] [-- --p1 ai] [-- --p2 ai]
 *                  [-- --map ruins] [-- --level 2] [-- --encounter goblins]
 * For the persistent campaign (shops, loot, ladder): npm run campaign
 */
import * as readline from 'node:readline/promises';
import { Combat } from '../../engine/combat.js';
import { buildParty } from '../../builder/character.js';
import { MAPS, MAP_IDS } from '../../data/maps.js';
import { ENCOUNTERS, buildEncounter } from '../../data/monsters.js';
import { runBattle, argValue, parseSeed, AiLevel } from './battle.js';

async function main() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const seed = parseSeed();
  const aiTeams = new Set<string>();
  if (argValue('--p1') === 'ai') aiTeams.add('team1');
  if (argValue('--p2') === 'ai') aiTeams.add('team2');
  const mode = aiTeams.size === 2 ? 'AI vs AI' : aiTeams.size === 1 ? 'human vs AI' : 'hot-seat';
  const mapArg = argValue('--map');
  if (mapArg !== undefined && !MAPS[mapArg]) {
    console.log(`Unknown map '${mapArg}'. Available: ${MAP_IDS.join(', ')}`);
    process.exit(1);
  }
  const mapId = mapArg ?? MAP_IDS[Math.floor(Math.random() * MAP_IDS.length)]!;

  const encounterArg = argValue('--encounter');
  if (encounterArg !== undefined && !ENCOUNTERS[encounterArg]) {
    console.log(`Unknown encounter '${encounterArg}'. Available: ${Object.keys(ENCOUNTERS).join(', ')}`);
    process.exit(1);
  }
  const level = Math.min(3, Math.max(1, Number(argValue('--level') ?? 1)));

  let team2 = buildParty('team2', 7, level);
  let banner = mode;
  if (encounterArg) {
    const enc = ENCOUNTERS[encounterArg]!;
    team2 = buildEncounter(encounterArg, 'team2', 7);
    aiTeams.add('team2');
    banner = `party vs ${enc.name}`;
    if (level !== enc.suggestedLevel) {
      console.log(`(note: ${enc.name} is tuned for a level-${enc.suggestedLevel} party; you are level ${level})`);
    }
  }

  console.log(`\nD&D Grid Combat — ${banner}. Level ${level}. Seed: ${seed}. Map: ${MAPS[mapId]!.name}`);
  console.log(`(terrain: ### wall  ~~~ difficult ground  ^^^ fire hazard)\n`);
  const combat = new Combat({
    seed,
    mapId,
    combatants: [...buildParty('team1', 0, level), ...team2],
  });

  const aiLevel = (argValue('--ai') ?? 'normal') as AiLevel;
  await runBattle(combat, aiTeams, rl, aiLevel);
  rl.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
