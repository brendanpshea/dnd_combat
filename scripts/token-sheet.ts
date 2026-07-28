/**
 * A contact sheet of every token silhouette, at the sizes the board uses.
 *
 * The same argument the terrain sheet settled, about a different asset: whether
 * an abstract shape "reads" cannot be decided by describing it. So this renders
 * the real `.token` markup with the real `styles.css`, at the three sizes that
 * matter, next to the emoji it replaces and real art for comparison.
 *
 * Measured first, because the sheet is answering a measurement: a board cell is
 * 49px on a 430px phone and the emoji standing in for missing art was 20x19 —
 * about a sixth of the cell, where real art fills it.
 *
 *   npx tsx scripts/token-sheet.ts
 *   node_modules/playwright-core/.../chrome --headless --screenshot=... \
 *     --window-size=1200,2600 art/token-sheet.html
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { glyphFor } from '../web/src/glyphs.js';
import { SILHOUETTE_PATH, SILHOUETTE_BOX } from '../web/src/silhouettes.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const OUT = `${ROOT}art/token-sheet.html`;

/** Cell sizes: a small phone, a normal phone, and a desktop board. */
const SIZES = [34, 49, 96];

/** One example creature per type, for the emoji row and the art comparison. */
const EXAMPLE: Record<string, string> = {
  aberration: 'aboleth', beast: 'wolf', celestial: 'unicorn', construct: 'animated-armor',
  dragon: 'young-red', elemental: 'fire-elemental', fey: 'sprite', fiend: 'imp',
  giant: 'hill-giant', humanoid: 'bandit', monstrosity: 'owlbear', ooze: 'gray-ooze',
  undead: 'skeleton',
  // Body plans: the monster each one was drawn for.
  winged: 'griffon', serpent: 'giant-constrictor-snake', manylegs: 'giant-spider',
  drifting: 'specter',
};

const css = readFileSync(`${ROOT}web/src/styles.css`, 'utf8');

function svg(key: string): string {
  return `<svg viewBox="0 0 ${SILHOUETTE_BOX} ${SILHOUETTE_BOX}" aria-hidden="true">`
    + `<path d="${SILHOUETTE_PATH[key] ?? ''}" fill="currentColor"/></svg>`;
}

/** A token as the board builds one, with a silhouette inside it. */
function silhouetteToken(key: string, size: number, team: 'team1' | 'team2'): string {
  return `<div class="token noart ${team} sheet" style="--cell:${size}px">
    <div class="base"></div>
    <span class="sil">${svg(key)}</span>
  </div>`;
}

function emojiToken(monsterId: string, size: number, team: 'team1' | 'team2'): string {
  return `<div class="token emoji ${team} sheet" style="--cell:${size}px">
    <div class="base"></div>
    <span class="glyph">${glyphFor(monsterId)}</span>
  </div>`;
}

function artToken(monsterId: string, size: number, team: 'team1' | 'team2'): string {
  return `<div class="token ${team} sheet" style="--cell:${size}px">
    <div class="base"></div>
    <img class="art" src="../web/public/art/token-${monsterId}.webp" alt="">
  </div>`;
}

const keys = Object.keys(SILHOUETTE_PATH);
function group(prefix: string): string[] {
  return keys.filter((k) => k.startsWith(prefix));
}

function rows(prefix: string, team: 'team1' | 'team2'): string {
  return group(prefix).map((key) => {
    const name = key.slice(prefix.length);
    const example = EXAMPLE[name] ?? name;
    const cells = SIZES.map((s) => `<td>${silhouetteToken(key, s, team)}</td>`).join('')
      + `<td class="gap">${emojiToken(example, 49, team)}</td>`
      + `<td>${artToken(example, 49, team)}</td>`;
    return `<tr><th>${name}</th>${cells}</tr>`;
  }).join('\n');
}

// Size tiers, since throwing the size signal away is half of what was wrong
// with the emoji: a Huge remorhaz and a Tiny sprite were both 20px.
const TIERS: Array<[string, number]> = [
  ['tiny', 0.6], ['small', 0.82], ['medium', 1], ['large', 1.25], ['huge', 1.5],
];
const tierRow = TIERS.map(([name, scale]) =>
  `<td><div class="token team2 sheet" style="--cell:49px">
     <div class="base"></div>
     <span class="sil" style="transform:scale(${scale})">${svg('type-monstrosity')}</span>
   </div><small>${name}</small></td>`).join('');

const head = '<thead><tr><td></td><td>34</td><td>49</td><td>96</td>'
  + '<td class="gap">emoji</td><td>art</td></tr></thead>';

writeFileSync(OUT, `<!doctype html>
<meta charset="utf-8">
<title>Token silhouettes — contact sheet</title>
<style>
${css}
body { background: #1a1625; color: #d8cfe8; font-family: system-ui, sans-serif; padding: 20px; }
h1 { font-size: 1.1rem; } h2 { font-size: .9rem; margin-top: 26px; color: #8d84a6; }
table { border-collapse: collapse; }
th { text-align: right; padding-right: 12px; font-size: .74rem; font-weight: 600; color: #8d84a6; }
td { padding: 5px 7px; vertical-align: middle; }
td.gap { border-left: 1px solid #322b47; padding-left: 16px; }
thead td { font-size: .68rem; color: #6f6790; text-align: center; }
small { display: block; text-align: center; font-size: .62rem; color: #6f6790; }
/* The sheet drives cell size directly; the board gets it from the grid. */
.token.sheet { position: relative; width: var(--cell); height: var(--cell); }
/* The emoji column is history now — the app no longer has a rule for it, so
   the sheet keeps the one it used to have, to compare against. */
.token.emoji .base {
  inset: 9%; border-radius: 50%; background: #1d1830; border: 2.5px solid transparent;
}
.token.emoji.team1 .base { border-color: var(--blue); }
.token.emoji.team2 .base { border-color: var(--red); }
.token.emoji .glyph {
  position: absolute; inset: 9%; z-index: 1; display: flex;
  align-items: center; justify-content: center;
  font-size: clamp(14px, 4.2vmin, 26px); line-height: 1;
}
</style>
<h1>Token silhouettes — ${keys.length} shapes, ${Object.values(SILHOUETTE_PATH).join('').length} bytes of path data</h1>
<p style="color:#8d84a6;font-size:.8rem;max-width:64ch">
Columns: the silhouette at 34px (small phone), 49px (the measured cell on a
430px phone) and 96px (desktop) — then, past the rule, the emoji it replaces
and the real art at 49px for comparison.</p>

<h2>By creature type</h2>
<table>${head}
${rows('type-', 'team2')}</table>

<h2>By body plan — chosen per monster where the type is too coarse</h2>
<table>${head}
${rows('plan-', 'team2')}</table>

<h2>By class — the party's own tokens</h2>
<table>${head}
${rows('class-', 'team1')}</table>

<h2>Size tiers — the signal the emoji path threw away</h2>
<table><tr><th>monstrosity</th>${tierRow}</tr></table>
`);
console.log(`wrote ${OUT}`);
