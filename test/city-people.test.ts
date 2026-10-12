/**
 * A generated town an author has a hand in: people placed, places written,
 * rumours that become leads, and trouble in the streets.
 */
import { describe, it, expect } from 'vitest';
import { generateCity, checkCitySpec, type CitySpec } from '../src/adventure/city-gen.js';
import { validateModule } from '../src/adventure/validate.js';
import { startAdventure, enterScene, choose, enterNode, currentScene, resolveBattle } from '../src/adventure/runtime.js';
import { newCampaign } from '../src/campaign/campaign.js';
import { encounterFor } from '../src/data/encounters.js';
import { FACTIONS } from '../src/data/factions.js';
import type { ExploreMap, Module, Scene } from '../src/adventure/types.js';

const SPEC: CitySpec = {
  size: 'town', level: 3,
  people: [
    { name: 'Mother Ilse', emoji: '🕯️', at: 'temple', lines: ['"The dead under the chapel are not resting."'],
      lead: { title: 'The Waking Dead', text: 'Someone is waking the dead under the old chapel.', flag: 'saw-chapel' } },
    { name: 'Corvin Ash', at: 'market', lines: ['A man in a good coat, watching the stalls and not buying.'], when: ['!saw-chapel'] },
    { name: 'Dagny', at: 'armorer', lines: ['"Dagny\'s. I made the armour, I\'ll fix the armour."'] },
  ],
  places: [
    { label: 'Old Chapel', district: 'temple-quarter', text: ['Cold stone, and steps going down.'], sets: 'saw-chapel', fight: { brief: 'mixed' } },
    { label: 'Smugglers\' Cache', district: 'gatehouse', hidden: 13, text: ['A loose flagstone, and a purse under it.'], loot: 'gold' },
  ],
  rumours: [{ text: 'They say the old chapel has lights in it at night.', lead: { title: 'Lights in the Chapel', text: 'Lights, at night.', flag: 'saw-chapel' } }],
};

/** Every map a town has: one, or a city's map of quarters and each quarter's. */
const mapsOf = (m: Module): ExploreMap[] => Object.values(m.scenes).flatMap((s) => (s.kind === 'explore' ? [s.map] : []));
/** The town's places, wherever they stand: every marker but the ways between maps. */
const mapOf = (m: Module): ExploreMap => {
  const maps = mapsOf(m);
  if (!maps.length) throw new Error('no city map');
  return { ...maps[0]!, nodes: maps.flatMap((x) => x.nodes).filter((n) => !/^(way|to)-/.test(n.id)) };
};
const dialogue = (m: Module, id: string) => { const s = m.scenes[id]; if (s?.kind !== 'dialogue') throw new Error(`no dialogue '${id}'`); return s; };
const node = (m: Module, id: string) => mapOf(m).nodes.find((n) => n.id === id)!;

describe('a town an author has written into', () => {
  it('passes every proof, every seed', () => {
    let rerolls = 0;
    for (let seed = 1; seed <= 30; seed++) {
      const r = generateCity(seed, SPEC);
      expect(validateModule(r.module), `seed ${seed}`).toEqual([]);
      rerolls += r.rerolls;
    }
    expect(rerolls / 30).toBeLessThan(0.3);
  });

  const m = generateCity(5, SPEC).module;

  it('puts a person at a venue as someone to talk to there, with a lead to give', () => {
    const temple = dialogue(m, 'temple');
    const talk = temple.next.find((c) => c.id === 'talk-mother-ilse')!;
    // Before the way out, so it reads as part of the temple.
    expect(temple.next.indexOf(talk)).toBe(temple.next.length - 2);
    const ilse = dialogue(m, talk.to);
    expect(ilse.npc).toMatchObject({ name: 'Mother Ilse' });
    const ask = ilse.next.find((c) => c.id === 'ask')!;
    expect(ask.once).toBe(true);
    expect(ask.effects).toContainEqual(expect.objectContaining({ kind: 'journal', entry: expect.objectContaining({ kind: 'lead', resolvedBy: 'saw-chapel' }) }));
    expect(ilse.next.find((c) => c.id === 'leave')!.to).toBe('temple');
  });

  it('lets a person run a shop', () => {
    const armoury = m.scenes.armorer;
    expect(armoury?.kind === 'shop' && armoury.npc?.name).toBe('Dagny');
    expect(armoury?.kind === 'shop' && armoury.intro).toEqual(['"Dagny\'s. I made the armour, I\'ll fix the armour."']);
  });

  it('gives a person in a district a marker of their own, there only while the story allows', () => {
    const corvin = node(m, 'person-corvin-ash');
    expect(corvin.label).toBe('Corvin Ash');
    // Gone once the party has been down the chapel: he was waiting for that.
    expect(corvin.requires).toEqual([{ kind: 'notFlag', flag: 'saw-chapel' }]);
  });

  it('builds a written place: the fight on the way in once, then the place, which closes the lead', () => {
    const chapel = node(m, 'place-old-chapel');
    const fight = m.scenes[chapel.scene];
    expect(fight?.kind).toBe('battle');
    expect(chapel.sceneWhen).toEqual([{ if: [{ kind: 'flag', flag: 'place-old-chapel-cleared' }], to: 'place-old-chapel' }]);
    const place = m.scenes['place-old-chapel'];
    if (place?.kind !== 'story') throw new Error();
    for (const c of place.next) expect(c.effects, c.id).toContainEqual({ kind: 'setFlag', flag: 'saw-chapel' });
    // The cache is hidden, and pays once.
    expect(node(m, 'place-smugglers-cache').hidden).toEqual({ dc: 13 });
    const cache = m.scenes['place-smugglers-cache'];
    if (cache?.kind !== 'story') throw new Error();
    expect(cache.next.find((c) => c.id === 'take')).toMatchObject({ once: true, effects: [{ kind: 'gold', amount: 60 }] });
  });

  it('closes its lead whichever way the party leaves, loot in hand or not', () => {
    // The first cut set the flag only on "Walk on": take the loot, and the
    // lead that pointed here stayed open forever.
    const t = generateCity(5, { places: [{ label: 'Vault', text: ['A strongbox.'], loot: 'gold', sets: 'found-vault' }],
      rumours: [{ text: 'A vault.', lead: { title: 'The Vault', text: 'v', flag: 'found-vault' } }] }).module;
    const vault = t.scenes['place-vault'];
    if (vault?.kind !== 'story') throw new Error();
    expect(vault.next.map((c) => c.id)).toEqual(['take', 'leave']);
    for (const c of vault.next) expect(c.effects, c.id).toContainEqual({ kind: 'setFlag', flag: 'found-vault' });
  });

  it('plays the chapel through: fight, place, flag', () => {
    const s = startAdventure(newCampaign(2), m);
    enterScene(s, m, m.start);
    choose(s, m, 'in');
    enterNode(s, m, 'place-old-chapel');
    expect(currentScene(s, m).kind).toBe('battle');
    resolveBattle(s, m, true);
    expect(s.sceneId).toBe('place-old-chapel');
    choose(s, m, 'leave');
    expect(s.flags['saw-chapel']).toBe(true);
    // Back on the map, the chapel is now just the chapel.
    enterNode(s, m, 'place-old-chapel');
    expect(s.sceneId).toBe('place-old-chapel');
  });

  it('tells the author\'s rumours first, and writes their leads down', () => {
    const talk = m.scenes['inn-talk'];
    if (talk?.kind !== 'story') throw new Error();
    expect(talk.text[0]).toBe('"They say the old chapel has lights in it at night."');
    expect(talk.next[0]!.effects).toEqual([expect.objectContaining({ kind: 'journal', entry: expect.objectContaining({ title: 'Lights in the Chapel' }) })]);
    // Only the first inn: a rumour told twice is two leads for one thing.
    const plain = generateCity(5, { ...SPEC, size: 'city' }).module.scenes['inn-2-talk'];
    expect(plain?.kind === 'story' && plain.next[0]!.effects).toBeFalsy();
  });
});

describe('trouble in the streets', () => {
  const streets = (m: Module) => mapOf(m).nodes.filter((n) => n.wandering);

  it('comes to towns and cities, not villages, and only where the author says', () => {
    for (let seed = 1; seed <= 10; seed++) {
      expect(streets(generateCity(seed, { size: 'village' }).module)).toHaveLength(0);
      expect(streets(generateCity(seed, { size: 'town' }).module)).toHaveLength(1);
      expect(streets(generateCity(seed, { size: 'city' }).module)).toHaveLength(2);
      expect(streets(generateCity(seed, { size: 'city', streets: false }).module)).toHaveLength(0);
    }
  });

  it('is footpads, on the village board, in the rough districts, never at the gate', () => {
    for (let seed = 1; seed <= 15; seed++) {
      const m = generateCity(seed, { size: 'city' }).module;
      for (const n of streets(m)) {
        expect(n.id).not.toBe('gate');
        expect(n.hidden).toBeUndefined();
        const fight = m.scenes[n.wandering!.battleScene] as Extract<Scene, { kind: 'battle' }>;
        expect(fight.mapId).toBe('village');
        expect(encounterFor(fight.encounterId)!.members.every((x) => FACTIONS.bandits!.members.includes(x))).toBe(true);
      }
    }
  });
});

describe('what the author cannot ask for', () => {
  it('is refused at once, saying why', () => {
    const bad: [CitySpec, RegExp][] = [
      [{ size: 'village', people: [{ name: 'X', at: 'warrens', lines: ['hi'] }] }, /not a district of a village/],
      [{ size: 'village', people: [{ name: 'X', at: 'mage-guild', lines: ['hi'] }] }, /which a village does not have/],
      [{ people: [{ name: 'X', at: 'armorer', lines: ['hi'], lead: { title: 'T', text: 't' } }] }, /a shop, where there is no talking/],
      [{ rumours: [{ text: 'r', lead: { title: 'T', text: 't', flag: 'nowhere' } }] }, /closes on 'nowhere', which no place sets/],
      [{ people: [{ name: 'X', at: 'inn', lines: ['a'] }, { name: 'x', at: 'temple', lines: ['b'] }] }, /two people called/],
      [{ places: [{ label: 'P', text: ['t'], fight: 'no-such-fight' }] }, /no encounter/],
      [{ people: [{ name: 'X', at: 'inn', lines: ['a'], when: ['met-x'] }] }, /'met-x', which nothing in the town sets/],
      [{ size: 'town', places: Array.from({ length: 7 }, (_, i) => ({ label: `P${i}`, text: ['t'] })) }, /at most 15/],
      [{ size: 'city', places: Array.from({ length: 21 }, (_, i) => ({ label: `P${i}`, text: ['t'] })) }, /at most 30/],
    ];
    for (const [spec, why] of bad) expect(() => checkCitySpec(spec), JSON.stringify(spec)).toThrow(why);
    expect(() => checkCitySpec({ size: 'village', venues: ['mage-guild'], people: [{ name: 'X', at: 'mage-guild', lines: ['hi'] }] })).not.toThrow();
  });
});
