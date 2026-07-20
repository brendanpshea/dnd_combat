/** The registry of playable adventure modules, in menu order. */
import type { Module } from '../../adventure/types.js';
import { HOLLOW_ROAD_MODULE } from './hollow-road.js';
import { CLASSIC_MODULE } from './classic.js';
import { HIDEOUT_MODULE } from './demo.js';

export const MODULES: Module[] = [HOLLOW_ROAD_MODULE, HIDEOUT_MODULE, CLASSIC_MODULE];

export function moduleById(id: string): Module | undefined {
  return MODULES.find((m) => m.id === id);
}
