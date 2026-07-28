/**
 * Creeping into a fight.
 *
 * The engine has been able to surprise a team since combat was written and only
 * authored adventure scenes ever set it. What these tests defend is the shape
 * that makes it safe to hand to a player: it is a gamble you opt into, it cuts
 * both ways, and it cannot be shopped around the three doors for the easiest
 * pair of eyes.
 */
import { describe, it, expect } from 'vitest';
import {
  passivePerception, ambushDc, canCreepIn, creepKey, creepFor, surprisedTeam,
  type CreepAttempt,
} from '../src/arena/ambush.js';
import { Combat } from '../src/engine/combat.js';
import { buildMonster, MONSTERS } from '../src/data/monsters.js';
import { buildCharacter } from '../src/builder/character.js';
import { parseMap } from '../src/data/maps.js';
import { isDown } from '../src/engine/types.js';

const COVERED = {
  id: 'c', name: 'c', theme: 'stone' as const,
  rows: ['........', '..++++..', '........', '........',
    '........', '........', '........', '........'],
};
const OPEN = { ...COVERED, rows: Array(8).fill('........') };

describe('who hears you coming', () => {
  it('is plain passive Perception, not the searching kind', () => {
    // The hide rules use 15 + Wis + proficiency for a creature actively
    // looking. Walking into your own ambush is the *unaware* case, so what
    // opposes you is the ordinary 10 + Wis + proficiency.
    const goblin = buildMonster('goblin-warrior', 'team2', { x: 0, y: 0 });
    const wis = Math.floor((goblin.abilities.wis - 10) / 2);
    expect(passivePerception(goblin)).toBeGreaterThanOrEqual(10 + wis);
    expect(passivePerception(goblin)).toBeLessThan(15 + wis + 6);
  });

  it('takes the sharpest eyes in the warband, not the average', () => {
    // One sentry raises the alarm. Averaging would make a big warband easier to
    // sneak past than a single alert scout, which is exactly backwards.
    const scoutAlone = ambushDc(['scout']);
    const scoutInACrowd = ambushDc(['scout', 'goblin-warrior', 'goblin-warrior', 'goblin-warrior']);
    expect(scoutInACrowd).toBe(scoutAlone);
  });

  it('never lets a DC fall below a floor', () => {
    // A wave of oblivious things is still a wave you can be heard by.
    for (const id of Object.keys(MONSTERS).slice(0, 40)) {
      expect(ambushDc([id]), id).toBeGreaterThanOrEqual(10);
    }
    expect(ambushDc([])).toBe(10);
    expect(ambushDc(['not-a-monster'])).toBe(10);
  });
});

describe('where you can creep', () => {
  it('wants something to creep behind', () => {
    expect(canCreepIn(parseMap(COVERED))).toBe(true);
  });

  it('offers nothing on open ground', () => {
    // You cannot sneak across the Killing Floor. Offering the gamble there
    // would make it a bare dice roll with no read attached to it.
    expect(canCreepIn(parseMap(OPEN))).toBe(false);
  });
});

describe('the gamble cuts both ways', () => {
  const attempt = (over: Partial<CreepAttempt> = {}): CreepAttempt => ({
    key: creepKey(2, 'morning'), door: 1, success: true,
    by: 0, total: 18, dc: 12, ...over,
  });

  it('surprises them when it lands', () => {
    expect(surprisedTeam(attempt(), 1)).toBe('team2');
  });

  it('surprises YOU when it does not', () => {
    // The symmetry is the design. Surprise is powerful enough that handing it
    // out for a good modifier would flatten the fights it touches; being
    // surprised is punishing enough that inflicting it unasked would be
    // arbitrary. Opt in, and you own both ends.
    expect(surprisedTeam(attempt({ success: false }), 1)).toBe('team1');
  });

  it('does nothing at all if nobody crept', () => {
    expect(surprisedTeam(undefined, 0)).toBeUndefined();
  });

  it('CANNOT be cashed at a different door', () => {
    // The load-bearing one. The three doors hold different monsters with
    // different eyes, so a creep attempted at the sleepiest gate and spent at
    // the hardest would be a way to shop for the easiest DC.
    expect(surprisedTeam(attempt({ door: 0 }), 2)).toBeUndefined();
    expect(surprisedTeam(attempt({ door: 0, success: false }), 2),
      'and the penalty does not follow you either').toBeUndefined();
  });
});

describe('one attempt per fight', () => {
  const made: CreepAttempt = {
    key: creepKey(3, 'morning'), door: 0, success: true, by: 0, total: 19, dc: 13,
  };

  it('holds for the fight it was made in', () => {
    expect(creepFor(made, 3, 'morning')).toBe(made);
  });

  it('does not carry into the afternoon, which is a different line-up', () => {
    expect(creepFor(made, 3, 'afternoon')).toBeUndefined();
  });

  it('does not carry into tomorrow', () => {
    expect(creepFor(made, 4, 'morning')).toBeUndefined();
  });
});

describe('what surprise actually does to a fight', () => {
  it('takes the first round off the surprised team', () => {
    // Checked against the engine rather than assumed: this is the payoff the
    // whole gamble is for, and it is the one part of it we did not write.
    const hero = buildCharacter({ classId: 'fighter', team: 'team1', position: { x: 1, y: 1 } });
    const foe = buildMonster('goblin-warrior', 'team2', { x: 5, y: 5 });
    const c = new Combat({
      seed: 4, map: COVERED, combatants: [hero, foe], surprisedTeam: 'team2',
    });
    const surprised = c.state.combatants[foe.id]!;
    expect(surprised.conditions.some((k) => k.id === 'incapacitated'),
      'a surprised creature starts the fight unable to act').toBe(true);
    expect(isDown(surprised), 'incapacitated, not downed').toBe(false);
  });

  it('leaves an ordinary fight alone', () => {
    const hero = buildCharacter({ classId: 'fighter', team: 'team1', position: { x: 1, y: 1 } });
    const foe = buildMonster('goblin-warrior', 'team2', { x: 5, y: 5 });
    const c = new Combat({ seed: 4, map: COVERED, combatants: [hero, foe] });
    for (const x of Object.values(c.state.combatants)) {
      expect(x.conditions.some((k) => k.id === 'incapacitated'), x.id).toBe(false);
    }
  });
});
