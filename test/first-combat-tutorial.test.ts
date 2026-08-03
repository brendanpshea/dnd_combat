/**
 * Teaching happens on the player's first fight, not in a separate one.
 *
 * WHY THE TRAINING YARD WAS PARKED
 *
 * It was the first button on the landing page, and it did not work. The coach
 * banner sat over the board it was describing, and the kobolds put a hero down
 * — reported as about half the time for a real beginner. Measured here with the
 * greedy AI playing BOTH sides, which is a generous upper bound on how well a
 * first-timer plays: a hero still goes down in 5% of 300 seeds and the party is
 * wiped in 1%. `training.test.ts` asserted "comfortably winnable" against a
 * single fixed seed, which is why none of that showed up.
 *
 * WHAT REPLACES IT
 *
 * The "How to play" card, which already opens on the first combat in whichever
 * mode the player started, plus the just-in-time tips. Neither asks anyone to
 * go anywhere, which is the whole advantage.
 *
 * That puts a load on the card: it is now the ONLY up-front teaching, so it has
 * to describe a turn end to end. These tests are about that, and about the yard
 * staying out of a shipped build.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const APP = readFileSync(fileURLToPath(new URL('../web/src/App.tsx', import.meta.url)), 'utf8');

/** The `<ul className="tut-list">` block — the card a first-time player reads. */
const tutList = (() => {
  const start = APP.indexOf('<ul className="tut-list">');
  expect(start, 'the How-to-play list is gone').toBeGreaterThan(-1);
  return APP.slice(start, APP.indexOf('</ul>', start));
})();

describe('the Training Yard is not on the landing page', () => {
  it('is only reachable in a dev build', () => {
    // `import.meta.env.DEV` rather than a `?dev` URL flag: a flag is something
    // a player can be handed a link to, and the branch is dead code the bundler
    // drops entirely. Same treatment the Classic Campaign and Quick Battle got.
    const i = APP.indexOf("onPick({ view: 'training' })");
    expect(i, 'nothing opens the training yard at all').toBeGreaterThan(-1);
    const dev = APP.lastIndexOf('import.meta.env.DEV', i);
    const block = APP.slice(dev, i);
    expect(dev, 'the training yard is reachable outside a dev build').toBeGreaterThan(-1);
    expect(block.length, 'the nearest DEV guard is too far away to be guarding this')
      .toBeLessThan(2000);
  });

  it('no longer advertises itself as the way in', () => {
    expect(APP, 'the landing page still leads with "Learn the basics"')
      .not.toContain('Learn the basics');
    expect(APP, 'the landing tutorial button is back').not.toContain('landing-learn');
  });
});

describe('the first-combat card carries a whole turn', () => {
  it('opens on the first combat and never again', () => {
    expect(APP).toContain("!localStorage.getItem('dnd-tutorial-seen')");
    expect(APP).toContain("localStorage.setItem('dnd-tutorial-seen', '1')");
  });

  it('covers every step the yard used to walk through', () => {
    // The coach taught move, melee, end turn, cantrip, leveled spell, heal.
    // With the yard gone, anything missing here is simply not taught.
    const needs: Array<[string, RegExp]> = [
      ['whose turn it is', /gold arrow/i],
      ['moving', /blue tile/i],
      ['attacking', /enemy/i],
      ['cantrips vs. spell slots', /cantrip/i],
      ['what the pips under a name are', /slot/i],
      ['healing', /heal/i],
      ['ending the turn', /End turn/i],
    ];
    for (const [what, re] of needs) {
      expect(tutList, `the card never mentions ${what} — the yard taught it and the yard is gone`)
        .toMatch(re);
    }
  });

  it('does not tell the player to tap a status badge', () => {
    // Badges are decoration now; they take no pointer events. Teaching a tap
    // that does nothing is worse than teaching nothing.
    expect(tutList, 'the card still teaches tapping a status badge')
      .not.toMatch(/status badge/i);
  });

  it('stays short enough to be read at the start of a fight', () => {
    // It opens over a live board with the player's first turn waiting. A wall
    // of text there is skipped, and skipped teaching is no teaching.
    const items = tutList.match(/<li>/g)?.length ?? 0;
    expect(items, 'the card has no items').toBeGreaterThan(4);
    expect(items, `${items} bullets is a manual, not a card`).toBeLessThanOrEqual(10);
  });
});
