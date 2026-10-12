/**
 * Camps by level: a county rolls bands that are a fair fight for its party,
 * and in play a band preys on a weaker party and bows before a stronger one.
 */
import { describe, it, expect } from 'vitest';
import { generateLand } from '../src/adventure/overland.js';
import { startAdventure, enterScene, enterNode, choose } from '../src/adventure/runtime.js';
import { newCampaign, LEVEL_XP } from '../src/campaign/campaign.js';
import { encounterFor } from '../src/data/encounters.js';
import type { ExploreMap, Module } from '../src/adventure/types.js';

const TIER: Record<string, number> = { kobolds: 1, goblins: 1, bandits: 2, lizardfolk: 2, gnolls: 3, cult: 3, 'hag-court': 4, 'fire-court': 5 };
const mapOf = (m: Module) => (m.scenes.land as { map: ExploreMap }).map;
const campsOf = (m: Module) => mapOf(m).nodes.filter((n) => n.id.startsWith('camp-'));

describe('a county\'s camps', () => {
  it('are bands within a level of the party it is for', () => {
    for (const level of [1, 3, 5]) {
      const seen = new Set<string>();
      for (let seed = 1; seed <= 6; seed++) {
        for (const c of campsOf(generateLand(seed, { level }).module)) {
          const who = c.id.replace(/^camp-/, '');
          seen.add(who);
          expect(Math.abs(TIER[who]! - level), `${who} at level ${level}`).toBeLessThanOrEqual(1);
        }
      }
      expect(seen.size).toBeGreaterThan(0);
    }
  });

  it('fight at their own strength, whatever the party', () => {
    const m = generateLand(2, { level: 2 }).module;
    for (const c of campsOf(m)) {
      const fight = m.scenes[`${c.id}-fight`];
      expect(fight?.kind === 'battle' && encounterFor(fight.encounterId)).toBeTruthy();
    }
  });
});

describe('a camp, met in play', () => {
  const m = generateLand(3, { level: 2, camps: 0, places: [
    { id: 'reavers', label: 'Reaver Camp', kind: 'camp', faction: 'bandits', hostile: false },
    { id: 'pack', label: 'The Pack', kind: 'camp', faction: 'goblins', hostile: true },
  ] }).module;
  /** A party of `level`, standing at the camp (so no road to walk). */
  const meet = (level: number, camp: string) => {
    const c = newCampaign(1); c.xp = LEVEL_XP[level - 1]!; c.gold = 100;
    const s = startAdventure(c, m);
    enterScene(s, m, m.start); enterScene(s, m, 'land');
    s.exploredNodes.push(...mapOf(m).nodes.map((n) => n.id));
    (s.mapAt ??= {}).land = camp;
    enterNode(s, m, camp);
    return s;
  };

  it('asks a weaker party for a toll, and lets an even one sit at the fire', () => {
    expect(meet(1, 'reavers').sceneId).toBe('reavers-prey');
    expect(m.scenes['reavers-prey']).toMatchObject({ next: expect.arrayContaining([expect.objectContaining({ id: 'pay' })]) });
    expect(meet(2, 'reavers').sceneId).toBe('reavers');
    expect(meet(3, 'reavers').sceneId).toBe('reavers');
  });

  it('bows before a party two levels past it, with a gift', () => {
    const s = meet(4, 'reavers');
    expect(s.sceneId).toBe('reavers-cowed');
    const gold = s.campaign.gold;
    choose(s, m, 'take');
    expect(s.campaign.gold - gold).toBe(20);
  });

  it('or, a band that bolts, leaves its camp to a strong party', () => {
    expect(meet(1, 'pack').sceneId).toBe('pack');        // goblins: a fair fight at level 1
    const s = meet(3, 'pack');
    expect(s.sceneId).toBe('pack-cowed');
    expect(m.scenes['pack-cowed']).toMatchObject({ next: [expect.objectContaining({ id: 'take', to: 'pack-quiet' })] });
  });
});
