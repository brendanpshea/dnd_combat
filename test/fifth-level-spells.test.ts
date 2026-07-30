/**
 * The 5th-level spell tier, and the ninth level that reaches it.
 *
 * WHY BOTH IN ONE CHANGE. A 5th-level spell is unreachable without a 5th-level
 * slot, and nothing in this game had one: `LEVEL_XP` stopped at 8 and every
 * `slotsByLevel` row was eight entries long. Shipping the spells alone would
 * have added five spells that no character could ever cast — the "dead data"
 * failure this codebase keeps re-learning — so the level came with them.
 *
 * WHICH FIVE, AND HOW THEY WERE CHOSEN. By how many SRD class lists carry them,
 * read out of `SRD_CC_v5.2.1.txt` in this repo rather than recalled. That
 * mattered: the first draft's fifth spell was Synaptic Static, picked for being
 * on four lists, and it is not in SRD 5.2 at all. Grepping the document caught
 * it; nothing else would have, because it is a real spell in the 2024 Player's
 * Handbook and every plausibility check it faced, it passed.
 *
 * The test below re-derives the class lists from that document at runtime, so
 * the next spell added this way is checked against the SRD rather than against
 * whoever adds it.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { CLASSES } from '../src/data/classes.js';
import { SPELLS } from '../src/data/spells.js';
import { MAX_LEVEL, LEVEL_XP, levelForXp, newCampaign, setPartyClass, buildCampaignParty } from '../src/campaign/campaign.js';
import { buildCharacter } from '../src/builder/character.js';
import { buildMonster } from '../src/data/monsters.js';
import { Combat } from '../src/engine/combat.js';
import { isLegalAction } from '../src/engine/actions.js';
import { cellAt } from '../src/engine/types.js';
import type { Id } from '../src/engine/types.js';

const NEW_SPELLS = ['hold-monster', 'cone-of-cold', 'flame-strike', 'insect-plague', 'mass-cure-wounds'];

/** The SRD's own 5th-level class lists, parsed from the document in this repo. */
function srdFifthLevelLists(): Record<string, Set<string>> {
  const text = readFileSync(fileURLToPath(new URL('../SRD_CC_v5.2.1.txt', import.meta.url)), 'utf8');
  const lines = text.split('\n');
  const out: Record<string, Set<string>> = {};
  for (let i = 1; i < lines.length; i++) {
    const m = lines[i]!.trim().match(/^Level 5 [A-Za-z]+ \(([^)]*)\)$/);
    if (!m) continue;
    const name = lines[i - 1]!.trim();
    if (!name || name.length > 40) continue;
    const id = name.toLowerCase().replace(/'/g, '').replace(/ /g, '-');
    for (const cls of m[1]!.split(',').map((c) => c.trim().toLowerCase())) {
      (out[cls] ??= new Set()).add(id);
    }
  }
  return out;
}

describe('the five spells are the SRD’s, on the SRD’s lists', () => {
  const SRD = srdFifthLevelLists();

  it('parses a believable 5th-level tier out of the document', () => {
    // A guard on the parser itself: if the SRD file moved or the format
    // changed, every assertion below would pass vacuously.
    expect(Object.keys(SRD).length).toBeGreaterThanOrEqual(6);
    expect(SRD['wizard']!.size).toBeGreaterThan(10);
  });

  it('every new spell exists and is actually 5th level', () => {
    for (const id of NEW_SPELLS) {
      expect(SPELLS[id], `${id} is not a spell`).toBeDefined();
      expect(SPELLS[id]!.level, id).toBe(5);
    }
  });

  it('no class is granted a 5th-level spell that is not on its SRD list', () => {
    /**
     * The assertion that would have caught Synaptic Static. It is deliberately
     * about the SRD document and not about a transcription of it: a list typed
     * out by hand can be typed out wrong in exactly the way the spell was
     * chosen wrong.
     */
    for (const cls of Object.values(CLASSES)) {
      const granted = Object.entries(cls.spellcasting?.spellsByLevel ?? {})
        .flatMap(([, ids]) => ids)
        .filter((id) => SPELLS[id]?.level === 5);
      for (const id of granted) {
        expect(
          SRD[cls.id]?.has(id),
          `${cls.id} grants ${id}, which the SRD does not put on its 5th-level list`,
        ).toBe(true);
      }
    }
  });

  it('gives every class that reaches a 5th-level slot something to put in it', () => {
    for (const cls of Object.values(CLASSES)) {
      const atNine = cls.spellcasting?.slotsByLevel[8];
      if (!atNine || (atNine[4] ?? 0) === 0) continue;
      const fifth = Object.entries(cls.spellcasting!.spellsByLevel)
        .flatMap(([, ids]) => ids)
        .filter((id) => SPELLS[id]?.level === 5);
      expect(fifth.length, `${cls.id} gets a 5th-level slot and no 5th-level spell`).toBeGreaterThan(0);
    }
  });
});

describe('level 9 exists and is reached', () => {
  it('extends the ladder by one rung', () => {
    expect(MAX_LEVEL).toBe(9);
    expect(LEVEL_XP.length).toBe(9);
    expect(levelForXp(48000)).toBe(9);
    expect(levelForXp(47999)).toBe(8);
  });

  it('every per-level caster table grew with it', () => {
    /**
     * The failure this catches is silent rather than loud: `levelTable` clamps
     * to the LAST entry, so a table left eight long would quietly hand a
     * 9th-level wizard its 8th-level prepared count and nobody would see an
     * error — just a caster that stopped growing.
     */
    for (const cls of Object.values(CLASSES)) {
      const sc = cls.spellcasting;
      if (!sc) continue;
      expect(sc.slotsByLevel.length, `${cls.id} slotsByLevel`).toBe(9);
      for (const [name, table] of [
        ['cantripsKnownByLevel', sc.cantripsKnownByLevel],
        ['preparedByLevel', sc.preparedByLevel],
        ['spellbookByLevel', sc.spellbookByLevel],
      ] as const) {
        if (table) expect(table.length, `${cls.id} ${name}`).toBe(9);
      }
    }
  });

  it('a level-9 full caster actually walks in holding a 5th-level spell', () => {
    // End to end, through the campaign builder rather than the class table —
    // the slot, the prepared count and the list order all have to agree.
    for (const classId of ['wizard', 'cleric', 'druid', 'sorcerer', 'bard']) {
      const c = newCampaign(1);
      setPartyClass(c, 0, classId);
      c.xp = 48000;
      const built = buildCampaignParty(c)[0]!;
      expect(built.level, classId).toBe(9);
      expect(built.spellSlots[4]?.max, `${classId} has no 5th-level slot`).toBeGreaterThan(0);
      const fifth = built.spellIds.filter((id) => SPELLS[id]?.level === 5);
      expect(fifth.length, `${classId} prepares no 5th-level spell`).toBeGreaterThan(0);
    }
  });

  it('gives the warlock a 5th-level pact slot', () => {
    const w = buildCharacter({ classId: 'warlock', team: 'team1', position: { x: 0, y: 0 }, level: 9 });
    expect(w.spellSlots[4]?.max).toBe(2);
    expect(w.spellIds).toContain('hold-monster');
  });

  /**
   * THE HOLE THIS CHANGE LEAVES, named here so it is recorded in code rather
   * than only in a comment.
   *
   * Level 9 is a spell level, so the six full casters gain a 5th-level slot and
   * the paladin and ranger gain a 3rd — eight of the twelve classes get
   * something real. The four below gain NOTHING. The SRD gives them Indomitable
   * (fighter), Brutal Strike (barbarian), Steady Aim (rogue) and Acrobatic
   * Movement (monk), and none of those are implemented.
   *
   * Delete a name from this list when its feature lands; delete the test when
   * the list is empty.
   */
  it('records which classes still gain nothing at level 9', () => {
    const KNOWN_GAP = ['barbarian', 'fighter', 'monk', 'rogue'];
    const empty: string[] = [];
    for (const cls of Object.values(CLASSES)) {
      const fromTable = cls.featuresByLevel[9] ?? [];
      const fromChoices = (cls.choices ?? []).filter((ch) => ch.atLevel === 9);
      const slots = cls.spellcasting?.slotsByLevel;
      const grew = slots !== undefined && (slots[8]?.length ?? 0) > (slots[7]?.length ?? 0);
      if (fromTable.length + fromChoices.length === 0 && !grew) empty.push(cls.id);
    }
    expect(empty.sort()).toEqual(KNOWN_GAP);
  });
});

describe('Hold Person and Hold Monster split the bestiary', () => {
  const cast = (spellId: Id, monsterId: string) => {
    const base = buildCharacter({ classId: 'wizard', team: 'team1', position: { x: 1, y: 3 }, level: 9 });
    // Both spells forced into the prepared list: what is under test is the
    // TARGETING gate, not whether auto-prepare happened to pick them.
    const hero = { ...base, spellIds: [...new Set([...base.spellIds, 'hold-person', 'hold-monster'])] };
    const foe = { ...buildMonster(monsterId, 'team2', { x: 3, y: 3 }, '1'), id: 'foe' };
    const c = new Combat({ combatants: [hero, foe], seed: 4, mapId: 'open' });
    let guard = 0;
    while (c.activeId !== hero.id && guard++ < 20) c.apply({ kind: 'endTurn' });
    return isLegalAction(c.state, hero.id, {
      kind: 'castSpell', spellId,
      slotLevel: SPELLS[spellId]!.level,
      targets: [{ combatantId: 'foe' }],
    });
  };

  it('Hold Person now refuses everything that is not a humanoid', () => {
    // The SRD gate that was simply missing: this spell has been paralysing
    // dragons for a 2nd-level slot.
    expect(cast('hold-person', 'bandit')).toBe(true);
    expect(cast('hold-person', 'ogre')).toBe(false);
  });

  it('and Hold Monster is the one that does not care', () => {
    // Without this the 5th-level spell would be strictly worse than the
    // 2nd-level one, which is the whole reason Hold Person was gated.
    expect(cast('hold-monster', 'bandit')).toBe(true);
    expect(cast('hold-monster', 'ogre')).toBe(true);
  });

  it('leaves Hold Person off the front of every class line', () => {
    // A spell that answers 18 of 143 monsters must not be the first 2nd-level
    // spell auto-prepare reaches for.
    for (const cls of Object.values(CLASSES)) {
      for (const ids of Object.values(cls.spellcasting?.spellsByLevel ?? {})) {
        if (ids.includes('hold-person') && ids.length > 1) {
          expect(ids[0], `${cls.id} still leads with Hold Person`).not.toBe('hold-person');
        }
      }
    }
  });
});

describe('Insect Plague leaves a swarm behind', () => {
  it('stamps a hazard that damages whoever walks in, as piercing', () => {
    /**
     * The generalisation this spell needed: `cell.fire` was Wall of Fire's, and
     * hard-coded to fire damage on a Dexterity 15 save. A swarm of locusts is
     * neither, so the cell carries its damage type and save now.
     */
    const hero = buildCharacter({ classId: 'druid', team: 'team1', position: { x: 1, y: 1 }, level: 9 });
    const foe = { ...buildMonster('ogre', 'team2', { x: 6, y: 6 }, '1'), id: 'foe' };
    const c = new Combat({ combatants: [hero, foe], seed: 3, mapId: 'open' });
    let guard = 0;
    while (c.activeId !== hero.id && guard++ < 20) c.apply({ kind: 'endTurn' });
    c.apply({ kind: 'castSpell', spellId: 'insect-plague', slotLevel: 5, targets: [{ position: { x: 3, y: 3 } }] });
    const cell = cellAt(c.state.grid, { x: 3, y: 3 })!;
    expect(cell.fire, 'no swarm on the board').toBeDefined();
    expect(cell.fire!.damageType).toBe('piercing');
    expect(cell.fire!.save?.ability).toBe('con');
  });

  it('and Wall of Fire still burns as fire on a Dexterity save', () => {
    // The other half of a generalisation: the caller that did not change must
    // keep its old behaviour, which defaults rather than restates it.
    const hero = buildCharacter({ classId: 'wizard', team: 'team1', position: { x: 1, y: 1 }, level: 9 });
    const foe = { ...buildMonster('ogre', 'team2', { x: 6, y: 6 }, '1'), id: 'foe' };
    const c = new Combat({ combatants: [hero, foe], seed: 3, mapId: 'open' });
    let guard = 0;
    while (c.activeId !== hero.id && guard++ < 20) c.apply({ kind: 'endTurn' });
    c.apply({ kind: 'castSpell', spellId: 'wall-of-fire', slotLevel: 4, targets: [{ position: { x: 3, y: 3 } }] });
    const cell = cellAt(c.state.grid, { x: 3, y: 3 })!;
    expect(cell.fire).toBeDefined();
    expect(cell.fire!.damageType).toBeUndefined();   // absent = the wall's own fire
    expect(cell.fire!.save).toBeUndefined();         // absent = Dexterity 15
  });
});
