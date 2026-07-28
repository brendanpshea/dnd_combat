/**
 * The morning review, and the case it must not fire in.
 *
 * `buyItem` only fills a pack — it never equips — so a breastplate won as a
 * prize sits in a rucksack for the rest of the run unless somebody opens the
 * party screen and puts it on. That is not a hypothetical: the playtest harness
 * had to grow an `equipUpgrades` step for exactly this, and every armour
 * purchase in every sweep before that was invisible to measurement because
 * nobody was wearing any of it. A player has the same problem and less
 * information.
 *
 * The hard requirement is the empty one. A review that opens every morning
 * whether or not anything changed is a screen people learn to close without
 * reading, which costs more than the single useful reminder it was built for —
 * so "nothing to do" has to be genuinely quiet, and most of these check that.
 */
import { describe, it, expect } from 'vitest';
import { gearTasks, spellTasks, morningTasks, morningReview } from '../src/arena/morning.js';
import { newCampaign, equipItem, addItem, preparedRoom } from '../src/campaign/campaign.js';
import type { CampaignState } from '../src/campaign/campaign.js';

function party(): CampaignState {
  const c = newCampaign(11);
  c.partyReady = true;
  return c;
}
const idxOf = (c: CampaignState, classId: string) =>
  c.characters.findIndex((ch) => ch.classId === classId);

describe('gear sitting unused', () => {
  it('says nothing about a party straight out of the forge', () => {
    // The starting kits are already equipped. If this ever reports something,
    // every single morning of every run opens a panel.
    expect(gearTasks(party())).toEqual([]);
  });

  it('notices better armour in a pack, and says what it is worth', () => {
    const c = party();
    const i = idxOf(c, 'fighter');
    addItem(c.characters[i]!.inventory, 'plate');
    const tasks = gearTasks(c).filter((t) => t.who === i && t.kind === 'armor');
    expect(tasks).toHaveLength(1);
    expect(tasks[0]!.detail).toContain('Plate');
    expect(tasks[0]!.detail).toMatch(/\+\d+ armour class/);
  });

  it('stops mentioning it the moment it is worn', () => {
    const c = party();
    const i = idxOf(c, 'fighter');
    addItem(c.characters[i]!.inventory, 'plate');
    expect(gearTasks(c).some((t) => t.who === i && t.kind === 'armor')).toBe(true);
    equipItem(c, i, 'plate', 'armor');
    expect(gearTasks(c).some((t) => t.who === i && t.kind === 'armor')).toBe(false);
  });

  it('does not offer armour to somebody who cannot wear it', () => {
    // A wizard's plate is not an upgrade, it is a rock. `equipBlocked` is the
    // authority and the check has to go through it rather than compare AC.
    const c = party();
    const i = idxOf(c, 'wizard');
    if (i < 0) return;
    addItem(c.characters[i]!.inventory, 'plate');
    expect(gearTasks(c).some((t) => t.who === i)).toBe(false);
  });

  it('never suggests a downgrade', () => {
    const c = party();
    const i = idxOf(c, 'fighter');
    equipItem(c, i, 'chain-mail', 'armor');
    addItem(c.characters[i]!.inventory, 'leather');
    expect(gearTasks(c).some((t) => t.who === i && t.kind === 'armor')).toBe(false);
  });

  it('ignores a spare copy of what they already have on', () => {
    // Two chain mails is not an upgrade. Worth pinning because the comparison
    // is one character away from being `>=`, and that reads as a real
    // suggestion every morning for as long as the duplicate is carried.
    const c = party();
    const i = idxOf(c, 'fighter');
    const worn = c.characters[i]!.equipped.armor!;
    addItem(c.characters[i]!.inventory, worn);
    expect(gearTasks(c).some((t) => t.who === i && t.kind === 'armor')).toBe(false);
  });

  it('offers a shield only while the hand is free', () => {
    const c = party();
    const i = idxOf(c, 'cleric');
    if (i < 0) return;
    // Clerics start with one on. Take it off and it becomes a suggestion.
    delete c.characters[i]!.equipped.offHand;
    addItem(c.characters[i]!.inventory, 'shield');
    expect(gearTasks(c).some((t) => t.who === i && t.kind === 'shield')).toBe(true);
    equipItem(c, i, 'shield', 'offHand');
    expect(gearTasks(c).some((t) => t.who === i && t.kind === 'shield')).toBe(false);
  });
});

describe('prepared spells going unused', () => {
  it('is quiet when every caster is full', () => {
    expect(spellTasks(party())).toEqual([]);
  });

  it('speaks up when a saved list has fallen behind the cap', () => {
    // The real trap: `growSpellsForLevel` deliberately does not grow a saved
    // prepared list, so a lean loadout picked at level 1 is still four spells
    // at a level that allows more — and nothing ever said so.
    const c = party();
    const i = idxOf(c, 'wizard');
    if (i < 0) return;
    c.xp = 6500;                              // several levels on
    c.characters[i]!.prepared = [];           // a saved, empty list
    const tasks = spellTasks(c);
    expect(tasks.some((t) => t.who === i)).toBe(true);
    const { limit } = preparedRoom(c, i);
    expect(tasks.find((t) => t.who === i)!.detail).toContain(`0 of ${limit}`);
  });

  it('says nothing about a character with no spellcasting at all', () => {
    const c = party();
    const i = idxOf(c, 'fighter');
    expect(spellTasks(c).some((t) => t.who === i)).toBe(false);
  });
});

describe('the morning as a whole', () => {
  it('is empty for a party with nothing to do', () => {
    // The load-bearing assertion. This is the common case — most mornings
    // change nothing — and it is what keeps the review from becoming noise.
    expect(morningTasks(party())).toEqual([]);
  });

  it('gathers gear and spells together', () => {
    const c = party();
    const f = idxOf(c, 'fighter');
    const w = idxOf(c, 'wizard');
    addItem(c.characters[f]!.inventory, 'plate');
    if (w >= 0) { c.xp = 6500; c.characters[w]!.prepared = []; }
    const kinds = new Set(morningTasks(c).map((t) => t.kind));
    expect(kinds.has('armor')).toBe(true);
    if (w >= 0) expect(kinds.has('spells')).toBe(true);
  });

  it('phrases every line for a player, naming who it is about', () => {
    const c = party();
    const f = idxOf(c, 'fighter');
    addItem(c.characters[f]!.inventory, 'plate');
    for (const t of morningTasks(c)) {
      expect(t.name, 'a task with no name cannot be shown').toBeTruthy();
      expect(t.detail.length, t.detail).toBeGreaterThan(10);
      expect(t.detail, t.detail).not.toMatch(/undefined|NaN|\[object/);
    }
  });
});

describe('when the review actually opens', () => {
  const LUNCH = { totalHealed: 3, hitDiceSpent: 2 };   // only lunch reports dice
  const NIGHT = { totalHealed: 12 };

  it('stays shut at lunch, even with gear going unused', () => {
    // Lunch keeps hit points, slots and charges, so nothing about the loadout
    // has changed. Asking twice a day trains the answer "dismiss", which costs
    // more than the reminder is worth.
    const c = party();
    addItem(c.characters[idxOf(c, 'fighter')]!.inventory, 'plate');
    expect(morningTasks(c).length).toBeGreaterThan(0);
    expect(morningReview(LUNCH, c)).toBeNull();
  });

  it('stays shut overnight when there is nothing to do', () => {
    expect(morningReview(NIGHT, party())).toBeNull();
  });

  it('opens on gear first, because that is the tab it lands you in', () => {
    const c = party();
    addItem(c.characters[idxOf(c, 'fighter')]!.inventory, 'plate');
    const r = morningReview(NIGHT, c);
    expect(r?.open).toBe('gear');
    expect(r?.note).toContain('Plate');
  });

  it('skips straight to the spellbook when only spells need doing', () => {
    const c = party();
    const w = idxOf(c, 'wizard');
    if (w < 0) return;
    c.xp = 6500;
    c.characters[w]!.prepared = [];
    expect(morningReview(NIGHT, c)?.open).toBe('spells');
  });
});
