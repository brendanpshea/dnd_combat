/**
 * The trilogy's prose names its characters, and the places and groups in its
 * canon, by token (`{wren}`, `{thornwick}`), never by typing the name, so a
 * rename is one line in the registry. Comments may say what they like.
 * Number facts and common words ("lamb") are not linted: number words are
 * everywhere (test/canon-trilogy.test.ts checks those instead).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { TRILOGY_NPCS } from '../src/data/modules/npcs.js';
import { TRILOGY_FACTS } from '../src/data/modules/canon.js';

const CHAPTERS = ['hollow-road', 'sunken-barrows', 'wyrmcalling'];
/** The source with comments blanked out (strings never hold `//` or `/*` here). */
const code = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"])\/\/.*$/gm, '$1');
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** A registered name: a person's, or a fact that is a proper name (no
 *  number, capitalised: "Thornwick", "Barrow Gate"). */
const NAMES = [
  ...Object.values(TRILOGY_NPCS).map((npc) => npc.name),
  ...Object.values(TRILOGY_FACTS).filter((f) => f.value === undefined && /^[A-Z]/.test(f.text)).map((f) => f.text),
];

describe('the trilogy names characters, places and groups only by token', () => {
  it('lints the canon\'s place and group names too', () => {
    expect(NAMES).toEqual(expect.arrayContaining(['Thornwick', 'Wander-Inn', 'Ashfang', 'Calling', 'Undercrypt']));
  });
  for (const chapter of CHAPTERS) {
    it(chapter, () => {
      // The chapter's file, and its folder's stories and parts, where it has one.
      const dir = new URL(`../src/data/modules/${chapter}/`, import.meta.url);
      const files = [new URL(`../src/data/modules/${chapter}.ts`, import.meta.url),
        ...(existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith('.story') || f === 'parts.ts').map((f) => new URL(f, dir)) : [])];
      const typed = files.flatMap((file) => {
        const src = code(readFileSync(file, 'utf8'));
        const short = file.pathname.split('/modules/')[1];
        return NAMES.flatMap((name) => {
          const re = new RegExp(`(?<![\\w-])${escape(name)}(?![\\w-])`);
          return src.split('\n').flatMap((line, i) => (re.test(line) ? [`${short}:${i + 1}: ${name}: ${line.trim().slice(0, 100)}`] : []));
        });
      });
      expect(typed).toEqual([]);
    });
  }
});
