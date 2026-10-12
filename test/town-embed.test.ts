/**
 * Generated towns inside written stories, and the delves under them.
 */
import { describe, it, expect } from 'vitest';
import { TOWN_STORY_MODULE as STORY } from '../src/data/modules/town-story.js';
import { expandModule, liveModule, validateLive } from '../src/adventure/embed.js';
import { validateModule } from '../src/adventure/validate.js';
import { checkCitySpec } from '../src/adventure/city-gen.js';
import { startAdventure, enterScene, choose, enterNode, legalChoices, currentScene } from '../src/adventure/runtime.js';
import { newCampaign } from '../src/campaign/campaign.js';
import type { Module } from '../src/adventure/types.js';
import { playUntil } from './delve-play.js';

const shown = (s: ReturnType<typeof startAdventure>, m: Module) =>
  legalChoices(s, m).filter((o) => !o.blocked).map((o) => o.choice.id);

describe('a written story with a generated town in it, and a delve under the town', () => {
  it('passes every proof, for every seed tried and every flag the town reads', () => {
    expect(validateLive(STORY)).toEqual([]);
  });

  it('cannot pass as written', () => {
    expect(validateModule(STORY).join('\n')).toMatch(/unknown scene 'port'/);
  });

  it('keeps the town in its own namespace, and the story\'s scenes as written', () => {
    const live = expandModule(STORY, { seed: 3, flags: [] });
    for (const [id, s] of Object.entries(STORY.scenes)) expect(live.scenes[id], id).toEqual(s);
    const made = Object.keys(live.scenes).filter((id) => !STORY.scenes[id]);
    for (const id of made) expect(/^(port|tunnels)(\/|$)/.test(id), id).toBe(true);
    expect(live.scenes['port/city']?.kind).toBe('explore');
  });

  it('plays: the harbourmaster\'s lead, down the grate, the dead put down, the priest, the road home', () => {
    for (const seed of [1, 2, 3]) {
      const s = startAdventure(newCampaign(seed), STORY);
      const m = liveModule(STORY, s, seed * 101);
      enterScene(s, m, m.start);
      choose(s, m, 'go');
      choose(s, m, 'in');
      expect(s.sceneId).toBe('port/city');

      // The lead: closed by a STORY flag, so its name must survive the splice
      // un-renamed. Renamed with the town's flags, it waited forever.
      enterNode(s, m, 'person-harbourmaster-wrenna');
      choose(s, m, 'ask');
      const lead = s.journal.find((e) => e.title === 'The Drowned Tunnels');
      expect(lead?.resolvedBy, `seed ${seed}`).toBe('tunnels-cleared');
      choose(s, m, 'ok');
      choose(s, m, 'leave');

      // Brother Aldo is not at the temple yet.
      enterNode(s, m, 'temple');
      expect(shown(s, m)).not.toContain('talk-brother-aldo');
      choose(s, m, 'leave');

      // Down the grate, through the delve, and back up onto the town's map.
      enterNode(s, m, 'place-sewer-grate');
      choose(s, m, 'on');
      expect(s.sceneId).toBe('tunnels');
      playUntil(s, m, seed, (id) => id === 'port/city');
      expect(s.sceneId, `seed ${seed}`).toBe('port/city');
      expect(s.flags['tunnels-cleared'], `seed ${seed}`).toBe(true);

      // Now he is.
      enterNode(s, m, 'temple');
      expect(shown(s, m)).toContain('talk-brother-aldo');
      choose(s, m, 'leave');

      // And the story knows what you did.
      enterNode(s, m, 'gate');
      choose(s, m, 'go');
      expect(s.sceneId).toBe('home');
      expect(shown(s, m)).toEqual(['hero']);
      choose(s, m, 'hero');
      expect(currentScene(s, m)).toMatchObject({ kind: 'ending', outcome: 'victory', id: 'home-hero' });
    }
  }, 60_000);
});

describe('what a town in a story may and may not do', () => {
  const variant = (f: (m: Module) => void): Module => { const m = structuredClone(STORY); f(m); return m; };

  it('leads on into the story only from inside one', () => {
    expect(() => checkCitySpec({ places: [{ label: 'Grate', text: ['x'], way: { to: 'tunnels' } }] }))
      .toThrow(/a town on its own has no story to lead into/);
    expect(() => checkCitySpec({ places: [{ label: 'Grate', text: ['x'], way: { to: 'tunnels' } }] }, { story: true })).not.toThrow();
  });

  it('reads a story flag only if it says so', () => {
    const m = variant((x) => { x.towns!.port!.reads = []; });
    expect(validateLive(m).join('\n')).toMatch(/'tunnels-cleared', which neither the town sets nor the town reads from the story/);
  });

  it('names nobody on its map before the party has met them', () => {
    // The harbourmaster's marker says what she is, not who: the cast check
    // refused the first draft, which put her name on the map.
    const m = variant((x) => { delete x.towns!.port!.spec.people![0]!.title; });
    expect(validateLive(m).join('\n')).toMatch(/names Wrenna before any introduction/);
  });

  it('closes a lead on the town\'s own flag, renamed with it', () => {
    // A lead closed by one of the town's places: the place's flag is renamed
    // into the town, so the lead's `resolvedBy` must be renamed the same way
    // or it waits on a name nothing sets.
    const m = variant((x) => {
      x.towns!.port!.spec.places!.push({ label: 'Old Shrine', text: ['Candles.'], sets: 'shrine-seen' });
      x.towns!.port!.spec.rumours = [{ text: 'There is a shrine.', lead: { title: 'The Shrine', text: 'Find it.', flag: 'shrine-seen' } }];
    });
    const live = expandModule(m, { seed: 2, flags: [] });
    const json = JSON.stringify(live.scenes);
    expect(json).toContain('"resolvedBy":"port/shrine-seen"');
    expect(json).toContain('"flag":"port/shrine-seen"');
    expect(validateLive(m)).toEqual([]);
  });

  it('puts nobody where there is no one to talk to', () => {
    expect(() => checkCitySpec({ people: [{ name: 'X', at: 'gate', lines: ['hi'] }] })).toThrow(/has no one to talk to/);
    // The district is 'gatehouse': once 'gate', which made "at the gate"
    // mean the venue when the author meant the district.
    expect(() => checkCitySpec({ people: [{ name: 'X', at: 'gatehouse', lines: ['hi'] }] })).not.toThrow();
  });
});
