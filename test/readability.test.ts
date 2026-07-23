import { describe, it, expect } from 'vitest';
import { playableModules } from '../src/data/modules/index.js';
import { collectModuleProse, readabilityIssues, wordCount } from '../src/adventure/readability.js';

/**
 * Adventure prose is held to a plain, vivid modern-fantasy voice — clear enough
 * for a new or younger player reading on a phone mid-fight. A single grade score
 * doesn't catch every way writing gets hard to follow, so `readabilityIssues`
 * combines four signals: reading grade (≤ 8), no over-long sentences, no
 * clause pile-ups (stacked em-dashes / semicolons / colons), and no archaic
 * vocabulary. Short UI fragments aren't graded — the metrics are noisy on them.
 */
const MIN_WORDS = 6;

describe('adventure reading level', () => {
  for (const mod of playableModules()) {
    it(`${mod.id}: every passage reads plainly (grade ≤ 8, no sprawl or archaic words)`, () => {
      const flagged = collectModuleProse(mod)
        .filter((p) => wordCount(p.text) >= MIN_WORDS)
        .map((p) => ({ where: p.where, issues: readabilityIssues(p.text) }))
        .filter((p) => p.issues.length > 0);

      const report = flagged.map((p) => `  ${p.where}\n     ${p.issues.join('\n     ')}`).join('\n');
      expect(flagged.length, `passages with readability issues:\n${report}`).toBe(0);
    });
  }
});
