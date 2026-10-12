/**
 * Time of day in a town: the shops keep daylight hours, the back room keeps
 * night ones, and the inn is where the time passes.
 */
import { describe, it, expect } from 'vitest';
import { generateCity } from '../src/adventure/city-gen.js';
import { expandModule } from '../src/adventure/embed.js';
import {
  startAdventure, enterScene, enterNode, choose, exploreNodes, resolveShopOrRest, carriedFlags,
} from '../src/adventure/runtime.js';
import { newCampaign } from '../src/campaign/campaign.js';
import { TOWN_STORY_MODULE } from '../src/data/modules/town-story.js';
import { CAUGHT_STEALING, NIGHT, type Module } from '../src/adventure/types.js';

function inTown(seed: number, m: Module) {
  const c = newCampaign(seed); c.gold = 500;
  const s = startAdventure(c, m);
  enterScene(s, m, m.start);
  choose(s, m, 'in');
  return s;
}
const open = (s: ReturnType<typeof inTown>, m: Module) =>
  new Set(exploreNodes(s, m).filter((n) => !n.blocked).map((n) => n.node.id));

describe('night in a town', () => {
  const m = generateCity(2, { size: 'town', level: 2 }).module;

  it('shuts the shops and opens the back room', () => {
    const s = inTown(2, m);
    const day = open(s, m);
    for (const shop of ['general', 'armorer', 'weaponsmith', 'mage-guild']) expect(day.has(shop), shop).toBe(true);
    expect(day.has('thieves-guild')).toBe(false);
    enterNode(s, m, 'inn');
    choose(s, m, 'dusk');
    expect(s.flags[NIGHT]).toBe(true);
    choose(s, m, 'leave');
    const night = open(s, m);
    for (const shop of ['general', 'armorer', 'weaponsmith', 'mage-guild']) expect(night.has(shop), shop).toBe(false);
    // The temple, the inn and the road out keep no hours.
    for (const always of ['temple', 'inn', 'gate']) expect(night.has(always), always).toBe(true);
    const guild = exploreNodes(s, m).find((n) => n.node.id === 'thieves-guild');
    // Unblocked at night (still to be spotted, if the party has not).
    if (guild) expect(guild.blocked).toBeFalsy();
  });

  it('ends at dawn: a room for the night, or sitting up for it', () => {
    const s = inTown(2, m);
    enterNode(s, m, 'inn');
    choose(s, m, 'dusk');
    choose(s, m, 'room');
    resolveShopOrRest(s, m);
    expect(s.flags[NIGHT]).toBeUndefined();
    // No coin for a room: still never stuck in the dark.
    s.campaign.gold = 0;
    choose(s, m, 'dusk');
    choose(s, m, 'dawn');
    expect(s.flags[NIGHT]).toBeFalsy();
  });

  it('is one sky over a story and its towns: never renamed by a splice', () => {
    const json = JSON.stringify(expandModule(TOWN_STORY_MODULE, { seed: 1, flags: [] }).scenes);
    expect(json).toContain(`"flag":"${NIGHT}"`);
    expect(json).not.toContain(`"flag":"port/${NIGHT}"`);
  });
});

describe('a name for theft', () => {
  it('follows the company into the next chapter', () => {
    const m = generateCity(3, {}).module;
    const s = inTown(3, m);
    s.flags[CAUGHT_STEALING] = 2;
    expect(carriedFlags(m, s)[CAUGHT_STEALING]).toBe(2);
    s.flags[CAUGHT_STEALING] = false;
    expect(carriedFlags(m, s)[CAUGHT_STEALING]).toBeUndefined();
  });
});
