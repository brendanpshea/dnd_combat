import { describe, it, expect } from 'vitest';
import { playableModules } from '../src/data/modules/index.js';
import { collectModuleProse, gradeLevel, wordCount } from '../src/adventure/readability.js';

/**
 * Adventure prose is held to roughly an 8th-grade reading level: new and
 * younger players read every scene, often on a phone, so a beat that takes two
 * passes to parse is a real cost. Short UI fragments (a handful of words) aren't
 * worth grading — the metric is noisy on them — so only substantial passages
 * are checked.
 */
const GRADE_CEILING = 8;
const MIN_WORDS = 6;

describe('adventure reading level', () => {
  for (const mod of playableModules()) {
    it(`${mod.id}: every passage reads at or below grade ${GRADE_CEILING}`, () => {
      const tooHard = collectModuleProse(mod)
        .filter((p) => wordCount(p.text) >= MIN_WORDS)
        .map((p) => ({ ...p, grade: gradeLevel(p.text) }))
        .filter((p) => p.grade > GRADE_CEILING)
        .sort((a, b) => b.grade - a.grade);

      // A readable failure: name each passage, its grade, and a snippet.
      const report = tooHard.map((p) => `  [${p.grade.toFixed(1)}] ${p.where}\n     "${p.text.slice(0, 100)}${p.text.length > 100 ? '…' : ''}"`).join('\n');
      expect(tooHard.length, `passages above grade ${GRADE_CEILING}:\n${report}`).toBe(0);
    });
  }
});
