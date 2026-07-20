/**
 * The classic 14-battle ladder, expressed as an adventure module.
 *
 * Two jobs: it's the migration target for legacy campaign saves (a saved
 * `stage` maps to `battle-<stage>`), and it's the proof the scene runtime
 * subsumes what already exists — a shop, then a fight, then the next shop,
 * fourteen times, then a victory epilogue. The scenes are assembled from the
 * existing `STAGES`/`ENCOUNTERS` data, so the ladder stays single-sourced.
 */
import type { Id } from '../../engine/types.js';
import { STAGES } from '../../campaign/campaign.js';
import { ENCOUNTERS } from '../monsters.js';
import { MAPS } from '../maps.js';
import type { Module, Scene } from '../../adventure/types.js';

const MAP_NAME = (mapId: string) => MAPS[mapId]?.name ?? mapId;

function buildClassic(): Module {
  const scenes: Record<Id, Scene> = {};
  const last = STAGES.length - 1;

  scenes['start'] = {
    id: 'start', kind: 'story',
    art: { emoji: '⚔️' },
    text: [
      'Four adventurers set out along the old road, blades sharp and purses light.',
      'A ladder of foes stands between them and glory. One fight at a time.',
    ],
    next: [{ id: 'begin', label: 'Set out', to: 'shop-0' }],
  };

  STAGES.forEach((stage, i) => {
    const enc = ENCOUNTERS[stage.encounterId];
    const name = enc?.name ?? stage.encounterId;
    const nextShop = i < last ? `shop-${i + 1}` : 'victory';

    scenes[`shop-${i}`] = {
      id: `shop-${i}`, kind: 'shop', next: `battle-${i}`,
      ...(i === 0 ? { intro: ['You reach a wayside market. Stock up before the road turns dangerous.'] } : {}),
    };

    scenes[`battle-${i}`] = {
      id: `battle-${i}`, kind: 'battle',
      encounterId: stage.encounterId, mapId: stage.mapId,
      intro: [`Stage ${i + 1} of ${STAGES.length}: ${name} — ${MAP_NAME(stage.mapId)}.`],
      onWin: { to: nextShop, text: [`${name} is defeated!`] },
      // onLoss omitted → story mode retries the fight.
    };
  });

  scenes['victory'] = {
    id: 'victory', kind: 'ending', outcome: 'victory',
    art: { emoji: '🏆' },
    text: [
      `${ENCOUNTERS[STAGES[last]!.encounterId]?.name ?? 'The last foe'} is vanquished.`,
      'The ladder is climbed. The party rests, richer and renowned.',
    ],
  };

  return {
    id: 'classic', title: 'The Classic Ladder',
    blurb: 'The original fourteen-battle gauntlet, now as an adventure.',
    start: 'start', scenes,
  };
}

export const CLASSIC_MODULE: Module = buildClassic();
