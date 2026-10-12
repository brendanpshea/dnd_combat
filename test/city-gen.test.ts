/**
 * Generated towns: places, wares, people, and the road out.
 */
import { describe, it, expect } from 'vitest';
import { generateCity, cityFromId, checkCitySpec, apart, CITY_SIZES, MAX_PLACES } from '../src/adventure/city-gen.js';
import { validateModule } from '../src/adventure/validate.js';
import { runModule } from '../src/adventure/runner.js';
import { newCampaign, SHOP_STOCK, isPermanentMagic } from '../src/campaign/campaign.js';
import { classScrollPool } from '../src/data/classes.js';
import { ARMOR } from '../src/data/armor.js';
import { WEAPONS } from '../src/data/weapons.js';
import { ITEMS } from '../src/data/items.js';
import type { ExploreMap, Module, Scene } from '../src/adventure/types.js';

/** Every map a town has: one, or a city's map of quarters and each quarter's. */
const mapsOf = (m: Module): ExploreMap[] => Object.values(m.scenes).flatMap((s) => (s.kind === 'explore' ? [s.map] : []));
/** The town's places, wherever they stand: every marker but the ways between maps. */
const mapOf = (m: Module): ExploreMap => {
  const maps = mapsOf(m);
  if (!maps.length) throw new Error('no city map');
  return { ...maps[0]!, nodes: maps.flatMap((x) => x.nodes).filter((n) => !/^(way|to|short)-/.test(n.id)) };
};
type Shop = Extract<Scene, { kind: 'shop' }>;
const shop = (m: Module, id: string): Shop => {
  const s = m.scenes[id];
  if (s?.kind !== 'shop') throw new Error(`no shop '${id}'`);
  return s;
};

describe('a generated town', () => {
  it('passes every proof, at every size and level, without leaning on rerolls', () => {
    let rerolls = 0, n = 0;
    for (const size of CITY_SIZES) for (let seed = 1; seed <= 25; seed++) {
      const r = generateCity(seed, { size, level: 1 + (seed % 5) });
      expect(validateModule(r.module), `${size} seed ${seed}`).toEqual([]);
      rerolls += r.rerolls; n++;
    }
    expect(rerolls / n).toBeLessThan(0.2);
  });

  it('grows with its size, and never past what a phone map can hold', () => {
    const count = (size: (typeof CITY_SIZES)[number]) => Array.from({ length: 20 }, (_, i) => mapOf(generateCity(i + 1, { size }).module).nodes.length);
    const [v, t, c] = CITY_SIZES.map(count);
    expect(Math.max(...v!)).toBeLessThan(Math.min(...c!));
    expect(Math.min(...t!)).toBeGreaterThan(Math.max(...v!) - 1);
    for (const n of [...v!, ...t!]) expect(n).toBeLessThanOrEqual(MAX_PLACES);
    // A city has room on each quarter's map, not one screen for the lot.
    for (let i = 1; i <= 20; i++) for (const map of mapsOf(generateCity(i, { size: 'city' }).module)) expect(map.nodes.length).toBeLessThanOrEqual(MAX_PLACES);
  });

  it('builds the venues a spec asks for, even in a village', () => {
    const m = generateCity(4, { size: 'village', venues: ['mage-guild', 'thieves-guild'] }).module;
    const ids = mapOf(m).nodes.map((n) => n.id);
    expect(ids).toContain('mage-guild');
    expect(ids).toContain('thieves-guild');
  });

  it('lays its markers out on the map, apart, and joined by roads', () => {
    for (const size of CITY_SIZES) for (let seed = 1; seed <= 20; seed++) for (const map of mapsOf(generateCity(seed, { size }).module)) {
      for (const n of map.nodes) {
        expect(n.x).toBeGreaterThanOrEqual(14); expect(n.x).toBeLessThanOrEqual(86);
        expect(n.y).toBeGreaterThanOrEqual(16); expect(n.y).toBeLessThanOrEqual(82);
      }
      for (const a of map.nodes) for (const b of map.nodes) {
        if (a !== b) expect(apart(a, b), `${size} seed ${seed}: ${a.id} on ${b.id}`).toBe(true);
      }
      // Labels short enough to stay on two lines of a phone map (a three-line
      // label runs into the marker below it).
      for (const n of map.nodes) expect(n.label.length, n.label).toBeLessThanOrEqual(20);
      // No two markers with the same name (two "Market Cross"es, once).
      expect(new Set(map.nodes.map((n) => n.label)).size, `${size} seed ${seed}`).toBe(map.nodes.length);
      // One town, not islands: every marker reachable along the roads. (A
      // city's map of quarters is all ways in, and its streets join them.)
      if (map.nodes.some((n) => n.id.startsWith('to-'))) continue;
      const seen = new Set([map.nodes[0]!.id]);
      for (let grew = true; grew;) {
        grew = false;
        for (const [a, b] of map.roads ?? []) {
          if (seen.has(a) !== seen.has(b)) { seen.add(a); seen.add(b); grew = true; }
        }
      }
      expect(seen.size, `${size} seed ${seed}`).toBe(map.nodes.length);
    }
  });
});

describe('what a town sells', () => {
  const m = generateCity(3, { size: 'city', level: 3 }).module;
  const spellOf = (id: string) => { const t = ITEMS[id]?.targeting; return t && 'spellId' in t ? t.spellId : undefined; };

  it('never permanent magic: that is earned, not bought', () => {
    for (const s of Object.values(m.scenes)) {
      if (s.kind === 'shop') for (const id of s.stock ?? []) expect(isPermanentMagic(id), `${s.id}: ${id}`).toBe(false);
    }
  });

  it('keeps each trade to its own goods', () => {
    expect(shop(m, 'armorer').stock!.every((id) => ARMOR[id])).toBe(true);
    expect(shop(m, 'weaponsmith').stock!.every((id) => WEAPONS[id])).toBe(true);
    const divine = new Set([...classScrollPool('cleric'), ...classScrollPool('paladin')]);
    for (const id of shop(m, 'temple-wares').stock!) {
      expect(id.includes('healing') || divine.has(spellOf(id)!), id).toBe(true);
    }
    // The guild sells scrolls (the bug this pins: matching scroll ids against
    // SPELL ids, and stocking no scrolls at all).
    expect(shop(m, 'mage-guild').stock!.filter((id) => id.startsWith('scroll-')).length).toBeGreaterThan(30);
  });

  it('a city has every ware the game sells somewhere in it', () => {
    const sold = new Set(Object.values(m.scenes).flatMap((s) => (s.kind === 'shop' ? s.stock ?? [] : [])));
    expect(SHOP_STOCK.filter((id) => !sold.has(id))).toEqual([]);
  });

  it('hides the guild behind a door you have to notice', () => {
    expect(mapOf(m).nodes.find((n) => n.id === 'thieves-guild')?.hidden?.dc).toBeGreaterThan(10);
  });
});

describe('a town\'s services', () => {
  it('rents a room for a long rest, for coin', () => {
    const m = generateCity(2, { size: 'town' }).module;
    const inn = m.scenes.inn;
    if (inn?.kind !== 'dialogue') throw new Error('no inn');
    const room = inn.next.find((c) => c.id === 'room')!;
    expect(room.requires).toEqual([{ kind: 'gold', atLeast: 2 }]);
    expect(room.effects).toEqual([{ kind: 'gold', amount: -2 }]);
    expect(m.scenes[room.to]).toMatchObject({ kind: 'rest', variant: 'long' });
  });

  it('heals at the temple, at a price that rises with the party', () => {
    for (const level of [1, 4]) {
      const t = generateCity(2, { level }).module.scenes.temple;
      if (t?.kind !== 'dialogue') throw new Error('no temple');
      const heal = t.next.find((c) => c.id === 'heal')!;
      expect(heal.effects).toEqual([{ kind: 'gold', amount: -10 * level }, { kind: 'heal', amount: 'full' }]);
    }
  });

  it('can be walked through and left', () => {
    let n = 7;
    const r = runModule(newCampaign(7), generateCity(7, { size: 'city' }).module, {
      pick: (count) => { n = (n * 1103515245 + 12345) % 2147483648; return Math.floor((n / 2147483648) * count); },
      battle: () => true,
    }, 5000);
    expect(r.ending).toBe('victory');
  });
});

describe('a town\'s id', () => {
  it('rebuilds the same town, and saves in the delve slot, not a company\'s', async () => {
    const { module } = generateCity(11, { size: 'village', level: 2 });
    expect(module.id).toMatch(/^city-11-/);
    expect(cityFromId(module.id)).toEqual(module);
    expect(generateCity(12, { size: 'village', level: 2 }).module).not.toEqual(module);
    const { slotFor, DELVE_SLOT } = await import('../web/src/adventureStorage.js');
    expect(slotFor(module.id)).toBe(DELVE_SLOT);
  });

  it('refuses a spec that cannot be built', () => {
    expect(() => checkCitySpec({ size: 'metropolis' as never })).toThrow(/no size/);
    expect(() => checkCitySpec({ level: 0 })).toThrow(/level/);
    expect(() => checkCitySpec({ venues: ['casino' as never] })).toThrow(/no venue/);
  });
});
