/**
 * A town's ground: laid first, and the markers placed on it — off the
 * water, along the streets, a wall round anything bigger than a village.
 */
import { describe, it, expect } from 'vitest';
import { generateCity, CITY_SIZES } from '../src/adventure/city-gen.js';
import { toLine, nearestOn } from '../src/adventure/town-map.js';
import type { ExploreMap } from '../src/adventure/types.js';

const mapOf = (seed: number, size: (typeof CITY_SIZES)[number]) => {
  const s = generateCity(seed, { size }).module.scenes.city;
  if (s?.kind !== 'explore') throw new Error('no map');
  return s.map as ExploreMap & { ground: NonNullable<ExploreMap['ground']> };
};

describe('a town\'s ground', () => {
  it('has streets, and a wall only once it is more than a village', () => {
    for (let seed = 1; seed <= 20; seed++) for (const size of CITY_SIZES) {
      const g = mapOf(seed, size).ground;
      expect(g.streets.length).toBeGreaterThan(0);
      expect(!!g.wall).toBe(size !== 'village');
    }
  });

  it('keeps every marker out of the water', () => {
    const seen = new Set<string>();
    for (let seed = 1; seed <= 40; seed++) for (const size of CITY_SIZES) {
      const { ground: g, nodes } = mapOf(seed, size);
      seen.add(g.feature);
      for (const n of nodes) {
        if (g.water?.kind === 'river') expect(toLine([n.x, n.y], g.water.points), `${seed} ${n.id}`).toBeGreaterThanOrEqual(7);
        if (g.water?.kind === 'coast') {
          const shore = nearestOn([n.x, n.y], [g.water.points]).at[0];
          expect(g.water.side === 'left' ? n.x > shore : n.x < shore).toBe(true);
        }
      }
    }
    expect([...seen].sort()).toEqual(['coast', 'crossroads', 'river']);
  });

  it('puts every door on a street, or a lane to one', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const { ground: g, nodes } = mapOf(seed, 'city');
      for (const n of nodes) expect(nearestOn([n.x, n.y], g.streets).d, `${seed} ${n.id}`).toBeLessThanOrEqual(2.5);
    }
  });

  it('puts the gate on the road in', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const { ground: g, nodes } = mapOf(seed, 'town');
      const gate = nodes.find((n) => n.id === 'gate')!;
      expect(toLine([gate.x, gate.y], g.streets[0]!)).toBeLessThan(14);
    }
  });
});

describe('a city\'s quarters', () => {
  const m = generateCity(7, { size: 'city', level: 3 }).module;
  const explore = (id: string) => { const s = m.scenes[id]; if (s?.kind !== 'explore') throw new Error(id); return s.map; };

  it('puts one marker per quarter on the city\'s own map, the way in at the gatehouse', () => {
    const top = explore('city');
    expect(top.nodes.filter((n) => n.id.startsWith('to-')).map((n) => n.scene).sort()).toEqual(['quarter-gatehouse', 'quarter-market', 'quarter-temple-quarter', 'quarter-warrens']);
    expect(top.entry).toEqual(['to-gatehouse']);
    expect(top.ground?.wall).toBeTruthy();
  });

  it('gives each quarter a street-level map with a way back up', () => {
    for (const q of ['market', 'temple-quarter', 'warrens', 'gatehouse']) {
      const map = explore(`quarter-${q}`);
      expect(map.nodes.find((n) => n.id === `way-${q}`)?.scene).toBe('city');
      expect(map.nodes.length).toBeGreaterThan(1);
    }
    expect(explore('quarter-gatehouse').nodes.some((n) => n.id === 'gate')).toBe(true);
  });

  it('sends every shop back out into its own quarter', () => {
    for (const [qid, s] of Object.entries(m.scenes)) {
      if (s.kind !== 'explore' || qid === 'city') continue;
      for (const n of s.map.nodes) {
        const scene = m.scenes[n.scene];
        if (scene?.kind === 'shop') expect(scene.next, n.id).toBe(qid);
      }
    }
  });

  it('keeps a village and a town on one map', () => {
    for (const size of ['village', 'town'] as const) {
      expect(Object.values(generateCity(3, { size }).module.scenes).filter((s) => s.kind === 'explore')).toHaveLength(1);
    }
  });
});

import { startAdventure, enterScene, enterNode, choose, exploreNodes } from '../src/adventure/runtime.js';
import { newCampaign } from '../src/campaign/campaign.js';
import { NIGHT, type Module } from '../src/adventure/types.js';

function walkIn(seed: number, m: Module) {
  const c = newCampaign(seed); c.gold = 500;
  const s = startAdventure(c, m);
  enterScene(s, m, m.start);
  choose(s, m, 'in');
  return s;
}
const shownHere = (s: ReturnType<typeof walkIn>, m: Module) => exploreNodes(s, m).map((n) => n.node.id);

describe('the city\'s own map', () => {
  it('keeps a shop off it until it is found, then one tap away', () => {
    const m = generateCity(7, { size: 'city', level: 3 }).module;
    const s = walkIn(7, m);
    expect(shownHere(s, m)).not.toContain('short-general');
    enterScene(s, m, 'general');
    enterScene(s, m, 'city');
    expect(shownHere(s, m)).toContain('short-general');
    enterNode(s, m, 'short-general');
    expect(s.sceneId).toBe('general');
  });

  it('shows a castle, and a harbour on the coast or a bridge on a river', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const m = generateCity(seed, { size: 'city' }).module;
      const top = m.scenes.city!.kind === 'explore' ? (m.scenes.city as { map: ExploreMap }).map : undefined;
      const ids = top!.nodes.map((n) => n.id);
      expect(ids).toContain('castle');
      if (top!.ground?.water?.kind === 'coast') expect(ids).toContain('harbour');
      if (top!.ground?.water?.kind === 'river') expect(ids).toContain('bridge');
    }
  });
});

describe('the gates at night', () => {
  it('are barred in a walled town until dawn, or a bribe', () => {
    for (const size of ['town', 'city'] as const) {
      const m = generateCity(5, { size, level: 2 }).module;
      const s = walkIn(5, m);
      s.flags[NIGHT] = 1;
      enterScene(s, m, size === 'city' ? 'quarter-gatehouse' : 'city');
      enterNode(s, m, 'gate');
      expect(s.sceneId).toBe('gate-shut');
      const gold = s.campaign.gold;
      choose(s, m, 'bribe');
      expect(gold - s.campaign.gold).toBe(10);
      expect(s.sceneId).toBe('gate');
    }
  });

  it('stand open in a village, which has none', () => {
    const m = generateCity(5, { size: 'village' }).module;
    const s = walkIn(5, m);
    s.flags[NIGHT] = 1;
    enterNode(s, m, 'gate');
    expect(s.sceneId).toBe('gate');
  });
});
