/**
 * Trouble on the road: legs that roll as you walk them, rarer after each
 * fight, worse at night; camps by the ground slept on; and a map that
 * remembers where the party stood on it, however many towns it went into.
 */
import { describe, it, expect } from 'vitest';
import { startAdventure, enterScene, enterNode, exploreNodes, resolveBattle, restOptions, currentScene } from '../src/adventure/runtime.js';
import { newCampaign } from '../src/campaign/campaign.js';
import { generateLand } from '../src/adventure/overland.js';
import { generateCity } from '../src/adventure/city-gen.js';
import { NIGHT, type ExploreMap, type Module } from '../src/adventure/types.js';

function road(chance: number): Module {
  return {
    id: 'road-test', title: 'Road', blurb: 'b', start: 'map',
    scenes: {
      map: { id: 'map', kind: 'explore', map: {
        title: 'Road', art: { emoji: '🗺️' }, entry: ['a'], paths: [['a', 'b']],
        legs: [{ between: ['a', 'b'], chance, battles: ['ambush'] }],
        nodes: [
          { id: 'a', label: 'A', icon: 'x', scene: 'a', x: 20, y: 20 },
          { id: 'b', label: 'B', icon: 'x', scene: 'town', x: 60, y: 60, camp: { risky: { chance: 0.3, battleScene: 'ambush' } } },
        ] } },
      a: { id: 'a', kind: 'story', text: ['A.'], next: [{ id: 'back', label: 'Back', to: 'map' }] },
      town: { id: 'town', kind: 'explore', map: { title: 'Town', art: { emoji: '🏘️' }, entry: ['t'],
        nodes: [{ id: 't', label: 'T', icon: 'x', scene: 'map', x: 50, y: 50 }] } },
      ambush: { id: 'ambush', kind: 'battle', encounterId: 'goblin-ambush', mapId: 'open', onWin: { to: 'map' } },
      end: { id: 'end', kind: 'ending', outcome: 'victory', text: ['Done.'] },
    },
  };
}
const walk = (seed: number, m: Module) => {
  const s = startAdventure(newCampaign(seed), m);
  enterScene(s, m, 'map'); enterNode(s, m, 'a'); enterScene(s, m, 'map');   // standing at A
  return s;
};
const here = (s: ReturnType<typeof walk>, m: Module) => exploreNodes(s, m).find((n) => n.here)?.node.id;

describe('a leg of road', () => {
  it('may be fought over on the way, and the party arrives once it is won', () => {
    const m = road(1);
    const s = walk(1, m);
    enterNode(s, m, 'b');
    expect(s.sceneId).toBe('ambush');
    expect(s.legFights).toEqual({ 'a|b': 1 });
    resolveBattle(s, m, true);
    expect(s.sceneId).toBe('map');
    expect(here(s, m)).toBe('b');
  });

  it('is never fought over at no chance, nor standing still', () => {
    const m = road(0);
    const s = walk(2, m);
    for (let i = 0; i < 20; i++) { enterNode(s, m, i % 2 ? 'a' : 'b'); enterScene(s, m, 'map'); }
    expect(s.legFights).toBeUndefined();
  });

  it('grows quiet once fought over, and worse at night', () => {
    const rate = (met: number, night: boolean) => {
      let hits = 0;
      for (let seed = 1; seed <= 300; seed++) {
        const m = road(0.6);
        const s = walk(seed, m);
        if (met) s.legFights = { 'a|b': met };
        if (night) s.flags[NIGHT] = true;
        enterNode(s, m, 'b');
        if (s.sceneId === 'ambush') hits++;
      }
      return hits / 300;
    };
    const fresh = rate(0, false), after = rate(2, false), dark = rate(0, true);
    expect(fresh).toBeGreaterThan(0.45); expect(fresh).toBeLessThan(0.75);
    expect(after).toBeLessThan(fresh / 2);
    expect(dark).toBeGreaterThan(fresh);
  });
});

describe('a map', () => {
  it('remembers where the party stood on it, after a town with a map of its own', () => {
    const m = road(0);
    const s = walk(3, m);
    enterNode(s, m, 'b');                          // into the town's own map
    expect(s.sceneId).toBe('town');
    enterNode(s, m, 't');                          // and back out
    expect(s.sceneId).toBe('map');
    expect(here(s, m)).toBe('b');                  // not the road's start
  });

  it('sleeps by the ground the party stands on', () => {
    const m = road(0);
    const s = walk(4, m);
    expect(restOptions(s, m).long.ok).toBe(false);  // the map has no camp of its own
    enterNode(s, m, 'b'); enterNode(s, m, 't');
    expect(restOptions(s, m).long).toMatchObject({ ok: true, chance: 0.3 });
  });
});

describe('a county\'s roads', () => {
  const m = generateLand(4).module;
  const map = (m.scenes.land as { map: ExploreMap }).map;

  it('roll on every leg, for a fight on that ground', () => {
    expect(map.legs).toHaveLength(map.paths!.length);
    for (const l of map.legs!) {
      expect(l.chance).toBeGreaterThan(0); expect(l.chance).toBeLessThan(0.35);
      for (const b of l.battles) expect(m.scenes[b]?.kind).toBe('battle');
    }
  });

  it('make a town a safe night, and the wild a risky one', () => {
    for (const n of map.nodes) {
      if (/^(city|town|village)-/.test(n.id)) expect(n.camp).toEqual({});
      else expect(n.camp?.risky?.chance).toBeGreaterThan(0);
    }
    expect(m.defeatScene).toBe('beaten');
  });
});

describe('a town\'s streets', () => {
  it('turn worse after dark', () => {
    const m = generateCity(3, { size: 'town' }).module;
    const nodes = (m.scenes.city as { map: ExploreMap }).map.nodes.filter((n) => n.wandering);
    expect(nodes.length).toBeGreaterThan(0);
    for (const n of nodes) expect(n.wandering!.night).toBeGreaterThan(n.wandering!.chance);
  });
});
void currentScene;

import { campRest, MORNING } from '../src/adventure/runtime.js';
import { miles } from '../src/adventure/overland.js';

describe('the day on the road', () => {
  const timed = (hours: number) => { const m = road(0); (m.scenes.map as { map: ExploreMap }).map.legs![0]!.hours = hours; return m; };

  it('wears on as the party walks, and night falls on the road', () => {
    const m = timed(5);
    const s = walk(5, m);
    enterNode(s, m, 'b'); enterNode(s, m, 't');       // there: 1 pm
    expect(s.hour).toBe(MORNING + 5);
    expect(s.flags[NIGHT]).toBeFalsy();
    enterNode(s, m, 'a'); enterScene(s, m, 'map');      // back: 6 pm
    enterNode(s, m, 'b');                               // and out again: 11 pm
    expect(s.hour).toBe(MORNING + 15);
    expect(s.flags[NIGHT]).toBe(true);
  });

  it('turns to morning after a night on the road, or a night\'s sleep', () => {
    const m = timed(12);
    const s = walk(6, m);
    enterNode(s, m, 'b'); enterNode(s, m, 't');         // 8 pm: night
    expect(s.flags[NIGHT]).toBe(true);
    campRest(s, m, 'long');                             // a safe-ish sleep at B (may be broken up)
    if (s.sceneId === 'map') { expect(s.hour).toBe(MORNING); expect(s.flags[NIGHT]).toBeFalsy(); }
    const t = walk(7, m);
    enterNode(t, m, 'b'); enterNode(t, m, 't'); enterNode(t, m, 'a'); enterScene(t, m, 'map');
    expect(t.hour).toBe(MORNING);                       // walked through the night
    expect(t.flags[NIGHT]).toBeFalsy();
  });

  it('takes a county\'s legs at a walking pace', () => {
    const m = generateLand(4).module;
    const map = (m.scenes.land as { map: ExploreMap }).map;
    for (const l of map.legs!) {
      const [a, b] = l.between.map((id) => { const n = map.nodes.find((x) => x.id === id)!; return [n.x, n.y] as [number, number]; });
      const d = miles(a!, b!);
      expect(l.hours!).toBeGreaterThanOrEqual(Math.max(0.5, Math.floor(d / 3)));
      expect(l.hours!).toBeLessThanOrEqual(Math.max(1, d * 1.2));
    }
  });
});
