import { describe, it, expect } from 'vitest';
import {
  BOARD_THEMES, parseColor, composite, contrastRatio, type BoardThemeColors,
} from '../web/src/boardTheme.js';
import type { MapTheme } from '../src/data/maps.js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * Every blocking prop ("wall") must read against its board — the fix for props
 * (the ember basalt spire) that used to vanish into a dark backdrop. The blocks
 * carry depth through relief and a light rim, not flat hue contrast, so the
 * legibility guarantee we can hold in a test is the *rim*: it has to stand out
 * both from the board background behind the prop and from the prop's own
 * material it outlines. (WCAG's 3:1 floor for graphical objects is the anchor.)
 */
const themes = Object.keys(BOARD_THEMES) as MapTheme[];

const wallMid = (t: BoardThemeColors) => {
  const hi = parseColor(t.wallHi), lo = parseColor(t.wallLo);
  return { r: (hi.r + lo.r) / 2, g: (hi.g + lo.g) / 2, b: (hi.b + lo.b) / 2, a: 1 };
};

describe('board theme contrast', () => {
  it('covers every declared map theme', () => {
    // Keep the palette and the MapTheme union in lockstep.
    const declared: MapTheme[] = ['stone', 'forest', 'graveyard', 'ember', 'village', 'bog'];
    expect(themes.sort()).toEqual([...declared].sort());
  });

  it.each(themes)('%s: the prop rim separates it from the backdrop and its own material', (theme) => {
    const t = BOARD_THEMES[theme];
    const rim = parseColor(t.wallRim);
    const bg = parseColor(t.bg);
    const mid = wallMid(t);

    // The rim pops off the dark board background behind the prop...
    expect(contrastRatio(rim, bg), `${theme} rim vs background`).toBeGreaterThanOrEqual(4.5);
    // ...and off the prop's own fill it outlines (WCAG graphical-object floor).
    expect(contrastRatio(rim, mid), `${theme} rim vs material`).toBeGreaterThanOrEqual(3.0);
  });

  it.each(themes)('%s: floor colours composite to opaque without error', (theme) => {
    const t = BOARD_THEMES[theme];
    for (const floor of [t.floor, t.floorDark]) {
      const eff = composite(floor, t.bg);
      expect(eff.a).toBe(1);
      for (const ch of [eff.r, eff.g, eff.b]) {
        expect(ch).toBeGreaterThanOrEqual(0);
        expect(ch).toBeLessThanOrEqual(255);
      }
    }
  });
});

/**
 * Difficult ground is a COST, not a hazard, and must not out-shout the floor.
 *
 * Measured on a phone screenshot of a forest map: the difficult tile was the
 * brightest thing on the board (lum 0.162) against plain grass at 0.122 and a
 * log wall at 0.115. The tile that costs half your movement shouted; the tile
 * that blocks you outright whispered. A player read the teal as water they
 * could not cross, and said so.
 *
 * The rule the fix encodes: fills are for danger, patterns are for cost, relief
 * is for blocking, saturation belongs to the figures. This board had fills
 * doing all four jobs.
 *
 * ALL OF THAT WAS ALREADY TRUE OF THE STYLESHEET AND NONE OF IT REACHED THE
 * SCREEN, which is what these tests are really for now. The hatch was declared
 * on `.cell.terrain-difficult`; six themes then restyled the tile with the
 * `background` SHORTHAND, which resets `background-image` and erased it. The
 * old tests here passed throughout, because they read the declaration that got
 * overridden rather than the one that won. Measured on a live graveyard board,
 * the computed `background-image` of a difficult cell was a single flat
 * `linear-gradient` — no hatch anywhere on the board.
 *
 * So these assert the CASCADE, not the intent: one rule paints this tile, it
 * takes its colour from the theme's floor variable, and nothing uses the
 * shorthand that ate it last time.
 */
/** The arguments of the first `fn(` in `text`, to its own closing paren. */
function balanced(text: string, open: string): string {
  const start = text.indexOf(open);
  if (start < 0) return '';
  let depth = 0;
  for (let i = start + open.length - 1; i < text.length; i++) {
    if (text[i] === '(') depth++;
    else if (text[i] === ')' && --depth === 0) return text.slice(start + open.length, i);
  }
  return '';
}

describe('difficult ground reads as slow, not deadly', () => {
  const css = readFileSync(fileURLToPath(new URL('../web/src/styles.css', import.meta.url)), 'utf8');

  /** Every rule body whose selector mentions difficult ground and isn't a badge. */
  const paintRules = [...css.matchAll(/^([^{}\n]*\.terrain-difficult[^{}\n]*)\{([^}]*)\}/gm)]
    .map(([, selector, body]) => ({ selector: selector!.trim(), body: body! }))
    .filter((r) => !r.selector.includes('::after'));

  it('is painted by exactly one rule, so no theme can override it away', () => {
    // The `.dark` companion sets only the checker's other floor colour.
    expect(paintRules.map((r) => r.selector).sort()).toEqual([
      '.board .cell.terrain-difficult',
      '.board .cell.terrain-difficult.dark',
    ]);
  });

  it('never uses the background shorthand, which is what erased the hatch', () => {
    for (const r of paintRules) {
      expect(r.body, `${r.selector} uses the \`background\` shorthand — it resets background-image`)
        .not.toMatch(/(^|[;\s])background\s*:/);
    }
  });

  it('takes its colour from the floor, so it is the same ground and not a hole', () => {
    // Floor cells are translucent and let the painted backdrop through. The old
    // difficult tile was opaque, so it was the one patch the art did not show
    // through — which is what read as water you could not cross.
    for (const r of paintRules) {
      const colour = /background-color:\s*([^;]+)/.exec(r.body);
      expect(colour, `${r.selector} sets no background-color`).not.toBeNull();
      expect(colour![1], `${r.selector} paints a literal colour instead of the theme floor`)
        .toMatch(/var\(--floor/);
    }
  });

  it('carries a pattern, so the affordance is not the colour', () => {
    // A hatch survives desaturation, colour-blindness and a 50px cell on a
    // phone. A hue shift survives none of them.
    const main = paintRules.find((r) => r.selector === '.board .cell.terrain-difficult')!;
    expect(main.body, 'the hatch is gone — difficult ground is back to colour alone')
      .toContain('repeating-linear-gradient');
    // Two-tone: a light-only stripe needs a dark floor, and village and ember
    // do not have one — measured at 0.010 ABOVE the floor and 0.002 from it.
    // A ridge plus its shadow carries contrast whatever the floor is worth.
    // Balance the parens rather than matching to the next `);`. A lazy regex
    // ran straight past the hatch into the darkening layer below it, which is
    // rgba(0,0,0,…) — so deleting the dark stripe still "passed".
    const hatch = balanced(main.body, 'repeating-linear-gradient(');
    expect(hatch, 'a single pale stripe washes out on the light themes')
      .toMatch(/rgba\(255,\s*255,\s*255[\s\S]*rgba\(0,\s*0,\s*0/);
  });

  it('no longer glares: no theme paints a bright pool on it', () => {
    // The bright radial "pooling water" highlights were what made a cost tile
    // the brightest thing on the board.
    for (const r of paintRules) {
      expect(r.body, `${r.selector} still has a bright pool highlight`)
        .not.toContain('radial-gradient');
    }
  });

  it('still names itself for anyone who cannot see the difference', () => {
    // The corner badge is the colour-blind fallback and outlives any repaint.
    expect(css).toContain('.cell.terrain-difficult.needs-badge::after');
  });
});

/**
 * And the figures are cut out of whatever they stand on.
 *
 * Same screenshot: tokens were the LEAST saturated objects on the board (0.26
 * against terrain's 0.55-0.62) at 1.49:1 against their own floor.
 */
describe('tokens are cut out of the ground', () => {
  const css = readFileSync(fileURLToPath(new URL('../web/src/styles.css', import.meta.url)), 'utf8');

  it('has a ring on every side, not just a contact shadow', () => {
    const i = css.indexOf('.token .art {');
    const rule = css.slice(i, css.indexOf('}', i));
    const rings = [...rule.matchAll(/drop-shadow\(/g)].length;
    expect(rings, 'a single drop-shadow is a contact shadow, not an outline')
      .toBeGreaterThanOrEqual(5);
  });

  it('does not try to fix figure/ground behind the cells', () => {
    // A backdrop scrim was tried and removed: `backdrop-filter` reaches only
    // the board's backdrop image, and the loud things paint their own cell
    // backgrounds above it. It bought 0.15 of contrast and pushed difficult
    // ground from below the floor to above it — the hierarchy got worse.
    expect(css, 'the backdrop scrim is back, and it makes the hierarchy worse')
      .not.toContain('.board::before');
  });
});
