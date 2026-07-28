/**
 * Keep `art/prompts.md` honest about what is actually left to draw.
 *
 *   npm run art-backlog             # rewrite the derived parts
 *   npm run art-backlog -- --check  # fail if they are stale
 *
 * TWO PROBLEMS THIS SOLVES, BOTH THE SAME PROBLEM
 *
 * The doc carried three counts of how much art was left — in the summary, in
 * the §8 heading and in §12 — and all three were wrong, by different amounts,
 * in different directions: "80 of the 132", "still needed (74)", "60 of 140".
 * The truth was 103 of 138 done. A number that has been wrong for a while is
 * worse than no number, because it is the one thing in a doc a reader will not
 * check.
 *
 * Worse, §8 called itself the queue and was not one. Forty-eight of its
 * eighty-three prompts were for monsters that had long since been drawn, so
 * "what is still needed" could only be worked out by cross-referencing every
 * entry against the art directory by hand — which is exactly the work nobody
 * does, and exactly why nine monsters sat with no art and no prompt without
 * anyone noticing.
 *
 * So §8 now IS the queue: this partitions every prompt by whether its art
 * exists, leaves the outstanding ones there, and moves the finished ones to
 * §13. Nothing is deleted — a generated prompt is the record of how a thing was
 * drawn and what a re-roll would start from — but it is out of the way of the
 * question the section exists to answer.
 *
 * WHAT IS DERIVED AND WHAT IS NOT
 *
 * The counts, the §12 triage table, and which section a prompt sits in: all
 * facts about the code (`MONSTERS`, the art registry, `glyphFor`), so none of
 * them are hand-kept. The prompts themselves are authored and only ever moved
 * verbatim — a generator has nothing useful to say about what a creature looks
 * like. `test/art-prompts.test.ts` insists every monster still on the emoji has
 * one.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { MONSTERS, MONSTER_XP } from '../src/data/monsters.js';
import { HAS_ART } from '../web/src/art-registry.js';
import { glyphFor } from '../web/src/glyphs.js';

const DOC = fileURLToPath(new URL('../art/prompts.md', import.meta.url));

const all = Object.keys(MONSTERS);
const missing = all.filter((id) => !HAS_ART.has(id));
const done = all.length - missing.length;

/** XP orders the worklist: the ones met as a set-piece get drawn first. */
const xpOf = (id: string): number => MONSTER_XP[id] ?? 0;

/**
 * Creature-type headings, in the order the doc has always used them, keyed by
 * the `creatureType` in the stat block.
 *
 * Derived rather than read back out of the document, and that is the whole
 * point: the heading a prompt sits under used to be harvested from the doc, so
 * once this script invented a `### Not in the game` group, every entry that
 * happened to land after it inherited that label on the next run and never
 * escaped. Two mephits — real monsters, with art — ended up filed as not in the
 * game. A label parsed from the thing you are rewriting is not a fact about
 * anything.
 */
const SECTION_OF: Record<string, string> = {
  humanoid: 'Humanoids', beast: 'Beasts', fey: 'Fey', undead: 'Undead',
  fiend: 'Fiends', celestial: 'Celestials', elemental: 'Elementals',
  giant: 'Giants', dragon: 'Dragons', monstrosity: 'Monstrosities',
  aberration: 'Aberrations', construct: 'Constructs', ooze: 'Oozes',
};
const SECTIONS = [...Object.values(SECTION_OF), 'Not in the game'];

/** Where a prompt belongs, from the stat block — never from the document. */
function sectionFor(id: string): string {
  const m = MONSTERS[id];
  return m ? (SECTION_OF[m.creatureType] ?? 'Monstrosities') : 'Not in the game';
}

interface Entry { id: string; section: string; lines: string[] }

/** Line indices of a `## N.` heading, or -1. */
function headingAt(lines: string[], n: number): number {
  return lines.findIndex((l) => l.startsWith(`## ${n}.`));
}

/**
 * Pull every prompt entry out of a section, with the creature-type heading it
 * sat under. An entry is a `**Name** (`id`)` header plus everything up to the
 * next header or heading — which keeps any line of design intent attached to
 * the prompt it explains.
 */
function harvest(lines: string[], from: number, to: number): Entry[] {
  const out: Entry[] = [];
  for (let i = from; i < to; i++) {
    const m = lines[i]!.match(/^\*\*.+?\*\*\s*\(`([a-z0-9-]+)`\)/);
    if (!m) continue;
    let end = i + 1;
    while (end < to && !/^\*\*.+?\*\*\s*\(`[a-z0-9-]+`\)/.test(lines[end]!)
      && !lines[end]!.startsWith('###') && !lines[end]!.startsWith('## ')) end++;
    const body = lines.slice(i, end);
    while (body.length && body[body.length - 1]!.trim() === '') body.pop();
    out.push({ id: m[1]!, section: sectionFor(m[1]!), lines: body });
    i = end - 1;
  }
  return out;
}

/** Render entries grouped by creature type, skipping empty groups. */
function render(entries: Entry[]): string[] {
  const out: string[] = [];
  for (const section of SECTIONS) {
    const mine = entries.filter((e) => e.section === section)
      .sort((a, b) => xpOf(b.id) - xpOf(a.id) || a.id.localeCompare(b.id));
    if (!mine.length) continue;
    out.push(`### ${section}`, '');
    for (const e of mine) out.push(...e.lines, '');
  }
  return out;
}

function backlogTable(): string {
  const rows = [...missing].sort((a, b) => xpOf(b) - xpOf(a) || a.localeCompare(b));
  const head = '| Monster | ID | Type | XP | Fallback | Size |\n| --- | --- | --- | --- | --- | --- |';
  const body = rows.map((id) => {
    const m = MONSTERS[id]!;
    return `| ${m.name} | \`${id}\` | ${m.creatureType} | ${xpOf(id) || '—'} | ${glyphFor(id)} | ${m.size ?? 'medium'} |`;
  });
  return [head, ...body].join('\n');
}

const S8_BLURB = [
  '',
  `Everything here still needs drawing, and everything that needs drawing is`,
  `here — the split is derived from the art directory by \`npm run art-backlog\`,`,
  `so this section is the worklist rather than a description of one. Finished`,
  `prompts move to §13.`,
  '',
  'Each prompt is a **side-by-side design sheet** (portrait left, token right, on',
  'a #00FF00 chroma key) in the format `slice_side_by_side.py` expects — copy the',
  'whole line, generate, process. Sizes follow the §4 SIZE tiers so relative scale',
  'reads on the board.',
  '',
];

const S12_BLURB = (n: number, total: number) => [
  '',
  `The same ${n} monsters as §8, as a table rather than as prompts — §8 tells you`,
  'what to type into a generator, this tells you what to pick. Ordered by XP, so',
  'the ones a player meets as a set-piece get drawn first.',
  '',
  `${n} of ${total} monsters have no generated art. This is not a bug: the emoji`,
  'reads fine at token size, and `ArtImage` falls back deliberately rather than',
  'shipping a broken image. The **Fallback** column is what the board shows today.',
  '',
  'To close a row: take its prompt from §8, generate, drop **both** halves into',
  '`web/public/art` as `portrait-<id>.webp` and `token-<id>.webp`, and run',
  '`npm run art-registry` then `npm run art-backlog`. The registry is derived from',
  'the directory so there is no list to edit — but both halves must land, or the',
  'generator refuses: one without the other means one of the two views draws a',
  'broken image.',
  '',
];

const S13_BLURB = (strays: number) => [
  '',
  'Already generated and sitting in `web/public/art`. Kept, but out of the way of',
  '§8 so that section can be read as the worklist it is: a prompt is the record of',
  'how a thing was drawn, and a re-roll, a restyle or a matching new variant all',
  'start from the line that produced the original.',
  ...(strays ? [
    '',
    'Entries under *Not in the game* are prompts for creatures `MONSTERS` does not',
    'contain — renamed, or dropped. Nothing will ever ask for them.',
  ] : []),
  '',
];

function rewrite(text: string): string {
  const lines = text.split('\n');

  // Harvest §8 and, if it exists, the §13 archive.
  const s8 = headingAt(lines, 8);
  const s9 = headingAt(lines, 9);
  if (s8 < 0 || s9 < 0) throw new Error('cannot find §8/§9 in art/prompts.md');
  const s13 = headingAt(lines, 13);
  const entries = [
    ...harvest(lines, s8, s9),
    ...(s13 >= 0 ? harvest(lines, s13, lines.length) : []),
  ];
  const seen = new Set<string>();
  const unique = entries.filter((e) => !seen.has(e.id) && seen.add(e.id));

  // Three buckets, not two. `shadow-demon` had a prompt and is not a monster
  // in the game at all — the mirror image of a monster with no prompt, and just
  // as invisible. Work that will never be wanted is not "still to draw".
  const queue = unique.filter((e) => MONSTERS[e.id] && !HAS_ART.has(e.id));
  const archive = unique.filter((e) => MONSTERS[e.id] && HAS_ART.has(e.id));
  const orphans = unique.filter((e) => !MONSTERS[e.id]);

  // Rebuild the tail: everything before §8, then §8, then §9..§12, then §13.
  const middle = lines.slice(s9, s13 >= 0 ? s13 : lines.length);
  const rebuilt = [
    ...lines.slice(0, s8),
    `## 8. Still to draw — the queue (${queue.length}), by creature type`,
    ...S8_BLURB,
    ...render(queue),
    '---',
    '',
    ...middle,
    orphans.length
      ? `## 13. Not in the queue — already drawn, or no longer wanted (${archive.length + orphans.length})`
      : `## 13. Already drawn — the prompts that produced the shipped art (${archive.length})`,
    ...S13_BLURB(orphans.length),
    ...render(archive),
    ...(orphans.length ? render(orphans) : []),
  ];

  let out = rebuilt.join('\n');

  // The summary line at the top.
  out = out.replace(
    /\*\*\d+ of the \d+ monsters are ✅, and the remaining \d+ have\s*\n\s*prompts ready to generate in §8\.\*\*/,
    `**${done} of the ${all.length} monsters are ✅, and the remaining ${missing.length} have\nprompts ready to generate in §8.**`,
  );
  // §12: heading, prose and table are all a function of the data.
  out = out.replace(/^## 12\..*$[\s\S]*?(?=^\| Monster \| ID \|)/m,
    [`## 12. The queue at a glance (${missing.length})`, ...S12_BLURB(missing.length, all.length)].join('\n') + '\n');
  // Every such table, not the first. A `/m` replace left a stale second copy
  // behind once already: the §12 prose replacement above runs up to the first
  // table header, so a doc that had somehow acquired two tables kept one of
  // them, silently, listing monsters that had since been drawn.
  let tables = 0;
  out = out.replace(/^\| Monster \| ID \|.*(?:\n\|.*)*/gm, () => (tables++ ? '' : backlogTable()));
  if (tables > 1) console.warn(`removed ${tables - 1} duplicate backlog table(s)`);

  // Collapse runs of horizontal rules. The doc separates sections with `---`,
  // and rebuilding §8 emits one of its own, so without this every run stacks
  // another and `--check` never settles.
  return out
    .replace(/(?:^---$\n+){2,}/gm, '---\n\n')
    .replace(/\n{4,}/g, '\n\n\n')
    .replace(/\s*$/, '\n');
}

const before = readFileSync(DOC, 'utf8');
const after = rewrite(before);

if (process.argv.includes('--check')) {
  if (before !== after) {
    console.error('art/prompts.md is stale; run: npm run art-backlog');
    process.exit(1);
  }
  console.log('art/prompts.md counts and sections are up to date.');
} else {
  writeFileSync(DOC, after);
  console.log(`${done}/${all.length} monsters have art; ${missing.length} still to draw.`);
  const stray = rewrite(before).includes('### Not in the game');
  if (stray) console.log('note: art/prompts.md holds prompts for creatures not in MONSTERS (see §13).');
}
