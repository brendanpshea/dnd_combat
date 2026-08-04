/**
 * A Dash grants THIS TURN'S Speed, not the base one.
 *
 * WHAT WAS WRONG
 *
 * `startTurn` computes an effective speed for the turn — zero if restrained or
 * incapacitated, halved by Spirit Guardians, minus ten if slowed, doubled if
 * hasted — and stores it as `turn.movementMax`. Every Dash then did
 *
 *     turn.movementMax += combatant.speed
 *
 * which is the BASE speed, undoing all of it. Measured: a restrained creature
 * had `movementMax` 0 and, after Dashing, 30 feet and 62 legal destinations. It
 * walked out of the web that was holding it. The same for Cunning Action: Dash
 * and Adrenaline Rush, and for Remarkable Athlete's half-Speed crit bonus.
 *
 * Reported as "dash is allowing movement on paralyze". Paralysis was already
 * safe — `cannotAct` makes Dash illegal outright — but restrained looks the
 * same from the player's chair: a hero who cannot move, moving.
 *
 * WHY A STORED `turn.dashSpeed` RATHER THAN READING `movementMax`
 *
 * Two Dashes in one turn would compound off each other — 30, 60, 120 — instead
 * of adding the same 30 three times.
 *
 * AND WHY IT IS NOT SIMPLY THE STARTING `movementMax`
 *
 * Standing up from prone costs MOVEMENT, not Speed. The engine models it as a
 * halved speed, so a hero who stood this turn has `movementMax` 15 — but their
 * Speed is still 30, and a Dash is worth 30.
 */
import { describe, it, expect } from 'vitest';
import { Combat } from '../src/engine/combat.js';
import { legalActions, isLegalAction, step } from '../src/engine/actions.js';
import { makeCombatant } from './helpers.js';
import type { GameState, ConditionId, Combatant } from '../src/engine/types.js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/** `a` acts first, deterministically. */
const aFirst = (s: GameState): GameState => ({ ...s, initiativeOrder: ['a', 'b'], turnIndex: 0 });

function turnWith(conds: ConditionId[], over: Partial<Combatant> = {}): GameState {
  const c = new Combat({
    seed: 3,
    combatants: [
      makeCombatant({
        id: 'a', team: 'team1', position: { x: 2, y: 2 }, level: 5,
        conditions: conds.map((id) => ({ id })), ...over,
      }),
      makeCombatant({ id: 'b', team: 'team2', position: { x: 7, y: 7 } }),
    ],
  });
  return aFirst(c.state);
}

const moveCount = (s: GameState) => legalActions(s, 'a').filter((x) => x.kind === 'move').length;

describe('a creature that cannot move cannot Dash its way out', () => {
  it('gives a restrained creature nothing for a Dash', () => {
    // The reported bug, in the state that actually produced it.
    const s = turnWith(['restrained']);
    expect(s.combatants['a']!.turn.movementMax, 'restrained did not zero this turn\'s movement').toBe(0);
    expect(isLegalAction(s, 'a', { kind: 'dash' }), 'Dash is not even offered — this tests nothing').toBe(true);
    const after = step(s, { kind: 'dash' }).state;
    expect(after.combatants['a']!.turn.movementMax, 'Dash bought movement out of a web').toBe(0);
    expect(moveCount(after), 'a restrained creature can walk after Dashing').toBe(0);
  });

  it.each(['cunning-dash', 'adrenaline-rush'])('and nothing for %s either', (fid) => {
    // The bonus-action Dashes are separate code paths and had the same bug.
    const s = turnWith(['restrained'], {
      featureIds: [fid], featureUses: { [fid]: { current: 3, max: 3 } },
    });
    const act = { kind: 'useFeature', featureId: fid } as const;
    expect(isLegalAction(s, 'a', act), `${fid} is not available — this tests nothing`).toBe(true);
    const after = step(s, act).state;
    expect(after.combatants['a']!.turn.movementMax, `${fid} bought movement out of a web`).toBe(0);
    expect(moveCount(after)).toBe(0);
  });

  it('leaves paralysis alone, which was already correct', () => {
    // `cannotAct` blocks the Dash outright. Worth pinning: the report named
    // paralysis, and a fix aimed at the wrong condition would have "fixed"
    // this by making it illegal twice.
    const s = turnWith(['paralyzed']);
    expect(isLegalAction(s, 'a', { kind: 'dash' })).toBe(false);
    expect(moveCount(s)).toBe(0);
  });
});

describe('Dash is worth what this turn is worth', () => {
  const dashTo = (conds: ConditionId[]) => {
    const s = turnWith(conds);
    const before = s.combatants['a']!.turn.movementMax;
    const after = step(s, { kind: 'dash' }).state.combatants['a']!.turn.movementMax;
    return { before, after, gained: after - before };
  };

  it('adds the reduced speed when slowed, not the full one', () => {
    const { before, gained } = dashTo(['slowed']);
    expect(before, 'slowed did not take 10 feet off').toBe(20);
    expect(gained, 'Dash handed back the 10 feet that Slow took').toBe(20);
  });

  it('adds the doubled speed when hasted', () => {
    // This one was under-granting: turn speed 60, Dash added 30.
    const { before, gained } = dashTo(['hasted']);
    expect(before).toBe(60);
    expect(gained, 'a hasted Dash is still worth only a base move').toBe(60);
  });

  it('still gives a full Dash to somebody who just stood up', () => {
    // Standing is a movement cost, not a Speed cut. If `dashSpeed` were simply
    // the starting `movementMax`, this would silently halve the Dash — a nerf
    // hiding inside a bug fix.
    const { before, gained } = dashTo(['prone']);
    expect(before, 'standing up did not cost half the movement').toBe(15);
    expect(gained, 'standing up quietly halved the Dash too').toBe(30);
  });

  it('does not compound when a turn holds two Dashes', () => {
    // Reading `movementMax` instead of storing the value would give 30, 60,
    // 120 rather than 30, 60, 90.
    const s = turnWith([], {
      featureIds: ['cunning-dash'], featureUses: { 'cunning-dash': { current: 3, max: 3 } },
    });
    const one = step(s, { kind: 'dash' }).state;
    const two = step(one, { kind: 'useFeature', featureId: 'cunning-dash' }).state;
    expect(one.combatants['a']!.turn.movementMax).toBe(60);
    expect(two.combatants['a']!.turn.movementMax, 'the second Dash compounded off the first').toBe(90);
  });
});

describe('every movement grant reads the same number', () => {
  it('leaves no grant still adding the base speed', () => {
    /*
     * Remarkable Athlete gives half Speed on a crit, and had the identical bug
     * — a restrained fighter who crit got 15 feet out of the web.
     *
     * Checked at the source rather than by driving a crit: forcing one takes a
     * rigged die, and what actually matters is that no FUTURE grant reaches for
     * `speed` again. Four call sites had this bug; a fifth would be silent.
     */
    const files = ['src/engine/actions.ts', 'src/data/features.ts', 'src/engine/rules/attack.ts'];
    const bad: string[] = [];
    for (const f of files) {
      const src = readFileSync(fileURLToPath(new URL(`../${f}`, import.meta.url)), 'utf8');
      for (const m of src.matchAll(/movementMax \+= ([^;\n]+)/g)) {
        if (!m[1]!.includes('dashSpeed')) bad.push(`${f}: movementMax += ${m[1]!.trim()}`);
      }
    }
    expect(bad, `these grant movement from the base speed, ignoring this turn's conditions:\n  ${bad.join('\n  ')}`)
      .toEqual([]);
  });
});
