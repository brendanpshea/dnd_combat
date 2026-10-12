/** A headless player for generated delves, shared by the delve tests. */
import {
  startAdventure, enterScene, currentScene, legalChoices, choose, resolveBattle, battleWonBefore,
  dungeonExits, walkTo, forceDoor, canSearch, searchRoom, dungeonExitHere, leaveDungeon,
} from '../src/adventure/runtime.js';
import { newCampaign, xpAward } from '../src/campaign/campaign.js';
import type { Module } from '../src/adventure/types.js';
import type { AdventureState } from '../src/adventure/runtime.js';

/**
 * A player who means to get to the bottom: takes the stairs down whenever it
 * stands on them, never the way back up or out, and otherwise wanders. A
 * purely random walker wanders three floors for tens of thousands of steps,
 * because the stair up is one choice in four on every stair foot.
 */
export function playDown(module: Module, seed: number): { ending: string; xp: number; scene: string; flags: Record<string, boolean | number> } {
  const state = startAdventure(newCampaign(seed), module);
  enterScene(state, module, module.start);
  playUntil(state, module, seed, () => false);
  const scene = currentScene(state, module);
  if (scene.kind !== 'ending') throw new Error(`${module.id} did not end`);
  return { ending: scene.outcome, xp: state.campaign.xp, scene: scene.id, flags: state.flags };
}

/** The same player, from wherever the run stands, until `stop` says so or an
 *  ending is reached. Throws if neither happens. */
export function playUntil(state: AdventureState, module: Module, seed: number, stop: (sceneId: string) => boolean): void {
  let n = seed;
  const roll = (k: number) => { n = (n * 1103515245 + 12345) % 2147483648; return Math.floor((n / 2147483648) * k); };
  for (let step = 0; step < 20000; step++) {
    const scene = currentScene(state, module);
    if (scene.kind === 'ending' || stop(scene.id)) return;
    if (scene.kind === 'battle') {
      if (scene.loot !== false && !battleWonBefore(state, scene.id)) state.campaign.xp += xpAward(scene.encounterId, state.campaign.characters.length);
      resolveBattle(state, module, true);
    } else if (scene.kind === 'dungeon') {
      const exit = dungeonExitHere(state, module);
      if (exit && /(^|\/)delve-\d$/.test(exit.to) && exit.label === 'Down the stairs') { leaveDungeon(state, module); continue; }
      if (canSearch(state, module)) { searchRoom(state, module); continue; }
      const doors = dungeonExits(state, module);
      const open = doors.filter((x) => !x.blocked);
      const forcible = doors.filter((x) => x.blocked && x.force);
      if (open.length) walkTo(state, module, open[roll(open.length)]!.to);
      else if (forcible.length) forceDoor(state, module, forcible[0]!.link);
      else if (exit) leaveDungeon(state, module);
      else throw new Error(`stuck in ${scene.id}`);
    } else {
      const options = legalChoices(state, module).filter((o) => !o.blocked);
      const back = options.find((o) => o.choice.id === 'in' || o.choice.id === 'on');
      choose(state, module, (back ?? options[0]!).choice.id);
    }
  }
  throw new Error(`${module.id}: did not get there`);
}

