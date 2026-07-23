/**
 * The single source of truth for each board theme's colours — the checker
 * floor, the blocking-prop ("wall") material, and a light rim that outlines a
 * prop so it reads against any backdrop. Board.tsx feeds these to the grid as
 * inline CSS custom properties (`--floor`, `--wall-hi`, …), so styles.css holds
 * the *shapes* (bevels, clip-paths, silhouettes) while the *colours* live here,
 * where a contrast test can hold them to a legibility floor (board-contrast
 * test). That test is why a blocking object can't silently fade into its
 * background again — the way the ember basalt did against the fiery backdrop.
 */
import type { CSSProperties } from 'react';
import type { MapTheme } from '../../src/data/maps.js';

export interface BoardThemeColors {
  /** Solid board background, behind the painterly art. */
  bg: string;
  /** Checker cells — light and dark. Translucent so the backdrop shows through. */
  floor: string;
  floorDark: string;
  /** Blocking-prop material: lit face → shadow face of the raised block. */
  wallHi: string;
  wallLo: string;
  /** A light rim drawn tight around every prop so its silhouette separates from
   *  the ground and the backdrop, bright or dark. */
  wallRim: string;
}

export const BOARD_THEMES: Record<MapTheme, BoardThemeColors> = {
  stone:     { bg: '#201f33', floor: 'rgba(107,100,128,0.55)', floorDark: 'rgba(69,63,92,0.55)', wallHi: '#847da0', wallLo: '#524a72', wallRim: '#e8e4f0' },
  forest:    { bg: '#10180f', floor: 'rgba(70,105,60,0.55)',   floorDark: 'rgba(61,93,52,0.55)', wallHi: '#6a7d55', wallLo: '#445531', wallRim: '#eaf2d6' },
  graveyard: { bg: '#0d1014', floor: 'rgba(59,64,72,0.55)',    floorDark: 'rgba(52,57,65,0.55)', wallHi: '#7b8391', wallLo: '#4b525f', wallRim: '#e6ecf2' },
  // Ember was a near-black basalt spire (#7c5e52 → #33221c) that vanished into
  // the dark fiery backdrop — brightened to a lit sandstone so it reads.
  ember:     { bg: '#170d0b', floor: 'rgba(74,54,48,0.55)',    floorDark: 'rgba(65,46,41,0.55)', wallHi: '#c0946a', wallLo: '#7a5238', wallRim: '#ffe6c4' },
  village:   { bg: '#26212b', floor: 'rgba(122,110,96,0.52)',  floorDark: 'rgba(94,84,72,0.52)', wallHi: '#a07a52', wallLo: '#573c28', wallRim: '#f6efdc' },
  bog:       { bg: '#0b1310', floor: 'rgba(58,84,64,0.5)',     floorDark: 'rgba(48,70,54,0.5)',  wallHi: '#6d855e', wallLo: '#324a2e', wallRim: '#e0eec6' },
};

/** The inline custom properties Board.tsx spreads onto the `.board` element, so
 *  the grid's floor and prop colours come from the palette above. */
export function boardThemeVars(theme: MapTheme): CSSProperties {
  const t = BOARD_THEMES[theme];
  return {
    ['--floor' as string]: t.floor,
    ['--floor-dark' as string]: t.floorDark,
    ['--wall-hi' as string]: t.wallHi,
    ['--wall-lo' as string]: t.wallLo,
    ['--wall-rim' as string]: t.wallRim,
  };
}

// --- colour maths (shared with the contrast test) --------------------------

export interface Rgba { r: number; g: number; b: number; a: number }

/** Parse `#rgb`, `#rrggbb`, or `rgba(r,g,b,a)` into channels (0–255) + alpha. */
export function parseColor(c: string): Rgba {
  const s = c.trim();
  if (s.startsWith('#')) {
    const h = s.slice(1);
    const full = h.length === 3 ? h.split('').map((d) => d + d).join('') : h;
    return { r: parseInt(full.slice(0, 2), 16), g: parseInt(full.slice(2, 4), 16), b: parseInt(full.slice(4, 6), 16), a: 1 };
  }
  const m = s.match(/rgba?\(([^)]+)\)/);
  if (!m) throw new Error(`Unparseable colour: ${c}`);
  const [r, g, b, a] = m[1]!.split(',').map((v) => parseFloat(v.trim()));
  return { r: r!, g: g!, b: b!, a: a ?? 1 };
}

/** Alpha-composite a (possibly translucent) colour over an opaque one. */
export function composite(fg: string, bg: string): Rgba {
  const f = parseColor(fg), b = parseColor(bg);
  return {
    r: f.r * f.a + b.r * (1 - f.a),
    g: f.g * f.a + b.g * (1 - f.a),
    b: f.b * f.a + b.b * (1 - f.a),
    a: 1,
  };
}

function relLuminance({ r, g, b }: Rgba): number {
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/** WCAG contrast ratio (1–21) between two opaque colours. */
export function contrastRatio(a: Rgba, b: Rgba): number {
  const la = relLuminance(a), lb = relLuminance(b);
  const hi = Math.max(la, lb), lo = Math.min(la, lb);
  return (hi + 0.05) / (lo + 0.05);
}
