/**
 * Export every word of player-facing module text as Markdown, so the writing
 * can be read and reviewed the way a player meets it — in one document, in
 * scene order — instead of hunted through TypeScript object literals.
 *
 * The readability test tells you which passages *fail* a mechanical check. This
 * tells you what the prose actually *reads like*, which is the thing a check
 * can't measure. Each passage is annotated with its reading grade, and anything
 * the checker flags is marked ⚠ inline, so a review pass can scan for both.
 *
 * Usage:
 *   npm run prose                       # every playable module → stdout
 *   npm run prose -- hollow-road        # one module
 *   npm run prose -- --out docs/prose   # write <module>.md files
 *   npm run prose -- --issues           # only passages the checker flags
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { MODULES, playableModules } from '../src/data/modules/index.js';

import type { Module, Scene, Choice } from '../src/adventure/types.js';
import { gradeLevel, readabilityIssues, wordCount } from '../src/adventure/readability.js';

// Below this a passage is a UI fragment ("Onward", "Back to camp"), not prose —
// graded scores on three words are noise. Matches the readability test's floor.
const MIN_WORDS = 6;

const args = process.argv.slice(2);
const outDir = ((): string | undefined => {
  const i = args.indexOf('--out');
  return i >= 0 ? args[i + 1] : undefined;
})();
const issuesOnly = args.includes('--issues');
const wanted = args.filter((a) => !a.startsWith('--') && a !== outDir);

/** One passage, rendered with its grade and any checker complaints. */
function passage(text: string, opts: { quote?: boolean } = {}): string | undefined {
  const issues = wordCount(text) >= MIN_WORDS ? readabilityIssues(text) : [];
  if (issuesOnly && issues.length === 0) return undefined;
  const grade = wordCount(text) >= MIN_WORDS ? ` <sub>(grade ${gradeLevel(text).toFixed(1)})</sub>` : '';
  const flag = issues.length ? `\n\n> ⚠ ${issues.join('  ·  ')}` : '';
  const body = opts.quote ? `> ${text.replace(/\n/g, '\n> ')}` : text;
  return `${body}${grade}${flag}`;
}

function block(title: string, paras: readonly unknown[] | undefined, quote = false): string {
  const rendered = (paras ?? []).map((p) => passage(String(p), { quote })).filter((s): s is string => !!s);
  if (rendered.length === 0) return '';
  return `**${title}**\n\n${rendered.join('\n\n')}\n\n`;
}

function choices(list: Choice[] | undefined): string {
  if (!list?.length) return '';
  const rows = list.map((c) => {
    const gate = c.check ? ` \`[${c.check.skill} DC ${c.check.dc}]\`` : '';
    const once = c.once ? ' _(once)_' : '';
    return `- →${gate} ${c.label}${once}  → \`${c.to}\``;
  });
  return `**Choices**\n\n${rows.join('\n')}\n\n`;
}

function sceneMd(scene: Scene): string {
  let md = `### \`${scene.id}\` — ${scene.kind}\n\n`;

  if ('npc' in scene && scene.npc) md += `_Speaker: ${scene.npc.name}_\n\n`;
  if ('encounterId' in scene) md += `_Fight: ${scene.encounterId} on ${scene.mapId}_\n\n`;
  if ('skill' in scene && 'dc' in scene) md += `_Check: ${scene.skill} DC ${scene.dc}_\n\n`;

  if ('text' in scene) md += block('Text', scene.text);
  if ('lines' in scene) md += block('Lines', scene.lines);
  if ('intro' in scene) md += block('Intro', scene.intro);
  if ('success' in scene && scene.success?.text) md += block('On success', scene.success.text, true);
  if ('failure' in scene && scene.failure?.text) md += block('On failure', scene.failure.text, true);
  if ('onWin' in scene && scene.onWin?.text) md += block('On win', scene.onWin.text, true);
  if ('onLoss' in scene && scene.onLoss?.text) md += block('On loss', scene.onLoss.text, true);

  if ('approaches' in scene) {
    for (const a of scene.approaches ?? []) {
      md += `**Approach: ${a.label}** \`[${a.skill} DC ${a.dc}]\`${a.hint ? ` — _${a.hint}_` : ''}\n\n`;
      if (a.success?.text) md += block('… success', a.success.text, true);
      if (a.failure?.text) md += block('… failure', a.failure.text, true);
    }
  }

  // An explore map's node labels are read as much as any paragraph — they are
  // what the player actually picks between.
  if ('map' in scene) {
    md += `**Map: ${scene.map.title}**\n\n`;
    const rows = scene.map.nodes.map((n) =>
      `- **${n.label}**${n.mystery ? ` — _unvisited: “${n.mystery}”_` : ''}  → \`${n.scene}\``);
    md += `${rows.join('\n')}\n\n`;
  }

  if ('next' in scene && Array.isArray(scene.next)) md += choices(scene.next);
  else if ('next' in scene && typeof scene.next === 'string') md += `→ \`${scene.next}\`\n\n`;

  return md;
}

/** Journal entries live in `effects` all over the tree — sweep them out. */
function journalMd(mod: Module): string {
  const seen = new Set<string>();
  const rows: string[] = [];
  const sweep = (node: unknown): void => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) { node.forEach(sweep); return; }
    const o = node as Record<string, unknown>;
    if (o['kind'] === 'journal' && o['entry'] && typeof o['entry'] === 'object') {
      const e = o['entry'] as { id?: string; kind?: string; title?: string; body?: string };
      if (e.body && !seen.has(e.body)) {
        seen.add(e.body);
        const p = passage(e.body);
        if (p) rows.push(`**${e.title ?? e.id}** _(${e.kind})_\n\n${p}`);
      }
    }
    for (const k of Object.keys(o)) sweep(o[k]);
  };
  sweep(mod.scenes);
  return rows.length ? `## Journal entries\n\n${rows.join('\n\n')}\n\n` : '';
}

function moduleMd(mod: Module): string {
  let md = `# ${mod.title}\n\n_${mod.blurb}_\n\n`;
  md += `Levels ${mod.levelBand?.from ?? '?'}–${mod.levelBand?.to ?? '?'} · start \`${mod.start}\` · ${Object.keys(mod.scenes).length} scenes\n\n---\n\n`;
  md += `## Scenes\n\n`;
  // Start scene first, then the rest in declaration order — closest thing to
  // the order a player meets them without simulating every branch.
  const ids = Object.keys(mod.scenes);
  const ordered = [mod.start, ...ids.filter((i) => i !== mod.start)];
  for (const id of ordered) {
    const scene = mod.scenes[id];
    if (scene) md += sceneMd(scene);
  }
  md += journalMd(mod);
  return md;
}

const mods = wanted.length
  ? wanted.map((id) => {
      const m = MODULES.find((x) => x.id === id);
      if (!m) { console.error(`unknown module "${id}" — have: ${MODULES.map((x) => x.id).join(', ')}`); process.exit(1); }
      return m;
    })
  : playableModules();

if (outDir) {
  mkdirSync(outDir, { recursive: true });
  for (const m of mods) {
    const path = join(outDir, `${m.id}.md`);
    writeFileSync(path, moduleMd(m));
    console.error(`wrote ${path}`);
  }
} else {
  process.stdout.write(mods.map(moduleMd).join('\n---\n\n'));
}
