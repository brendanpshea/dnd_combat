/**
 * Summon Dragon and Animate Objects: conjured creatures the AI plays.
 *
 * These are the two spells that really needed the summon machinery, and between
 * them they forced the two gaps it still had:
 *
 *   - MULTIPLE SUMMONS AT ONCE. The id was `${hint}-${summoner}-${round}` with
 *     a guard that silently dropped a duplicate, so Animate Objects would have
 *     put one object on the board and quietly discarded the other three.
 *   - CONCENTRATION. `breakConcentration` swept the pseudo-summons (Spiritual
 *     Weapon, Flaming Sphere) and knew nothing about summoned COMBATANTS, so a
 *     dragon spirit would have fought on after the mind holding it wandered.
 *
 * The concentration sweep is scoped to the SPELL and not merely the caster,
 * which is what `summonSpell` is for: a paladin's steed is not concentration at
 * all and must survive somebody else's broken Fireball.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { buildCharacter } from '../src/builder/character.js';
import { buildMonster, MONSTERS } from '../src/data/monsters.js';
import { Combat } from '../src/engine/combat.js';
import { SPELLS } from '../src/data/spells.js';
import { CLASSES } from '../src/data/classes.js';
import { actsOnItsOwn, livingParty } from '../src/engine/rules/summon.js';
import { breakConcentration } from '../src/engine/rules/attack.js';
import { reachCells } from '../src/engine/rules/reach.js';
import { chooseAction } from '../src/ai/greedy.js';
import { abilityMod, type Position, type Id } from '../src/engine/types.js';

const at = (x: number, y: number): Position => ({ x, y });

function field(classId: string, seed = 4) {
  const hero = { ...buildCharacter({ classId, team: 'team1', position: at(1, 1), level: 9 }), id: 'caster' };
  const foe = { ...buildMonster('ogre', 'team2', at(6, 6), '1'), id: 'foe' };
  const c = new Combat({ combatants: [hero, foe], seed, mapId: 'open' });
  let guard = 0;
  while (c.activeId !== 'caster' && guard++ < 30) c.apply({ kind: 'endTurn' });
  return c;
}

const summonsOf = (c: Combat, spellId: Id) =>
  Object.values(c.state.combatants).filter((x) => x.summonSpell === spellId);

const cast = (c: Combat, spellId: Id) =>
  c.apply({ kind: 'castSpell', spellId, slotLevel: 5, targets: [{ position: at(3, 3) }] });

describe('the stat blocks come off the document', () => {
  const doc = readFileSync(fileURLToPath(new URL('../SRD_CC_v5.2.1.txt', import.meta.url)), 'utf8');

  it('is quoting an SRD that still says what we think', () => {
    expect(doc).toContain('Draconic Spirit');
    expect(doc).toContain('AC 14 + the spell');
    expect(doc).toContain('Animated Object');
  });

  it('the dragon spirit has the SRD abilities, resistances and reach', () => {
    const d = MONSTERS['draconic-spirit']!;
    expect(d.abilities).toEqual({ str: 19, dex: 14, con: 17, int: 10, wis: 14, cha: 14 });
    expect([...d.resistances!].sort()).toEqual(['acid', 'cold', 'fire', 'lightning', 'poison']);
    expect(d.attacksPerAction, 'Multiattack is two Rends at a 5th-level cast').toBe(2);
    // "reach 10 feet", carried by the same feature a bugbear uses rather than a
    // second way of saying reach.
    expect(reachCells(buildMonster('draconic-spirit', 'team1', at(0, 0)))).toBe(2);
  });

  it('the animated object is the Medium-or-smaller row', () => {
    const o = MONSTERS['animated-object']!;
    expect(o.ac).toBe(15);
    expect(o.hp).toBe(10);
    expect(o.abilities.str).toBe(16);
    expect(o.immunities).toEqual(expect.arrayContaining(['poison', 'psychic']));
  });
});

describe('Animate Objects conjures a crowd', () => {
  it('makes one object per point of spellcasting modifier', () => {
    /**
     * The bug the id fix exists for: every object was built with the same id
     * and `summonCombatant`'s duplicate guard dropped all but the first, so a
     * 5th-level slot bought ONE 10-hit-point object.
     */
    for (const classId of ['wizard', 'sorcerer', 'bard']) {
      const c = field(classId);
      cast(c, 'animate-objects');
      const caster = c.state.combatants['caster']!;
      const want = Math.max(1, abilityMod(caster.abilities[caster.spellcastingAbility ?? 'int']));
      expect(want, `${classId} modifier`).toBeGreaterThan(1);
      expect(summonsOf(c, 'animate-objects').length, `${classId} objects`).toBe(want);
    }
  });

  it('gives every object its own place in the initiative order', () => {
    const c = field('wizard');
    cast(c, 'animate-objects');
    const ids = summonsOf(c, 'animate-objects').map((x) => x.id);
    expect(new Set(ids).size, 'two objects share an id').toBe(ids.length);
    for (const id of ids) {
      expect(c.state.initiativeOrder.filter((x) => x === id).length, id).toBe(1);
    }
  });

  it('stands them in different squares', () => {
    const c = field('wizard');
    cast(c, 'animate-objects');
    const spots = summonsOf(c, 'animate-objects').map((x) => `${x.position.x},${x.position.y}`);
    expect(new Set(spots).size, 'objects stacked in one square').toBe(spots.length);
  });
});

describe('they are creatures the AI plays', () => {
  for (const [spellId, classId] of [['summon-dragon', 'wizard'], ['animate-objects', 'wizard']] as const) {
    it(`${spellId} puts something on the board that runs itself`, () => {
      const c = field(classId);
      cast(c, spellId);
      const [s] = summonsOf(c, spellId);
      expect(s, `${spellId} summoned nothing`).toBeDefined();
      expect(actsOnItsOwn(s!)).toBe(true);
      // Never part of the party: not in the win check, not in a survivor list.
      expect(livingParty(c.state, 'team1').map((x) => x.id)).toEqual(['caster']);
    });

    it(`${spellId}'s summon takes a real turn`, () => {
      // Dead data check: a creature the AI has no action for would stand still
      // for the whole fight.
      const c = field(classId);
      cast(c, spellId);
      const s = summonsOf(c, spellId)[0]!;
      let guard = 0;
      while (c.activeId !== s.id && guard++ < 20) c.apply({ kind: 'endTurn' });
      expect(c.activeId, `${spellId} summon never got a turn`).toBe(s.id);
      const action = chooseAction(c.state, s.id);
      expect(action, 'the AI had nothing for it to do').toBeDefined();
      expect(action!.kind).not.toBe('endTurn');
    });
  }

  it('the dragon takes its turn immediately after its summoner', () => {
    const c = field('wizard');
    cast(c, 'summon-dragon');
    const s = summonsOf(c, 'summon-dragon')[0]!;
    expect(c.state.initiativeOrder.indexOf(s.id))
      .toBe(c.state.initiativeOrder.indexOf('caster') + 1);
  });
});

describe('concentration holds them up', () => {
  for (const spellId of ['summon-dragon', 'animate-objects'] as const) {
    it(`${spellId} vanishes when the caster stops concentrating`, () => {
      const c = field('wizard');
      cast(c, spellId);
      expect(summonsOf(c, spellId).length).toBeGreaterThan(0);
      expect(c.state.combatants['caster']!.concentratingOn?.spellId).toBe(spellId);
      breakConcentration(c.state, 'caster');
      expect(summonsOf(c, spellId), 'summon outlived the concentration holding it').toEqual([]);
      // …and left no phantom slots behind in the turn order.
      const ghosts = c.state.initiativeOrder.filter((id) => !c.state.combatants[id]);
      expect(ghosts, 'initiative order still lists the dismissed summons').toEqual([]);
    });
  }

  it('and does not take the SAME caster’s non-concentration steed with it', () => {
    /**
     * The reason the sweep is keyed on the SPELL rather than the caster.
     *
     * It has to be ONE caster holding both, or the test proves nothing — a
     * wizard's broken spell never touched a paladin's steed anyway, because
     * they are different summoners. So: a paladin conjures a steed (no
     * concentration at all), then picks up a concentration of its own, then
     * loses it. The steed must still be standing.
     */
    const pal = { ...buildCharacter({ classId: 'paladin', team: 'team1', position: at(1, 1), level: 9 }), id: 'caster' };
    const foe = { ...buildMonster('ogre', 'team2', at(6, 6), '1'), id: 'foe' };
    const c = new Combat({ combatants: [pal, foe], seed: 4, mapId: 'open' });
    let guard = 0;
    while (c.activeId !== 'caster' && guard++ < 30) c.apply({ kind: 'endTurn' });
    c.apply({ kind: 'castSpell', spellId: 'find-steed', slotLevel: 2, targets: [{ position: at(3, 1) }] });
    expect(summonsOf(c, 'find-steed').length, 'no steed to begin with').toBe(1);

    // A concentration of its own — Shining Smite is the paladin's — and then
    // that concentration drops.
    c.state.combatants['caster']!.concentratingOn = { spellId: 'shining-smite', targetIds: [] };
    breakConcentration(c.state, 'caster');
    expect(summonsOf(c, 'find-steed').length, 'a broken smite dismissed the steed').toBe(1);
  });
});

describe('the classes can reach them', () => {
  it('Summon Dragon is the wizard’s alone, Animate Objects is on three lists', () => {
    const carries = (id: string) => Object.values(CLASSES)
      .filter((cls) => Object.values(cls.spellcasting?.spellsByLevel ?? {}).flat().includes(id))
      .map((cls) => cls.id).sort();
    expect(carries('summon-dragon')).toEqual(['wizard']);
    expect(carries('animate-objects')).toEqual(['bard', 'sorcerer', 'wizard']);
    expect(SPELLS['summon-dragon']!.level).toBe(5);
    expect(SPELLS['animate-objects']!.level).toBe(5);
  });
});
