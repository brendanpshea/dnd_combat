import { describe, it, expect } from 'vitest';
import {
  BOARD_THEMES, parseColor, composite, contrastRatio, type BoardThemeColors,
} from '../web/src/boardTheme.js';
import type { MapTheme } from '../src/data/maps.js';

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
