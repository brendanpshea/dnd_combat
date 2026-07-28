/**
 * A contact sheet of every token silhouette, at the sizes the board uses.
 *
 * The same argument the terrain sheet settled, about a different asset: whether
 * an abstract shape "reads" cannot be decided by describing it. So this renders
 * the real `.token` markup with the real `styles.css`, at the three sizes that
 * matter, next to real generated art for comparison.
 *
 * Measured first, because the sheet is answering a measurement: a board cell is
 * 49px on a 430px phone and the emoji standing in for missing art is 20x19 —
 * about a sixth of the cell, where real art fills it. The bottom row of this
 * sheet is that emoji, at the same sizes, so the comparison is in the picture
 * rather than in a claim about it.
 *
 *   npx tsx scripts/token-sheet.ts
 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { glyphFor } from '../web/src/glyphs.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const TOKENS = `${ROOT}web/public/art/tokens/`;
const OUT = `${ROOT}art/token-sheet.html`;

/** Cell sizes: a small phone, a normal phone, and a desktop board. */
const SIZES = [34, 49, 96];

/** One example creature per type, for the emoji row and the art comparison. */
const EXAMPLE: Record<string, string> = {
  aberration: 'aboleth', beast: 'wolf', celestial: 'unicorn', construct: 'animated-armor',
  dragon: 'red-wyrmling', elemental: 'fire-elemental', fey: 'sprite', fiend: 'imp',
  giant: 'hill-giant', humanoid: 'bandit', monstrosity: 'owlbear', ooze: 'gray-ooze',
  undead: 'skeleton',
};

const css = readFileSync(`${ROOT}web/src/styles.css`, 'utf8');
const svgs = new Map<string, string>();
for (const f of readdirSync(TOKENS)) {
  svgs.set(f.replace(/\.svg$/, ''), readFileSync(TOKENS + f, 'utf8'));
}

/** A token as the board builds one, with a silhouette inside it. */
function silhouetteToken(key: string, size: number, team: 'team1' | 'team2'): string {
  return `<div class="token ${team} sheet" style="--cell:${size}px">
    <div class="base"></div>
    <span class="sil">${svgs.get(key) ?? ''}</span>
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

const types = [...svgs.keys()].filter((k) => k.startsWith('type-')).sort();
const classes = [...svgs.keys()].filter((k) => k.startsWith('class-')).sort();

function row(label: string, cells: string): string {
  return `<tr><th>${label}</th>${cells}</tr>`;
}

const typeRows = types.map((key) => {
  const type = key.slice('type-'.length);
  const example = EXAMPLE[type];
  const cells = SIZES.map((s) => `<td>${silhouetteToken(key, s, 'team2')}</td>`).join('')
    + `<td class="gap">${example ? emojiToken(example, 49, 'team2') : ''}</td>`
    + `<td>${example ? artToken(example, 49, 'team2') : ''}</td>`;
  return row(type, cells);
}).join('\n');

const classRows = classes.map((key) => {
  const cls = key.slice('class-'.length);
  const cells = SIZES.map((s) => `<td>${silhouetteToken(key, s, 'team1')}</td>`).join('')
    + `<td class="gap">${emojiToken(cls, 49, 'team1')}</td>`
    + `<td>${artToken(cls, 49, 'team1')}</td>`;
  return row(cls, cells);
}).join('\n');

// Size tiers, since throwing the size signal away is half of what is wrong with
// the emoji: a Huge remorhaz and a Tiny sprite are both 20px today.
const TIERS: Array<[string, number]> = [
  ['tiny', 0.6], ['small', 0.82], ['medium', 1], ['large', 1.25], ['huge', 1.5],
];
const tierRow = TIERS.map(([name, scale]) =>
  `<td><div class="token team2 sheet" style="--cell:49px">
     <div class="base"></div>
     <span class="sil" style="transform:scale(${scale})">${svgs.get('type-monstrosity')}</span>
   </div><small>${name}</small></td>`).join('');

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
.token.sheet .sil { position: absolute; inset: 6%; display: block; z-index: 1; }
.token.sheet .sil svg { width: 100%; height: 100%; display: block; }
.token.team1 .sil { color: #7fb3ff; }
.token.team2 .sil { color: #ff8f8f; }
</style>
<h1>Token silhouettes — 21 files, 6.4 KB total</h1>
<p style="color:#8d84a6;font-size:.8rem;max-width:60ch">
Columns: the silhouette at 34px (small phone), 49px (the measured cell on a
430px phone) and 96px (desktop) — then, past the rule, today's emoji and the
real art at 49px for comparison.</p>

<h2>By creature type — 13 files, one per type</h2>
<table><thead><tr><td></td><td>34</td><td>49</td><td>96</td><td class="gap">emoji</td><td>art</td></tr></thead>
${typeRows}</table>

<h2>By class — 8 files, for the party's own tokens</h2>
<table><thead><tr><td></td><td>34</td><td>49</td><td>96</td><td class="gap">emoji</td><td>art</td></tr></thead>
${classRows}</table>

<h2>Size tiers — the signal the emoji path throws away</h2>
<table><tr><th>monstrosity</th>${tierRow}</tr></table>
`);
console.log(`wrote ${OUT}`);
