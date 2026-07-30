import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { SPELLS } from '../src/data/spells.js';

/**
 * Every implemented spell, checked field by field against the SRD text vendored
 * at `SRD_CC_v5.2.1.txt` — level, casting time, range and concentration.
 *
 * The existing `srd-spell-lists.test.ts` pins *which* spells a class gets. This
 * pins that each spell's own stat line is right, which is a different and
 * sneakier class of error: the spell exists, is on the right list, is cast, and
 * is quietly stronger or weaker than the book. Nine were wrong when this was
 * written, and every one of them looked completely plausible:
 *
 *   Sleep, Suggestion, Spiritual Weapon, Shining Smite,
 *   Ensnaring Strike, Guidance     not marked Concentration
 *   Animal Friendship              range 0 (touch), SRD says 30 feet
 *   Banishment                     range 60 feet, SRD says 30
 *   Lesser Restoration             an action, SRD says a Bonus Action
 *
 * Spiritual Weapon is the one that mattered: a cleric could hold it *and*
 * Spirit Guardians at once, which the rules exist to prevent.
 *
 * The parsing is deliberately dumb — find "Level N School (Classes)" or
 * "School Cantrip (Classes)", take the name off the line above and the stat
 * line off the lines below. Nothing here needs to understand the spell.
 */

const SRD = fileURLToPath(new URL('../SRD_CC_v5.2.1.txt', import.meta.url));

interface SrdSpell {
  name: string;
  level: number;
  castingTime: string;
  range: string;
  duration: string;
  concentration: boolean;
}

function parseSrd(): Map<string, SrdSpell> {
  const lines = readFileSync(SRD, 'utf8').split('\n');
  const out = new Map<string, SrdSpell>();
  const header = /^(?:Level (\d) (\w+)|(\w+) Cantrip) \(([^)]+)\)$/;
  for (let i = 1; i < lines.length; i++) {
    const m = lines[i]!.trim().match(header);
    if (!m) continue;
    const name = lines[i - 1]!.trim();
    // The name sits on its own line directly above. Anything with sentence
    // punctuation is prose that happened to end near a header.
    if (!name || name.length > 40 || /[.:;]/.test(name)) continue;
    /**
     * The stat line wraps for the long ones ("Casting Time: Bonus Action, which
     * you take immediately after hitting..."), so gather a few lines and let
     * each field regex find its own end.
     *
     * A fixed three-line window was not enough. Hold Monster's entry straddles a
     * PAGE BREAK, so its Components/Duration line sits five lines below the
     * header with a page footer and two blanks in between — the parser read its
     * range and duration as empty, and the concentration check then reported the
     * spell as disagreeing with an SRD that says no such thing.
     *
     * So the window runs forward to the next spell header instead of a fixed
     * distance, dropping the page furniture on the way.
     */
    const FOOTER = /^\d+\s+System Reference Document/;
    const window: string[] = [];
    for (let j = i + 1; j < lines.length && window.length < 4; j++) {
      const line = lines[j]!;
      if (header.test(line.trim())) break;      // next spell's stat line
      if (!line.trim() || FOOTER.test(line.trim())) continue;
      window.push(line);
    }
    const meta = window.join(' ');
    if (!meta.startsWith('Casting Time:')) continue;
    // Duration runs to the end of whichever *physical* line carries it — on the
    // joined string it would swallow the next spell's name.
    const durLine = window.find((l) => l.includes('Duration:')) ?? '';
    const duration = durLine.match(/Duration:\s*(.+?)\s*$/)?.[1] ?? '';
    // First block wins: the magic-item chapter repeats a few spell names.
    const key = name.toLowerCase();
    if (out.has(key)) continue;
    out.set(key, {
      name,
      level: m[1] ? Number(m[1]) : 0,
      castingTime: meta.match(/Casting Time:\s*(.+?)\s+Range:/)?.[1] ?? '',
      range: meta.match(/Range:\s*(.+?)\s+Components?:/)?.[1] ?? '',
      duration,
      concentration: /Concentration/i.test(duration),
    });
  }
  return out;
}

/**
 * Spells whose stat line deliberately differs, each with the reason. An empty
 * reason is not allowed: if a deviation cannot be justified in a sentence it is
 * a bug, not a decision.
 */
const DELIBERATE: Record<string, string> = {
  'find-familiar': [
    'SRD casting time is "1 hour or Ritual". This game is a combat simulator with',
    'no out-of-combat clock, so the ritual is folded into an action — the `ritual`',
    'flag still keeps it off the known-spells budget, which is the part that has',
    'mechanical meaning here.',
  ].join(' '),
};

/**
 * Spells the SRD does not carry under the name we use. Kept explicit so a
 * misspelling cannot hide among them.
 */
const NOT_IN_SRD: Record<string, string> = {
  'blindness': 'SRD calls it "Blindness/Deafness". There is no deafened condition in this engine, so the implementation is the blindness half and the name says so rather than over-claiming.',
  'breath-weapon': 'Not an SRD spell — the dragonborn species trait, implemented through the spell system so it can reuse cone targeting and saves.',
};

const CASTING_TIME: Record<string, string> = {
  action: 'Action',
  bonus: 'Bonus Action',
  reaction: 'Reaction',
};

describe('spell stat lines against the SRD', () => {
  const srd = parseSrd();

  it('parses the spell descriptions out of the vendored SRD', () => {
    // If the file is replaced by a revision with a different layout, every
    // assertion below would pass vacuously. Guard the parser first.
    expect(srd.size, 'the SRD parser found almost nothing — has the file changed shape?').toBeGreaterThan(300);
    expect(srd.get('fireball')).toMatchObject({ level: 3, range: '150 feet', concentration: false });
    expect(srd.get('spirit guardians')).toMatchObject({ level: 3, concentration: true });
  });

  it('names every implemented spell the way the SRD does', () => {
    const missing = Object.values(SPELLS)
      .filter((s) => !srd.has(s.name.toLowerCase()) && !NOT_IN_SRD[s.id])
      .map((s) => `${s.id} ("${s.name}")`);
    expect(missing, `not found in the SRD by name — a typo, or add it to NOT_IN_SRD with a reason: ${missing.join(', ')}`).toEqual([]);
  });

  it('every deviation is justified, and every justification is used', () => {
    for (const [id, why] of Object.entries({ ...DELIBERATE, ...NOT_IN_SRD })) {
      expect(SPELLS[id], `${id} is listed as a deviation but is not a spell any more`).toBeDefined();
      expect(why.length, `${id} has no reason given`).toBeGreaterThan(30);
    }
  });

  /**
   * `concentration: true` is a claim about behaviour, and the behaviour lives in
   * each spell's `cast` closure — nothing makes the flag and the closure agree.
   * Six spells declared it and never took any, so the flag did nothing at all:
   * the caster could hold the spell *and* something else, which is the entire
   * rule. Banishment was one of them and predates this pass — flagged
   * concentration since it was written, never taking it, permanently removing a
   * creature for free.
   */
  it('every spell that declares concentration actually takes it', async () => {
    const { Combat } = await import('../src/engine/combat.js');
    const { buildCharacter } = await import('../src/builder/character.js');
    const { buildMonster } = await import('../src/data/monsters.js');
    const { CLASSES } = await import('../src/data/classes.js');

    const wrong: string[] = [];
    const unreachable: string[] = [];
    for (const spell of Object.values(SPELLS).filter((x) => x.concentration)) {
      // Guidance never resolves in a fight at all (`outOfCombat`), so there is
      // no cast to check — the flag is there to be true to the book.
      if (spell.outOfCombat) continue;
      let cast = false;
      for (const classId of Object.keys(CLASSES)) {
        const hero = buildCharacter({
          classId, team: 'team1', level: 7, name: 'H', position: { x: 4, y: 1 }, speciesId: 'human',
        });
        if (!hero.spellIds.includes(spell.id)) continue;
        // A knight, not an ogre: Heat Metal returns early with nothing to heat,
        // and a target in no armour would read as a spell that skips its own
        // concentration.
        const foes = [0, 1].map((k) => ({
          ...buildMonster('knight', 'team2', { x: 4 + k, y: 3 }), id: `f${k}`,
        }));
        const c = new Combat({ seed: 4, width: 10, height: 10, combatants: [hero, ...foes] });
        for (let i = 0; i < 30 && c.activeId !== hero.id; i++) c.apply({ kind: 'endTurn' });
        if (c.activeId !== hero.id) continue;
        const action = c.legalActions(hero.id).find((a) => a.kind === 'castSpell' && a.spellId === spell.id);
        if (!action) continue;
        cast = true;
        c.apply(action);
        const held = c.state.combatants[hero.id]!.concentratingOn?.spellId;
        if (held !== spell.id) {
          wrong.push(`${spell.name} (${spell.id}): after casting, concentratingOn is ${held ?? 'nothing'}`);
        }
        break;
      }
      if (!cast) unreachable.push(spell.id);
    }
    expect(wrong, `spells whose concentration flag does nothing:\n${wrong.join('\n')}`).toEqual([]);
    // Not a failure — a spell only a monster carries has no class to cast it
    // from — but if this grew to cover most of them the check would be hollow.
    expect(unreachable.length, `too many unreachable to be meaningful: ${unreachable.join(', ')}`).toBeLessThan(6);
  }, 30000);

  it('matches the SRD on level, casting time, range and concentration', () => {
    const wrong: string[] = [];
    for (const s of Object.values(SPELLS)) {
      const r = srd.get(s.name.toLowerCase());
      if (!r || DELIBERATE[s.id]) continue;

      if (r.level !== s.level) wrong.push(`${s.name}: level ${s.level}, SRD says ${r.level}`);
      if (!r.castingTime.startsWith(CASTING_TIME[s.castingTime]!)) {
        wrong.push(`${s.name}: castingTime '${s.castingTime}', SRD says '${r.castingTime}'`);
      }
      if (r.concentration !== s.concentration) {
        wrong.push(`${s.name}: concentration ${s.concentration}, SRD Duration is '${r.duration}'`);
      }
      // Range, only where our targeting declares a number to compare. Self and
      // Touch spells carry their reach in the targeting *kind*, not a distance.
      const t = s.targeting as { range?: number };
      if (typeof t.range === 'number') {
        const feet = Number(r.range.match(/^(\d+) f/)?.[1] ?? NaN);
        if (!Number.isNaN(feet) && feet !== t.range) {
          wrong.push(`${s.name}: range ${t.range} ft, SRD says '${r.range}'`);
        }
      }
    }
    expect(wrong, `stat lines that disagree with the SRD:\n${wrong.join('\n')}`).toEqual([]);
  });
});

describe('concentration is actually load-bearing', () => {
  /**
   * Marking a spell `concentration: true` is only worth anything if something
   * enforces one at a time — and the summon sweep in breakConcentration used to
   * name Flaming Sphere specifically, so a newly-concentration Spiritual Weapon
   * would have outlived the concentration holding it.
   */
  it('a second concentration spell replaces the first, and takes its summon away', async () => {
    const { Combat } = await import('../src/engine/combat.js');
    const { buildCharacter } = await import('../src/builder/character.js');
    const { buildMonster } = await import('../src/data/monsters.js');

    const cleric = buildCharacter({
      classId: 'cleric', team: 'team1', level: 7, name: 'C', position: { x: 4, y: 1 }, speciesId: 'human',
    });
    const foe = { ...buildMonster('ogre', 'team2', { x: 4, y: 3 }), id: 'f' };
    const c = new Combat({ seed: 4, width: 10, height: 10, combatants: [cleric, foe] });
    for (let i = 0; i < 20 && c.activeId !== cleric.id; i++) c.apply({ kind: 'endTurn' });

    const weapon = c.legalActions(cleric.id)
      .find((a) => a.kind === 'castSpell' && a.spellId === 'spiritual-weapon');
    expect(weapon, 'Spiritual Weapon not offered').toBeDefined();
    c.apply(weapon!);
    expect(c.state.combatants[cleric.id]!.concentratingOn?.spellId).toBe('spiritual-weapon');
    expect(c.state.combatants[cleric.id]!.summons?.length).toBe(1);

    // Spirit Guardians is an action, Spiritual Weapon a bonus action, so both
    // are castable on the same turn — which is exactly the stacking the
    // concentration rule exists to stop.
    const guardians = c.legalActions(cleric.id)
      .find((a) => a.kind === 'castSpell' && a.spellId === 'spiritual-guardians');
    expect(guardians, 'Spirit Guardians not offered').toBeDefined();
    c.apply(guardians!);

    const after = c.state.combatants[cleric.id]!;
    expect(after.concentratingOn?.spellId, 'the new spell must take concentration').toBe('spiritual-guardians');
    expect(after.summons ?? [], 'the weapon must vanish with the concentration that held it').toEqual([]);
  });
});
