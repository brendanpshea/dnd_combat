/**
 * Find Steed: the first SPELL to conjure a real creature.
 *
 * Eight magic items already used `summonCombatant` — a full combatant with its
 * own stat block, hit points, AC and initiative slot, driven by the same AI
 * that drives the monsters. No spell did. This is that machinery finally
 * reached from the paladin's spell list, and Conjure Elemental is the useful
 * contrast: that one LOOKED like a summon and turned out, on reading the 2024
 * SRD, to be an intangible zone. This one really is a creature, and the SRD
 * says so in as many words.
 *
 * FOUR DELIBERATE DEPARTURES, all pulling the same way — the spell is cast
 * before the doors open, and the game only simulates what happens after:
 *
 *   - a BONUS action, not an action (declared in `srd-spell-stats.test.ts`)
 *   - always the CELESTIAL steed, so Healing Touch is always the bonus action
 *   - it SURVIVES its paladin going down, because down is not dead here
 *   - no mount: there are no mounted-combat rules, so it fights alongside
 *
 * The stat block is checked against the document below rather than trusted,
 * because the steed is printed inside the spell entry with "CR None" and so is
 * invisible to `srd-monsters.test.ts`'s bestiary parser.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { buildCharacter } from '../src/builder/character.js';
import { buildMonster, MONSTERS } from '../src/data/monsters.js';
import { Combat } from '../src/engine/combat.js';
import { SPELLS } from '../src/data/spells.js';
import { CLASSES } from '../src/data/classes.js';
import { FEATURES } from '../src/data/features.js';
import { actsOnItsOwn, livingParty } from '../src/engine/rules/summon.js';
import { kill } from '../src/engine/rules/attack.js';
import { legalActions } from '../src/engine/actions.js';
import { acOf } from '../src/data/armor.js';
import type { Position } from '../src/engine/types.js';

const at = (x: number, y: number): Position => ({ x, y });

/** A paladin who can cast it, and something to fight. */
function field(level = 9, seed = 4) {
  const hero = { ...buildCharacter({ classId: 'paladin', team: 'team1', position: at(1, 1), level }), id: 'pal' };
  const foe = { ...buildMonster('ogre', 'team2', at(6, 6), '1'), id: 'foe' };
  const c = new Combat({ combatants: [hero, foe], seed, mapId: 'open' });
  let guard = 0;
  while (c.activeId !== 'pal' && guard++ < 30) c.apply({ kind: 'endTurn' });
  return c;
}

const steedOf = (c: Combat) =>
  Object.values(c.state.combatants).find((x) => x.classId === 'otherworldly-steed');

const cast = (c: Combat, slotLevel = 2) =>
  c.apply({ kind: 'castSpell', spellId: 'find-steed', slotLevel, targets: [{ position: at(2, 2) }] });

describe('the stat block matches the SRD', () => {
  const doc = readFileSync(fileURLToPath(new URL('../SRD_CC_v5.2.1.txt', import.meta.url)), 'utf8');

  it('is quoting a document that still says what we think', () => {
    // Guards the guard: if the entry moved or was reworded, the assertions
    // below would pass by matching nothing.
    expect(doc).toContain('Otherworldly Steed');
    expect(doc).toContain('AC 10 + 1 per spell level');
  });

  it('has the SRD ability scores', () => {
    // Str 18, Dex 12, Con 14, Int 6, Wis 12, Cha 8 — read off the block.
    expect(MONSTERS['otherworldly-steed']!.abilities)
      .toEqual({ str: 18, dex: 12, con: 14, int: 6, wis: 12, cha: 8 });
    expect(MONSTERS['otherworldly-steed']!.speed).toBe(60);
    expect(MONSTERS['otherworldly-steed']!.size).toBe('large');
    expect(MONSTERS['otherworldly-steed']!.creatureType).toBe('celestial');
  });

  it('scales its AC and hit points with the slot, per "the spell’s level"', () => {
    // AC 10 + level, HP 5 + 10 per level. A 2nd-level cast is AC 12 / 25 HP;
    // a 4th is AC 14 / 45 HP.
    // 2nd and 3rd only: see the flight test for why 4th is unreachable.
    for (const [slot, ac, hp] of [[2, 12, 25], [3, 13, 35]] as const) {
      const c = field();
      cast(c, slot);
      const s = steedOf(c)!;
      expect(s, `no steed at slot ${slot}`).toBeDefined();
      expect(s.maxHp, `slot ${slot} hp`).toBe(hp);
      expect(acOf(s), `slot ${slot} ac`).toBe(ac);
    }
  });

  it('cannot fly, because no paladin can reach the slot that would grant it', () => {
    /**
     * The stat block says "Fly 60 ft. (requires level 4+ spell)", and that
     * clause is deliberately not implemented. Find Steed is paladin-only and a
     * half-caster's slots stop at 3rd — a level-9 paladin has [4, 3, 2]. A
     * `slotLevel >= 4` branch would read as a feature and never once run.
     *
     * This test is the record of WHY the line is absent, and it starts failing
     * the day paladins reach a 4th-level slot — which is exactly when the line
     * should come back.
     */
    const slots = CLASSES['paladin']!.spellcasting!.slotsByLevel;
    const best = Math.max(...slots.map((row) => row.filter((n) => n > 0).length));
    expect(best, 'paladins can now reach a 4th-level slot — restore the fly clause').toBeLessThan(4);
    const c = field(); cast(c, 3);
    expect(steedOf(c)!.flying).toBeFalsy();
  });
});

describe('it is a real combatant the AI drives', () => {
  it('joins the board and the initiative order, right after its paladin', () => {
    const c = field();
    cast(c);
    const s = steedOf(c)!;
    expect(s).toBeDefined();
    expect(c.state.initiativeOrder).toContain(s.id);
    expect(c.state.initiativeOrder.indexOf(s.id)).toBe(c.state.initiativeOrder.indexOf('pal') + 1);
  });

  it('runs itself, and is not counted as part of the party', () => {
    /**
     * The three things that make a summon safe, all at once: the AI drives it,
     * the win check ignores it, and it can never be read back into a campaign
     * roster as a fifth party member.
     */
    const c = field();
    cast(c);
    const s = steedOf(c)!;
    expect(actsOnItsOwn(s)).toBe(true);
    expect(livingParty(c.state, 'team1').map((x) => x.id)).toEqual(['pal']);
  });

  it('wears the unicorn’s art without being the CR-5 Unicorn', () => {
    const c = field();
    cast(c);
    expect(steedOf(c)!.portraitId).toBe('unicorn');
    // The real unicorn is a different, far stronger creature.
    expect(MONSTERS['unicorn']!.hp).toBeGreaterThan(90);
    expect(MONSTERS['otherworldly-steed']!.hp).toBeLessThan(30);
  });

  it('costs a bonus action, so the paladin still gets to swing', () => {
    const c = field();
    cast(c);
    const pal = c.state.combatants['pal']!;
    expect(pal.turn.bonusActionUsed).toBe(true);
    expect(pal.turn.actionUsed, 'conjuring ate the paladin’s action').toBe(false);
  });

  it('replaces itself rather than building a herd', () => {
    // The SRD: "If you already have a steed from this spell, the steed is
    // replaced by the new one."
    const c = field();
    cast(c);
    expect(steedOf(c)!.maxHp).toBe(25);
    c.state.combatants['pal']!.turn.bonusActionUsed = false;
    cast(c, 3);
    const all = Object.values(c.state.combatants).filter((x) => x.classId === 'otherworldly-steed');
    expect(all.length, 'a second steed joined the first').toBe(1);
    // The replacement is the NEW one — a bigger slot, so a bigger steed.
    expect(all[0]!.maxHp).toBe(35);
    // And exactly one slot in the initiative order, not two.
    expect(c.state.initiativeOrder.filter((x) => x === all[0]!.id).length).toBe(1);
  });
});

describe('when the paladin falls', () => {
  it('stays on the board while its paladin is merely down', () => {
    /**
     * The departure that matters most in play. The SRD dismisses the steed when
     * you DIE; a hero at 0 hit points here is unconscious and comes back the
     * moment anything heals them. A steed that vanished then would vanish at
     * exactly the moment its paladin most needed something standing over the
     * body.
     */
    const c = field();
    cast(c);
    const pal = c.state.combatants['pal']!;
    pal.hp = 0;
    expect(steedOf(c), 'the steed left its paladin on the floor').toBeDefined();
    expect(steedOf(c)!.alive).toBe(true);
  });

  it('but goes with them when they actually die', () => {
    const c = field();
    cast(c);
    expect(steedOf(c)).toBeDefined();
    kill(c.state, 'pal');
    expect(steedOf(c), 'a steed outlived the mind that conjured it').toBeUndefined();
    expect(c.state.initiativeOrder).not.toContain('steed');
  });
});

describe('Healing Touch', () => {
  it('is the steed’s bonus action, once a day', () => {
    const s = buildMonster('otherworldly-steed', 'team1', at(0, 0));
    expect(s.featureIds).toContain('healing-touch');
    expect(s.featureUses['healing-touch']?.max).toBe(1);
    expect(FEATURES['healing-touch']!.trigger).toBe('bonus');
  });

  it('heals the ally closest to the floor, and only one within reach', () => {
    const c = field();
    cast(c);
    const s = steedOf(c)!;
    const pal = c.state.combatants['pal']!;
    pal.hp = 5;
    // Stand the steed beside its paladin so the heal has somewhere to land.
    const cell = c.state.grid.cells[s.position.y * c.state.grid.width + s.position.x]!;
    delete cell.occupantId;
    s.position = { x: pal.position.x + 1, y: pal.position.y };
    const events = FEATURES['healing-touch']!.apply!({ state: c.state, actorId: s.id });
    expect(events.some((e) => e.type === 'healed')).toBe(true);
    expect(pal.hp).toBeGreaterThan(5);
  });

  it('does nothing when nobody nearby is hurt', () => {
    const c = field();
    cast(c);
    const s = steedOf(c)!;
    expect(FEATURES['healing-touch']!.apply!({ state: c.state, actorId: s.id })).toEqual([]);
  });

  it('is offered to the steed on its own turn', () => {
    // Dead data check: a feature nothing ever reaches fails silently.
    const c = field();
    cast(c);
    const s = steedOf(c)!;
    const pal = c.state.combatants['pal']!;
    pal.hp = 5;
    let guard = 0;
    while (c.activeId !== s.id && guard++ < 20) c.apply({ kind: 'endTurn' });
    const offered = legalActions(c.state, s.id)
      .filter((a) => a.kind === 'useFeature' && a.featureId === 'healing-touch');
    expect(offered.length, 'the steed is never offered its own heal').toBeGreaterThan(0);
  });
});

describe('the paladin can actually get there', () => {
  it('is on the paladin list at the level its 2nd-level slots arrive', () => {
    const line = CLASSES['paladin']!.spellcasting!.spellsByLevel[5] ?? [];
    expect(line).toContain('find-steed');
    // Leads the line: auto-prepare takes the first of each spell level, and a
    // second body on the board outvalues any one-shot 2nd-level effect.
    expect(line[0]).toBe('find-steed');
    expect(SPELLS['find-steed']!.level).toBe(2);
  });

  it('walks in holding it', () => {
    const p = buildCharacter({ classId: 'paladin', team: 'team1', position: at(0, 0), level: 9 });
    expect(p.spellIds).toContain('find-steed');
    expect(p.spellSlots[1]?.max, 'no 2nd-level slot to cast it from').toBeGreaterThan(0);
  });
});
