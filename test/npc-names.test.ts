/**
 * The trilogy's prose names its characters by token (`{wren}`), never by
 * typing the name, so a rename is one line in the registry. Comments may say
 * what they like.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { TRILOGY_NPCS } from '../src/data/modules/npcs.js';

const CHAPTERS = ['hollow-road', 'sunken-barrows', 'wyrmcalling'];
/** The source with comments blanked out (strings never hold `//` or `/*` here). */
const code = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"])\/\/.*$/gm, '$1');

describe('the trilogy names characters only by token', () => {
  for (const chapter of CHAPTERS) {
    it(chapter, () => {
      const src = code(readFileSync(new URL(`../src/data/modules/${chapter}.ts`, import.meta.url), 'utf8'));
      const typed = Object.values(TRILOGY_NPCS).flatMap((npc) =>
        src.split('\n').flatMap((line, i) => (new RegExp(`\\b${npc.name}\\b`).test(line) ? [`${i + 1}: ${npc.name}: ${line.trim().slice(0, 100)}`] : [])));
      expect(typed).toEqual([]);
    });
  }
});
