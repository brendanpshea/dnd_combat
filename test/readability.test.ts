import { describe, it, expect } from 'vitest';
import { playableModules } from '../src/data/modules/index.js';
import {
  collectModuleProse, collectModuleLabels, readabilityIssues, wordCount,
  sentenceFragments, passiveConstructions, hardWordsIn,
} from '../src/adventure/readability.js';

/**
 * Adventure prose is held to a plain, vivid modern-fantasy voice — clear enough
 * for a new or younger player reading on a phone mid-fight. A single grade score
 * doesn't catch every way writing gets hard to follow, so `readabilityIssues`
 * combines six signals: reading grade (≤ 8), no over-long sentences, no clause
 * pile-ups (stacked em-dashes / semicolons / colons), no archaic vocabulary,
 * no verbless sentence fragments in narration (dialogue is exempt — people talk
 * in fragments), and no passive voice (active names the actor). The fragment
 * check takes two independent verb detectors (a POS tagger + a curated lexicon)
 * and flags only when both find nothing — precision over recall, so the lint
 * never bullies a good sentence. Short UI fragments aren't graded at all.
 */
const MIN_WORDS = 6;

describe('fragment + passive detectors (calibration)', () => {
  it('flags genuine verbless fragments in narration', () => {
    expect(sentenceFragments('The hall of the old dead kings.')).toHaveLength(1);
    expect(sentenceFragments('No carters, no herders, no birds.')).toHaveLength(1);
  });

  it('passes complete sentences, short punches, gerunds with auxiliaries, and dialogue', () => {
    expect(sentenceFragments('Cold light burns in its eye sockets.')).toHaveLength(0);
    expect(sentenceFragments('Raiders scramble out of the ditch.')).toHaveLength(0); // POS-ambiguous verb
    expect(sentenceFragments('The last cockatrice flops still.')).toHaveLength(0);
    expect(sentenceFragments('The **Undercrypt**.')).toHaveLength(0); // 1–2-word punch allowed
    expect(sentenceFragments('The fire is burning low.')).toHaveLength(0);
    expect(sentenceFragments('"Steel, then. No parley." The manticore sighs.')).toHaveLength(0); // dialogue exempt
  });

  it('flags passive voice but not actives or adjectival participles', () => {
    expect(passiveConstructions('The graves were opened from below.')).toHaveLength(1);
    expect(passiveConstructions('The road is watched by the Ashfang.')).toHaveLength(1);
    expect(passiveConstructions('Something opened the graves from below.')).toHaveLength(0);
    expect(passiveConstructions('She is tired and the gate is open.')).toHaveLength(0);
  });
});

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

/**
 * Buttons and map pins are read (and tapped) as much as any paragraph, but they
 * are too short to grade — a three-word label has no meaningful reading level.
 * So they get the vocabulary check alone. Without this, archaic words hid in
 * plain sight on the UI: "Slip over the palisade", "The Muster Yard".
 */
describe('adventure label vocabulary', () => {
  for (const mod of playableModules()) {
    it(`${mod.id}: buttons and map pins use plain words`, () => {
      const flagged = collectModuleLabels(mod)
        .map((p) => ({ where: p.where, text: p.text, words: hardWordsIn(p.text) }))
        .filter((p) => p.words.length > 0);

      const report = flagged.map((p) => `  ${p.where}: "${p.text}" → ${p.words.join(', ')}`).join('\n');
      expect(flagged.length, `labels with archaic words:\n${report}`).toBe(0);
    });
  }
});
