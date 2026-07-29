/**
 * Every theme has to dress its own terrain.
 *
 * THE BUG THIS EXISTS FOR
 *
 * `terrain-hazard` was one global rule — molten lava, orange, with an ember
 * glow — and there were no per-theme variants at all. So the "damage on entry"
 * tile rendered as a lava pool in a forest, in a graveyard, in a market square
 * and in a swamp. Fire on grassland.
 *
 * `terrain-difficult` had the opposite history: four themes had been given a
 * fiction of their own (seepage between flagstones, boggy undergrowth,
 * grave-mist, the Black Ford) and two had not, so ember and village fell
 * through to the generic rule and drew a bright turquoise pool on scorched
 * volcanic rock and on cobblestones.
 *
 * Both were invisible to `terrain-sheet.ts`, which compares one terrain against
 * another in a 4x2 patch. The question it cannot ask is whether the tiles look
 * like the same PLACE — a lava tile is perfectly legible on its own and still
 * wrong when the ground around it is grass. That needs a whole board, which is
 * what `scripts/board-sheet.ts` renders.
 *
 * WHAT THIS CHECKS
 *
 * Not that the art is good — no test can. That every theme has made a DECISION
 * about each effect terrain: either a rule of its own, or a named place on the
 * inherit list below saying why the default is right for it. A seventh theme
 * added without either fails here rather than shipping with a lava pool in it.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { BOARD_THEMES } from '../web/src/boardTheme.js';

const CSS = readFileSync(fileURLToPath(new URL('../web/src/styles.css', import.meta.url)), 'utf8');
const THEMES = Object.keys(BOARD_THEMES);

/**
 * Themes for which the GENERIC rule is already the right fiction.
 *
 * The generic hazard is molten lava and the generic difficult is water, so a
 * theme belongs here only when that is what it would have drawn anyway.
 */
const INHERITS: Record<string, string> = {
  'hazard:stone': 'A lava seam under a ruin is what the generic tile already draws.',
  'hazard:ember': 'Molten rock IS the ember theme — the generic tile was designed for it.',
  'difficult:stone': 'Has its own rule; listed nowhere else.',
};

describe('board themes dress their own terrain', () => {
  for (const terrain of ['hazard', 'difficult'] as const) {
    it(`gives every theme a ${terrain} treatment`, () => {
      const missing = THEMES.filter((theme) =>
        // The RULE, not the badge override. `.includes` on the bare selector
        // also matched `...terrain-hazard.needs-badge::after`, so deleting a
        // theme's whole gradient block and leaving its badge behind passed —
        // which is exactly the half that draws the lava.
        !CSS.includes(`.board.theme-${theme} .cell.terrain-${terrain} {`) &&
        !INHERITS[`${terrain}:${theme}`]);
      expect(
        missing,
        `these themes draw the GENERIC ${terrain} tile — ${terrain === 'hazard' ? 'a lava pool' : 'a turquoise pool'}`
          + ` — wherever it lands: ${missing.join(', ')}.\n`
          + `Give each one a rule in styles.css, or add it to INHERITS with a reason.`,
      ).toEqual([]);
    });
  }

  it('keeps the inherit list honest', () => {
    for (const [key, why] of Object.entries(INHERITS)) {
      const [terrain, theme] = key.split(':');
      expect(THEMES, `${theme} is on the inherit list but is not a theme`).toContain(theme);
      expect(why.length, `${key} needs a reason`).toBeGreaterThan(20);
      // A theme that has since been given its own rule should come off the
      // list, or the comment has stopped being true.
      if (CSS.includes(`.board.theme-${theme} .cell.terrain-${terrain} {`) && key !== 'difficult:stone') {
        throw new Error(`${key} has its own rule now — remove it from INHERITS`);
      }
    }
  });

  it('never leaves an effect tile without a badge', () => {
    // The badge is the colour-blind fallback and the semantic tiebreaker, so a
    // theme that restyles a terrain must not silently drop it.
    for (const terrain of ['hazard', 'difficult'] as const) {
      expect(CSS, `${terrain} needs a default badge`)
        .toMatch(new RegExp(`\\.cell\\.terrain-${terrain}\\.needs-badge::after`));
    }
  });
});
