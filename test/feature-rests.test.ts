/**
 * Limited features spend across a day, and come back on the right clock.
 *
 * `uses.per` was the single-member union `'encounter'`, so every limited
 * feature in the game refilled at the start of every fight. Right for a monster
 * — few survive to a second one — and wrong for the eight a player class owns.
 * Lay on Hands was the loudest: a level-5 paladin's 25 HP healing pool is meant
 * to be the whole day's budget and it came back in full for each wave.
 *
 * The consequence was systemic. Spell slots persist across an arena day, so the
 * wizard was the only character in the party doing resource management, and the
 * martial and Channel Divinity classes were quietly stronger than their class
 * tables assume.
 *
 * These tests are the fence around that. The interesting cases are the two
 * boundaries — what survives a fight, and what a short rest hands back — plus
 * the one thing that must NOT change: a monster's pool still refills each time.
 */
import { describe, it, expect } from 'vitest';
import {
  newCampaign, buildCampaignParty, readBackSurvivors, shortRest, longRest,
} from '../src/campaign/campaign.js';
import { setPartyClass } from '../src/campaign/campaign.js';
import { FEATURES } from '../src/data/features.js';
import { CLASSES } from '../src/data/classes.js';
import { buildMonster } from '../src/data/monsters.js';

/** A campaign whose first hero is the given class, at the given level. */
function partyOf(classId: string, level = 5) {
  const c = newCampaign(1);
  setPartyClass(c, 0, classId);
  c.xp = 0;
  // Level is derived from XP; walk it up rather than reaching into internals.
  while (c.characters[0] && buildCampaignParty(c)[0]!.level < level) c.xp += 500;
  return c;
}

describe('feature pools and rests', () => {
  it('scopes every player-class pool to a rest, and every other one to the fight', () => {
    // The split this change is about, asserted directly rather than by example.
    // A new class feature written with `per: 'encounter'` — the old default,
    // and the easy mistake — fails here.
    const owned = new Set<string>();
    for (const cls of Object.values(CLASSES)) {
      for (const ids of Object.values(cls.featuresByLevel)) for (const id of ids) owned.add(id);
      for (const p of cls.choices ?? []) {
        for (const o of p.options) for (const id of o.grants.featureIds ?? []) owned.add(id);
      }
    }
    const perFight = [...owned].filter((id) => FEATURES[id]?.uses?.per === 'encounter');
    expect(perFight, 'a class feature that refills every fight').toEqual([]);
    // Guards the guard: if `owned` came out empty the line above proves nothing.
    const limited = [...owned].filter((id) => FEATURES[id]?.uses);
    expect(limited.length).toBeGreaterThan(5);
  });

  it("spends a paladin's Lay on Hands across the whole day, not each fight", () => {
    // THE case. 5 x level, and it used to come back for every wave.
    const c = partyOf('paladin');
    const before = buildCampaignParty(c)[0]!;
    const pool = before.featureUses['lay-on-hands']!;
    expect(pool.current).toBe(pool.max);

    // Spend most of it in a fight, then walk out of that fight.
    before.featureUses['lay-on-hands'] = { current: 3, max: pool.max };
    readBackSurvivors(c, [before]);
    expect(c.characters[0]!.resources?.featureUses?.['lay-on-hands']).toBe(3);
    expect(buildCampaignParty(c)[0]!.featureUses['lay-on-hands']!.current).toBe(3);

    // A short rest is lunch, not the night: the day's budget stays spent.
    shortRest(c);
    expect(buildCampaignParty(c)[0]!.featureUses['lay-on-hands']!.current).toBe(3);

    // The night gives it back.
    longRest(c);
    const after = buildCampaignParty(c)[0]!.featureUses['lay-on-hands']!;
    expect(after.current).toBe(after.max);
  });

  it('hands Action Surge back at the lunch break', () => {
    const c = partyOf('fighter');
    const fought = buildCampaignParty(c)[0]!;
    fought.featureUses['action-surge'] = { current: 0, max: 1 };
    fought.featureUses['second-wind'] = { current: 0, max: 2 };
    readBackSurvivors(c, [fought]);
    // Still spent going into the next wave of the same half-day.
    expect(buildCampaignParty(c)[0]!.featureUses['action-surge']!.current).toBe(0);

    shortRest(c);
    const rested = buildCampaignParty(c)[0]!;
    expect(rested.featureUses['action-surge']!.current).toBe(1);
    expect(rested.featureUses['second-wind']!.current).toBe(2);
    // And the field is gone entirely rather than left as a full-looking record —
    // "absent means full" is the convention every other resource here uses.
    expect(c.characters[0]!.resources?.featureUses).toBeUndefined();
  });

  it('keeps the daily pool while giving back the short-rest one', () => {
    // The mixed case, which is where a naive "clear it all" would pass the two
    // tests above and still be wrong.
    const c = partyOf('paladin');
    const fought = buildCampaignParty(c)[0]!;
    fought.featureUses['lay-on-hands'] = { current: 1, max: 5 * fought.level };
    fought.featureUses['sacred-weapon'] = { current: 0, max: 1 };
    readBackSurvivors(c, [fought]);
    shortRest(c);
    const rested = buildCampaignParty(c)[0]!;
    expect(rested.featureUses['sacred-weapon']!.current, 'Channel Divinity is a short rest').toBe(1);
    expect(rested.featureUses['lay-on-hands']!.current, 'Lay on Hands is the day').toBe(1);
  });

  it('never carries an encounter pool out of a fight', () => {
    // A monster's Whelm or a species trait refills every fight by definition.
    // Persisting one would be a bug that reads like a balance decision, so the
    // filter is at the write, not just at the read.
    const c = partyOf('fighter');
    const fought = buildCampaignParty(c)[0]!;
    const encounterScoped = Object.keys(fought.featureUses)
      .filter((id) => FEATURES[id]?.uses?.per === 'encounter');
    for (const id of encounterScoped) fought.featureUses[id] = { current: 0, max: 1 };
    fought.featureUses['action-surge'] = { current: 0, max: 1 };
    readBackSurvivors(c, [fought]);
    const stored = Object.keys(c.characters[0]!.resources?.featureUses ?? {});
    for (const id of encounterScoped) expect(stored, `${id} was persisted`).not.toContain(id);
    expect(stored).toContain('action-surge');
  });

  it('still builds monsters with full pools every time', () => {
    // The other half of the guarantee: nothing about this reaches monsters.
    for (const id of ['water-elemental', 'banshee', 'mummy']) {
      const m = buildMonster(id, 'team2', { x: 0, y: 0 });
      for (const [fid, pool] of Object.entries(m.featureUses)) {
        expect(pool.current, `${id}: ${fid}`).toBe(pool.max);
      }
    }
  });

  it('ignores a stored pool for a feature that is no longer rest-scoped', () => {
    // Old saves. If a feature is re-scoped back to per-fight, a value left in a
    // save must not pin it spent forever -- the builder ignores the override
    // rather than trusting whatever is on disk.
    const c = partyOf('fighter');
    c.characters[0]!.resources = {
      ...c.characters[0]!.resources,
      hp: 30,
      featureUses: { 'heroic-inspiration': 0 },
    };
    const built = buildCampaignParty(c)[0]!;
    const pool = built.featureUses['heroic-inspiration'];
    if (pool) expect(pool.current).toBe(pool.max);
  });
});
