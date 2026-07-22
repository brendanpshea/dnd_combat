/** The registry of playable adventure modules, in menu order. */
import type { Module } from '../../adventure/types.js';
import { HOLLOW_ROAD_MODULE } from './hollow-road.js';
import { SUNKEN_BARROWS_MODULE } from './sunken-barrows.js';
import { CLASSIC_MODULE } from './classic.js';
import { HIDEOUT_MODULE } from './demo.js';

export const MODULES: Module[] = [HOLLOW_ROAD_MODULE, SUNKEN_BARROWS_MODULE, HIDEOUT_MODULE, CLASSIC_MODULE];

/** Modules shown to players. The Bandit Hideout and Classic Ladder are test /
 *  demo scaffolding kept only for the suite — they stay out of the menu unless
 *  the UI opts into dev mode. */
const SHIPPED_MODULE_IDS = new Set<string>(['hollow-road', 'sunken-barrows']);

/** The modules a player may pick. `includeDev` (the `?dev` URL flag) reveals the
 *  test modules too. */
export function playableModules(includeDev = false): Module[] {
  return includeDev ? MODULES : MODULES.filter((m) => SHIPPED_MODULE_IDS.has(m.id));
}

export function moduleById(id: string): Module | undefined {
  return MODULES.find((m) => m.id === id);
}
