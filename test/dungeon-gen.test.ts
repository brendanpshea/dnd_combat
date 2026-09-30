/**
 * Generated delves: every seed gives a dungeon that passes every proof, is
 * the same every time, and plays through to its end.
 */
import { describe, it, expect } from 'vitest';
import { generateDelve, DELVE_THEMES } from '../src/adventure/dungeon-gen.js';
import { validateModule } from '../src/adventure/validate.js';
import { checkDungeon, goalCost, layoutDungeon } from '../src/adventure/dungeon.js';
import { runModule } from '../src/adventure/runner.js';
import { newCampaign } from '../src/campaign/campaign.js';
import type { Dungeon, Module } from '../src/adventure/types.js';

const delveOf = (m: Module): Dungeon => {
  const s = m.scenes.delve;
  if (s?.kind !== 'dungeon') throw new Error('no delve');
  return s.dungeon;
};

describe('generated delves', () => {
  it('pass every proof, across 240 seeds, every theme and size', () => {
    for (let seed = 1; seed <= 240; seed++) {
      const { module } = generateDelve(seed, {
        theme: DELVE_THEMES[seed % DELVE_THEMES.length]!,
        size: (['small', 'medium', 'large'] as const)[seed % 3]!,
        level: 1 + (seed % 4),
      });
      expect(validateModule(module), `seed ${seed}`).toEqual([]);
      expect(layoutDungeon(delveOf(module)).faults, `seed ${seed}`).toEqual([]);
    }
  });

  it('are the same for the same seed', () => {
    for (const seed of [3, 77, 501]) expect(generateDelve(seed)).toEqual(generateDelve(seed));
    expect(generateDelve(3).module).not.toEqual(generateDelve(4).module);
  });

  it('put the lock on the only way to the goal, with its key before it', () => {
    for (let seed = 1; seed <= 80; seed++) {
      const { module } = generateDelve(seed);
      const d = delveOf(module);
      const goal = d.rooms.find((r) => r.goal)!.id;
      // Take the key out of the dungeon: the goal must become unreachable.
      const keyless: Module = JSON.parse(JSON.stringify(module).replaceAll('"flag":"delve-key"', '"flag":"no-key"')) as Module;
      const locked = keyless.scenes.delve;
      if (locked?.kind !== 'dungeon') throw new Error();
      locked.dungeon.links = locked.dungeon.links.map((l) =>
        l.door?.locked ? { ...l, door: { ...l.door, locked: [{ kind: 'flag', flag: 'delve-key' }] } } : l);
      expect(goalCost(keyless, locked.dungeon, goal), `seed ${seed}`).toBeUndefined();
      expect(checkDungeon(module, 'delve', d)).toEqual([]);
    }
  });

  it('light a torch that lasts the proven route, with some to spare', () => {
    for (let seed = 1; seed <= 80; seed++) {
      const { module } = generateDelve(seed);
      const d = delveOf(module);
      const cost = goalCost(module, d, d.rooms.find((r) => r.goal)!.id)!;
      expect(d.torch!.length).toBeGreaterThanOrEqual(cost + 4);
    }
  });

  it('play through to victory with a party that never gives up', () => {
    for (let seed = 1; seed <= 60; seed++) {
      const { module } = generateDelve(seed, { level: 1 + (seed % 3) });
      let n = seed;
      const r = runModule(newCampaign(seed), module, {
        // Wander at random, but always go back in.
        pick: (count, tag) => {
          if (tag === 'choice:outside') return 0;
          n = (n * 1103515245 + 12345) % 2147483648;
          return Math.floor((n / 2147483648) * count);
        },
        battle: () => true,
      }, 8000);
      expect(r.ending, `seed ${seed}`).toBe('victory');
    }
  });
});
