/**
 * Camps by level: a county rolls bands that are a fair fight for its party,
 * and in play a band preys on a weaker party and bows before a stronger one.
 */
import { describe, it, expect } from 'vitest';
import { generateLand, miles } from '../src/adventure/overland.js';
import { startAdventure, enterScene, enterNode, choose } from '../src/adventure/runtime.js';
import { newCampaign, LEVEL_XP } from '../src/campaign/campaign.js';
import { encounterFor } from '../src/data/encounters.js';
import type { ExploreMap, Module } from '../src/adventure/types.js';

const TIER: Record<string, number> = { kobolds: 1, goblins: 1, bandits: 2, lizardfolk: 2, gnolls: 3, cult: 3, 'hag-court': 4, 'fire-court': 5 };
const mapOf = (m: Module) => (m.scenes.land as { map: ExploreMap }).map;
const campsOf = (m: Module) => mapOf(m).nodes.filter((n) => n.id.startsWith('camp-'));

describe('a county\'s camps', () => {
  it('are bands for the county\'s levels, the stronger farther from the city', () => {
    for (const level of [1, 3]) {
      const top = Math.min(5, level + (level <= 2 ? 2 : 1));
      const near: number[] = [], far: number[] = [];
      for (let seed = 1; seed <= 8; seed++) {
        const m = generateLand(seed, { level }).module;
        const map = mapOf(m);
        const city = map.nodes.find((n) => n.id.startsWith('city-'))!;
        for (const c of campsOf(m)) {
          const tier = TIER[c.id.replace(/^camp-/, '')]!;
          expect(tier, `${c.id} at levels ${level}–${top}`).toBeGreaterThanOrEqual(level - 1);
          expect(tier).toBeLessThanOrEqual(top + 1);
          (miles([c.x, c.y], [city.x, city.y]) < 10 ? near : far).push(tier);
        }
      }
      const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
      expect(near.length && far.length).toBeTruthy();
      expect(mean(far), `level ${level}`).toBeGreaterThan(mean(near));
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

describe('a county for a band of levels', () => {
  it('runs from its level to two more at levels 1–2, one more after', () => {
    expect(generateLand(1, { level: 1 }).module.levelBand).toEqual({ from: 1, to: 3 });
    expect(generateLand(1, { level: 3 }).module.levelBand).toEqual({ from: 3, to: 4 });
    expect(generateLand(1, { level: 2, top: 2 }).module.levelBand).toEqual({ from: 2, to: 2 });
  });

  it('puts its harder delves farther out', () => {
    let rising = 0, n = 0;
    for (let seed = 1; seed <= 8; seed++) {
      const m = generateLand(seed, { level: 1 }).module;
      const map = mapOf(m);
      const city = map.nodes.find((x) => x.id.startsWith('city-'))!;
      const ds = Object.entries(m.delves ?? {}).map(([id, d]) => {
        const node = map.nodes.find((x) => x.id === id)!;
        return { far: miles([node.x, node.y], [city.x, city.y]), level: d.spec.level! };
      }).sort((a, b) => a.far - b.far);
      for (const d of ds) { expect(d.level).toBeGreaterThanOrEqual(1); expect(d.level).toBeLessThanOrEqual(3); }
      if (ds.length === 2) { n++; if (ds[1]!.level >= ds[0]!.level) rising++; }
    }
    expect(rising).toBe(n);
  });

  it('keeps its road fights up with the party as it grows', () => {
    const m = generateLand(5, { level: 1 }).module;
    const map = mapOf(m);
    const leg = map.legs![0]!;
    expect(leg.byLevel?.map((b) => b.from)).toEqual([1, 2, 3]);
    // Walked at level 1 and at level 3, a sure fight: each meets its own.
    const fightAt = (level: number) => {
      leg.chance = 1;
      const c = newCampaign(2); c.xp = LEVEL_XP[level - 1]!;
      const s = startAdventure(c, m);
      enterScene(s, m, m.start); enterScene(s, m, 'land');
      s.exploredNodes.push(...map.nodes.map((x) => x.id));
      (s.mapAt ??= {}).land = leg.between[0];
      enterNode(s, m, leg.between[1]);
      return s.sceneId;
    };
    expect(fightAt(1)).toMatch(/^road-\w+-1-/);
    expect(fightAt(3)).toMatch(/^road-\w+-3-/);
  });
});

import { expandModule } from '../src/adventure/embed.js';

describe('going to the city to upgrade, and being warned off', () => {
  const m = generateLand(6, { level: 1 }).module;
  const map = mapOf(m);

  it('stocks the city for the top of the band, the towns and villages for its start', () => {
    for (const [id, t] of Object.entries(m.towns!)) {
      if (t.spec.size === 'city') expect(t.spec.stock, id).toBe(3);
      else expect(t.spec.stock, id).toBeUndefined();
    }
  });

  it('marks every camp and delve with the level it is built for', () => {
    for (const n of map.nodes) {
      if (n.id.startsWith('camp-')) expect(n.danger).toBe(TIER[n.id.replace(/^camp-/, '')]);
      if (m.delves?.[n.id]) expect(n.danger).toBe(m.delves[n.id]!.spec.level);
    }
    expect(map.nodes.some((n) => (n.danger ?? 0) > 1)).toBe(true);
  });

  it('has the innkeepers warn of what is beyond the party, by name', () => {
    const dangerous = map.nodes.filter((n) => (n.danger ?? 0) > 1).map((n) => n.label);
    const live = expandModule(m, { seed: 1, flags: [] });
    const said = JSON.stringify(Object.values(live.scenes).filter((s) => /\/inn-talk$/.test(s.id)));
    expect(dangerous.some((label) => said.includes(`Keep clear of ${label}`))).toBe(true);
  });
});
