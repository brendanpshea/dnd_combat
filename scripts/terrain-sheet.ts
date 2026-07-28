/**
 * A contact sheet of every terrain, in every theme, at true phone tile size.
 *
 * Written because a design argument about whether the blocking tiles "read"
 * cannot be settled by describing them to each other. It renders the REAL
 * markup — the same class names `Board.tsx` emits, the real `styles.css`, the
 * real per-theme custom properties from `boardTheme.ts`, the real painted
 * backdrops — so what comes out is what the game draws, not an approximation
 * that would let a problem hide.
 *
 * Two things it shows that a screenshot of a live board does not:
 *
 *   - every terrain beside every other one, in every theme, at once; and
 *   - each of them at three sizes, because the whole question is whether a
 *     soft gradient survives being 35 pixels wide on a phone. A tile that
 *     reads at desktop size and dissolves at phone size is the failure mode
 *     we are looking for, and it is invisible unless you put them side by side.
 *
 * A token sits on half the tiles, because terrain is never seen bare in play —
 * it is seen with something standing on or behind it, which is exactly when a
 * low barricade and a solid wall most need to be distinguishable.
 *
 *     npx tsx scripts/terrain-sheet.ts
 *     /opt/pw-browsers/chromium-1194/chrome-linux/chrome --headless --disable-gpu \
 *       --no-sandbox --hide-scrollbars --force-device-scale-factor=2 \
 *       --window-size=1500,5200 --screenshot=docs/terrain-sheet.png \
 *       file://$PWD/docs/terrain-sheet.html
 *
 * Both outputs are gitignored: regenerate them, do not commit them.
 */
import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BOARD_THEMES } from '../web/src/boardTheme.js';
import type { MapTheme } from '../src/data/maps.js';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const OUT = join(ROOT, 'docs/terrain-sheet.html');

const THEMES = Object.keys(BOARD_THEMES) as MapTheme[];

/** The four terrains a player has to tell apart, and what each one means. */
const TERRAINS = [
  { id: 'open', label: 'Open', rule: 'walk through it' },
  { id: 'wall', label: 'Wall', rule: 'blocks movement AND sight' },
  { id: 'cover', label: 'Barricade', rule: 'blocks movement, +2 AC, shoot over' },
  { id: 'difficult', label: 'Difficult', rule: 'costs double to enter' },
  { id: 'hazard', label: 'Hazard', rule: 'damage on entry' },
] as const;

/**
 * Cell sizes to draw at.
 *
 * 34px is an 8-wide board on a 320px-wide phone, which is the real constraint
 * and the one the current gradients are least likely to survive.
 */
const SIZES = [
  { px: 34, label: 'phone · 8-wide' },
  { px: 48, label: 'tablet' },
  { px: 72, label: 'desktop' },
];

function themeVars(theme: MapTheme): string {
  const t = BOARD_THEMES[theme];
  return [
    `--floor:${t.floor}`, `--floor-dark:${t.floorDark}`,
    `--wall-hi:${t.wallHi}`, `--wall-lo:${t.wallLo}`, `--wall-rim:${t.wallRim}`,
  ].join(';');
}

/**
 * One cell, with the classes `Board.tsx` would give it.
 *
 * `needs-badge` is applied exactly as the board applies it — only to effect
 * terrain, and never to a wall. That omission is one of the things this sheet
 * exists to make visible: the pair that matters most tactically is the pair
 * with no badge on either side of the comparison.
 */
function cell(
  terrain: string, dark: boolean, withToken: boolean,
  art?: { theme: MapTheme; variant: 'a' | 'b' },
): string {
  const classes = ['cell', `terrain-${terrain}`];
  if (dark) classes.push('dark');
  // With a drawn prop on it, the CSS gradient and its emoji badge are exactly
  // what the prop is replacing — so suppress both, or we would be judging the
  // art through the thing it exists to remove.
  if (art) classes.push('art-prop');
  else if (terrain === 'difficult' || terrain === 'hazard' || terrain === 'cover') classes.push('needs-badge');
  const token = withToken
    ? '<span class="sheet-token" aria-hidden>🧙</span>'
    : '';
  const prop = art
    ? `<img class="prop" src="../web/public/art/terrain/terrain-${terrain === 'wall' ? 'wall' : 'cover'}-${art.theme}-${art.variant}.svg" alt="">`
    : '';
  return `<div class="${classes.join(' ')}">${prop}${token}</div>`;
}

/** A 4×2 patch of one terrain, half of it occupied, as it appears in play. */
function patch(theme: MapTheme, terrain: string, px: number, bg: boolean, svg = false): string {
  const cells: string[] = [];
  let nth = 0;
  for (let y = 0; y < 2; y++) {
    for (let x = 0; x < 4; x++) {
      // Every other tile is the terrain in question, so it is always seen
      // against the floor it has to be distinguished from.
      const isTerrain = (x + y) % 2 === 0 || terrain === 'open';
      // Alternate the two variants, which is the whole reason there are two:
      // a run of one sprite reads as wallpaper.
      const drawn = svg && isTerrain && (terrain === 'wall' || terrain === 'cover');
      const art = drawn ? { theme, variant: (nth++ % 2 === 0 ? 'a' : 'b') as 'a' | 'b' } : undefined;
      cells.push(cell(isTerrain ? terrain : 'open', (x + y) % 2 === 1, x === 3 && y === 0, art));
    }
  }
  // Relative to docs/, where the sheet is written — the real art, not a copy.
  const bgStyle = bg ? `background-image:url('../web/public/art/bg-${theme}.webp');` : '';
  return `<div class="board theme-${theme}" style="${themeVars(theme)};${bgStyle}` +
    `grid-template-columns:repeat(4,${px}px);width:max-content">${cells.join('')}</div>`;
}

function build(): string {
  const css = readFileSync(join(ROOT, 'web/src/styles.css'), 'utf8');

  const sections = THEMES.map((theme) => {
    const hasBg = existsSync(join(ROOT, `web/public/art/bg-${theme}.webp`));
    const hasSvg = existsSync(join(ROOT, `art/svg-terrain/terrain-wall-${theme}-a.svg`));
    const rows = SIZES.map(({ px, label }) => {
      const patches = TERRAINS.map((t) => {
        const drawable = (t.id === 'wall' || t.id === 'cover') && hasSvg;
        // Side by side, because "is the new art better" is a comparison and
        // showing only the new one invites grading it against a memory.
        const both = drawable
          ? `<div class="ab"><div><div class="ab-tag">css</div>${patch(theme, t.id, px, hasBg)}</div>
             <div><div class="ab-tag on">svg</div>${patch(theme, t.id, px, hasBg, true)}</div></div>`
          : patch(theme, t.id, px, hasBg);
        return `
        <div class="swatch">
          <div class="swatch-name">${t.label}</div>
          ${both}
          <div class="swatch-rule">${t.rule}</div>
        </div>`;
      }).join('');
      return `<div class="size-row"><div class="size-label">${label} · ${px}px</div>
        <div class="swatches">${patches}</div></div>`;
    }).join('');
    return `<section><h2>${theme}${hasBg ? '' : ' <em>(no backdrop art)</em>'}</h2>${rows}</section>`;
  }).join('');

  return `<!doctype html><html><head><meta charset="utf-8">
<title>Terrain contact sheet</title>
<style>
${css}
/* --- sheet chrome only; nothing here touches the tiles themselves --- */
body { background:#0d0b14; color:#e8e4f0; font-family:system-ui,sans-serif; margin:0; padding:24px; }
h1 { font-size:20px; margin:0 0 4px; }
.intro { color:#9d95b8; font-size:13px; max-width:60ch; margin:0 0 24px; line-height:1.5; }
section { margin-bottom:34px; }
h2 { font-size:15px; text-transform:uppercase; letter-spacing:.1em; color:#c79ae0; margin:0 0 10px;
     border-bottom:1px solid #2a2440; padding-bottom:5px; }
h2 em { color:#6b6480; font-size:11px; letter-spacing:0; text-transform:none; }
.size-row { display:flex; align-items:flex-start; gap:14px; margin-bottom:14px; }
.size-label { width:104px; flex:0 0 104px; font-size:11px; color:#6b6480; padding-top:16px; }
.swatches { display:flex; gap:16px; flex-wrap:wrap; }
.swatch-name { font-size:11px; font-weight:700; margin-bottom:3px; }
.swatch-rule { font-size:10px; color:#6b6480; margin-top:3px; max-width:150px; }
.sheet-token { font-size:70%; filter:drop-shadow(0 1px 2px #000); position:relative; z-index:2; }
/* The drawn prop, filling its cell — this is how it would ship. */
.cell .prop { position:absolute; inset:0; width:100%; height:100%; display:block; }
/* A cell carrying a prop drops the CSS gradient it replaces. */
.cell.art-prop.terrain-wall::before, .cell.art-prop.terrain-cover { background:none; box-shadow:inset 0 0 0 1px #14101f; }
.cell.art-prop.terrain-wall::before { content:none; }
.cell.art-prop::after { content:none; }
.ab { display:flex; gap:8px; }
.ab-tag { font-size:9px; color:#6b6480; text-transform:uppercase; letter-spacing:.08em; margin-bottom:2px; }
.ab-tag.on { color:#8fe3a0; }
</style></head><body>
<h1>Terrain contact sheet</h1>
<p class="intro">The real markup, the real stylesheet, the real theme colours and backdrops — so this
is what the game draws. Each patch alternates the terrain with open floor, and one tile in each carries
a token, because terrain is never seen bare in play. The three sizes are the point: 34px is an 8-wide
board on a narrow phone, and a soft gradient that reads at desktop size can dissolve there.</p>
${sections}
</body></html>`;
}

writeFileSync(OUT, build());
console.log(`wrote ${OUT}`);
