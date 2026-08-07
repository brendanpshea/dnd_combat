import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { restPools, shortLabel } from '../web/src/featurePools.js';
import { byTier } from '../web/src/spellTiers.js';
import { CONDITION_META } from '../web/src/conditions.js';
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

/**
 * The board must not resize because the browser's URL bar moved.
 *
 * MEASURED, at 412x600 with an 8x8 board (short enough that the board is
 * height-constrained rather than width-constrained, which is the case a 390x780
 * phone never exercises):
 *
 *     chrome visible (600px)  board 259px
 *     chrome hidden  (710px)  board 364px
 *     chrome back    (600px)  board 254px
 *
 * A 41% jump mid-fight, triggered by nothing the player did — and it did not
 * land back where it started. The board sizes itself to the height left over,
 * and `height: 100%` tracks the visual viewport, which is exactly what the URL
 * bar changes.
 *
 * WHY THIS IS A SOURCE GUARD AND NOT A BROWSER TEST. Headless Chromium has no
 * URL bar, so it reports `100svh`, `100dvh` and `100lvh` as identical — all
 * equal to the viewport. Checked directly:
 *
 *     headless viewport units: {"svh":600,"dvh":600,"lvh":600,"inner":600}
 *
 * `setViewportSize` changes the real viewport, which `svh` is not supposed to
 * resist. So no automated browser check can tell the fixed layout from the
 * broken one; what can be held is that the shell asks for the stable unit.
 */
describe('the app shell is pinned to the small viewport', () => {
  const css = readFileSync(fileURLToPath(new URL('../web/src/styles.css', import.meta.url)), 'utf8');

  it('sizes the shell in svh, the unit the URL bar does not move', () => {
    expect(css, 'the shell no longer asks for svh').toMatch(/@supports \(height: 100svh\)/);
    const at = css.indexOf('@supports (height: 100svh)');
    const block = css.slice(at, css.indexOf('}', css.indexOf('{', at) + 1) + 1);
    expect(block, 'the svh rule does not cover the shell').toMatch(/html,\s*body,\s*#root/);
    expect(block).toContain('100svh');
  });

  it('keeps a plain fallback for anything without svh', () => {
    // The `@supports` guard means an engine that has never heard of svh gets
    // exactly today's behaviour rather than a shell with no height at all.
    expect(css).toMatch(/html,\s*body,\s*#root \{ height: 100%; \}/);
  });

  it('does not use dvh, which is the unit that tracks the bar', () => {
    // dvh is the trap: it looks like the modern choice and it is precisely the
    // one that changes as the chrome slides.
    expect(css, 'dvh tracks the URL bar — that is the bug, not the fix').not.toContain('dvh');
  });
});

/**
 * The board must not change size when the turn changes.
 *
 * MEASURED at 412x600 with an 8x8 board, sampling every 60ms across five turns:
 *
 *     254px  with the action bar        (your turn)
 *     349px  without it                 (an enemy's turn)
 *
 * A 37% jump every single turn. The action bar is only rendered on a human's
 * turn, and the board is budgeted from whatever height is left over, so the
 * board grew the instant an enemy started acting and shrank back when you got
 * the initiative again. That is the resize — and it is far more frequent than
 * the browser-chrome one it was first mistaken for.
 *
 * After: 308px / 312px. The 4px that remains is the status line, which really
 * does render at slightly different heights for a hero and a monster.
 */
describe('the board keeps its size across a turn change', () => {
  const app = readFileSync(fileURLToPath(new URL('../web/src/App.tsx', import.meta.url)), 'utf8');

  it('remembers the action bar height for the turns it is not rendered on', () => {
    expect(app, 'nothing remembers the bar height across turns').toContain('barHeight');
    // Held in a ref, because the measuring pass runs after every render and a
    // piece of state would loop.
    expect(app).toMatch(/barHeight\s*=\s*useRef\(0\)/);
  });

  it('reserves that height when the bar is absent', () => {
    // The budget has to subtract the bar whether or not it is on screen, or the
    // board simply takes the space back on the enemy's turn.
    expect(app).toMatch(/querySelector\('\.actionbar'\) \? 0 : barHeight\.current/);
  });
});

/**
 * The numbers on the tiles are the clutter, not the blue.
 *
 * Every reachable cell with any risk at all wore a number and every one with any
 * cover wore a shield, so a hazard map put dozens of small figures over the
 * board they were drawn on. The rule now matches what `styles.css` already says
 * about the lethal case being "the one worth interrupting for".
 */
describe('tile badges stay out of the way', () => {
  const css = readFileSync(fileURLToPath(new URL('../web/src/styles.css', import.meta.url)), 'utf8');
  const board = readFileSync(fileURLToPath(new URL('../web/src/Board.tsx', import.meta.url)), 'utf8');

  it('hides the cover shield until the tile is considered', () => {
    expect(css).toMatch(/\.cover-badge \{[^}]*opacity: 0/);
  });

  it('still shows it on hover and on keyboard focus', () => {
    expect(css).toContain('.cell:hover .cover-badge');
    expect(css).toContain('.cell:focus-visible .cover-badge');
  });

  it('hides with opacity, so a screen reader still reads it', () => {
    // `display: none` would drop the aria-label the badge already carries.
    // Two rules share this selector — the layout one legitimately sets
    // `display: flex` — so find the one that does the hiding.
    const hider = [...css.matchAll(/\.cover-badge \{([^}]*)\}/g)]
      .map((m) => m[1]!)
      .find((body) => /opacity:\s*0\s*;/.test(body));
    expect(hider, 'nothing hides the cover badge any more').toBeDefined();
    expect(hider).not.toContain('display');
  });

  it('does not put a damage number on every reachable cell', () => {
    // The per-cell risk badge is gone on purpose. It annotated every tile the
    // hero could reach; on a hazard map that is dozens of 7px numbers, and the
    // lethal variant was always-on and pulsing, so a hurt hero lit up half the
    // board. Reported from a session with a young player as tiny text covering
    // everything. The opportunity attack — the only part a player cannot see
    // coming — asks at the moment of the step instead.
    expect(css, 'the per-cell risk badge is back').not.toContain('.risk-badge');
    expect(board, 'the board is annotating cells with walk damage again')
      .not.toContain('riskCells');
  });
});

/**
 * No empty box under the board.
 *
 * The narration strip renders a non-breaking space when there is no line, so its
 * height is reserved and the board never shifts as lines come and go. But the
 * panel, border and shadow were drawn around that space, so for most of a fight
 * a small empty box sat under the board looking like something that had failed
 * to load. Reported from a real phone.
 */
describe('the narration strip is invisible when it has nothing to say', () => {
  const css = readFileSync(fileURLToPath(new URL('../web/src/styles.css', import.meta.url)), 'utf8');
  const app = readFileSync(fileURLToPath(new URL('../web/src/App.tsx', import.meta.url)), 'utf8');

  it('drops its panel when quiet', () => {
    const at = css.indexOf('.narration.quiet {');
    expect(at, 'no quiet state for the narration strip').toBeGreaterThan(0);
    const block = css.slice(at, css.indexOf('}', at));
    expect(block).toContain('background: none');
    expect(block).toContain('border-color: transparent');
  });

  it('still reserves the height, so the board does not shift', () => {
    // The whole reason the element renders a space in the first place.
    const at = css.indexOf('.narration {');
    const block = css.slice(at, css.indexOf('}', at));
    expect(block, 'the reserved height is gone — the board will jump').toContain('min-height');
  });

  it('is driven by a class, because :empty can never match here', () => {
    // The space is a text node, so the element is never `:empty`. A CSS-only
    // attempt at this silently does nothing.
    expect(app).toMatch(/narration\$\{narration \? '' : ' quiet'\}/);
    expect(css, ':empty cannot match an element holding a space').not.toContain('.narration:empty');
  });
});

/**
 * Camp: scribing is study, not shopping — and a lunch is not a night.
 *
 * Scribing a scroll sat FOUR TAPS deep inside the market (open the stall, pick
 * a buyer, tap a pack item, find `Scribe` under the sell price) and the stalls
 * shut at noon — so the one camp activity that is pure study was unavailable
 * for half of every day. Reported as simply not finding it.
 *
 * And the day header read "Day 2 · Morning" against "Day 1 · Afternoon": one
 * word apart, for two rests that restore very different things. A night gives
 * everything back; a lunch gives hit points and leaves your spent slots spent.
 */
describe('the camp says what it is offering', () => {
  const arena = readFileSync(fileURLToPath(new URL('../web/src/Arena.tsx', import.meta.url)), 'utf8');
  const css = readFileSync(fileURLToPath(new URL('../web/src/styles.css', import.meta.url)), 'utf8');

  it('offers scribing from the spell panel, which is open all day', () => {
    // The panel the spellbook is already in — not the stall, which is shut in
    // the afternoon.
    expect(arena, 'nothing computes what can be scribed').toContain('const scribable');
    expect(arena, 'the scribe list is not rendered').toContain('scribe-shelf');
    const at = arena.indexOf('scribe-shelf');
    // It has to sit inside the prepare panel, not the shop one.
    const panelAt = arena.lastIndexOf("panel === 'prepare'", at);
    const shopAt = arena.lastIndexOf("panel === 'shop'", at);
    expect(panelAt, 'the scribe shelf is not under the spell panel').toBeGreaterThan(shopAt);
  });

  it('flags a scribable scroll on the closed panel', () => {
    // Otherwise it is discoverable only by opening the panel that hides it —
    // which is the bug, one level shallower.
    expect(arena).toMatch(/scribable\.length > 0 \? '\u{1F4DC}'/u);
    expect(css, 'the scroll marker has no style of its own').toContain('.prep-badge.scribe');
  });

  it('tells the two rests apart by what they restore', () => {
    // What each rest RESTORES, which is the difference that matters. This used
    // to check for the literal "rested overnight" — but that phrase was the
    // line saying WHEN it is for a third time, after the sun mark and the
    // title had both already said so. The news is the restore list.
    expect(arena, 'the morning no longer says what a night gives back')
      .toContain('slots, abilities and hit dice all back');
    expect(arena, 'the afternoon no longer warns that slots stay spent').toContain('stay spent until tonight');
    // …and they do not merely differ by a word: the halves are styled apart.
    expect(css).toContain('.arena-when.morning');
    expect(css).toContain('.arena-when.afternoon');
  });
});

/**
 * A banner that floats over the play area must not eat taps.
 *
 * The coach banner is `position: fixed` and was anchored `bottom: actionbar-h +
 * 14px` — which assumes the action bar is flush with the bottom of the window.
 * It is in flow, so it is not: whenever the layout does not fill the viewport
 * the bar rides up and the banner lands on top of it.
 *
 * Found by a Playwright click on "End turn" timing out at 412x800 with
 * "coach-banner subtree intercepts pointer events" — in the TUTORIAL, which is
 * the worst possible place for an unclickable button. It was a regression from
 * moving the banner to the bottom to stop it covering the enemies.
 *
 * Two independent fixes, because either alone would have left the bug
 * reachable: the banner is anchored to where the bar actually is, and it is
 * click-through regardless of where it lands.
 */
describe('the coach banner cannot block the action bar', () => {
  const css = readFileSync(fileURLToPath(new URL('../web/src/styles.css', import.meta.url)), 'utf8');
  const app = readFileSync(fileURLToPath(new URL('../web/src/App.tsx', import.meta.url)), 'utf8');

  it('lets taps through, since it carries no controls of its own', () => {
    // The standalone rule, not the `\n.tip-toast, .coach-banner {` one that
    // contains the same text — the shared rule covers both banners, and the
    // tip must stay clickable.
    const at = css.indexOf('\n.coach-banner {');
    expect(at, 'no standalone .coach-banner rule').toBeGreaterThan(0);
    const block = css.slice(at, css.indexOf('}', at));
    expect(block, 'the banner can swallow a tap again').toContain('pointer-events: none');
  });

  it('leaves the tip toast clickable, because that one has a dismiss button', () => {
    // Blanket `pointer-events: none` on both would make the tip impossible to
    // close — the opposite bug.
    const at = css.indexOf('.tip-toast {');
    const block = css.slice(at, css.indexOf('}', at));
    expect(block).not.toContain('pointer-events: none');
  });

  it('anchors to where the action bar actually is', () => {
    // Not to the bottom of the window, which is only the same thing when the
    // layout happens to fill the screen.
    expect(css).toContain('var(--above-bar');
    expect(app, 'nothing measures the bar\'s top edge').toContain('--above-bar');
    expect(app).toMatch(/innerHeight - abar\.getBoundingClientRect\(\)\.top/);
  });
});

/**
 * The combat status box: say what a player can read, and only what they can use.
 *
 * Two faults, both visible in one screenshot at 412x800.
 *
 * "SeW oo" — the fighter's Second Wind, abbreviated. `shortLabel` goes to real
 * trouble to keep those initials unique ("SeW" against the paladin's "SaW"),
 * and it is right to: the CAMP screen lists every hero at once, so labels
 * collide and space is tight. None of that is true of the combat card, which
 * shows exactly one creature with nothing beside it — and on a touch screen
 * there is no tooltip to decode a crossword clue with.
 *
 * And on an enemy's turn the card lit ACTION and BONUS in gold beside a
 * movement figure — an enemy's action economy, which is the AI's business and
 * nothing the player can spend. Three things that looked usable and were not.
 */
describe('the combat status box', () => {
  const app = readFileSync(fileURLToPath(new URL('../web/src/App.tsx', import.meta.url)), 'utf8');
  const pips = readFileSync(fileURLToPath(new URL('../web/src/FeaturePips.tsx', import.meta.url)), 'utf8');
  const css = readFileSync(fileURLToPath(new URL('../web/src/styles.css', import.meta.url)), 'utf8');

  it('spells feature pools out in combat instead of initialling them', () => {
    expect(app, 'the combat card is back to abbreviations').toMatch(/labels="full"/);
    expect(pips, 'FeaturePips cannot say the whole name').toMatch(/labels === 'full' \? p\.name : p\.short/);
  });

  it('keeps the abbreviation for the camp, where labels really do collide', () => {
    // `short` must survive: the multi-hero row is what it was built for, and
    // deleting it would trade one unreadable screen for another.
    expect(pips).toContain('p.short');
    expect(shortLabel('second-wind'), 'the camp label changed shape').toBe('SeW');
  });

  it('offers a real name to spell out', () => {
    // Behavioural, not a source read: the pool has to carry the feature's
    // actual name or "full" would print an id.
    const pools = restPools({ 'second-wind': { current: 1, max: 2 } });
    expect(pools[0]?.name).toBe('Second Wind');
    expect(pools[0]?.short).toBe('SeW');
  });

  it('sets the text beside the portrait instead of below it', () => {
    // The portrait was a flex item in the same wrap flow as the text, so it
    // claimed row one alone and the card stood `portrait + gap + text` tall —
    // 86px measured at 412px wide for two short lines. Boxing the text puts it
    // alongside the face, so the card is the taller of the two, not their sum:
    // 52px measured for the same content, hero and enemy alike.
    const face = app.indexOf('adv-party-face');
    const body = app.indexOf('className="statusline-body"', face);
    expect(body, 'the status text is loose in the portrait row again').toBeGreaterThan(face);
    // The name is the first thing after the face, so it has to be inside.
    expect(app.indexOf('<strong>{active.name}</strong>'), 'the text escaped the box')
      .toBeGreaterThan(body);
    const rule = css.slice(css.indexOf('.statusline-body {'));
    expect(rule.slice(0, 200), 'the box no longer takes the leftover width')
      .toMatch(/flex:\s*1 1 0/);
  });

  it('shows action economy only for a creature the player drives', () => {
    const at = app.indexOf('className="economy"');
    expect(at, 'no economy chips at all').toBeGreaterThan(0);
    // The gate has to be immediately above them, not merely somewhere earlier
    // in the file: `runsItself` is used to decide whose turn it is too, and
    // matching that one would pass with the chips wide open.
    const near = app.slice(Math.max(0, at - 400), at);
    expect(near, 'the economy chips are shown for enemies again')
      .toContain('!runsItself(active) && (');
  });
});

/**
 * The spell tray, reported from a real phone: "each spell / box / check is
 * multiple lines (breaks out spell title from check)".
 *
 * The name was a bare text node inside the label, which makes it an anonymous
 * flex item — free to wrap. It did: the checkbox held the left edge and
 * "Shocking Grasp" broke underneath it, so a row was two or three ragged lines
 * and the tick no longer read as belonging to the spell beside it.
 *
 * Three more faults came out of measuring it at 390x780 with a 9th-level
 * wizard, whose three lists come to 3178px of content:
 *
 *   - the ⓘ dot asked for 24px and got 40, because the global
 *     `button { min-height: 40px }` outranks a plain `height`. It was the
 *     tallest thing in every row, so 66 spells cost 44px of pitch each for a
 *     26px label — and the roominess of the row was an accident nobody meant.
 *   - `max-height: 60vh` showed 468px of that behind 312px of backdrop. It is
 *     a modal; there is nothing behind it worth keeping in view.
 *   - the lists arrive in pool order, so a 37-entry spellbook was one
 *     undifferentiated wall. A caster picks by tier.
 */
describe('the spell tray', () => {
  const tray = readFileSync(fileURLToPath(new URL('../web/src/SpellTray.tsx', import.meta.url)), 'utf8');
  const css = readFileSync(fileURLToPath(new URL('../web/src/styles.css', import.meta.url)), 'utf8');
  // Anchored to the start of a line: `.prepare-option {` is a substring of
  // `.prepare-option-row .prepare-option {`, and matching that one reads a
  // three-word rule instead of the one being asserted about.
  const rule = (sel: string): string => {
    const i = css.indexOf('\n' + sel + ' {');
    expect(i, `no rule for ${sel}`).toBeGreaterThan(-1);
    return css.slice(i, css.indexOf('}', i));
  };

  it('never breaks a spell name away from its checkbox', () => {
    // The name has to be an element of its own — a bare text node cannot be
    // told not to wrap.
    expect(tray, 'the name is a loose text node again').toContain('className="prepare-option-name"');
    expect(rule('.prepare-option-name'), 'the name may wrap under its tick again')
      .toContain('white-space: nowrap');
  });

  it('sizes columns so a whole name fits on a phone', () => {
    // Measured: 210px tracks give one column at 360 and 390px (nothing
    // clipped, no row over 40px tall) and two in the 560px desktop tray.
    // Narrower tracks fit two columns on a phone and truncated real spells —
    // "Burning Han…" is no better than a wrapped row.
    const track = rule('.prepare-grid').match(/minmax\((\d+)px/);
    expect(track, 'the grid no longer sizes its own tracks').toBeTruthy();
    expect(Number(track![1]), 'a column this narrow clips real spell names')
      .toBeGreaterThanOrEqual(200);
  });

  it('lets the info dot be smaller than a full button', () => {
    expect(rule('.prepare-option-row .info-dot'), 'the global 40px button floor is back')
      .toContain('min-height');
    // ...and the label keeps a real tap target of its own, rather than
    // inheriting one from the dot beside it.
    expect(rule('.prepare-option')).toContain('min-height: 34px');
  });

  it('gives the sheet most of the phone rather than most of the backdrop', () => {
    const max = rule('.tray').match(/max-height:\s*(\d+)vh/);
    expect(max, 'the tray lost its height cap').toBeTruthy();
    expect(Number(max![1]), 'back to showing a sixth of the content').toBeGreaterThanOrEqual(80);
  });

  it('groups the leveled lists by tier, cheapest first', () => {
    // Behavioural: real spell ids through the real grouping.
    const tiers = byTier(['fireball', 'magic-missile', 'shield', 'cone-of-cold', 'web']);
    expect(tiers.map(([lv]) => lv), 'tiers out of order').toEqual([1, 2, 3, 5]);
    expect(tiers[0]![1], 'first-level spells split up').toEqual(['magic-missile', 'shield']);
    expect(tiers[2]![1]).toEqual(['fireball']);
    // A heading must span the grid or the spells under it start in column two.
    expect(rule('.prepare-tier')).toContain('grid-column: 1 / -1');
  });

  it('does not let the setup screen restyle every label inside it', () => {
    // The reported fault — "the level up spell screen wastes a lot of space" —
    // was `.setup label { flex-direction: column }`, a rule written for the
    // party forge's own captioned fields. The tray renders inside `.setup`, so
    // every spell checkbox inherited it, stacking the tick above the name and
    // turning a 34px row into 77px. Measured: 77 -> 54.
    //
    // The hazard is the SHAPE — a bare element descendant of a screen-level
    // class — but only for properties that decide layout. `.setup select` is a
    // form-control skin (font, colour, border) and is meant to reach every
    // control on the screen; that one is fine and stays. Laying out somebody
    // else's element is what is banned.
    const leaks: string[] = [];
    for (const m of css.matchAll(/^\.setup\s+([a-z]+)[^{]*\{([^}]*)\}/gm)) {
      if (/(^|[\s;])(display|flex-direction|grid-template|position)\s*:/.test(m[2]!)) {
        leaks.push(m[1]!);
      }
    }
    expect(leaks, `.setup lays out bare <${leaks[0]}> elements — it will reach components mounted inside it`)
      .toEqual([]);
  });

  it('makes each option state its own direction rather than trust the screen', () => {
    // The other half of the fix: a component that can be mounted anywhere has
    // to declare the layout it needs, not inherit one.
    expect(rule('.prepare-option'), 'the option relies on its container for a row again')
      .toContain('flex-direction: row');
  });

  it('turns a wide screen into more columns rather than more scrolling', () => {
    // `.tray` is 560px because most trays are lists. This one is a GRID of
    // short rows, so on a 1250px tablet the 560px cap resolved to two 265px
    // tracks and the sheet scrolled for three more screens with half the
    // viewport empty. Measured at 1250x2000: four columns, 1222px -> 679px.
    const wide = rule('.tray-prepare').match(/min\((\d+)px/);
    const base = rule('.tray').match(/width:\s*min\((\d+)px/);
    expect(wide, 'the prepare tray lost its own width').toBeTruthy();
    expect(base, 'the tray lost its width').toBeTruthy();
    expect(Number(wide![1]), 'the prepare tray is back to a list-width column')
      .toBeGreaterThan(Number(base![1]));
    // Only useful if the grid actually spends the width on tracks.
    expect(rule('.prepare-grid'), 'a fixed column count would waste the extra width')
      .toContain('auto-fill');
    expect(tray, 'the tray is no longer marked as the prepare variant')
      .toContain('tray-prepare');
  });

  it('draws every option as a tile, not only the ticked ones', () => {
    // Unticked rows were bare text on the panel, so a multi-column grid read as
    // ragged columns of words with no row boundaries.
    expect(rule('.prepare-option'), 'unticked options have no tile again')
      .toMatch(/background:/);
  });

  it('lists a wizard\'s spells once, with both ticks on the row', () => {
    // The spellbook and the prepared list were two grids over the same names.
    // The merged row is `DualOption`; the plain `Option` survives for cantrips
    // and for a knows-all caster, which genuinely has one decision per spell.
    expect(tray, 'the merged row is gone — the two grids are back').toContain('DualOption');
    expect(rule('.prepare-prep'), 'the second tick has no style').toContain('width');
    // The second grid may only render for a caster with no book to merge into.
    const second = tray.indexOf('Prepared ({prepareDraft.length}/{cap})');
    expect(second, 'no standalone prepared list at all — a cleric has nothing to pick from')
      .toBeGreaterThan(-1);
    expect(tray.slice(Math.max(0, second - 400), second),
      'the standalone prepared list is not gated on the caster having no spellbook')
      .toMatch(/!usesBook \|\| locked/);
  });

  it('keeps the second tick a real tap target', () => {
    // It is one emoji wide, which is exactly how a control ends up at 16px.
    expect(rule('.prepare-prep')).toContain('min-height: 34px');
    // Hidden by size, not by `display: none` — a removed input cannot be
    // focused, and the pad around it is the only thing a keyboard can reach.
    expect(rule('.prepare-prep input'), 'the checkbox was removed from the tab order')
      .not.toMatch(/display:\s*none/);
  });

  it('keeps the close button in the corner, not adrift in the title', () => {
    // The tally used to sit inline between the name and the ✕, wrapping the
    // header to four lines and pushing the only way out of a long sheet into
    // the middle of it.
    const title = tray.indexOf('className="tray-title"');
    const close = tray.indexOf('onClick={onClose}>✕', title);
    const tally = tray.indexOf('tray-tally');
    expect(close, 'no close button after the title').toBeGreaterThan(title);
    expect(tally, 'the tally is back between the title and the ✕').toBeGreaterThan(close);
    expect(rule('.tray-tally'), 'the tally no longer takes a row of its own').toContain('100%');
  });
});

/**
 * A sleeping enemy has to LOOK asleep.
 *
 * The board toppled a creature with the `prone` condition and a hero at 0 HP,
 * and nothing else. A target that failed its save against Sleep stood upright
 * in full colour — indistinguishable from an enemy about to act, which is the
 * one thing the caster spent a slot to change. The rules agree: an unconscious
 * creature falls prone.
 *
 * `incapacitated` is deliberately excluded. It is Sleep's first stage, and a
 * merely incapacitated creature stays on its feet.
 */
describe('unconscious creatures on the board', () => {
  const board = readFileSync(fileURLToPath(new URL('../web/src/Board.tsx', import.meta.url)), 'utf8');

  it('are toppled like a prone one', () => {
    const at = board.indexOf("? 'prone' : ''");
    expect(at, 'the board no longer tilts anything').toBeGreaterThan(0);
    const test = board.slice(Math.max(0, at - 260), at);
    expect(test, 'a slept creature stands upright again').toContain("condition.id === 'unconscious'");
    expect(test).toContain("condition.id === 'prone'");
    expect(test, 'merely incapacitated should stay on its feet')
      .not.toContain("'incapacitated'");
  });

  it('still let a downed body own the greyed-out look', () => {
    // Both classes on one token would fight over `transform`; `downed` is the
    // one that also greys and hides the HP bar, so it must win.
    const at = board.indexOf("? 'prone' : ''");
    expect(board.slice(Math.max(0, at - 300), at)).toContain('!isDown(c)');
  });

  it('have a glyph to go with the posture', () => {
    expect(CONDITION_META.unconscious?.icon, 'nothing marks the sleeper').toBeTruthy();
  });
});

/**
 * The arena's day, as a step bar rather than three toggles.
 *
 * Reported: "clicking on shop or party management entirely removes the choice
 * of combat." It did. A panel replaces the gate content, so the doors you were
 * picking between vanish — a deliberate fix for a real problem (the stall used
 * to open UNDERNEATH, making the screen 4.8 phone-fulls long) that traded one
 * bad screen for a mode you had to work out how to leave. The Fight button
 * stayed pinned, so you could still commit; you just could not see to what.
 *
 * The row is now Spells, Stall, Gear, Doors — the day's own order, and the
 * doors are a destination you can tap from anywhere rather than the absence of
 * a panel. Nothing is locked: on a day where you want only the fight, the fight
 * is one tap away. That is deliberate, and the alternative was considered — a
 * strict cycle would guarantee the ordering but nag on the fifth identical day,
 * and steps that are no-ops nag worst of all.
 */
describe('the arena day steps', () => {
  const arena = readFileSync(fileURLToPath(new URL('../web/src/Arena.tsx', import.meta.url)), 'utf8');
  // To the element's real end, not a guessed window: a short slice silently
  // cut the Doors step off and the order assertion "passed" on -1s.
  const barStart = arena.indexOf('className="arena-tools"');
  const bar = arena.slice(barStart, arena.indexOf('\n                </div>', barStart));

  it('runs in the day\'s order, ending at the doors', () => {
    const at = (label: string) => bar.indexOf(`<small>${label}</small>`);
    for (const l of ['Spells', 'Stall', 'Gear', 'Doors']) {
      expect(at(l), `no ${l} step`).toBeGreaterThan(-1);
    }
    expect(at('Spells')).toBeLessThan(at('Stall'));
    expect(at('Stall')).toBeLessThan(at('Gear'));
    expect(at('Gear'), 'the doors must come last — they are what the rest is for')
      .toBeLessThan(at('Doors'));
  });

  it('always offers a way back to the doors', () => {
    // The regression this exists for: no Doors step, so a panel is a mode and
    // the only exit is noticing the button you pressed now says Close.
    const doors = bar.slice(bar.indexOf('<small>Doors</small>') - 320);
    expect(bar, 'the doors step is gone').toContain('<small>Doors</small>');
    expect(doors, 'the doors step must clear whatever panel is open')
      .toContain("setPanel('none')");
  });

  it('selects rather than toggles', () => {
    // A step bar's buttons name where you are going. `Close` made a button name
    // what it would do to itself, which is the mode it used to be.
    expect(bar, 'the tools toggle themselves shut again').not.toContain("'none' : 'shop'");
    expect(bar).not.toContain("'none' : 'prepare'");
    // Every step's label is a fixed word. A `<small>{...}</small>` is the shape
    // the old toggles had — the label changing to "Close" is how a button stops
    // naming a place and starts naming a mode. (Matching the bare word "Close"
    // is no good here: this file's own comments explain the fault.)
    expect(bar, 'a step is labelled by what it does to itself again')
      .not.toMatch(/<small>\{/);
  });

  it('says a step is shut rather than hiding it', () => {
    // The stall closes at noon. A step that vanishes half the time reads as a
    // bug; one that says "Shut" teaches the day model.
    // ...and it keeps its own name while saying so. Renaming the step to
    // "Shut" made a lone verb sit in a row of places, reading as an
    // instruction to shut something rather than as the stall being closed.
    expect(bar, 'the stall step stops naming the stall').toContain('<small>Stall</small>');
    expect(bar, 'nothing says the stall is closed').toContain('step-shut');
    expect(bar).toContain('disabled');
  });

  it('badges the steps with work waiting, gear included', () => {
    // Gear was the silent one: the morning review names upgradeable kit once
    // and is then gone, so a Mace +1 sat in a pack with nothing on screen.
    // On the GATE, not merely mentioned: `toContain('gearTodo')` passed with
    // the condition replaced by `false`, because the count inside the badge
    // still spelled the name.
    expect(bar, 'the gear badge no longer depends on there being work')
      .toMatch(/\{gearTodo > 0 && \(/);
    expect(arena, 'the badge must come from the same helper the review uses')
      .toContain('gearTasks(c).length');
  });
});

/**
 * The arena gate, after a design pass on a real phone screenshot.
 *
 * The screen had twelve zones at roughly one weight, and the decision it exists
 * for — which door — was the most cramped thing on it. Three faults were cheap
 * to fix and are pinned here; the fourth (the doors' own layout) is its own
 * change.
 *
 *  - THE SAME MONSTERS, TWICE. Each door card drew 16px thumbnails, and the
 *    selected door's roster drew the same creatures full-size and named, 400px
 *    further down. Two representations of one fact, neither near the other.
 *  - THE ROSTER WAS DETACHED FROM THE DOORS. It sat below the buffs and the
 *    skill checks, so the one row that CHANGES when you pick a different door
 *    was separated from the doors by two rows that do not.
 *  - THE WARNING WAS A FOOTNOTE. "You have outgrown this day" means the fight
 *    is beneath you and so is its reward — and it was grey, small and last,
 *    tacked onto the end of a sentence about rests.
 */
describe('the arena gate', () => {
  const arena = readFileSync(fileURLToPath(new URL('../web/src/Arena.tsx', import.meta.url)), 'utf8');

  it('draws each monster once', () => {
    expect(arena, 'the door cards are repeating the roster below them')
      .not.toContain('gate-foe');
    expect(arena, 'nothing names the monsters at all now').toContain('arena-foes');
    // The card still has to say HOW MANY — that is the part it was carrying.
    expect(arena).toContain('gate-count');
  });

  it('puts the roster with the doors it belongs to', () => {
    /*
     * The roster is the one thing on the screen that CHANGES when you pick a
     * different door, so it sits directly under the cards.
     *
     * This used to compare the roster's position against the check row, which
     * was the thing that had been wedged between them. That comparison stopped
     * meaning anything when the check moved to a phase of its own: a phase is
     * declared EARLIER in the file than the gate markup, so the old assertion
     * failed while the layout it cared about was better than ever. Scoped to
     * the doors screen now, and asked directly.
     */
    const doorsStart = arena.indexOf("<div className={panel === 'none' ? '' : 'hidden'}>");
    const doorsEnd = arena.indexOf("{panel === 'gear' && (", doorsStart);
    expect(doorsStart, 'the doors screen is gone').toBeGreaterThan(-1);
    const doors = arena.slice(doorsStart, doorsEnd);

    const gates = doors.indexOf('<div className="gates">');
    const foes = doors.indexOf('<div className="arena-foes">');
    expect(gates, 'no door cards on the doors screen').toBeGreaterThan(-1);
    expect(foes, 'the roster is not on the doors screen at all').toBeGreaterThan(gates);
    // Nothing between the cards and the faces they belong to.
    const between = doors.slice(doors.indexOf('</div>', gates), foes);
    expect(between.includes('SkillGambit'), 'a check is wedged between the doors and their roster')
      .toBe(false);
  });

  it('gives the outgrown-day warning its own weight', () => {
    expect(arena, 'the warning is back to being a hint').toContain('arena-warn');
    // Specifically NOT welded onto the rest sentence, which is where it hid.
    // Anchored on the class, not on the prose beside it — the wording of that
    // sentence has already changed once since this was written.
    const hint = arena.indexOf('<p className="hint">', arena.indexOf('arena-warn'));
    const warn = arena.indexOf('arena-warn');
    expect(hint, 'no rest hint after the warning at all').toBeGreaterThan(-1);
    expect(warn, 'the warning trails the sentence it used to hide in')
      .toBeLessThan(hint);
    expect(CSS).toContain('.arena-warn {');
  });

  it('marks the time of day with something that reads as a time', () => {
    // 🍞 is a loaf. The sub-line had to explain the mark, which is the mark
    // failing at its one job.
    expect(arena, 'the afternoon is a bakery again').not.toContain("'🍞'");
    expect(arena).toContain("'☀️'");
  });
});

/**
 * A health bar's colour has to mean health.
 *
 * The fill was `linear-gradient(90deg, red, green)` across its OWN width, so
 * every bar was red at the left edge and green at the right — including a hero
 * at full health, who read as half-wounded. Colour encoded position in the bar,
 * which is not a fact about anything.
 */
describe('the party strip health bars', () => {
  const adv = readFileSync(fileURLToPath(new URL('../web/src/Adventure.tsx', import.meta.url)), 'utf8');

  it('are a solid band chosen by how hurt you are', () => {
    expect(CSS, 'the gradient is back — full health reads as wounded')
      .not.toMatch(/\.adv-party-hpbar > div \{[^}]*linear-gradient/);
    for (const band of ['hp-ok', 'hp-hurt', 'hp-low']) {
      expect(CSS, `no rule for ${band}`).toContain(`.adv-party-hpbar > div.${band}`);
    }
    expect(adv, 'the band is not chosen from the percentage').toContain('hpBand(pct)');
  });

  it('still say how much is left with width', () => {
    expect(adv).toMatch(/width: `\$\{pct\}%`/);
  });
});

/**
 * The doors are the decision. They get the width.
 *
 * Three columns on a phone gave each card ~130px: three-line descriptions in
 * 11px grey, a reward that wrapped into the card edge, and the most cramped
 * element on a screen whose only real question it is — while the roster, the
 * checks and the prose below it had five times the room.
 *
 * There WAS a `max-width: 420px` rule meant to stack them, and it is why this
 * was reported from a phone rather than caught here: the reporter's phone is
 * ~443px across, so the breakpoint never fired and they got three columns
 * anyway. A pixel breakpoint guesses at devices; sizing the track states the
 * actual rule — a column narrower than this cannot hold a name, a line of
 * description and a reward — and it holds on hardware nobody tested. The spell
 * tray's option grid learnt the same lesson.
 */
describe('the arena doors', () => {
  const arena = readFileSync(fileURLToPath(new URL('../web/src/Arena.tsx', import.meta.url)), 'utf8');
  const rule = (sel: string): string => {
    const i = CSS.indexOf('\n' + sel + ' {');
    expect(i, `no rule for ${sel}`).toBeGreaterThan(-1);
    return CSS.slice(i, CSS.indexOf('}', i));
  };

  it('size their own tracks instead of guessing at a phone', () => {
    const gates = rule('.gates');
    expect(gates, 'three hard columns are back — that is the bug on a 443px phone')
      .not.toMatch(/repeat\(3,/);
    const track = gates.match(/minmax\((\d+)px/);
    expect(track, 'the grid no longer sizes its own tracks').toBeTruthy();
    // Measured: 260px gives one column at 390 and 443, two at 900, with every
    // blurb on a single line and no card overflowing.
    expect(Number(track![1]), 'a column this narrow puts the blurb back to three lines')
      .toBeGreaterThanOrEqual(240);
    expect(CSS, 'the pixel breakpoint is back').not.toMatch(/max-width: 420px[\s\S]{0,80}\.gates/);
  });

  it('put the name and the headcount on one line', () => {
    expect(arena, 'the head row is gone').toContain('className="gate-head"');
    const head = arena.indexOf('className="gate-head"');
    const name = arena.indexOf('gate-name', head);
    const count = arena.indexOf('gate-count', head);
    expect(name).toBeGreaterThan(head);
    expect(count, 'the headcount left the head row').toBeGreaterThan(name);
    // `margin-top: auto` existed to make three ragged columns end level.
    // Stacked, there is nothing to line up and it just pushed the count away.
    expect(rule('.gate-count'), 'the count is being pushed to the card foot again')
      .not.toContain('margin-top: auto');
  });

  it('keep gold for selection alone', () => {
    // Inside a card that uses gold to mean "you picked this", a gold reward
    // title on every card made them all look half-chosen.
    expect(rule('.gate-bounty b'), 'the reward title is competing with the selected door again')
      .not.toContain('var(--gold)');
    expect(rule('.gate.on .gate-name'), 'selection lost its colour').toContain('var(--gold)');
  });

  it('draw the reward divider across the whole card', () => {
    // `.gate` is align-items: flex-start, so this shrank to its own text and
    // the dashed rule spanned about a third of the card — which reads as a
    // broken border rather than a divider.
    expect(rule('.gate-bounty')).toContain('align-self: stretch');
  });
});

/**
 * Repetitive text on the gate, reported from the same screen: "there is a lot
 * of repetitive unnecessary text."
 *
 * Counted, there was — 131 words, with the same facts printed twice:
 *
 *  - THE BOUNTY, DRAWN TWICE. The selected door's reward was on its card
 *    (name + prize) and again below under "This door pays" (heading + the same
 *    name + the same prize + gold), with only the how-to-earn-it line unique to
 *    the second. Exactly the duplication the monster art had one change ago.
 *  - "ENEMIES", THREE TIMES. Printed on every card, never varying. The number
 *    is the information, and the roster underneath names them anyway.
 *  - "MORNING", THREE TIMES. The sun mark, the title, and then a sub-line that
 *    opened with "rested overnight" before getting to its actual news.
 *  - THE BOUNTY'S FLAVOUR NAME. "Two Birds", "Opening Act" — three per screen,
 *    nothing a player can act on, occupying the slot the condition needed.
 *
 * 131 words to 116, one whole zone gone, and every card now says the same four
 * things in the same order.
 */
describe('the gate says each thing once', () => {
  const arena = readFileSync(fileURLToPath(new URL('../web/src/Arena.tsx', import.meta.url)), 'utf8');

  it('draws the bounty on the card and nowhere else', () => {
    // Markup, not the phrase: this file's own comment explains the fault and
    // names the heading, so matching the words "This door pays" fails on the
    // explanation rather than on the bug.
    expect(arena, 'the duplicate reward block is back')
      .not.toMatch(/className="bounties"/);
    expect(arena, 'the duplicate block is back').not.toMatch(/className="bounties-head"/);
    // ...and the card carries what that block was uniquely for.
    expect(arena, 'the card no longer says how to earn the prize')
      .toContain('bounty!.blurb');
  });

  it('leaves no dead styling behind the block it deleted', () => {
    for (const dead of ['.bounties {', '.bounties-head {', '.bounty-name {', '.bounty-gold {']) {
      expect(CSS, `${dead} outlived its markup`).not.toContain(dead);
    }
  });

  it('prints the headcount as a number, not a sentence', () => {
    const head = arena.indexOf('className="gate-head"');
    const card = arena.slice(head, head + 600);
    expect(card, 'the word "enemies" is back on every card')
      .not.toMatch(/enem\{/);
    expect(card).toContain('members.length');
  });

  it('says which half of the day it is once', () => {
    // The mark and the title have both said it by the time this line runs; it
    // used to spend its opening words saying it a third time.
    expect(arena, 'the sub-line is restating the time of day again')
      .not.toContain('rested overnight');
    expect(arena, 'the sub-line no longer says what a night restores')
      .toContain('slots, abilities and hit dice all back');
  });

  it('sets the earn-it line as small print, not a label', () => {
    const i = CSS.indexOf('\n.gate-bounty b {');
    const rule = CSS.slice(i, CSS.indexOf('}', i));
    // It was a small-caps label when it held a two-word bounty NAME. It now
    // holds a sentence, and a sentence in caps shouts.
    expect(rule, 'the condition is shouting in small caps').not.toContain('uppercase');
    expect(rule, 'the condition is competing with the prize above it').toContain('var(--muted)');
  });
});

/**
 * The Spells step, after a look at a real phone screenshot.
 *
 * Preparing spells is what the step is for, and the only way to do it was to
 * tap a 34px portrait in the panel header — the smallest target on a screen
 * where everything else ran full width — while "Copy a scroll into a
 * spellbook", a rare secondary action, got a full-width card with a heading and
 * its own explanatory line. Above them sat thirty words urging the player to
 * consider their spells, and NO visible state at all.
 *
 * Four things came out of it:
 *
 *  - the casters are the screen, one full-width row each, showing the count;
 *  - the exhortation is gone. A screen that nags is one you learn to scroll
 *    past; one that shows "5/6, one spare" needs no nagging, and on a day with
 *    nothing to change it says that instead;
 *  - camp buffs moved here from the door screen — they spend spell slots and
 *    potions, which is this step's business — and they say what they cost;
 *  - the primary button belongs to the step you are on.
 */
describe('the arena spells step', () => {
  const arena = readFileSync(fileURLToPath(new URL('../web/src/Arena.tsx', import.meta.url)), 'utf8');

  it('makes the casters the screen, not a header of thumbnails', () => {
    expect(arena, 'the caster list is gone').toContain('className="prep-casters"');
    expect(CSS, 'a caster row must be a real tap target').toMatch(/\.prep-caster \{[\s\S]*?min-height: 52px/);
    // The old header row of portrait buttons must not come back as the way in.
    expect(arena, 'prep is back behind thumbnails in the header')
      .not.toContain('arena-buyer-pick');
  });

  it('shows state instead of urging', () => {
    expect(arena, 'the exhortation is back')
      .not.toContain('walking in with fewer spells than they could');
    expect(arena, 'a quiet day says nothing at all again')
      .toContain('Everyone is fully prepared');
  });

  it('offers camp buffs here, not on the door screen', () => {
    const spells = arena.indexOf("panel === 'prepare' && (");
    const buffs = arena.indexOf('className="camp-buffs"');
    expect(buffs, 'the buffs are not in the spells panel').toBeGreaterThan(spells);
    expect(arena, 'the door screen is offering buffs again').not.toContain('lore-row prep-row');
    // Potions came with the spells on purpose: splitting the row by which
    // resource it spends is a distinction the player does not hold.
    expect(arena.slice(buffs, buffs + 1800)).toContain('drinkCampBuffPotion');
  });

  it('puts the price on the button that charges it', () => {
    const buffs = arena.indexOf('className="camp-buffs"');
    const block = arena.slice(buffs, buffs + 1800);
    expect(block, 'the buff no longer quotes its cost').toContain('o.cost');
    expect(block, 'nothing says how much of that resource is left').toContain('left');
  });

  it('gives the primary button to the step you are on', () => {
    // It read "Fight — <door>" from every step, and from a panel the doors are
    // off screen — so the biggest button on the phone committed you to a fight
    // you could not see, on a day where `run.gate ?? 0` may have picked it.
    expect(arena, 'the primary button is unconditional again')
      .toMatch(/panel === 'none' \? \([\s\S]{0,400}Fight —/);
    expect(arena, 'no way onward from a panel').toContain('Choose a door →');
  });
});

/**
 * The backdrop was not a decision — it was the leftover.
 *
 * The gate panel is bottom-anchored and used to size to its content, so the
 * sand took whatever was left: measured at 443x990, 13% of the screen on the
 * Doors step and 67% on the Spells step, lurching between the two as you moved
 * along the step bar. Same instability as the board resizing between actions.
 *
 * Pinning the height outright was tried first and was worse — a quiet Spells
 * step opened at 86% with 900px of empty card in it, the same wasted space in a
 * different colour. A floor bounds the sand (14%-38%) and lets a short step be
 * short.
 */
describe('the gate backdrop', () => {
  it('is bounded rather than left over', () => {
    const i = CSS.indexOf('.adv-panel.arena-gate { min-height');
    expect(i, 'the panel has no height floor, so the sand is the remainder again')
      .toBeGreaterThan(-1);
    const rule = CSS.slice(i, CSS.indexOf('}', i));
    const floor = Number(rule.match(/min-height: (\d+)%/)![1]);
    expect(floor, 'the floor is too low to bound the backdrop').toBeGreaterThanOrEqual(55);
    expect(rule).toContain('max-height');
  });

  it('does not grow a taller panel just because one is open', () => {
    // `.tall` took the panel to 96% whenever a panel was open, which swung the
    // backdrop 13% -> 4% instead of holding it steady.
    expect(CSS, 'the tall variant is back').not.toContain('.adv-panel.arena-gate.tall');
  });
});

/**
 * The gear screen, reported as "a mess, completely unlike other tabs, no bottom
 * navigation, no indicator of what is equipped".
 *
 * All three were true and the last was the worst. `.adv-camp-gear` rendered the
 * FILLED slots only, as chips near-identical to the pack chips beneath them —
 * so a worn Splint and a packed Adamantine Scale Mail were the same object on
 * screen, and nothing said which of two swords was in hand. And the whole thing
 * was a scrim over everything with an ✕ for an exit, where every other tab kept
 * the step bar, the Fight button and the party strip.
 *
 * Six slots now, always, for every character. Fixed positions are what make it
 * scannable — slot four is always ranged, so an empty one reads without being
 * read — and empty is the useful state, because it is what prompts a player to
 * mark the javelin. No slot is ever unavailable to a class either: a wizard's
 * off hand takes a dagger, it just cannot take a shield, and what is blocked is
 * always an ITEM in a slot.
 */
describe('the gear screen', () => {
  const ps = readFileSync(fileURLToPath(new URL('../web/src/PartyScreen.tsx', import.meta.url)), 'utf8');
  const arena = readFileSync(fileURLToPath(new URL('../web/src/Arena.tsx', import.meta.url)), 'utf8');

  it('lays out every slot for every character', () => {
    expect(ps, 'the strip is gone').toContain('className="gear-slots"');
    // The regression this replaces: only the filled ones were drawn.
    expect(ps, 'empty slots are being skipped again — the useful ones')
      .not.toMatch(/const held = ch\.equipped\[slot\];\s*if \(!held\) return null;/);
    expect(ps, 'a slot needs a label and an empty-state mark')
      .toContain('SLOT_GLYPH[slot]');
  });

  it('is a step in the arena, not a modal over it', () => {
    expect(ps, 'the frame is not selectable').toContain("frame?: 'modal' | 'panel'");
    expect(arena, 'the arena is still opening it as a scrim').not.toContain('showParty');
    expect(arena, 'gear is not a panel value').toMatch(/'none' \| 'shop' \| 'prepare' \| 'gear'/);
    expect(arena).toContain('frame="panel"');
  });

  it('explains a blocked item rather than hiding it', () => {
    // `equipBlocked` already writes the sentence; a wizard should see the
    // shield and be told why, not wonder where it went.
    expect(ps).toContain('equipBlocked(campaign, idx, id, slot)');
    expect(ps, 'the reason is not shown').toContain('gear-cand');
    // ...but only for near-misses. Listing every potion against the ranged
    // slot as "not a weapon" is noise, not teaching.
    // The CALL, not the declaration: removing only the filter left the helper
    // defined and this assertion passing on a dead name.
    expect(ps, 'wrong-kind items are back in the picker').toContain('!wrongKind(why)');
  });

  it('folds the packs away', () => {
    // Four open chip lists is why the party's loadout could not be seen at a
    // glance, which is the one thing this screen is for.
    expect(ps).toContain('pack-toggle');
    expect(ps, 'more than one pack can be open at once again').toContain('openPack === idx ? null : idx');
  });

  it('leaves spells to the spells step', () => {
    // They were duplicated: the arena's Spells step offers the same casts WITH
    // the slot cost on the button, so Mage Armor appeared twice in one mode —
    // priced in one place and free-looking in the other.
    const at = ps.indexOf('const spells = storeSpellActions');
    expect(at).toBeGreaterThan(0);
    expect(ps.slice(at - 300, at), 'camp casting is showing in the arena panel again')
      .toContain("frame === 'modal'");
  });
});

/**
 * The attack chooser: ready weapons first, the pack behind one control.
 *
 * Every stowed weapon is a legal attack while the free interaction is unspent,
 * so tapping one goblin met a fighter with Longsword, Javelin, Silvered Spear
 * and Silvered Javelin before the button they wanted.
 *
 * Folded, not filtered. Removing the pack weapons would be a rules change for
 * the human — the AI would keep options the player could not reach — so they
 * are one tap away rather than absent.
 */
describe('the attack chooser', () => {
  const app = readFileSync(fileURLToPath(new URL('../web/src/App.tsx', import.meta.url)), 'utf8');
  const groups = readFileSync(fileURLToPath(new URL('../web/src/actionGroups.ts', import.meta.url)), 'utf8');

  it('folds low-ranked options instead of dropping them', () => {
    expect(app, 'the chooser is flat again').toContain('o.folded || showAllOptions');
    // The CONDITION, not just the handler. Replacing the reveal button's guard
    // with `false` once left `setShowAllOptions(true)` in a dead branch and this
    // assertion green, while every folded option became unreachable — which is
    // precisely the rules change this describe block exists to prevent.
    expect(app, 'no way to reach a folded option at all — that is a rules change')
      .toMatch(/!showAllOptions && chooser\.options\.some\(\(o\) => o\.folded\) && \(/);
    expect(app).toContain('setShowAllOptions(true)');
  });

  it('says how many it folded, and how many of those are in the pack', () => {
    // "More" is a shrug. A count is a reason to tap or not to — and the pack
    // split matters because drawing a weapon is a different kind of act.
    expect(app).toContain('hidden.length');
    expect(app).toContain('from the pack');
  });

  it('reopens folded, not left open from last time', () => {
    const at = app.indexOf('setChooser({ target: occ');
    expect(app.slice(Math.max(0, at - 200), at), 'the fold sticks open between targets')
      .toContain('setShowAllOptions(false)');
  });

  it('counts the ranged marker as ready', () => {
    // Which is the entire reason the marker exists.
    expect(groups).toContain('actor?.equipped.ranged');
    expect(groups, 'unarmed must not be treated as a draw from the pack')
      .toContain("'unarmed-strike'");
  });
});

/**
 * The move prompt must not lie about what Disengage costs.
 *
 * A rogue's Cunning Action and a goblin's Nimble Escape make Disengage a BONUS
 * action. `groupActions` already resolves that — it hands back the cheaper
 * action and tags the entry `Bonus` — so a prompt that hard-codes "uses your
 * action" tells a rogue their attack is about to disappear when it is not.
 * That is the kind of wrong that teaches a new player the wrong rule.
 */
describe('the opportunity-attack prompt', () => {
  const app = readFileSync(fileURLToPath(new URL('../web/src/App.tsx', import.meta.url)), 'utf8');
  const confirm = app.slice(app.indexOf('{moveConfirm && (()'), app.indexOf('{chooser && ('));

  it('exists and offers a way out', () => {
    expect(confirm.length, 'no move-confirm block in App.tsx').toBeGreaterThan(200);
    expect(confirm).toContain('Move anyway');
    expect(confirm).toContain('disengage');
  });

  it('reads the cost off the bar entry instead of hard-coding it', () => {
    expect(confirm, 'the Disengage cost is hard-coded — a rogue pays a bonus action')
      .toMatch(/note === 'Bonus'/);
    expect(confirm).toContain('uses your bonus action');
  });

  it('says why when Disengage is not on offer', () => {
    // The button vanishing with no explanation is how a player concludes the
    // game is inconsistent rather than that they spent something.
    expect(confirm).toMatch(/\{!dis &&/);
  });

  it('only interrupts for a walk that actually provokes', () => {
    // Prompting on every move trains the player to dismiss it unread, which
    // costs the feature its whole purpose.
    expect(app).toMatch(/walk\.provokers\.length === 0[^\n]*apply\(move\)/);
  });
});
