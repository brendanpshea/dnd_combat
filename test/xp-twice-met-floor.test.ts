/**
 * The XP ceiling is a CEILING, floors included.
 *
 * `xp-reach.ts` promises "an upper bound, never an underestimate", and every
 * caller reads it that way: `check-story.ts` and `test/xp-ceiling.test.ts` both
 * treat a number under the band as proof that no route can exceed it. An
 * under-estimate there is not a wrong number, it is a green check over a
 * chapter that over-levels.
 *
 * WHAT WAS WRONG
 *
 * A payment that one route can meet TWICE, in two components, cannot be placed
 * on the longest path — the walk does not know it was already paid — so it is
 * counted once at every state a paying route reaches (`again`). That entry
 * carried the `add` and dropped the `floor`, so a keyed `xpToLevel` vanished
 * from the bound entirely.
 *
 * WHY NO SHIPPED CHAPTER SHOWS IT
 *
 * `misplacedLevelFloors` (validate.ts) confines `xpToLevel` to the start
 * scene's own choices, which carry no key, so nothing in the trilogy can reach
 * the gap. That is a rule in another file about what a module may say, not a
 * property of the search — which is exactly why this fixture says it, and why
 * it does not go through `validateModule`.
 *
 * THE FIXTURE
 *
 * Two choices in two scenes share one `attempt`, so both pay under the single
 * key `attempt:rites`, and the road runs one way throughout — two components,
 * one key, which is the shape `again` exists for. Each tops XP up to 3rd (900).
 *
 * Each rite leads ONWARD rather than back to itself, and that detail is the
 * whole test. A rite that looped in place would be paid on an edge inside its
 * own component, where `floorIn` picks the floor up regardless of `again` and
 * the bound comes out right with the bug still in. Only a payment made on the
 * way BETWEEN components goes through the path that dropped it. A first version
 * of this fixture looped, read 900, and proved nothing.
 *
 * Nothing else pays, so the fight's door should be bounded at 900; with the
 * floor dropped it was bounded at 0 — a chapter reported four levels below
 * where a route can actually arrive.
 */
import { describe, it, expect } from 'vitest';
import { maxXpReport } from '../src/adventure/xp-reach.js';
import { LEVEL_XP } from '../src/campaign/campaign.js';
import type { Module, Scene } from '../src/adventure/types.js';

const THIRD = LEVEL_XP[2]!; // what `xpToLevel: 3` tops a party up to

/** A one-way story beat. */
const on = (id: string, to: string, text: string): Scene =>
  ({ id, kind: 'story', text: [text], next: [{ id: 'on', label: 'Press on', to }] });

function twiceMetFloor(secondAttempt = 'rites'): Module {
  const scenes: Record<string, Scene> = {
    a: {
      id: 'a', kind: 'story', text: ['A shrine.'], next: [
        { id: 'rite', label: 'Take the rites', attempt: 'rites', to: 'a-after',
          effects: [{ kind: 'xpToLevel', level: 3 }] },
        { id: 'past', label: 'Walk past', to: 'b' },
      ],
    },
    'a-after': on('a-after', 'b', 'Blessed, you go on.'),
    b: {
      id: 'b', kind: 'story', text: ['A second shrine.'], next: [
        // The same `attempt` by default, so the same key — paid on the way out
        // of a different component.
        { id: 'rite', label: 'Take the rites again', attempt: secondAttempt, to: 'b-after',
          effects: [{ kind: 'xpToLevel', level: 3 }] },
        { id: 'past', label: 'Walk past', to: 'fight' },
      ],
    },
    'b-after': on('b-after', 'fight', 'Blessed again, you go on.'),
    fight: { id: 'fight', kind: 'battle', encounterId: 'marsh-dead', mapId: 'bog', onWin: { to: 'won' } },
    won: { id: 'won', kind: 'ending', outcome: 'victory', text: ['Done.'] },
  };
  return { id: `tiny-twice-met-${secondAttempt}`, title: 'T', blurb: '', start: 'a', scenes };
}

describe('a twice-met payment keeps its floor', () => {
  const m = twiceMetFloor();
  const report = maxXpReport(m, [m]);
  const door = report.battles.find((b) => b.scene === 'fight')!;

  it('bounds the fight at the floor the rites set', () => {
    expect(door.max, 'the floor on a twice-met key was dropped from the bound: the ceiling is now below a route that exists')
      .toBeGreaterThanOrEqual(THIRD);
  });

  it('counts the floor once, not once per place it can be paid', () => {
    // The other way to get this wrong. Both shrines floor to the same level, so
    // a bound that stacked them would read 1800 and the whole check would go
    // slack: every fight would look safely under its band.
    expect(door.max, 'the floor is being counted twice').toBeLessThan(THIRD * 2);
  });

  it('says in the path that a level floor was reached', () => {
    // The path is what a chapter author reads to find the route. A bound with
    // nothing behind it is a number nobody can act on.
    expect(door.path.join('\n')).toMatch(/level's floor/);
  });

  it('is really the twice-met case, not an ordinary single payment', () => {
    // Guard on the fixture. Give the second rite its own attempt and the key is
    // met once in each place, so the longest path handles it — which it always
    // did, floors included. If the shared key ever stopped being shared, the
    // cases above would pass without `again` running at all.
    const apart = twiceMetFloor('other-rites');
    const one = maxXpReport(apart, [apart]).battles.find((x) => x.scene === 'fight')!;
    expect(one.max, 'the single-payment road is broken too, so the comparison means nothing')
      .toBeGreaterThanOrEqual(THIRD);
    // The shared-key road must report the floor from `again` ("somewhere
    // before"), not from the longest path.
    expect(door.path.join('\n'), 'the floor is coming from the longest path, so `again` is not being exercised')
      .toContain('somewhere before');
  });
});
