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

  it('hides cover and non-lethal risk until the tile is considered', () => {
    expect(css).toMatch(/\.cover-badge,\s*\n\.risk-badge:not\(\.lethal\) \{[^}]*opacity: 0/);
  });

  it('still shows them on hover and on keyboard focus', () => {
    expect(css).toContain('.cell:hover .cover-badge');
    expect(css).toContain('.cell:focus-visible .risk-badge');
  });

  it('never hides the lethal warning', () => {
    // The one case that has to interrupt: this move can end with you on the
    // floor. `:not(.lethal)` is what keeps it loud.
    const at = css.indexOf('.risk-badge:not(.lethal) {');
    expect(at, 'the lethal badge is no longer exempt').toBeGreaterThan(0);
  });

  it('hides with opacity, so a screen reader still reads every one', () => {
    // `display: none` would drop the aria-labels the badges already carry.
    const at = css.indexOf('.risk-badge:not(.lethal) {');
    const block = css.slice(at, css.indexOf('}', at));
    expect(block).not.toContain('display');
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
    expect(arena, 'the morning no longer says what a night gives back').toContain('rested overnight');
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
    const gates = arena.indexOf('<div className="gates">');
    const foes = arena.indexOf('<div className="arena-foes">');
    const checks = arena.indexOf('lore-row');
    expect(gates).toBeGreaterThan(-1);
    expect(foes, 'the roster is back below the buffs and checks').toBeGreaterThan(gates);
    expect(foes, 'the buffs and checks are between the doors and their roster again')
      .toBeLessThan(checks);
  });

  it('gives the outgrown-day warning its own weight', () => {
    expect(arena, 'the warning is back to being a hint').toContain('arena-warn');
    // Specifically NOT welded onto the rest sentence, which is where it hid.
    const hint = arena.indexOf("'The second fight of the day");
    const warn = arena.indexOf('arena-warn');
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
