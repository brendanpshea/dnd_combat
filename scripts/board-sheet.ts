/**
 * A full 8x10 board per theme, carrying every terrain and every overlay at once.
 *
 * WHY THIS, WHEN terrain-sheet.ts ALREADY EXISTS
 *
 * That sheet answers "does a barricade read as a barricade" by putting one
 * terrain beside another in a 4x2 patch. It cannot answer the question that
 * comes next, which is whether the tiles look like they belong to the SAME
 * PLACE. A lava tile is perfectly legible on its own and still wrong if the
 * ground around it is grass.
 *
 * That is a whole-board question. It needs the theme's real backdrop, the real
 * floor colours, walls and barricades drawn in the theme's own art, and the
 * hazard sitting in the middle of it — which is exactly how the fire-on-
 * grassland problem was spotted, and exactly what a 4x2 patch hides.
 *
 * It also draws the OVERLAYS, which the terrain sheet does not cover at all:
 * a lingering Web, a gnome's illusory wall. Those sit on top of whatever the
 * ground already is, so they are the other thing that can clash with a theme.
 *
 * Renders the real markup and the real stylesheet, like its sibling, so what
 * comes out is what the game draws.
 *
 *     npm run board-sheet
 *     /opt/pw-browsers/chromium-1194/chrome-linux/chrome --headless --disable-gpu \
 *       --no-sandbox --hide-scrollbars --force-device-scale-factor=2 \
 *       --window-size=1400,3400 --screenshot=docs/board-sheet.png \
 *       file://$PWD/docs/board-sheet.html
 *
 * Both outputs are gitignored: regenerate them, do not commit them.
 */
import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BOARD_THEMES } from '../web/src/boardTheme.js';
import type { MapTheme } from '../src/data/maps.js';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const OUT = join(ROOT, 'docs/board-sheet.html');
const THEMES = Object.keys(BOARD_THEMES) as MapTheme[];

const W = 8;
const H = 10;

/**
 * One hand-laid board, used for every theme so they can be compared directly.
 *
 * Deliberately not a real generated map: this needs every terrain and every
 * overlay on screen at once, which no real map has, and it needs to be IDENTICAL
 * across themes or the comparison is between layouts rather than palettes.
 *
 *   . open      # wall       o cover (barricade)
 *   ~ difficult ^ hazard     w web overlay      i illusion overlay
 *
 * Laid out the way a real map is: walls around the edges of a structure, a
 * barricade line to shoot over, a hazard field with a clear edge (so the badge
 * rule fires on its perimeter, as it does in play), and the overlays sitting on
 * ordinary ground where you would actually meet them.
 */
const LAYOUT = [
  '..####..',
  '.#....#.',
  '.#.^^.#.',
  '.#.^^.#.',
  '.#....#.',
  '..oooo..',
  '~~....ww',
  '~~..ii.w',
  '~.......',
  '........',
];

function themeVars(theme: MapTheme): string {
  const t = BOARD_THEMES[theme];
  return [
    `--floor:${t.floor}`, `--floor-dark:${t.floorDark}`,
    `--wall-hi:${t.wallHi}`, `--wall-lo:${t.wallLo}`, `--wall-rim:${t.wallRim}`,
  ].join(';');
}

const TERRAIN_OF: Record<string, string> = {
  '.': 'open', '#': 'wall', o: 'cover', '~': 'difficult', '^': 'hazard',
  w: 'open', i: 'open',
};

/** Is this cell on the edge of its own terrain field? The board's own rule. */
function isEdge(x: number, y: number, ch: string): boolean {
  return ([[1, 0], [-1, 0], [0, 1], [0, -1]] as const).some(([dx, dy]) => {
    const row = LAYOUT[y + dy];
    const n = row?.[x + dx];
    return n === undefined || TERRAIN_OF[n] !== TERRAIN_OF[ch];
  });
}

function board(theme: MapTheme, px: number): string {
  const hasBg = existsSync(join(ROOT, `web/public/art/bg-${theme}.webp`));
  // The GENERATED art, which is what the app loads. `art/svg-terrain/` holds
  // only a README and a preview folder, so checking there reported "no art" for
  // every theme and drew the CSS fallback — judging the game by a picture of
  // something it does not draw.
  const hasSvg = existsSync(join(ROOT, `web/public/art/terrain/terrain-wall-${theme}-a.svg`));
  const cells: string[] = [];
  // Top row first, like Board.tsx (`for (let y = height - 1; y >= 0; y--)`),
  // so the picture matches what the game actually draws.
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const ch = LAYOUT[y]![x]!;
      const terrain = TERRAIN_OF[ch]!;
      const classes = ['cell', `terrain-${terrain}`];
      const drawn = hasSvg && (terrain === 'wall' || terrain === 'cover');
      if (drawn) classes.push('art-prop');
      else if ((terrain === 'difficult' || terrain === 'hazard' || terrain === 'cover') && isEdge(x, y, ch)) {
        classes.push('needs-badge');
      }
      if (ch === 'w') classes.push('webbed');
      if (ch === 'i') classes.push('illusion');
      // Board.tsx darkens on (x + y) % 2 with y counted from the bottom.
      if ((x + (H - 1 - y)) % 2 === 0) classes.push('dark');
      const prop = drawn
        ? `<img class="prop" src="../web/public/art/terrain/terrain-${terrain}-${theme}-${(x * 3 + (H - 1 - y) * 5) % 2 === 0 ? 'a' : 'b'}.svg" alt="">`
        : '';
      // A couple of tokens, because terrain is never seen bare in play.
      const token = (x === 4 && y === 8) ? '<span class="sheet-token">🧙</span>'
        : (x === 3 && y === 1) ? '<span class="sheet-token">👹</span>' : '';
      cells.push(`<div class="${classes.join(' ')}">${prop}${token}</div>`);
    }
  }
  const bg = hasBg ? `background-image:url('../web/public/art/bg-${theme}.webp');` : '';
  return `<div class="board theme-${theme}" style="${themeVars(theme)};${bg}` +
    `grid-template-columns:repeat(${W},${px}px);width:max-content">${cells.join('')}</div>`;
}

function build(): string {
  const css = readFileSync(join(ROOT, 'web/src/styles.css'), 'utf8');
  const sections = THEMES.map((theme) => `
    <section>
      <h2>${theme}</h2>
      <div class="pair">
        <div><div class="tag">phone · 34px</div>${board(theme, 34)}</div>
        <div><div class="tag">desktop · 64px</div>${board(theme, 64)}</div>
      </div>
    </section>`).join('');

  return `<!doctype html><meta charset="utf-8"><title>Board sheet</title>
<style>
${css}
body { background:#0b0910; color:#e8e4f0; font:14px/1.5 system-ui, sans-serif; padding:24px; margin:0; }
h1 { font-size:20px; margin:0 0 4px; }
p.lede { opacity:.72; margin:0 0 24px; max-width:70ch; }
section { margin:0 0 34px; }
h2 { font-size:15px; text-transform:uppercase; letter-spacing:.08em; opacity:.8; margin:0 0 10px; }
.pair { display:flex; gap:28px; align-items:flex-start; flex-wrap:wrap; }
.tag { font-size:11px; opacity:.6; margin-bottom:6px; }
.sheet-token { position:absolute; inset:0; display:grid; place-items:center; font-size:70%; z-index:2; }
.cell { position:relative; }
.legend { opacity:.7; font-size:12px; margin:-10px 0 26px; }
</style>
<h1>Every terrain and overlay, on one board, in every theme</h1>
<p class="lede">The same hand-laid layout in all six themes, so the comparison is between
palettes rather than between maps. Walls and barricades use the theme's drawn art where it
exists; the hazard field, the difficult ground, the web and the illusion are CSS.</p>
<p class="legend">wall · barricade · difficult · <b>hazard (centre)</b> · web (right) · illusion</p>
${sections}
`;
}

writeFileSync(OUT, build());
console.log(OUT);
