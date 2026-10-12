/**
 * Quests a county writes for itself: the lord's in the castle (best paid,
 * one with something permanent), bounties on the boards, the innkeepers'
 * errands — and a main quest earned by doing them.
 */
import { describe, it, expect } from 'vitest';
import { generateLand, checkLandSpec } from '../src/adventure/overland.js';
import { expandModule } from '../src/adventure/embed.js';
import { startAdventure, enterScene, legalChoices } from '../src/adventure/runtime.js';
import { newCampaign, isPermanentMagic } from '../src/campaign/campaign.js';
import type { Module } from '../src/adventure/types.js';

const cityOf = (m: Module) => Object.keys(m.towns!).find((id) => m.towns![id]!.spec.size === 'city')!;

describe('a county\'s own quests', () => {
  const counties = [1, 2, 3, 4].map((seed) => generateLand(seed, { level: 2 }).module);

  it('has a lord in the castle of its city', () => {
    for (const m of counties) {
      const lord = m.towns![cityOf(m)]!.spec.lord!;
      expect(lord).toMatch(/^(Count|Baron|Margrave|Countess|Baroness|Lady) [A-Z]/);
      const castle = expandModule(m, { seed: 1, flags: [] }).scenes[`${cityOf(m)}/castle`];
      expect(castle?.kind === 'dialogue' && castle.npc.name).toBe(lord);
    }
  });

  it('writes four, given where each kind belongs, and pays the lord\'s best', () => {
    for (const m of counties) {
      const qs = Object.values(m.quests ?? {});
      expect(qs).toHaveLength(4);
      for (const q of qs) {
        const at = q.giver.scene.split('/').pop();
        expect(['castle', 'notice-board', 'inn']).toContain(at);
        if (at === 'castle') expect(q.giver.name).toBe(m.towns![cityOf(m)]!.spec.lord);
      }
      const gold = (q: (typeof qs)[number]) => q.reward.find((e) => e.kind === 'gold')!;
      const lords = qs.filter((q) => q.giver.scene.endsWith('/castle'));
      const others = qs.filter((q) => !q.giver.scene.endsWith('/castle'));
      if (lords.length && others.length) expect(Math.max(...lords.map((q) => (gold(q) as { amount: number }).amount))).toBeGreaterThan(Math.min(...others.map((q) => (gold(q) as { amount: number }).amount)));
    }
  });

  it('rarely hands over something permanent: one of the lord\'s, at most', () => {
    for (const m of counties) {
      const items = Object.values(m.quests ?? {}).flatMap((q) => q.reward.filter((e) => e.kind === 'addItem'));
      expect(items.length).toBeLessThanOrEqual(1);
      for (const e of items) expect(e.kind === 'addItem' && isPermanentMagic(e.itemId)).toBe(true);
    }
    expect(counties.some((m) => Object.values(m.quests ?? {}).some((q) => q.reward.some((e) => e.kind === 'addItem')))).toBe(true);
  });

  it('never writes one about a place the author already has a quest on', () => {
    for (let seed = 1; seed <= 6; seed++) {
      const m = generateLand(seed, { level: 2, generated: 8, places: [{ id: 'barrow', label: 'The Barrow', kind: 'delve' }],
        quests: [{ id: 'mine', kind: 'defeat', target: 'barrow' }] }).module;
      const ids = Object.keys(m.quests!);
      expect(ids).not.toContain('g-barrow');
      expect(ids.length).toBeGreaterThan(1);
      for (const q of Object.values(m.quests!)) if (q.title !== m.quests!.mine!.title) expect(JSON.stringify(q.stages)).not.toContain('won-barrow');
    }
  });
});

describe('a main quest', () => {
  const m = generateLand(5, { level: 2, main: { title: 'The Count\'s Trust', needs: 2 } }).module;
  const live = expandModule(m, { seed: 1, flags: [] });

  it('is earned by the county\'s work: every side quest adds a favour', () => {
    expect(m.quests!.main!.stages[0]!.done).toEqual([{ kind: 'count', flag: 'favour', atLeast: 2 }]);
    for (const [id, q] of Object.entries(m.quests!)) {
      if (id !== 'main') expect(q.reward).toEqual(expect.arrayContaining([{ kind: 'addFlag', flag: 'favour', amount: 1 }]));
    }
  });

  it('can be reported once enough is done', () => {
    const s = startAdventure(newCampaign(1), live);
    s.flags['quest-main'] = true;
    s.flags.favour = 1;
    enterScene(s, live, `${cityOf(m)}/castle`);
    const can = () => legalChoices(s, live).some((c) => c.choice.id === 'report-main' && !c.blocked);
    expect(can()).toBe(false);
    s.flags.favour = 2;
    expect(can()).toBe(true);
  });

  it('cannot ask for more work than the county has', () => {
    expect(() => checkLandSpec({ generated: 1, main: { title: 'T', needs: 3 } })).toThrow(/needs 3 quests done, of 1/);
  });
});
