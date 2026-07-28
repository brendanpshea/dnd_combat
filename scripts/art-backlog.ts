/**
 * Rewrite the parts of `art/prompts.md` that are facts about the code.
 *
 *   npm run art-backlog             # rewrite them
 *   npm run art-backlog -- --check  # fail if they are stale
 *
 * The doc carried three counts of how much art was left — in the summary at the
 * top, in the §8 heading and in the §12 backlog — and all three were wrong, by
 * different amounts, in different directions. "80 of the 132 monsters are ✅",
 * "still needed (74)", "60 of 140 monsters have no generated art"; the truth was
 * 103 of 138 done and 35 left. A number that has been wrong for a while is worse
 * than no number, because it is the one thing in a doc a reader will not check.
 *
 * All of it is derivable: which monsters exist is `MONSTERS`, which have art is
 * the registry (itself derived from the directory), and the emoji a boardless
 * monster falls back to is `glyphFor`. So none of it is written by hand any
 * more. Same rule as the reference docs, the art registry and the SVG terrain.
 *
 * What this does NOT touch is the prompts themselves. Those are authored, and
 * `test/art-prompts.test.ts` is what insists every monster still on the emoji
 * has one.
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

function backlogTable(): string {
  const rows = [...missing].sort((a, b) => xpOf(b) - xpOf(a) || a.localeCompare(b));
  const head = '| Monster | ID | Type | XP | Fallback | Size |\n| --- | --- | --- | --- | --- | --- |';
  const body = rows.map((id) => {
    const m = MONSTERS[id]!;
    return `| ${m.name} | \`${id}\` | ${m.creatureType} | ${xpOf(id) || '—'} | ${glyphFor(id)} | ${m.size ?? 'medium'} |`;
  });
  return [head, ...body].join('\n');
}

function rewrite(text: string): string {
  let out = text;

  // The summary line at the top.
  out = out.replace(
    /\*\*\d+ of the \d+ monsters are ✅, and the remaining \d+ have\s*\n\s*prompts ready to generate in §8\.\*\*/,
    `**${done} of the ${all.length} monsters are ✅, and the remaining ${missing.length} have\nprompts ready to generate in §8.**`,
  );

  // The §8 heading.
  out = out.replace(/^## 8\. Monsters — .*\(\d+ still needed\).*$|^## 8\. Monsters — ⬜ still needed \(\d+\), by creature type$/m,
    `## 8. Monsters — the generation queue (${missing.length} still needed), by creature type`);

  // The §12 opening sentence and its table.
  out = out.replace(/^\d+ of \d+ monsters have no generated art\./m,
    `${missing.length} of ${all.length} monsters have no generated art.`);
  out = out.replace(/^\| Monster \| ID \|.*(?:\n\|.*)*/m, backlogTable());

  return out;
}

const before = readFileSync(DOC, 'utf8');
const after = rewrite(before);

if (process.argv.includes('--check')) {
  if (before !== after) {
    console.error('art/prompts.md is stale; run: npm run art-backlog');
    process.exit(1);
  }
  console.log('art/prompts.md counts and backlog are up to date.');
} else {
  writeFileSync(DOC, after);
  console.log(`${done}/${all.length} monsters have art; ${missing.length} in the backlog.`);
}
