/**
 * Builds each chapter's scenes from its `.story` files (story-format.ts):
 * `src/data/modules/<chapter>/*.story`, in the order of their names, into
 * `<chapter>/scenes.gen.ts`. Run after editing a story: `npm run stories`.
 * `test/story-format.test.ts` fails while a built file is out of date.
 */
import { readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseStory, emitScenes } from '../src/adventure/story-format.js';

export const MODULES_DIR = fileURLToPath(new URL('../src/data/modules/', import.meta.url));

/** The chapters written as stories: folders holding `.story` files. */
export function storyChapters(): string[] {
  return readdirSync(MODULES_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory() && readdirSync(join(MODULES_DIR, d.name)).some((f) => f.endsWith('.story')))
    .map((d) => d.name).sort();
}

/** A story file's act: its name without the order prefix (`2-thornwick.story` is `thornwick`). */
export const actOf = (file: string): string => file.replace(/\.story$/, '').replace(/^\d+-/, '');

/** One chapter's built scenes, as the file `scenes.gen.ts` should read. */
export function buildStories(chapter: string): string {
  const dir = join(MODULES_DIR, chapter);
  const files = readdirSync(dir).filter((f) => f.endsWith('.story')).sort();
  const scenes: Record<string, unknown> = {};
  const acts: Record<string, string> = {};
  for (const f of files) {
    for (const [id, sc] of Object.entries(parseStory(readFileSync(join(dir, f), 'utf8'), `${chapter}/${f}`))) {
      if (id in scenes) throw new Error(`${chapter}/${f}: '${id}' is already a scene in another file`);
      scenes[id] = sc;
      acts[id] = actOf(f);
    }
  }
  const { code, parts } = emitScenes(scenes);
  const hasParts = existsSync(join(dir, 'parts.ts'));
  if (parts.length && !hasParts) throw new Error(`${chapter}: the stories use ${parts.join(', ')}, and there is no parts.ts`);
  return [
    `// Built by \`npm run stories\` from ${chapter}/*.story. Edit those, not this.`,
    '/* eslint-disable */',
    `import type { Scene } from '../../../adventure/types.js';`,
    ...(code.includes('factValue(') ? [`import { factValue } from '../canon.js';`] : []),
    ...(code.includes('avoidedFightXP(') ? [`import { avoidedFightXP } from '../../encounters.js';`] : []),
    ...(parts.length ? [`import { ${parts.join(', ')} } from './parts.js';`] : []),
    '',
    'export const SCENES: Record<string, Scene> = {',
    code,
    '};',
    '',
    '/** Each scene\'s act: the file it is written in (Module.acts). */',
    `export const ACTS: Record<string, string> = ${JSON.stringify(acts, null, 2).replace(/\n/g, '\n')};`,
    '',
  ].join('\n');
}

function main() {
  for (const ch of storyChapters()) {
    const out = join(MODULES_DIR, ch, 'scenes.gen.ts');
    writeFileSync(out, buildStories(ch));
    console.log(`${ch}/scenes.gen.ts`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
