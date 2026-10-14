/**
 * Builder options for games that make characters differently: a chosen id,
 * ability scores given outright (rolled stats) and rolled hit dice.
 *
 * The load-bearing test is the last one: leaving the options out must build
 * exactly the character this game always built, so nothing here can move a
 * balance number.
 */
import { describe, it, expect } from 'vitest';
import { buildCharacter } from '../src/builder/character.js';
import { abilityMod } from '../src/engine/types.js';

const HERE = { x: 0, y: 0 } as const;
const ROLLED = { str: 17, dex: 9, con: 14, int: 8, wis: 12, cha: 13 };

describe('build options', () => {
  it('takes an id, so a team can have two of a class', () => {
    const a = buildCharacter({ classId: 'fighter', team: 'team1', position: HERE, id: 'pc-1' });
    const b = buildCharacter({ classId: 'fighter', team: 'team1', position: HERE, id: 'pc-2' });
    expect([a.id, b.id]).toEqual(['pc-1', 'pc-2']);
    expect(buildCharacter({ classId: 'fighter', team: 'team1', position: HERE }).id).toBe('team1-fighter');
  });

  it('honours ability scores given outright, then still applies level increases', () => {
    const first = buildCharacter({ classId: 'fighter', team: 'team1', position: HERE, abilities: ROLLED });
    expect(first.abilities).toEqual(ROLLED);
    const fourth = buildCharacter({ classId: 'fighter', team: 'team1', position: HERE, level: 4, abilities: ROLLED });
    const raised = Object.values(fourth.abilities).reduce((n, v) => n + v, 0) - Object.values(ROLLED).reduce((n, v) => n + v, 0);
    expect(raised).toBe(2);
  });

  it('ignores impossible ability scores rather than honouring them', () => {
    const plain = buildCharacter({ classId: 'wizard', team: 'team1', position: HERE });
    for (const bad of [{ ...ROLLED, str: 25 }, { ...ROLLED, dex: 0 }, { ...ROLLED, con: 12.5 }]) {
      expect(buildCharacter({ classId: 'wizard', team: 'team1', position: HERE, abilities: bad }).abilities).toEqual(plain.abilities);
    }
  });

  it('uses rolled hit dice after 1st level, and the average where a roll is missing or impossible', () => {
    const build = (hitDieRolls?: number[]) =>
      buildCharacter({ classId: 'fighter', team: 'team1', position: HERE, level: 3, abilities: ROLLED, ...(hitDieRolls ? { hitDieRolls } : {}) });
    const con = abilityMod(ROLLED.con);
    // d10: the full 10 at 1st, then the rolls; the average is 6.
    expect(build([3, 10]).maxHp).toBe(10 + con + (3 + con) + (10 + con));
    expect(build([3]).maxHp).toBe(10 + con + (3 + con) + (6 + con));
    expect(build([11, 0]).maxHp).toBe(build().maxHp);
  });

  it('builds exactly the old character when the options are left out', () => {
    for (const classId of ['fighter', 'wizard', 'cleric', 'rogue', 'paladin', 'sorcerer']) {
      for (const level of [1, 5, 8]) {
        const before = buildCharacter({ classId, team: 'team1', position: HERE, level });
        const after = buildCharacter({ classId, team: 'team1', position: HERE, level, hitDieRolls: [] });
        expect(after).toEqual(before);
      }
    }
  });
});
