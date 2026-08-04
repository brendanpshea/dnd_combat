/**
 * The pre-fight gambit: what it offers, how hard it is, and what it does.
 *
 * Most of what makes this design work is not visible in the code — it is in the
 * measurements that chose the numbers, and a later edit that looks harmless can
 * undo any of them. So the tests below pin the PROPERTIES that were measured,
 * not just the wiring:
 *
 *   - the pool is several skills wide and no skill dominates it, because a pool
 *     of one or two is the two-choice design minus the choice, and a pool that
 *     licenses everything has no connection to the fight at all;
 *   - the DC sits in the band where proficiency is what clears it;
 *   - the draw ignores the party, which is the knob that would undo the whole
 *     "one forced offer rewards breadth" argument;
 *   - the offer is stable across doors and retries, so it cannot be shopped;
 *   - the setup lines claim nothing the eligibility gate does not guarantee.
 */
import { describe, it, expect } from 'vitest';
import {
  GAMBITS, gambitContext, eligibleGambits, drawGambit, gambitDc, applyGambit,
  gambitKey, attemptFor, type GambitAttempt,
} from '../src/arena/gambit.js';
import { buildWave } from '../src/arena/run.js';
import { parseMap } from '../src/data/maps.js';
import { MONSTERS, buildMonster } from '../src/data/monsters.js';
import { makeCombatant } from './helpers.js';
import { Combat } from '../src/engine/combat.js';
import { SKILL_ABILITY } from '../src/data/classes.js';
import { blocksMovement } from '../src/engine/grid.js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { Combatant } from '../src/engine/types.js';

/** A spread of real generated waves, the thing the rules actually run against. */
function waves(n = 120) {
  const out = [];
  for (const level of [1, 3, 5, 7]) {
    for (let seed = 1; seed <= n; seed++) {
      const w = buildWave(seed, level, 1 + (seed % 6));
      const grid = parseMap(w.map);
      out.push({ level, seed, members: w.encounter.members, grid, map: w.map });
    }
  }
  return out;
}
const SAMPLE = waves();

const ctxOf = (w: (typeof SAMPLE)[number], hurt = false) =>
  gambitContext(w.members, w.grid, hurt);

describe('what a fight puts on offer', () => {
  it('licenses several skills, not one or two', () => {
    // A pool of one is a forced button; the draw has to have something to draw
    // FROM or the "random of one" design is deterministic in a costume.
    const sizes = SAMPLE.map((w) => eligibleGambits(ctxOf(w, true)).length);
    const mean = sizes.reduce((a, b) => a + b, 0) / sizes.length;
    expect(mean, `pool averages ${mean.toFixed(2)} skills`).toBeGreaterThan(3);
    expect(sizes.filter((s) => s <= 1).length / sizes.length,
      'too many fights license nothing to choose between').toBeLessThan(0.15);
  });

  it('is not dominated by any one skill, and leaves none unreachable', () => {
    // Measured spread was 15% to 56%. A skill that fires in every fight is
    // decoration; one that never fires is dead content.
    const seen = new Map<string, number>();
    for (const [i, w] of SAMPLE.entries()) {
      // Medicine is gated on the PARTY, not the roster, so it is passed a
      // realistic mix rather than a standing "somebody is hurt" — with that
      // pinned true it is trivially eligible always and says nothing about
      // whether the roster rules discriminate.
      for (const g of eligibleGambits(ctxOf(w, i % 3 === 0))) {
        seen.set(g.skill, (seen.get(g.skill) ?? 0) + 1);
      }
    }
    const never = GAMBITS.filter((g) => !seen.has(g.skill)).map((g) => g.skill);
    expect(never, `never eligible in ${SAMPLE.length} real waves`).toEqual([]);
    for (const [skill, n] of seen) {
      expect(n / SAMPLE.length, `${skill} is eligible in nearly every fight`).toBeLessThan(0.8);
    }
  });

  it('offers Medicine only when somebody is actually hurt', () => {
    const w = SAMPLE[0]!;
    const healthy = eligibleGambits(ctxOf(w, false)).map((g) => g.skill);
    const wounded = eligibleGambits(ctxOf(w, true)).map((g) => g.skill);
    expect(healthy).not.toContain('medicine');
    expect(wounded).toContain('medicine');
  });
});

describe('the difficulty', () => {
  it('stays in the band where being proficient is what clears it', () => {
    /*
     * The measured failure modes on either side of this band:
     *
     *   too high (10 + CR)  the share of offers worth taking fell to 21% by
     *                       level 7 — the feature is dead most of a run.
     *   too low  (flat 13)  86% worth taking AND the broad party did WORSE than
     *                       the narrow one, because at a low DC everyone clears
     *                       on raw ability scores and proficiency never decides.
     *
     * 13-17 is the range where a +2 proficiency bonus is the difference.
     */
    for (const w of SAMPLE) {
      const dc = gambitDc(w.members);
      expect(dc, `DC ${dc} at level ${w.level}`).toBeGreaterThanOrEqual(13);
      expect(dc).toBeLessThanOrEqual(17);
    }
  });

  it('is harder in front of nastier things', () => {
    const byCr = [...SAMPLE].sort((a, b) =>
      Math.max(...a.members.map((m) => MONSTERS[m]?.cr ?? 0)) -
      Math.max(...b.members.map((m) => MONSTERS[m]?.cr ?? 0)));
    const easiest = gambitDc(byCr[0]!.members);
    const hardest = gambitDc(byCr[byCr.length - 1]!.members);
    expect(hardest, 'the DC ignores what is in front of you').toBeGreaterThan(easiest);
  });
});

describe('the draw', () => {
  it('gives the same offer for the same fight, every time', () => {
    // A retry after a loss must not be a reroll for an easier skill.
    const w = SAMPLE[3]!;
    const c = ctxOf(w, true);
    const a = drawGambit(7, 2, 'morning', 1, c);
    const b = drawGambit(7, 2, 'morning', 1, c);
    expect(a?.skill).toBe(b?.skill);
  });

  it('varies across doors, halves and days', () => {
    // Each door is a different roster, so it gets its own question. What stops
    // this being a shopping trip is `applyGambit` binding an attempt to its
    // door, tested below — not making the offer identical everywhere.
    const c = ctxOf(SAMPLE[3]!, true);
    const drawn = new Set([
      drawGambit(7, 1, 'morning', 0, c)?.skill,
      drawGambit(7, 1, 'morning', 1, c)?.skill,
      drawGambit(7, 1, 'afternoon', 0, c)?.skill,
      drawGambit(7, 2, 'morning', 0, c)?.skill,
    ]);
    expect(drawn.size, 'every door and half asks the identical question').toBeGreaterThan(1);
  });

  it('never draws something the fight does not license', () => {
    for (const w of SAMPLE.slice(0, 60)) {
      const c = ctxOf(w, true);
      const g = drawGambit(w.seed, 1, 'morning', 0, c);
      if (!g) continue;
      expect(g.eligible(c), `${g.skill} was offered for a fight that does not license it`).toBe(true);
    }
  });

  it('spreads over the pool rather than favouring one entry', () => {
    // Uniform, and specifically NOT weighted toward what the party is good at:
    // weighting is the knob that would hand them their best skill every time
    // and undo the reason there is only one offer.
    const picked = new Map<string, number>();
    for (const w of SAMPLE) {
      const g = drawGambit(w.seed, 1, 'morning', w.seed % 3, ctxOf(w, true));
      if (g) picked.set(g.skill, (picked.get(g.skill) ?? 0) + 1);
    }
    expect(picked.size, 'the draw only ever reaches a handful of skills').toBeGreaterThan(6);
    const top = Math.max(...picked.values());
    expect(top / SAMPLE.length, 'one skill is drawn far more than the rest').toBeLessThan(0.35);
  });
});

describe('the writing promises only what the gate guarantees', () => {
  it.each(GAMBITS.map((g) => [g.skill, g] as const))('%s', (_skill, g) => {
    // The line is shown before the roll, on a wave that was generated, so
    // anything specific in it is a claim that will eventually be false.
    const banned = /\bwolf|wolves|goblin|orc|dragon|skeleton|zombie|uniform|chain|sergeant|dozen|\btwo\b|\bthree\b|\bfour\b/i;
    expect(g.setup, `"${g.setup}" names something the gate does not promise`).not.toMatch(banned);
    // It must read as an offer, not as something that already happened.
    expect(g.setup, `"${g.setup}" does not offer the player anything to do`)
      .toMatch(/you could|you can|there is time/i);
    for (const line of [g.won, g.lost]) {
      expect(line.length, 'an outcome line is missing').toBeGreaterThan(10);
      expect(line, `"${line}" names something the gate does not promise`).not.toMatch(banned);
    }
  });

  it('keeps `outlined` out of the table, because it fades with level', () => {
    /*
     * Every other payload holds roughly flat from level 3 to 7. `outlined` does
     * not: +8 / +9 / +2, measured at n=400 per level. It was the obvious fit for
     * both Perception and Acrobatics and it quietly took both of them to nearly
     * nothing at the top of the range, which is the one place the arena is
     * hardest.
     *
     * Checked at the source rather than by re-simulating, because the finding is
     * about a curve and re-measuring it costs three minutes per run. Two
     * same-sized replacements were measured and both hold flat: `sapped` at
     * +8 / +4 / +4 and two-weakest-frightened at +8 / +7 / +5.
     */
    const src = readFileSync(fileURLToPath(new URL('../src/arena/gambit.ts', import.meta.url)), 'utf8');
    const uses = [...src.matchAll(/cond\((?:c|[a-z]+), 'outlined'\)/g)];
    expect(uses.length,
      'a gambit pays out in `outlined` again — measured +8/+9/+2, it is worth almost nothing by level 7')
      .toBe(0);
  });

  it('uses skills that exist, with no duplicates', () => {
    const skills = GAMBITS.map((g) => g.skill);
    expect(new Set(skills).size, 'two gambits share a skill').toBe(skills.length);
    for (const s of skills) expect(SKILL_ABILITY[s], `${s} is not a real skill`).toBeDefined();
  });
});

/**
 * Put the foes on squares that exist and are walkable.
 *
 * The generator picks a fresh board per wave, so marching them along a fixed
 * row walks them into walls and off the edge — which throws in `startCombat`
 * and looks exactly like a bug in the thing under test.
 */
function deploy(w: (typeof SAMPLE)[number]): Combatant[] {
  const out: Combatant[] = [];
  const free: Array<{ x: number; y: number }> = [];
  for (let y = w.grid.height - 2; y >= 1 && free.length < w.members.length; y--) {
    for (let x = 0; x < w.grid.width && free.length < w.members.length; x++) {
      const cell = w.grid.cells[y * w.grid.width + x];
      if (cell && !blocksMovement(cell.terrain)) free.push({ x, y });
    }
  }
  w.members.forEach((mid, i) => {
    const at = free[i];
    if (at) out.push(buildMonster(mid, 'team2', at, String(i + 1)));
  });
  return out;
}

describe('applying the outcome', () => {
  const fight = () => {
    const w = SAMPLE.find((x) => x.level === 5 && x.members.length >= 3)!;
    const party = [0, 1, 2, 3].map((i) =>
      makeCombatant({ id: `h${i}`, team: 'team1', position: { x: i, y: 0 }, level: 5 }));
    return { w, party, foes: deploy(w) };
  };

  const attempt = (skill: string, success: boolean, door = 0): GambitAttempt => ({
    key: gambitKey(1, 'morning'), door, skill: skill as GambitAttempt['skill'],
    by: 0, natural: 10, total: 15, dc: 15, success,
  });

  it('does nothing at all when no attempt was made', () => {
    const { w, party, foes } = fight();
    const before = JSON.stringify([party, foes]);
    applyGambit(undefined, 0, party, foes, w.grid, w.members);
    expect(JSON.stringify([party, foes])).toBe(before);
  });

  it('does nothing when the check was taken at a different door', () => {
    // Attempt at gate 1, then walk through gate 2: the question was about the
    // other roster, so it cannot follow you.
    const { w, party, foes } = fight();
    const before = JSON.stringify([party, foes]);
    applyGambit(attempt('religion', true, 1), 2, party, foes, w.grid, w.members);
    expect(JSON.stringify([party, foes])).toBe(before);
  });

  it('blesses the party on a landed Religion check and banes it on a failed one', () => {
    const won = fight();
    applyGambit(attempt('religion', true), 0, won.party, won.foes, won.w.grid, won.w.members);
    expect(won.party.every((c) => c.conditions.some((k) => k.id === 'blessed'))).toBe(true);

    const lost = fight();
    applyGambit(attempt('religion', false), 0, lost.party, lost.foes, lost.w.grid, lost.w.members);
    expect(lost.party.every((c) => c.conditions.some((k) => k.id === 'baned'))).toBe(true);
  });

  it('adds a creature to whichever side won the argument', () => {
    const won = fight();
    const foesBefore = won.foes.length;
    applyGambit(attempt('persuasion', true), 0, won.party, won.foes, won.w.grid, won.w.members);
    expect(won.party.length, 'nobody came over').toBe(5);
    expect(won.foes.length, 'it left their side as well as joining yours').toBe(foesBefore);

    const lost = fight();
    applyGambit(attempt('persuasion', false), 0, lost.party, lost.foes, lost.w.grid, lost.w.members);
    expect(lost.foes.length, 'nothing came to help them').toBe(foesBefore + 1);
    expect(lost.party.length).toBe(4);
  });

  it('brings the newcomer in unwilling, whichever side it lands on', () => {
    /*
     * The only dial this outcome has. At full strength the pair swung 22 points
     * against a table whose next-largest is 16, and three skills use it — there
     * is no smaller creature than the weakest, so size was not available.
     * Removing one of theirs instead was measured and came out identical (+11
     * / -11, swing 22); arriving frightened brought it to 18 with a tilt of
     * zero. Drop the condition and the loudest entry in the game gets louder.
     */
    const won = fight();
    applyGambit(attempt('persuasion', true), 0, won.party, won.foes, won.w.grid, won.w.members);
    const ally = won.party[won.party.length - 1]!;
    expect(ally.team).toBe('team1');
    expect(ally.conditions.some((k) => k.id === 'frightened'),
      'the recruit arrived at full strength').toBe(true);

    const lost = fight();
    applyGambit(attempt('persuasion', false), 0, lost.party, lost.foes, lost.w.grid, lost.w.members);
    const enemy = lost.foes[lost.foes.length - 1]!;
    expect(enemy.conditions.some((k) => k.id === 'frightened'),
      'the pair is only even because BOTH newcomers are half-hearted').toBe(true);
  });

  it('leaves the creatures that were already there alone', () => {
    // The frightened flag belongs to the newcomer, not to the wave.
    const { w, party, foes } = fight();
    const before = foes.length;
    applyGambit(attempt('persuasion', false), 0, party, foes, w.grid, w.members);
    for (const f of foes.slice(0, before)) {
      expect(f.conditions.some((k) => k.id === 'frightened'), `${f.id} was scared by proxy`).toBe(false);
    }
  });

  it('places the newcomer somewhere a fight can actually start', () => {
    // startCombat throws on anyone standing in a wall or a barricade, and on
    // two creatures sharing a square. The recruit is dropped onto a board the
    // generator chose, so the spot has to be searched for.
    for (const w of SAMPLE.filter((x) => x.level === 5).slice(0, 40)) {
      for (const success of [true, false]) {
        const party = [0, 1, 2, 3].map((i) =>
          makeCombatant({ id: `h${i}`, team: 'team1', position: { x: i, y: 0 }, level: 5 }));
        const foes: Combatant[] = deploy(w);
        applyGambit(attempt('persuasion', success), 0, party, foes, w.grid, w.members);
        expect(() => new Combat({ seed: 1, map: w.map, combatants: [...party, ...foes] }))
          .not.toThrow();
      }
    }
  });
});

describe('an attempt belongs to one fight', () => {
  it('is forgotten once the day or the half moves on', () => {
    const a = attemptForTest(1, 'morning');
    expect(attemptFor(a, 1, 'morning')).toBe(a);
    expect(attemptFor(a, 1, 'afternoon'), 'the morning check carried into the afternoon').toBeUndefined();
    expect(attemptFor(a, 2, 'morning'), 'yesterday\'s check carried into today').toBeUndefined();
  });
});

function attemptForTest(day: number, half: 'morning' | 'afternoon'): GambitAttempt {
  return {
    key: gambitKey(day, half), door: 0, skill: 'religion',
    by: 0, natural: 10, total: 15, dc: 15, success: true,
  };
}
