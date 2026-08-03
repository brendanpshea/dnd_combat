/**
 * Crop each item SVG to the thing it draws.
 *
 * THE PROBLEM, MEASURED
 *
 * The item icons are drawn inside a 512x512 canvas, and most of them use very
 * little of it. Ink coverage before this ran:
 *
 *     rapier 0.039, quarterstaff 0.048, javelin 0.048, spear 0.048,
 *     shortsword 0.050, dagger 0.056 ... shield 0.324, scroll 0.369
 *
 * A rapier used FOUR PERCENT of its own canvas. Weapons are drawn as thin
 * diagonals with the rest of the box empty, so they are both the worst-framed
 * group and by far the largest one. Rendered at the 20-28px an inventory row
 * gives an icon, a dagger, a longsword and a greatsword were three
 * indistinguishable slivers — strictly worse than the emoji they would replace.
 *
 * This is the same fault the repo has already fixed twice for creature art:
 * `normalize_framing` in art/process.py for heroes, and `TOKEN_FILL` +
 * `tokenScale` for monsters, both of which exist because "how much of the frame
 * something fills" is noise from whoever drew it rather than information.
 *
 * WHY REWRITE THE FILE INSTEAD OF CORRECTING AT RENDER TIME
 *
 * The monster fix corrects when drawing, because the art is raster and cropping
 * it would throw pixels away. An SVG has no such problem: the viewBox IS the
 * crop, changing it is lossless, and a correctly framed file then works
 * everywhere — an `<img>`, a CSS background, a README preview — without every
 * consumer having to know the correction.
 *
 * HOW THE BOX IS MEASURED
 *
 * `SVGGraphicsElement.getBBox()` in a real browser, which returns the exact
 * union of the geometry. Not rasterised and counted: a thin blade at 256px
 * would quantise to a box a pixel or two out, and that error lands right where
 * these icons are most sensitive.
 *
 * Filters are the one thing `getBBox` does not account for — a drop shadow
 * spills past the geometry — so the box is padded. See `PAD`.
 */
import { readFileSync, writeFileSync, readdirSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const DIR = join(ROOT, 'art/svg-items');
/**
 * Where the app loads them from.
 *
 * The same source-then-published split every other asset uses: `art/source/*.png`
 * becomes `web/public/art/*.webp`, and these become `web/public/art/items/*.svg`.
 * Copied rather than symlinked or imported across the boundary so that
 * `web/public` remains exactly what ships, which is what `art-registry.ts`
 * scans and what the build serves.
 */
const PUBLIC = join(ROOT, 'web/public/art/items');

/**
 * Breathing room around the measured box, as a fraction of its longest side.
 *
 * Two jobs. The drop-shadow filter (`dy=8`, `stdDeviation=10`) paints outside
 * the geometry `getBBox` reports, and a shape cropped flush to its own edge
 * looks wedged into the frame — every other icon in the app has margin.
 */
const PAD = 0.06;

/** The browser Playwright already downloaded for this repo's tests. */
function chromePath(): string | undefined {
  const base = '/opt/pw-browsers';
  try {
    const dir = readdirSync(base).find((d) => d.startsWith('chromium-'));
    return dir ? join(base, dir, 'chrome-linux', 'chrome') : undefined;
  } catch {
    return undefined;   // not this machine's layout; let Playwright find its own
  }
}

export interface Box { x: number; y: number; w: number; h: number }

/** Measure every named SVG's geometry, in its own user units. */
async function measure(names: string[]): Promise<Map<string, Box>> {
  const exe = chromePath();
  const browser = await chromium.launch(exe ? { executablePath: exe } : {});
  const page = await browser.newPage();
  const out = new Map<string, Box>();
  for (const name of names) {
    const svg = readFileSync(join(DIR, `${name}.svg`), 'utf8');
    // Inlined into the document: `getBBox` needs a laid-out element, and an
    // `<img>` never exposes its internals.
    await page.setContent(`<body style="margin:0">${svg}</body>`);
    const box = await page.evaluate(() => {
      const root = document.querySelector('svg')!;
      // The root's own bbox is the union of its children — including <defs>,
      // which draws nothing and whose gradients would otherwise drag the box
      // out to the full canvas.
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (const el of Array.from(root.children)) {
        if (el.tagName === 'defs') continue;
        const b = (el as SVGGraphicsElement).getBBox();
        if (b.width === 0 && b.height === 0) continue;
        x0 = Math.min(x0, b.x); y0 = Math.min(y0, b.y);
        x1 = Math.max(x1, b.x + b.width); y1 = Math.max(y1, b.y + b.height);
      }
      return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
    });
    out.set(name, box);
  }
  await browser.close();
  return out;
}

/**
 * The viewBox that crops to `box`, kept SQUARE.
 *
 * Square because the app lays icons out in square slots. A tight non-square
 * viewBox would be honest about the drawing and wrong about the layout: a
 * rapier's box is roughly 1:4, and stretched into a square slot it would be the
 * only icon in the game that is not to scale.
 */
export function frameFor(box: Box, pad = PAD): { x: number; y: number; size: number } {
  const side = Math.max(box.w, box.h);
  const grown = side * (1 + pad * 2);
  return {
    x: box.x + box.w / 2 - grown / 2,
    y: box.y + box.h / 2 - grown / 2,
    size: grown,
  };
}

const round = (n: number) => Math.round(n * 10) / 10;

/** The file's text with its viewBox replaced. */
export function reframe(svg: string, box: Box): string {
  const f = frameFor(box);
  return svg.replace(/viewBox="[^"]*"/,
    `viewBox="${round(f.x)} ${round(f.y)} ${round(f.size)} ${round(f.size)}"`);
}

async function main(): Promise<number> {
  const check = process.argv.includes('--check');
  const names = readdirSync(DIR).filter((f) => f.endsWith('.svg')).map((f) => f.slice(0, -4)).sort();
  if (names.length === 0) {
    console.error('no SVGs in art/svg-items');
    return 1;
  }
  const boxes = await measure(names);
  const stale: string[] = [];
  for (const name of names) {
    const path = join(DIR, `${name}.svg`);
    const current = readFileSync(path, 'utf8');
    const want = reframe(current, boxes.get(name)!);
    if (current === want) continue;
    if (check) stale.push(name);
    else writeFileSync(path, want, 'utf8');
  }

  // Publish. Cleared first so a renamed or deleted icon does not linger in
  // `web/public` and go on being registered — the same reason `make_thumbs.py`
  // treats an orphan thumb as staleness rather than as harmless.
  const published = existsSync(PUBLIC) ? readdirSync(PUBLIC).filter((f) => f.endsWith('.svg')) : [];
  const wantPublished = names.map((n) => `${n}.svg`);
  const orphans = published.filter((f) => !wantPublished.includes(f));
  const outOfDate = names.filter((n) => {
    const dst = join(PUBLIC, `${n}.svg`);
    if (!existsSync(dst)) return true;
    const src = reframe(readFileSync(join(DIR, `${n}.svg`), 'utf8'), boxes.get(n)!);
    return readFileSync(dst, 'utf8') !== src;
  });
  if (check) {
    stale.push(...orphans.map((f) => `${f} (published with no source)`));
    stale.push(...outOfDate.map((n) => `${n} (not published)`));
  } else {
    if (existsSync(PUBLIC)) rmSync(PUBLIC, { recursive: true });
    mkdirSync(PUBLIC, { recursive: true });
    for (const n of names) {
      writeFileSync(join(PUBLIC, `${n}.svg`), readFileSync(join(DIR, `${n}.svg`), 'utf8'), 'utf8');
    }
  }
  if (check) {
    if (stale.length > 0) {
      console.log(`item SVGs are unframed or unpublished; run: npm run svg-frame\n  ${stale.join(', ')}`);
      return 1;
    }
    console.log(`${names.length} item SVGs are framed.`);
    return 0;
  }
  // Report the improvement, because "it ran" is not the same as "it helped".
  const gain = names.map((n) => {
    const b = boxes.get(n)!;
    return (b.w * b.h) / (frameFor(b).size ** 2);
  });
  const mean = gain.reduce((a, c) => a + c, 0) / gain.length;
  console.log(`framed ${names.length} item SVGs -> ${PUBLIC}; mean box coverage now ${(mean * 100).toFixed(0)}%`);
  return 0;
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/').split('/').pop()!)) {
  process.exit(await main());
}
