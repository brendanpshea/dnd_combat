/**
 * The buffs worth putting up before the doors open.
 *
 * THE PROBLEM
 *
 * The arena runs two fights a day and the party walks in cold. False Life,
 * Aid, Haste and Protection from Evil and Good were all castable only once a
 * fight had already started — which, for a ward, is the moment it is worth
 * least. Temporary hit points are what you raise BEFORE anyone reaches you.
 *
 * THE PART THAT NEEDED CARE
 *
 * Two of the four take CONCENTRATION, and a camp-cast Haste must not be better
 * than a Haste. Aid and False Life simply persist — no concentration, and both
 * outlast a fight — so a camp cast is exactly a cast. Haste and Protection are
 * recorded with their caster, and `buildCampaignParty` starts that caster
 * already concentrating: the buff is then as fragile as it would have been cast
 * on round one, can be broken by a hit, and blocks the caster from holding
 * anything else.
 */
import { describe, it, expect } from 'vitest';
import {
  newCampaign, buildCampaignParty, storeSpellActions, useStoreSpell, shortRest, LEVEL_XP,
  growSpellsForLevel, setPartyClass,
} from '../src/campaign/campaign.js';
import { SPELLS } from '../src/data/spells.js';
import { CLASSES } from '../src/data/classes.js';
import { spellOptions } from '../src/arena/prep.js';
import type { CampaignState } from '../src/campaign/campaign.js';

/** A level-7 party, so every tier under test is actually castable. */
function party(classes = ['wizard', 'cleric', 'fighter', 'rogue']): CampaignState {
  const c = newCampaign(1);
  classes.forEach((id, i) => setPartyClass(c, i, id));
  c.partyReady = true;
  c.xp = LEVEL_XP[LEVEL_XP.length - 1]!;
  growSpellsForLevel(c);
  return c;
}

/**
 * Index of a character who can cast `spellId`, PREPARING it if need be.
 *
 * Written the obvious way first — find whoever already has it — and three of
 * the four spells came back -1, because `buildCampaignParty` returns the
 * *prepared* list and the auto-default does not happen to prepare False Life,
 * Haste or Protection from Evil and Good. Every test that used it then took an
 * early return and passed without touching the code under test. Eight green
 * tests, two of which meant anything.
 *
 * So: prepare it explicitly, and throw rather than skip if no class in the
 * party could ever learn it. A test that quietly does nothing is worse than no
 * test, because it also reports that the thing works.
 */
function casterOf(c: CampaignState, spellId: string): number {
  const known = c.characters.findIndex((ch) => {
    const sc = CLASSES[ch.classId]?.spellcasting;
    return !!sc && Object.values(sc.spellsByLevel).flat().includes(spellId);
  });
  if (known < 0) throw new Error(`no class in this party can learn ${spellId}`);
  const ch = c.characters[known]!;
  const already = buildCampaignParty(c)[known]!.spellIds;
  if (!already.includes(spellId)) {
    ch.prepared = [spellId, ...(ch.prepared ?? already.filter((id) => (SPELLS[id]?.level ?? 0) > 0))].slice(0, 8);
  }
  const got = buildCampaignParty(c)[known]!;
  if (!got.spellIds.includes(spellId)) throw new Error(`could not prepare ${spellId}`);
  return known;
}

describe('camp spells are offered at all', () => {
  it('offers each of the four to somebody who knows it', () => {
    // The defect, stated directly: these were combat-only, so the shop screen
    // never showed them however many slots the party was sitting on.
    const c = party();
    for (const spellId of ['false-life', 'aid', 'haste', 'protection-from-evil-and-good']) {
      const idx = casterOf(c, spellId);
      const offered = storeSpellActions(buildCampaignParty(c)[idx]!).map((a) => a.spellId);
      expect(offered, `${spellId} not offered to its own caster`).toContain(spellId);
    }
  });
});

describe('the ones that simply persist', () => {
  it('False Life brings temporary hit points into the fight', () => {
    const c = party();
    const idx = casterOf(c, 'false-life');
    expect(buildCampaignParty(c)[idx]!.tempHp ?? 0).toBe(0);
    expect(useStoreSpell(c, idx, 'false-life')).toBe(true);
    expect(buildCampaignParty(c)[idx]!.tempHp ?? 0).toBeGreaterThan(0);
  });

  it('Aid raises the hit point maximum of everybody else', () => {
    const c = party();
    const idx = casterOf(c, 'aid');
    const before = buildCampaignParty(c).map((p) => p.maxHp);
    expect(useStoreSpell(c, idx, 'aid')).toBe(true);
    const after = buildCampaignParty(c).map((p) => p.maxHp);
    after.forEach((hp, i) => {
      // SRD Aid reaches three creatures and this party is four, so it goes to
      // everyone except the caster — the one split that needs no question asked.
      if (i === idx) expect(hp, 'the caster should not be aided').toBe(before[i]);
      else expect(hp, `member ${i}`).toBe(before[i]! + 5);
    });
  });

  it('spends the slot', () => {
    // A camp button that buffs for free is not a spell, it is a setting.
    const c = party();
    const idx = casterOf(c, 'false-life');
    const level = SPELLS['false-life']!.level;
    const before = buildCampaignParty(c)[idx]!.spellSlots[level - 1]!.current;
    useStoreSpell(c, idx, 'false-life');
    expect(buildCampaignParty(c)[idx]!.spellSlots[level - 1]!.current).toBe(before - 1);
  });
});

describe('the ones that take concentration', () => {
  it('starts the caster already concentrating', () => {
    // THE rule that keeps a camp Haste from being better than a Haste. Without
    // it the party gets a free 3rd-level buff every fight and the caster is
    // still able to hold Spirit Guardians on top.
    const c = party();
    const idx = casterOf(c, 'haste');
    expect(useStoreSpell(c, idx, 'haste')).toBe(true);
    const built = buildCampaignParty(c);
    expect(built[idx]!.concentratingOn?.spellId).toBe('haste');
    const hasted = built.filter((p) => p.conditions.some((k) => k.id === 'hasted'));
    expect(hasted).toHaveLength(1);
    // And it is somebody else — the buff and the concentration are on
    // different people, which is what makes it breakable.
    expect(hasted[0]!.id).not.toBe(built[idx]!.id);
  });

  it('refuses a second concentration buff from the same caster', () => {
    const c = party();
    const idx = casterOf(c, 'haste');
    expect(useStoreSpell(c, idx, 'haste')).toBe(true);
    expect(useStoreSpell(c, idx, 'haste'), 'one mind, one spell').toBe(false);
  });

  it('does not spend the slot when it refuses', () => {
    // The failure that makes a refusal worse than no button at all.
    const c = party();
    const idx = casterOf(c, 'haste');
    useStoreSpell(c, idx, 'haste');
    const level = SPELLS.haste!.level;
    const before = buildCampaignParty(c)[idx]!.spellSlots[level - 1]!.current;
    useStoreSpell(c, idx, 'haste');
    expect(buildCampaignParty(c)[idx]!.spellSlots[level - 1]!.current).toBe(before);
  });
});

describe('camp buffs end at a rest', () => {
  it('clears all of them', () => {
    // False Life is an hour, Haste a minute, Aid eight hours — all over by the
    // time the party has rested. A buff that survived a rest is one you cast
    // once and never again.
    const c = party();
    for (const spellId of ['false-life', 'aid', 'haste']) {
      const idx = casterOf(c, spellId);
      useStoreSpell(c, idx, spellId);
    }
    shortRest(c);
    for (const ch of c.characters) {
      const eff = ch.resources?.effects;
      expect(eff?.falseLife).toBeUndefined();
      expect(eff?.aid).toBeUndefined();
      expect(eff?.campConcentration).toBeUndefined();
    }
  });
});

describe('the gate offers them, not just the party screen', () => {
  it('offers every camp spell at the arena gate', () => {
    // `spellOptions` used to be one hard-coded `if (spellId !== 'mage-armor')`,
    // so every camp spell added after it was castable on the party screen and
    // invisible at the gate — the one moment a buff is worth most, because the
    // wave is on screen and the fight is the next click.
    for (const spellId of ['false-life', 'aid', 'haste', 'protection-from-evil-and-good']) {
      const c = party();
      const idx = casterOf(c, spellId);
      const offered = spellOptions(c).filter((o) => o.who === idx).map((o) => o.id);
      expect(offered, `${spellId} is missing from the gate`).toContain(spellId);
    }
  });

  it('stops offering one that is already up', () => {
    // A button that spends a slot to change nothing is worse than no button.
    const c = party();
    const idx = casterOf(c, 'false-life');
    expect(spellOptions(c).some((o) => o.who === idx && o.id === 'false-life')).toBe(true);
    useStoreSpell(c, idx, 'false-life');
    expect(spellOptions(c).some((o) => o.who === idx && o.id === 'false-life')).toBe(false);
  });

  it('stops offering a concentration buff to a caster already holding one', () => {
    const c = party();
    const idx = casterOf(c, 'haste');
    useStoreSpell(c, idx, 'haste');
    expect(spellOptions(c).some((o) => o.who === idx && o.id === 'haste')).toBe(false);
  });

  it('never offers a spell there is no slot for', () => {
    const c = party();
    const idx = casterOf(c, 'aid');
    const level = SPELLS.aid!.level;
    c.characters[idx]!.resources = {
      ...c.characters[idx]!.resources,
      slots: buildCampaignParty(c)[idx]!.spellSlots.map((s, i) => (i === level - 1 ? 0 : s.current)),
    };
    expect(spellOptions(c).some((o) => o.who === idx && o.id === 'aid')).toBe(false);
  });
});
