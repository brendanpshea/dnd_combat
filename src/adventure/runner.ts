/**
 * A headless driver that walks a module to an ending, given policies for the
 * three things the pure runtime can't decide on its own: which choice to take,
 * who steps up for a "chosen" check, and whether a battle is won. The CLI and
 * the auto-player test are both thin wrappers over this — the same reason the
 * combat engine has one `step` behind every UI.
 */
import type { Module } from './types.js';
import { type CampaignState, xpAward } from '../campaign/campaign.js';
import {
  type AdventureState, type AdventureEvent,
  startAdventure, currentScene, enterScene, legalChoices, choose,
  rollSceneCheck, legalApproaches, tryApproach, exploreNodes, enterNode,
  resolveBattle, resolveShopOrRest,
} from './runtime.js';

export interface RunPolicy {
  /** Pick an index into the provided list of options (choices or nodes). */
  pick(count: number, tag: string): number;
  /** Resolve a battle scene → did the party win? */
  battle(encounterId: string, mapId: string): boolean;
  /** Actor index for a `roller: 'chosen'` check (default: runtime's best). */
  actor?(skill: string): number | undefined;
}

export interface RunResult {
  state: AdventureState;
  events: AdventureEvent[];
  ending: 'victory' | 'defeat';
  steps: number;
}

/** Drive `module` from its start to an ending. Throws on a dead end (no legal
 *  progress), which is exactly what the validator/auto-player want to catch. */
export function runModule(
  campaign: CampaignState, module: Module, policy: RunPolicy, maxSteps = 5000,
): RunResult {
  const state = startAdventure(campaign, module);
  const events: AdventureEvent[] = [...enterScene(state, module, module.start)];
  let ending: 'victory' | 'defeat' | null = null;

  for (let steps = 0; steps < maxSteps; steps++) {
    const scene = currentScene(state, module);
    switch (scene.kind) {
      case 'ending':
        ending = scene.outcome;
        return { state, events, ending, steps };

      case 'story':
      case 'dialogue': {
        const options = legalChoices(state, module).filter((o) => !o.blocked);
        if (options.length === 0) throw new Error(`Dead end at scene '${scene.id}'`);
        const pick = options[policy.pick(options.length, `choice:${scene.id}`)]!;
        events.push(...choose(state, module, pick.choice.id));
        break;
      }

      case 'check': {
        const actor = scene.roller === 'chosen' ? policy.actor?.(scene.skill) : undefined;
        events.push(...rollSceneCheck(state, module, actor));
        break;
      }

      case 'challenge': {
        // Only untried, unblocked approaches are pickable; a `perApproach`
        // challenge whittles them down until it resolves or runs dry.
        const options = legalApproaches(state, module).filter((a) => !a.blocked && !a.spent);
        if (options.length === 0) throw new Error(`Challenge dead end at '${scene.id}'`);
        const pick = options[policy.pick(options.length, `approach:${scene.id}`)]!;
        const actor = (pick.approach.roller === 'chosen') ? policy.actor?.(pick.approach.skill) : undefined;
        events.push(...tryApproach(state, module, pick.approach.id, actor));
        break;
      }

      case 'battle': {
        const won = policy.battle(scene.encounterId, scene.mapId);
        // Mirror the real driver (applyAdventureVictory): a won fight grants
        // encounter XP unless the scene opts out with loot:false. Without this,
        // headless pacing ignored combat entirely and only saw milestone XP.
        if (won && scene.loot !== false) {
          state.campaign.xp += xpAward(scene.encounterId, Math.max(1, state.campaign.characters.length));
        }
        events.push(...resolveBattle(state, module, won));
        break;
      }

      case 'shop':
      case 'rest':
        events.push(...resolveShopOrRest(state, module));
        break;

      case 'explore': {
        const nodes = exploreNodes(state, module).filter((n) => !n.blocked);
        if (nodes.length === 0) throw new Error(`Explore dead end at '${scene.id}'`);
        const pick = nodes[policy.pick(nodes.length, `node:${scene.id}`)]!;
        events.push(...enterNode(state, module, pick.node.id));
        break;
      }
    }
  }
  throw new Error(`Module '${module.id}' did not reach an ending within ${maxSteps} steps`);
}
