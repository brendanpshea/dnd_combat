/**
 * Theft gets noticed: a shop that catches you will not serve you again, the
 * town's watch waits at the gate for a party caught twice, and the thieves'
 * guild will make a name go away — for a price below the watch's.
 */
import { describe, it, expect } from 'vitest';
import { generateCity } from '../src/adventure/city-gen.js';
import { expandModule } from '../src/adventure/embed.js';
import { validateModule } from '../src/adventure/validate.js';
import {
  startAdventure, enterScene, enterNode, choose, legalChoices, shopSteal, currentScene, resolveBattle,
} from '../src/adventure/runtime.js';
import { newCampaign } from '../src/campaign/campaign.js';
import { TOWN_STORY_MODULE } from '../src/data/modules/town-story.js';
import { CAUGHT_STEALING, type Module } from '../src/adventure/types.js';

/** A party in a town, standing on its map, with coin to pay fines. */
function inTown(seed: number, m: Module) {
  const c = newCampaign(seed); c.gold = 5000;
  const s = startAdventure(c, m);
  enterScene(s, m, m.start);
  choose(s, m, 'in');
  return s;
}
/** Steal from a shop until caught (or give up), returning whether it was. */
function stealUntilCaught(s: ReturnType<typeof inTown>, m: Module, shop: string): boolean {
  for (let i = 0; i < 40; i++) {
    enterScene(s, m, shop);
    if (s.sceneId !== shop) return true;            // bounced at the door
    const caught = !shopSteal(s, m).some((e) => e.type === 'item');
    enterScene(s, m, 'city');
    if (caught) return true;
  }
  return false;
}
/** Wait at the inn for dark (the back room keeps night hours). */
function nightfall(s: ReturnType<typeof inTown>, m: Module): void {
  enterNode(s, m, 'inn');
  choose(s, m, 'dusk');
  choose(s, m, 'leave');
}
const shown = (s: ReturnType<typeof inTown>, m: Module) => legalChoices(s, m).filter((o) => !o.blocked).map((o) => o.choice.id);

describe('a shop that catches you', () => {
  it('will not serve you again, and the town counts it', () => {
    const m = generateCity(3, { size: 'town', level: 2 }).module;
    const s = inTown(3, m);
    expect(stealUntilCaught(s, m, 'general')).toBe(true);
    expect(s.barredShops).toContain('general');
    expect(s.flags[CAUGHT_STEALING]).toBe(1);
    // Back at the door: turned away, onto the map.
    enterScene(s, m, 'general');
    expect(s.sceneId).toBe('city');
    // A theft that works is not noticed: only being caught bars a shop.
    expect(s.barredShops).toEqual(['general']);
  });

  it('is bounded: once caught, no more tries, however often you walk back in', () => {
    // The exploit this closes: "once per visit" was once per walk round the
    // block, at about +40 gold of value a try (60% success, a ~90 gold item,
    // a 50 gold fine), for ever.
    const m = generateCity(4, { size: 'city', level: 3 }).module;
    const s = inTown(4, m);
    stealUntilCaught(s, m, 'armorer');
    const before = JSON.stringify(s.campaign.characters.map((c) => c.inventory));
    // Back out onto the armourer's own street: a city's quarter, not its map.
    const street = (m.scenes.armorer as { next: string }).next;
    expect(street).toMatch(/^quarter-/);
    for (let i = 0; i < 10; i++) { enterScene(s, m, 'armorer'); expect(s.sceneId).toBe(street); }
    expect(JSON.stringify(s.campaign.characters.map((c) => c.inventory))).toBe(before);
  });
});

describe('the watch at the gate', () => {
  const m = generateCity(5, { size: 'town', level: 2 }).module;

  it('lets a party caught once go, and stops one caught twice', () => {
    const s = inTown(5, m);
    stealUntilCaught(s, m, 'general');
    enterNode(s, m, 'gate');
    expect(s.sceneId).toBe('gate');
    enterScene(s, m, 'city');
    stealUntilCaught(s, m, 'armorer');
    enterNode(s, m, 'gate');
    expect(s.sceneId).toBe('gate-watch');
  });

  it('takes a fine worth a tenth of a delve, and forgets', () => {
    const s = inTown(5, m);
    stealUntilCaught(s, m, 'general'); stealUntilCaught(s, m, 'armorer');
    enterNode(s, m, 'gate');
    const gold = s.campaign.gold;
    choose(s, m, 'pay');
    expect(gold - s.campaign.gold).toBe(150);
    expect(s.flags[CAUGHT_STEALING]).toBeFalsy();
    expect(s.sceneId).toBe('gate');
  });

  it('or can be fought through, and forgets just the same', () => {
    const s = inTown(5, m);
    stealUntilCaught(s, m, 'general'); stealUntilCaught(s, m, 'armorer');
    enterNode(s, m, 'gate');
    choose(s, m, 'fight');
    expect(currentScene(s, m)).toMatchObject({ kind: 'battle', mapId: 'village' });
    resolveBattle(s, m, true);
    expect(s.flags[CAUGHT_STEALING]).toBeFalsy();
    expect(s.sceneId).toBe('gate');
  });
});

describe('the thieves\' guild', () => {
  const m = generateCity(6, { size: 'town', level: 2 }).module;

  it('offers to clear a name only to someone who has one, and for less than the watch', () => {
    const s = inTown(6, m);
    // Caught in daylight (the shops are shut at night)...
    stealUntilCaught(s, m, 'general');
    const s2 = inTown(6, m);
    nightfall(s2, m);
    enterNode(s2, m, 'thieves-guild');
    expect(shown(s2, m)).not.toContain('clean');
    // ...and to the back room after dark, to be rid of it.
    nightfall(s, m);
    enterNode(s, m, 'thieves-guild');
    expect(shown(s, m)).toContain('clean');
    const gold = s.campaign.gold;
    choose(s, m, 'clean');
    expect(gold - s.campaign.gold).toBe(80);
    expect(80).toBeLessThan(150);          // the watch's fine at level 2
    expect(s.flags[CAUGHT_STEALING]).toBeFalsy();
  });

  it('still sells what the shops will not', () => {
    expect(m.scenes['thieves-guild-wares']?.kind).toBe('shop');
  });
});

describe('the runtime\'s flag', () => {
  it('may be read by a written story that only reads it', () => {
    // No scene sets or clears it — the runtime does, in any shop. Without the
    // validator knowing that, a story could not so much as notice a thief.
    const m: Module = {
      id: 'thief-test', title: 'T', blurb: 'b', start: 'square',
      scenes: {
        square: { id: 'square', kind: 'story', text: ['A square.'], next: [
          { id: 'shop', label: 'Shop', to: 'stall' },
          { id: 'end', label: 'Leave', to: 'end' },
          { id: 'jail', label: 'Hand yourself in', to: 'end', requires: [{ kind: 'count', flag: CAUGHT_STEALING, atLeast: 1 }], hideWhenBlocked: true },
        ] },
        stall: { id: 'stall', kind: 'shop', next: 'square', stock: ['dagger'] },
        end: { id: 'end', kind: 'ending', outcome: 'victory', text: ['Done.'] },
      },
    };
    expect(validateModule(m).filter((e) => e.includes(CAUGHT_STEALING))).toEqual([]);
  });

  it('counts as written wherever there is a shop, and is never renamed by a splice', () => {
    // A town reads it at its gate; nothing in the town sets it — the runtime
    // does. Renamed into a story's town, it would wait on a name nobody sets.
    for (let seed = 1; seed <= 10; seed++) expect(validateModule(generateCity(seed, { size: 'village' }).module)).toEqual([]);
    const live = expandModule(TOWN_STORY_MODULE, { seed: 1, flags: [] });
    const json = JSON.stringify(live.scenes);
    expect(json).toContain(`"flag":"${CAUGHT_STEALING}"`);
    expect(json).not.toContain(`"flag":"port/${CAUGHT_STEALING}"`);
  });
});
