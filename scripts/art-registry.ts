/**
 * Derive `web/src/art-registry.ts` from the files in `web/public/art`.
 *
 *   npm run art-registry           # rewrite it
 *   npm run art-registry -- --check  # fail if it is stale
 *
 * Which ids have generated art is a fact about the directory, and it used to be
 * a hand-kept list in `art.ts` that happened to agree with it. Two lists that
 * must match and only a test between them is one edit away from a broken <img>
 * (declared, no file) or 300 KB of art nobody ever sees (file, not declared).
 *
 * The obvious alternative — `import.meta.glob('../public/art/*.webp')` — reads
 * the directory at build time with no generated file at all, and was measured
 * before this was written: it makes Vite treat every asset in `public/` as a
 * bundle input as well as a static copy, so `dist-web` went from 2 assets and
 * 7.5 MB to 623 assets and 16 MB. `public/` is copied verbatim by design;
 * globbing it duplicates it. Hence codegen, checked in CI.
 *
 * The four categories are read off the filename, not declared anywhere:
 *
 *   portrait-npc-<id>.webp  -> HAS_NPC_ART     (adventure NPC, portrait only)
 *   token-tok-<id>.webp     -> HAS_TOKEN_ART   (map node, token only)
 *   scene-<id>.webp         -> HAS_SCENE_ART   (location backdrop)
 *   icon-<id>.webp          -> HAS_SPELL_ICON  (spell / feature icon)
 *   bg-<theme>.webp         -> HAS_BOARD_BG    (arena backdrop)
 *   terrain/terrain-<kind>-<theme>-<variant>.svg -> HAS_TERRAIN_ART
 *   items/<id>.svg                               -> HAS_ITEM_ART
 *   portrait-<id> AND token-<id> -> HAS_ART    (needs both: the board shows the
 *                                               token, the sheet the portrait)
 *
 * A combatant with only one of the pair is the interesting case, and it is a
 * hard error rather than a silent omission — `hasArt` is one predicate for both
 * files, so half a pair means one of the two views renders a broken image.
 */
import { writeFileSync, readFileSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const ART = fileURLToPath(new URL('../web/public/art/', import.meta.url));
const OUT = fileURLToPath(new URL('../web/src/art-registry.ts', import.meta.url));

interface Registry {
  art: string[];
  npc: string[];
  scene: string[];
  token: string[];
  icon: string[];
  bg: string[];
  /** Themes with a full set of drawn blocking props. */
  terrain: string[];
  /** Gear icons: `items/<id>.svg`, drawn vector like the terrain props. */
  item: string[];
}

function scan(): Registry {
  const files = readdirSync(ART);
  const portraits = new Set<string>();
  const tokens = new Set<string>();
  const scenes = new Set<string>();
  const icons = new Set<string>();
  const bgs = new Set<string>();
  for (const f of files) {
    let m = f.match(/^portrait-(.+)\.webp$/);
    if (m) { portraits.add(m[1]!); continue; }
    m = f.match(/^token-(.+)\.webp$/);
    if (m) { tokens.add(m[1]!); continue; }
    m = f.match(/^scene-(.+)\.webp$/);
    if (m) { scenes.add(m[1]!); continue; }
    m = f.match(/^icon-(.+)\.webp$/);
    if (m) { icons.add(m[1]!); continue; }
    m = f.match(/^bg-(.+)\.webp$/);
    if (m) bgs.add(m[1]!);
  }

  // Blocking props live in their own subfolder and are SVG, not webp: they are
  // drawn vector rather than generated raster, so they skip the sheet-slicing
  // pipeline entirely. A theme registers only when ALL FOUR of its props exist
  // — a half-set would leave the board mixing drawn walls with CSS ones, which
  // looks worse than either alone.
  const terrainDir = join(ART, 'terrain');
  const terrainFiles = existsSync(terrainDir) ? readdirSync(terrainDir) : [];
  const seen = new Set(terrainFiles.filter((f) => f.endsWith('.svg')).map((f) => f.slice(0, -4)));
  const themes = new Set<string>();
  for (const f of seen) {
    const m = f.match(/^terrain-(?:wall|cover)-(.+)-[ab]$/);
    if (m) themes.add(m[1]!);
  }
  const terrain = [...themes].filter((t) => (['wall', 'cover'] as const)
    .every((kind) => (['a', 'b'] as const).every((v) => seen.has(`terrain-${kind}-${t}-${v}`))));

  // Gear icons. Vector like the terrain props and for the same reason — they
  // are drawn rather than generated — but flat, one file per item id, so there
  // is no completeness rule to apply: whatever is there is offered.
  const itemDir = join(ART, 'items');
  const item = (existsSync(itemDir) ? readdirSync(itemDir) : [])
    .filter((f) => f.endsWith('.svg')).map((f) => f.slice(0, -4));

  const npc = [...portraits].filter((id) => id.startsWith('npc-'));
  const token = [...tokens].filter((id) => id.startsWith('tok-'));
  const paired = [...portraits].filter((id) => !id.startsWith('npc-') && tokens.has(id));

  // Half a pair: a portrait with no token, or a token with no portrait, for
  // something that is neither an NPC nor a map node. Nothing can display it
  // correctly, so say so rather than quietly dropping it.
  const lonely = [
    ...[...portraits].filter((id) => !id.startsWith('npc-') && !tokens.has(id)).map((id) => `portrait-${id}.webp has no token`),
    ...[...tokens].filter((id) => !id.startsWith('tok-') && !portraits.has(id)).map((id) => `token-${id}.webp has no portrait`),
  ];
  if (lonely.length > 0) {
    console.error('Art files that cannot be registered — every combatant needs both a portrait and a token:');
    for (const l of lonely) console.error(`  ${l}`);
    process.exit(1);
  }

  const sort = (a: string[]) => a.sort((x, y) => x.localeCompare(y));
  return {
    art: sort(paired), npc: sort(npc), scene: sort([...scenes]), token: sort(token),
    icon: sort([...icons]), bg: sort([...bgs]), terrain: sort(terrain),
    item: sort(item),
  };
}

function block(name: string, doc: string, ids: string[]): string {
  const lines: string[] = [];
  let row = '';
  for (const id of ids) {
    const piece = `'${id}', `;
    if (row.length + piece.length > 76) { lines.push(`  ${row.trimEnd()}`); row = ''; }
    row += piece;
  }
  if (row) lines.push(`  ${row.trimEnd().replace(/,$/, '')}`);
  return [doc, `export const ${name} = new Set<string>([`, ...lines, ']);', ''].join('\n');
}

function render(r: Registry): string {
  return [
    '/**',
    ' * Which ids have generated art, derived from the contents of',
    ' * `web/public/art` by `npm run art-registry`. Do not edit by hand: add or',
    ' * remove the .webp files and regenerate. The test suite fails if this file',
    ' * and the directory disagree.',
    ' */',
    '',
    block(
      'HAS_ART',
      ['/** Combatants with both a `portrait-<id>.webp` and a `token-<id>.webp`. */'].join('\n'),
      r.art,
    ),
    block(
      'HAS_NPC_ART',
      ['/** Adventure NPC archetypes (`portrait-npc-<id>.webp`) — portrait only. */'].join('\n'),
      r.npc,
    ),
    block(
      'HAS_SCENE_ART',
      ['/** Location backdrops (`scene-<id>.webp`). */'].join('\n'),
      r.scene,
    ),
    block(
      'HAS_TOKEN_ART',
      ['/** Map nodes (`token-tok-<id>.webp`) — token only. */'].join('\n'),
      r.token,
    ),
    block(
      'HAS_SPELL_ICON',
      ['/** Spells and features with a generated icon (`icon-<id>.webp`). */'].join('\n'),
      r.icon,
    ),
    block(
      'HAS_BOARD_BG',
      ['/** Map themes with a generated arena backdrop (`bg-<theme>.webp`). */'].join('\n'),
      r.bg,
    ),
    block(
      'HAS_TERRAIN_ART',
      [
        '/**',
        ' * Map themes with a full set of drawn blocking props',
        ' * (`terrain/terrain-{wall,cover}-<theme>-{a,b}.svg`).',
        ' *',
        ' * All four or none: a theme with drawn walls and CSS barricades would',
        ' * read worse than either treatment on its own.',
        ' */',
      ].join('\n'),
      r.terrain,
    ),
    block(
      'HAS_ITEM_ART',
      [
        '/**',
        ' * Gear with a drawn icon (`items/<id>.svg`).',
        ' *',
        ' * Keyed by the BASE shape, not by inventory id — see `itemArtId` in',
        ' * `web/src/itemArt.ts`. A +1 longsword, a silvered longsword and a',
        ' * longsword are one picture.',
        ' */',
      ].join('\n'),
      r.item,
    ),
  ].join('\n');
}

const body = render(scan());

if (process.argv.includes('--check')) {
  if (!existsSync(OUT) || readFileSync(OUT, 'utf8') !== body) {
    console.error('web/src/art-registry.ts is stale.');
    console.error('Run `npm run art-registry` and commit the result.');
    process.exit(1);
  }
  console.log('Art registry is up to date.');
} else {
  writeFileSync(OUT, body);
  console.log(`${OUT}  (${body.split('\n').length} lines)`);
}
