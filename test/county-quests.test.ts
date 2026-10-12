/**
 * A county's quests, written from a line each: defeat, fetch and scout, each
 * with more than one way through, and objects with names worth the walk.
 */
import { describe, it, expect } from 'vitest';
import { generateLand, checkLandSpec, type LandSpec } from '../src/adventure/overland.js';
import { expandModule } from '../src/adventure/embed.js';
import { startAdventure, enterScene, choose, legalChoices } from '../src/adventure/runtime.js';
import { newCampaign } from '../src/campaign/campaign.js';
import { questObjectName, theObject } from '../src/adventure/quest-objects.js';
import type { Module } from '../src/adventure/types.js';

const SPEC: LandSpec = { level: 2, camps: 1, places: [
  { id: 'reavers', label: 'Reaver Camp', kind: 'camp', faction: 'bandits' },
  { id: 'barrow', label: 'The Old Barrow', kind: 'delve' },
  { id: 'ashford', label: 'Ashford', kind: 'town' },
], quests: [
  { id: 'clear', kind: 'defeat', target: 'reavers' },
  { id: 'relic', kind: 'fetch', target: 'barrow', giver: 'ashford', object: 'Silver Chalice of Ashford' },
  { id: 'look', kind: 'scout', visit: ['reavers', 'barrow'] },
] };
const m = generateLand(3, SPEC).module;
const live = expandModule(m, { seed: 1, flags: [] });
const cityId = Object.keys(m.towns!).find((id) => m.towns![id]!.spec.size === 'city')!;
const story = (id: string) => { const s = live.scenes[id]; if (s?.kind !== 'story' && s?.kind !== 'dialogue') throw new Error(id); return s; };

describe('a county\'s quests', () => {
  it('are given at the innkeepers\' bars', () => {
    expect(story(`${cityId}/inn`).next.map((c) => c.id)).toEqual(expect.arrayContaining(['ask-clear', 'report-clear', 'ask-look']));
    expect(story('ashford/inn').next.map((c) => c.id)).toEqual(expect.arrayContaining(['ask-relic', 'report-relic']));
  });

  it('let a camp be cowed into leaving as well as beaten', () => {
    const camp = Object.keys(live.scenes).filter((id) => /^reavers(-prey|-cowed)?$/.test(id));
    for (const id of camp) {
      const cow = story(id).next.find((c) => c.id === 'quest-clear-cow');
      expect(cow?.check?.skill, id).toBe('intimidation');
      expect(cow?.effects).toEqual([{ kind: 'setFlag', flag: 'won-reavers' }]);
    }
  });

  it('put the object in the hoard, and up for sale with the fence', () => {
    expect(m.delves!.barrow!.onWin.effects).toEqual(expect.arrayContaining([{ kind: 'setFlag', flag: 'has-relic' }]));
    expect(story(`${cityId}/thieves-guild`).next.some((c) => c.id === 'quest-relic-fence')).toBe(true);
    expect(m.quests!.relic!.objects).toEqual({ 'has-relic': 'the Silver Chalice of Ashford' });
  });

  it('can be done the other way: bought from the fence and handed in', () => {
    const c = newCampaign(4); c.gold = 500;
    const s = startAdventure(c, live);
    enterScene(s, live, 'ashford/inn');
    choose(s, live, 'ask-relic'); choose(s, live, 'accept');
    enterScene(s, live, `${cityId}/thieves-guild`);
    choose(s, live, 'quest-relic-fence');
    expect(s.flags['has-relic']).toBe(true);
    enterScene(s, live, 'ashford/inn');
    const gold = s.campaign.gold;
    choose(s, live, 'report-relic');
    expect(s.campaign.gold).toBeGreaterThan(gold);
    expect(s.flags['has-relic']).toBeFalsy();
  });

  it('send a scout to see each place, in whatever state it is found', () => {
    for (const id of ['reavers', 'reavers-prey', 'reavers-cowed', 'reavers-quiet', 'barrow']) {
      if (!live.scenes[id]) continue;
      expect(story(id).next.some((c) => c.id === 'quest-look-note'), id).toBe(true);
    }
    expect(m.quests!.look!.stages.map((st) => st.text)).toEqual(['See Reaver Camp', 'See The Old Barrow']);
  });

  it('turns away a quest it cannot write, saying why', () => {
    const bad: [LandSpec, RegExp][] = [
      [{ quests: [{ id: 'x', kind: 'defeat', target: 'nowhere' }] }, /not one of the county's camps or delves/],
      [{ quests: [{ id: 'x', kind: 'scout' }] }, /needs places to visit/],
      [{ places: [{ id: 'c', label: 'C', kind: 'camp' }], quests: [{ id: 'x', kind: 'fetch', target: 'c', giver: 'c' }] }, /giver 'c' is not the city/],
    ];
    for (const [spec, why] of bad) expect(() => checkLandSpec(spec)).toThrow(why);
  });
});

describe('quest objects', () => {
  it('have names long enough to say what they are, and short enough to show', () => {
    let a = 11; const rng = () => { a = (a * 1103515245 + 12345) % 2147483648; return a / 2147483648; };
    const names = Array.from({ length: 200 }, () => questObjectName(rng, 'gaelic'));
    for (const n of names) {
      expect(n.length).toBeLessThanOrEqual(40);
      expect(n.split(' ').length).toBeGreaterThanOrEqual(3);
      expect(n).not.toMatch(/Seven [A-Z][a-z]+[^s]$/);
    }
    expect(new Set(names).size).toBeGreaterThan(150);
    expect(theObject('Tome of Silent Winters')).toBe('the Tome of Silent Winters');
    expect(theObject("Aldric's Silver Chalice")).toBe("Aldric's Silver Chalice");
  });
});
void legalChoices; void ({} as Module);

describe('rescue, arrest and delivery', () => {
  const spec: LandSpec = { level: 2, camps: 0, delves: 1, places: [
    { id: 'reavers', label: 'Reaver Camp', kind: 'camp', faction: 'bandits', hostile: false },
    { id: 'barrow', label: 'The Old Barrow', kind: 'delve' },
    { id: 'ashford', label: 'Ashford', kind: 'town' },
  ], quests: [
    { id: 'mara', kind: 'rescue', target: 'reavers', person: 'Mara Vell' },
    { id: 'tom', kind: 'arrest', target: 'barrow', person: 'Black Tom' },
    { id: 'post', kind: 'deliver', to: 'ashford' },
  ] };
  const land = generateLand(5, spec).module;
  const run = expandModule(land, { seed: 2, flags: [] });
  const city = Object.keys(land.towns!).find((id) => land.towns![id]!.spec.size === 'city')!;
  const sc = (id: string) => { const s = run.scenes[id]; if (s?.kind !== 'story' && s?.kind !== 'dialogue') throw new Error(id); return s; };

  it('rescues by the sword, by coin, or by stealth', () => {
    expect(land.quests!.mara!.objects).toEqual({ 'with-mara': 'Mara Vell' });
    const ways = sc('reavers').next.map((c) => c.id);
    expect(ways).toEqual(expect.arrayContaining(['quest-mara-ransom', 'quest-mara-sneak', 'fight']));
    expect(sc('reavers').next.find((c) => c.id === 'quest-mara-sneak')?.check).toMatchObject({ skill: 'stealth', failTo: 'reavers-fight' });
    const fight = run.scenes['reavers-fight'];
    expect(fight?.kind === 'battle' && fight.onWin.effects).toEqual(expect.arrayContaining([{ kind: 'setFlag', flag: 'with-mara' }]));
  });

  it('pays a ransom and brings them home', () => {
    const c = newCampaign(6); c.gold = 500;
    const s = startAdventure(c, run);
    enterScene(s, run, `${city}/inn`);
    choose(s, run, 'ask-mara'); choose(s, run, 'accept');
    enterScene(s, run, 'reavers');
    choose(s, run, 'quest-mara-ransom');
    expect(s.flags['with-mara']).toBe(true);
    enterScene(s, run, `${city}/inn`);
    choose(s, run, 'report-mara');
    expect(s.flags['quest-mara-done']).toBe(true);
    expect(s.flags['with-mara']).toBeFalsy();
  });

  it('arrests whoever holds a delve by winning it', () => {
    expect(land.delves!.barrow!.onWin.effects).toEqual(expect.arrayContaining([{ kind: 'setFlag', flag: 'prisoner-tom' }]));
    expect(land.quests!.tom!.objects).toEqual({ 'prisoner-tom': 'Black Tom, in chains' });
  });

  it('carries a parcel there and back, and it cannot be had any other way', () => {
    const c = newCampaign(7);
    const s = startAdventure(c, run);
    enterScene(s, run, `${city}/inn`);
    choose(s, run, 'ask-post'); choose(s, run, 'accept');
    expect(s.flags['has-post']).toBe(true);              // handed over on taking it
    enterScene(s, run, 'ashford/inn');
    choose(s, run, 'quest-post-hand');
    expect(s.flags['has-post']).toBeFalsy();
    enterScene(s, run, `${city}/inn`);
    expect(legalChoices(s, run).some((x) => x.choice.id === 'report-post' && !x.blocked)).toBe(true);
  });

  it('refuses a delivery to nowhere, or back where it came from', () => {
    expect(() => checkLandSpec({ quests: [{ id: 'x', kind: 'deliver', to: 'nowhere' }] })).toThrow(/not the city or one of/);
    expect(() => checkLandSpec({ quests: [{ id: 'x', kind: 'deliver', to: 'city' }] })).toThrow(/to where it was given/);
  });
});
