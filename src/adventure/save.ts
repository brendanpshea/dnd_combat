/**
 * Adventure save/resume. AdventureState is plain serializable data (the whole
 * point of the function-free module rule), so a save is JSON. Loading migrates
 * the embedded campaign through `parseCampaign` and re-validates the scene id
 * against the module — a module edited since the save (a renamed/removed scene)
 * discards rather than crashing, the same forgiving stance as the campaign save.
 */
import { parseCampaign } from '../campaign/campaign.js';
import type { AdventureState } from './runtime.js';
import type { Module } from './types.js';

export const ADVENTURE_SAVE_VERSION = 1;

export interface AdventureSave {
  version: number;
  state: AdventureState;
}

export function serializeAdventure(state: AdventureState): string {
  return JSON.stringify({ version: ADVENTURE_SAVE_VERSION, state } satisfies AdventureSave);
}

/** The module id a save belongs to, or undefined if the blob is unusable. */
export function savedModuleId(json: string): string | undefined {
  try {
    const raw = JSON.parse(json) as AdventureSave;
    return raw?.state?.moduleId;
  } catch {
    return undefined;
  }
}

/** Parse a save and validate it against `module`. Returns undefined if the
 *  blob is malformed, belongs to another module, or points at a scene the
 *  module no longer has. */
export function parseAdventure(json: string, module: Module): AdventureState | undefined {
  try {
    const raw = JSON.parse(json) as AdventureSave;
    const state = raw?.state;
    if (!state || state.moduleId !== module.id) return undefined;
    if (!module.scenes[state.sceneId]) return undefined;

    const campaign = parseCampaign(JSON.stringify(state.campaign));
    if (!campaign) return undefined;
    state.campaign = campaign;

    // Back-fill fields added after older saves.
    state.flags ??= {};
    state.visited ??= [];
    state.exploredNodes ??= [];
    state.wanderingRolled ??= [];
    state.journal ??= [];
    state.guidanceSpent ??= [];
    state.consumedChoices ??= [];
    state.spentApproaches ??= [];
    state.shopVisits ??= {};
    return state;
  } catch {
    return undefined;
  }
}
