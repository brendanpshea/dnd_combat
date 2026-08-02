/**
 * A weapon attack that looks like something happened.
 *
 * WHAT WAS WRONG
 *
 * A spell pulsed its caster, flew a bolt and bloomed an area; a sword emitted
 * only a SOUND. Everything a weapon attack drew — the number, the burst, the
 * shake — landed on the person being hit, in the same presentation a spell was
 * already using, so the attacker never visibly acted and melee and ranged were
 * indistinguishable. Reported as "melee and ranged attacks don't have anything".
 *
 * WHY THESE ARE THE THINGS TESTED
 *
 * The three ways this goes wrong are all invisible in a screenshot of a still
 * board: a lunge in the wrong direction (looks deliberate), an arrow lying flat
 * while flying north (only shows mid-flight), and a lead time that one module
 * applies and another does not (the number draws mid-swing, or the board stops
 * holding still before the number can be read).
 */
import { describe, it, expect } from 'vitest';
import {
  isShot, cellDistance, lungeVector, shotAngleDeg, attackLeadMs,
  LUNGE_MS, MELEE_LEAD_MS, SHOT_LEAD_MS,
} from '../web/src/strike.js';
import { beatFor } from '../web/src/pacing.js';
import type { GameEvent } from '../src/engine/events.js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const CSS = readFileSync(fileURLToPath(new URL('../web/src/styles.css', import.meta.url)), 'utf8');

const at = (x: number, y: number) => ({ x, y });

describe('a swing or a shot', () => {
  it('lunges at somebody standing next to you', () => {
    expect(isShot({ canMelee: true, reach: 1, distance: 1 })).toBe(false);
  });

  it('does not lunge across the board', () => {
    // The bug this guards: a thrown dagger has `melee: true` AND a range, so
    // keying off the weapon flag alone would have had a rogue lunge at thin air
    // from six squares away.
    expect(isShot({ canMelee: true, reach: 1, distance: 6 }),
      'a thrown weapon at range still counted as a melee swing').toBe(true);
  });

  it('treats a bow at point-blank as a shot', () => {
    // `canMelee: false` means the weapon cannot be swung at all. Firing it into
    // an adjacent enemy is still an arrow leaving a string.
    expect(isShot({ canMelee: false, reach: 1, distance: 1 })).toBe(true);
  });

  it('lets a reach weapon swing at two squares', () => {
    // A glaive thrusts; it does not shoot. Distance alone would have made this
    // a projectile.
    expect(isShot({ canMelee: true, reach: 2, distance: 2 }),
      'a reach weapon threw a projectile instead of thrusting').toBe(false);
    expect(isShot({ canMelee: true, reach: 2, distance: 3 })).toBe(true);
  });

  it('measures distance the way the grid does', () => {
    // Chebyshev: a diagonal is one step, so a diagonal neighbour is in melee.
    expect(cellDistance(at(2, 2), at(3, 3))).toBe(1);
    expect(cellDistance(at(2, 2), at(5, 3))).toBe(3);
  });
});

describe('the lunge points at the target', () => {
  it('goes right for a target to the east', () => {
    const v = lungeVector(at(1, 1), at(4, 1));
    expect(v.dx).toBeGreaterThan(0);
    expect(v.dy).toBeCloseTo(0);
  });

  it('goes UP the screen for a target to the north', () => {
    // The one that cannot be eyeballed: the board draws y upward-positive and
    // CSS grows downward, so a northward lunge must be a NEGATIVE screen
    // offset. Get this wrong and every attacker lunges away from its target,
    // which reads as flinching rather than as striking.
    const v = lungeVector(at(1, 1), at(1, 5));
    expect(v.dy, 'a lunge to the north moved down the screen').toBeLessThan(0);
    expect(v.dx).toBeCloseTo(0);
  });

  it('goes down the screen for a target to the south', () => {
    expect(lungeVector(at(1, 5), at(1, 1)).dy).toBeGreaterThan(0);
  });

  it('is the same length in every direction', () => {
    // Otherwise a diagonal lunge travels 1.41x as far as an orthogonal one and
    // the swing looks stronger to the north-east than to the north.
    const straight = lungeVector(at(0, 0), at(3, 0));
    const diagonal = lungeVector(at(0, 0), at(3, 3));
    expect(Math.hypot(diagonal.dx, diagonal.dy)).toBeCloseTo(Math.hypot(straight.dx, straight.dy));
  });

  it('reaches far enough to see and not so far as to look like a move', () => {
    const len = Math.hypot(...Object.values(lungeVector(at(0, 0), at(1, 0))));
    expect(len, 'the lunge is too small to notice').toBeGreaterThan(0.15);
    expect(len, 'the token appears to have changed square').toBeLessThan(0.5);
  });

  it('does not produce NaN when the two share a cell', () => {
    // Should not happen; must not freeze a token mid-animation if it does.
    const v = lungeVector(at(2, 2), at(2, 2));
    expect(Number.isFinite(v.dx) && Number.isFinite(v.dy)).toBe(true);
  });
});

describe('the arrow faces where it is going', () => {
  it('points right for an eastward shot', () => {
    expect(shotAngleDeg(at(0, 0), at(5, 0))).toBeCloseTo(0);
  });

  it('points UP the screen for a northward shot', () => {
    // CSS rotation grows clockwise and atan2 grows anticlockwise, on top of the
    // same y flip as the lunge — two sign errors that cancel if you make both,
    // so this checks the actual direction rather than the formula.
    expect(shotAngleDeg(at(0, 0), at(0, 5)), 'an arrow flying north pointed south')
      .toBeCloseTo(-90);
  });

  it('points down the screen for a southward shot', () => {
    expect(shotAngleDeg(at(0, 5), at(0, 0))).toBeCloseTo(90);
  });

  it('points left for a westward shot', () => {
    expect(Math.abs(shotAngleDeg(at(5, 0), at(0, 0)))).toBeCloseTo(180);
  });
});

describe('the damage number lands on the blow', () => {
  it('holds a melee result until the apex of the swing', () => {
    expect(attackLeadMs(false)).toBe(MELEE_LEAD_MS);
    expect(attackLeadMs(true)).toBe(SHOT_LEAD_MS);
    expect(MELEE_LEAD_MS, 'the number would draw before the arm moved').toBeGreaterThan(0);
  });

  it('puts the apex exactly where the CSS puts it', () => {
    // `effects.ts` releases the number at MELEE_LEAD_MS; the keyframe reaches
    // full extension at 50% of LUNGE_MS. If those drift, the number lands on a
    // retreating arm and nothing points at anything. Nothing else can catch it
    // — the two live in different languages.
    const rule = CSS.slice(CSS.indexOf('.token.striking {'));
    const dur = rule.match(/animation:\s*lunge\s*([\d.]+)s/);
    expect(dur, 'the lunge animation is gone or renamed').toBeTruthy();
    expect(Number(dur![1]) * 1000, 'LUNGE_MS and the CSS duration disagree').toBe(LUNGE_MS);
    const frames = CSS.slice(CSS.indexOf('@keyframes lunge {'));
    expect(frames.slice(0, frames.indexOf('\n}')), 'the keyframe no longer extends at the halfway point')
      .toMatch(/50%\s*\{\s*transform: translate\(var\(--lx/);
    expect(MELEE_LEAD_MS, 'the number no longer lands at the apex').toBe(LUNGE_MS / 2);
  });

  it('gives the board time to show a number that now arrives later', () => {
    // The half that is easy to forget. `effects.ts` delays the number and
    // `beatFor` decides how long the board holds still; if only the first
    // changed, the swing would eat the number's dwell instead of preceding it.
    const hit: GameEvent[] = [
      { type: 'attackRolled', attackerId: 'a', targetId: 'b', weaponId: 'longsword',
        natural: 15, total: 20, targetAc: 14, mode: 'flat', advSources: [], disSources: [],
        hit: true, crit: false, opportunity: false },
      { type: 'damageDealt', targetId: 'b', sourceId: 'a', amount: 7, damageType: 'slashing', rolls: [7] },
    ];
    const spellOnly: GameEvent[] = [
      { type: 'damageDealt', targetId: 'b', sourceId: 'a', amount: 7, damageType: 'fire', rolls: [7] },
    ];
    expect(beatFor(hit), 'a weapon hit holds no longer than a bare damage event')
      .toBeGreaterThanOrEqual(beatFor(spellOnly) + SHOT_LEAD_MS);
  });

  it('holds longer for three attacks than for one', () => {
    // Extra Attack stacks three leads, so one lead's worth of extra dwell would
    // leave the last two numbers cut off.
    const swing = (): GameEvent => ({
      type: 'attackRolled', attackerId: 'a', targetId: 'b', weaponId: 'longsword',
      natural: 15, total: 20, targetAc: 14, mode: 'flat', advSources: [], disSources: [],
      hit: true, crit: false, opportunity: false,
    });
    expect(beatFor([swing(), swing(), swing()]) - beatFor([swing()]))
      .toBeGreaterThanOrEqual(2 * SHOT_LEAD_MS);
  });

  it('adds nothing for a spell or a summon, which already telegraph themselves', () => {
    // Compared against a WEAPON swing, not against another spell — the obvious
    // spelling of this ("a spell equals a spell") passes no matter what the
    // code does, which is how it first got written and why the plant that paid
    // spells a lead went unnoticed.
    const roll = (over: Partial<Extract<GameEvent, { type: 'attackRolled' }>>): GameEvent => ({
      type: 'attackRolled', attackerId: 'a', targetId: 'b', weaponId: 'longsword',
      natural: 15, total: 20, targetAc: 14, mode: 'flat', advSources: [], disSources: [],
      hit: true, crit: false, opportunity: false, ...over,
    });
    const weapon = beatFor([roll({})]);
    expect(beatFor([roll({ weaponId: 'spell' })]),
      'a spell attack paid for a swing it never makes').toBe(weapon - SHOT_LEAD_MS);
    // A summon's strike is already animated by `summonStrikes`, and the lunge
    // would move the CASTER, who did not move at all.
    expect(beatFor([roll({ via: 'spiritual-weapon' })]),
      'a summon attack paid for its caster to lunge').toBe(weapon - SHOT_LEAD_MS);
  });
});

describe('the motion has an accessible fallback', () => {
  it('keeps the cue and drops the travel under reduced motion', () => {
    // The summon strike already struck this bargain; a new animation that
    // ignores it is a regression on the board's accessibility, not a feature.
    const reduced = CSS.slice(CSS.indexOf('@media (prefers-reduced-motion: reduce)',
      CSS.indexOf('.token.striking {')));
    expect(reduced.slice(0, 400), 'the lunge has no reduced-motion variant')
      .toContain('.token.striking');
    expect(reduced.slice(0, 400), 'reduced motion still translates the token')
      .not.toMatch(/\.token\.striking \{ animation: lunge 0/);
  });
});
