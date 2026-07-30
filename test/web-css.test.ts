import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * A layout class with no rule behind it is a silent failure. `.adv-stage` is
 * `flex: 1`, so if its parent has no styling the stage collapses to zero
 * height and the screen renders as a blank strip — which is exactly what a
 * typo'd root class (`adv-root` for `adventure`) did to the arena. Nothing
 * throws, nothing logs; the page is just empty.
 *
 * So: every class the web code names must exist in the stylesheet. Started as
 * a check on the `adv-*`/`arena-*` layout scaffolding, where a missing rule
 * costs the whole view; widened to everything after a sweep turned up four
 * more dead ones (`card-picker`, `choice-point`, `prepare-list`, `frozen`).
 * Those were harmless — each rode along on a styled primary class — but they
 * read as styling that isn't there.
 */
import { fileURLToPath } from 'node:url';

import { CLASSES } from '../src/data/classes.js';
import { SPECIES } from '../src/data/species.js';

const WEB = fileURLToPath(new URL('../web/src/', import.meta.url));
const CSS = readFileSync(join(WEB, 'styles.css'), 'utf8');

function tsxFiles(): string[] {
  return readdirSync(WEB).filter((f) => f.endsWith('.tsx')).map((f) => join(WEB, f));
}

/** Class names out of `className="a b"` and `` className={`a ${x}`} `` alike. */
function classNamesIn(src: string): string[] {
  const out: string[] = [];
  for (const m of src.matchAll(/className=(?:"([^"]*)"|\{`([^`]*)`\})/g)) {
    const body = m[1] ?? m[2] ?? '';
    // Drop interpolations — `${sel ? 'on' : ''}` is decided at runtime.
    for (const w of body.replace(/\$\{[^}]*\}/g, ' ').split(/\s+/)) {
      if (w) out.push(w);
    }
  }
  return out;
}

describe('web stylesheet coverage', () => {
  it('every class the code names has a rule', () => {
    const defined = new Set(
      [...CSS.matchAll(/\.([a-zA-Z][\w-]*)/g)].map((m) => m[1]!),
    );
    const missing = new Set<string>();
    for (const file of tsxFiles()) {
      for (const cls of classNamesIn(readFileSync(file, 'utf8'))) {
        // A trailing hyphen is the literal half of an interpolated name
        // (`fx-${kind}`), not a class anyone wrote a rule for.
        if (cls.endsWith('-')) continue;
        if (!defined.has(cls)) missing.add(cls);
      }
    }
    expect([...missing], `classes used but never styled: ${[...missing].join(', ')}`).toEqual([]);
  });

  /**
   * The combat top bar overflowed a phone: it wants ~570px of controls and a
   * 390px screen gave it 390, so the page scrolled sideways by 185px and the
   * wave label wrapped to three lines, making the header 152px tall. Verified
   * in a browser at 360/390/430/768/1100px; CI has no browser, so what is
   * pinned here are the three properties that make the overflow impossible.
   *
   * A flex item defaults to `min-width: auto` and so refuses to shrink below
   * its own text — that is the actual mechanism, and it is the one a future
   * edit is most likely to undo by accident.
   */
  it('the combat top bar cannot push the page sideways', () => {
    const rule = (selector: string): string => {
      const i = CSS.indexOf(selector + ' {');
      expect(i, `no rule for ${selector}`).toBeGreaterThan(-1);
      return CSS.slice(i, CSS.indexOf('}', i));
    };
    expect(rule('.topbar'), '.topbar must wrap rather than overflow').toContain('flex-wrap: wrap');
    const mapname = rule('.topbar .mapname');
    expect(mapname, 'the wave label must be allowed to shrink').toContain('min-width: 0');
    expect(mapname, 'the wave label must truncate, not wrap to three lines').toContain('text-overflow: ellipsis');
    expect(mapname).toContain('white-space: nowrap');
    // The controls have to be one flex child, or they wrap one button at a
    // time and the bar grows a ragged extra row per button.
    expect(CSS).toContain('.topbar-tools');
  });

  /**
   * `--topbar-h` positions the floating tip and coach banners. It was declared
   * only as a 46px fallback and never actually set, which was harmless while
   * the bar was one row and wrong the moment it wraps to two: the first
   * learning tip a phone player ever sees landed on top of the controls
   * (measured: toast at 54px under an 84px bar). App.tsx now publishes the
   * measured height, so the fallback must never become the real value again.
   */
  it('the tip banner positions off a measured top bar height', () => {
    const app = readFileSync(join(WEB, 'App.tsx'), 'utf8');
    expect(app, '--topbar-h must be set from a real measurement').toContain("setProperty('--topbar-h'");
    expect(app).toContain('ResizeObserver');
    expect(CSS).toContain('var(--topbar-h');
  });

  /**
   * Log kinds never appear in a `className="..."` literal — they're strings
   * `kindOf` returns and the log interpolates — so the sweep above can't see
   * them. A new kind with no rule doesn't break anything visibly; the line just
   * renders as undifferentiated grey, which is the exact failure the styled log
   * exists to prevent.
   */
  it('every log kind has a rule', () => {
    const src = readFileSync(join(WEB, 'log.ts'), 'utf8');
    const kindOf = src.slice(src.indexOf('function kindOf'), src.indexOf('function subjectOf'));
    const kinds = new Set(
      [...kindOf.matchAll(/return '([a-z ]+)'/g)].flatMap((m) => m[1]!.split(' ')),
    );
    const defined = new Set([...CSS.matchAll(/\.logline\.([a-zA-Z][\w-]*)/g)].map((m) => m[1]!));
    // `misc` is the deliberate default: plain body text, no rule needed.
    const missing = [...kinds].filter((k) => k !== 'misc' && !defined.has(k));
    expect(missing, `log kinds with no style: ${missing.join(', ')}`).toEqual([]);
  });

  /**
   * The board's height budget is MEASURED, not guessed.
   *
   * It used to be `44vh + 14vh·aspect` — 65vh for an 8×12 — and everything
   * below it took what was left. On a phone that ran out: the second row of the
   * action bar was clipped by the navigation bar, reported from a live Chrome
   * on Android. No fixed fraction can be right, because what sits under the
   * board changes with the turn (a character card, one or two rows of buttons,
   * a banner), so the board takes the remainder instead.
   *
   * Three things went wrong while building it, and all three were silent:
   *
   *   - a ResizeObserver on `.battle` never fires, because the column is
   *     height:100% and its own box does not change when a child comes or
   *     goes. The budget was measured once with the tutorial panel up and kept
   *     forever: a 250px board on an 844px screen with 600 available.
   *   - `scrollHeight - board` collapses to `clientHeight - board` once the
   *     column can scroll, so the budget ratcheted down to whatever the board
   *     already was, a little smaller on every render.
   *   - counting out-of-flow children (the floating log, a toast) charged the
   *     board for space they never occupied.
   */
  it('sizes the board off a measured remainder, not a fraction of the viewport', () => {
    const app = readFileSync(join(WEB, 'App.tsx'), 'utf8');
    expect(app, '--board-budget must be published from a measurement').toContain("setProperty('--board-budget'");
    expect(CSS, 'and consumed by the board width').toContain('var(--board-budget');
    // The old guess must not come back.
    expect(CSS, 'the viewport-fraction guess is what clipped the action bar')
      .not.toMatch(/14vh \* var\(--board-aspect/);

    // Re-measured on every render, not only when a box resizes.
    expect(app, 'a ResizeObserver alone goes stale on a height:100% column')
      .toMatch(/useEffect\(\(\) => \{ publishRef\.current\?\.\(\); \}\)/);
    // Siblings summed directly; scrollHeight is self-referential here.
    expect(app, 'must not derive the budget from scrollHeight').not.toContain('root.scrollHeight');
    // Out-of-flow children do not take space in the column.
    expect(app).toContain("cs.position === 'absolute'");
  });

  it('lets the battle column scroll rather than clip', () => {
    const i = CSS.indexOf('.battle {');
    expect(i, 'no .battle rule').toBeGreaterThan(-1);
    const rule = CSS.slice(i, CSS.indexOf('}', i));
    // The board shrinks to fit, so this should never engage — but a button you
    // cannot reach is worse than a board you have to scroll to.
    expect(rule, 'the action bar must stay reachable').toContain('overflow-y: auto');
  });
});

/**
 * Every playable class and species needs a one-line blurb.
 *
 * `classBlurb` falls back to an empty string, which is the right runtime
 * behaviour and the wrong development one: a class with no entry renders a card
 * with a name and a blank line under it, next to eleven cards that explain
 * themselves. Nothing errors, nothing logs, and it looks like a styling glitch
 * rather than missing copy.
 *
 * Both the warlock and the sorcerer shipped that way and were only found by
 * opening the party forge and reading it. This is the same "dead data" shape
 * the rest of the repo guards against — content that exists but says nothing —
 * so it gets the same treatment.
 */
describe('forge copy', () => {
  it('has a blurb for every class and every species', () => {
    const src = readFileSync(join(WEB, 'blurbs.ts'), 'utf8');
    const body = (start: string) => {
      const i = src.indexOf(start);
      return src.slice(i, src.indexOf('};', i));
    };
    const classes = body('export const CLASS_BLURB');
    const species = body('export const SPECIES_BLURB');
    const missingClass = Object.keys(CLASSES).filter((id) => !new RegExp(`\\b${id}:`).test(classes));
    const missingSpecies = Object.keys(SPECIES).filter((id) => !new RegExp(`\\b${id}:`).test(species));
    expect(missingClass, `classes with a blank card in the forge: ${missingClass.join(', ')}`).toEqual([]);
    expect(missingSpecies, `species with a blank card in the forge: ${missingSpecies.join(', ')}`).toEqual([]);
  });
});

/**
 * Where you can walk reads as ONE region, not forty-eight boxes.
 *
 * Every reachable cell used to carry `inset 0 0 0 3px #4a9eff88`, so a 30-foot
 * move on an 8x8 board ringed 48 of its 64 squares in bright blue. The map art,
 * the terrain and the tokens all read through a grid of loud rectangles, and
 * the one thing the rings existed to say — "here is where you can go" — was the
 * hardest thing on the board to see.
 *
 * The ring now belongs to the region's EDGE and the interior gets a wash, which
 * is the same trick the terrain badges already use: an area marked on every
 * interior tile is marked on nothing.
 */
describe('the move overlay is a region, not a grid of boxes', () => {
  const css = readFileSync(fileURLToPath(new URL('../web/src/styles.css', import.meta.url)), 'utf8');
  const board = readFileSync(fileURLToPath(new URL('../web/src/Board.tsx', import.meta.url)), 'utf8');

  const rule = (selector: string) => {
    const at = css.indexOf(`${selector} {`);
    return at < 0 ? '' : css.slice(at, css.indexOf('}', at));
  };

  it('gives the interior no ring at all', () => {
    const base = rule('.hl-move');
    expect(base, 'no .hl-move rule found — has it been renamed?').not.toBe('');
    expect(base, 'every reachable cell is ringed again').not.toContain('box-shadow');
    expect(base, 'the interior lost its wash').toContain('background');
  });

  it('rings only the edge, and more quietly than the old every-cell ring', () => {
    const edge = rule('.hl-move-edge');
    expect(edge, 'the region has no outline').toContain('box-shadow');
    // Thinner than the 3px it replaced: the ring is now a boundary rather than
    // a repeated stamp, so it does not need the weight.
    const px = Number(edge.match(/inset 0 0 0 (\d+)px/)?.[1] ?? 99);
    expect(px, 'the edge ring is back to its old weight').toBeLessThan(3);
  });

  it('marks the edge from the neighbours, not from a guess', () => {
    // The class has to be computed against the highlight map, or it is
    // decoration that happens to look right on one board.
    expect(board, 'Board.tsx never emits hl-move-edge').toContain('hl-move-edge');
    expect(board, 'the edge is not derived from neighbouring cells')
      .toMatch(/highlights\.get\(posKey\(\{ x: x \+ dx, y: y \+ dy \}\)\) === 'move'/);
  });

  it('cross-fades instead of popping when an action clears it', () => {
    // Committing to a move cleared every highlight in the frame the token
    // started sliding, so the board flickered on every action.
    expect(rule('.cell'), 'cells no longer transition their highlight').toContain('transition');
  });
});
