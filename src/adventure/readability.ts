/**
 * Reading-level tooling for adventure prose. New players (and younger ones)
 * have to *read* every scene, so the writing is held to roughly an 8th-grade
 * level — short sentences, plain words. This computes the Flesch–Kincaid grade
 * level of a passage and walks a module's prose so a test can flag anything
 * that drifts too hard to parse.
 *
 * Grade level = 0.39·(words/sentence) + 11.8·(syllables/word) − 15.59. The two
 * levers are sentence length and word length, so the fix for a failing passage
 * is almost always "split the long sentence", which is exactly what makes a
 * beat easier to follow on a phone mid-fight.
 */
import type { Module, Paragraph } from './types.js';

/** Strip the markdown and glyphs the UI renders, so scoring sees only prose. */
function plain(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '$1')   // bold
    .replace(/\*(.+?)\*/g, '$1')       // italic
    .replace(/[—–]/g, ' ')             // dashes → spaces (not sentence ends)
    .replace(/[^\p{L}\p{N}\s.!?,'-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** A rough but stable syllable count: vowel groups, with a few common
 *  adjustments (silent trailing 'e', short words count as one). */
export function countSyllables(word: string): number {
  const w = word.toLowerCase().replace(/[^a-z]/g, '');
  if (!w) return 0;
  if (w.length <= 3) return 1;
  const trimmed = w.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '').replace(/^y/, '');
  const groups = trimmed.match(/[aeiouy]{1,2}/g);
  return Math.max(1, groups ? groups.length : 1);
}

/** Flesch–Kincaid grade level for a passage (higher = harder). */
export function gradeLevel(text: string): number {
  const clean = plain(text);
  const sentences = Math.max(1, (clean.match(/[.!?]+/g) ?? []).length);
  const words = clean.split(/\s+/).filter(Boolean);
  if (words.length === 0) return 0;
  const syllables = words.reduce((sum, w) => sum + countSyllables(w), 0);
  return 0.39 * (words.length / sentences) + 11.8 * (syllables / words.length) - 15.59;
}

/** How many real words a passage has (short UI fragments — button labels, a
 *  two-word hint — aren't worth grading, so callers can skip them). */
export function wordCount(text: string): number {
  return plain(text).split(/\s+/).filter(Boolean).length;
}

export interface ProsePassage {
  /** Where it lives, for a failing-test message: `moduleId:sceneId:field`. */
  where: string;
  text: string;
}

/** Every substantial prose passage in a module — the narration a player reads,
 *  not the short choice/approach labels. */
export function collectModuleProse(mod: Module): ProsePassage[] {
  const out: ProsePassage[] = [];
  const add = (paras: Paragraph[] | undefined, where: string) => {
    for (const p of paras ?? []) out.push({ where, text: String(p) });
  };
  for (const scene of Object.values(mod.scenes)) {
    const at = `${mod.id}:${scene.id}`;
    if ('text' in scene) add(scene.text, `${at}:text`);
    if ('lines' in scene) add(scene.lines, `${at}:lines`);
    if ('intro' in scene) add(scene.intro, `${at}:intro`);
    if ('success' in scene && scene.success?.text) add(scene.success.text, `${at}:success`);
    if ('failure' in scene && scene.failure?.text) add(scene.failure.text, `${at}:failure`);
    if ('approaches' in scene) {
      for (const a of scene.approaches ?? []) {
        if (a.success?.text) add(a.success.text, `${at}:${a.id}:success`);
        if (a.failure?.text) add(a.failure.text, `${at}:${a.id}:failure`);
      }
    }
  }
  return out;
}
